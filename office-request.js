
/* ===== Global collections for both office & nurse sides ===== */
window.COL_LEAVE = "nurse_leave_requests";
window.COL_SWAP  = "nurse_shift_requests";

/**
 * office-request.js (Micronurse Office) — UPDATED FOR HOURS COLUMN
 * - Adds display column: 請假時數(小時) after "班別"
 * - A1 rule: if no explicit hours info in legacy data, show blank
 * - Keeps mirror to Annual Leave (特休) enabled
 * - Firebase v8 compatible
 */

(function () {
  const DB = () => firebase.firestore();
  const COL_LEAVE   = "nurse_leave_requests";
  const COL_SWAP    = "nurse_shift_requests";
  const COL_STATUS  = "request_status_list";
  const COL_ANNUAL  = "annual_leave_requests";
  const HOURS_PER_DAY = 8;

  const $ = (s) => document.querySelector(s);

  // ===== 登入者顯示（右上角）=====
  function getLoggedInUserName() {
    // ✅ 優先抓辦公室登入（office.html / office.js）使用的 sessionStorage: officeAuth
    // officeAuth 內容形如：{ staffId, displayName, username, canOffice, ... }
    try {
      const raw = sessionStorage.getItem('officeAuth');
      if (raw) {
        const u = JSON.parse(raw);
        const n = (u && (u.displayName || u.name || u.username)) ? String(u.displayName || u.name || u.username) : '';
        if (n && n.trim()) return n.trim();
      }
    } catch (e) {}

    // ✅ 其次抓護理端登入（如果此頁也會從護理端入口開）
    try {
      const raw = sessionStorage.getItem('nurseAuth');
      if (raw) {
        const u = JSON.parse(raw);
        const n = (u && (u.displayName || u.name || u.username)) ? String(u.displayName || u.name || u.username) : '';
        if (n && n.trim()) return n.trim();
      }
    } catch (e) {}

    // 盡量兼容你其他系統可能用的命名（不確定就多抓幾個）
    const candidates = [
      window.CURRENT_USER_NAME,
      window.LOGIN_USER_NAME,
      window.LOGIN_NAME,
      window.currentUserName,
      window.userName,
      window.loggedInUserName,
      (() => { try { return sessionStorage.getItem("loginName"); } catch(_) { return ""; } })(),
      (() => { try { return sessionStorage.getItem("loggedInUser"); } catch(_) { return ""; } })(),
      (() => { try { return sessionStorage.getItem("username"); } catch(_) { return ""; } })(),
      (() => { try { return localStorage.getItem("loginName"); } catch(_) { return ""; } })(),
      (() => { try { return localStorage.getItem("loggedInUser"); } catch(_) { return ""; } })(),
      (() => { try { return localStorage.getItem("username"); } catch(_) { return ""; } })(),
    ].filter(Boolean);

    return String(candidates[0] || "").trim();
  }

  function renderLoggedInUser() {
    const el = document.getElementById("loginUserName");
    if (!el) return;
    const name = getLoggedInUserName();
    el.textContent = name ? `登入者：${name}` : "登入者：未登入";
  }

  // 允許其他頁面在登入後用 event 通知更新（可選）
  window.addEventListener("user-changed", renderLoggedInUser);


  // ===== 員工清單（申請人下拉選單用） =====
  const EMP_COLLECTIONS = ["caregivers","localCaregivers","nurses","adminStaff"];  // 調整順序：外籍 → 台籍 → 護理師 → 行政
  let EMP_NAMES = []; // 只存姓名給辦公室端選擇

  async function loadEmployeeListForOffice() {
    const db = firebase.firestore();
    const snaps = await Promise.all(EMP_COLLECTIONS.map(c => db.collection(c).get()));
    const seen = new Set();
    EMP_NAMES = [];
    snaps.forEach(snap => {
      snap.forEach(doc => {
        const d = doc.data() || {};
        const name = d.name || "";
        if (!name || seen.has(name)) return;
        seen.add(name);
        EMP_NAMES.push(name);
      });
    });
    EMP_NAMES.sort(); // 排序一下比較好選
    fillApplicantDropdowns();
  }

  function fillApplicantDropdowns() {
    const leaveSel = document.getElementById("leaveApplicant");
    const swapSel  = document.getElementById("swapApplicant");
    const opts = ['<option value="">請選擇申請人</option>']
      .concat(EMP_NAMES.map(n => `<option value="${n}">${n}</option>`))
      .join("");
    if (leaveSel) leaveSel.innerHTML = opts;
    if (swapSel)  swapSel.innerHTML  = opts;
  }

  // ===== 主管簽名下拉（目前只有林淑菁） =====
  const SUPERVISORS = ["林淑菁"];

  function fillSupervisorSelectElement(sel, currentValue) {
    if (!sel) return;

    // ✅ 動態把「目前登入者」也加入可選清單（避免自動帶入時下拉找不到該名字）
    const loginName = (typeof getLoggedInUserName === "function") ? getLoggedInUserName() : "";
    const names = Array.from(new Set([loginName, ...(SUPERVISORS || [])].filter(Boolean)));

    let html = '<option value=""></option>';
    names.forEach(name => {
      const selected = (name === (currentValue || "")) ? "selected" : "";
      html += `<option value="${name}" ${selected}>${name}</option>`;
    });
    sel.innerHTML = html;
  }

    function initSupervisorDropdowns() {
    // leave & swap table 中的主管簽名欄位
    document.querySelectorAll("select.supervisor-sign").forEach(sel => {
      const cur = sel.getAttribute("data-supervisor") || "";
      fillSupervisorSelectElement(sel, cur);
    });

    // 編輯視窗（Modal）的主管簽名下拉
    const modalSel = document.getElementById("eSupervisorSign");
    if (modalSel) {
      fillSupervisorSelectElement(modalSel, modalSel.value || "");
    }
  }


  // ========= Utilities =========
  function ymd(dLike) {
    if (!dLike) return "";
    const d = new Date(dLike);
    if (isNaN(d)) {
      const s = String(dLike);
      return s.length >= 10 ? s.slice(0,10) : s;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function toISODate() {
    return new Date().toISOString();
  }
  function hoursFromPayload(d) {
    // Preferred explicit field
    if (typeof d.hoursUsed === "number" && d.hoursUsed > 0) return d.hoursUsed;

    // UI Mode A (number + unit)
    const val = Number(d.durationValue || d.hours || 0);
    const unit = String(d.durationUnit || d.unit || "").toLowerCase();
    if (val > 0) {
      if (unit === "hour" || unit === "hours" || unit === "小時") return val;
      if (unit === "day"  || unit === "days"  || unit === "天") return val * HOURS_PER_DAY;
      // if unit empty (legacy but has value), assume hours
      return val;
    }

    // Legacy half-day
    if (String(d.halfDay || "").toLowerCase() === "true") return 4;

    // If none -> undefined (A1: show blank)
    return undefined;
  }
  function getDisplayHoursText(d) {
    const h = hoursFromPayload(d);
    if (typeof h === "number" && h >= 0) return `${h} 小時`;
    return ""; // A1 rule
  }
  function getStatusColor(name, list) {
    const s = list.find(x => x.name === name);
    return s ? s.color : "#6c757d";
  }

  // ========= Status List =========
  let STATUS_LIST = [];
  async function loadStatuses() {
    const statusCol = firebase.firestore().collection(COL_STATUS);
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    STATUS_LIST = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const optionHTML = STATUS_LIST.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    ["leaveStatusSelect","swapStatusSelect","leaveStatusFilter","swapStatusFilter"].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.innerHTML = `<option value="">全部</option>${optionHTML}`;
    });

    const statusBody = document.getElementById("statusTableBody");
    if (statusBody) {
      statusBody.innerHTML = STATUS_LIST.map(s => `
        <tr>
          <td>${s.name}</td>
          <td><span class="badge" style="background:${s.color};color:#fff;">${s.color}</span></td>
        </tr>
      `).join("");
    }
  }

  // ========= Rendering (Leave / Swap) =========
  function inDateRange(targetDate, start, end) {
    if (!targetDate) return true;
    const t = new Date(targetDate);
    if (start) { const s = new Date(start); if (t < s) return false; }
    if (end)   { const e = new Date(end);   if (t > e) return false; }
    return true;
  }

  async function loadLeaveRequests() {
    const leaveBody = document.getElementById("leaveTableBody");
    if (!leaveBody) return;
    leaveBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">載入中...</td></tr>`;
    const db = firebase.firestore();
    const snap = await db.collection(COL_LEAVE).orderBy("applyDate", "desc").get();
    const start = $("#leaveStartDate")?.value;
    const end   = $("#leaveEndDate")?.value;
    const filterStatus = $("#leaveStatusFilter")?.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!inDateRange(d.leaveDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status || "", STATUS_LIST);
      const hoursText = getDisplayHoursText(d); // "" if not available

      rows += `
        <tr data-id="${doc.id}">
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.leaveType || ""}</td>
          <td>${d.leaveDate || ""}</td>
          <td>${d.shift || ""}</td>
          <td>${hoursText}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}" style="background:${color};color:#fff;">
              ${STATUS_LIST.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><select class="form-select form-select-sm supervisor-sign" data-id="${doc.id}" data-supervisor="${d.supervisorSign || ""}"></select></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-sm btn-outline-primary me-1 edit-leave" data-id="${doc.id}"><i class="fa-solid fa-pen"></i></button>
<button class="btn btn-danger btn-sm delete-leave" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    leaveBody.innerHTML = rows || `<tr><td colspan="11" class="text-center text-muted">沒有符合的資料</td></tr>`;
    initSupervisorDropdowns();
  }

  async function loadSwapRequests() {
    const swapBody = document.getElementById("swapTableBody");
    if (!swapBody) return;
    swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const db = firebase.firestore();
    const snap = await db.collection(COL_SWAP).orderBy("applyDate", "desc").get();
    const start = $("#swapStartDate")?.value;
    const end   = $("#swapEndDate")?.value;
    const filterStatus = $("#swapStatusFilter")?.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!inDateRange(d.swapDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status || "", STATUS_LIST);
      rows += `
        <tr data-id="${doc.id}">
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.swapDate || ""}</td>
          <td>${d.originalShift || ""}</td>
          <td>${d.newShift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}" style="background:${color};color:#fff;">
              ${STATUS_LIST.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><select class="form-select form-select-sm supervisor-sign" data-id="${doc.id}" data-supervisor="${d.supervisorSign || ""}"></select></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-sm btn-outline-primary me-1 edit-swap" data-id="${doc.id}"><i class="fa-solid fa-pen"></i></button>
<button class="btn btn-danger btn-sm delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    swapBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
    initSupervisorDropdowns();
  }

  // ========= Create Leave/Swap (with mixed duration support if fields exist) =========
  async function handleAddLeave(e) {
    e.preventDefault();
    const f = e.target;
    const db = firebase.firestore();

    const amountInput = f.querySelector('[name="durationValue"]') || $("#leaveAmount");
    const unitSelect  = f.querySelector('[name="durationUnit"]')  || $("#leaveUnit");

    let durationValue = amountInput ? Number(amountInput.value || "0") : 0;
    let durationUnit  = unitSelect  ? (unitSelect.value || "").toLowerCase() : "";

    if (!(durationValue > 0)) {
      // default to 1 day only if no UI fields exist; but since UI has field, keep 0 -> will be ignored in display
      if (!amountInput) { durationValue = 1; durationUnit = "day"; }
    }

    const payload = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: f.leaveType.value,
      leaveDate: f.leaveDate.value,
      shift: f.shift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: "",
      durationValue,
      durationUnit,
      hoursUsed: (durationValue > 0)
        ? (durationUnit && durationUnit.startsWith("day") ? durationValue * HOURS_PER_DAY : durationValue)
        : undefined,
      createdAt: toISODate()
    };

    await db.collection(COL_LEAVE).add(payload);
    f.reset();
    alert("✅ 已新增請假單");
  }

  async function handleAddSwap(e) {
    e.preventDefault();
    const f = e.target;
    const db = firebase.firestore();
    const payload = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: f.swapDate.value,
      originalShift: f.originalShift.value,
      newShift: f.newShift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: "",
      createdAt: toISODate()
    };
    await db.collection(COL_SWAP).add(payload);
    f.reset();
    alert("✅ 已新增調班單");
  }

  // ========= Mirror Sync to Annual Leave (特休) =========
  const _empIdCache = Object.create(null);

  // ★ 支援 caregivers / localCaregivers / nurses / adminStaff 四種來源
  const COLLECTIONS_FOR_ID = ["caregivers","localCaregivers","nurses","adminStaff"];
  async function resolveEmpIdByName(name) {
    if (!name) return "";
    if (_empIdCache[name]) return _empIdCache[name];
    const db = firebase.firestore();
    for (const col of COLLECTIONS_FOR_ID) {
      const q = await db.collection(col).where("name","==",name).limit(1).get();
      if (!q.empty) {
        const doc = q.docs[0];
        const data = doc.data() || {};
        const id = data.empId || data.id || doc.id || "";
        if (id) {
          _empIdCache[name] = id;
          return id;
        }
      }
    }
    return "";
  }

  async function upsertAnnualBySource(sourceDocId, d) {
    const db = firebase.firestore();
    const al = db.collection(COL_ANNUAL);
    const found = await al.where("sourceDocId","==",sourceDocId).limit(1).get();
    const empId = d.employeeId || d.empId || d.applicantId || await resolveEmpIdByName(d.applicant || d.name);
    // compute hours but DO NOT default to HOURS_PER_DAY for display rule; annual_leave needs numeric though
    let hrs = hoursFromPayload(d);
    if (typeof hrs !== "number") hrs = 0; // in annual_leave, store 0 if missing

    const payload = {
      sourceDocId,
      source: "請假系統",
      applyDate: d.applyDate || ymd(d.createdAt || toISODate()),
      applicant: d.applicant || d.name || "",
      empId: empId || "",
      leaveType: d.leaveType || "特休",
      leaveDate: ymd(d.leaveDate || d.date),
      shift: d.shift || "",
      reason: d.reason || "",
      status: d.status || "審核通過",
      supervisorSign: d.supervisorSign || "",
      note: d.note || "",
      hoursUsed: hrs,
      daysUsed: (hrs / HOURS_PER_DAY),
      createdAt: d.createdAt || toISODate(),
      updatedAt: toISODate()
    };
    if (!payload.applicant || !payload.leaveDate) {
      console.warn("[mirror] skip upsert: missing required fields", payload);
      return false;
    }
    await al.doc(sourceDocId).set(payload, { merge: true });
    return true;
  }

  async function deleteAnnualBySource(sourceDocId) {
    const db = firebase.firestore();
    const al = db.collection(COL_ANNUAL);
    const snap = await al.where("sourceDocId","==",sourceDocId).get();
    if (snap.empty) return false;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }

  function bindMirrorRealtime() {
    const db = firebase.firestore();
    db.collection(COL_LEAVE).onSnapshot(snap => {
      snap.docChanges().forEach(async chg => {
        const id = chg.doc.id;
        const d  = chg.doc.data() || {};
        const type = (d.leaveType || "").trim();
        if (type !== "特休") return; // only mirror annual leave

        if (chg.type === "removed") {
          await deleteAnnualBySource(id);
          return;
        }

        const status = (d.status || "").trim();
        if (status === "審核通過") {
          await upsertAnnualBySource(id, d);
        } else {
          await deleteAnnualBySource(id);
        }
      });
    });
  }

  // ========= Inline updates (with debounce) =========
  const _debounceTimers = Object.create(null);
  function debounceUpdate(key, delay, fn) {
    if (_debounceTimers[key]) clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(() => {
      delete _debounceTimers[key];
      try { fn(); } catch (e) { console.error("debounceUpdate error:", e); }
    }, delay);
  }

  async function updateRequestFieldSmart(id, patch) {
    const db = firebase.firestore();
    const leaveDoc = await db.collection(COL_LEAVE).doc(id).get();
    if (leaveDoc.exists) {
      await leaveDoc.ref.update(patch);
      return "leave";
    }
    const swapDoc = await db.collection(COL_SWAP).doc(id).get();
    if (swapDoc.exists) {
      await swapDoc.ref.update(patch);
      return "swap";
    }
    return "none";
  }

  function bindInlineEditors() {
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("note-area")) {
        const id = e.target.dataset.id;
        const value = e.target.value;
        debounceUpdate(`note-${id}`, 800, async () => {
          await updateRequestFieldSmart(id, { note: value });
        });
      }
    });

    document.addEventListener("change", async (e) => {
      if (e.target.classList.contains("supervisor-sign")) {
        const id = e.target.dataset.id;
        const value = e.target.value;
        debounceUpdate(`sup-${id}`, 100, async () => {
          await updateRequestFieldSmart(id, { supervisorSign: value });
        });
      }
      if (e.target.classList.contains("status-select")) {
        const id = e.target.dataset.id;
        const value = e.target.value;

        const color = (STATUS_LIST.find(s => s.name === value)?.color) || "#6c757d";
        e.target.style.background = color;
        e.target.style.color = "#fff";

        // ✅ 狀態被變更時，自動把主管簽名帶入「目前登入者」
        const loginName = getLoggedInUserName();
        const patch = { status: value };

        if (loginName) {
          patch.supervisorSign = loginName;

          const tr = e.target.closest("tr");
          const supSel = tr ? tr.querySelector("select.supervisor-sign") : null;
          if (supSel) {
            // 確保下拉裡有登入者的名字可選
            const hasOpt = Array.from(supSel.options || []).some(o => o.value === loginName);
            if (!hasOpt) {
              const opt = document.createElement("option");
              opt.value = loginName;
              opt.textContent = loginName;
              // 插在空白選項後面（若存在）
              if (supSel.options && supSel.options.length > 0) {
                supSel.insertBefore(opt, supSel.options[1] || null);
              } else {
                supSel.appendChild(opt);
              }
            }
            supSel.value = loginName;
          }
        }

        await updateRequestFieldSmart(id, patch);
      }
    });
  }

  // ========= Delete buttons =========
  function bindDeleteButtons() {
    document.addEventListener("click", async (e) => {
      const btnLeave = e.target.closest(".delete-leave");
      const btnSwap  = e.target.closest(".delete-swap");
      if (btnLeave) {
        const id = btnLeave.dataset.id;
        if (confirm("確定要刪除此請假單？")) {
          await firebase.firestore().collection(COL_LEAVE).doc(id).delete();
        }
      }
      if (btnSwap) {
        const id = btnSwap.dataset.id;
        if (confirm("確定要刪除此調班單？")) {
          await firebase.firestore().collection(COL_SWAP).doc(id).delete();
        }
      }
    });
  }

  // ========= Export & Print =========
  // ========= Export (Styled .xlsx via ExcelJS; fallback to XLSX table export) =========
  function _cmToIn(cm){ return cm / 2.54; }

  function _ensureExcelJs(){
    if (typeof ExcelJS === "undefined" || typeof saveAs === "undefined") return false;
    return true;
  }

  function _collectTableData(tableId){
    const table = document.getElementById(tableId);
    if (!table) return { headers: [], rows: [] };

    // headers
    const ths = [...table.querySelectorAll("thead th")].filter(th => !th.classList.contains("no-print"));
    const headers = ths.map(th => (th.textContent || "").trim());

    // rows
    const rows = [...table.querySelectorAll("tbody tr")].map(tr => {
      const tds = [...tr.children].filter(td => !td.classList.contains("no-print"));
      return tds.map(td => {
        // If contains select/input/textarea, extract value
        const sel = td.querySelector("select");
        if (sel) return (sel.value || sel.options?.[sel.selectedIndex]?.text || "").trim();
        const inp = td.querySelector("input");
        if (inp) return (inp.value || "").trim();
        const ta = td.querySelector("textarea");
        if (ta) return (ta.value || "").trim();
        return (td.textContent || "").trim();
      });
    }).filter(r => r.length && !r.join("").includes("沒有符合的資料") && !r.join("").includes("載入中"));

    return { headers, rows };
  }

  async function exportStyledXlsx({ tableId, filename, sheetName, title }) {
    // Prefer ExcelJS styled export; fallback to legacy XLSX table export
    if (!_ensureExcelJs()) {
      exportTableToExcel(tableId, filename.replace(/\.xlsx$/i, "") + ".xlsx");
      return;
    }

    const { headers, rows } = _collectTableData(tableId);
    if (!headers.length) {
      alert("找不到可匯出的表格資料");
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Micronurse Office";
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName || "Sheet1", {
      properties: { defaultRowHeight: 20 },
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          top: _cmToIn(1.5),
          bottom: _cmToIn(1.5),
          left: _cmToIn(1.5),
          right: _cmToIn(1.5),
          header: _cmToIn(0.8),
          footer: _cmToIn(0.8)
        }
      },
      views: [{ state: "frozen", ySplit: 2 }] // freeze title + header
    });

    // Title row
    const titleText = title || filename.replace(/\.xlsx$/i, "");
    ws.mergeCells(1, 1, 1, headers.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = titleText;
    titleCell.font = { name: "Microsoft JhengHei", size: 16, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Header row
    ws.addRow(headers);
    const headerRow = ws.getRow(2);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Microsoft JhengHei", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      };
    });

    // Data rows
    rows.forEach(r => ws.addRow(r));
    for (let i = 3; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      row.height = 36; // allow wrap
      row.eachCell((cell) => {
        cell.font = { name: "Microsoft JhengHei", size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" }
        };
      });
    }

    // Column widths (make it roomy; tweak based on header text)
    const widthMap = {
      "申請日期": 14, "申請人": 14, "假別": 12, "請假日期": 14, "班別": 12,
      "請假時數(小時)": 16, "理由": 30, "狀態": 14, "主管簽名": 14, "註解": 30,
      "調班日期": 14, "原班別": 14, "欲換班別": 14
    };
    ws.columns = headers.map(h => ({ width: widthMap[h] || 18 }));

    // Save
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  }

  function exportTableToExcel(tableId, filename) {
    // ✅ 防呆：避免 XLSX 沒載入導致 XLSX is not defined
    if (typeof XLSX === "undefined") {
      alert("⚠️ 匯出功能需要載入 Excel 函式庫（XLSX）。\n請確認 office-request.html 已加入 xlsx.full.min.js，或重新整理再試一次。");
      console.error("XLSX is not defined. Please include https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js before office-request.js");
      return;
    }

    const table = document.getElementById(tableId).cloneNode(true);
    table.querySelectorAll(".no-print").forEach(e => e.remove());
    table.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }
  function bindExportPrint() {
    $("#exportLeaveExcel")?.addEventListener("click", () => exportStyledXlsx({ tableId: "leaveTable", filename: "請假紀錄.xlsx", sheetName: "請假紀錄", title: "請假紀錄表" }));
    $("#exportSwapExcel") ?.addEventListener("click", () => exportStyledXlsx({ tableId: "swapTable",  filename: "調班紀錄.xlsx", sheetName: "調班紀錄", title: "調班紀錄表" }));
$("#printLeaveTable")?.addEventListener("click", () => {
      const clone = document.getElementById("leaveTable").cloneNode(true);
      clone.querySelectorAll(".no-print").forEach(e => e.remove());
      clone.querySelectorAll("select, input, textarea").forEach(el => {
        const text = el.value || el.options?.[el.selectedIndex]?.text || "";
        el.replaceWith(document.createTextNode(text));
      });
      const content = clone.outerHTML;
      const w = window.open("", "_blank");
      w.document.write(`
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
      w.document.close();
      w.print();
    });

    $("#printSwapTable")?.addEventListener("click", () => {
      const clone = document.getElementById("swapTable").cloneNode(true);
      clone.querySelectorAll(".no-print").forEach(e => e.remove());
      clone.querySelectorAll("select, input, textarea").forEach(el => {
        const text = el.value || el.options?.[el.selectedIndex]?.text || "";
        el.replaceWith(document.createTextNode(text));
      });
      const content = clone.outerHTML;
      const w = window.open("", "_blank");
      w.document.write(`
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
      w.document.close();
      w.print();
    });
  }

  // ========= Init =========
  document.addEventListener("firebase-ready", async () => {
    renderLoggedInUser();
    await loadEmployeeListForOffice();
    await loadStatuses();
    await loadLeaveRequests();
    await loadSwapRequests();

    $("#filterLeave")?.addEventListener("click", loadLeaveRequests);
    $("#filterSwap") ?.addEventListener("click", loadSwapRequests);

    $("#addLeaveForm")?.addEventListener("submit", handleAddLeave);
    $("#addSwapForm") ?.addEventListener("submit", handleAddSwap);

    bindInlineEditors();
    bindDeleteButtons();
    bindExportPrint();
    bindMirrorRealtime();

    // Realtime refresh (only when added/removed or status changed)
    firebase.firestore().collection(COL_LEAVE).onSnapshot((snap) => {
      let shouldRefresh = false;
      snap.docChanges().forEach(chg => {
        if (chg.type === "added" || chg.type === "removed") shouldRefresh = true;
        if (chg.type === "modified") {
          const afterStatus = chg.doc.data().status;
          // If status changed, refresh to update color
          if (afterStatus !== undefined) shouldRefresh = true;
        }
      });
      if (shouldRefresh) loadLeaveRequests();
    });

    firebase.firestore().collection(COL_SWAP).onSnapshot((snap) => {
      let shouldRefresh = false;
      snap.docChanges().forEach(chg => {
        if (chg.type === "added" || chg.type === "removed") shouldRefresh = true;
        if (chg.type === "modified") {
          const afterStatus = chg.doc.data().status;
          if (afterStatus !== undefined) shouldRefresh = true;
        }
      });
      if (shouldRefresh) loadSwapRequests();
    });
  });
})();



// ========= Edit Modal (full edit with dropdown leaveType) =========
let editModal;

function fillStatusSelectForModal(current) {
  try {
    const sel = document.getElementById("eStatus");
    if (!sel) return;
    if (typeof STATUS_LIST !== 'undefined' && Array.isArray(STATUS_LIST)) {
      sel.innerHTML = STATUS_LIST.map(s =>
        `<option value="${s.name}" ${current === s.name ? "selected": ""}>${s.name}</option>`
      ).join("");
    } else {
      const fallback = ['待審核','審核通過','退回'];
      sel.innerHTML = fallback.map(n => `<option value="${n}" ${current===n?'selected':''}>${n}</option>`).join("");
    }
  } catch (e) { console.error(e); }
}

async function openEdit(kind, id) {
  try {
    const db = firebase.firestore();
    const col = kind === "leave" ? COL_LEAVE : COL_SWAP;
    const snap = await db.collection(col).doc(id).get();
    if (!snap.exists) return alert("找不到資料");
    const d = snap.data() || {};

    document.getElementById("editReqTitle").textContent = kind === "leave" ? "編輯請假單" : "編輯調班單";
    document.getElementById("editReqId").value   = id;
    document.getElementById("editReqType").value = kind;

    // 共用
    document.getElementById("eApplicant").value      = d.applicant || "";
    document.getElementById("eApplyDate").value      = d.applyDate || (new Date().toISOString().slice(0,10));
    document.getElementById("eReason").value         = d.reason || "";
    document.getElementById("eSupervisorSign").value = d.supervisorSign || "";
    document.getElementById("eNote").value           = d.note || "";
    fillStatusSelectForModal(d.status || "");

    // 請假
    document.getElementById("eLeaveType").value = d.leaveType || "";
    document.getElementById("eLeaveDate").value = d.leaveDate || "";
    document.getElementById("eShift").value     = d.shift || "";
    const hrs = (typeof d.durationValue === "number") ? d.durationValue
              : (typeof d.hoursUsed === "number" ? d.hoursUsed
              : (typeof d.hours === "number" ? d.hours : ""));
    document.getElementById("eHours").value = hrs;

    // 調班
    document.getElementById("eSwapDate").value      = d.swapDate || "";
    document.getElementById("eOriginalShift").value = d.originalShift || "";
    document.getElementById("eNewShift").value      = d.newShift || "";

    if (!editModal) editModal = new bootstrap.Modal(document.getElementById("editReqModal"));
    editModal.show();
  } catch (e) { console.error(e); alert("讀取資料時發生錯誤"); }
}

function bindEditModal() {
  document.addEventListener("click", (e) => {
    const b1 = e.target.closest(".edit-leave");
    const b2 = e.target.closest(".edit-swap");
    if (b1)  openEdit("leave", b1.dataset.id);
    if (b2)  openEdit("swap",  b2.dataset.id);
  });

  const form = document.getElementById("editReqForm");
  if (form) form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const id   = document.getElementById("editReqId").value;
      const kind = document.getElementById("editReqType").value;
      const db   = firebase.firestore();
      const col  = kind === "leave" ? COL_LEAVE : COL_SWAP;

      const patch = {
        applicant:      document.getElementById("eApplicant").value.trim(),
        applyDate:      document.getElementById("eApplyDate").value,
        status:         document.getElementById("eStatus").value,
        reason:         document.getElementById("eReason").value.trim(),
        supervisorSign: document.getElementById("eSupervisorSign").value.trim(),
        note:           document.getElementById("eNote").value.trim(),
      };

      if (kind === "leave") {
        patch.leaveType = document.getElementById("eLeaveType").value;
        patch.leaveDate = document.getElementById("eLeaveDate").value;
        patch.shift     = document.getElementById("eShift").value.trim();
        const hoursVal  = document.getElementById("eHours").value;
        const hnum = Number(hoursVal);
        if (!isNaN(hnum) && hnum >= 0) {
          patch.durationValue = hnum;
          patch.durationUnit  = "hour";
          patch.hoursUsed     = hnum; // 兼容舊資料顯示
        } else {
          patch.durationValue = null;
          patch.durationUnit  = "hour";
        }
      } else {
        patch.swapDate      = document.getElementById("eSwapDate").value;
        patch.originalShift = document.getElementById("eOriginalShift").value.trim();
        patch.newShift      = document.getElementById("eNewShift").value.trim();
      }

      await db.collection(col).doc(id).update(patch);

      if (typeof loadLeaveRequests === 'function' && kind === "leave") await loadLeaveRequests();
      if (typeof loadSwapRequests  === 'function' && kind === "swap")  await loadSwapRequests();
      editModal?.hide();
      alert("✅ 已更新");
    } catch (e) { console.error(e); alert("儲存時發生錯誤"); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try { bindEditModal(); } catch(e) { console.error(e); }
  try { if (typeof renderLoggedInUser === 'function') renderLoggedInUser(); } catch(e) { console.error(e); }
});


/* ===== Edit Modal & Button Injection (uses firebase.firestore, global collections) ===== */
(function(){
  const LEAVE_COL = window.COL_LEAVE || "nurse_leave_requests";
  const SWAP_COL  = window.COL_SWAP  || "nurse_shift_requests";

  function qs(sel){ return document.querySelector(sel); }

  function fillStatusSelectForModal(current){
    try{
      const sel = document.getElementById("eStatus");
      if (!sel) return;
      if (typeof window.STATUS_LIST !== 'undefined' && Array.isArray(window.STATUS_LIST)){
        sel.innerHTML = window.STATUS_LIST.map(s => 
          `<option value="${s.name}" ${current===s.name?'selected':''}>${s.name}</option>`
        ).join("");
      }else{
        const fallback = ['待審核','審核通過','退回'];
        sel.innerHTML = fallback.map(n => `<option value="${n}" ${current===n?'selected':''}>${n}</option>`).join("");
      }
    }catch(e){ console.error(e); }
  }

  async function openEdit(kind, id){
    try{
      const db  = firebase.firestore();
      const col = (kind === 'leave') ? LEAVE_COL : SWAP_COL;
      const doc = await db.collection(col).doc(id).get();
      if(!doc.exists){ alert("找不到資料（ID："+id+"）"); return; }
      const d = doc.data() || {};

      // Set title
      qs("#editReqTitle").textContent = (kind==='leave') ? "編輯請假單" : "編輯調班單";
      qs("#editReqId").value   = id;
      qs("#editReqType").value = kind;

      // Common
      qs("#eApplicant").value      = d.applicant || "";
      qs("#eApplyDate").value      = (d.applyDate || "").toString().slice(0,10);
      qs("#eReason").value         = d.reason || "";
      qs("#eSupervisorSign").value = d.supervisorSign || "";
      qs("#eNote").value           = d.note || "";
      fillStatusSelectForModal(d.status || "");

      // Leave
      qs("#eLeaveType").value = d.leaveType || "";
      qs("#eLeaveDate").value = (d.leaveDate || "").toString().slice(0,10);
      qs("#eShift").value     = d.shift || "";
      const hrs = (typeof d.durationValue === "number") ? d.durationValue
                : (typeof d.hoursUsed === "number") ? d.hoursUsed
                : (typeof d.hours === "number") ? d.hours : "";
      qs("#eHours").value = hrs;

      // Swap
      qs("#eSwapDate").value      = (d.swapDate || "").toString().slice(0,10);
      qs("#eOriginalShift").value = d.originalShift || "";
      qs("#eNewShift").value      = d.newShift || "";

      window.__editModalInstance = window.__editModalInstance || new bootstrap.Modal(document.getElementById("editReqModal"));
      window.__editModalInstance.show();
    }catch(e){
      console.error(e);
      alert("讀取資料時發生錯誤");
    }
  }

  function bindEditModal(){
    // Open handlers
    document.addEventListener("click", (e)=>{
      const el = e.target.closest(".edit-leave, .edit-swap");
      if(!el) return;
      if(el.classList.contains("edit-leave")) openEdit("leave", el.dataset.id);
      if(el.classList.contains("edit-swap"))  openEdit("swap",  el.dataset.id);
    });

    // Save
    const form = document.getElementById("editReqForm");
    if(form) form.addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      try{
        const id   = qs("#editReqId").value;
        const kind = qs("#editReqType").value;
        const db   = firebase.firestore();
        const col  = (kind==='leave') ? LEAVE_COL : SWAP_COL;

        const patch = {
          applicant:      qs("#eApplicant").value.trim(),
          applyDate:      qs("#eApplyDate").value,
          status:         qs("#eStatus").value,
          reason:         qs("#eReason").value.trim(),
          supervisorSign: qs("#eSupervisorSign").value.trim(),
          note:           qs("#eNote").value.trim(),
        };

        if(kind==='leave'){
          patch.leaveType = qs("#eLeaveType").value;
          patch.leaveDate = qs("#eLeaveDate").value;
          patch.shift     = qs("#eShift").value.trim();
          const hnum = Number(qs("#eHours").value);
          if(!isNaN(hnum) && hnum >= 0){
            patch.durationValue = hnum;
            patch.durationUnit  = "hour";
            patch.hoursUsed     = hnum; // legacy display support
          }
        }else{
          patch.swapDate      = qs("#eSwapDate").value;
          patch.originalShift = qs("#eOriginalShift").value.trim();
          patch.newShift      = qs("#eNewShift").value.trim();
        }

        await db.collection(col).doc(id).update(patch);
        window.__editModalInstance?.hide();
        // 🔥 避免Modal遮罩殘留造成畫面無法操作
        setTimeout(() => {
          document.body.classList.remove('modal-open');
          document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        }, 200);
        if(kind==='leave' && typeof window.loadLeaveRequests==='function') window.loadLeaveRequests();
        if(kind==='swap'  && typeof window.loadSwapRequests==='function')  window.loadSwapRequests();
        alert("✅ 已更新");
      }catch(e){ console.error(e); alert("儲存時發生錯誤"); }
    });
  }
    // ===== 防止Modal關閉後遮罩卡住 =====
    document.addEventListener("click", (e) => {
      // 點取消按鈕
      if (e.target.matches("#editReqModal .btn-secondary, #editReqModal [data-bs-dismiss='modal']")) {
        setTimeout(() => {
          document.body.classList.remove("modal-open");
          document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
        }, 200);
      }
    });
    
    // 當Modal完全關閉時，也再清一次（Bootstrap事件）
    document.getElementById("editReqModal")?.addEventListener("hidden.bs.modal", () => {
      setTimeout(() => {
        document.body.classList.remove("modal-open");
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
      }, 150);
    });

  // Inject edit buttons before delete buttons (supports multiple class names)
  function injectEditButtons(){
    const selectors = [
      // leave delete
      'button.delete-leave','button.deleteLeave',
      // swap delete
      'button.delete-swap','button.deleteSwap'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(btn => {
      const isSwap = btn.classList.contains('delete-swap') || btn.classList.contains('deleteSwap');
      const editClass = isSwap ? 'edit-swap' : 'edit-leave';
      if (btn.previousElementSibling && btn.previousElementSibling.classList.contains(editClass)) return;
      const id = btn.dataset.id || btn.closest('tr')?.dataset?.id || '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn-sm btn-outline-primary me-1 ${editClass}`;
      b.dataset.id = id;
      b.textContent = '✏️';
      btn.parentNode.insertBefore(b, btn);
    });
  }

  // Observe DOM to re-inject after rerender
  const mo = new MutationObserver(() => injectEditButtons());

  document.addEventListener('DOMContentLoaded', () => {
    bindEditModal();
    injectEditButtons();
    mo.observe(document.body, { childList:true, subtree:true });
  });
})();
