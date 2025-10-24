document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const statusListBody = document.getElementById("statusListBody");

  let statusList = [];

  // ===== 狀態清單載入 =====
  async function loadStatuses() {
    const snap = await statusCol.get();
    statusList = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      color: doc.data().color || "#6c757d"
    }));
    console.log("✅ 狀態清單載入完成：", statusList);
    renderStatusTable();
  }

  // ===== 顯示狀態列表 =====
  function renderStatusTable() {
    if (!statusListBody) return;
    statusListBody.innerHTML = "";
    statusList.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name}</td>
        <td><span class="badge" style="background:${s.color};">${s.color}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-danger delete-status" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      statusListBody.appendChild(tr);
    });
  }

  // ===== 新增狀態 =====
  const addStatusForm = document.getElementById("addStatusForm");
  if (addStatusForm) {
    addStatusForm.addEventListener("submit", async e => {
      e.preventDefault();
      const name = e.target.statusName.value.trim();
      const color = e.target.statusColor.value.trim();
      if (!name) return alert("請輸入狀態名稱");
      await statusCol.add({ name, color });
      alert("✅ 狀態已新增");
      e.target.reset();
      loadStatuses();
    });
  }

  // ===== 刪除狀態 =====
  if (statusListBody) {
    statusListBody.addEventListener("click", async e => {
      if (e.target.closest(".delete-status")) {
        const id = e.target.closest(".delete-status").dataset.id;
        if (confirm("確定要刪除此狀態嗎？")) {
          await statusCol.doc(id).delete();
          alert("🗑️ 已刪除");
          loadStatuses();
        }
      }
    });
  }

  // ===== 狀態徽章樣式 =====
  function getStatusStyle(statusName) {
    const found = statusList.find(s => s.name === statusName);
    if (!found) return `<span class="badge bg-secondary">${statusName || ""}</span>`;
    const bg = found.color;
    const rgb = parseInt(bg.replace("#", ""), 16);
    const brightness =
      ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000;
    const textColor = brightness > 140 ? "#000" : "#fff";
    return `<span class="badge" style="background:${bg};color:${textColor};">${found.name}</span>`;
  }

  // ===== 請假/調班資料載入 =====
  async function loadRequests() {
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
        <td>${d.supervisorSign || ""}</td>
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
        <td>${d.supervisorSign || ""}</td>
      `;
      swapBody.appendChild(tr);
    });
  }

  // ===== 匯出 Excel（含日期區間） =====
  function exportTableToExcel(tableId, fileTitle, startDate, endDate) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");

    const wb = XLSX.utils.table_to_book(table, { sheet: "資料" });
    const fileName = `${fileTitle}_${startDate || "起"}至${endDate || "今"}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ===== 列印功能（正式橫式） =====
  function printSection(tableId, title, startDate, endDate) {
    const table = document.getElementById(tableId);
    if (!table) return alert("找不到表格");

    const printWindow = window.open("", "_blank");
    const style = `
      <style>
        @page { size: landscape; }
        body { font-family: "Microsoft JhengHei", sans-serif; padding: 20px; }
        h2, h4 { text-align:center; margin:0; }
        table { border-collapse: collapse; width: 100%; margin-top:20px; }
        th, td { border: 1px solid #000; padding: 6px; text-align:center; }
      </style>
    `;
    const subtitle = `${startDate || ""} 至 ${endDate || ""} ${title}`;
    const html = `
      <html>
        <head><title>${title}</title>${style}</head>
        <body>
          <h2>安泰醫療社團法人附設安泰護理之家</h2>
          <h4>${subtitle}</h4>
          ${table.outerHTML}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  // ===== 綁定匯出與列印按鈕 =====
  document.getElementById("exportLeaveExcel")?.addEventListener("click", () => {
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    exportTableToExcel("leaveTable", "安泰護理之家_請假總表", start, end);
  });

  document.getElementById("exportSwapExcel")?.addEventListener("click", () => {
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    exportTableToExcel("swapTable", "安泰護理之家_調班總表", start, end);
  });

  document.getElementById("printLeave")?.addEventListener("click", () => {
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    printSection("leaveTable", "請假總表", start, end);
  });

  document.getElementById("printSwap")?.addEventListener("click", () => {
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    printSection("swapTable", "調班總表", start, end);
  });

  // ===== 初始化 =====
  await loadStatuses();
  await loadRequests();

  // 即時同步
  leaveCol.onSnapshot(() => loadRequests());
  swapCol.onSnapshot(() => loadRequests());
  statusCol.onSnapshot(() => loadStatuses());
});
