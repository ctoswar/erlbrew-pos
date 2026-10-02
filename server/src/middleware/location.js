/**
 * Resolve the operational location for an authenticated request.
 *
 * Managers may select a location (or omit it to work across all locations).
 * Every other staff member must have an assigned location and cannot override
 * it with a query/body value supplied by the client.
 */
export async function locationScope(req, res, next) {
  let role = req.user?.role;
  let assignedLocationId = req.user?.location_id;
  const pool = req.app?.locals?.pool;
  const staffId = Number(req.user?.sub);

  if (pool && Number.isInteger(staffId) && staffId > 0) {
    try {
      const [rows] = await pool.query('SELECT role, location_id FROM staff WHERE id = ?', [staffId]);
      if (!rows.length) return res.status(401).json({ error: 'Staff account not found', code: 'STAFF_NOT_FOUND' });
      role = rows[0].role;
      assignedLocationId = rows[0].location_id;
    } catch (error) {
      console.error('Failed to resolve current staff location:', error);
      return res.status(500).json({ error: 'Failed to resolve staff location' });
    }
  }

  const requestedValue = req.query?.location_id ?? req.body?.location_id;
  const requestedLocationId = requestedValue === undefined || requestedValue === null || requestedValue === ''
    ? null
    : Number(requestedValue);

  if (requestedLocationId !== null && (!Number.isInteger(requestedLocationId) || requestedLocationId < 1)) {
    return res.status(400).json({ error: 'location_id must be a positive integer', code: 'INVALID_LOCATION' });
  }

  if (role === 'Manager') {
    req.locationId = requestedLocationId;
    return next();
  }

  assignedLocationId = Number(assignedLocationId);
  if (!Number.isInteger(assignedLocationId) || assignedLocationId < 1) {
    return res.status(403).json({
      error: 'Staff account is not assigned to a location',
      code: 'LOCATION_ASSIGNMENT_REQUIRED',
    });
  }

  if (requestedLocationId !== null && requestedLocationId !== assignedLocationId) {
    return res.status(403).json({
      error: 'Staff can only access their assigned location',
      code: 'LOCATION_FORBIDDEN',
    });
  }

  req.locationId = assignedLocationId;
  next();
}

/**
 * Require a concrete location for a write operation. A manager may read all
 * locations, but writes must always identify the branch being changed.
 */
export function requireLocationId(req, res, next) {
  if (req.locationId === null || req.locationId === undefined) {
    return res.status(400).json({
      error: 'location_id is required for this operation',
      code: 'LOCATION_REQUIRED',
    });
  }
  next();
}

/**
 * Build a SQL predicate for a previously resolved request scope.
 */
export function scopedLocationCondition(req, column = 'location_id') {
  if (req.locationId === null || req.locationId === undefined) {
    return { sql: '', params: [] };
  }
  return { sql: ` AND ${column} = ?`, params: [req.locationId] };
}
