const jwt = require('jsonwebtoken');
require('dotenv').config();

// Authenticate user via Bearer token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // includes id, email, role
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Authorize by role(s)
const authorizeRoles = (...allowed) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

// Optionally authenticate if Authorization header is present; otherwise continue
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // ignore invalid token and proceed without user
  }
  next();
};

module.exports = { authenticate, authorizeRoles, optionalAuthenticate };
