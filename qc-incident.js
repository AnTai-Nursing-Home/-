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
  "管路滑脫","缺氧","壓傷","昏倒(死亡)","跌倒","其他"
];

const FallCaseFactors = ["頭暈","虛弱","步態不穩","意識混亂","不當使用輔具","未使用輔具","肌力不足","穿著不合適","不遵從","其他"];
const FallEnvFactors  = ["地面濕滑","路面不平","照明不足","有障礙物"];
const FallEquipFactors= ["未使用助行器","床欄未拉起","床或椅子的高度不適合","呼叫鈴放置不易取得"];
const FallStaffFactors= ["未定時巡視","照服員未能及時協助","未依標準照護流程執行"];
const FallDrugFactors = ["鎮靜劑","降壓劑","降血糖","利尿劑"];

let currentYear = new Date().getFullYear();
let currentMonth = null; // 1~12
let residentsCache = []; // [{id,name,gender,birthday,diagnosis}]

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
}

async function showMonthDetail(month){
  currentMonth = month;
  $("btnBack").classList.remove("hidden");
  $("btnAdd").classList.remove("hidden");
  $("viewMonths").classList.add("hidden");
  $("viewIncidents").classList.remove("hidden");
  setTopTitle();
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
    else renderMonths();
  };
}

async function countIncidentsOfMonth(year, month){
  const snap = await window.db.collection("qc_incidents")
    .where("occurYear","==",year)
    .where("occurMonth","==",month)
    .get();
  return snap.size;
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
      <div class="muted" id="mCount-${m}">讀取中...</div>
    `;
    card.querySelector("button").onclick = ()=> showMonthDetail(m);
    box.appendChild(card);

    countIncidentsOfMonth(currentYear, m)
      .then(n => { const el = $(`mCount-${m}`); if (el) el.textContent = `本月事件：${n} 筆`; })
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
      diagnosis: d.diagnosis || ""
    });
  });
  list.sort((a,b)=> (a.name||"").localeCompare(b.name||"", "zh-Hant"));
  residentsCache = list;
}

function buildResidentSelect(){
  const sel = $("residentSelect");
  sel.innerHTML = `<option value="">請選擇住民</option>`;
  for (const r of residentsCache){
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    sel.appendChild(opt);
  }
  sel.onchange = () => {
    const rid = sel.value;
    const r = residentsCache.find(x=>x.id===rid);
    $("residentGender").value = r?.gender || "";
    $("residentAge").value = r ? String(calcAgeFromBirthday(r.birthday) ?? "") : "";
    $("residentDiagnosis").value = r?.diagnosis || "";
  };
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

function openModal(){
  clearHints();
  $("modalMask").classList.remove("hidden");
  // reset form but keep resident list
  $("residentSelect").value = "";
  $("residentGender").value = "";
  $("residentAge").value = "";
  $("residentDiagnosis").value = "";
  $("diagnosisCategory").value = "";
  $("incidentType").value = "";
  $("incidentOtherWrap").classList.add("hidden");
  $("incidentTypeOtherText").value = "";
  $("injuryLevel").value = "";
  $("fallWrap").classList.add("hidden");
  clearFallInputs();
}

function closeModal(){
  $("modalMask").classList.add("hidden");
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

    const other = (type === "其他" && d.incidentTypeOtherText) ? `（${d.incidentTypeOtherText}）` : "";
    const fallTag = (type === "跌倒" && d.fallAnalysis) ? `原因分析已填` : "";

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="row">
        <div style="font-weight:800">${name} <span class="muted">${gender ? `｜${gender}`:""} ${age ? `｜${age}`:""}</span></div>
        <div class="muted">${creator ? `填報：${creator}`:""}</div>
      </div>
      <div class="meta">
        ${diagCat ? `<span class="tag">${diagCat}</span>`:""}
        ${diag ? `<span class="tag">${diag}</span>`:""}
        ${type ? `<span class="tag">${type}${other}</span>`:""}
        ${injury ? `<span class="tag">${injury}</span>`:""}
        ${fallTag ? `<span class="tag">${fallTag}</span>`:""}
      </div>
    `;
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
  const data = {
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

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: {
      uid: window.CurrentUser.uid,
      name: window.CurrentUser.name || "",
      role: window.CurrentUser.role || ""
    },
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

    data.fallAnalysis = {
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
  $("saveHint").textContent = "儲存中...";

  try{
    await window.db.collection("qc_incidents").add(data);
    $("saveHint").textContent = "已儲存";
    closeModal();
    await renderIncidents();
    // 回到月份頁也能看到更新後的數字（可選）
    // renderMonths();
  }catch(err){
    console.error("[qc_incidents] save failed", err);
    $("saveHint").textContent = `儲存失敗：${err.message || err}`;
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

  showMonthsView();
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

