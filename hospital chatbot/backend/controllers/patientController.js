const Patient = require('../models/Patient');
const Chat = require('../models/Chat');
const jwt = require('jsonwebtoken');

const cleanString = (value, maxLen = 400) => String(value || '').replace(/[<>]/g, '').trim().slice(0, maxLen);

// ─── First Time Patient Registration ───
exports.registerPatient = async (req, res) => {
    try {
        // Needs a token from OTP verification
        if (!req.user || !req.user.isVerified) {
            return res.status(401).json({ error: 'Phone verification required to register.' });
        }

        const { fullName, age, gender, phone, email } = req.body;
        
        // Ensure phone matches verified token
        if (phone !== req.user.phone) {
            return res.status(403).json({ error: 'Phone number mismatch with verified OTP.' });
        }

        const newPatient = new Patient({
            fullName, age, gender, phone, email, visitCount: 1
        });

        await newPatient.save(); // pre-validate hook auto-generates PAT-YYYY-XXXX

        // Create long-lived session token (e.g. 24h)
        const sessionToken = jwt.sign(
            { patientId: newPatient.patientId, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Patient registered successfully',
            patientId: newPatient.patientId,
            token: sessionToken,
            patient: newPatient
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to register patient.' });
    }
};

// ─── Login By Patient ID ───
exports.loginById = async (req, res) => {
    try {
        const patientId = cleanString(req.body.patientId, 40).toUpperCase();
        if (!/^PAT-\d{4}-\d{4}$/.test(patientId)) {
            return res.status(400).json({ error: 'Invalid Patient ID format.' });
        }
        if (!patientId) return res.status(400).json({ error: 'Patient ID is required.' });

        const patient = await Patient.findOne({ patientId });
        if (!patient) return res.status(404).json({ error: 'Patient not found.' });

        // Update visit logic
        patient.visitCount += 1;
        patient.lastVisitDate = new Date();
        await patient.save();

        const sessionToken = jwt.sign(
            { patientId: patient.patientId, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Welcome back!',
            token: sessionToken,
            patient
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to login with Patient ID.' });
    }
};

// ─── Session Check ───
exports.sessionCheck = async (req, res) => {
    try {
        // req.user populated by verifyToken middleware
        if (!req.user || req.user.role !== 'patient') {
            return res.status(401).json({ valid: false });
        }

        const patient = await Patient.findOne({ patientId: req.user.patientId });
        if (!patient) return res.status(404).json({ valid: false });

        res.json({ valid: true, patientId: req.user.patientId, patientName: patient.fullName });
    } catch (error) {
        res.status(500).json({ valid: false, error: 'Session check failed.' });
    }
};

// ─── Get Patient Details ───
exports.getPatient = async (req, res) => {
    try {
        const patient = await Patient.findOne({ patientId: req.params.patientId });
        if (!patient) return res.status(404).json({ error: 'Patient not found' });
        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patient data.' });
    }
};

// ─── Update Patient Details ───
exports.updatePatient = async (req, res) => {
    try {
        const updated = await Patient.findOneAndUpdate(
            { patientId: req.params.patientId },
            { $set: req.body },
            { new: true }
        );
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update patient data.' });
    }
};

// ─── Save Chat Message ───
exports.saveChat = async (req, res) => {
    try {
        const patientId = cleanString(req.body.patientId, 40).toUpperCase();
        const sessionId = cleanString(req.body.sessionId, 80);
        const userMessage = cleanString(req.body.userMessage, 1200);
        const botMessage = cleanString(req.body.botMessage, 2400);

        if (!req.user || req.user.role !== 'patient' || req.user.patientId !== patientId) {
            return res.status(403).json({ error: 'Unauthorized to save chat for this patient.' });
        }
        if (!sessionId || !userMessage || !botMessage) {
            return res.status(400).json({ error: 'Missing chat payload.' });
        }
        await Chat.create({ patientId, sessionId, userMessage, botMessage });
        res.status(201).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save chat.' });
    }
};

// ─── Get Chat History ───
exports.getChatHistory = async (req, res) => {
    try {
        const patientId = cleanString(req.params.patientId, 40).toUpperCase();
        if (!req.user || req.user.role !== 'patient' || req.user.patientId !== patientId) {
            return res.status(403).json({ error: 'Unauthorized to view this chat history.' });
        }
        const history = await Chat.find({ patientId }).sort({ timestamp: 1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
};

// ─── Admin View: Patient Full Chat History ───
exports.getPatientHistoryForAdmin = async (req, res) => {
    try {
        const patientId = cleanString(req.params.patientId, 40).toUpperCase();
        const history = await Chat.find({ patientId }).sort({ timestamp: 1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patient history.' });
    }
};

// ─── Logout ───
exports.logout = (req, res) => {
    // In JWT, logout is usually handled client-side by deleting the token.
    res.json({ message: 'Logged out successfully.' });
};
