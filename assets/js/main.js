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
    const getMockData = () => {
        let data = JSON.parse(localStorage.getItem('cyber_mock_db') || '{}');
        if (Object.keys(data).length === 0) {
            data = {
                users: {
                    "ali_valiyev": { firstName: "Ali", lastName: "Valiyev", pin: "1111", stats: { correct: 15, incorrect: 2, progress: 5, ticketId: 1, lastSeen: "24.04.2026, 15:30" } },
                    "nozim_hakimov": { firstName: "Nozim", lastName: "Hakimov", pin: "2222", stats: { correct: 8, incorrect: 5, progress: 3, ticketId: 2, lastSeen: "24.04.2026, 15:45" } },
                    "dilshod_asqarov": { firstName: "Dilshod", lastName: "Asqarov", pin: "3333", stats: { correct: 20, incorrect: 0, progress: 10, ticketId: 3, lastSeen: "24.04.2026, 16:00" } }
                },
                competition: { isActive: false, code: "0000", isStarted: false }
            };
            localStorage.setItem('cyber_mock_db', JSON.stringify(data));
        }
        return data;
    };
    const saveMockData = (data) => localStorage.setItem('cyber_mock_db', JSON.stringify(data));
    const setDeepValue = (obj, path, value) => {
        const parts = path.split('/').filter(p => p);
        let curr = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = value;
    };
    db = {
        ref: (path = "") => ({
            on: (event, callback) => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
                callback({ val: () => (Object.keys(target).length === 0 ? null : target) });
            },
            set: (val) => {
                const data = getMockData();
                setDeepValue(data, path, val);
                saveMockData(data);
                return Promise.resolve();
            },
            update: (val) => {
                const data = getMockData();
                Object.entries(val).forEach(([k, v]) => {
                    const fullPath = path ? `${path}/${k}` : k;
                    setDeepValue(data, fullPath, v);
                });
                saveMockData(data);
                return Promise.resolve();
            },
            remove: () => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) curr = curr[parts[i]];
                delete curr[parts[parts.length - 1]];
                saveMockData(data);
                return Promise.resolve();
            },
            once: (event, callback) => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
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
let timerInterval = null;

const savedBilets = localStorage.getItem('cyber_bilets');
if (savedBilets) {
    try {
        const parsed = JSON.parse(savedBilets);
        Object.assign(defaultBiletlar, parsed);
    } catch(e) { console.error("Error loading bilets", e); }
}

function init() {
    setupEventListeners();
    const savedAdmin = localStorage.getItem('vd_admin') === 'true';
    const savedPage = localStorage.getItem('cyber_active_page');

    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        const badge = document.getElementById('demoBadge');
        if (badge) badge.style.display = 'inline-block';
    }

    if (savedAdmin) {
        isAdmin = true;
        showPage(savedPage || 'adminDashboardPage');
    } else if (foydalanuvchi) {
        syncUserSession();
        db.ref('users/' + foydalanuvchi.id + '/stats').update({ lastSeen: new Date().toLocaleString() });
        showPage(savedPage || 'dashboardPage');
    } else {
        showPage('loginPage');
    }
    
    db.ref('competition').on('value', (snapshot) => {
        activeCompetition = snapshot.val() || { isActive: false };
        updateCompetitionMenus();
        if (document.getElementById('compAuthPage').classList.contains('active')) renderCompAuthPage();
        if (activeCompetition && activeCompetition.isStarted && activeCompetition.startTime) startCountdown();
        else stopCountdown();
    });
}

function updateCompetitionMenus() {
    const isActive = activeCompetition && activeCompetition.isActive;
    const isStarted = activeCompetition && activeCompetition.isStarted;
    
    // Admin Buttons
    const leaderBtn = document.getElementById('leaderboardToggleBtn');
    if (leaderBtn) leaderBtn.style.display = isActive ? 'inline-block' : 'none';
    
    const distBtn = document.getElementById('distBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (distBtn) distBtn.style.display = (isActive && !isStarted) ? 'block' : 'none';
    if (startBtn) startBtn.style.display = (isActive && !isStarted) ? 'block' : 'none';
    if (stopBtn) stopBtn.style.display = isStarted ? 'block' : 'none';

    // Student Side Navbar
    const compNavItem = document.querySelector('.nav-item[data-page="compAuthPage"]');
    if (compNavItem) compNavItem.style.display = 'block';
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

window.switchAuth = function(type) {
    document.getElementById('loginForm').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = type === 'register' ? 'block' : 'none';
    document.getElementById('tabLogin').classList.toggle('active', type === 'login');
    document.getElementById('tabRegister').classList.toggle('active', type === 'register');
}

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
            db.ref('users/' + userId + '/stats').update({ lastSeen: new Date().toLocaleString() });
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
            localStorage.setItem('cyber_user_session', JSON.stringify(foydalanuvchi));
        }
    });
}

function updateUI() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome && foydalanuvchi) welcome.innerText = `XUSH KELIBSIZ, ${foydalanuvchi.firstName} ${foydalanuvchi.lastName}_`.toUpperCase();
}

function showPage(id) {
    if (id === 'adminDashboardPage' && !isAdmin) return showPage('adminLoginPage');
    if (isAdmin && (id === 'dashboardPage' || id === 'compAuthPage')) {
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
        if (id === 'adminDashboardPage') { renderAdminDashboard(); toggleAdminView('modules'); }
        if (id === 'compAuthPage') renderCompAuthPage();
        if (id === 'profilePage') renderProfile();
        localStorage.setItem('cyber_active_page', id);
        window.scrollTo(0, 0);
    }
}
window.showPage = showPage;

function logout() {
    localStorage.removeItem('cyber_user_session');
    localStorage.removeItem('vd_admin');
    localStorage.removeItem('cyber_active_page');
    foydalanuvchi = null;
    isAdmin = false;
    location.reload();
}

// Competition Logic
function renderCompAuthPage() {
    const noComp = document.getElementById('noCompBox');
    const joinComp = document.getElementById('joinCompBox');
    
    if (activeCompetition && activeCompetition.isActive) {
        noComp.style.display = 'none';
        joinComp.style.display = 'block';
        
        const hasJoined = foydalanuvchi.stats.isJoined === true;
        
        if (!hasJoined) {
            joinComp.innerHTML = `
                <div style="font-size: 5rem; margin-bottom: 2rem;">🎮</div>
                <h2 style="color: var(--primary); margin-bottom: 1rem; letter-spacing: 2px;">BELLASHUV TASHKIL ETILDI!</h2>
                <p style="margin-bottom: 2.5rem; color: var(--text-dim); line-height: 1.8;">
                    Intelektual bellashuvda qatnashish uchun "QATNASHISH" tugmasini bosing. <br>
                    Ism-familiyangiz admin jadvalida paydo bo'ladi.
                </p>
                <button class="btn btn-primary" onclick="joinCompetitionAction()" style="width: 100%; height: 60px; font-size: 1.1rem;">QATNASHISH_</button>
            `;
        } else {
            if (activeCompetition.isStarted) {
                joinComp.innerHTML = `
                    <div style="font-size: 5rem; margin-bottom: 2rem; animation: pulseIcon 2s infinite;">🔥</div>
                    <h2 style="color: var(--primary); letter-spacing: 2px;">BELLASHUV BOSHLANDI!</h2>
                    <p style="margin-bottom: 2rem; letter-spacing: 1px; color: var(--text-dim);">
                        Sizga biriktirilgan bilet raqami: <br>
                        <strong style="color: var(--gold); font-size: 2.5rem; display: block; margin-top: 10px;">${foydalanuvchi.stats.ticketId || '...'}</strong>
                    </p>
                    <button class="btn btn-primary" onclick="startCompetition(${foydalanuvchi.stats.ticketId})" style="width: 100%; height: 60px; font-size: 1.1rem; background: var(--gold); color: #000;">IMTIHONNI BOSHLASH_</button>
                `;
            } else {
                joinComp.innerHTML = `
                    <div style="font-size: 5rem; margin-bottom: 2rem;">🤝</div>
                    <h2 style="color: var(--secondary); letter-spacing: 2px;">SIZ RO'YXATDASIZ</h2>
                    <p style="color: var(--text-dim); margin-bottom: 2.5rem; line-height: 1.8;">
                        Siz muvaffaqiyatli ro'yxatdan o'tdingiz. <br>
                        Hozirda ustoz biletlarni tarqatmoqda...
                    </p>
                    <div class="loader-line"></div>
                    <p style="font-size: 0.8rem; color: var(--gold); margin-top: 1.5rem; letter-spacing: 3px; font-weight: 800;">TAYYOR TURING...</p>
                `;
            }
        }
    } else {
        noComp.style.display = 'block';
        joinComp.style.display = 'none';
    }
}

window.joinCompetitionAction = function() {
    db.ref('users/' + foydalanuvchi.id + '/stats').update({ isJoined: true, lastSeen: new Date().toLocaleString() }).then(() => {
        alert("Siz muvaffaqiyatli qo'shildingiz!");
        renderCompAuthPage();
    });
}

function startCompetition(id) {
    if(!id || id === 'BIRIKTIRILMAGAN') return alert("Sizga bilet biriktirilmagan!");
    joriyTestTuri = 'competition';
    document.getElementById('compTicketDisplay').innerText = `BILET #${id}`;
    
    const container = document.getElementById('compTestContent');
    const questions = defaultBiletlar[id];
    
    // Initialize session answers if not exists
    if (!foydalanuvchi.stats.answers) foydalanuvchi.stats.answers = {};
    
    let html = "";
    questions.forEach((q, i) => {
        const userAns = foydalanuvchi.stats.answers[i];
        const isSolved = userAns !== undefined;
        const isCorrect = isSolved && userAns === q.c;
        
        let statusClass = "pending";
        let statusIcon = "⏳";
        if (isSolved) {
            statusClass = isCorrect ? "solved" : "failed";
            statusIcon = isCorrect ? "✅" : "❌";
        }

        let opts = "";
        q.a.forEach(opt => {
            const checked = userAns === opt ? "checked" : "";
            const disabled = isSolved ? "disabled" : "";
            opts += `<label class="option-label ${isSolved ? 'locked' : ''}"><input type="radio" name="cq${i}" value="${opt}" ${checked} ${disabled} onchange="answerCompQuestion(${i}, this.value)"> ${opt}</label>`;
        });

        html += `
            <div class="q-card-premium ${statusClass}" id="q_card_${i}">
                <div class="q-header">
                    <span class="q-num">SAVOL #${i+1}</span>
                    <span class="q-status-icon" id="q_icon_${i}">${statusIcon}</span>
                </div>
                <p class="q-text">${q.q}</p>
                <div class="test-options">
                    ${opts}
                </div>
                <div id="status_msg_${i}" style="font-size: 0.8rem; font-weight: 700; color: ${isCorrect ? '#2ecc71' : 'var(--accent)'}; margin-top: 0.5rem;">
                    ${isSolved ? (isCorrect ? "TO'G'RI JAVOB! ✅" : `XATO! TO'G'RI JAVOB: ${q.c} ❌`) : ""}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    showPage('competitionTestPage');
}

window.answerCompQuestion = function(qIdx, val) {
    const ticketId = foydalanuvchi.stats.ticketId;
    const questions = defaultBiletlar[ticketId];
    const q = questions[qIdx];
    const isCorrect = val === q.c;
    
    // Immediate UI Feedback
    const card = document.getElementById(`q_card_${qIdx}`);
    const icon = document.getElementById(`q_icon_${qIdx}`);
    const msg = document.getElementById(`status_msg_${qIdx}`);
    
    card.classList.remove('pending');
    card.classList.add(isCorrect ? 'solved' : 'failed');
    icon.innerText = isCorrect ? "✅" : "❌";
    msg.innerText = isCorrect ? "TO'G'RI JAVOB! ✅" : `XATO! TO'G'RI JAVOB: ${q.c} ❌`;
    msg.style.color = isCorrect ? "#2ecc71" : "var(--accent)";
    
    // Disable inputs
    document.querySelectorAll(`input[name="cq${qIdx}"]`).forEach(inp => {
        inp.disabled = true;
        inp.parentElement.classList.add('locked');
    });

    // Update Firebase and Local Session
    const answers = foydalanuvchi.stats.answers || {};
    answers[qIdx] = val;
    
    db.ref('users/' + foydalanuvchi.id + '/stats').update({
        correct: (foydalanuvchi.stats.correct || 0) + (isCorrect ? 1 : 0),
        incorrect: (foydalanuvchi.stats.incorrect || 0) + (isCorrect ? 0 : 1),
        answers: answers,
        lastSeen: new Date().toLocaleString()
    });
}

// Admin Logic
window.startNewCompetitionAction = function() {
    if (confirm("Kodsiz yangi bellashuv tashkil qilinsinmi?")) {
        db.ref('competition').set({ isActive: true, isStarted: false }).then(() => {
            alert("Bellashuv yaratildi! Endi o'quvchilar qo'shilishini kuting.");
            toggleAdminView('leaderboard');
        });
    }
}

window.startExamAction = function() {
    const startTime = Date.now();
    db.ref('competition').update({ isStarted: true, startTime: startTime, duration: 30 * 60 * 1000 }).then(() => {
        alert("Bellashuv BOSHLANDI!");
    });
}

window.stopCompetition = function() {
    if (confirm("Bellashuvni to'xtatmoqchimisiz?")) {
        db.ref('competition').set({ isActive: false, isStarted: false }).then(() => {
            alert("Bellashuv to'xtatildi!");
            toggleAdminView('modules');
        });
    }
}

function startCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const updateTimerUI = () => {
        const now = Date.now();
        const start = activeCompetition.startTime;
        const diff = (start + (activeCompetition.duration || 1800000)) - now;
        if (diff <= 0) {
            if (document.getElementById('studentTimer')) document.getElementById('studentTimer').innerText = "00:00";
            if (document.getElementById('adminTimer')) document.getElementById('adminTimer').innerText = "00:00";
            clearInterval(timerInterval);
            if (joriyTestTuri === 'competition') showPage('dashboardPage');
            return;
        }
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (document.getElementById('studentTimer')) document.getElementById('studentTimer').innerText = timeStr;
        const adminT = document.getElementById('adminTimer');
        if (adminT) { adminT.innerText = timeStr; adminT.style.display = 'block'; }
    };
    updateTimerUI();
    timerInterval = setInterval(updateTimerUI, 1000);
}

function stopCountdown() { if (timerInterval) clearInterval(timerInterval); const adminT = document.getElementById('adminTimer'); if (adminT) adminT.style.display = 'none'; }

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
        html += `<tr><td style="font-weight: 600;">${d.t}</td><td style="display: flex; gap: 0.5rem;"><button class="btn btn-outline" style="font-size: 0.7rem;" onclick="openTestManager(${d.id})">TESTLAR</button></td></tr>`;
    });
    list.innerHTML = html + '</tbody></table>';
}

function renderAdminUserStats() {
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const body = document.getElementById('userStatsBody');
        body.innerHTML = "";
        Object.entries(users).forEach(([id, u]) => {
            const tr = document.createElement('tr');
            const progress = u.stats.progress || 0;
            const currentLesson = defaultDarslar[progress] ? defaultDarslar[progress].t : "TUGATILDI";
            tr.innerHTML = `<td><strong>${u.firstName} ${u.lastName}</strong></td><td style="color: var(--secondary);">${currentLesson}</td><td>T: ${u.stats.correct} | X: ${u.stats.incorrect}</td><td style="text-align: center;"><button class="btn btn-outline" style="border-color: var(--accent); color: var(--accent); font-size: 0.7rem;" onclick="deleteUser('${id}')">O'CHIRISH</button></td>`;
            body.appendChild(tr);
        });
    });
}

window.deleteUser = function(id) { if(confirm("Foydalanuvchini o'chirmoqchimisiz?")) { db.ref('users/' + id).remove().then(() => alert("Foydalanuvchi o'chirildi!")); } }

function listenLeaderboard() {
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const body = document.getElementById('leaderboardBody');
        body.innerHTML = "";
        const joinedUsers = Object.entries(users).filter(([id, u]) => u.stats.isJoined === true);
        joinedUsers.sort((a,b) => (b[1].stats.correct||0) - (a[1].stats.correct||0));
        joinedUsers.forEach(([id, u], i) => {
            const ticket = u.stats.ticketId ? `<span style="color: var(--gold); font-weight: 800;">BILET #${u.stats.ticketId}</span>` : '<span style="color: #666;">BIRIKTIRILMAGAN</span>';
            body.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding: 1.5rem; text-align: center;">${i+1}</td><td style="padding: 1.5rem; font-weight: 700;">${u.firstName} ${u.lastName}</td><td style="padding: 1.5rem; text-align: center;">${ticket}</td><td style="padding: 1.5rem; text-align: center; color: #2ecc71;">${u.stats.correct || 0}</td><td style="padding: 1.5rem; text-align: center; color: var(--accent);">${u.stats.incorrect || 0}</td><td style="padding: 1.5rem; text-align: center; font-size: 0.8rem; color: #888;">${u.stats.lastSeen}</td></tr>`;
        });
    });
}

window.distributeTickets = function() {
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        const joinedUsers = Object.keys(users).filter(id => users[id].stats.isJoined === true);
        if (joinedUsers.length === 0) return alert("Hali hech kim qo'shilmadi!");
        const biletIds = Object.keys(defaultBiletlar);
        const updates = {};
        joinedUsers.forEach(id => {
            const rId = biletIds[Math.floor(Math.random() * biletIds.length)];
            updates[`users/${id}/stats/ticketId`] = rId;
        });
        db.ref().update(updates).then(() => { alert("Biletlar tarqatildi!"); });
    });
}

window.openBiletManager = function() { document.getElementById('biletManagerModal').style.display = 'flex'; renderAdminBilets(); }
window.closeBiletManager = function() { document.getElementById('biletManagerModal').style.display = 'none'; }
function renderAdminBilets() {
    const container = document.getElementById('biletsList');
    container.innerHTML = "";
    Object.entries(defaultBiletlar).forEach(([id, qs]) => {
        const card = document.createElement('div');
        card.className = "card"; card.style.background = "rgba(0,0,0,0.3)";
        let h = ""; qs.forEach((q, i) => h += `<div style="padding:0.5rem;"><input type="text" class="input-field b-q-text" data-bid="${id}" data-qidx="${i}" value="${q.q}" style="width:100%;"></div>`);
        card.innerHTML = `<h4>BILET #${id}</h4>${h}`; container.appendChild(card);
    });
}
window.saveBilets = function() {
    const newB = {};
    Object.keys(defaultBiletlar).forEach(bid => {
        newB[bid] = [];
        document.querySelectorAll(`.b-q-text[data-bid="${bid}"]`).forEach((el, i) => { newB[bid].push({ q: el.value, a: defaultBiletlar[bid][i].a, c: defaultBiletlar[bid][i].c }); });
    });
    Object.assign(defaultBiletlar, newB); localStorage.setItem('cyber_bilets', JSON.stringify(defaultBiletlar)); alert("Saqlandi!"); closeBiletManager();
}
window.exportToExcel = function() { const table = document.getElementById("leaderboardTableMain"); const ws = XLSX.utils.table_to_sheet(table); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Natijalar"); XLSX.writeFile(wb, "Natijalar.xlsx"); }

function renderProfile() {
    document.getElementById('profileName').innerText = `${foydalanuvchi.firstName} ${foydalanuvchi.lastName}`;
    document.getElementById('profileRole').innerText = foydalanuvchi.stats.ticketId ? `BILET #${foydalanuvchi.stats.ticketId}` : "TALABA";
    document.getElementById('profileProgress').innerText = foydalanuvchi.stats.progress;
    document.getElementById('profileCorrect').innerText = foydalanuvchi.stats.correct;
}

function renderDashboard() {
    const grid = document.getElementById('lessonGrid');
    grid.innerHTML = "";
    defaultDarslar.forEach((d, i) => {
        const isLocked = i > (foydalanuvchi.stats.progress || 0);
        const card = document.createElement('div');
        card.className = `lesson-card ${isLocked ? 'locked' : ''}`;
        let ytId = "";
        if (d.v.includes('embed/')) ytId = d.v.split('embed/')[1].split('?')[0];
        else if (d.v.includes('v=')) ytId = d.v.split('v=')[1].split('&')[0];
        else if (d.v.includes('youtu.be/')) ytId = d.v.split('youtu.be/')[1].split('?')[0];
        const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : 'assets/img/video-placeholder.jpg';
        card.innerHTML = `<div class="lesson-thumb" style="background-image: url('${thumbUrl}')">${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}</div><div class="lesson-info"><h3>${d.t}</h3><p class="status">${isLocked ? 'Qulflangan' : '✅ Ochiq'}</p></div>`;
        if (!isLocked) card.onclick = () => { 
            joriyDars = d; 
            showPage('lessonPage'); 
            document.getElementById('lessonTitle').innerText = d.t; 
            document.getElementById('lessonVideo').src = d.v; 
            document.getElementById('lessonExamBtn').style.display = 'block';
        };
        grid.appendChild(card);
    });
}

window.startLessonTest = function() {
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
        const currentIdx = defaultDarslar.findIndex(d => d.id === joriyDars.id);
        db.ref('users/' + foydalanuvchi.id + '/stats').update({ progress: Math.max(foydalanuvchi.stats.progress || 0, currentIdx + 1) });
    }
    renderResult(percent);
}

function renderResult(p) {
    document.getElementById('resultPercent').innerText = p + "%";
    document.getElementById('resultMsg').innerText = p >= 60 ? "Muvaffaqiyatli! Keyingi dars ochildi." : "Yana urinib ko'ring (Kamida 60% kerak)";
    document.getElementById('resultActionBtn').innerText = "DAVOM ETISH";
    document.getElementById('resultActionBtn').onclick = () => showPage('dashboardPage');
    showPage('resultPage');
}
