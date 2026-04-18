/**
 * Doctor Routes — CRUD API
 * ─────────────────────────
 * GET    /api/doctors           — list all doctors (public)
 * GET    /api/doctors/:id       — get single doctor (public)
 * POST   /api/doctors           — add doctor (admin only)
 * PUT    /api/doctors/:id       — edit doctor (admin only)
 * DELETE /api/doctors/:id       — delete doctor (admin only)
 * PATCH  /api/doctors/:id/availability — toggle availability (admin only)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('./auth');

// ─── GET all doctors (public) ────────────────────────────
router.get('/', (req, res) => {
    try {
        const { specialist } = req.query;
        let doctors;
        if (specialist) {
            doctors = db.getDoctorsBySpecialization(specialist);
            if (!doctors || doctors.length === 0) {
                // Fallback
                doctors = db.getDoctorsBySpecialization('General Physician');
            }
        } else {
            doctors = db.getAllDoctors();
        }
        res.json(doctors);
    } catch (err) {
        console.error('[Doctors] Error fetching:', err);
        res.status(500).json({ error: 'Failed to fetch doctors.' });
    }
});

// ─── GET single doctor (public) ──────────────────────────
router.get('/:id', (req, res) => {
    try {
        const doctor = db.getDoctorById(parseInt(req.params.id));
        if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
        res.json(doctor);
    } catch (err) {
        console.error('[Doctors] Error fetching by ID:', err);
        res.status(500).json({ error: 'Failed to fetch doctor.' });
    }
});

// ─── POST add doctor (admin only) ────────────────────────
router.post('/', requireAdmin, (req, res) => {
    try {
        const { name, specialization, experience, room_no, timing, available, contact, photo } = req.body;
        if (!name || !specialization) {
            return res.status(400).json({ error: 'Name and specialization are required.' });
        }
        const doctor = db.addDoctor({ name, specialization, experience, room_no, timing, available, contact, photo });
        console.log(`[Doctors] Added: ${name} (${specialization})`);
        res.status(201).json(doctor);
    } catch (err) {
        console.error('[Doctors] Error adding:', err);
        res.status(500).json({ error: 'Failed to add doctor.' });
    }
});

// ─── PUT update doctor (admin only) ──────────────────────
router.put('/:id', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getDoctorById(id);
        if (!existing) return res.status(404).json({ error: 'Doctor not found.' });

        const { name, specialization, experience, room_no, timing, available, contact, photo } = req.body;
        db.updateDoctor(id, {
            name: name || existing.name,
            specialization: specialization || existing.specialization,
            experience: experience !== undefined ? experience : existing.experience,
            room_no: room_no !== undefined ? room_no : existing.room_no,
            timing: timing || existing.timing,
            available: available !== undefined ? available : existing.available,
            contact: contact !== undefined ? contact : existing.contact,
            photo: photo !== undefined ? photo : existing.photo
        });
        console.log(`[Doctors] Updated ID ${id}: ${name || existing.name}`);
        res.json({ message: 'Doctor updated successfully.', id });
    } catch (err) {
        console.error('[Doctors] Error updating:', err);
        res.status(500).json({ error: 'Failed to update doctor.' });
    }
});

// ─── DELETE doctor (admin only) ──────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getDoctorById(id);
        if (!existing) return res.status(404).json({ error: 'Doctor not found.' });

        db.deleteDoctor(id);
        console.log(`[Doctors] Deleted ID ${id}: ${existing.name}`);
        res.json({ message: 'Doctor deleted successfully.' });
    } catch (err) {
        console.error('[Doctors] Error deleting:', err);
        res.status(500).json({ error: 'Failed to delete doctor.' });
    }
});

// ─── PATCH toggle availability (admin only) ──────────────
router.patch('/:id/availability', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { available } = req.body;
        if (available === undefined) {
            return res.status(400).json({ error: 'Available field is required.' });
        }
        db.toggleAvailability(id, available ? 1 : 0);
        console.log(`[Doctors] Toggled ID ${id} availability: ${available}`);
        res.json({ message: 'Availability updated.', available });
    } catch (err) {
        console.error('[Doctors] Error toggling availability:', err);
        res.status(500).json({ error: 'Failed to update availability.' });
    }
});

module.exports = router;
