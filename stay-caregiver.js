// stay-caregiver.js - 照服員端外宿申請

// 全域變數
let statusMap = {};           // statusId -> { name, color }
let currentApplicantId = null;
let currentApplicantName = null;
let commentModal;
let currentAppIdForComment = null;

document.addEventListener('firebase-ready', () => {
    initStayCaregiver();
});

async function initStayCaregiver() {
    // Firebase 已初始化，db 可直接使用
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
}

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
function updateCurrentApplicant(selectEl) {
    currentApplicantId = selectEl.value || null;
    currentApplicantName = selectEl.selectedOptions[0]?.textContent || '';
    if (currentApplicantId) {
        localStorage.setItem('stayApplicantId', currentApplicantId);
        localStorage.setItem('stayApplicantName', currentApplicantName);
    }
}


async function loadApplicants(selectEl) {
    const employees = [];
    const collections = ['caregivers'];

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
