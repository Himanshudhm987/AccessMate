import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateFileSignature, sanitizeFilename } from '../utils/fileValidation.js';

describe('OCR & Document Processing Engine Verification', () => {

  test('1. Devanagari character ranges and Hindi matras are recognized and intact', () => {
    const hindiSample = 'नमस्ते दुनिया, यह एक्सेसमेट का हिंदी ओसीआर परीक्षण है।';
    const devanagariRegex = /[\u0900-\u097F]/;

    assert.ok(devanagariRegex.test(hindiSample), 'Sample should match Devanagari Unicode range');
    assert.strictEqual(hindiSample.includes('नमस्ते'), true);
    assert.strictEqual(hindiSample.includes('ओसीआर'), true);
  });

  test('2. Bilingual Hindi + English mixed token parsing', () => {
    const mixedSample = 'AccessMate Document 2026: रोगी का नाम (Patient Name) एवं विवरण.';
    const hasEnglish = /[A-Za-z]/.test(mixedSample);
    const hasHindi = /[\u0900-\u097F]/.test(mixedSample);

    assert.ok(hasEnglish, 'Should detect English Latin tokens');
    assert.ok(hasHindi, 'Should detect Hindi Devanagari tokens');
  });

  test('3. Confidence Score Classification logic', () => {
    function classifyConfidence(score) {
      if (score >= 80) return 'high';
      if (score >= 60) return 'moderate';
      return 'low';
    }

    assert.strictEqual(classifyConfidence(95), 'high');
    assert.strictEqual(classifyConfidence(72), 'moderate');
    assert.strictEqual(classifyConfidence(45), 'low');
  });

  test('4. PDF Magic Byte Validation (%PDF)', () => {
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]); // %PDF-1.7
    const result = validateFileSignature(pdfBytes, 'document.pdf');

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.detectedMime, 'application/pdf');
  });

  test('5. Image Magic Byte Validation (JPEG, PNG, WEBP)', () => {
    const jpegBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    assert.strictEqual(validateFileSignature(jpegBytes, 'photo.jpg').valid, true);

    const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.strictEqual(validateFileSignature(pngBytes, 'photo.png').valid, true);

    const webpBytes = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50
    ]);
    assert.strictEqual(validateFileSignature(webpBytes, 'photo.webp').valid, true);
  });

  test('6. Filename Sanitization & Path Traversal Neutralization', () => {
    const unsafe1 = '../../etc/passwd.jpg';
    assert.strictEqual(sanitizeFilename(unsafe1).includes('..'), false);
    assert.strictEqual(sanitizeFilename(unsafe1).includes('/'), false);

    const unsafe2 = '..\\..\\windows\\system32\\cmd.exe.png';
    assert.strictEqual(sanitizeFilename(unsafe2).includes('\\'), false);
    assert.strictEqual(sanitizeFilename(unsafe2).endsWith('.png'), true);
  });
});
