const express = require("express");
const router = express.Router();

const { getDoctor, normalizeDepartment } = require("../utils/doctorAssignment");

// 🚨 Emergency detection
function isEmergency(text) {
  if (!text) return false;

  const t = text.toLowerCase();

  return (
    t.includes("vomiting blood") ||
    t.includes("unconscious") ||
    t.includes("seizure") ||
    t.includes("not breathing") ||
    t.includes("severe chest pain")
  );
}

router.post("/", async (req, res) => {
  try {
    const { text, aiData } = req.body;

    // 🚨 Emergency check
    if (isEmergency(text)) {
      return res.json({
        emergency: true,
        message: "🚨 Go to Emergency immediately",
        doctor: null
      });
    }

    // 🧠 Get department from AI
    const rawDepartment = aiData?.department;

    const department = normalizeDepartment(rawDepartment);

    // 👨‍⚕️ Get doctor
    const doctor = getDoctor(department);

    if (!doctor) {
      return res.json({
        department,
        doctor: null,
        message: "No doctor available, refer to higher center"
      });
    }

    return res.json({
      emergency: false,
      department,
      doctor: doctor.name,
      message: "Doctor assigned successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;