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
                setTimeout(triggerListeners, 0); // Async to prevent stack overflow
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
                setTimeout(triggerListeners, 0);
                return Promise.resolve();
            },
            remove: () => {
                const data = getMockData();
                const parts = path.split('/').filter(p => p);
                let curr = data;
                for (let i = 0; i < parts.length - 1; i++) curr = curr[parts[i]];
                if (curr) delete curr[parts[parts.length - 1]];
                setMockData(data);
                setTimeout(triggerListeners, 0);
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
    videos: [],
    activePage: 'page-landing',
    currentLesson: null,
    editingVideoId: null
};

window.app = {
    init() {
        const currentDB = getMockData();
        if (!currentDB.videos || Object.keys(currentDB.videos).length === 0) {
            const initial = {};
            defaultData.forEach(v => initial[v.id] = v);
            db.ref('videos').set(initial);
        }

        this.listenToGlobalVideos();
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
        if (!nav) return;
        if (state.activePage === 'page-landing' || state.activePage.includes('login') || state.activePage === 'page-register') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'block';
            userInfo.innerText = state.isAdmin ? "ADMIN" : (state.user ? `${state.user.firstName} ${state.user.lastName}` : "");
        }
    },

    extractVidId(url) {
        if (!url) return "";
        if (url.length === 11) return url;
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : url;
    },

    register() {
        const f = document.getElementById('reg-firstname').value.trim();
        const l = document.getElementById('reg-lastname').value.trim();
        if (!f || !l) return alert("To'ldiring!");
        const u = (f + "_" + l).toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(1000 + Math.random() * 8999);
        db.ref('users/' + u).set({
            firstName: f, lastName: l, username: u,
            stats: { progress: 0, correct: 0, incorrect: 0, score: 0 }
        }).then(() => {
            alert("Login: " + u);
            document.getElementById('login-username').value = u;
            this.showPage('page-student-login');
        });
    },

    studentLogin() {
        const u = document.getElementById('login-username').value.trim();
        if (!u) return alert("Login!");
        db.ref('users/' + u).once('value', snap => {
            const data = snap.val();
            if (data) {
                state.user = data;
                state.isAdmin = false;
                localStorage.setItem('vd_session', JSON.stringify(data));
                localStorage.setItem('vd_is_admin', 'false');
                this.syncUser();
                this.showPage('page-student-dashboard');
            } else alert("Xato!");
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
        } else alert("Xato!");
    },

    logout() {
        localStorage.removeItem('vd_session');
        localStorage.removeItem('vd_is_admin');
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

    listenToGlobalVideos() {
        db.ref('videos').on('value', snap => {
            const val = snap.val();
            if (val) {
                state.videos = Object.values(val).sort((a,b) => Number(a.id) - Number(b.id));
                if (state.activePage === 'page-student-dashboard') this.renderStudentDashboard();
                if (state.activePage === 'page-admin-dashboard') this.renderAdminDashboard();
            }
        });
    },

    renderStudentDashboard() {
        const grid = document.getElementById('video-grid');
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
                    <div class="card-info">
                        <h3>${v.title}</h3>
                        <p>${isLocked ? 'Qulflangan' : (isCompleted ? 'Tugatildi' : 'Hozirgi dars')}</p>
                    </div>
                </div>
            `;
        }).join('');

        if (userProgress >= state.videos.length && state.videos.length > 0) {
            const certBox = document.createElement('div');
            certBox.className = 'cert-promo-card';
            certBox.innerHTML = `<h3>TABRIKLAYMIZ! 🎓</h3><p>Siz kursni tugatdingiz.</p><button class="btn btn-primary" onclick="app.showCertificate()">SERTIFIKATNI OLISH</button>`;
            grid.prepend(certBox);
        }
    },

    renderAdminDashboard() {
        const list = document.getElementById('admin-video-list');
        if (!list) return;
        list.innerHTML = state.videos.map(v => `
            <div class="admin-video-card">
                <div class="vid-preview"><img src="https://img.youtube.com/vi/${v.vidId}/mqdefault.jpg"></div>
                <div class="vid-details">
                    <h4>${v.title}</h4>
                    <p class="vid-id-tag">ID: ${v.vidId}</p>
                    <div class="vid-actions">
                        <button class="btn-s btn-edit-premium" onclick="app.openEditVideo(${v.id})">Tahrirlash</button>
                        <button class="btn-s btn-test-premium" onclick="app.openTestEditor(${v.id})">Testlarni boshqarish</button>
                        <button class="btn-s btn-delete-premium" onclick="app.deleteVideo(${v.id})">O'chirish</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    openAddVideoModal() {
        state.editingVideoId = null;
        document.getElementById('video-modal-title').innerText = "Yangi Dars Qo'shish";
        document.getElementById('edit-vid-title').value = "";
        document.getElementById('edit-vid-id').value = "";
        this.openModal('modal-video');
    },

    openEditVideo(id) {
        state.editingVideoId = id;
        const v = state.videos.find(v => v.id === id);
        document.getElementById('video-modal-title').innerText = "Darsni Tahrirlash";
        document.getElementById('edit-vid-title').value = v.title;
        document.getElementById('edit-vid-id').value = v.vidId;
        this.openModal('modal-video');
    },

    saveVideo() {
        const title = document.getElementById('edit-vid-title').value.trim();
        const rawVid = document.getElementById('edit-vid-id').value.trim();
        if (!title || !rawVid) return alert("To'ldiring!");
        const vidId = this.extractVidId(rawVid);

        if (state.editingVideoId) {
            db.ref('videos/' + state.editingVideoId).update({ title, vidId }).then(() => {
                alert("Yangilandi!"); this.closeModal('modal-video');
            });
        } else {
            const id = Date.now();
            const questions = Array.from({length: 10}, (_, i) => ({
                q: `${title} bo'yicha ${i+1}-savol?`,
                a: ["A variant", "B variant", "C variant", "D variant"],
                c: "A variant"
            }));
            db.ref('videos/' + id).set({ id, title, vidId, questions }).then(() => {
                alert("Qo'shildi!"); this.closeModal('modal-video');
            });
        }
    },

    deleteVideo(id) {
        if (confirm("O'chirilsinmi?")) {
            db.ref('videos/' + id).remove().then(() => alert("O'chirildi!"));
        }
    },

    openTestEditor(id) {
        state.editingVideoId = id;
        const v = state.videos.find(v => v.id === id);
        const container = document.getElementById('test-editor-container');
        container.innerHTML = (v.questions || []).map((q, i) => `
            <div class="test-edit-block">
                <div class="input-group"><label>${i+1}-savol</label><input type="text" class="edit-q-text" value="${q.q}"></div>
                <div class="edit-options-grid">
                    ${q.a.map((opt, j) => `
                        <div class="opt-edit">
                            <input type="text" class="edit-opt-text" value="${opt}">
                            <input type="radio" name="correct-${i}" value="${j}" ${opt === q.c ? 'checked' : ''}>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        this.openModal('modal-test-editor');
    },

    saveEditedTest() {
        const id = state.editingVideoId;
        const questions = [];
        document.querySelectorAll('.test-edit-block').forEach(block => {
            const q = block.querySelector('.edit-q-text').value;
            const opts = [];
            block.querySelectorAll('.edit-opt-text').forEach(opt => opts.push(opt.value));
            const correctRadio = block.querySelector('input[type="radio"]:checked');
            const correctIdx = correctRadio ? correctRadio.value : 0;
            questions.push({ q, a: opts, c: opts[correctIdx] });
        });
        db.ref('videos/' + id + '/questions').set(questions).then(() => {
            alert("Saqlandi!"); this.closeModal('modal-test-editor');
        });
    },

    openModal(id) { document.getElementById(id).style.display = 'flex'; document.body.style.overflow = 'hidden'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; document.body.style.overflow = 'auto'; },

    openLesson(idx) {
        const userProgress = state.user?.stats?.progress || 0;
        if (idx > userProgress) return alert("Avvalgi darslarni yakunlang!");
        state.currentLesson = state.videos[idx];
        document.getElementById('lesson-title').innerText = state.currentLesson.title;
        document.getElementById('lesson-iframe').src = `https://www.youtube.com/embed/${state.currentLesson.vidId}?rel=0`;
        this.showPage('page-lesson-view');
        this.closeLessonTest();
    },

    startLessonTest() {
        const container = document.getElementById('lesson-questions-container');
        container.innerHTML = (state.currentLesson.questions || []).map((q, i) => `
            <div class="question-block">
                <p><strong>${i+1}. ${q.q}</strong></p>
                <div class="options">
                    ${q.a.map(opt => `<label class="opt-label"><input type="radio" name="lq-${i}" value="${opt}"> ${opt}</label>`).join('')}
                </div>
            </div>
        `).join('');
        this.openModal('lesson-test-overlay');
    },

    closeLessonTest() { this.closeModal('lesson-test-overlay'); },

    submitLessonTest() {
        const questions = state.currentLesson.questions || [];
        let correct = 0; let answered = 0;
        questions.forEach((q, i) => {
            const sel = document.querySelector(`input[name="lq-${i}"]:checked`);
            if (sel) { answered++; if (sel.value === q.c) correct++; }
        });
        if (answered < questions.length) return alert("Hamma savollarga javob bering!");
        const percent = Math.round((correct / questions.length) * 100);
        if (percent >= 60) {
            const currentIdx = state.videos.findIndex(v => v.id === state.currentLesson.id);
            const nextProgress = Math.max(state.user.stats.progress, currentIdx + 1);
            db.ref('users/' + state.user.username + '/stats').update({ progress: nextProgress }).then(() => { 
                alert("Muvaffaqiyatli!"); this.closeLessonTest(); this.showPage('page-student-dashboard'); 
            });
        } else alert(`Natija: ${percent}%. O'tish: 60%.`);
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
            link.download = `Sertifikat.png`; link.href = canvas.toDataURL(); link.click();
        });
    },

    listenToData() {
        db.ref('competition').on('value', snap => {
            state.comp = snap.val() || { isStarted: false };
            const box = document.getElementById('comp-status-box');
            if (box) box.innerText = state.comp.isStarted ? "BELLASHUV BOSHLANDI!" : "Bellashuv kutilmoqda...";
        });
    },

    switchAdminTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        if (event && event.target && event.target.classList) event.target.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'results') this.renderResults();
    }
};

window.onload = () => app.init();
