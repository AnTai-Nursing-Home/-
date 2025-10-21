document.addEventListener('firebase-ready', async () => {
  const dbLeave = db.collection('nurse_leave_requests');
  const dbShift = db.collection('nurse_shift_requests');
  const dbStatus = db.collection('request_status_list');

  const leaveTableBody = document.getElementById('leaveTableBody');
  const shiftTableBody = document.getElementById('shiftTableBody');
  const statusListDiv = document.getElementById('statusList');
  const addStatusBtn = document.getElementById('addStatusBtn');
  const newStatusInput = document.getElementById('newStatus');

  // === 狀態管理 ===
  async function loadStatuses() {
    statusListDiv.innerHTML = '';
    const snap = await dbStatus.orderBy('name').get();
    snap.forEach(doc => {
      const div = document.createElement('div');
      div.classList = 'badge bg-secondary p-2';
      div.textContent = doc.data().name;
      div.addEventListener('click', async () => {
        if (confirm(`刪除此狀態 "${doc.data().name}"？`)) {
          await dbStatus.doc(doc.id).delete();
          loadStatuses();
        }
      });
      statusListDiv.appendChild(div);
    });
  }

  addStatusBtn.addEventListener('click', async () => {
    const val = newStatusInput.value.trim();
    if (!val) return alert('請輸入狀態名稱');
    await dbStatus.add({ name: val });
    newStatusInput.value = '';
    loadStatuses();
  });

  async function getStatuses() {
    const snap = await dbStatus.get();
    return snap.docs.map(d => d.data().name);
  }

  // === 載入請假清單 ===
  async function loadLeaveList() {
    leaveTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbLeave.orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      leaveTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }

    const statuses = await getStatuses();
    leaveTableBody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement('tr');
      const statusOptions = statuses.map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('');
      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.leaveDate || ''}</td>
        <td>${d.leaveType || ''}</td>
        <td>${d.shift || ''}</td>
        <td>${d.reason || ''}</td>
        <td><select class="form-select form-select-sm statusSelect">${statusOptions}</select></td>
        <td><input type="text" class="form-control form-control-sm commentInput" placeholder="留言..."></td>
        <td>
          <button class="btn btn-sm btn-success saveBtn">儲存</button>
          <button class="btn btn-sm btn-danger delBtn">刪除</button>
        </td>`;
      leaveTableBody.appendChild(tr);

      tr.querySelector('.saveBtn').addEventListener('click', async () => {
        const newStatus = tr.querySelector('.statusSelect').value;
        const comment = tr.querySelector('.commentInput').value.trim();
        await dbLeave.doc(doc.id).update({
          status: newStatus,
          comment: comment ? `${comment}（${new Date().toLocaleString()}）` : ''
        });
        alert('✅ 已更新');
      });

      tr.querySelector('.delBtn').addEventListener('click', async () => {
        if (confirm('確定刪除此紀錄？')) {
          await dbLeave.doc(doc.id).delete();
          loadLeaveList();
        }
      });
    });
  }

  // === 載入調班清單 ===
  async function loadShiftList() {
    shiftTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbShift.orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      shiftTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }

    const statuses = await getStatuses();
    shiftTableBody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement('tr');
      const statusOptions = statuses.map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('');
      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.fromDate || ''}</td>
        <td>${d.fromShift || ''}</td>
        <td>${d.toDate || ''}</td>
        <td>${d.toShift || ''}</td>
        <td>${d.reason || ''}</td>
        <td><select class="form-select form-select-sm statusSelect">${statusOptions}</select></td>
        <td><input type="text" class="form-control form-control-sm commentInput" placeholder="留言..."></td>
        <td>
          <button class="btn btn-sm btn-success saveBtn">儲存</button>
          <button class="btn btn-sm btn-danger delBtn">刪除</button>
        </td>`;
      shiftTableBody.appendChild(tr);

      tr.querySelector('.saveBtn').addEventListener('click', async () => {
        const newStatus = tr.querySelector('.statusSelect').value;
        const comment = tr.querySelector('.commentInput').value.trim();
        await dbShift.doc(doc.id).update({
          status: newStatus,
          comment: comment ? `${comment}（${new Date().toLocaleString()}）` : ''
        });
        alert('✅ 已更新');
      });

      tr.querySelector('.delBtn').addEventListener('click', async () => {
        if (confirm('確定刪除此紀錄？')) {
          await dbShift.doc(doc.id).delete();
          loadShiftList();
        }
      });
    });
  }

  // === 匯出 / 列印功能 ===
  function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, filename + ".xlsx");
  }

  function exportTableToWord(tableId, filename) {
    const table = document.getElementById(tableId).outerHTML;
    const blob = new Blob(['\ufeff' + table], {
      type: 'application/msword'
    });
    saveAs(blob, filename + '.doc');
  }

  function printTable(tableId) {
    const printContents = document.getElementById(tableId).outerHTML;
    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>列印</title></head><body>');
    win.document.write('<h3>報表列印</h3>');
    win.document.write(printContents);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  }

  document.getElementById('printLeave').addEventListener('click', () => printTable('leaveTable'));
  document.getElementById('printShift').addEventListener('click', () => printTable('shiftTable'));

  document.getElementById('exportLeaveExcel').addEventListener('click', () => exportTableToExcel('leaveTable', '請假清單'));
  document.getElementById('exportShiftExcel').addEventListener('click', () => exportTableToExcel('shiftTable', '調班清單'));

  document.getElementById('exportLeaveWord').addEventListener('click', () => exportTableToWord('leaveTable', '請假清單'));
  document.getElementById('exportShiftWord').addEventListener('click', () => exportTableToWord('shiftTable', '調班清單'));

  // === 初始化 ===
  loadStatuses();
  loadLeaveList();
  loadShiftList();
});
