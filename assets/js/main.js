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
    const getMockData = () => {
        let data = JSON.parse(localStorage.getItem('cyber_mock_db') || '{}');
        if (Object.keys(data).length === 0) {
            // Initial Sample Data
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
let timerInterval = null;

// Load persisted bilets if they exist
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
        // Update last seen to show user is active
        db.ref('users/' + foydalanuvchi.id + '/stats').update({ lastSeen: new Date().toLocaleString() });
        showPage(savedPage || 'dashboardPage');
    } else {
        showPage('loginPage');
    }
    
    // Listen for global competition status
    db.ref('competition').on('value', (snapshot) => {
        activeCompetition = snapshot.val() || { isActive: false };
        updateCompetitionMenus();
        if (document.getElementById('compAuthPage').classList.contains('active')) renderCompAuthPage();
        
        // Timer Logic
        if (activeCompetition && activeCompetition.isStarted && activeCompetition.startTime) {
            startCountdown();
        } else {
            stopCountdown();
        }
    });
}

function updateCompetitionMenus() {
    const isActive = activeCompetition && activeCompetition.isActive;
    
    // Admin Side
    const leaderBtn = document.querySelector('button[onclick="toggleAdminView(\'leaderboard\')"]');
    if (leaderBtn) leaderBtn.style.display = isActive ? 'inline-block' : 'none';
    
    // Student Side Navbar
    const compNavItem = document.querySelector('.nav-item[data-page="compAuthPage"]');
    if (compNavItem) compNavItem.style.display = isActive ? 'block' : 'none';
    
    // If we are currently on the leaderboard but it's now inactive, switch back to modules
    if (!isActive && isAdmin && document.getElementById('adminLeaderboard').style.display === 'block') {
        toggleAdminView('modules');
    }
    
    // If student is on compAuthPage but it's now inactive, go to dashboard
    if (!isActive && !isAdmin && document.getElementById('compAuthPage').classList.contains('active')) {
        showPage('dashboardPage');
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
            // Update last seen
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

// Page Navigation
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
        if (id === 'adminDashboardPage') {
            renderAdminDashboard();
            toggleAdminView('modules');
        }
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
let isCompVerified = false;

function renderCompAuthPage() {
    const noComp = document.getElementById('noCompBox');
    const joinComp = document.getElementById('joinCompBox');
    
    if (activeCompetition && activeCompetition.isActive) {
        noComp.style.display = 'none';
        joinComp.style.display = 'block';
        
        if (!isCompVerified) {
            joinComp.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 1.5rem;">🔑</div>
                <h3 style="color: var(--primary); margin-bottom: 1rem;">BELLASHUV KODI</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-dim);">Davom etish uchun admin tomonidan berilgan 4 xonali kodni kiriting:</p>
                <input type="password" id="compJoinCode" class="old-input" placeholder="XXXX" maxlength="4" style="text-align: center; font-size: 2rem; letter-spacing: 10px; margin-bottom: 1.5rem;">
                <button class="btn btn-primary" onclick="verifyCompCode()" style="width: 100%;">KODNI TASDIQLASH_</button>
            `;
        } else {
            if (activeCompetition.isStarted) {
                joinComp.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔥</div>
                    <h3 style="color: var(--primary);">BELLASHUV BOSHLANDI!</h3>
                    <p style="margin-bottom: 1.5rem; letter-spacing: 1px;">Sizga biriktirilgan bilet: <strong style="color: var(--gold); font-size: 1.2rem;">${foydalanuvchi.stats.ticketId || 'BIRIKTIRILMAGAN'}</strong></p>
                    <button class="btn btn-primary" onclick="startCompetition(${foydalanuvchi.stats.ticketId})" style="width: 100%; background: var(--gold); color: #000; font-weight: 800;">IMTIHONNI BOSHLASH_</button>
                `;
            } else {
                joinComp.innerHTML = `
                    <div style="font-size: 4rem; margin-bottom: 1.5rem;">⌛</div>
                    <h3 style="color: var(--secondary);">TASDIQLANDI</h3>
                    <p style="color: var(--text-dim); margin-bottom: 1rem;">Siz bellashuvga muvaffaqiyatli kirdingiz.</p>
                    <div class="loader-line"></div>
                    <p style="font-size: 0.8rem; color: var(--gold); margin-top: 1rem; letter-spacing: 2px;">ADMIN START BERISHINI KUTING...</p>
                `;
            }
        }
    } else {
        noComp.style.display = 'block';
        joinComp.style.display = 'none';
        isCompVerified = false; // Reset on close
    }
}

window.verifyCompCode = function() {
    const code = document.getElementById('compJoinCode').value.trim();
    if (code === activeCompetition.code) {
        if (!foydalanuvchi.stats.ticketId) return alert("Sizga hali bilet biriktirilmagan! Admindan so'rang.");
        isCompVerified = true;
        renderCompAuthPage();
    } else {
        alert("Noto'g'ri kod!");
    }
}

function startCompetition(id) {
    if(!id || id === 'BIRIKTIRILMAGAN') return alert("Sizga bilet biriktirilmagan!");
    joriyTestTuri = 'competition';
    document.getElementById('compTicketDisplay').innerText = `BILET #${id}`;
    const container = document.getElementById('compTestContent');
    const questions = defaultBiletlar[id];
    let html = "";
    questions.forEach((q, i) => {
        let opts = "";
        q.a.forEach(opt => opts += `<label class="option-label"><input type="radio" name="cq${i}" value="${opt}" onchange="answerCompQuestion(${i}, this.value)"> ${opt}</label>`);
        html += `<div class="card" style="margin-bottom: 1.5rem;">
            <p style="font-weight: 700; margin-bottom: 1rem;">${i+1}. ${q.q}</p>
            <div class="test-options">${opts}</div>
            <div id="status_cq${i}" style="margin-top: 0.5rem; font-size: 0.8rem; font-weight: 700;"></div>
        </div>`;
    });
    container.innerHTML = html;
    showPage('competitionTestPage');
}

window.answeredQuestions = {}; 

window.answerCompQuestion = function(qIdx, val) {
    if (window.answeredQuestions[qIdx]) return; 
    
    const questions = defaultBiletlar[foydalanuvchi.stats.ticketId];
    const q = questions[qIdx];
    const isCorrect = val === q.c;
    
    window.answeredQuestions[qIdx] = true;
    document.querySelectorAll(`input[name="cq${qIdx}"]`).forEach(inp => inp.disabled = true);
    
    const statusEl = document.getElementById(`status_cq${qIdx}`);
    if (isCorrect) {
        statusEl.innerText = "TO'G'RI! ✅";
        statusEl.style.color = "#2ecc71";
    } else {
        statusEl.innerText = `XATO! ❌ (To'g'ri javob: ${q.c})`;
        statusEl.style.color = "#e74c3c";
    }

    db.ref('users/' + foydalanuvchi.id + '/stats').update({
        correct: (foydalanuvchi.stats.correct || 0) + (isCorrect ? 1 : 0),
        incorrect: (foydalanuvchi.stats.incorrect || 0) + (isCorrect ? 0 : 1),
        lastSeen: new Date().toLocaleString()
    });
}

window.submitCompTest = function() {
    alert("Barcha javoblaringiz saqlandi!");
    showPage('dashboardPage');
}

// Admin Logic
window.openCompSetup = function() {
    document.getElementById('compSetupModal').style.display = 'flex';
    renderCompSetupButtons();
}

window.closeCompSetup = function() {
    document.getElementById('compSetupModal').style.display = 'none';
}

window.startNewCompetition = function() {
    const code = document.getElementById('newCompCode').value.trim();
    if (code.length !== 4) return alert("4 xonali kod kiriting!");
    db.ref('competition').set({ isActive: true, code: code, isStarted: false }).then(() => {
        alert("Bellashuv yaratildi! Endi 'START' tugmasini bosing.");
        renderCompSetupButtons();
    });
}

window.startExamAction = function() {
    const startTime = Date.now();
    db.ref('competition').update({ isStarted: true, startTime: startTime, duration: 30 * 60 * 1000 }).then(() => {
        alert("Bellashuv BOSHLANDI! Talabalar savollarni ko'rishlari mumkin.");
        closeCompSetup();
    });
}

function startCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const updateTimerUI = () => {
        const now = Date.now();
        const start = activeCompetition.startTime;
        const duration = activeCompetition.duration || (30 * 60 * 1000);
        const diff = (start + duration) - now;
        
        if (diff <= 0) {
            const timeStr = "00:00";
            if (document.getElementById('studentTimer')) document.getElementById('studentTimer').innerText = timeStr;
            if (document.getElementById('adminTimer')) document.getElementById('adminTimer').innerText = timeStr;
            clearInterval(timerInterval);
            if (joriyTestTuri === 'competition') {
                alert("Vaqt tugadi! Test avtomatik yopiladi.");
                showPage('dashboardPage');
            }
            return;
        }
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (document.getElementById('studentTimer')) document.getElementById('studentTimer').innerText = timeStr;
        const adminT = document.getElementById('adminTimer');
        const adminMsg = document.getElementById('adminTimerMsg');
        if (adminT) {
            adminT.innerText = timeStr;
            adminT.style.display = 'inline-block';
            if (adminMsg) adminMsg.style.display = 'none';
        }
    };
    updateTimerUI();
    timerInterval = setInterval(updateTimerUI, 1000);
}

function stopCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const adminT = document.getElementById('adminTimer');
    const adminMsg = document.getElementById('adminTimerMsg');
    if (adminT) adminT.style.display = 'none';
    if (adminMsg) adminMsg.style.display = 'block';
}

function renderCompSetupButtons() {
    const container = document.querySelector('#compSetupModal div div:last-child');
    if (activeCompetition && activeCompetition.isActive) {
        container.innerHTML = `
            <button class="btn btn-primary" onclick="startExamAction()" style="background: #2ecc71;">START (TALABALARGA YUBORISH)_</button>
            <button class="btn btn-outline" onclick="stopCompetition()" style="border-color: var(--accent); color: var(--accent);">BELLASHUVNI YOPISH_</button>
            <button class="btn btn-outline" style="border:none;" onclick="closeCompSetup()">BEKOR QILISH</button>
        `;
    }
}

window.stopCompetition = function() {
    if (confirm("Bellashuvni to'xtatmoqchimisiz?")) {
        db.ref('competition').set({ isActive: false, isStarted: false }).then(() => {
            alert("Bellashuv to'xtatildi!");
            closeCompSetup();
        });
    }
}

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
        html += `<tr><td style="font-weight: 600;">${d.t}</td><td style="display: flex; gap: 0.5rem;"><button class="btn btn-outline" style="font-size: 0.7rem;" onclick="openTestManager(${d.id})">TESTLAR</button><button class="btn btn-outline" style="font-size: 0.7rem; color: var(--secondary);" onclick="openModuleModal(${d.id})">TAHRIRLASH</button></td></tr>`;
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
            tr.innerHTML = `<td><strong>${u.firstName} ${u.lastName}</strong></td><td style="color: var(--primary); font-weight: 700;">${u.stats.ticketId || '-'}</td><td>${u.stats.progress || 0}</td><td>T: ${u.stats.correct} | X: ${u.stats.incorrect}</td><td style="text-align: center;"><button class="btn btn-outline" style="border-color: var(--accent); color: var(--accent); font-size: 0.7rem;" onclick="deleteUser('${id}')">O'CHIRISH</button></td>`;
            body.appendChild(tr);
        });
    });
}

window.deleteUser = function(id) {
    if(confirm("Foydalanuvchini o'chirmoqchimisiz?")) {
        db.ref('users/' + id).remove().then(() => alert("Foydalanuvchi o'chirildi!"));
    }
}

function listenLeaderboard() {
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const body = document.getElementById('leaderboardBody');
        const sorted = Object.entries(users).sort((a,b) => (b[1].stats.correct||0) - (a[1].stats.correct||0));
        body.innerHTML = "";
        sorted.forEach(([id, u], i) => {
            body.innerHTML += `<tr><td>${i+1}</td><td>${u.firstName} ${u.lastName}</td><td>${u.stats.ticketId || '-'}</td><td>${u.stats.correct}</td><td>${u.stats.incorrect}</td><td>${u.stats.lastSeen}</td></tr>`;
        });
    });
}

window.distributeTickets = function() {
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        const updates = {};
        const biletIds = Object.keys(defaultBiletlar);
        if (biletIds.length === 0) return alert("Hali biletlar yaratilmagan!");
        Object.keys(users).forEach(id => {
            const randomBiletId = biletIds[Math.floor(Math.random() * biletIds.length)];
            updates[`users/${id}/stats/ticketId`] = randomBiletId;
        });
        db.ref().update(updates).then(() => alert("Biletlar tarqatildi!"));
    });
}

// Bilet Manager
window.openBiletManager = function() { document.getElementById('biletManagerModal').style.display = 'flex'; renderAdminBilets(); }
window.closeBiletManager = function() { document.getElementById('biletManagerModal').style.display = 'none'; }

function renderAdminBilets() {
    const container = document.getElementById('biletsList');
    container.innerHTML = "";
    Object.entries(defaultBiletlar).forEach(([id, questions]) => {
        const biletCard = document.createElement('div');
        biletCard.className = "card";
        biletCard.style.background = "rgba(0,0,0,0.3)";
        let qsHtml = "";
        questions.forEach((q, qIdx) => {
            qsHtml += `<div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="input-field b-q-text" data-bid="${id}" data-qidx="${qIdx}" value="${q.q}" placeholder="Savol..." style="width: 80%;"> <button onclick="removeQuestionFromBilet('${id}', ${qIdx})">&times;</button></div>`;
        });
        biletCard.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem;"><h4>BILET #${id}</h4><div><button onclick="addQuestionToBilet('${id}')">+</button> <button onclick="removeBilet('${id}')">O'CHIRISH</button></div></div>${qsHtml}`;
        container.appendChild(biletCard);
    });
}

window.saveBilets = function() {
    const newB = {};
    Object.keys(defaultBiletlar).forEach(bid => {
        newB[bid] = [];
        document.querySelectorAll(`.b-q-text[data-bid="${bid}"]`).forEach((el, qIdx) => {
            newB[bid].push({ q: el.value, a: defaultBiletlar[bid][qIdx].a, c: defaultBiletlar[bid][qIdx].c });
        });
    });
    Object.assign(defaultBiletlar, newB);
    localStorage.setItem('cyber_bilets', JSON.stringify(defaultBiletlar));
    alert("Saqlandi!");
    closeBiletManager();
}

window.exportToExcel = function() {
    const table = document.getElementById("leaderboardTableMain");
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Natijalar");
    XLSX.writeFile(wb, "Natijalar.xlsx");
}

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
        card.innerHTML = `<h3>${d.t}</h3><p>${isLocked ? '🔒 Qulflangan' : '✅ Ochiq'}</p>`;
        if (!isLocked) card.onclick = () => { joriyDars = d; showPage('lessonPage'); document.getElementById('lessonTitle').innerText = d.t; document.getElementById('lessonVideo').src = d.v; };
        grid.appendChild(card);
    });
}
