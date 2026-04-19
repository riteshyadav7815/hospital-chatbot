/**
 * Admin Dashboard — JavaScript Logic
 * ────────────────────────────────────
 * Login, Doctor CRUD, Appointments management
 */
(function () {
    'use strict';

    const API = 'http://localhost:3000/api';
    let token = localStorage.getItem('admin_token') || '';

    // ─── DOM ────────────────────────────────────────────────
    const loginPage = document.getElementById('loginPage');
    const adminLayout = document.getElementById('adminLayout');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    // ─── AUTH ───────────────────────────────────────────────
    async function checkAuth() {
        if (!token) return showLogin();
        try {
            const res = await apiFetch('/auth/check');
            if (res.authenticated) showDashboard();
            else showLogin();
        } catch { showLogin(); }
    }

    function showLogin() {
        token = '';
        localStorage.removeItem('admin_token');
        loginPage.style.display = 'flex';
        adminLayout.classList.remove('active');
    }

    function showDashboard() {
        loginPage.style.display = 'none';
        adminLayout.classList.add('active');
        loadDashboard();
        loadDoctors();
        loadAppointments();
    }

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value.trim();
        loginError.style.display = 'none';

        if (!username || !password) {
            loginError.textContent = 'Please enter both fields.';
            loginError.style.display = 'block';
            return;
        }

        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                token = data.token;
                localStorage.setItem('admin_token', token);
                showDashboard();
            } else {
                loginError.textContent = data.error || 'Login failed.';
                loginError.style.display = 'block';
            }
        } catch (err) {
            loginError.textContent = 'Cannot connect to server.';
            loginError.style.display = 'block';
        }
    });

    // Enter key on password field
    document.getElementById('loginPass').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    logoutBtn.addEventListener('click', () => showLogin());

    // ─── API HELPER ─────────────────────────────────────────
    async function apiFetch(endpoint, options = {}) {
        const res = await fetch(`${API}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
        if (res.status === 401) { showLogin(); throw new Error('Unauthorized'); }
        return res.json();
    }

    // ─── SIDEBAR NAV ────────────────────────────────────────
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${link.dataset.page}`).classList.add('active');
        });
    });

    // ─── DASHBOARD ──────────────────────────────────────────
    async function loadDashboard() {
        try {
            const doctors = await apiFetch('/doctors');
            const stats = await apiFetch('/appointments/stats');

            document.getElementById('statsGrid').innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fa-solid fa-user-doctor"></i></div>
                    <div class="stat-info"><h3>${doctors.length}</h3><p>Total Doctors</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fa-solid fa-calendar-check"></i></div>
                    <div class="stat-info"><h3>${stats.total}</h3><p>Total Appointments</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fa-solid fa-clock"></i></div>
                    <div class="stat-info"><h3>${stats.pending}</h3><p>Pending</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fa-solid fa-check-circle"></i></div>
                    <div class="stat-info"><h3>${stats.confirmed + stats.completed}</h3><p>Confirmed / Done</p></div>
                </div>
            `;

            // Recent appointments
            const appointments = await apiFetch('/appointments');
            const recent = appointments.slice(0, 5);
            if (recent.length === 0) {
                document.getElementById('recentAppointments').innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar"></i><p>No appointments yet.</p></div>';
            } else {
                let html = '<table class="admin-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th></tr></thead><tbody>';
                recent.forEach(a => {
                    html += `<tr><td>${esc(a.patient_name)}</td><td>${esc(a.doctor_name || 'N/A')}</td><td>${esc(a.date)}</td><td><span class="badge ${statusBadge(a.status)}">${esc(a.status)}</span></td></tr>`;
                });
                html += '</tbody></table>';
                document.getElementById('recentAppointments').innerHTML = html;
            }
        } catch (err) { console.error('Dashboard load error:', err); }
    }

    // ─── DOCTORS ────────────────────────────────────────────
    let allDoctors = [];

    async function loadDoctors() {
        try {
            allDoctors = await apiFetch('/doctors');
            populateDeptFilter(allDoctors);
            renderDoctors();
        } catch (err) { console.error('Doctors load error:', err); }
    }

    function populateDeptFilter(doctors) {
        const filter = document.getElementById('deptFilter');
        if (!filter) return;
        const currentVal = filter.value;
        const depts = [...new Set(doctors.map(d => d.specialization))].sort();
        filter.innerHTML = '<option value="All">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
        if (depts.includes(currentVal)) filter.value = currentVal;
    }

    document.getElementById('deptFilter')?.addEventListener('change', renderDoctors);

    function renderDoctors() {
        const tbody = document.getElementById('doctorsTableBody');
        const filterVal = document.getElementById('deptFilter') ? document.getElementById('deptFilter').value : 'All';

        let filtered = allDoctors;
        if (filterVal !== 'All') {
            filtered = allDoctors.filter(d => d.specialization === filterVal);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8;">No doctors found.</td></tr>';
            return;
        }

        const grouped = {};
        filtered.forEach(d => {
            if (!grouped[d.specialization]) grouped[d.specialization] = [];
            grouped[d.specialization].push(d);
        });

        let html = '';
        for (const [dept, docs] of Object.entries(grouped)) {
            html += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; color:#334155; padding:10px 16px; border-bottom:1px solid #e2e8f0;">${esc(dept)}</td></tr>`;
            docs.forEach(d => {
                const desigBadge = d.designation ? `<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:12px; font-size:10px; margin-left:8px; font-weight:600; text-transform:uppercase;">${esc(d.designation)}</span>` : '';
                html += `
                    <tr>
                        <td><strong>${esc(d.name)}</strong>${desigBadge}</td>
                        <td>${esc(d.specialization)}</td>
                        <td>${d.experience} yrs</td>
                        <td>${esc(d.room_no)}</td>
                        <td>${esc(d.timing)}</td>
                        <td>
                            <label class="toggle-switch">
                                <input type="checkbox" ${d.available ? 'checked' : ''} onchange="window._toggleAvail(${d.id}, this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                        <td>
                            <div class="action-btns">
                                <button class="btn btn-sm btn-primary" onclick="window._editDoctor(${d.id})"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="window._deleteDoctor(${d.id}, '${esc(d.name)}')"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    }

    // ─── DOCTOR MODAL ───────────────────────────────────────
    const modal = document.getElementById('doctorModal');
    const modalTitle = document.getElementById('modalTitle');

    document.getElementById('addDoctorBtn').addEventListener('click', () => {
        modalTitle.textContent = 'Add Doctor';
        document.getElementById('docId').value = '';
        document.getElementById('docName').value = '';
        document.getElementById('docSpec').value = 'General Physician';
        document.getElementById('docExp').value = '';
        document.getElementById('docRoom').value = '';
        document.getElementById('docTiming').value = '';
        document.getElementById('docContact').value = '';
        modal.classList.add('active');
    });

    document.getElementById('modalClose').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('modalCancelBtn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('modalSaveBtn').addEventListener('click', async () => {
        const id = document.getElementById('docId').value;
        const body = {
            name: document.getElementById('docName').value.trim(),
            specialization: document.getElementById('docSpec').value,
            experience: parseInt(document.getElementById('docExp').value) || 0,
            room_no: document.getElementById('docRoom').value.trim(),
            timing: document.getElementById('docTiming').value.trim(),
            contact: document.getElementById('docContact').value.trim(),
            available: 1
        };

        if (!body.name || !body.specialization) { alert('Name and specialization are required.'); return; }

        try {
            if (id) {
                await apiFetch(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await apiFetch('/doctors', { method: 'POST', body: JSON.stringify(body) });
            }
            modal.classList.remove('active');
            loadDoctors();
            loadDashboard();
        } catch (err) { alert('Error saving doctor.'); }
    });

    // Global functions for inline handlers
    window._editDoctor = async function (id) {
        try {
            const d = await apiFetch(`/doctors/${id}`);
            modalTitle.textContent = 'Edit Doctor';
            document.getElementById('docId').value = d.id;
            document.getElementById('docName').value = d.name;
            document.getElementById('docSpec').value = d.specialization;
            document.getElementById('docExp').value = d.experience;
            document.getElementById('docRoom').value = d.room_no;
            document.getElementById('docTiming').value = d.timing;
            document.getElementById('docContact').value = d.contact || '';
            modal.classList.add('active');
        } catch (err) { alert('Error loading doctor.'); }
    };

    window._deleteDoctor = async function (id, name) {
        if (!confirm(`Delete ${name}?`)) return;
        try {
            await apiFetch(`/doctors/${id}`, { method: 'DELETE' });
            loadDoctors();
            loadDashboard();
        } catch (err) { alert('Error deleting doctor.'); }
    };

    window._toggleAvail = async function (id, checked) {
        try {
            await apiFetch(`/doctors/${id}/availability`, {
                method: 'PATCH',
                body: JSON.stringify({ available: checked })
            });
        } catch (err) { alert('Error updating availability.'); loadDoctors(); }
    };

    // ─── APPOINTMENTS ───────────────────────────────────────
    async function loadAppointments() {
        try {
            const appointments = await apiFetch('/appointments');
            const tbody = document.getElementById('appointmentsTableBody');

            if (appointments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#94a3b8;">No appointments yet.</td></tr>';
                return;
            }

            tbody.innerHTML = appointments.map(a => `
                <tr>
                    <td><strong>${esc(a.patient_name)}</strong></td>
                    <td>${a.age || '-'}</td>
                    <td>${esc(a.symptoms || '-')}</td>
                    <td>${esc(a.doctor_name || 'N/A')}</td>
                    <td>${esc(a.date)}</td>
                    <td>${esc(a.time)}</td>
                    <td><span class="badge ${statusBadge(a.status)}">${esc(a.status)}</span></td>
                    <td>
                        <select class="btn btn-sm" style="font-size:11px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;" onchange="window._updateStatus(${a.id}, this.value)">
                            <option ${a.status==='Pending'?'selected':''}>Pending</option>
                            <option ${a.status==='Confirmed'?'selected':''}>Confirmed</option>
                            <option ${a.status==='Completed'?'selected':''}>Completed</option>
                            <option ${a.status==='Cancelled'?'selected':''}>Cancelled</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        } catch (err) { console.error('Appointments load error:', err); }
    }

    window._updateStatus = async function (id, status) {
        try {
            await apiFetch(`/appointments/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            loadDashboard();
        } catch (err) { alert('Error updating status.'); loadAppointments(); }
    };

    // ─── HELPERS ────────────────────────────────────────────
    function statusBadge(s) {
        if (s === 'Confirmed') return 'badge-success';
        if (s === 'Pending') return 'badge-warning';
        if (s === 'Cancelled') return 'badge-danger';
        if (s === 'Completed') return 'badge-info';
        return 'badge-neutral';
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    // ─── BOOT ───────────────────────────────────────────────
    checkAuth();
})();
