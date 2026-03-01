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
  // 統計面板（月份頁）
  initStatsUI();
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




// ===================== 統計面板（同頁整合） =====================
const AGE_BANDS = [
  { label:"0–64", min:0, max:64 },
  { label:"65–74", min:65, max:74 },
  { label:"75–84", min:75, max:84 },
  { label:"85–94", min:85, max:94 },
  { label:"95+", min:95, max:200 },
];
const INJURY_LEVELS = ["無傷害","第一級","第二級","第三級","未填"];

let _statsCharts = { gender:null, age:null, type:null, fallCase:null, fallOther:null };

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

  if (by) by.onclick = async ()=>{ setStatsPresetThisYear(); await runStatsFromInputs(); };
  if (b30) b30.onclick = async ()=>{ setStatsPresetLast30(); await runStatsFromInputs(); };
  if (br) br.onclick = async ()=>{ await runStatsFromInputs(); };

  setStatsPresetThisYear();
  // 自動跑一次
  runStatsFromInputs();
}
// ===================== 統計面板 END =====================
