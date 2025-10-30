// 年假系統（特休單唯讀 + 年假統計）
// - 不修改 firebase-init.js
// - 依到職日周年累積（不清零、可結轉）
// - 年資對照表採用你提供的版本
// - 只顯示「審核通過 + 特休」
// - 兩分頁均支援 Excel 匯出
// - 員工查找用下拉選單（來源：employees）

(function () {
  const REQ_COL = "annual_leave_requests"; // 年假系統匯入的「已核准特休單」
  const EMP_COL = "employees";             // 員工基本資料（提供姓名/員編/入職日）
  const HOURS_PER_DAY = 8;

  // ===== 小工具 =====
  const $ = (s) => document.querySelector(s);

  const fmtDate = (s) => (s ? s.replace(/\//g, "-") : "");
  const parseDate = (s) => {
    if (!s) return null;
    const d = new Date(s.replace(/\//g, "-"));
    return isNaN(d) ? null : d;
  };
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  function hoursToText(h) {
    const neg = h < 0;
    const abs = Math.abs(h);
    const days = Math.floor(abs / HOURS_PER_DAY);
    const hours = abs % HOURS_PER_DAY;
    const t = `${days} 天${hours ? " " + hours + " 小時" : ""}`;
    return neg ? `-${t}` : t;
  }
  function calcTenureString(startDateStr) {
    const sd = parseDate(startDateStr);
    if (!sd) return "—";
    const now = new Date();
    let y = now.getFullYear() - sd.getFullYear();
    let m = now.getMonth() - sd.getMonth();
    let d = now.getDate() - sd.getDate();
    if (d < 0) m -= 1;
    if (m < 0) { y -= 1; m += 12; }
    return `${y} 年 ${m} 月`;
  }

  // ===== 年資 → 應放天數（依你提供表） =====
  function entitlementDaysForYears(fullYears) {
    if (fullYears < 1) return 0;         // 未滿一年：0（半年另處理）
    if (fullYears === 1) return 7;
    if (fullYears === 2) return 10;
    if (fullYears === 3) return 14;
    if (fullYears === 4) return 14;
    if (fullYears === 5) return 15;
    if (fullYears >= 6 && fullYears <= 9) return 10 + fullYears; // 6→16,7→17,8→18,9→19
    if (fullYears >= 10) return Math.min(20 + (fullYears - 10), 30);
    return 0;
  }
  // 指定「年度」的應放（天）——以該年 12/31 的年資判斷；未滿一年但>=半年 → 3 天
  function calcEntitlementForYear(startDateStr, year) {
    const sd = parseDate(startDateStr);
    if (!sd) return 0;
    const endOfYear = new Date(year, 11, 31);
    if (endOfYear < sd) return 0;

    let fullYears = endOfYear.getFullYear() - sd.getFullYear();
    let m = endOfYear.getMonth() - sd.getMonth();
    let d = endOfYear.getDate() - sd.getDate();
    if (d < 0) m -= 1;
    if (m < 0) { fullYears -= 1; m += 12; }

    if (fullYears < 1) {
      if (fullYears === 0 && m >= 6) return 3; // 半年：3 天
      return 0;
    }
    return entitlementDaysForYears(fullYears);
  }
  // 到「所選年度」為止的累計應放（天）
  function calcCumulativeEntitlementDays(startDateStr, upToYear) {
    const sd = parseDate(startDateStr);
    if (!sd) return 0;
    const startYear = sd.getFullYear();
    let total = 0;
    for (let y = startYear; y <= upToYear; y++) {
      total += calcEntitlementForYear(startDateStr, y);
    }
    return total;
  }

  // ===== Excel 匯出 =====
  function exportTableToXLSX(tableSelector, filename) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // ===== UI =====
  function initYearSelect() {
    const sel = $("#yearSelect");
    const nowY = new Date().getFullYear();
    sel.innerHTML = "";
    for (let y = nowY + 1; y >= nowY - 5; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === nowY) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  function setLoading(tbodyId, col) {
    const tb = document.getElementById(tbodyId);
    tb.innerHTML = `<tr><td colspan="${col}" class="text-center text-muted-ghost">讀取中…</td></tr>`;
  }
  function setEmpty(tbodyId, col) {
    const tb = document.getElementById(tbodyId);
    tb.innerHTML = `<tr><td colspan="${col}" class="text-center text-muted-ghost">沒有符合條件的資料</td></tr>`;
  }

  // 讀員工名單 → 下拉選單（requests / stats 都用）
  async function loadEmployeeSelects(db) {
    const reqSel = $("#reqEmpSelect");
    const statSel = $("#statEmpSelect");
    // 保留「全部」
    reqSel.innerHTML = `<option value="">全部</option>`;
    statSel.innerHTML = `<option value="">全部</option>`;

    try {
      const snap = await db.collection(EMP_COL).get();
      const rows = [];
      snap.forEach(doc => {
        const e = doc.data() || {};
        const empId = (e.empId || e.employeeId || "").toString();
        const name = e.name || e.applicant || "";
        const startDate = fmtDate(e.startDate || e.hireDate || e.entryDate || "");
        if (!name) return;
        rows.push({ empId, name, startDate });
      });
      // 依姓名排序
      rows.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

      for (const r of rows) {
        const t = r.empId ? `${r.name}（${r.empId}）` : r.name;
        const opt1 = document.createElement("option");
        opt1.value = r.name; opt1.textContent = t;
        reqSel.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = r.name; opt2.textContent = t;
        statSel.appendChild(opt2);
      }
    } catch (e) {
      console.warn("讀取 employees 失敗（可忽略）", e);
    }
  }

  // ===== 資料：特休單（唯讀）=====
  async function loadRequests(db) {
    setLoading("al-req-body", 9);

    const dateFrom = $("#reqDateFrom").value || "";
    const dateTo = $("#reqDateTo").value || "";
    const nameFilter = $("#reqEmpSelect").value || "";

    const snap = await db.collection(REQ_COL).get();
    let rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.status !== "審核通過" || d.leaveType !== "特休") return;

      const ld = fmtDate(d.leaveDate || "");
      if (dateFrom && ld < dateFrom) return;
      if (dateTo && ld > dateTo) return;

      const name = d.applicant || d.name || "";
      if (nameFilter && name !== nameFilter) return;

      rows.push({
        applyDate: fmtDate(d.applyDate || ""),
        applicant: name,
        leaveType: d.leaveType || "",
        leaveDate: ld,
        shift: d.shift || "",
        reason: d.reason || "",
        note: d.note || "",
        supervisorSign: d.supervisorSign || "",
        sourceDocId: d.sourceDocId || doc.id
      });
    });

    const tb = $("#al-req-body");
    if (!rows.length) { setEmpty("al-req-body", 9); return; }

    rows.sort((a,b)=> (a.leaveDate > b.leaveDate ? -1 : 1));
    tb.innerHTML = rows.map(r => `
      <tr>
        <td>${r.applyDate || "—"}</td>
        <td>${r.applicant || "—"}</td>
        <td>${r.leaveType || "—"}</td>
        <td>${r.leaveDate || "—"}</td>
        <td>${r.shift || "—"}</td>
        <td>${r.reason || "—"}</td>
        <td>${r.note || "—"}</td>
        <td>${r.supervisorSign || "—"}</td>
        <td>${r.sourceDocId}</td>
      </tr>
    `).join("");
  }

  // ===== 資料：年假統計（累加、可為負）=====
  async function loadStats(db) {
    setLoading("al-stat-body", 7);

    const selectedYear = parseInt($("#yearSelect").value, 10);
    const nameFilter = $("#statEmpSelect").value || "";

    // 1) 讀員工資料
    const empMap = new Map(); // key: name, val: { empId, name, startDate }
    try {
      const empSnap = await db.collection(EMP_COL).get();
      empSnap.forEach(doc => {
        const e = doc.data() || {};
        const empId = (e.empId || e.employeeId || "").toString();
        const name = e.name || e.applicant || "";
        const startDate = fmtDate(e.startDate || e.hireDate || e.entryDate || "");
        if (name) empMap.set(name, { empId, name, startDate });
      });
    } catch (err) {
      console.warn("讀取員工資料失敗（可忽略）", err);
    }

    // 2) 讀已用特休（至所選年度止）
    const usedHoursByName = new Map();
    const reqSnap = await db.collection(REQ_COL).get();
    reqSnap.forEach(doc => {
      const d = doc.data() || {};
      if (d.status !== "審核通過" || d.leaveType !== "特休") return;
      const name = d.applicant || d.name || "";
      if (!name) return;
      const ld = parseDate(d.leaveDate);
      if (!ld) return;
      if (ld.getFullYear() > selectedYear) return;
      const hours = Number.isFinite(d.hours) ? Number(d.hours) : HOURS_PER_DAY;
      usedHoursByName.set(name, (usedHoursByName.get(name) || 0) + hours);
    });

    // 3) 建名單：以 employees 為主；若沒有 employees 也會以請假單名單補上
    const allNames = new Set([...empMap.keys(), ...usedHoursByName.keys()]);
    const rows = [];
    allNames.forEach(name => {
      if (nameFilter && name !== nameFilter) return;
      const emp = empMap.get(name) || { empId:"", name, startDate:"" };
      const startDate = emp.startDate || "";
      const entDays = startDate ? calcCumulativeEntitlementDays(startDate, selectedYear) : 0;
      const totalHours = entDays * HOURS_PER_DAY;
      const usedHours = usedHoursByName.get(name) || 0;
      const remainingHours = totalHours - usedHours;
      rows.push({
        empId: emp.empId || "—",
        name,
        startDate: startDate || "—",
        tenure: startDate ? calcTenureString(startDate) : "—",
        totalHours, usedHours, remainingHours
      });
    });

    const tb = $("#al-stat-body");
    if (!rows.length) { setEmpty("al-stat-body", 7); return; }

    rows.sort((a,b)=> a.remainingHours - b.remainingHours);
    tb.innerHTML = rows.map(r=>{
      const remTxt = hoursToText(r.remainingHours);
      const remCls = r.remainingHours < 0 ? "neg" : "";
      return `
        <tr>
          <td>${r.empId}</td>
          <td>${r.name}</td>
          <td>${r.startDate}</td>
          <td>${r.tenure}</td>
          <td>${hoursToText(r.totalHours)}</td>
          <td>${hoursToText(r.usedHours)}</td>
          <td class="${remCls}">${remTxt}</td>
        </tr>
      `;
    }).join("");
  }

  // ===== 綁定事件 =====
  function bindEvents(db) {
    // 年度切換 → 兩分頁重整
    $("#yearSelect").addEventListener("change", () => {
      loadRequests(db);
      loadStats(db);
    });

    // 特休單
    $("#reqFilterBtn").addEventListener("click", ()=> loadRequests(db));
    $("#reqClearBtn").addEventListener("click", ()=>{
      $("#reqDateFrom").value="";
      $("#reqDateTo").value="";
      $("#reqEmpSelect").value="";
      loadRequests(db);
    });
    $("#export-req-excel").addEventListener("click", ()=>{
      exportTableToXLSX("#reqTable", `特休單_${$("#yearSelect").value}.xlsx`);
    });

    // 年假統計
    $("#statFilterBtn").addEventListener("click", ()=> loadStats(db));
    $("#statClearBtn").addEventListener("click", ()=>{
      $("#statEmpSelect").value="";
      loadStats(db);
    });
    $("#export-stat-excel").addEventListener("click", ()=>{
      exportTableToXLSX("#statTable", `年假統計_${$("#yearSelect").value}.xlsx`);
    });
  }

  // ===== 入口：沿用既有「firebase-ready」事件 =====
  document.addEventListener("firebase-ready", async () => {
    // 舊架構：直接用 v8 寫法取得 db
    const db = firebase.firestore();

    initYearSelect();
    await loadEmployeeSelects(db); // 先把兩個下拉選單填好
    bindEvents(db);

    // 初始載入
    await loadRequests(db);
    await loadStats(db);

    console.log("✅ 年假系統已就緒");
  });
})();
