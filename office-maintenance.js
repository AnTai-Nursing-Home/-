/** 2025-02 Final Upgrade Version (Part 1/2)
 *  ✅ 註解改 subcollection
 *  ✅ 與護理師端一致的留言UI
 *  ✅ 顯示「作者（角色）」＋最新留言在上
 *  ✅ 舊 comments array 仍顯示但不可刪除
 *  ✅ 保留所有功能：篩選/匯出/列印/狀態管理
 */
document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const statusFilterEl = document.getElementById("statusFilter");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const applyDateBtn = document.getElementById("applyDateBtn");
  const clearDateBtn = document.getElementById("clearDateBtn");
  const exportWordBtn = document.getElementById("exportWordBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const printBtn = document.getElementById("printBtn");

  const addRequestBtn = document.getElementById("addRequestBtn");
  const saveRequestBtn = document.getElementById("saveRequestBtn");
  const statusSelect = document.getElementById("statusSelect");
  const addModal = new bootstrap.Modal(document.getElementById("addRequestModal"));

  let statuses = [];
  let allRequests = [];
  let currentStatusFilter = "all";
  let currentStart = null;
  let currentEnd = null;

  // ===== Utilities =====
  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  async function loadStatuses() {
    const snap = await colStatus.orderBy("order","asc").get().catch(()=>colStatus.get());
    statuses = snap.docs.map(d => ({ id: d.id, name: d.id, ...d.data() }));

    // 重建 Filter / Status 下拉
    statusFilterEl.innerHTML = `<option value="all">全部</option>` +
      statuses.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
  }

  async function loadRequests() {
    showLoading();
    const snap = await colReq.orderBy("createdAt","desc").get().catch(()=> colReq.get());

    allRequests = await Promise.all(snap.docs.map(async doc => {
      const data = { id: doc.id, ...doc.data() };

      const cSnap = await colReq.doc(doc.id).collection("comments")
        .orderBy("time","desc").get();
      const subComments = cSnap.docs.map(c => ({ _cid: c.id, ...c.data() }));

      const legacy = Array.isArray(data.comments) ? data.comments : [];
      const legacyComments = legacy.map(lc => ({
        _cid: null,
        author: lc.author || "未紀錄",
        message: lc.message || "",
        role: lc.role || "admin",
        time: lc.time || null,
        _legacy: true
      }));

      data._comments = [...subComments, ...legacyComments];
      return data;
    }));

    renderRequests();
  }

  function inDateRange(ts) {
    if (!ts || !ts.toDate) return true;
    const d = ts.toDate();
    if (currentStart && d < currentStart) return false;
    if (currentEnd) {
      const e = new Date(currentEnd);
      e.setHours(23,59,59,999);
      if (d > e) return false;
    }
    return true;
  }

  function filterRequests() {
    return allRequests.filter(r => {
      const passS = currentStatusFilter==="all" || r.status === currentStatusFilter;
      const passD = (currentStart || currentEnd) ? inDateRange(r.createdAt) : true;
      return passS && passD;
    });
  }

  // ===== Render Table =====
  function renderRequests() {
    const rows = filterRequests();
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    rows.forEach(r => {
      const sColor = statuses.find(s => s.name === r.status)?.color || "#6c757d";

      const commentsHTML = r._comments.map(c => {
        const roleLabel = c.role==="nurse" ? "護理師" : "管理端";
        const canDelete = !c._legacy;
        return `
          <div class="border rounded p-2 mb-2">
            <strong>${c.author}（${roleLabel}）</strong><br>
            ${c.message}
            <div class="d-flex justify-content-between align-items-center small text-muted mt-1">
              <span>${fmt(c.time)}</span>
              ${
                canDelete
                ? `<button class="btn btn-sm btn-outline-danger delCommentBtn"
                    data-id="${r.id}" data-cid="${c._cid}">
                    🗑️
                  </button>`
                : ""
              }
            </div>
          </div>
        `;
      }).join("") || `<span class="text-muted">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.item||""}</td>
        <td>${r.detail||""}</td>
        <td>${r.reporter||""}</td>
        <td><span class="badge" style="background:${sColor}">${r.status}</span></td>
        <td>${fmt(r.createdAt)}</td>
        <td style="min-width:260px;">
          <div class="mb-2">
            <strong>註解：</strong>
            <div class="mt-1">${commentsHTML}</div>
          </div>

          <input type="text" class="form-control form-control-sm comment-author mb-1"
            placeholder="留言者名稱">
          <textarea class="form-control form-control-sm comment-input mb-1"
            placeholder="新增註解..."></textarea>
          <button class="btn btn-sm btn-primary btn-add-comment">新增註解</button>
        </td>
        <td class="text-end no-print">
          <button class="btn btn-sm btn-outline-danger" data-delreq="${r.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }); // end rows.forEach
  } // end renderRequests

  // ===== 事件綁定：新增註解（表格內輸入） =====
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-add-comment");
    if (!btn) return;

    const row = btn.closest("tr");
    const id = row.querySelector('[data-delreq]')?.dataset?.delreq || row.dataset?.id;
    if (!id) return alert("找不到報修單 ID");

    const author = row.querySelector(".comment-author")?.value.trim();
    const message = row.querySelector(".comment-input")?.value.trim();
    if (!author) return alert("請輸入留言者名稱");
    if (!message) return alert("請輸入註解內容");

    await colReq.doc(id).collection("comments").add({
      author,
      message,
      role: "admin",
      time: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // 清空欄位
    row.querySelector(".comment-author").value = "";
    row.querySelector(".comment-input").value = "";
    await loadRequests();
  });

  // ===== 事件綁定：刪除註解（僅 subcollection 可刪） =====
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delCommentBtn");
    if (!btn) return;
    const id = btn.dataset.id;
    const cid = btn.dataset.cid;
    if (!cid) return alert("這是舊資料（陣列），無法刪除");

    if (!confirm("確定要刪除此註解？")) return;
    await colReq.doc(id).collection("comments").doc(cid).delete();
    await loadRequests();
  });

  // ===== 事件綁定：刪除報修單（原功能保留） =====
  tbody.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-delreq]");
    if (!delBtn) return;
    const id = delBtn.dataset.delreq;
    if (!id) return;
    if (!confirm("確定要刪除此報修單？")) return;

    // 一併刪除該單底下所有 subcomments
    const cSnap = await colReq.doc(id).collection("comments").get();
    const batch = db.batch();
    cSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    await colReq.doc(id).delete();
    await loadRequests();
  });

  // ===== 篩選（原功能保留） =====
  statusFilterEl.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value || "all";
    renderRequests();
  });

  // ===== 日期區間（原功能保留） =====
  applyDateBtn?.addEventListener("click", () => {
    const s = startDateEl.value ? new Date(startDateEl.value) : null;
    const e = endDateEl.value ? new Date(endDateEl.value) : null;
    if (s && e && s > e) {
      alert("開始日期不可晚於結束日期");
      return;
    }
    currentStart = s;
    currentEnd = e;
    renderRequests();
  });

  clearDateBtn?.addEventListener("click", () => {
    startDateEl.value = "";
    endDateEl.value = "";
    currentStart = null;
    currentEnd = null;
    renderRequests();
  });

  // ===== 匯出/列印（原功能保留） =====
  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDateOnly(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function buildHeaderHTML() {
    let sub = "全部期間 報修總表";
    if (currentStart || currentEnd) {
      const s = currentStart ? fmtDateOnly(currentStart) : "起";
      const e = currentEnd ? fmtDateOnly(currentEnd) : "今";
      sub = `${s} 至 ${e} 報修總表`;
    }
    return `
      <div class="print-header" style="text-align:center;margin-bottom:12px;">
        <h1 style="font-size:20px;margin:0;font-weight:700;">安泰醫療社團法人附設安泰護理之家</h1>
        <h2 style="font-size:16px;margin:6px 0 12px;font-weight:600;">${sub}</h2>
      </div>`;
  }

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

    const trows = rows
      .map((r) => {
        const ts = r.createdAt?.toDate ? r.createdAt.toDate() : null;
        return `
        <tr>
          <td>${escapeHTML(r.item)}</td>
          <td>${escapeHTML(r.detail)}</td>
          <td>${escapeHTML(r.reporter)}</td>
          <td>${escapeHTML(r.status)}</td>
          <td>${ts ? fmt({ toDate: () => ts }) : ""}</td>
          <td>${escapeHTML(r.note)}</td>
        </tr>`;
      })
      .join("");

    return `
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse;">
        ${thead}
        <tbody>${trows}</tbody>
      </table>`;
  }

  function downloadURL(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 0);
  }

  function buildFileName(base, ext) {
    let range = "全部期間";
    if (currentStart || currentEnd) {
      const s = currentStart ? fmtDateOnly(currentStart) : "起";
      const e = currentEnd ? fmtDateOnly(currentEnd) : "今";
      range = `${s}至${e}`;
    }
    return `${base}_${range}.${ext}`;
  }

  exportWordBtn?.addEventListener("click", () => {
    const rows = filterRequests();
    const html = `
      <html><head><meta charset="UTF-8">
      <style>
        body{font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;}
        table{width:100%;border-collapse:collapse;}
        th,td{border:1px solid #000;padding:6px 8px;}
      </style></head>
      <body>${buildHeaderHTML()}${buildFormalTableHTML(rows)}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    downloadURL(url, buildFileName("報修總表", "doc"));
  });

  exportExcelBtn?.addEventListener("click", () => {
    const rows = filterRequests();
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body>${buildHeaderHTML()}${buildFormalTableHTML(rows)}</body>
      </html>`;
    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    downloadURL(url, buildFileName("報修總表", "xls"));
  });

  printBtn?.addEventListener("click", () => {
    const rows = filterRequests();
    const html = `
      <html><head><meta charset="UTF-8"><title>列印 - 報修總表</title>
      <style>
        @page{size:A4 landscape;margin:12mm;}
        body{font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;}
        table{width:100%;border-collapse:collapse;}
        th,td{border:1px solid #000;padding:6px 8px;}
        .print-header{text-align:center;margin-bottom:12px;}
        .print-header h1{font-size:20px;margin:0;font-weight:700;}
        .print-header h2{font-size:16px;margin:6px 0 12px;font-weight:600;}
      </style>
      </head>
      <body>
        ${buildHeaderHTML()}${buildFormalTableHTML(rows)}
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    w.document.open();
    w.document.write(html);
    w.document.close();
  });

  // ===== 新增報修單（原功能保留） =====
  addRequestBtn?.addEventListener("click", () => {
    document.getElementById("item").value = "";
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";
    document.getElementById("note").value = "";
    addModal.show();
  });

  saveRequestBtn?.addEventListener("click", async () => {
    const item = document.getElementById("item").value.trim();
    const detail = document.getElementById("detail").value.trim();
    const reporter = document.getElementById("reporter").value.trim();
    const status = statusSelect.value;
    const note = document.getElementById("note").value.trim();
    if (!item || !detail || !reporter) return alert("請輸入完整資料");

    await colReq.add({
      item,
      detail,
      reporter,
      status,
      note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      // 舊欄位保留（相容舊畫面，不再使用）
      comments: [],
    });

    addModal.hide();
    await loadRequests();
  });

  // ===== 初始化 =====
  await loadStatuses();
  await loadRequests();
});
