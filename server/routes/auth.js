import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import db, { logAudit } from '../db.js';
import { issueSession, clearSession, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Registration
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body || {};

  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 80 ||
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error: 'Please provide a valid name (2–80 chars), email address, and password (8–128 chars).'
    });
  }

  const normalized = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(normalized);
  if (existing) {
    return res.status(409).json({ error: 'This email is already registered.' });
  }

  // Count total users to determine if first user should be super_admin
  const userCount = db.prepare('SELECT count(*) as count FROM users').get()?.count || 0;
  const role = userCount === 0 ? 'super_admin' : 'user';

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare('INSERT INTO users(name, email, password_hash, role, status) VALUES(?,?,?,?,?)')
    .run(name.trim(), normalized, hash, role, 'active');

  const userId = Number(info.lastInsertRowid);
  const newUser = db.prepare('SELECT id, name, email, role, status FROM users WHERE id=?').get(userId);

  issueSession(res, newUser);
  logAudit(userId, 'USER_SIGNUP', `Registered with role: ${role}`, req.ip);

  res.status(201).json({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status
    }
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalized = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(normalized);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logAudit(user?.id || null, 'LOGIN_FAILED', `Failed login attempt for ${normalized}`, req.ip);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status === 'suspended') {
    logAudit(user.id, 'LOGIN_BLOCKED', 'Suspended account attempted login', req.ip);
    return res.status(403).json({ error: 'Account is suspended. Please contact administrator.' });
  }

  issueSession(res, user);
  logAudit(user.id, 'USER_LOGIN', 'User successfully logged in', req.ip);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
});

// Get current user session
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  if (req.user) {
    logAudit(req.user.id, 'USER_LOGOUT', 'User signed out', req.ip);
  }
  clearSession(res);
  res.json({ ok: true, message: 'Signed out successfully.' });
});

// Update Profile
router.put('/profile', authMiddleware, (req, res) => {
  const { name, currentPassword, newPassword } = req.body || {};

  if (name && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)) {
    return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  }

  const currentUser = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);

  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, currentUser.password_hash)) {
      return res.status(401).json({ error: 'Current password incorrect.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be 8–128 characters.' });
    }
    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET name=?, password_hash=?, updated_at=datetime('now') WHERE id=?")
      .run(name ? name.trim() : currentUser.name, newHash, req.user.id);
  } else if (name) {
    db.prepare("UPDATE users SET name=?, updated_at=datetime('now') WHERE id=?")
      .run(name.trim(), req.user.id);
  }

  const updated = db.prepare('SELECT id, name, email, role, status FROM users WHERE id=?').get(req.user.id);
  logAudit(req.user.id, 'PROFILE_UPDATE', 'Updated user profile/password', req.ip);

  res.json({ user: updated });
});

// Request Password Reset Token
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalized = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(normalized);

  // Always return success response to prevent email enumeration
  if (!user) {
    return res.json({ ok: true, message: 'If this email is registered, reset instructions have been generated.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare('INSERT INTO password_resets(user_id, token_hash, expires_at) VALUES(?,?,?)')
    .run(user.id, tokenHash, expiresAt);

  logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'Password reset token generated', req.ip);

  // Return resetToken in dev/demo mode so user can complete flow without SMTP setup
  res.json({
    ok: true,
    message: 'Password reset token generated.',
    devResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined
  });
});

// Execute Password Reset
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Valid reset token and password (min 8 chars) required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND used=0').get(tokenHash);

  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?")
    .run(newHash, record.user_id);
  db.prepare('UPDATE password_resets SET used=1 WHERE id=?').run(record.id);

  logAudit(record.user_id, 'PASSWORD_RESET_COMPLETED', 'Password was successfully reset', req.ip);

  res.json({ ok: true, message: 'Password has been successfully reset. You may now sign in.' });
});

export default router;
