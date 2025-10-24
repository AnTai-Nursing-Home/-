document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  let statusList = [];

  // ===== 載入狀態設定（共用顏色表） =====
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get();
    statusList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function getStatusStyle(statusName) {
    const found = statusList.find(s => s.name === statusName);
    if (!found) return `<span>${statusName || ""}</span>`;
    const color = found.color || "#6c757d";
    return `<span class="badge" style="background:${color};">${found.name}</span>`;
  }

  function showLoading(tbody, colspan) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== 請假申請載入 =====
  async function loadLeaveRequests(userFilter = "") {
    showLoading(leaveBody, 8);
    let query = leaveCol.orderBy("applyDate", "desc");
    if (userFilter) query = query.where("applicant", "==", userFilter);
    const snap = await query.get();
    leaveBody.innerHTML = "";
    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有請假資料</td></tr>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>${getStatusStyle(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
      `;
      leaveBody.appendChild(tr);
    });
  }

  // ===== 調班申請載入 =====
  async function loadSwapRequests(userFilter = "") {
    showLoading(swapBody, 8);
    let query = swapCol.orderBy("applyDate", "desc");
    if (userFilter) query = query.where("applicant", "==", userFilter);
    const snap = await query.get();
    swapBody.innerHTML = "";
    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有調班資料</td></tr>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>${getStatusStyle(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
      `;
      swapBody.appendChild(tr);
    });
  }

  // ===== 新增請假申請 =====
  document.getElementById("addLeaveForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      applyDate: new Date().toISOString().split("T")[0],
      applicant: form.applicant.value.trim(),
      leaveType: form.leaveType.value.trim(),
      leaveDate: form.leaveDate.value.trim(),
      shift: form.shift.value.trim(),
      reason: form.reason.value.trim(),
      status: "審核中",
      notes: [],
    };
    await leaveCol.add(data);
    alert("✅ 已送出請假申請");
    form.reset();
    loadLeaveRequests(form.applicant.value.trim());
  });

  // ===== 新增調班申請 =====
  document.getElementById("addSwapForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      applyDate: new Date().toISOString().split("T")[0],
      applicant: form.applicant.value.trim(),
      swapDate: form.swapDate.value.trim(),
      originalShift: form.originalShift.value.trim(),
      newShift: form.newShift.value.trim(),
      reason: form.reason.value.trim(),
      status: "審核中",
      notes: [],
    };
    await swapCol.add(data);
    alert("✅ 已送出調班申請");
    form.reset();
    loadSwapRequests(form.applicant.value.trim());
  });

  // ===== 初次載入 =====
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  // ===== 即時同步（狀態有變更時自動更新顯示） =====
  leaveCol.onSnapshot(() => loadLeaveRequests());
  swapCol.onSnapshot(() => loadSwapRequests());
});
