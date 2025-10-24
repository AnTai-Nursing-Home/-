document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const addStatusBtn = document.getElementById("btn-add-status");
  const newStatusEl = document.getElementById("new-status");
  const newStatusColorEl = document.getElementById("new-status-color");
  const statusListEl = document.getElementById("statusList");
  const addRequestBtn = document.getElementById("addRequestBtn");
  const saveRequestBtn = document.getElementById("saveRequestBtn");
  const statusSelect = document.getElementById("statusSelect");
  const addModal = new bootstrap.Modal(document.getElementById("addRequestModal"));

  // 新增：日期/匯出/列印/狀態篩選控制元件
  const statusFilterEl = document.getElementById("statusFilter");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const applyDateBtn = document.getElementById("applyDateBtn");
  const clearDateBtn = document.getElementById("clearDateBtn");
  const exportWordBtn = document.getElementById("exportWordBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const printBtn = document.getElementById("printBtn");

  let statuses = [];
  let allRequests = [];
  let currentStatusFilter = "all";
  let currentStart = null; // Date or null
  let currentEnd = null;   // Date or null

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDateOnly(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtYearMonth(d) {
    const m = d.getMonth() + 1;
    return `${d.getFullYear()}年${m.toString().padStart(2, "0")}月`;
  }

  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
    statuses = snap.docs.map(d => ({ id: d.id, name: d.id, ...d.data() }));

    if (statuses.length === 0) {
      const batch = db.batch();
      [["待處理", 0, "#6c757d"], ["維修中", 1, "#ffc107"], ["已完成", 2, "#28a745"]]
        .forEach(([name, order, color]) => batch.set(colStatus.doc(name), { order, color }));
      await batch.commit();
      return loadStatuses();
    }

    // 狀態清單
    statusListEl.innerHTML = statuses.map((s) => `
      <li class="list-group-item d-flex justify-content-between align-items-center" data-id="${s.id}">
        <div>
          <span class="badge me-2 mb-0" style="background:${s.color || "#6c757d"};color:#fff;">${s.name}</span>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-danger btn-del-status" data-id="${s.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </li>
    `).join("");

    // 新增報修用狀態選單
    statusSelect.innerHTML = statuses.map(s => `
      <option value="${s.name}" style="background:${s.color || "#6c757d"};color:#fff;">${s.name}</option>
    `).join("");

    // 篩選下拉選單（先清空再置入）
    statusFilterEl.innerHTML = `<option value="all">全部</option>` + statuses.map(s => `<option value="${s.name}">${s.name}</option>`).join("");

    // 綁定刪除狀態
    document.querySelectorAll(".btn-del-status").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm(`確定刪除狀態「${id}」嗎？`)) return;
        await colStatus.doc(id).delete();
        await loadStatuses();
        await loadRequests();
      });
    });
  }

  function inDateRange(ts) {
    if (!ts || !ts.toDate) return false;
    const d = ts.toDate();
    if (currentStart && d < currentStart) return false;
    if (currentEnd) {
      // 讓結束日為當天 23:59:59
      const end = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate(), 23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  }

  function getFilteredRequests() {
    return allRequests.filter(r => {
      const passStatus = (currentStatusFilter === "all") ? true : (r.status === currentStatusFilter);
      const passDate = currentStart || currentEnd ? inDateRange(r.createdAt) : true;
      return passStatus && passDate;
    });
  }

  function renderRequests() {
    const filtered = getFilteredRequests();
    tbody.innerHTML = "";
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    filtered.forEach(d => {
      const color = statuses.find(s => s.name === d.status)?.color || "#6c757d";
      const options = statuses.map(
        s => `<option value="${s.name}" ${s.name === d.status ? "selected" : ""} style="background:${s.color};color:#fff;">${s.name}</option>`
      ).join("");

      const commentsHtml = (d.comments || []).map((c, i) => `
        <div class="comment border rounded p-2 mb-2">
          <div>${c.message || ""}</div>
          <time>${fmt(c.time)}</time>
          <div class="text-end mt-1 no-print">
            <button class="btn btn-sm btn-outline-secondary me-1 editCommentBtn" data-id="${d.id}" data-idx="${i}">✏️</button>
            <button class="btn btn-sm btn-outline-danger delCommentBtn" data-id="${d.id}" data-idx="${i}">🗑️</button>
          </div>
        </div>
      `).join("") || `<span class="text-muted">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.item || ""}</td>
        <td>${d.detail || ""}</td>
        <td>${d.reporter || ""}</td>
        <td>
          <span class="badge text-white mb-1" style="background:${color};">${d.status || "—"}</span>
          <select class="form-select form-select-sm status-pill no-print" data-id="${d.id}">${options}</select>
        </td>
        <td>${fmt(d.createdAt)}</td>
        <td style="min-width:240px;">${commentsHtml}${d.note ? `<div class="mt-2 border rounded p-2 bg-light">${d.note}</div>` : ""}</td>
        <td class="text-end no-print">
          <button class="btn btn-sm btn-primary" data-comment="${d.id}">
            <i class="fa-solid fa-message"></i> 新增註解
          </button>
          <button class="btn btn-sm btn-outline-danger ms-1" data-delreq="${d.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 綁定狀態變更 -> 寫回 Firestore 並重繪
    tbody.querySelectorAll(".status-pill").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        await colReq.doc(id).update({ status: newStatus });
        await loadRequests(); // 重新載入以套用顏色/篩選
      });
    });
  }

  async function loadRequests() {
    showLoading();
    const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
    allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRequests();
  }

  // 新增狀態
  addStatusBtn.addEventListener("click", async () => {
    const name = newStatusEl.value.trim();
    const color = newStatusColorEl.value.trim() || "#6c757d";
    if (!name) return alert("請輸入狀態名稱");

    let max = -1;
    const snap = await colStatus.get();
    snap.forEach(d => (max = Math.max(max, d.data().order ?? -1)));

    await colStatus.doc(name).set({ order: max + 1, color });
    newStatusEl.value = ""; newStatusColorEl.value = "#007bff";
    await loadStatuses();
  });

  // 新增報修單
  addRequestBtn.addEventListener("click", () => {
    document.getElementById("item").value = "";
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";
    document.getElementById("note").value = "";
    addModal.show();
  });

  saveRequestBtn.addEventListener("click", async () => {
    const item = document.getElementById("item").value.trim();
    const detail = document.getElementById("detail").value.trim();
    const reporter = document.getElementById("reporter").value.trim();
    const status = statusSelect.value;
    const note = document.getElementById("note").value.trim();
    if (!item || !detail || !reporter) return alert("請輸入完整資料");

    await colReq.add({
      item, detail, reporter, status, note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      comments: []
    });

    addModal.hide();
    await loadRequests();
  });

  // 狀態篩選變更
  statusFilterEl.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value || "all";
    renderRequests();
  });

  // 日期區間套用/清除
  applyDateBtn.addEventListener("click", () => {
    const s = startDateEl.value ? new Date(startDateEl.value) : null;
    const e = endDateEl.value ? new Date(endDateEl.value) : null;
    if (s && e && s > e) {
      alert("開始日期不可晚於結束日期");
      return;
    }
    currentStart = s; currentEnd = e;
    renderRequests();
  });

  clearDateBtn.addEventListener("click", () => {
    startDateEl.value = ""; endDateEl.value = "";
    currentStart = null; currentEnd = null;
    renderRequests();
  });

  // ===== 匯出/列印：共用產生正式表格 HTML（僅保留必要欄位，純文字） =====
  function buildFormalTableHTML(rows) {
    const thead = `
      <thead>
        <tr>
          <th>報修物品</th>
          <th>詳細資訊</th>
          <th>報修人</th>
          <th>狀態</th>
          <th>報修時間</th>
          <th>備註</th>
        </tr>
      </thead>`;
    const trows = rows.map(r => {
      const ts = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : null;
      return `<tr>
        <td>${escapeHTML(r.item || "")}</td>
        <td>${escapeHTML(r.detail || "")}</td>
        <td>${escapeHTML(r.reporter || "")}</td>
        <td>${escapeHTML(r.status || "")}</td>
        <td>${ts ? fmt(tsToFs(ts)) : ""}</td>
        <td>${escapeHTML(r.note || "")}</td>
      </tr>`;
    }).join("");

    return `<table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse;">
      ${thead}
      <tbody>${trows}</tbody>
    </table>`;
  }
  // 修正：fmt 需要 firestore Timestamp；這裡把 Date 包成同格式物件
  function tsToFs(d) { return { toDate: () => d }; }

  function escapeHTML(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function buildHeaderHTML() {
    // 副標用「YYYY年MM月 到 YYYY年MM月 報修總表」
    let sub = "全部期間 報修總表";
    if (currentStart || currentEnd) {
      const s = currentStart ? fmtYearMonth(currentStart) : "起";
      const e = currentEnd ? fmtYearMonth(currentEnd) : "今";
      sub = `${s} 到 ${e} 報修總表`;
    }
    return `
      <div class="print-header">
        <h1>安泰醫療社團法人附設安泰護理之家</h1>
        <h2>${sub}</h2>
      </div>
    `;
  }

  // ===== 匯出 Word（.doc，使用 HTML 包裝） =====
  exportWordBtn.addEventListener("click", () => {
    const rows = getFilteredRequests();
    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;}
          .print-header{text-align:center; margin-bottom:12px;}
          .print-header h1{font-size:20px;margin:0;font-weight:700;}
          .print-header h2{font-size:16px;margin:6px 0 12px;font-weight:600;}
          table{width:100%;border-collapse:collapse;}
          th,td{border:1px solid #000;padding:6px 8px;}
        </style>
      </head>
      <body>
        ${buildHeaderHTML()}
        ${buildFormalTableHTML(rows)}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    downloadURL(url, buildFileName("報修總表", "doc"));
  });

  // ===== 匯出 Excel（.xls，HTML Table 可相容開啟） =====
  exportExcelBtn.addEventListener("click", () => {
    const rows = getFilteredRequests();
    const tableHTML = buildFormalTableHTML(rows).replace(/"/g, '\"');
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>${buildHeaderHTML()}${tableHTML}</body></nhtml>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    downloadURL(url, buildFileName("報修總表", "xls"));
  });

  // ===== 列印（新視窗、橫向） =====
  printBtn.addEventListener("click", () => {
    const rows = getFilteredRequests();
    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>列印 - 報修總表</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body{font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;}
          .print-header{text-align:center; margin-bottom:12px;}
          .print-header h1{font-size:20px;margin:0;font-weight:700;}
          .print-header h2{font-size:16px;margin:6px 0 12px;font-weight:600;}
          table{width:100%;border-collapse:collapse;}
          th,td{border:1px solid #000;padding:6px 8px;}
        </style>
      </head>
      <body>
        ${buildHeaderHTML()}
        ${buildFormalTableHTML(rows)}
        <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 300); }<\/script>
      </body>
      </html>
    `;
    const w = window.open("", "_blank");
    w.document.open(); w.document.write(html); w.document.close();
  });

  function downloadURL(url, filename) {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 0);
  }
  function buildFileName(base, ext) {
    // 依區間組檔名
    let range = "全部期間";
    if (currentStart || currentEnd) {
      const s = currentStart ? fmtDateOnly(currentStart) : "起";
      const e = currentEnd ? fmtDateOnly(currentEnd) : "今";
      range = `${s}至${e}`;
    }
    return `${base}_${range}.${ext}`;
  }

  // 初始化
  await loadStatuses();
  await loadRequests();
});
