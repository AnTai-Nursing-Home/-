document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  let statusList = [];

  // ===== 狀態樣式顯示 =====
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function getStatusBadge(statusName) {
    const found = statusList.find(s => s.name === statusName);
    return found
      ? `<span class="badge" style="background:${found.color};color:#fff;">${found.name}</span>`
      : `<span class="badge bg-secondary">${statusName || ""}</span>`;
  }

  // ===== 載入請假申請 =====
  function hoursText(d) {
    const v = Number(d?.durationValue ?? 0);
    if (v > 0) return v + " 小時"; // 舊資料顯示空白
    return "";
  }

  async function loadLeaveRequests() {
    leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await leaveCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有申請資料</td></tr>`;
      return;
    }

    leaveBody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${hoursText(d)}</td>
        <td>${d.reason || ""}</td>
        <td>${getStatusBadge(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
        <td>${d.note || ""}</td>
      `;
      leaveBody.appendChild(tr);
    });
  }

  // ===== 載入調班申請 =====
  async function loadSwapRequests() {
    swapBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await swapCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">目前沒有調班資料</td></tr>`;
      return;
    }

    swapBody.innerHTML = "";
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
        <td>${getStatusBadge(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
        <td>${d.note || ""}</td>
      `;
      swapBody.appendChild(tr);
    });
  }

  // ===== 送出請假申請 =====
  document.getElementById("leaveForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const applicantName = form.applicant?.value?.trim() || "未命名護理師";

    const data = {
      applicant: applicantName,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: form.leaveType.value,
      leaveDate: form.leaveDate.value,
      shift: form.shift.value,
      reason: form.reason.value,
      durationValue: Number(form.durationValue.value), // ✅ 新增
      durationUnit: "hour",
      status: "待審核",
      note: "",
      supervisorSign: ""
    };

    await leaveCol.add(data);
    alert(`✅ 已送出請假申請！（申請人：${applicantName}）`);
    form.reset();
  });

  // ===== 送出調班申請 =====
  document.getElementById("swapForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const applicantName = form.applicant?.value?.trim() || "未命名護理師";

    const data = {
      applicant: applicantName,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: form.swapDate.value,
      originalShift: form.originalShift.value,
      newShift: form.newShift.value,
      reason: form.reason.value,
      status: "待審核",
      note: "",
      supervisorSign: ""
    };

    await swapCol.add(data);
    alert(`✅ 已送出調班申請！（申請人：${applicantName}）`);
    form.reset();
  });

  // ===== 初始化 =====
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  // 即時同步 Firestore 更新
  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);
});
