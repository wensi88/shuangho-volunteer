// ============================================================
// 雙和醫院四下志工管理系統 - 前端應用程式
// ============================================================

let currentUser = null;
let allVolunteers = [];

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initAuth();
});

// ===== Tab 切換 =====
function initTabs() {
    document.querySelectorAll('nav a[data-tab]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });
    // 初始載入預設分頁
    switchTab('status');
}

function switchTab(tab) {
    document.querySelectorAll('nav a[data-tab]').forEach(l => l.classList.remove('active'));
    document.querySelector(`nav a[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');

    if (tab === 'status') loadStatusBoard();
    else if (tab === 'leave') loadLeavePage();
    else if (tab === 'roster') loadRoster();
    else if (tab === 'contact') loadContactGroups();
}

// ===== Auth =====
function initAuth() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
        const bar = document.getElementById('userBar');
        if (user) {
            bar.innerHTML = `<span class="logged-in"><span>👤 ${user.email || '志工'}</span>
                <button onclick="logout()">登出</button></span>`;
            // 檢查是否為管理員
            if (user.email === 'wensijou88@gmail.com') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
            }
        } else {
            bar.innerHTML = '<button onclick="login()">🔑 志工登入</button>';
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
        loadAllVolunteers();
        // 登入後重新載入當前分頁資料
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabId = activeTab.id.replace('tab-', '');
            if (tabId === 'status') loadStatusBoard();
            else if (tabId === 'leave') loadLeavePage();
            else if (tabId === 'roster') loadRoster();
            else if (tabId === 'contact') loadContactGroups();
        }
    });
}

function login() {
    const email = prompt('請輸入電子郵件登入：');
    if (!email) return;
    const password = prompt('請輸入密碼（首次使用將自動註冊）：');
    if (!password) return;

    // 先嘗試登入
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                // 自動註冊
                return auth.createUserWithEmailAndPassword(email, password);
            }
            throw err;
        })
        .then(() => toast('登入成功 ✅', 'success'))
        .catch(err => toast('登入失敗：' + err.message, 'error'));
}

function logout() {
    auth.signOut();
    toast('已登出');
    loadAllVolunteers();
}

// ===== 載入所有志工列表 =====
function loadAllVolunteers() {
    db.collection('volunteers').orderBy('name').onSnapshot(snapshot => {
        allVolunteers = [];
        snapshot.forEach(doc => {
            allVolunteers.push({ id: doc.id, ...doc.data() });
        });
        // 更新各頁面
        populateVolunteerSelects();
        if (document.getElementById('tab-leave').classList.contains('active')) loadLeavePage();
    }, err => {
        console.error('載入志工失敗:', err);
    });
}

function populateVolunteerSelects() {
    const selects = document.querySelectorAll('#leaveVolunteer');
    selects.forEach(sel => {
        sel.innerHTML = '<option value="">請選擇</option>';
        allVolunteers.forEach(v => {
            sel.innerHTML += `<option value="${v.id}">${v.name} (${v.shift || ''})</option>`;
        });
    });
}

// ===== 即時狀態板 =====
let statusUnsubscribe = null;
function loadStatusBoard() {
    const board = document.getElementById('statusBoard');
    board.innerHTML = '<div class="loading">🔄 即時載入中...</div>';

    if (statusUnsubscribe) statusUnsubscribe();
    statusUnsubscribe = db.collection('leaves')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            const leaves = {};
            snapshot.forEach(doc => {
                const d = doc.data();
                if (!leaves[d.date]) leaves[d.date] = [];
                d.id = doc.id;
                leaves[d.date].push(d);
            });

            if (Object.keys(leaves).length === 0) {
                board.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:#aaa;">✅ 目前無請假紀錄</div>';
                return;
            }

            const dates = Object.keys(leaves).sort().reverse();
            board.innerHTML = dates.map(date => {
                const items = leaves[date];
                const absentCount = items.filter(l => l.status === '請假').length;
                const subCount = items.filter(l => l.status === '代班').length;
                const presentCount = items.filter(l => l.status === '出勤').length;

                return `
                <div class="status-date-group">
                    <div class="status-date-header">
                        <span>📅 ${date}</span>
                        <span class="count">
                            ✅出勤 ${presentCount} | ❌請假 ${absentCount} | 🔄代班 ${subCount}
                        </span>
                    </div>
                    <div class="status-volunteers">
                        ${items.map(item => `
                            <div class="status-row">
                                <div class="status-avatar">${item.volunteerName ? item.volunteerName[0] : '👤'}</div>
                                <div class="status-info">
                                    <div class="status-name">${item.volunteerName || '未知'}</div>
                                    <div class="status-shift">${item.shift || ''} · ${item.reason || ''}</div>
                                </div>
                                <div class="status-badge ${item.status === '請假' ? 'absent' : item.status === '代班' ? 'substitute' : 'present'}">
                                    ${item.status === '請假' ? '❌ 請假' : item.status === '代班' ? '🔄 已代班' : '✅ 出勤'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }).join('');
        }, err => {
            board.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:#e74c3c;">⚠️ 載入失敗，請確認 Firebase 設定</div>';
            console.error(err);
        });
}

// ===== 請假申請 =====
function loadLeavePage() {
    populateVolunteerSelects();
    document.getElementById('leaveDate').value = new Date().toISOString().split('T')[0];

    // 載入請假歷史
    db.collection('leaves').orderBy('createdAt', 'desc').limit(20).get()
        .then(snapshot => {
            const history = document.getElementById('leaveHistory');
            if (snapshot.empty) {
                history.innerHTML = '<p style="color:#aaa;text-align:center;">尚無請假紀錄</p>';
                return;
            }
            history.innerHTML = snapshot.docs.map(doc => {
                const d = doc.data();
                const ts = d.createdAt ? new Date(d.createdAt.seconds * 1000) : new Date();
                return `
                <div class="leave-history-item">
                    <div class="lh-date">${d.date}</div>
                    <div class="lh-name">${d.volunteerName}</div>
                    <div style="flex:1">${d.shift}</div>
                    <span class="status-badge ${d.status === '請假' ? 'absent' : 'substitute'}">${d.status}</span>
                    <div class="lh-reason">${d.reason || ''}</div>
                    <div style="font-size:0.8em;color:#bbb">${ts.toLocaleString('zh-TW')}</div>
                    ${currentUser && currentUser.email === 'wensijou88@gmail.com' ? 
                        `<button onclick="deleteLeave('${doc.id}')" style="background:#e74c3c;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;">刪除</button>` : ''}
                </div>`;
            }).join('');
        });
}

document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const volunteerId = document.getElementById('leaveVolunteer').value;
    const date = document.getElementById('leaveDate').value;
    const shift = document.getElementById('leaveShift').value;
    const needSub = document.getElementById('needSub').value;
    const reason = document.getElementById('leaveReason').value;
    const note = document.getElementById('leaveNote').value;

    if (!volunteerId || !date || !shift) {
        toast('請填寫所有必填欄位', 'error');
        return;
    }

    const volunteer = allVolunteers.find(v => v.id === volunteerId);

    const leaveData = {
        volunteerId: volunteerId,
        volunteerName: volunteer ? volunteer.name : '未知',
        date: date,
        shift: shift,
        needSub: needSub,
        reason: reason,
        note: note,
        status: '請假',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = this.querySelector('button');
    btn.disabled = true;
    btn.textContent = '⏳ 送出中...';

    db.collection('leaves').add(leaveData)
        .then(() => {
            toast('請假申請已送出 ✅', 'success');
            this.reset();
            document.getElementById('leaveDate').value = new Date().toISOString().split('T')[0];
            loadLeavePage();
        })
        .catch(err => {
            toast('送出失敗：' + err.message, 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '✅ 送出請假申請';
        });
});

function deleteLeave(id) {
    if (!confirm('確定刪除此筆請假紀錄？')) return;
    db.collection('leaves').doc(id).delete()
        .then(() => toast('已刪除 ✅', 'success'))
        .catch(err => toast('刪除失敗', 'error'));
}

// ===== 志工名冊 =====
function loadRoster() {
    const list = document.getElementById('rosterList');
    if (allVolunteers.length === 0) {
        list.innerHTML = '<div class="loading">尚無志工資料</div>';
        return;
    }
    list.innerHTML = `
    <div class="card" style="overflow-x:auto;">
        <table class="roster-table">
            <thead>
                <tr>
                    <th>姓名</th>
                    <th>班別</th>
                    <th>群組</th>
                    <th>電話</th>
                    <th>LINE</th>
                    <th>Email</th>
                </tr>
            </thead>
            <tbody>
                ${allVolunteers.map(v => `
                    <tr>
                        <td><strong>${v.name}</strong></td>
                        <td>${v.shift || '-'}</td>
                        <td>${v.group || '-'}</td>
                        <td>${v.phone || '-'}</td>
                        <td>${v.line || '-'}</td>
                        <td>${v.email || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ===== 聯絡群組 =====
function loadContactGroups() {
    if (allVolunteers.length === 0) {
        document.getElementById('contactGroups').innerHTML = '<div class="loading">尚無志工資料</div>';
        return;
    }

    const groups = {};
    allVolunteers.forEach(v => {
        const g = v.group || '未分組';
        if (!groups[g]) groups[g] = [];
        groups[g].push(v);
    });

    document.getElementById('contactGroups').innerHTML = Object.entries(groups).map(([gname, members]) => `
        <div class="contact-group-card">
            <h3>📋 ${gname}（${members.length}人）</h3>
            ${members.map(m => `
                <div class="contact-member">
                    <span>👤</span>
                    <strong style="min-width:80px">${m.name}</strong>
                    <span>📞 <a href="tel:${m.phone || ''}">${m.phone || '-'}</a></span>
                    ${m.line ? `<span>💬 LINE: ${m.line}</span>` : ''}
                    <span style="margin-left:auto;font-size:0.85em;color:#888">${m.shift || ''}</span>
                </div>
            `).join('')}
        </div>
    `).join('');
}

// ===== 新增志工（管理者） =====
document.getElementById('addVolunteerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!currentUser || currentUser.email !== 'wensijou88@gmail.com') {
        toast('權限不足', 'error');
        return;
    }

    const data = {
        name: document.getElementById('newName').value,
        phone: document.getElementById('newPhone').value,
        email: document.getElementById('newEmail').value,
        line: document.getElementById('newLine').value,
        shift: document.getElementById('newShift').value,
        group: document.getElementById('newGroup').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('volunteers').add(data)
        .then(() => {
            toast('志工已新增 ✅', 'success');
            this.reset();
        })
        .catch(err => toast('新增失敗：' + err.message, 'error'));
});

// ===== Toast 通知 =====
function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
