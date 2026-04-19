/**
 * Hospital Doctor Recommendation System — Server
 * ────────────────────────────────────────────────
 * Enhanced backend with:
 *  - Symptom fallback + Groq AI diagnosis
 *  - Real doctor database matching
 *  - Doctor CRUD API
 *  - Appointment booking API
 *  - Admin authentication
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { Groq } = require('groq-sdk');
const rateLimit = require('express-rate-limit');

dotenv.config();

// ─── Import DB and Routes ───────────────────────────────
const db = require('./db');
const { router: authRouter } = require('./routes/auth');
const doctorsRouter = require('./routes/doctors');
const appointmentsRouter = require('./routes/appointments');

const app = express();
const port = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────

// Dynamic CORS based on .env ALLOWED_ORIGINS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['*'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const diagnoseLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: 'Too many requests. Please wait a minute before trying again.' }
});

const appointmentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: { error: 'Too many booking requests. Please try again later.' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Initialize Groq ────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Mount API Routes ───────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentLimiter, appointmentsRouter);

// ─── Health Check ───────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Hospital Chatbot Backend is running' });
});

// ─── Symptom → Specialization Mapping ───────────────────
const SYMPTOM_MAP = [
    {
        keywords: ['chest pain'],
        disease: "Heart Issue",
        probability: "75%",
        severity: "High",
        advice: "Seek immediate medical attention.",
        specialization: "Cardiologist"
    },
    {
        keywords: ['skin rash'],
        disease: "Skin Allergy",
        probability: "75%",
        severity: "Low",
        advice: "Avoid allergen, antihistamine.",
        specialization: "Dermatologist"
    },
    {
        keywords: ['headache'],
        disease: "Migraine",
        probability: "70%",
        severity: "Medium",
        advice: "Rest in dark room, hydrate.",
        specialization: "Neurologist"
    },
    {
        keywords: ['stomach pain'],
        disease: "Gastritis",
        probability: "65%",
        severity: "Medium",
        advice: "Avoid spicy food, consult doctor.",
        specialization: "Gastroenterologist"
    },
    {
        keywords: ['bone pain', 'fracture', 'joint pain'],
        disease: "Musculoskeletal Issue",
        probability: "70%",
        severity: "Medium",
        advice: "Rest the affected area, apply ice. See a doctor.",
        specialization: "Orthopedic"
    },
    {
        keywords: ['cold', 'cough', 'fever'],
        disease: "Common Cold",
        probability: "80%",
        severity: "Low",
        advice: "Rest, hydrate, paracetamol if needed.",
        specialization: "General Physician"
    }
];

/** Match symptoms to a known condition and specialization */
function matchSymptoms(symptomsText) {
    const lower = symptomsText.toLowerCase();
    for (const entry of SYMPTOM_MAP) {
        // Match if ANY keyword in the group is found
        const matched = entry.keywords.some(kw => lower.includes(kw));
        if (matched) return entry;
    }
    return null;
}

/** Map a specialist name (from Groq or fallback) to a DB specialization */
function normalizeSpecialization(spec) {
    if (!spec) return 'General Medicine';
    const lower = spec.toLowerCase();
    
    // Unavailable Specialists
    if (lower.includes('cardio') || lower.includes('heart')) return 'Cardiologist';
    if (lower.includes('neuro') || lower.includes('brain')) return 'Neurologist';
    if (lower.includes('nephro') || lower.includes('kidney')) return 'Nephrologist';
    if (lower.includes('uro') || lower.includes('bladder')) return 'Urologist';
    if (lower.includes('onco') || lower.includes('cancer')) return 'Oncologist';
    if (lower.includes('pulmo') || lower.includes('lung')) return 'Pulmonologist';
    if (lower.includes('gastro') || lower.includes('stomach')) return 'Gastroenterologist';
    if (lower.includes('endo') || lower.includes('hormone')) return 'Endocrinologist';

    // Available Mappings
    if (lower.includes('derma') || lower.includes('skin')) return 'Skin & VD';
    if (lower.includes('gyn') || lower.includes('obs') || lower.includes('women')) return 'Obstetrics & Gynecology';
    if (lower.includes('ped') || lower.includes('paed') || lower.includes('child')) return 'Paediatrics';
    if (lower.includes('ortho') || lower.includes('bone')) return 'Orthopaedics';
    if (lower.includes('ent') || lower.includes('otolaryng')) return 'ENT';
    if (lower.includes('ophth') || lower.includes('eye')) return 'Ophthalmology';
    if (lower.includes('psych')) return 'Psychiatry';
    if (lower.includes('dent') || lower.includes('tooth')) return 'Dental';
    if (lower.includes('surg')) return 'General Surgery';
    if (lower.includes('radio')) return 'Radiology';
    if (lower.includes('patho')) return 'Pathology';
    if (lower.includes('anaes')) return 'Anaesthesiology';
    if (lower.includes('community')) return 'Community Medicine';

    return 'General Medicine';
}

// ─── Follow-Up Questions Route ──────────────────────────────
app.post('/api/follow-up-questions', diagnoseLimiter, async (req, res) => {
    try {
        const { symptoms, age, gender, language } = req.body;
        if (!symptoms) return res.status(400).json({ error: 'Symptoms are required.' });
        
        const langMap = { "en":"English", "hi":"Hindi", "mr":"Marathi", "ta":"Tamil", "bn":"Bengali", "gu":"Gujarati" };
        const langName = langMap[language] || "English";

        let questions = [
            { id: "q1", question: "How long have you been experiencing these symptoms?", type: "text" },
            { id: "q2", question: "On a scale of 1 to 10, how severe is your discomfort?", type: "scale" },
            { id: "q3", question: "Are the symptoms constant, or do they come and go?", type: "text" },
            { id: "q4", question: "Do you have any other associated symptoms like fever, nausea, or dizziness?", type: "text" }
        ];

        if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_key_here') {
            try {
                const systemPrompt = `You are a medical AI assistant.
Based on the patient's symptoms, generate exactly 4 contextual follow-up questions to gather more specific information for triage.
IMPORTANT: The user speaks ${langName.toUpperCase()}. Generate exactly 4 follow-up questions in ${langName.toUpperCase()} language.
Return ONLY valid JSON with this EXACT structure:
{
  "questions": [
    { "id": "q1", "question": "...", "type": "text" },
    { "id": "q2", "question": "...", "type": "scale" },
    { "id": "q3", "question": "...", "type": "text" },
    { "id": "q4", "question": "...", "type": "text" }
  ]
}
Return JSON with questions translated to ${langName.toUpperCase()}.
No markdown. No explanation. Only JSON.`;

                const userPrompt = `Patient Age: ${age || 'Unknown'}, Gender: ${gender || 'Unknown'}\nSymptoms: ${symptoms}`;

                const response = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.2
                });

                let content = response.choices[0].message.content.trim();
                if (content.startsWith("```json")) content = content.replace(/^```json/i, "").replace(/```$/i, "").trim();
                else if (content.startsWith("```")) content = content.replace(/^```/i, "").replace(/```$/i, "").trim();

                const parsed = JSON.parse(content);
                if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                    questions = parsed.questions;
                }
            } catch (err) {
                console.error('[Follow-Up] Groq error:', err.message);
            }
        }
        res.json({ questions });
    } catch (error) {
        console.error('[Follow-Up] Error:', error);
        res.status(500).json({ error: 'Failed to generate questions.' });
    }
});

// ─── Enhanced Diagnose Route ────────────────────────────────
app.post('/api/diagnose', diagnoseLimiter, async (req, res) => {
    try {
        const { name, age, gender, symptoms, followUpAnswers, language } = req.body;
        
        const langMap = { "en":"English", "hi":"Hindi", "mr":"Marathi", "ta":"Tamil", "bn":"Bengali", "gu":"Gujarati" };
        const langName = langMap[language] || "English";

        // Input Validation
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Valid name is required.' });
        }
        if (!age || isNaN(age) || age < 1 || age > 120) {
            return res.status(400).json({ error: 'Valid age between 1 and 120 is required.' });
        }
        if (!symptoms || typeof symptoms !== 'string' || symptoms.trim() === '') {
            return res.status(400).json({ error: 'Please describe your symptoms.' });
        }

        let context = `Symptoms: ${symptoms}`;
        if (followUpAnswers && followUpAnswers.length > 0) {
            context += `\nFollow-up Details: ` + followUpAnswers.map(a => `${a.question}: ${a.answer}`).join(' | ');
        }

        let diagnosis = null;

        // ─── Step 1: Manual symptom fallback ────────────
        const fallback = matchSymptoms(symptoms);
        if (fallback) {
            console.log(`[Diagnose] Fallback match: "${symptoms}" → ${fallback.disease}`);
            diagnosis = {
                condition: fallback.disease,
                explanation: `Based on your symptoms, this could be related to ${fallback.disease}.`,
                severity: fallback.severity.toLowerCase(),
                specialist: fallback.specialization,
                red_flags: ["If symptoms worsen, seek immediate medical attention."],
                recommendations: [fallback.advice, "Rest and monitor your symptoms."],
                urgency: fallback.severity === "High" ? "Go to ER immediately" : "See doctor within 24h"
            };
        }

        // ─── Step 2: Groq API (if no fallback match) ───
        if (!diagnosis) {
            if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_key_here') {
                diagnosis = {
                    condition: "Unknown Condition",
                    explanation: "We could not determine a specific condition based on the provided symptoms.",
                    severity: "moderate",
                    specialist: "General Physician",
                    red_flags: ["Seek immediate help if symptoms become severe."],
                    recommendations: ["Consult a doctor for a proper evaluation."],
                    urgency: "See doctor within 24h"
                };
            } else {
                try {
                    const systemPrompt = `You are an expert medical AI assistant.
IMPORTANT Medical Safety: Return ONLY valid JSON with these EXACT keys:
{
  "condition": "Likely condition name",
  "explanation": "2-3 sentence reasoning based on symptoms and follow-ups",
  "severity": "low|moderate|high|emergency",
  "specialist": "Correct specialist name (e.g. Cardiologist)",
  "red_flags": ["warning 1", "warning 2"],
  "recommendations": ["advice 1", "advice 2"],
  "urgency": "Can wait for appointment | See doctor within 24h | Go to ER immediately"
}
Respond entirely in ${langName.toUpperCase()} language. The patient speaks ${langName.toUpperCase()}.
All fields (condition, explanation, red_flags, recommendations, urgency) must be in ${langName.toUpperCase()}.
Only keep the "specialist" and "severity" fields in exact English (for database matching and system routing).
No markdown. No explanation. Only JSON.`;

                    const userPrompt = `Patient Age: ${age}, Gender: ${gender}\n${context}\nAnalyze the patient's information and return the exact JSON structure required.`;

                    const response = await groq.chat.completions.create({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.1
                    });

                    let content = response.choices[0].message.content.trim();

                    if (content.startsWith("```json")) {
                        content = content.replace(/^```json/i, "").replace(/```$/i, "").trim();
                    } else if (content.startsWith("```")) {
                        content = content.replace(/^```/i, "").replace(/```$/i, "").trim();
                    }

                    diagnosis = JSON.parse(content);
                    console.log(`[Diagnose] Groq diagnosis: ${diagnosis.condition}`);
                } catch (groqErr) {
                    console.error('[Diagnose] Groq error:', groqErr.message || groqErr);
                    diagnosis = {
                        condition: "Unknown Condition",
                        explanation: "An error occurred during AI analysis. Please consult a doctor.",
                        severity: "moderate",
                        specialist: "General Physician",
                        red_flags: ["Seek immediate help if symptoms become severe."],
                        recommendations: ["Consult a doctor for a proper evaluation."],
                        urgency: "See doctor within 24h"
                    };
                }
            }
        }

        // Add standard disclaimer
        diagnosis.disclaimer = "This chatbot provides general guidance only and is not a medical diagnosis.";

        const originalSpecialist = normalizeSpecialization(diagnosis.specialist);
        const UNAVAILABLE_SPECIALISTS = ['Cardiologist', 'Neurologist', 'Nephrologist', 'Urologist', 'Oncologist', 'Pulmonologist', 'Gastroenterologist', 'Endocrinologist'];
        
        if (UNAVAILABLE_SPECIALISTS.includes(originalSpecialist)) {
            const isHighSeverity = diagnosis.severity.toLowerCase().includes('high') || diagnosis.severity.toLowerCase().includes('emergency');
            if (isHighSeverity) {
                diagnosis.availability_status = "external_referral";
                diagnosis.referral_message = `Our hospital does not have a ${originalSpecialist} specialist. For this condition, we recommend visiting a multi-specialty hospital. In case of emergency, call 102/108 immediately.`;
                diagnosis.specialist = null;
            } else {
                diagnosis.availability_status = "referral_needed";
                diagnosis.referral_message = `We don't have a dedicated ${originalSpecialist} specialist, but our General Medicine OPD can provide initial assessment.`;
                diagnosis.specialist = "General Medicine";
            }
        } else {
            const docExists = db.getAllDoctors().some(d => d.specialization === originalSpecialist);
            if (docExists || originalSpecialist === 'General Medicine') {
                 diagnosis.availability_status = "available";
                 diagnosis.referral_message = null;
                 diagnosis.specialist = originalSpecialist;
            } else {
                 diagnosis.availability_status = "referral_needed";
                 diagnosis.referral_message = `We couldn't find a direct match for ${originalSpecialist}, but our General Medicine OPD can help.`;
                 diagnosis.specialist = "General Medicine";
            }
        }

        // ─── Step 3: Return diagnosis ───────────
        res.json(diagnosis);

    } catch (error) {
        console.error('[Diagnose] Error:', error);
        res.status(500).json({ error: 'Failed to analyze symptoms. Please try again later.' });
    }
});

// ─── Serve pages ────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'chatbot.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

// ─── Start Server ───────────────────────────────────────
app.listen(port, () => {
    console.log(`✅ Hospital Chatbot Server running on http://localhost:${port}`);
    console.log(`🏥 Chatbot:  http://localhost:${port}`);
    console.log(`🔐 Admin:    http://localhost:${port}/admin.html`);
});
