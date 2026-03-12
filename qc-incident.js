/* qc-incident.js
 * 需要先在全站初始化 Firebase/Firestore，並能取得：
 *   window.db  (Firestore instance; firebase v8)
 *   window.CurrentUser = { uid, name, role }
 *
 * residents 集合（依你截圖）常見欄位：
 *   birthday: "1934-05-15"
 *   diagnosis: "糖尿病、腎臟病"
 *   gender: "女"
 *   residentName: "余劉春花"   // 有些資料也用 docId 當名字
 */

const IncidentTypes = [
  "給藥異常","走失","暴力事件","火災","天然災害事件","食物中毒","財物失竊",
  "管路滑脫-鼻胃管","管路滑脫-導尿管","缺氧","壓傷","昏倒(死亡)","跌倒","其他"
];

const FallCaseFactors = ["頭暈","虛弱","步態不穩","意識混亂","不當使用輔具","未使用輔具","肌力不足","穿著不合適","不遵從","其他"];
const FallEnvFactors  = ["地面濕滑","路面不平","照明不足","有障礙物"];
const FallEquipFactors= ["未使用助行器","床欄未拉起","床或椅子的高度不適合","呼叫鈴放置不易取得"];
const FallStaffFactors= ["未定時巡視","照服員未能及時協助","未依標準照護流程執行"];
const FallDrugFactors = ["鎮靜劑","降壓劑","降血糖","利尿劑"];

let currentYear = new Date().getFullYear();
let currentMonth = null; // 1~12
let residentsCache = []; // [{id,name,gender,birthday,diagnosis}]
let reviewersCache = []; // 舊版欄位保留，不再作為覆核者指定用途
let reviewerLoadError = null;
let currentUserCanReview = false;

const $ = (id) => document.getElementById(id);

// === 登入者（沿用住民系統的儲存格式）===
// 會依序嘗試：antai_session_user → officeAuth/nurseAuth/caregiverAuth
function getCurrentUserFromStorage(){
  const pick = (a) => {
    if (!a || typeof a !== "object") return null;
    const uid = String(a.staffId || a.username || a.id || a.uid || "").trim();
    const name = String(a.displayName || a.name || a.staffName || a.userName || "").trim();
    const role = String(a.role || a.userRole || "").trim();
    const out = { uid: uid || name || "unknown", name: name || uid || "unknown", role };
    // 保留原始資料（若你之後要做權限判斷）
    out.raw = a;
    return out;
  };

  for (const store of [sessionStorage, localStorage]) {
    try{
      const raw = store.getItem("antai_session_user");
      if (raw) {
        const u = pick(JSON.parse(raw));
        if (u) return u;
      }
    }catch(_e){}
    for (const k of ["officeAuth","nurseAuth","caregiverAuth"]) {
      try{
        const raw = store.getItem(k);
        if(!raw) continue;
        const u = pick(JSON.parse(raw));
        if (u) return u;
      }catch(_e){}
    }
  }
  return null;
}

function ensureCurrentUser(){
  if (!window.CurrentUser || !window.CurrentUser.uid) {
    const u = getCurrentUserFromStorage();
    if (u) window.CurrentUser = u;
  }
  return window.CurrentUser;
}


function pad2(n){ return String(n).padStart(2,"0"); }

function ensureEnv(){
  if (!window.db) throw new Error("Firestore 未初始化：請確認 window.db 存在");
  if (!window.firebase || !window.firebase.firestore) {
    throw new Error("找不到 firebase.firestore：請確認你使用 firebase v8 並已載入 firebase/firestore");
  }
  ensureCurrentUser();
  if (!window.CurrentUser || !window.CurrentUser.uid) {
    throw new Error("尚未取得登入者：請確認登入後 session/localStorage 有 antai_session_user 或 officeAuth/nurseAuth/caregiverAuth");
  }
}

function serverTimestamp(){
  return window.firebase.firestore.FieldValue.serverTimestamp();
}

function formatDateDisplay(value, withTime=false){
  if (!value) return "";
  let d = null;
  if (value && typeof value.toDate === "function") d = value.toDate();
  else if (value instanceof Date) d = value;
  else if (typeof value === "string" || typeof value === "number") d = new Date(value);
  if (!d || isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  if (!withTime) return `${y}/${m}/${day}`;
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePersonName(name){
  return String(name || "").trim().replace(/\s+/g, "");
}

function isIncidentReviewed(d){
  return !!(d && d.review && d.review.reviewedBy && (d.review.reviewedBy.name || d.review.reviewedBy.uid));
}

function getReviewerDisplay(d){
  const review = d?.review || {};
  const reviewedBy = review.reviewedBy || {};
  if (reviewedBy.name) return reviewedBy.name;
  if (reviewedBy.uid) return reviewedBy.uid;
  return "";
}

function extractReviewPermissionFromObject(obj){
  if (!obj || typeof obj !== "object") return false;
  if (obj.canReviewQcIncident === true) return true;
  if (obj.qcIncidentReview === true) return true;
  if (obj.permissions && typeof obj.permissions === "object") {
    if (obj.permissions.qcIncidentReview === true) return true;
    if (obj.permissions.canReviewQcIncident === true) return true;
  }
  return false;
}

async function loadCurrentUserReviewPermission(){
  const me = ensureCurrentUser();
  currentUserCanReview = false;
  if (!me) return false;

  if (extractReviewPermissionFromObject(me) || extractReviewPermissionFromObject(me.raw)) {
    currentUserCanReview = true;
    return true;
  }

  const collections = ["accounts", "employees", "users"];
  const idCandidates = Array.from(new Set([
    String(me.uid || "").trim(),
    String(me.name || "").trim(),
    String(me.raw?.staffId || "").trim(),
    String(me.raw?.employeeId || "").trim(),
    String(me.raw?.username || "").trim(),
    String(me.raw?.id || "").trim(),
    String(me.raw?.uid || "").trim()
  ].filter(Boolean)));

  const matchFields = ["staffId", "employeeId", "uid", "username", "id", "name", "staffName", "displayName", "userName"];

  for (const col of collections) {
    try {
      for (const id of idCandidates) {
        try {
          const direct = await window.db.collection(col).doc(id).get();
          if (direct.exists && extractReviewPermissionFromObject(direct.data())) {
            currentUserCanReview = true;
            return true;
          }
        } catch(_e){}
      }

      for (const field of matchFields) {
        for (const value of idCandidates) {
          try {
            const snap = await window.db.collection(col).where(field, "==", value).limit(1).get();
            if (!snap.empty) {
              const data = snap.docs[0].data() || {};
              if (extractReviewPermissionFromObject(data)) {
                currentUserCanReview = true;
                return true;
              }
            }
          } catch(_e){}
        }
      }
    } catch(_e){}
  }
  return false;
}

function canCurrentUserReview(d){
  ensureCurrentUser();
  if (isIncidentReviewed(d)) return false;
  return !!currentUserCanReview;
}


function bedSortKey(bed){
  const s = String(bed || "").trim();
  if (!s) return [999999, 999999, ""];
  // 常見格式：201-1、219-2；也可能只有 201
  const parts = s.split("-");
  const room = parseInt(parts[0], 10);
  const sub = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  const roomKey = Number.isFinite(room) ? room : 999999;
  const subKey = Number.isFinite(sub) ? sub : 999999;
  return [roomKey, subKey, s];
}

function calcAgeFromBirthday(birthday){
  if (!birthday) return "";
  // birthday 可能是 "YYYY-MM-DD" 或 Timestamp
  let d;
  if (typeof birthday === "string") d = new Date(birthday);
  else if (birthday.toDate) d = birthday.toDate();
  else d = new Date(birthday);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function setTopTitle(){
  const u = ensureCurrentUser();
  const who = u ? `${u.uid || ""} ${u.name || ""}`.trim() : "";
  if (currentMonth) {
    $("topTitle").textContent = "品管｜意外事件系統";
    $("subTitle").textContent = `${currentYear} 年 ${pad2(currentMonth)} 月｜登入者：${who}`;
  } else {
    $("topTitle").textContent = "品管｜意外事件系統";
    $("subTitle").textContent = who ? `登入者：${who}${u.role ? `（${u.role}）` : ""}` : "";
  }
}

function showMonthsView(){
  currentMonth = null;
  $("btnBack").classList.add("hidden");
  $("btnAdd").classList.add("hidden");
  $("viewIncidents").classList.add("hidden");
  $("viewMonths").classList.remove("hidden");
  setTopTitle();
  renderMonths();
  // 統計面板（月份頁）
  initStatsUI();

  // 回到月份頁時，預設應顯示「案件單」，避免進入後出現空白
  try{ if (typeof setTab === "function") setTab("cases"); }catch(_e){}
}

async function showMonthDetail(month){
  currentMonth = month;
  $("btnBack").classList.remove("hidden");
  $("btnAdd").classList.remove("hidden");
  $("viewMonths").classList.add("hidden");
  $("viewIncidents").classList.remove("hidden");
  setTopTitle();

  // 進入月份後應直接顯示案件單（不需要再按一次 Tab）
  try{ if (typeof setTab === "function") setTab("cases"); }catch(_e){}
  await renderIncidents();
}

function buildYearSelect(){
  const sel = $("yearSelect");
  sel.innerHTML = "";
  const nowY = new Date().getFullYear();
  const years = [];
  for (let y = nowY - 3; y <= nowY + 1; y++) years.push(y);
  years.reverse().forEach(y=>{
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = `${y} 年`;
    if (y === currentYear) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    currentYear = parseInt(sel.value,10);
    if (currentMonth) showMonthDetail(currentMonth);
    else {
      renderMonths();
      initStatsUI();
    }
  };
}

async function countIncidentsOfMonth(year, month){
  const snap = await window.db.collection("qc_incidents")
    .where("occurYear","==",year)
    .where("occurMonth","==",month)
    .get();
  let unreviewed = 0;
  snap.forEach(doc=>{ if (!isIncidentReviewed(doc.data() || {})) unreviewed++; });
  return { total: snap.size, unreviewed };
}

async function renderMonths(){
  const box = $("viewMonths");
  box.innerHTML = "";

  for (let m=1; m<=12; m++){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row">
        <h3>${pad2(m)} 月</h3>
        <button class="btn">查看</button>
      </div>
      <div class="monthMetaRow">
        <div class="muted" id="mCount-${m}">讀取中...</div>
        <div id="mPending-${m}"></div>
      </div>
    `;
    card.querySelector("button").onclick = ()=> showMonthDetail(m);
    box.appendChild(card);

    countIncidentsOfMonth(currentYear, m)
      .then(({ total, unreviewed }) => {
        const el = $(`mCount-${m}`);
        if (el) el.textContent = `本月事件：${total} 筆`;
        const pendingEl = $(`mPending-${m}`);
        if (pendingEl) pendingEl.innerHTML = unreviewed > 0 ? `<span class="monthAlertBadge">未覆核 ${unreviewed} 筆</span>` : ``;
      })
      .catch(() => { const el = $(`mCount-${m}`); if (el) el.textContent = "本月事件：讀取失敗"; });
  }
}

function clearHints(){
  ["hintResident","hintDiagCat","hintIncidentType","hintIncidentOther","hintInjury"].forEach(id=>{
    const el = $(id); if (el) el.classList.add("hidden");
  });
  $("saveHint").textContent = "";
}

function showHint(id){
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

async function loadResidents(){
  // 住民量通常不大：直接全載入（若很大可改分頁/條件）
  const snap = await window.db.collection("residents").get();
  const list = [];
  snap.forEach(doc=>{
    const d = doc.data() || {};
    const name = d.residentName || d.name || doc.id;
    list.push({
      id: doc.id,
      name,
      gender: d.gender || "",
      birthday: d.birthday || d.birthDate || "",
      diagnosis: d.diagnosis || "",
      bedNumber: d.bedNumber || d.bed || ""
    });
  });
  list.sort((a,b)=>{
  const ka = bedSortKey(a.bedNumber);
  const kb = bedSortKey(b.bedNumber);
  // 先比床號，再比名字
  if (ka[0]!==kb[0]) return ka[0]-kb[0];
  if (ka[1]!==kb[1]) return ka[1]-kb[1];
  if (ka[2]!==kb[2]) return ka[2].localeCompare(kb[2]);
  return (a.name||"").localeCompare(b.name||"", "zh-Hant");
});
  residentsCache = list;
}

function buildResidentSelect(){
  const sel = $("residentSelect");
  sel.innerHTML = `<option value="">請選擇住民</option>`;

  for (const r of residentsCache){
    const opt = document.createElement("option");
    opt.value = r.id;
    const bed = (r.bedNumber || "").trim();
    const fullLabel = bed ? `${bed} ${r.name}` : r.name;
    opt.textContent = fullLabel;
    // 用 dataset 保存「完整顯示」與「選定後僅姓名」
    opt.dataset.fullLabel = fullLabel;
    opt.dataset.nameLabel = r.name;
    sel.appendChild(opt);
  }

  const restoreFullLabels = () => {
    for (const opt of sel.options){
      if (!opt.value) continue; // placeholder
      if (opt.dataset.fullLabel) opt.textContent = opt.dataset.fullLabel;
    }
  };

  const showSelectedNameOnly = () => {
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.value && opt.dataset.nameLabel){
      opt.textContent = opt.dataset.nameLabel;
    }
  };

  sel.addEventListener("focus", restoreFullLabels);
  sel.addEventListener("click", restoreFullLabels);

  sel.onchange = () => {
    const rid = sel.value;
    const r = residentsCache.find(x=>x.id===rid);
    $("residentGender").value = r?.gender || "";
    $("residentAge").value = r ? String(calcAgeFromBirthday(r.birthday) ?? "") : "";
    $("residentDiagnosis").value = r?.diagnosis || "";
    // 點選後，欄位只顯示姓名
    showSelectedNameOnly();
  };
}

async function loadReviewers(){
  reviewerLoadError = null;
  const map = new Map();
  const addReviewer = (uid, name, role="") => {
    const cleanName = String(name || uid || "").trim();
    const cleanUid = String(uid || cleanName || "").trim();
    if (!cleanName && !cleanUid) return;
    const key = `${cleanUid}__${cleanName}`;
    if (!map.has(key)) map.set(key, { uid: cleanUid, name: cleanName, role: String(role||"").trim() });
  };

  const me = ensureCurrentUser();
  if (me) addReviewer(me.uid, me.name, me.role);

  const candidates = [
    { collection: "employees", fields: ["staffId","employeeId","uid","username","id"], names: ["name","staffName","displayName","userName"], roles:["role","jobTitle","title","department"] },
    { collection: "accounts", fields: ["staffId","employeeId","uid","username","id"], names: ["name","staffName","displayName","userName"], roles:["role","jobTitle","title","department"] },
    { collection: "users", fields: ["staffId","employeeId","uid","username","id"], names: ["name","staffName","displayName","userName"], roles:["role","jobTitle","title","department"] }
  ];

  for (const cfg of candidates){
    try{
      const snap = await window.db.collection(cfg.collection).get();
      if (!snap.empty){
        snap.forEach(doc=>{
          const d = doc.data() || {};
          const uid = cfg.fields.map(k=>d[k]).find(Boolean) || doc.id;
          const name = cfg.names.map(k=>d[k]).find(Boolean) || uid;
          const role = cfg.roles.map(k=>d[k]).find(Boolean) || "";
          addReviewer(uid, name, role);
        });
        break;
      }
    }catch(err){
      reviewerLoadError = err;
    }
  }

  reviewersCache = Array.from(map.values()).sort((a,b)=>{
    const an = String(a.name||"");
    const bn = String(b.name||"");
    return an.localeCompare(bn, "zh-Hant");
  });
}

function buildReviewerSelect(){
  const sel = $("reviewerSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">請選擇覆核者</option>`;
  for (const r of reviewersCache){
    const opt = document.createElement("option");
    opt.value = r.uid || r.name;
    opt.textContent = r.role ? `${r.name}（${r.role}）` : r.name;
    opt.dataset.uid = r.uid || "";
    opt.dataset.name = r.name || "";
    opt.dataset.role = r.role || "";
    sel.appendChild(opt);
  }
  const otherOpt = document.createElement("option");
  otherOpt.value = "__manual__";
  otherOpt.textContent = "其他／手動輸入";
  sel.appendChild(otherOpt);

  sel.onchange = () => {
    const isManual = sel.value === "__manual__";
    $("reviewerOtherWrap").classList.toggle("hidden", !isManual);
    if (!isManual) {
      $("reviewerOtherText").value = "";
      $("hintReviewerOther").classList.add("hidden");
    }
  };
}

function getReviewerPayloadFromForm(){
  const sel = $("reviewerSelect");
  const manual = ($("reviewerOtherText").value || "").trim();
  if (!sel || !sel.value) return null;
  if (sel.value === "__manual__") {
    if (!manual) return null;
    return { reviewer: { uid: "", name: manual, role: "" }, manualReviewerName: manual };
  }
  const opt = sel.options[sel.selectedIndex];
  return {
    reviewer: {
      uid: opt?.dataset?.uid || sel.value || "",
      name: opt?.dataset?.name || opt?.textContent || sel.value || "",
      role: opt?.dataset?.role || ""
    },
    manualReviewerName: ""
  };
}

function fillReviewerForm(review = {}){
  const sel = $("reviewerSelect");
  const wrap = $("reviewerOtherWrap");
  const other = $("reviewerOtherText");
  if (!sel) return;
  const reviewer = review.reviewer || {};
  const targetUid = String(reviewer.uid || "").trim();
  const targetName = String(reviewer.name || review.manualReviewerName || "").trim();
  let matched = false;
  for (const opt of sel.options){
    const optUid = String(opt.dataset?.uid || opt.value || "").trim();
    const optName = String(opt.dataset?.name || "").trim();
    if ((targetUid && optUid && targetUid === optUid) || (targetName && optName && targetName === optName)) {
      sel.value = opt.value;
      matched = true;
      break;
    }
  }
  if (!matched && targetName){
    sel.value = "__manual__";
    if (other) other.value = targetName;
    if (wrap) wrap.classList.remove("hidden");
  } else {
    if (wrap) wrap.classList.toggle("hidden", sel.value !== "__manual__");
    if (sel.value !== "__manual__" && other) other.value = "";
  }
}

function buildIncidentTypeSelect(){
  const sel = $("incidentType");
  sel.innerHTML = `<option value="">請選擇</option>`;
  for (const t of IncidentTypes){
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  }

  sel.onchange = () => {
    const t = sel.value;
    // other
    if (t === "其他") $("incidentOtherWrap").classList.remove("hidden");
    else {
      $("incidentOtherWrap").classList.add("hidden");
      $("incidentTypeOtherText").value = "";
      $("hintIncidentOther").classList.add("hidden");
    }

    // fall analysis
    if (t === "跌倒") $("fallWrap").classList.remove("hidden");
    else {
      $("fallWrap").classList.add("hidden");
      clearFallInputs();
    }
  };
}

function buildCheckGroup(containerId, items, onChange){
  const box = $(containerId);
  box.innerHTML = "";
  items.forEach((label, idx)=>{
    const id = `${containerId}_${idx}`;
    const wrap = document.createElement("label");
    wrap.className = "check";
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" value="${label}" />
      <span>${label}</span>
    `;
    const cb = wrap.querySelector("input");
    cb.addEventListener("change", ()=> onChange?.(label, cb.checked));
    box.appendChild(wrap);
  });
}

function clearFallInputs(){
  // uncheck all
  ["caseFactors","envFactors","equipFactors","staffFactors","drugFactors"].forEach(cid=>{
    const box = $(cid);
    if (!box) return;
    box.querySelectorAll("input[type=checkbox]").forEach(cb=> cb.checked = false);
  });
  $("caseOtherWrap").classList.add("hidden");
  $("caseFactorsOtherText").value = "";
  $("fallOtherText").value = "";
}

function getCheckedValues(containerId){
  const box = $(containerId);
  if (!box) return [];
  const out = [];
  box.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    if (cb.checked) out.push(cb.value);
  });
  return out;
}

function setReviewStatusText(text){
  const el = $("reviewStatusText");
  if (el) el.value = text || "未覆核";
}

function resetIncidentForm(){
  $("editingIncidentId").value = "";
  $("modalTitle").textContent = "新增意外事件";
  $("btnSave").textContent = "儲存";
  $("residentSelect").value = "";
  $("residentGender").value = "";
  $("residentAge").value = "";
  $("residentDiagnosis").value = "";
  $("diagnosisCategory").value = "";
  $("incidentType").value = "";
  $("incidentOtherWrap").classList.add("hidden");
  $("incidentTypeOtherText").value = "";
  $("injuryLevel").value = "";
  setReviewStatusText(currentUserCanReview ? "未覆核（你具有覆核權限）" : "未覆核");
  $("fallWrap").classList.add("hidden");
  clearFallInputs();
}

function openModal(){
  clearHints();
  resetIncidentForm();
  $("modalMask").classList.remove("hidden");
}

async function openEditModal(docId){
  clearHints();
  resetIncidentForm();
  $("modalTitle").textContent = "編輯意外事件";
  $("btnSave").textContent = "儲存修改";
  $("editingIncidentId").value = docId;
  $("modalMask").classList.remove("hidden");

  const snap = await window.db.collection("qc_incidents").doc(docId).get();
  if (!snap.exists) throw new Error("找不到案件資料");
  const d = snap.data() || {};
  $("residentSelect").value = d.residentId || "";
  const r = residentsCache.find(x=>x.id === d.residentId);
  $("residentGender").value = d.residentGender || r?.gender || "";
  $("residentAge").value = d.residentAge ?? (r ? String(calcAgeFromBirthday(r.birthday) ?? "") : "");
  $("residentDiagnosis").value = d.residentDiagnosis || r?.diagnosis || "";
  $("diagnosisCategory").value = d.diagnosisCategory || "";
  $("incidentType").value = d.incidentType || "";
  $("incidentType").dispatchEvent(new Event("change"));
  $("incidentTypeOtherText").value = d.incidentTypeOtherText || "";
  $("injuryLevel").value = d.injuryLevel || "";
  if (isIncidentReviewed(d)) {
    const reviewedBy = d.review?.reviewedBy?.name || d.review?.reviewedBy?.uid || "";
    const reviewedAt = formatDateDisplay(d.review?.reviewedAt, true);
    setReviewStatusText(reviewedAt ? `已覆核（${reviewedBy}｜${reviewedAt}）` : `已覆核（${reviewedBy}）`);
  } else {
    setReviewStatusText(currentUserCanReview ? "未覆核（你具有覆核權限）" : "未覆核");
  }

  if (d.incidentType === "跌倒" && d.fallAnalysis){
    $("fallWrap").classList.remove("hidden");
    const fa = d.fallAnalysis || {};
    const setChecks = (containerId, values=[])=>{
      const set = new Set(Array.isArray(values) ? values : []);
      const box = $(containerId);
      if (!box) return;
      box.querySelectorAll('input[type="checkbox"]').forEach(cb=>{ cb.checked = set.has(cb.value); });
    };
    setChecks("caseFactors", fa.caseFactors || []);
    setChecks("envFactors", fa.environmentFactors || []);
    setChecks("equipFactors", fa.equipmentFactors || []);
    setChecks("staffFactors", fa.staffFactors || []);
    setChecks("drugFactors", fa.drugFactors || []);
    if (Array.isArray(fa.caseFactors) && fa.caseFactors.includes("其他")) {
      $("caseOtherWrap").classList.remove("hidden");
    }
    $("caseFactorsOtherText").value = fa.caseFactorsOtherText || "";
    $("fallOtherText").value = fa.otherText || "";
  }
}

function closeModal(){
  $("modalMask").classList.add("hidden");
}

async function reviewIncident(docId, btn){
  ensureCurrentUser();
  if (!currentUserCanReview) {
    alert("你目前沒有意外事件覆核權限。");
    return;
  }
  if (btn) btn.disabled = true;
  try{
    const ref = window.db.collection("qc_incidents").doc(docId);
    const snap = await ref.get();
    const oldReview = snap.data()?.review || {};
    await ref.update({
      review: {
        ...oldReview,
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: {
          uid: window.CurrentUser.uid,
          name: window.CurrentUser.name || "",
          role: window.CurrentUser.role || ""
        }
      },
      updatedAt: serverTimestamp(),
      updatedBy: {
        uid: window.CurrentUser.uid,
        name: window.CurrentUser.name || "",
        role: window.CurrentUser.role || ""
      }
    });
    await renderIncidents();
    await renderMonths();
  }catch(err){
    console.error("[qc_incidents] review failed", err);
    alert("覆核失敗：" + (err.message || err));
  }finally{
    if (btn) btn.disabled = false;
  }
}

async function renderIncidents(){
  const box = $("viewIncidents");
  box.innerHTML = `<div class="muted">讀取中...</div>`;

  const q = window.db.collection("qc_incidents")
    .where("occurYear","==",currentYear)
    .where("occurMonth","==",currentMonth)
    .orderBy("createdAt","desc");

  const snap = await q.get();

  if (snap.empty){
    box.innerHTML = `<div class="card"><div class="muted">本月尚無意外事件，請按右上角「新增意外事件」。</div></div>`;
    return;
  }

  box.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data() || {};
    const name = d.residentName || "(未填)";
    const gender = d.residentGender || "";
    const age = (d.residentAge ?? "") !== "" ? `${d.residentAge}歲` : "";
    const diagCat = d.diagnosisCategory || "";
    const diag = d.residentDiagnosis || "";
    const type = d.incidentType || "";
    const injury = d.injuryLevel || "";
    const creator = d.createdBy?.name || d.createdBy?.uid || "";
    const createdAtText = formatDateDisplay(d.createdAt) || "";
    const reviewed = isIncidentReviewed(d);
    const canReview = canCurrentUserReview(d);
    const reviewedBy = d.review?.reviewedBy?.name || d.review?.reviewedBy?.uid || "";
    const reviewedAtText = formatDateDisplay(d.review?.reviewedAt, true) || "";

    const other = (type === "其他" && d.incidentTypeOtherText) ? `（${escapeHtml(d.incidentTypeOtherText)}）` : "";
    const fallTag = (type === "跌倒" && d.fallAnalysis) ? `原因分析已填` : "";

    const el = document.createElement("div");
    el.className = "item";
    const typeLabel = type ? `${escapeHtml(type)}${other}` : "";
    el.innerHTML = `
      <div class="row">
        <div class="nameWrap">
          <div class="nameLine">
            <span class="nameText">${escapeHtml(name)}</span>
            ${typeLabel ? `<span class="typeBadge">${typeLabel}</span>`:""}
            ${!reviewed ? `<span class="reviewBadge">未覆核</span>` : `<span class="reviewedBadge">已覆核</span>`}
          </div>
          <div class="subLine muted">${gender ? `${escapeHtml(gender)}`:""}${(gender && age) ? "｜":""}${age ? `${escapeHtml(age)}`:""}</div>
        </div>
        <div class="row" style="gap:8px; justify-content:flex-end; flex-wrap:wrap;">
          ${createdAtText ? `<div class="muted">建立：${escapeHtml(createdAtText)}</div>` : ``}
          <div class="muted">${creator ? `填報：${escapeHtml(creator)}`:""}</div>
          <button class="btn" data-edit="${doc.id}" type="button">查看／編輯</button>
          ${canReview ? `<button class="btn" data-review="${doc.id}" type="button">覆核案件</button>` : ``}
          <button class="btn" data-del="${doc.id}" type="button" style="background:rgba(220,38,38,.10);border-color:rgba(220,38,38,.35);color:#7f1d1d;">刪除</button>
        </div>
      </div>
      <div class="metaGrid">
        ${diagCat ? `<div class="metaBlock">
            <div class="metaTitle">診斷類別</div>
            <div><span class="tag">${escapeHtml(diagCat)}</span></div>
        </div>`:""}
        ${diag ? `<div class="metaBlock">
            <div class="metaTitle">疾病診斷</div>
            <div><span class="tag">${escapeHtml(diag)}</span></div>
        </div>`:""}
        ${injury ? `<div class="metaBlock">
            <div class="metaTitle">傷害等級</div>
            <div><span class="tag">${escapeHtml(injury)}</span></div>
        </div>`:""}
        <div class="metaBlock">
            <div class="metaTitle">覆核欄</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${reviewed ? `<span class="reviewedBadge">已覆核：${escapeHtml(reviewedBy || '已覆核')}${reviewedAtText ? `｜${escapeHtml(reviewedAtText)}` : ''}</span>` : `<span class="reviewBadge">未覆核</span>`}
              ${canReview ? `<span class="tag">你目前具有覆核權限</span>` : ``}
            </div>
        </div>
        ${fallTag ? `<div class="metaBlock">
            <div class="metaTitle">原因分析</div>
            <div><span class="tag">${escapeHtml(fallTag)}</span></div>
        </div>`:""}
      </div>
    `;

    const delBtn = el.querySelector('button[data-del]');
    if (delBtn){
      delBtn.onclick = async ()=>{
        if (!confirm("確定要刪除這筆案件單？此操作無法復原。")) return;
        delBtn.disabled = true;
        try{
          await window.db.collection("qc_incidents").doc(delBtn.dataset.del).delete();
          await renderIncidents();
          await renderMonths();
        }catch(err){
          console.error("[qc_incidents] delete failed", err);
          alert("刪除失敗：" + (err.message || err));
        }finally{
          delBtn.disabled = false;
        }
      };
    }

    const editBtn = el.querySelector('button[data-edit]');
    if (editBtn){
      editBtn.onclick = async ()=>{
        try{
          await openEditModal(editBtn.dataset.edit);
        }catch(err){
          console.error("[qc_incidents] open edit failed", err);
          alert("開啟案件失敗：" + (err.message || err));
        }
      };
    }

    const reviewBtn = el.querySelector('button[data-review]');
    if (reviewBtn){
      reviewBtn.onclick = async ()=>{
        if (!confirm("確定要覆核這筆案件嗎？")) return;
        await reviewIncident(reviewBtn.dataset.review, reviewBtn);
      };
    }

    box.appendChild(el);
  });
}

function validateForm(){
  clearHints();
  let ok = true;

  const rid = $("residentSelect").value;
  if (!rid){ showHint("hintResident"); ok = false; }

  const diagCat = $("diagnosisCategory").value;
  if (!diagCat){ showHint("hintDiagCat"); ok = false; }

  const type = $("incidentType").value;
  if (!type){ showHint("hintIncidentType"); ok = false; }

  if (type === "其他"){
    const other = ($("incidentTypeOtherText").value || "").trim();
    if (!other){ showHint("hintIncidentOther"); ok = false; }
  }

  const injury = $("injuryLevel").value;
  if (!injury){ showHint("hintInjury"); ok = false; }

  if (!ok) $("saveHint").textContent = "請先完成必填欄位。";
  return ok;
}

async function saveIncident(){
  ensureCurrentUser();
  if (!validateForm()) return;

  const rid = $("residentSelect").value;
  const r = residentsCache.find(x=>x.id===rid);
  const incidentType = $("incidentType").value;
  const editingId = ($("editingIncidentId").value || "").trim();

  const baseData = {
    occurYear: currentYear,
    occurMonth: currentMonth,

    residentId: rid,
    residentName: r?.name || "",
    residentGender: r?.gender || "",
    residentAge: calcAgeFromBirthday(r?.birthday),
    diagnosisCategory: $("diagnosisCategory").value,
    residentDiagnosis: r?.diagnosis || "",

    incidentType,
    incidentTypeOtherText: incidentType === "其他" ? ($("incidentTypeOtherText").value || "").trim() : "",
    injuryLevel: $("injuryLevel").value,

    fallAnalysis: null,

    review: {
      status: "pending",
      reviewedAt: null,
      reviewedBy: null
    },

    updatedAt: serverTimestamp(),
    updatedBy: {
      uid: window.CurrentUser.uid,
      name: window.CurrentUser.name || "",
      role: window.CurrentUser.role || ""
    }
  };

  if (incidentType === "跌倒"){
    const caseFactors = getCheckedValues("caseFactors");
    const envFactors = getCheckedValues("envFactors");
    const equipFactors = getCheckedValues("equipFactors");
    const staffFactors = getCheckedValues("staffFactors");
    const drugFactors = getCheckedValues("drugFactors");

    baseData.fallAnalysis = {
      caseFactors,
      caseFactorsOtherText: (caseFactors.includes("其他") ? ($("caseFactorsOtherText").value || "").trim() : ""),
      environmentFactors: envFactors,
      equipmentFactors: equipFactors,
      staffFactors,
      drugFactors,
      otherText: ($("fallOtherText").value || "").trim()
    };
  }

  $("btnSave").disabled = true;
  $("saveHint").textContent = editingId ? "修改中..." : "儲存中...";

  try{
    if (editingId){
      const ref = window.db.collection("qc_incidents").doc(editingId);
      const oldSnap = await ref.get();
      const oldData = oldSnap.data() || {};
      const payload = { ...baseData };
      if (oldData.review && isIncidentReviewed(oldData)) {
        payload.review = { ...oldData.review };
      } else if (oldData.review) {
        payload.review = { ...oldData.review, status: oldData.review.status || "pending", reviewedAt: null, reviewedBy: null };
      }
      await ref.update(payload);
      $("saveHint").textContent = "已修改";
    } else {
      await window.db.collection("qc_incidents").add({
        ...baseData,
        createdAt: serverTimestamp(),
        createdBy: {
          uid: window.CurrentUser.uid,
          name: window.CurrentUser.name || "",
          role: window.CurrentUser.role || ""
        }
      });
      $("saveHint").textContent = "已儲存";
    }
    closeModal();
    await renderIncidents();
    await renderMonths();
  }catch(err){
    console.error("[qc_incidents] save failed", err);
    $("saveHint").textContent = `${editingId ? "修改" : "儲存"}失敗：${err.message || err}`;
  }finally{
    $("btnSave").disabled = false;
  }
}

function initFallUI(){
  buildCheckGroup("caseFactors", FallCaseFactors, (label, checked)=>{
    if (label === "其他"){
      if (checked) $("caseOtherWrap").classList.remove("hidden");
      else {
        $("caseOtherWrap").classList.add("hidden");
        $("caseFactorsOtherText").value = "";
      }
    }
  });
  buildCheckGroup("envFactors", FallEnvFactors);
  buildCheckGroup("equipFactors", FallEquipFactors);
  buildCheckGroup("staffFactors", FallStaffFactors);
  buildCheckGroup("drugFactors", FallDrugFactors);
}

async function init(){
  ensureEnv();

  buildYearSelect();
  buildIncidentTypeSelect();
  initFallUI();

  $("btnBack").onclick = ()=> showMonthsView();
  $("btnAdd").onclick = ()=> openModal();
  $("btnCloseModal").onclick = ()=> closeModal();
  $("modalMask").addEventListener("click", (e)=>{
    if (e.target === $("modalMask")) closeModal();
  });
  $("btnSave").onclick = ()=> saveIncident();

  await loadResidents();
  buildResidentSelect();
  await loadCurrentUserReviewPermission();
  const reviewModeHint = document.getElementById("reviewModeHint");
  if (reviewModeHint) reviewModeHint.textContent = currentUserCanReview ? "目前登入者具有覆核權限；所有未覆核案件皆可直接覆核。" : "目前登入者無覆核權限；可查看案件內容，但不可執行覆核。";

  showMonthsView();
  initTabs();
}

function boot(){
  // 若 firebase-init 已完成（window.db 已存在）就直接啟動
  try{
    if (window.db) {
      init().catch(err=>{
        console.error(err);
        alert(err.message || String(err));
      });
      return;
    }
  }catch(_e){}

  // 否則等待 firebase-ready
  document.addEventListener("firebase-ready", () => {
    init().catch(err=>{
      console.error(err);
      alert(err.message || String(err));
    });
  }, { once: true });

  // 保險：若 8 秒內仍沒拿到 db，給提示（避免畫面空空）
  setTimeout(() => {
    if (!window.db) {
      console.warn("[qc] window.db 尚未就緒，請確認 qc-incident.html 有先載入 firebase-init.js，且路徑正確。");
      // 不強制 alert，避免一直跳；但若你想要可打開下一行
      // alert("尚未連線到資料庫：請確認已載入 firebase-init.js（且在本檔案之前）");
    }
  }, 8000);
}

window.addEventListener("DOMContentLoaded", boot);




// ===================== 統計面板（同頁整合） =====================
const AGE_BANDS = [
  { label:"31–40", min:31, max:40 },
  { label:"41–50", min:41, max:50 },
  { label:"51–60", min:51, max:60 },
  { label:"61–70", min:61, max:70 },
  { label:"71–80", min:71, max:80 },
  { label:"81–90", min:81, max:90 },
  { label:"91+", min:91, max:200 },
];
const INJURY_LEVELS = ["無傷害","第一級","第二級","第三級","未填"];

// 診斷類別（與表單選單一致；未填一定要統計到）
const DIAG_CATS = ["癌症","腦中風","高血壓","糖尿病","失智","骨折","腎臟疾病","頭頸部外傷","精神疾病","其他","未填"];

let _statsCharts = { gender:null, age:null, type:null, diagCat:null, fallCase:null, fallOther:null };

function _destroyChart(k){
  if (_statsCharts[k]){ _statsCharts[k].destroy(); _statsCharts[k]=null; }
}

function _fmtDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const da=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

function _endOfDay(d){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
}

function _toTimestamp(dateObj){
  return window.firebase.firestore.Timestamp.fromDate(dateObj);
}

function _normalizeGender(g){
  if (!g) return "未填";
  const s = String(g).trim();
  if (s === "男" || s.toLowerCase()==="male") return "男";
  if (s === "女" || s.toLowerCase()==="female") return "女";
  return s;
}

function _bandAge(age){
  const n = Number(age);
  if (!Number.isFinite(n)) return "未填";
  for (const b of AGE_BANDS){
    if (n >= b.min && n <= b.max) return b.label;
  }
  return "其他";
}

function _countBy(items, keyFn){
  const m = new Map();
  for (const x of items){
    const k = keyFn(x);
    m.set(k, (m.get(k)||0)+1);
  }
  return m;
}

function _topN(map, n=10){
  return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

function _makeBar(canvas, labels, values){
  return new Chart(canvas, {
    type:"bar",
    data:{ labels, datasets:[{ label:"件數", data:values }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{
        x:{ ticks:{ font:{ size:14 }}},
        y:{ beginAtZero:true, ticks:{ precision:0, font:{ size:14 }}}
      }
    }
  });
}

function _makePie(canvas, labels, values){
  return new Chart(canvas, {
    type:"pie",
    data:{ labels, datasets:[{ data:values }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:"bottom", labels:{ font:{ size:14 }}}}
    }
  });
}

function _renderStatsKPIs(total, fallTotal, uniqueResidents){
  const box = document.getElementById("statsKpiRow");
  if (!box) return;
  box.innerHTML = "";
  const mk = (label, value)=> {
    const div = document.createElement("div");
    div.className="pill";
    div.textContent = `${label}：${value}`;
    box.appendChild(div);
  };
  mk("事件總數", total);
  mk("跌倒事件", fallTotal);
  mk("涉及住民數", uniqueResidents);
}

function _buildMatrixTable(items){
  const table = document.getElementById("tableMatrix");
  if (!table) return;
  table.innerHTML = "";

  // type -> injury -> count
  const matrix = new Map();
  for (const x of items){
    const type = (x.incidentType === "其他" && x.incidentTypeOtherText) ? `其他（${x.incidentTypeOtherText}）` : (x.incidentType || "未填");
    const injury = x.injuryLevel || "未填";
    if (!matrix.has(type)) matrix.set(type, new Map());
    const inner = matrix.get(type);
    inner.set(injury, (inner.get(injury)||0)+1);
  }

  const types = Array.from(matrix.keys()).sort((a,b)=>a.localeCompare(b,"zh-Hant"));

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.innerHTML = `<th>事件類別</th>` + INJURY_LEVELS.map(l=>`<th>${l}</th>`).join("") + `<th>合計</th>`;
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const colTotals = new Map(INJURY_LEVELS.map(l=>[l,0]));
  let grandTotal = 0;

  for (const t of types){
    const inner = matrix.get(t) || new Map();
    let rowTotal = 0;
    const tds = INJURY_LEVELS.map(l=>{
      const c = inner.get(l)||0;
      rowTotal += c;
      colTotals.set(l, colTotals.get(l)+c);
      return `<td>${c}</td>`;
    }).join("");
    grandTotal += rowTotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="font-weight:900">${t}</td>${tds}<td style="font-weight:900">${rowTotal}</td>`;
    tbody.appendChild(tr);
  }

  const trf = document.createElement("tr");
  trf.innerHTML =
    `<td style="font-weight:900">合計</td>` +
    INJURY_LEVELS.map(l=>`<td style="font-weight:900">${colTotals.get(l)||0}</td>`).join("") +
    `<td style="font-weight:900">${grandTotal}</td>`;
  tbody.appendChild(trf);

  table.appendChild(tbody);
}

async function runStatsByRange(startDate, endDate){
  // 用 createdAt 做區間統計（不需要 composite index）
  const q = window.db.collection("qc_incidents")
    .where("createdAt", ">=", _toTimestamp(startDate))
    .where("createdAt", "<=", _toTimestamp(endDate));

  const snap = await q.get();
  const items = [];
  snap.forEach(d=> items.push(d.data()||{}));

  const total = items.length;
  const fallTotal = items.filter(x=>x.incidentType==="跌倒").length;
  const uniqueResidents = new Set(items.map(x=>x.residentId).filter(Boolean)).size;
  _renderStatsKPIs(total, fallTotal, uniqueResidents);

  // gender
  const gMap = _countBy(items, x=>_normalizeGender(x.residentGender));
  const gLabels = Array.from(gMap.keys());
  const gVals = gLabels.map(k=>gMap.get(k));
  _destroyChart("gender");
  _statsCharts.gender = _makePie(document.getElementById("chartGender"), gLabels, gVals);

  // age bands
  const aMap = _countBy(items, x=>_bandAge(x.residentAge));
  const aLabels = AGE_BANDS.map(b=>b.label).concat(["未填","其他"]);
  const aVals = aLabels.map(l=>aMap.get(l)||0);
  _destroyChart("age");
  _statsCharts.age = _makeBar(document.getElementById("chartAge"), aLabels, aVals);

  // type top
  const tMap = _countBy(items, x=>{
    if (x.incidentType === "其他" && x.incidentTypeOtherText) return `其他（${x.incidentTypeOtherText}）`;
    return x.incidentType || "未填";
  });
  const tTop = _topN(tMap, 12);
  _destroyChart("type");
  _statsCharts.type = _makeBar(document.getElementById("chartType"), tTop.map(x=>x[0]), tTop.map(x=>x[1]));

  // diagnosis category
  const dMap = _countBy(items, x=> (x.diagnosisCategory || "").trim() || "未填");
  const dOrdered = DIAG_CATS.map(k=>[k, dMap.get(k)||0]);
  // 若資料中出現非預設類別，也一併列入（避免漏算）
  for (const [k,v] of dMap.entries()){
    if (!DIAG_CATS.includes(k)) dOrdered.push([k,v]);
  }
  const dFiltered = dOrdered.filter(x=>x[1] > 0);
  _destroyChart("diagCat");
  const diagCanvas = document.getElementById("chartDiagCat");
  if (diagCanvas) {
    _statsCharts.diagCat = _makeBar(diagCanvas, dFiltered.map(x=>x[0]), dFiltered.map(x=>x[1]));
  }

  // fall factors
  const fallCase = new Map();
  const fallOther = new Map();
  const add = (m, k)=> m.set(k, (m.get(k)||0)+1);

  for (const x of items){
    if (x.incidentType !== "跌倒") continue;
    const fa = x.fallAnalysis;
    if (!fa) continue;

    const caseFactors = Array.isArray(fa.caseFactors) ? fa.caseFactors : [];
    for (const f of caseFactors) add(fallCase, f);
    if (caseFactors.includes("其他") && (fa.caseFactorsOtherText||"").trim()){
      add(fallCase, `其他：${(fa.caseFactorsOtherText||"").trim()}`);
    }

    const env = Array.isArray(fa.environmentFactors) ? fa.environmentFactors : [];
    const equip = Array.isArray(fa.equipmentFactors) ? fa.equipmentFactors : [];
    const staff = Array.isArray(fa.staffFactors) ? fa.staffFactors : [];
    const drug = Array.isArray(fa.drugFactors) ? fa.drugFactors : [];

    env.forEach(f=> add(fallOther, `環境：${f}`));
    equip.forEach(f=> add(fallOther, `設備：${f}`));
    staff.forEach(f=> add(fallOther, `人員：${f}`));
    drug.forEach(f=> add(fallOther, `藥物：${f}`));
    if ((fa.otherText||"").trim()) add(fallOther, `其他：${(fa.otherText||"").trim()}`);
  }

  const fcTop = _topN(fallCase, 10);
  _destroyChart("fallCase");
  _statsCharts.fallCase = _makeBar(document.getElementById("chartFallCase"), fcTop.map(x=>x[0]), fcTop.map(x=>x[1]));

  const foTop = _topN(fallOther, 12);
  _destroyChart("fallOther");
  _statsCharts.fallOther = _makeBar(document.getElementById("chartFallOther"), foTop.map(x=>x[0]), foTop.map(x=>x[1]));

  _buildMatrixTable(items);

  const rangeText = document.getElementById("statsRangeText");
  if (rangeText) rangeText.textContent = `${_fmtDate(startDate)} ～ ${_fmtDate(endDate)}（${total} 筆）`;
}

function setStatsPresetThisYear(){
  const y = currentYear || new Date().getFullYear();
  const s = new Date(y,0,1,0,0,0,0);
  const e = _endOfDay(new Date(y,11,31,0,0,0,0));
  const startEl = document.getElementById("statsStart");
  const endEl = document.getElementById("statsEnd");
  if (startEl) startEl.value = _fmtDate(s);
  if (endEl) endEl.value = _fmtDate(e);
}

function setStatsPresetLast30(){
  const now = new Date();
  const e = _endOfDay(now);
  const s = new Date(now.getTime() - 29*24*60*60*1000);
  const startEl = document.getElementById("statsStart");
  const endEl = document.getElementById("statsEnd");
  if (startEl) startEl.value = _fmtDate(s);
  if (endEl) endEl.value = _fmtDate(e);
}

async function runStatsFromInputs(){
  const startEl = document.getElementById("statsStart");
  const endEl = document.getElementById("statsEnd");
  const btn = document.getElementById("btnStatsRun");
  if (!startEl || !endEl) return;

  const ds = startEl.value;
  const de = endEl.value;
  if (!ds || !de){
    alert("請選擇統計起訖日期");
    return;
  }
  const start = new Date(ds + "T00:00:00");
  const end = _endOfDay(new Date(de + "T00:00:00"));

  if (btn) btn.disabled = true;
  try{
    await runStatsByRange(start, end);
  }catch(err){
    console.error(err);
    alert(err.message || String(err));
  }finally{
    if (btn) btn.disabled = false;
  }
}

function initStatsUI(){
  // 若 Chart.js 沒載入就略過（避免整頁掛掉）
  if (!window.Chart) {
    console.warn("[qc] Chart.js not loaded, stats panel disabled");
    return;
  }

  const by = document.getElementById("btnStatsThisYear");
  const b30 = document.getElementById("btnStatsLast30");
  const br = document.getElementById("btnStatsRun");
  const bex = document.getElementById("btnStatsExport");

  if (by) by.onclick = async ()=>{ setStatsPresetThisYear(); await runStatsFromInputs(); };
  if (b30) b30.onclick = async ()=>{ setStatsPresetLast30(); await runStatsFromInputs(); };
  if (br) br.onclick = async ()=>{ await runStatsFromInputs(); };
  if (bex) bex.onclick = async ()=>{ await exportStatsWorkbook(); };

  setStatsPresetThisYear();
  // 自動跑一次
  runStatsFromInputs();
}
// ===================== 統計面板 END =====================


// ===================== 統計 Excel 匯出（每分頁一個月份） =====================
function _xlsTableCss(){
  return `
    table{border-collapse:collapse;font-family:"Microsoft JhengHei",Arial;}
    th,td{border:1px solid #999;padding:4px 6px; mso-number-format:"\\@";}
    th{background:#f1f3f5;font-weight:bold;}
    .room-title{background:#e7f1ff;font-weight:bold;}
    .sec-title{background:#fff7cc;font-weight:bold;}
  `;
}

function _buildWorkbookHTML(sheets){
  const worksheetXml = sheets.map(s=>`
    <x:ExcelWorksheet>
      <x:Name>${s.name}</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet>`).join('');
  const content = sheets.map(s=>`<div id="${s.name}">${s.html}</div>`).join('');
  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]><xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>${worksheetXml}</x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml><![endif]-->
      <style>${_xlsTableCss()}</style>
    </head>
    <body>${content}</body></html>`;
}

function _downloadTextAsFile(filename, content, mime){
  const blob = new Blob([content], { type: mime || 'application/vnd.ms-excel;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(_e){} }, 2000);
}

function _mapToSortedRows(map){
  return Array.from(map.entries()).sort((a,b)=> b[1]-a[1]);
}

function _sectionTableHTML(title, rows, total){
  let html = '<table>'; 
  html += `<tr><th colspan="2" class="sec-title">${title}</th></tr>`;
  html += '<tr><th>類別</th><th>數量</th></tr>';
  for (const [k,v] of rows){
    html += `<tr><td>${String(k||'')}</td><td>${Number(v||0)}</td></tr>`;
  }
  html += `<tr><th>合計</th><th>${Number(total||0)}</th></tr>`;
  html += '</table>';
  return html;
}

function _buildMonthStatsSheetHTML(year, month, items){
  const ym = `${year}年${String(month).padStart(2,'0')}月`;

  // ========== 案件類別：即使 0 也要顯示 ==========
  const tMap = _countBy(items, x=>{
    if (x.incidentType === '其他' && (x.incidentTypeOtherText||'').trim()) {
      return `其他（${(x.incidentTypeOtherText||'').trim()}）`;
    }
    return (x.incidentType || '').trim() || '未填';
  });

  // 其他（xxx）合計
  let otherSum = 0;
  const otherDetails = [];
  for (const [k,v] of tMap.entries()){
    if (String(k).startsWith('其他（')) {
      otherSum += Number(v||0);
      otherDetails.push([k, Number(v||0)]);
    }
  }
  otherDetails.sort((a,b)=>b[1]-a[1]);

  const baseTypes = (Array.isArray(IncidentTypes) ? IncidentTypes.slice() : []).concat(['未填']);
  const tRows = baseTypes.map(k=>{
    if (k === '其他') return ['其他（自訂）', otherSum + (tMap.get('其他')||0)];
    return [k, tMap.get(k)||0];
  });

  // 若資料中出現非預設類別，也一併列入（避免漏算）
  for (const [k,v] of tMap.entries()){
    if (!baseTypes.includes(k) && !String(k).startsWith('其他（')) {
      tRows.push([k, v]);
    }
  }
  // 把「其他（xxx）」明細也列出（讓你知道自訂項目有哪些）
  if (otherDetails.length){
    tRows.push(['— 其他明細 —', '']);
    tRows.push(...otherDetails);
  }

  const tTotal = items.length;

  // ========== 診斷類型：預設類別全部列出 ==========
  const dMap = _countBy(items, x=> (x.diagnosisCategory || '').trim() || '未填');
  const dRowsOrdered = DIAG_CATS.map(k=>[k, dMap.get(k)||0]);
  for (const [k,v] of dMap.entries()){
    if (!DIAG_CATS.includes(k)) dRowsOrdered.push([k, v]);
  }
  const dTotal = Array.from(dMap.values()).reduce((a,b)=>a+b,0);

  // ========== 傷害等級：預設類別全部列出 ==========
  const iMap = _countBy(items, x=> (x.injuryLevel || '').trim() || '未填');
  const iRows = INJURY_LEVELS.map(k=>[k, iMap.get(k)||0]);
  for (const [k,v] of iMap.entries()){
    if (!INJURY_LEVELS.includes(k)) iRows.push([k, v]);
  }
  const iTotal = Array.from(iMap.values()).reduce((a,b)=>a+b,0);

  // ========== 性別：男/女/未填 一定顯示 ==========
  const gMap = _countBy(items, x=> _normalizeGender(x.residentGender));
  const genderOrder = ['男','女','未填'];
  const gRows = genderOrder.map(g=>[g, gMap.get(g)||0]);
  for (const [k,v] of gMap.entries()){
    if (!genderOrder.includes(k)) gRows.push([k, v]);
  }
  const gTotal = Array.from(gMap.values()).reduce((a,b)=>a+b,0);

  // ========== 年齡區間：全部區間都顯示（含 0） ==========
  const aMap = _countBy(items, x=> _bandAge(x.residentAge));
  const aLabels = AGE_BANDS.map(b=>b.label).concat(['未填','其他']);
  const aRows = aLabels.map(l=>[l, aMap.get(l)||0]);
  const aTotal = Array.from(aMap.values()).reduce((a,b)=>a+b,0);

  let html = '';
  html += '<table>';
  html += `<tr><th colspan="2" class="room-title">${ym}｜意外事件統計</th></tr>`;
  html += `<tr><td>總筆數</td><td>${tTotal}</td></tr>`;
  html += '</table>';
  html += '<br/>';
  html += _sectionTableHTML('案件類別', tRows, tTotal);
  html += '<br/>';
  html += _sectionTableHTML('診斷類型', dRowsOrdered, dTotal);
  html += '<br/>';
  html += _sectionTableHTML('傷害等級', iRows, iTotal);
  html += '<br/>';
  html += _sectionTableHTML('性別', gRows, gTotal);
  html += '<br/>';
  html += _sectionTableHTML('年齡區間', aRows, aTotal);
  return html;
}


async function exportStatsWorkbook(){
  ensureEnv();
  const year = Number(currentYear || new Date().getFullYear());
  const raw = (prompt('輸入要匯出月份(1-12)；或輸入 ALL 匯出全年 12 個分頁', 'ALL') || '').trim();
  const isAll = !raw || /^all$/i.test(raw);
  const mPick = isAll ? null : Number(raw);
  if (!isAll && (!Number.isFinite(mPick) || mPick<1 || mPick>12)){
    alert('月份輸入錯誤，請輸入 1~12 或 ALL');
    return;
  }

  const btn = document.getElementById('btnStatsExport');
  if (btn) { btn.disabled = true; btn.dataset.idleText = btn.dataset.idleText || btn.textContent; btn.textContent = '匯出中...'; }

  try{
    // 一次抓全年，再依月份分組（避免 12 次查詢）
    const snap = await window.db.collection('qc_incidents').where('occurYear','==', year).get();
    const byMonth = new Map();
    snap.forEach(doc=>{
      const d = doc.data() || {};
      const m = Number(d.occurMonth);
      if (!Number.isFinite(m) || m<1 || m>12) return;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(d);
    });

    const months = isAll ? Array.from({length:12},(_,i)=>i+1) : [mPick];
    const sheets = months.map(m=>{
      const items = byMonth.get(m) || [];
      return {
        name: `${String(m).padStart(2,'0')}月`,
        html: _buildMonthStatsSheetHTML(year, m, items)
      };
    });

    const wbHtml = _buildWorkbookHTML(sheets);
    const fn = isAll
      ? `意外事件統計_${year}年_全年.xls`
      : `意外事件統計_${year}年_${String(mPick).padStart(2,'0')}月.xls`;
    _downloadTextAsFile(fn, wbHtml, 'application/vnd.ms-excel;charset=utf-8');
  }catch(err){
    console.error(err);
    alert('匯出失敗：' + (err?.message || String(err)));
  }finally{
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.idleText || '匯出Excel'; }
  }
}
// ===================== 統計 Excel 匯出 END =====================


// ===================== Tabs（案件單 / 統計） =====================
let currentTab = "cases";

function setTab(tab){
  currentTab = tab;
  try{ localStorage.setItem("qc_incident_tab", tab); }catch(_e){}

  const btnCases = document.getElementById("tabBtnCases");
  const btnStats = document.getElementById("tabBtnStats");
  const stats = document.getElementById("statsPanel");
  const vm = document.getElementById("viewMonths");
  const vi = document.getElementById("viewIncidents");
  const btnAdd = document.getElementById("btnAdd");
  const btnBack = document.getElementById("btnBack");

  if (btnCases) btnCases.classList.toggle("active", tab==="cases");
  if (btnStats) btnStats.classList.toggle("active", tab==="stats");

  if (stats) stats.style.display = (tab==="stats") ? "" : "none";
  if (vm) vm.style.display = (tab==="cases" && !currentMonth) ? "" : "none";
  if (vi) vi.style.display = (tab==="cases" && !!currentMonth) ? "" : "none";

  // stats tab 不需要新增/返回月份按鈕
  if (btnAdd) btnAdd.classList.toggle("hidden", tab==="stats" || !currentMonth);
  if (btnBack) btnBack.classList.toggle("hidden", tab==="stats" || !currentMonth);

  // 統計 tab 需要確保 charts 會初始化
  if (tab==="stats") {
    initStatsUI();
  }
}

function initTabs(){
  const btnCases = document.getElementById("tabBtnCases");
  const btnStats = document.getElementById("tabBtnStats");
  if (btnCases) btnCases.onclick = ()=> setTab("cases");
  if (btnStats) btnStats.onclick = ()=> setTab("stats");

  let saved = null;
  try{ saved = localStorage.getItem("qc_incident_tab"); }catch(_e){}
  setTab(saved==="stats" ? "stats" : "cases");
}
// ===================== Tabs END =====================
