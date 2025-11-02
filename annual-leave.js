// 年假系統（修正版）
// - 讀取 annual_leave_requests，對齊請假系統的拋轉欄位：name/date/reason/sourceDocId/approvedBy/createdAt
// - 顯示欄位順序：申請日期、申請人、假別、請假日期、班別、請假原因、備註、審核者、來源單號
// - applyDate 若缺 → 用 createdAt 推 yyyy-mm-dd
// - 班別 shift 若缺 → 顯示「-」
// - 審核者以 approvedBy 優先，無則用 supervisorSign
// - 不改你的 Firebase 結構 / 不改 HTML
alert("✅ Annual-leave.js 已載入！");

(function () {
  const HOURS_PER_DAY = 8;
  const REQ_COL = "annual_leave_requests";
  const EMPTY_TEXT = "目前沒有符合條件的資料";

  const EMP_MAP = {}; // empId -> { name, role }
  const $  = (s) => document.querySelector(s);

  // ---- date helpers ----
  const toDate = (s) => {
    if (!s) return null;
    const t = String(s).replace(/\./g, "-").replace(/\//g, "-");
    const d = new Date(t);
    return isNaN(d) ? null : d;
  };
  const ymd = (d) => {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };
  const startOfYear = (year) => new Date(`${year}-01-01T00:00:00`);
  const endOfYear   = (year) => new Date(`${year}-12-31T23:59:59`);

  // ---- 年資規則（保留原邏輯） ----
  const ENTITLE_STEPS = [
    { years: 0.5, days: 3 }, { years: 1, days: 7 }, { years: 2, days: 10 },
    { years: 3, days: 14 }, { years: 4, days: 14 }, { years: 5, days: 15 },
    { years: 6, days: 15 }, { years: 7, days: 15 }, { years: 8, days: 15 },
    { years: 9, days: 15 }, { years: 10, days: 16 }, { years: 11, days: 17 },
    { years: 12, days: 18 }, { years: 13, days: 19 }, { years: 14, days: 20 },
    { years: 15, days: 21 }, { years: 16, days: 22 }, { years: 17, days: 23 },
    { years: 18, days: 24 }, { years: 19, days: 25 }, { years: 20, days: 26 },
    { years: 21, days: 27 }, { years: 22, days: 28 }, { years: 23, days: 29 },
    { years: 24, days: 30 },
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
    ENTITLE_STEPS.forEach(step => {
      const when = addYears(hireDate, step.years);
      if (when <= eoy) sumDays += step.days;
    });
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
    if (!el) return;
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted">讀取中…</td></tr>`;
  }
  function setEmpty(tbodyId, colSpan) {
    const el = document.getElementById(tbodyId);
    if (!el) return;
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted">${EMPTY_TEXT}</td></tr>`;
  }
  function ensureTableId(selector, fallbackId) {
    const el = document.querySelector(selector);
    if (!el) return null;
    if (!el.id) el.id = fallbackId;
    return el.id;
  }
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

    initYearSelect();

    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(db);
      renderQuickList(db);
      renderSummary(db);
    });
    $("#reqFilterBtn")?.addEventListener("click", () => renderRequests(db));
    $("#reqClearBtn")?.addEventListener("click", () => {
      $("#reqDateFrom").value = "";
      $("#reqDateTo").value   = "";
      $("#reqEmpSelect").value = "";
      renderRequests(db);
      renderQuickList(db);
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

    await loadEmployeeOptions(db);

    // 初次渲染
    renderRequests(db);
    renderQuickList(db);
    renderSummary(db);

    // ===== 快速補登送出 =====
    $("#quickSubmit")?.addEventListener("click", async () => {
      const empId  = $("#quickEmpSelect")?.value || "";
      const dateStr= $("#quickDate")?.value || "";
      const amount = Number($("#quickAmount")?.value || "0");
      const unit   = $("#quickUnit")?.value || "day";
      const reason = $("#quickReason")?.value?.trim() || "快速補登";

      if (!empId) return alert("請選擇員工");
      if (!dateStr) return alert("請選擇日期");
      if (!(amount > 0)) return alert("請輸入有效數值");

      const name  = EMP_MAP[empId]?.name || "";
      const hours = unit === "day" ? (amount * HOURS_PER_DAY) : amount;

      try {
        await db.collection(REQ_COL).add({
          empId, name,
          leaveType: "特休",
          status: "審核通過",
          date: dateStr,
          hours,
          reason,
          source: "快速補登",
          createdAt: new Date().toISOString()
        });
        $("#quickAmount").value = "";
        $("#quickReason").value = "";
        await renderQuickList(db);
        await renderSummary(db);
        alert("已補登成功！");
      } catch (e) {
        console.error("快速補登失敗：", e);
        alert("補登失敗，請稍後再試");
      }
    });
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
    const reqSel   = $("#reqEmpSelect");
    const statSel  = $("#statEmpSelect");
    const quickSel = $("#quickEmpSelect");
    if (reqSel)  reqSel.innerHTML  = `<option value="">全部</option>`;
    if (quickSel) quickSel.innerHTML = `<option value="">請選擇</option>`;
    if (statSel) statSel.innerHTML = `<option value="">全部</option>`;

    try {
      const nurseSnap = await db.collection("nurses").orderBy("sortOrder").get();
      nurseSnap.forEach(doc => {
        const d = doc.data();
        const empId = d.id || doc.id;
        const name  = d.name || "";
        const label = `${empId} ${name}（護理師）`;
        if (reqSel)  reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        if (statSel) statSel.innerHTML += `<option value="${empId}">${label}</option>`;
        if (quickSel) quickSel.innerHTML += `<option value="${empId}">${label}</option>`;
        EMP_MAP[empId] = { name, role: "護理師" };
      });
    } catch (e) {
      console.warn("讀取 nurses 失敗（可略）：", e);
    }

    try {
      const cgSnap = await db.collection("caregivers").orderBy("sortOrder").get();
      cgSnap.forEach(doc => {
        const d = doc.data();
        const empId = d.id || doc.id;
        const name  = d.name || "";
        const label = `${empId} ${name}（照服員）`;
        if (reqSel)  reqSel.innerHTML  += `<option value="${empId}">${label}</option>`;
        if (statSel) statSel.innerHTML += `<option value="${empId}">${label}</option>`;
        if (quickSel) quickSel.innerHTML += `<option value="${empId}">${label}</option>`;
        EMP_MAP[empId] = { name, role: "護理師" }; // 保持原結構
      });
    } catch (e) {
      console.warn("讀取 caregivers 失敗（可略）：", e);
    }
  }

  // ===== 特休單（唯讀） =====
  async function renderRequests(db) {
    const year  = Number($("#yearSelect")?.value || new Date().getFullYear());
    const empId = $("#reqEmpSelect")?.value || "";

    // 預設整個年度；若有輸入日期才用輸入值
    const fromDate = $("#reqDateFrom")?.value ? toDate($("#reqDateFrom").value) : startOfYear(year);
    const toDateV  = $("#reqDateTo")?.value   ? toDate($("#reqDateTo").value)   : endOfYear(year);

    setLoading("al-req-body", 9);

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

      // 日期（用 date / leaveDate）
      const dateStr = d.date || d.leaveDate;
      const leaveAt = toDate(dateStr);
      if (!leaveAt) return;
      if (leaveAt < fromDate || leaveAt > toDateV) return;

      // 員工篩選
      if (empId) {
        const hitId = d.empId || d.id || d.applicantId || "";
        if (hitId !== empId) return;
      }

      // 排除快速補登（顯示在另一頁籤）
      if ((d.source || "") === "快速補登") return;

      // 申請日期：applyDate 若無 → createdAt → 空字串
      const applyAt = d.applyDate ? toDate(d.applyDate) : (d.createdAt ? toDate(d.createdAt) : null);
      const applyDate = applyAt ? ymd(applyAt) : "";

      rows.push({
        applyDate,
        name: d.applicant || d.name || "",
        leaveType: d.leaveType || "特休",
        leaveDate: ymd(leaveAt),
        shift: d.shift || "-", // 班別未拋轉則顯示「-」
        reason: d.reason || "",
        note: d.note || "",
        supervisor: d.approvedBy || d.supervisorSign || "", // 你選 A：只顯示名字
        sourceId: d.sourceDocId || d.sourceId || doc.id     // 來源單號
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
        <td>${r.applyDate}</td>
        <td>${r.name}</td>
        <td>${r.leaveType}</td>
        <td>${r.leaveDate}</td>
        <td>${r.shift}</td>
        <td>${r.reason}</td>
        <td>${r.note}</td>
        <td>${r.supervisor}</td>
        <td>${r.sourceId}</td>
      </tr>
    `).join("");
  }

  // ===== 快速補登列表（維持原有邏輯） =====
  async function renderQuickList(db) {
    const year  = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year);
    const to = endOfYear(year);

    let snap;
    try {
      snap = await db.collection(REQ_COL)
        .where("status", "==", "審核通過")
        .where("leaveType", "==", "特休")
        .get();
    } catch (e) {
      console.error("讀取快速補登失敗：", e);
      setEmpty("quick-body", 6);
      return;
    }

    const list = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.source !== "快速補登") return;
      const leaveAt = toDate(d.date || d.leaveDate);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;
      const empId = d.empId || d.id || d.applicantId;
      const name = d.name || d.applicant || "";
      const hours = Number(d.hours) || HOURS_PER_DAY;
      list.push({
        id: doc.id,
        date: ymd(leaveAt),
        name: `${empId} ${name}`,
        hours: hours,
        reason: d.reason || "",
        source: d.source || ""
      });
    });

    const tbody = $("#quick-body");
    if (!tbody) return;
    if (!list.length) { setEmpty("quick-body", 6); return; }

    tbody.innerHTML = list.sort((a,b) => a.date.localeCompare(b.date)).map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.name}</td>
        <td>${r.hours}</td>
        <td>${r.reason}</td>
        <td>${r.source}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-id="${r.id}"><i class="fa-solid fa-trash-can"></i></button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("確定要刪除此補登紀錄？")) return;
        try {
          await firebase.firestore().collection(REQ_COL).doc(id).delete();
          await renderQuickList(firebase.firestore());
          await renderSummary(firebase.firestore());
        } catch (e) {
          alert("刪除失敗，請稍後再試");
        }
      });
    });
  }

  // ===== 年假統計（保留原邏輯） =====
  async function renderSummary(db) {
    const year  = Number($("#yearSelect")?.value || new Date().getFullYear());
    const empIdFilter = $("#statEmpSelect")?.value || "";

    setLoading("al-stat-body", 7);

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

    const list = empIdFilter ? people.filter(p => p.empId === empIdFilter) : people;

    const usedMap = {};
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
      const leaveAt = toDate(d.date || d.leaveDate);
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
