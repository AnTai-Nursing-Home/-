(function () {
  'use strict';

  const COLLECTION_RESIDENTS = 'residents';
  const COLLECTION_EXTRA_MEALS = 'extraMeals';
  const MEAL_TYPES = ['牛奶', '普通餐', '剁碎飯', '剁碎粥', '攪打餐'];

  const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: null,
    currentDocId: null,
    currentEntries: [],
    residents: [],
    sourceEntries: [],
    user: null,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    loginUserText: $('loginUserText'),
    yearSelect: $('yearSelect'),
    prevYearBtn: $('prevYearBtn'),
    nextYearBtn: $('nextYearBtn'),
    monthsGrid: $('monthsGrid'),
    currentMonthTitle: $('currentMonthTitle'),
    currentMonthSubtitle: $('currentMonthSubtitle'),
    addEntryBtn: $('addEntryBtn'),
    copyBtn: $('copyBtn'),
    entriesTbody: $('entriesTbody'),
    entryModal: $('entryModal'),
    residentSelect: $('residentSelect'),
    bedNumberInput: $('bedNumberInput'),
    residentNameInput: $('residentNameInput'),
    mealTypeSelect: $('mealTypeSelect'),
    saveEntryBtn: $('saveEntryBtn'),
    copyModal: $('copyModal'),
    copyYearSelect: $('copyYearSelect'),
    copyMonthSelect: $('copyMonthSelect'),
    copyList: $('copyList'),
    copyAllBtn: $('copyAllBtn'),
    copySourceHint: $('copySourceHint'),
    toast: $('toast'),
  };

  function showToast(message, ms = 2600) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function monthDocId(year, month) {
    return `${year}-${pad2(month)}`;
  }

  function formatMonthLabel(year, month) {
    return `${year} 年 ${month} 月`;
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>'"]/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[s]));
  }

  function formatDateTime(value) {
    try {
      const d = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(+d)) return '';
      return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForFirebaseReady(timeoutMs = 10000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      try {
        if (window.db) return window.db;

        if (window.firebase && Array.isArray(window.firebase.apps) && window.firebase.apps.length > 0) {
          const db = window.firebase.firestore();
          window.db = db;
          return db;
        }
      } catch (err) {
        // 忽略，繼續等
      }

      await sleep(100);
    }

    throw new Error('Firebase 尚未初始化完成，請確認 firebase-init.js 是否正確載入');
  }

  async function getDb() {
    if (window.db) return window.db;
    return await waitForFirebaseReady();
  }

  function getCurrentUser() {
    let raw = null;
    try {
      raw = sessionStorage.getItem('antai_session_user');
    } catch {}

    if (!raw) {
      try {
        raw = localStorage.getItem('antai_session_user');
      } catch {}
    }

    if (raw) {
      try {
        const u = JSON.parse(raw);
        return {
          id: u.uid || u.id || u.employeeId || u.staffId || u.account || 'unknown',
          name: u.name || u.displayName || u.employeeName || u.username || u.account || '未命名使用者',
          role: u.role || '',
          raw: u,
        };
      } catch {}
    }

    return { id: 'guest', name: '未登入使用者', role: '' };
  }

  function naturalBedCompare(a, b) {
    const split = (s) => String(s).split(/[-_]/).map(part => /^\d+$/.test(part) ? Number(part) : part);
    const aa = split(a);
    const bb = split(b);
    const len = Math.max(aa.length, bb.length);

    for (let i = 0; i < len; i++) {
      const x = aa[i];
      const y = bb[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x).localeCompare(String(y), 'zh-Hant');
    }
    return 0;
  }

  function setupYearControls() {
    if (!els.yearSelect) return;
    els.yearSelect.innerHTML = '';

    for (let y = state.currentYear - 5; y <= state.currentYear + 3; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = `${y}`;
      if (y === state.currentYear) opt.selected = true;
      els.yearSelect.appendChild(opt);
    }
  }

  function renderMonthsGrid() {
    if (!els.monthsGrid) return;

    const frag = document.createDocumentFragment();
    for (let month = 1; month <= 12; month++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'month-btn';
      btn.innerHTML = `<span>${month} 月</span><span class="count" id="month-count-${month}">載入中...</span>`;
      btn.addEventListener('click', () => openMonth(state.currentYear, month));
      frag.appendChild(btn);
    }

    els.monthsGrid.innerHTML = '';
    els.monthsGrid.appendChild(frag);

    refreshMonthCounts();
  }

  async function refreshMonthCounts() {
    try {
      const db = await getDb();

      for (let month = 1; month <= 12; month++) {
        const countEl = document.getElementById(`month-count-${month}`);
        if (!countEl) continue;

        try {
          const snap = await db.collection(COLLECTION_EXTRA_MEALS).doc(monthDocId(state.currentYear, month)).get();
          const entries = snap.exists ? (snap.data().entries || []) : [];
          countEl.textContent = `${entries.length} 人`;
        } catch (err) {
          console.error(err);
          countEl.textContent = '讀取失敗';
        }
      }
    } catch (err) {
      console.error(err);
      for (let month = 1; month <= 12; month++) {
        const countEl = document.getElementById(`month-count-${month}`);
        if (countEl) countEl.textContent = '讀取失敗';
      }
    }
  }

  async function loadResidents() {
    const db = await getDb();
    const snap = await db.collection(COLLECTION_RESIDENTS).get();

    const items = [];
    snap.forEach(doc => {
      const data = doc.data() || {};
      const bedNumber = String(data.bedNumber || '').trim();
      const residentName = String(data.residentName || data.name || '').trim();
      if (!bedNumber || !residentName) return;

      items.push({
        id: doc.id,
        bedNumber,
        residentName,
      });
    });

    items.sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));
    state.residents = items;
    renderResidentOptions();
  }

  function renderResidentOptions() {
    if (!els.residentSelect) return;

    const opts = ['<option value="">請選擇床號｜住民</option>'];
    for (const r of state.residents) {
      opts.push(`<option value="${escapeHtml(r.id)}">${escapeHtml(r.bedNumber)}｜${escapeHtml(r.residentName)}</option>`);
    }
    els.residentSelect.innerHTML = opts.join('');
  }

  async function openMonth(year, month) {
    state.currentYear = year;
    state.currentMonth = month;
    state.currentDocId = monthDocId(year, month);

    if (els.currentMonthTitle) {
      els.currentMonthTitle.textContent = `${formatMonthLabel(year, month)} 加餐名單`;
    }
    if (els.currentMonthSubtitle) {
      els.currentMonthSubtitle.textContent = '會顯示該月份所有有加餐的住民';
    }
    if (els.addEntryBtn) els.addEntryBtn.disabled = false;
    if (els.copyBtn) els.copyBtn.disabled = false;
    if (els.entriesTbody) {
      els.entriesTbody.innerHTML = `<tr><td colspan="6" class="empty">讀取中...</td></tr>`;
    }

    await loadMonthEntries();
  }

  async function loadMonthEntries() {
    const db = await getDb();
    const docRef = db.collection(COLLECTION_EXTRA_MEALS).doc(state.currentDocId);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : {};

    state.currentEntries = Array.isArray(data.entries) ? data.entries.slice() : [];
    state.currentEntries.sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));

    renderEntriesTable();
    refreshMonthCounts();
  }

  function renderEntriesTable() {
    if (!els.entriesTbody) return;

    if (!state.currentEntries.length) {
      els.entriesTbody.innerHTML = `<tr><td colspan="6" class="empty">這個月份目前沒有加餐名單</td></tr>`;
      return;
    }

    els.entriesTbody.innerHTML = state.currentEntries.map((item, idx) => `
      <tr>
        <td>${escapeHtml(item.bedNumber || '')}</td>
        <td>${escapeHtml(item.residentName || '')}</td>
        <td><span class="pill">${escapeHtml(item.mealType || '')}</span></td>
        <td>${escapeHtml(item.createdByName || '')}</td>
        <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
        <td><button type="button" class="danger" data-delete-index="${idx}">刪除</button></td>
      </tr>
    `).join('');

    els.entriesTbody.querySelectorAll('[data-delete-index]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.getAttribute('data-delete-index'));
        const row = state.currentEntries[index];
        if (!row) return;

        if (!confirm(`確定刪除 ${row.bedNumber}｜${row.residentName} 的加餐資料？`)) return;

        state.currentEntries.splice(index, 1);
        await saveCurrentEntries();
        showToast('已刪除加餐資料');
      });
    });
  }

  async function saveCurrentEntries() {
    const db = await getDb();
    const docRef = db.collection(COLLECTION_EXTRA_MEALS).doc(state.currentDocId);

    await docRef.set({
      year: state.currentYear,
      month: state.currentMonth,
      entries: state.currentEntries,
      updatedAt: new Date(),
      updatedById: state.user.id,
      updatedByName: state.user.name,
    }, { merge: true });

    state.currentEntries.sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));
    renderEntriesTable();
    refreshMonthCounts();
  }

  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('show');
  }

  function closeModal(id) {
    const el = $(id);
    if (el) el.classList.remove('show');
  }

  function bindModalClosers() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
    });

    ['entryModal', 'copyModal'].forEach(id => {
      const modal = $(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(id);
      });
    });
  }

  function syncSelectedResident() {
    const residentId = els.residentSelect?.value;
    const resident = state.residents.find(r => r.id === residentId);

    if (els.bedNumberInput) els.bedNumberInput.value = resident?.bedNumber || '';
    if (els.residentNameInput) els.residentNameInput.value = resident?.residentName || '';
  }

  function resetEntryModal() {
    if (els.residentSelect) els.residentSelect.value = '';
    if (els.bedNumberInput) els.bedNumberInput.value = '';
    if (els.residentNameInput) els.residentNameInput.value = '';
    if (els.mealTypeSelect) els.mealTypeSelect.value = '';
  }

  async function handleSaveEntry() {
    if (!state.currentDocId) {
      showToast('請先選擇月份');
      return;
    }

    const residentId = els.residentSelect?.value;
    const resident = state.residents.find(r => r.id === residentId);
    const mealType = els.mealTypeSelect?.value;

    if (!resident) return showToast('請先選擇住民');
    if (!MEAL_TYPES.includes(mealType)) return showToast('請先選擇加餐飲食');

    const existingIndex = state.currentEntries.findIndex(x => x.residentId === resident.id);

    const entry = {
      residentId: resident.id,
      bedNumber: resident.bedNumber,
      residentName: resident.residentName,
      mealType,
      note: '',
      createdById: existingIndex >= 0 ? state.currentEntries[existingIndex].createdById : state.user.id,
      createdByName: existingIndex >= 0 ? state.currentEntries[existingIndex].createdByName : state.user.name,
      createdAt: existingIndex >= 0 ? state.currentEntries[existingIndex].createdAt : new Date(),
      updatedAt: new Date(),
      updatedById: state.user.id,
      updatedByName: state.user.name,
    };

    if (existingIndex >= 0) {
      state.currentEntries[existingIndex] = {
        ...state.currentEntries[existingIndex],
        ...entry,
      };
      await saveCurrentEntries();
      closeModal('entryModal');
      showToast('已更新該住民的加餐資料');
      return;
    }

    state.currentEntries.push(entry);
    await saveCurrentEntries();
    closeModal('entryModal');
    showToast('已新增加餐資料');
  }

  function setupCopySelectors() {
    if (!els.copyYearSelect || !els.copyMonthSelect) return;

    const years = [];
    const current = new Date().getFullYear();
    for (let y = current - 5; y <= current + 1; y++) years.push(y);

    els.copyYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    els.copyMonthSelect.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} 月</option>`).join('');

    els.copyYearSelect.value = String(state.currentYear || current);
    els.copyMonthSelect.value = String(state.currentMonth || (new Date().getMonth() + 1));
  }

  async function loadSourceEntries() {
    const year = Number(els.copyYearSelect?.value);
    const month = Number(els.copyMonthSelect?.value);

    const db = await getDb();
    const snap = await db.collection(COLLECTION_EXTRA_MEALS).doc(monthDocId(year, month)).get();
    const entries = snap.exists ? (snap.data().entries || []) : [];

    state.sourceEntries = entries.slice().sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));

    if (els.copySourceHint) {
      els.copySourceHint.textContent = `${formatMonthLabel(year, month)} 共有 ${state.sourceEntries.length} 筆名單`;
    }

    renderCopyList();
  }

  function renderCopyList() {
    if (!els.copyList) return;

    if (!state.sourceEntries.length) {
      els.copyList.innerHTML = '<div class="empty">此來源月份沒有可複製的名單</div>';
      return;
    }

    els.copyList.innerHTML = state.sourceEntries.map((item, index) => `
      <div class="copy-item">
        <div>
          <div><strong>${escapeHtml(item.bedNumber || '')}</strong>｜${escapeHtml(item.residentName || '')}</div>
          <div class="muted">${escapeHtml(item.mealType || '')}</div>
        </div>
        <button type="button" class="primary" data-copy-one="${index}">複製這筆</button>
      </div>
    `).join('');

    els.copyList.querySelectorAll('[data-copy-one]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-copy-one'));
        const src = state.sourceEntries[idx];
        if (!src) return;

        const added = copyEntriesToCurrent([src]);
        await saveCurrentEntries();
        showToast(added ? '已複製 1 筆名單' : '這筆住民已存在，已自動跳過');
      });
    });
  }

  function copyEntriesToCurrent(entries) {
    let added = 0;

    for (const src of entries) {
      const exists = state.currentEntries.some(x => x.residentId === src.residentId);
      if (exists) continue;

      state.currentEntries.push({
        residentId: src.residentId || '',
        bedNumber: src.bedNumber || '',
        residentName: src.residentName || '',
        mealType: src.mealType || '',
        note: src.note || '',
        createdById: state.user.id,
        createdByName: state.user.name,
        createdAt: new Date(),
        copiedFrom: {
          year: Number(els.copyYearSelect?.value),
          month: Number(els.copyMonthSelect?.value),
        },
      });

      added++;
    }

    return added;
  }

  async function handleCopyAll() {
    if (!state.sourceEntries.length) return showToast('來源月份沒有資料可複製');

    const added = copyEntriesToCurrent(state.sourceEntries);
    await saveCurrentEntries();
    showToast(added ? `已複製 ${added} 筆名單` : '沒有可新增的資料，重複名單已全部跳過');
  }

  function bindEvents() {
    els.prevYearBtn?.addEventListener('click', () => {
      state.currentYear -= 1;
      setupYearControls();
      renderMonthsGrid();
    });

    els.nextYearBtn?.addEventListener('click', () => {
      state.currentYear += 1;
      setupYearControls();
      renderMonthsGrid();
    });

    els.yearSelect?.addEventListener('change', () => {
      state.currentYear = Number(els.yearSelect.value);
      renderMonthsGrid();
    });

    els.residentSelect?.addEventListener('change', syncSelectedResident);

    els.addEntryBtn?.addEventListener('click', () => {
      resetEntryModal();
      openModal('entryModal');
    });

    els.saveEntryBtn?.addEventListener('click', handleSaveEntry);

    els.copyBtn?.addEventListener('click', async () => {
      setupCopySelectors();
      openModal('copyModal');
      await loadSourceEntries();
    });

    els.copyYearSelect?.addEventListener('change', loadSourceEntries);
    els.copyMonthSelect?.addEventListener('change', loadSourceEntries);
    els.copyAllBtn?.addEventListener('click', handleCopyAll);
  }

  async function init() {
    try {
      if (els.loginUserText) els.loginUserText.textContent = '登入者：初始化中...';

      await waitForFirebaseReady();

      state.user = getCurrentUser();
      if (els.loginUserText) {
        els.loginUserText.textContent = `登入者：${state.user.id} ${state.user.name}`;
      }

      bindModalClosers();
      bindEvents();
      setupYearControls();
      renderMonthsGrid();
      setupCopySelectors();
      await loadResidents();
    } catch (err) {
      console.error(err);
      if (els.loginUserText) els.loginUserText.textContent = '登入者：讀取失敗';
      showToast(err.message || '初始化失敗');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
