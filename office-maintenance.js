/**
 * office-maintenance.js
 * Integrated Admin (Top "Status Management" + Bottom "Maintenance Management")
 * Version: 2025-10-29
 *
 * ✅ 頂部「狀態管理」：新增、改名、改色、刪除、拖曳排序（Firestore: maintenance_status）
 * ✅ 報修管理（辦公室端）：
 *    - 狀態 <select> 直接修改（寫回 Firestore maintenance_requests.status）
 *    - 狀態變更自動新增「系統留言」（使用 localStorage.adminName）
 *    - 註解：subcollection 新增 / 編輯(僅 admin) / 刪除；舊 comments[] 只顯示不可動
 *    - 篩選（狀態 / 日期）、列印、匯出 Word/Excel、刪除報修單（含刪子註解）
 *
 * 需求的 DOM（若不存在會自動安全略過）：
 *  - 狀態管理頂部區塊：
 *      #newStatusName, #newStatusColor, #addStatusBtn, #statusList   （拖曳把手 class: .drag-handle）
 *  - 報修管理表格與工具列：
 *      #maintenanceTableBody, #statusFilter, #startDate, #endDate, #applyDateBtn, #clearDateBtn
 *      #exportWordBtn, #exportExcelBtn, #printBtn
 *      #addRequestBtn, #saveRequestBtn, #statusSelect, #addRequestModal（modal 欄位: #item, #detail, #reporter, #note）
 *
 * Firestore 結構：
 *  - maintenance_status/{docId = 狀態名稱} => { color: "#xxxxxx", order: number }
 *  - maintenance_requests/{id} => { item, detail, reporter, status, note, createdAt, comments: [](legacy) }
 *      - subcollection comments/{commentId} => { author, message, role("admin"/"nurse"), time(Timestamp) }
 *
 * 備註：
 *  - 行為紀錄（狀態變更留言）使用 localStorage.getItem("adminName")，若無則顯示「管理端」
 *  - 拖曳排序使用 SortableJS（若頁面未載入外掛，也能優雅略過拖曳功能）
 */

(function () {
  // ------- 安全檢查：Firebase Ready（專案初始化完成後再跑） -------
  // 若你專案會派發 custom event "firebase-ready"，可改成 document.addEventListener('firebase-ready', init)
  if (window.firebase?.apps?.length) {
    init();
  } else {
    document.addEventListener("firebase-ready", init);
  }

  async function init() {
    // ---------- Firestore ----------
    const db = firebase.firestore();
    const colStatus = db.collection("maintenance_status");
    const colReq = db.collection("maintenance_requests");

    // ---------- 通用工具 ----------
    const pad = (n) => String(n).padStart(2, "0");
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const fmtTS = (ts) => {
      if (!ts || !ts.toDate) return "";
      const d = ts.toDate();
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    };
    const fmtDateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // =========================================================
    // =============== [A] 頂部：狀態管理 模組 ==================
    // =========================================================
    const $statusName = document.getElementById("newStatusName");
    const $statusColor = document.getElementById("newStatusColor");
    const $addStatusBtn = document.getElementById("addStatusBtn");
    const $statusList = document.getElementById("statusList"); // list-group

    // 頂部狀態資料緩存
    let statusRows = []; // [{id,name,color,order}]
    let sortableInstance = null;
    const hasStatusAdminUI =
      $statusName && $statusColor && $addStatusBtn && $statusList ? true : false;

    // —— 狀態管理：載入資料（維持現有順序，不強制重排；僅拖曳時更新 order）——
    async function loadStatusesForAdmin() {
      if (!hasStatusAdminUI) return;
      const snap = await colStatus.get();
      statusRows = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: d.id,
          color: x.color || "#6c757d",
          order: Number(x.order ?? 9999),
        };
      });
      // 顯示上：以 order 升冪，次序相同則依中文名稱
      statusRows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hant"));
      renderStatusAdminList();
      // 同步底部下拉的可選狀態
      await loadStatusesForRequests(); // 讓下方報修管理也取得最新顏色、選項
    }

    function renderStatusAdminList() {
      if (!hasStatusAdminUI) return;
      $statusList.innerHTML = "";
      statusRows.forEach((s) => {
        const row = document.createElement("div");
        row.className = "list-group-item status-row";
        row.dataset.id = s.id;
        row.dataset.order = String(s.order);

        row.innerHTML = `
          <div class="row align-items-center g-2">
            <div class="col-1 text-center drag-handle"><i class="fa-solid fa-grip-lines"></i></div>

            <div class="col-4">
              <div class="d-flex align-items-center">
                <span class="color-dot me-2" style="background:${esc(s.color)}"></span>
                <input class="form-control form-control-sm nameInput" value="${esc(s.name)}" disabled>
              </div>
            </div>

            <div class="col-3">
              <input type="color" class="form-control form-control-color colorInput" value="${esc(
                s.color
              )}" title="選擇顏色">
            </div>

            <div class="col-2 text-center">
              <span class="badge bg-secondary orderBadge">${esc(String(s.order))}</span>
            </div>

            <div class="col-2 text-end">
              <button class="btn btn-sm btn-outline-primary me-1 editBtn"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-outline-success d-none saveBtn"><i class="fa-solid fa-floppy-disk"></i></button>
              <button class="btn btn-sm btn-outline-secondary d-none cancelBtn"><i class="fa-solid fa-rotate-left"></i></button>
              <button class="btn btn-sm btn-outline-danger delBtn"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `;
        $statusList.appendChild(row);
      });

      // 啟用拖曳（若 SortableJS 已載入）
      try {
        if (typeof Sortable !== "undefined") {
          if (sortableInstance) sortableInstance.destroy();
          sortableInstance = new Sortable($statusList, {
            handle: ".drag-handle",
            animation: 150,
            onEnd: onStatusReorder,
          });
        }
      } catch (e) {
        // 如果沒有 Sortable，安靜略過，仍可編輯/改色/刪除
        console.warn("SortableJS not found, reorder disabled.");
      }
    }

    async function onStatusReorder() {
      const rows = [...$statusList.querySelectorAll(".status-row")];
      const batch = db.batch();
      rows.forEach((row, idx) => {
        const id = row.dataset.id;
        const newOrder = idx + 1;
        const ref = colStatus.doc(id);
        batch.update(ref, { order: newOrder });
        const badge = row.querySelector(".orderBadge");
        if (badge) badge.textContent = newOrder;
      });
      await batch.commit();
      await loadStatusesForAdmin(); // 重新讀，保持資料與畫面同步
    }

    // —— 狀態管理：新增 —— 
    if ($addStatusBtn) {
      $addStatusBtn.addEventListener("click", async () => {
        const name = $statusName.value.trim();
        const color = $statusColor.value || "#0d6efd";
        if (!name) return alert("請輸入狀態名稱");

        // 同名檢查
        const exists = await colStatus.doc(name).get();
        if (exists.exists) return alert("狀態已存在");

        // 找最大 order + 1
        const maxOrder =
          statusRows.reduce((m, x) => Math.max(m, Number(x.order || 0)), 0) + 1;
        await colStatus.doc(name).set({ color, order: maxOrder });

        $statusName.value = "";
        await loadStatusesForAdmin();
      });
    }

    // —— 狀態管理：事件代理（改名 / 取消 / 儲存 / 刪除 / 改色）——
    if ($statusList) {
      $statusList.addEventListener("click", async (e) => {
        const row = e.target.closest(".status-row");
        if (!row) return;
        const id = row.dataset.id;

        const nameInput = row.querySelector(".nameInput");
        const editBtn = row.querySelector(".editBtn");
        const saveBtn = row.querySelector(".saveBtn");
        const cancelBtn = row.querySelector(".cancelBtn");

        // 編輯
        if (e.target.closest(".editBtn")) {
          if (nameInput) {
            nameInput.disabled = false;
            nameInput.focus();
          }
          if (editBtn) editBtn.classList.add("d-none");
          if (saveBtn) saveBtn.classList.remove("d-none");
          if (cancelBtn) cancelBtn.classList.remove("d-none");
        }

        // 取消
        if (e.target.closest(".cancelBtn")) {
          if (nameInput) {
            nameInput.value = id; // docId 即原名稱
            nameInput.disabled = true;
          }
          if (editBtn) editBtn.classList.remove("d-none");
          if (saveBtn) saveBtn.classList.add("d-none");
          if (cancelBtn) cancelBtn.classList.add("d-none");
        }

        // 儲存（改名：需要搬移 doc）
        if (e.target.closest(".saveBtn")) {
          const newName = nameInput?.value.trim();
          if (!newName) return alert("名稱不可空白");
          if (newName === id) {
            // 名稱沒變
            if (nameInput) nameInput.disabled = true;
            if (editBtn) editBtn.classList.remove("d-none");
            if (saveBtn) saveBtn.classList.add("d-none");
            if (cancelBtn) cancelBtn.classList.add("d-none");
            return;
          }
          // 舊資料
          const snap = await colStatus.doc(id).get();
          if (!snap.exists) return alert("原狀態不存在");
          const oldData = snap.data();

          // 不可與現有名稱衝突
          const dup = await colStatus.doc(newName).get();
          if (dup.exists) return alert("已存在相同名稱的狀態");

          // 新建 → 刪舊
          await colStatus.doc(newName).set({ ...oldData });
          await colStatus.doc(id).delete();

          await loadStatusesForAdmin();
        }

        // 刪除
        if (e.target.closest(".delBtn")) {
          if (
            !confirm(
              `確定刪除狀態「${id}」？\n（提示：若已有報修單使用此狀態，請先改為其他狀態）`
            )
          )
            return;
          await colStatus.doc(id).delete();
          await loadStatusesForAdmin();
        }
      });

      // 顏色即時變更
      $statusList.addEventListener("input", async (e) => {
        const row = e.target.closest(".status-row");
        if (!row) return;

        if (e.target.classList.contains("colorInput")) {
          const id = row.dataset.id;
          const color = e.target.value || "#6c757d";
          await colStatus.doc(id).update({ color });
          const dot = row.querySelector(".color-dot");
          if (dot) dot.style.background = color;
          // 下方報修管理下次 load 會拿到新顏色；如需跨區即時同步可加 snapshot 監聽
        }
      });
    }

    // =========================================================
    // =========== [B] 下方：報修管理（辦公室端） ===============
    // =========================================================
    // ---- DOM ----
    const $tbody = document.getElementById("maintenanceTableBody");
    const $statusFilter = document.getElementById("statusFilter");
    const $startDate = document.getElementById("startDate");
    const $endDate = document.getElementById("endDate");
    const $applyDate = document.getElementById("applyDateBtn");
    const $clearDate = document.getElementById("clearDateBtn");
    const $exportWord = document.getElementById("exportWordBtn");
    const $exportExcel = document.getElementById("exportExcelBtn");
    const $print = document.getElementById("printBtn");
    const $addRequest = document.getElementById("addRequestBtn");
    const $saveRequest = document.getElementById("saveRequestBtn");
    const $statusSelectInModal = document.getElementById("statusSelect");
    const $addModalEl = document.getElementById("addRequestModal");
    const addModal = $addModalEl ? new bootstrap.Modal($addModalEl) : null;

    // ---- 狀態資料（供下拉＆顏色） ----
    let statuses = []; // [{id,name,color,order}]
    // ---- 報修資料 ----
    let allRequests = []; // request + _comments
    // ---- 篩選狀態 ----
    let currentStatusFilter = "all";
    let currentStart = null;
    let currentEnd = null;

    function showLoadingRow() {
      if (!$tbody) return;
      $tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
    }

    // —— 報修管理：載入「狀態」供下拉＆顏色 badge —— 
    async function loadStatusesForRequests() {
      const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
      statuses = snap.docs.map((d) => ({ id: d.id, name: d.id, ...d.data() }));

      // 狀態篩選器
      if ($statusFilter) {
        $statusFilter.innerHTML =
          `<option value="all">全部</option>` +
          statuses.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
      }
      // 新增報修單 Modal 的狀態
      if ($statusSelectInModal) {
        $statusSelectInModal.innerHTML = statuses
          .map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`)
          .join("");
      }
    }

    // —— 報修管理：載入列表（含 subcomments + legacy comments[] 顯示）——
    async function loadRequests() {
      if (!$tbody) return; // 頁面可能沒有管理表格（例如純狀態管理頁）
      showLoadingRow();
      const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
      allRequests = await Promise.all(
        snap.docs.map(async (doc) => {
          const data = { id: doc.id, ...doc.data() };

          // subcollection comments（最新在上）
          const cSnap = await colReq.doc(doc.id).collection("comments").orderBy("time", "desc").get();
          const sub = cSnap.docs.map((c) => ({ _cid: c.id, ...c.data() }));

          // legacy 陣列 comments（顯示不可動）
          const legacy = Array.isArray(data.comments) ? data.comments : [];
          const legacyView = legacy.map((lc) => ({
            _cid: null,
            author: lc.author || lc.authorName || "未紀錄",
            message: lc.message || "",
            role: lc.role || "admin",
            time: lc.time || null,
            _legacy: true,
          }));

          data._comments = [...sub, ...legacyView];
          return data;
        })
      );

      renderRequests();
    }

    function inDateRange(ts) {
      if (!ts?.toDate) return true;
      const d = ts.toDate();
      if (currentStart && d < currentStart) return false;
      if (currentEnd) {
        const end = new Date(
          currentEnd.getFullYear(),
          currentEnd.getMonth(),
          currentEnd.getDate(),
          23,
          59,
          59,
          999
        );
        if (d > end) return false;
      }
      return true;
    }

    function getFiltered() {
      return allRequests.filter((r) => {
        const okS = currentStatusFilter === "all" || r.status === currentStatusFilter;
        const okD = currentStart || currentEnd ? inDateRange(r.createdAt) : true;
        return okS && okD;
      });
    }

    function colorOf(statusName) {
      return statuses.find((s) => s.name === statusName)?.color || "#6c757d";
    }

    function renderCommentBlock(reqId, c) {
      const roleLabel = c.role === "nurse" ? "護理師" : "管理端";
      const canEdit = !c._legacy && c.role === "admin"; // 只有 admin subcomment 可編輯
      const canDelete = !c._legacy; // subcomment 都可刪（含護理師）

      return `
        <div class="border rounded p-2 mb-2">
          <div><strong>${esc(c.author)}（${roleLabel}）</strong></div>
          <div class="comment-text mt-1">${esc(c.message)}</div>
          <div class="d-flex justify-content-between align-items-center mt-1">
            <time class="text-muted small">${fmtTS(c.time)}</time>
            <div class="btn-group btn-group-sm" role="group">
              ${canEdit
                ? `<button class="btn btn-outline-primary editCommentBtn" title="編輯"
                    data-id="${reqId}" data-cid="${c._cid}" data-msg="${esc(c.message)}">✏️</button>`
                : ``}
              ${canDelete
                ? `<button class="btn btn-outline-danger delCommentBtn" title="刪除"
                    data-id="${reqId}" data-cid="${c._cid}">🗑️</button>`
                : ``}
            </div>
          </div>
        </div>
      `;
    }

    function renderRequests() {
      if (!$tbody) return;
      const rows = getFiltered();
      $tbody.innerHTML = "";
      if (!rows.length) {
        $tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
        return;
      }

      rows.forEach((r) => {
        const commentsHTML =
          (r._comments || []).map((c) => renderCommentBlock(r.id, c)).join("") ||
          `<span class="text-muted">—</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${esc(r.item || "")}</td>
          <td>${esc(r.detail || "")}</td>
          <td>${esc(r.reporter || "")}</td>
          <td>
            <select class="form-select form-select-sm statusSelectCell">
              ${statuses
                .map(
                  (s) => `
                <option value="${esc(s.name)}" ${s.name === r.status ? "selected" : ""}>
                  ${esc(s.name)}
                </option>`
                )
                .join("")}
            </select>
          </td>
          <td>${fmtTS(r.createdAt)}</td>
          <td style="min-width:260px;">
            <div class="mb-2">
              <strong>註解：</strong>
              <div class="mt-1">${commentsHTML}</div>
            </div>

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
        $tbody.appendChild(tr);
      });
    }

    // —— 報修管理：狀態變更 + 寫入系統留言 —— 
    if ($tbody) {
      $tbody.addEventListener("change", async (e) => {
        const sel = e.target.closest(".statusSelectCell");
        if (!sel) return;

        const row = sel.closest("tr");
        const id = row.querySelector("[data-delreq]")?.dataset?.delreq;
        if (!id) return alert("找不到報修單 ID");

        const newStatus = sel.value;

        // 先取舊狀態
        const doc = await colReq.doc(id).get();
        const oldStatus = doc.exists ? doc.data().status || "" : "";

        // 更新狀態
        await colReq.doc(id).update({ status: newStatus });

        // 寫入系統留言（localStorage.adminName）
        const operator = localStorage.getItem("adminName") || "管理端";
        const msg = `系統：${operator} 將狀態由「${oldStatus || "（無）」}」改為「${newStatus}」`;
        await colReq.doc(id).collection("comments").add({
          author: operator,
          message: msg,
          role: "admin",
          time: firebase.firestore.FieldValue.serverTimestamp(),
        });

        await loadRequests();
      });
    }

    // —— 報修管理：註解 新增 / 編輯 / 刪除 / 刪單 —— 
    if ($tbody) {
      // 新增註解
      $tbody.addEventListener("click", async (e) => {
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
          time: firebase.firestore.FieldValue.serverTimestamp(),
        });

        authorEl.value = "";
        inputEl.value = "";
        await loadRequests();
      });

      // 編輯註解（僅 admin subcomment 顯示 ✏️）
      $tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest(".editCommentBtn");
        if (!btn) return;

        const id = btn.dataset.id;
        const cid = btn.dataset.cid;
        const oldMsgEscaped = btn.dataset.msg || "";
        const container = btn.closest(".border");
        if (!container) return;

        const oldHTML = container.innerHTML;
        const decode = (s) =>
          s
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"');

        const oldMsg = decode(oldMsgEscaped);
        container.innerHTML = `
          <div><strong>編輯留言（管理端）</strong></div>
          <textarea class="form-control form-control-sm mt-2 editMessageBox" rows="3">${esc(oldMsg)}</textarea>
          <div class="mt-2">
            <button class="btn btn-sm btn-success saveEditBtn">💾 儲存</button>
            <button class="btn btn-sm btn-secondary cancelEditBtn">取消</button>
          </div>
        `;

        container.querySelector(".saveEditBtn").addEventListener("click", async () => {
          const newText = container.querySelector(".editMessageBox")?.value.trim();
          if (!newText) return alert("內容不可為空白");
          await colReq.doc(id).collection("comments").doc(cid).update({ message: newText });
          await loadRequests();
        });

        container.querySelector(".cancelEditBtn").addEventListener("click", () => {
          container.innerHTML = oldHTML;
        });
      });

      // 刪除註解（僅 subcomments）
      $tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delCommentBtn");
        if (!btn) return;

        const id = btn.dataset.id;
        const cid = btn.dataset.cid;
        if (!cid) return alert("這是舊資料（陣列 comments[]），無法刪除");

        if (!confirm("確定要刪除此註解？")) return;
        await colReq.doc(id).collection("comments").doc(cid).delete();
        await loadRequests();
      });

      // 刪除報修單（含刪 subcomments）
      $tbody.addEventListener("click", async (e) => {
        const delBtn = e.target.closest("[data-delreq]");
        if (!delBtn) return;
        // 避免與其他按鈕衝突
        if (e.target.closest(".btn-add-comment") || e.target.closest(".delCommentBtn") || e.target.closest(".editCommentBtn")) return;

        const id = delBtn.dataset.delreq;
        if (!id) return;
        if (!confirm("確定要刪除此報修單？\n（將同時刪除此單的所有子留言）")) return;

        const cSnap = await colReq.doc(id).collection("comments").get();
        const batch = db.batch();
        cSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        await colReq.doc(id).delete();
        await loadRequests();
      });
    }

    // —— 報修管理：篩選（狀態 / 日期）——
    if ($statusFilter) {
      $statusFilter.addEventListener("change", (e) => {
        currentStatusFilter = e.target.value || "all";
        renderRequests();
      });
    }
    if ($applyDate) {
      $applyDate.addEventListener("click", () => {
        const s = $startDate?.value ? new Date($startDate.value) : null;
        const e = $endDate?.value ? new Date($endDate.value) : null;
        if (s && e && s > e) return alert("開始日期不可晚於結束日期");
        currentStart = s;
        currentEnd = e;
        renderRequests();
      });
    }
    if ($clearDate) {
      $clearDate.addEventListener("click", () => {
        if ($startDate) $startDate.value = "";
        if ($endDate) $endDate.value = "";
        currentStart = null;
        currentEnd = null;
        renderRequests();
      });
    }

    // —— 報修管理：匯出 & 列印 —— 
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
              <td>${esc(r.item)}</td>
              <td>${esc(r.detail)}</td>
              <td>${esc(r.reporter)}</td>
              <td>${esc(r.status)}</td>
              <td>${ts ? fmtTS({ toDate: () => ts }) : ""}</td>
              <td>${esc(r.note || "")}</td>
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

    if ($exportWord) {
      $exportWord.addEventListener("click", () => {
        const rows = getFiltered();
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
    }

    if ($exportExcel) {
      $exportExcel.addEventListener("click", () => {
        const rows = getFiltered();
        const html = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office"
                xmlns:x="urn:schemas-microsoft-com:office:excel"
                xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>${buildHeaderHTML()}${buildFormalTableHTML(rows)}</body>
          </html>`;
        const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        downloadURL(url, buildFileName("報修總表", "xls"));
      });
    }

    if ($print) {
      $print.addEventListener("click", () => {
        const rows = getFiltered();
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
    }

    // —— 報修管理：新增報修單（Modal）—— 
    if ($addRequest) {
      $addRequest.addEventListener("click", () => {
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
    }
    if ($saveRequest) {
      $saveRequest.addEventListener("click", async () => {
        const item = document.getElementById("item")?.value.trim();
        const detail = document.getElementById("detail")?.value.trim();
        const reporter = document.getElementById("reporter")?.value.trim();
        const statusVal = $statusSelectInModal?.value || "待處理";
        const note = document.getElementById("note")?.value.trim() || "";
        if (!item || !detail || !reporter) return alert("請輸入完整資料");

        await colReq.add({
          item,
          detail,
          reporter,
          status: statusVal,
          note,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          comments: [], // 保留相容
        });

        addModal?.hide();
        await loadRequests();
      });
    }

    // ------ 初始化：先載入狀態（兩邊共用），再載入請修單 ------
    await loadStatusesForAdmin();   // 若頁面沒有頂部 UI，函式內會自動略過並仍進行 loadStatusesForRequests
    await loadRequests();           // 若頁面沒有下方表格，函式會安靜略過
  }
})();
