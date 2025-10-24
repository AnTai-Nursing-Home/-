document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  let statusList = [];
  let isLoading = false;
  let initialized = false;
  const currentUser = localStorage.getItem("username") || "管理員";

  // ===== 狀態清單載入 =====
  async function loadStatuses() {
    const snap = await statusCol.get();
    statusList = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      color: doc.data().color || "#6c757d"
    }));
  }

  // ===== 狀態徽章樣式 =====
  function getStatusStyle(statusName) {
    const found = statusList.find(s => s.name === statusName);
    if (!found) return `<span class="badge bg-secondary">${statusName || ""}</span>`;
    const bg = found.color;
    const rgb = parseInt(bg.replace("#", ""), 16);
    const brightness = ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000;
    const textColor = brightness > 140 ? "#000" : "#fff";
    return `<span class="badge" style="background:${bg};color:${textColor};">${found.name}</span>`;
  }

  // ===== 顯示註解欄位 =====
  function renderNoteCell(docId, note, updatedBy, updatedAt) {
    const updatedInfo = updatedAt
      ? `<div class="cell-meta">上次修改：${updatedBy || "—"} ${new Date(updatedAt.seconds * 1000).toLocaleString("zh-TW", { hour12: false })}</div>`
      : "";
    return `
      <div class="note-cell">
        <div contenteditable="true" class="editable-note" data-id="${docId}" data-original="${note || ""}">
          ${note || ""}
        </div>
        <button class="clear-note" data-id="${docId}">清除</button>
        ${updatedInfo}
      </div>
    `;
  }

  // ===== 顯示主管簽名欄位 =====
  function renderSupervisorCell(docId, sign, updatedBy, updatedAt) {
    const updatedInfo = updatedAt
      ? `<div class="cell-meta">上次修改：${updatedBy || "—"} ${new Date(updatedAt.seconds * 1000).toLocaleString("zh-TW", { hour12: false })}</div>`
      : "";
    return `
      <div class="sign-cell">
        <div contenteditable="true" class="editable-sign" data-id="${docId}" data-original="${sign || ""}">
          ${sign || ""}
        </div>
        <button class="clear-sign" data-id="${docId}">清除</button>
        ${updatedInfo}
      </div>
    `;
  }

  // ===== 載入請假 / 調班資料 =====
  async function loadRequests() {
    if (isLoading) return;
    isLoading = true;
    leaveBody.innerHTML = "";
    swapBody.innerHTML = "";

    const [leaveSnap, swapSnap] = await Promise.all([
      leaveCol.orderBy("applyDate", "desc").get(),
      swapCol.orderBy("applyDate", "desc").get()
    ]);

    leaveSnap.forEach(doc => {
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
        <td>${renderSupervisorCell(doc.id, d.supervisorSign, d.supervisorSignUpdatedBy, d.supervisorSignUpdatedAt)}</td>
        <td>${renderNoteCell(doc.id, d.note, d.noteUpdatedBy, d.noteUpdatedAt)}</td>
        <td><button class="btn btn-sm btn-outline-danger delete-btn" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
      `;
      leaveBody.appendChild(tr);
    });

    swapSnap.forEach(doc => {
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
        <td>${renderSupervisorCell(doc.id, d.supervisorSign, d.supervisorSignUpdatedBy, d.supervisorSignUpdatedAt)}</td>
        <td>${renderNoteCell(doc.id, d.note, d.noteUpdatedBy, d.noteUpdatedAt)}</td>
        <td><button class="btn btn-sm btn-outline-danger delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
      `;
      swapBody.appendChild(tr);
    });

    isLoading = false;
  }

  // ===== Firestore 更新函式 =====
  async function updateNote(collection, id, note) {
    await collection.doc(id).update({
      note,
      noteUpdatedBy: currentUser,
      noteUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    loadRequests();
  }

  async function updateSign(collection, id, sign) {
    await collection.doc(id).update({
      supervisorSign: sign,
      supervisorSignUpdatedBy: currentUser,
      supervisorSignUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    loadRequests();
  }

  // ===== 編輯防重機制 =====
  let editTimeout;
  function addEditListener(container, collection, selector, updater) {
    container.addEventListener("input", (e) => {
      if (e.target.classList.contains(selector)) {
        clearTimeout(editTimeout);
        editTimeout = setTimeout(() => {
          const id = e.target.dataset.id;
          const original = e.target.dataset.original || "";
          const newText = e.target.innerText.trim();
          if (newText !== original || newText === "") {
            e.target.dataset.original = newText;
            updater(collection, id, newText);
          }
        }, 800); // 停止輸入 0.8 秒後更新
      }
    });
  }

  addEditListener(leaveBody, leaveCol, "editable-note", updateNote);
  addEditListener(swapBody, swapCol, "editable-note", updateNote);
  addEditListener(leaveBody, leaveCol, "editable-sign", updateSign);
  addEditListener(swapBody, swapCol, "editable-sign", updateSign);

  // ===== 清除註解 / 簽名 =====
  function setupClearButtons(body, collection) {
    body.addEventListener("click", async (e) => {
      const noteBtn = e.target.closest(".clear-note");
      const signBtn = e.target.closest(".clear-sign");
      if (noteBtn) {
        const id = noteBtn.dataset.id;
        await collection.doc(id).update({
          note: "",
          noteUpdatedBy: currentUser,
          noteUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        loadRequests();
      }
      if (signBtn) {
        const id = signBtn.dataset.id;
        await collection.doc(id).update({
          supervisorSign: "",
          supervisorSignUpdatedBy: currentUser,
          supervisorSignUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        loadRequests();
      }
    });
  }

  setupClearButtons(leaveBody, leaveCol);
  setupClearButtons(swapBody, swapCol);

  // ===== 刪除 =====
  leaveBody.addEventListener("click", async (e) => {
    if (e.target.closest(".delete-btn")) {
      const id = e.target.closest(".delete-btn").dataset.id;
      if (confirm("確定刪除此請假資料？")) {
        await leaveCol.doc(id).delete();
        alert("✅ 已刪除");
        loadRequests();
      }
    }
  });

  swapBody.addEventListener("click", async (e) => {
    if (e.target.closest(".delete-swap")) {
      const id = e.target.closest(".delete-swap").dataset.id;
      if (confirm("確定刪除此調班資料？")) {
        await swapCol.doc(id).delete();
        alert("✅ 已刪除");
        loadRequests();
      }
    }
  });

  // ===== 匯出 Excel =====
  function exportTableToExcel(tableId, fileTitle) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");
    const wb = XLSX.utils.table_to_book(table, { sheet: "資料" });
    XLSX.writeFile(wb, `${fileTitle}.xlsx`);
  }

  // ===== 列印 =====
  function printSection(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        @page { size: landscape; }
        body { font-family:"Microsoft JhengHei";padding:20px; }
        h2,h4{text-align:center;margin:0;}
        table{border-collapse:collapse;width:100%;margin-top:20px;}
        th,td{border:1px solid #000;padding:6px;text-align:center;}
        .text-muted{color:#666;font-size:10px;}
      </style></head><body>
      <h2>安泰醫療社團法人附設安泰護理之家</h2>
      <h4>${title}</h4>
      ${table.outerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  document.getElementById("exportLeaveExcel")?.addEventListener("click", () =>
    exportTableToExcel("leaveTable", "安泰護理之家_請假總表")
  );
  document.getElementById("exportSwapExcel")?.addEventListener("click", () =>
    exportTableToExcel("swapTable", "安泰護理之家_調班總表")
  );
  document.getElementById("printLeave")?.addEventListener("click", () =>
    printSection("leaveTable", "請假總表")
  );
  document.getElementById("printSwap")?.addEventListener("click", () =>
    printSection("swapTable", "調班總表")
  );

  await loadStatuses();
  await loadRequests();

  leaveCol.onSnapshot(() => {
    if (initialized) loadRequests();
    initialized = true;
  });
  swapCol.onSnapshot(() => {
    if (initialized) loadRequests();
    initialized = true;
  });
});
