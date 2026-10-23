import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory first, then fallback
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config();

let Database;
try {
  Database = (await import('better-sqlite3')).default;
} catch {
  const { DatabaseSync } = await import('node:sqlite');
  Database = class extends DatabaseSync {
    pragma(str) {
      this.exec(`PRAGMA ${str};`);
    }
  };
}

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET.length < 32) {
  throw new Error('Set JWT_SECRET (32+ characters) in server/.env');
}

const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new Database(join(dataDir, 'accessmate.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const allowedOrigins = [
  ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    const origin = req.headers.origin;
    if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Invalid request origin' });
    }
  }
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const opts = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 604800000 };
const issue = (res, id) => res.cookie('accessmate_session', jwt.sign({ sub: id }, SECRET, { expiresIn: '7d' }), opts);

function auth(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.accessmate_session, SECRET, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(payload.sub);
    if (!user) throw Error('No user');
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in first' });
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'AccessMate API' }));

app.post('/api/auth/signup', limiter, (req, res) => {
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
    return res.status(400).json({ error: 'Enter a name, valid email and password of 8–128 characters' });
  }
  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(normalized)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim(), normalized, hash);
  issue(res, info.lastInsertRowid);
  res.status(201).json({ user: { id: Number(info.lastInsertRowid), name: name.trim(), email: normalized } });
});

app.post('/api/auth/login', limiter, (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  issue(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('accessmate_session', { httpOnly: true, sameSite: 'lax', secure: opts.secure, path: '/' });
  res.json({ ok: true });
});

app.get('/api/documents', auth, (req, res) => {
  res.json({ documents: db.prepare('SELECT id,name,text,created_at AS date FROM documents WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id) });
});

app.post('/api/documents', auth, (req, res) => {
  const { name, text } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.length > 200 || typeof text !== 'string' || !text.trim() || text.length > 100000) {
    return res.status(400).json({ error: 'Invalid document (maximum 100,000 characters)' });
  }
  const info = db.prepare('INSERT INTO documents(user_id,name,text) VALUES(?,?,?)').run(req.user.id, name.trim(), text);
  res.status(201).json({ document: db.prepare('SELECT id,name,text,created_at AS date FROM documents WHERE id=?').get(info.lastInsertRowid) });
});

app.delete('/api/documents/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM documents WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => console.log(`AccessMate API at http://localhost:${PORT}`));

export default server;
