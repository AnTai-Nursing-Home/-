/**
 * office-maintenance.js
 * Integrated Admin (Top "Status Management" + Bottom "Maintenance Management")
 * Version: 2025-10-29
 *
 * - Top: maintenance_status CRUD + color + drag order (optional SortableJS)
 * - Bottom: maintenance_requests list with status <select> (background color + white text),
 *           status change writes a system comment (localStorage.adminName),
 *           comments subcollection add/edit(delete admin only for edit; subcomments deletable; legacy array read-only),
 *           filters (status/date), export to Word/Excel, print, delete request with subcomments.
 *
 * Requirements in HTML (if absent, logic auto-skips safely):
 *  Top admin: #newStatusName, #newStatusColor, #addStatusBtn, #statusList (each row uses .drag-handle)
 *  Bottom table/tools:
 *   #maintenanceTableBody, #statusFilter, #startDate, #endDate, #applyDateBtn, #clearDateBtn
 *   #exportWordBtn, #exportExcelBtn, #printBtn
 *   #addRequestBtn, #saveRequestBtn, #statusSelect, #addRequestModal
 *   Modal fields: #item, #detail, #reporter, #note
 */

(function () {
  // If firebase already init, run; else wait custom event.
  if (window.firebase?.apps?.length) {
    init();
  } else {
    document.addEventListener("firebase-ready", init);
  }

  async function init() {
    const db = firebase.firestore();
    const colStatus = db.collection("maintenance_status");
    const colReq = db.collection("maintenance_requests");
    const colResidents = db.collection("residents");

    // Utils
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
      return (
        d.getFullYear() +
        "-" +
        pad(d.getMonth() + 1) +
        "-" +
        pad(d.getDate()) +
        " " +
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes())
      );
    };
    const fmtDateOnly = (d) =>
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());


    // -------------------- Login User (for top-right display + auto reporter/comment author) --------------------
    function getLoggedUser() {
      if (window.loginUser && typeof window.loginUser === "object") return window.loginUser;
      if (window.currentUser && typeof window.currentUser === "object") return window.currentUser;

      const safeParse = (raw) => {
        try { return JSON.parse(raw); } catch (_) { return null; }
      };

      // Prefer sessionStorage (你的系統登入多數在 sessionStorage)
      const sessionKeys = ["officeAuth","nurseAuth","adminAuth","auth","userAuth","loginAuth"];
      for (const k of sessionKeys) {
        try {
          const raw = sessionStorage.getItem(k);
          if (!raw) continue;
          const u = safeParse(raw);
          if (u && typeof u === "object") return u;
        } catch (_) {}
      }

      // Compatible with antai_session* key naming: scan all sessionStorage keys
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (!key) continue;
          const lk = key.toLowerCase();
          if (lk.startsWith("antai_session") || lk.startsWith("antai_sess") || lk.includes("antai_session")) {
            const raw = sessionStorage.getItem(key);
            if (!raw) continue;
            const u = safeParse(raw);
            if (u && typeof u === "object") return u;
          }
        }
      } catch (_) {}

      // Fallback localStorage JSON
      const jsonKeys = ["loginUser","currentUser","loggedInUser","officeUser","user","userInfo","authUser"];
      for (const k of jsonKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = safeParse(raw);
        if (obj && typeof obj === "object") return obj;
      }

      // Fallback combine fields
      const empId =
        localStorage.getItem("empId") ||
        localStorage.getItem("employeeId") ||
        localStorage.getItem("staffId") ||
        localStorage.getItem("employeeNo") ||
        localStorage.getItem("empNo") ||
        localStorage.getItem("username") ||
        "";

      const name =
        localStorage.getItem("employeeName") ||
        localStorage.getItem("displayName") ||
        localStorage.getItem("name") ||
        localStorage.getItem("staffName") ||
        "";

      if (empId || name) return { empId, employeeId: empId, staffId: empId, empNo: empId, id: empId, name, displayName: name };
      return {};
    }

    const loggedUser = getLoggedUser();
    const loggedEmpId = (loggedUser.empId || loggedUser.employeeId || loggedUser.staffId || loggedUser.staffNo || loggedUser.empNo || loggedUser.id || "").toString().trim();
    const loggedName = (loggedUser.name || loggedUser.employeeName || loggedUser.displayName || loggedUser.display_name || loggedUser.username || loggedUser.userName || "").toString().trim();

    function getLoggedUserLabel() {
      if (loggedEmpId && loggedName) return `${loggedEmpId} ${loggedName}`;
      if (loggedName) return loggedName;
      if (loggedEmpId) return loggedEmpId;
      return "未登入";
    }

    function setTopRightLoginInfo() {
      const el = document.getElementById("loginUserInfo");
      if (!el) return;
      el.textContent = `登入者：${getLoggedUserLabel()}`;
    }
    setTopRightLoginInfo();

    // -------------------- Top: Status Admin --------------------
    // 狀態管理 UI 元素（對應 HTML 正確 ID）
    const $statusName = document.getElementById("new-status");
    const $statusColor = document.getElementById("new-status-color");
    const $addStatusBtn = document.getElementById("btn-add-status");
    const $statusList = document.getElementById("statusList");

    let statusRows = []; // [{id,name,color,order}]
    let sortableInstance = null;
    const hasStatusAdminUI =
      $statusName && $statusColor && $addStatusBtn && $statusList;

    async function loadStatusesForAdmin() {
      if (!hasStatusAdminUI) {
        // Still ensure bottom gets statuses.
        await loadStatusesForRequests();
        return;
      }
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
      statusRows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hant"));
      renderStatusAdminList();
      await loadStatusesForRequests();
    }

    function renderStatusAdminList() {
      if (!hasStatusAdminUI) return;
      $statusList.innerHTML = "";
      statusRows.forEach((s) => {
        const row = document.createElement("div");
        row.className = "list-group-item status-row";
        row.dataset.id = s.id;
        row.dataset.order = String(s.order);
        row.innerHTML = [
          '<div class="row align-items-center g-2">',
          '  <div class="col-1 text-center drag-handle"><i class="fa-solid fa-grip-lines"></i></div>',
          '  <div class="col-4">',
          '    <div class="d-flex align-items-center">',
          '      <span class="color-dot me-2" style="display:inline-block;width:20px;height:20px;border-radius:6px;border:1px solid rgba(0,0,0,.15);background:' +
            esc(s.color) +
            ';"></span>',
          '      <input class="form-control form-control-sm nameInput" value="' + esc(s.name) + '" disabled>',
          "    </div>",
          "  </div>",
          '  <div class="col-3">',
          '    <input type="color" class="form-control form-control-color colorInput" value="' +
            esc(s.color) +
            '" title="選擇顏色">',
          "  </div>",
          '  <div class="col-2 text-center"><span class="badge bg-secondary orderBadge">' +
            esc(String(s.order)) +
            "</span></div>",
          '  <div class="col-2 text-end">',
          '    <button class="btn btn-sm btn-outline-primary me-1 editBtn" title="編輯名稱"><i class="fa-solid fa-pen"></i></button>',
          '    <button class="btn btn-sm btn-outline-success d-none saveBtn" title="儲存"><i class="fa-solid fa-floppy-disk"></i></button>',
          '    <button class="btn btn-sm btn-outline-secondary d-none cancelBtn" title="取消"><i class="fa-solid fa-rotate-left"></i></button>',
          '    <button class="btn btn-sm btn-outline-danger delBtn" title="刪除"><i class="fa-solid fa-trash"></i></button>',
          "  </div>",
          "</div>",
        ].join("");
        $statusList.appendChild(row);
      });

      // Enable drag if Sortable available
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
        console.warn("SortableJS not found; drag disabled.");
      }
    }

    async function onStatusReorder() {
      const rows = Array.prototype.slice.call(
        $statusList.querySelectorAll(".status-row")
      );
      const batch = db.batch();
      rows.forEach((row, idx) => {
        const id = row.dataset.id;
        const newOrder = idx + 1;
        batch.update(colStatus.doc(id), { order: newOrder });
        const badge = row.querySelector(".orderBadge");
        if (badge) badge.textContent = newOrder;
      });
      await batch.commit();
      await loadStatusesForAdmin();
    }

    if ($addStatusBtn) {
      $addStatusBtn.addEventListener("click", async () => {
        const name = ($statusName.value || "").trim();
        const color = $statusColor.value || "#0d6efd";
        if (!name) {
          alert("請輸入狀態名稱");
          return;
        }
        const exists = await colStatus.doc(name).get();
        if (exists.exists) {
          alert("狀態已存在");
          return;
        }
        const maxOrder =
          statusRows.reduce((m, x) => Math.max(m, Number(x.order || 0)), 0) + 1;
        await colStatus.doc(name).set({ color, order: maxOrder });
        $statusName.value = "";
        await loadStatusesForAdmin();
      });
    }

    if ($statusList) {
      $statusList.addEventListener("click", async (e) => {
        const row = e.target.closest(".status-row");
        if (!row) return;
        const id = row.dataset.id;
        const nameInput = row.querySelector(".nameInput");
        const editBtn = row.querySelector(".editBtn");
        const saveBtn = row.querySelector(".saveBtn");
        const cancelBtn = row.querySelector(".cancelBtn");

        if (e.target.closest(".editBtn")) {
          if (nameInput) {
            nameInput.disabled = false;
            nameInput.focus();
          }
          if (editBtn) editBtn.classList.add("d-none");
          if (saveBtn) saveBtn.classList.remove("d-none");
          if (cancelBtn) cancelBtn.classList.remove("d-none");
        }

        if (e.target.closest(".cancelBtn")) {
          if (nameInput) {
            nameInput.value = id;
            nameInput.disabled = true;
          }
          if (editBtn) editBtn.classList.remove("d-none");
          if (saveBtn) saveBtn.classList.add("d-none");
          if (cancelBtn) cancelBtn.classList.add("d-none");
        }

        if (e.target.closest(".saveBtn")) {
          const newName = (nameInput && nameInput.value.trim()) || "";
          if (!newName) {
            alert("名稱不可空白");
            return;
          }
          if (newName === id) {
            if (nameInput) nameInput.disabled = true;
            if (editBtn) editBtn.classList.remove("d-none");
            if (saveBtn) saveBtn.classList.add("d-none");
            if (cancelBtn) cancelBtn.classList.add("d-none");
            return;
          }
          const snap = await colStatus.doc(id).get();
          if (!snap.exists) {
            alert("原狀態不存在");
            return;
          }
          const oldData = snap.data();
          const dup = await colStatus.doc(newName).get();
          if (dup.exists) {
            alert("已存在相同名稱的狀態");
            return;
          }
          await colStatus.doc(newName).set(oldData);
          await colStatus.doc(id).delete();
          await loadStatusesForAdmin();
        }

        if (e.target.closest(".delBtn")) {
          if (
            !confirm(
              "確定刪除此狀態？已有報修單使用此狀態時，請先改為其他狀態再刪除。"
            )
          )
            return;
          await colStatus.doc(id).delete();
          await loadStatusesForAdmin();
        }
      });

      $statusList.addEventListener("input", async (e) => {
        const row = e.target.closest(".status-row");
        if (!row) return;
        if (e.target.classList.contains("colorInput")) {
          const id = row.dataset.id;
          const color = e.target.value || "#6c757d";
          await colStatus.doc(id).update({ color });
          const dot = row.querySelector(".color-dot");
          if (dot) dot.style.background = color;
          // Bottom side will use latest colors on next load; onSnapshot could be added if needed.
        }
      });
    }


    // -------------------- Cascading selects for new request modal --------------------
    function setOptions(selectEl, options, placeholder) {
      if (!selectEl) return;
      const ph = placeholder || "請選擇";
      selectEl.innerHTML = `<option value="">${esc(ph)}</option>` + (options || [])
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
        .join("");
    }

    async function refreshLocationAndItems() {
      const cat = ($categorySelect && $categorySelect.value) || "";
      if (!cat) {
        setOptions($locationSelect, [], "請先選分類");
        setOptions($itemSelect, [], "請先選位置");
        return;
      }

      if (cat === "其他") {
        setOptions($locationSelect, ["其他"], "請選擇");
        $locationSelect.value = "其他";
        setOptions($itemSelect, ["洗澡床", "洗澡椅", "輪椅"], "請選擇");
        return;
      }

      // 1F/2F/3F
      setOptions($locationSelect, ["護理站", "房間"], "請選擇");
      setOptions($itemSelect, [], "請先選位置");
    }

    async function refreshItemsByLocation() {
      const cat = ($categorySelect && $categorySelect.value) || "";
      const loc = ($locationSelect && $locationSelect.value) || "";
      if (!cat || !loc) {
        setOptions($itemSelect, [], "請先選位置");
        return;
      }

      if (cat === "其他") {
        setOptions($itemSelect, ["洗澡床", "洗澡椅", "輪椅"], "請選擇");
        return;
      }

      if (loc === "護理站") {
        setOptions($itemSelect, ["飲水機"], "請選擇");
        return;
      }

      if (loc === "房間") {
        await loadBedsOnce();
        const beds = bedsByFloor[cat] || [];
        const items = [];
        beds.forEach((b) => {
          items.push(`${b}床`);
          items.push(`${b}叫人鈴`);
        });
        setOptions($itemSelect, items, items.length ? "請選擇" : "此樓層無床號");
        return;
      }

      setOptions($itemSelect, [], "請先選位置");
    }

    function initModalSelects() {
      if ($categorySelect) {
        setOptions($categorySelect, ["1F", "2F", "3F", "其他"], "請選擇");
      }
      refreshLocationAndItems();

      if ($categorySelect) {
        $categorySelect.addEventListener("change", async function () {
          await refreshLocationAndItems();
        });
      }
      if ($locationSelect) {
        $locationSelect.addEventListener("change", async function () {
          await refreshItemsByLocation();
        });
      }
      if ($categorySelect) {
        $categorySelect.addEventListener("change", async function () {
          // if category becomes "其他", location auto set, also refresh items
          await refreshItemsByLocation();
        });
      }
    }

    // -------------------- Bottom: Requests Admin --------------------
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
    const $categorySelect = document.getElementById("categorySelect");
    const $locationSelect = document.getElementById("locationSelect");
    const $itemSelect = document.getElementById("itemSelect");
    const $addModalEl = document.getElementById("addRequestModal");
    const addModal = $addModalEl ? new bootstrap.Modal($addModalEl) : null;

    let statuses = []; // for bottom: [{id,name,color,order}]
    let allRequests = []; // each has _comments
    let currentStatusFilter = "all";
    let currentStart = null;
    let currentEnd = null;


    // -------------------- Beds for room items (from residents system) --------------------
    const bedsByFloor = { "1F": [], "2F": [], "3F": [] };
    let bedsLoaded = false;

    function normalizeBedToken(v) {
      const s = String(v || "").trim().replace(/_/g, "-");
      const m = s.match(/^(\d{3})-(\w+)$/);
      return m ? `${m[1]}-${m[2]}` : null;
    }

    function uniqSortBeds(arr) {
      const uniq = Array.from(new Set((arr || []).filter(Boolean)));
      uniq.sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true }));
      return uniq;
    }

    async function loadBedsOnce() {
      if (bedsLoaded) return;
      bedsLoaded = true;
      try {
        const snap = await colResidents.get();
        const f1 = [], f2 = [], f3 = [];
        snap.forEach((doc) => {
          const data = doc.data() || {};
          const bed = normalizeBedToken(data.bedNumber);
          if (!bed) return;
          if (bed.startsWith("1")) f1.push(bed);
          else if (bed.startsWith("2")) f2.push(bed);
          else if (bed.startsWith("3")) f3.push(bed);
        });
        bedsByFloor["1F"] = uniqSortBeds(f1);
        bedsByFloor["2F"] = uniqSortBeds(f2);
        bedsByFloor["3F"] = uniqSortBeds(f3);
      } catch (e) {
        console.warn("loadBedsOnce failed:", e);
      }
    }

    function setSelectColor(selectEl, statusName) {
      const color = colorOf(statusName);
      // Option C: background= color, text= white
      selectEl.style.background = color;
      selectEl.style.color = "#ffffff";
      // Avoid default iOS shadow text; set text-shadow none
      selectEl.style.textShadow = "none";
      // For Firefox on Windows, sometimes need to force important via CSS, but inline suffices here.
    }

    function showLoadingRow() {
      if (!$tbody) return;
      $tbody.innerHTML =
        '<tr><td colspan="9" class="text-center text-muted">讀取中...</td></tr>';
    }

    async function loadStatusesForRequests() {
      const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
      statuses = snap.docs.map((d) => ({ id: d.id, name: d.id, ...d.data() }));

      if ($statusFilter) {
        $statusFilter.innerHTML =
          '<option value="all">全部</option>' +
          statuses.map((s) => '<option value="' + esc(s.name) + '">' + esc(s.name) + "</option>").join("");
      }
      if ($statusSelectInModal) {
        $statusSelectInModal.innerHTML = statuses
          .map((s) => '<option value="' + esc(s.name) + '">' + esc(s.name) + "</option>")
          .join("");
      }
    }

    async function loadRequests() {
      if (!$tbody) return;
      showLoadingRow();
      const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
      allRequests = await Promise.all(
        snap.docs.map(async (doc) => {
          const data = { id: doc.id, ...doc.data() };
          const cSnap = await colReq
            .doc(doc.id)
            .collection("comments")
            .orderBy("time", "desc")
            .get();
          const sub = cSnap.docs.map((c) => ({ _cid: c.id, ...c.data() }));
          const legacy = Array.isArray(data.comments) ? data.comments : [];
          const legacyView = legacy.map((lc) => ({
            _cid: null,
            author: lc.author || lc.authorName || "未紀錄",
            message: lc.message || "",
            role: lc.role || "admin",
            time: lc.time || null,
            _legacy: true,
          }));
          data._comments = [].concat(sub, legacyView);
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
        const e = new Date(
          currentEnd.getFullYear(),
          currentEnd.getMonth(),
          currentEnd.getDate(),
          23,
          59,
          59,
          999
        );
        if (d > e) return false;
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
      const s = statuses.find((x) => x.name === statusName);
      return s ? s.color || "#6c757d" : "#6c757d";
    }

    function renderCommentBlock(reqId, c) {
      const roleLabel = c.role === "nurse" ? "護理師" : "管理端";
      const canEdit = !c._legacy && c.role === "admin";
      const canDelete = !c._legacy;
      return [
        '<div class="border rounded p-2 mb-2">',
        " <div><strong>" + esc(c.author) + "（" + roleLabel + "）</strong></div>",
        ' <div class="comment-text mt-1">' + esc(c.message) + "</div>",
        ' <div class="d-flex justify-content-between align-items-center mt-1">',
        '  <time class="text-muted small">' + fmtTS(c.time) + "</time>",
        '  <div class="btn-group btn-group-sm" role="group">',
        canEdit
          ? '   <button class="btn btn-outline-primary editCommentBtn" title="編輯" data-id="' +
            reqId +
            '" data-cid="' +
            c._cid +
            '" data-msg="' +
            esc(c.message) +
            '">✏️</button>'
          : "",
        canDelete
          ? '   <button class="btn btn-outline-danger delCommentBtn" title="刪除" data-id="' +
            reqId +
            '" data-cid="' +
            c._cid +
            '">🗑️</button>'
          : "",
        "  </div>",
        " </div>",
        "</div>",
      ].join("");
    }

    function renderRequests() {
      if (!$tbody) return;
      const rows = getFiltered();
      $tbody.innerHTML = "";
      if (!rows.length) {
        $tbody.innerHTML =
          '<tr><td colspan="9" class="text-center text-muted">目前沒有報修單</td></tr>';
        return;
      }

      rows.forEach((r) => {
        const commentsHTML =
          (r._comments || []).map((c) => renderCommentBlock(r.id, c)).join("") ||
          '<span class="text-muted">—</span>';
        const tr = document.createElement("tr");
        tr.innerHTML = [
          "<td>" + esc(r.category || "") + "</td>",
          "<td>" + esc(r.location || "") + "</td>",
          "<td>" + esc(r.item || "") + "</td>",
          "<td>" + esc(r.detail || "") + "</td>",
          "<td>" + esc(r.reporter || "") + "</td>",
          "<td>",
          '  <select class="form-select form-select-sm statusSelectCell">',
          statuses
            .map(function (s) {
              return (
                '<option value="' +
                esc(s.name) +
                '"' +
                (s.name === r.status ? " selected" : "") +
                ">" +
                esc(s.name) +
                "</option>"
              );
            })
            .join(""),
          "  </select>",
          "</td>",
          "<td>" + fmtTS(r.createdAt) + "</td>",
          '<td style="min-width:320px;">',
          '  <div class="mb-2"><strong>備註：</strong> ' + esc(r.note || "") + "</div>",
          '  <div class="mb-2"><strong>註解：</strong><div class="mt-1">' +
            commentsHTML +
            "</div></div>",
          '  <textarea class="form-control form-control-sm comment-input mb-1" placeholder="新增註解..."></textarea>',
          '  <button class="btn btn-sm btn-primary btn-add-comment">新增註解</button>',
          "</td>",
          '<td class="text-end no-print">',
          '  <button class="btn btn-sm btn-outline-danger" title="刪除報修單" data-delreq="' +
            r.id +
            '"><i class="fa-solid fa-trash"></i></button>',
          "</td>",
        ].join("");
        $tbody.appendChild(tr);

        // Apply colored select style (Option C)
        const sel = tr.querySelector(".statusSelectCell");
        if (sel) setSelectColor(sel, r.status);
      });
    }

    // Status change + system comment
    if ($tbody) {
      $tbody.addEventListener("change", async (e) => {
        const sel = e.target.closest(".statusSelectCell");
        if (!sel) return;
        const row = sel.closest("tr");
        const id =
          row.querySelector("[data-delreq]")?.dataset?.delreq || row.dataset?.id;
        if (!id) {
          alert("找不到報修單 ID");
          return;
        }
        const newStatus = sel.value;
        // Read old status
        const doc = await colReq.doc(id).get();
        const oldStatus = doc.exists ? doc.data().status || "" : "";
        // Update status
        await colReq.doc(id).update({ status: newStatus });
        // System comment
        const operator = getLoggedUserLabel() || "管理端";
        const msg =
          "系統：" +
          operator +
          " 將狀態由「" +
          (oldStatus || "（無）") +
          "」改為「" +
          newStatus +
          "」";
        await colReq.doc(id).collection("comments").add({
          author: operator,
          message: msg,
          role: "admin",
          time: firebase.firestore.FieldValue.serverTimestamp(),
        });
        // Update select color immediately
        setSelectColor(sel, newStatus);
        await loadRequests();
      });
    }

    // Comments add/edit/delete and delete request
    if ($tbody) {
      // Add comment
      $tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btn-add-comment");
        if (!btn) return;
        const row = btn.closest("tr");
        const id =
          row.querySelector("[data-delreq]")?.dataset?.delreq || row.dataset?.id;
        if (!id) {
          alert("找不到報修單 ID");
          return;
        }
        const inputEl = row.querySelector(".comment-input");
        const author = getLoggedUserLabel();
        const message = (inputEl && inputEl.value.trim()) || "";
        if (!message) {
          alert("請輸入註解內容");
          return;
        }
        await colReq.doc(id).collection("comments").add({
          author: author,
          message: message,
          role: "admin",
          time: firebase.firestore.FieldValue.serverTimestamp(),
        });
                if (inputEl) inputEl.value = "";
        await loadRequests();
      });

      // Edit comment (admin only)
      $tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest(".editCommentBtn");
        if (!btn) return;
        const id = btn.dataset.id;
        const cid = btn.dataset.cid;
        const oldMsgEscaped = btn.dataset.msg || "";
        const container = btn.closest(".border");
        if (!container) return;
        const oldHTML = container.innerHTML;
        // decode a minimal set
        const decode = function (s) {
          return s
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"');
        };
        const oldMsg = decode(oldMsgEscaped);
        container.innerHTML = [
          "<div><strong>編輯留言（管理端）</strong></div>",
          '<textarea class="form-control form-control-sm mt-2 editMessageBox" rows="3">' +
            esc(oldMsg) +
            "</textarea>",
          '<div class="mt-2">',
          '  <button class="btn btn-sm btn-success saveEditBtn">儲存</button>',
          '  <button class="btn btn-sm btn-secondary cancelEditBtn">取消</button>',
          "</div>",
        ].join("");

        const saveBtn = container.querySelector(".saveEditBtn");
        const cancelBtn = container.querySelector(".cancelEditBtn");
        if (saveBtn) {
          saveBtn.addEventListener("click", async function () {
            const newText =
              container.querySelector(".editMessageBox")?.value.trim() || "";
            if (!newText) {
              alert("內容不可為空白");
              return;
            }
            await colReq
              .doc(id)
              .collection("comments")
              .doc(cid)
              .update({ message: newText });
            await loadRequests();
          });
        }
        if (cancelBtn) {
          cancelBtn.addEventListener("click", function () {
            container.innerHTML = oldHTML;
          });
        }
      });

      // Delete comment (subcomments only)
      $tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delCommentBtn");
        if (!btn) return;
        const id = btn.dataset.id;
        const cid = btn.dataset.cid;
        if (!cid) {
          alert("這是舊資料（陣列 comments[]），無法刪除");
          return;
        }
        if (!confirm("確定要刪除此註解？")) return;
        await colReq.doc(id).collection("comments").doc(cid).delete();
        await loadRequests();
      });

      // Delete request with subcomments
      $tbody.addEventListener("click", async (e) => {
        const delBtn = e.target.closest("[data-delreq]");
        if (!delBtn) return;
        // prevent conflict with comment buttons
        if (
          e.target.closest(".btn-add-comment") ||
          e.target.closest(".delCommentBtn") ||
          e.target.closest(".editCommentBtn")
        )
          return;
        const id = delBtn.dataset.delreq;
        if (!id) return;
        if (
          !confirm("確定要刪除此報修單？將同時刪除此單的所有子留言。")
        )
          return;
        const cSnap = await colReq.doc(id).collection("comments").get();
        const batch = db.batch();
        cSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        await colReq.doc(id).delete();
        await loadRequests();
      });
    }

    // Filters
    if ($statusFilter) {
      $statusFilter.addEventListener("change", function (e) {
        currentStatusFilter = e.target.value || "all";
        renderRequests();
      });
    }
    if ($applyDate) {
      $applyDate.addEventListener("click", function () {
        const s = $startDate?.value ? new Date($startDate.value) : null;
        const e = $endDate?.value ? new Date($endDate.value) : null;
        if (s && e && s > e) {
          alert("開始日期不可晚於結束日期");
          return;
        }
        currentStart = s;
        currentEnd = e;
        renderRequests();
      });
    }
    if ($clearDate) {
      $clearDate.addEventListener("click", function () {
        if ($startDate) $startDate.value = "";
        if ($endDate) $endDate.value = "";
        currentStart = null;
        currentEnd = null;
        renderRequests();
      });
    }

    // Export & Print (no inline <script> to avoid syntax errors)
    function buildHeaderHTML() {
      var sub = "全部期間 報修總表";
      if (currentStart || currentEnd) {
        var s = currentStart ? fmtDateOnly(currentStart) : "起";
        var e = currentEnd ? fmtDateOnly(currentEnd) : "今";
        sub = s + " 至 " + e + " 報修總表";
      }
      return (
        '<div class="print-header" style="text-align:center;margin-bottom:12px;">' +
        '<h1 style="font-size:20px;margin:0;font-weight:700;">安泰醫療社團法人附設安泰護理之家</h1>' +
        '<h2 style="font-size:16px;margin:6px 0 12px;font-weight:600;">' +
        sub +
        "</h2></div>"
      );
    }
    
    function buildFormalTableHTML(rows) {
      var thead =
        "<thead><tr><th>分類</th><th>位置</th><th>報修物品</th><th>詳細資訊</th><th>報修人</th><th>狀態</th><th>報修時間</th><th>備註</th></tr></thead>";
      var trows = rows
        .map(function (r) {
          var ts = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : null;
          return (
            "<tr>" +
            "<td>" + esc(r.category || "") + "</td>" +
            "<td>" + esc(r.location || "") + "</td>" +
            "<td>" + esc(r.item || "") + "</td>" +
            "<td>" + esc(r.detail || "") + "</td>" +
            "<td>" + esc(r.reporter || "") + "</td>" +
            "<td>" + esc(r.status || "") + "</td>" +
            "<td>" + (ts ? fmtTS({ toDate: function () { return ts; } }) : "") + "</td>" +
            "<td>" + esc(r.note || "") + "</td>" +
            "</tr>"
          );
        })
        .join("");
      return (
        '<table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">' +
        thead +
        "<tbody>" +
        trows +
        "</tbody></table>"
      );
    }

    function downloadURL(url, filename) {
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 0);
    }
    function buildFileName(base, ext) {
      var range = "全部期間";
      if (currentStart || currentEnd) {
        var s = currentStart ? fmtDateOnly(currentStart) : "起";
        var e = currentEnd ? fmtDateOnly(currentEnd) : "今";
        range = s + "至" + e;
      }
      return base + "_" + range + "." + ext;
    }

    if ($exportWord) {
      $exportWord.addEventListener("click", function () {
        var rows = getFiltered();
        var html =
          '<html><head><meta charset="UTF-8"><style>body{font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:6px 8px;}</style></head><body>' +
          buildHeaderHTML() +
          buildFormalTableHTML(rows) +
          "</body></html>";
        var blob = new Blob(["\ufeff", html], { type: "application/msword" });
        var url = URL.createObjectURL(blob);
        downloadURL(url, buildFileName("報修總表", "doc"));
      });
    }

    if ($exportExcel) {
      $exportExcel.addEventListener("click", function () {
        var rows = getFiltered();
        var html =
          '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>' +
          buildHeaderHTML() +
          buildFormalTableHTML(rows) +
          "</body></html>";
        var blob = new Blob(["\ufeff", html], {
          type: "application/vnd.ms-excel",
        });
        var url = URL.createObjectURL(blob);
        downloadURL(url, buildFileName("報修總表", "xls"));
      });
    }

    if ($print) {
      $print.addEventListener("click", function () {
        var rows = getFiltered();
        var html =
          '<html><head><meta charset="UTF-8"><title>列印 - 報修總表</title><style>@page{size:A4 landscape;margin:12mm;}body{font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:6px 8px;}.print-header{text-align:center;margin-bottom:12px;}.print-header h1{font-size:20px;margin:0;font-weight:700;}.print-header h2{font-size:16px;margin:6px 0 12px;font-weight:600;}</style></head><body>' +
          buildHeaderHTML() +
          buildFormalTableHTML(rows) +
          "</body></html>";
        var w = window.open("", "_blank");
        if (!w) return;
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.onload = function () {
          try {
            w.focus();
            w.print();
            setTimeout(function () { w.close(); }, 500);
          } catch (err) {
            console.warn(err);
          }
        };
      });
    }

    // Add Request (Modal)
    if ($addRequest) {
      $addRequest.addEventListener("click", async function () {
        // reset fields
        var detail = document.getElementById("detail");
        var reporter = document.getElementById("reporter");
        var note = document.getElementById("note");

        if ($categorySelect) $categorySelect.value = "";
        if ($locationSelect) $locationSelect.value = "";
        if ($itemSelect) $itemSelect.value = "";
        await refreshLocationAndItems();

        if (detail) detail.value = "";
        if (note) note.value = "";

        // reporter auto = login user (name preferred)
        if (reporter) reporter.value = loggedName || getLoggedUserLabel();

        if ($statusSelectInModal && $statusSelectInModal.options.length > 0) {
          // keep default option
        }
        if (addModal) addModal.show();
      });
    }


    if ($saveRequest) {
      $saveRequest.addEventListener("click", async function () {
        var category = ($categorySelect && $categorySelect.value) || "";
        var location = ($locationSelect && $locationSelect.value) || "";
        var item = ($itemSelect && $itemSelect.value) || "";
        var detail = (document.getElementById("detail")?.value || "").trim();
        var reporter = (document.getElementById("reporter")?.value || "").trim();
        var statusVal =
          ($statusSelectInModal && $statusSelectInModal.value) || "待處理";
        var note = (document.getElementById("note")?.value || "").trim();

        if (!category || !location || !item || !detail || !reporter) {
          alert("請輸入完整資料（分類/位置/報修物品/詳細資訊/報修人）");
          return;
        }

        // 重複申請偵測：比對「分類 + 位置 + 報修物品」，若已有未完成/未紀錄的相同申請，提醒確認
        try {
          var dupSnap = await colReq
            .where("category", "==", category)
            .where("location", "==", location)
            .where("item", "==", item)
            .orderBy("createdAt", "desc")
            .limit(10)
            .get();

          var isClosedStatus = function (s) {
            var v = String(s || "").trim();
            return v === "已完成" || v === "紀錄";
          };

          var dupDoc = null;
          dupSnap.forEach(function (d) {
            if (dupDoc) return;
            var data = d.data() || {};
            if (!isClosedStatus(data.status)) dupDoc = data;
          });

          if (dupDoc) {
            var dayText = "某天";
            try {
              if (dupDoc.createdAt && dupDoc.createdAt.toDate) {
                var dt = dupDoc.createdAt.toDate();
                var y = dt.getFullYear();
                var m = String(dt.getMonth() + 1).padStart(2, "0");
                var dd = String(dt.getDate()).padStart(2, "0");
                dayText = y + "-" + m + "-" + dd;
              }
            } catch (_) {}
            var ok = confirm(
              "偵測到 " +
                dayText +
                " 有一筆相同的報修資料（且狀態未結案），請確認是否重複申請。\n\n按「確定」仍要送出；按「取消」返回檢查。"
            );
            if (!ok) return;
          }
        } catch (err) {
          console.warn("duplicate check failed:", err);
          // 不中斷送出流程
        }


        await colReq.add({
          category: category,
          location: location,
          item: item,
          detail: detail,
          reporter: reporter,
          status: statusVal,
          note: note || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          comments: [], // legacy compatibility
        });
        if (addModal) addModal.hide();
        await loadRequests();
      });
    }


    // Init
    initModalSelects();
    await loadStatusesForAdmin(); // internally calls loadStatusesForRequests
    await loadRequests();
  }
})();
