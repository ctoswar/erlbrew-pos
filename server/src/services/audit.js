// Audit log service — fire-and-forget logging for admin/manager actions
// Usage: logAudit(pool, req, { action, entityType, entityId, details })

/**
 * Log an audit event. Never throws — failures are silently logged to console.
 */
export async function logAudit(pool, req, { action, entityType, entityId, details }) {
  try {
    const staffId = req.user?.sub ?? req.user?.id ?? null;
    const staffName = req.user?.name ?? null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const detailsJson = details ? JSON.stringify(details) : null;

    await pool.query(
      `INSERT INTO audit_logs
        (staff_id, staff_name, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, staffName, action, entityType || null, entityId || null, detailsJson, ip]
    );
  } catch (e) {
    console.error('Audit log failed (non-critical):', e.message);
  }
}

/**
 * Query audit logs with optional filters.
 */
export async function queryAuditLogs(pool, { startDate, endDate, action, staffId, entityType, limit = 100, offset = 0 }) {
  const conditions = [];
  const values = [];

  if (startDate) { conditions.push('DATE(created_at) >= ?'); values.push(startDate); }
  if (endDate) { conditions.push('DATE(created_at) <= ?'); values.push(endDate); }
  if (action) { conditions.push('action = ?'); values.push(action); }
  if (staffId) { conditions.push('staff_id = ?'); values.push(staffId); }
  if (entityType) { conditions.push('entity_type = ?'); values.push(entityType); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
    values
  );

  return { logs: rows, total: countRows[0]?.total || 0 };
}
