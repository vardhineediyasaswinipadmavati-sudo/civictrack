import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Department, PasswordReset, Notification, AuditLog } from '../models/index.js';
import { generateToken, authenticateToken, requireRole } from '../middleware/auth.js';
import { getSmtpConfig, getCanonicalAppUrl, sendPasswordResetEmail } from '../services/emailService.js';
import { connectMongo } from '../db/connection.js';

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
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Role enforcement: Public registration must never allow creating admin or staff accounts
    if (role && role !== 'citizen') {
      return res.status(400).json({
        error: 'Public registration is strictly restricted to citizen accounts. Municipal staff and administrators are provisioned by authorities.'
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: passwordHash,
      role: 'citizen',
      department_id: null,
      phone: phone || null
    });

    const userObj = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department_id: null,
      department_name: null,
      phone: newUser.phone || null,
      created_at: newUser.created_at
    };

    const token = generateToken(userObj);

    // Welcome notification
    await Notification.create({
      user_id: newUser._id,
      title: 'Welcome to CivicTrack Bhimavaram!',
      message: 'Thank you for joining CivicTrack. Report civic issues in your neighborhood and track infrastructure lifecycle.',
      is_read: false
    });

    res.status(201).json({ user: userObj, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login - verified against MongoDB with role matching verification
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (isRateLimited(`login:${clientIp}`, 15, 60000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in a few moments.' });
    }

    const { email, password, role, selectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const userDoc = await User.findOne({ email: trimmedEmail }).populate('department_id');

    if (!userDoc) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, userDoc.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (userDoc.is_active === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact municipal administration.' });
    }

    // Role verification: If user selected Citizen, Staff, or Admin at login,
    // verify the authenticated account actually possesses the requested role.
    const portalRole = role || selectedRole;
    if (portalRole) {
      const normalizedPortal = portalRole === 'staff' ? 'department_staff' : portalRole;
      const userRole = userDoc.role === 'staff' ? 'department_staff' : userDoc.role;
      if (userRole !== normalizedPortal) {
        const roleLabels = {
          citizen: 'Citizen',
          department_staff: 'Staff',
          admin: 'Administrator'
        };
        const actualLabel = roleLabels[userRole] || userRole;
        const requestedLabel = roleLabels[normalizedPortal] || portalRole;
        return res.status(403).json({
          error: `Access denied. This account is registered as a ${actualLabel}, not an authorized ${requestedLabel}. Please switch to the ${actualLabel} portal.`
        });
      }
    }

    const dept = userDoc.department_id;
    const deptId = dept ? (dept._id ? dept._id.toString() : dept.toString()) : null;
    const deptName = dept && dept.name ? dept.name : null;
    const deptCode = dept && dept.code ? dept.code : null;

    const user = {
      id: (userDoc._id || userDoc.id || '').toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      department_id: deptId,
      department_name: deptName,
      department_code: deptCode,
      phone: userDoc.phone || null,
      created_at: userDoc.created_at
    };

    const token = generateToken(user);

    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError' || err.name === 'MongooseError' || err.message?.includes('buffering timed out')) {
      return res.status(503).json({
        error: 'Municipal database service is currently unreachable. Please verify MongoDB Atlas network connectivity.'
      });
    }
    res.status(500).json({ error: 'Server error during login. Please try again shortly.' });
  }
});

// Forgot password request - strictly protects token secrecy and account enumeration
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

    const trimmedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: trimmedEmail });
    const smtpConfig = getSmtpConfig();

    if (user && smtpConfig.configured) {
      let tokenHash = null;
      try {
        // Generate cryptographically secure random token (256-bit entropy)
        const rawToken = crypto.randomBytes(32).toString('hex');
        tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity
        const now = new Date();

        // Invalidate previous unused reset tokens for this user
        await PasswordReset.updateMany(
          { user_id: user._id, used_at: null },
          { used_at: now }
        );

        // Store hashed token with expiry in database - raw token is NEVER stored
        await PasswordReset.create({
          user_id: user._id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: now
        });

        // Audit log entry
        await AuditLog.create({
          action: 'PASSWORD_RESET_REQUESTED',
          entity_type: 'user',
          entity_id: user._id,
          user_id: user._id,
          details: 'Password reset link requested',
          created_at: now
        });

        // Deliver email using canonical APP_URL
        const canonicalBaseUrl = getCanonicalAppUrl();
        const resetUrl = `${canonicalBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
        const deliveryResult = await sendPasswordResetEmail({ to: user.email, resetUrl });

        if (!deliveryResult.success) {
          const failureTime = new Date();

          // Immediately invalidate newly generated reset token so it cannot remain usable
          await PasswordReset.updateOne(
            { token_hash: tokenHash },
            { used_at: failureTime, expires_at: failureTime }
          );

          await AuditLog.create({
            action: 'PASSWORD_RESET_DELIVERY_FAILED',
            entity_type: 'user',
            entity_id: user._id,
            user_id: user._id,
            details: 'Password reset email delivery failed; token invalidated',
            created_at: failureTime
          });

          // Detailed delivery errors in server-side logs ONLY - never log raw tokens, reset URLs, passwords, or credentials
          console.error(`Password reset email delivery failed for user ${user._id}:`, deliveryResult.error || 'Unknown transport error');
        }
      } catch (userErr) {
        // If an unexpected error occurred, invalidate any created token so it cannot remain usable
        if (tokenHash) {
          try {
            const errTime = new Date();
            await PasswordReset.updateOne(
              { token_hash: tokenHash },
              { used_at: errTime, expires_at: errTime }
            );
          } catch (_) {}
        }
        console.error(`Unexpected error processing password reset for user ${user._id}:`, userErr.message || userErr);
      }
    }

    // Strictly prevent account enumeration across all outcomes (existing accounts, nonexistent accounts,
    // SMTP delivery failures, and unexpected errors receive identical HTTP status codes and payloads).
    // NEVER expose raw reset tokens or reset URLs in HTTP responses.
    if (smtpConfig.configured) {
      return res.json({
        message: 'If an account exists with that email address, password reset instructions have been sent.',
        email_service_configured: true
      });
    }

    return res.json({
      message: 'If an account exists with that email address, password reset instructions have been processed.',
      email_service_configured: false,
      notice: 'Outgoing SMTP email service is not configured on this server environment.',
      required_env: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    });
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

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = await PasswordReset.findOne({ token_hash: tokenHash });

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

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = await PasswordReset.findOne({ token_hash: tokenHash });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    if (resetRecord.used_at) {
      return res.status(400).json({ error: 'This password reset link has already been used.' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This password reset link has expired.' });
    }

    const now = new Date();
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update password in users collection
    await User.updateOne(
      { _id: resetRecord.user_id },
      { password_hash: newPasswordHash }
    );

    // Invalidate the reset token
    await PasswordReset.updateOne(
      { _id: resetRecord._id },
      { used_at: now }
    );

    // Security notification for user
    await Notification.create({
      user_id: resetRecord.user_id,
      title: 'Security Notice: Password Changed',
      message: 'Your CivicTrack password was successfully updated.',
      is_read: false
    });

    // Audit log
    await AuditLog.create({
      action: 'PASSWORD_RESET_COMPLETED',
      entity_type: 'user',
      entity_id: resetRecord.user_id,
      user_id: resetRecord.user_id,
      details: 'Password was successfully reset using token'
    });

    res.json({ message: 'Password has been successfully reset. You may now sign in with your new credentials.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// Current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).populate('department_id');

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const dept = userDoc.department_id;
    const deptId = dept ? (dept._id ? dept._id.toString() : dept.toString()) : null;
    const deptName = dept && dept.name ? dept.name : null;
    const deptCode = dept && dept.code ? dept.code : null;

    const user = {
      id: (userDoc._id || userDoc.id || '').toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      department_id: deptId,
      department_name: deptName,
      department_code: deptCode,
      phone: userDoc.phone || null,
      created_at: userDoc.created_at
    };

    let unreadCount = 0;
    try {
      unreadCount = await Notification.countDocuments({ user_id: userDoc._id, is_read: false });
    } catch (countErr) {
      console.warn('Notification count error in profile:', countErr.message);
    }

    res.json({
      user,
      unreadNotificationsCount: unreadCount
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError' || err.name === 'MongooseError' || err.message?.includes('buffering timed out')) {
      return res.status(503).json({
        error: 'Municipal database service is currently unreachable.'
      });
    }
    res.status(500).json({ error: 'Server error fetching user profile.' });
  }
});

// Provision new Admin or Staff account (Authorized Administrator Only)
router.post('/provision', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, department_id, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required for provisioning.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedRole = role === 'staff' ? 'department_staff' : role;
    if (!['admin', 'department_staff'].includes(normalizedRole)) {
      return res.status(400).json({
        error: 'Only administrative and municipal staff accounts can be provisioned through this portal. Citizens register via the public citizen portal.'
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    let assignedDeptId = null;
    let deptName = null;
    let deptCode = null;

    if (normalizedRole === 'department_staff') {
      if (!department_id) {
        return res.status(400).json({ error: 'A valid municipal department is required when provisioning staff accounts.' });
      }

      let dept = null;
      if (mongoose.Types.ObjectId.isValid(department_id)) {
        dept = await Department.findById(department_id);
      }
      if (!dept) {
        dept = await Department.findOne({
          $or: [
            { code: department_id.toString().toUpperCase() },
            { legacy_id: Number(department_id) || -1 }
          ]
        });
      }

      if (!dept) {
        return res.status(400).json({ error: 'Selected department does not exist in municipal records.' });
      }

      assignedDeptId = dept._id;
      deptName = dept.name;
      deptCode = dept.code;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: passwordHash,
      role: normalizedRole,
      department_id: assignedDeptId,
      phone: phone ? phone.trim() : null,
      is_active: true
    });

    // Create Audit Log entry
    await AuditLog.create({
      action: 'MUNICIPAL_USER_PROVISIONED',
      entity_type: 'user',
      entity_id: newUser._id,
      user_id: req.user.id,
      details: `Administrator provisioned new ${normalizedRole} account for ${newUser.name} (${newUser.email})`
    });

    // Security notification for new user
    await Notification.create({
      user_id: newUser._id,
      title: 'Municipal Account Provisioned',
      message: `Your CivicTrack municipal ${normalizedRole === 'admin' ? 'Administrator' : 'Department Staff'} account is now active.`,
      is_read: false
    });

    const userObj = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department_id: assignedDeptId ? assignedDeptId.toString() : null,
      department_name: deptName,
      department_code: deptCode,
      phone: newUser.phone,
      is_active: newUser.is_active,
      created_at: newUser.created_at
    };

    res.status(201).json({
      message: `${normalizedRole === 'admin' ? 'Administrator' : 'Department Staff'} account provisioned successfully.`,
      user: userObj
    });
  } catch (err) {
    console.error('Account provisioning error:', err);
    res.status(500).json({ error: 'Server error during account provisioning.' });
  }
});

// Alias for REST convention
router.post('/users', authenticateToken, requireRole('admin'), async (req, res, next) => {
  // Delegate directly to the provisioning logic
  try {
    const { name, email, password, role, department_id, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required for provisioning.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedRole = role === 'staff' ? 'department_staff' : role;
    if (!['admin', 'department_staff'].includes(normalizedRole)) {
      return res.status(400).json({
        error: 'Only administrative and municipal staff accounts can be provisioned through this portal. Citizens register via the public citizen portal.'
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    let assignedDeptId = null;
    let deptName = null;
    let deptCode = null;

    if (normalizedRole === 'department_staff') {
      if (!department_id) {
        return res.status(400).json({ error: 'A valid municipal department is required when provisioning staff accounts.' });
      }

      let dept = null;
      if (mongoose.Types.ObjectId.isValid(department_id)) {
        dept = await Department.findById(department_id);
      }
      if (!dept) {
        dept = await Department.findOne({
          $or: [
            { code: department_id.toString().toUpperCase() },
            { legacy_id: Number(department_id) || -1 }
          ]
        });
      }

      if (!dept) {
        return res.status(400).json({ error: 'Selected department does not exist in municipal records.' });
      }

      assignedDeptId = dept._id;
      deptName = dept.name;
      deptCode = dept.code;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: passwordHash,
      role: normalizedRole,
      department_id: assignedDeptId,
      phone: phone ? phone.trim() : null,
      is_active: true
    });

    await AuditLog.create({
      action: 'MUNICIPAL_USER_PROVISIONED',
      entity_type: 'user',
      entity_id: newUser._id,
      user_id: req.user.id,
      details: `Administrator provisioned new ${normalizedRole} account for ${newUser.name} (${newUser.email})`
    });

    await Notification.create({
      user_id: newUser._id,
      title: 'Municipal Account Provisioned',
      message: `Your CivicTrack municipal ${normalizedRole === 'admin' ? 'Administrator' : 'Department Staff'} account is now active.`,
      is_read: false
    });

    const userObj = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department_id: assignedDeptId ? assignedDeptId.toString() : null,
      department_name: deptName,
      department_code: deptCode,
      phone: newUser.phone,
      is_active: newUser.is_active,
      created_at: newUser.created_at
    };

    res.status(201).json({
      message: `${normalizedRole === 'admin' ? 'Administrator' : 'Department Staff'} account provisioned successfully.`,
      user: userObj
    });
  } catch (err) {
    console.error('Account provisioning error:', err);
    res.status(500).json({ error: 'Server error during account provisioning.' });
  }
});

// List municipal users (Authorized Administrator Only)
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) {
      filter.role = role === 'staff' ? 'department_staff' : role;
    }

    const users = await User.find(filter)
      .select('-password_hash')
      .populate('department_id', 'name code')
      .sort({ created_at: -1 });

    const formatted = users.map((u) => {
      const dept = u.department_id;
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        department_id: dept ? dept._id.toString() : null,
        department_name: dept ? dept.name : null,
        department_code: dept ? dept.code : null,
        phone: u.phone,
        is_active: u.is_active,
        created_at: u.created_at
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Server error fetching municipal users.' });
  }
});

export default router;
