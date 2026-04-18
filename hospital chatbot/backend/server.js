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
    if (!spec) return 'General Physician';
    const lower = spec.toLowerCase();
    if (lower.includes('cardio') || lower.includes('heart')) return 'Cardiologist';
    if (lower.includes('derma') || lower.includes('skin')) return 'Dermatologist';
    if (lower.includes('neuro')) return 'Neurologist';
    if (lower.includes('gastro') || lower.includes('stomach')) return 'Gastroenterologist';
    if (lower.includes('ortho') || lower.includes('bone')) return 'Orthopedic';
    if (lower.includes('general') || lower.includes('physician')) return 'General Physician';
    return spec;
}

// ─── Enhanced Diagnose Route ────────────────────────────────
app.post('/api/diagnose', diagnoseLimiter, async (req, res) => {
    try {
        const { name, age, gender, symptoms } = req.body;

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

        let diagnosis = null;

        // ─── Step 1: Manual symptom fallback ────────────
        const fallback = matchSymptoms(symptoms);
        if (fallback) {
            console.log(`[Diagnose] Fallback match: "${symptoms}" → ${fallback.disease}`);
            diagnosis = {
                condition: fallback.disease,
                severity: fallback.severity,
                specialist: fallback.specialization
            };
        }

        // ─── Step 2: Groq API (if no fallback match) ───
        if (!diagnosis) {
            if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_key_here') {
                // No API key and no fallback match → use generic response
                diagnosis = {
                    condition: "Unknown Condition",
                    severity: "Medium",
                    specialist: "General Physician"
                };
            } else {
                try {
                    const systemPrompt = `You are an expert medical AI assistant.
IMPORTANT Medical Safety: NEVER say "You have X disease". Return ONLY valid JSON with these EXACT keys:
{
  "condition": "Based on your symptoms, this may be related to [condition]",
  "severity": "Low / Medium / High",
  "specialist": "Correct specialist"
}
No markdown. No explanation. Only JSON.`;

                    const userPrompt = `Symptoms: ${symptoms}
Analyze the symptoms and return the exact JSON structure required.`;

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
                        severity: "Medium",
                        specialist: "General Physician"
                    };
                }
            }
        }

        // Add standard disclaimer
        diagnosis.disclaimer = "This chatbot provides general guidance only and is not a medical diagnosis.";

        const specialization = normalizeSpecialization(diagnosis.specialist);
        diagnosis.specialist = specialization; // ensure normalized

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
