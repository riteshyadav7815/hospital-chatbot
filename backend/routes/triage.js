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
 * Safe JSON parser
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
          "These symptoms may indicate a serious health emergency requiring urgent care.",
        possible_causes: [
          "Internal bleeding",
          "Heart problem",
          "Stroke",
          "Severe allergic reaction"
        ],
        severity: "emergency",
        specialist: "Emergency Medicine",
        urgency: "Go to emergency immediately",
        red_flags: [
          "Life-threatening symptoms detected"
        ],
        self_care: [
          "Do not delay treatment",
          "Call emergency services immediately"
        ],
        recommendations: [
          "Go to nearest emergency room now"
        ],
        tests_to_expect: [
          "Blood tests",
          "ECG",
          "Emergency imaging"
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

Analyze symptoms carefully and return ONLY valid JSON.

IMPORTANT SPECIALIST RULES:

1. Period pain, menstrual cramps, irregular periods, vaginal bleeding
→ Obstetrics & Gynecology

2. Pregnancy symptoms, pregnancy pain, pregnancy bleeding
→ Obstetrics & Gynecology

3. Child under 14 years
→ Paediatrics

4. Skin rash, itching, allergy, acne
→ Dermatology

5. Tooth pain, gums swelling, mouth pain
→ Dental

6. Anxiety, depression, panic attack, severe mood swings
→ Psychiatry

7. Neck pain, back pain, joint pain, fracture, bone pain
→ Orthopaedics

8. Ear pain, throat pain, nose blockage
→ ENT

9. Eye pain, blurred vision, eye redness
→ Ophthalmology

10. Breathing issues, cough, wheezing
→ Pulmonology

11. Chest pain, heart palpitations
→ Cardiology

12. Stomach pain, vomiting, digestion problems
→ Gastroenterology

13. If unclear:
→ General Medicine

Return ONLY JSON:

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

STRICT RULES:
- No markdown
- No explanation outside JSON
- No extra text
- JSON only
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
        temperature: 0.1
      });

    let content =
      aiResponse.choices[0].message.content.trim();

    let diagnosis =
      safeParseJSON(content);

    /**
     * AI fallback
     */
    if (!diagnosis) {
      diagnosis = {
        condition: "Unclear Condition",
        what_it_is:
          "Symptoms need medical evaluation.",
        why_it_happens:
          "Multiple possible causes exist.",
        explanation:
          "A doctor evaluation is recommended.",
        possible_causes: [],
        severity: "moderate",
        specialist: "General Medicine",
        urgency:
          "Visit doctor within 24–48 hours",
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
     * Normalize Department
     */
    const department =
      normalizeDepartment(
        diagnosis.specialist
      );

    /**
     * Doctor Assignment
     */
    const doctor =
      getDoctor(department);

    /**
     * Debug Logs
     */
    console.log(
      "AI Specialist:",
      diagnosis.specialist
    );

    console.log(
      "Normalized Department:",
      department
    );

    console.log(
      "Assigned Doctor:",
      doctor
    );

    /**
     * Final Response
     */
    const finalResponse = {
      emergency: false,
      condition:
        diagnosis.condition,
      what_it_is:
        diagnosis.what_it_is,
      why_it_happens:
        diagnosis.why_it_happens,
      explanation:
        diagnosis.explanation,
      possible_causes:
        diagnosis.possible_causes || [],
      severity:
        diagnosis.severity,
      specialist:
        department,
      urgency:
        diagnosis.urgency,
      red_flags:
        diagnosis.red_flags || [],
      self_care:
        diagnosis.self_care || [],
      recommendations:
        diagnosis.recommendations || [],
      tests_to_expect:
        diagnosis.tests_to_expect || [],
      doctor:
        doctor || null,
      referral_message:
        doctor
          ? null
          : "No doctor available. Please visit higher medical center.",
      disclaimer:
        "This chatbot provides general guidance only and is not a medical diagnosis."
    };

    return res.json(
      finalResponse
    );

  } catch (err) {
    console.error(
      "[Triage Error]",
      err
    );

    return res.status(500).json({
      error:
        "Failed to process symptoms"
    });
  }
});

module.exports = router;