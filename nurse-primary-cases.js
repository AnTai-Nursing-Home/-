// 主責個案分配（清單 + 編輯）
// - 清單：顯示日期、標題、週次、住民總人數、製表人
// - 編輯：表格同舊版，但不再顯示上方日期/週次/製表人欄位；儲存時用 Modal 填寫
// - 右上角顯示登入者（員編 + 姓名），登入邏輯參考 supplies.js

const ROW_COUNT = 12;      // 預設 12 位護理師名額（每位 2 列）
const CASE_COLS = 7;       // 每行 7 格

// 仍沿用原集合名稱；新表單用「自動 ID」避免同一天多張表衝突
const COLLECTION = 'nurse_case_assignments';

let nurses = [];
let residents = [];
let baseListsLoaded = false;

let currentUser = { staffId: '', displayName: '' };
let currentSheetId = '';              // Firestore doc id
let currentSheetMeta = {              // 會顯示在清單的欄位
  date: '',
  title: '',
  week: '',
  totalResidents: '',
  maker: ''
};

let sheetMetaModal = null;
let saving = false;

// ========== Login（參考 supplies.js） ==========
function getLoginUser() {
  // 系統共用登入資訊
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem('antai_session_user');
      if (raw) {
        const a = JSON.parse(raw);
        const staffId = (a?.staffId || a?.username || a?.id || '').toString().trim();
        const displayName = (a?.displayName || a?.name || a?.staffName || '').toString().trim();
        if (staffId || displayName) return { staffId, displayName };
      }
    } catch (e) {}

    for (const k of ['officeAuth', 'nurseAuth', 'caregiverAuth']) {
      try {
        const raw = store.getItem(k);
        if (!raw) continue;
        const a = JSON.parse(raw);
        const staffId = (a?.staffId || a?.username || a?.id || '').toString().trim();
        const displayName = (a?.displayName || a?.name || a?.staffName || '').toString().trim();
        if (staffId || displayName) return { staffId, displayName };
      } catch (e) {}
    }
  }

  // 常見單值 key
  const maybeNameKeys = ['loginName','userName','displayName','currentUserName','staffName','caregiverName','nurseName','officeName'];
  for (const k of maybeNameKeys) {
    const v = sessionStorage.getItem(k) || localStorage.getItem(k);
    if (v) return { staffId: '', displayName: String(v).trim() };
  }
  return { staffId: '', displayName: '' };
}

function renderLoginUserBadge() {
  currentUser = getLoginUser();
  const el = document.getElementById('loginUserNameCases');
  const text = (currentUser.staffId || currentUser.displayName)
    ? `登入者：${[currentUser.staffId, currentUser.displayName].filter(Boolean).join(' ')}`
    : '登入者：未登入';
  if (el) el.textContent = text;
}

// ========== 住民/護理師 options ==========
function buildResidentOptionsHtml() {
  let html = '<option value="">--</option>';
  residents.forEach(r => {
    const name = r.name || r.id || '';
    html += `<option value="${name}">${name}</option>`;
  });
  return html;
}

function buildNurseOptionsHtml() {
  let html = '<option value="">--</option>';
  nurses.forEach(n => {
    const name = n.name || '';
    const id = n.id || '';
    html += `<option value="${id}">${name}</option>`;
  });
  return html;
}

// 避免重複選到同一住民
function refreshResidentOptions() {
  const selects = document.querySelectorAll('.case-select');
  if (!selects.length) return;

  const selectedSet = new Set();
  selects.forEach(sel => {
    const v = (sel.value || '').trim();
    if (v) selectedSet.add(v);
  });

  selects.forEach(sel => {
    const current = (sel.value || '').trim();
    let html = '<option value="">--</option>';
    residents.forEach(r => {
      const name = r.name || r.id || '';
      if (selectedSet.has(name) && name !== current) return;
      const selectedAttr = (name === current) ? ' selected' : '';
      html += `<option value="${name}"${selectedAttr}>${name}</option>`;
    });
    sel.innerHTML = html;
  });
}

function updateCaseCountForGroup(groupIndex) {
  const selects = document.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);
  let count = 0;
  selects.forEach(sel => {
    if (sel.value && sel.value.trim() !== '') count++;
  });
  const span = document.querySelector(`.case-count[data-group="${groupIndex}"]`);
  if (span) span.textContent = count > 0 ? String(count) : '';
}

function setTotalResidentsCell(val) {
  const cell = document.getElementById('totalResidentsCell');
  if (!cell) return;
  const v = String(val ?? '').trim();
  cell.textContent = v ? v : '—';
}

// ========== 表格渲染 ==========
function renderCaseTable() {
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const nurseOptions = buildNurseOptionsHtml();
  const residentOptions = buildResidentOptionsHtml();

  for (let i = 0; i < ROW_COUNT; i++) {
    const groupIndex = String(i);

    const trTop = document.createElement('tr');
    const trBottom = document.createElement('tr');

    // 員編（rowspan=2）
    const tdId = document.createElement('td');
    tdId.rowSpan = 2;
    const idSpan = document.createElement('span');
    idSpan.classList.add('nurse-id');
    idSpan.setAttribute('data-group', groupIndex);
    tdId.appendChild(idSpan);
    trTop.appendChild(tdId);

    // 護理師（rowspan=2）
    const tdName = document.createElement('td');
    tdName.rowSpan = 2;
    tdName.innerHTML = `
      <select class="form-select form-select-sm nurse-name-select" data-group="${groupIndex}">
        ${nurseOptions}
      </select>
    `;
    trTop.appendChild(tdName);

    // 上列 1~7
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trTop.appendChild(tdCase);
    }

    // 下列 8~14
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trBottom.appendChild(tdCase);
    }

    // 個案數（rowspan=2）
    const tdCount = document.createElement('td');
    tdCount.rowSpan = 2;
    tdCount.innerHTML = `<span class="case-count" data-group="${groupIndex}"></span>`;
    trTop.appendChild(tdCount);

    tbody.appendChild(trTop);
    tbody.appendChild(trBottom);
  }

  // 護理師選單事件：選名字 → 員編自動帶出
  const nameSelects = tbody.querySelectorAll('.nurse-name-select');
  nameSelects.forEach(select => {
    select.addEventListener('change', (event) => {
      const target = event.target;
      const groupIndex = target.getAttribute('data-group');
      const nurseId = target.value;
      const nurse = nurses.find(n => n.id === nurseId);
      const idSpan = tbody.querySelector(`.nurse-id[data-group="${groupIndex}"]`);
      if (idSpan) idSpan.textContent = nurse ? nurse.id : '';
    });
  });

  // 個案選單事件：更新個案數 + 重新整理住民清單（避免重複）
  const caseSelects = tbody.querySelectorAll('.case-select');
  caseSelects.forEach(select => {
    select.addEventListener('change', (event) => {
      const target = event.target;
      const groupIndex = target.getAttribute('data-group');
      updateCaseCountForGroup(groupIndex);
      refreshResidentOptions();
    });
  });

  refreshResidentOptions();
}

// ========== 收集/套用表格資料 ==========
function collectCaseTableData() {
  const rows = [];
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return rows;

  for (let i = 0; i < ROW_COUNT; i++) {
    const groupIndex = String(i);

    const idSpan = tbody.querySelector(`.nurse-id[data-group="${groupIndex}"]`);
    const nurseId = idSpan ? idSpan.textContent.trim() : '';

    const nameSelect = tbody.querySelector(`.nurse-name-select[data-group="${groupIndex}"]`);
    let nurseName = '';
    if (nameSelect) {
      const opt = nameSelect.options[nameSelect.selectedIndex];
      if (opt) nurseName = opt.textContent.trim();
    }

    const caseSelects = tbody.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);
    const cases = [];
    caseSelects.forEach(sel => cases.push((sel.value || '').trim()));

    const countSpan = tbody.querySelector(`.case-count[data-group="${groupIndex}"]`);
    const caseCount = countSpan ? (countSpan.textContent.trim() || '') : '';

    rows.push({ nurseId, nurseName, cases, caseCount });
  }
  return rows;
}

function applyCaseTableRows(rows) {
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return;

  for (let i = 0; i < Math.min(rows.length, ROW_COUNT); i++) {
    const r = rows[i] || {};
    const groupIndex = String(i);

    const idSpan = tbody.querySelector(`.nurse-id[data-group="${groupIndex}"]`);
    const nameSelect = tbody.querySelector(`.nurse-name-select[data-group="${groupIndex}"]`);
    const caseSelects = tbody.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);

    if (idSpan) idSpan.textContent = r.nurseId || '';
    if (nameSelect && r.nurseId) nameSelect.value = r.nurseId;

    if (caseSelects.length) {
      const arr = Array.isArray(r.cases) ? r.cases : [];
      for (let j = 0; j < Math.min(caseSelects.length, arr.length); j++) {
        caseSelects[j].value = arr[j] || '';
      }
    }
    updateCaseCountForGroup(groupIndex);
  }
  refreshResidentOptions();
}

// ========== Base lists（護理師/住民） ==========
async function loadCaseAssignBaseLists() {
  try {
    const nurseSnap = await db.collection('nurses').orderBy('id').get();
    nurses = nurseSnap.docs.map(doc => {
      const data = doc.data() || {};
      return { id: data.id || doc.id, name: data.name || '' };
    });

    const residentSnap = await db.collection('residents').orderBy('bedNumber').get();
    residents = residentSnap.docs.map(doc => {
      const data = doc.data() || {};
      return { id: data.residentNumber || doc.id, name: doc.id };
    });

    baseListsLoaded = true;
    renderCaseTable();
  } catch (error) {
    console.error('載入主責個案分配（護理師/住民清單）失敗：', error);
    alert('載入主責個案分配資料失敗，請稍後再試。');
  }
}

// ========== 清單（Sheets list） ==========
function fmtTime(ts) {
  try {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString('zh-TW');
    if (ts instanceof Date) return ts.toLocaleString('zh-TW');
  } catch (e) {}
  return '';
}

function safeText(v) {
  return String(v ?? '').trim();
}

async function loadSheetsList() {
  const tbody = document.getElementById('sheetsTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>';

  try {
    // 先嘗試用 date 排序（新資料都有 date 欄位）
    let snap = null;
    try {
      snap = await db.collection(COLLECTION).orderBy('date', 'desc').limit(200).get();
    } catch (e) {
      // 若舊資料沒有 date 欄位或尚未建立索引，退回用 updatedAt
      snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
    }

    const docs = snap.docs.map(d => ({ id: d.id, ...((d.data() || {})) }));
    if (!docs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">目前沒有任何個案分配表。</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    docs.forEach(d => {
      const date = safeText(d.date) || safeText(d.id);
      const title = safeText(d.title) || '(未命名)';
      const week = safeText(d.week);
      const totalResidents = safeText(d.totalResidents);
      const maker = safeText(d.maker);
      const updated = fmtTime(d.updatedAt);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center">${date}</td>
        <td>${escapeHtml(title)}</td>
        <td class="text-center">${escapeHtml(week)}</td>
        <td class="text-center">${escapeHtml(totalResidents)}</td>
        <td class="text-center">${escapeHtml(maker)}</td>
        <td class="text-center">${escapeHtml(updated)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary open-sheet-btn" data-id="${d.id}">
            開啟
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.open-sheet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditorById(id);
      });
    });
  } catch (err) {
    console.error('載入清單失敗：', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">載入清單失敗</td></tr>';
  }
}

function showListView() {
  document.getElementById('listSection')?.classList.remove('d-none');
  document.getElementById('editorSection')?.classList.add('d-none');
  currentSheetId = '';
  currentSheetMeta = { date: '', title: '', week: '', totalResidents: '', maker: '' };
}

function showEditorView() {
  document.getElementById('listSection')?.classList.add('d-none');
  document.getElementById('editorSection')?.classList.remove('d-none');
}

// ========== 開新表 / 開既有表 ==========
function defaultMetaForNewSheet() {
  const today = new Date().toISOString().slice(0, 10);
  const maker = [currentUser.staffId, currentUser.displayName].filter(Boolean).join(' ').trim();
  return { date: today, title: '', week: '', totalResidents: '', maker };
}

async function openNewSheet() {
  if (!baseListsLoaded) return;

  currentSheetId = '';
  currentSheetMeta = defaultMetaForNewSheet();

  renderCaseTable();
  setTotalResidentsCell(currentSheetMeta.totalResidents);

  renderCurrentSheetHeader();
  showEditorView();
  // URL 標示（不一定需要）
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'new');
    url.searchParams.delete('id');
    history.replaceState({}, '', url.toString());
  } catch (e) {}
}

async function openEditorById(id) {
  if (!baseListsLoaded) return;
  if (!id) return;

  currentSheetId = id;
  renderCaseTable();

  try {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) {
      alert('找不到此個案分配表。');
      showListView();
      return;
    }
    const data = snap.data() || {};
    currentSheetMeta = {
      date: safeText(data.date) || '',
      title: safeText(data.title) || '',
      week: safeText(data.week) || '',
      totalResidents: safeText(data.totalResidents) || '',
      maker: safeText(data.maker) || ''
    };

    const rows = Array.isArray(data.rows) ? data.rows : [];
    applyCaseTableRows(rows);
    setTotalResidentsCell(currentSheetMeta.totalResidents);

    renderCurrentSheetHeader();
    showEditorView();

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      url.searchParams.delete('mode');
      history.replaceState({}, '', url.toString());
    } catch (e) {}
  } catch (err) {
    console.error('讀取表單失敗：', err);
    alert('讀取表單失敗，請稍後再試。');
    showListView();
  }
}

function renderCurrentSheetHeader() {
  const titleEl = document.getElementById('currentSheetTitle');
  const metaEl = document.getElementById('currentSheetMeta');

  const title = currentSheetMeta.title ? currentSheetMeta.title : '（未命名）';
  const date = currentSheetMeta.date || '—';
  const week = currentSheetMeta.week || '—';
  const totalResidents = currentSheetMeta.totalResidents || '—';
  const maker = currentSheetMeta.maker || '—';

  if (titleEl) titleEl.textContent = `${title}`;
  if (metaEl) metaEl.textContent = `日期：${date}　週次：${week}　住民總人數：${totalResidents}　製表人：${maker}`;
}

// ========== 儲存（先開 Modal） ==========
function ensureModal() {
  if (!sheetMetaModal) {
    const el = document.getElementById('sheetMetaModal');
    if (el) sheetMetaModal = new bootstrap.Modal(el);
  }
}

function fillModalFromMeta() {
  const maker = [currentUser.staffId, currentUser.displayName].filter(Boolean).join(' ').trim();

  const dateEl = document.getElementById('metaDate');
  const titleEl = document.getElementById('metaTitle');
  const weekEl = document.getElementById('metaWeek');
  const totalEl = document.getElementById('metaTotalResidents');
  const makerEl = document.getElementById('metaMaker');

  if (dateEl) dateEl.value = currentSheetMeta.date || new Date().toISOString().slice(0, 10);
  if (titleEl) titleEl.value = currentSheetMeta.title || '';
  if (weekEl) weekEl.value = currentSheetMeta.week || '';
  if (totalEl) totalEl.value = currentSheetMeta.totalResidents || '';
  if (makerEl) makerEl.value = currentSheetMeta.maker || maker;
}

function readMetaFromModal() {
  const date = document.getElementById('metaDate')?.value || '';
  const title = document.getElementById('metaTitle')?.value?.trim() || '';
  const week = document.getElementById('metaWeek')?.value?.trim() || '';
  const totalResidents = document.getElementById('metaTotalResidents')?.value?.trim() || '';
  const maker = ([currentUser.staffId, currentUser.displayName].filter(Boolean).join(' ') || '').trim();

  return { date, title, week, totalResidents, maker };
}

async function saveSheetWithMeta(meta) {
  if (saving) return;
  saving = true;

  try {
    if (!meta.date) return alert('請填寫日期');
    if (!meta.title) return alert('請填寫標題');
    if (meta.totalResidents === '') return alert('請填寫住民總人數');

    const rows = collectCaseTableData();
    const filteredRows = rows.filter(r => {
      const hasCases = Array.isArray(r.cases) && r.cases.some(c => c && c.trim() !== '');
      return (r.nurseId && r.nurseId.trim() !== '') || hasCases;
    });

    const data = {
      date: meta.date,
      title: meta.title,
      week: meta.week,
      totalResidents: meta.totalResidents,
      maker: meta.maker,
      rows: filteredRows,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 新表：用 date + timestamp 組合成 doc id，避免同一天多表衝突
    if (!currentSheetId) {
      currentSheetId = `${meta.date}__${Date.now()}`;
    }

    await db.collection(COLLECTION).doc(currentSheetId).set(data, { merge: true });

    currentSheetMeta = { ...meta };
    setTotalResidentsCell(currentSheetMeta.totalResidents);
    renderCurrentSheetHeader();

    alert('主責個案分配表已儲存完成。');
    await loadSheetsList();
  } catch (err) {
    console.error('儲存失敗：', err);
    alert('儲存失敗，請稍後再試。');
  } finally {
    saving = false;
  }
}

// ========== 匯出 Excel（沿用舊版，增加標題/住民總人數） ==========
function toRocDotDate(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return '';
  const rocYear = y - 1911;
  return `${rocYear}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

async function exportCaseAssignExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS 載入失敗，無法匯出 Excel。');
    return;
  }

  const meta = currentSheetMeta || {};
  const isoDate = meta.date || '';
  const rocDate = toRocDotDate(isoDate);
  const title = meta.title || '主責個案分配表';
  const weekText = meta.week || '';
  const totalResidents = meta.totalResidents || '';
  const maker = meta.maker || '';

  const titleInfo = `日期：${rocDate || isoDate} ${weekText ? `(${weekText}) ` : ''}製表人：${maker || ''} 住民總人數：${totalResidents || ''}`;

  const rows = collectCaseTableData();
  const filteredRows = rows.filter(r => {
    const hasCases = Array.isArray(r.cases) && r.cases.some(c => c && c.trim() !== '');
    return (r.nurseId && r.nurseId.trim() !== '') || hasCases;
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('主責個案分配');

  const fontTitle = { name: '標楷體', size: 16, bold: true };
  const fontHeader = { name: '標楷體', size: 12, bold: true };
  const fontCell = { name: '標楷體', size: 12 };
  const borderThin = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  ws.columns = [
    { header: '員編', key: 'nurseId', width: 17 },
    { header: '護理師', key: 'nurseName', width: 17 },
    { header: '1', key: 'c1', width: 17 },
    { header: '2', key: 'c2', width: 17 },
    { header: '3', key: 'c3', width: 17 },
    { header: '4', key: 'c4', width: 17 },
    { header: '5', key: 'c5', width: 17 },
    { header: '6', key: 'c6', width: 17 },
    { header: '7', key: 'c7', width: 17 },
    { header: '備註(個案數)', key: 'count', width: 17 }
  ];

  // 標題
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 資訊列
  ws.mergeCells('A2:J2');
  const infoCell = ws.getCell('A2');
  infoCell.value = titleInfo;
  infoCell.font = fontCell;
  infoCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // 表頭（兩層）
  ws.mergeCells('A3:A4');
  ws.mergeCells('B3:B4');
  ws.mergeCells('C3:I3');
  ws.mergeCells('J3:J4');

  const headerTop = ws.getRow(3);
  headerTop.getCell(1).value = '員編';
  headerTop.getCell(2).value = '護理師';
  headerTop.getCell(3).value = '主責個案';
  headerTop.getCell(10).value = '備註(個案數)';

  const headerBottom = ws.getRow(4);
  const labels = ['1', '2', '3', '4', '5', '6', '7'];
  for (let i = 0; i < labels.length; i++) headerBottom.getCell(3 + i).value = labels[i];

  [headerTop, headerBottom].forEach(row => {
    row.height = 22;
    row.eachCell(cell => {
      cell.font = fontHeader;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = borderThin;
    });
  });

  // 資料列
  let excelRowIndex = 5;
  filteredRows.forEach(r => {
    const topRow = ws.getRow(excelRowIndex);
    const bottomRow = ws.getRow(excelRowIndex + 1);

    ws.mergeCells(excelRowIndex, 1, excelRowIndex + 1, 1);
    ws.mergeCells(excelRowIndex, 2, excelRowIndex + 1, 2);
    ws.mergeCells(excelRowIndex, 10, excelRowIndex + 1, 10);

    topRow.getCell(1).value = r.nurseId || '';
    topRow.getCell(2).value = r.nurseName || '';
    topRow.getCell(10).value = r.caseCount || '';

    for (let i = 0; i < 7; i++) {
      topRow.getCell(3 + i).value = (r.cases && r.cases[i]) || '';
      bottomRow.getCell(3 + i).value = (r.cases && r.cases[7 + i]) || '';
    }

    [topRow, bottomRow].forEach(row => {
      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = fontCell;
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center', wrapText: false };
        cell.border = borderThin;
      });
    });

    excelRowIndex += 2;
  });

  // 底部總人數（對應你要的「備註欄最下面那格」）
  const totalRowIndex = excelRowIndex + 1;
  ws.mergeCells(totalRowIndex, 1, totalRowIndex, 9);
  ws.getRow(totalRowIndex).getCell(1).value = '總人數';
  ws.getRow(totalRowIndex).getCell(1).font = fontHeader;
  ws.getRow(totalRowIndex).getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(totalRowIndex).getCell(1).border = borderThin;

  ws.getRow(totalRowIndex).getCell(10).value = totalResidents || '';
  ws.getRow(totalRowIndex).getCell(10).font = fontHeader;
  ws.getRow(totalRowIndex).getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(totalRowIndex).getCell(10).border = borderThin;

  // 列印設定
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 }
  };
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  const filename = isoDate
    ? `主責個案分配表_${isoDate.replace(/-/g, '')}.xlsx`
    : '主責個案分配表.xlsx';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ========== Utils ==========
function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ========== 事件綁定 ==========
function bindUI() {
  // list -> new
  const newBtn = document.getElementById('newSheetBtn');
  if (newBtn) newBtn.addEventListener('click', openNewSheet);

  // editor -> back
  const backBtn = document.getElementById('backToListBtn');
  if (backBtn) backBtn.addEventListener('click', () => {
    showListView();
    loadSheetsList();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      url.searchParams.delete('mode');
      history.replaceState({}, '', url.toString());
    } catch (e) {}
  });

  // save (open modal)
  const saveBtn = document.getElementById('saveButton');
  if (saveBtn) {
    const originalHtml = saveBtn.innerHTML;
    saveBtn.addEventListener('click', () => {
      if (saveBtn.disabled) return;

      ensureModal();
      fillModalFromMeta();

      const maker = [currentUser.staffId, currentUser.displayName].filter(Boolean).join(' ').trim();
      if (!maker) {
        alert('未偵測到登入者，無法自動帶入製表人。請先完成登入。');
        return;
      }

      sheetMetaModal?.show();
    });

    const confirmBtn = document.getElementById('confirmSaveBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (saveBtn.disabled) return;

        const meta = readMetaFromModal();
        // 更新畫面顯示的總人數（即時）
        setTotalResidentsCell(meta.totalResidents);

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>儲存中...';
        confirmBtn.disabled = true;

        try {
          await saveSheetWithMeta(meta);
          sheetMetaModal?.hide();
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHtml;
          confirmBtn.disabled = false;
        }
      });
    }
  }

  // print
  const printBtn = document.getElementById('printButton');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // export excel
  const exportBtn = document.getElementById('exportExcelButton');
  if (exportBtn) exportBtn.addEventListener('click', exportCaseAssignExcel);
}

// ========== 初始化 ==========
async function initPage() {
  renderLoginUserBadge();
  ensureModal();
  bindUI();

  await loadCaseAssignBaseLists();
  await loadSheetsList();

  // 若 URL 帶 id，直接開
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    const mode = url.searchParams.get('mode');
    if (id) {
      openEditorById(id);
    } else if (mode === 'new') {
      openNewSheet();
    } else {
      showListView();
    }
  } catch (e) {}
}

// Firebase 初始化完成後載入資料
document.addEventListener('firebase-ready', () => {
  initPage();
});
