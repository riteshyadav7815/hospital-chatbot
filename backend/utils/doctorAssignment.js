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

function normalizeDepartment(dep) {
  if (!dep) return "Medicine";

  const map = {
    gastroenterology: "Medicine",
    cardiology: "Medicine",
    orthopedics: "Ortho",
    ent: "ENT",
    dermatology: "Derma",
    gynecology: "Obs & Gyne",
    pediatrics: "Pedia"
  };

  return map[dep.toLowerCase()] || dep;
}

function getDoctor(department) {
  const normalized = normalizeDepartment(department);

  const available = doctors.filter(
    d =>
      d.status === "ON DUTY" &&
      d.department.toLowerCase() === normalized.toLowerCase()
  );

  if (available.length === 0) {
    return doctors.find(
      d => d.status === "ON DUTY" && d.department === "Medicine"
    ) || null;
  }

  return available[0];
}

module.exports = { getDoctor, normalizeDepartment };