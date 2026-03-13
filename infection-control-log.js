(function () {
  const COLLECTION = 'infectionControlLogs';
  const SESSION_KEY = 'antai_session_user';
  const FACILITY_NAME = '安泰醫療社團法人附設安泰護理之家';
  const DOCX_FONT = '標楷體';
  const OFF_SHIFTS = ['OFF', 'OF', 'OFH', 'V', '病', '公', '休', '休假', '例休', '特休'];
  const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  const ROWS = [
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '1.定期宣導感染管制相關政策或措施' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '2.訂定或檢視更新感染管制手冊' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '3.撰寫感染管制年度計畫' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '4.撰寫感染管制年終成果報告' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '5.撰寫感染管制教育訓練年度計畫' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '6.撰寫感染管制教育訓練年終成果報告' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '7.撰寫或修訂新興傳染病疫情或群聚感染事件發生之應變計畫' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '8.辦理新興傳染病疫情或群聚感染事件之演習' },
    { category: '(一)訂定或檢視計畫、規範、流程及報告', item: '9.依據不同疫情落實並滾動式調整訪客管理規範' },
    { category: '(二)服務對象及工作人員管理', item: '1.新進服務對象健康管理及追蹤' },
    { category: '(二)服務對象及工作人員管理', item: '2.新進工作人員健康管理及追蹤' },
    { category: '(二)服務對象及工作人員管理', item: '3.服務對象年度健康管理及追蹤' },
    { category: '(二)服務對象及工作人員管理', item: '4.工作人員年度健康管理及追蹤' },
    { category: '(二)服務對象及工作人員管理', item: '5.服務對象及工作人員疫苗接種' },
    { category: '(二)服務對象及工作人員管理', item: '6.工作人員感染管制教育訓練' },
    { category: '(二)服務對象及工作人員管理', item: '7.依「人口密集機構傳染病監視作業注意事項」規定執行疫情監測及上網登錄通報' },
    { category: '(二)服務對象及工作人員管理', item: '8.感染個案收案、分析及監測' },
    { category: '(二)服務對象及工作人員管理', item: '9.群聚感染事件處理及紀錄' },
    { category: '(二)服務對象及工作人員管理', item: '10.撰寫機構間感染管制轉介單' },
    { category: '(三)環境及物資管理', item: '1.環境清潔定期巡視及防蚊蟲措施' },
    { category: '(三)環境及物資管理', item: '2.機構內洗手設施管理' },
    { category: '(三)環境及物資管理', item: '3.衛材及器械之清潔消毒或滅菌及管理' },
    { category: '(三)環境及物資管理', item: '4.防護裝備物資點班與管理' },
    { category: '(四)稽核作業', item: '1.手部衛生遵從率及正確率之稽核' },
    { category: '(四)稽核作業', item: '2.隔離空間使用情形之監測' },
    { category: '(四)稽核作業', item: '3.漂白水泡製流程、濃度監測' },
    { category: '(四)稽核作業', item: '4.照護人員穿脫個人防護裝備遵從率及正確率之稽核' },
    { category: '(四)稽核作業', item: '5.侵入性照護技術之正確性稽核' },
    { category: '(四)稽核作業', item: '6.稽核結果回饋' }
  ].map((row, idx) => ({ ...row, id: `row_${String(idx + 1).padStart(2, '0')}` }));

  const $ = (id) => document.getElementById(id);
  const els = {
    loginBadge: $('loginBadge'),
    yearFilter: $('yearFilter'),
    btnReload: $('btnReload'),
    btnNew: $('btnNew'),
    listSection: $('listSection'),
    editorSection: $('editorSection'),
    listBox: $('listBox'),
    loadingText: $('loadingText'),
    listEmpty: $('listEmpty'),
    btnBack: $('btnBack'),
    btnUploadSchedule: $('btnUploadSchedule'),
    scheduleFileInput: $('scheduleFileInput'),
    btnSave: $('btnSave'),
    btnExportDocx: $('btnExportDocx'),
    btnDelete: $('btnDelete'),
    logYear: $('logYear'),
    logMonth: $('logMonth'),
    btnBuildMonth: $('btnBuildMonth'),
    specialistSelect: $('specialistSelect'),
    scheduleSourceText: $('scheduleSourceText'),
    bedCount: $('bedCount'),
    isFullTime: $('isFullTime'),
    weeklyHours: $('weeklyHours'),
    tableHead: $('tableHead'),
    tableBody: $('tableBody'),
    editorTitle: $('editorTitle'),
    editorSub: $('editorSub'),
    detectedStaffList: $('detectedStaffList'),
    btnConfirmDetectedStaff: $('btnConfirmDetectedStaff'),
    tableWrap: $('tableWrap'),
    tableScrollTop: $('tableScrollTop'),
    tableScrollTopInner: $('tableScrollTopInner'),
    logTable: $('logTable')
  };

  let recorder = { staffId: '', displayName: '' };
  let currentDocId = null;
  let currentDoc = null;
  let weekdayColumns = [];
  let specialistCandidates = [];
  let selectedDetectedStaffId = '';
  let scheduleShiftMap = {};
  let detectModal = null;
  let firebaseReadyPromise = null;

  function setLoginBadge(text) {
    if (!els.loginBadge) return;
    els.loginBadge.textContent = text || '登入者：—';
  }

  function getSessionUser() {
    try {
      const candidateKeys = [SESSION_KEY, 'officeAuth'];
      for (const key of candidateKeys) {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (!u) continue;
        const staffId = u.staffId || u.id || u.employeeId || u.empId || '';
        const displayName = u.displayName || u.name || u.staffName || u.username || '';
        if (!staffId && !displayName) continue;
        return { staffId, displayName, sourceKey: key, raw: u };
      }
      return null;
    } catch (e) {
      console.warn('[infection-control-log] getSessionUser failed:', e);
      return null;
    }
  }

  function syncLoginBadgeFromSession() {
    const su = getSessionUser();
    if (!su) {
      recorder = { staffId: '', displayName: '' };
      setLoginBadge('登入者：—');
      return null;
    }
    recorder = { staffId: su.staffId || '', displayName: su.displayName || '' };
    const label = `登入者：${recorder.staffId} ${recorder.displayName}`.replace(/\s+/g, ' ').trim();
    setLoginBadge(label || '登入者：—');
    console.log('[infection-control-log] login user from session =', su.sourceKey, su);
    return su;
  }

  async function loadCurrentUser() {
    const su = syncLoginBadgeFromSession();
    if (su) return recorder;

    try {
      if (firebase && typeof firebase.auth === 'function') {
        const auth = firebase.auth();
        const u = auth.currentUser || await new Promise((resolve) => {
          let settled = false;
          const finish = (val) => {
            if (settled) return;
            settled = true;
            resolve(val || null);
          };
          const off = auth.onAuthStateChanged((user) => {
            if (typeof off === 'function') off();
            finish(user || null);
          }, () => finish(null));
          setTimeout(() => finish(auth.currentUser || null), 1500);
        });
        if (u && u.uid && window.db) {
          const acc = await db.collection('userAccounts').doc(u.uid).get();
          if (acc.exists) {
            const d = acc.data() || {};
            recorder = {
              staffId: d.staffId || d.id || d.employeeId || '',
              displayName: d.displayName || d.name || d.staffName || d.username || ''
            };
            const label = `登入者：${recorder.staffId} ${recorder.displayName}`.replace(/\s+/g, ' ').trim();
            setLoginBadge(label || '登入者：—');
            return recorder;
          }
        }
      }
    } catch (e) {
      console.warn('[infection-control-log] loadCurrentUser fallback failed:', e);
    }

    setLoginBadge('登入者：—');
    return recorder;
  }

  function waitForFirebaseReady() {
    if (window.db && (!window.firebase || !firebase.apps || firebase.apps.length)) return Promise.resolve(window.db);
    if (firebaseReadyPromise) return firebaseReadyPromise;
    firebaseReadyPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        if (!window.db) return;
        settled = true;
        resolve(window.db);
      };
      document.addEventListener('firebase-ready', finish, { once: true });
      const timer = setInterval(() => {
        if (window.db) {
          clearInterval(timer);
          finish();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        if (window.db) finish();
        else if (!settled) {
          settled = true;
          reject(new Error('Firebase 尚未初始化完成'));
        }
      }, 5000);
    });
    return firebaseReadyPromise;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function pad2(v) { return String(v).padStart(2, '0'); }

  function getRocYear(adYear) { return Number(adYear) - 1911; }

  function titleText(year, month) {
    return `${getRocYear(year)}年度 ${pad2(month)} 月安泰醫療社團法人附設護理之家感染管制專責人員工作日誌`;
  }

  function fillYearOptions() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear - 3; y <= currentYear + 3; y++) years.push(y);
    els.yearFilter.innerHTML = years.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
    els.logYear.innerHTML = years.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
    els.logMonth.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `<option value="${m}">${pad2(m)}</option>`;
    }).join('');
    els.yearFilter.value = String(currentYear);
    els.logYear.value = String(currentYear);
    els.logMonth.value = String(now.getMonth() + 1);
  }

  const GOV_WORKDAY_RULES = {
    2024: {
      holidays: [
        '2024-01-01',
        '2024-02-08', '2024-02-09', '2024-02-12', '2024-02-13', '2024-02-14',
        '2024-02-28',
        '2024-04-04', '2024-04-05',
        '2024-06-10',
        '2024-09-17',
        '2024-10-10',
        '2024-10-11'
      ],
      makeUpWorkdays: ['2024-02-17']
    },
    2025: {
      holidays: [
        '2025-01-01',
        '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
        '2025-02-28',
        '2025-04-03', '2025-04-04',
        '2025-05-01', '2025-05-30',
        '2025-09-29',
        '2025-10-06', '2025-10-10', '2025-10-24',
        '2025-12-25'
      ],
      makeUpWorkdays: []
    },
    2026: {
      holidays: [
        '2026-01-01',
        '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-27',
        '2026-04-03', '2026-04-06',
        '2026-06-19',
        '2026-09-25', '2026-09-28',
        '2026-10-09', '2026-10-26',
        '2026-12-25'
      ],
      makeUpWorkdays: []
    }
  };

  function isGovernmentWorkday(year, month, day) {
    const date = new Date(year, month - 1, day);
    const weekday = date.getDay();
    const key = `${year}-${pad2(month)}-${pad2(day)}`;
    const rules = GOV_WORKDAY_RULES[year];

    if (rules?.holidays?.includes(key)) return false;
    if (rules?.makeUpWorkdays?.includes(key)) return true;
    return weekday !== 0 && weekday !== 6;
  }

  function buildWeekdayColumns(year, month, allScheduleMap, specialistId) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const cols = [];
    const staffSchedule = specialistId ? (allScheduleMap?.[specialistId] || {}) : {};

    for (let day = 1; day <= daysInMonth; day++) {
      if (!isGovernmentWorkday(year, month, day)) continue;

      const date = new Date(year, month - 1, day);
      const week = date.getDay();
      const key = `${year}-${pad2(month)}-${pad2(day)}`;
      const shift = specialistId ? String((staffSchedule[key] ?? '')).trim() : '';
      const isEnabled = specialistId ? isWorkingShift(shift) : true;

      cols.push({ key, day, weekday: DAY_LABELS[week], shift, enabled: isEnabled });
    }

    return cols;
  }

  function isWorkingShift(shift) {
    const s = String(shift || '').trim().toUpperCase();
    if (!s) return false;
    return !OFF_SHIFTS.includes(s);
  }

  function normalizeScheduleData(rows, daysInMonth) {
    if (!Array.isArray(rows) || !rows.length) return [];

    const isDayHeader = (v) => {
      const n = Number(String(v).trim());
      return Number.isFinite(n) && n >= 1 && n <= 31;
    };

    let headerRowIndex = -1;
    let idIdx = -1, nameIdx = -1, dayStartIdx = -1;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const cells = row.map(v => String(v ?? '').trim());
      const foundId = cells.findIndex(c => c.includes('員編'));
      const foundName = cells.findIndex(c => c.replace(/\s+/g,'').includes('姓名') || (c.replace(/\s+/g,'').includes('姓') && c.replace(/\s+/g,'').includes('名')));
      if (foundId !== -1 && foundName !== -1) {
        const dayIdx = row.findIndex(v => isDayHeader(v));
        if (dayIdx !== -1) {
          headerRowIndex = r;
          idIdx = foundId;
          nameIdx = foundName;
          dayStartIdx = dayIdx;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      idIdx = 0;
      nameIdx = 1;
      dayStartIdx = 2;
    }

    const out = [];
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.some(v => String(v ?? '').trim() !== '')) continue;
      const staffId = String(row[idIdx] ?? '').trim();
      const staffName = String(row[nameIdx] ?? '').trim();
      if (!staffId || !staffName) continue;
      const shifts = {};
      for (let d = 1; d <= daysInMonth; d++) {
        shifts[d] = String(row[dayStartIdx + (d - 1)] ?? '').trim();
      }
      out.push({ staffId, staffName, shifts });
    }
    return out;
  }

  function parseWorkbook(file, monthValue) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const hasIdNameHeader = (ws) => {
            const r0 = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })?.[0] || [];
            const cells = r0.map(v => String(v ?? '').trim().replace(/\s+/g, ''));
            const hasId = cells.some(c => c.includes('員編'));
            const hasName = cells.some(c => c.includes('姓名') || (c.includes('姓') && c.includes('名')));
            return hasId && hasName;
          };
          let targetSheetName = workbook.SheetNames.find(name => hasIdNameHeader(workbook.Sheets[name]));
          if (!targetSheetName) targetSheetName = workbook.SheetNames.find(n => /班表/.test(n));
          if (!targetSheetName) targetSheetName = workbook.SheetNames[0];
          const ws = workbook.Sheets[targetSheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const [year, month] = monthValue.split('-').map(Number);
          const daysInMonth = new Date(year, month, 0).getDate();
          const normalized = normalizeScheduleData(rows, daysInMonth);
          resolve({ normalized, sheetName: targetSheetName });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function showList() {
    els.editorSection.classList.add('d-none');
    els.listSection.classList.remove('d-none');
  }

  function showEditor() {
    els.listSection.classList.add('d-none');
    els.editorSection.classList.remove('d-none');
  }

  function emptyData(year, month) {
    return {
      year,
      month,
      title: titleText(year, month),
      facilityName: FACILITY_NAME,
      bedCount: 136,
      isFullTime: false,
      weeklyHours: 10,
      specialistId: '',
      specialistName: '',
      specialistCandidates: [],
      weekdayColumns: buildWeekdayColumns(year, month, {}, ''),
      scheduleShiftMap: {},
      scheduleSource: '',
      checks: {},
      hoursByDate: {},
      signByDate: {},
      updatedAt: null,
      createdAt: null,
      createdBy: recorder.staffId || ''
    };
  }

  function updateEditorHeader() {
    const year = Number(els.logYear?.value || currentDoc?.year || new Date().getFullYear());
    const month = Number(els.logMonth?.value || currentDoc?.month || (new Date().getMonth() + 1));
    if (els.editorTitle) els.editorTitle.textContent = titleText(year, month);
    const specialist = currentDoc?.specialistName ? `｜專責人員：${currentDoc.specialistName}` : '';
    if (els.editorSub) els.editorSub.textContent = `${year}/${pad2(month)}${specialist}`;
  }

  function populateSpecialistSelect(candidates, selectedId) {
    specialistCandidates = Array.isArray(candidates) ? candidates.slice() : [];
    const options = ['<option value="">未指定</option>']
      .concat(specialistCandidates.map(s => `<option value="${escapeHtml(s.staffId)}">${escapeHtml(s.staffId)} ${escapeHtml(s.staffName)}</option>`));
    els.specialistSelect.innerHTML = options.join('');
    els.specialistSelect.value = selectedId || '';
  }

  function ensureCheckMap() {
    if (!currentDoc.checks || typeof currentDoc.checks !== 'object') currentDoc.checks = {};
    if (!currentDoc.hoursByDate || typeof currentDoc.hoursByDate !== 'object') currentDoc.hoursByDate = {};
    if (!currentDoc.signByDate || typeof currentDoc.signByDate !== 'object') currentDoc.signByDate = {};
  }

  function renderTable() {
    ensureCheckMap();
    weekdayColumns = buildWeekdayColumns(Number(els.logYear.value), Number(els.logMonth.value), currentDoc.scheduleShiftMap || {}, currentDoc.specialistId || '');
    currentDoc.weekdayColumns = weekdayColumns;

    els.tableHead.innerHTML = `
      <tr>
        <th rowspan="2" class="sticky-col-1">項次</th>
        <th rowspan="2" class="sticky-col-2">項目/日期/星期</th>
        ${weekdayColumns.map(c => `<th class="date-head">${c.day}</th>`).join('')}
      </tr>
      <tr>
        ${weekdayColumns.map(c => `<th class="date-head">${c.weekday}</th>`).join('')}
      </tr>
    `;

    const categoryCounts = ROWS.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {});

    let catRendered = {};
    const html = [];

    ROWS.forEach((row) => {
      const tr = [];
      tr.push('<tr>');
      if (!catRendered[row.category]) {
        tr.push(`<td class="cat-cell" rowspan="${categoryCounts[row.category]}">${escapeHtml(row.category)}</td>`);
        catRendered[row.category] = true;
      }
      tr.push(`<td class="item-cell">${escapeHtml(row.item)}</td>`);
      weekdayColumns.forEach((col) => {
        const checked = !!(currentDoc.checks[row.id] && currentDoc.checks[row.id][col.key]);
        const disabledClass = col.enabled ? 'enabled-day' : 'disabled-day';
        tr.push(`
          <td class="${disabledClass}">
            <input class="form-check-input day-check" type="checkbox"
              data-row-id="${row.id}" data-date-key="${col.key}" ${checked ? 'checked' : ''} ${col.enabled ? '' : 'disabled'}>
          </td>
        `);
      });
      tr.push('</tr>');
      html.push(tr.join(''));
    });

    html.push('<tr>');
    html.push('<td class="cat-cell">專責執行業務之時數</td>');
    html.push('<td class="item-cell">專責執行業務之時數</td>');
    weekdayColumns.forEach((col) => {
      const value = currentDoc.hoursByDate[col.key] ?? '';
      const disabledClass = col.enabled ? 'enabled-day' : 'disabled-day';
      html.push(`<td class="${disabledClass}"><input class="form-control form-control-sm hours-input day-hours" data-date-key="${col.key}" value="${escapeHtml(value)}" ${col.enabled ? '' : 'disabled'}></td>`);
    });
    html.push('</tr>');

    html.push('<tr>');
    html.push('<td class="cat-cell">感染管制專責人員簽章</td>');
    html.push('<td class="item-cell">感染管制專責人員簽章</td>');
    weekdayColumns.forEach((col) => {
      const defaultSign = col.enabled && currentDoc.specialistName ? currentDoc.specialistName : '';
      const value = currentDoc.signByDate[col.key] ?? defaultSign;
      const disabledClass = col.enabled ? 'enabled-day' : 'disabled-day';
      html.push(`<td class="${disabledClass}"><input class="form-control form-control-sm sign-input day-sign" data-date-key="${col.key}" value="${escapeHtml(value)}" ${col.enabled ? '' : 'disabled'}></td>`);
    });
    html.push('</tr>');

    els.tableBody.innerHTML = html.join('');
    bindDynamicInputs();
    syncTableScrollbars();
  }

  function syncTableScrollbars() {
    const wrap = els.tableWrap;
    const top = els.tableScrollTop;
    const inner = els.tableScrollTopInner;
    const table = els.logTable;
    if (!wrap || !top || !inner || !table) return;

    inner.style.width = `${Math.max(table.scrollWidth, wrap.clientWidth)}px`;

    if (!wrap.dataset.syncBound) {
      let syncing = false;
      wrap.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        top.scrollLeft = wrap.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      });
      top.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        wrap.scrollLeft = top.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      });
      window.addEventListener('resize', () => {
        inner.style.width = `${Math.max(table.scrollWidth, wrap.clientWidth)}px`;
        top.scrollLeft = wrap.scrollLeft;
      });
      wrap.dataset.syncBound = '1';
    }

    top.scrollLeft = wrap.scrollLeft;
  }

  function bindDynamicInputs() {
    document.querySelectorAll('.day-check').forEach((input) => {
      input.addEventListener('change', (e) => {
        const rowId = e.target.dataset.rowId;
        const dateKey = e.target.dataset.dateKey;
        currentDoc.checks[rowId] = currentDoc.checks[rowId] || {};
        currentDoc.checks[rowId][dateKey] = e.target.checked;
      });
    });
    document.querySelectorAll('.day-hours').forEach((input) => {
      input.addEventListener('input', (e) => {
        currentDoc.hoursByDate[e.target.dataset.dateKey] = e.target.value;
      });
    });
    document.querySelectorAll('.day-sign').forEach((input) => {
      input.addEventListener('input', (e) => {
        currentDoc.signByDate[e.target.dataset.dateKey] = e.target.value;
      });
    });
  }

  function syncTopFieldsToDoc() {
    currentDoc = currentDoc || emptyData(new Date().getFullYear(), new Date().getMonth() + 1);

    const safeYear = Number(els.logYear?.value || currentDoc.year || new Date().getFullYear());
    const safeMonth = Number(els.logMonth?.value || currentDoc.month || (new Date().getMonth() + 1));

    currentDoc.year = safeYear;
    currentDoc.month = safeMonth;
    currentDoc.title = titleText(currentDoc.year, currentDoc.month);
    currentDoc.bedCount = Number(els.bedCount?.value || currentDoc.bedCount || 0);
    currentDoc.isFullTime = !!els.isFullTime?.checked;
    currentDoc.weeklyHours = Number(els.weeklyHours?.value || currentDoc.weeklyHours || 0);
    currentDoc.specialistId = els.specialistSelect?.value || currentDoc.specialistId || '';
    const specialist = specialistCandidates.find(s => s.staffId === currentDoc.specialistId);
    currentDoc.specialistName = specialist?.staffName || currentDoc.specialistName || '';
    updateEditorHeader();
  }

  function fillForm(docData) {
    currentDoc = JSON.parse(JSON.stringify(docData));
    els.logYear.value = String(currentDoc.year);
    els.logMonth.value = String(currentDoc.month);
    els.bedCount.value = currentDoc.bedCount ?? 136;
    els.isFullTime.checked = !!currentDoc.isFullTime;
    els.weeklyHours.value = currentDoc.weeklyHours ?? 10;
    els.scheduleSourceText.value = currentDoc.scheduleSource || '尚未匯入班表';
    populateSpecialistSelect(currentDoc.specialistCandidates || [], currentDoc.specialistId || '');
    updateEditorHeader();
    renderTable();
  }

  function collectPayload() {
    syncTopFieldsToDoc();
    return {
      ...currentDoc,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: recorder.staffId || '',
      updatedByName: recorder.displayName || ''
    };
  }

  async function loadList() {
    try {
      const year = Number(els.yearFilter.value);
      els.listBox.innerHTML = '';
      els.listEmpty.classList.add('d-none');
      els.loadingText.classList.remove('d-none');
      await waitForFirebaseReady();
      const snap = await db.collection(COLLECTION)
        .where('year', '==', year)
        .orderBy('month', 'desc')
        .get();
      els.loadingText.classList.add('d-none');
      if (snap.empty) {
        els.listEmpty.classList.remove('d-none');
        return;
      }
      snap.forEach((doc) => {
        const d = doc.data() || {};
        const checkedCount = countChecks(d.checks);
        const specialist = d.specialistName ? `｜${d.specialistName}` : '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-group-item list-group-item-action list-item d-flex justify-content-between align-items-start';
        btn.innerHTML = `
          <div class="me-3 text-start">
            <div class="fw-semibold">${escapeHtml(titleText(d.year, d.month))}</div>
            <div class="text-muted small">${escapeHtml(`${d.year}/${pad2(d.month)}${specialist}｜已勾選 ${checkedCount} 格`)}</div>
          </div>
          <div class="text-muted small">${escapeHtml(doc.id.slice(0, 6))}</div>
        `;
        btn.addEventListener('click', async () => {
          await waitForFirebaseReady();
          const one = await db.collection(COLLECTION).doc(doc.id).get();
          currentDocId = doc.id;
          fillForm(one.data() || emptyData(year, 1));
          showEditor();
        });
        els.listBox.appendChild(btn);
      });
    } catch (e) {
      els.loadingText.classList.add('d-none');
      console.error(e);
      alert('讀取清單失敗，請稍後再試');
    }
  }

  function countChecks(checks) {
    let total = 0;
    if (!checks) return total;
    Object.values(checks).forEach((rowMap) => {
      Object.values(rowMap || {}).forEach((v) => { if (v) total++; });
    });
    return total;
  }

  async function saveDoc() {
    const payload = collectPayload();
    if (!currentDocId) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    if (!currentDocId) payload.createdBy = recorder.staffId || '';
    try {
      await waitForFirebaseReady();
      if (currentDocId) await db.collection(COLLECTION).doc(currentDocId).set(payload, { merge: true });
      else {
        const ref = await db.collection(COLLECTION).add(payload);
        currentDocId = ref.id;
      }
      alert('已儲存');
      await loadList();
    } catch (e) {
      console.error(e);
      alert('儲存失敗，請稍後再試');
    }
  }

  async function deleteDoc() {
    if (!currentDocId) {
      alert('尚未儲存，無法刪除');
      return;
    }
    if (!confirm('確定要刪除此工作日誌？此動作無法復原。')) return;
    try {
      await waitForFirebaseReady();
      await db.collection(COLLECTION).doc(currentDocId).delete();
      alert('已刪除');
      currentDocId = null;
      showList();
      await loadList();
    } catch (e) {
      console.error(e);
      alert('刪除失敗，請稍後再試');
    }
  }

  function rebuildMonth() {
    syncTopFieldsToDoc();
    currentDoc.weekdayColumns = buildWeekdayColumns(currentDoc.year, currentDoc.month, currentDoc.scheduleShiftMap || {}, currentDoc.specialistId || '');
    renderTable();
  }

  async function handleScheduleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const monthValue = `${els.logYear.value}-${pad2(els.logMonth.value)}`;
    try {
      const { normalized, sheetName } = await parseWorkbook(file, monthValue);
      if (!normalized.length) {
        alert('班表中沒有偵測到有效的人員資料');
        return;
      }
      specialistCandidates = normalized.map(row => ({ staffId: row.staffId, staffName: row.staffName }));
      scheduleShiftMap = {};
      normalized.forEach((row) => {
        const map = {};
        Object.entries(row.shifts).forEach(([day, shift]) => {
          const dateKey = `${els.logYear.value}-${pad2(els.logMonth.value)}-${pad2(day)}`;
          map[dateKey] = shift;
        });
        scheduleShiftMap[row.staffId] = map;
      });
      currentDoc.specialistCandidates = specialistCandidates;
      currentDoc.scheduleShiftMap = scheduleShiftMap;
      currentDoc.scheduleSource = `${file.name}｜工作表：${sheetName}`;
      els.scheduleSourceText.value = currentDoc.scheduleSource;
      renderDetectedStaffModal();
    } catch (err) {
      console.error(err);
      alert('讀取 Excel 班表失敗，請確認檔案格式是否正確。');
    } finally {
      e.target.value = '';
    }
  }

  function renderDetectedStaffModal() {
    els.detectedStaffList.innerHTML = specialistCandidates.map((s) => `
      <div class="col-md-6">
        <label class="border rounded-3 p-2 w-100 d-flex align-items-center gap-2">
          <input class="form-check-input mt-0 detected-staff-radio" type="radio" name="detectedStaff" value="${escapeHtml(s.staffId)}">
          <span>${escapeHtml(s.staffId)} ${escapeHtml(s.staffName)}</span>
        </label>
      </div>
    `).join('');
    selectedDetectedStaffId = currentDoc.specialistId || specialistCandidates[0]?.staffId || '';
    document.querySelectorAll('.detected-staff-radio').forEach((radio) => {
      if (radio.value === selectedDetectedStaffId) radio.checked = true;
      radio.addEventListener('change', () => {
        selectedDetectedStaffId = radio.value;
      });
    });
    detectModal.show();
  }

  function applyDetectedStaff() {
    currentDoc.specialistId = selectedDetectedStaffId || '';
    const picked = specialistCandidates.find(s => s.staffId === currentDoc.specialistId);
    currentDoc.specialistName = picked?.staffName || '';
    populateSpecialistSelect(specialistCandidates, currentDoc.specialistId);
    rebuildMonth();
    detectModal.hide();
  }

  function handleSpecialistChange() {
    syncTopFieldsToDoc();
    rebuildMonth();
  }

  function docxSafeText(v) {
    let s = String(v ?? '');
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    s = s.replace(/[\uFFFE\uFFFF]/g, '');
    s = s.replace(/[\uD800-\uDFFF]/g, '');
    return s;
  }

  function run(text, opts = {}) {
    return new window.docx.TextRun({
      text: docxSafeText(text),
      font: {
        name: DOCX_FONT,
        ascii: DOCX_FONT,
        hAnsi: DOCX_FONT,
        eastAsia: DOCX_FONT,
        cs: DOCX_FONT
      },
      size: opts.size ?? 20,
      bold: !!opts.bold
    });
  }

  function p(text, opts = {}) {
    return new window.docx.Paragraph({
      alignment: opts.align || window.docx.AlignmentType.LEFT,
      spacing: opts.spacing || { after: 80 },
      children: [run(text, opts)]
    });
  }

  function checkboxMark(v) { return v ? '☑' : '☐'; }

  async function exportDocx() {
    syncTopFieldsToDoc();

    if (!window.docx || !window.saveAs) {
      alert('Word 匯出元件未載入完成，請重新整理後再試。');
      return;
    }

    const {
      Document,
      Packer,
      Paragraph,
      Table,
      TableRow,
      TableCell,
      WidthType,
      AlignmentType,
      BorderStyle,
      PageOrientation,
      VerticalAlign,
      PageBreak,
      TableLayoutType
    } = window.docx;

    const border = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    };

    const pageWidthTwips = 14500; // A4 landscape printable width approx after margins
    const col1 = 1200;
    const col2 = 3600;
    // 一個月份以「一個跨頁」為原則：單月內容最多拆成雙面兩頁，不再拆成更多頁。
    const maxPagesPerMonth = 2;

    const leftPara = (text, size = 16, bold = false) => new Paragraph({
      spacing: { after: 40 },
      children: [run(text, { size, bold })]
    });

    const makeCell = (text, width, align = AlignmentType.CENTER, size = 16, bold = false) => {
      const para = new Paragraph({
        alignment: align,
        spacing: { after: 20 },
        children: [run(text, { size, bold })]
      });
      return new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        borders: border,
        children: [para]
      });
    };

    const buildDuplexMonthChunks = (cols) => {
      if (!cols.length) return [[]];
      if (cols.length <= 16) return [cols];

      const pageCount = Math.min(maxPagesPerMonth, 2);
      const firstSize = Math.ceil(cols.length / pageCount);
      const secondSize = cols.length - firstSize;
      return [cols.slice(0, firstSize), cols.slice(firstSize, firstSize + secondSize)].filter(chunk => chunk.length);
    };

    const chunks = buildDuplexMonthChunks(weekdayColumns);

    const sectionChildren = [];
    chunks.forEach((dateCols, chunkIndex) => {
      if (chunkIndex > 0) {
        sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }

      const dateCount = Math.max(dateCols.length, 1);
      const dayWidth = Math.max(420, Math.floor((pageWidthTwips - col1 - col2) / dateCount));
      const tableWidth = col1 + col2 + dayWidth * dateCount;

      const rows = [];
      rows.push(new TableRow({
        tableHeader: true,
        children: [
          makeCell('項次', col1, AlignmentType.CENTER, 18, true),
          makeCell('項目/日期/星期', col2, AlignmentType.CENTER, 18, true),
          ...dateCols.map(col => makeCell(String(col.day), dayWidth, AlignmentType.CENTER, 18, true))
        ]
      }));

      rows.push(new TableRow({
        tableHeader: true,
        children: [
          makeCell('', col1),
          makeCell('', col2),
          ...dateCols.map(col => makeCell(col.weekday, dayWidth, AlignmentType.CENTER, 18, true))
        ]
      }));

      for (const row of ROWS) {
        const children = [
          makeCell(row.category, col1, AlignmentType.CENTER, 14, false),
          makeCell(row.item, col2, AlignmentType.LEFT, 14, false)
        ];
        for (const col of dateCols) {
          const checked = !!(currentDoc.checks[row.id] && currentDoc.checks[row.id][col.key]);
          const mark = col.enabled ? (checked ? '■' : '□') : '－';
          children.push(makeCell(mark, dayWidth, AlignmentType.CENTER, 14, false));
        }
        rows.push(new TableRow({ children }));
      }

      rows.push(new TableRow({
        children: [
          makeCell('時數', col1, AlignmentType.CENTER, 14, true),
          makeCell('專責執行業務之時數', col2, AlignmentType.LEFT, 14, false),
          ...dateCols.map(col => makeCell(String(currentDoc.hoursByDate[col.key] || ''), dayWidth, AlignmentType.CENTER, 14, false))
        ]
      }));

      rows.push(new TableRow({
        children: [
          makeCell('簽章', col1, AlignmentType.CENTER, 14, true),
          makeCell('感染管制專責人員簽章', col2, AlignmentType.LEFT, 14, false),
          ...dateCols.map(col => makeCell(String(currentDoc.signByDate[col.key] || (col.enabled ? currentDoc.specialistName : '')), dayWidth, AlignmentType.CENTER, 14, false))
        ]
      }));

      sectionChildren.push(
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [run('安泰醫療社團法人附設安泰護理之家', { size: 28, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run('感染管制專責人員工作日誌', { size: 30, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [run(`${getRocYear(currentDoc.year)} 年 ${pad2(currentDoc.month)} 月（雙面列印第 ${chunkIndex + 1} 面）`, { size: 22, bold: true })] }),
        leftPara(`一、機構基本資料：(一)立案床數 ${currentDoc.bedCount || ''} 位；(二)感染管制 ${currentDoc.isFullTime ? '■' : '□'} 專責專任；(三)每週專責執行業務之時數 ${currentDoc.weeklyHours || ''} 小時`, 18, false),
        leftPara(`專責人員：${currentDoc.specialistName || '未指定'}`, 18, false),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          layout: TableLayoutType ? TableLayoutType.FIXED : undefined,
          rows
        })
      );
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: sectionChildren
      }]
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `感管工作日誌_${currentDoc.year}-${pad2(currentDoc.month)}.docx`);
    } catch (err) {
      console.error('[infection-control-log] exportDocx failed:', err);
      alert('Word 匯出失敗，請稍後再試。');
    }
  }

  function bindEvents() {
    els.yearFilter.addEventListener('change', loadList);
    els.btnReload.addEventListener('click', loadList);
    els.btnNew.addEventListener('click', () => {
      currentDocId = null;
      const year = Number(els.yearFilter.value);
      const month = new Date().getMonth() + 1;
      fillForm(emptyData(year, month));
      showEditor();
    });
    els.btnBack.addEventListener('click', () => showList());
    els.btnSave.addEventListener('click', saveDoc);
    els.btnDelete.addEventListener('click', deleteDoc);
    els.btnUploadSchedule.addEventListener('click', () => els.scheduleFileInput.click());
    els.scheduleFileInput.addEventListener('change', handleScheduleUpload);
    els.btnConfirmDetectedStaff.addEventListener('click', applyDetectedStaff);
    els.specialistSelect.addEventListener('change', handleSpecialistChange);
    els.btnBuildMonth.addEventListener('click', rebuildMonth);
    els.logYear.addEventListener('change', rebuildMonth);
    els.logMonth.addEventListener('change', rebuildMonth);
    els.btnExportDocx.addEventListener('click', exportDocx);
  }

  async function init() {
    try {
      await waitForFirebaseReady();
    } catch (e) {
      console.error('[infection-control-log] waitForFirebaseReady failed:', e);
    }

    await loadCurrentUser();
    fillYearOptions();
    detectModal = new bootstrap.Modal(document.getElementById('staffDetectModal'));
    bindEvents();
    showList();
    await loadList();

    window.addEventListener('storage', (ev) => {
      if (ev.key === SESSION_KEY || ev.key === 'officeAuth') syncLoginBadgeFromSession();
    });
  }

  let __booted = false;
  document.addEventListener('DOMContentLoaded', () => {
    const boot = () => {
      if (__booted) return;
      __booted = true;
      init();
    };
    if (window.db) boot();
    else document.addEventListener('firebase-ready', boot, { once: true });
  });
})();
