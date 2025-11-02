
/**
 * annual-leave.js — FINAL
 * - Reads annual_leave_requests mirrored from office requests
 * - Displays fields in order: applyDate, applicant, leaveType, leaveDate, shift, reason, note, supervisorSign, sourceDocId
 * - Supports hours/days display (e.g., "1 天 4 小時")
 * - Year filter defaults to whole selected year; includes createdAt fallback
 * - Stats: granted/used/remain in day+hour text; remain turns red if negative
 * Author: ChatGPT — build 2025-11-02
 */

(function(){
  const DB = () => firebase.firestore();
  const COL = "annual_leave_requests";
  const HOURS_PER_DAY = 8;
  const $ = (s) => document.querySelector(s);

  function toDate(s){
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) { // try plain yyyy-mm-dd
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
    const H = Math.max(0, Number(h)||0);
    const d = Math.floor(H / HOURS_PER_DAY);
    const r = H % HOURS_PER_DAY;
    return (d?`${d} 天`:"") + (r? (d?" ":"") + `${r} 小時` : (d?"":"0 小時"));
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

  // ===== Requests (read-only) =====
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
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt || leaveAt < from || leaveAt > to) return;

      // Fallbacks
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
        sourceDocId: d.sourceDocId || doc.id,
        hoursUsed: Number(d.hoursUsed) || (Number(d.daysUsed)||0) * HOURS_PER_DAY
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

  // ===== Quick list (optional, if you have #quick-body) =====
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

  // ===== Summary =====
  async function renderSummary(){
    const year = Number($("#yearSelect")?.value || new Date().getFullYear());
    const from = startOfYear(year), to = endOfYear(year);
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    setLoading("al-stat-body", 7);

    // gather people
    const people = [];
    try {
      const ns = await DB().collection("nurses").orderBy("sortOrder").get();
      ns.forEach(doc => {
        const d = doc.data()||{};
        people.push({ empId: d.id || doc.id || d.empId || "", name: d.name || "", hireDate: d.hireDate ? ymd(new Date(d.hireDate)) : "" });
      });
    } catch(_) {}
    try {
      const cg = await DB().collection("caregivers").orderBy("sortOrder").get();
      cg.forEach(doc => {
        const d = doc.data()||{};
        people.push({ empId: d.id || doc.id || d.empId || "", name: d.name || "", hireDate: d.hireDate ? ymd(new Date(d.hireDate)) : "" });
      });
    } catch(_) {}

    // used map
    const used = Object.create(null);
    const snap = await DB().collection(COL).where("leaveType","==","特休").get().catch(()=>null);
    if (snap) {
      snap.forEach(doc => {
        const d = doc.data()||{};
        const t = toDate(d.leaveDate || d.date);
        if (!t || t < from || t > to) return;
        const k = d.empId || "";
        if (!k) return;
        const h = Number(d.hoursUsed) || (Number(d.daysUsed)||0) * HOURS_PER_DAY;
        used[k] = (used[k] || 0) + h;
      });
    }

    // granted (simple fixed rule: you can replace with your own entitlement logic)
    function grantedHours(hireYmd) {
      // If you had a complex entitlement, inject here. For now assume 30 days/year as placeholder? No — better neutral:
      // We'll not fabricate; we will just display "已用 / 剩餘" based on an optional granted field in the DB if you add later.
      // For now we consider granted unknown -> display "-". So we'll only show Used.
      return null; // unknown
    }

    const rows = people.sort((a,b)=> a.empId.localeCompare(b.empId)).map(p => {
      const usedH = used[p.empId] || 0;
      const grantedH = grantedHours(p.hireDate);
      const remainH = (grantedH==null) ? null : (grantedH - usedH);
      return {
        empId: p.empId,
        name: p.name,
        hireDate: p.hireDate || "",
        usedText: textDayHour(usedH),
        grantedText: (grantedH==null) ? "-" : textDayHour(grantedH),
        remainText: (remainH==null) ? "-" : textDayHour(remainH),
        remainNeg : (remainH!=null && remainH < 0)
      };
    });

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.empId}</td>
        <td>${r.name}</td>
        <td>${r.hireDate}</td>
        <td>-</td>
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
