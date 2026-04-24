import { defaultData } from './database.js';

/**
 * ==========================================
 * VD AKADEMIYA - CORE LOGIC (main.js)
 * ==========================================
 */

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
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    db = {
        ref: (path = "") => ({
            on: (event, cb) => {
                const data = JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
                cb({ val: () => (Object.keys(target).length === 0 && event === 'value' && parts.length > 0 ? null : target) });
            },
            once: (event, cb) => {
                const data = JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = target[p] || {};
                cb({ val: () => (Object.keys(target).length === 0 ? null : target) });
            },
            set: (val) => {
                const data = JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!curr[parts[i]]) curr[parts[i]] = {};
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = val;
                localStorage.setItem('vd_mock_db', JSON.stringify(data));
                return Promise.resolve();
            },
            update: (val) => {
                const data = JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (const p of parts) curr = curr[p] || (curr[p] = {});
                Object.assign(curr, val);
                localStorage.setItem('vd_mock_db', JSON.stringify(data));
                return Promise.resolve();
            },
            remove: () => {
                const data = JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) curr = curr[parts[i]];
                delete curr[parts[parts.length - 1]];
                localStorage.setItem('vd_mock_db', JSON.stringify(data));
                return Promise.resolve();
            }
        })
    };
} else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

const state = {
    user: JSON.parse(localStorage.getItem('vd_session')) || null,
    isAdmin: localStorage.getItem('vd_is_admin') === 'true',
    videos: defaultData,
    activePage: 'page-landing',
    currentLesson: null,
    comp: { isStarted: false },
    timerInterval: null
};

window.app = {
    init() {
        if (state.user) {
            this.syncUser();
            this.showPage(state.isAdmin ? 'page-admin-dashboard' : 'page-student-dashboard');
        } else {
            this.showPage('page-landing');
        }
        this.listenToData();
    },

    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) {
            target.classList.add('active');
            state.activePage = id;
            this.updateNav();
            if (id === 'page-student-dashboard') this.renderStudentDashboard();
            if (id === 'page-admin-dashboard') this.renderAdminDashboard();
        }
        window.scrollTo(0, 0);
    },

    updateNav() {
        const nav = document.getElementById('main-nav');
        const userInfo = document.getElementById('nav-user-info');
        if (state.activePage === 'page-landing' || state.activePage.includes('login') || state.activePage === 'page-register') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'block';
            userInfo.innerText = state.isAdmin ? "ADMIN" : `${state.user.firstName} ${state.user.lastName}`;
        }
    },

    // --- Auth ---
    register() {
        const f = document.getElementById('reg-firstname').value.trim();
        const l = document.getElementById('reg-lastname').value.trim();
        if (!f || !l) return alert("Iltimos, ism va familiyangizni kiriting!");
        
        const username = (f + "_" + l).toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(1000 + Math.random() * 8999);
        
        db.ref('users/' + username).set({
            firstName: f,
            lastName: l,
            username: username,
            stats: { progress: 0, correct: 0, incorrect: 0, score: 0 }
        }).then(() => {
            alert("Muvaffaqiyatli ro'yxatdan o'tdingiz!\nSizning login: " + username + "\nUni saqlab qoling!");
            document.getElementById('login-username').value = username;
            this.showPage('page-student-login');
        });
    },

    studentLogin() {
        const u = document.getElementById('login-username').value.trim();
        if (!u) return alert("Loginni kiriting!");
        
        db.ref('users/' + u).once('value', snap => {
            const data = snap.val();
            if (data) {
                state.user = data;
                state.isAdmin = false;
                localStorage.setItem('vd_session', JSON.stringify(data));
                localStorage.setItem('vd_is_admin', 'false');
                this.showPage('page-student-dashboard');
            } else {
                alert("Xato! Bunday login topilmadi.");
            }
        });
    },

    adminLogin() {
        const u = document.getElementById('admin-user').value;
        const p = document.getElementById('admin-pass').value;
        if (u === 'xujaqulov01' && p === 'admin777') {
            state.isAdmin = true;
            state.user = { firstName: "Admin", lastName: "" };
            localStorage.setItem('vd_session', JSON.stringify(state.user));
            localStorage.setItem('vd_is_admin', 'true');
            this.showPage('page-admin-dashboard');
        } else {
            alert("Login yoki parol xato!");
        }
    },

    logout() {
        localStorage.removeItem('vd_session');
        localStorage.removeItem('vd_is_admin');
        state.user = null;
        state.isAdmin = false;
        location.reload();
    },

    syncUser() {
        if (!state.user || !state.user.username) return;
        db.ref('users/' + state.user.username).on('value', snap => {
            const data = snap.val();
            if (data) {
                state.user = data;
                localStorage.setItem('vd_session', JSON.stringify(data));
                if (state.activePage === 'page-student-dashboard') this.renderStudentDashboard();
                this.updateNav();
            }
        });
    },

    // --- Student Logic ---
    renderStudentDashboard() {
        const grid = document.getElementById('video-grid');
        const userProgress = state.user.stats?.progress || 0;
        
        grid.innerHTML = state.videos.map((v, i) => {
            const isLocked = i > userProgress;
            const isCompleted = i < userProgress;
            return `
                <div class="video-card ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" onclick="app.openLesson(${i})">
                    <div class="card-thumb">
                        <img src="https://img.youtube.com/vi/${v.vidId}/mqdefault.jpg">
                        ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
                        ${isCompleted ? '<div class="check-overlay">✅</div>' : ''}
                    </div>
                    <div class="card-info">
                        <h3>${v.title}</h3>
                        <p>${isLocked ? 'Qulflangan' : (isCompleted ? 'Tugatildi' : 'Hozirgi dars')}</p>
                    </div>
                </div>
            `;
        }).join('');

        if (userProgress >= 15) {
            const certBox = document.createElement('div');
            certBox.className = 'cert-promo-card';
            certBox.innerHTML = `
                <h3>TABRIKLAYMIZ! 🎓</h3>
                <p>Siz kursni to'liq yakunladingiz va sertifikatga loyiq topildingiz.</p>
                <button class="btn btn-primary" onclick="app.showCertificate()">SERTIFIKATNI OLISH</button>
            `;
            grid.prepend(certBox);
        }
    },

    openLesson(idx) {
        const userProgress = state.user.stats?.progress || 0;
        if (idx > userProgress) return alert("Avvalgi darslarni yakunlang!");
        
        state.currentLesson = state.videos[idx];
        document.getElementById('lesson-title').innerText = state.currentLesson.title;
        document.getElementById('lesson-iframe').src = `https://www.youtube.com/embed/${state.currentLesson.vidId}?rel=0`;
        this.showPage('page-lesson-view');
        this.closeLessonTest(); // Reset test overlay
    },

    startLessonTest() {
        this.renderLessonQuestions();
        document.getElementById('lesson-test-overlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    closeLessonTest() {
        document.getElementById('lesson-test-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    },

    renderLessonQuestions() {
        const container = document.getElementById('lesson-questions-container');
        container.innerHTML = state.currentLesson.questions.map((q, i) => `
            <div class="question-block">
                <p><strong>${i+1}. ${q.q}</strong></p>
                <div class="options">
                    ${q.a.map(opt => `
                        <label class="opt-label">
                            <input type="radio" name="lq-${i}" value="${opt}"> ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    submitLessonTest() {
        const questions = state.currentLesson.questions;
        let correct = 0;
        let answered = 0;
        
        questions.forEach((q, i) => {
            const selected = document.querySelector(`input[name="lq-${i}"]:checked`);
            if (selected) {
                answered++;
                if (selected.value === q.c) correct++;
            }
        });

        if (answered < questions.length) return alert("Barcha savollarga javob bering!");

        const percent = Math.round((correct / questions.length) * 100);
        if (percent >= 60) {
            const currentIdx = state.videos.findIndex(v => v.id === state.currentLesson.id);
            const nextProgress = Math.max(state.user.stats.progress, currentIdx + 1);
            
            db.ref('users/' + state.user.username + '/stats').update({ 
                progress: nextProgress,
                correct: (state.user.stats.correct || 0) + correct,
                incorrect: (state.user.stats.incorrect || 0) + (questions.length - correct)
            }).then(() => {
                alert(`Muvaffaqiyatli! ${percent}% natija bilan o'tdingiz. Keyingi dars ochildi!`);
                this.closeLessonTest();
                this.showPage('page-student-dashboard');
            });
        } else {
            alert(`Natija: ${percent}%. O'tish balli: 60%. Iltimos, videoni qayta ko'rib chiqib, qaytadan urinib ko'ring.`);
        }
    },

    showCertificate() {
        document.getElementById('cert-name').innerText = `${state.user.firstName} ${state.user.lastName}`.toUpperCase();
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString();
        this.showPage('page-final-results');
    },

    downloadCertificate() {
        const element = document.getElementById('certificate-template');
        html2canvas(element, { scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Sertifikat_${state.user.firstName}_${state.user.lastName}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    },

    // --- Admin/Global ---
    listenToData() {
        db.ref('competition').on('value', snap => {
            state.comp = snap.val() || { isStarted: false };
            this.handleCompUI();
        });
    },

    handleCompUI() {
        const box = document.getElementById('comp-status-box');
        if (!box) return;
        if (state.comp.isStarted) {
            box.innerText = "BELLASHUV BOSHLANDI!";
            box.style.background = "#ef4444";
            box.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.5)";
        } else {
            box.innerText = "Bellashuv kutilmoqda...";
            box.style.background = "#00d2ff";
            box.style.boxShadow = "none";
        }
    },

    renderAdminDashboard() {
        const list = document.getElementById('admin-video-list');
        list.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3>Darslar Ro'yxati</h3>
                <div class="video-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                    ${state.videos.map(v => `
                        <div class="video-card" style="cursor: default;">
                            <div class="card-thumb"><img src="https://img.youtube.com/vi/${v.vidId}/mqdefault.jpg"></div>
                            <div class="card-info"><h4>${v.title}</h4></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    switchAdminTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        if (event) event.target.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'results') this.renderResults();
    },

    renderResults() {
        db.ref('users').once('value', snap => {
            const users = Object.values(snap.val() || {});
            const body = document.getElementById('results-body');
            body.innerHTML = users.sort((a,b) => (b.stats.progress - a.stats.progress)).map((u, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td><strong>${u.firstName} ${u.lastName}</strong></td>
                    <td>${u.stats.progress} / 15</td>
                    <td>${u.stats.score || 0}</td>
                    <td><span style="color: ${u.stats.progress === 15 ? '#10b981' : '#f59e0b'}">${u.stats.progress === 15 ? 'TUGATGAN' : 'O\'QIMOQDA'}</span></td>
                </tr>
            `).join('');
        });
    },

    toggleCompetition(start) {
        db.ref('competition').set({ isStarted: start, startTime: Date.now() });
        document.getElementById('btn-start-comp').style.display = start ? 'none' : 'inline-block';
        document.getElementById('btn-stop-comp').style.display = start ? 'inline-block' : 'none';
    },

    exportExcel() {
        db.ref('users').once('value', snap => {
            const data = Object.values(snap.val() || {}).map(u => ({
                Ism: u.firstName,
                Familiya: u.lastName,
                Darslar: u.stats.progress,
                Xatolar: u.stats.incorrect || 0,
                Ball: u.stats.score || 0
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Akademiya_Natijalar");
            XLSX.writeFile(wb, "Natijalar.xlsx");
        });
    }
};

window.onload = () => app.init();
