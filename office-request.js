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

    // 更新狀態選項
    const optionHTML = statusList.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    [leaveStatusSelect, swapStatusSelect, leaveStatusFilter, swapStatusFilter].forEach(sel => {
      if (sel) sel.innerHTML = `<option value="">全部</option>${optionHTML}`;
    });

    // 狀態管理表
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

  // ====== 狀態顏色輔助 ======
  function getStatusColor(name) {
    const s = statusList.find(x => x.name === name);
    return s ? s.color : "#6c757d";
  }

  // ====== 日期篩選 ======
  function inDateRange(targetDate, start, end) {
    if (!targetDate) return true;
    const t = new Date(targetDate);
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (s && t < s) return false;
    if (e && t > e) return false;
    return true;
  }

  // ====== 請假資料 ======
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
      const color = getStatusColor(d.status);

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.leaveType || ""}</td>
          <td>${d.leaveDate || ""}</td>
          <td>${d.shift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}"
              style="background:${color};color:#fff;">
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

  // ====== 調班資料 ======
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
      const color = getStatusColor(d.status);

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.swapDate || ""}</td>
          <td>${d.originalShift || ""}</td>
          <td>${d.newShift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}"
              style="background:${color};color:#fff;">
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

  // ====== 篩選 ======
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

  // ====== 刪除 ======
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
      const color = getStatusColor(value);
      e.target.style.background = color;
      e.target.style.color = "#fff";
      await Promise.all([
        leaveCol.doc(id).update({ status: value }).catch(() => {}),
        swapCol.doc(id).update({ status: value }).catch(() => {})
      ]);
    }
  });

  // ====== 簽名與註解 ======
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

  // ====== 匯出請假紀錄 ======
  document.getElementById("exportLeaveExcel")?.addEventListener("click", () => {
    const clone = document.getElementById("leaveTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(clone);
    XLSX.utils.book_append_sheet(wb, ws, "請假紀錄");
    XLSX.writeFile(wb, "請假紀錄.xlsx");
  });

  // ====== 匯出調班紀錄 ======
  document.getElementById("exportSwapExcel")?.addEventListener("click", () => {
    const clone = document.getElementById("swapTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(clone);
    XLSX.utils.book_append_sheet(wb, ws, "調班紀錄");
    XLSX.writeFile(wb, "調班紀錄.xlsx");
  });

  // ====== 列印請假紀錄 ======
  document.getElementById("printLeaveTable")?.addEventListener("click", () => {
    const clone = document.getElementById("leaveTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const content = clone.outerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html><head><title>請假紀錄</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family:"Microsoft JhengHei"; font-size:13px; }
        table { border-collapse:collapse; width:100%; }
        th,td { border:1px solid #000; padding:6px; text-align:center; }
        h2,h4,p { text-align:center; margin:0; }
      </style></head>
      <body>
        <h2>安泰護理之家</h2>
        <h4>請假紀錄表</h4>
        <p>列印日期：${new Date().toLocaleDateString('zh-TW')}</p>
        ${content}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  });

  // ====== 列印調班紀錄 ======
  document.getElementById("printSwapTable")?.addEventListener("click", () => {
    const clone = document.getElementById("swapTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const content = clone.outerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html><head><title>調班紀錄</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family:"Microsoft JhengHei"; font-size:13px; }
        table { border-collapse:collapse; width:100%; }
        th,td { border:1px solid #000; padding:6px; text-align:center; }
        h2,h4,p { text-align:center; margin:0; }
      </style></head>
      <body>
        <h2>安泰護理之家</h2>
        <h4>調班紀錄表</h4>
        <p>列印日期：${new Date().toLocaleDateString('zh-TW')}</p>
        ${content}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  });

  // ====== 初始化 ======
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);
});
