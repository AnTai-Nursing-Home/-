document.addEventListener('firebase-ready', () => {
  // ======= Firestore 集合名稱 =======
  const overtimeCollection = 'overtime_requests';
  const deductCollection = 'deduct_requests';
  const nursesCollection = 'nurses';
  const caregiversCollection = 'caregivers';

  // ======= 預設狀態 =======
  const DEFAULT_STATUSES = [
    { name: '待審', color: '#6c757d' },
    { name: '核准', color: '#198754' },
    { name: '退回', color: '#dc3545' }
  ];

  // ======= 狀態暫存（localStorage）=======
  function getStatuses(type) {
    const key = `status_${type}`;
    const list = localStorage.getItem(key);
    return list ? JSON.parse(list) : DEFAULT_STATUSES;
  }
  function setStatuses(type, arr) {
    localStorage.setItem(`status_${type}`, JSON.stringify(arr));
    fillFilterOptions(type);
  }

  // ======= DOM =======
  const modalEntry = new bootstrap.Modal(document.getElementById('entry-modal'));
  const modalStatus = new bootstrap.Modal(document.getElementById('status-modal'));

  // ======= 讀取員工名單 =======
  async function loadEmployees() {
    const select = document.getElementById('employee-select');
    select.innerHTML = `<option value="">讀取中...</option>`;
    try {
      const [nursesSnap, caregiversSnap] = await Promise.all([
        db.collection(nursesCollection).orderBy('sortOrder').get(),
        db.collection(caregiversCollection).orderBy('sortOrder').get()
      ]);
      let html = '<option value="">請選擇員工</option>';
      nursesSnap.forEach(doc => {
        const e = doc.data();
        html += `<option value="${e.name}" data-id="${e.id}">${e.name}（護理師）</option>`;
      });
      caregiversSnap.forEach(doc => {
        const e = doc.data();
        html += `<option value="${e.name}" data-id="${e.id}">${e.name}（照服員）</option>`;
      });
      select.innerHTML = html;
    } catch (err) {
      console.error('讀取員工資料失敗', err);
      select.innerHTML = `<option value="">讀取失敗</option>`;
    }
  }

  // ======= 儲存單筆 =======
  async function saveEntry() {
    const type = document.getElementById('form-type').value;
    const editId = document.getElementById('edit-id').value;
    const name = document.getElementById('employee-select').value;
    const employeeOption = document.querySelector(`#employee-select option[value="${name}"]`);
    const id = employeeOption ? employeeOption.dataset.id : '';
    const date = document.getElementById('date-input').value;
    const hours = parseFloat(document.getElementById('hours-input').value);
    const reason = document.getElementById('reason-input').value.trim();
    const status = document.getElementById('status-select').value;
    const signName = document.getElementById('sign-name-input').value.trim();
    const note = document.getElementById('note-input').value.trim();
    const file = document.getElementById('sign-image-input').files[0];

    if (!name || !date || !hours || !reason) {
      alert('請完整填寫必要欄位。');
      return;
    }

    const coll = (type === 'ot') ? overtimeCollection : deductCollection;
    const ref = db.collection(coll);
    const payload = {
      name, id, date, hours, reason, status, signName, note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const saveToDB = async (imgData) => {
      if (imgData) payload.signImage = imgData;
      if (editId) await ref.doc(editId).set(payload, { merge: true });
      else await ref.add(payload);
      modalEntry.hide();
      renderTable(type);
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = () => saveToDB(reader.result);
      reader.readAsDataURL(file);
    } else {
      saveToDB(null);
    }
  }

  // ======= 渲染表格 =======
  async function renderTable(type) {
    const tbody = document.querySelector(`#table-${type === 'ot' ? 'ot' : 'deduct'} tbody`);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">讀取中...</td></tr>`;
    const coll = (type === 'ot') ? overtimeCollection : deductCollection;

    try {
      const statusFilter = document.getElementById(`filter-status-${type}`).value || '';
      const from = document.getElementById(`filter-from-${type}`).value;
      const to = document.getElementById(`filter-to-${type}`).value;
      let query = db.collection(coll).orderBy('date', 'desc');
      const snapshot = await query.get();
      let rows = '';
      const statuses = getStatuses(type);
      let idx = 1;

      snapshot.forEach(doc => {
        const e = doc.data();
        if (statusFilter && e.status !== statusFilter) return;
        if (from && e.date < from) return;
        if (to && e.date > to) return;

        const s = statuses.find(x => x.name === e.status);
        const color = s ? s.color : '#999999';
        const signBlock = `
          ${e.signName ? `<div>${e.signName}</div>` : ''}
          ${e.signImage ? `<img src="${e.signImage}" class="signature-img">` : ''}
        `;
        rows += `
          <tr>
            <td>${idx++}</td>
            <td>${e.name || ''}</td>
            <td>${e.date || ''}</td>
            <td>${e.hours || ''}</td>
            <td>${escapeHTML(e.reason || '')}</td>
            <td><span class="badge-status" style="color:${color};background:${hexToRgba(color,0.15)};">${e.status || ''}</span></td>
            <td>${signBlock}</td>
            <td>${escapeHTML(e.note || '')}</td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline-primary me-1" onclick="editEntry('${type}','${doc.id}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteEntry('${type}','${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = rows || `<tr><td colspan="9" class="text-center text-muted">尚無資料</td></tr>`;
    } catch (err) {
      console.error('載入資料失敗', err);
      tbody.innerHTML = `<tr><td colspan="9" class="text-danger text-center">讀取失敗</td></tr>`;
    }
  }

  // ======= 編輯與刪除 =======
  window.editEntry = async function(type, docId) {
    const coll = (type === 'ot') ? overtimeCollection : deductCollection;
    const doc = await db.collection(coll).doc(docId).get();
    if (!doc.exists) return;
    const data = doc.data();

    document.getElementById('form-type').value = type;
    document.getElementById('edit-id').value = docId;
    document.getElementById('entry-modal-title').textContent = `編輯${type === 'ot' ? '加班單' : '扣班單'}`;
    document.getElementById('date-label').textContent = type === 'ot' ? '加班日' : '扣班日';

    await loadEmployees();
    document.getElementById('employee-select').value = data.name || '';
    document.getElementById('date-input').value = data.date || '';
    document.getElementById('hours-input').value = data.hours || '';
    document.getElementById('reason-input').value = data.reason || '';
    document.getElementById('sign-name-input').value = data.signName || '';
    document.getElementById('note-input').value = data.note || '';
    fillStatusSelect(type, data.status);

    modalEntry.show();
  };

  window.deleteEntry = async function(type, docId) {
    if (!confirm('確定要刪除此筆資料嗎？')) return;
    const coll = (type === 'ot') ? overtimeCollection : deductCollection;
    await db.collection(coll).doc(docId).delete();
    renderTable(type);
  };

  // ======= 狀態管理 =======
  function openStatusManager(type) {
    currentStatusType = type;
    renderStatusList(type);
    modalStatus.show();
  }

  function renderStatusList(type) {
    const box = document.getElementById('status-list');
    const list = getStatuses(type);
    box.innerHTML = '';
    list.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'd-flex justify-content-between align-items-center border rounded p-2';
      row.innerHTML = `
        <div><span class="status-color me-2" style="background:${s.color}"></span>${s.name}</div>
        <div>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editStatus('${type}',${i})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStatus('${type}',${i})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      box.appendChild(row);
    });
  }

  window.editStatus = function(type, i) {
    const list = getStatuses(type);
    const s = list[i];
    const newName = prompt('修改狀態名稱', s.name);
    if (newName === null) return;
    const newColor = prompt('修改顏色（#RRGGBB）', s.color);
    if (newColor === null) return;
    list[i] = { name: newName.trim() || s.name, color: (/^#([0-9A-Fa-f]{6})$/.test(newColor) ? newColor : s.color) };
    setStatuses(type, list);
    renderStatusList(type);
  };

  window.deleteStatus = function(type, i) {
    const list = getStatuses(type);
    if (!confirm(`刪除狀態「${list[i].name}」？`)) return;
    list.splice(i, 1);
    setStatuses(type, list);
    renderStatusList(type);
  };

  document.getElementById('btn-add-status').addEventListener('click', () => {
    const name = document.getElementById('status-name').value.trim();
    const color = document.getElementById('status-color').value;
    if (!name) return alert('請輸入狀態名稱');
    const list = getStatuses(currentStatusType);
    if (list.some(s => s.name === name)) return alert('狀態已存在');
    list.push({ name, color });
    setStatuses(currentStatusType, list);
    document.getElementById('status-name').value = '';
    renderStatusList(currentStatusType);
  });

  function fillStatusSelect(type, selected = '') {
    const sel = document.getElementById('status-select');
    sel.innerHTML = '';
    const statuses = getStatuses(type);
    statuses.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      if (s.name === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function fillFilterOptions(type) {
    const sel = document.getElementById(`filter-status-${type}`);
    sel.innerHTML = '<option value="">全部狀態</option>';
    getStatuses(type).forEach(s => {
      const o = document.createElement('option');
      o.value = s.name;
      o.textContent = s.name;
      sel.appendChild(o);
    });
  }

  // ======= 匯出 Excel =======
  async function exportExcel(type) {
    const coll = (type === 'ot') ? overtimeCollection : deductCollection;
    const snapshot = await db.collection(coll).orderBy('date', 'desc').get();
    const data = [];
    snapshot.forEach(doc => {
      const e = doc.data();
      data.push({
        姓名: e.name,
        日期: e.date,
        時數: e.hours,
        原因: e.reason,
        狀態: e.status,
        主管簽名: e.signName || '',
        注解: e.note || ''
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'ot' ? '加班單' : '扣班單');
    XLSX.writeFile(wb, (type === 'ot' ? '加班單' : '扣班單') + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  // ======= 公用工具 =======
  function escapeHTML(str) {
    return str ? str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m])) : '';
  }
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ======= 事件綁定 =======
  document.getElementById('btn-save-entry').addEventListener('click', saveEntry);

  // 加班單
  document.getElementById('btn-new-ot').addEventListener('click', async () => {
    await loadEmployees();
    fillStatusSelect('ot');
    document.getElementById('form-type').value = 'ot';
    document.getElementById('entry-form').reset();
    document.getElementById('entry-modal-title').textContent = '新增加班單';
    document.getElementById('date-label').textContent = '加班日';
    modalEntry.show();
  });
  document.getElementById('btn-status-ot').addEventListener('click', () => openStatusManager('ot'));
  document.getElementById('btn-export-ot').addEventListener('click', () => exportExcel('ot'));
  document.getElementById('btn-print-ot').addEventListener('click', () => window.print());
  document.getElementById('btn-clear-ot').addEventListener('click', () => { 
    document.getElementById('filter-status-ot').value='';
    document.getElementById('filter-from-ot').value='';
    document.getElementById('filter-to-ot').value='';
    renderTable('ot');
  });
  ['filter-status-ot','filter-from-ot','filter-to-ot'].forEach(id=>{
    document.getElementById(id).addEventListener('change',()=>renderTable('ot'));
  });

  // 扣班單
  document.getElementById('btn-new-deduct').addEventListener('click', async () => {
    await loadEmployees();
    fillStatusSelect('deduct');
    document.getElementById('form-type').value = 'deduct';
    document.getElementById('entry-form').reset();
    document.getElementById('entry-modal-title').textContent = '新增扣班單';
    document.getElementById('date-label').textContent = '扣班日';
    modalEntry.show();
  });
  document.getElementById('btn-status-deduct').addEventListener('click', () => openStatusManager('deduct'));
  document.getElementById('btn-export-deduct').addEventListener('click', () => exportExcel('deduct'));
  document.getElementById('btn-print-deduct').addEventListener('click', () => window.print());
  document.getElementById('btn-clear-deduct').addEventListener('click', () => { 
    document.getElementById('filter-status-deduct').value='';
    document.getElementById('filter-from-deduct').value='';
    document.getElementById('filter-to-deduct').value='';
    renderTable('deduct');
  });
  ['filter-status-deduct','filter-from-deduct','filter-to-deduct'].forEach(id=>{
    document.getElementById(id).addEventListener('change',()=>renderTable('deduct'));
  });

  // ======= 初始化 =======
  let currentStatusType = 'ot';
  fillFilterOptions('ot');
  fillFilterOptions('deduct');
  renderTable('ot');
  renderTable('deduct');
});
