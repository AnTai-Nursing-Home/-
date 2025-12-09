// stay-caregiver.js - 照服員端外宿申請系統

// 全域變數（db 由 firebase-init.js 提供，不在此重新宣告）
let statusMap = {};           // statusId -> { id, name, color }
let currentApplicantId = null;
let currentApplicantName = null;
let commentModal = null;
let currentAppIdForComment = null;

// 安全取得多語系文字的工具函式
function getTextSafe(key, fallback) {
    if (typeof getText === 'function') {
        return getText(key);
    }
    return fallback !== undefined ? fallback : key;
}

// 等 firebase-init.js 初始化完成後再啟動本頁邏輯
document.addEventListener("firebase-ready", () => {
    initStayCaregiver();
});

// 主要初始化流程（async，可使用 await）
async function initStayCaregiver() {
    console.log("stay-caregiver 初始化...");
    try {
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
                alert(getTextSafe('stay_submit_success', '外宿申請已送出'));
            } catch (err) {
                console.error(err);
                alert(err.message || getTextSafe('stay_submit_failed', '申請失敗，請稍後再試'));
            }
        });

        btnRefresh.addEventListener('click', async () => {
            await loadMyApps(stayTableBody);
        });

        document.getElementById('btnSaveComment').addEventListener('click', saveCommentFromModal);

        await loadMyApps(stayTableBody);
        // 初始化完成後套用目前語系文字
        if (typeof applyTranslations === 'function') {
            applyTranslations();
        }
    } catch (err) {
        console.error("initStayCaregiver 發生錯誤：", err);
    }
}

// --- 日期相關工具 ---

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

function formatDateTime(d) {
    if (!d) return '';
    if (d.toDate) d = d.toDate();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- 狀態定義 ---

async function loadStatusDefs() {
    statusMap = {};
    try {
        const snap = await db.collection('stayStatusDefs').orderBy('order', 'asc').get();
        if (snap.empty) {
            // 若尚未建立，提供三個預設狀態
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
    } catch (e) {
        console.warn('讀取 stayStatusDefs 失敗，改用預設狀態', e);
        statusMap = {
            pending: { id: 'pending', name: '待審核', color: '#6c757d' },
            approved: { id: 'approved', name: '核准', color: '#198754' },
            rejected: { id: 'rejected', name: '退回', color: '#dc3545' },
        };
    }
}

// --- 申請人下拉（只抓 caregivers） ---

async function loadApplicants(selectEl) {
    const employees = [];
    const collections = ['caregivers'];  // 依你的需求，只抓 caregivers

    for (const colName of collections) {
        try {
            const snap = await db.collection(colName)
                .orderBy('sortOrder', 'asc')
                .get();

            snap.forEach(doc => {
                const d = doc.data();
                const name = d.name || doc.id;
                employees.push({
                    id: doc.id,
                    name
                });
            });
        } catch (e) {
            console.warn('讀取集合失敗：' + colName, e);
        }
    }

    // 若 sortOrder 沒填，最後再用姓名排序一次避免亂序
    employees.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

    selectEl.innerHTML = '';
    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name;
        selectEl.appendChild(opt);
    });

    const savedId = localStorage.getItem('stayApplicantId');
    if (savedId && employees.some(e => e.id === savedId)) {
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

// --- 表單讀取 ---

function getFormData() {
    const startVal = document.getElementById('startDateTime').value;
    const endVal = document.getElementById('endDateTime').value;

    const startDateTime = new Date(startVal);
    const endDateTime = new Date(endVal);

    if (!startVal || isNaN(startDateTime.getTime())) {
        throw new Error(getTextSafe('stay_error_start_datetime_required', '請正確選擇起始日期時間'));
    }
    if (!endVal || isNaN(endDateTime.getTime())) {
        throw new Error(getTextSafe('stay_error_end_datetime_required', '請正確選擇結束日期時間'));
    }
    if (endDateTime <= startDateTime) {
        throw new Error(getTextSafe('stay_error_end_before_start', '結束時間必須晚於起始時間'));
    }
    if (!currentApplicantId) {
        throw new Error(getTextSafe('stay_error_select_applicant', '請先選擇申請人'));
    }

    const location = document.getElementById('location').value.trim();
    if (!location) {
        throw new Error(getTextSafe('stay_error_location_required', '請填寫外宿地點'));
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

// --- 規則檢查 ---

async function validateBusinessRulesForNewApplication(data) {
    const today = new Date();
    const minStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 0, 0, 0);
    if (data.startDateTime < minStart) {
        throw new Error(getTextSafe('stay_error_need_3days_advance', '外宿需提前三天申請，起始日期須在三天後'));
    }

    const days = enumerateDates(data.startDateTime, data.endDateTime);

    const overLimit = await checkTwoPerDayLimit(days);
    if (overLimit) {
        throw new Error(getTextSafe('stay_error_two_per_day_limit', '同一天外宿人數已達兩人上限，無法再申請'));
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

// Firestore 限制：同一個 query 不能對兩個不同欄位做不等式
// 所以這裡改成：只用 startDateTime 落在當天來判斷「同日」
// 代表規則是：「同一天起始的外宿申請不得超過兩人」
async function checkTwoPerDayLimit(days) {
    for (const d of days) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

        const snap = await db.collection('stayApplications')
            .where('startDateTime', '>=', dayStart)
            .where('startDateTime', '<=', dayEnd)
            .get();

        if (snap.size >= 2) {
            return true;
        }
    }
    return false;
}

async function checkConflictRules(applicantId, days) {
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
            const ruleName = rule.ruleName || getTextSafe('stay_conflict_default_group_name', '同組員工');
            return getTextSafe('stay_conflict_rule_msg', `${ruleName} 已設定不可同日外宿，請與主管討論後再安排。`).replace('{ruleName}', ruleName);
        }
    }
    return null;
}

async function checkOthersStayOnDays(others, days) {
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
                .where('startDateTime', '>=', dayStart)
                .where('startDateTime', '<=', dayEnd)
                .get();

            if (!snap.empty) return true;
        }
    }
    return false;
}

// --- 資料存取 ---

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
    if (!currentApplicantId) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${getTextSafe('stay_msg_select_applicant_first', '請先選擇申請人')}</td></tr>`;
        return;
    }
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${getTextSafe('stay_msg_loading', '載入中...')}</td></tr>`;

    const snap = await db.collection('stayApplications')
        .where('applicantId', '==', currentApplicantId)
        .orderBy('startDateTime', 'desc')
        .get();

    tbody.innerHTML = '';
    if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${getTextSafe('stay_msg_no_applications', '目前沒有外宿申請')}</td></tr>`;
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

// --- 註解相關 ---

async function openCommentModal(appId) {
    currentAppIdForComment = appId;
    document.getElementById('commentInput').value = '';
    document.getElementById('editingCommentId').value = '';
    const listEl = document.getElementById('commentList');
    listEl.innerHTML = `<li class="list-group-item text-center text-muted">${getTextSafe('stay_comment_loading', '載入中...')}</li>`;

    const snap = await db.collection('stayComments')
        .where('appId', '==', appId)
        .orderBy('createdAt', 'asc')
        .get();

    listEl.innerHTML = '';
    if (snap.empty) {
        listEl.innerHTML = `<li class="list-group-item text-center text-muted">${getTextSafe('stay_comment_none', '目前沒有註解')}</li>`;
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
                    if (!confirm(getTextSafe('stay_confirm_delete_comment', '確定要刪除這則註解嗎？'))) return;
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
        alert(getTextSafe('stay_error_select_applicant_for_comment', '請先選擇申請人'));
        return;
    }
    const content = document.getElementById('commentInput').value.trim();
    if (!content) {
        alert(getTextSafe('stay_error_comment_required', '請先輸入註解內容'));
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
