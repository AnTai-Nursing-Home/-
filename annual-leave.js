
/**
 * annual-leave.js — FINAL v2025-11-02-AL3
 * 規則：
 *  - 特休單(唯讀) 只顯示「請假系統」鏡像資料（排除 source=="快速補登"）
 *  - 「快速補登」分頁只顯示 source=="快速補登"
 *  - 年假統計採「階梯累計制 + 永不清空」：達門檻即累加配發（半年+3、滿1年+7、滿2年+10…）
 *  - 統計「已用年假」包含所有來源（請假系統 + 快速補登）
 *  - 保留你原本畫面與欄位順序（中文），剩餘可為負且標紅（.neg）
 */

(function(){
  const DB = () => firebase.firestore();
  const COL = "annual_leave_requests";
  const HOURS_PER_DAY = 8;
  const $ = (s) => document.querySelector(s);

  // ---- 年資規則（你提供的對應；採「達點即累加」） ----
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

  // 階梯累計制（到達門檻即累加），>24年每滿一年再 +30 天
  function calcGrantedHours(hireDate, selectedYear) {
    if (!hireDate) return 0;
    const eoy = endOfYear(selectedYear);
    let sumDays = 0;
    // 每個門檻到達就累加
    ENTITLE_STEPS.forEach(step => {
      const when = addYears(hireDate, step.years);
      if (when <= eoy) sumDays += step.days;
    });
    // 超過 24 年：每滿一年 +30 天（沿用你原本邏輯）
    const totalYearsFloat = (eoy - hireDate) / (365.25 * 24 * 3600 * 1000);
    const fullYears = Math.floor(totalYearsFloat);
    for (let y = 25; y <= fullYears; y++) {
      const ann = addYears(hireDate, y);
      if (ann <= eoy) sumDays += 30;
    }
    return sumDays * HOURS_PER_DAY;
  }

  function initYearSelect(){
    const sel = $("#yearSelect");
    if (!sel) return;
    const y = new Date().getFullYear();
    sel.innerHTML = "";
    for (let yy = y+1; yy >= y-5; yy--){
      const o = document.createElement("option");
      o.value = String(yy); o.textContent = String(yy);
      if (yy === y) o.selected = true;
      sel.appendChild(o);
    }
  }

  function setLoading(tbodyId, cols){
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted">讀取中…</td></tr>`;
  }
  function setEmpty(tbodyId, cols){
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted">沒有資料</td></tr>`;
  }

  // ===== 特休單（唯讀）— 只顯示「請假系統」鏡像資料 =====
  async function renderRequests(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year);
    const to   = endOfYear(year);
    setLoading("al-req-body", 9);

    const snap = await DB().collection(COL).get().catch(()=>null);
    if (!snap) { setEmpty("al-req-body", 9); return; }

    const list = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.source === "快速補登") return; // 分流：這裡不顯示補登
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;

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

    const tbody = $("#al-req-body");
    if (!tbody) return;

    if (!list.length) { setEmpty("al-req-body", 9); return; }
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

  // ===== 快速補登列表 — 只顯示 source=="快速補登" =====
  async function renderQuickList(){
    const body = $("#quick-body");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>`;
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);

    const snap = await DB().collection(COL).where("source","==","快速補登").get().catch(()=>null);
    if (!snap || snap.empty) { setEmpty("quick-body", 6); return; }

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
    if (!rows.length) { setEmpty("quick-body", 6); return; }
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

  // ===== 年假統計（採「階梯累計制 + 永不清空」） =====
  async function renderSummary(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    setLoading("al-stat-body", 7);

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

    // 已用年假（本年度內的使用合計；來源不限：請假系統 + 快速補登）
    const used = Object.create(null);
    const snap = await DB().collection(COL).where("leaveType","==","特休").get().catch(()=>null);
    if (snap) {
      snap.forEach(doc => {
        const d = doc.data()||{};
        const t = toDate(d.leaveDate || d.date);
        if (!t || t < from || t > to) return;
        const k = d.empId || "";
        if (!k) return;
        const h = Number(d.hoursUsed) || (Number(d.daysUsed)||0) * HOURS_PER_DAY || HOURS_PER_DAY;
        used[k] = (used[k] || 0) + h;
      });
    }

    // 產製統計列
    const rows = people.sort((a,b)=> (a.empId||"").localeCompare(b.empId||"")).map(p => {
      const grantedH = calcGrantedHours(p.hireDate, year);                 // 應放（累計制）
      const usedH    = used[p.empId] || 0;                                 // 本年度已用（含補登）
      const remainH  = grantedH - usedH;                                   // 剩餘（可為負）
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

    // 依你原本欄位順序渲染：員編｜姓名｜入職日｜總年資｜應放年假｜已用年假｜剩餘年假
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

  // ========= Init =========
  document.addEventListener("firebase-ready", () => {
    initYearSelect();
    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(); renderQuickList(); renderSummary();
    });
    renderRequests();
    renderQuickList();
    renderSummary();
  });
})();
