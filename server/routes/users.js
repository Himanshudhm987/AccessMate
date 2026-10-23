import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Super Admin and Admin can access user management
router.use(authMiddleware);
router.use(requireRole(['super_admin', 'admin']));

// List users with search, role filter, status filter, and pagination
router.get('/', (req, res) => {
  const { search = '', role = '', status = '', limit = 50, offset = 0 } = req.query;

  let query = 'SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (role) {
    query += ' AND role=?';
    params.push(role);
  }

  if (status) {
    query += ' AND status=?';
    params.push(status);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 50, Number(offset) || 0);

  const users = db.prepare(query).all(...params);
  const total = db.prepare('SELECT count(*) as count FROM users').get()?.count || 0;

  res.json({ users, total });
});

// Get user by ID
router.get('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const user = db.prepare('SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE id=?').get(targetId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Create new user by Admin / Super Admin
router.post('/', (req, res) => {
  const { name, email, password, role = 'user' } = req.body || {};

  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, valid email, and password (min 8 chars) required.' });
  }

  // Admins cannot create Super Admins
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admins can create Super Admin accounts.' });
  }

  const allowedRoles = ['super_admin', 'admin', 'staff', 'user'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified.' });
  }

  const normalized = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(normalized);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare('INSERT INTO users(name, email, password_hash, role, status) VALUES(?,?,?,?,?)')
    .run(name.trim(), normalized, hash, role, 'active');

  const newUser = db.prepare('SELECT id, name, email, role, status FROM users WHERE id=?').get(info.lastInsertRowid);
  logAudit(req.user.id, 'USER_CREATED_BY_ADMIN', `Created user ${normalized} as ${role}`, req.ip);

  res.status(201).json({ user: newUser });
});

// Update user role or status
router.patch('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const { role, status, name } = req.body || {};

  const target = db.prepare('SELECT * FROM users WHERE id=?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Admin cannot modify Super Admin accounts or promote anyone to Super Admin
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admins can modify other Super Admins.' });
  }

  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admins can assign the super_admin role.' });
  }

  // CRITICAL SECURITY RULE: Prevent demotion or deactivation of the LAST active Super Admin!
  if (target.role === 'super_admin' && (role && role !== 'super_admin' || status === 'suspended')) {
    const superAdminCount = db.prepare("SELECT count(*) as count FROM users WHERE role='super_admin' AND status='active'").get()?.count || 0;
    if (superAdminCount <= 1) {
      return res.status(400).json({
        error: 'Forbidden: Cannot demote or suspend the last active Super Admin. System requires at least one active Super Admin.'
      });
    }
  }

  const updates = [];
  const params = [];

  if (name && typeof name === 'string' && name.trim().length >= 2) {
    updates.push('name=?');
    params.push(name.trim());
  }

  if (role) {
    const allowedRoles = ['super_admin', 'admin', 'staff', 'user'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    updates.push('role=?');
    params.push(role);
  }

  if (status) {
    const allowedStatuses = ['active', 'suspended'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updates.push('status=?');
    params.push(status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  updates.push("updated_at=datetime('now')");
  params.push(targetId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id=?`).run(...params);

  const updated = db.prepare('SELECT id, name, email, role, status, updated_at FROM users WHERE id=?').get(targetId);
  logAudit(req.user.id, 'USER_MODIFIED', `Updated user ${target.email}: ${JSON.stringify({ role, status })}`, req.ip);

  res.json({ user: updated });
});

// Delete user
router.delete('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(targetId);

  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Admin cannot delete Super Admin accounts
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admins can delete Super Admin accounts.' });
  }

  // Prevent deleting the last active Super Admin
  if (target.role === 'super_admin') {
    const superAdminCount = db.prepare("SELECT count(*) as count FROM users WHERE role='super_admin' AND status='active'").get()?.count || 0;
    if (superAdminCount <= 1) {
      return res.status(400).json({
        error: 'Forbidden: Cannot delete the last active Super Admin account.'
      });
    }
  }

  db.prepare('DELETE FROM users WHERE id=?').run(targetId);
  logAudit(req.user.id, 'USER_DELETED', `Deleted user ${target.email} (id: ${targetId})`, req.ip);

  res.json({ ok: true, message: `User ${target.email} deleted successfully.` });
});

export default router;
