import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { customerAuthMiddleware } from '../middleware/customerAuth.js';
import { logAudit } from '../services/audit.js';
import { MISSION_METRICS, MISSION_REPEATS, missionPeriod } from '../services/missions.js';

export default function loyaltyRouter(pool) {
  const router = Router();

  // Supported reward icon keys for the admin icon dropdown.
  // NULL / '' means the app infers the icon from the reward's name.
  const REWARD_ICON_KEYS = ['latte', 'matcha', 'coldbrew', 'pastry'];

  // Normalizes a request value: null (or '') → null (auto), a valid key →
  // the key, undefined (invalid) → undefined so routes can reject it.
  const normalizeRewardIconKey = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !REWARD_ICON_KEYS.includes(value)) {
      return undefined;
    }
    return value;
  };

  // Helper: tier from points balance (same thresholds as orders/customers)
  function tierFromPoints(points) {
    if (points >= 5000) return 'platinum';
    if (points >= 2000) return 'gold';
    if (points >= 500) return 'silver';
    return 'bronze';
  }

  // ── Missions engine helpers ─────────────────────────────────────────
  // Completed-order count driving the 'orders' metric. Mirrors the POS award
  // rule: only orders with status='completed' earn points/progress.
  const ordersProgress = async (conn, customerId, since) => {
    const [[{ count }]] = await conn.query(
      "SELECT COUNT(*) AS count FROM orders WHERE customer_id = ? AND status = 'completed' AND created_at >= ?",
      [customerId, since]
    );
    return Number(count);
  };

  function validateMissionInt(value, label) {
    if (!Number.isInteger(value) || value <= 0) return `${label} must be a positive integer`;
    return null;
  }

  // ── Rewards Catalog (public read, admin write) ────────────────────

  // GET /api/loyalty/rewards — list active rewards (public)
  router.get('/rewards', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, description, points_cost, emoji, icon_key, is_active, created_at FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
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
        'SELECT id, title, description, points_cost, emoji, icon_key, is_active, created_at FROM loyalty_rewards ORDER BY points_cost ASC'
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/loyalty/rewards — create reward (admin only)
  router.post('/rewards', authMiddleware, adminMiddleware, async (req, res) => {
    const { title, description, points_cost, emoji, icon_key } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!points_cost || typeof points_cost !== 'number' || points_cost <= 0) {
      return res.status(400).json({ error: 'points_cost must be a positive number' });
    }
    const iconKey = normalizeRewardIconKey(icon_key);
    if (iconKey === undefined) {
      return res.status(400).json({ error: `icon_key must be one of: ${REWARD_ICON_KEYS.join(', ')} or null` });
    }
    try {
      const [result] = await pool.query(
        'INSERT INTO loyalty_rewards (title, description, points_cost, emoji, icon_key, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [title, description || '', points_cost, emoji || '🎁', iconKey]
      );
      await logAudit(pool, req, { action: 'reward_create', entityType: 'loyalty_reward', entityId: String(result.insertId), details: { title, points_cost, icon_key: iconKey } });
      res.json({ id: result.insertId, title, description: description || '', points_cost, emoji: emoji || '🎁', icon_key: iconKey, is_active: 1 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/loyalty/rewards/:id — update reward (admin only)
  router.put('/rewards/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, description, points_cost, emoji, icon_key, is_active } = req.body;
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
      if (icon_key !== undefined) {
        const iconKey = normalizeRewardIconKey(icon_key);
        if (iconKey === undefined) {
          return res.status(400).json({ error: `icon_key must be one of: ${REWARD_ICON_KEYS.join(', ')} or null` });
        }
        fields.push('icon_key = ?'); vals.push(iconKey);
      }
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

  // DELETE /api/loyalty/rewards/:id — remove reward (admin only)
  // Rewards never redeemed are deleted outright. Rewards that appear in
  // redemption history are deactivated instead (`is_active = 0`) because
  // redemption history joins this table; they show up in the admin list as
  // "Inactive" rows rather than silently reappearing as active.
  router.delete('/rewards/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[{ count }]] = await conn.query(
        'SELECT COUNT(*) AS count FROM loyalty_redemptions WHERE reward_id = ?',
        [id]
      );
      const redeemed = Number(count) > 0;
      if (redeemed) {
        await conn.query('UPDATE loyalty_rewards SET is_active = 0 WHERE id = ?', [id]);
      } else {
        await conn.query('DELETE FROM loyalty_rewards WHERE id = ?', [id]);
      }
      await conn.commit();
      await logAudit(pool, req, {
        action: redeemed ? 'reward_deactivate' : 'reward_delete',
        entityType: 'loyalty_reward',
        entityId: id,
        details: redeemed ? { redemptions: Number(count) } : null,
      });
      res.json({ ok: true, deleted: !redeemed, deactivated: redeemed, redemptions: Number(count) });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // ── Missions (ZUS-style: earn points by completing challenges) ──────

  // GET /api/loyalty/missions — active missions + this customer's progress
  router.get('/missions', customerAuthMiddleware, async (req, res) => {
    const customerId = req.customer.sub;
    try {
      const [missions] = await pool.query(
        'SELECT id, title, description, emoji, metric, target, points_reward, repeat_interval, created_at FROM loyalty_missions WHERE is_active = 1 ORDER BY id ASC'
      );
      const [claims] = await pool.query(
        'SELECT mission_id, period_key FROM loyalty_mission_claims WHERE customer_id = ?',
        [customerId]
      );
      const claimedKeys = new Set(claims.map((c) => `${c.mission_id}:${c.period_key}`));

      const enriched = await Promise.all(
        missions.map(async (m) => {
          const period = missionPeriod(m, new Date());
          const progress = await ordersProgress(pool, customerId, period.start);
          return {
            ...m,
            period_key: period.key,
            progress,
            claimed: claimedKeys.has(`${m.id}:${period.key}`),
          };
        })
      );
      res.json(enriched);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/loyalty/missions/:id/claim — earn the mission's bonus points
  // Idempotent per period via the unique claims key, so double-taps and
  // retries cannot double-award.
  router.post('/missions/:id/claim', customerAuthMiddleware, async (req, res) => {
    const customerId = req.customer.sub;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[mission]] = await conn.query('SELECT * FROM loyalty_missions WHERE id = ? FOR UPDATE', [id]);
      if (!mission) {
        await conn.rollback();
        return res.status(404).json({ error: 'Mission not found' });
      }
      if (!mission.is_active) {
        await conn.rollback();
        return res.status(400).json({ error: 'Mission is no longer available' });
      }
      if (!MISSION_METRICS.includes(mission.metric)) {
        await conn.rollback();
        return res.status(400).json({ error: 'This mission type is no longer supported' });
      }

      const period = missionPeriod(mission, new Date());
      const progress = await ordersProgress(conn, customerId, period.start);
      if (progress < mission.target) {
        await conn.rollback();
        return res.status(400).json({ error: `Mission not complete yet (${progress}/${mission.target})` });
      }

      // Claim row first — the UNIQUE(customer, mission, period) constraint
      // rejects competing claims before any points move.
      try {
        await conn.query(
          'INSERT INTO loyalty_mission_claims (customer_id, mission_id, period_key, points_awarded) VALUES (?, ?, ?, ?)',
          [customerId, mission.id, period.key, mission.points_reward]
        );
      } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') {
          await conn.rollback();
          return res.status(409).json({ error: 'Already claimed for this period' });
        }
        throw e;
      }

      const [[customer]] = await conn.query(
        'SELECT id, loyalty_points FROM customers WHERE id = ? FOR UPDATE',
        [customerId]
      );
      if (!customer) {
        await conn.rollback();
        return res.status(404).json({ error: 'Customer not found' });
      }
      const newBalance = (Number(customer.loyalty_points) || 0) + mission.points_reward;
      await conn.query(
        'UPDATE customers SET loyalty_points = ?, last_points_update = NOW() WHERE id = ?',
        [newBalance, customerId]
      );
      await conn.query(
        `INSERT INTO loyalty_points_log (customer_id, points, type, reference_type, reference_id, notes)
         VALUES (?, ?, 'earned', 'mission', ?, ?)`,
        [customerId, mission.points_reward, `${mission.id}:${period.key}`, `Mission complete: ${mission.title}`]
      );
      const tier = tierFromPoints(newBalance);
      await conn.query('UPDATE customers SET loyalty_tier = ? WHERE id = ?', [tier, customerId]);
      await conn.commit();

      await logAudit(pool, req, {
        action: 'mission_claim',
        entityType: 'loyalty_mission',
        entityId: String(mission.id),
        details: { customerId, period: period.key, points: mission.points_reward },
      });
      res.json({
        ok: true,
        mission_id: mission.id,
        title: mission.title,
        points_awarded: mission.points_reward,
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

  // Admin mission CRUD ─────────────────────────────────────────────────

  // GET /api/loyalty/missions/all — ALL missions incl. inactive (admin)
  router.get('/missions/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, description, emoji, metric, target, points_reward, repeat_interval, is_active, created_at FROM loyalty_missions ORDER BY id ASC'
      );
      const [claimRows] = await pool.query(
        'SELECT mission_id, COUNT(*) AS claims FROM loyalty_mission_claims GROUP BY mission_id'
      );
      const claimsByMission = new Map(claimRows.map((r) => [r.mission_id, Number(r.claims)]));
      res.json(rows.map((r) => ({ ...r, total_claims: claimsByMission.get(r.id) || 0 })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/loyalty/missions — create mission (admin only)
  router.post('/missions', authMiddleware, adminMiddleware, async (req, res) => {
    const { title, description, emoji, metric, target, points_reward, repeat_interval, is_active } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (metric !== undefined && !MISSION_METRICS.includes(metric)) {
      return res.status(400).json({ error: `metric must be one of: ${MISSION_METRICS.join(', ')}` });
    }
    if (repeat_interval !== undefined && !MISSION_REPEATS.includes(repeat_interval)) {
      return res.status(400).json({ error: `repeat_interval must be one of: ${MISSION_REPEATS.join(', ')}` });
    }
    const intError = validateMissionInt(target, 'target') || validateMissionInt(points_reward, 'points_reward');
    if (intError) return res.status(400).json({ error: intError });
    let finalMetric = 'orders';
    if (metric !== undefined) finalMetric = metric;
    let finalRepeat = 'daily';
    if (repeat_interval !== undefined) finalRepeat = repeat_interval;
    let finalActive = 1;
    if (is_active !== undefined) finalActive = is_active ? 1 : 0;
    try {
      const [result] = await pool.query(
        `INSERT INTO loyalty_missions (title, description, emoji, metric, target, points_reward, repeat_interval, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', emoji || '🎯', finalMetric, target, points_reward, finalRepeat, finalActive]
      );
      await logAudit(pool, req, {
        action: 'mission_create',
        entityType: 'loyalty_mission',
        entityId: String(result.insertId),
        details: { title, metric: finalMetric, target, points_reward, repeat_interval: finalRepeat },
      });
      res.json({ id: result.insertId, title, description: description || '', emoji: emoji || '🎯', metric: finalMetric, target, points_reward, repeat_interval: finalRepeat, is_active: finalActive });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/loyalty/missions/:id — update mission (admin only)
  router.put('/missions/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, description, emoji, metric, target, points_reward, repeat_interval, is_active } = req.body;
    try {
      const fields = [];
      const vals = [];
      if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
      if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
      if (emoji !== undefined) { fields.push('emoji = ?'); vals.push(emoji); }
      if (metric !== undefined) {
        if (!MISSION_METRICS.includes(metric)) {
          return res.status(400).json({ error: `metric must be one of: ${MISSION_METRICS.join(', ')}` });
        }
        fields.push('metric = ?'); vals.push(metric);
      }
      if (target !== undefined) {
        const intError = validateMissionInt(target, 'target');
        if (intError) return res.status(400).json({ error: intError });
        fields.push('target = ?'); vals.push(target);
      }
      if (points_reward !== undefined) {
        const intError = validateMissionInt(points_reward, 'points_reward');
        if (intError) return res.status(400).json({ error: intError });
        fields.push('points_reward = ?'); vals.push(points_reward);
      }
      if (repeat_interval !== undefined) {
        if (!MISSION_REPEATS.includes(repeat_interval)) {
          return res.status(400).json({ error: `repeat_interval must be one of: ${MISSION_REPEATS.join(', ')}` });
        }
        fields.push('repeat_interval = ?'); vals.push(repeat_interval);
      }
      if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
      vals.push(id);
      await pool.query(`UPDATE loyalty_missions SET ${fields.join(', ')} WHERE id = ?`, vals);
      await logAudit(pool, req, { action: 'mission_update', entityType: 'loyalty_mission', entityId: id, details: { title, target, points_reward } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // DELETE /api/loyalty/missions/:id — remove mission (admin only).
  // Missions are engine records — nothing else references them, so the
  // mission and its claims ledger are dropped together.
  router.delete('/missions/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM loyalty_missions WHERE id = ?', [id]);
      await conn.query('DELETE FROM loyalty_mission_claims WHERE mission_id = ?', [id]);
      await conn.commit();
      await logAudit(pool, req, { action: 'mission_delete', entityType: 'loyalty_mission', entityId: id });
      res.json({ ok: true, deleted: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
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
                r.title, r.icon_key, r.emoji, r.description
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
