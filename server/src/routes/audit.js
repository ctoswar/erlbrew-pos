import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { queryAuditLogs } from '../services/audit.js';

export default function auditRouter(pool) {
  const router = Router();

  // GET /api/audit-logs — admin only
  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate, action, staffId, entityType, limit, offset } = req.query;
      const result = await queryAuditLogs(pool, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        action: action || undefined,
        staffId: staffId || undefined,
        entityType: entityType || undefined,
        limit: limit ? Number(limit) : 100,
        offset: offset ? Number(offset) : 0,
      });
      res.json(result);
    } catch (e) {
      console.error('Audit logs query failed:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
