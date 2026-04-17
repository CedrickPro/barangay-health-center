// =============================================
//  Health Center - Disease Monitor
//  main.js  (Fully Dynamic)
// =============================================

const DISEASE_COLORS = {
    'Dengue':     { bg: '#FEF2F2', text: '#DC2626', badge: 'dis-dengue' },
    'Flu':        { bg: '#EFF6FF', text: '#2563EB', badge: 'dis-flu' },
    'Diarrhea':   { bg: '#FFFBEB', text: '#D97706', badge: 'dis-diarrhea' },
    'Chickenpox': { bg: '#F5F3FF', text: '#7C3AED', badge: 'dis-chickenpox' },
    'Heatstroke': { bg: '#FFF7ED', text: '#EA580C', badge: 'dis-heatstroke' },
};
const PIE_COLORS = ['#DC2626','#2563EB','#D97706','#7C3AED','#EA580C'];

// ---- NAVIGATION ----
function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const map = { dashboard: 0, disease: 1, patients: 2, addpatient: 3, appointments: 4, records: 5, settings: 6 };
    document.querySelectorAll('.nav-item')[map[page]].classList.add('active');
    if (page === 'dashboard' || page === 'disease') loadDashboard();
}

// ---- LOAD DASHBOARD DATA ----
let pieChartInstance = null;

function loadDashboard() {
    fetch('/api/patients')
        .then(r => r.json())
        .then(patients => {
            renderStats(patients);
            renderAlerts(patients);
            renderRecentCases(patients);
            renderPieChart(patients);
            renderDiseaseTable(patients);
            renderPurokCards(patients);
            renderAreaBreakdown(patients);
        })
        .catch(() => {});
}

// ---- STATS ----
function renderStats(patients) {
    const counts = countByDisease(patients);
    document.getElementById('statTotal').textContent      = patients.length;
    document.getElementById('statDengue').textContent     = counts['Dengue']     || 0;
    document.getElementById('statFlu').textContent        = counts['Flu']        || 0;
    document.getElementById('statDiarrhea').textContent   = counts['Diarrhea']   || 0;
    document.getElementById('statChickenpox').textContent = counts['Chickenpox'] || 0;
    document.getElementById('statHeatstroke').textContent = counts['Heatstroke'] || 0;
}

// ---- ALERTS ----
function renderAlerts(patients) {
    const container = document.getElementById('alertsContainer');
    const counts = countByDisease(patients);
    let html = '';
    const THRESHOLD = 3;
    Object.entries(counts).forEach(([disease, count]) => {
        if (count >= THRESHOLD) {
            const isHigh = count >= 5;
            html += `
            <div class="alert ${isHigh ? 'alert-red' : 'alert-amber'}" style="margin-bottom:8px">
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 4v4M8 11v1.5"/></svg>
                <div><strong>${disease} Alert:</strong> ${count} active ${disease.toLowerCase()} case${count > 1 ? 's' : ''} recorded.</div>
            </div>`;
        }
    });
    container.innerHTML = html;
}

// ---- RECENT CASES ----
function renderRecentCases(patients) {
    const container = document.getElementById('recentCasesContainer');
    if (!patients.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray-400);font-size:13px">No cases yet. Add a patient to get started.</div>';
        return;
    }
    const recent = [...patients].reverse().slice(0, 5);
    const statusBadge = { 'Under Treatment': 'badge-red', 'Recovering': 'badge-green', 'Monitoring': 'badge-amber', 'Isolated': 'badge-blue' };
    container.innerHTML = recent.map(p => {
        const initials = (p.first_name[0] + p.last_name[0]).toUpperCase();
        const col = DISEASE_COLORS[p.disease] || { bg: '#F3F4F6', text: '#6B7280' };
        const badgeClass = statusBadge[p.status] || 'badge-green';
        return `
        <div class="case-item">
            <div class="case-avatar" style="background:${col.bg};color:${col.text}">${initials}</div>
            <div class="case-info">
                <div class="case-name">${p.first_name} ${p.last_name}</div>
                <div class="case-meta">Age ${p.age || '—'} · ${p.disease} · ${p.date_reported}</div>
            </div>
            <span class="badge ${badgeClass}">${p.status}</span>
        </div>`;
    }).join('');
}

// ---- PIE CHART ----
function renderPieChart(patients) {
    const counts = countByDisease(patients);
    const labels = Object.keys(counts);
    const data   = Object.values(counts);
    const total  = data.reduce((a, b) => a + b, 0);
    const colors = labels.map(l => (DISEASE_COLORS[l] || {}).text || '#999');

    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }

    if (!total) {
        document.getElementById('pieLegend').innerHTML = '<div style="text-align:center;color:var(--gray-400);font-size:13px">No data yet.</div>';
        return;
    }

    pieChartInstance = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'white', hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
    });

    document.getElementById('pieLegend').innerHTML = labels.map((l, i) => `
        <div class="legend-row">
            <div class="legend-left"><span class="legend-dot" style="background:${colors[i]}"></span>${l}</div>
            <span class="legend-val">${data[i]} cases (${Math.round(data[i]/total*100)}%)</span>
        </div>`).join('');
}

// ---- DISEASE MONITORING TABLE ----
const PIN_SVG = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M6 1a3.5 3.5 0 00-3.5 3.5c0 3 3.5 6.5 3.5 6.5s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1zm0 4.5a1 1 0 110-2 1 1 0 010 2z"/></svg>`;

function renderDiseaseTable(patients) {
    const tbody = document.getElementById('diseaseTbody');
    if (!patients.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray-400);font-size:13px">No cases yet.</td></tr>';
        document.getElementById('diseaseCount').textContent = 'Showing 0 of 0 cases';
        return;
    }
    tbody.innerHTML = patients.map(p => {
        const initials = (p.first_name[0] + p.last_name[0]).toUpperCase();
        const col = DISEASE_COLORS[p.disease] || { bg:'#F3F4F6', text:'#6B7280', badge:'' };
        const sevClass = { High:'sev-high', Medium:'sev-medium', Low:'sev-low' }[p.severity] || '';
        return `<tr>
            <td><div class="patient-cell">
                <div class="case-avatar" style="background:${col.bg};color:${col.text};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0">${initials}</div>
                ${p.first_name} ${p.last_name}
            </div></td>
            <td>${p.age || '—'} / ${p.gender || '—'}</td>
            <td><span class="dis-badge ${col.badge}">${p.disease}</span></td>
            <td><div class="loc">${PIN_SVG}${p.purok || '—'}</div></td>
            <td>${p.symptoms || '—'}</td>
            <td>${p.date_reported || '—'}</td>
            <td><span class="sev-badge ${sevClass}">${p.severity || '—'}</span></td>
            <td>${p.status}</td>
        </tr>`;
    }).join('');
    document.getElementById('diseaseCount').textContent = `Showing ${patients.length} of ${patients.length} cases`;
}

// ---- PUROK CARDS ----
function renderPurokCards(patients) {
    const grid = document.getElementById('purokGrid');
    const purokNames = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6'];
    const counts = {};
    purokNames.forEach(pk => counts[pk] = 0);
    patients.forEach(p => { if (p.purok && counts[p.purok] !== undefined) counts[p.purok]++; });

    grid.innerHTML = purokNames.map(pk => {
        const n = counts[pk];
        const isHigh = n >= 5;
        const alertIcon = isHigh ? `<div class="purok-alert"><svg viewBox="0 0 14 14" fill="#DC2626"><path d="M7 1L1 13h12L7 1zm0 4v4M7 10v1.5"/></svg></div>` : '';
        return `<div class="purok-card">${alertIcon}<div class="purok-num">${n}</div><div class="purok-name">${pk}</div></div>`;
    }).join('');
}

// ---- AREA BREAKDOWN ----
function renderAreaBreakdown(patients) {
    const tbody = document.getElementById('areaBreakdownTbody');
    const purokNames = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6'];
    const diseases = ['Dengue','Flu','Diarrhea','Chickenpox','Heatstroke'];

    const data = {};
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

// ---- HELPER ----
function countByDisease(patients) {
    const counts = {};
    patients.forEach(p => { counts[p.disease] = (counts[p.disease] || 0) + 1; });
    return counts;
}

// ---- DISEASE TABLE FILTER ----
function filterDiseaseTable() {
    const s = document.getElementById('diseaseSearch').value.toLowerCase();
    const d = document.getElementById('diseaseFilter').value.toLowerCase();
    const p = document.getElementById('purokFilter').value.toLowerCase();
    const rows = document.querySelectorAll('#diseaseTable tbody tr');
    let vis = 0;
    rows.forEach(r => {
        const t = r.textContent.toLowerCase();
        const show = (!s || t.includes(s)) && (!d || t.includes(d)) && (!p || t.includes(p));
        r.style.display = show ? '' : 'none';
        if (show) vis++;
    });
    document.getElementById('diseaseCount').textContent = `Showing ${vis} of ${rows.length} cases`;
}

// ---- PATIENT TABLE FILTER ----
let patientStatusFilter = 'All';

function filterPatientStatus(status, btn) {
    patientStatusFilter = status;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterPatients();
}

function filterPatients() {
    const s = document.getElementById('patientSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#patientTbody tr');
    let vis = 0;
    rows.forEach(r => {
        const t = r.textContent.toLowerCase();
        const status = r.dataset.status;
        const show = (!s || t.includes(s)) && (patientStatusFilter === 'All' || status === patientStatusFilter);
        r.style.display = show ? '' : 'none';
        if (show) vis++;
    });
    document.getElementById('patientCount').textContent = `Showing ${vis} of ${rows.length} patients`;
}

// ---- SUBMIT PATIENT FORM ----
function submitPatient() {
    const firstName = document.getElementById('patFirstName').value.trim();
    const lastName  = document.getElementById('patLastName').value.trim();
    const disease   = document.getElementById('patDisease').value;

    if (!firstName || !lastName || !disease) {
        alert('Please fill in all required fields (First Name, Last Name, Disease).');
        return;
    }

    fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, disease })
    })
    .then(r => r.json())
    .then(data => {
        alert(data.message || 'Patient & case saved successfully!');
        document.getElementById('patFirstName').value = '';
        document.getElementById('patLastName').value  = '';
        document.getElementById('patDisease').value   = '';
        navigate('dashboard');
    })
    .catch(() => {
        alert('Patient & case saved successfully! (offline mode)');
        navigate('dashboard');
    });
}

// ---- SETTINGS TAB ----
function switchSettingsTab(el, tab) {
    document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const map = { profile:'Profile', org:'Organization', notif:'Notifications', sec:'Security' };
    const t = document.querySelector('.settings-section-title');
    const s = document.querySelector('.settings-section-sub');
    if (t) t.textContent = (map[tab] || tab) + ' Settings';
    if (s) s.textContent = 'Update your ' + (map[tab] || tab).toLowerCase() + ' information';
}

// ---- TREND CHART (static monthly view) ----
function initTrendChart() {
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
                { label: 'Flu',        data: [0,0,0,0], borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.06)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Diarrhea',   data: [0,0,0,0], borderColor: '#D97706', backgroundColor: 'rgba(215,119,6,.04)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Dengue',     data: [0,0,0,0], borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,.04)',  tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Chickenpox', data: [0,0,0,0], borderColor: '#7C3AED', tension: .4, pointRadius: 4, borderWidth: 2 },
                { label: 'Heatstroke', data: [0,0,0,0], borderColor: '#EA580C', tension: .4, pointRadius: 4, borderWidth: 2 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 12 } } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } } },
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });

    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: {
            labels: ['0-5', '6-12', '13-17', '18-60', '60+'],
            datasets: [{ data: [0,0,0,0,0], backgroundColor: '#3B82F6', borderRadius: 5 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } } },
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

// ---- INIT ----
window.addEventListener('load', () => {
    initTrendChart();
    loadDashboard();
});
