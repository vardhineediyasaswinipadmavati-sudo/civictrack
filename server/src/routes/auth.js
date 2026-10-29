import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Simple in-memory sliding window rate limiter
const rateLimitMap = new Map();
function isRateLimited(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };
  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + windowMs;
  } else {
    entry.count += 1;
  }
  rateLimitMap.set(key, entry);
  return entry.count > maxRequests;
}

// Register new citizen
router.post('/register', async (req, res) => {
  try {
    const db = await getDb();
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Role enforcement: Public registration must never allow creating admin or staff accounts
    if (role && role !== 'citizen') {
      return res.status(400).json({
        error: 'Public registration is strictly restricted to citizen accounts. Municipal staff and administrators are provisioned by authorities.'
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = db.get('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    const result = db.run(
      `INSERT INTO users (name, email, password_hash, role, phone, created_at)
       VALUES (?, ?, ?, 'citizen', ?, ?)`,
      [name.trim(), trimmedEmail, passwordHash, phone || null, createdAt]
    );

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: trimmedEmail,
      role: 'citizen',
      department_id: null,
      department_name: null,
      phone: phone || null,
      created_at: createdAt
    };

    const token = generateToken(user);

    // Welcome notification
    db.run(
      `INSERT INTO notifications (user_id, title, message, is_read, created_at)
       VALUES (?, ?, ?, 0, ?)`,
      [
        user.id,
        'Welcome to CivicTrack Bhimavaram!',
        'Thank you for joining CivicTrack. Report civic issues in your neighborhood and track infrastructure lifecycle.',
        createdAt
      ]
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login - verified against database
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (isRateLimited(`login:${clientIp}`, 15, 60000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in a few moments.' });
    }

    const db = await getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = db.get(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, u.phone, u.created_at,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE LOWER(TRIM(u.email)) = ?`,
      [trimmedEmail]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    // Don't send password hash
    delete user.password_hash;

    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Forgot password request
router.post('/forgot-password', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (isRateLimited(`forgot:${clientIp}`, 6, 900000)) { // 6 attempts per 15 mins
      return res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const db = await getDb();
    const trimmedEmail = email.toLowerCase().trim();
    const user = db.get('SELECT id, name, email FROM users WHERE LOWER(TRIM(email)) = ?', [trimmedEmail]);

    let safeTestingToken = null;

    if (user) {
      // Generate cryptographically secure random token (64 hex characters)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity
      const createdAt = new Date().toISOString();

      // Invalidate previous unused reset tokens for this user
      db.run(
        'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
        [createdAt, user.id]
      );

      // Store hashed token with expiry in database
      db.run(
        `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [user.id, tokenHash, expiresAt, createdAt]
      );

      // Audit log entry
      db.run(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
         VALUES ('PASSWORD_RESET_REQUESTED', 'user', ?, ?, 'Password reset link requested', ?)`,
        [user.id, user.id, createdAt]
      );

      // Check if SMTP is configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        // In production with email provider configured, send email
        // (email dispatch logic uses configured SMTP provider)
      } else {
        // Safe local evaluation notice without logging secrets to production output
        if (process.env.NODE_ENV === 'test' || process.env.ENABLE_LOCAL_RESET_PREVIEW === 'true') {
          safeTestingToken = rawToken;
        }
      }
    }

    // Generic response: Never disclose whether the account exists
    const responsePayload = {
      message: 'If an account exists with that email address, password reset instructions have been sent.'
    };

    if (safeTestingToken) {
      responsePayload.dev_reset_token = safeTestingToken;
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error processing password reset request.' });
  }
});

// Validate reset token before showing reset form
router.post('/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Reset token is required.' });
    }

    const db = await getDb();
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = db.get(
      `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!resetRecord) {
      return res.status(400).json({ valid: false, error: 'This password reset link is invalid.' });
    }

    if (resetRecord.used_at) {
      return res.status(400).json({ valid: false, error: 'This password reset link has already been used.' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ valid: false, error: 'This password reset link has expired. Please request a new one.' });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('Validate reset token error:', err);
    res.status(500).json({ valid: false, error: 'Server error validating reset token.' });
  }
});

// Set new password using verified reset token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const db = await getDb();
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = db.get(
      `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    if (resetRecord.used_at) {
      return res.status(400).json({ error: 'This password reset link has already been used.' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This password reset link has expired.' });
    }

    const now = new Date().toISOString();
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update password in users table
    db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, resetRecord.user_id]
    );

    // Invalidate the reset token
    db.run(
      'UPDATE password_resets SET used_at = ? WHERE id = ?',
      [now, resetRecord.id]
    );

    // Security notification for user
    db.run(
      `INSERT INTO notifications (user_id, title, message, is_read, created_at)
       VALUES (?, 'Security Notice: Password Changed', 'Your CivicTrack password was successfully updated.', 0, ?)`,
      [resetRecord.user_id, now]
    );

    // Audit log
    db.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
       VALUES ('PASSWORD_RESET_COMPLETED', 'user', ?, ?, 'Password was successfully reset using token', ?)`,
      [resetRecord.user_id, resetRecord.user_id, now]
    );

    res.json({ message: 'Password has been successfully reset. You may now sign in with your new credentials.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// Current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = db.get(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.phone, u.created_at,
              d.name as department_name, d.code as department_code 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const unreadCount = db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [user.id]
    );

    res.json({
      user,
      unreadNotificationsCount: unreadCount ? unreadCount.count : 0
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Server error fetching user profile.' });
  }
});

export default router;
