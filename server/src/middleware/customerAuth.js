import jwt from 'jsonwebtoken';

// Middleware to authenticate customer tokens (separate from staff auth)
export const customerAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token', code: 'NO_TOKEN' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token', code: 'NO_TOKEN' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Customer tokens have 'customer' claim to distinguish from staff tokens
    if (!decoded.customer) {
      return res.status(401).json({ error: 'Invalid customer token', code: 'INVALID_TOKEN' });
    }
    req.customer = decoded;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    if (e instanceof jwt.JsonWebTokenError) return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }
};
