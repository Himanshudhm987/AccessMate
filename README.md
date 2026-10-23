# AccessMate# AccessMate with Sign up, Sign in and SQLite database

## Requirements
Node.js 20+ (Node 22 LTS recommended), npm.

## Setup
1. Open this folder in VS Code.
2. Copy `server/.env.example` to `server/.env`.
3. Replace `JWT_SECRET` with a strong random secret of at least 32 characters. Never commit `.env`.
4. In the root terminal run `npm run install:all`.
5. Run `npm run dev`.
6. Open http://localhost:5173

The server listens on http://localhost:5000 and the Vite frontend proxies `/api` there.
SQLite database is created automatically at `server/data/accessmate.db` when the server starts. Do not commit or publish this database.
Sign up -> Sign in -> Document reader -> Save -> Saved documents. Each user only accesses their own saved text. Images and OCR remain browser-side; clicking Save sends extracted text to the server.
Passwords are bcrypt-hashed, authentication uses an HttpOnly SameSite cookie, login/signup are rate-limited, and server validates document ownership.
This is a learning MVP: before public deployment add password reset/email verification, backup and recovery, HTTPS, operational monitoring and an independent security/accessibility review. Production frontend/backend should share a site origin or configure cookie/CORS accordingly.
