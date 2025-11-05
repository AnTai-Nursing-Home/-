// annual-leave.js — YEAR MODE v2025-11-05 (based on your latest v2)
// Changes requested by user:
// - Mirror uses hours (already S1 in quick entry; keep compatible for mirror from leave systems)
// - Stats: Accumulated shown as DAYS; Used shows "D 天 H 小時（X 小時）"; Remaining shows "D 天 H 小時"
// - Stats table adds a new column "剩餘時數" (pure hours)
// - Keep v8 Firebase compatibility and original flows

(function(){
  const DB = () => firebase.firestore();
  const COL_REQ = "annual_leave_requests"; // 鏡像 + 快速補登
  const HOURS_PER_DAY = 8;
  const $ = (s) => document.querySelector(s);

  const ROLES = { nurse: "護理師", caregiver: "照服員" };
  const EMP_MAP = Object.create(null);

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
    if (s instanceof Date) return isNaN(s) ? null : s;
    if (s && typeof s.toDate === "function") {
      try { const d = s.toDate(); return isNaN(d) ? null : d; } catch(_) {}
    }
    const raw = String(s);
    const d = new Date(raw);
    if (!isNaN(d)) return d;
    const t = raw.replace(/\./g,"-").replace(/\//g,"-");
    const dd = new Date(t);
    return isNaN(dd) ? null : dd;
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

  function toDaysHours(totalHours) {
    const h = Math.max(0, Math.round(Number(totalHours)||0));
    const d = Math.floor(h / HOURS_PER_DAY);
    const rem = h % HOURS_PER_DAY;
    return { d, rem, text: d && rem ? `${d} 天 ${rem} 小時` : (d ? `${d} 天` : `${rem} 小時`) };
  }

  function yearsCompletedAtEndOf(year, hireDate){
    if (!hireDate) return 0;
    const end = endOfYear(year);
    const diff = end - hireDate;
    return diff <= 0 ? 0 : diff / (365.25 * 24 * 3600 * 1000);
  }
  function entitlementForYear(hireDate, year){
    if (!hireDate) return 0;
    const yrs = yearsCompletedAtEndOf(year, hireDate);
    if (yrs >= 24) return 30 * HOURS_PER_DAY;
    let days = 0;
    for (const s of ENTITLE_STEPS){
      if (yrs >= s.years) days = s.days; else break;
    }
    return days * HOURS_PER_DAY; // keep hours for math; will render as DAYS only
  }

  // ===== 人員載入 =====
  async function loadEmployeesIntoSelects(){
    const selReq = $("#reqEmpSelect");
    const selQuick = $("#quickEmpSelect");
    const selStat = $("#statEmpSelect");

    const nurses = [], caregivers = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data()||{};
        const empId = d.empId || d.id || doc.id || "";
        const name = d.name || "";
        const hireDate = d.hireDate ? toDate(d.hireDate) : null;
        nurses.push({ empId, name, role: "nurse", hireDate });
        EMP_MAP[empId] = { name, role: "nurse", hireDate };
      });
    } catch(e){}
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data()||{};
        const empId = d.empId || d.id || doc.id || "";
        const name = d.name || "";
        const hireDate = d.hireDate ? toDate(d.hireDate) : null;
        caregivers.push({ empId, name, role: "caregiver", hireDate });
        EMP_MAP[empId] = { name, role: "caregiver", hireDate };
      });
    } catch(e){}

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

    if (selReq) selReq.innerHTML = optFilter;
    if (selStat) selStat.innerHTML = optFilter;
    if (selQuick) selQuick.innerHTML = optQuick;
  }

  // ===== 年度下拉 =====
  function populateYearOptions(){
    const sel = $("#yearSelect");
    if (!sel) return;
    const current = new Date().getFullYear();
    const start = current - 5, end = current + 1;
    sel.innerHTML = Array.from({length:end-start+1}, (_,i)=>{
      const y = start + i;
      return `<option value="${y}" ${y===current?'selected':''}>${y}</option>`;
    }).join("");
  }

  // ===== 特休單（唯讀） =====
  async function renderRequests(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    let from = startOfYear(year), to = endOfYear(year);

    const fromVal = $("#reqDateFrom")?.value;
    const toVal   = $("#reqDateTo")?.value;
    if (fromVal) from = new Date(`${fromVal}T00:00:00`);
    if (toVal)   to   = new Date(`${toVal}T23:59:59`);

    const empSelVal = $("#reqEmpSelect")?.value || "";
    const tbody = $("#al-req-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    const snap = await DB().collection(COL_REQ).get().catch(()=>null);
    if (!snap){ tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted-ghost">沒有資料</td></tr>`; return; }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data()||{};
      if (d.source === "快速補登") return;
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;

      if (empSelVal){
        if (empSelVal === "@nurse" || empSelVal === "@caregiver"){
          const role = EMP_MAP[d.empId]?.role;
          if (empSelVal === "@nurse" && role!=="nurse") return;
          if (empSelVal === "@caregiver" && role!=="caregiver") return;
        }else{
          if ((d.empId || "") !== empSelVal) return;
        }
      }

      const who = (d.applicant || d.name || "");
      const roleTxt = EMP_MAP[d.empId]?.role === "nurse" ? "護理師" : (EMP_MAP[d.empId]?.role === "caregiver" ? "照服員" : "");
      rows.push({
        applyDate: d.applyDate ? ymd(toDate(d.applyDate)) : (d.createdAt? ymd(toDate(d.createdAt)) : ""),
        applicant: roleTxt ? `${who}(${roleTxt})` : who,
        leaveType: d.leaveType || "特休",
        leaveDate: ymd(leaveAt),
        shift: d.shift || "-",
        reason: d.reason || "",
        note: d.note || "",
        supervisor: d.supervisorSign || d.approvedBy || "",
        sourceId: d.sourceDocId || doc.id
      });
    });

    if (!rows.length){ tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted-ghost">沒有資料</td></tr>`; return; }
    rows.sort((a,b)=> a.leaveDate.localeCompare(b.leaveDate));
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.applyDate}</td>
        <td>${r.applicant}</td>
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

  // ===== 快速補登（只寫 hoursUsed；天會換算 ×8） =====
  async function renderQuickList(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const tbody = $("#quick-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>`;

    const snap = await DB().collection(COL_REQ).where("source","==","快速補登").get().catch(()=>null);
    if (!snap || snap.empty){ tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data()||{};
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;

      const who = `${d.empId||""} ${(d.applicant||d.name||"")}${EMP_MAP[d.empId]?.role?`(${EMP_MAP[d.empId].role==="nurse"?"護理師":"照服員"})`:""}`.trim();
      const hours = safeHours(d);
      const dh = toDaysHours(hours);

      rows.push({
        id: doc.id,
        date: ymd(leaveAt),
        who, dhText: dh.text,
        reason: d.reason || "",
        source: d.source || ""
      });
    });

    if (!rows.length){ tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`; return; }
    rows.sort((a,b)=> a.date.localeCompare(b.date));
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.date}</td>
        <td>${r.who}</td>
        <td>${r.dhText}</td>
        <td>${r.reason}</td>
        <td>${r.source}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-id="${r.id}"><i class="fa-solid fa-trash-can"></i></button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll("button[data-id]").forEach(btn=>{
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("確定刪除此補登紀錄？")) return;
        await DB().collection(COL_REQ).doc(id).delete();
        renderQuickList(); renderSummary();
      });
    });
  }

  // ===== 年度統計 =====
  async function renderSummary(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const empSelVal = $("#statEmpSelect")?.value || "";
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    let people = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data()||{};
        people.push({ empId: d.empId||d.id||doc.id||"", name: d.name||"", role:"nurse", hireDate: d.hireDate? toDate(d.hireDate):null });
      });
    } catch(_){ }
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data()||{};
        people.push({ empId: d.empId||d.id||doc.id||"", name: d.name||"", role:"caregiver", hireDate: d.hireDate? toDate(d.hireDate):null });
      });
    } catch(_){ }

    if (empSelVal){
      if (empSelVal === "@nurse") people = people.filter(p=>p.role==="nurse");
      else if (empSelVal === "@caregiver") people = people.filter(p=>p.role==="caregiver");
      else people = people.filter(p=>p.empId === empSelVal);
    }

    const used = Object.create(null);
    const snap = await DB().collection(COL_REQ).where("leaveType","==","特休").get().catch(()=>null);
    if (snap){
      snap.forEach(doc => {
        const d = doc.data()||{};
        const t = toDate(d.leaveDate || d.date);
        if (!t || t < from || t > to) return;
        const k = d.empId || "";
        const h = safeHours(d);
        used[k] = (used[k]||0) + h;
      });
    }

    const orderRole = { nurse: 0, caregiver: 1 };
    people.sort((a,b)=> (orderRole[a.role]-orderRole[b.role]) || (a.empId>b.empId?1:-1));

    const rows = people.map(p=>{
      const entitledH = entitlementForYear(p.hireDate, year);  // hours
      const usedH = used[p.empId] || 0;                        // hours
      const remainH = Math.max(0, entitledH - usedH);          // hours

      const entDaysOnly = Math.floor(entitledH / 8);           // 累積只顯示天
      const usedDH = toDaysHours(usedH);                       // 已用 D+H
      const remainDH = toDaysHours(remainH);                   // 剩餘 D+H

      const yrs = p.hireDate ? yearsCompletedAtEndOf(year, p.hireDate) : 0;
      const yrsTxt = p.hireDate ? `${Math.floor(yrs)} 年 ${Math.round((yrs%1)*12)} 月` : "";

      return {
        empId: p.empId,
        name: `${p.name}${p.role==="nurse"?"(護理師)":p.role==="caregiver"?"(照服員)":""}`,
        hire: p.hireDate? ymd(p.hireDate):"",
        seniority: yrsTxt,
        entText: `${entDaysOnly} 天`,                           // ✅ 累積：天
        usedText: `${usedDH.text}（${usedH} 小時）`,            // ✅ 已用：D+H（X 小時）
        remainText: `${remainDH.text}`,                         // ✅ 剩餘：D+H
        remainHours: `${remainH} 小時`                          // ✅ 剩餘時數
      };
    });

    tbody.innerHTML = rows.map(r=>`
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

  // ===== 共用：將 hoursUsed / daysUsed 轉為小時 =====
  function safeHours(d){
    const h = Number(d?.hoursUsed);
    if (!isNaN(h) && isFinite(h)) return h;
    const days = Number(d?.daysUsed);
    if (!isNaN(days) && isFinite(days)) return days * 8;
    return 0;
  }

  function exportTableToExcel(tableId, filename){
    const table = document.getElementById(tableId);
    if (!table){ alert("找不到表格"); return; }
    const wb = XLSX.utils.table_to_book(table, {sheet:"Sheet1"});
    XLSX.writeFile(wb, filename);
  }

  function bindUI(){
    $("#reqFilterBtn")?.addEventListener("click", renderRequests);
    $("#reqClearBtn")?.addEventListener("click", () => {
      if ($("#reqEmpSelect")) $("#reqEmpSelect").value = "";
      if ($("#reqDateFrom")) $("#reqDateFrom").value = "";
      if ($("#reqDateTo")) $("#reqDateTo").value = "";
      renderRequests();
    });

    $("#statFilterBtn")?.addEventListener("click", renderSummary);
    $("#statClearBtn")?.addEventListener("click", () => {
      if ($("#statEmpSelect")) $("#statEmpSelect").value = "";
      renderSummary();
    });

    $("#quickSubmit")?.addEventListener("click", async () => {
      const empSel = $("#quickEmpSelect");
      const dateEl = $("#quickDate");
      const amountEl = $("#quickAmount");
      const unitEl = $("#quickUnit");
      const reasonEl = $("#quickReason");

      const empId = empSel?.value || "";
      const empName = empSel?.selectedOptions?.[0]?.getAttribute("data-name") || "";
      const date = dateEl?.value || "";
      const amount = Number(amountEl?.value || "0");
      const unit = (unitEl?.value || "day").toLowerCase();
      const isDay = unit === "day";
      const reason = reasonEl?.value || "";

      if (!empId || !date || !(amount>0)){ alert("請選擇員工、日期並輸入正確數值"); return; }

      const hours = isDay ? amount * 8 : amount; // S1: 只寫 hoursUsed
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

    $("#yearSelect")?.addEventListener("change", () => {
      renderRequests(); renderQuickList(); renderSummary();
    });

    $("#export-req-excel")?.addEventListener("click", ()=> exportTableToExcel("reqTable", `特休單_${$("#yearSelect").value||""}.xlsx`));
    $("#export-stat-excel")?.addEventListener("click", ()=> exportTableToExcel("statTable", `年假統計_${$("#yearSelect").value||""}.xlsx`));
  }

  async function init(){
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
    catch(e){ console.error("[annual-leave YEAR v2 customized] init error:", e); __inited = false; }
  });
})();
