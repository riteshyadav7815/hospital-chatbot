/**
 * Auth Routes — Admin Login / Logout
 * ────────────────────────────────────
 * POST /api/auth/login   — validate admin credentials, return JWT
 * GET  /api/auth/check   — verify if token is valid
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-chatbot-secret-key-2024';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// ─── Login ──────────────────────────────────────────────
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`[Auth] Admin logged in: ${username}`);
    res.json({ token, message: 'Login successful.' });
});

// ─── Check Auth ─────────────────────────────────────────
router.get('/check', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ authenticated: true, username: decoded.username });
    } catch (err) {
        res.status(401).json({ authenticated: false });
    }
});

// ─── Auth Middleware (for protecting routes) ─────────────
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { router, requireAdmin };
