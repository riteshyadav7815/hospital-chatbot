const doctors = [
  { name: "Dr. Robin", department: "Derma", status: "ON DUTY" },
  { name: "Dr. Monu Kumar", department: "Surgery", status: "ON DUTY" },
  { name: "Dr. Satish Kumar", department: "Surgery", status: "ON DUTY" },

  { name: "Dr. Palak", department: "Pedia", status: "ON DUTY" },
  { name: "Dr. Pinky Atal", department: "Pedia", status: "ON DUTY" },

  { name: "Dr. Mansa Ram Sahran", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Jitin", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Deepak", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Shubham Rawal", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Shashank Sharma", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Priyatama Sawant", department: "Medicine", status: "ON DUTY" },
  { name: "Dr. Suresh Prajapat", department: "Medicine", status: "ON DUTY" },

  { name: "Dr. Sushila Jewalia", department: "Obs & Gyne", status: "ON DUTY" },

  { name: "Dr. Vikram Singh", department: "Ortho", status: "ON DUTY" },

  { name: "Dr. Ravisha", department: "ENT", status: "ON DUTY" },
  { name: "Dr. Azad Meena", department: "ENT", status: "ON DUTY" },

  { name: "Dr. Vikas Dhaka", department: "Psychiatry", status: "ON DUTY" },
  { name: "Dr. Imran Khan", department: "Psychiatry", status: "ON DUTY" },

  { name: "Dr. Tara Chand", department: "Dentistry", status: "ON DUTY" },

  { name: "Dr. Himanshi Panwar", department: "Physiotherapy", status: "ON DUTY" }
];

/**
 * Normalize AI specialist → hospital department
 */
function normalizeDepartment(dep) {
  if (!dep) return "Medicine";

  const d = dep.toLowerCase().trim();

  const map = {
    // General Medicine
    "general medicine": "Medicine",
    "medicine": "Medicine",
    "internal medicine": "Medicine",
    "physician": "Medicine",
    "general physician": "Medicine",
    "family medicine": "Medicine",

    // Common unavailable specialities → Medicine fallback
    "gastroenterology": "Medicine",
    "cardiology": "Medicine",
    "neurology": "Medicine",
    "nephrology": "Medicine",
    "urology": "Medicine",
    "pulmonology": "Medicine",
    "endocrinology": "Medicine",

    // Orthopaedics
    "orthopedics": "Ortho",
    "orthopaedics": "Ortho",
    "orthopedic": "Ortho",
    "orthopaedic": "Ortho",
    "bone specialist": "Ortho",
    "joint specialist": "Ortho",
    "fracture specialist": "Ortho",

    // ENT
    "ent": "ENT",
    "ear nose throat": "ENT",
    "otolaryngology": "ENT",

    // Dermatology
    "dermatology": "Derma",
    "dermatologist": "Derma",
    "skin": "Derma",
    "skin specialist": "Derma",
    "allergy skin": "Derma",

    // Obstetrics & Gynecology
    "gynecology": "Obs & Gyne",
    "gynaecology": "Obs & Gyne",
    "gynecologist": "Obs & Gyne",
    "gynaecologist": "Obs & Gyne",
    "obstetrics": "Obs & Gyne",
    "obstetrician": "Obs & Gyne",
    "obgyn": "Obs & Gyne",
    "obs & gyne": "Obs & Gyne",
    "women's health": "Obs & Gyne",
    "womens health": "Obs & Gyne",
    "period specialist": "Obs & Gyne",
    "menstrual specialist": "Obs & Gyne",

    // Pediatrics
    "pediatrics": "Pedia",
    "paediatrics": "Pedia",
    "pediatrician": "Pedia",
    "child specialist": "Pedia",
    "baby doctor": "Pedia",

    // Psychiatry
    "psychiatry": "Psychiatry",
    "psychologist": "Psychiatry",
    "mental health": "Psychiatry",
    "behavioral health": "Psychiatry",

    // Dental
    "dentistry": "Dentistry",
    "dental": "Dentistry",
    "dentist": "Dentistry",
    "tooth specialist": "Dentistry",

    // Surgery
    "surgery": "Surgery",
    "general surgery": "Surgery",
    "surgeon": "Surgery",

    // Physiotherapy
    "physiotherapy": "Physiotherapy",
    "physio": "Physiotherapy",
    "physical therapy": "Physiotherapy"
  };

  return map[d] || "Medicine";
}

/**
 * Get doctor by department
 */
function getDoctor(department) {
  const normalizedDepartment = normalizeDepartment(department);

  const availableDoctors = doctors.filter(
    (doctor) =>
      doctor.status === "ON DUTY" &&
      doctor.department.toLowerCase() ===
        normalizedDepartment.toLowerCase()
  );

  // fallback to Medicine if no exact department found
  if (availableDoctors.length === 0) {
    const medicineDoctors = doctors.filter(
      (doctor) =>
        doctor.status === "ON DUTY" &&
        doctor.department === "Medicine"
    );

    if (medicineDoctors.length === 0) return null;

    const randomMedicineDoctor =
      medicineDoctors[
        Math.floor(Math.random() * medicineDoctors.length)
      ];

    return randomMedicineDoctor;
  }

  // Random doctor from matching department
  const randomDoctor =
    availableDoctors[
      Math.floor(Math.random() * availableDoctors.length)
    ];

  return randomDoctor;
}

module.exports = {
  getDoctor,
  normalizeDepartment
};