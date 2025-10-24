document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const leaveStatusFilter = document.getElementById("leaveStatusFilter");
  const swapStatusFilter = document.getElementById("swapStatusFilter");

  // 狀態設定相關元素
  const statusListEl = document.getElementById("statusList");
  const newStatusEl = document.getElementById("new-status");
  const newStatusColorEl = document.getElementById("new-status-color");
  const addStatusBtn = document.getElementById("btn-add-status");

  let statusList = [];
  let isLoading = false;
  let initialized = false;
  const currentUser = localStorage.getItem("username") || "管理員";

  // ===== 狀態清單載入 =====
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // UI顯示
    statusListEl.innerHTML = statusList.map(s => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <span class="badge me-2" style="background:${s.color || "#6c757d"}">${s.name}</span>
        </div>
        <button class="btn btn-sm btn-outline-danger del-status" data-id="${s.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </li>
    `).join("");

    // 狀態下拉篩選更新
    [leaveStatusFilter, swapStatusFilter].forEach(sel => {
      sel.innerHTML = `<option value="">全部狀態</option>` +
        statusList.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    });

    // 綁定刪除狀態
    statusListEl.querySelectorAll(".del-status").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (confirm(`確定刪除狀態「${id}」？`)) {
          await statusCol.doc(id).delete();
          await loadStatuses();
        }
      });
    });
  }

  // 新增狀態
  addStatusBtn.addEventListener("click", async () => {
    const name = newStatusEl.value.trim();
    const color = newStatusColorEl.value.trim() || "#6c757d";
    if (!name) return alert("請輸入狀態名稱");
    await statusCol.doc(name).set({ name, color });
    newStatusEl.value = "";
    newStatusColorEl.value = "#007bff";
    await loadStatuses();
  });

  // ===== 狀態徽章樣式 =====
  function getStatusBadge(statusName) {
    const found = statusList.find(s => s.name === statusName);
    return found
      ? `<span class="badge" style="background:${found.color};color:#fff;">${found.name}</span>`
      : `<span class="badge bg-secondary">${statusName || ""}</span>`;
  }

  // 狀態下拉 HTML
  function getStatusDropdown(current, docId, type) {
    return `
      <select class="form-select form-select-sm status-dropdown" data-id="${docId}" data-type="${type}">
        ${statusList.map(s => `
          <option value="${s.name}" ${s.name === current ? "selected" : ""} style="background:${s.color};color:#fff;">
            ${s.name}
          </option>`).join("")}
      </select>
    `;
  }

  // ===== 註解 / 簽名欄位 =====
  function renderEditableCell(docId, text, updatedBy, updatedAt, type) {
    const label = type === "sign" ? "editable-sign" : "editable-note";
    const clearLabel = type === "sign" ? "clear-sign" : "clear-note";
    const updatedInfo = updatedAt
      ? `<div class="cell-meta">上次修改：${updatedBy || "—"} ${new Date(updatedAt.seconds * 1000).toLocaleString("zh-TW", { hour12: false })}</div>`
      : "";
    return `
      <div class="${label}-cell">
        <div contenteditable="true" class="${label}" data-id="${docId}" data-original="${text || ""}">
          ${text || ""}
        </div>
        <button class="${clearLabel}" data-id="${docId}">清除</button>
        ${updatedInfo}
      </div>
    `;
  }

  // ===== 載入資料（可篩選） =====
  async function loadRequests() {
    if (isLoading) return;
    isLoading = true;
    leaveBody.innerHTML = "";
    swapBody.innerHTML = "";

    const [leaveSnap, swapSnap] = await Promise.all([
      leaveCol.orderBy("applyDate", "desc").get(),
      swapCol.orderBy("applyDate", "desc").get()
    ]);

    const leaveFilter = leaveStatusFilter.value || "";
    const swapFilter = swapStatusFilter.value || "";

    // 請假
    leaveSnap.forEach(doc => {
      const d = doc.data();
      if (leaveFilter && d.status !== leaveFilter) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>
          ${getStatusBadge(d.status)}<br>${getStatusDropdown(d.status, doc.id, "leave")}
        </td>
        <td>${renderEditableCell(doc.id, d.supervisorSign, d.supervisorSignUpdatedBy, d.supervisorSignUpdatedAt, "sign")}</td>
        <td>${renderEditableCell(doc.id, d.note, d.noteUpdatedBy, d.noteUpdatedAt, "note")}</td>
        <td><button class="btn btn-sm btn-outline-danger delete-btn" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
      `;
      leaveBody.appendChild(tr);
    });

    // 調班
    swapSnap.forEach(doc => {
      const d = doc.data();
      if (swapFilter && d.status !== swapFilter) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>
          ${getStatusBadge(d.status)}<br>${getStatusDropdown(d.status, doc.id, "swap")}
        </td>
        <td>${renderEditableCell(doc.id, d.supervisorSign, d.supervisorSignUpdatedBy, d.supervisorSignUpdatedAt, "sign")}</td>
        <td>${renderEditableCell(doc.id, d.note, d.noteUpdatedBy, d.noteUpdatedAt, "note")}</td>
        <td><button class="btn btn-sm btn-outline-danger delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
      `;
      swapBody.appendChild(tr);
    });

    // 狀態變更監聽
    document.querySelectorAll(".status-dropdown").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        const type = e.target.dataset.type;
        const targetCol = type === "leave" ? leaveCol : swapCol;
        await targetCol.doc(id).update({ status: newStatus });
        loadRequests();
      });
    });

    isLoading = false;
  }

  // ===== 篩選功能 =====
  document.getElementById("filterLeaveBtn")?.addEventListener("click", loadRequests);
  document.getElementById("resetLeaveFilterBtn")?.addEventListener("click", async () => {
    leaveStatusFilter.value = "";
    await loadRequests();
  });
  document.getElementById("filterSwapBtn")?.addEventListener("click", loadRequests);
  document.getElementById("resetSwapFilterBtn")?.addEventListener("click", async () => {
    swapStatusFilter.value = "";
    await loadRequests();
  });

  // ===== Firestore 更新函式 =====
  async function updateField(collection, id, field, value) {
    const updateObj = {};
    updateObj[field] = value;
    updateObj[`${field}UpdatedBy`] = currentUser;
    updateObj[`${field}UpdatedAt`] = firebase.firestore.FieldValue.serverTimestamp();
    await collection.doc(id).update(updateObj);
    loadRequests();
  }

  let editTimeout;
  function addEditListener(container, collection, selector, field) {
    container.addEventListener("input", (e) => {
      if (e.target.classList.contains(selector)) {
        clearTimeout(editTimeout);
        editTimeout = setTimeout(() => {
          const id = e.target.dataset.id;
          const newText = e.target.innerText.trim();
          updateField(collection, id, field, newText);
        }, 800);
      }
    });
  }

  addEditListener(leaveBody, leaveCol, "editable-note", "note");
  addEditListener(swapBody, swapCol, "editable-note", "note");
  addEditListener(leaveBody, leaveCol, "editable-sign", "supervisorSign");
  addEditListener(swapBody, swapCol, "editable-sign", "supervisorSign");

  // 清除按鈕
  function setupClearButtons(body, collection) {
    body.addEventListener("click", async (e) => {
      const clearNote = e.target.closest(".clear-note");
      const clearSign = e.target.closest(".clear-sign");
      if (clearNote) {
        const id = clearNote.dataset.id;
        await updateField(collection, id, "note", "");
      }
      if (clearSign) {
        const id = clearSign.dataset.id;
        await updateField(collection, id, "supervisorSign", "");
      }
    });
  }
  setupClearButtons(leaveBody, leaveCol);
  setupClearButtons(swapBody, swapCol);

  // ===== 列印（正式格式） =====
  function printSection(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");
    const now = new Date().toLocaleString("zh-TW", { hour12: false });
    const cleanTable = table.cloneNode(true);
    cleanTable.querySelectorAll("button, .status-dropdown, .cell-meta").forEach(el => el.remove());

    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family:"Microsoft JhengHei"; padding:20px; color:#000; }
        h2,h4{text-align:center;margin:0;}
        .header-info { text-align:right; font-size:12px; margin-bottom:10px; }
        table { border-collapse: collapse; width:100%; margin-top:10px; }
        th,td { border:1px solid #000; padding:6px 8px; text-align:center; }
      </style></head><body>
      <h2>安泰醫療社團法人附設安泰護理之家</h2>
      <h4>${title}</h4>
      <div class="header-info">列印日期：${now}</div>
      ${cleanTable.outerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  document.getElementById("printLeave")?.addEventListener("click", () =>
    printSection("leaveTable", "請假總表")
  );
  document.getElementById("printSwap")?.addEventListener("click", () =>
    printSection("swapTable", "調班總表")
  );

  // 匯出 Excel
  function exportTableToExcel(tableId, fileTitle) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");
    const wb = XLSX.utils.table_to_book(table, { sheet: "資料" });
    XLSX.writeFile(wb, `${fileTitle}.xlsx`);
  }
  document.getElementById("exportLeaveExcel")?.addEventListener("click", () =>
    exportTableToExcel("leaveTable", "安泰護理之家_請假總表")
  );
  document.getElementById("exportSwapExcel")?.addEventListener("click", () =>
    exportTableToExcel("swapTable", "安泰護理之家_調班總表")
  );

  // ===== 初始化 =====
  await loadStatuses();
  await loadRequests();

  leaveCol.onSnapshot(() => { if (initialized) loadRequests(); initialized = true; });
  swapCol.onSnapshot(() => { if (initialized) loadRequests(); initialized = true; });
  statusCol.onSnapshot(() => loadStatuses());
});
