import jwt from 'jsonwebtoken';
export const authMiddleware = (req, res, next) => {
  // Public routes are login; assume '/api/staff/login' open
  if (req.path === '/login' || req.path === '/' || req.url.startsWith('/login')) return next();
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
