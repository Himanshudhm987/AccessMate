import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let Database;
try {
  const { DatabaseSync } = await import('node:sqlite');
  Database = class extends DatabaseSync {
    pragma(str) {
      try {
        this.exec(`PRAGMA ${str};`);
      } catch (err) {
        console.warn(`[DB] PRAGMA ${str} warning:`, err.message);
      }
    }
  };
} catch {
  try {
    Database = (await import('better-sqlite3')).default;
  } catch (err) {
    throw new Error('No compatible SQLite driver found. Please use Node.js 22.5+ (which includes built-in node:sqlite) or install better-sqlite3.');
  }
}

const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'accessmate.db');
export const db = new Database(dbPath);

// Enable WAL mode and Foreign Keys for safety and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema migration runner
export function initDatabase() {
  // Base tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      confidence REAL DEFAULT 0,
      language TEXT DEFAULT 'eng+hin',
      status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrate existing tables if they were created before schema updates
  try {
    const userColumns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!userColumns.includes('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
    }
    if (!userColumns.includes('status')) {
      db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
    }
    if (!userColumns.includes('updated_at')) {
      db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT '';");
    }
  } catch (err) {
    console.error('[DB] Migration error on users table:', err.message);
  }

  try {
    const docColumns = db.prepare('PRAGMA table_info(documents)').all().map(c => c.name);
    if (!docColumns.includes('file_path')) {
      db.exec("ALTER TABLE documents ADD COLUMN file_path TEXT;");
    }
    if (!docColumns.includes('file_size')) {
      db.exec("ALTER TABLE documents ADD COLUMN file_size INTEGER DEFAULT 0;");
    }
    if (!docColumns.includes('mime_type')) {
      db.exec("ALTER TABLE documents ADD COLUMN mime_type TEXT;");
    }
    if (!docColumns.includes('confidence')) {
      db.exec("ALTER TABLE documents ADD COLUMN confidence REAL DEFAULT 0;");
    }
    if (!docColumns.includes('language')) {
      db.exec("ALTER TABLE documents ADD COLUMN language TEXT DEFAULT 'eng+hin';");
    }
    if (!docColumns.includes('status')) {
      db.exec("ALTER TABLE documents ADD COLUMN status TEXT DEFAULT 'completed';");
    }
    if (!docColumns.includes('updated_at')) {
      db.exec("ALTER TABLE documents ADD COLUMN updated_at TEXT DEFAULT '';");
    }
  } catch (err) {
    console.error('[DB] Migration error on documents table:', err.message);
  }

  // Ensure there is at least one active Super Admin if users exist
  try {
    const superAdmin = db.prepare("SELECT id FROM users WHERE role='super_admin' LIMIT 1").get();
    if (!superAdmin) {
      const firstUser = db.prepare("SELECT id, email FROM users ORDER BY id ASC LIMIT 1").get();
      if (firstUser) {
        db.prepare("UPDATE users SET role='super_admin' WHERE id=?").run(firstUser.id);
        console.log(`[DB] Promoted initial user (${firstUser.email}) to super_admin.`);
        logAudit(firstUser.id, 'SYSTEM_INIT', 'Initial user promoted to super_admin', '127.0.0.1');
      }
    }
  } catch (err) {
    console.error('[DB] Error checking super_admin role:', err.message);
  }
}

export function logAudit(userId, action, details, ipAddress = '') {
  try {
    db.prepare('INSERT INTO audit_logs(user_id, action, details, ip_address) VALUES(?,?,?,?)').run(
      userId || null,
      action,
      typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      ipAddress || ''
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err.message);
  }
}

initDatabase();
export default db;
