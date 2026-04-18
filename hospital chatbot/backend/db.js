/**
 * Database Layer — SQLite via better-sqlite3
 * ─────────────────────────────────────────────
 * Auto-creates tables and seeds default doctors on first run.
 * Exports helper functions for doctors, appointments, and queries.
 */

const Database = require('better-sqlite3');
const path = require('path');

// ─── Initialize database ────────────────────────────────
const DB_PATH = path.join(__dirname, 'hospital.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`[DB] SQLite database initialized at ${DB_PATH}`);

// ─── Create tables ──────────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        experience INTEGER DEFAULT 0,
        room_no TEXT,
        timing TEXT DEFAULT '9:00 AM - 5:00 PM',
        available INTEGER DEFAULT 1,
        contact TEXT,
        photo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        symptoms TEXT,
        doctor_id INTEGER,
        date TEXT,
        time TEXT,
        phone TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );
`);

// ─── Add phone column to existing table if missing ────────
const columns = db.prepare("PRAGMA table_info(appointments)").all();
if (!columns.some(c => c.name === 'phone')) {
    db.exec("ALTER TABLE appointments ADD COLUMN phone TEXT");
}

// ─── Seed default doctors if table is empty ─────────────
const count = db.prepare('SELECT COUNT(*) as cnt FROM doctors').get();
if (count.cnt === 0) {
    console.log('[DB] Seeding default doctors...');
    const insert = db.prepare(`
        INSERT INTO doctors (name, specialization, experience, room_no, timing, available, contact)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seedDoctors = [
        ['Dr. Rajesh Sharma',  'Cardiologist',       12, '204', '10:00 AM - 2:00 PM', 1, '9876543210'],
        ['Dr. Priya Patel',    'Dermatologist',        8, '105', '9:00 AM - 1:00 PM',  1, '9876543211'],
        ['Dr. Amit Kumar',     'Neurologist',         15, '302', '11:00 AM - 3:00 PM', 1, '9876543212'],
        ['Dr. Sneha Gupta',    'General Physician',   10, '101', '9:00 AM - 5:00 PM',  1, '9876543213'],
        ['Dr. Vikram Singh',   'Gastroenterologist',  14, '210', '10:00 AM - 4:00 PM', 1, '9876543214'],
        ['Dr. Ananya Reddy',   'Orthopedic',           9, '308', '9:00 AM - 12:00 PM', 1, '9876543215'],
        ['Dr. Rahul Mehta',    'General Physician',     6, '102', '2:00 PM - 6:00 PM',  1, '9876543216'],
        ['Dr. Kavita Joshi',   'Cardiologist',         18, '205', '2:00 PM - 6:00 PM',  1, '9876543217'],
    ];

    const insertMany = db.transaction((doctors) => {
        for (const d of doctors) insert.run(...d);
    });
    insertMany(seedDoctors);
    console.log(`[DB] Seeded ${seedDoctors.length} doctors.`);
}

// ════════════════════════════════════════════════════════
//  DOCTOR FUNCTIONS
// ════════════════════════════════════════════════════════

/** Get all doctors */
function getAllDoctors() {
    return db.prepare('SELECT * FROM doctors ORDER BY specialization, name').all();
}

/** Get a single doctor by ID */
function getDoctorById(id) {
    return db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
}

/** Get doctors by specialization (case-insensitive), available first */
function getDoctorsBySpecialization(spec) {
    return db.prepare(`
        SELECT * FROM doctors 
        WHERE LOWER(specialization) = LOWER(?) 
        ORDER BY available DESC, experience DESC
    `).all(spec);
}

/** Add a new doctor */
function addDoctor({ name, specialization, experience, room_no, timing, available, contact, photo }) {
    const result = db.prepare(`
        INSERT INTO doctors (name, specialization, experience, room_no, timing, available, contact, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, specialization, experience || 0, room_no || '', timing || '9:00 AM - 5:00 PM', available !== undefined ? available : 1, contact || '', photo || '');
    return { id: result.lastInsertRowid, ...arguments[0] };
}

/** Update an existing doctor */
function updateDoctor(id, { name, specialization, experience, room_no, timing, available, contact, photo }) {
    return db.prepare(`
        UPDATE doctors SET 
            name = ?, specialization = ?, experience = ?, room_no = ?, 
            timing = ?, available = ?, contact = ?, photo = ?
        WHERE id = ?
    `).run(name, specialization, experience, room_no, timing, available, contact, photo || '', id);
}

/** Delete a doctor */
function deleteDoctor(id) {
    return db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
}

/** Toggle doctor availability */
function toggleAvailability(id, available) {
    return db.prepare('UPDATE doctors SET available = ? WHERE id = ?').run(available, id);
}

// ════════════════════════════════════════════════════════
//  APPOINTMENT FUNCTIONS
// ════════════════════════════════════════════════════════

/** Get all appointments with doctor names */
function getAllAppointments() {
    return db.prepare(`
        SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        ORDER BY a.created_at DESC
    `).all();
}

/** Create a new appointment */
function createAppointment({ patient_name, age, gender, symptoms, doctor_id, date, time, phone }) {
    const result = db.prepare(`
        INSERT INTO appointments (patient_name, age, gender, symptoms, doctor_id, date, time, phone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `).run(patient_name, age, gender, symptoms, doctor_id, date, time, phone || '');
    return { id: result.lastInsertRowid };
}

/** Update appointment status */
function updateAppointmentStatus(id, status) {
    return db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
}

/** Get appointment count stats */
function getAppointmentStats() {
    const total = db.prepare('SELECT COUNT(*) as cnt FROM appointments').get().cnt;
    const pending = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Pending'").get().cnt;
    const confirmed = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Confirmed'").get().cnt;
    const completed = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Completed'").get().cnt;
    return { total, pending, confirmed, completed };
}

// ─── Export ─────────────────────────────────────────────
module.exports = {
    db,
    getAllDoctors,
    getDoctorById,
    getDoctorsBySpecialization,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    toggleAvailability,
    getAllAppointments,
    createAppointment,
    updateAppointmentStatus,
    getAppointmentStats
};
