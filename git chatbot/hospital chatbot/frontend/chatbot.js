/**
 * AI Medical Chatbot Widget — Hospital Edition
 * ─────────────────────────────────────────────
 * Secure, Persistent, Embeddable widget.
 */
(function () {
    'use strict';

    // ─── CONFIGURATION & API ─────────────────────────────────
    const config = window.ChatbotConfig || {
        hospitalName: "City Hospital",
        themeColor: "#0066ff"
    };

    let API_BASE = 'http://localhost:3000';
    let backendConnectionVerified = false;
    const FALLBACK_TEXT = {
        welcome: "Hello! I'm your medical assistant.",
        ask_name: "What's your name?",
        ask_age: "How old are you?",
        ask_gender: "What is your gender? (Male/Female/Other)",
        ask_chief_symptom: "What is your main symptom or concern today?",
        ask_body_part: "Which body part is affected? (e.g., chest, head, abdomen)",
        ask_duration: "When did this symptom start? (e.g., today, 2 days ago, 1 week)",
        ask_severity: "On a scale of 1 to 10, how severe is it? (1 = mild, 10 = severe)",
        ask_associated: "Do you have any other symptoms? (e.g., fever, nausea, headache)",
        type_message: "Type your message...",
        invalid_age: "Please enter a valid age (1-120).",
        analyzing: "Analyzing your symptoms...",
        error_analyzing: "We're having trouble analyzing your request. Please try again or contact the hospital."
    };

    // ─── TRANSLATIONS ───────────────────────────────────────
    function t(key) {
        const lang = state?.language || localStorage.getItem('hc_chat_language') || 'en';
        if (!window.TRANSLATIONS) return FALLBACK_TEXT[key] || key;
        return (
            window.TRANSLATIONS[lang]?.[key] ||
            window.TRANSLATIONS['en']?.[key] ||
            FALLBACK_TEXT[key] ||
            key
        );
    }

    function ensureTranslationsLoaded(maxRetries = 6, delayMs = 250) {
        return new Promise((resolve) => {
            let retries = 0;
            const check = () => {
                const ready = !!(window.TRANSLATIONS && window.TRANSLATIONS.en && window.TRANSLATIONS.hi);
                if (ready) return resolve(true);
                retries++;
                if (retries > maxRetries) {
                    console.error('translations.js did not load correctly. Falling back to built-in English text.');
                    return resolve(false);
                }
                setTimeout(check, delayMs);
            };
            check();
        });
    }

    function askLanguage() {
        const next = (state.language === 'hi') ? 'en' : 'hi';
        window.hcSelectLang(next);
    }

    window.hcSelectLang = function(lang) {
        const safeLang = (lang === 'hi' || lang === 'en') ? lang : 'en';
        state.language = safeLang;
        localStorage.setItem('hc_chat_language', safeLang);
        saveState();

        // Task 2: Force Re-render After Language Change (Clear UI)
        body.innerHTML = '';
        state.history = [];
        
        input.placeholder = t('type_message');

        setEnabled(true);
        botMsg(t('language_updated') || (safeLang === 'hi' ? 'भाषा बदल दी गई।' : 'Language updated.'));
    };

    // ─── STATE MANAGEMENT (LocalStorage) ─────────────────────
    const STATE_KEY = 'hc_chat_state';
    const INTRO_KEY = 'hc_intro_dismissed';
    
    let state = {
        isOpen: false,
        currentStep: 'NAME',
        language: 'en',
        voiceReadAloud: false,
        userData: { name: '', age: '', gender: '', phone: '' },
        chiefSymptom: '',
        bodyPart: '',
        duration: '',
        severity: '',
        associatedSymptoms: '',
        followUpQuestions: [],
        followUpAnswers: [],
        currentQuestionIndex: 0,
        symptomContext: '',
        diagnosisHistory: [],
        lastDiagnosis: null,
        history: []
    };

    function loadState() {
        try {
            const saved = localStorage.getItem(STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.userData) state = parsed;
            }
        } catch (e) {}
        // Language default (English) but allow Hindi
        const savedLang = localStorage.getItem('hc_chat_language');
        state.language = (state.language === 'hi' || state.language === 'en') ? state.language
                     : (savedLang === 'hi' || savedLang === 'en') ? savedLang
                     : 'en';
        localStorage.setItem('hc_chat_language', state.language);

        // Persist voice read-aloud preference
        if (typeof state.voiceReadAloud !== 'boolean') {
            const v = localStorage.getItem('hc_voice_read');
            state.voiceReadAloud = v === '1';
        }

        // If user has an old saved flow, move to Groq-driven follow-ups
        const deprecatedSteps = ['BODY_PART', 'DURATION', 'SEVERITY', 'ASSOCIATED'];
        if (deprecatedSteps.includes(state.currentStep)) {
            state.currentStep = 'CHIEF_SYMPTOM';
            state.bodyPart = '';
            state.duration = '';
            state.severity = '';
            state.associatedSymptoms = '';
            saveState();
        }
    }

    function saveState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    // ─── DOM REFERENCES ─────────────────────────────────────
    let root, widget, fab, popup, body, input, sendBtn;

    // ─── LOAD ASSETS ────────────────────────────────────────
    function loadAssets() {
        if (!document.querySelector('link[href*="chatbot.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = `${API_BASE}/chatbot.css`;
            document.head.appendChild(cssLink);
        }
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(faLink);
        }
    }

    // ─── BUILD WIDGET ───────────────────────────────────────
    function build() {
        root = document.createElement('div');
        root.id = 'hospital-chatbot-root';
        
        widget = document.createElement('div');
        widget.className = 'hc-widget';
        widget.style.setProperty('--hc-primary', config.themeColor);
        widget.style.setProperty('--hc-accent', config.accentColor || '#22c1b5');

        widget.innerHTML = `
            <!-- Intro Card -->
            <div class="hc-launcher-card" id="hc-launcher">
                <div class="hc-launcher-badge">Care Assistant</div>
                <div class="hc-launcher-bot-wrap">
                    <div class="hc-launcher-bot-glow"></div>
                    <div class="hc-launcher-bot">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                </div>
                <h4>${esc(config.hospitalName)} Care Companion</h4>
                <p>Chat in English or Hindi, or use voice to explain your symptoms.</p>
                <button class="hc-launcher-start" id="hc-launcher-start">${esc(t('start_chat') || 'Start chat')}</button>
            </div>

            <!-- Floating Button -->
            <button class="hc-fab ${state.isOpen ? 'open' : ''}" id="hc-fab" aria-label="Open chatbot">
                <i class="fa-solid fa-comment-medical hc-icon-chat"></i>
                <i class="fa-solid fa-xmark hc-icon-close"></i>
            </button>

            <!-- Popup Window -->
            <div class="hc-popup ${state.isOpen ? 'open' : ''}" id="hc-popup">
                <div class="hc-header">
                    <div class="hc-header-left">
                        <div class="hc-header-avatar">
                            <i class="fa-solid fa-robot"></i>
                        </div>
                        <div class="hc-header-info">
                            <h3>${esc(config.hospitalName)} Assistant</h3>
                            <span><span class="hc-online-dot"></span> Online</span>
                        </div>
                    </div>
                    <div class="hc-header-actions">
                        <button class="hc-header-btn" id="hc-lang-toggle" title="Change Language">
                            <i class="fa-solid fa-globe"></i>
                        </button>
                        <button class="hc-header-btn" id="hc-tts-toggle" title="Voice">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                        <button class="hc-header-btn" id="hc-clear" title="Restart">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button class="hc-header-btn" id="hc-close" title="Close">
                            <i class="fa-solid fa-minus"></i>
                        </button>
                    </div>
                </div>

                <div class="hc-body" id="hc-body"></div>

                <div class="hc-footer">
                    <div class="hc-input-row">
                        <input type="text" class="hc-input" id="hc-input"
                               placeholder="Type your message..." autocomplete="off">
                        <button class="hc-voice-btn" id="hc-voice" aria-label="Voice input" title="Voice input">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                        <button class="hc-send-btn" id="hc-send" disabled aria-label="Send">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="hc-powered">🏥 ${esc(config.hospitalName)} — AI-powered triage</div>
                </div>
            </div>`;

        root.appendChild(widget);
        document.body.appendChild(root);

        const launcher = document.getElementById('hc-launcher');
        const launcherStart = document.getElementById('hc-launcher-start');
        fab     = document.getElementById('hc-fab');
        popup   = document.getElementById('hc-popup');
        body    = document.getElementById('hc-body');
        input   = document.getElementById('hc-input');
        input.placeholder = t('type_message');
        sendBtn = document.getElementById('hc-send');
        const voiceBtn = document.getElementById('hc-voice');
        const ttsBtn = document.getElementById('hc-tts-toggle');
        
        document.getElementById('hc-close').addEventListener('click', () => toggle(false));
        document.getElementById('hc-clear').addEventListener('click', restart);
        const langToggle = document.getElementById('hc-lang-toggle');
        langToggle.addEventListener('click', askLanguage);

        // Read-aloud toggle (text-to-speech)
        const refreshTtsUi = () => {
            if (state.voiceReadAloud) ttsBtn.classList.add('active');
            else ttsBtn.classList.remove('active');
        };
        refreshTtsUi();
        ttsBtn.addEventListener('click', () => {
            state.voiceReadAloud = !state.voiceReadAloud;
            localStorage.setItem('hc_voice_read', state.voiceReadAloud ? '1' : '0');
            saveState();
            refreshTtsUi();
            botMsg(state.voiceReadAloud ? (t('voice_on') || 'Voice on.') : (t('voice_off') || 'Voice off.'));
        });
        // Always show intro on fresh page load so users can see bot animation.
        localStorage.removeItem(INTRO_KEY);
        launcherStart.addEventListener('click', () => {
            localStorage.setItem(INTRO_KEY, '1');
            launcher.classList.add('hidden');
            toggle(false);
        });

        fab.addEventListener('click', () => {
            localStorage.setItem(INTRO_KEY, '1');
            launcher.classList.add('hidden');
            toggle(!state.isOpen);
        });

        input.addEventListener('input', () => {
            sendBtn.disabled = input.value.trim() === '';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !sendBtn.disabled) send();
        });

        sendBtn.addEventListener('click', send);

        // Voice input (Web Speech API)
        let recognition = null;
        let isListening = false;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
                const transcript = event.results?.[0]?.[0]?.transcript || '';
                if (transcript) {
                    input.value = transcript;
                    sendBtn.disabled = input.value.trim() === '';
                }
            };
            recognition.onerror = () => {
                isListening = false;
                voiceBtn.classList.remove('listening');
            };
            recognition.onend = () => {
                isListening = false;
                voiceBtn.classList.remove('listening');
            };

            voiceBtn.addEventListener('click', () => {
                if (!recognition) return;
                if (isListening) {
                    recognition.stop();
                    return;
                }
                recognition.lang = (state.language === 'hi') ? 'hi-IN' : 'en-IN';
                isListening = true;
                voiceBtn.classList.add('listening');
                try {
                    recognition.start();
                    botMsg(t('listening') || 'Listening…');
                } catch (e) {
                    isListening = false;
                    voiceBtn.classList.remove('listening');
                }
            });
        } else {
            voiceBtn.addEventListener('click', () => {
                botMsg(t('voice_not_supported') || 'Voice input is not supported in this browser.');
            });
        }

        renderHistory();
    }

    function toggle(forceState) {
        state.isOpen = forceState;
        saveState();
        popup.classList.toggle('open', state.isOpen);
        fab.classList.toggle('open', state.isOpen);
        if (state.isOpen) setTimeout(() => input.focus(), 350);
    }

    function restart() {
        state.currentStep = 'NAME';
        state.userData = { name: '', age: '', gender: '', phone: '' };
        state.symptoms = '';
        state.followUpQuestions = [];
        state.followUpAnswers = [];
        state.currentQuestionIndex = 0;
        state.symptomContext = '';
        state.diagnosisHistory = [];
        state.lastDiagnosis = null;
        state.history = [];
        body.innerHTML = '';
        state.voiceReadAloud = typeof state.voiceReadAloud === 'boolean' ? state.voiceReadAloud : false;
        saveState();
        setEnabled(true);
        greet();
    }

    function renderHistory() {
        if (state.history.length === 0) {
            greet();
        } else {
            state.history.forEach(item => {
                if (item.type === 'user') renderUserMsg(item.content, false);
                else if (item.type === 'bot') renderBotMsg(item.content, false);
                else if (item.type === 'html') renderHtmlMsg(item.content, false);
            });
            scroll();
        }
    }

    function greet() {
        state.currentStep = 'NAME';
        saveState();
        setEnabled(true);
        botMsg(t('welcome') || "Hello! I'm your medical assistant.");
        setTimeout(() => botMsg(t('ask_name') || "What's your name?"), 600);
    }
    function send() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        sendBtn.disabled = true;
        userMsg(text);
        processFlow(text);
    }

    // ─── CONVERSATION FLOW ──────────────────────────────────
    function inferBodyPartFromSymptom(text) {
        const s = String(text || '').toLowerCase();

        // Menstrual / period-related pain is typically pelvic / lower abdomen
        if (s.includes('period') || s.includes('menstrual') || s.includes('menses') || s.includes('pregnan')) {
            return 'lower abdomen / pelvic area';
        }

        const mappings = [
            { part: 'chest', keys: ['chest'] },
            { part: 'head', keys: ['head', 'migraine'] },
            { part: 'throat', keys: ['throat'] },
            { part: 'abdomen', keys: ['abdomen', 'abdominal', 'stomach', 'belly'] },
            { part: 'back', keys: ['back'] },
            { part: 'pelvic area', keys: ['pelvic', 'uterus', 'ovary', 'ovarian'] },
            { part: 'arm', keys: ['arm', 'elbow', 'wrist', 'hand', 'finger'] },
            { part: 'leg', keys: ['leg', 'knee', 'ankle', 'foot', 'toe'] }
        ];

        for (const m of mappings) {
            if (m.keys.some(k => s.includes(k))) return m.part;
        }

        return '';
    }

    async function processFlow(userMessage) {
        if (state.currentStep === 'DONE') return;
    
        // --- STEP 1: NAME ---
        if (state.currentStep === 'NAME') {
            state.userData.name = userMessage;
            state.currentStep = 'AGE';
            saveState();
            delayBot(t('ask_age') || "How old are you?");
            return;
        }
    
        // --- STEP 2: AGE ---
        if (state.currentStep === 'AGE') {
            const age = parseInt(userMessage);
            if (isNaN(age) || age < 1 || age > 120) {
                delayBot(t('invalid_age') || "Please enter a valid age (1-120).");
                return;
            }
            state.userData.age = age;
            state.currentStep = 'GENDER';
            saveState();
            showGenderPicker();
            return;
        }
    
        // --- STEP 3: GENDER ---
        if (state.currentStep === 'GENDER') {
            const g = String(userMessage || '').toLowerCase().trim();
            const normalized = (g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : g ? userMessage : userMessage);
            state.userData.gender = normalized;
            state.currentStep = 'CHIEF_SYMPTOM';
            saveState();
            delayBot(t('ask_chief_symptom') || "What is your main symptom or concern today?");
            return;
        }
    
        // --- STEP 4: CHIEF SYMPTOM (with emergency detection) ---
        if (state.currentStep === 'CHIEF_SYMPTOM') {
            state.chiefSymptom = userMessage;
    
            const emergencyKeywords = [
                'chest pain', 'heart attack', 'stroke', 'severe bleeding',
                'unconscious', 'not breathing', 'severe allergic reaction',
                'suicidal thoughts', 'severe burn', 'broken bone protruding',
                'severe abdominal pain', 'severe headache sudden',
                'difficulty breathing', 'seizure', 'vomiting',
                'vomit', 'nausea', 'severe headache',
                'blood in stool', 'chest tightness'
            ];
            const isEmergency = emergencyKeywords.some(kw => 
                userMessage.toLowerCase().includes(kw)
            );
    
            if (isEmergency) {
                pushHtmlMsg(`
                    <div style="background:#DC3545; color:white; padding:12px; border-radius:12px; margin-bottom:12px; text-align:center;">
                        <strong>🚨 EMERGENCY ALERT 🚨</strong><br>
                        Please call emergency services immediately!<br>
                        Do not wait. Go to nearest ER now.
                    </div>
                `);
                state.currentStep = 'DONE';
                saveState();
                setEnabled(false);
                return;
            }

            // Skip fixed interview steps; let Groq generate relevant follow-ups.
            state.currentStep = 'FOLLOW_UP_LOADING';
            saveState();
            await fetchFollowUpQuestions(state.chiefSymptom);
            return;
        }
    
        // --- STEP 5: BODY PART ---
        if (state.currentStep === 'BODY_PART') {
            state.bodyPart = userMessage;
            state.currentStep = 'DURATION';
            saveState();
            delayBot(t('ask_duration') || "When did this symptom start? (e.g., today, 2 days ago, 1 week)");
            return;
        }
    
        // --- STEP 6: DURATION ---
        if (state.currentStep === 'DURATION') {
            state.duration = userMessage;
            state.currentStep = 'SEVERITY';
            saveState();
            delayBot(t('ask_severity') || "On a scale of 1 to 10, how severe is it? (1 = mild, 10 = severe)");
            return;
        }
    
        // --- STEP 7: SEVERITY (1-10) ---
        if (state.currentStep === 'SEVERITY') {
            const severityNum = parseInt(userMessage);
            if (isNaN(severityNum) || severityNum < 1 || severityNum > 10) {
                delayBot("Please enter a number between 1 and 10.");
                return;
            }
            state.severity = severityNum;
            state.currentStep = 'ASSOCIATED';
            saveState();
            delayBot(t('ask_associated') || "Do you have any other symptoms? (e.g., fever, nausea, headache)");
            return;
        }
    
        // --- STEP 8: ASSOCIATED SYMPTOMS ---
        if (state.currentStep === 'ASSOCIATED') {
            state.associatedSymptoms = userMessage;
    
            // Build combined symptom text for backend
            const fullSymptomText = `Chief: ${state.chiefSymptom}. Body part: ${state.bodyPart}. Duration: ${state.duration}. Severity: ${state.severity}/10. Associated: ${state.associatedSymptoms}`;
    
            await fetchFollowUpQuestions(fullSymptomText);
            return;
        }
    
        // --- FOLLOW-UP QUESTIONS (existing logic) ---
        if (state.currentStep === 'FOLLOW_UP') {
            const currentQ = state.followUpQuestions[state.currentQuestionIndex];
            const normalized = userMessage.toLowerCase().trim();
            const answer = (normalized === 'skip' || normalized === 'none') ? 'none' : userMessage;
            state.followUpAnswers.push({ question: currentQ.question, answer });
            state.currentQuestionIndex++;
            saveState();
    
            if (state.currentQuestionIndex < state.followUpQuestions.length) {
                askNextQuestion();
            } else {
                await handleDiagnosis(state.symptomContext || state.chiefSymptom, state.followUpAnswers);
            }
            return;
        }
    
        // --- MORE SYMPTOMS (after diagnosis) ---
        if (state.currentStep === 'MORE_SYMPTOMS') {
            if (userMessage.toLowerCase().trim() === 'no') {
                state.currentStep = 'DONE';
                saveState();
                delayBot(`Thank you, ${esc(state.userData.name)}! Stay healthy. Visit us anytime. 🏥`);
                setTimeout(() => setEnabled(false), 600);
            } else {
                state.chiefSymptom = state.chiefSymptom + ". " + userMessage;
                await fetchFollowUpQuestions(state.chiefSymptom);
            }
            return;
        }

        // --- ADDITIONAL PROBLEM (after Continue) ---
        if (state.currentStep === 'ADD_PROBLEM') {
            const msg = userMessage.trim();
            if (!msg) return;
            const lower = msg.toLowerCase();
            if (lower === 'no' || lower === 'none') {
                state.currentStep = 'DONE';
                saveState();
                delayBot(t('thanks_done') || `Thank you, ${esc(state.userData.name)}! Stay healthy. Visit us anytime. 🏥`);
                setTimeout(() => setEnabled(false), 600);
                return;
            }

            // Run follow-ups/diagnosis for the new complaint; report will be combined.
            await fetchFollowUpQuestions(msg);
            return;
        }
    }

    async function fetchFollowUpQuestions(symptoms) {
        const isConnected = await ensureBackendConnection();
        if (!isConnected) return;
        showLoader(t("analyzing"));
        setEnabled(false);

        try {
            const res = await fetch(`${API_BASE}/api/follow-up-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symptoms: symptoms,
                    age: state.userData.age,
                    gender: state.userData.gender,
                    language: state.language
                })
            });

            if (!res.ok) throw new Error("Failed to get questions");
            const data = await res.json();
            
            removeLoader();
            state.followUpQuestions = data.questions || [];
            state.followUpAnswers = [];
            state.currentQuestionIndex = 0;
            state.symptomContext = symptoms;
            
            if (state.followUpQuestions.length > 0) {
                state.currentStep = 'FOLLOW_UP';
                saveState();
                askNextQuestion();
            } else {
                // Fallback directly to diagnosis if no questions
                await handleDiagnosis(symptoms, []);
            }

        } catch (error) {
            removeLoader();
            console.error(error);
            // Fallback to diagnosis
            await handleDiagnosis(symptoms, []);
        }
    }

    window.hcScaleClick = function(val) {
        if (!state.isOpen) return;
        input.value = val;
        sendBtn.disabled = false;
        send();
    };

    window.hcQuickReply = function(val) {
        if (!state.isOpen) return;
        input.value = val;
        sendBtn.disabled = false;
        send();
    };

    function showGenderPicker() {
        const question = t('ask_gender') || "What's your gender?";
        pushHtmlMsg(`
            <div class="hc-choice">
                <div class="hc-choice-q">${esc(question)}</div>
                <div class="hc-choice-row" role="radiogroup" aria-label="Gender">
                    <button class="hc-choice-btn" onclick="window.hcQuickReply('Male')">${esc(t('male') || 'Male')}</button>
                    <button class="hc-choice-btn" onclick="window.hcQuickReply('Female')">${esc(t('female') || 'Female')}</button>
                    <button class="hc-choice-btn" onclick="window.hcQuickReply('Other')">${esc(t('other') || 'Other')}</button>
                </div>
            </div>
        `);
        setEnabled(true);
    }

    window.hcSkipFollowUp = function() {
        if (!state.isOpen || state.currentStep !== 'FOLLOW_UP') return;
        input.value = 'none';
        sendBtn.disabled = false;
        send();
    };

    window.hcFinishFollowUp = async function() {
        if (!state.isOpen || state.currentStep !== 'FOLLOW_UP') return;
        await handleDiagnosis(state.symptomContext || state.chiefSymptom, state.followUpAnswers);
    };

    window.hcStartNewChat = function() {
        restart();
    };

    window.hcContinueChat = function() {
        state.currentStep = 'ADD_PROBLEM';
        saveState();
        botMsg(t('ask_next_problem') || 'Tell me your next problem/symptom (or type "no" to finish).');
        setEnabled(true);
    };

    function showPostDiagnosisActions() {
        pushHtmlMsg(`
            <div class="hc-post-actions">
                <button class="hc-post-btn" onclick="window.hcContinueChat()">${esc(t('continue_chat') || 'Continue')}</button>
                <button class="hc-post-btn" onclick="window.hcStartNewChat()">${esc(t('new_chat') || 'New chat')}</button>
            </div>
        `);
    }

    window.hcFetchGeneralMedicine = async function() {
        showLoader("Finding General Medicine doctors...");
        try {
            const docResponse = await fetch(`${API_BASE}/api/doctors?specialist=General Medicine`);
            const doctors = docResponse.ok ? await docResponse.json() : [];
            removeLoader();
            if (doctors && doctors.length > 0) {
                const bestDoctor = doctors[0];
                showDoctorCard(bestDoctor);
            } else {
                botMsg('No General Medicine doctor currently available. Please contact the hospital directly.');
            }
        } catch (e) {
            removeLoader();
            botMsg('Error fetching doctors.');
        }
    };

    function askNextQuestion() {
        const q = state.followUpQuestions[state.currentQuestionIndex];
        let html = esc(q.question);
        
        if (q.type === 'scale') {
            html += `<div class="hc-scale-container">`;
            for(let i=1; i<=10; i++) {
                html += `<button class="hc-scale-btn" onclick="window.hcScaleClick('${i}')">${i}</button>`;
            }
            html += `</div>`;
        }
        
        delayBot(html);
    }

    // ─── DIAGNOSIS + DOCTOR MATCHING ────────────────────────
    async function handleDiagnosis(symptoms, followUpAnswers, isRetry = false) {
        if (!isRetry) showLoader(t("analyzing"));
        setEnabled(false);

        try {
            const diagResponse = await fetch(`${API_BASE}/api/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: state.userData.name,
                    age: state.userData.age,
                    gender: state.userData.gender,
                    symptoms: symptoms,
                    followUpAnswers: followUpAnswers,
                    language: state.language
                })
            });

            if (!diagResponse.ok) {
                if(diagResponse.status === 429) throw new Error("Rate limit exceeded.");
                throw new Error("Diagnosis failed");
            }
            const diagData = await diagResponse.json();
            
            state.lastDiagnosis = diagData;
            state.lastDiagnosis.symptoms = symptoms;
            state.diagnosisHistory = Array.isArray(state.diagnosisHistory) ? state.diagnosisHistory : [];
            state.diagnosisHistory.push({
                symptoms,
                condition: diagData.condition,
                severity: diagData.severity,
                specialist: diagData.specialist,
                urgency: diagData.urgency
            });
            saveState();

            removeLoader();
            showDiagnosis(diagData);

            if (diagData.availability_status === 'external_referral') {
                setTimeout(() => {
                    showPostDiagnosisActions();
                    state.currentStep = 'POST_DIAGNOSIS';
                    saveState();
                    setEnabled(true);
                }, 800);
            } else {
                showLoader("Finding specialists...");
                const docResponse = await fetch(`${API_BASE}/api/doctors?specialist=${encodeURIComponent(diagData.specialist)}`);
                const doctors = docResponse.ok ? await docResponse.json() : [];

                removeLoader();

                setTimeout(() => {
                    if (doctors && doctors.length > 0) {
                        const bestDoctor = doctors[0];
                        showDoctorCard(bestDoctor);
                    } else {
                        botMsg(t('no_specialist'));
                    }

                    setTimeout(() => {
                        showPostDiagnosisActions();
                        state.currentStep = 'POST_DIAGNOSIS';
                        saveState();
                        setEnabled(true);
                    }, 800);
                }, 600);
            }

        } catch (error) {
            removeLoader();
            console.error('API execution error:', error);
            showErrorRetry(t('error_analyzing'), () => {
                handleDiagnosis(symptoms, followUpAnswers, true);
            });
        }
    }

    // ─── RENDER COMPONENTS ──────────────────────────────────
    function showDiagnosis(d) {
        const combined = Array.isArray(state.diagnosisHistory) && state.diagnosisHistory.length > 1;
        const condition = d.condition || 'Unknown Condition';
        const severity = d.severity || 'Unknown';
        const specialist = d.specialist || 'General Physician';
        const explanation = d.explanation || '';
        const urgency = d.urgency || '';
        const redFlags = d.red_flags || [];
        const recommendations = d.recommendations || [];
        const disclaimer = t('disclaimer');

        const sevClass = String(severity).toLowerCase().includes('low') ? 'low'
                       : String(severity).toLowerCase().includes('high') || String(severity).toLowerCase().includes('emergency') ? 'high' : 'medium';

        let html = `
            <div class="hc-diagnosis">
                <div class="hc-diag-header"><i class="fa-solid fa-stethoscope"></i> ${combined ? (t('combined_report') || 'Combined Report') : t('diagnosis_complete')}</div>
                <div class="hc-diag-body">
                    ${combined ? `
                    <div class="hc-diag-row" style="border-left-color: var(--hc-warning);">
                        <span class="hc-diag-label">${t('multiple_conditions') || 'Possible conditions detected'}</span>
                        <span class="hc-diag-value">${state.diagnosisHistory.map((x, idx) => `${idx + 1}. ${esc(x.condition || 'Unknown')}`).join('<br>')}</span>
                    </div>
                    ` : ``}
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">${t('likely_condition')}</span>
                        <span class="hc-diag-value">${esc(condition)}</span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">${t('severity_level')}</span>
                        <span class="hc-diag-value"><span class="hc-severity ${sevClass}">${esc(severity)}</span></span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">${t('recommended_specialist')}</span>
                        <span class="hc-diag-value">${esc(specialist)}</span>
                    </div>`;

        if (explanation) {
            html += `<div class="hc-diag-row"><span class="hc-diag-label">${t('explanation')}</span><span class="hc-diag-value">${esc(explanation)}</span></div>`;
        }
        if (urgency) {
            const urgClass = urgency.toLowerCase().includes('immediately') || urgency.toLowerCase().includes('er') ? 'hc-text-danger' : 'hc-text-warning';
            html += `<div class="hc-diag-row"><span class="hc-diag-label">${t('urgency')}</span><span class="hc-diag-value ${urgClass}"><strong>${esc(urgency)}</strong></span></div>`;
        }
        if (redFlags.length > 0) {
            html += `<div class="hc-diag-row"><span class="hc-diag-label" style="color:var(--hc-danger)">🚩 ${t('watch_out')}</span><ul class="hc-diag-list">`;
            redFlags.forEach(rf => html += `<li>${esc(rf)}</li>`);
            html += `</ul></div>`;
        }
        if (recommendations.length > 0) {
            html += `<div class="hc-diag-row"><span class="hc-diag-label">${t('recommendations')}</span><ul class="hc-diag-list">`;
            recommendations.forEach(rc => html += `<li>${esc(rc)}</li>`);
            html += `</ul></div>`;
        }

        if (d.availability_status === 'external_referral') {
            html += `<div class="hc-diag-row hc-alert-danger" style="background:#fee2e2; border-left:3px solid #ef4444; padding:8px; border-radius:6px; margin-top:8px;">
                <div style="color:#b91c1c; font-weight:700; margin-bottom:4px;">⚠️ ${t('specialist_not_available')}</div>
                <div style="font-size:12px; color:#991b1b;">${esc(d.referral_message)}</div>
                <button class="hc-book-btn" style="margin-top:8px; background:#ef4444; width:100%; border:none; padding:8px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;" onclick="window.hcFetchGeneralMedicine()">📞 ${t('book_gm_instead')}</button>
            </div>`;
        } else if (d.availability_status === 'referral_needed') {
            html += `<div class="hc-diag-row hc-alert-info" style="background:#e0f2fe; border-left:3px solid #0ea5e9; padding:8px; border-radius:6px; margin-top:8px;">
                <div style="color:#0369a1; font-weight:700; margin-bottom:4px;">ℹ️ ${t('referral_needed')}</div>
                <div style="font-size:12px; color:#0c4a6e;">${esc(d.referral_message)}</div>
            </div>`;
        }

        html += `
                </div>
                <div class="hc-diag-footer"><i class="fa-solid fa-circle-info"></i> ${esc(disclaimer)}</div>
            </div>`;
        pushHtmlMsg(html);
    }
    
    function showDoctorCard(doctor) {
        const availClass = doctor.available ? 'available' : 'unavailable';
        const availText = doctor.available ? t('available_today') : t('unavailable_today');
        const avatarColor = '#6366f1';

        const html = `
            <div class="hc-doctor-card">
                <div class="hc-doc-header">
                    <div class="hc-doc-avatar" style="background: ${avatarColor}"><i class="fa-solid fa-user-doctor"></i></div>
                    <div class="hc-doc-info">
                        <div class="hc-doc-name">${esc(doctor.name)}</div>
                        <div class="hc-doc-spec">${esc(doctor.specialization)}</div>
                    </div>
                </div>
                <div class="hc-doc-details">
                    <div class="hc-doc-meta"><i class="fa-solid fa-star"></i> ${esc(String(doctor.experience))} ${t('years_exp')}</div>
                    <div class="hc-doc-meta"><i class="fa-solid fa-clock"></i> ${esc(doctor.timing)}</div>
                    <div class="hc-doc-meta hc-avail-badge ${availClass}">${availText}</div>
                </div>
                ${doctor.available ? `<button class="hc-book-btn" onclick="window.hcShowBookingForm(${doctor.id}, '${esc(doctor.name)}', '${esc(doctor.timing)}')"><i class="fa-solid fa-calendar-check"></i> ${t("book_appointment")}</button>` : `<div class="hc-doc-unavail">${t('not_available')}</div>`}
            </div>`;
        pushHtmlMsg(html);
    }

    window.hcShowBookingForm = function(doctorId, doctorName, timing) {
        // Fallback slots
        let slotsHtml = '<option value="10:00 AM">10:00 AM</option><option value="11:00 AM">11:00 AM</option>';
        const today = new Date().toISOString().split('T')[0];
        
        const html = `
            <div class="hc-appt-form" id="hc-form-${doctorId}">
                <div class="hc-appt-title"><i class="fa-solid fa-calendar-plus"></i> ${t('book_with')} ${esc(doctorName)}</div>
                <div class="hc-appt-field">
                    <label>${t('select_date')}</label>
                    <input type="date" class="hc-appt-date" value="${today}" min="${today}">
                </div>
                <div class="hc-appt-field">
                    <label>${t('select_time')}</label>
                    <select class="hc-appt-time">${slotsHtml}</select>
                </div>
                <div class="hc-appt-actions">
                    <button class="hc-appt-confirm" onclick="window.hcConfirmBooking(${doctorId}, '${esc(doctorName)}')"><i class="fa-solid fa-check"></i> ${t('confirm')}</button>
                    <button class="hc-appt-cancel" onclick="document.getElementById('hc-form-${doctorId}').remove()"><i class="fa-solid fa-xmark"></i> ${t('cancel')}</button>
                </div>
            </div>`;
        
        const el = document.createElement('div');
        el.innerHTML = html;
        body.appendChild(el);
        scroll();
    };

    window.hcConfirmBooking = async function(doctorId, doctorName) {
        const form = document.getElementById(`hc-form-${doctorId}`);
        if(!form) return;
        const date = form.querySelector('.hc-appt-date').value;
        const time = form.querySelector('.hc-appt-time').value;

        if (!date || !time) {
            botMsg('⚠️ ' + t('select_date_time'));
            return;
        }

        form.remove();
        showLoader(t("booking"));
        
        try {
            const res = await fetch(`${API_BASE}/api/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_name: state.userData.name,
                    age: parseInt(state.userData.age),
                    gender: state.userData.gender,
                    phone: state.userData.phone,
                    symptoms: state.lastDiagnosis ? state.lastDiagnosis.symptoms : '',
                    doctor_id: doctorId,
                    date: date,
                    time: time
                })
            });

            removeLoader();
            if (res.ok) {
                pushHtmlMsg(`
                    <div class="hc-booking-confirm">
                        <div class="hc-confirm-icon"><i class="fa-solid fa-circle-check"></i></div>
                        <div class="hc-confirm-title">${t('request_received')}</div>
                        <div class="hc-confirm-details">
                            <div><strong>${t('doctor')}:</strong> ${esc(doctorName)}</div>
                            <div><strong>${t('date')}:</strong> ${esc(date)}</div>
                            <div><strong>${t('time')}:</strong> ${esc(time)}</div>
                        </div>
                    </div>`);
                setTimeout(() => {
                    botMsg(t('booking_confirmed_msg'));
                }, 500);
            } else {
                botMsg('❌ ' + t('booking_failed'));
            }
        } catch (err) {
            removeLoader();
            console.error(err);
            botMsg('❌ ' + t('booking_error'));
        }
    };

    // ─── RENDERING & UI Helpers ──────────────────────────────
    function userMsg(text) {
        state.history.push({ type: 'user', content: text });
        saveState();
        renderUserMsg(text, true);
    }
    function renderUserMsg(text, doScroll) {
        const el = document.createElement('div');
        el.className = 'hc-msg user';
        const userBg = config.themeColor || '#0066ff';
        el.style.background = `linear-gradient(135deg, ${userBg}, #2563eb)`;
        el.innerHTML = `${esc(text)}<span class="hc-msg-time">${time()}</span>`;
        body.appendChild(el);
        if(doScroll) scroll();
    }

    function botMsg(html) {
        state.history.push({ type: 'bot', content: html });
        saveState();
        renderBotMsg(html, true);
        maybeSpeak(html);
    }
    function renderBotMsg(html, doScroll) {
        const el = document.createElement('div');
        el.className = 'hc-msg bot';
        el.innerHTML = `${html}<span class="hc-msg-time">${time()}</span>`;
        body.appendChild(el);
        if(doScroll) scroll();
    }

    function pushHtmlMsg(html) {
        state.history.push({ type: 'html', content: html });
        saveState();
        renderHtmlMsg(html, true);
    }
    function renderHtmlMsg(html, doScroll) {
        const el = document.createElement('div');
        el.innerHTML = html;
        body.appendChild(el);
        if(doScroll) scroll();
    }

    function delayBot(html, ms = 500) {
        showLoader();
        setTimeout(() => {
            removeLoader();
            botMsg(html);
            setEnabled(true);
        }, ms);
    }

    function maybeSpeak(htmlOrText) {
        if (!state.voiceReadAloud) return;
        const raw = String(htmlOrText || '');
        const d = document.createElement('div');
        d.innerHTML = raw;
        const text = (d.textContent || '').trim();
        if (!text) return;

        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = (state.language === 'hi') ? 'hi-IN' : 'en-IN';
            u.rate = 1;
            u.pitch = 1;
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }

    function showLoader(text = "") {
        removeLoader();
        const el = document.createElement('div');
        el.className = 'hc-typing';
        el.id = 'hc-typing';
        el.innerHTML = `<span></span><span></span><span></span> <small style="margin-left:8px;color:#94a3b8;">${esc(text)}</small>`;
        body.appendChild(el);
        scroll();
    }

    function removeLoader() {
        const el = document.getElementById('hc-typing');
        if (el) el.remove();
        const errEl = document.getElementById('hc-error');
        if(errEl) errEl.remove();
    }

    function showErrorRetry(msg, onRetry) {
        removeLoader();
        const el = document.createElement('div');
        el.id = 'hc-error';
        el.className = 'hc-msg bot hc-error-msg';
        el.innerHTML = `${esc(msg)} <br><button id="hc-retry-btn" style="margin-top:8px;padding:4px 10px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">Retry</button>`;
        body.appendChild(el);
        scroll();
        document.getElementById('hc-retry-btn').addEventListener('click', () => {
            el.remove();
            onRetry();
        });
        setEnabled(true);
    }

    async function ensureBackendConnection() {
        if (backendConnectionVerified) return true;
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (!res.ok) throw new Error('Health check failed');
            backendConnectionVerified = true;
            return true;
        } catch (e) {
            botMsg("Cannot connect to the medical server. Please ensure the backend is running (node server.js).");
            setEnabled(true);
            return false;
        }
    }

    function setEnabled(on) {
        if (!input || !sendBtn) return;
        input.disabled   = !on;
        sendBtn.disabled = !on;
        if (on && state.isOpen) setTimeout(() => input.focus(), 50);
    }

    function scroll() {
        setTimeout(() => { if (body) body.scrollTop = body.scrollHeight; }, 10);
    }
    function time() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    // ─── BOOT ───────────────────────────────────────────────
    function init() {
        loadAssets();
        loadState();
        ensureTranslationsLoaded().then(() => {
            build();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
