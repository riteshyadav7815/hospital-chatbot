/**
 * Appointment Routes
 * ───────────────────
 * GET   /api/appointments              — list all (admin only)
 * GET   /api/appointments/stats        — get stats (admin only)
 * POST  /api/appointments              — book appointment (public, from chatbot)
 * PATCH /api/appointments/:id/status   — update status (admin only)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('./auth');

// ─── GET all appointments (admin only) ───────────────────
router.get('/', requireAdmin, (req, res) => {
    try {
        const appointments = db.getAllAppointments();
        res.json(appointments);
    } catch (err) {
        console.error('[Appointments] Error fetching:', err);
        res.status(500).json({ error: 'Failed to fetch appointments.' });
    }
});

// ─── GET appointment stats (admin only) ──────────────────
router.get('/stats', requireAdmin, (req, res) => {
    try {
        const stats = db.getAppointmentStats();
        res.json(stats);
    } catch (err) {
        console.error('[Appointments] Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

// ─── POST book appointment (public — from chatbot) ──────
router.post('/', (req, res) => {
    try {
        const { patient_name, age, gender, symptoms, doctor_id, date, time, phone } = req.body;

        // Basic Validation
        if (!patient_name || typeof patient_name !== 'string' || patient_name.trim() === '') {
            return res.status(400).json({ error: 'Valid patient name is required.' });
        }
        if (!age || isNaN(age) || age < 1 || age > 120) {
            return res.status(400).json({ error: 'Valid age between 1 and 120 is required.' });
        }
        if (!doctor_id || !date || !time) {
            return res.status(400).json({ error: 'Doctor, date, and time are required.' });
        }

        // Verify doctor exists
        const doctor = db.getDoctorById(parseInt(doctor_id));
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found.' });
        }

        const appointment = db.createAppointment({
            patient_name: patient_name.trim(), 
            age: parseInt(age), 
            gender, 
            symptoms, 
            doctor_id: parseInt(doctor_id), 
            date, 
            time, 
            phone
        });

        console.log(`[Appointments] Booked: ${patient_name} → ${doctor.name} on ${date} at ${time}`);
        res.status(201).json({
            message: 'Your appointment request has been received. The hospital will contact you shortly.',
            appointment_id: appointment.id,
            doctor_name: doctor.name,
            date,
            time
        });
    } catch (err) {
        console.error('[Appointments] Error booking:', err);
        res.status(500).json({ error: 'Failed to book appointment.' });
    }
});

// ─── PATCH update status (admin only) ────────────────────
router.patch('/:id/status', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        if (!status || !['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use: Pending, Confirmed, Completed, or Cancelled.' });
        }

        db.updateAppointmentStatus(id, status);
        console.log(`[Appointments] Updated ID ${id} status: ${status}`);
        res.json({ message: 'Status updated.', status });
    } catch (err) {
        console.error('[Appointments] Error updating status:', err);
        res.status(500).json({ error: 'Failed to update status.' });
    }
});

module.exports = router;
