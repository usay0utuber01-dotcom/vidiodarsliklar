import { darslar as defaultDarslar, testlar as defaultTestlar, biletlar as defaultBiletlar } from './database.js';
import { shifrlashVigenere, deshifrlashVigenere } from './cipher.js';

/**
 * ==========================================
 * FIREBASE CONFIGURATION
 * ==========================================
 */
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db;
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    // Improved Mock DB for Local Testing
    const getMockData = () => JSON.parse(localStorage.getItem('cyber_mock_db') || '{}');
    const saveMockData = (data) => localStorage.setItem('cyber_mock_db', JSON.stringify(data));

    db = {
        ref: (path) => ({
            on: (event, callback) => {
                const data = getMockData();
                const parts = path.split('/');
                let target = data;
                for (const p of parts) if (p) target = target[p] || {};
                callback({ val: () => (Object.keys(target).length === 0 ? null : target) });
            },
            set: (val) => {
                const data = getMockData();
                const parts = path.split('/');
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (parts[i]) {
                        if (!curr[parts[i]]) curr[parts[i]] = {};
                        curr = curr[parts[i]];
                    }
                }
                curr[parts[parts.length - 1]] = val;
                saveMockData(data);
                return Promise.resolve();
            },
            update: (val) => {
                const data = getMockData();
                const parts = path.split('/');
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (parts[i]) {
                        if (!curr[parts[i]]) curr[parts[i]] = {};
                        curr = curr[parts[i]];
                    }
                }
                const key = parts[parts.length - 1];
                curr[key] = { ...curr[key], ...val };
                saveMockData(data);
                return Promise.resolve();
            },
            remove: () => {
                const data = getMockData();
                const parts = path.split('/');
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (parts[i]) curr = curr[parts[i]];
                }
                delete curr[parts[parts.length - 1]];
                saveMockData(data);
                return Promise.resolve();
            },
            once: (event, callback) => {
                const data = getMockData();
                const parts = path.split('/');
                let target = data;
                for (const p of parts) if (p) target = target[p] || {};
                callback({ val: () => (Object.keys(target).length === 0 ? null : target) });
            }
        })
    };
} else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// State
let foydalanuvchi = JSON.parse(localStorage.getItem('cyber_user_session')) || null;
let isAdmin = localStorage.getItem('vd_admin') === 'true';
let joriyDars = null;
let joriyTestTuri = 'lesson'; 
let activeCompetition = null;

function init() {
    setupEventListeners();
    
    const savedAdmin = localStorage.getItem('vd_admin') === 'true';
    const savedPage = localStorage.getItem('cyber_active_page');

    if (savedAdmin) {
        isAdmin = true;
        showPage(savedPage || 'adminDashboardPage');
    } else if (foydalanuvchi) {
        syncUserSession();
        showPage(savedPage || 'dashboardPage');
    } else {
        showPage('loginPage');
    }
    
    // Listen for global competition status
    db.ref('competition').on('value', (snapshot) => {
        activeCompetition = snapshot.val();
        if (document.getElementById('compAuthPage').classList.contains('active')) renderCompAuthPage();
    });
}

window.addEventListener('DOMContentLoaded', init);

function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', login);
    document.getElementById('registerBtn')?.addEventListener('click', register);
    document.getElementById('adminLoginBtn')?.addEventListener('click', adminLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', (e) => showPage(e.currentTarget.getAttribute('data-page')));
    });
}

// Auth Tabs Switch
window.switchAuth = function(type) {
    document.getElementById('loginForm').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = type === 'register' ? 'block' : 'none';
    document.getElementById('tabLogin').classList.toggle('active', type === 'login');
    document.getElementById('tabRegister').classList.toggle('active', type === 'register');
}

// Register/Login
async function register() {
    const first = document.getElementById('regFirst').value.trim();
    const last = document.getElementById('regLast').value.trim();
    const code = document.getElementById('regCode').value.trim();
    if (!first || !last || code.length !== 4) return alert("Xatolik!");
    const userId = (first + "_" + last).toLowerCase().replace(/\s+/g, '');
    db.ref('users/' + userId).set({
        firstName: first, lastName: last, pin: code,
        stats: { correct: 0, incorrect: 0, progress: 0, ticketId: null, lastSeen: new Date().toLocaleString() }
    }).then(() => { alert("Ro'yxatdan o'tdingiz!"); switchAuth('login'); });
}

function login() {
    const first = document.getElementById('loginFirst').value.trim();
    const last = document.getElementById('loginLast').value.trim();
    const code = document.getElementById('loginCode').value.trim();
    const userId = (first + "_" + last).toLowerCase().replace(/\s+/g, '');
    db.ref('users/' + userId).once('value', (snapshot) => {
        const user = snapshot.val();
        if (user && user.pin === code) {
            foydalanuvchi = { id: userId, ...user };
            localStorage.setItem('cyber_user_session', JSON.stringify(foydalanuvchi));
            syncUserSession();
            showPage('dashboardPage');
        } else alert("Xato!");
    });
}

function syncUserSession() {
    if (!foydalanuvchi) return;
    db.ref('users/' + foydalanuvchi.id).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) { 
            foydalanuvchi = { id: foydalanuvchi.id, ...data }; 
            updateUI(); 
            // Update local storage too to keep it fresh
            localStorage.setItem('cyber_user_session', JSON.stringify(foydalanuvchi));
        }
    });
}

function updateUI() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.innerText = `XUSH KELIBSIZ, ${foydalanuvchi.firstName} ${foydalanuvchi.lastName}_`.toUpperCase();
}

// Page Navigation
function showPage(id) {
    if (id === 'adminDashboardPage' && !isAdmin) return showPage('adminLoginPage');
    
    // If admin is active and tries to go to student pages, redirect or handle accordingly
    if (isAdmin && (id === 'dashboardPage' || id === 'compAuthPage')) {
        // Stay in admin but show corresponding view
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('adminDashboardPage').classList.add('active');
        if (id === 'dashboardPage') toggleAdminView('modules');
        if (id === 'compAuthPage') toggleAdminView('leaderboard');
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        document.getElementById('navbar').style.display = (id === 'loginPage' || id === 'adminLoginPage') ? 'none' : 'flex';
        
        if (id === 'dashboardPage') renderDashboard();
        if (id === 'adminDashboardPage') {
            renderAdminDashboard();
            toggleAdminView('modules'); // Default view
        }
        if (id === 'compAuthPage') renderCompAuthPage();
        if (id === 'profilePage') renderProfile();
        
        localStorage.setItem('cyber_active_page', id);
        window.scrollTo(0, 0);
    }
}
window.showPage = showPage;

// Competition Logic
function renderCompAuthPage() {
    const noComp = document.getElementById('noCompBox');
    const joinComp = document.getElementById('joinCompBox');
    if (activeCompetition && activeCompetition.isActive) {
        noComp.style.display = 'none';
        joinComp.style.display = 'block';
    } else {
        noComp.style.display = 'block';
        joinComp.style.display = 'none';
    }
}

window.verifyCompCode = function() {
    const code = document.getElementById('compJoinCode').value.trim();
    if (code === activeCompetition.code) {
        if (!foydalanuvchi.stats.ticketId) return alert("Sizga hali bilet biriktirilmagan! Admindan so'rang.");
        startCompetition(foydalanuvchi.stats.ticketId);
    } else {
        alert("Noto'g'ri kod!");
    }
}

function startCompetition(id) {
    joriyTestTuri = 'competition';
    document.getElementById('compTicketDisplay').innerText = `BILET #${id}`;
    const container = document.getElementById('compTestContent');
    const questions = defaultBiletlar[id];
    let html = "";
    questions.forEach((q, i) => {
        let opts = "";
        q.a.forEach(opt => opts += `<label class="option-label"><input type="radio" name="cq${i}" value="${opt}"> ${opt}</label>`);
        html += `<div class="card" style="margin-bottom: 1.5rem;">
            <p style="font-weight: 700; margin-bottom: 1rem;">${i+1}. ${q.q}</p>
            <div class="test-options">${opts}</div>
        </div>`;
    });
    container.innerHTML = html;
    showPage('competitionTestPage');
}

window.submitCompTest = function() {
    const questions = defaultBiletlar[foydalanuvchi.stats.ticketId];
    let correct = 0, incorrect = 0;
    questions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="cq${i}"]:checked`);
        if (sel && sel.value === q.c) correct++; else incorrect++;
    });
    db.ref('users/' + foydalanuvchi.id + '/stats').update({
        correct: (foydalanuvchi.stats.correct || 0) + correct,
        incorrect: (foydalanuvchi.stats.incorrect || 0) + incorrect,
        lastSeen: new Date().toLocaleString()
    }).then(() => {
        alert("Natijangiz yuborildi!");
        showPage('dashboardPage');
    });
}

// Admin Competition Setup
window.openCompSetup = function() {
    document.getElementById('compSetupModal').style.display = 'flex';
}
window.closeCompSetup = function() {
    document.getElementById('compSetupModal').style.display = 'none';
}
window.startNewCompetition = function() {
    const code = document.getElementById('newCompCode').value.trim();
    if (code.length !== 4) return alert("4 xonali kod kiriting!");
    db.ref('competition').set({ isActive: true, code: code }).then(() => {
        alert("Bellashuv boshlandi!");
        closeCompSetup();
        toggleAdminView('leaderboard');
    });
}
window.stopCompetition = function() {
    if (confirm("Bellashuvni to'xtatmoqchimisiz?")) {
        db.ref('competition').update({ isActive: false }).then(() => {
            alert("Bellashuv to'xtatildi!");
            closeCompSetup();
        });
    }
}

// Other Admin functions
function adminLogin() {
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;
    if (u === 'xujaqulov01' && p === 'admin777') {
        isAdmin = true;
        localStorage.setItem('vd_admin', 'true');
        showPage('adminDashboardPage');
    } else alert("Xato!");
}

window.toggleAdminView = function(view) {
    document.querySelectorAll('.admin-view-section').forEach(s => s.style.display = 'none');
    if (view === 'modules') document.getElementById('adminModulesList').style.display = 'block';
    if (view === 'users') { document.getElementById('adminUsersList').style.display = 'block'; renderAdminUserStats(); }
    if (view === 'leaderboard') { document.getElementById('adminLeaderboard').style.display = 'block'; listenLeaderboard(); }
}

function renderAdminDashboard() {
    const list = document.getElementById('adminModulesList');
    let html = '<table class="admin-table"><thead><tr><th>MODUL NOMI</th><th>AMALLAR</th></tr></thead><tbody>';
    defaultDarslar.forEach((d) => {
        html += `<tr>
            <td style="font-weight: 600;">${d.t}</td>
            <td style="display: flex; gap: 0.5rem;">
                <button class="btn btn-outline" style="font-size: 0.7rem;" onclick="openTestManager(${d.id})">TESTLAR</button>
                <button class="btn btn-outline" style="font-size: 0.7rem; color: var(--secondary);" onclick="openModuleModal(${d.id})">TAHRIRLASH</button>
            </td>
        </tr>`;
    });
    list.innerHTML = html + '</tbody></table>';
}

// Module Management
window.openModuleModal = function(id = null) {
    const modal = document.getElementById('moduleModal');
    modal.style.display = 'flex';
    if (id) {
        const d = defaultDarslar.find(x => x.id === id);
        document.getElementById('editModuleId').value = id;
        document.getElementById('modTitle').value = d.t;
        document.getElementById('modVideo').value = d.v;
        document.getElementById('modDesc').value = d.description || "";
        document.getElementById('modalTitle').innerText = "DARS TAHRIRLASH";
    } else {
        document.getElementById('editModuleId').value = "";
        document.getElementById('modTitle').value = "";
        document.getElementById('modVideo').value = "";
        document.getElementById('modDesc').value = "";
        document.getElementById('modalTitle').innerText = "YANGI DARS QO'SHISH";
    }
}

window.closeModuleModal = function() {
    document.getElementById('moduleModal').style.display = 'none';
}

window.saveModule = function() {
    alert("Hozircha faqat ko'rish rejimi! Baza yangilash kodi qo'shilishi kerak.");
    closeModuleModal();
}

// Test Management
let joriyAdminModulId = null;
window.openTestManager = function(id) {
    joriyAdminModulId = id;
    const modal = document.getElementById('testManagerModal');
    modal.style.display = 'flex';
    renderAdminTests();
}

window.closeTestManager = function() {
    document.getElementById('testManagerModal').style.display = 'none';
}

function renderAdminTests() {
    const container = document.getElementById('questionsList');
    const questions = defaultTestlar[joriyAdminModulId] || [];
    container.innerHTML = "";
    questions.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = "card";
        div.style.marginBottom = "1.5rem";
        div.style.background = "rgba(255,255,255,0.02)";
        
        // Find which option matches the current correct answer
        let selectedIdx = q.a.indexOf(q.c);
        if (selectedIdx === -1) selectedIdx = 0; // Default to A if not found

        div.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <label style="font-size: 0.7rem; color: var(--gold); letter-spacing: 1px;">SAVOL MATNI:</label>
                <input type="text" class="input-field q-text" style="width: 100%; margin-top: 5px;" value="${q.q}" placeholder="Savolni kiriting...">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="font-size: 0.65rem; color: var(--text-dim);">VARIANT A:</label>
                    <input type="text" class="input-field q-opt" data-idx="0" value="${q.a[0] || ''}" placeholder="Variant A">
                </div>
                <div>
                    <label style="font-size: 0.65rem; color: var(--text-dim);">VARIANT B:</label>
                    <input type="text" class="input-field q-opt" data-idx="1" value="${q.a[1] || ''}" placeholder="Variant B">
                </div>
                <div>
                    <label style="font-size: 0.65rem; color: var(--text-dim);">VARIANT C:</label>
                    <input type="text" class="input-field q-opt" data-idx="2" value="${q.a[2] || ''}" placeholder="Variant C">
                </div>
                <div>
                    <label style="font-size: 0.65rem; color: var(--text-dim);">VARIANT D:</label>
                    <input type="text" class="input-field q-opt" data-idx="3" value="${q.a[3] || ''}" placeholder="Variant D">
                </div>
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="font-size: 0.7rem; color: #00ff41; letter-spacing: 1px;">TO'G'RI JAVOBNI TANLANG:</label>
                <select class="input-field q-ans-select" style="width: 100%; border-color: #00ff4133; margin-top: 5px;">
                    <option value="0" ${selectedIdx === 0 ? 'selected' : ''}>VARIANT A</option>
                    <option value="1" ${selectedIdx === 1 ? 'selected' : ''}>VARIANT B</option>
                    <option value="2" ${selectedIdx === 2 ? 'selected' : ''}>VARIANT C</option>
                    <option value="3" ${selectedIdx === 3 ? 'selected' : ''}>VARIANT D</option>
                </select>
            </div>
            <button class="btn btn-outline" style="color: var(--accent); border-color: var(--accent); font-size: 0.7rem; width: 100%;" onclick="removeQuestion(${i})">SAVOLNI O'CHIRISH</button>
        `;
        container.appendChild(div);
    });
}

window.addQuestion = function() {
    if (!defaultTestlar[joriyAdminModulId]) defaultTestlar[joriyAdminModulId] = [];
    defaultTestlar[joriyAdminModulId].push({ q: "", a: ["", "", "", ""], c: "" });
    renderAdminTests();
}

window.removeQuestion = function(i) {
    defaultTestlar[joriyAdminModulId].splice(i, 1);
    renderAdminTests();
}

window.saveTests = function() {
    const qBoxes = document.querySelectorAll('#questionsList .card');
    const newTests = [];
    qBoxes.forEach(box => {
        const q = box.querySelector('.q-text').value;
        const optsEls = box.querySelectorAll('.q-opt');
        const opts = Array.from(optsEls).map(i => i.value);
        const ansIdx = parseInt(box.querySelector('.q-ans-select').value);
        const ans = opts[ansIdx] || ""; // Get the value of the selected option
        
        newTests.push({ q, a: opts.filter(v => v !== ""), c: ans });
    });
    defaultTestlar[joriyAdminModulId] = newTests;
    alert("Testlar muvaffaqiyatli saqlandi! (Lokal sessiya uchun)");
    closeTestManager();
}

function renderAdminUserStats() {
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const body = document.getElementById('userStatsBody');
        body.innerHTML = "";
        Object.entries(users).forEach(([id, u]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${u.firstName} ${u.lastName}</strong></td><td>${u.stats.progress || 0}</td><td>T: ${u.stats.correct} | X: ${u.stats.incorrect}</td><td><button class="btn btn-outline" onclick="deleteUser('${id}')">O'CHIRISH</button></td>`;
            body.appendChild(tr);
        });
    });
}

function listenLeaderboard() {
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const body = document.getElementById('leaderboardBody');
        const sorted = Object.entries(users).sort((a,b) => (b[1].stats.correct||0) - (a[1].stats.correct||0));
        body.innerHTML = "";
        sorted.forEach(([id, u], i) => {
            const rank = i+1;
            body.innerHTML += `<tr><td>${rank}</td><td>${u.firstName} ${u.lastName}</td><td>${u.stats.ticketId || '-'}</td><td>${u.stats.correct}</td><td>${u.stats.incorrect}</td><td>${u.stats.lastSeen}</td></tr>`;
        });
    });
}

window.distributeTickets = function() {
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        const updates = {};
        Object.keys(users).forEach(id => updates[`users/${id}/stats/ticketId`] = Math.floor(Math.random()*20)+1);
        db.ref().update(updates).then(() => alert("Biletlar tarqatildi!"));
    });
}

window.exportToExcel = function() {
    const table = document.getElementById("leaderboardTableMain");
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Natijalar");
    XLSX.writeFile(wb, "Natijalar.xlsx");
}

window.clearLeaderboard = function() {
    if (confirm("Tozalaymizmi?")) {
        db.ref('users').once('value', (snapshot) => {
            const users = snapshot.val();
            const updates = {};
            Object.keys(users).forEach(id => {
                updates[`users/${id}/stats/correct`] = 0;
                updates[`users/${id}/stats/incorrect`] = 0;
                updates[`users/${id}/stats/ticketId`] = null;
            });
            db.ref().update(updates);
        });
    }
}

// Student Lesson Logic
window.startTest = function() {
    joriyTestTuri = 'lesson';
    const container = document.getElementById('testContent');
    const questions = defaultTestlar[joriyDars.id];
    let html = "";
    questions.forEach((q, i) => {
        let opts = "";
        q.a.forEach(opt => opts += `<label class="option-label"><input type="radio" name="q${i}" value="${opt}"> ${opt}</label>`);
        html += `<div class="card" style="margin-bottom: 1.5rem;"><p>${i+1}. ${q.q}</p><div class="test-options">${opts}</div></div>`;
    });
    container.innerHTML = html;
    showPage('testPage');
}

window.submitTest = function() {
    const questions = defaultTestlar[joriyDars.id];
    let correct = 0;
    questions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        if (sel && sel.value === q.c) correct++;
    });
    const percent = Math.round((correct/questions.length)*100);
    if (percent >= 60) {
        const idx = defaultDarslar.findIndex(d => d.id === joriyDars.id);
        db.ref('users/' + foydalanuvchi.id + '/stats').update({ progress: Math.max(foydalanuvchi.stats.progress, idx+1) });
    }
    renderResult(percent);
}

function renderResult(p) {
    document.getElementById('resultPercent').innerText = p + "%";
    document.getElementById('resultMsg').innerText = p >= 60 ? "Muvaffaqiyatli!" : "Yana urinib ko'ring";
    document.getElementById('resultActionBtn').innerText = "DAVOM ETISH";
    document.getElementById('resultActionBtn').onclick = () => showPage('dashboardPage');
    showPage('resultPage');
}

function renderDashboard() {
    const grid = document.getElementById('lessonGrid');
    grid.innerHTML = "";
    defaultDarslar.forEach((d, i) => {
        const isLocked = i > (foydalanuvchi.stats.progress || 0);
        const card = document.createElement('div');
        card.className = "lesson-card" + (isLocked ? " locked" : "");
        const vId = d.v.split('v=')[1] || d.v.split('/').pop();
        card.innerHTML = `${isLocked ? '🔒' : ''}<img src="https://img.youtube.com/vi/${vId}/hqdefault.jpg" class="lesson-thumb"><div class="lesson-content"><h3>${d.t}</h3><p>${d.description||""}</p></div>`;
        if (!isLocked) card.onclick = () => { joriyDars = d; showPage('lessonPage'); document.getElementById('lessonTitle').innerText = d.t; document.getElementById('lessonVideo').src = `https://www.youtube.com/embed/${vId}?autoplay=1`; };
        grid.appendChild(card);
    });
}

window.deleteUser = function(id) {
    if (confirm("Ushbu foydalanuvchini o'chirmoqchimisiz?")) {
        db.ref('users/' + id).remove().then(() => alert("O'chirildi!"));
    }
}

function logout() {
    localStorage.removeItem('cyber_user_session');
    localStorage.removeItem('vd_admin');
    localStorage.removeItem('cyber_active_page');
    isAdmin = false;
    location.reload();
}

function renderProfile() {
    const nameEl = document.getElementById('profileName');
    const roleEl = document.getElementById('profileRole');
    const statsEl = document.getElementById('studentStats');
    
    if (isAdmin) {
        nameEl.innerText = "XO'JAQULOV ANVAR";
        roleEl.innerText = "QDTU PROFESSOR O'QITUVCHISI";
        roleEl.style.background = "var(--secondary)";
        if (statsEl) statsEl.style.display = 'none';
        
        // Hide certificates for admin
        const certTitle = document.getElementById('profileCertTitle');
        const certGrid = document.getElementById('profileCertificates');
        if (certTitle) certTitle.style.display = 'none';
        if (certGrid) certGrid.style.display = 'none';
    } else {
        nameEl.innerText = `${foydalanuvchi.firstName} ${foydalanuvchi.lastName}`.toUpperCase();
        roleEl.innerText = "AKADEMIYA O'QUVCHISI";
        roleEl.style.background = "var(--primary)";
        
        const certTitle = document.getElementById('profileCertTitle');
        const certGrid = document.getElementById('profileCertificates');
        if (certTitle) certTitle.style.display = 'block';
        if (certGrid) certGrid.style.display = 'grid';

        if (statsEl) {
            statsEl.style.display = 'grid';
            document.getElementById('profileProgress').innerText = foydalanuvchi.stats.progress || 0;
            document.getElementById('profileCorrect').innerText = foydalanuvchi.stats.correct || 0;
        }
    }
}
