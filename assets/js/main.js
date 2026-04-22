import { darslar as defaultDarslar, testlar as defaultTestlar } from './database.js';
import { shifrlashVigenere, deshifrlashVigenere } from './cipher.js';

// Dynamic Data Loading
let darslar = defaultDarslar;
try {
    const savedDarslar = localStorage.getItem('vd_darslar');
    if (savedDarslar) {
        darslar = JSON.parse(savedDarslar);
        if (darslar.length !== defaultDarslar.length) {
            darslar = defaultDarslar;
            localStorage.setItem('vd_darslar', JSON.stringify(darslar));
            localStorage.setItem('vd_testlar', JSON.stringify(defaultTestlar));
        }
    } else {
        localStorage.setItem('vd_darslar', JSON.stringify(defaultDarslar));
        localStorage.setItem('vd_testlar', JSON.stringify(defaultTestlar));
    }
} catch (e) { console.error("Error loading darslar", e); }

let testlar = defaultTestlar;
try {
    const savedTestlar = localStorage.getItem('vd_testlar');
    if (savedTestlar) testlar = JSON.parse(savedTestlar);
} catch (e) { console.error("Error loading testlar", e); }

let userStats = {};
try {
    const savedStats = localStorage.getItem('vd_user_stats');
    if (savedStats) userStats = JSON.parse(savedStats);
} catch (e) { console.error("Error loading stats", e); }

let userProgressMap = {};
try {
    const savedProg = localStorage.getItem('vd_user_progress');
    if (savedProg) userProgressMap = JSON.parse(savedProg);
} catch (e) { console.error("Error loading progress map", e); }

let foydalanuvchi = localStorage.getItem('cyber_user_name') || "";
let progress = 0;
let joriyDars = null;
let isAdmin = sessionStorage.getItem('vd_admin') === 'true';

// Initialize
function init() {
    console.log("App Initializing...");
    if (foydalanuvchi) {
        progress = userProgressMap[foydalanuvchi] || 0;
        showDashboard();
    } else {
        showPage('loginPage');
    }
    setupEventListeners();
}

window.addEventListener('DOMContentLoaded', init);

function setupEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', login);

    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', adminLogin);
    
    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', function(e) {
            const pageId = e.currentTarget.getAttribute('data-page');
            showPage(pageId);
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    const encBtn = document.getElementById('encryptBtn');
    if (encBtn) encBtn.addEventListener('click', handleEncrypt);

    const decBtn = document.getElementById('decryptBtn');
    if (decBtn) decBtn.addEventListener('click', handleDecrypt);

    const clearBtn = document.getElementById('clearCipherBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearCipher);

    const copyBtn = document.getElementById('copyCipherBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyCipher);
}

function showPage(id) {
    if (id === 'adminDashboardPage' && !isAdmin) {
        return showPage('adminLoginPage');
    }

    if (id !== 'lessonPage') {
        const video = document.getElementById('lessonVideo');
        if (video) video.src = "";
    }

    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));
    
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (id === 'loginPage' || id === 'certificatePage' || id === 'adminLoginPage') {
                navbar.style.display = 'none';
            } else {
                navbar.style.display = 'flex';
            }
        }

        if (id === 'dashboardPage') renderDashboard();
        if (id === 'profilePage') renderProfile();
        if (id === 'adminDashboardPage') renderAdminDashboard();
        
        window.scrollTo(0, 0);
    }
}
window.showPage = showPage;

function login() {
    const nameInput = document.getElementById('nameInput');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) return alert("ILTIMOS, ISM VA FAMILIYANGIZNI KIRITING!");
    
    foydalanuvchi = name;
    localStorage.setItem('cyber_user_name', foydalanuvchi);
    progress = userProgressMap[name] || 0;
    
    updateUserStats(name, 'login');
    showDashboard();
}
window.login = login;

function adminLogin() {
    const userEl = document.getElementById('adminUser');
    const passEl = document.getElementById('adminPass');
    if (!userEl || !passEl) return;
    
    const user = userEl.value;
    const pass = passEl.value;

    if (user === 'xujaqulov01' && pass === 'admin777') {
        isAdmin = true;
        sessionStorage.setItem('vd_admin', 'true');
        showPage('adminDashboardPage');
    } else {
        alert("XATO LOGIN YOKI PAROL!");
    }
}
window.adminLogin = adminLogin;

function showDashboard() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.innerText = "XUSH KELIBSIZ, " + foydalanuvchi.toUpperCase() + "_";
    showPage('dashboardPage');
}

function logout() {
    if (confirm("Tizimdan chiqishni xohlaysizmi?")) {
        localStorage.removeItem('cyber_user_name');
        sessionStorage.removeItem('vd_admin');
        window.location.reload();
    }
}

function updateUserStats(user, action, details) {
    if (!userStats[user]) {
        userStats[user] = {
            viewed: [],
            tests: {},
            lastSeen: new Date().toLocaleString()
        };
    }
    
    const stats = userStats[user];
    stats.lastSeen = new Date().toLocaleString();

    if (action === 'view') {
        if (stats.viewed.indexOf(details) === -1) {
            stats.viewed.push(details);
        }
    } else if (action === 'test') {
        stats.tests[details.id] = details.percent;
    }

    localStorage.setItem('vd_user_stats', JSON.stringify(userStats));
}

function renderDashboard() {
    const grid = document.getElementById('lessonGrid');
    if (!grid) return;
    grid.innerHTML = "";

    darslar.forEach((d, i) => {
        const isLocked = i > progress;
        const card = document.createElement('div');
        card.className = "lesson-card" + (isLocked ? " locked" : "");
        
        const videoId = getYoutubeID(d.v);
        const thumb = "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg";

        card.innerHTML = 
            (isLocked ? '<div class="lock-overlay">🔒</div>' : '') +
            '<img src="' + thumb + '" class="lesson-thumb" alt="' + d.t + '">' +
            '<div class="lesson-content">' +
                '<h3 class="lesson-title">' + d.t + '</h3>' +
                '<p class="lesson-desc">' + (d.description || "") + '</p>' +
                '<div style="margin-top: 1rem; color: var(--primary); font-weight: 700;">' +
                    (isLocked ? 'Yopiq' : 'Boshlash ▶') +
                '</div>' +
            '</div>';

        if (!isLocked) {
            card.onclick = function() { window.openLesson(i); };
        }
        grid.appendChild(card);
    });
}

window.openLesson = function(index) {
    const d = darslar[index];
    joriyDars = d;
    document.getElementById('lessonTitle').innerText = d.t;
    const videoId = getYoutubeID(d.v);
    document.getElementById('lessonVideo').src = "https://www.youtube.com/embed/" + videoId + "?autoplay=1";
    updateUserStats(foydalanuvchi, 'view', d.t);
    showPage('lessonPage');
}

window.toggleAdminView = function(view) {
    const sections = document.querySelectorAll('.admin-view-section');
    sections.forEach(s => s.style.display = 'none');
    if (view === 'modules') {
        document.getElementById('adminModulesList').style.display = 'block';
    } else {
        document.getElementById('adminUsersList').style.display = 'block';
        renderUserStats();
    }
}

function renderAdminDashboard() {
    const list = document.getElementById('adminModulesList');
    if (!list) return;
    let html = '<table class="admin-table"><thead><tr><th>MODUL NOMI</th><th style="text-align: center;">BOSHQARUV</th></tr></thead><tbody>';

    darslar.forEach((d, i) => {
        html += '<tr><td style="font-weight: 600;">' + d.t + '</td>' +
                '<td style="text-align: center; display: flex; gap: 0.5rem; justify-content: center;">' +
                    '<button class="btn btn-primary" style="padding: 8px 15px; font-size: 0.75rem;" onclick="openModuleModal(' + i + ')">TAHRIRLASH</button>' +
                    '<button class="btn btn-outline" style="padding: 8px 15px; font-size: 0.75rem; border-color: var(--secondary); color: var(--secondary);" onclick="openTestManager(' + d.id + ')">TESTLAR</button>' +
                    '<button class="btn btn-outline" style="padding: 8px 15px; font-size: 0.75rem; border-color: var(--accent); color: var(--accent);" onclick="deleteModule(' + i + ')">O\'CHIRISH</button>' +
                '</td></tr>';
    });

    html += '</tbody></table>';
    list.innerHTML = html;
}

function renderUserStats() {
    const body = document.getElementById('userStatsBody');
    if (!body) return;
    body.innerHTML = "";

    Object.keys(userStats).forEach(user => {
        const stats = userStats[user];
        const tr = document.createElement('tr');
        
        let testsHtml = "";
        if (stats.tests) {
            Object.entries(stats.tests).forEach(([id, percent]) => {
                testsHtml += "Modul " + id + ": " + percent + "% <br>";
            });
        }

        tr.innerHTML = '<td><strong>' + user.toUpperCase() + '</strong><br><small style="color: #666;">Oxirgi faollik: ' + stats.lastSeen + '</small></td>' +
                       '<td>' + (stats.viewed ? stats.viewed.length : 0) + ' ta dars</td>' +
                       '<td>' + (testsHtml || 'Hali yo\'q') + '</td>' +
                       '<td style="text-align: center;"><button class="btn btn-outline" style="color: var(--accent); border-color: var(--accent); font-size: 0.7rem;" onclick="deleteUserStats(\'' + user + '\')">TOZALASH</button></td>';
        body.appendChild(tr);
    });
}

window.deleteUserStats = function(user) {
    if (confirm(user + " ma'lumotlarini o'chirmoqchimisiz?")) {
        delete userStats[user];
        localStorage.setItem('vd_user_stats', JSON.stringify(userStats));
        renderUserStats();
    }
}

window.openModuleModal = function(index = -1) {
    const modal = document.getElementById('moduleModal');
    const title = document.getElementById('modalTitle');
    const editId = document.getElementById('editModuleId');
    
    if (index === -1) {
        title.innerText = "YANGI DARS QO'SHISH";
        editId.value = "-1";
        document.getElementById('modTitle').value = "";
        document.getElementById('modVideo').value = "";
        document.getElementById('modDesc').value = "";
    } else {
        const d = darslar[index];
        title.innerText = "DARS TAHRIRLASH";
        editId.value = index;
        document.getElementById('modTitle').value = d.t;
        document.getElementById('modVideo').value = d.v;
        document.getElementById('modDesc').value = d.description || "";
    }
    modal.style.display = "flex";
}

window.closeModuleModal = function() {
    document.getElementById('moduleModal').style.display = "none";
}

window.saveModule = function() {
    const index = parseInt(document.getElementById('editModuleId').value);
    const title = document.getElementById('modTitle').value.trim();
    const video = document.getElementById('modVideo').value.trim();
    const desc = document.getElementById('modDesc').value.trim();

    if (!title || !video) return alert("Sarlavha va Video link shart!");

    if (index === -1) {
        const newId = darslar.length > 0 ? Math.max.apply(null, darslar.map(function(d) { return d.id; })) + 1 : 1;
        darslar.push({ id: newId, t: title, v: video, description: desc });
        testlar[newId] = [];
    } else {
        darslar[index].t = title;
        darslar[index].v = video;
        darslar[index].description = desc;
    }

    persistData();
    closeModuleModal();
    renderAdminDashboard();
}

window.deleteModule = function(index) {
    if (confirm("Ushbu darsni o'chirmoqchimisiz?")) {
        const id = darslar[index].id;
        darslar.splice(index, 1);
        delete testlar[id];
        persistData();
        renderAdminDashboard();
    }
}

let currentEditingModuleId = null;

window.openTestManager = function(moduleId) {
    currentEditingModuleId = moduleId;
    const modal = document.getElementById('testManagerModal');
    const list = document.getElementById('questionsList');
    const questions = testlar[moduleId] || [];

    let html = "";
    questions.forEach((q, i) => {
        html += '<div class="card q-card" style="background: rgba(0,0,0,0.6); border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">' +
                '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">' +
                '<strong style="color: var(--primary);">SAVOL #' + (i+1) + '</strong>' +
                '<button class="btn btn-outline" style="color: var(--accent); border-color: var(--accent); padding: 5px 15px; font-size: 0.8rem;" onclick="removeQuestion(' + i + ')">O\'CHIRISH_</button>' +
                '</div>' +
                '<input type="text" class="input-field q-text" placeholder="Savol matni..." value="' + q.q + '" style="background: rgba(255,255,255,0.05); margin-bottom: 1rem;">' +
                '<div style="display: flex; flex-direction: column; gap: 0.8rem;">' +
                    '<div style="display: flex; align-items: center; gap: 10px;">' +
                        '<input type="radio" name="correct_' + i + '" value="0" ' + (q.c === q.a[0] ? 'checked' : '') + '>' +
                        '<input type="text" class="input-field q-ans" placeholder="Variant A" value="' + (q.a[0] || '') + '" style="margin:0;">' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 10px;">' +
                        '<input type="radio" name="correct_' + i + '" value="1" ' + (q.c === q.a[1] ? 'checked' : '') + '>' +
                        '<input type="text" class="input-field q-ans" placeholder="Variant B" value="' + (q.a[1] || '') + '" style="margin:0;">' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 10px;">' +
                        '<input type="radio" name="correct_' + i + '" value="2" ' + (q.c === q.a[2] ? 'checked' : '') + '>' +
                        '<input type="text" class="input-field q-ans" placeholder="Variant C" value="' + (q.a[2] || '') + '" style="margin:0;">' +
                    '</div>' +
                '</div>' +
                '</div>';
    });
    list.innerHTML = html;
    modal.style.display = "flex";
}

window.addQuestion = function() {
    const list = document.getElementById('questionsList');
    const i = list.children.length;
    const div = document.createElement('div');
    div.className = "card q-card";
    div.style.background = "rgba(0,0,0,0.6)";
    div.style.border = "1px solid var(--glass-border)";
    div.style.marginBottom = "1.5rem";
    div.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">' +
                    '<strong style="color: var(--primary);">YANGI SAVOL</strong>' +
                    '<button class="btn btn-outline" style="color: var(--accent); border-color: var(--accent); padding: 5px 15px; font-size: 0.8rem;" onclick="this.parentElement.parentElement.remove()">O\'CHIRISH_</button>' +
                    '</div>' +
                    '<input type="text" class="input-field q-text" placeholder="Savol matni..." style="background: rgba(255,255,255,0.05); margin-bottom: 1rem;">' +
                    '<div style="display: flex; flex-direction: column; gap: 0.8rem;">' +
                        '<div style="display: flex; align-items: center; gap: 10px;">' +
                            '<input type="radio" name="correct_' + i + '" value="0" checked>' +
                            '<input type="text" class="input-field q-ans" placeholder="Variant A" style="margin:0;">' +
                        '</div>' +
                        '<div style="display: flex; align-items: center; gap: 10px;">' +
                            '<input type="radio" name="correct_' + i + '" value="1">' +
                            '<input type="text" class="input-field q-ans" placeholder="Variant B" style="margin:0;">' +
                        '</div>' +
                        '<div style="display: flex; align-items: center; gap: 10px;">' +
                            '<input type="radio" name="correct_' + i + '" value="2">' +
                            '<input type="text" class="input-field q-ans" placeholder="Variant C" style="margin:0;">' +
                        '</div>' +
                    '</div>';
    list.appendChild(div);
}

window.removeQuestion = function(index) {
    const questions = testlar[currentEditingModuleId];
    questions.splice(index, 1);
    openTestManager(currentEditingModuleId);
}

window.saveTests = function() {
    const list = document.getElementById('questionsList').children;
    const newQuestions = [];

    for (let i = 0; i < list.length; i++) {
        const card = list[i];
        const q = card.querySelector('.q-text').value.trim();
        const ansInputs = card.querySelectorAll('.q-ans');
        const ans = [];
        for (let j = 0; j < ansInputs.length; j++) { ans.push(ansInputs[j].value.trim()); }
        
        const radios = card.querySelectorAll('input[type="radio"]');
        let correctIdx = 0;
        for (let r = 0; r < radios.length; r++) {
            if (radios[r].checked) { correctIdx = r; break; }
        }
        const correct = ans[correctIdx];

        if (q && correct) {
            newQuestions.push({ q: q, a: ans, c: correct });
        }
    }

    testlar[currentEditingModuleId] = newQuestions;
    persistData();
    closeTestManager();
}

window.closeTestManager = function() {
    document.getElementById('testManagerModal').style.display = "none";
}

function persistData() {
    localStorage.setItem('vd_darslar', JSON.stringify(darslar));
    localStorage.setItem('vd_testlar', JSON.stringify(testlar));
}

window.startTest = function() {
    const video = document.getElementById('lessonVideo');
    if (video) video.src = "";

    const container = document.getElementById('testContent');
    const questions = testlar[joriyDars.id];
    
    if (!questions || questions.length === 0) return alert("Ushbu dars uchun testlar hali qo'shilmagan!");

    let html = "";
    questions.forEach((q, i) => {
        let optionsHtml = "";
        q.a.forEach(opt => {
            optionsHtml += '<label class="option-label"><input type="radio" name="q' + i + '" value="' + opt + '"> ' + opt + '</label>';
        });
        html += '<div class="card" style="margin-bottom: 1.5rem; background: rgba(0,0,0,0.5);">' +
                '<p style="font-size: 1.1rem; margin-bottom: 1rem;">' + (i+1) + '. ' + q.q + '</p>' +
                '<div class="test-options">' + optionsHtml + '</div></div>';
    });
    container.innerHTML = html;
    showPage('testPage');
}
window.startTest = window.startTest;

window.submitTest = function() {
    const questions = testlar[joriyDars.id];
    let correct = 0;

    questions.forEach((q, i) => {
        const selected = document.querySelector('input[name="q' + i + '"]:checked');
        if (selected && selected.value === q.c) correct++;
    });

    const percent = Math.round((correct / questions.length) * 100);
    updateUserStats(foydalanuvchi, 'test', { id: joriyDars.id, percent: percent });
    renderResult(percent);
}

function renderResult(percent) {
    const msg = document.getElementById('resultMsg');
    const actionBtn = document.getElementById('resultActionBtn');
    const percentEl = document.getElementById('resultPercent');
    
    percentEl.innerText = percent + "%";
    
    if (percent >= 60) {
        msg.innerText = "TABRIKLAYMIZ! BOSQICH MUVAFFAQIYATLI YAKUNLANDI.";
        msg.style.color = "var(--primary)";
        
        let currentIndex = -1;
        for (let i = 0; i < darslar.length; i++) { if (darslar[i].id === joriyDars.id) { currentIndex = i; break; } }

        if (progress <= currentIndex) {
            progress = currentIndex + 1;
            userProgressMap[foydalanuvchi] = progress;
            localStorage.setItem('vd_user_progress', JSON.stringify(userProgressMap));
        }

        if (progress >= darslar.length) {
            actionBtn.innerText = "YAKUNIY SERTIFIKATNI OLISH";
            actionBtn.onclick = function() { showPage('profilePage'); };
        } else {
            actionBtn.innerText = "KEYINGI MODULGA O'TISH";
            actionBtn.onclick = function() { showPage('dashboardPage'); };
        }
    } else {
        msg.innerText = "NATIJA YETARLI EMAS. QAYTADAN O'RING!";
        msg.style.color = "var(--accent)";
        actionBtn.innerText = "DARSGA QAYTISH";
        actionBtn.onclick = function() {
            window.openLesson(darslar.indexOf(joriyDars));
        };
    }
    showPage('resultPage');
}

function renderProfile() {
    document.getElementById('profileName').innerText = foydalanuvchi.toUpperCase();
    document.getElementById('profileProgressText').innerText = "O'ZLASHTIRISH: " + progress + "/" + darslar.length + " MODUL";
    
    const certList = document.getElementById('profileCertificates');
    certList.innerHTML = "";

    for (let i = 0; i < progress; i++) {
        const d = darslar[i];
        if (!d) continue;
        const card = document.createElement('div');
        card.className = "card";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";
        card.innerHTML = '<div><h4 style="color: var(--primary);">' + d.t + '</h4><p style="font-size: 0.8rem; color: var(--text-dim);">TAMOMLANDI: ✅</p></div><div style="font-size: 2rem;">🎖️</div>';
        certList.appendChild(card);
    }

    if (progress >= darslar.length && darslar.length > 0) {
        const finalBtn = document.createElement('button');
        finalBtn.className = "btn btn-primary";
        finalBtn.style.width = "100%";
        finalBtn.style.marginTop = "1rem";
        finalBtn.innerText = "ASOSIY SERTIFIKATNI GENERATSIYA QILISH";
        finalBtn.onclick = generateFinalCertificate;
        certList.appendChild(finalBtn);
    }
}

function generateFinalCertificate() {
    document.getElementById('certNameDisplay').innerText = foydalanuvchi.toUpperCase();
    const now = new Date();
    document.getElementById('certDate').innerText = now.getDate() + "." + (now.getMonth()+1) + "." + now.getFullYear();
    
    const qrContainer = document.getElementById('certQR');
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: "https://videodarslik.uz/verify/" + foydalanuvchi.replace(/ /g, '_'),
        width: 120,
        height: 120
    });
    showPage('certificatePage');
}

window.downloadPDF = async function() {
    const element = document.getElementById('certToExport');
    const { jsPDF } = window.jspdf;
    html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'px', [canvas.width, canvas.height]);
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save("VideoDarslik_" + foydalanuvchi + ".pdf");
    });
}

function handleEncrypt() {
    const matn = document.getElementById('cipherIn').value;
    const kalit = document.getElementById('cipherKey').value;
    const res = shifrlashVigenere(matn, kalit);
    if (res.error) return alert(res.error);
    document.getElementById('cipherOut').value = res.natijaStr;
    renderCipherTable(res.qatorNomlari, res.ustunlar);
}

function handleDecrypt() {
    const matn = document.getElementById('cipherIn').value;
    const kalit = document.getElementById('cipherKey').value;
    const res = deshifrlashVigenere(matn, kalit);
    if (res.error) return alert(res.error);
    document.getElementById('cipherOut').value = res.natijaStr;
    renderCipherTable(res.qatorNomlari, res.ustunlar);
}

function renderCipherTable(headers, rows) {
    const container = document.getElementById('cipherTableBox');
    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-family: monospace;">';
    headers.forEach((h, i) => {
        html += '<tr><th style="border: 1px solid var(--primary); padding: 5px; background: rgba(0,255,65,0.1);">' + h + '</th>';
        rows.forEach(row => {
            html += '<td style="border: 1px solid var(--primary); padding: 5px; text-align: center;">' + row[i] + '</td>';
        });
        html += '</tr>';
    });
    html += '</table>';
    container.innerHTML = html;
}

function clearCipher() {
    document.getElementById('cipherIn').value = "";
    document.getElementById('cipherKey').value = "";
    document.getElementById('cipherOut').value = "";
    document.getElementById('cipherTableBox').innerHTML = "";
}

function copyCipher() {
    const out = document.getElementById('cipherOut');
    out.select();
    document.execCommand('copy');
    alert("Nusxalandi!");
}

function getYoutubeID(url) {
    if (!url) return "";
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : url.split('/').pop();
}
