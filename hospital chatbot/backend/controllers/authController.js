const Otp = require('../models/Otp');
const Patient = require('../models/Patient');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ─── Generate a 6-digit OTP ───
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── Send OTP ───
exports.sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        // Check for existing OTP to prevent spam (30 sec cooldown)
        const existingOtp = await Otp.findOne({ phone }).sort({ createdAt: -1 });
        if (existingOtp) {
            const timeDiff = (Date.now() - existingOtp.createdAt.getTime()) / 1000;
            if (timeDiff < 30) {
                return res.status(429).json({ error: 'Please wait 30 seconds before requesting another OTP.' });
            }
        }

        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await Otp.create({ phone, otp: otpCode, expiresAt });

        // In production, integrate with Twilio/SNS here
        console.log(`[SMS MOCK] Sent OTP ${otpCode} to ${phone}`);

        res.json({ message: 'OTP sent successfully', expiresIn: '5 minutes' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error while sending OTP.' });
    }
};

// ─── Verify OTP ───
exports.verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

        const otpRecord = await Otp.findOne({ phone }).sort({ createdAt: -1 });
        if (!otpRecord) return res.status(400).json({ error: 'OTP expired or not requested' });

        if (otpRecord.attempts >= 5) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.status(429).json({ error: 'Max attempts reached. Please request a new OTP.' });
        }

        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // OTP verified successfully
        await Otp.deleteMany({ phone }); // Cleanup

        // Check if patient exists
        let patient = await Patient.findOne({ phone });
        
        // We do NOT create the patient here yet. Creating the patient happens during register.
        // We just return a verified token that allows them to register or login.
        
        const token = jwt.sign(
            { phone, isVerified: true, patientId: patient ? patient.patientId : null }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        res.json({
            message: 'OTP verified successfully',
            isNewPatient: !patient,
            patientId: patient ? patient.patientId : null,
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error while verifying OTP.' });
    }
};

// ─── Admin Login ───
exports.adminLogin = async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const loginId = (email || username || '').trim();
        if (!loginId || !password) {
            return res.status(400).json({ error: 'Email/username and password are required.' });
        }
        
        // Check hardcoded .env admin fallback
        if (loginId === process.env.ADMIN_USERNAME || loginId === 'admin') {
            if (bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH)) {
                const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
                return res.json({ token, role: 'admin', message: 'Logged in as super admin' });
            }
        }

        const user = await User.findOne({ email: loginId.toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, role: user.role, name: user.name });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login.' });
    }
};

// ─── Auth Check ───
exports.checkAuth = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return res.json({
            authenticated: true,
            role: decoded.role || 'admin'
        });
    } catch (error) {
        return res.status(401).json({ authenticated: false });
    }
};

// ─── Admin Registration ───
exports.registerStaff = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role: role || 'doctor' });

        res.status(201).json({ message: 'Staff account created successfully', userId: user._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
};
