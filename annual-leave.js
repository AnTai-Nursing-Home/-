
/**
 * annual-leave.js — FINAL v2025-11-02-AL5
 * - 三頁分流：特休單(唯讀) / 快速補登 / 年假統計
 * - 特休單(唯讀)：只顯示請假系統鏡像（排除 source=="快速補登"）
 * - 快速補登：只顯示 source=="快速補登"，支援直接新增
 * - 年假統計：採「階梯累計制 + 永不清空」，已用年假包含所有來源
 * - 自動載入員工名單到三個下拉選單：reqEmpSelect / quickEmpSelect / statEmpSelect
 */

(function(){
  const DB = () => firebase.firestore();
  const COL = "annual_leave_requests";
  const HOURS_PER_DAY = 8;
  const $ = (s) => document.querySelector(s);

  // ---- 年資規則（達門檻即累加；>24 每滿一年+30天） ----
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

  // ---- helpers ----
  function toDate(s){
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) {
      const t = String(s).replace(/\./g,"-").replace(/\//g,"-");
      const dd = new Date(t);
      return isNaN(dd) ? null : dd;
    }
    return d;
  }
  function ymd(d){
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const da= String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }
  function startOfYear(y){ return new Date(`${y}-01-01T00:00:00`); }
  function endOfYear(y){ return new Date(`${y}-12-31T23:59:59`); }
  function textDayHour(h){
    const neg = (Number(h)||0) < 0;
    const H = Math.abs(Number(h) || 0);
    const d = Math.floor(H / HOURS_PER_DAY);
    const r = H % HOURS_PER_DAY;
    const txt = (d?`${d} 天`:"") + (r? (d?" ":"") + `${r} 小時` : (d?"":"0 小時"));
    return neg ? `-${txt}` : txt;
  }
  function seniorityText(hireDate){
    if (!hireDate) return "";
    const today = new Date();
    let y = today.getFullYear() - hireDate.getFullYear();
    let m = today.getMonth() - hireDate.getMonth();
    let d = today.getDate() - hireDate.getDate();
    if (d < 0) { m -= 1; }
    if (m < 0) { y -= 1; m += 12; }
    return `${y}年${m}月`;
  }
  function addYears(base, yearsFloat) {
    const d = new Date(base.getTime());
    const y = Math.trunc(yearsFloat);
    const moreMonths = Math.round((yearsFloat - y) * 12);
    d.setFullYear(d.getFullYear() + y);
    d.setMonth(d.getMonth() + moreMonths);
    return d;
  }

  // 階梯累計制（到達門檻即累加），>24年每滿一年 +30 天
  function calcGrantedHours(hireDate, selectedYear) {
    if (!hireDate) return 0;
    const eoy = endOfYear(selectedYear);
    let sumDays = 0;
    ENTITLE_STEPS.forEach(step => {
      const when = addYears(hireDate, step.years);
      if (when <= eoy) sumDays += step.days;
    });
    const fullYears = Math.floor((eoy - hireDate) / (365.25 * 24 * 3600 * 1000));
    for (let y = 25; y <= fullYears; y++) {
      const ann = addYears(hireDate, y);
      if (ann <= eoy) sumDays += 30;
    }
    return sumDays * HOURS_PER_DAY;
  }

  // ===== 員工名單載入 → 三個下拉 =====
  async function loadEmployeesIntoSelects() {
    const selects = [
      $("#reqEmpSelect"),
      $("#quickEmpSelect"),
      $("#statEmpSelect")
    ].filter(Boolean);
    if (!selects.length) return;

    const list = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data() || {};
        list.push({ empId: d.empId || d.id || doc.id || "", name: d.name || "" });
      });
    } catch(e) {}
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data() || {};
        list.push({ empId: d.empId || d.id || doc.id || "", name: d.name || "" });
      });
    } catch(e) {}

    list.sort((a,b)=> (a.empId||"").localeCompare(b.empId||""));

    const opts = [`<option value="">全部</option>`]
      .concat(list.map(p => `<option value="${p.empId}" data-name="${p.name}">${p.empId}　${p.name}</option>`))
      .join("");

    selects.forEach(sel => sel.innerHTML = opts);
  }

  // ===== 特休單（唯讀）— 只顯示「請假系統」鏡像資料 =====
  async function renderRequests(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = toDate($("#reqDateFrom")?.value) || startOfYear(year);
    const to   = toDate($("#reqDateTo")?.value)   || endOfYear(year);
    const emp  = $("#reqEmpSelect")?.value || "";
    const tbody = $("#al-req-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">讀取中…</td></tr>`;

    const snap = await DB().collection(COL).get().catch(()=>null);
    if (!snap) { tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">沒有資料</td></tr>`; return; }

    const list = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.source === "快速補登") return;
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;
      if (emp && d.empId !== emp) return;

      const applyAt = d.applyDate ? toDate(d.applyDate) : (d.createdAt ? toDate(d.createdAt) : null);
      const applyDate = applyAt ? ymd(applyAt) : "";

      list.push({
        applyDate,
        applicant: d.applicant || d.name || "",
        leaveType: d.leaveType || "特休",
        leaveDate: ymd(leaveAt),
        shift: d.shift || "-",
        reason: d.reason || "",
        note: d.note || "",
        supervisorSign: d.supervisorSign || d.approvedBy || "",
        sourceDocId: d.sourceDocId || doc.id
      });
    });

    if (!list.length) { tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">沒有資料</td></tr>`; return; }
    list.sort((a,b)=> a.leaveDate.localeCompare(b.leaveDate));
    tbody.innerHTML = list.map(r => `
      <tr>
        <td>${r.applyDate}</td>
        <td>${r.applicant}</td>
        <td>${r.leaveType}</td>
        <td>${r.leaveDate}</td>
        <td>${r.shift}</td>
        <td>${r.reason}</td>
        <td>${r.note}</td>
        <td>${r.supervisorSign}</td>
        <td>${r.sourceDocId}</td>
      </tr>
    `).join("");
  }

  // ===== 快速補登：列表 + 新增 =====
  async function renderQuickList(){
    const body = $("#quick-body");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>`;
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);

    const snap = await DB().collection(COL).where("source","==","快速補登").get().catch(()=>null);
    if (!snap || snap.empty) { body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;
      rows.push({
        id: doc.id,
        date: ymd(leaveAt),
        who: `${d.empId||""} ${d.applicant||d.name||""}`.trim(),
        hours: Number(d.hoursUsed)||HOURS_PER_DAY,
        reason: d.reason || "",
        source: d.source || ""
      });
    });
    if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }
    body.innerHTML = rows.sort((a,b)=> a.date.localeCompare(b.date)).map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.who}</td>
        <td>${r.hours}</td>
        <td>${r.reason}</td>
        <td>${r.source}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-id="${r.id}"><i class="fa-solid fa-trash-can"></i></button></td>
      </tr>
    `).join("");

    body.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("確定要刪除此補登紀錄？")) return;
        await DB().collection(COL).doc(id).delete();
        renderQuickList();
        renderSummary();
      });
    });
  }

  async function handleQuickSubmit() {
    const empSel = $("#quickEmpSelect");
    const dateEl = $("#quickDate");
    const amountEl = $("#quickAmount");
    const unitEl = $("#quickUnit");
    const reasonEl = $("#quickReason");

    const empId = empSel?.value || "";
    const empName = empSel?.selectedOptions?.[0]?.getAttribute("data-name") || "";
    const date = dateEl?.value || "";
    const amount = Number(amountEl?.value || "0");
    const unit = (unitEl?.value || "").trim(); // 天 / 小時
    const reason = reasonEl?.value || "";

    if (!empId || !date || !(amount>0)) {
      alert("請選擇員工、日期並輸入正確的數值");
      return;
    }
    const hours = unit === "天" ? amount * HOURS_PER_DAY : amount;

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
    await DB().collection(COL).add(payload);
    // 清空欄位與重載
    amountEl.value = "";
    reasonEl.value = "";
    renderQuickList();
    renderSummary();
    alert("✅ 已送出補登");
  }

  // ===== 年假統計（採「階梯累計制 + 永不清空」） =====
  async function renderSummary(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const empFilter = $("#statEmpSelect")?.value || "";
    const from = startOfYear(year), to = endOfYear(year);
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中…</td></tr>`;

    // 取人員清單（員編、姓名、到職日）
    const people = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data()||{};
        const empId = d.empId || d.id || doc.id || "";
        const hire = d.hireDate ? toDate(d.hireDate) : null;
        people.push({ empId, name: d.name || "", hireDate: hire });
      });
    } catch(_) {}
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data()||{};
        const empId = d.empId || d.id || doc.id || "";
        const hire = d.hireDate ? toDate(d.hireDate) : null;
        people.push({ empId, name: d.name || "", hireDate: hire });
      });
    } catch(_) {}

    // 已用年假（年度內；來源不限）
    const used = Object.create(null);
    const snap = await DB().collection(COL).where("leaveType","==","特休").get().catch(()=>null);
    if (snap) {
      snap.forEach(doc => {
        const d = doc.data()||{};
        const t = toDate(d.leaveDate || d.date);
        if (!t || t < from || t > to) return;
        const k = d.empId || "";
        if (!k) return;
        const h = Number(d.hoursUsed) || (Number(d.daysUsed) || 0) * HOURS_PER_DAY || HOURS_PER_DAY;
        used[k] = (used[k] || 0) + h;
      });
    }

    let rowsData = people;
    if (empFilter) rowsData = rowsData.filter(p => p.empId === empFilter);

    const rows = rowsData.sort((a,b)=> (a.empId||"").localeCompare(b.empId||"")).map(p => {
      const grantedH = calcGrantedHours(p.hireDate, year);
      const usedH    = used[p.empId] || 0;
      const remainH  = grantedH - usedH;
      return {
        empId: p.empId,
        name: p.name,
        hireDate: p.hireDate ? ymd(p.hireDate) : "",
        seniority: p.hireDate ? seniorityText(p.hireDate) : "",
        grantedText: textDayHour(grantedH),
        usedText: textDayHour(usedH),
        remainText: textDayHour(remainH),
        remainNeg : remainH < 0
      };
    });

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.empId}</td>
        <td>${r.name}</td>
        <td>${r.hireDate}</td>
        <td>${r.seniority}</td>
        <td>${r.grantedText}</td>
        <td>${r.usedText}</td>
        <td class="${r.remainNeg?'neg':''}">${r.remainText}</td>
      </tr>
    `).join("");
  }

  // ===== 綁定與初始化 =====
  function bindUI() {
    $("#reqFilterBtn")?.addEventListener("click", renderRequests);
    $("#reqClearBtn")?.addEventListener("click", () => {
      if ($("#reqDateFrom")) $("#reqDateFrom").value = "";
      if ($("#reqDateTo")) $("#reqDateTo").value = "";
      if ($("#reqEmpSelect")) $("#reqEmpSelect").value = "";
      renderRequests();
    });

    $("#statFilterBtn")?.addEventListener("click", renderSummary);
    $("#statClearBtn")?.addEventListener("click", () => {
      if ($("#statEmpSelect")) $("#statEmpSelect").value = "";
      renderSummary();
    });

    $("#quickSubmit")?.addEventListener("click", handleQuickSubmit);

    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(); renderQuickList(); renderSummary();
    });
  }

  async function init(){
    await loadEmployeesIntoSelects();
    bindUI();
    renderRequests();
    renderQuickList();
    renderSummary();
  }

  // Firebase ready or DOM ready 皆嘗試初始化
  if (document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
  document.addEventListener("firebase-ready", init);
})();
