import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { mkdirSync, existsSync, unlinkSync, createReadStream } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { logAudit } from '../db.js';
import { authMiddleware, checkDocOwnership } from '../middleware/auth.js';
import {
  validateFileSignature,
  sanitizeFilename,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
} from '../utils/fileValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadDir = join(__dirname, '..', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

const router = Router();
router.use(authMiddleware);

// List documents: regular users see only their own; admins/staff see system-wide or filtered
router.get('/', (req, res) => {
  const { search = '', limit = 100, offset = 0, user_id } = req.query;

  let query = 'SELECT id, user_id, name, text, file_path, file_size, mime_type, confidence, language, status, created_at AS date, updated_at FROM documents WHERE 1=1';
  const params = [];

  // Super Admin, Admin, and Staff can filter by user_id or see all
  if (['super_admin', 'admin', 'staff'].includes(req.user.role)) {
    if (user_id) {
      query += ' AND user_id=?';
      params.push(Number(user_id));
    }
  } else {
    // Normal user: strictly restricted to their own documents
    query += ' AND user_id=?';
    params.push(req.user.id);
  }

  if (search && typeof search === 'string') {
    query += ' AND (name LIKE ? OR text LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 100, Number(offset) || 0);

  const documents = db.prepare(query).all(...params);

  // Return clean list
  res.json({
    documents: documents.map(d => ({
      ...d,
      has_file: Boolean(d.file_path && existsSync(d.file_path))
    }))
  });
});

// Create text-only document (e.g. from browser OCR save)
router.post('/', (req, res) => {
  const { name, text, confidence = 0, language = 'eng+hin' } = req.body || {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 200 ||
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 500000
  ) {
    return res.status(400).json({
      error: 'Invalid document. Name is required and text must be between 1 and 500,000 characters.'
    });
  }

  const sanitizedName = sanitizeFilename(name.trim());
  const info = db.prepare(`
    INSERT INTO documents(user_id, name, text, confidence, language, status)
    VALUES(?, ?, ?, ?, ?, 'completed')
  `).run(
    req.user.id,
    sanitizedName,
    text,
    Number(confidence) || 0,
    String(language || 'eng+hin').slice(0, 30)
  );

  const doc = db.prepare(`
    SELECT id, user_id, name, text, file_path, file_size, mime_type, confidence, language, status, created_at AS date
    FROM documents WHERE id=?
  `).get(info.lastInsertRowid);

  logAudit(req.user.id, 'DOCUMENT_CREATED', `Saved document: ${sanitizedName} (ID: ${doc.id})`, req.ip);
  res.status(201).json({ document: doc });
});

// Secure file upload endpoint with Magic Bytes Signature Verification
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select an image or PDF.' });
    }

    const { buffer, originalname, size } = req.file;
    const clientExt = extname(originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(clientExt)) {
      return res.status(400).json({
        error: `Unsupported file extension (${clientExt}). Allowed: JPG, PNG, WEBP, PDF.`
      });
    }

    // Verify magic bytes signature
    const signatureCheck = validateFileSignature(buffer, originalname);
    if (!signatureCheck.valid) {
      return res.status(400).json({ error: signatureCheck.error });
    }

    const detectedMime = signatureCheck.detectedMime;
    const sanitizedOriginalName = sanitizeFilename(originalname);

    // Generate random UUID storage filename outside public root
    const randomName = `${crypto.randomUUID()}${clientExt}`;
    const targetPath = join(uploadDir, randomName);

    // Write file to disk
    const { writeFileSync } = await import('node:fs');
    writeFileSync(targetPath, buffer);

    const initialText = req.body?.text || '';
    const initialConfidence = Number(req.body?.confidence) || 0;
    const lang = req.body?.language || 'eng+hin';

    const info = db.prepare(`
      INSERT INTO documents(user_id, name, text, file_path, file_size, mime_type, confidence, language, status)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(
      req.user.id,
      sanitizedOriginalName,
      initialText,
      targetPath,
      size,
      detectedMime,
      initialConfidence,
      lang
    );

    const doc = db.prepare(`
      SELECT id, user_id, name, text, file_path, file_size, mime_type, confidence, language, status, created_at AS date
      FROM documents WHERE id=?
    `).get(info.lastInsertRowid);

    logAudit(req.user.id, 'FILE_UPLOADED', `Uploaded file ${sanitizedOriginalName} (${size} bytes, ${detectedMime})`, req.ip);

    res.status(201).json({
      document: {
        ...doc,
        has_file: true
      },
      message: 'File successfully uploaded and stored securely.'
    });
  } catch (err) {
    console.error('[Upload] Error processing file upload:', err);
    res.status(500).json({ error: 'Failed to process file upload.' });
  }
});

// Get document by ID with IDOR protection
router.get('/:id', checkDocOwnership, (req, res) => {
  const doc = req.targetDocument;
  res.json({
    document: {
      ...doc,
      has_file: Boolean(doc.file_path && existsSync(doc.file_path))
    }
  });
});

// Stream / download document source file with IDOR protection
router.get('/:id/file', checkDocOwnership, (req, res) => {
  const doc = req.targetDocument;

  if (!doc.file_path || !existsSync(doc.file_path)) {
    return res.status(404).json({ error: 'Source file is not available on server.' });
  }

  const mime = doc.mime_type || 'application/octet-stream';
  const download = req.query.download === 'true';

  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.name)}"`
  );

  const stream = createReadStream(doc.file_path);
  stream.on('error', (err) => {
    console.error('[Stream] Error streaming file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming file.' });
    }
  });
  stream.pipe(res);
});

// Update document text / name with IDOR protection
router.put('/:id', checkDocOwnership, (req, res) => {
  const { name, text, confidence, language } = req.body || {};
  const doc = req.targetDocument;

  if (typeof text !== 'string' || text.length > 500000) {
    return res.status(400).json({ error: 'Invalid document text (max 500,000 characters).' });
  }

  const updatedName = name && typeof name === 'string' && name.trim()
    ? sanitizeFilename(name.trim())
    : doc.name;

  db.prepare(`
    UPDATE documents
    SET name=?, text=?, confidence=?, language=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    updatedName,
    text,
    confidence !== undefined ? Number(confidence) : doc.confidence,
    language ? String(language).slice(0, 30) : doc.language,
    doc.id
  );

  const updated = db.prepare(`
    SELECT id, user_id, name, text, file_path, file_size, mime_type, confidence, language, status, created_at AS date, updated_at
    FROM documents WHERE id=?
  `).get(doc.id);

  logAudit(req.user.id, 'DOCUMENT_UPDATED', `Updated document ${doc.id} (${updatedName})`, req.ip);

  res.json({ document: updated });
});

// Delete document with IDOR protection
router.delete('/:id', checkDocOwnership, (req, res) => {
  const doc = req.targetDocument;

  // If there's an uploaded file on disk, remove it safely
  if (doc.file_path && existsSync(doc.file_path)) {
    try {
      unlinkSync(doc.file_path);
    } catch (err) {
      console.warn(`[Delete] Could not delete disk file ${doc.file_path}:`, err.message);
    }
  }

  db.prepare('DELETE FROM documents WHERE id=?').run(doc.id);
  logAudit(req.user.id, 'DOCUMENT_DELETED', `Deleted document ${doc.id} (${doc.name})`, req.ip);

  res.json({ ok: true, message: 'Document deleted successfully.' });
});

export default router;
