// 年假系統 JS（特休單唯讀 + 年假統計）
// 依你的架構：等待 firebase-init.js 派發 "firebase-ready" 再啟動
// 集合：annual_leave_requests（特休單唯讀資料）
// 其他資料：employees（抓入職日/員編），如無則以請假單帶入姓名為主

(function () {
  const REQ_COL = "annual_leave_requests";
  const EMP_COL = "employees"; // 若你的員工基本資料集合不同，改這裡
  const HOURS_PER_DAY = 8;

  let dbRef = null;

  // ===== 工具 =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const fmtDate = (s) => {
    if (!s) return "";
    // 支援 YYYY-MM-DD / YYYY/MM/DD
    const t = s.replace(/\//g, "-");
    return t;
  };

  const parseDate = (s) => {
    if (!s) return null;
    const t = s.replace(/\//g, "-");
    const d = new Date(t);
    return isNaN(d) ? null : d;
  };

  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  // 小時 → "X 天 Y 小時"（支援負數、紅字交由呼叫端決定加 class）
  function hoursToText(h) {
    const neg = h < 0;
    const abs = Math.abs(h);
    const days = Math.floor(abs / HOURS_PER_DAY);
    const hours = abs % HOURS_PER_DAY;
    const text = `${days} 天${hours ? " " + hours + " 小時" : ""}`;
    return neg ? `-${text}` : text;
  }

  // 計算 tenure（到「今天」的總年資，顯示用）
  function calcTenureString(startDateStr) {
    const sd = parseDate(startDateStr);
    if (!sd) return "—";
    const now = new Date();
    let years = now.getFullYear() - sd.getFullYear();
    let months = now.getMonth() - sd.getMonth();
    let days = now.getDate() - sd.getDate();
    if (days < 0) { months -= 1; }
    if (months < 0) { years -= 1; months += 12; }
    return `${years} 年 ${months} 月`;
  }

  // 依台灣勞基法：回傳該年度的「應放天數」
  // 規則（簡化，符合常用實務）：
  // - 未滿半年：0 天
  // - 滿半年未滿一年：3 天
  // - 滿 1 年：7 天
  // - 滿 2 年：10 天
  // - 滿 3 年：14 天
  // - 滿 4 年：14 天
  // - 滿 5 年：15 天
  // - 滿 6~9 年：16~19 天（逐年+1）
  // - 滿 10 年：20 天，之後每滿一年 +1 天，最高 30 天
  function entitlementDaysForYears(fullYears) {
    if (fullYears < 1) return 0; // 半年在後面另行處理（看該年是否達半年門檻）
    if (fullYears === 1) return 7;
    if (fullYears === 2) return 10;
    if (fullYears === 3) return 14;
    if (fullYears === 4) return 14;
    if (fullYears === 5) return 15;
    if (fullYears >= 6 && fullYears <= 9) return 10 + fullYears; // 6→16,7→17,8→18,9→19
    if (fullYears >= 10) return Math.min(20 + (fullYears - 10), 30);
    return 0;
  }

  // 計算某一「年度」的應放（天）
  // 規則：以「當年度的 12/31」與入職日比較，計算當年度的 fullYears。
  // 若當年度尚未滿 1 年，但已滿 6 個月 → 該年度給 3 天。
  function calcEntitlementForYear(startDateStr, year) {
    const sd = parseDate(startDateStr);
    if (!sd) return 0;
    const endOfYear = new Date(year, 11, 31); // 12/31
    if (endOfYear < sd) return 0; // 入職都還沒到

    // 計算該年度截止時的年資
    let fullYears = endOfYear.getFullYear() - sd.getFullYear();
    let m = endOfYear.getMonth() - sd.getMonth();
    let d = endOfYear.getDate() - sd.getDate();
    if (d < 0) m -= 1;
    if (m < 0) { fullYears -= 1; m += 12; }

    if (fullYears < 1) {
      // <1 年 → 檢查是否已滿半年
      if (fullYears === 0 && m >= 6) return 3;
      return 0;
    }
    return entitlementDaysForYears(fullYears);
  }

  // 累加制：到「指定年度」為止的總應放（天）
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

  // ===== 輔助：匯出 Excel =====
  function exportTableToXLSX(tableId, filename) {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // ===== UI =====
  function initYearSelect() {
    const sel = $("#yearSelect");
    const now = new Date();
    const thisYear = now.getFullYear();
    sel.innerHTML = "";
    for (let y = thisYear + 1; y >= thisYear - 5; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === thisYear) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function setLoading(tbodyId, colSpan) {
    const tb = document.getElementById(tbodyId);
    tb.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted-ghost">讀取中…</td></tr>`;
  }

  function setEmpty(tbodyId, colSpan) {
    const tb = document.getElementById(tbodyId);
    tb.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted-ghost">沒有符合條件的資料</td></tr>`;
  }

  // ===== 讀取：特休單（唯讀，annual_leave_requests） =====
  async function loadRequests() {
    setLoading("al-req-body", 9);

    const dateFrom = $("#reqDateFrom").value || "";
    const dateTo = $("#reqDateTo").value || "";
    const kw = ($("#reqEmpKeyword").value || "").trim();

    const snap = await dbRef.collection(REQ_COL).get();
    let rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      // 僅顯示「審核通過」且「特休」
      if (d.status !== "審核通過" || d.leaveType !== "特休") return;

      // 日期篩選（以 leaveDate 為主）
      const ld = fmtDate(d.leaveDate);
      if (dateFrom && ld < dateFrom) return;
      if (dateTo && ld > dateTo) return;

      // 關鍵字（員編 / 姓名）
      const empId = (d.employeeId || d.empId || "").toString();
      const name = (d.applicant || d.name || "").toString();
      if (kw) {
        const hit = empId.includes(kw) || name.includes(kw);
        if (!hit) return;
      }

      rows.push({
        applyDate: fmtDate(d.applyDate || ""),
        applicant: name,
        leaveType: d.leaveType || "",
        leaveDate: ld,
        shift: d.shift || "",
        reason: d.reason || "",
        note: d.note || "",
        supervisorSign: d.supervisorSign || "",
        sourceDocId: d.sourceDocId || doc.id // 優先用來源單號，否則用此筆ID
      });
    });

    // 渲染
    const tb = $("#al-req-body");
    if (!rows.length) {
      setEmpty("al-req-body", 9);
      return;
    }
    tb.innerHTML = rows
      .sort((a, b) => (a.leaveDate > b.leaveDate ? -1 : 1))
      .map(r => `
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

  // ===== 讀取：年假統計（依累加制） =====
  async function loadStats() {
    setLoading("al-stat-body", 7);

    const selectedYear = parseInt($("#yearSelect").value, 10);
    const kw = ($("#statEmpKeyword").value || "").trim();

    // 1) 讀員工資料（可能沒有 empId，盡量以 name 對應）
    // 預期欄位：empId, name, startDate(YYYY-MM-DD)
    const empMap = new Map(); // key: name 或 empId，val: {empId, name, startDate}
    try {
      const empSnap = await dbRef.collection(EMP_COL).get();
      empSnap.forEach(doc => {
        const e = doc.data() || {};
        const empId = (e.empId || e.employeeId || "").toString();
        const name = e.name || e.applicant || "";
        const startDate = fmtDate(e.startDate || e.hireDate || e.entryDate || "");
        if (name) {
          empMap.set(name, { empId, name, startDate });
        } else if (empId) {
          empMap.set(empId, { empId, name, startDate });
        }
      });
    } catch (err) {
      // 若沒有 employees 集合，不影響主流程
      console.warn("讀取員工資料失敗（可忽略）", err);
    }

    // 2) 讀已核准的特休使用量（至所選年度止，累加）
    // 來源：annual_leave_requests，欄位 applicant/name + leaveDate
    const usedHoursByName = new Map(); // key: name, val: hours 累加
    const usedHoursByEmpId = new Map(); // key: empId, val: hours 累加

    const reqSnap = await dbRef.collection(REQ_COL).get();
    reqSnap.forEach(doc => {
      const d = doc.data() || {};
      if (d.status !== "審核通過" || d.leaveType !== "特休") return;
      const name = d.applicant || d.name || "";
      const empId = (d.employeeId || d.empId || "").toString();
      const ld = parseDate(d.leaveDate);
      if (!ld) return;
      if (ld.getFullYear() > selectedYear) return;

      // 本次使用時數：若有 hours 用 hours，否則以 1 天（8 小時）
      const hours = Number.isFinite(d.hours) ? Number(d.hours) : HOURS_PER_DAY;

      if (empId) {
        usedHoursByEmpId.set(empId, (usedHoursByEmpId.get(empId) || 0) + hours);
      } else if (name) {
        usedHoursByName.set(name, (usedHoursByName.get(name) || 0) + hours);
      }
    });

    // 3) 建立所有名單（來自員工資料 + 若員工表缺，就以請假單中的 name 生成）
    const nameSet = new Set([
      ...Array.from(empMap.keys()),
      ...Array.from(usedHoursByName.keys())
    ]);

    // 4) 彙整並渲染
    const rows = [];
    nameSet.forEach(nameKey => {
      // 找出對應的資料
      const empInfo = empMap.get(nameKey) || { empId: "", name: nameKey, startDate: "" };
      const empId = empInfo.empId || "";
      const name = empInfo.name || nameKey;

      // 入職日：若沒有員工資料，先以空值顯示
      const startDate = empInfo.startDate || "";

      // 應放（累加至所選年度），天 → 小時
      const entDaysCumu = startDate ? calcCumulativeEntitlementDays(startDate, selectedYear) : 0;
      const totalHours = entDaysCumu * HOURS_PER_DAY;

      // 已用（累加至所選年度）
      const usedHours =
        (empId && usedHoursByEmpId.get(empId)) ||
        usedHoursByName.get(name) ||
        0;

      const remainingHours = totalHours - usedHours;

      // 關鍵字過濾
      if (kw) {
        const hit = (empId || "").includes(kw) || (name || "").includes(kw);
        if (!hit) return;
      }

      rows.push({
        empId,
        name,
        startDate,
        tenure: startDate ? calcTenureString(startDate) : "—",
        totalHours,
        usedHours,
        remainingHours
      });
    });

    const tb = $("#al-stat-body");
    if (!rows.length) {
      setEmpty("al-stat-body", 7);
      return;
    }

    // 排序：剩餘小時少的在上（方便看到超休）
    rows.sort((a, b) => a.remainingHours - b.remainingHours);

    tb.innerHTML = rows.map(r => {
      const remTxt = hoursToText(r.remainingHours);
      const remClass = r.remainingHours < 0 ? "neg" : "";
      return `
        <tr>
          <td>${r.empId || "—"}</td>
          <td>${r.name || "—"}</td>
          <td>${r.startDate || "—"}</td>
          <td>${r.tenure}</td>
          <td>${hoursToText(r.totalHours)}</td>
          <td>${hoursToText(r.usedHours)}</td>
          <td class="${remClass}">${remTxt}</td>
        </tr>
      `;
    }).join("");
  }

  // ===== 綁定事件 =====
  function bindEvents() {
    // 年度切換 → 兩個分頁都刷新
    $("#yearSelect").addEventListener("change", () => {
      loadRequests();
      loadStats();
    });

    // 特休單：篩選
    $("#reqFilterBtn").addEventListener("click", loadRequests);
    $("#reqClearBtn").addEventListener("click", () => {
      $("#reqDateFrom").value = "";
      $("#reqDateTo").value = "";
      $("#reqEmpKeyword").value = "";
      loadRequests();
    });

    // 年假統計：篩選
    $("#statFilterBtn").addEventListener("click", loadStats);
    $("#statClearBtn").addEventListener("click", () => {
      $("#statEmpKeyword").value = "";
      loadStats();
    });

    // 匯出 Excel
    $("#export-req-excel").addEventListener("click", () => {
      exportTableToXLSX("al-req-body".replace("body", "body") ? "al-req-body" : "al-req-body", `特休單_${$("#yearSelect").value}.xlsx`);
      // 這裡為了穩定性直接抓整個 table
      exportTableToXLSX(document.querySelector("#tab-requests table").id || createTableId("#tab-requests table"), `特休單_${$("#yearSelect").value}.xlsx`);
    });
    $("#export-stat-excel").addEventListener("click", () => {
      exportTableToXLSX(document.querySelector("#tab-stats table").id || createTableId("#tab-stats table"), `年假統計_${$("#yearSelect").value}.xlsx`);
    });
  }

  // 若 table 沒 id，給一個臨時 id 再匯出
  function createTableId(selector) {
    const el = document.querySelector(selector);
    if (!el.id) el.id = "tbl_" + Math.random().toString(36).slice(2, 8);
    return el.id;
  }

  // ===== 入口（等待 firebase-ready） =====
  document.addEventListener("firebase-ready", async () => {
    // firebase-init.js 會建立全域 db
    if (!window.db) {
      console.error("找不到全域 db，請檢查 firebase-init.js 是否正確載入。");
      return;
    }
    dbRef = window.db;

    initYearSelect();
    bindEvents();

    // 預設載入
    await loadRequests();
    await loadStats();

    console.log("✅ 年假系統已就緒");
  });
})();
