document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  let statusList = [];

  // ===== 狀態清單載入 =====
  async function loadStatuses() {
    const snap = await statusCol.get();
    statusList = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        color: data.color || data.colour || data.colorCode || "#6c757d"
      };
    });
    console.log("✅ 狀態清單載入完成：", statusList);
  }

  // ===== 顯示狀態（含顏色與自動判斷亮度） =====
  function getStatusStyle(statusName) {
    const found = statusList.find(s => s.name === statusName);
    if (!found) {
      console.warn("⚠️ 未找到顏色設定：", statusName);
      return `<span class="badge bg-secondary">${statusName || ""}</span>`;
    }

    const bg = found.color;
    const rgb = parseInt(bg.replace("#", ""), 16);
    const brightness =
      ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000;
    const textColor = brightness > 140 ? "#000" : "#fff";

    return `<span class="badge" style="background:${bg};color:${textColor};">${found.name}</span>`;
  }

  // ===== 顯示載入中 =====
  function showLoading(tbody, colspan) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== 自動修正舊狀態 =====
  async function fixOldStatus(colRef, doc, data) {
    if (data.status === "審核中") {
      console.log("🛠️ 自動修正舊資料：", doc.id, "→ 待審核");
      await colRef.doc(doc.id).update({ status: "待審核" });
      data.status = "待審核";
    }
  }

  // ===== 請假申請載入 =====
  async function loadLeaveRequests() {
    showLoading(leaveBody, 8);
    const snap = await leaveCol.orderBy("applyDate", "desc").get();
    leaveBody.innerHTML = "";
    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有請假資料</td></tr>`;
      return;
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      await fixOldStatus(leaveCol, doc, d);

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
    }
  }

  // ===== 調班申請載入 =====
  async function loadSwapRequests() {
    showLoading(swapBody, 8);
    const snap = await swapCol.orderBy("applyDate", "desc").get();
    swapBody.innerHTML = "";
    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有調班資料</td></tr>`;
      return;
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      await fixOldStatus(swapCol, doc, d);

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
    }
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
      status: "待審核", // ✅ 預設狀態
      notes: [],
    };
    await leaveCol.add(data);
    alert("✅ 已送出請假申請");
    form.reset();
    loadLeaveRequests();
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
      status: "待審核", // ✅ 預設狀態
      notes: [],
    };
    await swapCol.add(data);
    alert("✅ 已送出調班申請");
    form.reset();
    loadSwapRequests();
  });

  // ===== 初次載入 =====
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  // ===== 即時同步 =====
  leaveCol.onSnapshot(() => loadLeaveRequests());
  swapCol.onSnapshot(() => loadSwapRequests());
  statusCol.onSnapshot(() => loadStatuses());
});
