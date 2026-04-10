(function(){
  const COLLECTION = 'mobilityAssessments';
  const RESIDENTS_COLLECTION = 'residents';

  let appStarted = false;
  let mobilityDb = null;
  let allSheets = [];
  let filteredSheets = [];
  let residentCache = [];
  let currentSheetId = null;
  let currentRows = [];
  let currentUser = null;
  let residentModal = null;

  const DAYS = [
    { key:'mon', label:'星期一' },
    { key:'tue', label:'星期二' },
    { key:'wed', label:'星期三' },
    { key:'thu', label:'星期四' },
    { key:'fri', label:'星期五' },
    { key:'sat', label:'星期六' }
  ];

  function $(id){ return document.getElementById(id); }

  function escapeHtml(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function showLoading(text){
    const overlay = $('loading-overlay');
    const label = $('loading-text');
    if (label) label.textContent = text || '處理中...';
    if (overlay) overlay.style.display = 'flex';
  }

  function hideLoading(){
    const overlay = $('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function toInputDate(value){
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0,10);
    try{
      if (value.toDate) return value.toDate().toISOString().slice(0,10);
    }catch(_e){}
    try{
      return new Date(value).toISOString().slice(0,10);
    }catch(_e){
      return '';
    }
  }

  function formatDate(dateInput, sep='/'){
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return [y,m,day].join(sep);
  }

  function formatDateTime(dateInput){
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '';
    return `${formatDate(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function normalizeString(v){
    return String(v == null ? '' : v).trim();
  }

  function bedSortValue(bed){
    const s = normalizeString(bed);
    const m = s.match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const base = parseInt(m[1],10) || 0;
    const sub = m[2] ? (parseInt(String(m[2]).replace(/\D/g,''),10) || 0) : 0;
    return base * 100 + sub;
  }

  function sortResidents(rows){
    return rows.slice().sort((a,b)=>{
      const diff = bedSortValue(a.bedNumber) - bedSortValue(b.bedNumber);
      if (diff !== 0) return diff;
      return normalizeString(a.residentName).localeCompare(normalizeString(b.residentName), 'zh-Hant');
    });
  }

  function getLoginUser(){
    const keys = ['antai_session_user', 'nurseAuth', 'officeAuth', 'nutritionistAuth', 'caregiverAuth'];
    for (const key of keys){
      try{
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj && (obj.staffId || obj.displayName || obj.name || obj.username)){
          return {
            staffId: normalizeString(obj.staffId || obj.employeeId || obj.id || ''),
            displayName: normalizeString(obj.displayName || obj.name || obj.username || ''),
            role: normalizeString(obj.role || ''),
            sourceKey: key
          };
        }
      }catch(_e){}
    }
    return {
      staffId: '',
      displayName: '未登入使用者',
      role: '',
      sourceKey: ''
    };
  }

  function userDisplayText(user){
    const sid = normalizeString(user && user.staffId);
    const name = normalizeString(user && user.displayName);
    if (sid && name) return `${sid} ${name}`;
    return sid || name || '未登入使用者';
  }

  function ensureYearOptions(){
    const select = $('year-filter');
    if (!select) return;
    const current = new Date().getFullYear();
    const years = [];
    for (let y=current+1; y>=current-5; y--) years.push(y);
    select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    select.value = String(current);
    $('stat-year').textContent = current;
  }

  function toggleView(mode){
    $('list-view').classList.toggle('view-hidden', mode !== 'list');
    $('editor-view').classList.toggle('view-hidden', mode !== 'editor');
  }

  function buildDefaultTitle(dateValue){
    const date = dateValue ? new Date(dateValue) : new Date();
    if (isNaN(date)) return '行動評估名單';
    return `${date.getFullYear()}年${date.getMonth()+1}月行動評估名單`;
  }

  function getEditorPayload(){
    return {
      title: normalizeString($('sheet-title').value),
      date: $('sheet-date').value,
      year: parseInt($('sheet-year').value, 10) || new Date().getFullYear(),
      createdByText: $('sheet-created-by').textContent || '',
      rows: currentRows.slice()
    };
  }

  function refreshEditorHeader(){
    $('row-count-display').textContent = currentRows.length;
    $('rehab-count-display').textContent = currentRows.filter(r => !!r.rehab).length;
  }

  function createEmptyRow(){
    return {
      rowNo: currentRows.length + 1,
      residentId: '',
      residentNumber: '',
      bedNumber: '',
      residentName: '',
      englishName: '',
      mobility: '',
      rehab: false,
      mon: '',
      tue: '',
      wed: '',
      thu: '',
      fri: '',
      sat: '',
      note: ''
    };
  }

  function normalizeRow(row, idx){
    return {
      rowNo: idx + 1,
      residentId: normalizeString(row && row.residentId),
      residentNumber: normalizeString(row && row.residentNumber),
      bedNumber: normalizeString(row && row.bedNumber),
      residentName: normalizeString(row && row.residentName),
      englishName: normalizeString(row && row.englishName),
      mobility: normalizeString(row && row.mobility),
      rehab: !!(row && row.rehab),
      mon: normalizeString(row && row.mon),
      tue: normalizeString(row && row.tue),
      wed: normalizeString(row && row.wed),
      thu: normalizeString(row && row.thu),
      fri: normalizeString(row && row.fri),
      sat: normalizeString(row && row.sat),
      note: normalizeString(row && row.note)
    };
  }

  function rerenderEditorRows(){
    currentRows = currentRows.map((row, idx) => normalizeRow(row, idx));
    const tbody = $('editor-table-body');
    if (!tbody) return;
    if (!currentRows.length){
      tbody.innerHTML = `
        <tr>
          <td colspan="15" class="text-center text-muted py-4">
            目前沒有資料，請從住民資料匯入，或手動新增空白列。
          </td>
        </tr>`;
      refreshEditorHeader();
      return;
    }

    tbody.innerHTML = currentRows.map((row, idx) => `
      <tr data-index="${idx}">
        <td class="text-center fw-bold">${idx+1}</td>
        <td><input class="form-control form-control-sm row-input" data-field="bedNumber" value="${escapeHtml(row.bedNumber)}"></td>
        <td><input class="form-control form-control-sm row-input" data-field="residentNumber" value="${escapeHtml(row.residentNumber)}"></td>
        <td><input class="form-control form-control-sm row-input" data-field="residentName" value="${escapeHtml(row.residentName)}"></td>
        <td><input class="form-control form-control-sm row-input" data-field="englishName" value="${escapeHtml(row.englishName)}"></td>
        <td><input class="form-control form-control-sm row-input" data-field="mobility" value="${escapeHtml(row.mobility)}"></td>
        <td class="text-center"><input type="checkbox" class="form-check-input row-check" data-field="rehab" ${row.rehab ? 'checked' : ''}></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="mon" value="${escapeHtml(row.mon)}"></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="tue" value="${escapeHtml(row.tue)}"></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="wed" value="${escapeHtml(row.wed)}"></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="thu" value="${escapeHtml(row.thu)}"></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="fri" value="${escapeHtml(row.fri)}"></td>
        <td><input class="form-control form-control-sm row-input text-center" data-field="sat" value="${escapeHtml(row.sat)}"></td>
        <td><textarea class="form-control form-control-sm row-input" data-field="note">${escapeHtml(row.note)}</textarea></td>
        <td class="text-center">
          <button class="btn btn-outline-danger mini-btn btn-delete-row" type="button"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
    refreshEditorHeader();
  }

  function bindEditorTableEvents(){
    const tbody = $('editor-table-body');
    if (!tbody) return;
    tbody.addEventListener('input', function(e){
      const target = e.target;
      const tr = target.closest('tr[data-index]');
      if (!tr) return;
      const idx = parseInt(tr.getAttribute('data-index'),10);
      const field = target.getAttribute('data-field');
      if (!currentRows[idx] || !field) return;
      currentRows[idx][field] = target.type === 'checkbox' ? !!target.checked : target.value;
      if (field === 'rehab') refreshEditorHeader();
    });
    tbody.addEventListener('change', function(e){
      const target = e.target;
      if (!target.classList.contains('row-check')) return;
      const tr = target.closest('tr[data-index]');
      if (!tr) return;
      const idx = parseInt(tr.getAttribute('data-index'),10);
      const field = target.getAttribute('data-field');
      if (!currentRows[idx] || !field) return;
      currentRows[idx][field] = !!target.checked;
      refreshEditorHeader();
    });
    tbody.addEventListener('click', function(e){
      const btn = e.target.closest('.btn-delete-row');
      if (!btn) return;
      const tr = btn.closest('tr[data-index]');
      if (!tr) return;
      const idx = parseInt(tr.getAttribute('data-index'),10);
      currentRows.splice(idx, 1);
      rerenderEditorRows();
    });
  }

  function setEditorMeta(sheet){
    const dateValue = sheet && sheet.date ? toInputDate(sheet.date) : formatDate(new Date(), '-');
    $('sheet-date').value = dateValue;
    $('sheet-year').value = String((sheet && sheet.year) || new Date(dateValue).getFullYear());
    $('sheet-title').value = (sheet && sheet.title) || buildDefaultTitle(dateValue);
    $('sheet-created-by').textContent = (sheet && sheet.createdByName) ? `${normalizeString(sheet.createdByStaffId)} ${normalizeString(sheet.createdByName)}`.trim() : userDisplayText(currentUser);
    $('editor-title').textContent = currentSheetId ? '編輯行動評估清單' : '新增行動評估清單';
  }

  function newSheet(){
    currentSheetId = null;
    currentRows = [];
    setEditorMeta(null);
    rerenderEditorRows();
    toggleView('editor');
  }

  function editSheet(id){
    const sheet = allSheets.find(s => s.id === id);
    if (!sheet) return;
    currentSheetId = sheet.id;
    setEditorMeta(sheet);
    currentRows = sortResidents((sheet.rows || []).map((r, idx) => normalizeRow(r, idx)));
    rerenderEditorRows();
    toggleView('editor');
  }

  function calculateSheetStats(sheet){
    const rows = Array.isArray(sheet && sheet.rows) ? sheet.rows : [];
    return {
      total: rows.length,
      rehab: rows.filter(r => !!r.rehab).length
    };
  }

  function renderList(){
    const tbody = $('sheet-list-body');
    const empty = $('list-empty');
    const year = parseInt($('year-filter').value, 10) || new Date().getFullYear();
    const kw = normalizeString($('list-search').value).toLowerCase();

    filteredSheets = allSheets
      .filter(s => (parseInt(s.year,10) || 0) === year)
      .filter(s => {
        if (!kw) return true;
        const text = [
          s.title, s.createdByName, s.createdByStaffId, s.updatedByName, s.updatedByStaffId, s.date
        ].join(' ').toLowerCase();
        return text.includes(kw);
      })
      .sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

    $('stat-year').textContent = year;
    $('stat-count').textContent = filteredSheets.length;
    $('stat-residents').textContent = filteredSheets.reduce((sum, s) => sum + calculateSheetStats(s).total, 0);
    $('stat-rehab').textContent = filteredSheets.reduce((sum, s) => sum + calculateSheetStats(s).rehab, 0);

    if (!filteredSheets.length){
      tbody.innerHTML = '';
      empty.classList.remove('view-hidden');
      return;
    }

    empty.classList.add('view-hidden');
    tbody.innerHTML = filteredSheets.map(sheet => {
      const stats = calculateSheetStats(sheet);
      const createdBy = `${normalizeString(sheet.createdByStaffId)} ${normalizeString(sheet.createdByName)}`.trim() || '--';
      const updatedBy = `${normalizeString(sheet.updatedByStaffId)} ${normalizeString(sheet.updatedByName)}`.trim() || '--';
      const updatedAtText = sheet.updatedAt ? `${updatedBy}<div class="small text-muted">${formatDateTime(sheet.updatedAt)}</div>` : updatedBy;
      return `
        <tr>
          <td>${escapeHtml(sheet.date || '')}</td>
          <td>
            <div class="fw-bold">${escapeHtml(sheet.title || '')}</div>
            <div class="small text-muted text-truncate-2">${escapeHtml(sheet.note || '')}</div>
          </td>
          <td class="text-center fw-bold">${stats.total}</td>
          <td class="text-center fw-bold">${stats.rehab}</td>
          <td>${escapeHtml(createdBy)}</td>
          <td>${updatedAtText}</td>
          <td>
            <div class="list-actions">
              <button class="btn btn-sm btn-outline-primary btn-edit-sheet" data-id="${sheet.id}"><i class="fas fa-pen-to-square me-1"></i>編輯</button>
              <button class="btn btn-sm btn-outline-dark btn-print-sheet" data-id="${sheet.id}"><i class="fas fa-print me-1"></i>列印</button>
              <button class="btn btn-sm btn-success btn-export-sheet" data-id="${sheet.id}"><i class="fas fa-file-excel me-1"></i>匯出</button>
              <button class="btn btn-sm btn-outline-danger btn-delete-sheet" data-id="${sheet.id}"><i class="fas fa-trash me-1"></i>刪除</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadSheets(){
    showLoading('載入案件清單中...');
    try{
      const snap = await mobilityDb.collection(COLLECTION).get();
      allSheets = snap.docs.map(doc => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          ...data,
          rows: Array.isArray(data.rows) ? data.rows : [],
          date: data.date || '',
          year: data.year || (data.date ? new Date(data.date).getFullYear() : new Date().getFullYear()),
          createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || ''),
          updatedAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || '')
        };
      });
      renderList();
    }catch(err){
      console.error(err);
      alert('載入清單失敗：' + (err && err.message ? err.message : err));
    }finally{
      hideLoading();
    }
  }

  async function loadResidents(){
    try{
      const snap = await mobilityDb.collection(RESIDENTS_COLLECTION).get();
      residentCache = sortResidents(snap.docs.map(doc => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          residentId: doc.id,
          residentNumber: normalizeString(d.residentNumber),
          bedNumber: normalizeString(d.bedNumber),
          residentName: normalizeString(d.residentName || doc.id),
          englishName: normalizeString(d.englishName),
          mobility: normalizeString(d.mobility),
          nursingStation: normalizeString(d.nursingStation),
          leaveStatus: normalizeString(d.leaveStatus),
          diagnosis: normalizeString(d.diagnosis)
        };
      }));
      renderResidentSelectionList();
    }catch(err){
      console.error(err);
      alert('載入住民資料失敗：' + (err && err.message ? err.message : err));
    }
  }

  function renderResidentSelectionList(){
    const wrap = $('resident-select-list');
    if (!wrap) return;
    const kw = normalizeString($('resident-search').value).toLowerCase();
    const rows = residentCache.filter(r => {
      if (!kw) return true;
      const text = [r.bedNumber, r.residentName, r.englishName, r.residentNumber].join(' ').toLowerCase();
      return text.includes(kw);
    });

    if (!rows.length){
      wrap.innerHTML = `<div class="empty-state py-4"><div class="mb-2"><i class="fas fa-user-slash"></i></div><div>查無符合的住民資料</div></div>`;
      return;
    }

    wrap.innerHTML = rows.map(r => `
      <label class="resident-item">
        <input type="checkbox" class="form-check-input mt-1 resident-select-check" value="${escapeHtml(r.id)}">
        <div class="flex-grow-1">
          <div class="fw-bold">${escapeHtml(r.bedNumber)}｜${escapeHtml(r.residentName)}</div>
          <div class="meta">${escapeHtml(r.englishName || '無英文名')}　｜　住民編號：${escapeHtml(r.residentNumber || '無')}</div>
          <div class="meta">行動方式：${escapeHtml(r.mobility || '未填寫')}　｜　護理站：${escapeHtml(r.nursingStation || '未填寫')}</div>
        </div>
      </label>
    `).join('');
  }

  function importSelectedResidents(){
    const checks = Array.from(document.querySelectorAll('.resident-select-check:checked'));
    if (!checks.length){
      alert('請先勾選要匯入的住民。');
      return;
    }
    const selectedIds = new Set(checks.map(c => c.value));
    const selectedRows = residentCache.filter(r => selectedIds.has(r.id));
    const existingKeys = new Set(currentRows.map(r => `${normalizeString(r.bedNumber)}|${normalizeString(r.residentName)}`));
    selectedRows.forEach(r => {
      const key = `${normalizeString(r.bedNumber)}|${normalizeString(r.residentName)}`;
      if (existingKeys.has(key)) return;
      currentRows.push(normalizeRow({
        residentId: r.id,
        residentNumber: r.residentNumber,
        bedNumber: r.bedNumber,
        residentName: r.residentName,
        englishName: r.englishName,
        mobility: r.mobility,
        rehab: false
      }, currentRows.length));
      existingKeys.add(key);
    });
    currentRows = sortResidents(currentRows).map((r, idx) => normalizeRow(r, idx));
    rerenderEditorRows();
    if (residentModal) residentModal.hide();
  }

  function collectEditorRows(){
    currentRows = currentRows.map((row, idx) => normalizeRow(row, idx));
    return currentRows;
  }

  async function saveCurrentSheet(){
    const title = normalizeString($('sheet-title').value);
    const date = $('sheet-date').value;
    const year = parseInt($('sheet-year').value, 10) || new Date().getFullYear();
    const rows = collectEditorRows();

    if (!title){
      alert('請輸入清單名稱。');
      $('sheet-title').focus();
      return;
    }
    if (!date){
      alert('請選擇日期。');
      $('sheet-date').focus();
      return;
    }
    if (!rows.length){
      alert('請至少加入一筆住民資料。');
      return;
    }

    const payload = {
      title,
      date,
      year,
      rows,
      createdByStaffId: currentSheetId ? undefined : normalizeString(currentUser.staffId),
      createdByName: currentSheetId ? undefined : normalizeString(currentUser.displayName),
      updatedByStaffId: normalizeString(currentUser.staffId),
      updatedByName: normalizeString(currentUser.displayName),
      updatedAt: nowIso()
    };

    if (!currentSheetId){
      payload.createdAt = nowIso();
    }

    showLoading('儲存清單中...');
    try{
      if (currentSheetId){
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        await mobilityDb.collection(COLLECTION).doc(currentSheetId).set(payload, { merge:true });
      }else{
        const ref = mobilityDb.collection(COLLECTION).doc();
        currentSheetId = ref.id;
        await ref.set(payload);
      }
      await loadSheets();
      await loadCurrentSheetData(currentSheetId);
      alert('清單已儲存。');
    }catch(err){
      console.error(err);
      alert('儲存失敗：' + (err && err.message ? err.message : err));
    }finally{
      hideLoading();
    }
  }

  async function deleteSheet(id){
    if (!confirm('確定要刪除此清單嗎？刪除後無法復原。')) return;
    showLoading('刪除清單中...');
    try{
      await mobilityDb.collection(COLLECTION).doc(id).delete();
      await loadSheets();
    }catch(err){
      console.error(err);
      alert('刪除失敗：' + (err && err.message ? err.message : err));
    }finally{
      hideLoading();
    }
  }

  function getSheetById(id){
    return allSheets.find(s => s.id === id) || null;
  }


  async function loadCurrentSheetData(sheetId){
    if (!sheetId) return;
    showLoading('重新載入清單資料中...');
    try{
      const doc = await mobilityDb.collection(COLLECTION).doc(sheetId).get();
      if (!doc.exists) return;
      const fresh = { id: doc.id, ...(doc.data() || {}) };
      const idx = allSheets.findIndex(s => s.id === sheetId);
      if (idx >= 0) allSheets[idx] = fresh;
      else allSheets.unshift(fresh);
      allSheets.sort((a,b) => {
        const ad = normalizeString(a.date || a.updatedAt || a.createdAt);
        const bd = normalizeString(b.date || b.updatedAt || b.createdAt);
        return bd.localeCompare(ad);
      });
      renderList();
      editSheet(sheetId);
    }catch(err){
      console.error('重新載入清單失敗', err);
      alert('重新載入清單失敗：' + (err && err.message ? err.message : err));
    }finally{
      hideLoading();
    }
  }

  function buildPrintHtml(sheet){
    const title = escapeHtml(sheet.title || '');
    const date = escapeHtml(sheet.date || '');
    const rows = sortResidents((sheet.rows || []).map((r, idx) => normalizeRow(r, idx)));
    const bodyRows = rows.map((row, idx) => `
      <tr>
        <td class="center">${idx+1}</td>
        <td class="center">${escapeHtml(row.bedNumber)}</td>
        <td class="center">${escapeHtml(row.residentName)}</td>
        <td>${escapeHtml(row.englishName)}</td>
        <td class="center">${escapeHtml(row.mobility)}</td>
        <td class="center rehab-cell">${row.rehab ? 'R' : ''}</td>
        <td>${escapeHtml(row.mon)}</td>
        <td>${escapeHtml(row.tue)}</td>
        <td>${escapeHtml(row.wed)}</td>
        <td>${escapeHtml(row.thu)}</td>
        <td>${escapeHtml(row.fri)}</td>
        <td>${escapeHtml(row.sat)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 7mm; }
  *{ box-sizing:border-box; }
  body{ font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif; margin:0; color:#111; }
  .title{ font-size:16px; font-weight:900; text-align:center; margin:0 0 6px; }
  .meta{ display:flex; justify-content:space-between; gap:10px; font-size:10px; margin-bottom:5px; }
  .note{ border:1px solid #000; padding:5px 6px; font-size:8.5px; line-height:1.35; margin-bottom:6px; }
  .note b.red{ color:#c70000; }
  table{ width:100%; border-collapse:collapse; table-layout:fixed; }
  th,td{ border:1px solid #000; padding:2px 2px; font-size:8.5px; line-height:1.15; vertical-align:middle; word-break:break-word; }
  thead th{ text-align:center; font-weight:900; }
  tbody td{ height:21px; }
  .center{text-align:center;}
  .rehab-head, .rehab-cell{ background:#fff48a; font-weight:900; }
  .sign{ margin-top:6px; font-size:10px; display:flex; justify-content:space-between; align-items:flex-end; }
  .line{ display:inline-block; border-bottom:1px solid #000; min-width:140px; height:1.1em; vertical-align:bottom; }
</style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="meta">
    <div>日期：${date}</div>
    <div>建立者：${escapeHtml((normalizeString(sheet.createdByStaffId) + ' ' + normalizeString(sheet.createdByName)).trim())}</div>
  </div>
  <div class="note">
    這些住民星期一到星期六14:00前都要坐輪椅到 TV Room，我們都會點名。<br>
    如果點名未到，一個人罰款新台幣100元，兩個人罰款新台幣200元，以此類推。<br>
    <b class="red">有復健註記 "R" 個案請推到一樓 TV ROOM 等待復健運動。</b>
    Cases with the rehabilitation mark "R" should be moved to the TV room on the first floor to wait for rehabilitation exercises.
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:4.5%">編號</th>
        <th style="width:7.5%">房號</th>
        <th style="width:8.5%">名字</th>
        <th style="width:15%">NAME</th>
        <th style="width:8.5%">行動方式</th>
        <th style="width:6%" class="rehab-head">復健<br>Rehabilitation</th>
        <th style="width:8.3%">星期一</th>
        <th style="width:8.3%">星期二</th>
        <th style="width:8.3%">星期三</th>
        <th style="width:8.3%">星期四</th>
        <th style="width:8.3%">星期五</th>
        <th style="width:8.3%">星期六</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="sign">
    <div>查核者簽名：<span class="line"></span></div>
    <div>列印人：${escapeHtml(userDisplayText(currentUser))}　列印時間：${escapeHtml(formatDateTime(new Date()))}</div>
  </div>
</body>
</html>
    `;
  }

  function printSheet(sheet){
    const html = buildPrintHtml(sheet);
    const w = window.open('', '_blank');
    if (!w){
      alert('瀏覽器擋住了列印視窗，請允許彈出視窗後再試一次。');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  }

  async function exportSheetExcel(sheet){
    if (!(window.ExcelJS && ExcelJS.Workbook)){
      alert('ExcelJS 尚未載入，無法匯出 Excel。');
      return;
    }

    const rows = sortResidents((sheet.rows || []).map((r, idx) => normalizeRow(r, idx)));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('行動評估名單', {
      views:[{ state:'frozen', ySplit:4 }]
    });

    ws.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left:0.2, right:0.2, top:0.3, bottom:0.45, header:0.1, footer:0.1 }
    };

    ws.mergeCells('A1:L1');
    ws.getCell('A1').value = sheet.title || '行動評估名單';
    ws.getCell('A1').font = { name:'標楷體', size:16, bold:true };
    ws.getCell('A1').alignment = { horizontal:'center', vertical:'middle' };
    ws.getRow(1).height = 24;

    ws.mergeCells('A2:L2');
    ws.getCell('A2').value = `日期：${sheet.date || ''}　建立者：${(normalizeString(sheet.createdByStaffId) + ' ' + normalizeString(sheet.createdByName)).trim()}`;
    ws.getCell('A2').font = { name:'標楷體', size:10, bold:true };
    ws.getCell('A2').alignment = { horizontal:'left', vertical:'middle' };
    ws.getRow(2).height = 18;

    ws.mergeCells('A3:L3');
    ws.getCell('A3').value = '有復健註記 "R" 個案請推到一樓 TV ROOM 等待復健運動。Cases with the rehabilitation mark "R" should be moved to the TV room on the first floor to wait for rehabilitation exercises.';
    ws.getCell('A3').font = { name:'標楷體', size:9, color:{ argb:'FFC00000' }, bold:true };
    ws.getCell('A3').alignment = { wrapText:true, vertical:'middle' };
    ws.getRow(3).height = 28;

    const header = ws.addRow(['編號','房號','名字','NAME','行動方式','復健','星期一','星期二','星期三','星期四','星期五','星期六']);
    header.height = 22;
    header.eachCell((cell, idx) => {
      cell.font = { name:'標楷體', size:10, bold:true };
      cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      cell.border = fullBorder();
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: idx===6 ? 'FFFFF38A' : 'FFF3F6FA' } };
    });

    rows.forEach((row, idx) => {
      const excelRow = ws.addRow([
        idx+1,
        row.bedNumber,
        row.residentName,
        row.englishName,
        row.mobility,
        row.rehab ? 'R' : '',
        row.mon,
        row.tue,
        row.wed,
        row.thu,
        row.fri,
        row.sat
      ]);
      excelRow.height = 20;
      excelRow.eachCell((cell, col) => {
        cell.font = { name:'標楷體', size:10, bold: col===6 && row.rehab };
        cell.alignment = { horizontal: (col===4 ? 'left' : 'center'), vertical:'middle', wrapText:true };
        cell.border = fullBorder();
        if (col === 6){
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF38A' } };
        }
      });
    });

    ws.addRow([]);
    const footerRow = ws.addRow([
      `匯出人：${userDisplayText(currentUser)}`,
      '', '', '', '', '',
      `匯出時間：${formatDateTime(new Date())}`
    ]);
    ws.mergeCells(`A${footerRow.number}:F${footerRow.number}`);
    ws.mergeCells(`G${footerRow.number}:L${footerRow.number}`);
    footerRow.height = 18;
    footerRow.getCell(1).font = { name:'標楷體', size:10, bold:true };
    footerRow.getCell(7).font = { name:'標楷體', size:10, bold:true };
    footerRow.getCell(1).alignment = { horizontal:'left', vertical:'middle' };
    footerRow.getCell(7).alignment = { horizontal:'right', vertical:'middle' };

    ws.columns = [
      { width:8 }, { width:12 }, { width:14 }, { width:25 }, { width:12 }, { width:8 },
      { width:11 }, { width:11 }, { width:11 }, { width:11 }, { width:11 }, { width:11 }
    ];

    showLoading('匯出 Excel 中...');
    try{
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(sheet.title || '行動評估名單').replace(/[\\/:*?"<>|]+/g,'_')}_${sheet.date || formatDate(new Date(), '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }catch(err){
      console.error(err);
      alert('匯出 Excel 失敗：' + (err && err.message ? err.message : err));
    }finally{
      hideLoading();
    }
  }

  function fullBorder(){
    return {
      top:{ style:'thin', color:{ argb:'FF000000' } },
      left:{ style:'thin', color:{ argb:'FF000000' } },
      bottom:{ style:'thin', color:{ argb:'FF000000' } },
      right:{ style:'thin', color:{ argb:'FF000000' } }
    };
  }

  function updateYearFromDate(){
    const date = $('sheet-date').value;
    if (!date) return;
    const year = new Date(date).getFullYear();
    $('sheet-year').value = String(year);
    if (!$('sheet-title').value || $('sheet-title').value.includes('行動評估名單')){
      $('sheet-title').value = buildDefaultTitle(date);
    }
  }

  function bindEvents(){
    $('btn-new-sheet').addEventListener('click', newSheet);
    $('btn-back-list').addEventListener('click', () => toggleView('list'));
    $('year-filter').addEventListener('change', renderList);
    $('list-search').addEventListener('input', renderList);
    $('btn-add-empty-row').addEventListener('click', () => {
      currentRows.push(createEmptyRow());
      rerenderEditorRows();
    });
    $('btn-save-sheet').addEventListener('click', saveCurrentSheet);
    $('sheet-date').addEventListener('change', updateYearFromDate);
    $('btn-open-import').addEventListener('click', () => {
      if (residentModal) residentModal.show();
    });
    $('resident-search').addEventListener('input', renderResidentSelectionList);
    $('btn-resident-select-all').addEventListener('click', () => {
      document.querySelectorAll('.resident-select-check').forEach(c => c.checked = true);
    });
    $('btn-resident-clear-all').addEventListener('click', () => {
      document.querySelectorAll('.resident-select-check').forEach(c => c.checked = false);
    });
    $('btn-import-selected-residents').addEventListener('click', importSelectedResidents);
    $('btn-print-current').addEventListener('click', () => {
      const payload = {
        title: normalizeString($('sheet-title').value),
        date: $('sheet-date').value,
        createdByStaffId: normalizeString(currentUser.staffId),
        createdByName: normalizeString(currentUser.displayName),
        rows: collectEditorRows()
      };
      if (!payload.rows.length){
        alert('目前沒有資料可列印。');
        return;
      }
      printSheet(payload);
    });
    $('btn-export-current').addEventListener('click', () => {
      const payload = {
        title: normalizeString($('sheet-title').value),
        date: $('sheet-date').value,
        createdByStaffId: normalizeString(currentUser.staffId),
        createdByName: normalizeString(currentUser.displayName),
        rows: collectEditorRows()
      };
      if (!payload.rows.length){
        alert('目前沒有資料可匯出。');
        return;
      }
      exportSheetExcel(payload);
    });

    $('sheet-list-body').addEventListener('click', function(e){
      const editBtn = e.target.closest('.btn-edit-sheet');
      const printBtn = e.target.closest('.btn-print-sheet');
      const exportBtn = e.target.closest('.btn-export-sheet');
      const deleteBtn = e.target.closest('.btn-delete-sheet');
      if (editBtn){
        editSheet(editBtn.getAttribute('data-id'));
      } else if (printBtn){
        const sheet = getSheetById(printBtn.getAttribute('data-id'));
        if (sheet) printSheet(sheet);
      } else if (exportBtn){
        const sheet = getSheetById(exportBtn.getAttribute('data-id'));
        if (sheet) exportSheetExcel(sheet);
      } else if (deleteBtn){
        deleteSheet(deleteBtn.getAttribute('data-id'));
      }
    });

    bindEditorTableEvents();
  }

  async function start(){
    currentUser = getLoginUser();
    $('login-user-display').textContent = userDisplayText(currentUser);
    ensureYearOptions();
    residentModal = window.bootstrap ? new bootstrap.Modal($('resident-import-modal')) : null;
    bindEvents();
    toggleView('list');
    await Promise.all([loadSheets(), loadResidents()]);
  }

  function canStart(){
    return typeof db !== 'undefined' && db && typeof db.collection === 'function';
  }

  function boot(){
    if (appStarted) return;
    if (!canStart()) return;
    appStarted = true;
    mobilityDb = db;
    start();
  }

  document.addEventListener('firebase-ready', boot);
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(boot, 300);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 300));
  }
  let tries = 0;
  const timer = setInterval(() => {
    if (appStarted){ clearInterval(timer); return; }
    if (canStart()){
      clearInterval(timer);
      boot();
      return;
    }
    tries += 1;
    if (tries > 20) clearInterval(timer);
  }, 500);
})();
