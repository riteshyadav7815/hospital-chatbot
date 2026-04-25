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
        timing TEXT DEFAULT '9:00 AM - 4:00 PM (Mon-Sun)',
        available INTEGER DEFAULT 1,
        contact TEXT,
        photo TEXT,
        designation TEXT,
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

// ─── Add designation column to doctors if missing ────────
const docColumns = db.prepare("PRAGMA table_info(doctors)").all();
if (!docColumns.some(c => c.name === 'designation')) {
    db.exec("ALTER TABLE doctors ADD COLUMN designation TEXT");
}

// ─── Seed real hospital doctors if not present ─────────────
const hasRealSeed = db.prepare("SELECT COUNT(*) as cnt FROM doctors WHERE name = 'Dr. Pradeep Pilajirao Kulkarni'").get().cnt;
if (hasRealSeed === 0) {
    console.log('[DB] Seeding real hospital doctors...');
    db.exec('DELETE FROM doctors'); // Remove old dummy data
    
    const insert = db.prepare(`
        INSERT INTO doctors (name, specialization, experience, room_no, timing, available, contact, designation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rawData = [
  { name: "Dr. Pradeep Pilajirao Kulkarni", phone: "8827110425", department: "Admin", designation: "Medical Director" },
  { name: "Dr. Pradnya Kulkarni", phone: "9405955802", department: "Anatomy", designation: "Professor" },
  { name: "Dr. Amit Manchanda", phone: "8851655583", department: "Anatomy", designation: "Senior Resident" },
  { name: "Dr. Manisha", phone: "9461922348", department: "Biochemistry", designation: "Associate Professor" },
  { name: "Dr. Nisha Yadav", phone: "8302009462", department: "Biochemistry", designation: "Senior Resident" },
  { name: "Dr. Shaivya Morwal", phone: "7339713293", department: "Biochemistry", designation: "Senior Resident" },
  { name: "Dr. Shivani Puri", phone: "8847553902", department: "Pathology", designation: "Assistant Professor" },
  { name: "Dr. Pradeep Kumar Sharma", phone: "9828818408", department: "Pathology", designation: "Assistant Professor" },
  { name: "Dr. Pooja Pahadiya", phone: "9828744488", department: "Pathology", designation: "Assistant Professor" },
  { name: "Dr. Abdul Majid Khan", phone: "9950995164", department: "Microbiology", designation: "Assistant Professor" },
  { name: "Dr. Bhawani Shankar Verma", phone: "8529068271", department: "Microbiology", designation: "Assistant Professor" },
  { name: "Dr. Uzma Rahman", phone: "8981222817", department: "Microbiology", designation: "Senior Resident" },
  { name: "Dr. Akansha Puri", phone: "9560940510", department: "Microbiology", designation: "Senior Resident" },
  { name: "Dr. Rajendra Vishnu Awate", phone: "7798272695", department: "Community Medicine", designation: "Principal" },
  { name: "Dr. Lokesh Kumar Meena", phone: "8005828986", department: "Community Medicine", designation: "Assistant Professor" },
  { name: "Dr. Manish Kumar Dewat", phone: "8385837650", department: "Forensic Medicine & Toxicology", designation: "Assistant Professor" },
  { name: "Dr. Monika Sharma", phone: "7976950623", department: "Forensic Medicine & Toxicology", designation: "Senior Resident" },
  { name: "Dr. Mansa Ram Saran", phone: "9414774547", department: "General Medicine", designation: "Professor" },
  { name: "Dr. Achlesh Sharma", phone: "9654791814", department: "General Medicine", designation: "Assistant Professor" },
  { name: "Dr. Sourabh Soni", phone: "7976474292", department: "General Medicine", designation: "Assistant Professor" },
  { name: "Dr. Sunny Kumar", phone: "8607920427", department: "General Medicine", designation: "Senior Resident" },
  { name: "Dr. Shubham Rawal", phone: "7988220657", department: "General Medicine", designation: "Senior Resident" },
  { name: "Dr. Manju", phone: "7217724756", department: "General Surgery", designation: "Assistant Professor" },
  { name: "Dr. Suhas Suresh Deshpandy", phone: "8275230425", department: "Obstetrics & Gynecology", designation: "Medical Superintendent" },
  { name: "Dr. Renu Singh", phone: "9634901769", department: "Obstetrics & Gynecology", designation: "Associate Professor" },
  { name: "Dr. Monika Yadav", phone: "9983299997", department: "Obstetrics & Gynecology", designation: "Assistant Professor" },
  { name: "Dr. Sushila Kumari Jewalia", phone: "8107291666", department: "Obstetrics & Gynecology", designation: "Assistant Professor" },
  { name: "Dr. Asha Choudhary", phone: "7597865052", department: "Obstetrics & Gynecology", designation: "Assistant Professor" },
  { name: "Dr. Dharampal Swami", phone: "7838637672", department: "Orthopaedics", designation: "Assistant Professor" },
  { name: "Dr. Vijay Kumar Aswal", phone: "7878656566", department: "Orthopaedics", designation: "Assistant Professor" },
  { name: "Dr. Jai Narayan Kumawat", phone: "8888110978", department: "Orthopaedics", designation: "Senior Resident" },
  { name: "Dr. Vikram Singh", phone: "9875459955", department: "Orthopaedics", designation: "Senior Resident" },
  { name: "Dr. Ashutosh", phone: "9413810208", department: "Orthopaedics", designation: "Senior Resident" },
  { name: "Dr. Pinky Atal", phone: "8742060596", department: "Paediatrics", designation: "Assistant Professor" },
  { name: "Dr. Palak Charpota", phone: "7073803226", department: "Paediatrics", designation: "Assistant Professor" },
  { name: "Dr. Khushboo Saini", phone: "8441878898", department: "Anaesthesiology", designation: "Assistant Professor" },
  { name: "Dr. Ravisha Choudhary", phone: "9351617345", department: "ENT", designation: "Assistant Professor" },
  { name: "Dr. Azad Meena", phone: "7792058894", department: "ENT", designation: "Senior Resident" },
  { name: "Dr. Sonu Kumawat", phone: "8561960860", department: "Ophthalmology", designation: "Senior Resident" },
  { name: "Dr. Vikas Dhaka", phone: "7791038773", department: "Psychiatry", designation: "Assistant Professor" },
  { name: "Dr. Imamuddin Khan", phone: "8209707560", department: "Psychiatry", designation: "Senior Resident" },
  { name: "Dr. Ajit Singh Kulhari", phone: "9414223082", department: "Skin & VD", designation: "Professor" },
  { name: "Dr. Robin Singh", phone: "9766582695", department: "Skin & VD", designation: "Senior Resident" },
  { name: "Dr. Sahil Chhabra", phone: "9501418500", department: "Radiology", designation: "Assistant Professor" },
  { name: "Dr. Tara Chand", phone: "9398963782", department: "Dental", designation: "Senior Resident" },
  { name: "Dr. Anju Sunda", phone: "7568619379", department: "Dental", designation: "Senior Resident" },
  { name: "Dr. Ankit Garg", phone: "9414289699", department: "Transfusion Medicine", designation: "Senior Resident" }
    ];

    let roomCounter = 101;
    const insertMany = db.transaction((doctors) => {
        for (const doc of doctors) {
            let exp = 5;
            let timing = "9:00 AM - 5:00 PM";
            const des = doc.designation;
            
            if ((des.includes('Professor') && !des.includes('Associate') && !des.includes('Assistant')) || des.includes('Director')) {
                exp = 20;
                timing = "9:00 AM - 1:00 PM";
            } else if (des.includes('Superintendent') || des.includes('Principal')) {
                exp = 18;
                timing = "9:00 AM - 1:00 PM";
            } else if (des.includes('Associate Professor')) {
                exp = 12;
                timing = "10:00 AM - 2:00 PM";
            } else if (des.includes('Assistant Professor')) {
                exp = 7;
                timing = "11:00 AM - 3:00 PM";
            } else if (des.includes('Senior Resident')) {
                exp = 3;
                timing = "2:00 PM - 6:00 PM";
            }

            const room_no = `Room ${roomCounter++}`;
            
            insert.run(doc.name, doc.department, exp, room_no, timing, 1, doc.phone, doc.designation);
        }
    });
    insertMany(rawData);
    console.log(`[DB] Seeded ${rawData.length} real doctors.`);
}

// ════════════════════════════════════════════════════════
//  DOCTOR FUNCTIONS
// ════════════════════════════════════════════════════════

function getAllDoctors() {
    return db.prepare('SELECT * FROM doctors ORDER BY specialization, name').all();
}

function getDoctorById(id) {
    return db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
}

function getDoctorsBySpecialization(spec) {
    return db.prepare(`
        SELECT * FROM doctors 
        WHERE LOWER(specialization) = LOWER(?) 
        ORDER BY available DESC, experience DESC
    `).all(spec);
}

function addDoctor({ name, specialization, experience, room_no, timing, available, contact, photo, designation }) {
    const result = db.prepare(`
        INSERT INTO doctors (name, specialization, experience, room_no, timing, available, contact, photo, designation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, specialization, experience || 0, room_no || '', timing || '9:00 AM - 4:00 PM (Mon-Sun)', available !== undefined ? available : 1, contact || '', photo || '', designation || '');
    return { id: result.lastInsertRowid, ...arguments[0] };
}

function updateDoctor(id, { name, specialization, experience, room_no, timing, available, contact, photo, designation }) {
    return db.prepare(`
        UPDATE doctors SET 
            name = ?, specialization = ?, experience = ?, room_no = ?, 
            timing = ?, available = ?, contact = ?, photo = ?, designation = ?
        WHERE id = ?
    `).run(name, specialization, experience, room_no, timing, available, contact, photo || '', designation || '', id);
}

function deleteDoctor(id) {
    return db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
}

function toggleAvailability(id, available) {
    return db.prepare('UPDATE doctors SET available = ? WHERE id = ?').run(available, id);
}

// ════════════════════════════════════════════════════════
//  APPOINTMENT FUNCTIONS
// ════════════════════════════════════════════════════════

function getAllAppointments() {
    return db.prepare(`
        SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        ORDER BY a.created_at DESC
    `).all();
}

function createAppointment({ patient_name, age, gender, symptoms, doctor_id, date, time, phone }) {
    const result = db.prepare(`
        INSERT INTO appointments (patient_name, age, gender, symptoms, doctor_id, date, time, phone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `).run(patient_name, age, gender, symptoms, doctor_id, date, time, phone || '');
    return { id: result.lastInsertRowid };
}

function updateAppointmentStatus(id, status) {
    return db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
}

function getAppointmentStats() {
    const total = db.prepare('SELECT COUNT(*) as cnt FROM appointments').get().cnt;
    const pending = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Pending'").get().cnt;
    const confirmed = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Confirmed'").get().cnt;
    const completed = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'Completed'").get().cnt;
    return { total, pending, confirmed, completed };
}

module.exports = {
    db, getAllDoctors, getDoctorById, getDoctorsBySpecialization, addDoctor, updateDoctor, deleteDoctor, toggleAvailability, getAllAppointments, createAppointment, updateAppointmentStatus, getAppointmentStats
};
