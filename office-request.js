document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const statusBody = document.getElementById("statusTableBody");

  const leaveStatusFilter = document.getElementById("leaveStatusFilter");
  const swapStatusFilter = document.getElementById("swapStatusFilter");

  const leaveStatusSelect = document.getElementById("leaveStatusSelect");
  const swapStatusSelect = document.getElementById("swapStatusSelect");

  let statusList = [];

  // ====== 載入狀態清單 ======
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 更新狀態選項
    const optionHTML = statusList.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    [leaveStatusSelect, swapStatusSelect, leaveStatusFilter, swapStatusFilter].forEach(sel => {
      if (sel) sel.innerHTML = `<option value="">全部</option>${optionHTML}`;
    });

    // 狀態管理表
    statusBody.innerHTML = statusList.map(s => `
      <tr>
        <td>${s.name}</td>
        <td><span class="badge" style="background:${s.color};color:#fff;">${s.color}</span></td>
      </tr>
    `).join("");
  }

  // ====== 新增狀態 ======
  document.getElementById("addStatusForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      color: form.color.value
    };
    if (!data.name) return alert("請輸入狀態名稱");
    await statusCol.add(data);
    form.reset();
    alert("✅ 已新增狀態");
    await loadStatuses();
  });

  // ====== 狀態顏色輔助 ======
  function getStatusColor(name) {
    const s = statusList.find(x => x.name === name);
    return s ? s.color : "#6c757d";
  }

  // ====== 日期篩選 ======
  function inDateRange(targetDate, start, end) {
    if (!targetDate) return true;
    const t = new Date(targetDate);
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (s && t < s) return false;
    if (e && t > e) return false;
    return true;
  }

  // ====== 請假資料 ======
  async function loadLeaveRequests() {
    leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await leaveCol.orderBy("applyDate", "desc").get();
    const start = document.getElementById("leaveStartDate").value;
    const end = document.getElementById("leaveEndDate").value;
    const filterStatus = leaveStatusFilter.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!inDateRange(d.leaveDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status);

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.leaveType || ""}</td>
          <td>${d.leaveDate || ""}</td>
          <td>${d.shift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}"
              style="background:${color};color:#fff;">
              ${statusList.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-leave" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    leaveBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  // ====== 調班資料 ======
  async function loadSwapRequests() {
    swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await swapCol.orderBy("applyDate", "desc").get();
    const start = document.getElementById("swapStartDate").value;
    const end = document.getElementById("swapEndDate").value;
    const filterStatus = swapStatusFilter.value;

    let rows = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!inDateRange(d.swapDate, start, end)) return;
      if (filterStatus && d.status !== filterStatus) return;
      const color = getStatusColor(d.status);

      rows += `
        <tr>
          <td>${d.applyDate || ""}</td>
          <td>${d.applicant || ""}</td>
          <td>${d.swapDate || ""}</td>
          <td>${d.originalShift || ""}</td>
          <td>${d.newShift || ""}</td>
          <td>${d.reason || ""}</td>
          <td>
            <select class="form-select form-select-sm status-select" data-id="${doc.id}"
              style="background:${color};color:#fff;">
              ${statusList.map(s => `<option value="${s.name}" ${d.status === s.name ? 'selected' : ''}>${s.name}</option>`).join("")}
            </select>
          </td>
          <td><input type="text" class="form-control form-control-sm supervisor-sign" data-id="${doc.id}" value="${d.supervisorSign || ""}"></td>
          <td><textarea class="form-control form-control-sm note-area" data-id="${doc.id}" rows="1">${d.note || ""}</textarea></td>
          <td class="no-print text-center"><button class="btn btn-danger btn-sm delete-swap" data-id="${doc.id}"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    swapBody.innerHTML = rows || `<tr><td colspan="10" class="text-center text-muted">沒有符合的資料</td></tr>`;
  }

  // ====== 篩選 ======
  document.getElementById("filterLeave")?.addEventListener("click", loadLeaveRequests);
  document.getElementById("filterSwap")?.addEventListener("click", loadSwapRequests);

  // ====== 新增請假單 ======
  document.getElementById("addLeaveForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: f.leaveType.value,
      leaveDate: f.leaveDate.value,
      shift: f.shift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: ""
    };
    await leaveCol.add(data);
    f.reset();
    alert("✅ 已新增請假單");
  });

  // ====== 新增調班單 ======
  document.getElementById("addSwapForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      applicant: f.applicant.value,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: f.swapDate.value,
      originalShift: f.originalShift.value,
      newShift: f.newShift.value,
      reason: f.reason.value,
      status: f.status.value,
      note: "",
      supervisorSign: ""
    };
    await swapCol.add(data);
    f.reset();
    alert("✅ 已新增調班單");
  });

  // ====== 刪除 ======
  document.addEventListener("click", async e => {
    const btnLeave = e.target.closest(".delete-leave");
    const btnSwap = e.target.closest(".delete-swap");
    if (btnLeave && confirm("確定要刪除此請假單？")) await leaveCol.doc(btnLeave.dataset.id).delete();
    if (btnSwap && confirm("確定要刪除此調班單？")) await swapCol.doc(btnSwap.dataset.id).delete();
  });

  // ====== 狀態更新 ======
  document.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
      const id = e.target.dataset.id;
      const value = e.target.value;
      const color = getStatusColor(value);
      e.target.style.background = color;
      e.target.style.color = "#fff";
  
      await Promise.all([
        leaveCol.doc(id).update({ status: value }).catch(() => {}),
        swapCol.doc(id).update({ status: value }).catch(() => {})
      ]);
  
      showToast("狀態已更新");
  
      // ====== 特休審核通過 → 拋轉至年假系統 ======
      try {
        await pushToAnnualLeaveIfNeeded(id, value);
        console.log(`✅【年假系統】審核通過 → 已處理請假單 ${id}`);
      } catch (err) {
        console.error("❌【年假系統】拋轉失敗：", err);
      }
    }
  });

  // ====== 簽名與註解 ======
  document.addEventListener("input", async e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains("supervisor-sign")) {
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ supervisorSign: value }).catch(() => {}),
        swapCol.doc(id).update({ supervisorSign: value }).catch(() => {})
      ]);
    }
    if (e.target.classList.contains("note-area")) {
      const value = e.target.value;
      await Promise.all([
        leaveCol.doc(id).update({ note: value }).catch(() => {}),
        swapCol.doc(id).update({ note: value }).catch(() => {})
      ]);
    }
  });

  // ====== 匯出請假紀錄 ======
  document.getElementById("exportLeaveExcel")?.addEventListener("click", () => {
    const clone = document.getElementById("leaveTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(clone);
    XLSX.utils.book_append_sheet(wb, ws, "請假紀錄");
    XLSX.writeFile(wb, "請假紀錄.xlsx");
  });

  // ====== 匯出調班紀錄 ======
  document.getElementById("exportSwapExcel")?.addEventListener("click", () => {
    const clone = document.getElementById("swapTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(clone);
    XLSX.utils.book_append_sheet(wb, ws, "調班紀錄");
    XLSX.writeFile(wb, "調班紀錄.xlsx");
  });

  // ====== 列印請假紀錄 ======
  document.getElementById("printLeaveTable")?.addEventListener("click", () => {
    const clone = document.getElementById("leaveTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const content = clone.outerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
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
    printWindow.document.close();
    printWindow.print();
  });

  // ====== 列印調班紀錄 ======
  document.getElementById("printSwapTable")?.addEventListener("click", () => {
    const clone = document.getElementById("swapTable").cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(e => e.remove());
    clone.querySelectorAll("select, input, textarea").forEach(el => {
      const text = el.value || el.options?.[el.selectedIndex]?.text || "";
      el.replaceWith(document.createTextNode(text));
    });
  
    const content = clone.outerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
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
    printWindow.document.close();
    printWindow.print();
  });

  // ====== 初始化 ======
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();

  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);
});
// ====== 特休審核通過 → 拋轉至年假系統 ======
async function pushToAnnualLeaveIfNeeded(docId, newStatus) {
  try {
    // 只處理審核通過
    if (newStatus !== "審核通過") return;

    // 先檢查該筆是否為請假單（存在於 nurse_leave_requests 才處理）
    const leaveDoc = await leaveCol.doc(docId).get();
    if (!leaveDoc.exists) return;
    const d = leaveDoc.data();

    // 只拋轉特休
    if (d.leaveType !== "特休") return;

    // 防止重複寫入（若已存在相同來源 ID 就不再寫入）
    const alCol = db.collection("annual_leave_requests");
    const exist = await alCol.where("sourceDocId", "==", docId).get();
    if (!exist.empty) return;

    // 目前以天數寫入（未來支援時數時可調整）
    const daysUsed = 1; // 你目前請假固定為 1 天
    const hoursUsed = daysUsed * 8;

    const data = {
      empId: d.employeeId ?? "",
      name: d.applicant || "",
      date: d.leaveDate,
      daysUsed,
      hoursUsed,
      reason: d.reason || "",
      approvedBy: d.supervisorSign || "",
      sourceDocId: docId,
      createdAt: new Date()
    };

    await alCol.add(data);
    console.log(`✅【年假系統】已成功寫入特休資料 → ${d.applicant} ${d.leaveDate}（${daysUsed}天）`);

  } catch (err) {
    console.error("❌【年假系統】拋轉發生錯誤：", err);
  }
}


/* ==== Annual Leave Mirroring & UI Hint (Integrated) ==== */
(() => {
  const OFFICE_LEAVE_COL = 'nurse_leave_requests';
  const ANNUAL_REQ_COL   = 'annual_leave_requests';
  const HOURS_PER_DAY    = 8;
  let __annualHintCssInjected = false;

  function injectAnnualHintCSS() {
    if (__annualHintCssInjected) return;
    try {
      const css = `.annual-sync-hint{position:absolute;top:6px;right:8px;font-size:12px;color:#198754;background:#e9f7ef;border:1px solid #198754;border-radius:6px;padding:2px 6px;line-height:1;white-space:nowrap;z-index:2}`;
      const style = document.createElement('style');
      style.setAttribute('data-annual-sync-hint','1');
      style.textContent = css;
      document.head.appendChild(style);
      __annualHintCssInjected = True;
    } catch(_) {}
  }

  function showSyncHint(docId, synced) {
    // Try to find a request row/container by common selectors
    const candidates = [
      `[data-doc-id="${docId}"]`,
      `[data-id="${docId}"]`,
      `#req-${docId}`,
      `#row-${docId}`
    ];
    let host = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) { host = el; break; }
    }
    if (!host) return; // best effort only

    // Ensure relative positioning
    const computed = window.getComputedStyle(host);
    if (computed.position === 'static') {
      host.style.position = 'relative';
    }

    // Find or create hint node
    let hint = host.querySelector('.annual-sync-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'annual-sync-hint';
      host.appendChild(hint);
    }
    hint.textContent = synced ? '已同步至年假系統' : '';
    hint.style.display = synced ? 'inline-block' : 'none';
  }

  async function ensureAnnualRecord(db, sourceDocId, d) {
    // Check if already exists
    const existed = await db.collection(ANNUAL_REQ_COL).where('sourceDocId','==',sourceDocId).limit(1).get();
    if (!existed.empty) return true;

    const empId = d.employeeId || d.empId || d.id || d.applicantId || '';
    const name  = d.applicant || d.name || '';
    const date  = (d.leaveDate || d.date || '').toString().slice(0,10);
    const hours = Number(d.hoursUsed) > 0 ? Number(d.hoursUsed) : HOURS_PER_DAY;

    if (!empId || !name || !date) {
      console.warn('[mirror] missing fields, skip', { empId, name, date, sourceDocId });
      return false;
    }
    const payload = {
      empId,
      name,
      leaveType: '特休',
      status: '審核通過',
      date,
      hours,
      reason: d.reason || '請假系統',
      source: '請假系統',
      sourceDocId,
      createdAt: new Date().toISOString()
    };
    await db.collection(ANNUAL_REQ_COL).add(payload);
    return true;
  }

  async function removeAnnualRecord(db, sourceDocId) {
    const snap = await db.collection(ANNUAL_REQ_COL).where('sourceDocId','==',sourceDocId).get();
    if (snap.empty) return false;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }

  document.addEventListener('firebase-ready', () => {
    try { injectAnnualHintCSS(); } catch(_) {}
    const db = firebase.firestore();

    // Real-time listen in office screen
    db.collection(OFFICE_LEAVE_COL).onSnapshot((snap) => {
      snap.docChanges().forEach((chg) => {
        const id = chg.doc.id;
        const d  = chg.doc.data() || {};
        const leaveType = (d.leaveType || d.type || '').trim();
        if (leaveType !== '特休') return;

        const status = (d.status || '').trim();
        if (status === '審核通過') {
          ensureAnnualRecord(db, id, d)
            .then(ok => { if (ok) showSyncHint(id, true); })
            .catch(e => console.error('ensureAnnualRecord error:', e));
        } else {
          removeAnnualRecord(db, id)
            .then(ok => { if (ok) showSyncHint(id, false); })
            .catch(e => console.error('removeAnnualRecord error:', e));
        }
      });
    });
  });
})();
/* ==== /Annual Leave Mirroring & UI Hint ==== */


/* ==== Annual Leave Mirroring V2 (empId lookup + UI hint) ==== */
(() => {
  const OFFICE_LEAVE_COL = 'nurse_leave_requests'; // your single request collection
  const ANNUAL_REQ_COL   = 'annual_leave_requests'; // annual-leave target
  const HOURS_PER_DAY    = 8;

  // ---- lightweight cache for empId lookups by name
  const __empIdCache = Object.create(null);

  // ---- inject CSS for green hint
  (function injectCSS(){
    if (document.querySelector('style[data-annual-sync-hint]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-annual-sync-hint','1');
    style.textContent =
      '.annual-sync-hint{position:absolute;top:6px;right:8px;font-size:12px;color:#198754;background:#e9f7ef;border:1px solid #198754;border-radius:6px;padding:2px 6px;line-height:1;white-space:nowrap;z-index:2}'+
      '.annual-sync-hint.err{color:#842029;background:#f8d7da;border-color:#842029}';
    document.head.appendChild(style);
  })();

  // ---- utils
  function ymd(s) {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s).slice(0,10);
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  async function getEmpIdByName(name) {
    if (!name) return '';
    if (__empIdCache[name]) return __empIdCache[name];
    const db = firebase.firestore();

    // find in nurses
    let q = await db.collection('nurses').where('name','==',name).limit(1).get();
    if (!q.empty) {
      const empId = q.docs[0].data().empId || q.docs[0].data().id || '';
      if (empId) { __empIdCache[name] = empId; return empId; }
    }
    // fallback caregivers
    q = await db.collection('caregivers').where('name','==',name).limit(1).get();
    if (!q.empty) {
      const empId = q.docs[0].data().empId || q.docs[0].data().id || '';
      if (empId) { __empIdCache[name] = empId; return empId; }
    }
    return '';
  }

  // Try to find the <tr> for a request by matching a few key cells
  function findRowForDoc(d) {
    const tbls = Array.from(document.querySelectorAll('table'));
    for (const table of tbls) {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const tr of rows) {
        const txt = tr.innerText || tr.textContent || '';
        const hasName  = d.applicant && txt.includes(d.applicant);
        const hasDate  = (d.leaveDate || d.date) && txt.includes(ymd(d.leaveDate || d.date));
        const hasType  = (d.leaveType || d.type) && txt.includes((d.leaveType || d.type));
        if (hasName && hasDate && hasType) return tr;
      }
    }
    return null;
  }

  function setHint(tr, message, isError=false){
    if (!tr) return;
    tr.style.position = (getComputedStyle(tr).position === 'static') ? 'relative' : tr.style.position;
    let hint = tr.querySelector('.annual-sync-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'annual-sync-hint';
      tr.appendChild(hint);
    }
    hint.textContent = message || '';
    hint.style.display = message ? 'inline-block' : 'none';
    hint.classList.toggle('err', !!isError);
  }

  async function ensureAnnualRecord(db, sourceDocId, d) {
    // de-dup
    const existed = await db.collection(ANNUAL_REQ_COL).where('sourceDocId','==',sourceDocId).limit(1).get();
    if (!existed.empty) return true;

    const name  = d.applicant || d.name || '';
    const empId = d.employeeId || d.empId || d.id || d.applicantId || await getEmpIdByName(name);
    const date  = ymd(d.leaveDate || d.date);
    const hours = Number(d.hoursUsed) > 0 ? Number(d.hoursUsed) : HOURS_PER_DAY;

    if (!name || !empId || !date) {
      // show red hint on the row if we can
      setHint(findRowForDoc(d), '未同步：缺少員編/日期', true);
      console.warn('[annual mirror] missing field(s)', { name, empId, date, sourceDocId });
      return false;
    }

    const payload = {
      empId,
      name,
      leaveType: '特休',
      status: '審核通過',
      date,
      hours,
      reason: d.reason || '請假系統',
      source: '請假系統',
      sourceDocId,
      createdAt: new Date().toISOString()
    };
    await db.collection(ANNUAL_REQ_COL).add(payload);
    setHint(findRowForDoc(d), '已同步至年假系統', false);
    return true;
  }

  async function removeAnnualRecord(db, sourceDocId, d) {
    const snap = await db.collection(ANNUAL_REQ_COL).where('sourceDocId','==',sourceDocId).get();
    if (snap.empty) { setHint(findRowForDoc(d), ''); return false; }
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    setHint(findRowForDoc(d), '');
    return true;
  }

  document.addEventListener('firebase-ready', () => {
    const db = firebase.firestore();
    db.collection(OFFICE_LEAVE_COL).onSnapshot((snap) => {
      snap.docChanges().forEach((chg) => {
        const id = chg.doc.id;
        const d  = chg.doc.data() || {};
        const type = (d.leaveType || d.type || '').trim();
        if (type !== '特休') return; // only mirror Annual leave

        const status = (d.status || '').trim();
        if (status === '審核通過') {
          ensureAnnualRecord(db, id, d).catch(e => console.error('ensureAnnualRecord error', e));
        } else {
          removeAnnualRecord(db, id, d).catch(e => console.error('removeAnnualRecord error', e));
        }
      });
    });
  });
})();
/* ==== /Annual Leave Mirroring V2 (empId lookup + UI hint) ==== */
