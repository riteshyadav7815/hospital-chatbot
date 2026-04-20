/**
 * Auth Routes — Admin Login / Logout
 * ────────────────────────────────────
 * POST /api/auth/login   — validate admin credentials, return JWT
 * GET  /api/auth/check   — verify if token is valid
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

// ─── Login ──────────────────────────────────────────────
router.post('/login', (req, res) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    const ADMIN_USER = process.env.ADMIN_USERNAME;
    const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
    const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

    // Reject if server not configured securely
    if (!JWT_SECRET || !ADMIN_USER || !ADMIN_HASH) {
        console.error('[Auth] Server missing required secure environment variables.');
        return res.status(500).json({ error: 'Internal server configuration error.' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (username !== ADMIN_USER || !bcrypt.compareSync(password, ADMIN_HASH)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { router, requireAdmin };
