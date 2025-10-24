document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  const leaveStatusSelect = document.getElementById("leaveStatusSelect");
  const swapStatusSelect = document.getElementById("swapStatusSelect");

  let statusList = [];

  // ====== 載入狀態清單 ======
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 填入新增表單的狀態選單
    [leaveStatusSelect, swapStatusSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = statusList
        .map(s => `<option value="${s.name}">${s.name}</option>`)
        .join("");
    });
  }

  function getStatusBadge(statusName) {
    const found = statusList.find(s => s.name === statusName);
    return found
      ? `<span class="badge" style="background:${found.color};color:#fff;">${found.name}</span>`
      : `<span class="badge bg-secondary">${statusName || ""}</span>`;
  }

  // ====== 日期範圍工具 ======
  function inDateRange(targetDate, start, end) {
    if (!targetDate) return true;
    const t = new Date(targetDate);
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (s && t < s) return false;
    if (e && t > e) return false;
    return true;
  }

  // ====== 載入請假資料 ======
  async function loadLeaveRequests() {
    leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await leaveCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`;
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
        <td>${d.reason || ""}</td>
        <td>${getStatusBadge(d.status)}</td>
        <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
        <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
        <td class="no-print text-center">
          <button class="btn btn-danger btn-sm delete-leave" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      leaveBody.appendChild(tr);
    });
  }

  // ====== 載入調班資料 ======
  async function loadSwapRequests() {
    swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await swapCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`;
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
        <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
        <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
        <td class="no-print text-center">
          <button class="btn btn-danger btn-sm delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      swapBody.appendChild(tr);
    });
  }

  // ====== 新增請假單 ======
  document.getElementById("addLeaveForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const data = {
      applicant: form.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: form.leaveType.value,
      leaveDate: form.leaveDate.value,
      shift: form.shift.value,
      reason: form.reason.value,
      status: form.status.value,
      note: "",
      supervisorSign: "主管"
    };

    await leaveCol.add(data);
    form.reset();
    alert("✅ 已新增請假單！");
  });

  // ====== 新增調班單 ======
  document.getElementById("addSwapForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const data = {
      applicant: form.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: form.swapDate.value,
      originalShift: form.originalShift.value,
      newShift: form.newShift.value,
      reason: form.reason.value,
      status: form.status.value,
      note: "",
      supervisorSign: "主管"
    };

    await swapCol.add(data);
    form.reset();
    alert("✅ 已新增調班單！");
  });

  // ====== 即時更新監聽 ======
  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);

  // ====== 刪除功能 ======
  document.addEventListener("click", async (e) => {
    if (e.target.closest(".delete-leave")) {
      const id = e.target.closest(".delete-leave").dataset.id;
      if (confirm("確定要刪除此請假單？")) await leaveCol.doc(id).delete();
    }
    if (e.target.closest(".delete-swap")) {
      const id = e.target.closest(".delete-swap").dataset.id;
      if (confirm("確定要刪除此調班單？")) await swapCol.doc(id).delete();
    }
  });

  // ====== 主管簽名 / 註解即時更新 ======
  document.addEventListener("input", async (e) => {
    if (e.target.classList.contains("supervisor-sign")) {
      const id = e.target.dataset.id;
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ supervisorSign: value }).catch(() => {}),
        swapCol.doc(id).update({ supervisorSign: value }).catch(() => {})
      ]);
    }

    if (e.target.classList.contains("note-area")) {
      const id = e.target.dataset.id;
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ note: value }).catch(() => {}),
        swapCol.doc(id).update({ note: value }).catch(() => {})
      ]);
    }
  });

  // ====== 初始化 ======
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();
});
