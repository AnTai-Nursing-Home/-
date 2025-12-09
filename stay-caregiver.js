// stay-caregiver.js - 照服員端外宿申請

// 全域變數
let db;
let statusMap = {};           // statusId -> { name, color }
let currentApplicantId = null;
let currentApplicantName = null;
let commentModal;
let currentAppIdForComment = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!firebase.apps.length) {
        console.error('Firebase 尚未初始化，請確認 firebase-init.js');
        return;
    }
    db = firebase.firestore();
    commentModal = new bootstrap.Modal(document.getElementById('commentModal'));

    const applicantSelect = document.getElementById('applicantSelect');
    const stayForm = document.getElementById('stayForm');
    const stayTableBody = document.querySelector('#stayTable tbody');
    const btnRefresh = document.getElementById('btnRefresh');

    await loadStatusDefs();
    await loadApplicants(applicantSelect);
    setMinDateForStart();

    stayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = getFormData();
            await validateBusinessRulesForNewApplication(data);
            await saveApplication(data);
            await loadMyApps(stayTableBody);
            stayForm.reset();
            setMinDateForStart();
            alert('外宿申請已送出');
        } catch (err) {
            console.error(err);
            alert(err.message || '申請失敗，請稍後再試');
        }
    });

    btnRefresh.addEventListener('click', async () => {
        await loadMyApps(stayTableBody);
    });

    document.getElementById('btnSaveComment').addEventListener('click', saveCommentFromModal);

    await loadMyApps(stayTableBody);
});

function setMinDateForStart() {
    const startInput = document.getElementById('startDateTime');
    const now = new Date();
    // 今天 + 3 天 的 00:00
    const min = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 0, 0, 0);
    startInput.min = toInputDateTime(min);
}

function toInputDateTime(d) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadStatusDefs() {
    statusMap = {};
    const snap = await db.collection('stayStatusDefs').orderBy('order', 'asc').get().catch(() => null);
    if (!snap || snap.empty) {
        // 若尚未建立，先提供三個預設狀態
        statusMap = {
            pending: { id: 'pending', name: '待審核', color: '#6c757d' },
            approved: { id: 'approved', name: '核准', color: '#198754' },
            rejected: { id: 'rejected', name: '退回', color: '#dc3545' },
        };
        return;
    }
    snap.forEach(doc => {
        const d = doc.data();
        statusMap[doc.id] = {
            id: doc.id,
            name: d.name || doc.id,
            color: d.color || '#6c757d'
        };
    });
}

async function loadApplicants(selectEl) {
    // 這裡示範：從 caregivers + localCaregivers 抓資料，並記錄在 localStorage
    const applicants = [];

    async function loadFromCollection(colName) {
        try {
            const snap = await db.collection(colName).get();
            snap.forEach(doc => {
                const d = doc.data();
                const name = d.name || d.displayName || d.fullName || doc.id;
                applicants.push({ id: doc.id, name });
            });
        } catch (e) {
            console.warn('讀取 ' + colName + ' 失敗，可自行調整程式或改用其他集合', e);
        }
    }

    await loadFromCollection('caregivers');
    await loadFromCollection('localCaregivers');

    // 排序
    applicants.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

    selectEl.innerHTML = '';
    applicants.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        selectEl.appendChild(opt);
    });

    // 若 localStorage 有之前選過的申請人，則預設選回
    const savedId = localStorage.getItem('stayApplicantId');
    if (savedId && applicants.some(a => a.id === savedId)) {
        selectEl.value = savedId;
    }
    updateCurrentApplicant(selectEl);

    selectEl.addEventListener('change', () => {
        updateCurrentApplicant(selectEl);
        loadMyApps(document.querySelector('#stayTable tbody'));
    });
}

function updateCurrentApplicant(selectEl) {
    currentApplicantId = selectEl.value || null;
    currentApplicantName = selectEl.selectedOptions[0]?.textContent || '';
    if (currentApplicantId) {
        localStorage.setItem('stayApplicantId', currentApplicantId);
        localStorage.setItem('stayApplicantName', currentApplicantName);
    }
}

function getFormData() {
    const startDateTime = new Date(document.getElementById('startDateTime').value);
    const endDateTime = new Date(document.getElementById('endDateTime').value);
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error('請正確選擇起訖日期時間');
    }
    if (endDateTime <= startDateTime) {
        throw new Error('結束時間必須晚於起始時間');
    }
    if (!currentApplicantId) {
        throw new Error('請先選擇申請人');
    }

    const location = document.getElementById('location').value.trim();
    if (!location) {
        throw new Error('請填寫外宿地點');
    }

    return {
        applicantId: currentApplicantId,
        applicantName: currentApplicantName,
        startDateTime,
        endDateTime,
        startShift: document.getElementById('startShift').value,
        endShift: document.getElementById('endShift').value,
        location,
        createdByRole: 'caregiver',
        createdByUserId: currentApplicantId
    };
}

// ------ 規則檢查 ------

async function validateBusinessRulesForNewApplication(data) {
    const today = new Date();
    const minStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 0, 0, 0);
    if (data.startDateTime < minStart) {
        throw new Error('外宿需提前三天申請，起始日期須在三天後');
    }

    const days = enumerateDates(data.startDateTime, data.endDateTime);

    const overLimit = await checkTwoPerDayLimit(days);
    if (overLimit) {
        throw new Error('同一天外宿人數已達兩人上限，無法再申請');
    }

    const conflictMsg = await checkConflictRules(data.applicantId, days);
    if (conflictMsg) {
        throw new Error(conflictMsg);
    }
}

function enumerateDates(start, end) {
    const dates = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= last) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

async function checkTwoPerDayLimit(days) {
    for (const d of days) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

        const snap = await db.collection('stayApplications')
            .where('startDateTime', '<=', dayEnd)
            .where('endDateTime', '>=', dayStart)
            .get();

        if (snap.size >= 2) {
            return true;
        }
    }
    return false;
}

async function checkConflictRules(applicantId, days) {
    // 找出所有包含 applicantId 的互斥規則
    const rulesSnap = await db.collection('stayConflictRules')
        .where('employeeIds', 'array-contains', applicantId)
        .get();

    if (rulesSnap.empty) return null;

    for (const ruleDoc of rulesSnap.docs) {
        const rule = ruleDoc.data();
        const memberIds = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
        const others = memberIds.filter(id => id !== applicantId);
        if (!others.length) continue;

        const hasConflict = await checkOthersStayOnDays(others, days);
        if (hasConflict) {
            const ruleName = rule.ruleName || '同組員工';
            return `${ruleName} 已設定不可同日外宿，請與主管討論後再安排。`;
        }
    }
    return null;
}

async function checkOthersStayOnDays(others, days) {
    // Firestore in 限制最多 10 筆
    const chunks = [];
    for (let i = 0; i < others.length; i += 10) {
        chunks.push(others.slice(i, i + 10));
    }

    for (const d of days) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

        for (const group of chunks) {
            const snap = await db.collection('stayApplications')
                .where('applicantId', 'in', group)
                .where('startDateTime', '<=', dayEnd)
                .where('endDateTime', '>=', dayStart)
                .get();

            if (!snap.empty) return true;
        }
    }
    return false;
}

// ------ 資料存取 ------

async function saveApplication(data) {
    await db.collection('stayApplications').add({
        applicantId: data.applicantId,
        applicantName: data.applicantName,
        startDateTime: firebase.firestore.Timestamp.fromDate(data.startDateTime),
        endDateTime: firebase.firestore.Timestamp.fromDate(data.endDateTime),
        startShift: data.startShift,
        endShift: data.endShift,
        location: data.location,
        statusId: 'pending',
        createdByRole: data.createdByRole,
        createdByUserId: data.createdByUserId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function loadMyApps(tbody) {
    if (!currentApplicantId) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">載入中...</td></tr>';

    const snap = await db.collection('stayApplications')
        .where('applicantId', '==', currentApplicantId)
        .orderBy('startDateTime', 'desc')
        .get();

    tbody.innerHTML = '';
    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">目前沒有外宿申請</td></tr>';
        return;
    }

    snap.forEach(doc => {
        const app = doc.data();
        const tr = document.createElement('tr');
        const start = app.startDateTime?.toDate?.() || new Date(app.startDateTime);
        const end = app.endDateTime?.toDate?.() || new Date(app.endDateTime);
        const status = statusMap[app.statusId] || { name: app.statusId || '—', color: '#6c757d' };

        tr.innerHTML = `
            <td>${app.applicantName || ''}</td>
            <td>${formatDateTime(start)}<br>~ ${formatDateTime(end)}</td>
            <td>${app.startShift || ''} → ${app.endShift || ''}</td>
            <td>${app.location || ''}</td>
            <td><span class="badge" style="background:${status.color}">${status.name}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" data-app-id="${doc.id}">
                    查看 / 編輯註解
                </button>
            </td>
        `;
        const btn = tr.querySelector('button');
        btn.addEventListener('click', () => openCommentModal(doc.id));
        tbody.appendChild(tr);
    });
}

function formatDateTime(d) {
    if (!d) return '';
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ------ 註解相關 ------

async function openCommentModal(appId) {
    currentAppIdForComment = appId;
    document.getElementById('commentInput').value = '';
    document.getElementById('editingCommentId').value = '';
    const listEl = document.getElementById('commentList');
    listEl.innerHTML = '<li class="list-group-item text-center text-muted">載入中...</li>';

    const snap = await db.collection('stayComments')
        .where('appId', '==', appId)
        .orderBy('createdAt', 'asc')
        .get();

    listEl.innerHTML = '';
    if (snap.empty) {
        listEl.innerHTML = '<li class="list-group-item text-center text-muted">目前沒有註解</li>';
    } else {
        snap.forEach(doc => {
            const c = doc.data();
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-start';
            const isMine = (c.authorRole === 'caregiver' && c.authorId === currentApplicantId);

            li.innerHTML = `
                <div class="me-2">
                    <div><strong>${c.authorName || ''}</strong> <span class="text-muted small">${formatDateTime(c.createdAt?.toDate?.() || new Date(c.createdAt))}</span></div>
                    <div class="mt-1">${(c.content || '').replace(/\n/g, '<br>')}</div>
                </div>
                <div class="ms-2 btn-group btn-group-sm" ${isMine ? '' : 'style="display:none"'}>
                    <button class="btn btn-outline-primary">編輯</button>
                    <button class="btn btn-outline-danger">刪除</button>
                </div>
            `;

            if (isMine) {
                const [editBtn, delBtn] = li.querySelectorAll('button');
                editBtn.addEventListener('click', () => {
                    document.getElementById('editingCommentId').value = doc.id;
                    document.getElementById('commentInput').value = c.content || '';
                });
                delBtn.addEventListener('click', async () => {
                    if (!confirm('確定要刪除這則註解嗎？')) return;
                    await db.collection('stayComments').doc(doc.id).delete();
                    openCommentModal(appId);
                });
            }

            listEl.appendChild(li);
        });
    }

    commentModal.show();
}

async function saveCommentFromModal() {
    if (!currentAppIdForComment) return;
    if (!currentApplicantId) {
        alert('請先選擇申請人');
        return;
    }
    const content = document.getElementById('commentInput').value.trim();
    if (!content) {
        alert('請先輸入註解內容');
        return;
    }
    const editingId = document.getElementById('editingCommentId').value;

    const payload = {
        appId: currentAppIdForComment,
        authorId: currentApplicantId,
        authorName: currentApplicantName,
        authorRole: 'caregiver',
        content,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingId) {
        await db.collection('stayComments').doc(editingId).update(payload);
    } else {
        await db.collection('stayComments').add({
            ...payload,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    document.getElementById('commentInput').value = '';
    document.getElementById('editingCommentId').value = '';
    await openCommentModal(currentAppIdForComment);
}

