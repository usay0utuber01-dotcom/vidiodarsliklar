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
const listeners = [];
const getMockData = () => JSON.parse(localStorage.getItem('vd_mock_db') || '{}');
const setMockData = (data) => localStorage.setItem('vd_mock_db', JSON.stringify(data));

const triggerListeners = () => {
    const data = getMockData();
    listeners.forEach(l => {
        const parts = l.path.split('/').filter(p => p);
        let target = data;
        for (const p of parts) target = (target && target[p]) ? target[p] : null;
        const val = (target === null || (typeof target === 'object' && Object.keys(target).length === 0)) ? null : target;
        l.cb({ val: () => val });
    });
};

window.addEventListener('storage', (e) => {
    if (e.key === 'vd_mock_db') triggerListeners();
});

if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    db = {
        ref: (path = "") => ({
            on: (event, cb) => {
                const parts = path.split('/').filter(p => p);
                listeners.push({ path, cb, partsLength: parts.length });
                const data = getMockData();
                let target = data;
                for (const p of parts) target = (target && target[p]) ? target[p] : null;
                const val = (target === null || (typeof target === 'object' && Object.keys(target).length === 0)) ? null : target;
                cb({ val: () => val });
            },
            once: (event, cb) => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let target = data;
                for (const p of parts) target = (target && target[p]) ? target[p] : null;
                const val = (target === null || (typeof target === 'object' && Object.keys(target).length === 0)) ? null : target;
                cb({ val: () => val });
            },
            set: (val) => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!curr[parts[i]]) curr[parts[i]] = {};
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = val;
                setMockData(data);
                setTimeout(triggerListeners, 10);
                return Promise.resolve();
            },
            update: (val) => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (const p of parts) {
                    if (!curr[p]) curr[p] = {};
                    curr = curr[p];
                }
                Object.assign(curr, val);
                setMockData(data);
                setTimeout(triggerListeners, 10);
                return Promise.resolve();
            },
            remove: () => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) curr = curr[parts[i]];
                if (curr) delete curr[parts[parts.length - 1]];
                setMockData(data);
                setTimeout(triggerListeners, 10);
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
    videos: defaultData,
    activePage: 'page-landing',
    currentLesson: null,
    competition: null,
    compTimer: null
};

window.app = {
    init() {
        if (state.user) {
            this.syncUser();
            this.showPage('page-student-dashboard');
            this.listenToCompetition();
        } else {
            this.showPage('page-landing');
        }
    },

    showPage(id) {
        // Stop video audio if leaving lesson view
        if (state.activePage === 'page-lesson-view' && id !== 'page-lesson-view') {
            const iframe = document.getElementById('lesson-iframe');
            if (iframe) iframe.src = "";
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) {
            target.classList.add('active');
            state.activePage = id;
            this.updateNav();
            if (id === 'page-student-dashboard') this.renderStudentDashboard();
        }
        window.scrollTo(0, 0);
    },

    updateNav() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;
        nav.style.display = (state.activePage === 'page-landing' || state.activePage.includes('login') || state.activePage === 'page-register') ? 'none' : 'block';
        const ui = document.getElementById('nav-user-info');
        if (ui) ui.innerText = state.user ? `${state.user.firstName} ${state.user.lastName}` : "";
    },

    register() {
        const f = document.getElementById('reg-firstname').value.trim();
        const l = document.getElementById('reg-lastname').value.trim();
        if (!f || !l) return alert("To'ldiring!");
        const u = (f + "_" + l).toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(1000 + Math.random() * 8999);
        db.ref('users/' + u).set({
            firstName: f, lastName: l, username: u,
            stats: { progress: 0, correct: 0, incorrect: 0 }
        }).then(() => {
            alert("Login: " + u);
            document.getElementById('login-username').value = u;
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
                localStorage.setItem('vd_session', JSON.stringify(data));
                this.syncUser();
                this.listenToCompetition();
                this.showPage('page-student-dashboard');
            } else alert("Xato!");
        });
    },

    logout() {
        localStorage.removeItem('vd_session');
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
            }
        });
    },

    renderStudentDashboard() {
        const grid = document.getElementById('video-grid');
        const greeting = document.getElementById('welcome-greeting');
        if (greeting && state.user) {
            greeting.innerText = `Xush kelibsiz, ${state.user.firstName} ${state.user.lastName}!`;
        }
        if (!grid) return;
        const userProgress = state.user?.stats?.progress || 0;
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
                    <div class="card-info"><h3>${v.title}</h3><p>${isLocked ? 'Qulflangan' : (isCompleted ? 'Tugatildi' : 'Hozirgi dars')}</p></div>
                </div>
            `;
        }).join('');
        if (userProgress >= state.videos.length && state.videos.length > 0) {
            const certBox = document.createElement('div');
            certBox.className = 'cert-promo-card';
            certBox.innerHTML = `<h3>TABRIKLAYMIZ! 🎓</h3><p>Sertifikatni olishingiz mumkin.</p><button class="btn btn-primary" onclick="app.showCertificate()">SERTIFIKAT</button>`;
            grid.prepend(certBox);
        }
    },

    listenToCompetition() {
        db.ref('competition').on('value', snap => {
            const comp = snap.val();
            if (comp && comp.isActive && state.activePage !== 'page-student-comp') {
                state.competition = comp;
                this.openStudentCompExam();
            } else if (!comp && state.activePage === 'page-student-comp') {
                alert("Musobaqa yakunlandi!");
                this.showPage('page-student-dashboard');
            }
        });
    },

    openStudentCompExam() {
        this.showPage('page-student-comp');
        document.getElementById('comp-questions-container').innerHTML = state.competition.questions.map((q, i) => `
            <div class="question-block">
                <p><strong>${i+1}. ${q.q}</strong></p>
                <div class="options">${q.a.map(opt => `<label class="opt-label"><input type="radio" name="cq-${i}" value="${opt}"> ${opt}</label>`).join('')}</div>
            </div>
        `).join('');
        if (state.compTimer) clearInterval(state.compTimer);
        state.compTimer = setInterval(() => {
            const left = Math.max(0, state.competition.endTime - Date.now());
            const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000);
            document.getElementById('comp-timer').innerText = `${m}:${s < 10 ? '0'+s : s}`;
            if (left <= 0) { clearInterval(state.compTimer); this.submitCompTest(true); }
        }, 1000);
    },

    submitCompTest(isAuto = false) {
        const questions = state.competition.questions;
        let correct = 0; let answered = 0;
        questions.forEach((q, i) => {
            const sel = document.querySelector(`input[name="cq-${i}"]:checked`);
            if (sel) { answered++; if (sel.value === q.c) correct++; }
        });
        if (!isAuto && answered < questions.length) return alert("Hamma savollarni belgilang!");
        const res = { username: state.user.username, name: `${state.user.firstName} ${state.user.lastName}`, score: correct, total: questions.length, timestamp: Date.now() };
        db.ref('competition_results/' + state.user.username).set(res).then(() => {
            alert("Natijangiz yuborildi!"); clearInterval(state.compTimer); this.showPage('page-student-dashboard');
        });
    },

    openLesson(idx) {
        if (idx > (state.user?.stats?.progress || 0)) return alert("Avvalgi darsni tugating!");
        state.currentLesson = state.videos[idx];
        document.getElementById('lesson-title').innerText = state.currentLesson.title;
        document.getElementById('lesson-iframe').src = `https://www.youtube.com/embed/${state.currentLesson.vidId}?rel=0`;
        this.showPage('page-lesson-view');
    },

    startLessonTest() {
        // Stop video audio when starting test
        const iframe = document.getElementById('lesson-iframe');
        if (iframe) iframe.src = "";

        document.getElementById('lesson-questions-container').innerHTML = (state.currentLesson.questions || []).map((q, i) => `
            <div class="question-block">
                <p><strong>${i+1}. ${q.q}</strong></p>
                <div class="options">${q.a.map(opt => `<label class="opt-label"><input type="radio" name="lq-${i}" value="${opt}"> ${opt}</label>`).join('')}</div>
            </div>
        `).join('');
        this.openModal('lesson-test-overlay');
    },

    submitLessonTest() {
        const questions = state.currentLesson.questions || [];
        let correct = 0; let answered = 0;
        questions.forEach((q, i) => {
            const sel = document.querySelector(`input[name="lq-${i}"]:checked`);
            if (sel) { answered++; if (sel.value === q.c) correct++; }
        });
        if (answered < questions.length) return alert("To'ldiring!");
        if ((correct / questions.length) >= 0.6) {
            const curIdx = state.videos.findIndex(v => v.id === state.currentLesson.id);
            db.ref('users/' + state.user.username + '/stats').update({ progress: Math.max(state.user.stats.progress, curIdx + 1) }).then(() => { 
                alert("O'tdingiz!"); this.closeLessonTest(); this.showPage('page-student-dashboard'); 
            });
        } else alert("Yana urinib ko'ring.");
    },

    showCertificate() {
        document.getElementById('cert-name').innerText = `${state.user.firstName} ${state.user.lastName}`.toUpperCase();
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString();
        this.showPage('page-final-results');
    },

    downloadCertificate() {
        html2canvas(document.getElementById('certificate-template'), { scale: 2 }).then(canvas => {
            const link = document.createElement('a'); link.download = `Sertifikat.png`; link.href = canvas.toDataURL(); link.click();
        });
    },

    openModal(id) { document.getElementById(id).style.display = 'flex'; document.body.style.overflow = 'hidden'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; document.body.style.overflow = 'auto'; },
    closeLessonTest() { this.closeModal('lesson-test-overlay'); }
};

window.onload = () => app.init();
