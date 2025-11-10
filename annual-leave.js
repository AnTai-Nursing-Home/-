// annual-leave.js — FULL CONSOLIDATED (J1)
// Date: 2025-11-05
// What’s included (as requested by user):
// 1) Requests (唯讀) tab: shows leave requests mirrored from leave systems (exclude 快速補登).
//    - Columns per C2: 請假日期 → 班別 → 請假時數(天+小時) → 請假原因…
//    - 時數顯示規則：R3（X 天 Y 小時），整數制（不處理小數），8 小時=1 天。
//    - Excel export mirrors current table columns.
// 2) 快速補登 tab: writes hoursUsed only; unit day/hour supported; hours = day*8 or hour。
// 3) 年假統計 tab: 完整版
//    - 累積：顯示「天」（以年資計算 / 或你現行制度邏輯）
//    - 已用：顯示「D 天 H 小時（X 小時）」
//    - 剩餘：顯示「D 天 H 小時」
//    - 剩餘時數：顯示「X 小時」
//    - 支援護理師/照服員/個人篩選與 Excel 匯出
// Firestore version: v8 compatible
// IMPORTANT: This file assumes a firebase-init.js will dispatch a `firebase-ready` event once initialized.

(function () {
  // ===== Constants & helpers =====
  const DB = () => firebase.firestore();
  const HOURS_PER_DAY = window.HOURS_PER_DAY || 8; // H8 固定 8
  const COL_REQ = "annual_leave_requests";         // 鏡像 + 快速補登
  const ROLE_TXT = { nurse: "護理師", caregiver: "照服員" };
  const $ = (sel) => document.querySelector(sel);

  // 員工快取：empId -> { name, role, hireDate }
  const EMP_MAP = Object.create(null);

  // 年資對應（可依你的制度微調）— 以「天」為單位（顯示用，數學使用小時換算）
  const ENTITLE_STEPS = [
    { years: 0.5, days: 3 }, { years: 1,  days: 7 }, { years: 2,  days: 10 },
    { years: 3,  days: 14 }, { years: 4,  days: 14 }, { years: 5,  days: 15 },
    { years: 6,  days: 15 }, { years: 7,  days: 15 }, { years: 8,  days: 15 },
    { years: 9,  days: 15 }, { years: 10, days: 16 }, { years: 11, days: 17 },
    { years: 12, days: 18 }, { years: 13, days: 19 }, { years: 14, days: 20 },
    { years: 15, days: 21 }, { years: 16, days: 22 }, { years: 17, days: 23 },
    { years: 18, days: 24 }, { years: 19, days: 25 }, { years: 20, days: 26 },
    { years: 21, days: 27 }, { years: 22, days: 28 }, { years: 23, days: 29 },
    { years: 24, days: 30 },
  ];

  function toDate(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    if (typeof s.toDate === "function") {
      try { const d = s.toDate(); return isNaN(d) ? null : d; } catch (_) {}
    }
    const raw = String(s);
    const d = new Date(raw);
    if (!isNaN(d)) return d;
    const alt = new Date(raw.replace(/\./g, "-").replace(/\//g, "-"));
    return isNaN(alt) ? null : alt;
  }
  function ymd(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }
  function startOfYear(y) { return new Date(`${y}-01-01T00:00:00`); }
  function endOfYear(y)   { return new Date(`${y}-12-31T23:59:59`); }

  function hoursToDPlusH(hours) {
    const h = Math.max(0, Number(hours) || 0); // ✅ 不取整數
    const d = Math.floor(h / HOURS_PER_DAY);
    const rem = h % HOURS_PER_DAY;
    const fullH = Math.floor(rem);
    const minutes = Math.round((rem - fullH) * 60); // ✅ 將小數部分轉成分鐘
    let text = `${d} 天 ${fullH} 小時`;
    if (minutes > 0) text += ` ${minutes} 分鐘`;
    return text;
  }
  
  // 小時 → {days, hours, minutes}
  function decomposeHours(hours) {
    const h = Math.max(0, Number(hours) || 0);
    const d = Math.floor(h / HOURS_PER_DAY);
    const rem = h % HOURS_PER_DAY;
    const fullH = Math.floor(rem);
    const minutes = Math.round((rem - fullH) * 60);
    return { days: d, hours: fullH, minutes };
  }
  
  // Firestore record → 小時（優先 hoursUsed；退而求其次 daysUsed/durationValue）
  function recordHours(d) {
    const h = Number(d?.hoursUsed);
    if (!isNaN(h) && isFinite(h)) return Math.max(0, h); // ✅ 不四捨五入
    const days = Number(d?.daysUsed ?? d?.durationValue);
    if (!isNaN(days) && isFinite(days)) return Math.max(0, days * HOURS_PER_DAY);
    return 0;
  }

  function yearsCompletedAtEndOf(year, hireDate) {
  (hireDate) {
    if (!hireDate) return 0;
    const now = new Date();
    const diff = now - hireDate;
    if (diff <= 0) return 0;
    return diff / (365.25 * 24 * 3600 * 1000);
  }

// 計算入職至目前的年資（以現在日期 new Date() 為基準）
function yearsCompletedUntilNow(hireDate) {
  if (!hireDate) return 0;
  const now = new Date();
  const diff = now - hireDate;
  if (diff <= 0) return 0;
  return diff / (365.25 * 24 * 3600 * 1000);
}

  


    if (!hireDate) return 0;
    const end = endOfYear(year);
    const diff = end - hireDate;
    if (diff <= 0) return 0;
    return diff / (365.25 * 24 * 3600 * 1000);
  }

  

  // Entitlement in "hours" (for math); render as "days only" on UI
  function entitlementHoursForYear(hireDate, year) {
    if (!hireDate) return 0;
    const yrs = yearsCompletedAtEndOf(year, hireDate);
    if (yrs >= 24) return 30 * HOURS_PER_DAY;
    let days = 0;
    for (const s of ENTITLE_STEPS) { if (yrs >= s.years) days = s.days; else break; }
    return days * HOURS_PER_DAY;
  }

  // ===== Employees =====
  async function loadEmployeesIntoSelects() {
    const selReq = $("#reqEmpSelect");
    const selQuick = $("#quickEmpSelect");
    const selStat = $("#statEmpSelect");

    const nurses = [], caregivers = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data() || {};
        const empId = d.empId || d.id || doc.id || "";
        const name = d.name || "";
        const hireDate = d.hireDate ? toDate(d.hireDate) : null;
        nurses.push({ empId, name, role: "nurse", hireDate });
        EMP_MAP[empId] = { name, role: "nurse", hireDate };
      });
    } catch (e) {}

    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data() || {};
        const empId = d.empId || d.id || doc.id || "";
        const name = d.name || "";
        const hireDate = d.hireDate ? toDate(d.hireDate) : null;
        caregivers.push({ empId, name, role: "caregiver", hireDate });
        EMP_MAP[empId] = { name, role: "caregiver", hireDate };
      });
    } catch (e) {}

    const optFilter = [
      `<option value="">全部</option>`,
      `<option value="@nurse">護理師</option>`,
      `<option value="@caregiver">照服員</option>`,
      ...nurses.map(p=>`<option value="${p.empId}" data-name="${p.name}" data-role="${p.role}">${p.empId} ${p.name}(護理師)</option>`),
      ...caregivers.map(p=>`<option value="${p.empId}" data-name="${p.name}" data-role="${p.role}">${p.empId} ${p.name}(照服員)</option>`),
    ].join("");

    const optQuick = [
      ...nurses.map(p=>`<option value="${p.empId}" data-name="${p.name}" data-role="${p.role}">${p.empId} ${p.name}(護理師)</option>`),
      ...caregivers.map(p=>`<option value="${p.empId}" data-name="${p.name}" data-role="${p.role}">${p.empId} ${p.name}(照服員)</option>`),
    ].join("");

    if (selReq)  selReq.innerHTML  = optFilter;
    if (selStat) selStat.innerHTML = optFilter;
    if (selQuick) selQuick.innerHTML = optQuick;
  }

  // ===== Year select =====
  function populateYearOptions() {
    const sel = $("#yearSelect");
    if (!sel) return;
    const current = new Date().getFullYear();
    const start = current - 5, end = current + 1;
    sel.innerHTML = Array.from({length: end - start + 1}, (_, i) => {
      const y = start + i;
      return `<option value="${y}" ${y === current ? "selected" : ""}>${y}</option>`;
    }).join("");
  }

  // ===== Requests (唯讀) =====
  async function renderRequests() {
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    let from = startOfYear(year), to = endOfYear(year);

    const fromVal = $("#reqDateFrom")?.value;
    const toVal   = $("#reqDateTo")?.value;
    if (fromVal) from = new Date(`${fromVal}T00:00:00`);
    if (toVal)   to   = new Date(`${toVal}T23:59:59`);

    const empSelVal = $("#reqEmpSelect")?.value || "";
    const tbody = $("#al-req-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    const snap = await DB().collection(COL_REQ).get().catch(()=>null);
    if (!snap) { tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted-ghost">沒有資料</td></tr>`; return; }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.source === "快速補登") return;     // 本頁僅顯示鏡像請假單
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;

      if (empSelVal) {
        if (empSelVal === "@nurse" || empSelVal === "@caregiver") {
          const role = EMP_MAP[d.empId]?.role;
          if (empSelVal === "@nurse" && role !== "nurse") return;
          if (empSelVal === "@caregiver" && role !== "caregiver") return;
        } else {
          if ((d.empId || "") !== empSelVal) return;
        }
      }

      const who = (d.applicant || d.name || "");
      const roleTxt = ROLE_TXT[EMP_MAP[d.empId]?.role] || "";
      const hours = recordHours(d);

      rows.push({
        applyDate: d.applyDate ? ymd(toDate(d.applyDate)) : (d.createdAt ? ymd(toDate(d.createdAt)) : ""),
        applicant: roleTxt ? `${who}(${roleTxt})` : who,
        leaveType: d.leaveType || "特休",
        leaveDate: ymd(leaveAt),
        shift: d.shift || "-",
        hoursText: hoursToDPlusH(hours), // ✅ C2: 顯示「天＋小時」
        reason: d.reason || "",
        note: d.note || "",
        supervisor: d.supervisorSign || d.approvedBy || "",
        sourceId: d.sourceDocId || doc.id
      });
    });

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted-ghost">沒有資料</td></tr>`; return; }
    rows.sort((a,b)=> a.leaveDate.localeCompare(b.leaveDate));
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.applyDate}</td>
        <td>${r.applicant}</td>
        <td>${r.leaveType}</td>
        <td>${r.leaveDate}</td>
        <td>${r.shift}</td>
        <td>${r.hoursText}</td>
        <td>${r.reason}</td>
        <td>${r.note}</td>
        <td>${r.supervisor}</td>
        <td>${r.sourceId}</td>
      </tr>
    `).join("");
  }

  // ===== Quick add (writes hoursUsed only) =====
  async function renderQuickList() {
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const tbody = $("#quick-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中...</td></tr>`;

    const snap = await DB().collection(COL_REQ).where("source","==","快速補登").get().catch(()=>null);
    if (!snap || snap.empty) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;
      const who = `${d.empId || ""} ${(d.applicant || d.name || "")}`.trim();
      rows.push({
        id: doc.id,
        date: ymd(leaveAt),
        who,
        hoursText: hoursToDPlusH(recordHours(d)),
        reason: d.reason || "",
        source: d.source || ""
      });
    });

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }
    rows.sort((a,b)=> a.date.localeCompare(b.date));
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.who}</td>
        <td>${r.hoursText}</td>
        <td>${r.reason}</td>
        <td>${r.source}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-id="${r.id}"><i class="fa-solid fa-trash-can"></i></button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("確定刪除此補登紀錄？")) return;
        await DB().collection(COL_REQ).doc(id).delete();
        renderQuickList(); renderSummary();
      });
    });
  }

  // ===== Summary (年度統計) =====
  async function renderSummary() {
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const empSelVal = $("#statEmpSelect")?.value || "";
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    // Load employees (same as loadEmployeesIntoSelects but building local list)
    let people = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data() || {};
        people.push({ empId: d.empId||d.id||doc.id||"", name: d.name||"", role:"nurse", hireDate: d.hireDate? toDate(d.hireDate):null });
      });
    } catch(_){}
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data() || {};
        people.push({ empId: d.empId||d.id||doc.id||"", name: d.name||"", role:"caregiver", hireDate: d.hireDate? toDate(d.hireDate):null });
      });
    } catch(_){}

    // Apply filter
    if (empSelVal) {
      if (empSelVal === "@nurse") people = people.filter(p=>p.role==="nurse");
      else if (empSelVal === "@caregiver") people = people.filter(p=>p.role==="caregiver");
      else people = people.filter(p=>p.empId === empSelVal);
    }

    // Aggregate used hours per emp within year
    const used = Object.create(null);
    const snap = await DB().collection(COL_REQ).where("leaveType","==","特休").get().catch(()=>null);
    if (snap) {
      snap.forEach(doc => {
        const d = doc.data() || {};
        const t = toDate(d.leaveDate || d.date);
        if (!t || t < from || t > to) return;
        const k = d.empId || "";
        used[k] = (used[k] || 0) + recordHours(d);
      });
    }

    // Order: nurse first then caregiver, empId asc
    const orderRole = { nurse: 0, caregiver: 1 };
    people.sort((a,b)=> (orderRole[a.role]-orderRole[b.role]) || (a.empId>b.empId?1:-1));

    const rows = people.map(p => {
      const entitledH = entitlementHoursForYear(p.hireDate, year); // hours
      const usedH = used[p.empId] || 0;                             // hours
      const remainH = Math.max(0, entitledH - usedH);               // hours

      const entDaysOnly = Math.floor(entitledH / HOURS_PER_DAY);    // 累積只顯示天（不顯示小時）
      const usedDH = decomposeHours(usedH);
      const remainDH = decomposeHours(remainH);

      const yrs = p.hireDate ? yearsCompletedUntilNow(p.hireDate) : 0;
      const yrsTxt = p.hireDate ? `${Math.floor(yrs)} 年 ${Math.round((yrs%1)*12)} 月` : "";

      let remainText = `${remainDH.days} 天 ${remainDH.hours} 小時`;
      if (remainDH.minutes > 0) remainText += ` ${remainDH.minutes} 分鐘`;
      
      return {
        empId: p.empId,
        name: `${p.name}${p.role==="nurse"?"(護理師)":p.role==="caregiver"?"(照服員)":""}`,
        hire: p.hireDate ? ymd(p.hireDate) : "",
        seniority: yrsTxt,
        entText: `${entDaysOnly} 天`,
        usedText: `${usedDH.days} 天 ${usedDH.hours} 小時（${usedH} 小時）`,
        remainText,
        remainHours: `${remainH} 小時`
      };
    });

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted-ghost">沒有符合條件的資料</td></tr>`; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.empId}</td>
        <td>${r.name}</td>
        <td>${r.hire}</td>
        <td>${r.seniority}</td>
        <td>${r.entText}</td>
        <td>${r.usedText}</td>
        <td>${r.remainText}</td>
        <td>${r.remainHours}</td>
      </tr>
    `).join("");
  }

  // ===== Excel export helpers =====
  function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) { alert("找不到表格"); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, filename);
  }

  // ===== Bind UI =====
  function bindUI() {
    // Requests
    $("#reqFilterBtn")?.addEventListener("click", renderRequests);
    $("#reqClearBtn")?.addEventListener("click", () => {
      if ($("#reqEmpSelect")) $("#reqEmpSelect").value = "";
      if ($("#reqDateFrom")) $("#reqDateFrom").value = "";
      if ($("#reqDateTo")) $("#reqDateTo").value = "";
      renderRequests();
    });
    
    // ===== Summary 篩選按鈕事件 =====
    $("#statFilterBtn")?.addEventListener("click", renderSummary);
    $("#statClearBtn")?.addEventListener("click", () => {
      $("#statEmpSelect").value = "";
      renderSummary();
    });

    // Quick
    $("#quickSubmit")?.addEventListener("click", async () => {
      const empSel = $("#quickEmpSelect");
      const dateEl = $("#quickDate");
      const amountEl = $("#quickAmount");
      const unitEl = $("#quickUnit");
      const reasonEl = $("#quickReason");

      const empId = empSel?.value || "";
      const empName = empSel?.selectedOptions?.[0]?.getAttribute("data-name") || "";
      const date = dateEl?.value || "";
      const amount = Number(amountEl?.value || "0"); // ✅ 改成支援小數
      const unit = (unitEl?.value || "day").toLowerCase();
      const isDay = unit === "day";
      const reason = reasonEl?.value || "";

      if (!empId || !date || !(amount > 0)) { alert("請選擇員工、日期並輸入正確整數數值"); return; }

      const hours = isDay ? amount * HOURS_PER_DAY : amount; // ✅ 小數制照樣可用
      const payload = {
        createdAt: new Date().toISOString(),
        date,
        empId,
        hoursUsed: hours,
        leaveType: "特休",
        name: empName,
        reason: reason || "快速補登",
        source: "快速補登",
        status: "審核通過"
      };
      await DB().collection(COL_REQ).add(payload);

      amountEl.value = ""; reasonEl.value = "";
      renderQuickList(); renderSummary();
      alert("✅ 已送出補登（已依日期歸屬該年度）");
    });

    // Common
    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(); renderQuickList(); renderSummary();
    });

    // Excel
    $("#export-req-excel")?.addEventListener("click", () => exportTableToExcel("reqTable",  `特休單_${$("#yearSelect")?.value || ""}.xlsx`));
    $("#export-stat-excel")?.addEventListener("click", () => exportTableToExcel("statTable", `年假統計_${$("#yearSelect")?.value || ""}.xlsx`));
  }

  // ===== Init =====
  async function init() {
    populateYearOptions();
    await loadEmployeesIntoSelects();
    bindUI();
    await Promise.all([renderRequests(), renderQuickList(), renderSummary()]);
  }

  let __inited = false;
  document.addEventListener("firebase-ready", async () => {
    if (__inited) return;
    __inited = true;
    try { await init(); }
    catch (e) { console.error("[annual-leave FULL J1] init error:", e); __inited = false; }
  });
})();
