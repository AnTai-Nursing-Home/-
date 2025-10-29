/** 
 * office-maintenance.js
 * Final Stable Integrated Version (Editable Status + Subcollection Comments)
 * 
 * 功能總覽：
 * - 狀態：以 <select> 直接編輯，變更即寫回 Firestore
 * - 註解：使用 subcollection（新增 / 編輯(僅 admin) / 刪除）；舊 comments[] 只顯示不可動
 * - 新增/刪除報修單、狀態篩選、日期篩選、匯出 Word/Excel、列印
 * - 與護理師端一致的註解結構；UI 排版不動你原本的表格與欄位
 *
 * 需要的 HTML 元素 ID：
 * - maintenanceTableBody
 * - statusFilter, startDate, endDate, applyDateBtn, clearDateBtn
 * - exportWordBtn, exportExcelBtn, printBtn
 * - addRequestBtn, saveRequestBtn, statusSelect, addRequestModal
 * - 新增報修單 Modal 欄位：item, detail, reporter, note
 *
 * 資料結構：
 * - maintenance_requests/{id}
 *    - fields: item, detail, reporter, status, note, createdAt, comments (legacy array)
 *    - subcollection: comments/{commentId} => { author, message, role("admin"/"nurse"), time(Timestamp) }
 *
 * 注意：
 * - 舊 comments 陣列：顯示但不可編輯/刪除（避免一次誤刪整串）
 * - 可選的升級（稍後）：
 *    1) 狀態變更自動寫入一則系統留言（誰在何時把狀態變為 X）
 *    2) 下拉狀態同步顯示顏色
 *    3) 一鍵搬移所有舊 comments[] → subcollection
 */

document.addEventListener("firebase-ready", async () => {
  // ===== Firestore references =====
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  // ===== DOM =====
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
  const statusSelect = document.getElementById("statusSelect"); // 新增報修單 modal 裡的狀態下拉
  const addModalEl = document.getElementById("addRequestModal");
  const addModal = addModalEl ? new bootstrap.Modal(addModalEl) : null;

  // ===== State =====
  let statuses = []; // [{ id, name, color, order }]
  let allRequests = []; // 每筆 request 內含 _comments (subcollection + legacy array)
  let currentStatusFilter = "all";
  let currentStart = null;
  let currentEnd = null;

  // ===== Utils =====
  const pad = (n) => String(n).padStart(2, "0");
  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function fmt(ts) {
    // Firestore Timestamp-like: { toDate: Function }
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDateOnly(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function showLoadingRow() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== Load statuses =====
  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
    statuses = snap.docs.map((d) => ({ id: d.id, name: d.id, ...d.data() }));

    // 重建篩選器
    if (statusFilterEl) {
      statusFilterEl.innerHTML =
        `<option value="all">全部</option>` +
        statuses.map((s) => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join("");
    }

    // 新增報修單 modal 裡的狀態選擇（若存在）
    if (statusSelect) {
      statusSelect.innerHTML = statuses
        .map((s) => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`)
        .join("");
    }
  }

  // ===== Load requests + comments =====
  async function loadRequests() {
    showLoadingRow();
    const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());

    allRequests = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };

        // subcollection comments（最新在上）
        const cSnap = await colReq.doc(doc.id).collection("comments").orderBy("time", "desc").get();
        const subComments = cSnap.docs.map((c) => ({ _cid: c.id, ...c.data() }));

        // legacy comments array（只顯示不可編輯/刪除）
        const legacy = Array.isArray(data.comments) ? data.comments : [];
        const legacyComments = legacy.map((lc) => ({
          _cid: null,
          author: lc.author || lc.authorName || "未紀錄",
          message: lc.message || "",
          role: lc.role || "admin",
          time: lc.time || null,
          _legacy: true
        }));

        data._comments = [...subComments, ...legacyComments];
        return data;
      })
    );

    renderRequests();
  }

  // ===== Filters =====
  function inDateRange(ts) {
    if (!ts?.toDate) return true;
    const d = ts.toDate();
    if (currentStart && d < currentStart) return false;
    if (currentEnd) {
      const end = new Date(
        currentEnd.getFullYear(),
        currentEnd.getMonth(),
        currentEnd.getDate(),
        23, 59, 59, 999
      );
      if (d > end) return false;
    }
    return true;
  }

  function getFilteredRequests() {
    return allRequests.filter((r) => {
      const passS = currentStatusFilter === "all" || r.status === currentStatusFilter;
      const passD = (currentStart || currentEnd) ? inDateRange(r.createdAt) : true;
      return passS && passD;
    });
  }

  // ===== Comment block renderer =====
  function renderCommentBlock(reqId, c) {
    const roleLabel = c.role === "nurse" ? "護理師" : "管理端";
    const canEdit = !c._legacy && c.role === "admin"; // 只有 admin 的 subcomment 可編輯
    const canDelete = !c._legacy;                      // subcomment 都可刪（含 nurse）

    return `
      <div class="border rounded p-2 mb-2">
        <div><strong>${escapeHTML(c.author)}（${roleLabel}）</strong></div>
        <div class="comment-text mt-1">${escapeHTML(c.message)}</div>

        <div class="d-flex justify-content-between align-items-center mt-1">
          <time class="text-muted small">${fmt(c.time)}</time>
          <div class="btn-group btn-group-sm" role="group">
            ${canEdit ? `
              <button class="btn btn-outline-primary editCommentBtn"
                title="編輯" data-id="${reqId}" data-cid="${c._cid}" data-msg="${escapeHTML(c.message)}">
                ✏️
              </button>` : ``}
            ${canDelete ? `
              <button class="btn btn-outline-danger delCommentBtn"
                title="刪除" data-id="${reqId}" data-cid="${c._cid}">
                🗑️
              </button>` : ``}
          </div>
        </div>
      </div>
    `;
  }

  // ===== Table renderer =====
  function renderRequests() {
    const rows = getFilteredRequests();
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    rows.forEach((r) => {
      const statusColor = statuses.find((s) => s.name === r.status)?.color || "#6c757d";
      const commentsHTML = (r._comments || []).map((c) => renderCommentBlock(r.id, c)).join("") || `<span class="text-muted">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(r.item || "")}</td>
        <td>${escapeHTML(r.detail || "")}</td>
        <td>${escapeHTML(r.reporter || "")}</td>
        <td>
          <select class="form-select form-select-sm statusSelectCell">
            ${statuses.map((s) => `
              <option value="${escapeHTML(s.name)}" ${s.name === r.status ? "selected" : ""}>
                ${escapeHTML(s.name)}
              </option>
            `).join("")}
          </select>
        </td>
        <td>${fmt(r.createdAt)}</td>
        <td style="min-width:260px;">
          <div class="mb-2">
            <strong>註解：</strong>
            <div class="mt-1">${commentsHTML}</div>
          </div>

          <!-- 辦公室端：表格內新增註解 -->
          <input type="text" class="form-control form-control-sm comment-author mb-1" placeholder="留言者名稱">
          <textarea class="form-control form-control-sm comment-input mb-1" placeholder="新增註解..."></textarea>
          <button class="btn btn-sm btn-primary btn-add-comment">新增註解</button>
        </td>
        <td class="text-end no-print">
          <button class="btn btn-sm btn-outline-danger" title="刪除報修單" data-delreq="${r.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== Event: change status =====
  tbody.addEventListener("change", async (e) => {
    const select = e.target.closest(".statusSelectCell");
    if (!select) return;

    const row = select.closest("tr");
    const id = row.querySelector("[data-delreq]")?.dataset?.delreq || row.dataset?.id;
    if (!id) return alert("找不到報修單 ID");

    const newStatus = select.value;
    await colReq.doc(id).update({ status: newStatus });
    await loadRequests();
  });

  // ===== Comments: add =====
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-add-comment");
    if (!btn) return;

    const row = btn.closest("tr");
    const id = row.querySelector("[data-delreq]")?.dataset?.delreq || row.dataset?.id;
    if (!id) return alert("找不到報修單 ID");

    const authorEl = row.querySelector(".comment-author");
    const inputEl = row.querySelector(".comment-input");
    const author = authorEl?.value.trim();
    const message = inputEl?.value.trim();
    if (!author) return alert("請輸入留言者名稱");
    if (!message) return alert("請輸入註解內容");

    await colReq.doc(id).collection("comments").add({
      author,
      message,
      role: "admin",
      time: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (authorEl) authorEl.value = "";
    if (inputEl) inputEl.value = "";
    await loadRequests();
  });

  // ===== Comments: edit (admin-only subcomments) =====
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".editCommentBtn");
    if (!btn) return;

    const id = btn.dataset.id;
    const cid = btn.dataset.cid;
    const oldMsgEscaped = btn.dataset.msg || "";
    const container = btn.closest(".border"); // 每一則留言外框
    if (!container) return;

    const oldHTML = container.innerHTML;
    const decode = (s) =>
      s.replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');

    const oldMsg = decode(oldMsgEscaped);
    container.innerHTML = `
      <div><strong>編輯留言（管理端）</strong></div>
      <textarea class="form-control form-control-sm mt-2 editMessageBox" rows="3">${escapeHTML(oldMsg)}</textarea>
      <div class="mt-2">
        <button class="btn btn-sm btn-success saveEditBtn">💾 儲存</button>
        <button class="btn btn-sm btn-secondary cancelEditBtn">取消</button>
      </div>
    `;

    // 存檔
    container.querySelector(".saveEditBtn").addEventListener("click", async () => {
      const newText = container.querySelector(".editMessageBox")?.value.trim();
      if (!newText) return alert("內容不可為空白");
      await colReq.doc(id).collection("comments").doc(cid).update({ message: newText });
      await loadRequests();
    });

    // 取消
    container.querySelector(".cancelEditBtn").addEventListener("click", () => {
      container.innerHTML = oldHTML;
    });
  });

  // ===== Comments: delete (subcomments only) =====
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delCommentBtn");
    if (!btn) return;

    const id = btn.dataset.id;
    const cid = btn.dataset.cid;
    if (!cid) return alert("這是舊資料（陣列 comments[]），無法刪除");

    if (!confirm("確定要刪除此註解？")) return;
    await colReq.doc(id).collection("comments").doc(cid).delete();
    await loadRequests();
  });

  // ===== Delete request (and its subcomments) =====
  tbody.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-delreq]");
    if (!delBtn) return;

    const id = delBtn.dataset.delreq;
    if (!id) return;

    if (!confirm("確定要刪除此報修單？\n（將同時刪除此單的所有子留言）")) return;

    // 先刪 subcomments
    const cSnap = await colReq.doc(id).collection("comments").get();
    const batch = db.batch();
    cSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // 再刪主文件
    await colReq.doc(id).delete();
    await loadRequests();
  });

  // ===== Filters: status =====
  statusFilterEl?.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value || "all";
    renderRequests();
  });

  // ===== Filters: dates =====
  applyDateBtn?.addEventListener("click", () => {
    const s = startDateEl?.value ? new Date(startDateEl.value) : null;
    const e = endDateEl?.value ? new Date(endDateEl.value) : null;

    if (s && e && s > e) {
      alert("開始日期不可晚於結束日期");
      return;
    }
    currentStart = s;
    currentEnd = e;
    renderRequests();
  });

  clearDateBtn?.addEventListener("click", () => {
    if (startDateEl) startDateEl.value = "";
    if (endDateEl) endDateEl.value = "";
    currentStart = null;
    currentEnd = null;
    renderRequests();
  });

  // ===== Export & Print =====
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
          <td>${escapeHTML(r.note || "")}</td>
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
    const rows = getFilteredRequests();
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
    const rows = getFilteredRequests();
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
    const rows = getFilteredRequests();
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

  // ===== Add new request (modal) =====
  addRequestBtn?.addEventListener("click", () => {
    const item = document.getElementById("item");
    const detail = document.getElementById("detail");
    const reporter = document.getElementById("reporter");
    const note = document.getElementById("note");
    if (item) item.value = "";
    if (detail) detail.value = "";
    if (reporter) reporter.value = "";
    if (note) note.value = "";
    addModal?.show();
  });

  saveRequestBtn?.addEventListener("click", async () => {
    const item = document.getElementById("item")?.value.trim();
    const detail = document.getElementById("detail")?.value.trim();
    const reporter = document.getElementById("reporter")?.value.trim();
    const statusVal = statusSelect?.value || "待處理";
    const note = document.getElementById("note")?.value.trim() || "";

    if (!item || !detail || !reporter) return alert("請輸入完整資料");

    await colReq.add({
      item,
      detail,
      reporter,
      status: statusVal,
      note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      // 保留舊欄位（相容舊畫面；不再使用）
      comments: []
    });

    addModal?.hide();
    await loadRequests();
  });

  // ===== Init =====
  await loadStatuses();
  await loadRequests();
});
