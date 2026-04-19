const fs = require('fs');
let code = fs.readFileSync('../frontend/chatbot.js', 'utf8');

// 1. Inject t() and askLanguage() functions, and add language-switch icon logic
code = code.replace(
    '<div class="hc-header-actions">',
    `<div class="hc-header-actions">\n                        <button class="hc-header-btn" id="hc-lang-toggle" title="Change Language">\n                            <i class="fa-solid fa-globe"></i>\n                        </button>`
);

code = code.replace(
    "document.getElementById('hc-clear').addEventListener('click', restart);",
    "document.getElementById('hc-clear').addEventListener('click', restart);\n        document.getElementById('hc-lang-toggle').addEventListener('click', askLanguage);"
);

// 2. Add translation logic at the top
code = code.replace(
    "// ─── STATE MANAGEMENT",
    `// ─── TRANSLATIONS ───────────────────────────────────────
    function t(key) {
        if (!window.TRANSLATIONS) return key;
        const l = state.lang || 'en';
        return window.TRANSLATIONS[l]?.[key] || window.TRANSLATIONS['en']?.[key] || key;
    }

    function askLanguage() {
        let html = \`<div class="hc-lang-container" style="background:var(--hc-white); padding:16px; border-radius:12px; border:1px solid var(--hc-border); margin-bottom:12px;">
            <p style="margin-bottom:12px; font-weight:600; text-align:center;">Please select your language:</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('en')">🇬🇧 English</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('hi')">🇮🇳 हिन्दी</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('mr')">🇮🇳 मराठी</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('ta')">🇮🇳 தமிழ்</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('bn')">🇮🇳 বাংলা</button>
                <button class="hc-book-btn" style="padding:8px; font-size:13px; border:none; border-radius:6px; cursor:pointer; background:var(--hc-primary-light); color:var(--hc-primary-dark); font-weight:600;" onclick="window.hcSelectLang('gu')">🇮🇳 ગુજરાતી</button>
            </div>
        </div>\`;
        pushHtmlMsg(html);
        setEnabled(false);
    }

    window.hcSelectLang = function(lang) {
        state.lang = lang;
        localStorage.setItem('hc_chat_language', lang);
        saveState();
        input.placeholder = t('type_message');
        
        if (state.currentStep === 'LANG') {
            state.currentStep = 'NAME';
            saveState();
            setEnabled(true);
            botMsg(t('welcome'));
            setTimeout(() => botMsg(t('ask_name')), 600);
        } else {
            setEnabled(true);
            botMsg("Language updated.");
        }
    };

    // ─── STATE MANAGEMENT`
);

// 3. Update state
code = code.replace(
    "currentStep: 'NAME',",
    "currentStep: 'LANG',\n        lang: localStorage.getItem('hc_chat_language') || 'en',"
);

code = code.replace(
    "function restart() {\n        state.currentStep = 'NAME';",
    "function restart() {\n        state.currentStep = 'LANG';"
);

// 4. Update greet()
code = code.replace(
    /function greet\(\) \{[\s\S]*?\}/,
    `function greet() {
        if (state.currentStep === 'LANG') {
            askLanguage();
        } else {
            botMsg(t('welcome'));
            setTimeout(() => botMsg(t('ask_name')), 600);
        }
    }`
);

// 5. Update processFlow texts
code = code.replace("delayBot(`Nice to meet you, <strong>${esc(state.userData.name)}</strong>! How old are you?`);", "delayBot(t('ask_age'));");
code = code.replace("delayBot('Got it. What is your <strong>gender</strong>? (Male / Female / Other)');", "delayBot(t('ask_gender'));");
code = code.replace("delayBot('Please provide your <strong>phone number</strong> so the hospital can contact you if needed.');", "delayBot(t('ask_phone'));");
code = code.replace("delayBot(`Thanks, ${esc(state.userData.name)}. Now describe your <strong>symptoms</strong> in detail.`);", "delayBot(t('ask_symptoms'));");

code = code.replace('botMsg("⚠️ **EMERGENCY DETECTED** ⚠️<br><br>Based on your symptoms, please go to the nearest Emergency Room immediately or call emergency services.");', "botMsg(t('emergency_warning'));");

// 6. Update API calls to include language
code = code.replace(
    "gender: state.userData.gender\n                })",
    "gender: state.userData.gender,\n                    language: state.lang\n                })"
);

code = code.replace(
    "followUpAnswers: followUpAnswers\n                })",
    "followUpAnswers: followUpAnswers,\n                    language: state.lang\n                })"
);

code = code.replace('showLoader("Generating questions...");', 'showLoader(t("analyzing"));');
code = code.replace('showLoader("Analyzing symptoms...");', 'showLoader(t("analyzing"));');

// 7. showDiagnosis translation
let showDiagSplit = code.split('function showDiagnosis(d) {');
let showDiagEnd = showDiagSplit[1].indexOf('function showDoctorCard');
let beforeShowDiag = showDiagSplit[0];
let afterShowDiag = 'function showDoctorCard' + showDiagSplit[1].substring(showDiagEnd + 'function showDoctorCard'.length);

let newShowDiag = `function showDiagnosis(d) {
        const condition = d.condition || 'Unknown Condition';
        const severity = d.severity || 'Unknown';
        const specialist = d.specialist || 'General Physician';
        const explanation = d.explanation || '';
        const urgency = d.urgency || '';
        const redFlags = d.red_flags || [];
        const recommendations = d.recommendations || [];
        const disclaimer = d.disclaimer || 'This is general guidance, not a medical diagnosis.';

        const sevClass = String(severity).toLowerCase().includes('low') ? 'low'
                       : String(severity).toLowerCase().includes('high') || String(severity).toLowerCase().includes('emergency') ? 'high' : 'medium';

        let html = \`
            <div class="hc-diagnosis">
                <div class="hc-diag-header"><i class="fa-solid fa-stethoscope"></i> \${t('diagnosis_complete')}</div>
                <div class="hc-diag-body">
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">\${t('likely_condition')}</span>
                        <span class="hc-diag-value">\${esc(condition)}</span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">Severity Level</span>
                        <span class="hc-diag-value"><span class="hc-severity \${sevClass}">\${esc(severity)}</span></span>
                    </div>
                    <div class="hc-diag-row">
                        <span class="hc-diag-label">\${t('recommended_specialist')}</span>
                        <span class="hc-diag-value">\${esc(specialist)}</span>
                    </div>\`;

        if (explanation) {
            html += \`<div class="hc-diag-row"><span class="hc-diag-label">Explanation</span><span class="hc-diag-value">\${esc(explanation)}</span></div>\`;
        }
        if (urgency) {
            const urgClass = urgency.toLowerCase().includes('immediately') || urgency.toLowerCase().includes('er') ? 'hc-text-danger' : 'hc-text-warning';
            html += \`<div class="hc-diag-row"><span class="hc-diag-label">\${t('urgency')}</span><span class="hc-diag-value \${urgClass}"><strong>\${esc(urgency)}</strong></span></div>\`;
        }
        if (redFlags.length > 0) {
            html += \`<div class="hc-diag-row"><span class="hc-diag-label" style="color:var(--hc-danger)">🚩 \${t('watch_out')}</span><ul class="hc-diag-list">\`;
            redFlags.forEach(rf => html += \`<li>\${esc(rf)}</li>\`);
            html += \`</ul></div>\`;
        }
        if (recommendations.length > 0) {
            html += \`<div class="hc-diag-row"><span class="hc-diag-label">\${t('recommendations')}</span><ul class="hc-diag-list">\`;
            recommendations.forEach(rc => html += \`<li>\${esc(rc)}</li>\`);
            html += \`</ul></div>\`;
        }

        if (d.availability_status === 'external_referral') {
            html += \`<div class="hc-diag-row hc-alert-danger" style="background:#fee2e2; border-left:3px solid #ef4444; padding:8px; border-radius:6px; margin-top:8px;">
                <div style="color:#b91c1c; font-weight:700; margin-bottom:4px;">⚠️ \${t('specialist_not_available')}</div>
                <div style="font-size:12px; color:#991b1b;">\${esc(d.referral_message)}</div>
                <button class="hc-book-btn" style="margin-top:8px; background:#ef4444; width:100%; border:none; padding:8px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;" onclick="window.hcFetchGeneralMedicine()">📞 \${t('book_gm_instead')}</button>
            </div>\`;
        } else if (d.availability_status === 'referral_needed') {
            html += \`<div class="hc-diag-row hc-alert-info" style="background:#e0f2fe; border-left:3px solid #0ea5e9; padding:8px; border-radius:6px; margin-top:8px;">
                <div style="color:#0369a1; font-weight:700; margin-bottom:4px;">ℹ️ Note: Specialized consultation may be needed</div>
                <div style="font-size:12px; color:#0c4a6e;">\${esc(d.referral_message)}</div>
            </div>\`;
        }

        html += \`
                </div>
                <div class="hc-diag-footer"><i class="fa-solid fa-circle-info"></i> \${esc(disclaimer)}</div>
            </div>\`;
        pushHtmlMsg(html);
    }
    
    `;

code = beforeShowDiag + newShowDiag + afterShowDiag;

code = code.replace('Book Appointment</button>', '${t("book_appointment")}</button>');
code = code.replace("input   = document.getElementById('hc-input');", "input   = document.getElementById('hc-input');\n        input.placeholder = t('type_message');");

fs.writeFileSync('../frontend/chatbot.js', code);
console.log('chatbot.js successfully modified!');
