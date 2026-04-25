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

    // Dynamically detect API base from script URL, or fallback to origin
    const scriptTag = document.currentScript;
    let API_BASE = window.location.origin;
    if (scriptTag && scriptTag.src && !scriptTag.src.startsWith('file:')) {
        try {
            const scriptUrl = new URL(scriptTag.src);
            API_BASE = scriptUrl.origin;
        } catch(e) {}
    }
    
    // Fallback to localhost if opened directly via file://
    if (API_BASE === 'null' || API_BASE === 'file://' || window.location.protocol === 'file:') {
        API_BASE = 'http://localhost:3000';
    }

    // ─── TRANSLATIONS ───────────────────────────────────────
    function t(key) {
        const lang = localStorage.getItem('hc_chat_language') || state?.language || 'en';

        if (!window.TRANSLATIONS) return key;

        return (
            window.TRANSLATIONS[lang]?.[key] ||
            window.TRANSLATIONS['en']?.[key] ||
            key
        );
    }

    function askLanguage() {
        let html = `<div class="hc-lang-container" style="background:var(--hc-white); padding:16px; border-radius:12px; border:1px solid var(--hc-border); margin-bottom:12px;">
            <p style="margin-bottom:12px; font-weight:600; text-align:center;">Please select your language:</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('en')">🇬🇧 English</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('hi')">🇮🇳 हिन्दी</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('mr')">🇮🇳 मराठी</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('ta')">🇮🇳 தமிழ்</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('bn')">🇮🇳 বাংলা</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('gu')">🇮🇳 ગુજરાતી</button>
            </div>
        </div>`;
        pushHtmlMsg(html);
        setEnabled(false);
    }

    window.hcSelectLang = function(lang) {
        state.language = lang;
        localStorage.setItem('hc_chat_language', lang);
        saveState();

        // Task 2: Force Re-render After Language Change (Clear UI)
        body.innerHTML = '';
        state.history = [];
        
        input.placeholder = t('type_message');
        
        if (state.currentStep === 'LANG') {
            state.currentStep = 'NAME';
            saveState();
            setEnabled(true);
            botMsg(t('welcome') || "Hello! I'm your medical assistant.");
            setTimeout(() => botMsg(t('ask_name') || "What's your name?"), 600);
        } else {
            setEnabled(true);
            botMsg(t('language_updated') || "Language updated.");
        }
    };

    // ─── STATE MANAGEMENT (LocalStorage) ─────────────────────
    const STATE_KEY = 'hc_chat_state';
    
    let state = {
        isOpen: false,
        currentStep: 'LANG',
        language: localStorage.getItem('hc_chat_language') || 'en',
        userData: { name: '', age: '', gender: '', phone: '' },
        symptoms: '',
        followUpQuestions: [],
        followUpAnswers: [],
        currentQuestionIndex: 0,
        lastDiagnosis: null,
        history: [] // { type: 'user'|'bot'|'html', content: '' }
    };

    function loadState() {
        try {
            const saved = localStorage.getItem(STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.userData) state = parsed;
            }
        } catch (e) {}
        // Task 4: Fix Initial Load
        state.language = localStorage.getItem('hc_chat_language') || 'en';
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

        widget.innerHTML = `
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
                        <button class="hc-send-btn" id="hc-send" disabled aria-label="Send">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="hc-powered">🏥 ${esc(config.hospitalName)} — AI-powered triage</div>
                </div>
            </div>`;

        root.appendChild(widget);
        document.body.appendChild(root);

        fab     = document.getElementById('hc-fab');
        popup   = document.getElementById('hc-popup');
        body    = document.getElementById('hc-body');
        input   = document.getElementById('hc-input');
        input.placeholder = t('type_message');
        sendBtn = document.getElementById('hc-send');
        
        document.getElementById('hc-close').addEventListener('click', () => toggle(false));
        document.getElementById('hc-clear').addEventListener('click', restart);
        document.getElementById('hc-lang-toggle').addEventListener('click', askLanguage);
        fab.addEventListener('click', () => toggle(!state.isOpen));

        input.addEventListener('input', () => {
            sendBtn.disabled = input.value.trim() === '';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !sendBtn.disabled) send();
        });

        sendBtn.addEventListener('click', send);

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
        state.currentStep = 'LANG';
        state.userData = { name: '', age: '', gender: '', phone: '' };
        state.symptoms = '';
        state.followUpQuestions = [];
        state.followUpAnswers = [];
        state.currentQuestionIndex = 0;
        state.lastDiagnosis = null;
        state.history = [];
        body.innerHTML = '';
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
        if (state.currentStep === 'LANG') {
            askLanguage();
        } else {
            botMsg(t('welcome') || "Hello! I'm your medical assistant.");
            setTimeout(() => botMsg(t('ask_name') || "What's your name?"), 600);
        }
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
    async function processFlow(userMessage) {
        if (state.currentStep === 'DONE') return;

        if (state.currentStep === 'NAME') {
            state.userData.name = userMessage;
            state.currentStep = 'AGE';
            saveState();
            delayBot(t('ask_age'));
            return;
        }

        if (state.currentStep === 'AGE') {
            const age = parseInt(userMessage);
            if (isNaN(age) || age < 1 || age > 120) {
                delayBot(t('invalid_age') || "Please enter a valid age.");
                return;
            }
            state.userData.age = age;
            state.currentStep = 'GENDER';
            saveState();
            delayBot(t('ask_gender'));
            return;
        }

        if (state.currentStep === 'GENDER') {
            state.userData.gender = userMessage;
            state.currentStep = 'PHONE';
            saveState();
            delayBot(t('ask_phone'));
            return;
        }

        if (state.currentStep === 'PHONE') {
            const phoneRegex = /^[0-9\s\-+]{8,15}$/;
            if (!phoneRegex.test(userMessage)) {
                delayBot(t('invalid_phone') || "Please enter a valid phone number.");
                return;
            }
            state.userData.phone = userMessage;
            state.currentStep = 'SYMPTOMS';
            saveState();
            delayBot(t('ask_symptoms'));
            return;
        }

        if (state.currentStep === 'SYMPTOMS') {
            state.symptoms = userMessage;
            
            // Emergency Check
            const emergencyKeywords = ['chest pain', "can't breathe", 'heart attack', 'stroke', 'severe bleeding', 'unconscious', 'fainting'];
            const isEmergency = emergencyKeywords.some(kw => userMessage.toLowerCase().includes(kw));
            
            if (isEmergency) {
                botMsg(t('emergency_warning'));
                state.currentStep = 'DONE';
                saveState();
                setTimeout(() => setEnabled(false), 600);
                return;
            }

            await fetchFollowUpQuestions(userMessage);
            return;
        }

        if (state.currentStep === 'FOLLOW_UP') {
            const currentQ = state.followUpQuestions[state.currentQuestionIndex];
            state.followUpAnswers.push({ question: currentQ.question, answer: userMessage });
            state.currentQuestionIndex++;
            saveState();

            if (state.currentQuestionIndex < state.followUpQuestions.length) {
                askNextQuestion();
            } else {
                await handleDiagnosis(state.symptoms, state.followUpAnswers);
            }
            return;
        }

        if (state.currentStep === 'MORE_SYMPTOMS') {
            if (userMessage.toLowerCase().trim() === 'no') {
                state.currentStep = 'DONE';
                saveState();
                delayBot(`Thank you, <strong>${esc(state.userData.name)}</strong>! Stay healthy. Visit us at ${esc(config.hospitalName)} anytime. 🏥`);
                setTimeout(() => setEnabled(false), 600);
            } else {
                state.symptoms = state.symptoms + ". " + userMessage;
                await fetchFollowUpQuestions(state.symptoms);
            }
            return;
        }
    }

    async function fetchFollowUpQuestions(symptoms) {
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
            saveState();

            removeLoader();
            showDiagnosis(diagData);

            if (diagData.availability_status === 'external_referral') {
                setTimeout(() => {
                    state.currentStep = 'MORE_SYMPTOMS';
                    saveState();
                    botMsg('Do you have <strong>other symptoms</strong>? Type them below or type <strong>"no"</strong> to finish.');
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
                        state.currentStep = 'MORE_SYMPTOMS';
                        saveState();
                        botMsg(t('ask_more_symptoms'));
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
                <div class="hc-diag-header"><i class="fa-solid fa-stethoscope"></i> ${t('diagnosis_complete')}</div>
                <div class="hc-diag-body">
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
        build();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
