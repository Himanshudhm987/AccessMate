import { extname, basename } from 'node:path';

/**
 * Validates a file buffer against known magic byte signatures.
 * Returns { valid: boolean, detectedMime: string | null, error?: string }
 */
export function validateFileSignature(buffer, originalname = '') {
  if (!buffer || buffer.length < 4) {
    return { valid: false, detectedMime: null, error: 'Empty or corrupt file payload.' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // 3. WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  // 4. PDF: %PDF (25 50 44 46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, detectedMime: 'application/pdf' };
  }

  return {
    valid: false,
    detectedMime: null,
    error: 'Unsupported file signature. Only JPEG, PNG, WEBP, and PDF documents are allowed.'
  };
}

/**
 * Sanitizes original filename to prevent path traversal or harmful characters.
 */
export function sanitizeFilename(name = 'document') {
  const base = basename(name).replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  const ext = extname(base).toLowerCase();
  const raw = base.slice(0, base.length - ext.length).trim().slice(0, 80) || 'document';
  return `${raw}${ext}`;
}

export const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
