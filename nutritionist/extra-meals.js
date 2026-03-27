(function () {
  'use strict';

  const COLLECTION_RESIDENTS = 'residents';
  const COLLECTION_EXTRA_MEALS = 'extraMeals';
  const MEAL_TYPES = ['牛奶', '普通餐', '剁碎飯', '剁碎粥', '攪打餐'];
  const MEAL_SOURCE_LABELS = {
    selfPay: '自費',
    selfBring: '自帶',
  };

  const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: null,
    currentDocId: null,
    currentEntries: [],
    residents: [],
    sourceEntries: [],
    user: null,
    currentTab: 'selfPay',
    currentMeta: {
      updatedAt: null,
      updatedById: '',
      updatedByName: '',
    },
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
    mealSourceSelect: $('mealSourceSelect'),
    mealTypeSelect: $('mealTypeSelect'),
    saveEntryBtn: $('saveEntryBtn'),
    copyModal: $('copyModal'),
    copyYearSelect: $('copyYearSelect'),
    copyMonthSelect: $('copyMonthSelect'),
    copyList: $('copyList'),
    copyAllBtn: $('copyAllBtn'),
    copySourceHint: $('copySourceHint'),
    noticeModal: $('noticeModal'),
    noticeTitle: $('noticeTitle'),
    noticeMessage: $('noticeMessage'),
    noticeOkBtn: $('noticeOkBtn'),
    tabSelfPay: $('tabSelfPay'),
    tabSelfBring: $('tabSelfBring'),
    lastUpdatedText: $('lastUpdatedText'),
    countAllText: $('countAllText'),
    countSelfPayText: $('countSelfPayText'),
    countSelfBringText: $('countSelfBringText'),
  };

  function showToast(message, title = '通知') {
    if (!els.noticeModal || !els.noticeMessage || !els.noticeTitle) {
      window.alert(message);
      return;
    }
    els.noticeTitle.textContent = title;
    els.noticeMessage.textContent = message;
    els.noticeModal.classList.add('show');
  }

  function closeNoticeModal() {
    els.noticeModal?.classList.remove('show');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function monthDocId(year, month) { return `${year}-${pad2(month)}`; }
  function formatMonthLabel(year, month) { return `${year} 年 ${month} 月`; }

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

  function getMealSourceLabel(value) {
    return MEAL_SOURCE_LABELS[value] || '未分類';
  }

  function getMealSourceClass(value) {
    return value === 'selfBring' ? 'bring' : 'pay';
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
        // keep waiting
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
    function normalizeUser(u) {
      if (!u || typeof u !== 'object') return null;

      const id =
        u.staffId ||
        u.employeeId ||
        u.uid ||
        u.id ||
        u.userId ||
        u.account ||
        u.username ||
        '';

      const name =
        u.displayName ||
        u.employeeName ||
        u.name ||
        u.fullName ||
        u.username ||
        u.account ||
        '';

      if (!id && !name) return null;

      return {
        id: id || 'unknown',
        name: name || '未命名使用者',
        role: u.role || '',
        raw: u,
      };
    }

    const candidateKeys = [
      'nutritionistAuth',
      'antai_session_user',
      'nutritionist_session_user',
      'nutritionist_user',
      'loggedInUser',
      'currentUser',
      'user',
      'employee',
      'antai_user',
      'nm_user',
      'nm_current_user',
      'staff_user',
      'loginUser'
    ];

    for (const key of candidateKeys) {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const user = normalizeUser(parsed);
            if (user) return user;
          } catch {}
        }
      } catch {}

      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const user = normalizeUser(parsed);
            if (user) return user;
          } catch {}
        }
      } catch {}
    }

    const globals = [
      window.currentUser,
      window.loggedInUser,
      window.user,
      window.staffUser,
      window.nutritionistUser
    ];

    for (const g of globals) {
      const user = normalizeUser(g);
      if (user) return user;
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

  function getEntryKey(entry) {
    return `${entry.residentId || ''}__${entry.mealSource || 'selfPay'}`;
  }

  function getCurrentSourceForNewEntry() {
    return state.currentTab === 'selfBring' ? 'selfBring' : 'selfPay';
  }

  function normalizeEntry(entry) {
    const normalized = {
      ...entry,
      mealSource: entry?.mealSource || 'selfPay',
    };
    return normalized;
  }

  function getCounts(entries) {
    const all = Array.isArray(entries) ? entries.length : 0;
    const selfPay = (entries || []).filter(item => (item.mealSource || 'selfPay') === 'selfPay').length;
    const selfBring = (entries || []).filter(item => (item.mealSource || 'selfPay') === 'selfBring').length;
    return { all, selfPay, selfBring };
  }

  function updateCountSummary() {
    const counts = getCounts(state.currentEntries);
    if (els.countAllText) els.countAllText.textContent = `本月總筆數：${counts.all}`;
    if (els.countSelfPayText) els.countSelfPayText.textContent = `自費：${counts.selfPay}`;
    if (els.countSelfBringText) els.countSelfBringText.textContent = `自帶：${counts.selfBring}`;
  }

  function updateLastUpdatedBanner() {
    if (!els.lastUpdatedText) return;

    if (!state.currentDocId) {
      els.lastUpdatedText.textContent = '資料最後更新時間：尚未選擇月份';
      return;
    }

    const updatedAt = state.currentMeta.updatedAt;
    const updatedByName = state.currentMeta.updatedByName || '';
    if (!updatedAt) {
      els.lastUpdatedText.textContent = '資料最後更新時間：目前尚無更新紀錄';
      return;
    }

    const byText = updatedByName ? `（由${updatedByName}更新）` : '';
    els.lastUpdatedText.textContent = `資料最後更新時間：${formatDateTime(updatedAt)}${byText}`;
  }

  function updateTabButtons() {
    if (els.tabSelfPay) els.tabSelfPay.classList.toggle('active', state.currentTab === 'selfPay');
    if (els.tabSelfBring) els.tabSelfBring.classList.toggle('active', state.currentTab === 'selfBring');
  }

  function updateActiveMonthButton() {
    document.querySelectorAll('.month-btn').forEach(btn => btn.classList.remove('active'));
    if (!state.currentMonth) return;
    const active = document.querySelector(`.month-btn[data-month="${state.currentMonth}"]`);
    if (active) active.classList.add('active');
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
      btn.setAttribute('data-month', String(month));
      btn.innerHTML = `<span>${month} 月</span><span class="count" id="month-count-${month}">載入中...</span>`;
      btn.addEventListener('click', () => openMonth(state.currentYear, month));
      frag.appendChild(btn);
    }

    els.monthsGrid.innerHTML = '';
    els.monthsGrid.appendChild(frag);

    refreshMonthCounts();
    updateActiveMonthButton();
  }

  async function refreshMonthCounts() {
    try {
      const db = await getDb();

      for (let month = 1; month <= 12; month++) {
        const countEl = document.getElementById(`month-count-${month}`);
        if (!countEl) continue;

        try {
          const snap = await db.collection(COLLECTION_EXTRA_MEALS).doc(monthDocId(state.currentYear, month)).get();
          const entries = snap.exists ? ((snap.data().entries || []).map(normalizeEntry)) : [];
          const counts = getCounts(entries);
          countEl.textContent = `共 ${counts.all}｜自費 ${counts.selfPay}｜自帶 ${counts.selfBring}`;
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
      els.currentMonthSubtitle.textContent = `目前顯示「${getMealSourceLabel(state.currentTab)}」分頁資料`;
    }
    if (els.addEntryBtn) els.addEntryBtn.disabled = false;
    if (els.copyBtn) els.copyBtn.disabled = false;
    if (els.entriesTbody) {
      els.entriesTbody.innerHTML = `<tr><td colspan="7" class="empty">讀取中...</td></tr>`;
    }

    updateActiveMonthButton();
    await loadMonthEntries();
  }

  async function loadMonthEntries() {
    const db = await getDb();
    const docRef = db.collection(COLLECTION_EXTRA_MEALS).doc(state.currentDocId);
    const snap = await docRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};

    state.currentEntries = Array.isArray(data.entries) ? data.entries.map(normalizeEntry) : [];
    state.currentEntries.sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));
    state.currentMeta = {
      updatedAt: data.updatedAt || null,
      updatedById: data.updatedById || '',
      updatedByName: data.updatedByName || '',
    };

    renderEntriesTable();
    updateLastUpdatedBanner();
    updateCountSummary();
    refreshMonthCounts();
  }

  function renderEntriesTable() {
    if (!els.entriesTbody) return;

    const filteredEntries = state.currentEntries
      .filter(item => (item.mealSource || 'selfPay') === state.currentTab)
      .sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));

    if (els.currentMonthSubtitle) {
      els.currentMonthSubtitle.textContent = state.currentDocId
        ? `目前顯示「${getMealSourceLabel(state.currentTab)}」分頁資料`
        : '會顯示該月份所有有加餐的住民';
    }

    updateCountSummary();
    updateTabButtons();

    if (!state.currentDocId) {
      els.entriesTbody.innerHTML = `<tr><td colspan="7" class="empty">請先從左邊選一個月份</td></tr>`;
      return;
    }

    if (!filteredEntries.length) {
      els.entriesTbody.innerHTML = `<tr><td colspan="7" class="empty">這個月份的「${getMealSourceLabel(state.currentTab)}」目前沒有加餐名單</td></tr>`;
      return;
    }

    els.entriesTbody.innerHTML = filteredEntries.map((item) => `
      <tr>
        <td>${escapeHtml(item.bedNumber || '')}</td>
        <td>${escapeHtml(item.residentName || '')}</td>
        <td><span class="pill ${escapeHtml(getMealSourceClass(item.mealSource))}">${escapeHtml(getMealSourceLabel(item.mealSource))}</span></td>
        <td><span class="pill">${escapeHtml(item.mealType || '')}</span></td>
        <td>${escapeHtml(item.createdByName || '')}</td>
        <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
        <td><button type="button" class="danger" data-entry-key="${escapeHtml(getEntryKey(item))}">刪除</button></td>
      </tr>
    `).join('');

    els.entriesTbody.querySelectorAll('[data-entry-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entryKey = btn.getAttribute('data-entry-key');
        const row = state.currentEntries.find(item => getEntryKey(item) === entryKey);
        if (!row) return;

        if (!confirm(`確定刪除 ${row.bedNumber}｜${row.residentName}（${getMealSourceLabel(row.mealSource)}）的加餐資料？`)) return;

        state.currentEntries = state.currentEntries.filter(item => getEntryKey(item) !== entryKey);
        await saveCurrentEntries();
        showToast('已刪除加餐資料');
      });
    });
  }

  async function saveCurrentEntries() {
    const db = await getDb();
    const docRef = db.collection(COLLECTION_EXTRA_MEALS).doc(state.currentDocId);
    const now = new Date();

    await docRef.set({
      year: state.currentYear,
      month: state.currentMonth,
      entries: state.currentEntries.map(normalizeEntry),
      updatedAt: now,
      updatedById: state.user.id,
      updatedByName: state.user.name,
    }, { merge: true });

    state.currentEntries = state.currentEntries.map(normalizeEntry)
      .sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));
    state.currentMeta = {
      updatedAt: now,
      updatedById: state.user.id,
      updatedByName: state.user.name,
    };

    renderEntriesTable();
    updateLastUpdatedBanner();
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

    els.noticeOkBtn?.addEventListener('click', closeNoticeModal);
    els.noticeModal?.addEventListener('click', (e) => {
      if (e.target === els.noticeModal) closeNoticeModal();
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
    if (els.mealSourceSelect) els.mealSourceSelect.value = getCurrentSourceForNewEntry();
  }

  async function handleSaveEntry() {
    if (!state.currentDocId) {
      showToast('請先選擇月份');
      return;
    }

    const residentId = els.residentSelect?.value;
    const resident = state.residents.find(r => r.id === residentId);
    const mealType = els.mealTypeSelect?.value;
    const mealSource = els.mealSourceSelect?.value;

    if (!resident) return showToast('請先選擇住民');
    if (!['selfPay', 'selfBring'].includes(mealSource)) return showToast('請先選擇分類');
    if (!MEAL_TYPES.includes(mealType)) return showToast('請先選擇加餐飲食');

    const existingIndex = state.currentEntries.findIndex(x =>
      (x.residentId === resident.id) && ((x.mealSource || 'selfPay') === mealSource)
    );

    const existingRow = existingIndex >= 0 ? state.currentEntries[existingIndex] : null;

    const entry = {
      residentId: resident.id,
      bedNumber: resident.bedNumber,
      residentName: resident.residentName,
      mealSource,
      mealType,
      note: existingRow?.note || '',
      createdById: existingRow?.createdById || state.user.id,
      createdByName: existingRow?.createdByName || state.user.name,
      createdAt: existingRow?.createdAt || new Date(),
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
      showToast(`已更新該住民的${getMealSourceLabel(mealSource)}加餐資料`);
      return;
    }

    state.currentEntries.push(entry);
    await saveCurrentEntries();
    closeModal('entryModal');
    showToast(`已新增${getMealSourceLabel(mealSource)}加餐資料`);
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
    const entries = snap.exists ? ((snap.data().entries || []).map(normalizeEntry)) : [];

    state.sourceEntries = entries.slice().sort((a, b) => naturalBedCompare(a.bedNumber, b.bedNumber));

    if (els.copySourceHint) {
      const counts = getCounts(state.sourceEntries);
      els.copySourceHint.textContent = `${formatMonthLabel(year, month)} 共有 ${counts.all} 筆名單（自費 ${counts.selfPay}／自帶 ${counts.selfBring}）`;
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
          <div class="muted">${escapeHtml(getMealSourceLabel(item.mealSource))}｜${escapeHtml(item.mealType || '')}</div>
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
        showToast(added ? '已複製 1 筆名單' : '這筆住民同分類已存在，已自動跳過');
      });
    });
  }

  function copyEntriesToCurrent(entries) {
    let added = 0;

    for (const sourceItem of entries) {
      const src = normalizeEntry(sourceItem);
      const exists = state.currentEntries.some(x => getEntryKey(x) === getEntryKey(src));
      if (exists) continue;

      state.currentEntries.push({
        residentId: src.residentId || '',
        bedNumber: src.bedNumber || '',
        residentName: src.residentName || '',
        mealSource: src.mealSource || 'selfPay',
        mealType: src.mealType || '',
        note: src.note || '',
        createdById: state.user.id,
        createdByName: state.user.name,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: state.user.id,
        updatedByName: state.user.name,
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

  function setCurrentTab(tab) {
    state.currentTab = tab === 'selfBring' ? 'selfBring' : 'selfPay';
    updateTabButtons();
    renderEntriesTable();
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

    els.tabSelfPay?.addEventListener('click', () => setCurrentTab('selfPay'));
    els.tabSelfBring?.addEventListener('click', () => setCurrentTab('selfBring'));
  }

  async function init() {
    try {
      if (els.loginUserText) els.loginUserText.textContent = '登入者：初始化中...';

      await waitForFirebaseReady();

      state.user = getCurrentUser();
      if (els.loginUserText) {
        els.loginUserText.textContent =
          state.user.id === 'guest'
            ? '登入者：未登入使用者'
            : `登入者：${state.user.id} ${state.user.name}`;
      }

      bindModalClosers();
      bindEvents();
      setupYearControls();
      renderMonthsGrid();
      setupCopySelectors();
      updateLastUpdatedBanner();
      updateTabButtons();
      updateCountSummary();
      await loadResidents();
    } catch (err) {
      console.error(err);
      if (els.loginUserText) els.loginUserText.textContent = '登入者：讀取失敗';
      showToast(err.message || '初始化失敗', '系統訊息');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
