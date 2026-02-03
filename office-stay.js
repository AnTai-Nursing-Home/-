// office-stay.js - 辦公室端外宿申請管理

/** 防 XSS：把文字安全地放進 innerHTML */
function escapeHtml(input) {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}




/* ===== 即時通知（參考照會系統） ===== */
const LS_NOTIFY_ENABLED = 'officeStay_notify_enabled';
const LS_LAST_SEEN = 'officeStay_last_seen';
let unsubStayRealtime = null;

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  try { return new Date(ts); } catch(_) { return null; }
}

function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const id = 't_' + Math.random().toString(16).slice(2);
  const html = `
    <div class="toast align-items-center text-bg-${type} border-0 mb-2" id="${id}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  const t = new bootstrap.Toast(el, { delay: 4500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function bumpLastSeen() {
  localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());
}
function getLastSeenDate() {
  const s = localStorage.getItem(LS_LAST_SEEN);
  const d = s ? new Date(s) : new Date(0);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function updateNotifyHint() {
  const hint = document.getElementById('notifyHint');
  if (!hint) return;
  if (!('Notification' in window)) {
    hint.textContent = '（此瀏覽器不支援通知）';
    return;
  }
  const p = Notification.permission;
  if (p === 'granted') hint.textContent = '（瀏覽器通知：已啟用）';
  else if (p === 'denied') hint.textContent = '（瀏覽器通知：已封鎖，可至瀏覽器設定解除）';
  else hint.textContent = '（瀏覽器通知：尚未授權）';
}

function initRealtimeNotificationUI() {
  const toggle = document.getElementById('notifyToggle');
  const btnAsk = document.getElementById('btnAskNotification');

  if (!toggle) return;

  // restore
  const saved = localStorage.getItem(LS_NOTIFY_ENABLED);
  toggle.checked = (saved === '1');
  if (toggle.checked && !localStorage.getItem(LS_LAST_SEEN)) bumpLastSeen();

  updateNotifyHint();

  if (btnAsk) {
    btnAsk.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        toast('此瀏覽器不支援通知', 'warning');
        return;
      }
      try {
        const perm = await Notification.requestPermission();
        updateNotifyHint();
        if (perm === 'granted') toast('已啟用瀏覽器通知', 'success');
        else toast('未授權瀏覽器通知（仍可使用頁面右上角 Toast）', 'info');
      } catch (e) {
        console.error(e);
        toast('啟用通知失敗：' + (e.message || e), 'danger');
      }
    });
  }

  toggle.addEventListener('change', () => {
    localStorage.setItem(LS_NOTIFY_ENABLED, toggle.checked ? '1' : '0');

    // 避免「第一次開啟」把既有舊單當新單狂跳：開啟時先把 lastSeen 置為現在
    if (toggle.checked) bumpLastSeen();

    startRealtimeIfEnabled(true);
    toast(toggle.checked ? '已開啟新外宿申請通知' : '已關閉通知', toggle.checked ? 'success' : 'secondary');
  });

  // start once
  startRealtimeIfEnabled(false);
}

function startRealtimeIfEnabled(forceRestart = false) {
  const toggle = document.getElementById('notifyToggle');
  const enabled = !!toggle?.checked;

  if (!enabled) {
    if (unsubStayRealtime) { try { unsubStayRealtime(); } catch(_) {} unsubStayRealtime = null; }
    return;
  }
  if (unsubStayRealtime && !forceRestart) return;

  if (unsubStayRealtime) { try { unsubStayRealtime(); } catch(_) {} unsubStayRealtime = null; }

  const lastSeen = getLastSeenDate();

  let isFirstSnapshot = true;

  unsubStayRealtime = db.collection('stayApplications')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snap) => {
      // Firestore 會先送一包「目前已有資料」的 snapshot。
      // 為避免第一次開啟就把舊單當新單狂跳：第一包只做初始化，不發通知。
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }

      let shouldReload = false;

      snap.docChanges().forEach((chg) => {
        if (chg.type !== 'added') return;

        const doc = { id: chg.doc.id, ...chg.doc.data() };

        // createdAt 優先，沒有就用 updatedAt；再沒有就跳過
        const created = tsToDate(doc.createdAt) || tsToDate(doc.updatedAt);
        if (!created) return;

        // 只通知：在 lastSeen 之後的新單，且不是辦公室自己新增的
        const createdByRole = (doc.createdByRole || '').toLowerCase();
        if (((created && created > lastSeen) || !created) && createdByRole !== 'office') {
          const start = tsToDate(doc.startDateTime);
          const end = tsToDate(doc.endDateTime);

          const title = '護理之家外宿系統通知：有新的外宿申請單';
          const body = `${doc.applicantName || ''}｜${formatDateTime(start)} ～ ${formatDateTime(end)}`;

          toast(`${title}：${body}`, 'info');

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body,
                icon: '/icons/notify-512.png',
                badge: '/icons/badge-72.png',
                tag: 'office-stay-notify',
                renotify: true
              });
            } catch (_) {}
          }

          shouldReload = true;
        }
      });

      if (shouldReload) {
        // 重新整理列表（讓辦公室立刻看到新單）
        loadApplicationsByFilter().catch(console.error);
      }
    }, (err) => {
      console.error('stayApplications realtime error:', err);
      toast('即時通知監聽失敗：' + (err.message || err), 'danger');
    });
}
/* ===== 即時通知 END ===== */

/** 按鈕載入狀態（避免使用者以為沒反應、避免重複送出） */
function setButtonLoading(btn, isLoading, loadingText = '儲存中...') {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}


document.addEventListener('firebase-ready', async () => {
    appModal = new bootstrap.Modal(document.getElementById('appModal'));
    commentModalOffice = new bootstrap.Modal(document.getElementById('commentModalOffice'));
    await loadEmployees();
    await loadStatusDefsOffice();
    await renderStatusTable();
    initStatusForm();
    initConflictForm();
    await renderConflictSettings();
    initAppSection();
    initCommentSection();
    initTabs();
    setDefaultFilterRange();
    await loadApplicationsByFilter();
    initRealtimeNotificationUI();
});
let statusMapOffice = {}; // id -> {id,name,color,order}
let allEmployees = [];    // {id,name}
let appModal;
let commentModalOffice;
let currentAppIdForCommentOffice = null;


// ---------- 基本工具 ----------

function formatDateTime(d) {
    if (!d) return '';
    if (d.toDate) d = d.toDate();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toInputDateTime(d) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

// ---------- 員工名單 ----------

async function loadEmployees() {
    allEmployees = [];

    const collections = ['caregivers'];

    for (const colName of collections) {
        try {
            const snap = await db.collection(colName)
                .orderBy('sortOrder', 'asc')
                .get();

            snap.forEach(doc => {
                const d = doc.data();
                // 離職員工不列入名單（資料保留，但不給選單抓到）
                if (d && d.isActive === false) return;
                const name = d.name || doc.id;
                allEmployees.push({
                    id: doc.id,
                    name,
                    collection: colName,
                    isActive: (d && d.isActive === false) ? false : true
                });
            });
        } catch (e) {
            console.warn('讀取集合失敗：' + colName, e);
        }
    }

    // sortOrder 之後再用姓名排序一次
    allEmployees.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

    // 1. 互斥名單多選
    const conflictSelect = document.getElementById('conflictEmployees');
    conflictSelect.innerHTML = '';
    allEmployees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name;
        conflictSelect.appendChild(opt);
    });

    // 2. 新增 / 編輯申請單用的申請人下拉
    const applicantSelectOffice = document.getElementById('applicantSelectOffice');
    applicantSelectOffice.innerHTML = '';
    allEmployees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name;
        applicantSelectOffice.appendChild(opt);
    });
}



// ---------- 照服員名冊（外籍・未離職） ----------

let rosterLoadedOnce = false;

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// 取得「今日外宿中」的 applicantId set（核准且日期涵蓋今日）
async function getTodayOutApplicantIdSet() {
    const today = new Date();
    const dayStart = startOfDay(today);

    let snap = null;
    try {
        // 主要策略：抓「核准」且 endDateTime >= 今日 00:00（再用前端補 startDateTime <= 今日 23:59）
        snap = await db.collection('stayApplications')
            .where('statusId', '==', 'approved')
            .where('endDateTime', '>=', firebase.firestore.Timestamp.fromDate(dayStart))
            .orderBy('endDateTime', 'asc')
            .get();
    } catch (e) {
        console.warn('名冊狀態判定查詢失敗，改用備援抓取核准單：', e);
        snap = await db.collection('stayApplications')
            .where('statusId', '==', 'approved')
            .get();
    }

    const dayEnd = endOfDay(today);
    const outSet = new Set();
    snap.forEach(doc => {
        const d = doc.data();
        if (!d) return;
        const s = d.startDateTime?.toDate ? d.startDateTime.toDate() : null;
        const e = d.endDateTime?.toDate ? d.endDateTime.toDate() : null;
        if (!s || !e) return;
        if (s <= dayEnd && e >= dayStart) {
            if (d.applicantId) outSet.add(d.applicantId);
        }
    });

    return outSet;
}

async function renderRoster() {
    const tbody = document.querySelector('#rosterTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">載入中...</td></tr>';

    // 只列 caregivers（外籍照服員），且未離職（isActive !== false）
    // loadEmployees() 已做過 isActive 過濾；但保險起見再過濾一次
    const activeForeign = (allEmployees || []).filter(e => e && e.collection === 'caregivers' && e.isActive !== false);

    // 取得今日外宿中名單
    const outSet = await getTodayOutApplicantIdSet();

    tbody.innerHTML = '';
    if (activeForeign.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">目前沒有在職的外籍照服員</td></tr>';
        return;
    }

    activeForeign.forEach((emp, idx) => {
        const isOut = outSet.has(emp.id);
        const badge = isOut
            ? '<span class="badge bg-warning text-dark">外宿中</span>'
            : '<span class="badge bg-success">於宿舍</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${escapeHtml(emp.name || '(未命名)')}</td>
            <td>${badge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function initTabs() {
    const tabs = document.querySelectorAll('#officeStayTabs .nav-link');
    const panes = document.querySelectorAll('#tabApps, #tabRoster, #tabStatus, #tabConflict');
    if (!tabs.length || !panes.length) return;

    const showTab = async (tabId) => {
        panes.forEach(p => {
            p.classList.remove('show', 'active');
        });
        tabs.forEach(t => t.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        const targetTab = document.querySelector(`#officeStayTabs .nav-link[data-tab="${tabId}"]`);
        if (targetPane) targetPane.classList.add('show', 'active');
        if (targetTab) targetTab.classList.add('active');

        if (tabId === 'tabRoster') {
            // 第一次切到名冊時才載入（避免一進來就多打一堆查詢）
            if (!rosterLoadedOnce) {
                try {
                    if (!allEmployees || allEmployees.length === 0) {
                        await loadEmployees();
                    }
                    await renderRoster();
                    rosterLoadedOnce = true;
                } catch (e) {
                    console.error(e);
                    const tbody = document.querySelector('#rosterTable tbody');
                    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">名冊載入失敗：${escapeHtml(e.message || String(e))}</td></tr>`;
                }
            }
        }
    };

    tabs.forEach(btn => {
        btn.addEventListener('click', async () => {
            const tabId = btn.getAttribute('data-tab');
            await showTab(tabId);
        });
    });

    const refreshBtn = document.getElementById('btnRefreshRoster');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            rosterLoadedOnce = false;
            await showTab('tabRoster');
        });
    }
}

// ---------- 狀態設定 ----------

async function loadStatusDefsOffice() {
    statusMapOffice = {};
    const snap = await db.collection('stayStatusDefs').orderBy('order', 'asc').get().catch(() => null);
    if (!snap || snap.empty) {
        // 預設三個狀態
        const defaults = [
            { id: 'pending', name: '待審核', color: '#6c757d', order: 1 },
            { id: 'approved', name: '核准', color: '#198754', order: 2 },
            { id: 'rejected', name: '退回', color: '#dc3545', order: 3 },
        ];
        for (const s of defaults) {
            await db.collection('stayStatusDefs').doc(s.id).set(s);
            statusMapOffice[s.id] = s;
        }
        return;
    }
    snap.forEach(doc => {
        const d = doc.data();
        statusMapOffice[doc.id] = {
            id: doc.id,
            name: d.name || doc.id,
            color: d.color || '#6c757d',
            order: d.order ?? 10
        };
    });
}

async function renderStatusTable() {
    const tbody = document.querySelector('#statusTable tbody');
    tbody.innerHTML = '';
    const arr = Object.values(statusMapOffice).sort((a, b) => a.order - b.order);

    arr.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td><span class="badge" style="background:${s.color}">${s.color}</span></td>
            <td>${s.order}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger">刪除</button>
            </td>
        `;
        const statusDelBtn = tr.querySelector('button');
        statusDelBtn.addEventListener('click', async () => {
            if (!confirm('確定要刪除此狀態嗎？（已有資料仍會保留原狀態代碼）')) return;
            await db.collection('stayStatusDefs').doc(s.id).delete();
            await loadStatusDefsOffice();
            await renderStatusTable();
            await loadApplicationsByFilter();
        });
tbody.appendChild(tr);
    });

    // 同時更新新增 / 編輯申請用的下拉選單
    const statusSelectOffice = document.getElementById('statusSelectOffice');
    statusSelectOffice.innerHTML = '';
    arr.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        statusSelectOffice.appendChild(opt);
    });
}

function initStatusForm() {
    const form = document.getElementById('statusForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('statusName').value.trim();
        const color = document.getElementById('statusColor').value || '#6c757d';
        const order = parseInt(document.getElementById('statusOrder').value || '10', 10);
        if (!name) {
            alert('請輸入狀態名稱');
            return;
        }
        // 以名稱當作 id（可自行調整）
        const id = name.trim().toLowerCase();

        await db.collection('stayStatusDefs').doc(id).set({
            name, color, order
        });
        document.getElementById('statusName').value = '';
        await loadStatusDefsOffice();
        await renderStatusTable();
        alert('狀態已新增 / 更新');
    });
}

// ---------- 互斥設定 ----------

async function renderConflictSettings() {
    const tbody = document.querySelector('#conflictTable tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">載入中...</td></tr>';
    const snap = await db.collection('stayConflictRules').get();
    tbody.innerHTML = '';
    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">目前尚未設定互斥規則</td></tr>';
        return;
    }
    snap.forEach(doc => {
        const r = doc.data();
        const members = (r.employeeIds || []).map(id => {
            const emp = allEmployees.find(e => e.id === id);
            return emp ? emp.name : id;
        }).join('、');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.ruleName || ''}</td>
            <td>${members}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger">刪除</button>
            </td>
        `;
        tr.querySelector('button').addEventListener('click', async () => {
            if (!confirm('確定要刪除此規則嗎？')) return;
            await db.collection('stayConflictRules').doc(doc.id).delete();
            await renderConflictSettings();
        });
        const delBtn = tr.querySelector('[data-del-app-id]');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm('確定要刪除這筆外宿申請單嗎？此動作無法復原。')) return;
                    await db.collection('stayApplications').doc(doc.id).delete();
                    await loadApplicationsByFilter();
                });
            }
            tbody.appendChild(tr);
    });
}

function initConflictForm() {
    const form = document.getElementById('conflictForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ruleName = document.getElementById('conflictRuleName').value.trim();
        if (!ruleName) {
            alert('請輸入規則名稱');
            return;
        }
        const select = document.getElementById('conflictEmployees');
        const selected = Array.from(select.selectedOptions).map(o => o.value);
        if (!selected.length) {
            alert('請至少選擇一位員工');
            return;
        }
        await db.collection('stayConflictRules').add({
            ruleName,
            employeeIds: selected
        });
        document.getElementById('conflictRuleName').value = '';
        select.selectedIndex = -1;
        await renderConflictSettings();
        alert('互斥規則已新增');
    });
}

// ---------- 外宿案件管理 ----------

function initAppSection() {
    document.getElementById('btnFilter').addEventListener('click', async () => { await loadApplicationsByFilter(); try{ bumpLastSeen(); }catch(_){} });
    document.getElementById('btnNewApp').addEventListener('click', () => openAppModal());
    document.getElementById('btnSaveApp').addEventListener('click', saveAppFromModal);

    document.getElementById('btnPrint').addEventListener('click', () => {
        window.print();
    });
    document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
}

function setDefaultFilterRange() {
    // 一開始不要預設日期，讓系統顯示所有申請單；起訖日期只作為篩選條件使用
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
}

async function loadApplicationsByFilter() {
    const startStr = document.getElementById('filterStart').value;
    const endStr = document.getElementById('filterEnd').value;

    const tbody = document.querySelector('#officeStayTable tbody');
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">載入中...</td></tr>';

    let queryRef = db.collection('stayApplications');
    let titleText = '外宿申請單';

    if (startStr) {
        const [y, m, d] = startStr.split('-').map(v => parseInt(v, 10));
        const startDate = new Date(y, m - 1, d, 0, 0, 0);
        queryRef = queryRef.where('startDateTime', '>=', startDate);
    }
    if (endStr) {
        const [y, m, d] = endStr.split('-').map(v => parseInt(v, 10));
        const endDate = new Date(y, m - 1, d, 23, 59, 59);
        queryRef = queryRef.where('startDateTime', '<=', endDate);
    }

    const snap = await queryRef.orderBy('startDateTime', 'asc').get();

    // 依送件時間（申請日期 / createdAt）排序：最新送件在上面
    // 注意：Firestore 若同時有 where(startDateTime...) 的不等式篩選，無法直接 orderBy(createdAt)，
    // 所以這裡先用 startDateTime 抓資料，再在前端用 createdAt 排序。
    const docs = snap.empty ? [] : snap.docs.slice();
    const toMs = (tsOrDate) => {
        if (!tsOrDate) return 0;
        const d = tsOrDate.toDate ? tsOrDate.toDate() : (tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate));
        const t = d.getTime();
        return isNaN(t) ? 0 : t;
    };
    const getApplyMs = (doc) => {
        const A = doc.data() || {};
        // 以 createdAt 為主；若舊資料沒有 createdAt，改用 updatedAt；再不行就用 startDateTime 當作替代
        return toMs(A.createdAt) || toMs(A.updatedAt) || toMs(A.startDateTime);
    };
    docs.sort((a, b) => getApplyMs(b) - getApplyMs(a));

    tbody.innerHTML = '';
    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">查無資料</td></tr>';
    } else {
        docs.forEach(doc => {
            const app = doc.data();
            const tr = document.createElement('tr');

            

            // === 沒簽名標示 ===
            const noSign = (!('signName' in (app || {}))) || (app.signName === null) || (app.signName === undefined) || (String(app.signName).trim() === '') || (String(app.signName).trim() === '—') || (String(app.signName).trim() === '-');
            if (noSign) {
                tr.classList.add('tr-no-signature');
            }
const start = app.startDateTime?.toDate?.() || new Date(app.startDateTime);
            const end = app.endDateTime?.toDate?.() || new Date(app.endDateTime);
            const status = statusMapOffice[app.statusId] || { name: app.statusId || '—', color: '#6c757d' };

            const statusOptions = Object.values(statusMapOffice)
                .sort((a, b) => a.order - b.order)
                .map(s => `<option value="${s.id}" ${s.id === app.statusId ? 'selected' : ''}>${s.name}</option>`)
                .join('');

            tr.innerHTML = `
                <td>${app.applicantName || ''}</td>
                <td>${formatDateTime(app.createdAt?.toDate?.() || (app.createdAt ? new Date(app.createdAt) : null)) || '—'}</td>
                <td>${formatDateTime(start)}<br>~ ${formatDateTime(end)}</td>
                <td>${app.startShift || ''}</td>
                <td>${app.location || ''}</td>
                <td>${app.reason || ''}</td>
                <td>
                    <select class="form-select form-select-sm status-select no-print" data-app-id="${doc.id}">
                        ${statusOptions}
                    </select>
                    <span class="badge d-print-inline d-none" style="background:${status.color}">${status.name}</span>
                </td>
                <td>
                    <select class="form-select form-select-sm sign-select no-print" data-app-id="${doc.id}">
                        <option value="">—</option>
                        <option value="林淑菁" ${app.signName === '林淑菁' ? 'selected' : ''}>林淑菁</option>
                        <option value="呂麗雯" ${app.signName === '呂麗雯' ? 'selected' : ''}>呂麗雯</option>
                    </select>
                    <span class="d-print-inline d-none sign-display">${app.signName || ''}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary no-print" data-comment-app-id="${doc.id}">
                        註解
                    </button>
                </td>
                <td class="no-print">
                    <button class="btn btn-sm btn-outline-primary me-1" data-edit-app-id="${doc.id}">編輯</button>
                    <button class="btn btn-sm btn-outline-danger" data-del-app-id="${doc.id}">刪除</button>
                </td>
            `;

            const statusSelect = tr.querySelector('.status-select');
            statusSelect.addEventListener('change', async () => {
                const newStatusId = statusSelect.value;
                await db.collection('stayApplications').doc(doc.id).update({
                    statusId: newStatusId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await loadStatusDefsOffice();
                await loadApplicationsByFilter();
            });

            const signSelect = tr.querySelector('.sign-select');
            if (signSelect) {
                signSelect.addEventListener('change', async () => {
                    const newSign = signSelect.value || null;
                    await db.collection('stayApplications').doc(doc.id).update({
                        signName: newSign,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    const span = tr.querySelector('.sign-display');
                    if (span) span.textContent = newSign || '';

                    // === 即時切換顏色 ===
                    const noSign = (newSign === null) || (newSign === undefined) || (String(newSign).trim() === '') || (String(newSign).trim() === '—') || (String(newSign).trim() === '-');
                    if (noSign) {
                        tr.classList.add('tr-no-signature');
                    } else {
                        tr.classList.remove('tr-no-signature');
                    }
                });
            }

            const commentBtn = tr.querySelector('[data-comment-app-id]');
            commentBtn.addEventListener('click', () => openCommentModalOffice(doc.id));

            const editBtn = tr.querySelector('[data-edit-app-id]');
            editBtn.addEventListener('click', () => openAppModal(doc));

            const delBtn = tr.querySelector('[data-del-app-id]');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm('確定要刪除這筆外宿申請單嗎？此動作無法復原。')) return;
                    await db.collection('stayApplications').doc(doc.id).delete();
                    await loadApplicationsByFilter();
                });
            }
            tbody.appendChild(tr);
        });
    }

    // 設定報表抬頭
    const titleEl = document.getElementById('reportTitle');
    if (startStr && endStr) {
        const startROC = toROCDate(startStr);
        const endROC = toROCDate(endStr);
        titleText = `${startROC}-${endROC} 外宿申請單`;
    }
    titleEl.textContent = `安泰醫療社團法人附設安泰護理之家  ${titleText}`;
    try { bumpLastSeen(); } catch (_) {}
}

function toROCDate(isoDateStr) {
    const [y, m, d] = isoDateStr.split('-').map(v => parseInt(v, 10));
    const rocYear = y - 1911;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${rocYear}/${pad(m)}/${pad(d)}`;
}

// ---------- 新增 / 編輯申請 ----------

function openAppModal(doc) {
    const form = document.getElementById('appForm');
    form.reset();
    document.getElementById('appId').value = '';
    const statusSelect = document.getElementById('statusSelectOffice');

    if (doc) {
        const app = doc.data();
        document.getElementById('appId').value = doc.id;
        const start = app.startDateTime?.toDate?.() || new Date(app.startDateTime);
        const end = app.endDateTime?.toDate?.() || new Date(app.endDateTime);
        document.getElementById('startDateTimeOffice').value = toInputDateTime(start);
        document.getElementById('endDateTimeOffice').value = toInputDateTime(end);
        document.getElementById('startShiftOffice').value = app.startShift || 'D';
        document.getElementById('locationOffice').value = app.location || '';
        document.getElementById('reasonOffice').value = app.reason || '';

        // 申請人
        const applicantSelect = document.getElementById('applicantSelectOffice');
        if (applicantSelect) {
            applicantSelect.value = app.applicantId || '';
        }

        // 狀態
        statusSelect.value = app.statusId || 'pending';
    }

    appModal.show();
}

async function saveAppFromModal() {
    const appId = document.getElementById('appId').value;
    const applicantSelect = document.getElementById('applicantSelectOffice');
    const applicantId = applicantSelect.value;
    const applicantName = applicantSelect.selectedOptions[0]?.textContent || '';

    const start = new Date(document.getElementById('startDateTimeOffice').value);
    const end = new Date(document.getElementById('endDateTimeOffice').value);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert('請正確填寫起訖時間');
        return;
    }
    if (end <= start) {
        alert('結束時間必須晚於起始時間');
        return;
    }
    const location = document.getElementById('locationOffice').value.trim();
    const reason = document.getElementById('reasonOffice').value.trim();
    if (!location) { alert('請填寫外宿地點'); return; }
    if (!reason) { alert('請填寫外宿原因'); return; }

    const data = {
        applicantId,
        applicantName,
        startDateTime: start,
        endDateTime: end,
        startShift: document.getElementById('startShiftOffice').value,
        location,
        reason,
        statusId: document.getElementById('statusSelectOffice').value || 'pending',
        createdByRole: 'office',
        createdByUserId: 'office'
    };

    const saveBtn = document.getElementById('btnSaveApp');
    setButtonLoading(saveBtn, true);
    try {
        // 辦公室新增 / 修改也套用同樣的業務規則
        await validateBusinessRulesForNewApplicationOffice(data, appId || null);

    if (appId) {
        await db.collection('stayApplications').doc(appId).update({
            applicantId: data.applicantId,
            applicantName: data.applicantName,
            startDateTime: firebase.firestore.Timestamp.fromDate(data.startDateTime),
            endDateTime: firebase.firestore.Timestamp.fromDate(data.endDateTime),
            startShift: data.startShift,
            location: data.location,
            reason: data.reason,
            statusId: data.statusId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await db.collection('stayApplications').add({
            applicantId: data.applicantId,
            applicantName: data.applicantName,
            startDateTime: firebase.firestore.Timestamp.fromDate(data.startDateTime),
            endDateTime: firebase.firestore.Timestamp.fromDate(data.endDateTime),
            startShift: data.startShift,
            location: data.location,
            reason: data.reason,
            statusId: data.statusId,
            createdByRole: data.createdByRole,
            createdByUserId: data.createdByUserId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    appModal.hide();
    await loadApplicationsByFilter();
        alert('外宿申請已儲存');
    } catch (err) {
        console.error('saveAppFromModal failed:', err);
        alert('儲存失敗，請稍後再試或檢查網路連線');
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

// 這裡沿用 caregiver 端的規則檢查邏輯，但要忽略正在編輯的那筆（appIdSelf）
async function validateBusinessRulesForNewApplicationOffice(data, appIdSelf) {
    const today = new Date();
    const minStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 0, 0, 0);
    if (data.startDateTime < minStart) {
        throw new Error('外宿需提前三天申請，起始日期須在三天後');
    }

    const days = enumerateDates(data.startDateTime, data.endDateTime);
    const limitCheck = await checkTwoPerDayLimitOfficeDetailed(days, appIdSelf);
    if (limitCheck && limitCheck.overLimit) {
        const detail = (limitCheck.conflicts || []).map(c => {
            const apps = (c.apps || []).map(a => {
                const s = a.start ? formatDateTime(a.start) : '—';
                const e = a.end ? formatDateTime(a.end) : '—';
                const st = statusMapOffice[a.statusId]?.name || a.statusId || '—';
                return `- ${a.applicantName || '(未填姓名)'}（${st}）｜${s} ～ ${e}`;
            }).join('\n');
            return `【${c.date}】\n${apps}`;
        }).join('\n\n');
        throw new Error(`同一天外宿人數已達兩人上限，無法再申請。\n\n原因：\n${detail || '(查無明細)'}`);
    }

    const conflictMsg = await checkConflictRulesOffice(data.applicantId, days, appIdSelf);
    if (conflictMsg) {
        throw new Error(conflictMsg);
    }
}


// 回傳：{ overLimit: boolean, conflicts: [{ date: 'YYYY/MM/DD', apps: [{id, applicantName, start, end, statusId}] }] }
async function checkTwoPerDayLimitOfficeDetailed(days, appIdSelf) {
    // Firestore 規則：不等式(where <=, >= ...) 不能同時用在兩個不同欄位
    // 這裡改成只用 startDateTime 做不等式查詢，endDateTime 用前端再過濾（避免 Invalid query）
    const toDate = (v) => (v?.toDate ? v.toDate() : (v instanceof Date ? v : (v ? new Date(v) : null)));
    const fmtDay = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    };

    const conflicts = [];

    for (const d of days) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

        const snap = await db.collection('stayApplications')
            .where('startDateTime', '<=', firebase.firestore.Timestamp.fromDate(dayEnd))
            .orderBy('startDateTime', 'asc')
            .get();

        const hits = [];
        snap.forEach(doc => {
            if (appIdSelf && doc.id === appIdSelf) return; // 排除自己（編輯中）
            const data = doc.data() || {};
            // 退回的不算（若你希望退回也要佔名額，把這行拿掉即可）
            if (data.statusId === 'rejected') return;

            const end = toDate(data.endDateTime);
            const start = toDate(data.startDateTime);
            if (!end) return;

            // 與當天有交集：startDateTime <= dayEnd 已在查詢保證；只要 endDateTime >= dayStart 即成立
            if (end >= dayStart) {
                hits.push({
                    id: doc.id,
                    applicantName: data.applicantName || '',
                    start,
                    end,
                    statusId: data.statusId || ''
                });
            }
        });

        if (hits.length >= 2) {
            // 依 startDateTime 排序，取最早的兩筆作為「已佔用名額」的原因
            hits.sort((a, b) => (a.start?.getTime?.() || 0) - (b.start?.getTime?.() || 0));
            conflicts.push({ date: fmtDay(d), apps: hits.slice(0, 2) });
        }
    }

    return { overLimit: conflicts.length > 0, conflicts };
}

// 舊版相容：只回傳 boolean
async function checkTwoPerDayLimitOffice(days, appIdSelf) {
    const r = await checkTwoPerDayLimitOfficeDetailed(days, appIdSelf);
    return !!r?.overLimit;
}


async function checkConflictRulesOffice(applicantId, days, appIdSelf) {
    const rulesSnap = await db.collection('stayConflictRules')
        .where('employeeIds', 'array-contains', applicantId)
        .get();
    if (rulesSnap.empty) return null;

    for (const ruleDoc of rulesSnap.docs) {
        const rule = ruleDoc.data();
        const memberIds = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
        const others = memberIds.filter(id => id !== applicantId);
        if (!others.length) continue;

        const hasConflict = await checkOthersStayOnDaysOffice(others, days, appIdSelf);
        if (hasConflict) {
            const ruleName = rule.ruleName || '同組員工';
            return `${ruleName} 已設定不可同日外宿，請與主管討論後再安排。`;
        }
    }
    return null;
}

async function checkOthersStayOnDaysOffice(others, days, appIdSelf) {
    const toDate = (v) => (v?.toDate ? v.toDate() : (v instanceof Date ? v : (v ? new Date(v) : null)));

    const chunks = [];
    for (let i = 0; i < others.length; i += 10) {
        chunks.push(others.slice(i, i + 10));
    }

    for (const d of days) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

        for (const group of chunks) {
            // 同上：避免 startDateTime + endDateTime 同時不等式
            const snap = await db.collection('stayApplications')
                .where('applicantId', 'in', group)
                .where('startDateTime', '<=', firebase.firestore.Timestamp.fromDate(dayEnd))
                .orderBy('startDateTime', 'asc')
                .get();

            let hasOther = false;
            snap.forEach(doc => {
                if (appIdSelf && doc.id === appIdSelf) return;
                const data = doc.data() || {};
                if (data.statusId === 'rejected') return;

                const end = toDate(data.endDateTime);
                if (!end) return;

                if (end >= dayStart) hasOther = true;
            });

            if (hasOther) return true;
        }
    }
    return false;
}

// ---------- 註解（辦公室端） ----------

function initCommentSection() {
    document.getElementById('btnSaveCommentOffice').addEventListener('click', saveCommentFromModalOffice);
}

async function openCommentModalOffice(appId) {
    currentAppIdForCommentOffice = appId;
    document.getElementById('commentInputOffice').value = '';
    document.getElementById('editingCommentIdOffice').value = '';
    const listEl = document.getElementById('commentListOffice');
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
            li.innerHTML = `
                <div class="me-2">
                    <div><strong>${c.authorName || ''}</strong> <span class="text-muted small">${formatDateTime(c.createdAt?.toDate?.() || new Date(c.createdAt))}</span></div>
                    <div class="mt-1">${(c.content || '').replace(/\n/g, '<br>')}</div>
                </div>
                <div class="ms-2 btn-group btn-group-sm">
                    <button class="btn btn-outline-primary">編輯</button>
                    <button class="btn btn-outline-danger">刪除</button>
                </div>
            `;
            const [editBtn, delBtn] = li.querySelectorAll('button');
            editBtn.addEventListener('click', () => {
                document.getElementById('editingCommentIdOffice').value = doc.id;
                document.getElementById('commentInputOffice').value = c.content || '';
            });
            delBtn.addEventListener('click', async () => {
                if (!confirm('確定要刪除這則註解嗎？')) return;
                await db.collection('stayComments').doc(doc.id).delete();
                openCommentModalOffice(appId);
            });
            listEl.appendChild(li);
        });
    }

    commentModalOffice.show();
}

async function saveCommentFromModalOffice() {
    if (!currentAppIdForCommentOffice) return;
    const content = document.getElementById('commentInputOffice').value.trim();
    if (!content) {
        alert('請先輸入註解內容');
        return;
    }
    const editingId = document.getElementById('editingCommentIdOffice').value;
    const payload = {
        appId: currentAppIdForCommentOffice,
        authorId: 'office',
        authorName: '辦公室',
        authorRole: 'office',
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
    document.getElementById('commentInputOffice').value = '';
    document.getElementById('editingCommentIdOffice').value = '';
    await openCommentModalOffice(currentAppIdForCommentOffice);
}

// ---------- 匯出 Excel ----------

function exportExcel() {
    const table = document.getElementById('officeStayTable').cloneNode(true);
    // 移除 no-print 欄位
    table.querySelectorAll('.no-print').forEach(el => el.remove());

    // 額外抬頭
    const reportTitle = document.getElementById('reportTitle').textContent || '外宿申請單';

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body>
            <h2 style="text-align:center;">安泰醫療社團法人附設安泰護理之家</h2>
            <h3 style="text-align:center;">${reportTitle}</h3>
            ${table.outerHTML}
        </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '外宿申請單.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
