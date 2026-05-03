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

/**
 * Emergency Detection
 */
function isEmergency(text) {
  if (!text) return false;

  const t = text.toLowerCase();

  const emergencyKeywords = [
    "vomiting blood",
    "coughing blood",
    "unconscious",
    "seizure",
    "not breathing",
    "cannot breathe",
    "difficulty breathing",
    "severe chest pain",
    "heart attack",
    "stroke",
    "heavy bleeding",
    "fainted",
    "fainting",
    "blood in stool",
    "black stool",
    "severe allergic reaction",
    "anaphylaxis",
    "suicidal thoughts",
    "overdose",
    "poisoning",
    "paralysis",
    "unable to speak",
    "loss of vision",
    "severe burns"
  ];

  return emergencyKeywords.some((word) =>
    t.includes(word)
  );
}

/**
 * Safe JSON Parser
 */
function safeParseJSON(content) {
  try {
    if (content.startsWith("```json")) {
      content = content
        .replace(/^```json/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    if (content.startsWith("```")) {
      content = content
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Triage Route
 */
router.post("/", async (req, res) => {
  try {
    const { text, age, gender } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Symptoms are required"
      });
    }

    /**
     * Emergency Fast Path
     */
    if (isEmergency(text)) {
      return res.json({
        emergency: true,
        condition: "Medical Emergency",
        what_it_is:
          "Your symptoms may indicate an emergency medical condition.",
        why_it_happens:
          "Some symptoms can signal serious internal problems requiring urgent care.",
        possible_causes: [
          "Internal bleeding",
          "Heart problem",
          "Neurological event",
          "Severe allergic reaction"
        ],
        severity: "emergency",
        specialist: "Emergency Medicine",
        urgency: "Go to emergency immediately",
        red_flags: [
          "Life-threatening symptoms detected"
        ],
        self_care: [
          "Do not drive yourself if unstable",
          "Call emergency services",
          "Stay with someone nearby"
        ],
        recommendations: [
          "Go to nearest ER now"
        ],
        tests_to_expect: [
          "Blood tests",
          "Imaging",
          "ECG"
        ],
        doctor: null,
        disclaimer:
          "This chatbot provides general guidance only and is not a medical diagnosis."
      });
    }

    /**
     * AI Prompt
     */
    const systemPrompt = `
You are an advanced hospital triage AI.

Analyze symptoms like a professional hospital pre-diagnosis assistant.

Return ONLY valid JSON.

JSON FORMAT:

{
  "condition": "",
  "what_it_is": "",
  "why_it_happens": "",
  "explanation": "",
  "possible_causes": [],
  "severity": "low|moderate|high|emergency",
  "specialist": "",
  "urgency": "",
  "red_flags": [],
  "self_care": [],
  "recommendations": [],
  "tests_to_expect": []
}

SPECIALIST MUST BE ONLY ONE OF:

[
"General Medicine",
"Emergency Medicine",
"Cardiology",
"Neurology",
"Neurosurgery",
"Orthopaedics",
"Physiotherapy",
"Pulmonology",
"Gastroenterology",
"Hepatology",
"Nephrology",
"Urology",
"Endocrinology",
"Dermatology",
"Obstetrics & Gynecology",
"Fertility Medicine",
"Paediatrics",
"Neonatology",
"ENT",
"Audiology",
"Ophthalmology",
"Psychiatry",
"Psychology",
"Dental",
"Oral Surgery",
"General Surgery",
"Laparoscopic Surgery",
"Oncology",
"Radiation Oncology",
"Rheumatology",
"Infectious Disease",
"Allergy & Immunology",
"Hematology",
"Vascular Surgery",
"Plastic Surgery",
"Pain Management",
"Sleep Medicine",
"Nutrition & Dietetics",
"Sexual Health",
"Geriatrics",
"Sports Medicine"
]

If unclear:
use "General Medicine"

No markdown.
No extra text.
JSON only.
`;

    const userPrompt = `
Patient age: ${age || "Unknown"}
Patient gender: ${gender || "Unknown"}

Symptoms:
${text}
`;

    /**
     * AI Call
     */
    const aiResponse =
      await groq.chat.completions.create({
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

    let diagnosis = safeParseJSON(content);

    /**
     * Fallback if AI breaks JSON
     */
    if (!diagnosis) {
      diagnosis = {
        condition: "Unclear Condition",
        what_it_is:
          "Symptoms need doctor evaluation.",
        why_it_happens:
          "Many conditions can cause these symptoms.",
        explanation:
          "A doctor evaluation is recommended.",
        possible_causes: [],
        severity: "moderate",
        specialist: "General Medicine",
        urgency: "Visit doctor within 24–48 hours",
        red_flags: [],
        self_care: [
          "Rest",
          "Stay hydrated"
        ],
        recommendations: [
          "Consult doctor"
        ],
        tests_to_expect: []
      };
    }

    /**
     * Normalize department
     */
    const department =
      normalizeDepartment(
        diagnosis.specialist
      );

    /**
     * Assign doctor
     */
    const doctor =
      getDoctor(department);

    /**
     * Final response
     */
    const finalResponse = {
      emergency: false,
      condition: diagnosis.condition,
      what_it_is: diagnosis.what_it_is,
      why_it_happens: diagnosis.why_it_happens,
      explanation: diagnosis.explanation,
      possible_causes:
        diagnosis.possible_causes || [],
      severity: diagnosis.severity,
      specialist: department,
      urgency: diagnosis.urgency,
      red_flags:
        diagnosis.red_flags || [],
      self_care:
        diagnosis.self_care || [],
      recommendations:
        diagnosis.recommendations || [],
      tests_to_expect:
        diagnosis.tests_to_expect || [],
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
      error:
        "Failed to process symptoms"
    });
  }
});

module.exports = router;