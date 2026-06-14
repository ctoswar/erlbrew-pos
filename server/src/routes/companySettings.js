import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import express from 'express';
import { logAudit } from '../services/audit.js';

export default function companySettingsRouter(pool) {
  const router = Router();

  // Allow larger payloads (base64 logos can be several MB)
  router.use(express.json({ limit: '10mb' }));

  // GET all company settings
  router.get('/', async (req, res) => {
    try {
      const [settings] = await pool.execute(`SELECT * FROM company_settings`);
      const obj = {};
      settings.forEach(s => { obj[s.setting_key] = s.setting_value; });
      res.json(obj);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT update company settings (batch) - admin only
  router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
    const updates = req.body; // { setting_key: value, ... }
    try {
      for (const [key, value] of Object.entries(updates)) {
        await pool.execute(`
          INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `, [key, value || '']);
      }
      await logAudit(pool, req, { action: 'company_settings_update_batch', entityType: 'company_settings', entityId: null, details: { keys: Object.keys(updates) } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET single setting
  router.get('/:key', async (req, res) => {
    try {
      const [settings] = await pool.execute(
        `SELECT * FROM company_settings WHERE setting_key = ?`,
        [req.params.key]
      );
      if (!settings.length) return res.json({ value: '' });
      res.json({ value: settings[0].setting_value });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT single setting - admin only
  router.put('/:key', authMiddleware, adminMiddleware, async (req, res) => {
    const { value } = req.body;
    try {
      await pool.execute(`
        INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, [req.params.key, value || '']);
      await logAudit(pool, req, { action: 'company_settings_update', entityType: 'company_settings', entityId: req.params.key });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}