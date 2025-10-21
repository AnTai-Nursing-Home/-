document.addEventListener('firebase-ready', () => {
  const dbLeave = db.collection('nurse_leave_requests');
  const dbShift = db.collection('nurse_shift_requests');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('applyDate').value = today;
  document.getElementById('shiftApplyDate').value = today;

  const addLeaveBtn = document.getElementById('addLeaveBtn');
  const addShiftBtn = document.getElementById('addShiftBtn');
  const leaveTableBody = document.getElementById('leaveTableBody');
  const shiftTableBody = document.getElementById('shiftTableBody');

  // 🔹 新增請假申請
  async function addLeave() {
    const data = {
      applyDate: document.getElementById('applyDate').value,
      applicant: document.getElementById('applicant').value.trim(),
      leaveDate: document.getElementById('leaveDate').value,
      leaveType: document.getElementById('leaveType').value,
      shift: document.getElementById('shift').value.trim(),
      reason: document.getElementById('reason').value.trim(),
      status: '待審核',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (Object.values(data).some(v => !v)) return alert('⚠️ 請完整填寫請假資料！');
    await dbLeave.add(data);
    alert('✅ 已送出請假申請！');
    loadLeaveList();
  }

  // 🔹 新增調班申請
  async function addShift() {
    const data = {
      applyDate: document.getElementById('shiftApplyDate').value,
      applicant: document.getElementById('shiftApplicant').value.trim(),
      fromDate: document.getElementById('fromDate').value,
      fromShift: document.getElementById('fromShift').value.trim(),
      toDate: document.getElementById('toDate').value,
      toShift: document.getElementById('toShift').value.trim(),
      reason: document.getElementById('shiftReason').value.trim(),
      status: '待審核',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (Object.values(data).some(v => !v)) return alert('⚠️ 請完整填寫調班資料！');
    await dbShift.add(data);
    alert('✅ 已送出調班申請！');
    loadShiftList();
  }

  // === 載入請假清單 ===
  async function loadLeaveList() {
    const tbody = document.getElementById('leaveTableBody');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">讀取中...</td></tr>`;
  
    const snap = await db.collection('nurse_leave_requests').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }
  
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.leaveDate || ''}</td>
        <td>${d.leaveType || ''}</td>
        <td>${d.shift || ''}</td>
        <td>${d.reason || ''}</td>
        <td>${d.status || ''}</td>
        <td>${d.comment || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  // === 載入調班清單 ===
  async function loadShiftList() {
    const tbody = document.getElementById('shiftTableBody');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">讀取中...</td></tr>`;
  
    const snap = await db.collection('nurse_shift_requests').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }
  
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.applyDate || ''}</td>
        <td>${d.applicant || ''}</td>
        <td>${d.fromDate || ''}</td>
        <td>${d.fromShift || ''}</td>
        <td>${d.toDate || ''}</td>
        <td>${d.toShift || ''}</td>
        <td>${d.reason || ''}</td>
        <td>${d.status || ''}</td>
        <td>${d.comment || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  addLeaveBtn.addEventListener('click', addLeave);
  addShiftBtn.addEventListener('click', addShift);

  loadLeaveList();
  loadShiftList();
});
