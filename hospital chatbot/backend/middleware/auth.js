const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Missing token.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Will contain patientId for patients, or role for admin
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
};

const requireAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({ error: 'Admin access required.' });
        }
    });
};

const requireDoctorOrAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && (req.user.role === 'admin' || req.user.role === 'doctor')) {
            next();
        } else {
            return res.status(403).json({ error: 'Staff access required.' });
        }
    });
};

module.exports = { verifyToken, requireAdmin, requireDoctorOrAdmin };
