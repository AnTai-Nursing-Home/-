// 年假系統（v8，沿用 firebase-ready，不改 firebase-init.js / 不改 HTML）
// 來源集合：nurses、caregivers、annual_leave_requests
// 功能：特休單（唯讀）＋ 年假統計（員工下拉篩選）＋ Excel 匯出
// 規格：一天=8小時；若請假單有 hours 欄位則優先採用；剩餘為負數顯示紅字
(function () {
  const HOURS_PER_DAY = 8;
  const REQ_COL = "annual_leave_requests";
  const EMPTY_TEXT = "目前沒有符合條件的資料";

  const $  = (s) => document.querySelector(s);

  const toDate = (s) => {
    if (!s) return null;
    const t = String(s).replace(/\./g, "-").replace(/\//g, "-");
    const d = new Date(t);
    return isNaN(d) ? null : d;
    };
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };
  const startOfYear = (year) => new Date(`${year}-01-01T00:00:00`);
  const endOfYear   = (year) => new Date(`${year}-12-31T23:59:59`);

  // 你的年資對照表（周年制，累加至所選年度年底）
  const ENTITLE_STEPS = [
    { years: 0.5, days: 3 },
    { years: 1,   days: 7 },
    { years: 2,   days: 10 },
    { years: 3,   days: 14 },
    { years: 4,   days: 14 },
    { years: 5,   days: 15 },
    { years: 6,   days: 15 },
    { years: 7,   days: 15 },
    { years: 8,   days: 15 },
    { years: 9,   days: 15 },
    { years: 10,  days: 16 },
    { years: 11,  days: 17 },
    { years: 12,  days: 18 },
    { years: 13,  days: 19 },
    { years: 14,  days: 20 },
    { years: 15,  days: 21 },
    { years: 16,  days: 22 },
    { years: 17,  days: 23 },
    { years: 18,  days: 24 },
    { years: 19,  days: 25 },
    { years: 20,  days: 26 },
    { years: 21,  days: 27 },
    { years: 22,  days: 28 },
    { years: 23,  days: 29 },
    { years: 24,  days: 30 }, // 25 年以上：每年 30 天（見下方邏輯）
  ];

  function addYears(base, yearsFloat) {
    const d = new Date(base.getTime());
    const y = Math.trunc(yearsFloat);
    const moreMonths = Math.round((yearsFloat - y) * 12);
    d.setFullYear(d.getFullYear() + y);
    d.setMonth(d.getMonth() + moreMonths);
    return d;
  }

  function calcGrantedHours(hireDate, selectedYear) {
    if (!hireDate) return 0;
    const eoy = endOfYear(selectedYear);
    let sumDays = 0;

    // 加入 0.5~24 年的節點
    ENTITLE_STEPS.forEach(step => {
      const when = addYears(hireDate, step.years);
      if (when <= eoy) sumDays += step.days;
    });

    // 25 年（含）以上：每達到一個周年，加 30 天
    const totalYearsFloat = (eoy - hireDate) / (365.25 * 24 * 3600 * 1000);
    const fullYears = Math.floor(totalYearsFloat);
    for (let y = 25; y <= fullYears; y++) {
      const ann = addYears(hireDate, y);
      if (ann <= eoy) sumDays += 30;
    }

    return sumDays * HOURS_PER_DAY;
  }

  function seniorityText(hireDate) {
    if (!hireDate) return "-";
    const today = new Date();
    let y = today.getFullYear() - hireDate.getFullYear();
    let m = today.getMonth() - hireDate.getMonth();
    let d = today.getDate() - hireDate.getDate();
    if (d < 0) { m -= 1; }
    if (m < 0) { y -= 1; m += 12; }
    return `${y}年${m}月`;
  }

  function hoursToText(h) {
    const neg = h < 0;
    const abs = Math.abs(h);
    const d = Math.floor(abs / HOURS_PER_DAY);
    const hr = abs % HOURS_PER_DAY;
    const txt = `${d} 天${hr ? ` ${hr} 小時` : ""}`;
    return neg ? `-${txt}` : txt;
  }

  function setLoading(tbodyId, colSpan) {
    const el = document.getElementById(tbodyId);
    if (!el) return; // 保險：避免報錯中斷
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted">讀取中…</td></tr>`;
  }
  function setEmpty(tbodyId, colSpan) {
    const el = document.getElementById(tbodyId);
    if (!el) return;
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted">${EMPTY_TEXT}</td></tr>`;
  }

  // 若 table 沒 id，動態補一個，供匯出用
  function ensureTableId(selector, fallbackId) {
    const el = document.querySelector(selector);
    if (!el) return null;
    if (!el.id) el.id = fallbackId;
    return el.id;
  }

  // 匯出 Excel（依你指定的命名規則 C）
  function exportBySelector(selector, filename) {
    const id = ensureTableId(selector, "tbl_" + Math.random().toString(36).slice(2, 8));
    if (!id) return;
    const table = document.getElementById(id);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // ===== 主流程：等 firebase-ready =====
  document.addEventListener("firebase-ready", async () => {
    const db = firebase.firestore();

    // 初始化年度下拉
    initYearSelect();

    // 綁定事件
    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(db);
      renderSummary(db);
    });
    $("#reqFilterBtn")?.addEventListener("click", () => renderRequests(db));
    $("#reqClearBtn")?.addEventListener("click", () => {
      const y = Number($("#yearSelect").value);
      $("#reqDateFrom").value = ""; // 清空 → 由程式用年度預設
      $("#reqDateTo").value   = "";
      $("#reqEmpSelect").value = "";
      renderRequests(db);
    });
    $("#export-req-excel")?.addEventListener("click", () => {
      const year = $("#yearSelect").value || new Date().getFullYear();
      exportBySelector("#tab-requests table, #tab-req table", `安泰護理之家_特休單_${year}.xlsx`);
    });

    $("#statEmpSelect")?.addEventListener("change", () => renderSummary(db));
    $("#export-stat-excel")?.addEventListener("click", () => {
      const year = $("#yearSelect").value || new Date().getFullYear();
      exportBySelector("#tab-stats table, #tab-stat table", `安泰護理之家_年假統計_${year}.xlsx`);
    });

    // 先載入員工清單 → 建立兩個下拉（特休單、統計）
    await loadEmployeeOptions(db);

    // 初次渲染
    renderRequests(db);
    renderSummary(db);
  });

  function initYearSelect() {
    const sel = $("#yearSelect");
    if (!sel) return;
    const y = new Date().getFullYear();
    sel.innerHTML = "";
    for (let yy = y + 1; yy >= y - 5; yy--) {
      const opt = document.createElement("option");
      opt.value = String(yy);
      opt.textContent = String(yy);
      if (yy === y) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function loadEmployeeOptions(db) {
    const reqSel  = $("#reqEmpSelect");
    const statSel = $("#statEmpSelect");
    if (reqSel)  reqSel.innerHTML  = `<option value="">全部</option>`;
    if (statSel) statSel.innerHTML = `<option value="">全部</option>`;

    // nurses
    try {
      const nurseSnap = await db.collection("nurses").orderBy("sortOrder").get();
      nurseSnap.forEach(doc => {
        const d = doc.data();
        const empId = d.id || doc.id;
        const name  = d.name || "";
        const label = `${empId} ${name}（護理師）`;
        if (reqSel)  reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        if (statSel) statSel.innerHTML += `<option value="${empId}">${label}</option>`;
      });
    } catch (e) {
      console.warn("讀取 nurses 失敗（可略）：", e);
    }

    // caregivers
    try {
      const cgSnap = await db.collection("caregivers").orderBy("sortOrder").get();
      cgSnap.forEach(doc => {
        const d = doc.data();
        const empId = d.id || doc.id;
        const name  = d.name || "";
        const label = `${empId} ${name}（照服員）`;
        if (reqSel)  reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        if (statSel) statSel.innerHTML += `<option value="${empId}">${label}</option>`;
      });
    } catch (e) {
      console.warn("讀取 caregivers 失敗（可略）：", e);
    }
  }

  // ===== 特休單（唯讀） =====
  async function renderRequests(db) {
    const year  = Number($("#yearSelect")?.value || new Date().getFullYear());
    const empId = $("#reqEmpSelect")?.value || "";

    // 日期範圍：若未填，預設整個年度
    const fromDate = $("#reqDateFrom")?.value ? toDate($("#reqDateFrom").value) : startOfYear(year);
    const toDateV  = $("#reqDateTo")?.value   ? toDate($("#reqDateTo").value)   : endOfYear(year);

    setLoading("al-req-body", 9);

    // 拉回來 JS 篩（相容不同欄位名：date/leaveDate、empId/id/applicantId）
    let snap;
    try {
      snap = await db.collection(REQ_COL)
        .where("status", "==", "審核通過")
        .where("leaveType", "==", "特休")
        .get();
    } catch (e) {
      console.error("讀取 annual_leave_requests 失敗：", e);
      setEmpty("al-req-body", 9);
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const dateStr = d.date || d.leaveDate;
      const leaveAt = toDate(dateStr);
      if (!leaveAt) return;
      if (leaveAt < fromDate || leaveAt > toDateV) return;

      if (empId) {
        const hitId = d.empId || d.id || d.applicantId || "";
        if (hitId !== empId) return;
      }

      rows.push({
        applyDate: d.applyDate || "",
        name: d.applicant || d.name || "",
        leaveType: d.leaveType || "特休",
        leaveDate: ymd(leaveAt),
        shift: d.shift || "",
        reason: d.reason || "",
        note: d.note || "",
        supervisor: d.supervisorSign || d.approvedBy || "",
        sourceId: d.sourceId || doc.id
      });
    });

    const tbody = $("#al-req-body");
    if (!tbody) return;

    if (!rows.length) {
      setEmpty("al-req-body", 9);
      return;
    }

    rows.sort((a,b)=> a.leaveDate.localeCompare(b.leaveDate));

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.applyDate || ""}</td>
        <td>${r.name || ""}</td>
        <td>${r.leaveType}</td>
        <td>${r.leaveDate}</td>
        <td>${r.shift}</td>
        <td>${r.reason || ""}</td>
        <td>${r.note || ""}</td>
        <td>${r.supervisor || ""}</td>
        <td>${r.sourceId}</td>
      </tr>
    `).join("");
  }

  // ===== 年假統計（員工下拉，不做日期篩選） =====
  async function renderSummary(db) {
    const year  = Number($("#yearSelect")?.value || new Date().getFullYear());
    const empIdFilter = $("#statEmpSelect")?.value || "";

    setLoading("al-stat-body", 7);

    // 載入人員（nurses + caregivers）
    const people = [];
    try {
      const nurseSnap = await db.collection("nurses").orderBy("sortOrder").get();
      nurseSnap.forEach(doc => {
        const d = doc.data();
        people.push({
          empId: d.id || doc.id,
          name: d.name || "",
          hireDate: toDate(d.hireDate),
        });
      });
    } catch (e) {
      console.warn("讀取 nurses 失敗（可略）：", e);
    }
    try {
      const cgSnap = await db.collection("caregivers").orderBy("sortOrder").get();
      cgSnap.forEach(doc => {
        const d = doc.data();
        people.push({
          empId: d.id || doc.id,
          name: d.name || "",
          hireDate: toDate(d.hireDate),
        });
      });
    } catch (e) {
      console.warn("讀取 caregivers 失敗（可略）：", e);
    }

    // 依選擇人員過濾
    const list = empIdFilter ? people.filter(p => p.empId === empIdFilter) : people;

    // 讀取 <= 當年度 12/31 的已用特休
    const usedMap = {}; // empId -> hours
    let reqSnap;
    try {
      reqSnap = await db.collection(REQ_COL)
        .where("status", "==", "審核通過")
        .where("leaveType", "==", "特休")
        .get();
    } catch (e) {
      console.error("讀取 annual_leave_requests 失敗：", e);
      setEmpty("al-stat-body", 7);
      return;
    }

    const eoy = endOfYear(year);
    reqSnap.forEach(doc => {
      const d = doc.data() || {};
      const dateStr = d.date || d.leaveDate;
      const leaveAt = toDate(dateStr);
      if (!leaveAt || leaveAt > eoy) return;

      const empId = d.empId || d.id || d.applicantId;
      if (!empId) return;

      const hours = Number(d.hours) > 0 ? Number(d.hours) : HOURS_PER_DAY;
      usedMap[empId] = (usedMap[empId] || 0) + hours;
    });

    const tbody = $("#al-stat-body");
    if (!tbody) return;

    if (!list.length) {
      setEmpty("al-stat-body", 7);
      return;
    }

    const rows = list.map(p => {
      const granted = calcGrantedHours(p.hireDate, year); // 累積權益（結轉不清零）
      const used    = usedMap[p.empId] || 0;              // 到當年 12/31 的已用
      const remain  = granted - used;                     // 可為負數
      return {
        empId: p.empId,
        name: p.name,
        hireDate: p.hireDate ? ymd(p.hireDate) : "",
        seniority: seniorityText(p.hireDate),
        grantedText: hoursToText(granted),
        usedText: hoursToText(used),
        remain,
        remainText: hoursToText(remain)
      };
    }).sort((a,b)=> a.empId.localeCompare(b.empId));

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.empId}</td>
        <td>${r.name}</td>
        <td>${r.hireDate || ""}</td>
        <td>${r.seniority}</td>
        <td>${r.grantedText}</td>
        <td>${r.usedText}</td>
        <td class="${r.remain < 0 ? 'neg' : ''}">${r.remainText}</td>
      </tr>
    `).join("");
  }
})();
