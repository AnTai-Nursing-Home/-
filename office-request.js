document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const statusBody = document.getElementById("statusTableBody");

  const leaveStatusFilter = document.getElementById("leaveStatusFilter");
  const swapStatusFilter = document.getElementById("swapStatusFilter");

  const leaveStatusSelect = document.getElementById("leaveStatusSelect");
  const swapStatusSelect = document.getElementById("swapStatusSelect");

  let statusList = [];

  // ====== 載入狀態清單 ======
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 更新選單
    const optionHTML = statusList.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    [leaveStatusSelect, swapStatusSelect, leaveStatusFilter, swapStatusFilter].forEach(sel => {
      if (sel) sel.innerHTML = `<option value="">全部</option>${optionHTML}`;
    });

    // 顯示在狀態管理表
    statusBody.innerHTML = statusList.map(s => `
      <tr>
        <td>${s.name}</td>
        <td><span class="badge" style="background:${s.color};color:#fff;">${s.color}</span></td>
      </tr>
    `).join("");
  }

  // ====== 新增狀態 ======
  document.getElementById("addStatusForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      color: form.color.value
    };
    if (!data.name) return alert("請輸入狀態名稱");
    await statusCol.add(data);
    form.reset();
    alert("✅ 已新增狀態");
    await loadStatuses();
  });

  // ====== 狀態 badge 顯示 ======
  function getStatusBadge(name) {
    const s = statusList.find(x => x.name === name);
    return s ? `<span class="badge" style="background:${s.color};color:#fff;">${s.name}</span>` : `<span class="badge bg-secondary">${name || ""}</span>`;
  }

  // ====== 日期範圍判斷 ======
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
    const start = document.getElementById("leaveStartDate").value;
    const end = document.getElementById("leaveEndDate").value;
    const filterStatus = leaveStatusFilter.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!inDateRange(d.leaveDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.leaveType || ""}</td>
          <td>${d.leaveDate || ""}</td>
          <td>${d.shift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}">
              ${statusList.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-leave" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    leaveBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  // ====== 載入調班資料 ======
  async function loadSwapRequests() {
    swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await swapCol.orderBy("applyDate", "desc").get();
    const start = document.getElementById("swapStartDate").value;
    const end = document.getElementById("swapEndDate").value;
    const filterStatus = swapStatusFilter.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!inDateRange(d.swapDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.swapDate || ""}</td>
          <td>${d.originalShift || ""}</td>
          <td>${d.newShift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}">
              ${statusList.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    swapBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  // ====== 篩選按鈕 ======
  document.getElementById("filterLeave")?.addEventListener("click", loadLeaveRequests);
  document.getElementById("filterSwap")?.addEventListener("click", loadSwapRequests);

  // ====== 新增請假單 ======
  document.getElementById("addLeaveForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: f.leaveType.value,
      leaveDate: f.leaveDate.value,
      shift: f.shift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: ""
    };
    await leaveCol.add(data);
    f.reset();
    alert("✅ 已新增請假單");
  });

  // ====== 新增調班單 ======
  document.getElementById("addSwapForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: f.swapDate.value,
      originalShift: f.originalShift.value,
      newShift: f.newShift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: ""
    };
    await swapCol.add(data);
    f.reset();
    alert("✅ 已新增調班單");
  });

  // ====== 刪除功能 ======
  document.addEventListener("click", async e => {
    const btnLeave = e.target.closest(".delete-leave");
    const btnSwap = e.target.closest(".delete-swap");
    if (btnLeave && confirm("確定要刪除此請假單？")) await leaveCol.doc(btnLeave.dataset.id).delete();
    if (btnSwap && confirm("確定要刪除此調班單？")) await swapCol.doc(btnSwap.dataset.id).delete();
  });

  // ====== 狀態更新 ======
  document.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
      const id = e.target.dataset.id;
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ status: value }).catch(() => {}),
        swapCol.doc(id).update({ status: value }).catch(() => {})
      ]);
    }
  });

  // ====== 即時更新：主管簽名與註解 ======
  document.addEventListener("input", async e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains("supervisor-sign")) {
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ supervisorSign: value }).catch(() => {}),
        swapCol.doc(id).update({ supervisorSign: value }).catch(() => {})
      ]);
    }
    if (e.target.classList.contains("note-area")) {
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ note: value }).catch(() => {}),
        swapCol.doc(id).update({ note: value }).catch(() => {})
      ]);
    }
  });

  // ====== 匯出 Excel ======
  document.getElementById("exportExcel")?.addEventListener("click", () => {
    const wb = XLSX.utils.book_new();
    const leaveTable = XLSX.utils.table_to_sheet(document.getElementById("leaveTable"));
    const swapTable = XLSX.utils.table_to_sheet(document.getElementById("swapTable"));
    XLSX.utils.book_append_sheet(wb, leaveTable, "請假單");
    XLSX.utils.book_append_sheet(wb, swapTable, "調班單");
    XLSX.writeFile(wb, "請假與調班紀錄.xlsx");
  });

  // ====== 初始化 ======
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  // 即時監聽更新
  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);
});
