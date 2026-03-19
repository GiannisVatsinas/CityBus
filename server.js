'use strict';

const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database     = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = 8082;
const ROOT        = path.join(__dirname);
const DB_PATH     = path.join(__dirname, 'citybus.db');
const BCRYPT_COST = 12;

// JWT secret: use env var in production; fall back to a per-process random for dev
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️  JWT_SECRET not set in environment. Using a random secret — all sessions will be invalidated on server restart.');
}

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        email              TEXT    UNIQUE NOT NULL,
        password_hash      TEXT    NOT NULL,
        created_at         TEXT    DEFAULT (datetime('now')),
        reset_token        TEXT,
        reset_token_expires TEXT
    );

    CREATE TABLE IF NOT EXISTS live_reports (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id     TEXT NOT NULL,
        report_type TEXT NOT NULL CHECK(report_type IN ('boarded', 'delay')),
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_live_reports_line_created
        ON live_reports (line_id, created_at);
`);

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(ROOT, { index: 'index.html' }));

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch { return null; }
}

function requireAuth(req, res, next) {
    const payload = verifyToken(req.cookies?.auth_token);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    req.user = payload;
    next();
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── POST /api/register ────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body || {};

    if (!isValidEmail(email))
        return res.status(400).json({ error: 'Μη έγκυρο email.' });
    if (typeof password !== 'string' || password.length < 8)
        return res.status(400).json({ error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });

    const normalizedEmail = email.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing)
        return res.status(409).json({ error: 'Το email χρησιμοποιείται ήδη.' });

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(normalizedEmail, hash);

    const token = signToken({ email: normalizedEmail });
    res.cookie('auth_token', token, { httpOnly: true, sameSite: 'Lax', maxAge: 7 * 24 * 3600 * 1000 });
    return res.status(201).json({ email: normalizedEmail });
});

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!isValidEmail(email) || typeof password !== 'string')
        return res.status(400).json({ error: 'Invalid credentials' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    // Use a constant-time comparison even when user doesn't exist
    const hashToCompare = user?.password_hash || '$2b$12$invalidhashfortimingprotection00000000000000000';
    const match = await bcrypt.compare(password, hashToCompare);

    if (!user || !match)
        return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ email: normalizedEmail });
    res.cookie('auth_token', token, { httpOnly: true, sameSite: 'Lax', maxAge: 7 * 24 * 3600 * 1000 });
    return res.status(200).json({ email: normalizedEmail });
});

// ── POST /api/logout ──────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    return res.status(200).json({ ok: true });
});

// ── GET /api/me ───────────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
    return res.status(200).json({ email: req.user.email });
});

// ── POST /api/forgot-password ─────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    if (!isValidEmail(email))
        return res.status(400).json({ error: 'Μη έγκυρο email.' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);

    // Always respond with the same message to prevent email enumeration
    const genericResponse = { message: 'Αν το email υπάρχει, θα σταλεί σύνδεσμος επαναφοράς.' };

    if (!user) return res.status(200).json(genericResponse);

    const rawToken   = crypto.randomBytes(32).toString('hex');
    const tokenHash  = await bcrypt.hash(rawToken, 10);
    const expires    = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?')
      .run(tokenHash, expires, normalizedEmail);

    // Mock email — print to terminal
    const resetLink = `http://localhost:${PORT}/?reset_token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;
    console.log('\n📧 ─────────────────────────────────────────────────────────');
    console.log(`   MOCK EMAIL  →  ${normalizedEmail}`);
    console.log(`   Reset link  →  ${resetLink}`);
    console.log('──────────────────────────────────────────────────────────────\n');

    return res.status(200).json(genericResponse);
});

// ── POST /api/reset-password ──────────────────────────────────────────────────
app.post('/api/reset-password', async (req, res) => {
    const { email, token, password } = req.body || {};

    if (!isValidEmail(email) || typeof token !== 'string' || typeof password !== 'string')
        return res.status(400).json({ error: 'Μη έγκυρη αίτηση.' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user || !user.reset_token || !user.reset_token_expires)
        return res.status(400).json({ error: 'Μη έγκυρος ή ληγμένος σύνδεσμος.' });

    const expired = new Date(user.reset_token_expires) < new Date();
    if (expired)
        return res.status(400).json({ error: 'Ο σύνδεσμος έχει λήξει.' });

    const valid = await bcrypt.compare(token, user.reset_token);
    if (!valid)
        return res.status(400).json({ error: 'Μη έγκυρος ή ληγμένος σύνδεσμος.' });

    const newHash = await bcrypt.hash(password, BCRYPT_COST);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE email = ?')
      .run(newHash, normalizedEmail);

    return res.status(200).json({ message: 'Ο κωδικός σας άλλαξε επιτυχώς.' });
});

// ── POST /api/reports ────────────────────────────────────────────────────────
app.post('/api/reports', (req, res) => {
    const { line_id, report_type } = req.body || {};

    if (typeof line_id !== 'string' || !line_id.trim())
        return res.status(400).json({ error: 'Μη έγκυρο line_id.' });
    if (report_type !== 'boarded' && report_type !== 'delay')
        return res.status(400).json({ error: 'Μη έγκυρος τύπος αναφοράς.' });

    db.prepare('INSERT INTO live_reports (line_id, report_type) VALUES (?, ?)')
      .run(line_id.trim(), report_type);

    return res.status(201).json({ ok: true });
});

// ── GET /api/reports/:lineId ──────────────────────────────────────────────────
app.get('/api/reports/:lineId', (req, res) => {
    const lineId = req.params.lineId;

    // Use SQLite's own datetime arithmetic — avoids JS/SQLite format mismatch
    const rows = db.prepare(
        `SELECT report_type, created_at FROM live_reports
         WHERE line_id = ? AND created_at >= datetime('now', '-1 hour')
         ORDER BY created_at DESC`
    ).all(lineId);

    if (rows.length === 0)
        return res.status(200).json({ boarded: 0, delay: 0, latest: null });

    const boarded = rows.filter(r => r.report_type === 'boarded').length;
    const delay   = rows.filter(r => r.report_type === 'delay').length;
    const latest  = rows[0]; // most recent (sorted DESC)

    // SQLite stores UTC as "YYYY-MM-DD HH:MM:SS" — parse it correctly
    const latestDate = new Date(latest.created_at.replace(' ', 'T') + 'Z');
    const minutesAgo = Math.max(0, Math.round((Date.now() - latestDate.getTime()) / 60000));

    return res.status(200).json({
        boarded,
        delay,
        latest: { type: latest.report_type, minutes_ago: minutesAgo }
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚌 CityBus server running at http://127.0.0.1:${PORT}`);
});
