// === Inject: hardcoded floor template & localStorage bootstrap ===
(function() {
  try {
    var KEY = 'FLOOR_TEMPLATE_V1';
    var cur = localStorage.getItem(KEY);
    if (!cur) {
      localStorage.setItem(KEY, {"1": ["101-1", "101-2", "102-1", "102-2", "103-1", "103-2", "105-1", "105-2", "106-1", "106-2", "107-1", "107-2", "108-1", "108-2", "109-1", "109-2", "110-1", "110-2", "111-1", "111-2", "112-1", "112-2", "113-1", "115-1", "115-2", "116-1", "116-2"], "2": ["201-1", "202-1", "202-2", "203-1", "203-2", "205-1", "205-2", "206-1", "206-2", "207-1", "207-2", "208-1", "208-2", "208-5", "209-1", "209-2", "209-3", "209-5", "210-1", "210-2", "210-3", "210-5", "211-1", "211-2", "212-1", "212-2", "213-1", "213-2", "215-1", "215-2", "216-1", "216-2", "217-1", "217-3", "217-5", "218-1", "218-2", "218-3", "218-5", "219-1", "219-2", "219-3", "219-5", "219-6", "220-1", "220-2", "220-3", "220-5", "221-1", "221-2", "221-3", "221-5"], "3": ["301-1", "301-2", "301-3", "301-5", "302-1", "302-2", "302-3", "302-5", "303-2", "303-3", "303-5", "305-1", "306-1", "306-2", "307-1", "307-2", "308-1", "308-2", "309-1", "309-2", "310-1", "310-2", "311-1", "311-2", "311-3", "311-5", "312-1", "312-2", "312-3", "312-5", "312-6", "313-1", "313-2", "313-3", "313-5", "313-6", "315-1", "315-2", "316-1", "316-2", "317-1", "317-2", "318-1", "318-2", "319-1", "319-2", "320-1", "320-2", "320-3", "320-5", "321-1", "321-2", "321-3", "321-5"]});
      console.log('[MSICAO] Default floor template installed.');
    } else {
      try {
        var tpl = JSON.parse(cur);
        var total = [].concat(tpl['1']||[], tpl['2']||[], tpl['3']||[]).length;
        if (!total) {
          localStorage.setItem(KEY, {"1": ["101-1", "101-2", "102-1", "102-2", "103-1", "103-2", "105-1", "105-2", "106-1", "106-2", "107-1", "107-2", "108-1", "108-2", "109-1", "109-2", "110-1", "110-2", "111-1", "111-2", "112-1", "112-2", "113-1", "115-1", "115-2", "116-1", "116-2"], "2": ["201-1", "202-1", "202-2", "203-1", "203-2", "205-1", "205-2", "206-1", "206-2", "207-1", "207-2", "208-1", "208-2", "208-5", "209-1", "209-2", "209-3", "209-5", "210-1", "210-2", "210-3", "210-5", "211-1", "211-2", "212-1", "212-2", "213-1", "213-2", "215-1", "215-2", "216-1", "216-2", "217-1", "217-3", "217-5", "218-1", "218-2", "218-3", "218-5", "219-1", "219-2", "219-3", "219-5", "219-6", "220-1", "220-2", "220-3", "220-5", "221-1", "221-2", "221-3", "221-5"], "3": ["301-1", "301-2", "301-3", "301-5", "302-1", "302-2", "302-3", "302-5", "303-2", "303-3", "303-5", "305-1", "306-1", "306-2", "307-1", "307-2", "308-1", "308-2", "309-1", "309-2", "310-1", "310-2", "311-1", "311-2", "311-3", "311-5", "312-1", "312-2", "312-3", "312-5", "312-6", "313-1", "313-2", "313-3", "313-5", "313-6", "315-1", "315-2", "316-1", "316-2", "317-1", "317-2", "318-1", "318-2", "319-1", "319-2", "320-1", "320-2", "320-3", "320-5", "321-1", "321-2", "321-3", "321-5"]});
          console.log('[MSICAO] Empty template fixed with default.');
        }
      } catch(e) {
        localStorage.setItem(KEY, {"1": ["101-1", "101-2", "102-1", "102-2", "103-1", "103-2", "105-1", "105-2", "106-1", "106-2", "107-1", "107-2", "108-1", "108-2", "109-1", "109-2", "110-1", "110-2", "111-1", "111-2", "112-1", "112-2", "113-1", "115-1", "115-2", "116-1", "116-2"], "2": ["201-1", "202-1", "202-2", "203-1", "203-2", "205-1", "205-2", "206-1", "206-2", "207-1", "207-2", "208-1", "208-2", "208-5", "209-1", "209-2", "209-3", "209-5", "210-1", "210-2", "210-3", "210-5", "211-1", "211-2", "212-1", "212-2", "213-1", "213-2", "215-1", "215-2", "216-1", "216-2", "217-1", "217-3", "217-5", "218-1", "218-2", "218-3", "218-5", "219-1", "219-2", "219-3", "219-5", "219-6", "220-1", "220-2", "220-3", "220-5", "221-1", "221-2", "221-3", "221-5"], "3": ["301-1", "301-2", "301-3", "301-5", "302-1", "302-2", "302-3", "302-5", "303-2", "303-3", "303-5", "305-1", "306-1", "306-2", "307-1", "307-2", "308-1", "308-2", "309-1", "309-2", "310-1", "310-2", "311-1", "311-2", "311-3", "311-5", "312-1", "312-2", "312-3", "312-5", "312-6", "313-1", "313-2", "313-3", "313-5", "313-6", "315-1", "315-2", "316-1", "316-2", "317-1", "317-2", "318-1", "318-2", "319-1", "319-2", "320-1", "320-2", "320-3", "320-5", "321-1", "321-2", "321-3", "321-5"]});
        console.log('[MSICAO] Corrupt template fixed with default.');
      }
    }
  } catch(e) {
    console.warn('[MSICAO] Template bootstrap failed', e);
  }
})();

// residents-admin.fixed.js
// 修正：
// 1) 基本資料依「床號」排序（含 3 碼房號與子床號自然序）。
// 2) 床位配置空白：若尚未建立樓層模板，會依現有床號自動推導模板並存到 localStorage，再依模板顯示空床/實床。
// 3) 匯出 Excel 保留（含框線、底色、各樓層統計與總人數統計）。

(function(){
  let started=false;
  function canStart(){return typeof db!=='undefined' && db && typeof db.collection==='function'}
  function startNow(){if(started)return; started=true; document.dispatchEvent(new Event('residents-init'));}
  document.addEventListener('firebase-ready', ()=>startNow());
  if(document.readyState==='complete'||document.readyState==='interactive'){setTimeout(()=>{if(canStart())startNow()},300)}
  else{document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if(canStart())startNow()},300)})}
  let tries=0; const t=setInterval(()=>{ if(started){clearInterval(t);return} if(canStart()){startNow();clearInterval(t)} if(++tries>20)clearInterval(t) },500);
})();

document.addEventListener('residents-init', ()=>{
  const dbCol='residents';
  const MOBILITY_COLLECTION='mobilityAssessments';
  const LINK_COLLECTION='systemSettings';
  const LINK_DOC='residentMobilityLink';
  const tbody=document.getElementById('residents-table-body');
  const floor1Grid=document.getElementById('floor1-grid');
  const floor2Grid=document.getElementById('floor2-grid');
  const floor3Grid=document.getElementById('floor3-grid');
  const statsArea=document.getElementById('stats-area');

  const importBtn=document.getElementById('import-excel-btn');
  const fileInput=document.getElementById('excel-file-input');
  const importStatus=document.getElementById('import-status');
  const addBtn=document.getElementById('add-resident-btn');
  const loadingOverlay=document.getElementById('loading-overlay');
  const loadingTextEl=document.getElementById('loading-text');

  function showLoading(message='資料處理中...'){
    try{
      if(loadingTextEl) loadingTextEl.textContent=message;
      if(loadingOverlay) loadingOverlay.classList.add('show');
    }catch(_e){}
  }
  function hideLoading(){
    try{ if(loadingOverlay) loadingOverlay.classList.remove('show'); }catch(_e){}
  }

  const LS_KEY='FLOOR_TEMPLATE_V1';
  function getTemplateRaw(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {'1':[], '2':[], '3':[]}; }
    catch{ return {'1':[], '2':[], '3':[]}; }
  }
  function setTemplate(tpl){ try{ localStorage.setItem(LS_KEY, JSON.stringify(tpl)); }catch{} }
  function normalizeToken(s){
    const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
    if(!m) return null;
    return `${m[1]}-${m[2]}`;
  }
  function ensureTemplateFromCache(data){
    const tpl = getTemplateRaw();
    let changed = false;
    [1,2,3].forEach(f=>{
      if(!tpl[String(f)] || tpl[String(f)].length===0){
        const tokens = [];
        data.forEach(r=>{
          const bed = normalizeToken(r.bedNumber);
          if(!bed) return;
          if(String(bed).startsWith(`${f}`)){ tokens.push(bed); }
        });
        const uniq = Array.from(new Set(tokens))
          .sort((a,b)=>{
            const ma=a.match(/^(\d{3})-(.+)$/); const mb=b.match(/^(\d{3})-(.+)$/);
            const ra=parseInt(ma[1],10), rb=parseInt(mb[1],10);
            if(ra!==rb) return ra-rb;
            const sa=parseInt(String(ma[2]).replace(/\D/g,''),10)||0;
            const sb=parseInt(String(mb[2]).replace(/\D/g,''),10)||0;
            return sa-sb;
          });
        tpl[String(f)] = uniq;
        changed = true;
      }
    });
    if(changed) setTemplate(tpl);
    return tpl;
  }
  function getTemplate(data){
    const raw = getTemplateRaw();
    if((raw['1']||[]).length===0 && (raw['2']||[]).length===0 && (raw['3']||[]).length===0){
      return ensureTemplateFromCache(data);
    }
    return raw;
  }

  const norm=v=>(v==null?'':String(v).trim());

  function firestoreDateToIso(value){
    try{ if(value && typeof value.toDate==='function') return value.toDate().toISOString(); }catch(_e){}
    if(!value) return '';
    try{
      const d = new Date(value);
      return isNaN(d) ? '' : d.toISOString();
    }catch(_e){ return ''; }
  }
  function pickLatestMobilitySheet(items){
    return (items || []).slice().sort((a,b)=>{
      const aUpdated = firestoreDateToIso(a && a.updatedAt) || '';
      const bUpdated = firestoreDateToIso(b && b.updatedAt) || '';
      if (aUpdated !== bUpdated) return bUpdated.localeCompare(aUpdated);
      const aDate = norm(a && a.date);
      const bDate = norm(b && b.date);
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return norm(b && b.id).localeCompare(norm(a && a.id));
    })[0] || null;
  }
  function buildMobilityMapFromSheet(sheet){
    const map = new Map();
    const rows = Array.isArray(sheet && sheet.rows) ? sheet.rows : [];
    rows.forEach(row=>{
      const residentNo = norm(row && row.residentNumber);
      if (!residentNo) return;
      const mobility = norm(row && row.mobility);
      if (!mobility) return;
      map.set(residentNo, mobility);
    });
    return map;
  }
  async function getLatestMobilitySheet(){
    try{
      const snap = await db.collection(MOBILITY_COLLECTION).get();
      const sheets = snap.docs.map(doc=>({ id:doc.id, ...doc.data() }));
      return pickLatestMobilitySheet(sheets);
    }catch(err){
      console.warn('讀取評估系統最新資料失敗：', err);
      return null;
    }
  }
  async function updateResidentMobilityLinkDoc(sheet){
    const payload = {
      linkedSheetId: sheet ? norm(sheet.id) : '',
      linkedSheetTitle: sheet ? norm(sheet.title) : '',
      linkedSheetDate: sheet ? norm(sheet.date) : '',
      linkedSheetYear: sheet && sheet.year ? Number(sheet.year) : null,
      linkedSheetUpdatedAt: sheet ? (firestoreDateToIso(sheet.updatedAt) || '') : '',
      linkedResidentCount: Array.isArray(sheet && sheet.rows) ? sheet.rows.length : 0,
      linkedAt: new Date().toISOString(),
      source: 'residents-admin-import'
    };
    await db.collection(LINK_COLLECTION).doc(LINK_DOC).set(payload, { merge:true });
  }
  function bedToSortValue(bed){ if(!bed) return 0; const m=String(bed).match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/); if(!m) return 0; const base=parseInt(m[1],10); const sub=m[2]?parseInt(String(m[2]).replace(/\D/g,''),10)||0:0; return base+sub/100; }
  function calcAge(iso){ if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; const now=new Date(); let a=now.getFullYear()-d.getFullYear(); const m=now.getMonth()-d.getMonth(); if(m<0||(m===0&&now.getDate()<d.getDate())) a--; return a; }
  function parseDateSmart(v){
    if(!v&&v!==0) return '';
    if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString().slice(0,10);
    if(typeof v==='number'&&isFinite(v)){const ms=(v-25569)*86400000; const d=new Date(ms); if(!isNaN(d)) return new Date(d.getTime()+d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
    let s=String(v).trim(); if(!s) return ''; s=s.replace(/[\.年\/-]/g,'-').replace(/月/g,'-').replace(/日/g,'').replace(/\s+/g,''); const m=s.match(/^(\d{1,4})-?(\d{1,2})-?(\d{1,2})$/); if(m){let y=+m[1],mo=+m[2],da=+m[3]; if(y<1911) y+=1911; const dd=new Date(Date.UTC(y,mo-1,da)); if(!isNaN(dd)) return dd.toISOString().slice(0,10);} const d2=new Date(s); if(!isNaN(d2)) return d2.toISOString().slice(0,10); return ''; }
  function rocName(){ const d=new Date(); const y=d.getFullYear()-1911; const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}${m}${dd}-床位配置-消防位置圖-報告詞 -`; }

  let cache=[];

  function renderBasic(){
    if(!tbody) return;
    let html='';
    cache.forEach(r=>{
      const age=calcAge(r.birthday);
      html+=`<tr data-id="${r.id}">
        <td>${r.nursingStation||''}</td>
        <td>${r.residentNumber||''}</td>
        <td>${r.bedNumber||''}</td>
        <td>${r.residentName||r.id||''}</td>
        <td>${r.englishName||''}</td>
        <td>${r.checkinDate||r.admissionDate||''}</td>
        <td>${r.idNumber||''}</td>
        <td>${r.birthday||''}</td>
        <td>${r.gender||''}</td>
        <td>${age!==''?age:''}</td>
        <td>${r.address||''}</td>
        <td>${r.diagnosis||''}</td>
        <td>${r.emergencyContact||''}</td>
        <td>${r.emergencyPhone||''}</td>
        <td>${r.mobility||''}</td>
        <td>${r.leaveStatus||''}</td>
        <td><button class="btn btn-sm btn-primary btn-edit">編輯</button> <button class="btn btn-sm btn-danger btn-delete">刪除</button></td>
      </tr>`;
    });
    tbody.innerHTML=html;
  }

  function parseBedToken(s){ const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return null; return {room:m[1], sub:m[2], token:`${m[1]}-${m[2]}`}; }


  function normalizeLeaveStatus(r){
    const raw = (r && r.leaveStatus != null) ? String(r.leaveStatus) : '';
    return raw.replace(/\s/g, '');
  }
  function isHospStatus(r){
    const v = normalizeLeaveStatus(r);
    return v.includes('住院');
  }
  function isLeaveStatus(r){
    const v = normalizeLeaveStatus(r);
    if (!v) return false;      // 空白視為在院
    return !v.includes('住院'); // 只要不是「住院」就當作請假
  }

  function buildFloorHtml(container,floor,tpl,data){
    if(!container) return;
    container.innerHTML='';

    const tokens=(tpl[String(floor)]||[]).slice();
    if(tokens.length===0){
      container.innerHTML = '<div class="alert alert-warning">尚未設定床位模板，已自動建立。請重新整理。</div>';
      return;
    }
    const grouped=new Map();
    tokens.forEach(tok=>{const t=parseBedToken(tok); if(!t) return; if(!grouped.has(t.room)) grouped.set(t.room,{}); const g=grouped.get(t.room); if(!g.__keys) g.__keys=new Set(); g.__keys.add(t.sub);});
    const resByToken=new Map(); data.forEach(r=>{ const key=normalizeToken(r.bedNumber); if(key) resByToken.set(key,r); });

    const rooms=[...grouped.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));
    let html='<div class="row g-2">';
    let totalBeds=0, usedBeds=0;
    const emptyTokens=[];

    rooms.forEach(room=>{
      const g=grouped.get(room); const subs=[...g.__keys].sort((a,b)=>(parseInt(a.replace(/\D/g,''),10)||0)-(parseInt(b.replace(/\D/g,''),10)||0));
      totalBeds += subs.length;
      let rows='';
      subs.forEach(sub=>{
        const token=`${room}-${sub}`;
        const r=resByToken.get(token);
        const age=r?calcAge(r.birthday):'';
        const status = r ? (isHospStatus(r)?'bg-danger-subtle':(isLeaveStatus(r)?'bg-warning-subtle':'bg-success-subtle')) : 'bg-light';
        if(r) usedBeds++; else emptyTokens.push(token);
        rows+=`<div class="d-flex justify-content-between border-bottom py-2 ${status}">
          <div class="small text-muted">🛏 ${token}</div>
          <div>${r?((r.residentName||r.id)||'🈳 空床'):'🈳 空床'} ${r?(r.gender||''):''} ${age!==''?`/ ${age}歲`:''}</div>
        </div>`;
      });
      html+=`<div class="col-12 col-sm-6 col-lg-4"><div class="card h-100">
        <div class="card-header fw-bold">房號 ${room}</div>
        <div class="card-body">${rows}</div>
      </div></div>`;
    });
    html+='</div>';

    const emptyBeds = totalBeds - usedBeds;
    html+= `<div class="mt-3">
      <div class="row g-2 align-items-start">
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">樓層床位數 <strong>${totalBeds}</strong></div></div>
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">空床數 <strong>${emptyBeds}</strong></div></div>
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">已使用床位數 <strong>${usedBeds}</strong></div></div>
      </div>
      <div class="small text-muted mt-2">空床清單：${emptyTokens.length? emptyTokens.join('、') : '無'}</div>
    </div>`;

    container.innerHTML=html;
  }

  function renderFloors(tpl){
    const f1=cache.filter(r=>/^1\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/1/.test(r.nursingStation)));
    const f2=cache.filter(r=>/^2\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/2/.test(r.nursingStation)));
    const f3=cache.filter(r=>/^3\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/3/.test(r.nursingStation)));
    buildFloorHtml(floor1Grid,1,tpl,f1);
    buildFloorHtml(floor2Grid,2,tpl,f2);
    buildFloorHtml(floor3Grid,3,tpl,f3);
  }

  
function renderStats(){
  if(!statsArea) return;
  var total = cache.length;
  var male = cache.filter(function(r){ return r.gender==='男'; }).length;
  var female = cache.filter(function(r){ return r.gender==='女'; }).length;
  var leave = cache.filter(function(r){ return isLeaveStatus(r); }).length;
  var hosp  = cache.filter(function(r){ return isHospStatus(r); }).length;
  var present = total - (leave + hosp);

  function normv(s){ return (s==null?'':String(s)); }
  function inFloor(f){
      var reg = new RegExp('^' + f + '\\d\\d');
      return cache.filter(function(r){
          var bed = String(r.bedNumber||'');
          return reg.test(bed) || (r.nursingStation && String(r.nursingStation).indexOf(String(f))>-1);
      });
  }

  var WHEEL = /(輪椅)/i;
  var TROLLEY = /(推床|臥床|平車|推車)/i;
  var WALK = /(步行|可獨立|助行|拐杖|walker)/i;

  var floors = [1,2,3].map(function(f){
      var arr = inFloor(f);
      var fTotal = arr.length;
      var fLeave = arr.filter(function(r){ return isLeaveStatus(r); }).length;
      var fHosp  = arr.filter(function(r){ return isHospStatus(r); }).length;
      var fPresent = fTotal - (fLeave + fHosp);
      var arrActive = arr.filter(function(r){ return !(isLeaveStatus(r) || isHospStatus(r)); });
      var fWheel = arrActive.filter(function(r){ return WHEEL.test(normv(r.mobility)); }).length;
      var fTrolley = arrActive.filter(function(r){ return TROLLEY.test(normv(r.mobility)); }).length;
      var fWalk = arrActive.filter(function(r){ return WALK.test(normv(r.mobility)); }).length;
      return {f:f, fTotal:fTotal, fPresent:fPresent, fLeave:fLeave, fHosp:fHosp, fWheel:fWheel, fTrolley:fTrolley, fWalk:fWalk};
  });

  var activeAll = cache.filter(function(r){ return !(isLeaveStatus(r) || isHospStatus(r)); });
  var mWheel = activeAll.filter(function(r){ return WHEEL.test(normv(r.mobility)); }).length;
  var mTrolley = activeAll.filter(function(r){ return TROLLEY.test(normv(r.mobility)); }).length;
  var mWalk = activeAll.filter(function(r){ return WALK.test(normv(r.mobility)); }).length;

  var rows = '';
  for(var i=0;i<floors.length;i++){
      var x = floors[i];
      rows += ''
      + '<tr>'
      +   '<td>' + x.f + 'F</td>'
      +   '<td class="text-end">' + x.fTotal + '</td>'
      +   '<td class="text-end text-success">' + x.fPresent + '</td>'
      +   '<td class="text-end text-warning">' + x.fLeave + '</td>'
      +   '<td class="text-end text-danger">' + x.fHosp + '</td>'
      +   '<td class="text-end">' + x.fWalk + '</td>'
      +   '<td class="text-end">' + x.fWheel + '</td>'
      +   '<td class="text-end">' + x.fTrolley + '</td>'
      + '</tr>';
  }

  var leaveArr = cache.filter(function(r){ return isLeaveStatus(r); })
    .slice()
    .sort(function(a,b){ return String(a.bedNumber||'').localeCompare(String(b.bedNumber||''), 'zh-Hant', {numeric:true}); });
  var hospArr  = cache.filter(function(r){ return isHospStatus(r); })
    .slice()
    .sort(function(a,b){ return String(a.bedNumber||'').localeCompare(String(b.bedNumber||''), 'zh-Hant', {numeric:true}); });

  function buildLHList(arr, emptyText){
    if(!arr || !arr.length){
      return '<div class="small text-muted">'+(emptyText||'無')+'</div>';
    }
    var items = '';
    for(var i=0;i<arr.length;i++){
      var r = arr[i] || {};
      var bed = (r.bedNumber!=null? String(r.bedNumber):'');
      var name = (r.residentName || r.id || '');
      items += ''
        + '<li class="list-group-item d-flex justify-content-between align-items-center py-2">'
        +   '<span class="small text-muted">🛏 ' + (bed||'') + '</span>'
        +   '<span class="fw-semibold">' + (name||'') + '</span>'
        + '</li>';
    }
    return '<ul class="list-group list-group-flush">' + items + '</ul>';
  }

  // NOTE: #stats-area 在 HTML 內已經是 row g-3，這裡只輸出 col-*，避免 row 包 row 造成版面怪異。
  var html = ''
    +   '<div class="col-12 col-lg-4">'
    +     '<div class="card border-0 shadow-sm h-100 stats-card">'
    +       '<div class="card-body d-flex flex-column">'
    +         '<div class="d-flex align-items-center justify-content-between mb-3">'
    +           '<div class="h5 mb-0">總人數</div>'
    +           '<span class="badge bg-dark fs-6">' + total + '</span>'
    +         '</div>'
    +         '<div class="row g-2 mb-2">'
    +           '<div class="col-auto"><span class="badge bg-secondary-subtle text-dark">男 <strong>' + male + '</strong></span></div>'
    +           '<div class="col-auto"><span class="badge bg-secondary-subtle text-dark">女 <strong>' + female + '</strong></span></div>'
    +           '<div class="col-auto"><span class="badge bg-success-subtle text-success">實到 <strong>' + present + '</strong></span></div>'
    +           '<div class="col-auto"><span class="badge bg-warning-subtle text-warning">請假 <strong>' + leave + '</strong></span></div>'
    +           '<div class="col-auto"><span class="badge bg-danger-subtle text-danger">住院 <strong>' + hosp + '</strong></span></div>'
    +         '</div>'
    +         '<div class="table-responsive mt-3">'
    +           '<table class="table table-sm align-middle mb-0">'
    +             '<thead class="table-light">'
    +               '<tr>'
    +                 '<th>樓層</th>'
    +                 '<th class="text-end">總數</th>'
    +                 '<th class="text-end">實到</th>'
    +                 '<th class="text-end">請假</th>'
    +                 '<th class="text-end">住院</th>'
    +                 '<th class="text-end">步行</th>'
    +                 '<th class="text-end">輪椅</th>'
    +                 '<th class="text-end">推床</th>'
    +               '</tr>'
    +             '</thead>'
    +             '<tbody>' + rows + '</tbody>'
    +           '</table>'
    +         '</div>'
    +         '<div class="small text-muted mt-2">'
    +           '<span class="me-3">行動方式總計：</span>'
    +           '<span class="me-2">步行 ' + mWalk + '</span>'
    +           '<span class="me-2">輪椅 ' + mWheel + '</span>'
    +           '<span>推床 ' + mTrolley + '</span>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'

    +   '<div class="col-12 col-lg-4">'
    +     '<div class="card border-0 shadow-sm h-100 stats-card">'
    +       '<div class="card-body d-flex flex-column">'
    +         '<div class="d-flex align-items-center justify-content-between mb-3">'
    +           '<div class="h5 mb-0">請假/住院</div>'
    +           '<div class="d-flex gap-2">'
    +             '<span class="badge bg-warning-subtle text-warning">請假 <strong>' + leave + '</strong></span>'
    +             '<span class="badge bg-danger-subtle text-danger">住院 <strong>' + hosp + '</strong></span>'
    +           '</div>'
    +         '</div>'
    +         '<div class="mb-3">'
    +           '<div class="fw-bold text-warning mb-2"><i class="fa-solid fa-person-walking-arrow-right me-1"></i>請假名單</div>'
    +           '<div class="border rounded-3 overflow-auto stats-scroll">' + buildLHList(leaveArr, '目前無請假') + '</div>'
    +         '</div>'
    +         '<div>'
    +           '<div class="fw-bold text-danger mb-2"><i class="fa-solid fa-hospital me-1"></i>住院名單</div>'
    +           '<div class="border rounded-3 overflow-auto stats-scroll">' + buildLHList(hospArr, '目前無住院') + '</div>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'

    +   '<div class="col-12 col-lg-4">'
    +     '<div class="card border-0 shadow-sm h-100 stats-card">'
    +       '<div class="card-body d-flex flex-column">'
    +         '<div class="d-flex justify-content-between align-items-center mb-3">'
    +           '<div class="h5 mb-0">動作區</div>'
    +           '<span class="badge bg-success-subtle text-success">報表</span>'
    +         '</div>'
    +         '<button id="export-xls-styled" class="btn btn-success w-100 mb-3">'
    +           '<i class="fa-solid fa-file-excel me-1"></i>匯出 Excel（V1.0）'
    +         '</button>'
    +         '<button id="print-headcards" class="btn btn-outline-dark w-100 mb-3">'
    +           '<i class="fa-solid fa-print me-1"></i>列印床頭牌'
    +         '</button>'
    +         '<ul class="list-group list-group-flush">'
    +           '<li class="list-group-item d-flex justify-content-between align-items-center">'
    +             '<span>下載目前資料的完整報表（基本資料 / 各樓層床位配置 / 總人數統計）。</span>'
    +             '<i class="fa-regular fa-circle-down"></i>'
    +           '</li>'
    +           '<li class="list-group-item">'
    +             '<div class="small text-muted">提示：請於「床位模板設定」維護各樓層床號清單，即可在樓層頁顯示空床並於報表列出空床名單。</div>'
    +           '</li>'
    +         '</ul>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    ;

  // 補一點樣式（只影響總人數統計頁三張卡）
  try{
    if(!document.getElementById('stats-cards-style')){
      var st=document.createElement('style');
      st.id='stats-cards-style';
      st.textContent='\
        .stats-card .card-body{gap:8px;}\
        .stats-card .table-responsive{flex:1; min-height:0;}\
        .stats-scroll{max-height:42vh; max-height:min(42vh, 420px); overflow:auto; -webkit-overflow-scrolling:touch;}\
        @media (min-width: 992px){ .stats-scroll{max-height:360px;} }\
      ';
      document.head.appendChild(st);
    }
  }catch(e){}

  statsArea.innerHTML = html;
  try{ updateStatsHeaderCounts(present, total); }catch(e){}
}



  // === 手動模板設定 ===
  const openTplBtn = document.getElementById('open-template-btn');
  const tplModalEl = document.getElementById('template-modal');
  let tplModal = null;
  if (window.bootstrap && tplModalEl) tplModal = new bootstrap.Modal(tplModalEl);
  const tplTextarea = document.getElementById('template-input');
  const saveTplBtn = document.getElementById('save-template-btn');

  function parseTokensToTemplate(text){
    const tpl = {'1':[], '2':[], '3':[]};
    if(!text || !text.trim()) return tpl;
    const raw = text.replace(/[,\s]+/g,' ').trim().split(' ');
    const norm = s => {
      const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      return m? `${m[1]}-${m[2]}` : null;
    };
    const set = {'1':new Set(),'2':new Set(),'3':new Set()};
    raw.forEach(tok=>{
      const t = norm(tok);
      if(!t) return;
      const floor = t[0];
      if(floor==='1') set['1'].add(t);
      else if(floor==='2') set['2'].add(t);
      else if(floor==='3') set['3'].add(t);
    });
    ['1','2','3'].forEach(f=>{
      tpl[f] = Array.from(set[f]).sort((a,b)=>{
        const ma=a.match(/^(\d{3})-(.+)$/); const mb=b.match(/^(\d{3})-(.+)$/);
        const ra=parseInt(ma[1],10), rb=parseInt(mb[1],10);
        if(ra!==rb) return ra-rb;
        const sa=parseInt(String(ma[2]).replace(/\D/g,''),10)||0;
        const sb=parseInt(String(mb[2]).replace(/\D/g,''),10)||0;
        return sa-sb;
      });
    });
    return tpl;
  }

  if(openTplBtn && tplModal && tplTextarea && saveTplBtn){
    openTplBtn.addEventListener('click', ()=>{
      // 預填目前模板內容
      const cur = JSON.parse(localStorage.getItem(LS_KEY) || '{"1":[],"2":[],"3":[]}');
      const merged = [...(cur['1']||[]), ...(cur['2']||[]), ...(cur['3']||[])].join(' ');
      tplTextarea.value = merged;
      tplModal.show();
    });
    saveTplBtn.addEventListener('click', ()=>{
      const text = tplTextarea.value;
      const tpl = parseTokensToTemplate(text);
      localStorage.setItem(LS_KEY, JSON.stringify(tpl));
      if(tplModal) tplModal.hide();
      // 重新渲染樓層（不刷新 Firestore）
      renderFloors(tpl);
    });
  }


  // === 床頭牌列印 ===
  const headcardModalEl = document.getElementById('headcard-modal');
  const headcardListEl  = document.getElementById('headcard-list');
  const headcardSearchEl = document.getElementById('headcard-search');
  const headcardSelectAllEl = document.getElementById('headcard-select-all');
  const headcardPrintBtn = document.getElementById('headcard-print-btn');
  let headcardModal = null;
  if (window.bootstrap && headcardModalEl) headcardModal = new bootstrap.Modal(headcardModalEl);

  function fmtYMDCompact(v){
    const s = parseDateSmart(v);
    if(!s) return '';
    return s.replace(/-/g,'');
  }

  function getSortedCache(){
    return (cache || []).slice().sort((a,b)=> bedToSortValue(a.bedNumber)-bedToSortValue(b.bedNumber));
  }

  function buildHeadcardList(){
    if(!headcardListEl) return;
    const q = (headcardSearchEl && headcardSearchEl.value) ? String(headcardSearchEl.value).trim().toLowerCase() : '';
    const rows = getSortedCache().filter(r=>{
      const name = String(r.residentName||'').toLowerCase();
      const en   = String(r.englishName||'').toLowerCase();
      const bed  = String(r.bedNumber||'').toLowerCase();
      const rn   = String(r.residentNumber||'').toLowerCase();
      if(!q) return true;
      return name.includes(q) || en.includes(q) || bed.includes(q) || rn.includes(q);
    });

    let html = '';
    rows.forEach(r=>{
      const id = r.id;
      const bed = r.bedNumber || '';
      const name = r.residentName || r.id || '';
      const en = r.englishName || '';
      const status = normalizeLeaveStatus(r);
      const badge = status ? `<span class="badge bg-secondary-subtle text-dark ms-2">${status}</span>` : '';
      html += `
        <label class="list-group-item d-flex align-items-center gap-2">
          <input class="form-check-input me-1 headcard-check" type="checkbox" value="${String(id).replace(/"/g,'&quot;')}">
          <div class="flex-grow-1">
            <div class="fw-semibold">${bed}　${name}${badge}</div>
            <div class="small text-muted">${en}</div>
          </div>
        </label>
      `;
    });

    headcardListEl.innerHTML = html || '<div class="text-muted small p-3">沒有符合的住民</div>';
  }

  function openHeadcardDialog(){
    if(!headcardModal) { alert('列印視窗初始化失敗（找不到 headcard-modal）。'); return; }
    buildHeadcardList();
    if(headcardSearchEl) headcardSearchEl.value = '';
    if(headcardSelectAllEl) headcardSelectAllEl.checked = false;
    headcardModal.show();
    // reset after show
    setTimeout(()=>{ buildHeadcardList(); }, 0);
  }

  async function handleHeadcardPrint(){
    // 取選取
    const checks = Array.from(document.querySelectorAll('.headcard-check:checked'));
    if(!checks.length){ alert('請先選擇要列印的床頭牌。'); return; }
    const idSet = new Set(checks.map(c=>String(c.value)));
    const selected = getSortedCache().filter(r=> idSet.has(String(r.id)));

    if(headcardModal) headcardModal.hide();
    printHeadcards(selected);
  }

  function printHeadcards(items){
    const w = window.open('', '_blank');
    if(!w){ alert('瀏覽器阻擋彈出視窗，請允許後再試一次。'); return; }

    const pages = (items||[]).map(r=>{
      const checkin = fmtYMDCompact(r.checkinDate);
      const name = (r.residentName || r.id || '');
      const en = (r.englishName || '');
      const diag = (r.diagnosis || '');
      const birth = fmtYMDCompact(r.birthday);
      const gender = (r.gender || '');
      const bed = (r.bedNumber || '');
      // 依示意圖排版：診斷放中段、下方左右為性別/床號
      return `
        <div class="page">
          <div class="card">
            <div class="row">
              <div class="lbl">入住日期：</div><div class="val">${checkin}</div>
            </div>
            <div class="row">
              <div class="lbl">姓名：</div><div class="val">${name}</div>
            </div>
            <div class="en">${en}</div>
            <div class="row diag-row">
              <div class="lbl">診斷：</div><div class="val diag">${diag}</div>
            </div>
            <div class="row">
              <div class="lbl">出生年月日：</div><div class="val">${birth}</div>
            </div>
            <div class="row bottom">
              <div class="half"><span class="lbl">性別：</span><span class="val">${gender}</span></div>
              <div class="half text-end"><span class="lbl">床號：</span><span class="val">${bed}</span></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const doc = `
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>列印床頭牌</title>
<style>
  @page { size: A4; margin: 12mm; }
  html, body { height: 100%; }
  body { margin: 0; font-family: "DFKai-SB","BiauKai","KaiTi","Microsoft JhengHei", Arial, sans-serif; }
  .page { width: 100%; height: calc(297mm - 24mm); display:flex; align-items:flex-start; justify-content:center; page-break-after: always; }
  .card {
    width: 130mm;
    min-height: 95mm;
    border: 3px solid #000;
    padding: 6mm 6mm;
    box-sizing: border-box;
  }
  .row { display:flex; gap: 8mm; margin: 2mm 0; align-items:flex-start; }
  .lbl { font-weight: 700; font-size: 22pt; white-space: nowrap; }
  .val { font-weight: 700; font-size: 22pt; flex: 1; }
  .en { text-align:center; font-size: 24pt; font-weight: 700; margin: 6mm 0 2mm; }
  .diag-row .val { line-height: 1.15; }
  .bottom { margin-top: 3mm; }
  .half { width: 50%; }
  .text-end { text-align: right; }
</style>
</head>
<body>
${pages}
<script>
(function(){
  function fit(el, min, max){
    if(!el) return;
    var size = max;
    el.style.fontSize = size + 'pt';
    // shrink until fits
    while (size > min && el.scrollHeight > el.clientHeight + 1) {
      size -= 1;
      el.style.fontSize = size + 'pt';
    }
  }
  // 讓診斷欄位高度固定（以便自動縮字）
  var diags = document.querySelectorAll('.diag');
  diags.forEach(function(d){
    d.style.maxHeight = '36mm';
    d.style.overflow = 'hidden';
    fit(d, 10, 22);
  });

  // 直接觸發列印
  setTimeout(function(){ window.print(); }, 200);
})();
</script>
</body>
</html>`;
    w.document.open();
    w.document.write(doc);
    w.document.close();
  }

  // headcard modal events
  if(headcardSearchEl){
    headcardSearchEl.addEventListener('input', ()=> buildHeadcardList());
  }
  if(headcardSelectAllEl){
    headcardSelectAllEl.addEventListener('change', ()=>{
      const checks = Array.from(document.querySelectorAll('.headcard-check'));
      checks.forEach(c=>{ c.checked = headcardSelectAllEl.checked; });
    });
  }
  if(headcardPrintBtn){
    headcardPrintBtn.addEventListener('click', handleHeadcardPrint);
  }

  function tableCss(){
    return `
      table { border-collapse: collapse; font-family: "Microsoft JhengHei", Arial; }
      th, td { border: 1px solid #999; padding: 4px 6px; mso-number-format:"\\@"; }
      th { background: #f1f3f5; }
      .room-title { background:#e7f1ff; font-weight:bold; }
      .cell-muted { color:#6c757d; }
      .bg-green { background:#e6ffed; }
      .bg-yellow { background:#fff7cc; }
      .bg-red { background:#ffe3e3; }
    `;
  }
  function sheetBasicHTML(){
    const header=['護理站','住民編號','床號','姓名','住民英文姓名','入住日期','身份證字號','生日','性別','住民年齡','地址','診斷','緊急連絡人或家屬','連絡電話','行走方式','請假 / 住院'];
    const rows=cache.map(r=>[
      r.nursingStation||'',
      r.residentNumber||'',
      r.bedNumber||'',
      r.residentName||r.id||'',
      r.englishName||'',
      r.checkinDate||r.admissionDate||'',
      r.idNumber||'',
      r.birthday||'',
      r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)),
      r.address||'',
      r.diagnosis||'',
      r.emergencyContact||'',
      r.emergencyPhone||'',
      r.mobility||'',
      r.leaveStatus||''
    ]);
    let html='<table><thead><tr>'+header.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>';
    rows.forEach(tr=>{ html+='<tr>'+tr.map(td=>`<td>${td||''}</td>`).join('')+'</tr>'; });
    html+='</tbody></table>';
    return html;
  }
  function sheetFloorHTML(floor){
    const tpl=getTemplate(cache); const tokens=(tpl[String(floor)]||[]).slice();
    const map=new Map(); tokens.forEach(t=>{ const m=t.match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return; const room=m[1], sub=m[2]; if(!map.has(room)) map.set(room,[]); map.get(room).push(sub); });
    const resMap=new Map(); cache.forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-'); resMap.set(key,r); });
    let html='<table>';
    html+=`<tr><th colspan="9" class="room-title">${floor}樓床位配置</th></tr>`;
    const rooms=[...map.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));

    let floorTotal=0, floorUsed=0;
    for(let i=0;i<rooms.length;i+=3){
      const chunk=rooms.slice(i,i+3);
      let tr='<tr>';
      chunk.forEach(room=>{ tr+=`<th colspan="3" class="room-title">房號 ${room}</th><td></td>`; });
      tr+='</tr>'; html+=tr;
      const maxLines=Math.max(...chunk.map(rm=> map.get(rm).length));
      for(let line=0; line<maxLines; line++){
        let row='<tr>';
        chunk.forEach(room=>{
          const subs=map.get(room);
          const sub=subs[line];
          const key=sub? `${room}-${sub}`:'';
          if(key) floorTotal++;
          const r=resMap.get(key);
          if(r) floorUsed++;
          const age=r? calcAge(r.birthday):'';
          const status=r? (isHospStatus(r)?'bg-red':(isLeaveStatus(r)?'bg-yellow':'bg-green')):'';
          row+=`<td class="cell-muted">🛏 ${key||''}</td>`;
          row+=`<td>${r?`${r.residentName||r.id||''}${(r.mobility||'').trim()?`（${r.mobility.trim()}）`:''}`:'🈳 空床'}</td>`;
          row+=`<td class="${status}">${r?(r.gender||''):''} ${age!==''?`/ ${age}歲`:''}</td>`;
          row+=`<td></td>`;
        });
        row+='</tr>'; html+=row;
      }
      html+='<tr><td colspan="9" style="border:none;height:6px"></td></tr>';
    }
    const floorEmpty=floorTotal-floorUsed;
    html+=`<tr><td>樓層床位數</td><td>${floorTotal}</td><td>空床數</td><td>${floorEmpty}</td><td>已使用床位數</td><td>${floorUsed}</td><td colspan="3"></td></tr>`;
    html+='</table>';
    return html;
  }
  function sheetStatsHTML(){
    const total=cache.length, male=cache.filter(r=>r.gender==='男').length, female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>isLeaveStatus(r)).length, hosp=cache.filter(r=>isHospStatus(r)).length;
    const present=total-(leave+hosp);
    let html='<table>';
    html+=`<tr><th colspan="8" class="room-title">總人數統計</th></tr>`;
    html+=`<tr><td>總人數</td><td>${total}</td><td>男</td><td>${male}</td><td>女</td><td>${female}</td><td>實到</td><td>${present}</td></tr>`;
    html+=`<tr><td>請假</td><td>${leave}</td><td>住院</td><td>${hosp}</td><td colspan="4"></td></tr>`;
    html+='</table>';
    return html;
  }
  function buildWorkbookHTML(sheets){
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
            <x:ExcelWorksheets>${worksheetXml}
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>${tableCss()}</style>
      </head>
      <body>
        ${content}
      </body></html>`;
  }


  async function isHospExport(r){const v=(r&&r.leaveStatus?String(r.leaveStatus):'').replace(/\s/g,'');return v.includes('住院');}
function isLeaveOnlyExport(r){const v=(r&&r.leaveStatus?String(r.leaveStatus):'').replace(/\s/g,'');if(!v)return false;return !v.includes('住院');}
function exportStyledXls(){
  if (window.__exportingXls) return;
  window.__exportingXls = true;
  (async () => {

  if (typeof ExcelJS === 'undefined') { alert('ExcelJS 載入失敗，無法匯出樣式。'); return; }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSICAO';
  wb.created = new Date();
  // ===== 匯出報表人（右下角頁尾）=====
  function getExportUserForFooter(){
    // 盡量沿用其他系統的登入儲存格式
    for (const store of [sessionStorage, localStorage]) {
      try{
        const raw = store.getItem('antai_session_user');
        if(raw){
          const a = JSON.parse(raw);
          const staffId = String(a?.staffId || a?.username || a?.id || '').trim();
          const displayName = String(a?.displayName || a?.name || a?.staffName || '').trim();
          const t = [staffId, displayName].filter(Boolean).join(' ').trim();
          if(t) return t;
        }
      }catch(_e){}
      for (const k of ['officeAuth','nurseAuth','caregiverAuth']) {
        try{
          const raw = store.getItem(k);
          if(!raw) continue;
          const a = JSON.parse(raw);
          const staffId = String(a?.staffId || a?.username || a?.id || '').trim();
          const displayName = String(a?.displayName || a?.name || a?.staffName || '').trim();
          const t = [staffId, displayName].filter(Boolean).join(' ').trim();
          if(t) return t;
        }catch(_e){}
      }
    }
    return '';
  }

  const __exportUserText = getExportUserForFooter();
  const __footerText = __exportUserText ? `&R&"Microsoft JhengHei,Regular"&8匯出報表人:${__exportUserText}` : '';

  function applyPrintFooter(ws){
    if(!ws || !__footerText) return;
    // ExcelJS headerFooter：&L 左、&C 中、&R 右
    ws.headerFooter = {
      oddFooter: __footerText,
      evenFooter: __footerText,
      firstFooter: __footerText
    };
  }


  // ===== 共用樣式 =====
  const fontTitle  = { name:'Microsoft JhengHei', bold:true, size:16 };
  const fontHeader = { name:'Microsoft JhengHei', bold:true, size:12 };
  const fontCell   = { name:'Microsoft JhengHei', size:11 };
  const fillHeader = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF1F3F5'} };
  const fillAlt    = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF8F9FA'} };
  const borderThin = { top:{style:'thin',color:{argb:'FF9E9E9E'}},
                       left:{style:'thin',color:{argb:'FF9E9E9E'}},
                       bottom:{style:'thin',color:{argb:'FF9E9E9E'}},
                       right:{style:'thin',color:{argb:'FF9E9E9E'}} };

  function styleRow(row,{isHeader=false,alt=false,center=false,height=18,wrap=false}={}){
    row.eachCell((c,idx)=>{
      c.font = isHeader ? fontHeader : fontCell;
      c.border = borderThin;
      const isBedNoCol = [2,3,7,12].includes(idx); // 床號欄置中
      c.alignment = { vertical:'middle', horizontal: (isHeader||center) ? 'center' : (isBedNoCol?'center':'left'), wrapText: wrap };
      if(isHeader) c.fill = fillHeader;
      else if(alt) c.fill = fillAlt;
    });
    row.height = height;
  }
  function addTitle(ws, text, lastCol){
    ws.mergeCells(1,1,1,lastCol);
    const c = ws.getCell(1,1);
    c.value = text;
    c.font = fontTitle;
    c.alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(1).height = 26;
  }
  function formatDate(d, sep='/'){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
    return `${y}${sep}${m}${sep}${da}`;
  }
  function getTpl(){
    try{ return JSON.parse(localStorage.getItem('FLOOR_TEMPLATE_V1')) || {'1':[],'2':[],'3':[]}; }
    catch{ return {'1':[],'2':[],'3':[]}; }
  }
  function computeAge(iso){
    if(!iso) return '';
    const d=new Date(iso); if(isNaN(d)) return '';
    const now=new Date();
    let a=now.getFullYear()-d.getFullYear();
    const m=now.getMonth()-d.getMonth();
    if(m<0||(m===0&&now.getDate()<d.getDate())) a--;
    return a;
  }

  // ===== 基本資料（第一張） =====
  (function addBasicSheet(){
  const ws = wb.addWorksheet('基本資料', { views: [{ state: 'frozen', ySplit: 1 }] });

  // 對應畫面「基本資料」頁 16 欄
  ws.columns = [
    { width: 8  },  // 護理站
    { width: 14 },  // 住民編號
    { width: 10 },  // 床號
    { width: 16 },  // 姓名
    { width: 20 },  // 住民英文姓名
    { width: 12 },  // 入住日期
    { width: 20 },  // 身份證字號
    { width: 12 },  // 生日
    { width: 6  },  // 性別
    { width: 8  },  // 住民年齡
    { width: 24 },  // 地址
    { width: 24 },  // 診斷
    { width: 18 },  // 緊急連絡人或家屬
    { width: 16 },  // 連絡電話
    { width: 14 },  // 行走方式
    { width: 10 }   // 請假 / 住院
  ];

  ws.mergeCells(1, 1, 1, 16);
  const titleCell = ws.getCell('A1');
  titleCell.value = '基本資料';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const header = ws.addRow([
    '護理站','住民編號','床號','姓名','住民英文姓名','入住日期','身份證字號','生日','性別','住民年齡',
    '地址','診斷','緊急連絡人或家屬','連絡電話','行走方式','請假 / 住院'
  ]);
  styleRow(header, { isHeader: true, center: true });

  // 依床號排序（同畫面）
  const rows = (cache || []).slice().sort(
    (a, b) => String(a.bedNumber || '').localeCompare(String(b.bedNumber || ''), 'zh-Hant')
  );

  for (const r of rows) {
    const age = computeAge(r.birthday);
    const row = ws.addRow([
      r.nursingStation || '',
      r.residentNumber || '',
      r.bedNumber || '',
      r.residentName || r.id || '',
      r.englishName || '',
      r.checkinDate || r.admissionDate || '',
      r.idNumber || '',
      r.birthday || '',
      r.gender || '',
      age === '' ? '' : age,
      r.address || '',
      r.diagnosis || '',
      r.emergencyContact || '',
      r.emergencyPhone || '',
      r.mobility || '',
      r.leaveStatus || ''
    ]);
    styleRow(row, {});
  }

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, // 不強制塞一頁，允許多頁
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 }
  };
  applyPrintFooter(ws);
})();
  // ===== 消防用名冊（第二張） =====
  (function addFireSheet(){
  const ws = wb.addWorksheet('消防用名冊', { views: [{ state: 'frozen', ySplit: 1 }] });

  // 對應基本資料欄位，但不含行走方式與請假 / 住院
  ws.columns = [
    { width: 8  },  // 護理站
    { width: 14 },  // 住民編號
    { width: 10 },  // 床號
    { width: 16 },  // 姓名
    { width: 20 },  // 住民英文姓名
    { width: 20 },  // 身份證字號
    { width: 12 },  // 生日
    { width: 6  },  // 性別
    { width: 8  },  // 住民年齡
    { width: 24 },  // 地址
    { width: 24 },  // 診斷
    { width: 18 },  // 緊急連絡人或家屬
    { width: 16 }   // 連絡電話
  ];

  ws.mergeCells(1, 1, 1, 13);
  const titleCell = ws.getCell('A1');
  titleCell.value = '消防用名冊';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const header = ws.addRow([
    '護理站','住民編號','床號','姓名','住民英文姓名','身份證字號','生日','性別','住民年齡',
    '地址','診斷','緊急連絡人或家屬','連絡電話'
  ]);
  styleRow(header, { isHeader: true, center: true, height: 18 });

  // header 字體：一般 8 號，住民年齡/地址/診斷 6 號
  header.eachCell((cell, colNumber) => {
    const baseFont = cell.font || {};
    const size = (colNumber === 9 || colNumber === 10 || colNumber === 11) ? 6 : 8;
    cell.font = Object.assign({}, baseFont, { size });
  });

  const rows = (cache || []).slice().sort(
    (a, b) => String(a.bedNumber || '').localeCompare(String(b.bedNumber || ''), 'zh-Hant')
  );

  for (const r of rows) {
    const age = computeAge(r.birthday);
    const row = ws.addRow([
      r.nursingStation || '',
      r.residentNumber || '',
      r.bedNumber || '',
      r.residentName || r.id || '',
      r.englishName || '',
      r.idNumber || '',
      r.birthday || '',
      r.gender || '',
      age === '' ? '' : age,
      r.address || '',
      r.diagnosis || '',
      r.emergencyContact || '',
      r.emergencyPhone || ''
    ]);
    styleRow(row, { height: 16 });

    // 內容列字體：一般 8 號，住民年齡/地址/診斷 6 號
    row.eachCell((cell, colNumber) => {
      const baseFont = cell.font || {};
      const size = (colNumber === 9 || colNumber === 10 || colNumber === 11) ? 6 : 8;
      cell.font = Object.assign({}, baseFont, { size });
    });
  }

  // 欄寬依內容自動微調，確保滿版但不過窄
  ws.columns.forEach((col, idx) => {
    let maxLength = 0;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const text = (v === undefined || v === null) ? '' : String(v);
      if (text.length > maxLength) maxLength = text.length;
    });
    // 基本寬度：字數 + 2，限制在 6 ~ 45 之間
    col.width = Math.min(Math.max(maxLength + 2, 6), 45);
  });

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 }
  };
  applyPrintFooter(ws);
})();

// ===== 樓層表（每房：房號｜床號｜姓名｜性別/年齡｜(空白)，x3；確保每列正好14格） =====
  function addFloorSheet(name, floor){
    const ws = wb.addWorksheet(name, {views:[{state:'frozen', ySplit:2}]});
    ws.columns = [
      {width:8},{width:8},{width:18},{width:12},{width:2},
      {width:10},{width:10},{width:18},{width:12},{width:2},
      {width:10},{width:10},{width:18},{width:12}
    ];

    addTitle(ws, name, 14);
    const head1 = ws.addRow(['房號','床號','姓名','性別/年齡','', '房號','床號','姓名','性別/年齡','', '房號','床號','姓名','性別/年齡']);
    styleRow(head1, {isHeader:true,height:18});
    [[1],[6],[11]].forEach(([s])=>ws.mergeCells(2,s,3,s));

    const tpl = getTpl();
    const tokens = (tpl[String(floor)]||[]).slice();
    const byRoom = {};
    tokens.forEach(tok=>{
      const m = String(tok).match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      if(!m) return;
      const room=m[1], sub=m[2].toUpperCase();
      (byRoom[room]=byRoom[room]||[]).push(sub);
    });
    const dataMap = new Map();
    (cache||[]).forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-').toUpperCase(); dataMap.set(key,r); });

    const rooms = Object.keys(byRoom).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
    let rowCursor = 4;
    let totalBeds=0, usedBeds=0;
    for(let i=0;i<rooms.length;i+=3){
      const group = rooms.slice(i, i+3);
      const lines = Math.max(...group.map(rm => (byRoom[rm]||[]).length), 0) || 1;
      for(let r=0;r<lines;r++){
        const rowCells = [];
        for(let k=0;k<3;k++){
          const rm = group[k];
          const isLast = (k===2);
          if(!rm){
            // 無此房：填滿該區塊
            rowCells.push('','','','');
            if(!isLast) rowCells.push(''); // 只有前兩房加 spacer
            continue;
          }
          const subs = byRoom[rm]||[];
          const sub = subs[r];
          // 房號列只在這組的首行顯示
          rowCells.push(r===0 ? rm : '');
          if(sub){
            totalBeds++;
            const token = `${rm}-${sub}`.toUpperCase();
            const rec = dataMap.get(token);
            if(rec) usedBeds++;
            const age = rec ? computeAge(rec.birthday) : '';
            const sexAge = rec ? ((rec.gender||'') + (age!==''?`/${age}歲`:'')) : '';
            const nameText = rec ? `${rec.id||''}${(rec.mobility||'').trim()?`（${rec.mobility.trim()}）`:''}` : '空床';
            rowCells.push(sub, nameText, sexAge);
          }else{
            rowCells.push('', '', '');
          }
          if(!isLast) rowCells.push(''); // spacer only for first & second blocks
        }
        // 確保長度為 14
        while(rowCells.length < 14) rowCells.push('');
        if(rowCells.length > 14) rowCells.length = 14;

        const row = ws.insertRow(rowCursor++, rowCells);
        styleRow(row, {alt:(rowCursor%2===0), height:18, wrap:false});
      }
      // 區隔空白行
      const sep = ws.insertRow(rowCursor++, Array(14).fill(''));
      sep.height = 6;
    }
    const emptyBeds = totalBeds - usedBeds;
    rowCursor += 1;
    const sumRow = ws.getRow(rowCursor);
    sumRow.getCell(1).value = '樓層床位數';
    sumRow.getCell(2).value = totalBeds;
    sumRow.getCell(6).value = '空床數';
    sumRow.getCell(7).value = emptyBeds;
    sumRow.getCell(11).value = '已使用床位數';
    sumRow.getCell(12).value = usedBeds;
    ;[2,7,12].forEach(ci=>{ const c=sumRow.getCell(ci); c.alignment={vertical:'middle', horizontal:'center', shrinkToFit:true}; c.numFmt='0'; });
    styleRow(sumRow, {isHeader:true, height:20});

    ws.pageSetup = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:1,
                     margins:{left:0.2,right:0.2,top:0.3,bottom:0.3,header:0.1,footer:0.1} };
                     applyPrintFooter(ws);
  }

  addFloorSheet('1樓床位配置', 1);
  addFloorSheet('2樓床位配置', 2);
  addFloorSheet('3樓床位配置', 3);
  // ===== 生命徵象紀錄表（新增兩張）=====
  function bedSortKey(bed){
    const m = String(bed||'').toUpperCase().match(/^(\d{3})[-_]?([A-Z0-9]+)?$/);
    if(!m) return 1e9;
    const room = parseInt(m[1],10);
    const subRaw = m[2]||'';
    const subNum = parseInt(String(subRaw).replace(/\D/g,''),10);
    const sub = isFinite(subNum) ? subNum : 0;
    return room*100 + sub;
  }
  function sortByBed(arr){
    return (arr||[]).slice().sort((a,b)=>bedSortKey(a.bedNumber)-bedSortKey(b.bedNumber));
  }
  function addVitalSheet_1F3F(){
    const ws = wb.addWorksheet('生命徵象(1+3)', {views:[{state:'frozen', ySplit:3}]});

    // 版面：直式、盡量滿版（左右兩欄各最多 27 筆）
    ws.columns = [
      // 左半
      {width:4.0},{width:8.2},{width:12.4},{width:6.0},{width:6.0},{width:6.0},{width:8.6},{width:6.6},
      // 中線
      {width:0.4},
      // 右半
      {width:4.0},{width:8.2},{width:12.4},{width:6.0},{width:6.0},{width:6.0},{width:8.6},{width:6.6}
    ];

    // 民國日期字串（避免日期欄寬太窄顯示 ####）
    function rocDateStr(d){
      const y = d.getFullYear() - 1911;
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${y}/${m}/${dd}`;
    }
    const exportDate = new Date();
    const exportRoc = rocDateStr(exportDate);

    const headers = ['編號','房號','姓名','體溫','心跳','呼吸','血壓','SPO2'];

    const thin = {style:'thin', color:{argb:'FF9E9E9E'}};
    const medium = {style:'medium', color:{argb:'FF000000'}};

    function cellBorderFor(col, rowNum, headerRowNum, lastDataRowNum){
      // 左表：1..8；中線：9；右表：10..17
      const inLeft = (col>=1 && col<=8);
      const inRight = (col>=10 && col<=17);
      const isHeader = (rowNum===headerRowNum);

      // spacer 做中線：左右加粗
      if(col===9){
        return { left: medium, right: medium, top: thin, bottom: thin };
      }

      // 外框加粗（左右各自一個表格）
      const isTop = isHeader;
      const isBottom = (rowNum===lastDataRowNum);

      if(inLeft){
        return {
          top: isTop ? medium : thin,
          bottom: isBottom ? medium : thin,
          left: (col===1) ? medium : thin,
          right: (col===8) ? medium : thin
        };
      }
      if(inRight){
        return {
          top: isTop ? medium : thin,
          bottom: isBottom ? medium : thin,
          left: (col===10) ? medium : thin,
          right: (col===17) ? medium : thin
        };
      }
      return {top:thin,left:thin,right:thin,bottom:thin};
    }

    function applyGridStyle(row, headerRowNum, lastDataRowNum){
      row.eachCell({includeEmpty:true}, (cell, colNumber)=>{
        if(colNumber===9){
          cell.value = cell.value || '';
          cell.fill = null;
          cell.alignment = { vertical:'middle', horizontal:'center' };
          cell.border = cellBorderFor(colNumber, row.number, headerRowNum, lastDataRowNum);
          return;
        }
        cell.font = { name:'DFKai-SB', size:12, bold:(row.number===headerRowNum) };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:false, shrinkToFit:true };
        cell.border = cellBorderFor(colNumber, row.number, headerRowNum, lastDataRowNum);
        if(row.number===headerRowNum){
          cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
        }
      });
    }

    function buildHeaderRow(){
      const rowCells = [];
      headers.forEach(h=>rowCells.push(h));
      rowCells.push('');
      headers.forEach(h=>rowCells.push(h));
      return rowCells;
    }

    function setRowHeightExceptTitle(rn, h){
      if(rn===1) return; // 大標題列不改
      ws.getRow(rn).height = h;
    }

    // 資料（不截斷，改為多頁）
    const f1All = sortByBed((cache||[]).filter(r=> /^1\d\d/.test(String(r.bedNumber||'')) ));
    const f3All = sortByBed((cache||[]).filter(r=> /^3\d\d/.test(String(r.bedNumber||'')) ));

    const PAGE_SIZE = 27;
    const pages = Math.max(Math.ceil(f1All.length / PAGE_SIZE), Math.ceil(f3All.length / PAGE_SIZE), 1);

    // 每頁區塊高度：title + labels + header + 27 data = 30
    const BLOCK_ROWS = 1 + 1 + 1 + PAGE_SIZE;

    for(let p=0; p<pages; p++){
      const startRow = 1 + p*BLOCK_ROWS;

      // ---- Title ----
      ws.mergeCells(startRow,1,startRow,17);
      const t = ws.getCell(startRow,1);
      t.value = '安泰護理之家住民生命跡象紀錄表';
      t.font = { name:'DFKai-SB', bold:true, size:18 };
      t.alignment = { vertical:'middle', horizontal:'center' };
      ws.getRow(startRow).height = 24.6;

      // ---- Labels + Date (merge P:Q to avoid ####) ----
      ws.mergeCells(startRow+1,1,startRow+1,8);   // A..H
      ws.mergeCells(startRow+1,10,startRow+1,15); // J..O
      ws.mergeCells(startRow+1,16,startRow+1,17); // P..Q

      ws.getCell(startRow+1,1).value = '1F護理站';
      ws.getCell(startRow+1,10).value = '3F護理站';
      ws.getCell(startRow+1,16).value = `日期  ${exportRoc}`;

      [ws.getCell(startRow+1,1), ws.getCell(startRow+1,10), ws.getCell(startRow+1,16)].forEach((c,idx)=>{
        c.font = { name:'DFKai-SB', size:12, bold:true };
        c.alignment = { vertical:'middle', horizontal: idx===2 ? 'right' : 'center' };
      });

      // ---- Header row ----
      const headerRowNum = startRow+2;
      const hRow = ws.getRow(headerRowNum);
      hRow.values = buildHeaderRow();
      // row.values 會把 index 0 留空，因此補齊
      if(!hRow.getCell(1).value) {
        // 如果 values 沒成功，改用 addRow 的方式
        //（保險用）
      }
      hRow.height = 30;
      // 套樣式（header）
      const lastDataRowNum = startRow+2+PAGE_SIZE;
      applyGridStyle(hRow, headerRowNum, lastDataRowNum);

      // ---- Data rows (fixed 27) ----
      const f1 = f1All.slice(p*PAGE_SIZE, p*PAGE_SIZE + PAGE_SIZE);
      const f3 = f3All.slice(p*PAGE_SIZE, p*PAGE_SIZE + PAGE_SIZE);

      for(let i=0;i<PAGE_SIZE;i++){
        const L = f1[i];
        const R = f3[i];
        const rowNum = startRow+3+i;
        const row = ws.getRow(rowNum);
        row.values = [
          (i+1),
          L ? (String(L.bedNumber||'').replace('_','-').toUpperCase()) : '',
          L ? (L.id||'') : '',
          '', '', '', '', '',
          '',
          (i+1),
          R ? (String(R.bedNumber||'').replace('_','-').toUpperCase()) : '',
          R ? (R.id||'') : '',
          '', '', '', '', ''
        ];
        row.height = 30;
        applyGridStyle(row, headerRowNum, lastDataRowNum);
      }

      // 其餘列高（labels 那列）
      setRowHeightExceptTitle(startRow+1, 30);

      // 讓下一頁真的斷頁：在下一個 startRow 前插入「手動分頁」(列印預覽會確實分頁)
      if(p < pages-1){
        // 斷在這一頁最後一列（也就是下一頁 title 的上一列），
        // 才不會讓下一頁的標題被擠到前一頁底部
        const breakAt = startRow + BLOCK_ROWS - 1; // 這一頁最後一列
        try{ ws.getRow(breakAt).addPageBreak(); }catch(e){}
        try{ if(ws.rowBreaks && ws.rowBreaks.add) ws.rowBreaks.add(breakAt); }catch(e){}
      }
    }

    // 列印設定：不要壓縮成一頁
    ws.sheetProperties = ws.sheetProperties || {};
    ws.sheetProperties.pageSetUpPr = ws.sheetProperties.pageSetUpPr || {};
    ws.sheetProperties.pageSetUpPr.autoPageBreaks = true;

    // 列印設定：不要把內容縮成同一頁，交給手動分頁與自然分頁
    ws.pageSetup = {
      paperSize:9,
      orientation:'portrait',
      fitToPage:true,
      fitToWidth:1,
      fitToHeight:0,
      horizontalCentered:true,
      margins:{left:0.12,right:0.12,top:0.15,bottom:0.15,header:0.05,footer:0.05}
    };
    applyPrintFooter(ws);
  }

  function addVitalSheet_2F(){
    const ws = wb.addWorksheet('生命徵象(2F)', {views:[{state:'frozen', ySplit:3}]});
    // 2F 住民較多：採左右兩欄各 27（共 54）仍固定單頁
    ws.columns = [
      {width:4.2},{width:8.6},{width:13.8},{width:6.4},{width:6.4},{width:6.4},{width:9.2},{width:7.5},
      {width:0.4},
      {width:4.2},{width:8.6},{width:13.8},{width:6.4},{width:6.4},{width:6.4},{width:9.2},{width:7.5}
    ];

    function rocDateStr(d){
      const y = d.getFullYear() - 1911;
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${y}/${m}/${dd}`;
    }
    const exportDate = new Date();
    const exportRoc = rocDateStr(exportDate);

    ws.mergeCells(1,1,1,17);
    const t = ws.getCell(1,1);
    t.value = '安泰護理之家住民生命跡象紀錄表';
    t.font = { name:'DFKai-SB', bold:true, size:18 };
    t.alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(1).height = 24.6;

    // 標題列（同樣盡量滿版 + 右上日期；改合併 P:Q 避免 ####）
    ws.mergeCells('A2:H2');
    ws.mergeCells('P2:Q2');
    ws.getCell('A2').value = '2F護理站';
    ws.getCell('P2').value = `日期  ${exportRoc}`;

    ['A2','P2'].forEach(addr=>{
      const c = ws.getCell(addr);
      c.font = { name:'DFKai-SB', size:12, bold:true };
      c.alignment = { vertical:'middle', horizontal: addr==='P2' ? 'right' : 'center' };
    });

    const headers = ['編號','房號','姓名','體溫','心跳','呼吸','血壓','SPO2'];
    const row3 = [];
    headers.forEach(h=>row3.push(h));
    row3.push('');
    headers.forEach(h=>row3.push(h)); // 右半保留（空白）
    const hRow = ws.addRow(row3);
    hRow.height = 30;

    const thin = {style:'thin', color:{argb:'FF9E9E9E'}};
    const medium = {style:'medium', color:{argb:'FF000000'}};

    function cellBorderFor(col, rowNum){
      if(col===9) return { left: medium, right: medium, top: thin, bottom: thin };
      const isTop = (rowNum===3);
      const isBottom = (rowNum===3+27);
      if(col>=1 && col<=8){
        return { top:isTop?medium:thin, bottom:isBottom?medium:thin, left:(col===1)?medium:thin, right:(col===8)?medium:thin };
      }
      if(col>=10 && col<=17){
        return { top:isTop?medium:thin, bottom:isBottom?medium:thin, left:(col===10)?medium:thin, right:(col===17)?medium:thin };
      }
      return {top:thin,left:thin,right:thin,bottom:thin};
    }
    function applyGridStyle(r){
      r.eachCell({includeEmpty:true}, (cell, colNumber)=>{
        if(colNumber===9){
          cell.value = cell.value || '';
          cell.fill = null;
          cell.alignment = { vertical:'middle', horizontal:'center' };
          cell.border = cellBorderFor(colNumber, r.number);
          return;
        }
        cell.font = { name:'DFKai-SB', size:12, bold:(r.number===3) };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:false, shrinkToFit:true };
        cell.border = cellBorderFor(colNumber, r.number);
        if(r.number===3){
          cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
        }
      });
    }
    applyGridStyle(hRow);

    const f2 = sortByBed((cache||[]).filter(r=> /^2\d\d/.test(String(r.bedNumber||'')) ));
    const left = f2.slice(0,27);
    const right = f2.slice(27,54);
    for(let i=0;i<27;i++){
      const L = left[i];
      const R = right[i];
      const row = ws.addRow([
        (i+1), L ? (String(L.bedNumber||'').replace('_','-').toUpperCase()) : '', L ? (L.id||'') : '', '', '', '', '', '',
        '',
        (27+i+1), R ? (String(R.bedNumber||'').replace('_','-').toUpperCase()) : '', R ? (R.id||'') : '', '', '', '', '', ''
      ]);
      row.height = 30;
      applyGridStyle(row);
    }
    ws.getRow(2).height = 30;

    ws.sheetProperties = ws.sheetProperties || {};
    ws.sheetProperties.pageSetUpPr = ws.sheetProperties.pageSetUpPr || {};
    ws.sheetProperties.pageSetUpPr.fitToPage = true;
    ws.sheetProperties.pageSetUpPr.autoPageBreaks = true;

    ws.pageSetup = { paperSize:9, orientation:'portrait', fitToPage:true, fitToWidth:1, fitToHeight:1,
                     horizontalCentered:true,
                     margins:{left:0.12,right:0.12,top:0.15,bottom:0.15,header:0.05,footer:0.05} };
                     applyPrintFooter(ws);
  }

  // ===== 各樓層人數統計 =====
  
const __RECALL_ROSTER = {"護理師": [{"序": "1", "職稱": "主任", "姓名": "林淑菁", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0970-101931", "電話": ""}, {"序": "2", "職稱": "護理師", "姓名": "徐雅婷", "居住地": "屏東縣崁頂鄉", "召回時間": "崁頂10分鐘", "召回順序": "1", "手機": "0955-339578", "電話": ""}, {"序": "3", "職稱": "護理師", "姓名": "蔡明芳", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0921-209188", "電話": ""}, {"序": "4", "職稱": "護理師", "姓名": "陳明志", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0980-898405", "電話": ""}, {"序": "5", "職稱": "護理師", "姓名": "張振達", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0909-393746", "電話": ""}, {"序": "6", "職稱": "護理師", "姓名": "蘇盈瑜", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0909-218180", "電話": ""}, {"序": "7", "職稱": "護理師", "姓名": "鍾旻珎", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0979-858130", "電話": ""}, {"序": "8", "職稱": "護理師", "姓名": "楊棠喻", "居住地": "屏東縣新園鄉", "召回時間": "新園30分鐘", "召回順序": "2", "手機": "0908-631007", "電話": ""}, {"序": "9", "職稱": "護理師", "姓名": "鄭婷方", "居住地": "屏東縣新園鄉", "召回時間": "新園30分鐘", "召回順序": "2", "手機": "0925-049861", "電話": ""}, {"序": "10", "職稱": "護理師", "姓名": "陳心怡", "居住地": "屏東縣新園鄉", "召回時間": "新園30分鐘", "召回順序": "2", "手機": "0903-796507", "電話": ""}, {"序": "11", "職稱": "護士", "姓名": "陳盈如", "居住地": "屏東縣新園鄉", "召回時間": "新園30分鐘", "召回順序": "2", "手機": "0980-810404", "電話": ""}, {"序": "12", "職稱": "護理師", "姓名": "王英瓊", "居住地": "屏東縣佳冬鄉", "召回時間": "佳冬30分鐘", "召回順序": "2", "手機": "0929-173317", "電話": ""}, {"序": "13", "職稱": "護理師", "姓名": "呂侖珉", "居住地": "屏東縣佳冬鄉", "召回時間": "佳冬30分鐘", "召回順序": "2", "手機": "0907-618080", "電話": ""}, {"序": "14", "職稱": "護理師", "姓名": "賴奕瑾", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0909-393746", "電話": ""}], "外籍照服員": [{"序": "1", "職稱": "照服員", "姓名": "安ANN", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0902-289604", "電話": "08-8635508"}, {"序": "2", "職稱": "照服員", "姓名": "瑪莉露Marilu", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0973-243350", "電話": "08-8635508"}, {"序": "3", "職稱": "照服員", "姓名": "保羅JP", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0968-606187", "電話": "08-8635508"}, {"序": "4", "職稱": "照服員", "姓名": "梅洛琳Merilyn", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0958-890539", "電話": "08-8635508"}, {"序": "5", "職稱": "照服員", "姓名": "喬德Jeodel", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0975-953048", "電話": "08-8635508"}, {"序": "6", "職稱": "照服員", "姓名": "羅德Reodel", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "", "電話": "08-8635508"}, {"序": "7", "職稱": "照服員", "姓名": "莉塔Merlita", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0916-133541", "電話": "08-8635508"}, {"序": "8", "職稱": "照服員", "姓名": "德莎Asa", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0916-132342", "電話": "08-8635508"}, {"序": "9", "職稱": "照服員", "姓名": "米妮Jasmin", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0966-191444", "電話": "08-8635508"}, {"序": "10", "職稱": "照服員", "姓名": "洛雅Rhea", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0907-623767", "電話": "08-8635508"}, {"序": "11", "職稱": "照服員", "姓名": "伊娃EVA", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0971-033180", "電話": "08-8635508"}, {"序": "12", "職稱": "照服員", "姓名": "捷克琳Jacklyn", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0928-529374", "電話": "08-8635508"}, {"序": "13", "職稱": "照服員", "姓名": "吉娜Gina", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0979-404607", "電話": "08-8635508"}, {"序": "14", "職稱": "照服員", "姓名": "瑞雪SHY", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0968-652140", "電話": "08-8635508"}, {"序": "15", "職稱": "照服員", "姓名": "艾倫Irene", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "0948-085763", "電話": "08-8635508"}, {"序": "16", "職稱": "照服員", "姓名": "大利Darryl", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "", "電話": "08-8635508"}, {"序": "17", "職稱": "照服員", "姓名": "克汀娜Tina", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "", "電話": "08-8635508"}, {"序": "18", "職稱": "照服員", "姓名": "奈娜Nena", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "", "電話": "08-8635508"}, {"序": "19", "職稱": "照服員", "姓名": "美琳Amy", "居住地": "外籍看護工", "召回時間": "宿舍5分鐘", "召回順序": "1", "手機": "", "電話": "08-8635508"}], "台籍照服員": [{"序": "1", "職稱": "照服員", "姓名": "石碧瑤", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0933-686674", "電話": ""}, {"序": "2", "職稱": "照服員", "姓名": "張瓊文", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0958-771397", "電話": ""}, {"序": "3", "職稱": "照服員", "姓名": "潘佩君", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0903-399429", "電話": ""}, {"序": "4", "職稱": "照服員", "姓名": "呂麗雯", "居住地": "屏東縣屏東市", "召回時間": "屏東45分鐘", "召回順序": "2", "手機": "0963-223771", "電話": ""}, {"序": "5", "職稱": "照服員", "姓名": "宋來富", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0935-401138", "電話": ""}, {"序": "6", "職稱": "照服員", "姓名": "胡志偉", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0927-556382", "電話": ""}, {"序": "7", "職稱": "照服員", "姓名": "曾宥溱", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0978-587025", "電話": ""}, {"序": "8", "職稱": "照服員", "姓名": "張邑涵", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0961-101137", "電話": ""}, {"序": "9", "職稱": "照服員", "姓名": "涂展源", "居住地": "屏東縣潮州鎮", "召回時間": "潮州20分鐘", "召回順序": "1", "手機": "0932-781372", "電話": ""}, {"序": "10", "職稱": "照服員", "姓名": "張修禎", "居住地": "屏東縣崁頂鄉", "召回時間": "崁頂10分鐘", "召回順序": "1", "手機": "0952-792099", "電話": ""}], "其他": [{"序": "1", "職稱": "社工師", "姓名": "李麗鳳", "居住地": "屏東縣東港鎮", "召回時間": "東港20分鐘", "召回順序": "1", "手機": "0928-152698", "電話": ""}, {"序": "2", "職稱": "司機", "姓名": "余志騰", "居住地": "屏東縣林邊鄉", "召回時間": "林邊30分鐘", "召回順序": "2", "手機": "0956-143876", "電話": ""}]};
(function addPeopleStats(){
    const ws = wb.addWorksheet('各樓層人數統計', {views:[{state:'frozen', ySplit:1}]});
    ws.columns = [{width:20},{width:46},{width:20},{width:20},{width:28},{width:12},{width:22}];
    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = '各樓層人數統計';
    ws.getCell('A1').font = { ...fontTitle, size:28 };
    ws.getCell('A1').alignment = {horizontal:'center', vertical:'middle'};
    ws.getRow(1).height = 43;
    const header = ws.addRow(['樓層','活動能力區分','請假人數','實到人數','住民總人數合計','','']);
    styleRow(header,{isHeader:true,center:true,height:54});
    header.eachCell(cell=>{
      cell.font = { ...(cell.font||{}), size:15 };
    });

    // 只用 leaveStatus 判斷：只要不是「住院」且欄位有值，一律視為請假
    function getStatus(r){
      const raw = ((r.leaveStatus||'')+'').replace(/\s/g,'');
      if (!raw) return 'present';
      if (raw.includes('住院')) return 'hospital';
      return 'leave';
    }

    const floors = {'1':[],'2':[],'3':[]};
    (cache||[]).forEach(r=>{
      const bed = String(r.bedNumber||''); const m=bed.match(/^(\d{3})[-_]/);
      const fl = m?m[1][0]:null;
      if(fl && floors[fl]) floors[fl].push(r);
    });

    function sumFloor(list){
      let leave=0, hosp=0, present=0;
      list.forEach(r=>{
        const s = getStatus(r);
        if(s==='leave') leave++;
        else if(s==='hospital') { hosp++; } // 住院不算請假，且不計入實到
        else present++;
      });
      return {leave, hosp, present, total:list.length};
    }
    // 活動能力只算「非請假」（present + hospital）
    function abilityCountExcludeLeave(list){
      const acc = {wheel:0,push:0,walk:0};
      list.forEach(r=>{
        const s = getStatus(r);
        if (s !== 'present') return; // 只計算未請假且未住院
        const a = (r.mobility||r.ability||'').trim();
        if(a.includes('輪椅')) acc.wheel++;
        else if(a.includes('推')) acc.push++;
        else if(a.includes('步')) acc.walk++;
      });
      return acc;
    }

    let sumLeave=0,sumPresent=0,sumTotal=0;
    let abilityStrings = [];
    ['1','2','3'].forEach(fl=>{
      const acc = sumFloor(floors[fl]);
      const ab  = abilityCountExcludeLeave(floors[fl]); // 只算沒請假的
      const leaveCombined = acc.leave + acc.hosp; // Excel 欄位：請假=請假+住院
      sumLeave += leaveCombined; sumPresent += (acc.total - leaveCombined);
      sumTotal += acc.total;
      const abilityText = `步行：${ab.walk} 人　輪椅：${ab.wheel} 人　推床：${ab.push} 人`;
      abilityStrings.push(abilityText);
      const row = ws.addRow([`${fl}樓`, abilityText, leaveCombined, (acc.total - leaveCombined), acc.total, '', '']);
      styleRow(row,{center:true,height:54});
      row.eachCell(cell => {
        cell.font = { ...(cell.font || {}), size: 15 };
      });
    });

    const totalAbilityText = `步行：${abilityCountExcludeLeave(cache).walk} 人　輪椅：${abilityCountExcludeLeave(cache).wheel} 人　推床：${abilityCountExcludeLeave(cache).push} 人`;
    const totalRow = ws.addRow(['總計', totalAbilityText, sumLeave, sumPresent, sumTotal, '', '']);
    styleRow(totalRow,{isHeader:true,center:true});
    ws.getRow(totalRow.number).height = 54;
    totalRow.eachCell(cell => {
      cell.font = { ...(cell.font || {}), size: 15 };
    });
  
    ws.getCell(`C${totalRow.number}`).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFF00'}};
    ws.getCell(`D${totalRow.number}`).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2F80ED'}};
    ws.mergeCells(`F${totalRow.number+1}:G${totalRow.number+1}`);
    const badge = ws.getCell(`F${totalRow.number+1}`);
    badge.value = sumPresent;
    badge.font = {name:'Microsoft JhengHei', size:36, bold:true};
    badge.alignment = {horizontal:'center', vertical:'middle'};
    badge.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFB7E1CD'}};
    ws.getCell(`E${totalRow.number+1}`).value = '實到';
    ws.getCell(`E${totalRow.number+1}`).alignment = {horizontal:'center', vertical:'middle'};

    // 備註
    ws.mergeCells(`A${totalRow.number+2}:G${totalRow.number+2}`);
    ws.getCell(`A${totalRow.number+2}`).value = '1.本機構共4層，1至3樓為住民層，4樓是宿舍；住民實到人數';
    ws.getCell(`A${totalRow.number+2}`).font = { name:'Microsoft JhengHei', size:16 };
    ws.getRow(totalRow.number+2).height = 28;
    ws.mergeCells(`A${totalRow.number+3}:G${totalRow.number+3}`);
    ws.getCell(`A${totalRow.number+3}`).value = '2.起火房為___房，與其共通房，共__位住民，已全數離室避難，沒有人受困。';
    ws.getCell(`A${totalRow.number+3}`).font = { name:'Microsoft JhengHei', size:16 };
    ws.getRow(totalRow.number+3).height = 28;

    // 自動調整第 2 欄（活動能力區分）欄寬
    const maxLen = Math.max('活動能力區分'.length, ...abilityStrings.map(s=>s.length));
    // CJK 字寬較大，乘以 2 作保守估算，限制 28~60
    ws.getColumn(2).width = Math.max(40, Math.min(80, Math.ceil(maxLen * 2.4)));
    ws.getColumn(2).alignment = { vertical:'middle', horizontal:'left', wrapText:false };

    ws.pageSetup = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:1,
                     horizontalCentered:true, verticalCentered:false,
                     margins:{left:0.15,right:0.15,top:0.15,bottom:0.15,header:0.05,footer:0.05} };
                     applyPrintFooter(ws);
})()

  // ===== 生命徵象（直式、各 1 頁）===== 
  addVitalSheet_1F3F();
  addVitalSheet_2F();
;
  // ===== 緊急召回名單（依名冊固定內容，不抓資料庫）=====
;  (function addRecallRosterSheets(){
    const roster = (typeof __RECALL_ROSTER !== 'undefined') ? __RECALL_ROSTER : {};
    function cleanOrder(v){
      if(!v) return '';
      // 移除 Word 內特殊符號（如  / ）
      return String(v).replace(/[\uF000-\uF8FF]/g,'').trim();
    }
    function addRecallSheet(sheetName, rows){
      const ws = wb.addWorksheet(sheetName, {views:[{state:'frozen', ySplit:2}]});
      ws.pageSetup = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0,
                       horizontalCentered:true,
                       margins:{left:0.1,right:0.1,top:0.15,bottom:0.15,header:0.05,footer:0.05} };
                       applyPrintFooter(ws);
      ws.columns = [
        {header:'序號', key:'no', width:13.25},
        {header:'職稱', key:'title', width:13.25},
        {header:'姓名', key:'name', width:13.25},
        {header:'居住地', key:'addr', width:21.38},
        {header:'召回時間', key:'time', width:21.38},
        {header:'召回順序', key:'order', width:21.38},
        {header:'手機', key:'mobile', width:21.38},
        {header:'電話', key:'phone', width:21.38}
      ];

      // Title
      ws.mergeCells('A1:H1');
      ws.getCell('A1').value = '安泰醫療社團法人附設安泰護理之家 緊急召回名單';
      ws.getCell('A1').font = fontTitle;
      ws.getCell('A1').alignment = {horizontal:'center', vertical:'middle'};
      ws.getRow(1).height = 24;

      // Header row (row 2)
      const headerRow = ws.getRow(2);
      headerRow.values = ['序號','職稱','姓名','居住地','召回時間','召回順序','手機','電話'];
      styleRow(headerRow, {isHeader:true, center:true, height:20, wrap:true});

      // Data rows
      const list = Array.isArray(rows) ? rows : [];
      list.forEach((r, idx)=>{
        // Section separator row (for combining groups)
        if (r && r.__section) {
          const rr = ws.addRow([r.__section, '', '', '', '', '', '', '']);
          ws.mergeCells(`A${rr.number}:H${rr.number}`);
          rr.getCell(1).font = {name:'Microsoft JhengHei', size:12, bold:true};
          rr.getCell(1).alignment = {horizontal:'left', vertical:'middle'};
          rr.height = 20;
          rr.getCell(1).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
          // border for merged row
          for (let c = 1; c <= 8; c++) {
            rr.getCell(c).border = {
              top: {style:'thin'},
              left: {style:'thin'},
              bottom: {style:'thin'},
              right: {style:'thin'}
            };
          }
          return;
        }
        const row = ws.addRow([
          r['序'] || (idx+1),
          r['職稱'] || '',
          r['姓名'] || '',
          r['居住地'] || '',
          r['召回時間'] || '',
          cleanOrder(r['召回順序'] || ''),
          r['手機'] || '',
          r['電話'] || ''
        ]);
        // alternating fill
        styleRow(row, {alt: (idx%2===1), center:true, height:18, wrap:true});
        // left align for address/time if you want: keep center for一致
      });

      // Set borders for all used cells (styleRow handles each cell already)
            // 統一列高
      ws.eachRow({ includeEmpty: false }, (r)=>{ r.height = 26; });

      ws.autoFilter = { from: 'A2', to: 'H2' };
    }

    addRecallSheet('召回名冊-護理師', roster['護理師'] || []);
    addRecallSheet('召回名冊-外籍照服員', roster['外籍照服員'] || []);
    const tai = roster['台籍照服員'] || [];
    const other = roster['其他'] || [];
    const taiOther = [...tai, {__section:'其他'}, ...other];
    addRecallSheet('召回名冊-台籍+其他', taiOther);
  })();
;



  // ===== 照服員名冊（外籍・未離職）===== 
  await (async function addCaregiverRosterSheet(){
    try{
      const ws = wb.addWorksheet('照服員名冊(外籍)', {views:[{state:'frozen', ySplit:2}]});

      // columns
      ws.columns = [
        {header:'#', key:'no', width:50},
        {header:'姓名', key:'name', width:50},
        {header:'狀態', key:'status', width:50}
      ];

      // Title
      ws.mergeCells('A1:C1');
      const titleCell = ws.getCell('A1');
      titleCell.value = '照服員名冊（外籍・未離職）';
      titleCell.font = { name:'Microsoft JhengHei', bold:true, size:14, color:{argb:'FFFFFFFF'} };
      titleCell.alignment = { horizontal:'left', vertical:'middle' };
      titleCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF4CAF50'} };
      ws.getRow(1).height = 26;

      // Header row
      const headerRow = ws.getRow(2);
      headerRow.values = ['#','姓名','狀態'];
      styleRow(headerRow, {isHeader:true, center:true, height:26, wrap:false});

      // ===== 取得員工（caregivers）=====
      let employees = [];
      try{
        const snap = await db.collection('caregivers').orderBy('sortOrder','asc').get();
        snap.forEach(doc=>{
          const d = doc.data() || {};
          if (d.isActive === false) return;
          employees.push({ id: doc.id, name: d.name || doc.id });
        });
      }catch(e){
        console.warn('讀取 caregivers 失敗，改用不排序讀取', e);
        const snap = await db.collection('caregivers').get();
        snap.forEach(doc=>{
          const d = doc.data() || {};
          if (d.isActive === false) return;
          employees.push({ id: doc.id, name: d.name || doc.id });
        });
      }
      employees.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'zh-Hant'));

      // ===== 取得今日外宿名單（核准且涵蓋今日）=====
      function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0); }
      function endOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999); }
      const today = new Date();
      const dayStart = startOfDay(today);
      const dayEnd = endOfDay(today);

      const outSet = new Set();
      try{
        let snap = null;
        try{
          if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.Timestamp) {
            snap = await db.collection('stayApplications')
              .where('statusId','==','approved')
              .where('endDateTime','>=', firebase.firestore.Timestamp.fromDate(dayStart))
              .orderBy('endDateTime','asc')
              .get();
          } else {
            // no Timestamp: fallback
            snap = await db.collection('stayApplications')
              .where('statusId','==','approved')
              .get();
          }
        }catch(e){
          console.warn('名冊狀態判定查詢失敗，改用備援抓取核准單：', e);
          snap = await db.collection('stayApplications')
            .where('statusId','==','approved')
            .get();
        }
        snap.forEach(doc=>{
          const d = doc.data() || {};
          const s = d.startDateTime?.toDate ? d.startDateTime.toDate() : null;
          const e = d.endDateTime?.toDate ? d.endDateTime.toDate() : null;
          if (!s || !e) return;
          if (s <= dayEnd && e >= dayStart) {
            if (d.applicantId) outSet.add(d.applicantId);
          }
        });
      }catch(e){
        console.warn('抓取 stayApplications 失敗（照服員名冊狀態可能不準）', e);
      }

      // rows
      if (!employees.length){
        const r = ws.addRow([1,'目前沒有在職的外籍照服員','']);
        styleRow(r, {alt:false, center:false, height:26});
      } else {
        employees.forEach((emp, i)=>{
          const isOut = outSet.has(emp.id);
          const statusText = isOut ? '外宿中' : '於宿舍';
          const row = ws.addRow([i+1, emp.name || '', statusText]);
          styleRow(row, {alt:(i%2===1), center:true, height:26});

          // status cell badge-like fill
          const sc = row.getCell(3);
          sc.font = { name:'Microsoft JhengHei', bold:true, size:11, color:{argb:'FFFFFFFF'} };
          sc.alignment = { vertical:'middle', horizontal:'center' };
          sc.fill = { type:'pattern', pattern:'solid', fgColor:{argb: isOut ? 'FFF59E0B' : 'FF16A34A'} };
        });
      }
      // 統一列高 26、欄寬 50
      try{
        ws.columns.forEach(c=>{ c.width = 50; });
        ws.eachRow({ includeEmpty: true }, (row)=>{ row.height = 26; });
      }catch(_e){}

      ws.autoFilter = { from: 'A2', to: 'C2' };
      ws.pageSetup = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0,
                       horizontalCentered:true,
                       margins:{left:0.2,right:0.2,top:0.25,bottom:0.25,header:0.1,footer:0.1} };
                       applyPrintFooter(ws);
    }catch(e){
      console.warn('匯出時建立「照服員名冊」分頁失敗：', e);
    }
  })();

  // ===== 下載 =====
  const blob = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([blob], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = `床位配置與總人數統計_${formatDate(new Date(), '-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);

  })().catch(err=>{ console.error(err); alert('匯出失敗：'+(err&&err.message?err.message:err)); }).finally(()=>{
    window.__exportingXls = false;
    try{ var b=document.getElementById('btnExportXls'); if(b){ b.disabled=false; if(b.dataset && b.dataset.idleText){ b.innerText=b.dataset.idleText; } } }catch(e){}
  });
}

    function hookEvents(){
    document.addEventListener('click', (e)=>{
      const t=e.target;
      if(t.closest('#export-xls-styled')) exportStyledXls();
      if(t.closest('#print-headcards')) openHeadcardDialog();
    });
  }

  // ===== 住院狀態：提醒未結案的導尿管單張 =====
  const foleyAlertModalEl = document.getElementById('foley-alert-modal');
  const foleyAlertSummaryEl = document.getElementById('foley-alert-summary');
  const foleyAlertListEl = document.getElementById('foley-alert-list');
  let foleyAlertModal = null;
  if (window.bootstrap && foleyAlertModalEl) {
    foleyAlertModal = new bootstrap.Modal(foleyAlertModalEl);
  }

  function showTopNotice(message, level='info'){
    try{
      if (typeof importStatus !== 'undefined' && importStatus) {
        importStatus.className = `alert alert-${level}`;
        importStatus.classList.remove('d-none');
        importStatus.style.whiteSpace = 'pre-line';
        importStatus.textContent = message;
      } else {
        alert(message);
      }
    }catch(_e){
      alert(message);
    }
  }

  function renderFoleyAlertModal(hits){
    if (!foleyAlertSummaryEl || !foleyAlertListEl || !Array.isArray(hits) || !hits.length) return;

    if (hits.length === 1) {
      const one = hits[0];
      const bed = one.bedNumber || '';
      const name = one.residentName || one.id || '';
      foleyAlertSummaryEl.textContent = `目前共有 1 位住院住民仍有未結案導尿管單張。`;
      foleyAlertListEl.innerHTML = `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold">${bed} ${name}</div>
            <div class="text-muted small">請前往導尿管系統確認是否需要結案。</div>
          </div>
          <span class="badge text-bg-warning">未結案</span>
        </div>`;
      return;
    }

    foleyAlertSummaryEl.textContent = `目前共有 ${hits.length} 位住院住民仍有未結案導尿管單張。`;
    foleyAlertListEl.innerHTML = hits.map(r=>{
      const bed = r.bedNumber || '';
      const name = r.residentName || r.id || '';
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold">${bed} ${name}</div>
            <div class="text-muted small">請前往導尿管系統確認是否需要結案。</div>
          </div>
          <span class="badge text-bg-warning">未結案</span>
        </div>`;
    }).join('');
  }

  function maybeShowFoleyAlertModal(hits){
    if (!foleyAlertModal || !Array.isArray(hits) || !hits.length) return;
    try {
      renderFoleyAlertModal(hits);
      setTimeout(() => { foleyAlertModal.show(); }, 250);
    } catch (_e) {
      try {
        renderFoleyAlertModal(hits);
        setTimeout(() => { foleyAlertModal.show(); }, 250);
      } catch(__e) {}
    }
  }

  async function notifyHospitalizedOngoingFoley(){
    try{
      // 只檢查「住院」住民
      const hospitalized = (Array.isArray(cache) ? cache : []).filter(r=>{
        const s = (typeof normalizeLeaveStatus === 'function') ? (normalizeLeaveStatus(r) || '') : (r?.leaveStatus || '');
        return String(s).includes('住院');
      });
      if(!hospitalized.length) return;

      // 一次抓出所有「未結案」導尿管照護單，避免對每位住民各查一次
      const snap = await db.collection('foley_care_records').where('closingDate', '==', null).get();
      if(snap.empty) return;

      const ongoingResidentKeys = new Set();
      snap.forEach(doc=>{
        const d = doc.data() || {};
        [d.residentName, d.residentNumber, d.residentId, d.id, d.idNumber].forEach(v=>{
          const key = String(v || '').trim();
          if(key) ongoingResidentKeys.add(key);
        });
      });

      const hits = hospitalized.filter(r=>{
        const keys = [r.id, r.residentName, r.residentNumber, r.idNumber].map(v=>String(v || '').trim()).filter(Boolean);
        return keys.some(k=> ongoingResidentKeys.has(k));
      });
      if(!hits.length) return;

      if(hits.length === 1){
        const one = hits[0];
        const name = one.residentName || one.id || '';
        showTopNotice(`檢查到 ${name} 住民住院中但仍有進行中的「導尿管單張」，請記得結案該住民的「導尿管單張」。`, 'warning');
      }else{
        const lines = hits.map(r=>{
          const bed = r.bedNumber || '';
          const name = r.residentName || r.id || '';
          return `- ${bed} ${name}`.trim();
        }).join('\n');
        showTopNotice(`檢查到以下住民仍有進行中的導尿管單張（目前為住院狀態），請記得結案：\n${lines}`, 'warning');
      }

      maybeShowFoleyAlertModal(hits);
    }catch(e){
      console.warn('住院導尿管結案提醒檢查失敗：', e);
    }
  }


  async function load(){
    showLoading('資料讀取中...');
    if(tbody) tbody.innerHTML='<tr><td colspan="17" class="text-center">讀取中...</td></tr>';
    try{
      const snap=await db.collection(dbCol).get();
      cache=snap.docs.map(d=>({id:d.id,...d.data()}));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber)-bedToSortValue(b.bedNumber));
      const tpl = getTemplate(cache);
      renderBasic(); renderFloors(tpl); renderStats(); hookEvents();
      await notifyHospitalizedOngoingFoley();
    }catch(e){
      console.error(e);
      if(tbody) tbody.innerHTML='<tr><td colspan="17"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
    }finally{
      hideLoading();
    }
  }

  // 匯入（保留）
  if(importBtn && fileInput){
    importBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', handleExcelImport);
  }
  function pick(row, aliases){ const map={}; Object.keys(row).forEach(k=>{ map[String(k).replace(/\s+/g,'').trim()] = row[k]; }); for(const a of aliases){ const kk=String(a).replace(/\s+/g,'').trim(); if(Object.prototype.hasOwnProperty.call(map,kk)) return map[kk]; } return ''; }
  async function handleExcelImport(evt){
    const file=evt.target.files[0]; if(!file) return;
    const setImportMessage = (message, statusClass='alert alert-info')=>{
      showLoading(message);
      if(importStatus){
        importStatus.className=statusClass;
        importStatus.classList.remove('d-none');
        importStatus.textContent=String(message || '').replace(/\n+/g,' ');
      }
    };

    setImportMessage(`正在讀取 Excel 檔案...\n檔名：${file.name}`);
    const reader=new FileReader();
    reader.onload=async (e)=>{
      try{
        setImportMessage('正在解析 Excel 資料...\n準備建立住民清單');
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array',cellDates:true});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});

        setImportMessage('正在讀取評估系統最新資料...\n準備比對行走方式');
        const latestMobilitySheet = await getLatestMobilitySheet();
        const mobilityMap = buildMobilityMapFromSheet(latestMobilitySheet);

        const batch=db.batch(); let count=0;
        let linkedOverrideCount = 0;
        let deleteCount = 0;
        const excelNames = new Set();

        setImportMessage(`正在整理 Excel 內容...\n共讀到 ${rows.length} 列資料`);
        rows.forEach(r=>{
          const name = norm(pick(r, ['姓名','住民姓名','Name']));
          if (!name) return;

          const bedRaw  = norm(pick(r, ['床號','床位','Bed']));
          const bedNorm = normalizeToken(bedRaw);
          if (!bedNorm) return;

          const birthdayRaw = pick(r, ['生日','出生日期','出生年月日','Birth','BirthDate']);
          const checkinRaw  = pick(r, ['入住日期','入住日','入院日期','Checkin','Admission']);

          const residentNo = norm(pick(r, ['住民編號','住民代碼','住民代號','編號','代碼','ResidentNo','ResidentID','Code']));
          const excelMobility = norm(pick(r, ['行動方式','行動','Mobility']));
          const linkedMobility = residentNo ? norm(mobilityMap.get(residentNo) || '') : '';
          const finalMobility = linkedMobility || excelMobility;
          if (linkedMobility && linkedMobility !== excelMobility) linkedOverrideCount++;

          const payload = {
            nursingStation: norm(pick(r, ['護理站','站別','樓層','Floor'])),
            bedNumber:      bedNorm,
            residentNumber: residentNo,
            residentName:   name,
            gender:         norm(pick(r, ['性別','Gender'])),
            idNumber:       norm(pick(r, ['身份證字號','身份証字號','ID','身分證'])),
            birthday:       parseDateSmart(birthdayRaw),
            checkinDate:    parseDateSmart(checkinRaw),
            englishName:    norm(pick(r, ['住民英文姓名','英文姓名','EnglishName','English Name'])),
            address:        norm(pick(r, ['地址','住址','Address'])),
            diagnosis:      norm(pick(r, ['診斷','診斷名稱','Diagnosis','Dx'])),
            emergencyContact: norm(pick(r, ['緊急連絡人或家屬','緊急聯絡人','家屬','EmergencyContact'])),
            emergencyPhone:   norm(pick(r, ['連絡電話','聯絡電話','電話','Phone'])),
            mobility:         finalMobility,
            mobilitySource:   linkedMobility ? 'mobility-assessment' : 'excel-import',
            mobilityLinkedSheetId: linkedMobility && latestMobilitySheet ? norm(latestMobilitySheet.id) : '',
            mobilityLinkedSheetTitle: linkedMobility && latestMobilitySheet ? norm(latestMobilitySheet.title) : '',
            leaveStatus:      norm(pick(r, ['住民請假','請假','住院','LeaveHosp','Leave/Hosp']))
          };

          let docId = name;
          if (residentNo && Array.isArray(cache)) {
            const found = cache.find(o => o && o.residentNumber === residentNo && o.id);
            if (found && found.id) docId = found.id;
          }

          excelNames.add(docId);
          batch.set(db.collection(dbCol).doc(docId), payload, { merge:true });
          count++;
        });

        if (Array.isArray(cache) && cache.length) {
          cache.forEach(old => {
            if (old && old.id && !excelNames.has(old.id)) {
              batch.delete(db.collection(dbCol).doc(old.id));
              deleteCount++;
            }
          });
        }

        setImportMessage(`正在寫入住民資料...\n新增 / 更新 ${count} 筆，刪除 ${deleteCount} 筆`);
        await batch.commit();

        setImportMessage('正在更新住民系統與評估系統連結...\n請勿關閉頁面');
        await updateResidentMobilityLinkDoc(latestMobilitySheet);

        const linkedLabel = latestMobilitySheet
          ? `已套用評估系統最新資料：${norm(latestMobilitySheet.title) || norm(latestMobilitySheet.date) || latestMobilitySheet.id}`
          : '未找到評估系統資料，行走方式維持 Excel 內容';

        setImportMessage(`匯入完成，正在重新整理頁面...\n成功 ${count} 筆，行走方式覆蓋 ${linkedOverrideCount} 筆`, 'alert alert-success');
        if(importStatus){
          importStatus.textContent=`成功匯入 ${count} 筆資料，刪除 ${deleteCount} 筆；行走方式以評估系統覆蓋 ${linkedOverrideCount} 筆。${linkedLabel}`;
        }
        setTimeout(()=>location.reload(),1000);
      }catch(err){
        console.error(err);
        setImportMessage('匯入失敗，請檢查 Excel 格式或稍後再試。', 'alert alert-danger');
      }finally{
        hideLoading();
        if(fileInput) fileInput.value='';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 新增/編輯/刪除（保留原 DOM）
  let modal; const modalEl=document.getElementById('resident-modal'); if(window.bootstrap && modalEl) modal=new bootstrap.Modal(modalEl);
  const modalTitle=document.getElementById('resident-modal-title');
  const saveBtn=document.getElementById('save-resident-btn');
  const nameInput=document.getElementById('resident-name');
  const englishNameInput=document.getElementById('resident-englishName');
  const stationInput=document.getElementById('resident-station');
  const bedInput=document.getElementById('resident-bedNumber');
  const genderInput=document.getElementById('resident-gender');
  const birthdayInput=document.getElementById('resident-birthday');
  const idInput=document.getElementById('resident-idNumber');
  const addressInput=document.getElementById('resident-address');
  const diagnosisInput=document.getElementById('resident-diagnosis');
  const emgNameInput=document.getElementById('resident-emgName');
  const emgPhoneInput=document.getElementById('resident-emgPhone');
  const mobilityInput=document.getElementById('resident-mobility');
  const checkinInput=document.getElementById('resident-checkinDate');
  const statusInput=document.getElementById('resident-status');
  let currentEditId = null;


  if(addBtn && modal){
    addBtn.addEventListener('click', ()=>{
      modalTitle && (modalTitle.textContent='新增住民');
      const form=document.getElementById('resident-form'); if(form) form.reset();
      currentEditId = null;
      if(nameInput){ nameInput.disabled=false; nameInput.value=''; }
      modal.show();
    });
  }
  if(saveBtn){
    saveBtn.addEventListener('click', async ()=>{
      const name=nameInput? nameInput.value.trim():'';
      if(!name) return alert('請填寫姓名');
      const payload={
        nursingStation:stationInput?norm(stationInput.value):'',
        bedNumber:bedInput?norm(bedInput.value):'',
        gender:genderInput?genderInput.value:'',
        birthday:birthdayInput?parseDateSmart(birthdayInput.value):'',
        idNumber:idInput?norm(idInput.value):'',
        englishName:englishNameInput?norm(englishNameInput.value):'',
        address:addressInput?norm(addressInput.value):'',
        diagnosis:diagnosisInput?norm(diagnosisInput.value):'',
        emergencyContact:emgNameInput?norm(emgNameInput.value):'',
        emergencyPhone:emgPhoneInput?norm(emgPhoneInput.value):'',
        mobility:mobilityInput?norm(mobilityInput.value):'',
        checkinDate:checkinInput?parseDateSmart(checkinInput.value):'',
        leaveStatus:statusInput?norm(statusInput.value):'',
        residentName:name
      };
      const docId = currentEditId || name;
      showLoading('資料儲存中...');
      await db.collection(dbCol).doc(docId).set(payload,{merge:true});
      if(modal) modal.hide();
      await load();
    });
  }
  if(tbody){
    tbody.addEventListener('click', async (e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const row=btn.closest('tr'); const id=row?.dataset.id; if(!id) return;
      if(btn.classList.contains('btn-edit')){
        if(!modal) return;
        modalTitle && (modalTitle.textContent='編輯住民資料');
        currentEditId = id;
        const doc=await db.collection(dbCol).doc(id).get();
        if(doc.exists){
          const d=doc.data();
          if(nameInput){ nameInput.disabled=false; nameInput.value=d.residentName||id; }
          if(stationInput) stationInput.value=d.nursingStation||'';
          if(bedInput) bedInput.value=d.bedNumber||'';
          if(englishNameInput) englishNameInput.value=d.englishName||'';
          if(addressInput) addressInput.value=d.address||'';
          if(diagnosisInput) diagnosisInput.value=d.diagnosis||'';
          if(genderInput) genderInput.value=d.gender||'';
          if(birthdayInput) birthdayInput.value=d.birthday||'';
          if(idInput) idInput.value=d.idNumber||'';
          if(emgNameInput) emgNameInput.value=d.emergencyContact||'';
          if(emgPhoneInput) emgPhoneInput.value=d.emergencyPhone||'';
          if(mobilityInput) mobilityInput.value=d.mobility||'';
          if(checkinInput) checkinInput.value=d.checkinDate||'';
          if(statusInput) statusInput.value=d.leaveStatus||'';
        }
        modal.show();
      }
      if(btn.classList.contains('btn-danger')){
        if(confirm(`確定刪除「${id}」資料？`)){
          showLoading('資料刪除中...');
          await db.collection(dbCol).doc(id).delete();
          await load();
        }
      }
    });
  }

  load();
});


// Fill top "實到 / 總數" header badges for the Stats tab
function updateStatsHeaderCounts(present, total){
  try{
    var bar = document.getElementById('statsHeadBar');
    if(!bar) return;
    var pb = document.getElementById('presentBadge');
    var tb = document.getElementById('totalBadge');
    if(pb) pb.textContent = '實到 ' + present;
    if(tb) tb.textContent = '總數 ' + total;
    bar.classList.remove('d-none');
  }catch(e){ console.warn('updateStatsHeaderCounts failed:', e); }
}
