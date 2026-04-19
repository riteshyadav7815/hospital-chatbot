-- ============================================
-- Hospital Doctor Recommendation System
-- Database Schema Reference
-- ============================================

-- Doctors table
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    symptoms TEXT,
    doctor_id INTEGER,
    date TEXT,
    time TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

-- ============================================
-- Seed Data: 8 Hospital Doctors
-- ============================================
INSERT INTO doctors (name, specialization, experience, room_no, timing, available, contact) VALUES
('Dr. Rajesh Sharma',  'Cardiologist',        12, '204', '10:00 AM - 2:00 PM', 1, '9876543210'),
('Dr. Priya Patel',    'Dermatologist',         8, '105', '9:00 AM - 1:00 PM',  1, '9876543211'),
('Dr. Amit Kumar',     'Neurologist',          15, '302', '11:00 AM - 3:00 PM', 1, '9876543212'),
('Dr. Sneha Gupta',    'General Physician',    10, '101', '9:00 AM - 5:00 PM',  1, '9876543213'),
('Dr. Vikram Singh',   'Gastroenterologist',   14, '210', '10:00 AM - 4:00 PM', 1, '9876543214'),
('Dr. Ananya Reddy',   'Orthopedic',            9, '308', '9:00 AM - 12:00 PM', 1, '9876543215'),
('Dr. Rahul Mehta',    'General Physician',      6, '102', '2:00 PM - 6:00 PM',  1, '9876543216'),
('Dr. Kavita Joshi',   'Cardiologist',          18, '205', '2:00 PM - 6:00 PM',  1, '9876543217');
