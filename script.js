// =============================================
//  Health Center - Disease Monitor
//  static/js/script.js  (Full Version)
// =============================================

'use strict';

// ── CONSTANTS ─────────────────────────────────────────────
const DISEASE_COLORS = {
    'Dengue':     { bg: '#FEF2F2', text: '#DC2626', badge: 'dis-dengue'     },
    'Flu':        { bg: '#EFF6FF', text: '#2563EB', badge: 'dis-flu'        },
    'Diarrhea':   { bg: '#FFFBEB', text: '#D97706', badge: 'dis-diarrhea'   },
    'Chickenpox': { bg: '#F5F3FF', text: '#7C3AED', badge: 'dis-chickenpox' },
    'Heatstroke': { bg: '#FFF7ED', text: '#EA580C', badge: 'dis-heatstroke' },
};

const STATUS_BADGE = {
    'Under Treatment': 'badge-red',
    'Recovering':      'badge-green',
    'Monitoring':      'badge-amber',
    'Isolated':        'badge-blue',
};

const APPT_STATUS_BADGE = {
    'Pending':   'badge-amber',
    'Confirmed': 'badge-blue',
    'Completed': 'badge-green',
    'Cancelled': 'badge-gray',
};

const PIN_SVG = `<svg viewBox="0 0 12 12" fill="currentColor" style="width:11px;height:11px;flex-shrink:0"><path d="M6 1a3.5 3.5 0 00-3.5 3.5c0 3 3.5 6.5 3.5 6.5s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1zm0 4.5a1 1 0 110-2 1 1 0 010 2z"/></svg>`;

// ── STATE ─────────────────────────────────────────────────
let allPatients     = [];
let allAppointments = [];
let patientStatusFilter = 'All';
let pendingDeleteFn  = null;
let pieChartInstance = null;

// ── NAVIGATION ────────────────────────────────────────────
function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');

    const navOrder = ['dashboard','disease','patients','addpatient','appointments','records','settings'];
    const idx = navOrder.indexOf(page);
    if (idx > -1) document.querySelectorAll('.nav-item')[idx].classList.add('active');

    if (page === 'dashboard' || page === 'disease') loadDashboard();
    if (page === 'patients')     loadPatientTable();
    if (page === 'appointments') loadAppointments();
    if (page === 'records')      loadRecords();
}

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('load', () => {
    initCharts();
    loadDashboard();
    // Set today as default appointment date
    const apptDate = document.getElementById('apptDate');
    if (apptDate) apptDate.value = today();
});

function today() {
    return new Date().toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════

function loadDashboard() {
    fetch('/api/patients')
        .then(r => r.json())
        .then(patients => {
            allPatients = patients;
            renderStats(patients);
            renderAlerts(patients);
            renderRecentCases(patients);
            renderPieChart(patients);
            renderDiseaseTable(patients);
            renderPurokCards(patients);
            renderAreaBreakdown(patients);
            updateAgeChart(patients);
        })
        .catch(() => showToast('error', 'Could not load patient data.'));
}

function renderStats(patients) {
    const c = countByDisease(patients);
    document.getElementById('statTotal').textContent      = patients.length;
    document.getElementById('statDengue').textContent     = c['Dengue']     || 0;
    document.getElementById('statFlu').textContent        = c['Flu']        || 0;
    document.getElementById('statDiarrhea').textContent   = c['Diarrhea']   || 0;
    document.getElementById('statChickenpox').textContent = c['Chickenpox'] || 0;
    document.getElementById('statHeatstroke').textContent = c['Heatstroke'] || 0;
}

function renderAlerts(patients) {
    const container = document.getElementById('alertsContainer');
    const counts    = countByDisease(patients);
    let html = '';
    Object.entries(counts).forEach(([disease, count]) => {
        if (count >= 3) {
            const isHigh = count >= 5;
            html += `<div class="alert ${isHigh ? 'alert-red' : 'alert-amber'}" style="margin-bottom:8px">
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 4v4M8 11v1.5"/></svg>
                <div><strong>${disease} Alert:</strong> ${count} active case${count > 1 ? 's' : ''} recorded.</div>
            </div>`;
        }
    });
    container.innerHTML = html;
}

function renderRecentCases(patients) {
    const container = document.getElementById('recentCasesContainer');
    if (!patients.length) {
        container.innerHTML = '<div class="empty-mini">No cases yet. Add a patient to get started.</div>';
        return;
    }
    const recent = [...patients].reverse().slice(0, 5);
    container.innerHTML = recent.map(p => {
        const col     = DISEASE_COLORS[p.disease] || { bg: '#F3F4F6', text: '#6B7280' };
        const ini     = initials(p.first_name, p.last_name);
        const badge   = STATUS_BADGE[p.status] || 'badge-green';
        const status  = p.status || 'Under Treatment';
        return `<div class="case-item">
            <div class="case-avatar" style="background:${col.bg};color:${col.text}">${ini}</div>
            <div class="case-info">
                <div class="case-name">${esc(p.first_name)} ${esc(p.last_name)}</div>
                <div class="case-meta">Age ${p.age || '—'} · ${esc(p.disease)} · ${p.date_reported || '—'}</div>
            </div>
            <span class="badge ${badge}">${status}</span>
        </div>`;
    }).join('');
}

function renderPieChart(patients) {
    const counts = countByDisease(patients);
    const labels = Object.keys(counts);
    const data   = Object.values(counts);
    const total  = data.reduce((a, b) => a + b, 0);
    const colors = labels.map(l => (DISEASE_COLORS[l] || {}).text || '#999');

    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }

    if (!total) {
        document.getElementById('pieLegend').innerHTML =
            '<div style="text-align:center;color:var(--gray-400);font-size:13px;padding:20px 0">No data yet.</div>';
        return;
    }

    pieChartInstance = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'white', hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
    });

    document.getElementById('pieLegend').innerHTML = labels.map((l, i) =>
        `<div class="legend-row">
            <div class="legend-left"><span class="legend-dot" style="background:${colors[i]}"></span>${l}</div>
            <span class="legend-val">${data[i]} (${Math.round(data[i] / total * 100)}%)</span>
        </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
//  DISEASE MONITORING
// ═══════════════════════════════════════════════════════════

function renderDiseaseTable(patients) {
    const tbody = document.getElementById('diseaseTbody');
    if (!patients.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-td">No cases recorded yet.</td></tr>`;
        document.getElementById('diseaseCount').textContent = 'Showing 0 of 0 cases';
        return;
    }
    tbody.innerHTML = patients.map(p => {
        const col      = DISEASE_COLORS[p.disease] || { bg: '#F3F4F6', text: '#6B7280', badge: '' };
        const sevClass = { High: 'sev-high', Medium: 'sev-medium', Low: 'sev-low' }[p.severity] || '';
        return `<tr>
            <td><div class="patient-cell">
                <div class="mini-avatar" style="background:${col.bg};color:${col.text}">${initials(p.first_name, p.last_name)}</div>
                ${esc(p.first_name)} ${esc(p.last_name)}
            </div></td>
            <td>${p.age || '—'} / ${p.gender || '—'}</td>
            <td><span class="dis-badge ${col.badge}">${esc(p.disease)}</span></td>
            <td><div class="loc">${PIN_SVG}${esc(p.purok) || '—'}</div></td>
            <td>${esc(p.symptoms) || '—'}</td>
            <td>${p.date_reported || '—'}</td>
            <td><span class="sev-badge ${sevClass}">${p.severity || '—'}</span></td>
            <td>${p.status || 'Under Treatment'}</td>
        </tr>`;
    }).join('');
    document.getElementById('diseaseCount').textContent = `Showing ${patients.length} of ${patients.length} cases`;
}

function filterDiseaseTable() {
    const s    = document.getElementById('diseaseSearch').value.toLowerCase();
    const d    = document.getElementById('diseaseFilter').value.toLowerCase();
    const p    = document.getElementById('purokFilter').value.toLowerCase();
    const rows = document.querySelectorAll('#diseaseTable tbody tr');
    let vis    = 0;
    rows.forEach(r => {
        const t    = r.textContent.toLowerCase();
        const show = (!s || t.includes(s)) && (!d || t.includes(d)) && (!p || t.includes(p));
        r.style.display = show ? '' : 'none';
        if (show) vis++;
    });
    document.getElementById('diseaseCount').textContent = `Showing ${vis} of ${rows.length} cases`;
}

function renderPurokCards(patients) {
    const grid       = document.getElementById('purokGrid');
    const purokNames = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6'];
    const counts     = {};
    purokNames.forEach(pk => counts[pk] = 0);
    patients.forEach(p => { if (p.purok && counts[p.purok] !== undefined) counts[p.purok]++; });

    grid.innerHTML = purokNames.map(pk => {
        const n         = counts[pk];
        const alertIcon = n >= 5
            ? `<div class="purok-alert"><svg viewBox="0 0 14 14" fill="#DC2626"><path d="M7 1L1 13h12L7 1zm0 4v4M7 10v1.5"/></svg></div>`
            : '';
        return `<div class="purok-card">${alertIcon}<div class="purok-num">${n}</div><div class="purok-name">${pk}</div></div>`;
    }).join('');
}

function renderAreaBreakdown(patients) {
    const tbody      = document.getElementById('areaBreakdownTbody');
    const purokNames = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6'];
    const diseases   = ['Dengue','Flu','Diarrhea','Chickenpox','Heatstroke'];
    const data       = {};
    purokNames.forEach(pk => { data[pk] = { total: 0 }; diseases.forEach(d => data[pk][d] = 0); });
    patients.forEach(p => {
        if (p.purok && data[p.purok]) {
            data[p.purok].total++;
            if (p.disease && data[p.purok][p.disease] !== undefined) data[p.purok][p.disease]++;
        }
    });
    tbody.innerHTML = purokNames.map(pk => `
        <tr>
            <td><div class="loc">${PIN_SVG}${pk}</div></td>
            <td><strong>${data[pk].total}</strong></td>
            ${diseases.map(d => `<td>${data[pk][d]}</td>`).join('')}
            <td>—</td>
        </tr>`).join('');
}

// ═══════════════════════════════════════════════════════════
//  PATIENTS
// ═══════════════════════════════════════════════════════════

function loadPatientTable() {
    fetch('/api/patients')
        .then(r => r.json())
        .then(patients => { allPatients = patients; renderPatientTable(patients); })
        .catch(() => showToast('error', 'Could not load patients.'));
}

function renderPatientTable(patients) {
    const tbody = document.getElementById('patientTbody');
    if (!patients.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-td">No patients registered yet.</td></tr>`;
        document.getElementById('patientCount').textContent = 'Showing 0 of 0 patients';
        return;
    }
    tbody.innerHTML = patients.map((p, i) => {
        const col      = DISEASE_COLORS[p.disease] || { bg: '#F3F4F6', text: '#6B7280', badge: '' };
        const sevClass = { High: 'sev-high', Medium: 'sev-medium', Low: 'sev-low' }[p.severity] || '';
        const status   = p.status || 'Under Treatment';
        const badge    = STATUS_BADGE[status] || 'badge-gray';
        return `<tr data-status="${status}">
            <td style="color:var(--gray-400);font-weight:500">${i + 1}</td>
            <td><div class="patient-cell">
                <div class="mini-avatar" style="background:${col.bg};color:${col.text}">${initials(p.first_name, p.last_name)}</div>
                <div>
                    <div style="font-weight:500">${esc(p.first_name)} ${esc(p.last_name)}</div>
                    ${p.phone ? `<div style="font-size:11px;color:var(--gray-400)">${esc(p.phone)}</div>` : ''}
                </div>
            </div></td>
            <td>${p.age || '—'} / ${p.gender || '—'}</td>
            <td><span class="dis-badge ${col.badge}">${esc(p.disease)}</span></td>
            <td><div class="loc">${PIN_SVG}${esc(p.purok) || '—'}</div></td>
            <td><span class="sev-badge ${sevClass}">${p.severity || '—'}</span></td>
            <td><span class="badge ${badge}">${status}</span></td>
            <td>${p.date_reported || '—'}</td>
            <td>
                <button class="icon-btn del" title="Delete patient"
                    onclick="confirmDelete('patient', ${p.id}, '${esc(p.first_name)} ${esc(p.last_name)}')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="2 4 3 4 14 4"/>
                        <path d="M13 4l-.8 10H3.8L3 4"/><path d="M6.5 7v5M9.5 7v5"/><path d="M5 4V2h6v2"/>
                    </svg>
                </button>
            </td>
        </tr>`;
    }).join('');
    filterPatients();
}

function filterPatientStatus(status, btn) {
    patientStatusFilter = status;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterPatients();
}

function filterPatients() {
    const s    = document.getElementById('patientSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#patientTbody tr');
    let vis    = 0;
    rows.forEach(r => {
        const t      = r.textContent.toLowerCase();
        const status = r.dataset.status;
        const show   = (!s || t.includes(s)) && (patientStatusFilter === 'All' || status === patientStatusFilter);
        r.style.display = show ? '' : 'none';
        if (show) vis++;
    });
    const el = document.getElementById('patientCount');
    if (el) el.textContent = `Showing ${vis} of ${rows.length} patients`;
}

// ═══════════════════════════════════════════════════════════
//  ADD PATIENT
// ═══════════════════════════════════════════════════════════

function submitPatient() {
    const firstName = document.getElementById('patFirstName').value.trim();
    const lastName  = document.getElementById('patLastName').value.trim();
    const disease   = document.getElementById('patDisease').value;

    if (!firstName || !lastName || !disease) {
        showToast('error', 'Please fill in First Name, Last Name, and Disease.');
        return;
    }

    const payload = {
        first_name: firstName,
        last_name:  lastName,
        age:        document.getElementById('patAge').value.trim(),
        gender:     document.getElementById('patGender').value,
        disease,
        purok:      document.getElementById('patPurok').value,
        severity:   document.getElementById('patSeverity').value,
        symptoms:   document.getElementById('patSymptoms').value.trim(),
        phone:      document.getElementById('patPhone').value.trim(),
        email:      document.getElementById('patEmail').value.trim(),
        address:    document.getElementById('patAddress').value.trim(),
    };

    fetch('/api/patients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast('error', data.error); return; }
        showToast('success', `${firstName} ${lastName} registered successfully!`);
        clearPatientForm();
        navigate('patients');
    })
    .catch(() => showToast('error', 'Network error. Please try again.'));
}

function clearPatientForm() {
    ['patFirstName','patLastName','patAge','patPhone','patEmail','patAddress','patSymptoms']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['patGender','patDisease','patPurok','patSeverity']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ═══════════════════════════════════════════════════════════
//  APPOINTMENTS
// ═══════════════════════════════════════════════════════════

function loadAppointments() {
    fetch('/api/appointments')
        .then(r => r.json())
        .then(appts => { allAppointments = appts; renderAppointments(appts); })
        .catch(() => showToast('error', 'Could not load appointments.'));
}

function renderAppointments(appts) {
    // Update stat counters
    document.getElementById('apptTotal').textContent     = appts.length;
    document.getElementById('apptPending').textContent   = appts.filter(a => a.status === 'Pending').length;
    document.getElementById('apptConfirmed').textContent = appts.filter(a => a.status === 'Confirmed').length;
    document.getElementById('apptDone').textContent      = appts.filter(a => a.status === 'Completed').length;

    const list = document.getElementById('apptList');
    if (!appts.length) {
        list.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="8" width="30" height="28" rx="3"/>
                <path d="M5 16h30M14 6v4M26 6v4M13 24h6M13 29h10"/>
            </svg>
            <p>No appointments yet. Click <strong>New Appointment</strong> to add one.</p>
        </div>`;
        return;
    }

    // Sort by date desc
    const sorted = [...appts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    list.innerHTML = sorted.map(a => {
        const badge  = APPT_STATUS_BADGE[a.status] || 'badge-gray';
        const typeIcons = {
            'Check-up':    '🩺', 'Follow-up': '🔄', 'Vaccination': '💉',
            'Lab Test':    '🧪', 'Consultation': '💬'
        };
        const icon = typeIcons[a.type] || '📋';
        return `<div class="appt-card">
            <div class="appt-time-col">
                <div class="appt-date">${formatDate(a.date)}</div>
                <div class="appt-time-val">${a.time || '—'}</div>
            </div>
            <div class="appt-type-icon">${icon}</div>
            <div class="appt-info">
                <div class="appt-name">${esc(a.patient)}</div>
                <div class="appt-meta">
                    ${a.type || 'Check-up'} · Dr. ${esc(a.doctor) || 'TBA'}
                    ${a.notes ? `<span class="appt-notes"> · ${esc(a.notes)}</span>` : ''}
                </div>
            </div>
            <div class="appt-actions">
                <span class="badge ${badge}">${a.status}</span>
                <div class="appt-btn-row">
                    ${a.status === 'Pending'   ? `<button class="appt-action-btn confirm" onclick="updateApptStatus(${a.id},'Confirmed')">Confirm</button>` : ''}
                    ${a.status === 'Confirmed' ? `<button class="appt-action-btn done"    onclick="updateApptStatus(${a.id},'Completed')">Done</button>` : ''}
                    <button class="icon-btn del" onclick="confirmDelete('appointment', ${a.id}, '${esc(a.patient)}')">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <polyline points="2 4 3 4 14 4"/>
                            <path d="M13 4l-.8 10H3.8L3 4"/><path d="M6.5 7v5M9.5 7v5"/><path d="M5 4V2h6v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterAppointments() {
    const s      = document.getElementById('apptSearch').value.toLowerCase();
    const status = document.getElementById('apptStatusFilter').value;
    const type   = document.getElementById('apptTypeFilter').value;

    const filtered = allAppointments.filter(a => {
        const text     = (a.patient + ' ' + (a.doctor || '')).toLowerCase();
        const matchS   = !s      || text.includes(s);
        const matchSt  = !status || a.status === status;
        const matchT   = !type   || a.type === type;
        return matchS && matchSt && matchT;
    });
    renderAppointments(filtered);
}

function openApptModal() {
    document.getElementById('apptModal').classList.add('open');
    document.getElementById('apptDate').value = today();
}

function closeApptModal() {
    document.getElementById('apptModal').classList.remove('open');
    ['apptPatient','apptDoctor','apptTime','apptNotes'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('apptType').value = 'Check-up';
}

function submitAppointment() {
    const patient = document.getElementById('apptPatient').value.trim();
    const date    = document.getElementById('apptDate').value;

    if (!patient) { showToast('error', 'Patient name is required.'); return; }
    if (!date)    { showToast('error', 'Please select a date.');     return; }

    const payload = {
        patient,
        date,
        time:   document.getElementById('apptTime').value,
        type:   document.getElementById('apptType').value,
        doctor: document.getElementById('apptDoctor').value.trim(),
        notes:  document.getElementById('apptNotes').value.trim(),
    };

    fetch('/api/appointments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast('error', data.error); return; }
        showToast('success', `Appointment for ${patient} saved!`);
        closeApptModal();
        loadAppointments();
    })
    .catch(() => showToast('error', 'Network error. Please try again.'));
}

function updateApptStatus(id, newStatus) {
    fetch(`/api/appointments/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
    })
    .then(r => r.json())
    .then(() => { showToast('success', `Appointment marked as ${newStatus}.`); loadAppointments(); })
    .catch(() => showToast('error', 'Could not update appointment.'));
}

// ═══════════════════════════════════════════════════════════
//  RECORDS (shows full patient records with all fields)
// ═══════════════════════════════════════════════════════════

function loadRecords() {
    fetch('/api/patients')
        .then(r => r.json())
        .then(patients => {
            allPatients = patients;
            renderRecordStats(patients);
            renderRecordsTable(patients);
        })
        .catch(() => showToast('error', 'Could not load records.'));
}

function renderRecordStats(patients) {
    const grid   = document.getElementById('recordsStatGrid');
    const total  = patients.length;
    const active = patients.filter(p => p.status === 'Under Treatment').length;
    const recov  = patients.filter(p => p.status === 'Recovering').length;
    const high   = patients.filter(p => p.severity === 'High').length;

    grid.innerHTML = `
        <div class="stat-card primary">
            <div class="stat-num">${total}</div>
            <div class="stat-label">Total Records</div>
        </div>
        <div class="stat-card">
            <div class="stat-num" style="color:#DC2626">${active}</div>
            <div class="stat-label">Under Treatment</div>
        </div>
        <div class="stat-card">
            <div class="stat-num" style="color:#16A34A">${recov}</div>
            <div class="stat-label">Recovering</div>
        </div>
        <div class="stat-card">
            <div class="stat-num" style="color:#D97706">${high}</div>
            <div class="stat-label">High Severity</div>
        </div>`;
}

function renderRecordsTable(patients) {
    const tbody = document.getElementById('recordsTbody');
    if (!patients.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-td">No records found.</td></tr>`;
        return;
    }
    tbody.innerHTML = patients.map((p, i) => {
        const col      = DISEASE_COLORS[p.disease] || { bg: '#F3F4F6', text: '#6B7280', badge: '' };
        const sevClass = { High: 'sev-high', Medium: 'sev-medium', Low: 'sev-low' }[p.severity] || '';
        const status   = p.status || 'Under Treatment';
        const badge    = STATUS_BADGE[status] || 'badge-gray';
        return `<tr>
            <td style="color:var(--gray-400);font-weight:500">${i + 1}</td>
            <td><div class="patient-cell">
                <div class="mini-avatar" style="background:${col.bg};color:${col.text}">${initials(p.first_name,p.last_name)}</div>
                <div>
                    <div style="font-weight:500">${esc(p.first_name)} ${esc(p.last_name)}</div>
                    ${p.phone ? `<div style="font-size:11px;color:var(--gray-400)">${esc(p.phone)}</div>` : ''}
                </div>
            </div></td>
            <td>${p.age || '—'} / ${p.gender || '—'}</td>
            <td><span class="dis-badge ${col.badge}">${esc(p.disease)}</span></td>
            <td><div class="loc">${PIN_SVG}${esc(p.purok) || '—'}</div></td>
            <td><span class="sev-badge ${sevClass}">${p.severity || '—'}</span></td>
            <td style="max-width:160px;font-size:12px;color:var(--gray-600)">${esc(p.symptoms) || '—'}</td>
            <td><span class="badge ${badge}">${status}</span></td>
            <td>${p.date_reported || '—'}</td>
        </tr>`;
    }).join('');
}

function filterRecords() {
    const s      = document.getElementById('recordSearch').value.toLowerCase();
    const disease = document.getElementById('recordDiseaseFilter').value;
    const status  = document.getElementById('recordStatusFilter').value;

    const filtered = allPatients.filter(p => {
        const name     = `${p.first_name} ${p.last_name}`.toLowerCase();
        const matchS   = !s       || name.includes(s);
        const matchD   = !disease || p.disease === disease;
        const matchSt  = !status  || p.status === status;
        return matchS && matchD && matchSt;
    });
    renderRecordsTable(filtered);
}

// ═══════════════════════════════════════════════════════════
//  DELETE (generic)
// ═══════════════════════════════════════════════════════════

function confirmDelete(type, id, name) {
    const overlay = document.getElementById('deleteModal');
    document.getElementById('deleteModalTitle').textContent =
        type === 'patient' ? 'Delete Patient?' : 'Delete Appointment?';
    document.getElementById('deleteModalMsg').textContent =
        `Are you sure you want to delete the record for "${name}"? This cannot be undone.`;

    pendingDeleteFn = () => {
        const url = type === 'patient' ? `/api/patients/${id}` : `/api/appointments/${id}`;
        fetch(url, { method: 'DELETE' })
            .then(r => r.json())
            .then(data => {
                if (data.error) { showToast('error', data.error); return; }
                showToast('success', `Record deleted successfully.`);
                closeDeleteModal();
                if (type === 'patient') { loadPatientTable(); loadDashboard(); }
                else                   { loadAppointments(); }
            })
            .catch(() => showToast('error', 'Could not delete record.'));
    };

    document.getElementById('confirmDeleteBtn').onclick = pendingDeleteFn;
    overlay.classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('open');
    pendingDeleteFn = null;
}

// close modals on overlay click
document.addEventListener('click', e => {
    if (e.target.id === 'deleteModal') closeDeleteModal();
    if (e.target.id === 'apptModal')   closeApptModal();
});

// ═══════════════════════════════════════════════════════════
//  CHARTS  
// ═══════════════════════════════════════════════════════════

let trendChartInstance = null;
let ageChartInstance   = null;

function initCharts() {
    trendChartInstance = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: ['Jan','Feb','Mar','Apr'],
            datasets: [
                { label: 'Dengue',     data: [0,0,0,0], borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,.06)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Flu',        data: [0,0,0,0], borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.06)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Diarrhea',   data: [0,0,0,0], borderColor: '#D97706', backgroundColor: 'rgba(215,119,6,.04)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Chickenpox', data: [0,0,0,0], borderColor: '#7C3AED', tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Heatstroke', data: [0,0,0,0], borderColor: '#EA580C', tension: .4, pointRadius: 4, borderWidth: 2 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 12 } } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } } },
                x: { grid: { display: false },           ticks: { font: { size: 11 } } }
            }
        }
    });

    ageChartInstance = new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: {
            labels: ['0-5','6-12','13-17','18-60','60+'],
            datasets: [{ data: [0,0,0,0,0], backgroundColor: '#3B82F6', borderRadius: 5 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } } },
                x: { grid: { display: false },           ticks: { font: { size: 11 } } }
            }
        }
    });
}

function updateAgeChart(patients) {
    if (!ageChartInstance) return;
    const buckets = [0, 0, 0, 0, 0];
    patients.forEach(p => {
        const age = parseInt(p.age);
        if (isNaN(age)) return;
        if (age <= 5)       buckets[0]++;
        else if (age <= 12) buckets[1]++;
        else if (age <= 17) buckets[2]++;
        else if (age <= 60) buckets[3]++;
        else                buckets[4]++;
    });
    ageChartInstance.data.datasets[0].data = buckets;
    ageChartInstance.update();
}

// ═══════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════

function switchSettingsTab(el, tab) {
    document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const map = { profile: 'Profile', org: 'Organization', notif: 'Notifications', sec: 'Security' };
    const t   = document.querySelector('.settings-section-title');
    const s   = document.querySelector('.settings-section-sub');
    if (t) t.textContent = (map[tab] || tab) + ' Settings';
    if (s) s.textContent = 'Update your ' + (map[tab] || tab).toLowerCase() + ' information';
}

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════

function showToast(type, message, duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons     = { success: '✓', error: '✕', info: 'ℹ' };
    const toast     = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut .25s ease forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════

function initials(first, last) {
    return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
}

function countByDisease(patients) {
    const c = {};
    patients.forEach(p => { c[p.disease] = (c[p.disease] || 0) + 1; });
    return c;
}

function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
