import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  // Public routes: staff login and root
  if (req.path === '/login' || req.url === '/api/staff/login') return next();
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token', code: 'NO_TOKEN' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token', code: 'NO_TOKEN' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    if (e instanceof jwt.JsonWebTokenError) return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }
};

// Middleware to restrict routes to Manager role only
export const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'Manager') {
    return res.status(403).json({ error: 'Admin access only', code: 'FORBIDDEN' });
  }
  next();
};
