// 年假系統（v8，沿用 firebase-ready）
// 來源集合：nurses、caregivers、annual_leave_requests
// 一天=8小時；若請假單有 hours 欄位則優先採用
(function () {
  const HOURS_PER_DAY = 8;
  const REQ_COL = "annual_leave_requests";

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

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
  const endOfYear = (year) => new Date(`${year}-12-31T23:59:59`);
  const startOfYear = (year) => new Date(`${year}-01-01T00:00:00`);

  function hoursToText(h) {
    const neg = h < 0;
    const abs = Math.abs(h);
    const d = Math.floor(abs / HOURS_PER_DAY);
    const hr = abs % HOURS_PER_DAY;
    const txt = `${d} 天${hr ? ` ${hr} 小時` : ""}`;
    return neg ? `-${txt}` : txt;
  }

  // 你的年資對照表（到達該周年時增加的年假「天數」）
  // 例如滿 0.5 年 +3 天、滿 1 年 +7 天、滿 2 年 +10 天… 25 年以上固定 30 天
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
    { years: 24,  days: 30 },
    // 25 以上 → 每年 30 天
  ];

  function addYears(base, yearsFloat) {
    const d = new Date(base.getTime());
    const y = Math.trunc(yearsFloat);
    const moreMonths = Math.round((yearsFloat - y) * 12);
    d.setFullYear(d.getFullYear() + y);
    d.setMonth(d.getMonth() + moreMonths);
    return d;
  }

  // 累加至「所選年度末日」為止的總核給時數（可結轉、累積不清零）
  function calcGrantedHours(hireDate, selectedYear) {
    if (!hireDate) return 0;
    const eoy = endOfYear(selectedYear);
    let sumDays = 0;

    // 先把 0.5~24 年的節點加進去
    ENTITLE_STEPS.forEach(step => {
      const when = addYears(hireDate, step.years);
      if (when <= eoy) sumDays += step.days;
    });

    // 25 年～所選年度滿的年數，每年 30 天
    const fullYears = Math.floor((eoy - hireDate) / (365.25 * 24 * 3600 * 1000));
    if (fullYears >= 25) {
      // 已經跨過 25 年節點
      const after25Start = addYears(hireDate, 25);
      // 從 25 週年當年起，只要當年的 25 週年日期在所選年度年底前，就再加 30
      // 計算 25~fullYears 每年的週年是否 <= eoy
      let y = 25;
      while (y <= fullYears) {
        const ann = addYears(hireDate, y);
        if (ann <= eoy) sumDays += 30;
        y++;
      }
    }

    return sumDays * HOURS_PER_DAY;
  }

  // 年資（今天為基準 → X年Y月）
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

  function setLoading(tbodyId, colSpan) {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${colSpan}" class="text-center text-muted">讀取中…</td></tr>`;
  }
  function setEmpty(tbodyId, colSpan) {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${colSpan}" class="text-center text-muted">沒有符合條件的資料</td></tr>`;
  }

  // Excel 匯出
  function exportTableToXLSX(tableId, filename) {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // ====== 主流程 ======
  document.addEventListener("firebase-ready", async () => {
    const db = firebase.firestore();

    // 年度下拉
    initYearSelect();
    $("#yearSelect").addEventListener("change", () => {
      renderRequests();
      renderSummary();
    });

    // 篩選區按鈕
    $("#reqFilterBtn")?.addEventListener("click", renderRequests);
    $("#reqClearBtn")?.addEventListener("click", () => {
      $("#reqDateFrom").value = "";
      $("#reqDateTo").value = "";
      $("#reqEmpSelect").value = "";
      renderRequests();
    });
    $("#exportReqExcel")?.addEventListener("click", () =>
      exportTableToXLSX("reqTable", `特休單_${$("#yearSelect").value}.xlsx`)
    );

    $("#statFilterBtn")?.addEventListener("click", renderSummary);
    $("#statClearBtn")?.addEventListener("click", () => {
      $("#statEmpSelect").value = "";
      renderSummary();
    });
    $("#exportStatExcel")?.addEventListener("click", () =>
      exportTableToXLSX("statTable", `年假統計_${$("#yearSelect").value}.xlsx`)
    );

    // 先載入人員 → 建立下拉
    await loadEmployeeOptions(db);

    // 初次渲染
    renderRequests();
    renderSummary();

    // ===== functions =====
    async function loadEmployeeOptions(db) {
      const reqSel  = $("#reqEmpSelect");
      const statSel = $("#statEmpSelect");
      reqSel.innerHTML  = `<option value="">全部</option>`;
      statSel.innerHTML = `<option value="">全部</option>`;

      // nurses
      const nurseSnap = await db.collection("nurses").orderBy("sortOrder").get();
      nurseSnap.forEach(doc => {
        const d = doc.data();
        const empId   = d.id || doc.id;
        const name    = d.name || "";
        const hire    = toDate(d.hireDate);
        const label   = `${empId} ${name}（護理師）`;
        reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        statSel.innerHTML += `<option value="${empId}">${label}</option>`;
      });

      // caregivers
      const cgSnap = await db.collection("caregivers").orderBy("sortOrder").get();
      cgSnap.forEach(doc => {
        const d = doc.data();
        const empId = d.id || doc.id;
        const name  = d.name || "";
        const label = `${empId} ${name}（照服員）`;
        reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        statSel.innerHTML += `<option value="${empId}">${label}</option>`;
      });
    }

    function initYearSelect() {
      const sel = $("#yearSelect");
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

    // 讀特休單（唯讀頁籤）
    async function renderRequests() {
      const year = Number($("#yearSelect").value);
      const fromDate = $("#reqDateFrom").value ? toDate($("#reqDateFrom").value) : startOfYear(year);
      const toDateV  = $("#reqDateTo").value   ? toDate($("#reqDateTo").value)   : endOfYear(year);
      const empId    = $("#reqEmpSelect").value;

      setLoading("reqTbody", 9);

      // 為了相容可能的欄位名：date 或 leaveDate，都抓回來再用 JS 篩
      const qs = await db.collection(REQ_COL)
        .where("status", "==", "審核通過")
        .where("leaveType", "==", "特休")
        .get();

      const rows = [];
      qs.forEach(doc => {
        const d = doc.data();
        const dateStr = d.date || d.leaveDate; // 相容不同欄位名
        const leaveAt = toDate(dateStr);
        if (!leaveAt) return;

        if (leaveAt < fromDate || leaveAt > toDateV) return;
        if (empId && (d.empId !== empId && d.id !== empId && d.applicantId !== empId)) return;

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

      const tbody = $("#reqTbody");
      if (!rows.length) { setEmpty("reqTbody", 9); return; }

      tbody.innerHTML = rows
        .sort((a,b)=> a.leaveDate.localeCompare(b.leaveDate))
        .map(r => `
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

    // 年假統計
    async function renderSummary() {
      const year = Number($("#yearSelect").value);
      const empFilter = $("#statEmpSelect").value;
      setLoading("statTbody", 7);

      // 載入人員（nurses + caregivers）
      const people = [];
      const nurseSnap = await db.collection("nurses").orderBy("sortOrder").get();
      nurseSnap.forEach(doc => {
        const d = doc.data();
        people.push({
          empId: d.id || doc.id,
          name: d.name || "",
          role: "護理師",
          hireDate: toDate(d.hireDate)
        });
      });
      const cgSnap = await db.collection("caregivers").orderBy("sortOrder").get();
      cgSnap.forEach(doc => {
        const d = doc.data();
        people.push({
          empId: d.id || doc.id,
          name: d.name || "",
          role: "照服員",
          hireDate: toDate(d.hireDate)
        });
      });

      // 依選擇人員過濾
      const list = empFilter ? people.filter(p => p.empId === empFilter) : people;

      // 讀年度（含以前）之已用特休（<=當年度 12/31）
      const eoy = endOfYear(year);
      const usedMap = {}; // empId -> hours

      const reqSnap = await db.collection(REQ_COL)
        .where("status", "==", "審核通過")
        .where("leaveType", "==", "特休")
        .get();

      reqSnap.forEach(doc => {
        const d = doc.data();
        const dateStr = d.date || d.leaveDate;
        const leaveAt = toDate(dateStr);
        if (!leaveAt) return;
        if (leaveAt > eoy) return;

        const empId = d.empId || d.id || d.applicantId; // 盡量抓到員編
        if (!empId) return;

        const hours = Number(d.hours) > 0 ? Number(d.hours) : HOURS_PER_DAY;
        usedMap[empId] = (usedMap[empId] || 0) + hours;
      });

      // 組表格
      const tbody = $("#statTbody");
      if (!list.length) { setEmpty("statTbody", 7); return; }

      const rows = list.map(p => {
        const granted = calcGrantedHours(p.hireDate, year);
        const used    = usedMap[p.empId] || 0;
        const remain  = granted - used;
        return {
          empId: p.empId,
          name: p.name,
          hireDate: p.hireDate ? ymd(p.hireDate) : "",
          seniority: seniorityText(p.hireDate),
          grantedText: hoursToText(granted),
          usedText: hoursToText(used),
          remain, // 先存數字，方便判斷正負
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
  });
})();
