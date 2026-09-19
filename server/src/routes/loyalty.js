import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { customerAuthMiddleware } from '../middleware/customerAuth.js';
import { logAudit } from '../services/audit.js';

export default function loyaltyRouter(pool) {
  const router = Router();

  // ── Rewards Catalog (public read, admin write) ────────────────────

  // GET /api/loyalty/rewards — list active rewards (public)
  router.get('/rewards', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, description, points_cost, emoji, is_active, created_at FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/loyalty/rewards/all — list ALL rewards including inactive (admin)
  router.get('/rewards/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, description, points_cost, emoji, is_active, created_at FROM loyalty_rewards ORDER BY points_cost ASC'
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/loyalty/rewards — create reward (admin only)
  router.post('/rewards', authMiddleware, adminMiddleware, async (req, res) => {
    const { title, description, points_cost, emoji } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!points_cost || typeof points_cost !== 'number' || points_cost <= 0) {
      return res.status(400).json({ error: 'points_cost must be a positive number' });
    }
    try {
      const [result] = await pool.query(
        'INSERT INTO loyalty_rewards (title, description, points_cost, emoji, is_active) VALUES (?, ?, ?, ?, 1)',
        [title, description || '', points_cost, emoji || '🎁']
      );
      await logAudit(pool, req, { action: 'reward_create', entityType: 'loyalty_reward', entityId: String(result.insertId), details: { title, points_cost } });
      res.json({ id: result.insertId, title, description: description || '', points_cost, emoji: emoji || '🎁', is_active: 1 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/loyalty/rewards/:id — update reward (admin only)
  router.put('/rewards/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, description, points_cost, emoji, is_active } = req.body;
    try {
      const fields = [];
      const vals = [];
      if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
      if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
      if (points_cost !== undefined) {
        if (typeof points_cost !== 'number' || points_cost <= 0) {
          return res.status(400).json({ error: 'points_cost must be a positive number' });
        }
        fields.push('points_cost = ?'); vals.push(points_cost);
      }
      if (emoji !== undefined) { fields.push('emoji = ?'); vals.push(emoji); }
      if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
      vals.push(id);
      await pool.query(`UPDATE loyalty_rewards SET ${fields.join(', ')} WHERE id = ?`, vals);
      await logAudit(pool, req, { action: 'reward_update', entityType: 'loyalty_reward', entityId: id, details: { title, points_cost } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // DELETE /api/loyalty/rewards/:id — deactivate reward (admin only)
  router.delete('/rewards/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('UPDATE loyalty_rewards SET is_active = 0 WHERE id = ?', [id]);
      await logAudit(pool, req, { action: 'reward_delete', entityType: 'loyalty_reward', entityId: id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // ── Redemption (customer auth required) ────────────────────────────

  // POST /api/loyalty/redeem — redeem a reward
  router.post('/redeem', customerAuthMiddleware, async (req, res) => {
    const { reward_id } = req.body;
    const customerId = req.customer.sub;

    if (!reward_id) {
      return res.status(400).json({ error: 'reward_id is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Check reward exists and is active
      const [rewards] = await conn.query(
        'SELECT id, title, points_cost, is_active FROM loyalty_rewards WHERE id = ?',
        [reward_id]
      );
      if (!rewards.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Reward not found' });
      }
      const reward = rewards[0];
      if (!reward.is_active) {
        await conn.rollback();
        return res.status(400).json({ error: 'Reward is no longer available' });
      }

      // 2. Check customer has enough points (lock row to prevent race conditions)
      const [customers] = await conn.query(
        'SELECT id, loyalty_points FROM customers WHERE id = ? FOR UPDATE',
        [customerId]
      );
      if (!customers.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Customer not found' });
      }
      const customer = customers[0];
      if (customer.loyalty_points < reward.points_cost) {
        await conn.rollback();
        return res.status(400).json({ error: `Not enough points. You have ${customer.loyalty_points}, need ${reward.points_cost}` });
      }

      // 3. Deduct points
      const newBalance = customer.loyalty_points - reward.points_cost;
      await conn.query(
        'UPDATE customers SET loyalty_points = ?, last_points_update = NOW() WHERE id = ?',
        [newBalance, customerId]
      );

      // 4. Insert redemption record
      await conn.query(
        'INSERT INTO loyalty_redemptions (customer_id, reward_id, points_spent) VALUES (?, ?, ?)',
        [customerId, reward_id, reward.points_cost]
      );

      // 5. Insert points log
      await conn.query(
        'INSERT INTO loyalty_points_log (customer_id, points, type, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, -reward.points_cost, 'redeemed', 'reward', String(reward_id), `Redeemed: ${reward.title}`]
      );

      // 6. Update tier based on new balance
      let tier = 'bronze';
      if (newBalance >= 5000) tier = 'platinum';
      else if (newBalance >= 2000) tier = 'gold';
      else if (newBalance >= 500) tier = 'silver';
      await conn.query(
        'UPDATE customers SET loyalty_tier = ? WHERE id = ?',
        [tier, customerId]
      );

      await conn.commit();

      await logAudit(pool, req, { action: 'reward_redeem', entityType: 'loyalty_redemption', entityId: String(reward_id), details: { customerId, pointsSpent: reward.points_cost, newBalance } });

      res.json({
        redemption: { reward_id, reward_title: reward.title, points_spent: reward.points_cost },
        balance: newBalance,
        tier,
      });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // GET /api/loyalty/my-redemptions — customer's redemption history
  router.get('/my-redemptions', customerAuthMiddleware, async (req, res) => {
    const customerId = req.customer.sub;
    try {
      const [rows] = await pool.query(
        `SELECT lr.id, lr.points_spent, lr.created_at,
                r.title, r.emoji, r.description
         FROM loyalty_redemptions lr
         JOIN loyalty_rewards r ON lr.reward_id = r.id
         WHERE lr.customer_id = ?
         ORDER BY lr.created_at DESC
         LIMIT 20`,
        [customerId]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
