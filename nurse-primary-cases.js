// 主責個案分配 JS（每位護理師 2 行，每行 7 個主責個案，共 14 個）

const ROW_COUNT = 12;      // 預設 12 位護理師名額（每位 2 列）
const CASE_COLS = 7;       // 每行 7 格

let nurses = [];
let residents = [];
let baseListsLoaded = false;

// 住民下拉選單 HTML（完整清單，不排除重複，用於初始渲染）
function buildResidentOptionsHtml() {
  let html = '<option value="">--</option>';
  residents.forEach(r => {
    const name = r.name || r.id || '';
    html += `<option value="${name}">${name}</option>`;
  });
  return html;
}

// 依目前已選的住民，刷新所有主責個案下拉選單，避免重複選到同一位住民
function refreshResidentOptions() {
  const selects = document.querySelectorAll('.case-select');
  if (!selects.length) return;

  // 先收集所有已被選到的住民名字
  const selectedSet = new Set();
  selects.forEach(sel => {
    const v = (sel.value || '').trim();
    if (v) selectedSet.add(v);
  });

  // 逐一重畫每一個 select
  selects.forEach(sel => {
    const current = (sel.value || '').trim();
    let html = '<option value="">--</option>';
    residents.forEach(r => {
      const name = r.name || r.id || '';
      // 如果這個住民已經被其它欄位選走了，就不要出現在清單裡
      // 但如果是自己目前選到的值，要保留，否則會把自己洗掉
      if (selectedSet.has(name) && name !== current) return;
      const selectedAttr = (name === current) ? ' selected' : '';
      html += `<option value="${name}"${selectedAttr}>${name}</option>`;
    });
    sel.innerHTML = html;
  });
}

// 護理師名字下拉選單 HTML（value = 員編，顯示：名字）
function buildNurseOptionsHtml() {
  let html = '<option value="">--</option>';
  nurses.forEach(n => {
    const name = n.name || '';
    const id = n.id || '';
    html += `<option value="${id}">${name}</option>`;
  });
  return html;
}

// 更新某一組（同一護理師兩行）的主責個案數
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

// 建立表格：每位護理師 2 行，每行 7 格，共 14 格
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

    // 員編（護理師名字選好後自動帶出，rowspan = 2）
    const tdId = document.createElement('td');
    tdId.rowSpan = 2;
    const idSpan = document.createElement('span');
    idSpan.classList.add('nurse-id');
    idSpan.setAttribute('data-group', groupIndex);
    tdId.appendChild(idSpan);
    trTop.appendChild(tdId);

    // 護理師名字（下拉選單，rowspan = 2）
    const tdName = document.createElement('td');
    tdName.rowSpan = 2;
    tdName.innerHTML = `
      <select class="form-select form-select-sm nurse-name-select" data-group="${groupIndex}">
        ${nurseOptions}
      </select>
    `;
    trTop.appendChild(tdName);

    // 第一行主責個案 1~7
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trTop.appendChild(tdCase);
    }

    // 第二行主責個案 8~14
    for (let j = 0; j < CASE_COLS; j++) {
      const tdCase = document.createElement('td');
      tdCase.innerHTML = `
        <select class="form-select form-select-sm case-select" data-group="${groupIndex}">
          ${residentOptions}
        </select>
      `;
      trBottom.appendChild(tdCase);
    }

    // 個案數（兩行一起算，rowspan = 2）
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

  // 初始渲染完也刷新一次（若有預設值的情況）
  refreshResidentOptions();
}

// 依目前日期載入已儲存的主責個案分配
async function loadAssignmentForCurrentDate() {
  if (!baseListsLoaded) return;

  const assignDateInput = document.getElementById('assignDate');
  if (!assignDateInput || !assignDateInput.value) return;

  const isoDate = assignDateInput.value;

  try {
    const docSnap = await db.collection('nurse_case_assignments').doc(isoDate).get();
    if (!docSnap.exists) {
      // 沒有資料就保持空白表格（但要刷新一次避免殘留重複選項）
      refreshResidentOptions();
      return;
    }

    const data = docSnap.data() || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];

    const assignWeekInput = document.getElementById('assignWeek');
    const assignMakerInput = document.getElementById('assignMaker');
    const note1Input = document.getElementById('note1');
    const note2Input = document.getElementById('note2');
    const note3Input = document.getElementById('note3');

    if (assignWeekInput && data.week) assignWeekInput.value = data.week;
    if (assignMakerInput && data.maker) assignMakerInput.value = data.maker;
    if (note1Input && data.note1) note1Input.value = data.note1;
    if (note2Input && data.note2) note2Input.value = data.note2;
    if (note3Input && data.note3) note3Input.value = data.note3;

    const tbody = document.getElementById('caseTableBody');
    if (!tbody) return;

    for (let i = 0; i < Math.min(rows.length, ROW_COUNT); i++) {
      const r = rows[i];
      const groupIndex = String(i);

      const idSpan = tbody.querySelector(`.nurse-id[data-group="${groupIndex}"]`);
      const nameSelect = tbody.querySelector(`.nurse-name-select[data-group="${groupIndex}"]`);
      const caseSelects = tbody.querySelectorAll(`.case-select[data-group="${groupIndex}"]`);

      if (idSpan) {
        idSpan.textContent = r.nurseId || '';
      }
      if (nameSelect && r.nurseId) {
        nameSelect.value = r.nurseId;
      }
      if (caseSelects.length) {
        const arr = Array.isArray(r.cases) ? r.cases : [];
        for (let j = 0; j < Math.min(caseSelects.length, arr.length); j++) {
          caseSelects[j].value = arr[j] || '';
        }
      }
      updateCaseCountForGroup(groupIndex);
    }

    // 資料載入完後，再刷新一次住民選單，避免重複
    refreshResidentOptions();
  } catch (err) {
    console.error('載入指定日期主責個案分配失敗：', err);
  }
}

// 顯示 / 隱藏「資料讀取中…」提示
function setLoading(isLoading) {
  const el = document.getElementById('loadingIndicator');
  if (!el) return;
  el.style.display = isLoading ? 'inline-flex' : 'none';
}

// 從 Firestore 載入 護理師 / 住民 清單
async function loadCaseAssignBaseLists() {
  setLoading(true);
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

    baseListsLoaded = true;

    // 先畫出空白表格
    renderCaseTable();
    // 再依目前日期載入已儲存內容
    loadAssignmentForCurrentDate();
  } catch (error) {
    console.error('載入主責個案分配資料失敗：', error);
    alert('載入主責個案分配資料失敗，請稍後再試。');
  } finally {
    setLoading(false);
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

// 取得目前表格資料（一組一筆，含 14 個 case）
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
        nurseName = opt.textContent.trim();
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
  // 去掉完全空白的組別
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

// 匯出 Excel（新版：兩層表頭 + 主責個案 14 欄）
async function exportCaseAssignExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS 載入失敗，無法匯出 Excel。');
    return;
  }

  const assignDateInput = document.getElementById('assignDate');
  const assignWeekInput = document.getElementById('assignWeek');
  const assignMakerInput = document.getElementById('assignMaker');

  const note1Input = document.getElementById('note1');
  const note2Input = document.getElementById('note2');
  const note3Input = document.getElementById('note3');

  const isoDate = assignDateInput && assignDateInput.value ? assignDateInput.value : '';
  const week = assignWeekInput ? assignWeekInput.value.trim() : '';
  const maker = assignMakerInput ? assignMakerInput.value.trim() : '';
  const note1 = note1Input ? note1Input.value.trim() : '';
  const note2 = note2Input ? note2Input.value.trim() : '';
  const note3 = note3Input ? note3Input.value.trim() : '';

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
  const fontCell = { name: '標楷體', size: 12 };
  const borderThin = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 欄寬統一 17
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

  // 標題列
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '主責個案分配表';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 日期 / 週次 / 製表人
  ws.mergeCells('A2:J2');
  const infoCell = ws.getCell('A2');
  infoCell.value = titleInfo;
  infoCell.font = fontCell;
  infoCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // 表頭：兩層結構
  // 第三列：員編 / 護理師 / 主責個案 / 備註(個案數)
  ws.mergeCells('A3:A4');
  ws.mergeCells('B3:B4');
  ws.mergeCells('C3:I3');
  ws.mergeCells('J3:J4');

  const headerTop = ws.getRow(3);
  headerTop.getCell(1).value = '員編';
  headerTop.getCell(2).value = '護理師';
  headerTop.getCell(3).value = '主責個案';
  headerTop.getCell(10).value = '備註(個案數)';

  // 第四列：1~7
  const headerBottom = ws.getRow(4);
  const labels = ['1', '2', '3', '4', '5', '6', '7'];
  for (let i = 0; i < labels.length; i++) {
    headerBottom.getCell(3 + i).value = labels[i];
  }

  // 套用表頭樣式
  [headerTop, headerBottom].forEach(row => {
    row.height = 22;
    row.eachCell(cell => {
      cell.font = fontHeader;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = borderThin;
    });
  });

  // 資料列從第 5 列開始：每位護理師 2 列（上列主責 1~7，下列主責 8~14）
  let excelRowIndex = 5;
  filteredRows.forEach(r => {
    const topRow = ws.getRow(excelRowIndex);
    const bottomRow = ws.getRow(excelRowIndex + 1);

    // 垂直合併 員編 / 護理師 / 備註(個案數)
    ws.mergeCells(excelRowIndex, 1, excelRowIndex + 1, 1); // A
    ws.mergeCells(excelRowIndex, 2, excelRowIndex + 1, 2); // B
    ws.mergeCells(excelRowIndex, 10, excelRowIndex + 1, 10); // J

    topRow.getCell(1).value = r.nurseId || '';
    topRow.getCell(2).value = r.nurseName || '';
    topRow.getCell(10).value = r.caseCount || '';

    // 主責個案 1~7 放在上列，8~14 放在下列
    for (let i = 0; i < 7; i++) {
      topRow.getCell(3 + i).value = (r.cases && r.cases[i]) || '';
      bottomRow.getCell(3 + i).value = (r.cases && r.cases[7 + i]) || '';
    }

    [topRow, bottomRow].forEach(row => {
      row.height = 22;
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

    excelRowIndex += 2;
  });

  // 在下方加入備註一～三
  let noteRowIndex = excelRowIndex + 1;
  const notes = [
    { label: '備註一：', value: note1 },
    { label: '備註二：', value: note2 },
    { label: '備註三：', value: note3 }
  ];

  notes.forEach(n => {
    const row = ws.getRow(noteRowIndex);
    ws.mergeCells(noteRowIndex, 1, noteRowIndex, 10);
    row.getCell(1).value = n.label + (n.value || '');
    row.height = 22;
    row.eachCell(cell => {
      cell.font = fontCell;
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = borderThin;
    });
    noteRowIndex++;
  });

  // 列印設定
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 }
  };

  // 冻结到表頭下方
  ws.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 4
    }
  ];

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
  loadCaseAssignBaseLists();
});

// DOM Ready：預設日期 + 綁按鈕 + 日期改變時載入該日資料
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('assignDate');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;
  }

  if (dateInput) {
    dateInput.addEventListener('change', async () => {
      if (baseListsLoaded) {
        setLoading(true);
        try {
          renderCaseTable();
          await loadAssignmentForCurrentDate();
        } finally {
          setLoading(false);
        }
      }
    });
  }

  const printBtn = document.getElementById('printButton');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const saveBtn = document.getElementById('saveButton');
  if (saveBtn) {
    const originalHtml = saveBtn.innerHTML;
    saveBtn.addEventListener('click', async () => {
      // 若已在儲存中就不要重複觸發
      if (saveBtn.disabled) return;

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>儲存中...';

      try {
        await saveCaseAssignment();
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
    });
  }

  const exportBtn = document.getElementById('exportExcelButton');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCaseAssignExcel();
    });
  }
});
