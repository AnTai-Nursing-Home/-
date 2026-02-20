// account-admin.js - 帳號管理（含登入者、權限編輯 Modal、管理員/非管理員視角）
// 帳號資料：userAccounts/{staffId}
// 員工資料來源：adminStaff / caregivers / localCaregivers / nurses

(function () {
  const AUTH_KEY = 'officeAuth';

  // 資料來源顯示中文（value 仍維持原本的 collection 名稱，避免影響既有資料/邏輯）
  const SOURCE_LABEL = {
    adminStaff: '社工/其他',
    caregivers: '外籍照服員',
    localCaregivers: '本國照服員',
    nurses: '護理師'
  };

  // 四大系統：護理師 / 照服員 / 辦公室 / 事務
  // ✅ 你之後要加更多權限，只要在這裡加項目即可（不會再把表格越拉越寬）
  const PERMISSION_CATALOG = {
    nurse: [
      { key: 'nurseWhiteboard', label: '護理白板' },
      { key: 'woundCare', label: '傷口照護' },
      { key: 'doctorRound', label: '醫師巡診' }
    ],
    caregiver: [
      { key: 'caregiverRoster', label: '照服員名冊' },
      { key: 'vitals', label: '生命徵象' }
    ],
    office: [
      { key: 'residentsAdmin', label: '住民系統' },
      { key: 'employeesAdmin', label: '員工資料系統' },
      { key: 'officeStay', label: '外宿系統' },
      { key: 'booking', label: '家屬探視預約' },
      { key: 'nutritionist', label: '營養師系統' },
      { key: 'accountAdmin', label: '帳號系統（管理）' }
    ],
    affairs: [
      { key: 'annualLeave', label: '年假系統' }
    ]
  };

  // 舊欄位相容（既有資料仍會讀/寫）
  const LEGACY_SYSTEM_FLAG = {
    nurse: 'canNurse',
    caregiver: 'canCaregiver',
    office: 'canOffice',
    affairs: 'canAnnualLeave'
  };

  const tbody = document.getElementById('tbody');
  const msg = document.getElementById('msg');
  const btnRefresh = document.getElementById('btnRefresh');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const qInput = document.getElementById('q');
  const sourceFilter = document.getElementById('sourceFilter');
  const statusFilter = document.getElementById('statusFilter');
  const btnCreateMissing = document.getElementById('btnCreateMissing');
  const loginInfo = document.getElementById('loginInfo');
  const adminHint = document.getElementById('adminHint');

  // Modal elements
  const editModalEl = document.getElementById('editModal');
  const editSubTitle = document.getElementById('editSubTitle');
  const editUsername = document.getElementById('editUsername');
  const editPassword = document.getElementById('editPassword');
  const permArea = document.getElementById('permArea');
  const btnSaveModal = document.getElementById('btnSaveModal');
  const btnDeleteAccount = document.getElementById('btnDeleteAccount');

  const toggleNurse = document.getElementById('toggleNurse');
  const toggleCaregiver = document.getElementById('toggleCaregiver');
  const toggleOffice = document.getElementById('toggleOffice');
  const toggleAffairs = document.getElementById('toggleAffairs');

  const nursePerms = document.getElementById('nursePerms');
  const caregiverPerms = document.getElementById('caregiverPerms');
  const officePerms = document.getElementById('officePerms');
  const affairsPerms = document.getElementById('affairsPerms');

  let rowsAll = [];
  let accountsMap = new Map();
  let isAdmin = false;
  let actor = { id: 'unknown', name: 'unknown', username: '' };

  let modal;
  let currentEditing = null; // { staffId, name, source, account }

  function getAuth() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }

  // 取得登入者資訊（盡量相容不同系統存法）
  function getActor() {
    const a = getAuth() || {};
    const id = a.staffId || a.uid || a.userId || a.staffNo || a.employeeId || a.username || 'unknown';
    const name = a.displayName || a.name || a.fullName || a.staffName || a.username || 'unknown';
    const username = a.username || a.user || '';
    return { id, name, username };
  }

  function renderLoginInfo() {
    if (!loginInfo) return;
    const a = actor;
    loginInfo.textContent = a.id === 'unknown' ? `登入中` : `登入者：${a.id} ${a.name}`;
  }

  async function waitForDbReady() {
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }

  function escapeHtml(s) {
    return (s ?? '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setMsg(text) {
    if (msg) msg.textContent = text || '';
  }

  function setButtonBusy(btn, busy, textBusy = '處理中...') {
    if (!btn) return;
    if (busy) {
      btn.dataset._oldText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${textBusy}`;
    } else {
      btn.disabled = false;
      if (btn.dataset._oldText) btn.innerHTML = btn.dataset._oldText;
    }
  }

  // ===== Toast =====
  function ensureToastContainer() {
    let c = document.getElementById('toastContainer');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(c);
    return c;
  }

  function showToast(message, variant = 'success') {
    try {
      const c = ensureToastContainer();
      const el = document.createElement('div');
      el.className = `toast align-items-center text-bg-${variant} border-0`;
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'assertive');
      el.setAttribute('aria-atomic', 'true');
      el.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${escapeHtml(message)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>`;
      c.appendChild(el);
      const t = new bootstrap.Toast(el, { delay: 2200 });
      t.show();
      el.addEventListener('hidden.bs.toast', () => el.remove());
    } catch (e) {
      console.log(message);
    }
  }

  // ===== 權限資料：讀/寫相容 =====
  function normalizeAccount(doc = {}) {
    const acc = { ...doc };

    // 新式結構：systems
    acc.systems = acc.systems && typeof acc.systems === 'object' ? acc.systems : {};

    // 確保四大系統都有物件
    for (const k of ['nurse', 'caregiver', 'office', 'affairs']) {
      if (!acc.systems[k] || typeof acc.systems[k] !== 'object') acc.systems[k] = {};
      if (typeof acc.systems[k].enabled !== 'boolean') {
        // 從舊欄位推導
        const legacyKey = LEGACY_SYSTEM_FLAG[k];
        acc.systems[k].enabled = acc[legacyKey] === true;
      }
      acc.systems[k].perms = acc.systems[k].perms && typeof acc.systems[k].perms === 'object' ? acc.systems[k].perms : {};
    }

    return acc;
  }

  function deriveLegacyFlagsFromSystems(acc) {
    for (const [sys, legacyKey] of Object.entries(LEGACY_SYSTEM_FLAG)) {
      acc[legacyKey] = acc.systems?.[sys]?.enabled === true;
    }
    return acc;
  }

  function buildPermGrid(container, sysKey) {
    if (!container) return;
    container.innerHTML = '';
    const items = PERMISSION_CATALOG[sysKey] || [];
    for (const it of items) {
      const id = `perm_${sysKey}_${it.key}`;
      const wrap = document.createElement('div');
      wrap.className = 'form-check';
      wrap.innerHTML = `
        <input class="form-check-input" type="checkbox" id="${id}" data-sys="${sysKey}" data-perm="${it.key}">
        <label class="form-check-label" for="${id}">${escapeHtml(it.label)}</label>
      `;
      container.appendChild(wrap);
    }
  }

  function setPermsEnabled(sysKey, enabled) {
    const selector = `[data-sys="${sysKey}"][data-perm]`;
    document.querySelectorAll(selector).forEach(cb => {
      cb.disabled = !enabled;
      if (!enabled) cb.checked = false;
    });
  }

  function fillPermsFromAccount(acc) {
    const a = normalizeAccount(acc);

    // toggles
    toggleNurse.checked = a.systems.nurse.enabled === true;
    toggleCaregiver.checked = a.systems.caregiver.enabled === true;
    toggleOffice.checked = a.systems.office.enabled === true;
    toggleAffairs.checked = a.systems.affairs.enabled === true;

    // perms
    for (const sysKey of ['nurse', 'caregiver', 'office', 'affairs']) {
      const enabled = a.systems[sysKey].enabled === true;
      setPermsEnabled(sysKey, enabled);

      const perms = a.systems[sysKey].perms || {};
      document.querySelectorAll(`[data-sys="${sysKey}"][data-perm]`).forEach(cb => {
        const permKey = cb.getAttribute('data-perm');
        cb.checked = enabled ? (perms[permKey] === true) : false;
      });
    }
  }

  function readAccountFromModal(baseAcc) {
    const out = normalizeAccount(baseAcc || {});
    out.username = (editUsername.value || '').trim();
    out.password = (editPassword.value || '').trim();

    out.systems.nurse.enabled = toggleNurse.checked;
    out.systems.caregiver.enabled = toggleCaregiver.checked;
    out.systems.office.enabled = toggleOffice.checked;
    out.systems.affairs.enabled = toggleAffairs.checked;

    for (const sysKey of ['nurse', 'caregiver', 'office', 'affairs']) {
      out.systems[sysKey].perms = out.systems[sysKey].perms || {};
      const enabled = out.systems[sysKey].enabled === true;

      // 如果沒開系統，perms 全清空
      if (!enabled) {
        out.systems[sysKey].perms = {};
        continue;
      }

      document.querySelectorAll(`[data-sys="${sysKey}"][data-perm]`).forEach(cb => {
        const permKey = cb.getAttribute('data-perm');
        out.systems[sysKey].perms[permKey] = cb.checked === true;
      });
    }

    deriveLegacyFlagsFromSystems(out);
    return out;
  }

  function renderSystemBadges(acc) {
    const a = normalizeAccount(acc || {});
    const badges = [];
    if (a.systems.office.enabled) badges.push(`<span class="badge bg-primary badge-system">辦公室</span>`);
    if (a.systems.nurse.enabled) badges.push(`<span class="badge bg-success badge-system">護理師</span>`);
    if (a.systems.caregiver.enabled) badges.push(`<span class="badge bg-warning text-dark badge-system">照服員</span>`);
    if (a.systems.affairs.enabled) badges.push(`<span class="badge bg-info text-dark badge-system">事務</span>`);
    return badges.join('') || `<span class="text-muted">—</span>`;
  }

  // ===== 管理員判斷 =====
  async function resolveIsAdmin() {
    const a = getAuth() || {};
    if (a.isAdmin === true || a.admin === true || a.role === 'admin' || a.canManageAccounts === true) return true;

    // fallback: 從 userAccounts 自己的 doc 判斷
    try {
      if (actor.id && actor.id !== 'unknown') {
        const doc = await db.collection('userAccounts').doc(actor.id).get();
        const d = doc.exists ? (doc.data() || {}) : {};
        if (d.isAdmin === true || d.role === 'admin' || d.canManageAccounts === true) return true;
      }
    } catch (e) { /* ignore */ }

    return false;
  }

  async function ensureLogin() {
    const auth = getAuth();
    if (!auth) {
      alert('請先登入後再進入帳號系統。');
      window.location.href = 'office.html';
      return false;
    }
    return true;
  }

  // ===== Firestore 讀取 =====
  async function loadAllStaff() {
    const sources = ['adminStaff', 'caregivers', 'localCaregivers', 'nurses'];
    const staff = [];

    for (const col of sources) {
      try {
        const snap = await db.collection(col).get();
        snap.forEach(doc => {
          const d = doc.data() || {};
          const name = d.name || d.fullName || d.displayName || doc.id;
          staff.push({
            staffId: doc.id,
            name,
            source: col,
          });
        });
      } catch (e) {
        console.warn('讀取集合失敗:', col, e);
      }
    }

    // 去重：同 staffId 若跨表重複，以先出現者為主
    const seen = new Set();
    const uniq = [];
    for (const s of staff) {
      if (seen.has(s.staffId)) continue;
      seen.add(s.staffId);
      uniq.push(s);
    }

    uniq.sort((a, b) => (a.source + a.staffId).localeCompare(b.source + b.staffId, 'zh-Hant'));
    return uniq;
  }

  async function loadAccountsMap() {
    const map = new Map();
    try {
      const snap = await db.collection('userAccounts').get();
      snap.forEach(doc => map.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
    } catch (e) {
      console.warn('讀取 userAccounts 失敗:', e);
    }
    return map;
  }

  function applyFilters(rows) {
    const q = (qInput.value || '').trim().toLowerCase();
    const src = sourceFilter.value || '';
    const st = statusFilter.value || '';

    return rows.filter(r => {
      if (src && r.source !== src) return false;

      const hasAcc = !!r.account;
      if (st === 'has' && !hasAcc) return false;
      if (st === 'none' && hasAcc) return false;

      if (!q) return true;
      const hay = `${r.staffId} ${r.name} ${(r.account?.username || '')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // ===== 表格渲染（不再把權限塞在表格欄位）=====
  function render(rows) {
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">沒有資料</td></tr>`;
      return;
    }

    for (const r of rows) {
      const acc = normalizeAccount(r.account || {});
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', r.staffId);

      const sourceText = SOURCE_LABEL[r.source] || r.source;

      const pwdMasked = acc.password ? '●'.repeat(Math.min(12, acc.password.length)) : '';
      const canEditThisRow = isAdmin || (r.staffId === actor.id);

      tr.innerHTML = `
        <td><span class="badge bg-secondary">${escapeHtml(sourceText)}</span></td>
        <td class="mono">${escapeHtml(r.staffId)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="mono">${escapeHtml(acc.username || '')}</td>
        <td class="mono pwd-mask">${escapeHtml(pwdMasked)}</td>
        <td>${renderSystemBadges(acc)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary" data-act="edit" ${canEditThisRow ? '' : 'disabled'}>
              <i class="fas fa-pen-to-square me-1"></i>編輯
            </button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline-danger" data-act="delete">
                <i class="fas fa-trash me-1"></i>刪除
              </button>` : ``}
          </div>
        </td>
      `;

      tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditModal(r));
      if (isAdmin) {
        tr.querySelector('[data-act="delete"]').addEventListener('click', () => deleteAccountWithConfirm(r));
      }

      tbody.appendChild(tr);
    }
  }

  // ===== Modal 開啟/關閉 =====
  function openEditModal(row) {
    const acc = normalizeAccount(row.account || {});
    currentEditing = {
      staffId: row.staffId,
      name: row.name,
      source: row.source,
      account: acc
    };

    editSubTitle.textContent = `${row.staffId}｜${row.name}｜${SOURCE_LABEL[row.source] || row.source}`;

    editUsername.value = acc.username || '';
    editPassword.value = acc.password || '';

    if (!isAdmin) {
      // 非管理員：只能改自己的帳密，不可調權限
      permArea.classList.add('d-none');
      btnDeleteAccount.classList.add('d-none');
    } else {
      permArea.classList.remove('d-none');
      btnDeleteAccount.classList.remove('d-none');

      fillPermsFromAccount(acc);
    }

    modal.show();
  }

  function closeEditModal() {
    currentEditing = null;
    modal.hide();
  }

  // toggle events -> enable/disable perms grid
  function bindToggleHandlers() {
    toggleNurse.addEventListener('change', () => {
      setPermsEnabled('nurse', toggleNurse.checked);
    });
    toggleCaregiver.addEventListener('change', () => {
      setPermsEnabled('caregiver', toggleCaregiver.checked);
    });
    toggleOffice.addEventListener('change', () => {
      setPermsEnabled('office', toggleOffice.checked);
    });
    toggleAffairs.addEventListener('change', () => {
      setPermsEnabled('affairs', toggleAffairs.checked);
    });
  }

  // ===== 寫入 Firestore（含登入者）=====
  function nowIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function attachAuditFields(acc, isNew) {
    const a = actor;
    const time = nowIso();
    if (isNew) {
      acc.createdAt = acc.createdAt || time;
      acc.createdBy = a.id;
      acc.createdById = a.id;
      acc.createdByName = a.name;
      acc.createdByUsername = a.username || '';
    }
    acc.updatedAt = time;
    acc.updatedBy = a.id;
    acc.updatedById = a.id;
    acc.updatedByName = a.name;
    acc.updatedByUsername = a.username || '';
    return acc;
  }

  async function saveAccountFromModal() {
    if (!currentEditing) return;

    const staffId = currentEditing.staffId;
    const existed = accountsMap.has(staffId);

    const newAcc = readAccountFromModal(currentEditing.account);

    // 非管理員：只允許改 username/password（權限維持原狀）
    if (!isAdmin) {
      const keep = normalizeAccount(currentEditing.account);
      keep.username = newAcc.username;
      keep.password = newAcc.password;
      // 保留原本權限（避免被前端隱藏欄位清空）
      currentEditing.account = keep;
    } else {
      currentEditing.account = newAcc;
    }

    const toWrite = attachAuditFields({ ...currentEditing.account }, !existed);

    setButtonBusy(btnSaveModal, true, '儲存中...');
    try {
      await db.collection('userAccounts').doc(staffId).set(toWrite, { merge: true });

      // 更新本地 map / rowsAll
      accountsMap.set(staffId, { id: staffId, ...toWrite });
      for (const r of rowsAll) {
        if (r.staffId === staffId) {
          r.account = accountsMap.get(staffId);
          break;
        }
      }

      showToast('已儲存', 'success');
      closeEditModal();
      refreshRender();
    } catch (e) {
      console.error(e);
      showToast('儲存失敗', 'danger');
    } finally {
      setButtonBusy(btnSaveModal, false);
    }
  }

  async function writeAuditLog(action, payload = {}) {
    try {
      await db.collection('auditLogs').add({
        action,
        at: nowIso(),
        actorId: actor.id,
        actorName: actor.name,
        actorUsername: actor.username || '',
        ...payload
      });
    } catch (e) {
      console.warn('寫入 auditLogs 失敗（不影響主要流程）', e);
    }
  }

  async function deleteAccountWithConfirm(row) {
    if (!isAdmin) return;
    if (!confirm(`確定要刪除「${row.staffId} ${row.name}」的帳號資料嗎？（只會刪 userAccounts）`)) return;

    try {
      await db.collection('userAccounts').doc(row.staffId).delete();
      await writeAuditLog('deleteUserAccount', { staffId: row.staffId, staffName: row.name });

      accountsMap.delete(row.staffId);
      for (const r of rowsAll) {
        if (r.staffId === row.staffId) {
          r.account = null;
          break;
        }
      }

      showToast('已刪除', 'warning');
      refreshRender();
    } catch (e) {
      console.error(e);
      showToast('刪除失敗', 'danger');
    }
  }

  async function deleteAccountFromModal() {
    if (!isAdmin || !currentEditing) return;
    const row = { staffId: currentEditing.staffId, name: currentEditing.name };
    if (!confirm(`確定要刪除「${row.staffId} ${row.name}」的帳號資料嗎？`)) return;

    setButtonBusy(btnDeleteAccount, true, '刪除中...');
    try {
      await db.collection('userAccounts').doc(row.staffId).delete();
      await writeAuditLog('deleteUserAccount', { staffId: row.staffId, staffName: row.name });

      accountsMap.delete(row.staffId);
      for (const r of rowsAll) {
        if (r.staffId === row.staffId) {
          r.account = null;
          break;
        }
      }

      showToast('已刪除', 'warning');
      closeEditModal();
      refreshRender();
    } catch (e) {
      console.error(e);
      showToast('刪除失敗', 'danger');
    } finally {
      setButtonBusy(btnDeleteAccount, false);
    }
  }

  // ===== 一鍵建立缺少帳號（admin only）=====
  async function createMissingAccounts() {
    if (!isAdmin) return;
    if (!confirm('確定要一鍵建立所有缺少帳號的人員？（username/password 都會先用員工編號）')) return;

    setButtonBusy(btnCreateMissing, true, '建立中...');
    try {
      let created = 0;
      for (const r of rowsAll) {
        if (r.account) continue;
        const acc = normalizeAccount({
          username: r.staffId,
          password: r.staffId,
          // 預設都不開任何系統，避免誤開權限
          systems: {
            nurse: { enabled: false, perms: {} },
            caregiver: { enabled: false, perms: {} },
            office: { enabled: false, perms: {} },
            affairs: { enabled: false, perms: {} },
          }
        });
        deriveLegacyFlagsFromSystems(acc);
        const toWrite = attachAuditFields({ ...acc }, true);

        await db.collection('userAccounts').doc(r.staffId).set(toWrite, { merge: true });
        accountsMap.set(r.staffId, { id: r.staffId, ...toWrite });
        r.account = accountsMap.get(r.staffId);
        created++;
      }
      showToast(`完成：建立 ${created} 筆`, 'success');
      refreshRender();
    } catch (e) {
      console.error(e);
      showToast('建立失敗', 'danger');
    } finally {
      setButtonBusy(btnCreateMissing, false);
    }
  }

  // ===== 重新渲染 =====
  function refreshRender() {
    const list = applyFilters(rowsAll);
    render(list);
    setMsg(`共 ${list.length} 筆`);
  }

  async function reloadAll() {
    setMsg('載入中...');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">載入中...</td></tr>`;

    const staff = await loadAllStaff();
    accountsMap = await loadAccountsMap();

    // 合併 staff + account
    const merged = staff.map(s => {
      const acc = accountsMap.get(s.staffId) || null;
      return { ...s, account: acc };
    });

    // 非管理員：只顯示自己
    rowsAll = isAdmin ? merged : merged.filter(r => r.staffId === actor.id);

    refreshRender();
  }

  function setupUiByRole() {
    // 這版不再做「一鍵儲存」：避免誤解，直接隱藏（你若想保留我再改成批次儲存 modal 變更）
    if (saveAllBtn) saveAllBtn.classList.add('d-none');

    if (!isAdmin) {
      if (btnCreateMissing) btnCreateMissing.classList.add('d-none');
      if (sourceFilter) sourceFilter.disabled = true;
      if (statusFilter) statusFilter.disabled = true;
      if (qInput) qInput.placeholder = '你目前只能查看/修改自己的帳密';
      if (adminHint) adminHint.textContent = '非管理員模式：只能查看/修改自己的帳號與密碼（不能調整權限）。';
    } else {
      if (adminHint) adminHint.textContent = '管理員模式：可管理所有人帳號與權限。';
    }
  }

  // ===== 初始化 =====
  async function init() {
    await waitForDbReady();
    if (!(await ensureLogin())) return;

    actor = getActor();
    renderLoginInfo();

    // build perm grids once
    buildPermGrid(nursePerms, 'nurse');
    buildPermGrid(caregiverPerms, 'caregiver');
    buildPermGrid(officePerms, 'office');
    buildPermGrid(affairsPerms, 'affairs');

    modal = new bootstrap.Modal(editModalEl);

    bindToggleHandlers();

    isAdmin = await resolveIsAdmin();
    setupUiByRole();

    // events
    btnRefresh?.addEventListener('click', reloadAll);
    btnCreateMissing?.addEventListener('click', createMissingAccounts);
    qInput?.addEventListener('input', refreshRender);
    sourceFilter?.addEventListener('change', refreshRender);
    statusFilter?.addEventListener('change', refreshRender);

    btnSaveModal?.addEventListener('click', saveAccountFromModal);
    btnDeleteAccount?.addEventListener('click', deleteAccountFromModal);

    // when modal is hidden, clear currentEditing
    editModalEl?.addEventListener('hidden.bs.modal', () => { currentEditing = null; });

    await reloadAll();
  }

  init().catch(err => {
    console.error(err);
    showToast('初始化失敗', 'danger');
  });
})();
