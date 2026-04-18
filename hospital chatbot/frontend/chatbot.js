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

    // ─── STATE MANAGEMENT (LocalStorage) ─────────────────────
    const STATE_KEY = 'hc_chat_state';
    
    let state = {
        isOpen: false,
        currentStep: 'NAME',
        userData: { name: '', age: '', gender: '', phone: '' },
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
        sendBtn = document.getElementById('hc-send');
        
        document.getElementById('hc-close').addEventListener('click', () => toggle(false));
        document.getElementById('hc-clear').addEventListener('click', restart);
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
        state.currentStep = 'NAME';
        state.userData = { name: '', age: '', gender: '', phone: '' };
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
        botMsg(`Hello! 👋 I'm your <strong>${esc(config.hospitalName)} AI Assistant</strong>.`);
        botMsg("I'll analyze your symptoms and connect you with the right doctor from our hospital.");
        botMsg("Let's begin — what is your <strong>name</strong>?");
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
            delayBot(`Nice to meet you, <strong>${esc(state.userData.name)}</strong>! How old are you?`);
            return;
        }

        if (state.currentStep === 'AGE') {
            const age = parseInt(userMessage);
            if (isNaN(age) || age < 1 || age > 120) {
                delayBot("Please enter a valid age.");
                return;
            }
            state.userData.age = age;
            state.currentStep = 'GENDER';
            saveState();
            delayBot('Got it. What is your <strong>gender</strong>? (Male / Female / Other)');
            return;
        }

        if (state.currentStep === 'GENDER') {
            state.userData.gender = userMessage;
            state.currentStep = 'PHONE';
            saveState();
            delayBot('Please provide your <strong>phone number</strong> so the hospital can contact you if needed.');
            return;
        }

        if (state.currentStep === 'PHONE') {
            const phoneRegex = /^[0-9\s\-+]{8,15}$/;
            if (!phoneRegex.test(userMessage)) {
                delayBot("Please enter a valid phone number.");
                return;
            }
            state.userData.phone = userMessage;
            state.currentStep = 'SYMPTOMS';
            saveState();
            delayBot(`Thanks, ${esc(state.userData.name)}. Now describe your <strong>symptoms</strong> in detail.`);
            return;
        }

        if (state.currentStep === 'SYMPTOMS') {
            await handleDiagnosis(userMessage);
            return;
        }

        if (state.currentStep === 'MORE_SYMPTOMS') {
            if (userMessage.toLowerCase().trim() === 'no') {
                state.currentStep = 'DONE';
                saveState();
                delayBot(`Thank you, <strong>${esc(state.userData.name)}</strong>! Stay healthy. Visit us at ${esc(config.hospitalName)} anytime. 🏥`);
                setTimeout(() => setEnabled(false), 600);
            } else {
                await handleDiagnosis(userMessage);
            }
            return;
        }
    }

    // ─── DIAGNOSIS + DOCTOR MATCHING ────────────────────────
    async function handleDiagnosis(userMessage, isRetry = false) {
        if (!isRetry) showLoader("Analyzing symptoms...");
        setEnabled(false);

        try {
            const diagResponse = await fetch(`${API_BASE}/api/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: state.userData.name,
                    age: state.userData.age,
                    gender: state.userData.gender,
                    symptoms: userMessage
                })
            });

            if (!diagResponse.ok) {
                if(diagResponse.status === 429) throw new Error("Rate limit exceeded.");
                throw new Error("Diagnosis failed");
            }
            const diagData = await diagResponse.json();
            
            state.lastDiagnosis = diagData;
            state.lastDiagnosis.symptoms = userMessage;
            saveState();

            removeLoader();
            showDiagnosis(diagData);

            showLoader("Finding specialists...");
            const docResponse = await fetch(`${API_BASE}/api/doctors?specialist=${encodeURIComponent(diagData.specialist)}`);
            const doctors = docResponse.ok ? await docResponse.json() : [];

            removeLoader();

            setTimeout(() => {
                if (doctors && doctors.length > 0) {
                    const bestDoctor = doctors[0];
                    showDoctorCard(bestDoctor);
                } else {
                    botMsg('No specialist currently available for this condition. Please contact the hospital directly.');
                }

                setTimeout(() => {
                    state.currentStep = 'MORE_SYMPTOMS';
                    saveState();
                    botMsg('Do you have <strong>other symptoms</strong>? Type them below or type <strong>"no"</strong> to finish.');
                    setEnabled(true);
                }, 800);
            }, 600);

        } catch (error) {
            removeLoader();
            console.error('API execution error:', error);
            showErrorRetry("We're having trouble analyzing your request. Please try again or contact the hospital.", () => {
                handleDiagnosis(userMessage, true);
            });
        }
    }

    // ─── RENDER COMPONENTS ──────────────────────────────────
    function showDiagnosis(d) {
        const condition = d.condition || 'Unknown Condition';
        const severity = d.severity || 'Unknown';
        const specialist = d.specialist || 'General Physician';
        const disclaimer = d.disclaimer || 'This is general guidance, not a medical diagnosis.';

        const sevClass = String(severity).toLowerCase().includes('low') ? 'low'
                       : String(severity).toLowerCase().includes('high') ? 'high' : 'medium';

        const html = `
            <div class="hc-diagnosis">
                <div class="hc-diag-header"><i class="fa-solid fa-stethoscope"></i> AI Analysis</div>
                <div class="hc-diag-body">
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">Condition Assessment</span>
                        <span class="hc-diag-value">${esc(condition)}</span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">Severity Level</span>
                        <span class="hc-diag-value"><span class="hc-severity ${sevClass}">${esc(severity)}</span></span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">Recommended Specialist</span>
                        <span class="hc-diag-value">${esc(specialist)}</span>
                    </div>
                </div>
                <div class="hc-diag-footer"><i class="fa-solid fa-circle-info"></i> ${esc(disclaimer)}</div>
            </div>`;
        pushHtmlMsg(html);
    }

    function showDoctorCard(doctor) {
        const availClass = doctor.available ? 'available' : 'unavailable';
        const availText = doctor.available ? '🟢 Available Today' : '🔴 Currently Unavailable';
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
                    <div class="hc-doc-meta"><i class="fa-solid fa-star"></i> ${esc(String(doctor.experience))} Years Experience</div>
                    <div class="hc-doc-meta"><i class="fa-solid fa-clock"></i> ${esc(doctor.timing)}</div>
                    <div class="hc-doc-meta hc-avail-badge ${availClass}">${availText}</div>
                </div>
                ${doctor.available ? `<button class="hc-book-btn" onclick="window.hcShowBookingForm(${doctor.id}, '${esc(doctor.name)}', '${esc(doctor.timing)}')"><i class="fa-solid fa-calendar-check"></i> Book Appointment</button>` : '<div class="hc-doc-unavail">Not available for booking.</div>'}
            </div>`;
        pushHtmlMsg(html);
    }

    window.hcShowBookingForm = function(doctorId, doctorName, timing) {
        // Fallback slots
        let slotsHtml = '<option value="10:00 AM">10:00 AM</option><option value="11:00 AM">11:00 AM</option>';
        const today = new Date().toISOString().split('T')[0];
        
        const html = `
            <div class="hc-appt-form" id="hc-form-${doctorId}">
                <div class="hc-appt-title"><i class="fa-solid fa-calendar-plus"></i> Book with ${esc(doctorName)}</div>
                <div class="hc-appt-field">
                    <label>Select Date</label>
                    <input type="date" class="hc-appt-date" value="${today}" min="${today}">
                </div>
                <div class="hc-appt-field">
                    <label>Select Time Slot</label>
                    <select class="hc-appt-time">${slotsHtml}</select>
                </div>
                <div class="hc-appt-actions">
                    <button class="hc-appt-confirm" onclick="window.hcConfirmBooking(${doctorId}, '${esc(doctorName)}')"><i class="fa-solid fa-check"></i> Confirm</button>
                    <button class="hc-appt-cancel" onclick="document.getElementById('hc-form-${doctorId}').remove()"><i class="fa-solid fa-xmark"></i> Cancel</button>
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
            botMsg('⚠️ Please select both date and time.');
            return;
        }

        form.remove();
        showLoader("Booking...");
        
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
                const result = await res.json();
                pushHtmlMsg(`
                    <div class="hc-booking-confirm">
                        <div class="hc-confirm-icon"><i class="fa-solid fa-circle-check"></i></div>
                        <div class="hc-confirm-title">Request Received!</div>
                        <div class="hc-confirm-details">
                            <div><strong>Doctor:</strong> ${esc(doctorName)}</div>
                            <div><strong>Date:</strong> ${esc(date)}</div>
                            <div><strong>Time:</strong> ${esc(time)}</div>
                        </div>
                    </div>`);
                setTimeout(() => {
                    botMsg("Your appointment request has been received. The hospital will contact you shortly.");
                }, 500);
            } else {
                botMsg('⚠️ Failed to book appointment. Please try again.');
            }
        } catch (err) {
            removeLoader();
            console.error(err);
            botMsg('⚠️ Unable to book appointment. Please check your connection.');
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
