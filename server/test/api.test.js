import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import db from '../db.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
});

async function api(path, options = {}) {
  const url = `${baseUrl}/api${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://127.0.0.1:5173',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data = null;
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  let sessionCookie = '';
  let csrfCookie = '';
  for (const c of setCookies) {
    if (c.includes('accessmate_session=')) {
      sessionCookie = c.split(';')[0];
    }
    if (c.includes('accessmate_csrf=')) {
      csrfCookie = c.split(';')[0];
    }
  }

  const combinedCookie = [sessionCookie, csrfCookie].filter(Boolean).join('; ');
  const csrfToken = csrfCookie ? csrfCookie.replace('accessmate_csrf=', '') : '';

  return {
    status: response.status,
    headers: response.headers,
    data,
    cookie: combinedCookie,
    csrfToken
  };
}

describe('AccessMate Backend Test Suite', () => {

  test('1. Health Check Endpoint responds with 200 OK and valid service metadata', async () => {
    const res = await api('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(res.data.service, 'AccessMate Secure API');
    assert.ok(typeof res.data.uptime === 'number');
  });

  test('2. Security headers are applied by Helmet', async () => {
    const res = await api('/health');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(res.headers.get('content-security-policy'));
  });

  test('3. Authentication Flow: Signup, Login, and Session retrieval', async () => {
    const testEmail = `testuser_${Date.now()}@example.com`;
    const signupRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tester',
        email: testEmail,
        password: 'Password123!'
      })
    });

    assert.strictEqual(signupRes.status, 201);
    assert.strictEqual(signupRes.data.user.email, testEmail);
    assert.strictEqual(signupRes.data.user.role, 'user');
    assert.ok(signupRes.cookie, 'Should set session cookies');

    // Access /auth/me with cookie
    const meRes = await api('/auth/me', {
      headers: { Cookie: signupRes.cookie }
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.email, testEmail);

    // Prevent duplicate registration
    const dupRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Tester',
        email: testEmail,
        password: 'Password123!'
      })
    });
    assert.strictEqual(dupRes.status, 409);
  });

  test('4. IDOR Protection: Users cannot view or delete documents of other users', async () => {
    // User A signup
    const emailA = `usera_${Date.now()}@example.com`;
    const userARes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'User A', email: emailA, password: 'Password123!' })
    });
    const cookieA = userARes.cookie;
    const csrfA = userARes.csrfToken;

    // User A creates a document
    const docRes = await api('/documents', {
      method: 'POST',
      headers: {
        Cookie: cookieA,
        'x-csrf-token': csrfA
      },
      body: JSON.stringify({ name: 'User A Private Note', text: 'Confidential text content.' })
    });
    assert.strictEqual(docRes.status, 201);
    const docId = docRes.data.document.id;

    // User B signup
    const emailB = `userb_${Date.now()}@example.com`;
    const userBRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'User B', email: emailB, password: 'Password123!' })
    });
    const cookieB = userBRes.cookie;
    const csrfB = userBRes.csrfToken;

    // User B attempts to read User A's document (IDOR attempt)
    const readAttempt = await api(`/documents/${docId}`, {
      headers: { Cookie: cookieB }
    });
    assert.strictEqual(readAttempt.status, 403, 'User B must be forbidden from accessing User A document');

    // User B attempts to delete User A's document
    const deleteAttempt = await api(`/documents/${docId}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieB,
        'x-csrf-token': csrfB
      }
    });
    assert.strictEqual(deleteAttempt.status, 403, 'User B must be forbidden from deleting User A document');

    // User A can successfully read their own document
    const authorizedRead = await api(`/documents/${docId}`, {
      headers: { Cookie: cookieA }
    });
    assert.strictEqual(authorizedRead.status, 200);
    assert.strictEqual(authorizedRead.data.document.id, docId);
  });

  test('5. Role-Based Access Control: Regular user cannot access admin routes', async () => {
    const regularEmail = `regular_${Date.now()}@example.com`;
    const regRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Regular User', email: regularEmail, password: 'Password123!' })
    });
    const regularCookie = regRes.cookie;

    // Attempt to access user management
    const usersListRes = await api('/users', {
      headers: { Cookie: regularCookie }
    });
    assert.strictEqual(usersListRes.status, 403);

    // Attempt to access system metrics
    const metricsRes = await api('/system/metrics', {
      headers: { Cookie: regularCookie }
    });
    assert.strictEqual(metricsRes.status, 403);
  });

  test('6. Super Admin Protection: Cannot demote or suspend the last active Super Admin', async () => {
    const superAdmin = db.prepare("SELECT id, email, role FROM users WHERE role='super_admin' AND status='active' LIMIT 1").get();
    assert.ok(superAdmin, 'Super Admin should exist in database');

    const { issueSession } = await import('../middleware/auth.js');
    let sessionCookie = '';
    let csrfCookie = '';
    const mockRes = {
      cookie(name, val) {
        if (name === 'accessmate_session') sessionCookie = val;
        if (name === 'accessmate_csrf') csrfCookie = val;
      }
    };
    issueSession(mockRes, superAdmin);
    const superAdminCookies = `accessmate_session=${sessionCookie}; accessmate_csrf=${csrfCookie}`;

    // Attempt to demote the only super admin to 'user'
    const demoteRes = await api(`/users/${superAdmin.id}`, {
      method: 'PATCH',
      headers: {
        Cookie: superAdminCookies,
        'x-csrf-token': csrfCookie
      },
      body: JSON.stringify({ role: 'user' })
    });

    assert.strictEqual(demoteRes.status, 400);
    assert.ok(demoteRes.data.error.includes('last active Super Admin'));
  });

  test('7. File Upload Validation: Rejects invalid magic byte signatures', async () => {
    const userEmail = `uploader_${Date.now()}@example.com`;
    const uploaderRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'File Uploader', email: userEmail, password: 'Password123!' })
    });
    const uploaderCookie = uploaderRes.cookie;
    const csrfToken = uploaderRes.csrfToken;

    // Create a fake file with .jpg extension but text contents (invalid signature)
    const formData = new FormData();
    const fakeBlob = new Blob(['THIS IS NOT A VALID JPEG IMAGE BUFFER'], { type: 'image/jpeg' });
    formData.append('file', fakeBlob, 'malicious_script.jpg');

    const uploadUrl = `${baseUrl}/api/documents/upload`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Cookie: uploaderCookie,
        Origin: 'http://127.0.0.1:5173',
        'x-csrf-token': csrfToken
      },
      body: formData
    });

    const data = await uploadRes.json();
    assert.strictEqual(uploadRes.status, 400);
    assert.ok(data.error.includes('Unsupported file signature') || data.error.includes('signature'));
  });

  test('8. File Upload Validation: Accepts genuine PNG image with magic bytes', async () => {
    const userEmail = `valid_uploader_${Date.now()}@example.com`;
    const uploaderRes = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Valid Uploader', email: userEmail, password: 'Password123!' })
    });
    const uploaderCookie = uploaderRes.cookie;
    const csrfToken = uploaderRes.csrfToken;

    // Valid 1x1 PNG bytes
    const validPngBytes = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const formData = new FormData();
    const pngBlob = new Blob([validPngBytes], { type: 'image/png' });
    formData.append('file', pngBlob, 'valid_scan.png');
    formData.append('text', 'Extracted OCR Sample text from valid scan');

    const uploadUrl = `${baseUrl}/api/documents/upload`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Cookie: uploaderCookie,
        Origin: 'http://127.0.0.1:5173',
        'x-csrf-token': csrfToken
      },
      body: formData
    });

    const data = await uploadRes.json();
    assert.strictEqual(uploadRes.status, 201);
    assert.ok(data.document.id);
    assert.strictEqual(data.document.mime_type, 'image/png');
    assert.strictEqual(data.document.has_file, true);
  });
});
