/**
 * 主責個案分配 JS
 * - 從 Firestore 載入護理師與住民
 * - 產生表格列
 * - 自動統計每列主責個案數
 * - 匯出 Excel（使用 ExcelJS）
 */

const ROW_COUNT = 12;      // 預設 12 列
const CASE_COLS = 8;       // 主責個案 8 格

let nurses = [];
let residents = [];

// 住民下拉選單 HTML
function buildResidentOptionsHtml() {
  let html = '<option value="">--</option>';
  residents.forEach(r => {
    const name = r.name || r.id;
    html += `<option value="${name}">${name}</option>`;
  });
  return html;
}

// 護理師員編下拉選單 HTML
function buildNurseOptionsHtml() {
  let html = '<option value="">--</option>';
  nurses.forEach(n => {
    html += `<option value="${n.id}">${n.id}</option>`;
  });
  return html;
}

// 更新單一列的主責個案數
function updateCaseCountForRow(tr) {
  const selects = tr.querySelectorAll('.case-select');
  let count = 0;
  selects.forEach(sel => {
    if (sel.value) count++;
  });
  const cell = tr.querySelector('.case-count');
  cell.textContent = count > 0 ? String(count) : '';
}

// 建構整張表格
function renderCaseTable() {
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const nurseOptions = buildNurseOptionsHtml();
  const residentOptions = buildResidentOptionsHtml();

  for (let i = 0; i < ROW_COUNT; i++) {
    const tr = document.createElement('tr');

    // 員編
    const tdId = document.createElement('td');
    tdId.innerHTML = `<select class="form-select form-select-sm nurse-id-select">
                        ${nurseOptions}
                      </select>`;
    tr.appendChild(tdId);

    // 護理師姓名（自動帶出）
    const tdName = document.createElement('td');
    tdName.innerHTML = '<span class="nurse-name"></span>';
    tr.appendChild(tdName);

    // 主責個案下拉選單
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `<select class="form-select form-select-sm case-select">
                            ${residentOptions}
                          </select>`;
      tr.appendChild(tdCase);
    }

    // 備註：顯示個案數
    const tdCount = document.createElement('td');
    tdCount.innerHTML = '<span class="case-count"></span>';
    tr.appendChild(tdCount);

    tbody.appendChild(tr);
  }

  // 綁定事件：員編 → 自動帶出護理師姓名
  tbody.querySelectorAll('.nurse-id-select').forEach(select => {
    select.addEventListener('change', event => {
      const tr = event.target.closest('tr');
      const nurseNameSpan = tr.querySelector('.nurse-name');
      const selectedId = event.target.value;
      const nurse = nurses.find(n => n.id === selectedId);
      nurseNameSpan.textContent = nurse ? nurse.name : '';
    });
  });

  // 綁定事件：每次變更主責個案 → 重新統計個案數
  tbody.querySelectorAll('.case-select').forEach(select => {
    select.addEventListener('change', event => {
      const tr = event.target.closest('tr');
      updateCaseCountForRow(tr);
    });
  });
}

// 從 Firestore 載入資料
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

// 將西元 yyyy-mm-dd 轉為民國年格式：114.12.19
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

// 取得目前表格資料
function collectCaseTableData() {
  const rows = [];
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return rows;

  tbody.querySelectorAll('tr').forEach(tr => {
    const nurseIdSelect = tr.querySelector('.nurse-id-select');
    const nurseId = nurseIdSelect ? nurseIdSelect.value.trim() : '';
    const nurseNameSpan = tr.querySelector('.nurse-name');
    const nurseName = nurseNameSpan ? nurseNameSpan.textContent.trim() : '';
    const caseSelects = tr.querySelectorAll('.case-select');
    const cases = [];
    caseSelects.forEach(sel => cases.push((sel.value || '').trim()));
    const countSpan = tr.querySelector('.case-count');
    const caseCount = countSpan ? (countSpan.textContent.trim() || '') : '';

    rows.push({
      nurseId,
      nurseName,
      cases,
      caseCount
    });
  });

  return rows;
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
  const rocDate = toRocDotDate(isoDate);
  const week = assignWeekInput ? assignWeekInput.value.trim() : '';
  const maker = assignMakerInput ? assignMakerInput.value.trim() : '';

  const rows = collectCaseTableData();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSICAO';
  wb.created = new Date();

  const ws = wb.addWorksheet('主責個案分配');

  // 欄寬設定
  ws.columns = [
    { width: 10 },  // 員編
    { width: 14 },  // 護理師
    { width: 12 },  // 個案1
    { width: 12 },  // 個案2
    { width: 12 },  // 個案3
    { width: 12 },  // 個案4
    { width: 12 },  // 個案5
    { width: 12 },  // 個案6
    { width: 12 },  // 個案7
    { width: 12 },  // 個案8
    { width: 10 }   // 個案數
  ];

  const fontTitle = { name: 'Microsoft JhengHei', size: 16, bold: true };
  const fontHeader = { name: 'Microsoft JhengHei', size: 12, bold: true };
  const fontCell = { name: 'Microsoft JhengHei', size: 11 };
  const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };
  const borderThin = {
    top: { style: 'thin', color: { argb: 'FF999999' } },
    left: { style: 'thin', color: { argb: 'FF999999' } },
    bottom: { style: 'thin', color: { argb: 'FF999999' } },
    right: { style: 'thin', color: { argb: 'FF999999' } }
  };

  // Title
  ws.mergeCells(1, 1, 1, 11);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = '主責個案分配表';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 26;

  // 日期 / 週次 / 製表人
  ws.mergeCells(2, 1, 2, 11);
  const infoCell = ws.getCell(2, 1);
  let infoText = '';
  if (rocDate) infoText += `日期：${rocDate}  `;
  if (week) infoText += `(${week})  `;
  if (maker) infoText += `製表人：${maker}`;
  infoCell.value = infoText.trim();
  infoCell.font = { name: 'Microsoft JhengHei', size: 11 };
  infoCell.alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(2).height = 18;

  // 表頭
  const headerRow = ws.addRow([
    '員編',
    '護理師',
    '主責個案1',
    '主責個案2',
    '主責個案3',
    '主責個案4',
    '主責個案5',
    '主責個案6',
    '主責個案7',
    '主責個案8',
    '個案數'
  ]);

  headerRow.eachCell(cell => {
    cell.font = fontHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = fillHeader;
    cell.border = borderThin;
  });
  headerRow.height = 22;

  // 資料列
  rows.forEach(r => {
    const row = ws.addRow([
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
      r.caseCount || ''
    ]);

    row.eachCell((cell, colNumber) => {
      cell.font = fontCell;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
        wrapText: false
      };
      cell.border = borderThin;
    });
    row.height = 20;
  });

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 }
  };

  const rocFilePart = rocDate ? rocDate.replace(/\./g, '') : '';
  const fileName = rocFilePart
    ? `主責個案分配表_${rocFilePart}.xlsx`
    : '主責個案分配表.xlsx';

  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('匯出主責個案分配 Excel 失敗：', err);
    alert('匯出 Excel 失敗，請稍後再試。');
  }
}

// Firebase 初始化完成後開始載入資料
document.addEventListener('firebase-ready', () => {
  loadCaseAssignData();
});

// DOM Ready：預設日期、綁定按鈕事件
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('assignDate');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    dateInput.value = today;
  }

  const printBtn = document.getElementById('printButton');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const exportBtn = document.getElementById('exportExcelButton');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCaseAssignExcel();
    });
  }
});
