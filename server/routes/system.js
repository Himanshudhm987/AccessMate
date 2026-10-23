import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// Public Health Check Endpoint
router.get('/health', (_req, res) => {
  let dbStatus = 'connected';
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'AccessMate Secure API',
    version: '2.5.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// Admin / Super Admin System Metrics
router.get('/metrics', authMiddleware, requireRole(['super_admin', 'admin']), (_req, res) => {
  try {
    const userStats = db.prepare(`
      SELECT 
        count(*) as total,
        sum(case when role='super_admin' then 1 else 0 end) as super_admins,
        sum(case when role='admin' then 1 else 0 end) as admins,
        sum(case when role='staff' then 1 else 0 end) as staff,
        sum(case when role='user' then 1 else 0 end) as users,
        sum(case when status='active' then 1 else 0 end) as active,
        sum(case when status='suspended' then 1 else 0 end) as suspended
      FROM users
    `).get();

    const docStats = db.prepare(`
      SELECT 
        count(*) as total,
        sum(case when file_path IS NOT NULL then 1 else 0 end) as files_uploaded,
        sum(file_size) as total_bytes,
        avg(confidence) as avg_confidence
      FROM documents
    `).get();

    const auditCount = db.prepare('SELECT count(*) as count FROM audit_logs').get()?.count || 0;

    res.json({
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage()
      },
      users: userStats,
      documents: {
        ...docStats,
        total_mb: ((docStats?.total_bytes || 0) / (1024 * 1024)).toFixed(2)
      },
      auditLogsTotal: auditCount
    });
  } catch (err) {
    console.error('[Metrics] Error compiling system metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve system metrics.' });
  }
});

// Super Admin Only: System Audit Logs
router.get('/audit-logs', authMiddleware, requireRole('super_admin'), (req, res) => {
  const { limit = 50, offset = 0, action = '' } = req.query;

  let query = `
    SELECT 
      a.id, a.user_id, a.action, a.details, a.ip_address, a.created_at,
      u.email as user_email, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (action) {
    query += ' AND a.action LIKE ?';
    params.push(`%${action}%`);
  }

  query += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 50, Number(offset) || 0);

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT count(*) as count FROM audit_logs').get()?.count || 0;

  res.json({ logs, total });
});

export default router;
