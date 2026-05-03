const express = require("express");
const router = express.Router();
const { Groq } = require("groq-sdk");

const {
  getDoctor,
  normalizeDepartment
} = require("../utils/doctorAssignment");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Emergency detection
function isEmergency(text) {
  if (!text) return false;

  const t = text.toLowerCase();

  const emergencyKeywords = [
    "vomiting blood",
    "unconscious",
    "seizure",
    "not breathing",
    "severe chest pain",
    "cannot breathe",
    "heavy bleeding",
    "stroke",
    "heart attack",
    "fainted"
  ];

  return emergencyKeywords.some((word) => t.includes(word));
}

router.post("/", async (req, res) => {
  try {
    const { text, age, gender } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Symptoms are required"
      });
    }

    // Emergency check
    if (isEmergency(text)) {
      return res.json({
        emergency: true,
        condition: "Medical Emergency",
        explanation:
          "Your symptoms may indicate a serious emergency condition requiring immediate medical care.",
        severity: "high",
        specialist: "Emergency Care",
        urgency: "Go to ER immediately",
        red_flags: [
          "Emergency symptoms detected"
        ],
        recommendations: [
          "Do not wait",
          "Go to emergency immediately",
          "Call emergency support if needed"
        ],
        doctor: null,
        disclaimer:
          "This chatbot provides general guidance only and is not a medical diagnosis."
      });
    }

    // AI medical triage
    const systemPrompt = `
You are an experienced hospital triage assistant.

Analyze symptoms and return ONLY JSON.

Rules:
1. Explain what the likely condition is.
2. Explain why these symptoms may happen.
3. Explain possible causes.
4. Explain what patient can do at home first.
5. Explain when to seek doctor.
6. Give medical red flags.
7. Choose specialist.

Return ONLY this JSON:

{
  "condition": "",
  "explanation": "",
  "possible_causes": [],
  "severity": "low|moderate|high",
  "specialist": "",
  "urgency": "",
  "red_flags": [],
  "recommendations": []
}
`;

    const userPrompt = `
Patient age: ${age || "Unknown"}
Patient gender: ${gender || "Unknown"}

Symptoms:
${text}
`;

    const aiResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2
    });

    let content =
      aiResponse.choices[0].message.content.trim();

    if (content.startsWith("```json")) {
      content = content
        .replace(/^```json/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    const diagnosis = JSON.parse(content);

    // Normalize department
    const department = normalizeDepartment(
      diagnosis.specialist
    );

    // Assign doctor
    const doctor = getDoctor(department);

    // Final enriched response
    const finalResponse = {
      emergency: false,
      condition: diagnosis.condition,
      explanation: diagnosis.explanation,
      possible_causes: diagnosis.possible_causes || [],
      severity: diagnosis.severity,
      specialist: department,
      urgency: diagnosis.urgency,
      red_flags: diagnosis.red_flags || [],
      recommendations: diagnosis.recommendations || [],
      doctor: doctor || null,
      referral_message: doctor
        ? null
        : "No doctor available. Please visit higher medical center.",
      disclaimer:
        "This chatbot provides general guidance only and is not a medical diagnosis."
    };

    return res.json(finalResponse);

  } catch (err) {
    console.error("[Triage Error]", err);

    return res.status(500).json({
      error: "Failed to process symptoms"
    });
  }
});

module.exports = router;