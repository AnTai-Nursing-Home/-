/**
 * office-request.js (Micronurse Office) — FINAL
 * - Mixed mode leave duration (day/half-day/custom hours) — UI Mode A compatible
 * - Mirror sync to Annual Leave: upsert on approve, delete on unapprove/remove
 * - Debounce updates for supervisorSign/note (0.8s) so typing won't be interrupted
 * - Uses collection names from your current app:
 *   nurse_leave_requests, nurse_shift_requests, request_status_list
 * - Year-end friendly: all timestamps in YYYY-MM-DD or ISO
 *
 * Requires: firebase v8, XLSX (if you use export), and your existing HTML (office-request.html).
 * Author: ChatGPT — build 2025-11-02
 */

(function () {
  const DB = () => firebase.firestore();
  const COL_LEAVE   = "nurse_leave_requests";
  const COL_SWAP    = "nurse_shift_requests";
  const COL_STATUS  = "request_status_list";
  const COL_ANNUAL  = "annual_leave_requests";
  const HOURS_PER_DAY = 8;

  const $ = (s) => document.querySelector(s);

  // ========= Utilities =========
  function ymd(dLike) {
    if (!dLike) return "";
    const d = new Date(dLike);
    if (isNaN(d)) {
      // maybe it's already 'YYYY-MM-DD'
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

    // New UI Mode A (number + unit) — look for durationValue/durationUnit
    const val = Number(d.durationValue || d.hours || 0);
    const unit = String(d.durationUnit || d.unit || "").toLowerCase();
    if (val > 0) {
      if (unit === "hour" || unit === "hours" || unit === "小時") return val;
      if (unit === "day"  || unit === "days"  || unit === "天") return val * HOURS_PER_DAY;
    }

    // Legacy half-day/whole-day flags (if any)
    if (String(d.halfDay || "").toLowerCase() === "true") return 4;

    // Default to 1 day (your current behavior)
    return HOURS_PER_DAY;
  }
  function dayHourText(hours) {
    const neg = hours < 0;
    const H = Math.abs(Number(hours) || 0);
    const d = Math.floor(H / HOURS_PER_DAY);
    const h = H % HOURS_PER_DAY;
    const txt = (d ? `${d} 天` : "") + (h ? (d ? " " : "") + `${h} 小時` : (d ? "" : "0 小時"));
    return neg ? `-${txt}` : txt;
  }

  // ========= Status List =========
  let STATUS_LIST = [];
  async function loadStatuses() {
    const statusCol = DB().collection(COL_STATUS);
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
  function getStatusColor(name) {
    const s = STATUS_LIST.find(x => x.name === name);
    return s ? s.color : "#6c757d";
  }

  // ========= Debounce helper (to avoid typing being interrupted) =========
  const _debounceTimers = Object.create(null);
  function debounceUpdate(key, delay, fn) {
    if (_debounceTimers[key]) clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(() => {
      delete _debounceTimers[key];
      try { fn(); } catch (e) { console.error("debounceUpdate error:", e); }
    }, delay);
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
    leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const db = DB();
    const snap = await db.collection(COL_LEAVE).orderBy("applyDate", "desc").get();
    const start = $("#leaveStartDate")?.value;
    const end   = $("#leaveEndDate")?.value;
    const filterStatus = $("#leaveStatusFilter")?.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!inDateRange(d.leaveDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status);
      rows += `
        <tr data-id="${doc.id}">
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.leaveType || ""}</td>
          <td>${d.leaveDate || ""}</td>
          <td>${d.shift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}" style="background:${color};color:#fff;">
              ${STATUS_LIST.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-leave" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    leaveBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  async function loadSwapRequests() {
    const swapBody = document.getElementById("swapTableBody");
    if (!swapBody) return;
    swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const db = DB();
    const snap = await db.collection(COL_SWAP).orderBy("applyDate", "desc").get();
    const start = $("#swapStartDate")?.value;
    const end   = $("#swapEndDate")?.value;
    const filterStatus = $("#swapStatusFilter")?.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!inDateRange(d.swapDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status);
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
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    swapBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  // ========= Create Leave/Swap (with mixed duration support if fields exist) =========
  async function handleAddLeave(e) {
    e.preventDefault();
    const f = e.target;
    const db = DB();

    // Optional mixed-mode fields (UI Mode A)
    const amountInput = f.querySelector('[name="durationValue"]') || $("#leaveAmount");
    const unitSelect  = f.querySelector('[name="durationUnit"]')  || $("#leaveUnit");

    let durationValue = amountInput ? Number(amountInput.value || "0") : 0;
    let durationUnit  = unitSelect  ? (unitSelect.value || "").toLowerCase() : "";

    // Backward compatible defaults
    if (!(durationValue > 0)) {
      // If no UI fields, default to 1 day
      durationValue = 1;
      durationUnit = "day";
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
      hoursUsed: durationUnit.startsWith("day") ? durationValue * HOURS_PER_DAY :
                 durationUnit.startsWith("小時") || durationUnit.startsWith("hour") ? durationValue : HOURS_PER_DAY,
      createdAt: toISODate()
    };

    await db.collection(COL_LEAVE).add(payload);
    f.reset();
    alert("✅ 已新增請假單");
  }

  async function handleAddSwap(e) {
    e.preventDefault();
    const f = e.target;
    const db = DB();
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

  // ========= Mirror Sync to Annual Leave =========
  const _empIdCache = Object.create(null);
  async function resolveEmpIdByName(name) {
    if (!name) return "";
    if (_empIdCache[name]) return _empIdCache[name];
    const db = DB();
    let q = await db.collection("nurses").where("name","==",name).limit(1).get();
    if (!q.empty) {
      const id = q.docs[0].data().empId || q.docs[0].data().id || q.docs[0].id || "";
      if (id) return (_empIdCache[name] = id);
    }
    q = await db.collection("caregivers").where("name","==",name).limit(1).get();
    if (!q.empty) {
      const id = q.docs[0].data().empId || q.docs[0].data().id || q.docs[0].id || "";
      if (id) return (_empIdCache[name] = id);
    }
    return "";
  }

  async function upsertAnnualBySource(sourceDocId, d) {
    const db = DB();
    const al = db.collection(COL_ANNUAL);
    const found = await al.where("sourceDocId","==",sourceDocId).limit(1).get();
    const empId = d.employeeId || d.empId || d.applicantId || await resolveEmpIdByName(d.applicant || d.name);
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
      hoursUsed: hoursFromPayload(d),
      daysUsed: (hoursFromPayload(d) / HOURS_PER_DAY),
      createdAt: d.createdAt || toISODate(),
      updatedAt: toISODate()
    };
    if (!payload.applicant || !payload.leaveDate) {
      console.warn("[mirror] skip upsert: missing required fields", payload);
      return false;
    }
    if (!found.empty) {
      await found.docs[0].ref.update(payload);
      return true;
    } else {
      await al.add(payload);
      return true;
    }
  }

  async function deleteAnnualBySource(sourceDocId) {
    const db = DB();
    const al = db.collection(COL_ANNUAL);
    const snap = await al.where("sourceDocId","==",sourceDocId).get();
    if (snap.empty) return false;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }

  // realtime mirror on leave collection
  function bindMirrorRealtime() {
    const db = DB();
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
  async function updateRequestFieldSmart(id, patch) {
    const db = DB();
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
      // supervisorSign
      if (e.target.classList.contains("supervisor-sign")) {
        const id = e.target.dataset.id;
        const value = e.target.value;
        debounceUpdate(`sup-${id}`, 800, async () => {
          await updateRequestFieldSmart(id, { supervisorSign: value });
        });
      }
      // note
      if (e.target.classList.contains("note-area")) {
        const id = e.target.dataset.id;
        const value = e.target.value;
        debounceUpdate(`note-${id}`, 800, async () => {
          await updateRequestFieldSmart(id, { note: value });
        });
      }
    });

    document.addEventListener("change", async (e) => {
      // status change
      if (e.target.classList.contains("status-select")) {
        const id = e.target.dataset.id;
        const value = e.target.value;
        const color = getStatusColor(value);
        e.target.style.background = color;
        e.target.style.color = "#fff";

        await updateRequestFieldSmart(id, { status: value });
        // Mirror will react to onSnapshot; no need to call mirror directly here.
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
          await DB().collection(COL_LEAVE).doc(id).delete();
          // Mirror will remove via onSnapshot
        }
      }
      if (btnSwap) {
        const id = btnSwap.dataset.id;
        if (confirm("確定要刪除此調班單？")) {
          await DB().collection(COL_SWAP).doc(id).delete();
        }
      }
    });
  }

  // ========= Export & Print =========
  function exportTableToExcel(tableId, filename) {
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
    $("#exportLeaveExcel")?.addEventListener("click", () => exportTableToExcel("leaveTable", "請假紀錄.xlsx"));
    $("#exportSwapExcel") ?.addEventListener("click", () => exportTableToExcel("swapTable",  "調班紀錄.xlsx"));

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
    await loadStatuses();
    await loadLeaveRequests();
    await loadSwapRequests();

    // filter buttons
    $("#filterLeave")?.addEventListener("click", loadLeaveRequests);
    $("#filterSwap") ?.addEventListener("click", loadSwapRequests);

    // add forms
    $("#addLeaveForm")?.addEventListener("submit", handleAddLeave);
    $("#addSwapForm") ?.addEventListener("submit", handleAddSwap);

    bindInlineEditors();
    bindDeleteButtons();
    bindExportPrint();
    bindMirrorRealtime();
    DB().collection(COL_LEAVE).onSnapshot((snap) => {
      let shouldRefresh = false;
    
      snap.docChanges().forEach(chg => {
        // 若是新增或刪除 → 一定刷新
        if (chg.type === "added" || chg.type === "removed") {
          shouldRefresh = true;
        }
    
        // 若是修改 → 只有修改 status 時才刷新
        if (chg.type === "modified") {
          const beforeStatus = chg.oldIndex > -1 ? chg.doc.data().status : null;
          const afterStatus = chg.doc.data().status;
    
          if (beforeStatus !== afterStatus) {
            shouldRefresh = true;
          }
        }
      });
    
      if (shouldRefresh) {
        loadLeaveRequests();
      }
    });
    
    DB().collection(COL_SWAP).onSnapshot((snap) => {
      let shouldRefresh = false;
    
      snap.docChanges().forEach(chg => {
        if (chg.type === "added" || chg.type === "removed") {
          shouldRefresh = true;
        }
    
        if (chg.type === "modified") {
          const beforeStatus = chg.oldIndex > -1 ? chg.doc.data().status : null;
          const afterStatus = chg.doc.data().status;
    
          if (beforeStatus !== afterStatus) {
            shouldRefresh = true;
          }
        }
      });
    
      if (shouldRefresh) {
        loadSwapRequests();
      }
    });
  });
})();
