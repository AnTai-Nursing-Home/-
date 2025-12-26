// 主責個案分配 JS

const ROW_COUNT = 12;      // 預設 12 位護理師名額
const CASE_COLS = 7;       // 每排 7 格，一個護理師兩排共 14 格

let nurses = [];
let residents = [];

// 住民下拉選單 HTML
function buildResidentOptionsHtml() {
  let html = '<option value="">--</option>';
  residents.forEach(r => {
    const name = r.name || r.id || '';
    html += `<option value="${name}">${name}</option>`;
  });
  return html;
}

// 護理師名字下拉選單 HTML（value = 員編，顯示：名字 (員編)）
function buildNurseOptionsHtml() {
  let html = '<option value="">--</option>';
  nurses.forEach(n => {
    const name = n.name || '';
    const id = n.id || '';
    const label = id ? `${name} (${id})` : name;
    html += `<option value="${id}">${label}</option>`;
  });
  return html;
}

// 更新某一組（同一護理師，兩排）的主責個案數
function updateCaseCountForGroup(groupIndex) {
  const selects = document.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);
  let count = 0;
  selects.forEach(sel => {
    if (sel.value && sel.value.trim() !== '') count++;
  });
  const span = document.querySelector(`.case-count[data-group="${groupIndex}"]`);
  if (span) {
    span.textContent = count > 0 ? String(count) : '';
  }
}

// 建立表格：一個護理師兩排
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

    // 員編（由護理師名字自動帶出，rowspan=2）
    const tdId = document.createElement('td');
    tdId.rowSpan = 2;
    const idSpan = document.createElement('span');
    idSpan.classList.add('nurse-id');
    idSpan.setAttribute('data-group', groupIndex);
    tdId.appendChild(idSpan);
    trTop.appendChild(tdId);

    // 護理師名字（下拉選單，rowspan=2）
    const tdName = document.createElement('td');
    tdName.rowSpan = 2;
    tdName.innerHTML = `
      <select class="form-select form-select-sm nurse-name-select" data-group="${groupIndex}">
        ${nurseOptions}
      </select>
    `;
    trTop.appendChild(tdName);

    // 第一排主責個案（1~7）
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trTop.appendChild(tdCase);
    }

    // 第二排主責個案（8~14）
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trBottom.appendChild(tdCase);
    }

    // 個案數（兩排一起算，rowspan=2）
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
      if (idSpan) {
        idSpan.textContent = nurse ? nurse.id : '';
      }
    });
  });

  // 個案選單事件：更新個案數
  const caseSelects = tbody.querySelectorAll('.case-select');
  caseSelects.forEach(select => {
    select.addEventListener('change', (event) => {
      const target = event.target;
      const groupIndex = target.getAttribute('data-group');
      updateCaseCountForGroup(groupIndex);
    });
  });
}

// 從 Firestore 載入 護理師 / 住民 資料
async function loadCaseAssignData() {
  try {
    // 護理師
    const nurseSnap = await db.collection('nurses').orderBy('id').get();
    nurses = nurseSnap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: data.id || doc.id,
        name: data.name || ''
      };
    });

    // 住民（使用文件 ID 當姓名）
    const residentSnap = await db.collection('residents').orderBy('bedNumber').get();
    residents = residentSnap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: data.residentNumber || doc.id,
        name: doc.id
      };
    });

    renderCaseTable();
  } catch (error) {
    console.error('載入主責個案分配資料失敗：', error);
    alert('載入主責個案分配資料失敗，請稍後再試。');
  }
}

// 西元 yyyy-mm-dd → 民國 114.12.26 這種格式
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

// 取得目前表格資料（一個 group 一筆，含 14 個 case）
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
      if (opt) {
        const fullText = opt.textContent.trim();      // 例如：陳如 (114014)
        const match = fullText.match(/^(.*?)(\s*\(|$)/);
        nurseName = match ? match[1].trim() : fullText;
      }
    }

    const caseSelects = tbody.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);
    const cases = [];
    caseSelects.forEach(sel => {
      cases.push((sel.value || '').trim());
    });

    const countSpan = tbody.querySelector(`.case-count[data-group="${groupIndex}"]`);
    const caseCount = countSpan ? (countSpan.textContent.trim() || '') : '';

    rows.push({
      nurseId,
      nurseName,
      cases,
      caseCount
    });
  }

  return rows;
}

// 儲存主責個案分配（製表人必填）
async function saveCaseAssignment() {
  const assignDateInput = document.getElementById('assignDate');
  const assignWeekInput = document.getElementById('assignWeek');
  const assignMakerInput = document.getElementById('assignMaker');

  const isoDate = assignDateInput && assignDateInput.value ? assignDateInput.value : '';
  const week = assignWeekInput ? assignWeekInput.value.trim() : '';
  const maker = assignMakerInput ? assignMakerInput.value.trim() : '';

  const note1Input = document.getElementById('note1');
  const note2Input = document.getElementById('note2');
  const note3Input = document.getElementById('note3');
  const note1 = note1Input ? note1Input.value.trim() : '';
  const note2 = note2Input ? note2Input.value.trim() : '';
  const note3 = note3Input ? note3Input.value.trim() : '';

  if (!isoDate) {
    alert('請先選擇日期再儲存。');
    return;
  }
  if (!maker) {
    alert('請先填寫製表人再儲存。');
    return;
  }

  const rows = collectCaseTableData();
  // 去掉完全空白的列
  const filteredRows = rows.filter(r => {
    const hasCases = Array.isArray(r.cases) && r.cases.some(c => c && c.trim() !== '');
    return (r.nurseId && r.nurseId.trim() !== '') || hasCases;
  });

  const data = {
    date: isoDate,
    week,
    maker,
    note1,
    note2,
    note3,
    rows: filteredRows,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('nurse_case_assignments').doc(isoDate).set(data, { merge: true });
    alert('主責個案分配已儲存完成。');
  } catch (err) {
    console.error('儲存主責個案分配失敗：', err);
    alert('儲存失敗，請稍後再試。');
  }
}

// 匯出 Excel
async function exportCaseAssignExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS 載入失敗，無法匯出 Excel。');
    return;
  }

  const assignDateInput = document.getElementById('assignDate');
  const assignWeekInput = document.getElementById('assignWeek');
  const assignMakerInput = document.getElementById('assignMaker');

  const isoDate = assignDateInput && assignDateInput.value ? assignDateInput.value : '';
  const week = assignWeekInput ? assignWeekInput.value.trim() : '';
  const maker = assignMakerInput ? assignMakerInput.value.trim() : '';
  const rocDate = toRocDotDate(isoDate);
  const weekText = week || '';
  const titleInfo = `日期：${rocDate || isoDate} ${weekText ? `(${weekText}) ` : ''}製表人：${maker || ''}`;

  const rows = collectCaseTableData();
  const filteredRows = rows.filter(r => {
    const hasCases = Array.isArray(r.cases) && r.cases.some(c => c && c.trim() !== '');
    return (r.nurseId && r.nurseId.trim() !== '') || hasCases;
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('主責個案分配');

  const fontTitle = { name: '標楷體', size: 16, bold: true };
  const fontHeader = { name: '標楷體', size: 12, bold: true };
  const fontCell = { name: '標楷體', size: 11 };
  const borderThin = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 欄寬設定
  ws.columns = [
    { header: '員編', key: 'nurseId', width: 10 },
    { header: '護理師', key: 'nurseName', width: 12 },
    { header: '1', key: 'c1', width: 10 },
    { header: '2', key: 'c2', width: 10 },
    { header: '3', key: 'c3', width: 10 },
    { header: '4', key: 'c4', width: 10 },
    { header: '5', key: 'c5', width: 10 },
    { header: '6', key: 'c6', width: 10 },
    { header: '7', key: 'c7', width: 10 },
    { header: '8', key: 'c8', width: 10 },
    { header: '9', key: 'c9', width: 10 },
    { header: '10', key: 'c10', width: 10 },
    { header: '11', key: 'c11', width: 10 },
    { header: '12', key: 'c12', width: 10 },
    { header: '13', key: 'c13', width: 10 },
    { header: '14', key: 'c14', width: 10 },
    { header: '個案數', key: 'count', width: 8 }
  ];

  // 標題列
  ws.mergeCells('A1:Q1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '主責個案分配表';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 日期 / 週次 / 製表人
  ws.mergeCells('A2:Q2');
  const infoCell = ws.getCell('A2');
  infoCell.value = titleInfo;
  infoCell.font = fontCell;
  infoCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // 表頭列
  const headerRow = ws.getRow(3);
  headerRow.values = [
    '員編',
    '護理師',
    '1', '2', '3', '4', '5', '6', '7',
    '8', '9', '10', '11', '12', '13', '14',
    '個案數'
  ];
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font = fontHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderThin;
  });

  // 資料列
  let excelRowIndex = 4;
  filteredRows.forEach(r => {
    const row = ws.getRow(excelRowIndex++);
    row.values = [
      r.nurseId || '',
      r.nurseName || '',
      r.cases[0] || '',
      r.cases[1] || '',
      r.cases[2] || '',
      r.cases[3] || '',
      r.cases[4] || '',
      r.cases[5] || '',
      r.cases[6] || '',
      r.cases[7] || '',
      r.cases[8] || '',
      r.cases[9] || '',
      r.cases[10] || '',
      r.cases[11] || '',
      r.cases[12] || '',
      r.cases[13] || '',
      r.caseCount || ''
    ];
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = fontCell;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
        wrapText: false
      };
      cell.border = borderThin;
    });
  });

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 }
  };

  const filename = isoDate
    ? `主責個案分配表_${isoDate.replace(/-/g, '')}.xlsx`
    : '主責個案分配表.xlsx';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Firebase 初始化完成後載入資料
document.addEventListener('firebase-ready', () => {
  loadCaseAssignData();
});

// DOM Ready：預設日期 + 綁按鈕
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('assignDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = today;
  }

  const printBtn = document.getElementById('printButton');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const saveBtn = document.getElementById('saveButton');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveCaseAssignment();
    });
  }

  const exportBtn = document.getElementById('exportExcelButton');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCaseAssignExcel();
    });
  }
});
