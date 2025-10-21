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

  // === 通用函式：顯示註解列表 ===
  function renderNotes(notes, docRef, reloadCallback) {
    if (!notes || notes.length === 0) return '<li class="text-muted">尚無註解</li>';

    return notes
      .map(
        (n, i) => `
      <li>
        <div class="d-flex justify-content-between align-items-center">
          <span>${n.content} <small class="text-muted">(${n.author} / ${n.timestamp})</small></span>
          <div>
            <button class="btn btn-sm btn-outline-secondary me-1 editNoteBtn" data-idx="${i}">✏️</button>
            <button class="btn btn-sm btn-outline-danger delNoteBtn" data-idx="${i}">🗑️</button>
          </div>
        </div>
      </li>`
      )
      .join('');
  }

  // === 通用函式：處理註解操作 ===
  function handleNoteActions(tr, docRef, notes, reloadFn) {
    tr.querySelectorAll('.editNoteBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = btn.dataset.idx;
        const note = notes[idx];
        const newContent = prompt('修改註解內容：', note.content);
        if (newContent === null || newContent.trim() === '') return;

        notes[idx].content = newContent.trim();
        notes[idx].timestamp = new Date().toLocaleString();
        await docRef.update({ notes });
        alert('✅ 註解已更新');
        reloadFn();
      });
    });

    tr.querySelectorAll('.delNoteBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = btn.dataset.idx;
        if (!confirm('確定刪除此註解？')) return;

        notes.splice(idx, 1);
        await docRef.update({ notes });
        alert('🗑️ 已刪除註解');
        reloadFn();
      });
    });
  }

  // === 請假清單 ===
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
      const notesHTML = renderNotes(d.notes, dbLeave.doc(doc.id), loadLeaveList);

      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.leaveDate || ''}</td>
        <td>${d.leaveType || ''}</td>
        <td>${d.shift || ''}</td>
        <td>${d.reason || ''}</td>
        <td><select class="form-select form-select-sm statusSelect">${statusOptions}</select></td>
        <td>
          <ul class="mb-2">${notesHTML}</ul>
          <input type="text" class="form-control form-control-sm noteInput" placeholder="新增註解...">
        </td>
        <td>
          <button class="btn btn-sm btn-success saveBtn">儲存</button>
          <button class="btn btn-sm btn-danger delBtn">刪除</button>
        </td>`;
      leaveTableBody.appendChild(tr);

      const docRef = dbLeave.doc(doc.id);

      tr.querySelector('.saveBtn').addEventListener('click', async () => {
        const newStatus = tr.querySelector('.statusSelect').value;
        const newNote = tr.querySelector('.noteInput').value.trim();

        const updateData = { status: newStatus };
        if (newNote)
          updateData.notes = firebase.firestore.FieldValue.arrayUnion({
            author: '辦公室管理員',
            content: newNote,
            timestamp: new Date().toLocaleString(),
          });

        await docRef.update(updateData);
        alert('✅ 已更新');
        loadLeaveList();
      });

      tr.querySelector('.delBtn').addEventListener('click', async () => {
        if (confirm('確定刪除此紀錄？')) {
          await docRef.delete();
          loadLeaveList();
        }
      });

      // 綁定編輯/刪除註解事件
      handleNoteActions(tr, docRef, d.notes || [], loadLeaveList);
    });
  }

  // === 調班清單 ===
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
      const notesHTML = renderNotes(d.notes, dbShift.doc(doc.id), loadShiftList);

      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.fromDate || ''}</td>
        <td>${d.fromShift || ''}</td>
        <td>${d.toDate || ''}</td>
        <td>${d.toShift || ''}</td>
        <td>${d.reason || ''}</td>
        <td><select class="form-select form-select-sm statusSelect">${statusOptions}</select></td>
        <td>
          <ul class="mb-2">${notesHTML}</ul>
          <input type="text" class="form-control form-control-sm noteInput" placeholder="新增註解...">
        </td>
        <td>
          <button class="btn btn-sm btn-success saveBtn">儲存</button>
          <button class="btn btn-sm btn-danger delBtn">刪除</button>
        </td>`;
      shiftTableBody.appendChild(tr);

      const docRef = dbShift.doc(doc.id);

      tr.querySelector('.saveBtn').addEventListener('click', async () => {
        const newStatus = tr.querySelector('.statusSelect').value;
        const newNote = tr.querySelector('.noteInput').value.trim();

        const updateData = { status: newStatus };
        if (newNote)
          updateData.notes = firebase.firestore.FieldValue.arrayUnion({
            author: '辦公室管理員',
            content: newNote,
            timestamp: new Date().toLocaleString(),
          });

        await docRef.update(updateData);
        alert('✅ 已更新');
        loadShiftList();
      });

      tr.querySelector('.delBtn').addEventListener('click', async () => {
        if (confirm('確定刪除此紀錄？')) {
          await docRef.delete();
          loadShiftList();
        }
      });

      // 綁定編輯/刪除註解事件
      handleNoteActions(tr, docRef, d.notes || [], loadShiftList);
    });
  }

  // === 初始化 ===
  loadStatuses();
  loadLeaveList();
  loadShiftList();
});
