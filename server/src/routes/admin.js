import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { Transform } from 'stream';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

// Helpers for Asia/Taipei (UTC+8) timestamps — matches the rest of the app
function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

export default function adminRouter(pool) {
  const router = Router();

  // One SQL backup download per user per minute (mysqldump is expensive on the Pi).
  // Keyed by the authenticated staff id (authMiddleware guarantees req.user).
  const backupLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1,
    keyGenerator: (req) => String(req.user?.sub ?? 'unknown'),
    message: { error: 'Backup rate limit reached — one SQL backup per minute. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Streaming transform: mariadb-dump does not skip MySQL 8 GENERATED ALWAYS
   * columns when writing INSERTs, so restoring fails with ERROR 3105
   * ("value specified for generated column ... is not allowed"). This
   * transform rewrites `--complete-insert` INSERT statements, removing the
   * generated columns from the column list and from each value tuple. The
   * restored schema keeps the generated definitions — only the computed
   * values are omitted.
   *
   * Pairs with --complete-insert (explicit column lists) and
   * --skip-extended-insert (one statement per line, so the transform stays
   * line-based and memory-flat).
   */
  function generatedColumnStripper(tablesMap) {
    let carry = '';
    let cur = null; // { tbl, drop: number[] }
    let warned = false;

    function splitTop(s) {
      const parts = [];
      let depth = 0, start = 0, inStr = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (ch === '\\') { i++; continue; }
          if (ch === "'") inStr = false;
        } else if (ch === "'") inStr = true;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
      }
      parts.push(s.slice(start));
      return parts;
    }

    function stripTuples(text) {
      const tuples = [];
      let depth = 0, start = -1, inStr = false, tail = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
          if (ch === '\\') { i++; continue; }
          if (ch === "'") inStr = false;
          continue;
        }
        if (ch === "'") { inStr = true; continue; }
        if (ch === '(') { if (depth === 0) start = i; depth++; continue; }
        if (ch === ')') {
          depth--;
          if (depth === 0) { tuples.push(text.slice(start, i + 1)); start = -1; }
          continue;
        }
        if (depth === 0 && ch === ';') { tail = text.slice(i); break; }
      }
      if (inStr) { cur = null; return text; } // unbalanced — pass through untouched
      const rebuilt = tuples.map((t) => {
        const vals = splitTop(t.slice(1, -1));
        return '(' + vals.filter((_, i) => !cur.drop.includes(i)).join(',') + ')';
      }).join(',');
      if (tail.includes(';')) cur = null;
      return rebuilt + tail.trim();
    }

    function processLine(line) {
      if (cur === null) {
        const m = line.match(/^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES ?/);
        if (m && tablesMap[m[1]]) {
          const cols = m[2].split('`, `').map((c) => c.replace(/`/g, ''));
          const keep = [], drop = [];
          cols.forEach((c, i) => (tablesMap[m[1]].includes(c) ? drop.push(i) : keep.push(c)));
          if (!drop.length) return line;
          cur = { tbl: m[1], drop: drop.sort((a, b) => b - a) };
          const prefix = `INSERT INTO \`${m[1]}\` (${keep.map((c) => '`' + c + '`').join(', ')}) VALUES `;
          return prefix + stripTuples(line.slice(m[0].length));
        }
        return line;
      }
      return stripTuples(line);
    }

    return new Transform({
      transform(chunk, enc, cb) {
        carry += chunk.toString('utf8');
        let idx;
        while ((idx = carry.indexOf('\n')) !== -1) {
          const line = carry.slice(0, idx);
          carry = carry.slice(idx + 1);
          try {
            this.push(processLine(line) + '\n');
          } catch (e) {
            // Never corrupt the backup on an unexpected format — emit as-is
            if (!warned) { warned = true; console.error('[backup/sql] transform fallback:', e.message); }
            this.push(line + '\n');
          }
        }
        cb();
      },
      flush(cb) {
        if (carry) {
          try { this.push(processLine(carry) + '\n'); }
          catch { this.push(carry + '\n'); }
        }
        cb();
      },
    });
  }

  // GET /api/admin/backup/sql — full MySQL dump as .sql.gz (Manager only).
  // Streams mysqldump stdout through gzip straight to the client (no buffering,
  // safe for the low-RAM Raspberry Pi). --single-transaction avoids table locks
  // so the POS keeps running during the dump. Credentials are passed via a
  // temp --defaults-extra-file, never as command-line arguments.
  router.get('/sql', authMiddleware, adminMiddleware, backupLimiter, async (req, res) => {
    const url = new URL(process.env.DATABASE_URL || '');
    const dbName = url.pathname.replace(/^\//, '');
    const dbUser = process.env.BACKUP_DB_USER || decodeURIComponent(url.username);
    const dbPass = process.env.BACKUP_DB_PASSWORD || decodeURIComponent(url.password);

    if (!dbName || !dbUser) {
      return res.status(500).json({ error: 'Database is not configured (DATABASE_URL missing or malformed)' });
    }

    const taipei = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const stamp = `${toDateOnly(taipei)}_${taipei.toISOString().slice(11, 13)}${taipei.toISOString().slice(14, 16)}`;
    const filename = `erlbrew-backup-${stamp}.sql.gz`;

    // Which tables have MySQL-8 generated columns? mariadb-dump writes values
    // for them (restores fail with ERROR 3105) — we strip them from the INSERTs.
    let genMap = {};
    try {
      const [rows] = await pool.query(
        "SELECT table_name AS tn, column_name AS cn FROM information_schema.columns WHERE table_schema = ? AND (extra LIKE 'VIRTUAL GENERATED%' OR extra LIKE 'STORED GENERATED%')",
        [dbName]
      );
      for (const r of rows) {
        (genMap[r.tn] = genMap[r.tn] || []).push(r.cn);
      }
    } catch (e) {
      console.warn('[backup/sql] could not list generated columns — dump will be untransformed:', e.message);
      genMap = {};
    }

    // Credentials via temp defaults-extra-file (chmod 600), never argv
    let cnfPath;
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erlbrew-dump-'));
      cnfPath = path.join(dir, 'client.cnf');
      fs.writeFileSync(
        cnfPath,
        `[client]\nhost=${url.hostname}\nport=${url.port || 3306}\nuser=${dbUser}\npassword="${String(dbPass).replace(/"/g, '\\"').replace(/[\r\n]/g, '')}"\n`
      );
      fs.chmodSync(cnfPath, 0o600);
    } catch (e) {
      console.error('[backup/sql] failed to write credentials file:', e.message);
      return res.status(500).json({ error: 'Failed to prepare database dump' });
    }

    const args = [
      `--defaults-extra-file=${cnfPath}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--no-tablespaces',
      '--quick',
      '--complete-insert',
      '--skip-extended-insert',
      '--ssl-verify-server-cert=0', // LAN MySQL with self-signed chain (matches app TLS policy)
      dbName,
    ];

    let committed = false;      // headers sent?
    let gzipBytes = 0;
    let stderrText = '';
    let started = false;

    const cleanup = () => { try { fs.rmSync(path.dirname(cnfPath), { recursive: true, force: true }); } catch { /* best effort */ } };

    const failBeforeCommit = (status, message) => {
      cleanup();
      if (!committed) {
        if (!res.headersSent) res.status(status).json({ error: message });
        else res.destroy();
      } else {
        // Dump died mid-stream — destroy the socket so the client's .gz is
        // invalid (gunzip fails) instead of silently truncated.
        res.destroy();
      }
    };

    const startDump = (bin) => {
      console.log(`[backup/sql] user=${req.user?.name} starting ${bin} → ${filename}`);
      const child = spawn(bin, args, { env: { ...process.env } });

      const gzip = zlib.createGzip({ level: 6 });

      child.stderr.on('data', (d) => {
        stderrText += d.toString();
        if (stderrText.length > 8192) stderrText = stderrText.slice(0, 8192);
      });

      // Gate: pipe starts immediately (the child's stdout pipe must be drained
      // or mysqldump blocks on write). Headers are committed on the first
      // chunk — a dump that fails before producing output (bad credentials,
      // unknown option) exits with an empty pipe, so we can still answer 500.
      const gate = new Transform({
        transform(chunk, enc, cb) {
          if (!committed) {
            committed = true;
            started = true;
            console.log(`[backup/sql] first data from ${bin} — committing ${filename}`);
            res.status(200).set({
              'Content-Type': 'application/gzip',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Cache-Control': 'no-store',
            });
          }
          cb(null, chunk);
        },
        flush(cb) { cb(); },
      });

      const stripper = generatedColumnStripper(genMap);
      gzip.on('data', (c) => { gzipBytes += c.length; });
      child.stdout.pipe(gate).pipe(stripper).pipe(gzip).pipe(res);

      // Success audit + log on stream finish (child exit can race the final flush)
      res.on('finish', () => {
        cleanup();
        logAudit(pool, req, {
          action: 'backup_sql_download',
          entityType: 'database',
          entityId: dbName,
          details: { file: filename, sizeBytes: gzipBytes },
        });
        console.log(`[backup/sql] completed: ${filename} (${gzipBytes} bytes gz)`);
      });

      child.on('error', (e) => {
        console.error(`[backup/sql] spawn error for ${bin}:`, e.message);
        if (!started && bin === 'mariadb-dump') {
          // Fallback: some images ship the Oracle binary name instead
          startDump('mysqldump');
        } else {
          failBeforeCommit(500, `mysqldump is not available on the server (${e.message}). Install mysql-client in the container.`);
        }
      });

      child.on('exit', (code) => {
        cleanup();
        if (code === 0) {
          // success audit happens on res 'finish' (above) once gzip has flushed
        } else if (!started) {
          const msg = (stderrText || '').trim().split('\n').pop() || `mysqldump exited with code ${code}`;
          console.error(`[backup/sql] failed before output (exit ${code}):`, stderrText);
          failBeforeCommit(500, `Database dump failed: ${msg.slice(0, 300)}`);
        } else {
          // Partial output already sent — abort so the file cannot decompress
          console.error(`[backup/sql] failed mid-stream (exit ${code}):`, stderrText.slice(0, 1000));
          gzip.destroy();
          res.destroy();
        }
      });
    };

    startDump(process.env.MYSQLDUMP_BIN || 'mariadb-dump');
  });

  return router;
}
