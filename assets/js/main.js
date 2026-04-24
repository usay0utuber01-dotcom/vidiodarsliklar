import { defaultData } from './database.js';

/**
 * ==========================================
 * ACADEMY TEST & COMPETITION PLATFORM
 * Core Logic (main.js)
 * ==========================================
 */

// 1. Firebase Mock / Initial Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db;
let isMock = true;

// Initialize Firebase or Mock
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Firebase config not found. Using LocalStorage Mock Mode.");
    db = {
        ref: (path) => ({
            on: (event, cb) => {
                const data = JSON.parse(localStorage.getItem('academy_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
                cb({ val: () => (Object.keys(target).length === 0 && event === 'value' && parts.length > 0 ? null : target) });
            },
            once: (event, cb) => {
                const data = JSON.parse(localStorage.getItem('academy_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
                cb({ val: () => (Object.keys(target).length === 0 ? null : target) });
            },
            set: (val) => {
                const data = JSON.parse(localStorage.getItem('academy_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!curr[parts[i]]) curr[parts[i]] = {};
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = val;
                localStorage.setItem('academy_mock_db', JSON.stringify(data));
                return Promise.resolve();
            },
            update: (val) => {
                const data = JSON.parse(localStorage.getItem('academy_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (const p of parts) curr = curr[p] || (curr[p] = {});
                Object.assign(curr, val);
                localStorage.setItem('academy_mock_db', JSON.stringify(data));
                return Promise.resolve();
            }
        })
    };
} else {
    isMock = false;
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// 2. State Management
const state = {
    user: JSON.parse(localStorage.getItem('academy_session')) || null,
    isAdmin: localStorage.getItem('academy_admin') === 'true',
    activePage: 'page-landing',
    videos: [],
    comp: { isStarted: false, startTime: null, duration: 30 * 60 * 1000 },
    currentQuestions: [],
    currentQuestionIdx: 0,
    userAnswers: [],
    timerInterval: null
};

// 3. Main App Controller
window.app = {
    init() {
        this.showPage(state.user ? (state.isAdmin ? 'page-admin-dashboard' : 'page-student-dashboard') : 'page-landing');
        this.listenToGlobalData();
        this.updateNav();
    },

    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        state.activePage = id;
        this.updateNav();
        
        if (id === 'page-admin-dashboard') this.switchAdminTab('videos');
        if (id === 'page-student-dashboard') this.renderStudentDashboard();
        window.scrollTo(0, 0);
    },

    updateNav() {
        const nav = document.getElementById('main-nav');
        const userInfo = document.getElementById('nav-user-info');
        if (state.activePage === 'page-landing' || state.activePage.includes('login') || state.activePage === 'page-register') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'block';
            userInfo.innerText = state.isAdmin ? "ADMIN: XUJAQULOV" : `${state.user.firstName} ${state.user.lastName}`;
        }
    },

    // --- Authentication ---
    register() {
        const first = document.getElementById('reg-firstname').value.trim();
        const last = document.getElementById('reg-lastname').value.trim();
        if (!first || !last) return alert("Iltimos, hamma maydonlarni to'ldiring!");

        const username = (first + "_" + last).toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(1000 + Math.random() * 9000);
        
        db.ref('users/' + username).set({
            firstName: first,
            lastName: last,
            username: username,
            stats: { correct: 0, incorrect: 0, score: 0, isFinished: false }
        }).then(() => {
            alert(`Muvaffaqiyatli ro'yxatdan o'tdingiz!\nSizning loginiz: ${username}\nUni saqlab qoling!`);
            document.getElementById('login-username').value = username;
            this.showPage('page-student-login');
        });
    },

    studentLogin() {
        const user = document.getElementById('login-username').value.trim();
        db.ref('users/' + user).once('value', (snap) => {
            const data = snap.val();
            if (data) {
                state.user = data;
                state.isAdmin = false;
                localStorage.setItem('academy_session', JSON.stringify(data));
                localStorage.setItem('academy_admin', 'false');
                this.showPage('page-student-dashboard');
            } else alert("Bunday foydalanuvchi topilmadi!");
        });
    },

    adminLogin() {
        const u = document.getElementById('admin-user').value;
        const p = document.getElementById('admin-pass').value;
        if (u === 'xujaqulov01' && p === 'admin777') {
            state.isAdmin = true;
            state.user = { firstName: "Admin", lastName: "Xujaqulov" };
            localStorage.setItem('academy_admin', 'true');
            localStorage.setItem('academy_session', JSON.stringify(state.user));
            this.showPage('page-admin-dashboard');
        } else alert("Login yoki parol xato!");
    },

    logout() {
        localStorage.clear();
        location.reload();
    },

    // --- Admin Functions ---
    switchAdminTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-tab-' + tab).classList.add('active');
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        
        if (tab === 'results') this.renderResultsTable();
    },

    openModal(id) { document.getElementById(id).style.display = 'flex'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; },

    saveVideo() {
        const title = document.getElementById('vid-title').value;
        const vidId = document.getElementById('vid-id').value;
        if (!title || !vidId) return alert("Ma'lumotlarni to'ldiring!");

        const id = Date.now();
        // Generate 10 mock questions for each video
        const questions = Array.from({length: 10}, (_, i) => ({
            id: i + 1,
            q: `${title} mavzusi bo'yicha ${i+1}-savol?`,
            a: ["To'g'ri javob", "Xato variant 1", "Xato variant 2", "Xato variant 3"],
            c: "To'g'ri javob"
        }));

        db.ref('videos/' + id).set({ id, title, vidId, questions }).then(() => {
            alert("Dars qo'shildi!");
            this.closeModal('modal-video');
        });
    },

    listenToGlobalData() {
        db.ref('videos').on('value', snap => {
            const val = snap.val();
            if (!val && state.isAdmin) {
                // Agar videolar bo'lmasa va admin bo'lsa, default darslarni yuklaymiz
                const seedData = {};
                defaultData.forEach(v => seedData[v.id] = v);
                db.ref('videos').set(seedData);
            }
            state.videos = val ? Object.values(val) : (state.isAdmin ? defaultData : []);
            if (state.activePage === 'page-student-dashboard') this.renderStudentDashboard();
            if (state.activePage === 'page-admin-dashboard') this.renderAdminVideoList();
        });

        db.ref('competition').on('value', snap => {
            state.comp = snap.val() || { isStarted: false };
            this.handleCompetitionState();
        });
    },

    renderAdminVideoList() {
        const list = document.getElementById('admin-video-list');
        list.innerHTML = state.videos.map(v => `
            <div class="admin-item-card">
                <div>
                    <strong>${v.title}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-dim)">ID: ${v.vidId} | Savollar: 10 ta</p>
                </div>
                <button class="btn btn-outline" style="padding: 5px 15px; font-size: 0.7rem;">Tahrirlash</button>
            </div>
        `).join('');
    },

    // --- Competition Logic ---
    toggleCompetition(start) {
        if (start) {
            const startTime = Date.now();
            db.ref('competition').set({
                isStarted: true,
                startTime: startTime,
                duration: 30 * 60 * 1000
            });
        } else {
            db.ref('competition').update({ isStarted: false });
        }
    },

    handleCompetitionState() {
        const statusBox = document.getElementById('comp-status-box');
        const statusText = document.getElementById('comp-status-text');
        
        if (state.comp.isStarted) {
            statusBox.classList.add('active');
            statusText.innerText = "BELLASHUV BOSHLANDI!";
            this.startGlobalTimer();
            
            if (state.activePage === 'page-student-dashboard' && !state.user.stats.isFinished) {
                if (confirm("Bellashuv boshlandi! Qatnashasizmi?")) this.prepareCompetitionTest();
            }
        } else {
            statusBox.classList.remove('active');
            statusText.innerText = "Bellashuv kutilmoqda...";
            this.stopGlobalTimer();
        }

        // Admin Buttons
        if (state.isAdmin) {
            document.getElementById('btn-start-comp').style.display = state.comp.isStarted ? 'none' : 'block';
            document.getElementById('btn-stop-comp').style.display = state.comp.isStarted ? 'block' : 'none';
        }
    },

    startGlobalTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - state.comp.startTime;
            const remaining = state.comp.duration - elapsed;

            if (remaining <= 0) {
                this.finishCompetition();
                return;
            }

            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
            document.getElementById('admin-timer').innerText = timeStr;
            document.getElementById('student-timer').innerText = timeStr;
        }, 1000);
    },

    stopGlobalTimer() {
        clearInterval(state.timerInterval);
        document.getElementById('admin-timer').innerText = "30:00";
    },

    prepareCompetitionTest() {
        // Collect all questions from all videos
        let allQs = [];
        state.videos.forEach(v => allQs = [...allQs, ...v.questions]);
        
        // Pick 20 random questions
        if (allQs.length < 20) {
            // Duplicate if not enough
            while(allQs.length < 20) allQs = [...allQs, ...allQs];
        }
        
        state.currentQuestions = allQs.sort(() => Math.random() - 0.5).slice(0, 20);
        state.currentQuestionIdx = 0;
        state.userAnswers = [];
        
        this.showPage('page-competition');
        this.renderQuestion();
    },

    renderQuestion() {
        const q = state.currentQuestions[state.currentQuestionIdx];
        const container = document.getElementById('test-container');
        document.getElementById('test-progress').innerText = `Savol: ${state.currentQuestionIdx + 1} / 20`;

        const options = [...q.a].sort(() => Math.random() - 0.5);

        container.innerHTML = `
            <div class="question-text">${q.q}</div>
            <div class="options-grid">
                ${options.map(opt => `<button class="option-btn" onclick="app.answerQuestion('${opt.replace(/'/g, "\\'")}')">${opt}</button>`).join('')}
            </div>
        `;
    },

    answerQuestion(ans) {
        const q = state.currentQuestions[state.currentQuestionIdx];
        const isCorrect = ans === q.c;
        
        state.userAnswers.push({ qId: q.id, isCorrect });
        
        // Update live stats in DB
        const correct = state.userAnswers.filter(a => a.isCorrect).length;
        const incorrect = state.userAnswers.length - correct;
        
        db.ref('users/' + state.user.username + '/stats').update({
            correct, incorrect, score: correct * 5,
            lastUpdate: Date.now()
        });

        state.currentQuestionIdx++;
        if (state.currentQuestionIdx < 20) {
            this.renderQuestion();
        } else {
            this.finishCompetition();
        }
    },

    finishCompetition() {
        this.stopGlobalTimer();
        db.ref('users/' + state.user.username + '/stats').update({ isFinished: true });
        
        // Show results
        const stats = state.userAnswers;
        const correct = stats.filter(a => a.isCorrect).length;
        document.getElementById('user-final-stats').innerHTML = `
            <div class="stat-item"><span>To'g'ri:</span> <strong>${correct}</strong></div>
            <div class="stat-item"><span>Noto'g'ri:</span> <strong>${stats.length - correct}</strong></div>
            <div class="stat-item"><span>Umumiy ball:</span> <strong>${correct * 5}</strong></div>
        `;

        // Check for Rank (Top 3 get certificate)
        db.ref('users').once('value', snap => {
            const users = Object.values(snap.val() || {});
            users.sort((a, b) => b.stats.score - a.stats.score);
            const myRank = users.findIndex(u => u.username === state.user.username) + 1;
            
            if (myRank <= 3) {
                document.getElementById('certificate-box').style.display = 'block';
                document.getElementById('cert-name').innerText = `${state.user.firstName} ${state.user.lastName}`.toUpperCase();
                document.getElementById('cert-rank-val').innerText = myRank;
                document.getElementById('cert-date').innerText = new Date().toLocaleDateString();
            }
            
            this.showPage('page-final-results');
        });
    },

    // --- Student Dashboard ---
    renderStudentDashboard() {
        const grid = document.getElementById('video-grid');
        grid.innerHTML = state.videos.map(v => `
            <div class="video-card">
                <div class="video-thumbnail">
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${v.vidId}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="video-card-content">
                    <h3>${v.title}</h3>
                    <button class="btn btn-primary w-100" onclick="alert('Ushbu dars bo\\'yicha testlar bellashuv vaqtida ochiladi!')">DARSNI KO'RISH</button>
                </div>
            </div>
        `).join('');
    },

    // --- Results & Table ---
    renderResultsTable() {
        db.ref('users').on('value', snap => {
            const users = Object.values(snap.val() || {});
            users.sort((a, b) => (b.stats.score || 0) - (a.stats.score || 0));
            
            const body = document.getElementById('results-body');
            body.innerHTML = users.map((u, i) => `
                <tr>
                    <td><strong>${i + 1}</strong></td>
                    <td>${u.firstName} ${u.lastName}</td>
                    <td>${u.username}</td>
                    <td style="color: var(--success)">${u.stats.correct || 0}</td>
                    <td style="color: var(--danger)">${u.stats.incorrect || 0}</td>
                    <td><span class="badge-score">${u.stats.score || 0}</span></td>
                    <td>${u.stats.isFinished ? '✅ Tugatdi' : '⏳ Ishlamoqda'}</td>
                </tr>
            `).join('');
        });
    },

    exportExcel() {
        db.ref('users').once('value', snap => {
            const users = Object.values(snap.val() || {});
            users.sort((a, b) => (b.stats.score || 0) - (a.stats.score || 0));
            
            const data = users.map((u, i) => ({
                "O'rin": i + 1,
                "Ism": u.firstName,
                "Familiya": u.lastName,
                "Username": u.username,
                "To'g'ri": u.stats.correct || 0,
                "Noto'g'ri": u.stats.incorrect || 0,
                "Ball": u.stats.score || 0
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Natijalar");
            XLSX.writeFile(wb, "Bellashuv_Natijalari.xlsx");
        });
    },

    downloadCertificate() {
        const cert = document.getElementById('certificate-template');
        html2canvas(cert).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'px', [canvas.width, canvas.height]);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${state.user.firstName}_Sertifikat.pdf`);
        });
    }
};

// Start the App
window.addEventListener('DOMContentLoaded', () => app.init());
