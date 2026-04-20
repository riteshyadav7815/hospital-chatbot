const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { verifyToken, requireDoctorOrAdmin } = require('../middleware/auth');

// ─── Patient App Routes ───
// These are endpoints hit by the chatbot widget
router.post('/register', verifyToken, patientController.registerPatient); // Needs OTP token
router.post('/login-by-id', patientController.loginById);
router.get('/session-check', verifyToken, patientController.sessionCheck);
router.post('/logout', patientController.logout);

// ─── Chat History Routes ───
router.post('/chat/save', verifyToken, patientController.saveChat);
router.get('/chat/history/:patientId', verifyToken, patientController.getChatHistory);

// ─── Admin / Doctor Routes (Protected) ───
// These are endpoints hit by the dashboard
router.get('/all', requireDoctorOrAdmin, async (req, res) => {
    const Patient = require('../models/Patient');
    const { search, risk, from, to } = req.query;
    const filter = {};
    if (search) {
        const regex = new RegExp(String(search).trim(), 'i');
        filter.$or = [{ fullName: regex }, { patientId: regex }, { phone: regex }];
    }
    if (from || to) {
        filter.lastVisitDate = {};
        if (from) filter.lastVisitDate.$gte = new Date(from);
        if (to) filter.lastVisitDate.$lte = new Date(to);
    }

    let patients = await Patient.find(filter).sort({ lastVisitDate: -1 });
    if (risk && ['low', 'medium', 'high'].includes(String(risk).toLowerCase())) {
        const target = String(risk).toLowerCase();
        patients = patients.filter((p) => {
            const sev = String(p.severity || '').toLowerCase();
            if (target === 'high') return sev.includes('high') || sev.includes('emergency');
            if (target === 'medium') return sev.includes('moderate') || sev.includes('medium');
            return sev.includes('low');
        });
    }
    res.json(patients);
});
router.get('/:patientId/history', requireDoctorOrAdmin, patientController.getPatientHistoryForAdmin);
router.get('/:patientId', requireDoctorOrAdmin, patientController.getPatient);
router.put('/update/:patientId', requireDoctorOrAdmin, patientController.updatePatient);
router.delete('/:patientId', requireDoctorOrAdmin, async (req, res) => {
    const Patient = require('../models/Patient');
    await Patient.findOneAndDelete({ patientId: req.params.patientId });
    res.json({ message: 'Patient deleted.' });
});

module.exports = router;
