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
    videos: [],
    activePage: 'page-landing',
    currentLesson: null,
    comp: { isStarted: false },
    timerInterval: null,
    editingVideoId: null
};

window.app = {
    init() {
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
            firstName: f, lastName: l, username: username,
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
            } else alert("Xato! Bunday login topilmadi.");
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
        } else alert("Login yoki parol xato!");
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

    // --- Video/Lesson Management ---
    listenToGlobalVideos() {
        db.ref('videos').on('value', snap => {
            const val = snap.val();
            if (!val) {
                state.videos = defaultData;
                if (state.isAdmin) {
                    const seed = {};
                    defaultData.forEach(v => seed[v.id] = v);
                    db.ref('videos').set(seed);
                }
            } else {
                state.videos = Object.values(val).sort((a,b) => a.id - b.id);
            }
            if (state.activePage === 'page-student-dashboard') this.renderStudentDashboard();
            if (state.activePage === 'page-admin-dashboard') this.renderAdminDashboard();
        });
    },

    renderStudentDashboard() {
        const grid = document.getElementById('video-grid');
        if (!grid) return;
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
                    <div class="card-info"><h3>${v.title}</h3><p>${isLocked ? 'Qulflangan' : (isCompleted ? 'Tugatildi' : 'Hozirgi dars')}</p></div>
                </div>
            `;
        }).join('');

        if (userProgress >= state.videos.length && state.videos.length > 0) {
            const certBox = document.createElement('div');
            certBox.className = 'cert-promo-card';
            certBox.innerHTML = `<h3>TABRIKLAYMIZ! 🎓</h3><p>Siz kursni to'liq yakunladingiz.</p><button class="btn btn-primary" onclick="app.showCertificate()">SERTIFIKATNI OLISH</button>`;
            grid.prepend(certBox);
        }
    },

    // --- Admin Functions ---
    renderAdminDashboard() {
        const list = document.getElementById('admin-video-list');
        if (!list) return;
        list.innerHTML = state.videos.map(v => `
            <div class="admin-video-card">
                <div class="vid-preview"><img src="https://img.youtube.com/vi/${v.vidId}/mqdefault.jpg"></div>
                <div class="vid-details">
                    <h4>${v.title}</h4>
                    <p>ID: ${v.vidId}</p>
                    <div class="vid-actions">
                        <button class="btn-s btn-edit" onclick="app.openEditVideo(${v.id})">Tahrirlash</button>
                        <button class="btn-s btn-test" onclick="app.openTestEditor(${v.id})">Testlar</button>
                        <button class="btn-s btn-delete" onclick="app.deleteVideo(${v.id})">O'chirish</button>
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
        const vidId = document.getElementById('edit-vid-id').value.trim();
        if (!title || !vidId) return alert("Hamma maydonlarni to'ldiring!");

        if (state.editingVideoId) {
            db.ref('videos/' + state.editingVideoId).update({ title, vidId }).then(() => {
                alert("Dars yangilandi!"); this.closeModal('modal-video');
            });
        } else {
            const id = Date.now();
            const questions = Array.from({length: 10}, (_, i) => ({
                q: `${title} mavzusi bo'yicha ${i+1}-savol?`,
                a: ["Javob A", "Javob B", "Javob C", "Javob D"],
                c: "Javob A"
            }));
            db.ref('videos/' + id).set({ id, title, vidId, questions }).then(() => {
                alert("Yangi dars qo'shildi!"); this.closeModal('modal-video');
            });
        }
    },

    deleteVideo(id) {
        if (confirm("Ushbu darsni o'chirmoqchimisiz?")) {
            db.ref('videos/' + id).remove().then(() => alert("Dars o'chirildi!"));
        }
    },

    openTestEditor(id) {
        state.editingVideoId = id;
        const v = state.videos.find(v => v.id === id);
        const container = document.getElementById('test-editor-container');
        container.innerHTML = v.questions.map((q, i) => `
            <div class="test-edit-block" data-idx="${i}">
                <div class="input-group">
                    <label>${i+1}-savol matni</label>
                    <input type="text" class="edit-q-text" value="${q.q}">
                </div>
                <div class="edit-options-grid">
                    ${q.a.map((opt, j) => `
                        <div class="opt-edit">
                            <input type="text" class="edit-opt-text" value="${opt}">
                            <input type="radio" name="correct-${i}" value="${j}" ${opt === q.c ? 'checked' : ''}> To'g'ri
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
            const correctIdx = block.querySelector('input[type="radio"]:checked').value;
            questions.push({ q, a: opts, c: opts[correctIdx] });
        });
        db.ref('videos/' + id + '/questions').set(questions).then(() => {
            alert("Testlar saqlandi!"); this.closeModal('modal-test-editor');
        });
    },

    // --- Common UI ---
    openModal(id) { document.getElementById(id).style.display = 'flex'; document.body.style.overflow = 'hidden'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; document.body.style.overflow = 'auto'; },

    // --- Student Test ---
    openLesson(idx) {
        const userProgress = state.user.stats?.progress || 0;
        if (idx > userProgress) return alert("Avvalgi darslarni yakunlang!");
        state.currentLesson = state.videos[idx];
        document.getElementById('lesson-title').innerText = state.currentLesson.title;
        document.getElementById('lesson-iframe').src = `https://www.youtube.com/embed/${state.currentLesson.vidId}?rel=0`;
        this.showPage('page-lesson-view');
        this.closeLessonTest();
    },

    startLessonTest() {
        const container = document.getElementById('lesson-questions-container');
        container.innerHTML = state.currentLesson.questions.map((q, i) => `
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
        const questions = state.currentLesson.questions;
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
            db.ref('users/' + state.user.username + '/stats').update({ 
                progress: nextProgress,
                correct: (state.user.stats.correct || 0) + correct,
                incorrect: (state.user.stats.incorrect || 0) + (questions.length - correct)
            }).then(() => { alert(`Muvaffaqiyatli! ${percent}% natija! Keyingi dars ochildi.`); this.closeLessonTest(); this.showPage('page-student-dashboard'); });
        } else alert(`Natija: ${percent}%. O'tish balli: 60%. Iltimos, qaytadan urinib ko'ring.`);
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
            link.href = canvas.toDataURL(); link.click();
        });
    },

    listenToData() {
        db.ref('competition').on('value', snap => {
            state.comp = snap.val() || { isStarted: false };
            const box = document.getElementById('comp-status-box');
            if (!box) return;
            if (state.comp.isStarted) { box.innerText = "BELLASHUV BOSHLANDI!"; box.style.background = "#ef4444"; }
            else { box.innerText = "Bellashuv kutilmoqda..."; box.style.background = "#00d2ff"; }
        });
    },

    switchAdminTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'results') this.renderResults();
    },

    renderResults() {
        db.ref('users').once('value', snap => {
            const users = Object.values(snap.val() || {}).sort((a,b) => (b.stats.progress - a.stats.progress));
            document.getElementById('results-body').innerHTML = users.map((u, i) => `
                <tr><td>${i+1}</td><td><strong>${u.firstName} ${u.lastName}</strong></td><td>${u.stats.progress} / ${state.videos.length}</td><td>${u.stats.score || 0}</td><td><span style="color: ${u.stats.progress >= state.videos.length ? '#10b981' : '#f59e0b'}">${u.stats.progress >= state.videos.length ? 'TUGATGAN' : 'O\'QIMOQDA'}</span></td></tr>
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
            const data = Object.values(snap.val() || {}).map(u => ({ Ism: u.firstName, Familiya: u.lastName, Darslar: u.stats.progress, Xatolar: u.stats.incorrect || 0, Ball: u.stats.score || 0 }));
            const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Akademiya_Natijalar"); XLSX.writeFile(wb, "Natijalar.xlsx");
        });
    }
};

window.onload = () => app.init();
