/**
 * AI Medical Chatbot Widget — Hospital Edition
 * ─────────────────────────────────────────────
 * State Machine:
 *   [new user]       LANG → NAME → AGE → GENDER → PHONE → SYMPTOMS →
 *                    FOLLOW_UP → DIAGNOSIS → POST_DIAGNOSIS →
 *                    (yes: SYMPTOMS) | (no: ENDED)
 *   [returning user] SYMPTOMS (welcome back) → FOLLOW_UP → DIAGNOSIS →
 *                    POST_DIAGNOSIS → (yes: SYMPTOMS) | (no: ENDED)
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
        const lang = localStorage.getItem('hc_chat_language') || (typeof state !== 'undefined' && state?.language) || 'en';

        if (!window.TRANSLATIONS) return '';

        const result = window.TRANSLATIONS[lang]?.[key] || window.TRANSLATIONS['en']?.[key] || '';
        console.debug(`[chatbot] t() key=${key} lang=${lang} result=${result}`);
        return result;
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

        hcVoice.cancelSpeech();

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

    // ─── VOICE (STT & TTS) ──────────────────────────────────
    const STT_SUPPORTED = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const TTS_SUPPORTED = 'speechSynthesis' in window;
    let ttsInteracted = false;

    const hcVoice = {
        recognition: null,
        isListening: false,
        ttsEnabled: localStorage.getItem('hc_tts_enabled') !== 'false',
        iosHintShown: false,
        
        initRecognition() {
            if (!STT_SUPPORTED) return;
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SR();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = this.getBCP47(state.language);
            
            this.recognition.onresult = (e) => {
                const transcript = Array.from(e.results)
                    .map(r => r[0].transcript)
                    .join('');
                const inputEl = document.getElementById('hc-input');
                const sendBtnEl = document.getElementById('hc-send');
                if (inputEl) inputEl.value = transcript;
                if (sendBtnEl) sendBtnEl.disabled = false;
                if (e.results[e.results.length-1].isFinal) {
                    this.stopListening();
                    send(); // Auto-submit
                }
            };
            
            this.recognition.onerror = (e) => {
                this.stopListening();
                if (e.error === 'not-allowed') botMsg("Mic permission denied. Please enable in browser settings.");
                else if (e.error === 'no-speech') botMsg("I didn't catch that. Try again?");
                else if (e.error === 'network') botMsg("Network issue. Please check connection.");
                else if (e.error === 'language-not-supported') {
                    this.recognition.lang = 'en-IN';
                    this.startListening();
                }
            };
            this.recognition.onend = () => { 
                this.isListening = false;
                const micBtn = document.getElementById('hc-mic');
                if (micBtn) micBtn.classList.remove('recording');
            };
        },
        
        startListening() {
            if (!STT_SUPPORTED) return;
            if (!this.recognition) this.initRecognition();
            try {
                this.recognition.lang = this.getBCP47(state.language);
                this.recognition.start();
                this.isListening = true;
                const micBtn = document.getElementById('hc-mic');
                if (micBtn) micBtn.classList.add('recording');
            } catch(e) {}
        },
        
        stopListening() {
            if (this.recognition) this.recognition.stop();
            this.isListening = false;
            const micBtn = document.getElementById('hc-mic');
            if (micBtn) micBtn.classList.remove('recording');
        },
        
        getBCP47(lang) {
            const map = {
                en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN',
                ta: 'ta-IN', bn: 'bn-IN', gu: 'gu-IN'
            };
            return map[lang] || 'en-IN';
        },

        speak(text, lang) {
            if (!this.ttsEnabled || !TTS_SUPPORTED) return;
            
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS && !ttsInteracted) {
                if (!this.iosHintShown) {
                    botMsg("Tap 🔊 to enable voice");
                    this.iosHintShown = true;
                }
                return;
            }

            window.speechSynthesis.cancel();
            
            const cleanText = text.replace(/<[^>]*>/g, '').trim();
            if (!cleanText) return;
            
            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.lang = this.getBCP47(lang);
            utter.rate = 0.95;
            utter.pitch = 1.0;
            utter.volume = 1.0;
            
            const voice = this.pickVoice(utter.lang);
            if (voice) utter.voice = voice;
            
            window.speechSynthesis.speak(utter);
        },
        
        pickVoice(bcp47) {
            if (!TTS_SUPPORTED) return null;
            const voices = window.speechSynthesis.getVoices();
            let v = voices.find(v => v.lang === bcp47);
            if (!v) {
                const prefix = bcp47.split('-')[0];
                v = voices.find(v => v.lang.startsWith(prefix));
            }
            return v || null;
        },
        
        cancelSpeech() {
            if (TTS_SUPPORTED) window.speechSynthesis.cancel();
        }
    };

    if (TTS_SUPPORTED && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            console.debug('[TTS] voices loaded:', window.speechSynthesis.getVoices().length);
        };
    }

    // ─── STATE MANAGEMENT (LocalStorage) ─────────────────────
    const STATE_KEY = 'hc_chat_state';
    const PROFILE_KEY = 'hc_user_profile';
    const SESSION_KEY = 'hc_patient_session';
    const API = `${API_BASE}/api`;
    
    let state = {
        isOpen: false,
        isAuthenticated: false,
        currentStep: 'LANG',
        language: localStorage.getItem('hc_chat_language') || 'en',
        userData: { name: '', age: '', gender: '', phone: '' },
        patientSession: { token: '', patientId: '', sessionId: '' },
        symptoms: '',
        followUpQuestions: [],
        followUpAnswers: [],
        currentQuestionIndex: 0,
        lastDiagnosis: null,
        history: [],
        pendingUserMessage: '',
        authUiState: { mode: 'otp', phone: '', otpSent: false, otpToken: '', resendAt: 0 },
        isSubmitting: false,
        bookingInFlight: false,
        failedChatQueue: [],
        savedChatHashes: []
    };

    function loadState() {
        try {
            const saved = localStorage.getItem(STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.userData) state = parsed;
            }
        } catch (e) {}
        state.language = localStorage.getItem('hc_chat_language') || 'en';
        if (!state.patientSession) state.patientSession = { token: '', patientId: '', sessionId: '' };
        if (!state.authUiState) state.authUiState = { mode: 'otp', phone: '', otpSent: false, otpToken: '', resendAt: 0 };
        if (!Array.isArray(state.failedChatQueue)) state.failedChatQueue = [];
        if (!Array.isArray(state.savedChatHashes)) state.savedChatHashes = [];
        if (typeof state.isSubmitting !== 'boolean') state.isSubmitting = false;
    }

    function saveState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    function loadProfile() {
        try {
            const raw = localStorage.getItem(PROFILE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { localStorage.removeItem(PROFILE_KEY); }
        return null;
    }

    function saveProfile(fields) {
        const existing = loadProfile() || {};
        Object.assign(existing, fields, { lastVisit: new Date().toISOString() });
        localStorage.setItem(PROFILE_KEY, JSON.stringify(existing));
    }

    function clearAllData() {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(STATE_KEY);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('hc_chat_language');
        localStorage.removeItem('hc_tts_enabled');
    }

    function newSessionId() {
        return `SID-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function getStoredSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
    }

    function savePatientSession(data) {
        const session = {
            token: data.token || '',
            patientId: data.patientId || '',
            patientName: data.patientName || '',
            sessionId: data.sessionId || state.patientSession.sessionId || newSessionId()
        };
        state.patientSession = {
            token: session.token,
            patientId: session.patientId,
            sessionId: session.sessionId
        };
        state.isAuthenticated = Boolean(session.token && session.patientId);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        saveState();
        refreshSessionBadge();
    }

    function clearPatientSession() {
        state.patientSession = { token: '', patientId: '', sessionId: '' };
        state.isAuthenticated = false;
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        saveState();
        refreshSessionBadge();
    }

    async function handlePatientLogout() {
        if (!state.isAuthenticated) {
            botMsg('You are already logged out.');
            return;
        }
        try {
            await fetch(`${API}/patient/logout`, {
                method: 'POST',
                headers: authHeaders()
            });
        } catch (e) {}
        clearPatientSession();
        state.currentStep = 'LANG';
        state.pendingUserMessage = '';
        state.followUpQuestions = [];
        state.followUpAnswers = [];
        state.currentQuestionIndex = 0;
        state.lastDiagnosis = null;
        state.history = [];
        if (body) body.innerHTML = '';
        saveState();
        botMsg('Logged out successfully. Please sign in to continue.');
        buildAuthUi();
    }

    function authHeaders(extraHeaders) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
        if (state.patientSession.token) headers.Authorization = `Bearer ${state.patientSession.token}`;
        return headers;
    }

    function refreshSessionBadge() {
        const el = document.getElementById('hc-session-status');
        if (!el) return;
        if (state.isAuthenticated && state.patientSession.patientId) {
            el.innerHTML = `<span class="hc-online-dot"></span> ${esc(state.patientSession.patientId)}`;
        } else {
            el.innerHTML = '<span class="hc-online-dot"></span> Online';
        }
    }

    window.hcStartFresh = function() {
        clearAllData();
        state.currentStep = 'LANG';
        state.userData = { name: '', age: '', gender: '', phone: '' };
        state.symptoms = '';
        state.followUpQuestions = [];
        state.followUpAnswers = [];
        state.currentQuestionIndex = 0;
        state.lastDiagnosis = null;
        state.history = [];
        state.language = 'en';
        body.innerHTML = '';
        saveState();
        setEnabled(true);
        botMsg(t('freshStart') || 'Okay, starting fresh. Please select your language.');
        setTimeout(() => askLanguage(), 600);
    };

    window.hcClearData = function() {
        clearAllData();
        state.currentStep = 'LANG';
        state.userData = { name: '', age: '', gender: '', phone: '' };
        state.symptoms = '';
        state.history = [];
        state.language = 'en';
        body.innerHTML = '';
        saveState();
        setEnabled(true);
        botMsg('Your data has been cleared.');
        setTimeout(() => askLanguage(), 800);
    };

    window.hcStartNewChat = function() {
        state.symptoms = '';
        state.followUpQuestions = [];
        state.followUpAnswers = [];
        state.currentQuestionIndex = 0;
        state.lastDiagnosis = null;
        state.currentStep = 'SYMPTOMS';
        state.history = [];
        body.innerHTML = '';
        saveState();
        setEnabled(true);
        botMsg(t('ask_symptoms') || 'Please describe your symptoms.');
    };

    async function apiJson(url, options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
        clearTimeout(timeout);
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            clearPatientSession();
            setEnabled(false);
            botMsg('Your session expired. Please login again.');
            buildAuthUi();
            throw new Error('Session expired');
        }
        if (!res.ok) {
            const msg = data.error || data.message || `Request failed (${res.status})`;
            throw new Error(msg);
        }
        return data;
    }

    async function verifyExistingSession() {
        const stored = getStoredSession();
        if (!stored || !stored.token) return false;
        try {
            state.patientSession = {
                token: stored.token,
                patientId: stored.patientId || '',
                sessionId: stored.sessionId || newSessionId()
            };
            const data = await apiJson(`${API}/patient/session-check`, {
                method: 'GET',
                headers: authHeaders()
            });
            savePatientSession({
                token: stored.token,
                patientId: data.patientId || stored.patientId,
                patientName: data.patientName || stored.patientName,
                sessionId: stored.sessionId || newSessionId()
            });
            return true;
        } catch (e) {
            clearPatientSession();
            return false;
        }
    }

    function buildAuthUi() {
        const mode = state.authUiState.mode || 'otp';
        const resendRemaining = Math.max(0, Math.ceil((state.authUiState.resendAt - Date.now()) / 1000));
        const otpBtnLabel = resendRemaining > 0 ? `Resend in ${resendRemaining}s` : (state.authUiState.otpSent ? 'Resend OTP' : 'Send OTP');
        const html = `
            <div class="hc-auth-card">
                <div class="hc-auth-title">Secure Patient Login</div>
                <div class="hc-auth-subtitle">Continue with OTP or your Patient ID</div>
                <div class="hc-auth-tabs">
                    <button class="hc-auth-tab ${mode === 'otp' ? 'active' : ''}" onclick="window.hcSetAuthMode('otp')">OTP Login</button>
                    <button class="hc-auth-tab ${mode === 'pid' ? 'active' : ''}" onclick="window.hcSetAuthMode('pid')">Patient ID</button>
                </div>
                ${mode === 'otp' ? `
                    <div class="hc-auth-grid">
                        <input id="hc-auth-phone" class="hc-auth-input" placeholder="Phone number" value="${esc(state.authUiState.phone || '')}" />
                        <button class="hc-auth-btn" onclick="window.hcSendOtp()" ${resendRemaining > 0 ? 'disabled' : ''}>${otpBtnLabel}</button>
                    </div>
                    ${state.authUiState.otpSent ? `
                        <div class="hc-auth-grid">
                            <input id="hc-auth-otp" class="hc-auth-input" placeholder="Enter 6-digit OTP" maxlength="6" />
                            <button class="hc-auth-btn" onclick="window.hcVerifyOtp()">Verify OTP</button>
                        </div>
                    ` : ''}
                ` : `
                    <div class="hc-auth-grid">
                        <input id="hc-auth-pid" class="hc-auth-input" placeholder="Patient ID (e.g. PAT-2026-0001)" />
                        <button class="hc-auth-btn" onclick="window.hcLoginByPatientId()">Login</button>
                    </div>
                `}
            </div>`;
        const existing = body ? body.querySelector('.hc-auth-card') : null;
        if (existing) {
            existing.parentElement.innerHTML = html;
            scroll();
        } else {
            pushHtmlMsg(html);
        }
        setEnabled(false);
        if (resendRemaining > 0) {
            setTimeout(() => buildAuthUi(), 1000);
        }
    }

    window.hcSetAuthMode = function(mode) {
        state.authUiState.mode = mode;
        saveState();
        buildAuthUi();
    };

    window.hcSendOtp = async function() {
        if (state.isSubmitting) return;
        const phoneEl = document.getElementById('hc-auth-phone');
        const phone = phoneEl ? phoneEl.value.trim() : '';
        const resendRemaining = Math.max(0, Math.ceil((state.authUiState.resendAt - Date.now()) / 1000));
        if (resendRemaining > 0) return;
        if (!/^[0-9\s\-+]{8,15}$/.test(phone)) {
            botMsg('Please enter a valid phone number.');
            return;
        }
        state.isSubmitting = true;
        showLoader('Sending OTP...');
        try {
            await apiJson(`${API}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            removeLoader();
            state.authUiState.phone = phone;
            state.authUiState.otpSent = true;
            state.authUiState.resendAt = Date.now() + (30 * 1000);
            saveState();
            botMsg('OTP sent successfully. Please enter it below.');
            buildAuthUi();
        } catch (error) {
            removeLoader();
            botMsg(`Unable to send OTP: ${esc(error.message)}`);
        } finally {
            state.isSubmitting = false;
        }
    };

    window.hcVerifyOtp = async function() {
        if (state.isSubmitting) return;
        const otpEl = document.getElementById('hc-auth-otp');
        const otp = otpEl ? otpEl.value.trim() : '';
        if (!/^\d{6}$/.test(otp)) {
            botMsg('Please enter a valid 6-digit OTP.');
            return;
        }
        state.isSubmitting = true;
        showLoader('Verifying OTP...');
        try {
            const data = await apiJson(`${API}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: state.authUiState.phone, otp })
            });
            removeLoader();
            state.authUiState.otpToken = data.token;
            saveState();
            if (data.isNewPatient) {
                botMsg('Welcome! Please complete your profile to continue.');
                state.currentStep = 'NAME';
                setEnabled(true);
                delayBot(t('ask_name') || "What's your name?");
            } else if (data.patientId) {
                await completePatientLogin(data.patientId);
            } else {
                botMsg('Verification succeeded, but patient record was not found.');
            }
        } catch (error) {
            removeLoader();
            botMsg(`OTP verification failed: ${esc(error.message)}`);
        } finally {
            state.isSubmitting = false;
        }
    };

    window.hcLoginByPatientId = async function() {
        if (state.isSubmitting) return;
        const pidEl = document.getElementById('hc-auth-pid');
        const patientId = (pidEl ? pidEl.value.trim() : '').toUpperCase();
        if (!/^PAT-\d{4}-\d{4}$/.test(patientId)) {
            botMsg('Please enter a valid Patient ID (PAT-YYYY-0001).');
            return;
        }
        state.isSubmitting = true;
        showLoader('Signing in...');
        try {
            await completePatientLogin(patientId);
            removeLoader();
        } catch (error) {
            removeLoader();
            botMsg(`Login failed: ${esc(error.message)}`);
        } finally {
            state.isSubmitting = false;
        }
    };

    async function completePatientLogin(patientId) {
        const data = await apiJson(`${API}/patient/login-by-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId })
        });
        const patient = data.patient || {};
        state.userData = {
            name: patient.fullName || '',
            age: patient.age || '',
            gender: patient.gender || '',
            phone: patient.phone || ''
        };
        saveProfile({ name: state.userData.name, age: state.userData.age, gender: state.userData.gender, phone: state.userData.phone, language: state.language });
        savePatientSession({
            token: data.token,
            patientId: patient.patientId || patientId,
            patientName: patient.fullName || '',
            sessionId: newSessionId()
        });
        await hydrateHistoryFromServer();
        state.currentStep = 'SYMPTOMS';
        saveState();
        setEnabled(true);
        botMsg(`Welcome back, <strong>${esc(state.userData.name || 'Patient')}</strong>! Your previous conversation is loaded.`);
        delayBot(t('ask_symptoms') || 'Please describe your symptoms.');
    }

    async function registerNewPatient() {
        const payload = {
            fullName: state.userData.name,
            age: Number(state.userData.age),
            gender: String(state.userData.gender),
            phone: state.userData.phone
        };
        const data = await apiJson(`${API}/patient/register`, {
            method: 'POST',
            headers: Object.assign({ Authorization: `Bearer ${state.authUiState.otpToken}` }, { 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        savePatientSession({
            token: data.token,
            patientId: data.patientId,
            patientName: data.patient?.fullName || payload.fullName,
            sessionId: newSessionId()
        });
        state.authUiState = { mode: 'otp', phone: '', otpSent: false, otpToken: '', resendAt: 0 };
        saveState();
    }

    async function hydrateHistoryFromServer() {
        if (!state.patientSession.patientId || !state.patientSession.token) return;
        const history = await apiJson(`${API}/patient/chat/history/${encodeURIComponent(state.patientSession.patientId)}`, {
            method: 'GET',
            headers: authHeaders()
        });
        state.history = [];
        history.forEach((item) => {
            if (item.userMessage) state.history.push({ type: 'user', content: item.userMessage, ts: item.timestamp });
            if (item.botMessage) state.history.push({ type: 'bot', content: item.botMessage, ts: item.timestamp });
        });
        saveState();
        if (body) {
            body.innerHTML = '';
            renderHistory();
        }
    }

    async function saveChatPair(userMessage, botMessage) {
        if (!state.patientSession.patientId || !state.patientSession.token) return;
        const userText = (userMessage || '').trim();
        const botText = stripHtml(botMessage || '').trim();
        if (!userText || !botText) return;
        const payload = {
            patientId: state.patientSession.patientId,
            sessionId: state.patientSession.sessionId || newSessionId(),
            userMessage: userText,
            botMessage: botText
        };
        const hash = `${payload.sessionId}|${payload.userMessage}|${payload.botMessage}`;
        if (state.savedChatHashes.includes(hash)) return;
        state.savedChatHashes = [...state.savedChatHashes.slice(-149), hash];
        saveState();
        try {
            await apiJson(`${API}/patient/chat/save`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
        } catch (e) {
            state.failedChatQueue.push(payload);
            state.failedChatQueue = state.failedChatQueue.slice(-50);
            saveState();
            console.warn('[chatbot] save chat failed, queued', e.message);
        }
    }

    async function flushFailedChatQueue() {
        if (!state.failedChatQueue.length || !navigator.onLine || !state.isAuthenticated) return;
        const queue = [...state.failedChatQueue];
        state.failedChatQueue = [];
        saveState();
        for (const item of queue) {
            try {
                await apiJson(`${API}/patient/chat/save`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(item)
                });
            } catch (error) {
                state.failedChatQueue.push(item);
            }
        }
        saveState();
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
                            <span id="hc-session-status"><span class="hc-online-dot"></span> Online</span>
                        </div>
                    </div>
                    <div class="hc-header-actions">
                        ${TTS_SUPPORTED ? `<button class="hc-tts-toggle" id="hc-tts" title="Toggle Voice Output" aria-label="Toggle voice output" style="background:transparent;border:none;color:white;cursor:pointer;font-size:16px;">${hcVoice.ttsEnabled ? '🔊' : '🔇'}</button>` : ''}
                        <button class="hc-header-btn" id="hc-logout" title="Logout">
                            <i class="fa-solid fa-right-from-bracket"></i>
                        </button>
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
                        ${STT_SUPPORTED ? `<button class="hc-mic-btn" id="hc-mic" aria-label="Record voice message">🎤</button>` : ''}
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
        document.getElementById('hc-logout').addEventListener('click', handlePatientLogout);
        fab.addEventListener('click', () => toggle(!state.isOpen));

        if (TTS_SUPPORTED) {
            const ttsBtn = document.getElementById('hc-tts');
            ttsBtn.addEventListener('click', () => {
                ttsInteracted = true;
                hcVoice.ttsEnabled = !hcVoice.ttsEnabled;
                localStorage.setItem('hc_tts_enabled', hcVoice.ttsEnabled);
                ttsBtn.textContent = hcVoice.ttsEnabled ? '🔊' : '🔇';
                if (!hcVoice.ttsEnabled) hcVoice.cancelSpeech();
            });
        }

        if (STT_SUPPORTED) {
            const micBtn = document.getElementById('hc-mic');
            micBtn.addEventListener('click', () => {
                ttsInteracted = true;
                if (hcVoice.isListening) hcVoice.stopListening();
                else hcVoice.startListening();
            });
        }

        input.addEventListener('input', () => {
            sendBtn.disabled = input.value.trim() === '';
        });

        input.addEventListener('keydown', (e) => {
            ttsInteracted = true;
            if (e.key === 'Enter' && !sendBtn.disabled) send();
        });

        sendBtn.addEventListener('click', () => {
            ttsInteracted = true;
            send();
        });

        renderHistory();
        refreshSessionBadge();
    }

    function toggle(forceState) {
        state.isOpen = forceState;
        saveState();
        popup.classList.toggle('open', state.isOpen);
        fab.classList.toggle('open', state.isOpen);
        if (!state.isOpen) {
            hcVoice.stopListening();
            hcVoice.cancelSpeech();
        }
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
            let lastDate = '';
            state.history.forEach(item => {
                const ts = item.ts || new Date().toISOString();
                const dateKey = new Date(ts).toDateString();
                if (dateKey !== lastDate) {
                    renderDateDivider(new Date(ts), false);
                    lastDate = dateKey;
                }
                if (item.type === 'user') renderUserMsg(item.content, false, ts);
                else if (item.type === 'bot') renderBotMsg(item.content, false, ts);
                else if (item.type === 'html') renderHtmlMsg(item.content, false, ts);
            });
            scroll();
        }
    }

    function greet() {
        if (!state.isAuthenticated) {
            botMsg('Welcome to secure care support. Please login to continue.');
            buildAuthUi();
            return;
        }

        const profile = loadProfile();
        if (profile && profile.name && profile.age && profile.gender && profile.phone) {
            state.userData = { name: profile.name, age: profile.age, gender: profile.gender, phone: profile.phone };
            if (profile.language) {
                state.language = profile.language;
                localStorage.setItem('hc_chat_language', profile.language);
            }
            state.currentStep = 'SYMPTOMS';
            saveState();
            setEnabled(true);
            const wb = (t('welcomeBack') || 'Welcome back, {name}! How are you feeling today?').replace('{name}', esc(profile.name));
            botMsg(wb + ` <a href="#" onclick="window.hcStartFresh();return false" style="color:var(--hc-primary);font-size:12px;">(${t('notYou') || 'Not you?'} ${t('startFresh') || 'Start fresh'})</a>`);
            setTimeout(() => botMsg(t('ask_symptoms') || 'Please describe your symptoms.'), 600);
        } else if (profile && profile.name) {
            state.userData.name = profile.name;
            if (profile.language) { state.language = profile.language; localStorage.setItem('hc_chat_language', profile.language); }
            if (profile.age) { state.userData.age = profile.age; }
            if (profile.gender) { state.userData.gender = profile.gender; }
            const firstMissing = !profile.age ? 'AGE' : !profile.gender ? 'GENDER' : 'PHONE';
            state.currentStep = firstMissing;
            saveState();
            setEnabled(true);
            if (firstMissing === 'AGE') {
                const msg = (t('hiName') || 'Hi {name}, how old are you?').replace('{name}', esc(profile.name));
                botMsg(msg);
            } else if (firstMissing === 'GENDER') {
                botMsg(t('ask_gender'));
            } else {
                botMsg(t('ask_phone'));
            }
        } else if (state.currentStep === 'LANG') {
            askLanguage();
        } else {
            botMsg(t('welcome') || "Hello! I'm your medical assistant.");
            setTimeout(() => botMsg(t('ask_name') || "What's your name?"), 600);
        }
    }

    function send() {
        if (state.isSubmitting) return;
        const text = input.value.trim();
        if (!text) return;
        state.isSubmitting = true;
        input.value = '';
        sendBtn.disabled = true;
        state.pendingUserMessage = text;
        userMsg(text);
        processFlow(text);
    }

    // ─── CONVERSATION FLOW ──────────────────────────────────
    async function processFlow(userMessage) {
        try {
            console.debug('[chatbot] step=', state.currentStep, 'lang=', state.language, 'input=', userMessage);

            if (state.currentStep === 'DONE') return;

            if (state.currentStep === 'NAME') {
                if (!userMessage || userMessage.trim() === '' || userMessage.length > 50) return;
                state.userData.name = userMessage;
                saveProfile({ name: userMessage });
                state.currentStep = 'AGE';
                saveState();
                delayBot(t('ask_age') || "How old are you?");
                return;
            }

        if (state.currentStep === 'AGE') {
            const age = parseInt(userMessage);
            if (isNaN(age) || age < 1 || age > 120) {
                delayBot(t('invalid_age') || "Please enter a valid age.");
                return;
            }
            state.userData.age = age;
            saveProfile({ age: age });
            state.currentStep = 'GENDER';
            saveState();
            delayBot(t('ask_gender'));
            setTimeout(() => showQuickReplies(['Male', 'Female', 'Other']), 550);
            return;
        }

        if (state.currentStep === 'GENDER') {
            const normalized = userMessage.toLowerCase().trim();
            if (['male', 'm', 'man', 'boy'].includes(normalized)) state.userData.gender = 'Male';
            else if (['female', 'f', 'woman', 'girl'].includes(normalized)) state.userData.gender = 'Female';
            else state.userData.gender = 'Other';
            saveProfile({ gender: state.userData.gender });
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
            saveProfile({ phone: userMessage, language: state.language });
            if (state.authUiState.otpToken) {
                showLoader('Creating your patient profile...');
                try {
                    await registerNewPatient();
                    removeLoader();
                    botMsg(`Registration successful. Your Patient ID is <strong>${esc(state.patientSession.patientId)}</strong>.`);
                } catch (error) {
                    removeLoader();
                    botMsg(`Registration failed: ${esc(error.message)}`);
                    state.currentStep = 'PHONE';
                    saveState();
                    return;
                }
            }
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

        // Issue 2: POST_DIAGNOSIS re-engagement
        if (state.currentStep === 'POST_DIAGNOSIS') {
            const low = userMessage.toLowerCase().trim();
            const YES = ['yes','y','yep','sure','ok','okay','haan','हाँ','होय','आम्','ह্याঁ','हा'];
            const NO = ['no','n','nahi','नहीं','नाही','इल्लै','ना','ना','stop','end','bye'];
            if (YES.includes(low)) {
                state.symptoms = '';
                state.followUpAnswers = [];
                state.lastDiagnosis = null;
                state.currentStep = 'SYMPTOMS';
                saveState();
                delayBot(t('describeNewProblem') || 'Great! Please describe your new symptoms.');
            } else if (NO.includes(low)) {
                state.currentStep = 'ENDED';
                saveState();
                const gbye = (t('goodbye') || 'Thank you, {name}! Take care. 💚').replace('{name}', esc(state.userData.name));
                botMsg(gbye);
                setTimeout(() => {
                    setEnabled(false);
                    if (input) input.placeholder = t('chatEnded') || 'Chat ended.';
                    pushHtmlMsg(`<div style="text-align:center;margin:8px 0;"><button class="hc-book-btn" style="width:auto;margin:0 auto;padding:8px 20px;" onclick="window.hcStartNewChat()">${t('startNewChat') || 'Start New Chat'}</button></div>`);
                }, 600);
            } else if (low.length > 10) {
                state.symptoms = userMessage;
                state.followUpAnswers = [];
                state.lastDiagnosis = null;
                state.currentStep = 'SYMPTOMS';
                saveState();
                await fetchFollowUpQuestions(userMessage);
            } else {
                delayBot(t('clarifyYesNo') || "Please type 'yes' for another problem or 'no' to end.");
            }
            return;
        }

        if (state.currentStep === 'ENDED') {
            pushHtmlMsg(`<div style="text-align:center;margin:8px 0;"><button class="hc-book-btn" style="width:auto;margin:0 auto;padding:8px 20px;" onclick="window.hcStartNewChat()">${t('startNewChat') || 'Start New Chat'}</button></div>`);
            return;
        }
        } catch (error) {
            console.error('[chatbot] processFlow error:', error);
        } finally {
            state.isSubmitting = false;
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

    window.hcChipClick = function(value) {
        if (!input || input.disabled) return;
        input.value = value;
        sendBtn.disabled = false;
        send();
    };

    function showQuickReplies(options) {
        if (!Array.isArray(options) || options.length === 0) return;
        let html = '<div class="hc-chip-row">';
        options.forEach((opt) => {
            html += `<button class="hc-chip" onclick="window.hcChipClick('${esc(opt)}')">${esc(opt)}</button>`;
        });
        html += '</div>';
        pushHtmlMsg(html);
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
            saveState();

            removeLoader();
            showDiagnosis(diagData);

            if (diagData.availability_status === 'external_referral') {
                setTimeout(() => {
                    state.currentStep = 'POST_DIAGNOSIS';
                    saveState();
                    botMsg(t('anotherProblem') || "Is there anything else I can help you with? Type 'yes' for another problem or 'no' to end.");
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
                        state.currentStep = 'POST_DIAGNOSIS';
                        saveState();
                        botMsg(t('anotherProblem') || "Is there anything else I can help you with? Type 'yes' for another problem or 'no' to end.");
                        showQuickReplies(['Yes', 'No']);
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
        if (state.bookingInFlight) return;
        const form = document.getElementById(`hc-form-${doctorId}`);
        if(!form) return;
        const date = form.querySelector('.hc-appt-date').value;
        const time = form.querySelector('.hc-appt-time').value;

        if (!date || !time) {
            botMsg('⚠️ ' + t('select_date_time'));
            return;
        }

        form.remove();
        state.bookingInFlight = true;
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
        } finally {
            state.bookingInFlight = false;
        }
    };

    // ─── RENDERING & UI Helpers ──────────────────────────────
    function userMsg(text) {
        state.history.push({ type: 'user', content: text, ts: new Date().toISOString() });
        saveState();
        renderUserMsg(text, true);
    }
    function renderUserMsg(text, doScroll, timestamp) {
        const el = document.createElement('div');
        el.className = 'hc-msg user';
        const userBg = config.themeColor || '#0066ff';
        el.style.background = `linear-gradient(135deg, ${userBg}, #2563eb)`;
        el.innerHTML = `${esc(text)}<span class="hc-msg-time">${time(timestamp)}</span>`;
        body.appendChild(el);
        if(doScroll) scroll();
    }

    function botMsg(html) {
        state.history.push({ type: 'bot', content: html, ts: new Date().toISOString() });
        saveState();
        if (state.pendingUserMessage) {
            saveChatPair(state.pendingUserMessage, html);
            state.pendingUserMessage = '';
        }
        renderBotMsg(html, true);
    }
    function renderBotMsg(html, doScroll, timestamp) {
        const el = document.createElement('div');
        el.className = 'hc-msg bot';
        el.innerHTML = `${html}<span class="hc-msg-time">${time(timestamp)}</span>`;
        body.appendChild(el);
        if(doScroll) scroll();

        if (hcVoice.ttsEnabled) {
            hcVoice.speak(html, state.language);
        }
    }

    function pushHtmlMsg(html) {
        state.history.push({ type: 'html', content: html, ts: new Date().toISOString() });
        saveState();
        if (state.pendingUserMessage) {
            saveChatPair(state.pendingUserMessage, html);
            state.pendingUserMessage = '';
        }
        renderHtmlMsg(html, true);
    }
    function renderHtmlMsg(html, doScroll, timestamp) {
        const el = document.createElement('div');
        el.innerHTML = html;
        if (timestamp) {
            const timeEl = document.createElement('div');
            timeEl.className = 'hc-system-time';
            timeEl.textContent = time(timestamp);
            el.appendChild(timeEl);
        }
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
    function renderDateDivider(dateObj, doScroll) {
        const el = document.createElement('div');
        el.className = 'hc-date-divider';
        el.textContent = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        body.appendChild(el);
        if (doScroll) scroll();
    }

    function time(ts) {
        const d = ts ? new Date(ts) : new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    function stripHtml(str) {
        const d = document.createElement('div');
        d.innerHTML = String(str || '');
        return d.textContent || d.innerText || '';
    }

    // ─── BOOT ───────────────────────────────────────────────
    async function init() {
        loadAssets();
        loadState();
        await verifyExistingSession();
        build();
        window.addEventListener('offline', () => {
            botMsg('You appear to be offline. I will reconnect automatically.');
        });
        window.addEventListener('online', async () => {
            botMsg('Connection restored. Syncing your pending chat...');
            await flushFailedChatQueue();
        });
        if (state.isAuthenticated && state.patientSession.patientId && state.history.length === 0) {
            try { await hydrateHistoryFromServer(); } catch (e) {}
        }
        await flushFailedChatQueue();
    }

    function waitForTranslations(callback, attempts) {
        attempts = attempts || 0;
        if (window.TRANSLATIONS) {
            callback();
        } else if (attempts < 50) {
            setTimeout(function() { waitForTranslations(callback, attempts + 1); }, 50);
        } else {
            // Translations never loaded — boot anyway
            callback();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { waitForTranslations(init); });
    } else {
        waitForTranslations(init);
    }
})();
