import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && (!secret || secret === 'civictrack-super-secret-jwt-key-2024')) {
    console.error('CRITICAL SECURITY CONFIGURATION ERROR: A strong, dedicated JWT_SECRET environment variable is strictly required in production mode.');
  }
  return secret || 'civictrack-super-secret-jwt-key-2024';
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id || null,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }
    req.user = user;
    next();
  });
}

// Optional authentication middleware for public endpoints with personalized filters
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return next();
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  });
}

// Role-based authorization middleware
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const normalize = (r) => (r === 'staff' ? 'department_staff' : r);
    const normalizedAllowed = allowedRoles.map(normalize);
    const userRole = normalize(req.user.role);

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ 
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}` 
      });
    }

    next();
  };
}
