import { darslar as defaultDarslar, testlar as defaultTestlar, biletlar as defaultBiletlar } from './database.js';
import { shifrlashVigenere, deshifrlashVigenere } from './cipher.js';

/**
 * ==========================================
 * FIREBASE CONFIGURATION
 * ==========================================
 * O'zingizning Firebase loyihangiz ma'lumotlarini bu yerga qo'ying:
 * 1. Firebase Console (https://console.firebase.google.com/)
 * 2. Project Settings -> General -> Your Apps -> Web SDK configuration -> Config
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

// Mock Database if Config is missing (for local development only)
let db;
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("FIREBASE CONFIGURATION MISSING! Using Mock Storage.");
    db = {
        ref: (path) => ({
            on: (event, callback) => {
                const data = JSON.parse(localStorage.getItem('mock_db_' + path) || '{}');
                callback({ val: () => data });
            },
            set: (data) => localStorage.setItem('mock_db_' + path, JSON.stringify(data)),
            update: (data) => {
                const current = JSON.parse(localStorage.getItem('mock_db_' + path) || '{}');
                localStorage.setItem('mock_db_' + path, JSON.stringify({ ...current, ...data }));
            },
            remove: () => localStorage.removeItem('mock_db_' + path)
        })
    };
} else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// State Management
let foydalanuvchi = JSON.parse(localStorage.getItem('cyber_user_session')) || null;
let isAdmin = sessionStorage.getItem('vd_admin') === 'true';
let joriyDars = null;
let joriyTestTuri = 'lesson'; // 'lesson' or 'competition'

// UI Initialization
function init() {
    console.log("Cyber Academy Initializing...");
    setupEventListeners();
    
    if (foydalanuvchi) {
        syncUserSession();
    } else {
        showPage('loginPage');
    }
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

    // Cipher Page Listeners
    document.getElementById('encryptBtn')?.addEventListener('click', handleEncrypt);
    document.getElementById('decryptBtn')?.addEventListener('click', handleDecrypt);
    document.getElementById('clearCipherBtn')?.addEventListener('click', clearCipher);
    document.getElementById('copyCipherBtn')?.addEventListener('click', copyCipher);
}

// Authentication Logic
window.switchAuth = function(type) {
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabRegister');

    if (type === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

async function register() {
    const first = document.getElementById('regFirst').value.trim();
    const last = document.getElementById('regLast').value.trim();
    const code = document.getElementById('regCode').value.trim();

    if (!first || !last || code.length !== 4) return alert("Barcha maydonlarni to'ldiring (kod 4 xonali bo'lsin)!");

    const userId = (first + "_" + last).toLowerCase().replace(/\s+/g, '');
    
    db.ref('users/' + userId).set({
        firstName: first,
        lastName: last,
        pin: code,
        stats: {
            correct: 0,
            incorrect: 0,
            progress: 0,
            ticketId: null,
            lastSeen: new Date().toLocaleString()
        }
    }).then(() => {
        alert("Muvaffaqiyatli ro'yxatdan o'tdingiz! Endi tizimga kiring.");
        switchAuth('login');
    });
}

function login() {
    const first = document.getElementById('loginFirst').value.trim();
    const last = document.getElementById('loginLast').value.trim();
    const code = document.getElementById('loginCode').value.trim();

    if (!first || !last || !code) return alert("Ma'lumotlarni to'liq kiriting!");

    const userId = (first + "_" + last).toLowerCase().replace(/\s+/g, '');

    db.ref('users/' + userId).on('value', (snapshot) => {
        const user = snapshot.val();
        if (user && user.pin === code) {
            foydalanuvchi = { id: userId, ...user };
            localStorage.setItem('cyber_user_session', JSON.stringify(foydalanuvchi));
            syncUserSession();
        } else {
            alert("Ism, familiya yoki kod xato!");
        }
    }, { onlyOnce: true });
}

function syncUserSession() {
    db.ref('users/' + foydalanuvchi.id).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            foydalanuvchi = { id: foydalanuvchi.id, ...data };
            updateUI();
        }
    });
    showPage('dashboardPage');
}

function updateUI() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.innerText = `XUSH KELIBSIZ, ${foydalanuvchi.firstName} ${foydalanuvchi.lastName}_`.toUpperCase();
    
    // Check if user has an assigned ticket
    if (foydalanuvchi.stats.ticketId && joriyTestTuri !== 'competition') {
        notifyTicket(foydalanuvchi.stats.ticketId);
    }
}

function notifyTicket(id) {
    const existing = document.getElementById('ticketNotification');
    if (existing) return;

    const div = document.createElement('div');
    div.id = 'ticketNotification';
    div.className = 'card comp-card';
    div.style.marginBottom = '2rem';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="color: var(--gold);">SIZGA BELLASHUV BILETI BERILDI!</h3>
                <p>Bilet raqami: <span class="ticket-badge">#${id}</span></p>
            </div>
            <button class="btn btn-primary" onclick="startCompetition(${id})" style="background: var(--gold); color: #000;">BOSHLASH_</button>
        </div>
    `;
    document.getElementById('dashboardPage').prepend(div);
}

// Navigation
function showPage(id) {
    if (id === 'adminDashboardPage' && !isAdmin) return showPage('adminLoginPage');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        const navbar = document.getElementById('navbar');
        navbar.style.display = (id === 'loginPage' || id === 'adminLoginPage') ? 'none' : 'flex';
        
        if (id === 'dashboardPage') renderDashboard();
        if (id === 'adminDashboardPage') renderAdminDashboard();
        if (id === 'profilePage') renderProfile();
        
        window.scrollTo(0, 0);
    }
}
window.showPage = showPage;

// Admin Logic
function adminLogin() {
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;
    if (u === 'xujaqulov01' && p === 'admin777') {
        isAdmin = true;
        sessionStorage.setItem('vd_admin', 'true');
        showPage('adminDashboardPage');
    } else {
        alert("ACCESS DENIED");
    }
}

window.toggleAdminView = function(view) {
    document.querySelectorAll('.admin-view-section').forEach(s => s.style.display = 'none');
    if (view === 'modules') document.getElementById('adminModulesList').style.display = 'block';
    if (view === 'users') {
        document.getElementById('adminUsersList').style.display = 'block';
        renderAdminUserStats();
    }
    if (view === 'leaderboard') {
        document.getElementById('adminLeaderboard').style.display = 'block';
        listenLeaderboard();
    }
}

function renderAdminDashboard() {
    const list = document.getElementById('adminModulesList');
    let html = '<table class="admin-table"><thead><tr><th>MODUL NOMI</th><th>AMALLAR</th></tr></thead><tbody>';
    defaultDarslar.forEach((d, i) => {
        html += `<tr>
            <td style="font-weight: 600;">${d.t}</td>
            <td style="display: flex; gap: 0.5rem;">
                <button class="btn btn-outline" style="font-size: 0.7rem;" onclick="openTestManager(${d.id})">TESTLAR</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    list.innerHTML = html;
}

function renderAdminUserStats() {
    const body = document.getElementById('userStatsBody');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        body.innerHTML = "";
        Object.entries(users).forEach(([id, u]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${u.firstName} ${u.lastName}</strong><br><small>${u.stats.lastSeen}</small></td>
                <td>${u.stats.progress || 0}</td>
                <td>T: ${u.stats.correct || 0} | X: ${u.stats.incorrect || 0}</td>
                <td><button class="btn btn-outline" style="color: var(--accent); border-color: var(--accent); font-size: 0.7rem;" onclick="deleteUser('${id}')">O'CHIRISH</button></td>
            `;
            body.appendChild(tr);
        });
    });
}

window.deleteUser = function(id) {
    if (confirm("Ushbu foydalanuvchini o'chirmoqchimisiz?")) {
        db.ref('users/' + id).remove();
    }
}

// Competition Logic
window.distributeTickets = function() {
    if (!confirm("Barcha talabalarga biletlarni tasodifiy tarqatmoqchimisiz?")) return;

    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        const updates = {};
        Object.keys(users).forEach(id => {
            const randomTicket = Math.floor(Math.random() * 20) + 1;
            updates[`users/${id}/stats/ticketId`] = randomTicket;
        });
        db.ref().update(updates).then(() => alert("Biletlar tarqatildi!"));
    });
}

function listenLeaderboard() {
    const body = document.getElementById('leaderboardBody');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const sorted = Object.entries(users)
            .sort((a, b) => (b[1].stats.correct || 0) - (a[1].stats.correct || 0));
        
        body.innerHTML = "";
        sorted.forEach(([id, u], index) => {
            const tr = document.createElement('tr');
            const rank = index + 1;
            let rankHtml = rank;
            if (rank === 1) rankHtml = '<span class="rank-1"><span class="crown">👑</span>1</span>';
            else if (rank === 2) rankHtml = '<span class="rank-2">🥈 2</span>';
            else if (rank === 3) rankHtml = '<span class="rank-3">🥉 3</span>';

            tr.innerHTML = `
                <td>${rankHtml}</td>
                <td style="text-align: left;">${u.firstName} ${u.lastName}</td>
                <td><span class="ticket-badge">${u.stats.ticketId || '-'}</span></td>
                <td style="color: var(--primary); font-weight: bold;">${u.stats.correct || 0}</td>
                <td style="color: var(--accent);">${u.stats.incorrect || 0}</td>
                <td style="font-size: 0.7rem; color: #888;">${u.stats.lastSeen.split(',')[1] || u.stats.lastSeen}</td>
            `;
            body.appendChild(tr);
        });
    });
}

window.clearLeaderboard = function() {
    if (confirm("HAQIQATDAN HAM JADVALNI TOZALAYMIZMI? Barcha natijalar nolga tushadi!")) {
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

window.exportToExcel = function() {
    const table = document.getElementById("leaderboardTableMain");
    const rows = [];
    const headers = ["O'RIN", "F.I.SH", "BILET", "TO'G'RI", "XATO", "VAQT"];
    rows.push(headers);

    const trs = table.querySelectorAll('tbody tr');
    trs.forEach((tr, i) => {
        const tds = tr.querySelectorAll('td');
        const row = [
            i + 1,
            tds[1].innerText,
            tds[2].innerText,
            tds[3].innerText,
            tds[4].innerText,
            tds[5].innerText
        ];
        rows.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Natijalar");
    XLSX.writeFile(workbook, `Cyber_Academy_Natijalar_${new Date().toLocaleDateString()}.xlsx`);
}

// Student Test Logic
window.startCompetition = function(id) {
    joriyTestTuri = 'competition';
    const questions = defaultBiletlar[id];
    renderTest(questions);
    showPage('testPage');
}

window.startTest = function() {
    joriyTestTuri = 'lesson';
    const questions = defaultTestlar[joriyDars.id];
    renderTest(questions);
    showPage('testPage');
}

function renderTest(questions) {
    const container = document.getElementById('testContent');
    let html = "";
    questions.forEach((q, i) => {
        let opts = "";
        q.a.forEach(opt => {
            opts += `<label class="option-label"><input type="radio" name="q${i}" value="${opt}"> ${opt}</label>`;
        });
        html += `<div class="card" style="margin-bottom: 1.5rem; background: rgba(0,0,0,0.5);">
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">${i+1}. ${q.q}</p>
            <div class="test-options">${opts}</div>
        </div>`;
    });
    container.innerHTML = html;
}

window.submitTest = function() {
    const questions = (joriyTestTuri === 'competition') ? defaultBiletlar[foydalanuvchi.stats.ticketId] : defaultTestlar[joriyDars.id];
    let correct = 0;
    let incorrect = 0;

    questions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        if (sel && sel.value === q.c) correct++;
        else incorrect++;
    });

    const percent = Math.round((correct / questions.length) * 100);

    // Update Global Stats
    if (joriyTestTuri === 'competition') {
        db.ref('users/' + foydalanuvchi.id + '/stats').update({
            correct: (foydalanuvchi.stats.correct || 0) + correct,
            incorrect: (foydalanuvchi.stats.incorrect || 0) + incorrect,
            lastSeen: new Date().toLocaleString()
        });
    } else {
        // Handle lesson progress
        if (percent >= 60) {
            const currentIdx = defaultDarslar.findIndex(d => d.id === joriyDars.id);
            const newProg = Math.max(foydalanuvchi.stats.progress, currentIdx + 1);
            db.ref('users/' + foydalanuvchi.id + '/stats').update({ progress: newProg });
        }
    }

    renderResult(percent);
}

function renderResult(percent) {
    document.getElementById('resultPercent').innerText = percent + "%";
    const msg = document.getElementById('resultMsg');
    const btn = document.getElementById('resultActionBtn');

    if (percent >= 60) {
        msg.innerText = "Muvaffaqiyatli!";
        btn.innerText = "DAVOM ETISH";
        btn.onclick = () => showPage('dashboardPage');
    } else {
        msg.innerText = "Yana bir bor urinib ko'ring!";
        btn.innerText = "QAYTADAN BOSHLASH";
        btn.onclick = () => showPage('testPage');
    }
    showPage('resultPage');
}

// Dashboard rendering
function renderDashboard() {
    const grid = document.getElementById('lessonGrid');
    grid.innerHTML = "";
    defaultDarslar.forEach((d, i) => {
        const isLocked = i > (foydalanuvchi.stats.progress || 0);
        const card = document.createElement('div');
        card.className = "lesson-card" + (isLocked ? " locked" : "");
        const vId = getYoutubeID(d.v);
        card.innerHTML = `
            ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
            <img src="https://img.youtube.com/vi/${vId}/hqdefault.jpg" class="lesson-thumb">
            <div class="lesson-content">
                <h3 class="lesson-title">${d.t}</h3>
                <p class="lesson-desc">${d.description || ""}</p>
            </div>
        `;
        if (!isLocked) card.onclick = () => { joriyDars = d; showPage('lessonPage'); document.getElementById('lessonTitle').innerText = d.t; document.getElementById('lessonVideo').src = `https://www.youtube.com/embed/${vId}?autoplay=1`; };
        grid.appendChild(card);
    });
}

function getYoutubeID(url) {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : url.split('/').pop();
}

function logout() {
    localStorage.removeItem('cyber_user_session');
    location.reload();
}

// Cipher functions
function handleEncrypt() {
    const res = shifrlashVigenere(document.getElementById('cipherIn').value, document.getElementById('cipherKey').value);
    if (res.error) return alert(res.error);
    document.getElementById('cipherOut').value = res.natijaStr;
}
function handleDecrypt() {
    const res = deshifrlashVigenere(document.getElementById('cipherIn').value, document.getElementById('cipherKey').value);
    if (res.error) return alert(res.error);
    document.getElementById('cipherOut').value = res.natijaStr;
}
function clearCipher() {
    document.getElementById('cipherIn').value = "";
    document.getElementById('cipherKey').value = "";
    document.getElementById('cipherOut').value = "";
}
function copyCipher() {
    const out = document.getElementById('cipherOut');
    out.select();
    document.execCommand('copy');
    alert("Nusxalandi!");
}
