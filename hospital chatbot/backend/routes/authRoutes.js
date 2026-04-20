const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ─── Patient OTP Auth ───
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

// ─── Staff / Admin Auth ───
router.post('/login', authController.adminLogin);
router.get('/check', authController.checkAuth);
router.post('/register-admin', authController.registerStaff);

module.exports = router;
