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
  const tbody=document.getElementById('residents-table-body');
  const floor1Grid=document.getElementById('floor1-grid');
  const floor2Grid=document.getElementById('floor2-grid');
  const floor3Grid=document.getElementById('floor3-grid');
  const statsArea=document.getElementById('stats-area');

  const importBtn=document.getElementById('import-excel-btn');
  const fileInput=document.getElementById('excel-file-input');
  const importStatus=document.getElementById('import-status');
  const addBtn=document.getElementById('add-resident-btn');

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
        <td>${r.nursingStation||''}</td><td>${r.bedNumber||''}</td><td>${r.id||''}</td><td>${r.idNumber||''}</td>
        <td>${r.birthday||''}</td><td>${r.gender||''}</td><td>${age!==''?age:''}</td>
        <td>${r.emergencyContact||''}</td><td>${r.emergencyPhone||''}</td><td>${r.mobility||''}</td>
        <td>${r.checkinDate||''}</td><td>${r.leaveStatus||''}</td>
        <td><button class="btn btn-sm btn-primary btn-edit">編輯</button> <button class="btn btn-sm btn-danger btn-delete">刪除</button></td>
      </tr>`;
    });
    tbody.innerHTML=html;
  }

  function parseBedToken(s){ const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return null; return {room:m[1], sub:m[2], token:`${m[1]}-${m[2]}`}; }
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
        const status = r ? (r.leaveStatus==='住院'?'bg-danger-subtle':(r.leaveStatus==='請假'?'bg-warning-subtle':'bg-success-subtle')) : 'bg-light';
        if(r) usedBeds++; else emptyTokens.push(token);
        rows+=`<div class="d-flex justify-content-between border-bottom py-2 ${status}">
          <div class="small text-muted">🛏 ${token}</div>
          <div>${r?(r.id||'🈳 空床'):'🈳 空床'} ${r?(r.gender||''):''} ${age!==''?`/ ${age}歲`:''}</div>
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
  var leave = cache.filter(function(r){ return r.leaveStatus==='請假'; }).length;
  var hosp  = cache.filter(function(r){ return r.leaveStatus==='住院'; }).length;
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
      var fLeave = arr.filter(function(r){ return r.leaveStatus==='請假'; }).length;
      var fHosp  = arr.filter(function(r){ return r.leaveStatus==='住院'; }).length;
      var fPresent = fTotal - (fLeave + fHosp);
      var fWheel = arr.filter(function(r){ return WHEEL.test(normv(r.mobility)); }).length;
      var fTrolley = arr.filter(function(r){ return TROLLEY.test(normv(r.mobility)); }).length;
      var fWalk = arr.filter(function(r){ return WALK.test(normv(r.mobility)); }).length;
      return {f:f, fTotal:fTotal, fPresent:fPresent, fLeave:fLeave, fHosp:fHosp, fWheel:fWheel, fTrolley:fTrolley, fWalk:fWalk};
  });

  var mWheel = cache.filter(function(r){ return WHEEL.test(normv(r.mobility)); }).length;
  var mTrolley = cache.filter(function(r){ return TROLLEY.test(normv(r.mobility)); }).length;
  var mWalk = cache.filter(function(r){ return WALK.test(normv(r.mobility)); }).length;

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
      +   '<td class="text-end">' + x.fWheel + '</td>'
      +   '<td class="text-end">' + x.fTrolley + '</td>'
      +   '<td class="text-end">' + x.fWalk + '</td>'
      + '</tr>';
  }

  var html = ''
    + '<div class="row g-3">'
    +   '<div class="col-12 col-xl-5">'
    +     '<div class="card border-0 shadow-sm h-100">'
    +       '<div class="card-body">'
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
    +                 '<th class="text-end">輪椅</th>'
    +                 '<th class="text-end">推床</th>'
    +                 '<th class="text-end">步行</th>'
    +               '</tr>'
    +             '</thead>'
    +             '<tbody>' + rows + '</tbody>'
    +           '</table>'
    +         '</div>'
    +         '<div class="small text-muted mt-2">'
    +           '<span class="me-3">行動方式總計：</span>'
    +           '<span class="me-2">輪椅 ' + mWheel + '</span>'
    +           '<span class="me-2">推床 ' + mTrolley + '</span>'
    +           '<span>步行 ' + mWalk + '</span>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="col-12 col-xl-7">'
    +     '<div class="card border-0 shadow-sm h-100">'
    +       '<div class="card-body">'
    +         '<div class="d-flex justify-content-between align-items-center mb-3">'
    +           '<div class="h6 mb-0 text-muted">動作區</div>'
    +           '<button id="export-xls-styled" class="btn btn-success btn-sm">'
    +             '<i class="fa-solid fa-file-excel me-1"></i>匯出 Excel（含框線與底色）'
    +           '</button>'
    +         '</div>'
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
    + '</div>';

  statsArea.innerHTML = html;
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
    const header=['護理站','床號','姓名','身份證字號','生日','性別','住民年齡','緊急連絡人或家屬','連絡電話','行動方式','入住日期','住民請假'];
    const rows=cache.map(r=>[r.nursingStation||'',r.bedNumber||'',r.id||'',r.idNumber||'',r.birthday||'',r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)),r.emergencyContact||'',r.emergencyPhone||'',r.mobility||'',r.checkinDate||'',r.leaveStatus||'']);
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
          const status=r? (r.leaveStatus==='住院'?'bg-red':(r.leaveStatus==='請假'?'bg-yellow':'bg-green')):'';
          row+=`<td class="cell-muted">🛏 ${key||''}</td>`;
          row+=`<td>${r?(r.id||''):'🈳 空床'}</td>`;
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
    const leave=cache.filter(r=>r.leaveStatus==='請假').length, hosp=cache.filter(r=>r.leaveStatus==='住院').length;
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


  async function exportStyledXls(){
  if (typeof ExcelJS === 'undefined') { alert('ExcelJS 載入失敗，無法匯出樣式。'); return; }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSICAO';
  wb.created = new Date();

  // ===== 0) 共用樣式 =====
  const fontTitle  = { name:'Microsoft JhengHei', bold:true, size:14 };
  const fontHeader = { name:'Microsoft JhengHei', bold:true, size:11 };
  const fontCell   = { name:'Microsoft JhengHei', size:11 };
  const fillHeader = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF1F3F5'} };
  const fillAlt    = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF8F9FA'} };
  const borderThin = { top:{style:'thin',color:{argb:'FFB0B0B0'}},
                       left:{style:'thin',color:{argb:'FFB0B0B0'}},
                       bottom:{style:'thin',color:{argb:'FFB0B0B0'}},
                       right:{style:'thin',color:{argb:'FFB0B0B0'}} };

  function styleRow(row,{isHeader=false,alt=false,center=false}={}){
    row.eachCell(c=>{
      c.font = isHeader ? fontHeader : fontCell;
      c.border = borderThin;
      c.alignment = { vertical:'middle', horizontal: center ? 'center' : (isHeader?'center':'left'), wrapText:true };
      if(isHeader) c.fill = fillHeader;
      else if(alt) c.fill = fillAlt;
    });
    row.height = 20;
  }
  function addTitle(ws, text, lastCol){
    ws.mergeCells(1,1,1,lastCol);
    const c = ws.getCell(1,1);
    c.value = text;
    c.font = fontTitle;
    c.alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(1).height = 24;
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

  // ===== 1) 基本資料（放在第一張） =====
  (function addBasicSheet(){
    const ws = wb.addWorksheet('基本資料', {views:[{state:'frozen', ySplit:1}]});
    ws.columns = [
      {width:10},{width:10},{width:12},{width:16},{width:8},{width:8},{width:12},{width:18}
    ];
    const title = ws.addRow(['基本資料']); title.font = fontTitle; title.height = 24;
    ws.mergeCells(1,1,1,8);
    const header = ws.addRow(['房號','床號','床位代碼','姓名','性別','年齡','狀態','備註']);
    styleRow(header,{isHeader:true,center:true});

    const rows = (cache||[]).slice().sort((a,b)=>String(a.bedNumber||'').localeCompare(String(b.bedNumber||''),'zh-Hant'));
    for(const r of rows){
      const room = String(r.bedNumber||'').split(/[-_]/)[0] || '';
      const bed = (String(r.bedNumber||'').split(/[-_]/)[1]||'').toUpperCase();
      const age = computeAge(r.birthday);
      const line = [
        room,
        bed,
        r.bedNumber || '',
        r.id || '',
        r.gender || '',
        age===''?'':age,
        r.leaveStatus || '',
        r.note || ''
      ];
      const row = ws.addRow(line);
      styleRow(row,{center:false});
    }
  })();

  // ===== 2) 樓層表（參考第一個 Excel）：一列三房、每房三欄（床號/姓名/狀態），組間留一欄空白，底部合計 =====
  function addFloorSheet(name, floor){
    const ws = wb.addWorksheet(name, {views:[{state:'frozen', ySplit:2}]});
    // 一列：每房 3 欄 + 間隔 1 欄；三房 = 12 欄
    ws.columns = Array.from({length:12}, (_,i)=>({ width:[10,20,16, 3, 10,20,16, 3, 10,20,16, 0][i] || 12 }));

    addTitle(ws, name, 12);
    const head1 = ws.addRow(['房號','床號','姓名','','房號','床號','姓名','','房號','床號','姓名','']);
    styleRow(head1, {isHeader:true});
    const head2 = ws.addRow(['','(A/B/C)','(百歲在/性別/年齡)','', '', '(A/B/C)','(百歲在/性別/年齡)','', '', '(A/B/C)','(百歲在/性別/年齡)','', '']);
    styleRow(head2, {isHeader:true});
    // 合併每房的房號兩列
    [[1,1],[5,5],[9,9]].forEach(([s])=>ws.mergeCells(2,s,3,s));

    // 依模板展開
    const tpl = getTpl();
    const tokens = (tpl[String(floor)]||[]).slice();
    const byRoom = {};
    tokens.forEach(tok=>{
      const m = String(tok).match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      if(!m) return;
      const room=m[1], sub=m[2];
      (byRoom[room]=byRoom[room]||[]).push(sub);
    });
    const dataMap = new Map();
    (cache||[]).forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-'); dataMap.set(key,r); });

    const rooms = Object.keys(byRoom).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
    let rowCursor = 4;
    let totalBeds=0, usedBeds=0;
    for(let i=0;i<rooms.length;i+=3){
      const group = rooms.slice(i, i+3);
      const lines = Math.max(...group.map(rm => (byRoom[rm]||[]).length), 0) || 1;
      for(let r=0;r<lines;r++){
        const line = [];
        for(let k=0;k<3;k++){
          const rm = group[k];
          if(!rm){ line.push('','','',''); continue; }
          const subs = byRoom[rm]||[];
          const sub = subs[r];
          if(r===0) line.push(rm); else line.push('');
          if(sub){
            totalBeds++;
            const token = `${rm}-${sub}`;
            const rec = dataMap.get(token);
            if(rec) usedBeds++;
            const age = rec ? computeAge(rec.birthday) : '';
            const sexAge = rec ? ((rec.gender||'') + (age!==''?`/${age}歲`:'')) : '';
            const nameCell = rec ? `${rec.id||''}\n${sexAge}` : '空床';
            line.push(sub, nameCell, '');
          }else{
            line.push('','','','');
          }
        }
        const row = ws.insertRow(rowCursor++, line);
        styleRow(row, {alt:(rowCursor%2===0)});
      }
      // 區隔空白行
      ws.insertRow(rowCursor++, ['', '', '', '', '', '', '', '', '', '', '', '']);
    }
    const emptyBeds = totalBeds - usedBeds;
    rowCursor += 1;
    const sumRow = ws.getRow(rowCursor);
    sumRow.getCell(1).value = '樓層床位數';
    sumRow.getCell(2).value = totalBeds;
    sumRow.getCell(4).value = '空床數';
    sumRow.getCell(5).value = emptyBeds;
    sumRow.getCell(7).value = '已使用床位數';
    sumRow.getCell(8).value = usedBeds;
    styleRow(sumRow, {isHeader:true});
  }

  addFloorSheet('1樓床位配置', 1);
  addFloorSheet('2樓床位配置', 2);
  addFloorSheet('3樓床位配置', 3);

  // ===== 3) 總人數統計（參考第二個 Excel） =====
  const wsT = wb.addWorksheet('4總人數統計', {views:[{state:'frozen', ySplit:1}]});
  wsT.columns = [
    {width:10},{width:14},{width:12},{width:12},{width:10},{width:12},{width:12},{width:12},{width:10}
  ];

  // A1:I1 標題
  wsT.mergeCells('A1:I1');
  wsT.getCell('A1').value = '總人數統計';
  wsT.getCell('A1').font = fontTitle;
  wsT.getCell('A1').alignment = { vertical:'middle', horizontal:'center' };
  wsT.getRow(1).height = 26;

  // B2:D2 統計日期
  wsT.mergeCells('B2:D2');
  wsT.getCell('B2').value = `統計日期：${formatDate(new Date())}`;
  for(let r=2;r<=2;r++) for(let c=2;c<=4;c++) wsT.getCell(r,c).border = borderThin;

  // 右側四格 KPI：G2:H2 ~ G5:H5
  function boxMerge(a1){
    const c1 = wsT.getCell(a1.split(':')[0]);
    const c2 = wsT.getCell(a1.split(':')[1]);
    wsT.mergeCells(a1);
    for(let r=c1.row;r<=c2.row;r++){
      for(let c=c1.col;c<=c2.col;c++){
        wsT.getCell(r,c).border = borderThin;
        wsT.getCell(r,c).alignment = {horizontal:'center', vertical:'middle'};
      }
    }
  }
  const total = (cache||[]).length;
  const male = (cache||[]).filter(r=>r.gender==='男').length;
  const female = (cache||[]).filter(r=>r.gender==='女').length;
  const leave = (cache||[]).filter(r=>r.leaveStatus==='請假').length;
  const hosp  = (cache||[]).filter(r=>r.leaveStatus==='住院').length;
  const present = total - (leave + hosp);
  boxMerge('G2:H2'); wsT.getCell('G2').value = `總人數：${total}`;
  boxMerge('G3:H3'); wsT.getCell('G3').value = `實到：${present}`;
  boxMerge('G4:H4'); wsT.getCell('G4').value = `請假：${leave}`;
  boxMerge('G5:H5'); wsT.getCell('G5').value = `住院：${hosp}`;

  // A7:F7、A8:H8
  wsT.mergeCells('A7:F7'); wsT.getCell('A7').value = '性別與樓層彙整';
  wsT.getCell('A7').font = fontHeader;
  wsT.getCell('A7').alignment = {vertical:'middle', horizontal:'left'};
  wsT.getRow(7).height = 22;
  wsT.mergeCells('A8:H8'); wsT.getCell('A8').value = '下表列出性別分布與各樓使用/空床';
  wsT.getCell('A8').alignment = {vertical:'middle', horizontal:'left'};
  wsT.getRow(8).height = 20;
  for(let r=7;r<=7;r++) for(let c=1;c<=6;c++) wsT.getCell(r,c).border = borderThin;
  for(let r=8;r<=8;r++) for(let c=1;c<=8;c++) wsT.getCell(r,c).border = borderThin;

  // 性別表
  const sexHeader = wsT.addRow(['項目','人數','','','','','','','']); styleRow(sexHeader,{isHeader:true,center:true});
  wsT.mergeCells(sexHeader.number,1,sexHeader.number,2);
  [['男', male],['女', female]].forEach(([lab,val])=>{
    const r = wsT.addRow([lab,val,'','','','','','','']); styleRow(r,{center:true}); wsT.mergeCells(r.number,1,r.number,2);
  });

  // 空一行
  wsT.addRow(['']);

  // 樓層表
  const floorHeader = wsT.addRow(['樓層','總床位','已使用','空床','','','','','']); styleRow(floorHeader,{isHeader:true,center:true});
  function floorStats(f){
    const tpl = getTpl();
    const tokens = (tpl[String(f)]||[]).slice();
    const resMap = new Map(); (cache||[]).forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-'); resMap.set(key,r); });
    const totalBeds = tokens.length;
    let used=0; tokens.forEach(t=>{ if(resMap.get(t)) used++; });
    return {beds: totalBeds, used: used, empty: totalBeds - used};
  }
  [1,2,3].forEach(f=>{
    const fs = floorStats(f);
    const r = wsT.addRow([`${f}樓`, fs.beds, fs.used, fs.empty,'','','','','']); styleRow(r,{center:true});
  });

  // ===== 4) 下載 =====
  const blob = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([blob], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = `床位配置與總人數統計_${formatDate(new Date(), '-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
    function hookEvents(){
    document.addEventListener('click', (e)=>{
      const t=e.target;
      if(t.closest('#export-xls-styled')) exportStyledXls();
    });
  }

  async function load(){
    if(tbody) tbody.innerHTML='<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap=await db.collection(dbCol).get();
      cache=snap.docs.map(d=>({id:d.id,...d.data()}));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber)-bedToSortValue(b.bedNumber));
      const tpl = getTemplate(cache);
      renderBasic(); renderFloors(tpl); renderStats(); hookEvents();
    }catch(e){
      console.error(e);
      if(tbody) tbody.innerHTML='<tr><td colspan="13"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
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
    if(importStatus){ importStatus.className='alert alert-info'; importStatus.classList.remove('d-none'); importStatus.textContent='正在讀取檔案...'; }
    const reader=new FileReader();
    reader.onload=async (e)=>{
      try{
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array',cellDates:true});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
        const batch=db.batch(); let count=0;
        rows.forEach(r=>{
          const name=norm(pick(r,['姓名','住民姓名','Name'])); if(!name) return;
          const birthdayRaw=pick(r,['生日','出生日期','出生年月日','Birth','BirthDate']);
          const checkinRaw=pick(r,['入住日期','入住日','入院日期','Checkin','Admission']);
          const payload={
            nursingStation:norm(pick(r,['護理站','站別','樓層','Floor'])),
            bedNumber:norm(pick(r,['床號','床位','Bed'])),
            gender:norm(pick(r,['性別','Gender'])),
            idNumber:norm(pick(r,['身份證字號','身份証字號','ID','身分證'])),
            birthday:parseDateSmart(birthdayRaw),
            checkinDate:parseDateSmart(checkinRaw),
            emergencyContact:norm(pick(r,['緊急連絡人或家屬','緊急聯絡人','家屬','EmergencyContact'])),
            emergencyPhone:norm(pick(r,['連絡電話','聯絡電話','電話','Phone'])),
            mobility:norm(pick(r,['行動方式','行動','Mobility'])),
            leaveStatus:norm(pick(r,['住民請假','請假','住院','LeaveHosp','Leave/Hosp']))
          };
          batch.set(db.collection(dbCol).doc(name), payload, {merge:true}); count++;
        });
        await batch.commit();
        if(importStatus){ importStatus.className='alert alert-success'; importStatus.textContent=`成功匯入 ${count} 筆資料！重新載入中...`; }
        setTimeout(()=>location.reload(),1000);
      }catch(err){
        console.error(err);
        if(importStatus){ importStatus.className='alert alert-danger'; importStatus.textContent='匯入失敗，請檢查檔案。'; }
      }finally{ if(fileInput) fileInput.value=''; }
    };
    reader.readAsArrayBuffer(file);
  }

  // 新增/編輯/刪除（保留原 DOM）
  let modal; const modalEl=document.getElementById('resident-modal'); if(window.bootstrap && modalEl) modal=new bootstrap.Modal(modalEl);
  const modalTitle=document.getElementById('resident-modal-title');
  const saveBtn=document.getElementById('save-resident-btn');
  const nameInput=document.getElementById('resident-name');
  const stationInput=document.getElementById('resident-station');
  const bedInput=document.getElementById('resident-bedNumber');
  const genderInput=document.getElementById('resident-gender');
  const birthdayInput=document.getElementById('resident-birthday');
  const idInput=document.getElementById('resident-idNumber');
  const emgNameInput=document.getElementById('resident-emgName');
  const emgPhoneInput=document.getElementById('resident-emgPhone');
  const mobilityInput=document.getElementById('resident-mobility');
  const checkinInput=document.getElementById('resident-checkinDate');
  const statusInput=document.getElementById('resident-status');

  if(addBtn && modal){
    addBtn.addEventListener('click', ()=>{
      modalTitle && (modalTitle.textContent='新增住民');
      const form=document.getElementById('resident-form'); if(form) form.reset();
      if(nameInput){ nameInput.disabled=false; nameInput.value=''; }
      modal.show();
    });
  }
  if(saveBtn){
    saveBtn.addEventListener('click', async ()=>{
      const name=nameInput? nameInput.value.trim():''; if(!name) return alert('請填寫姓名');
      const payload={
        nursingStation:stationInput?norm(stationInput.value):'',
        bedNumber:bedInput?norm(bedInput.value):'',
        gender:genderInput?genderInput.value:'',
        birthday:birthdayInput?parseDateSmart(birthdayInput.value):'',
        idNumber:idInput?norm(idInput.value):'',
        emergencyContact:emgNameInput?norm(emgNameInput.value):'',
        emergencyPhone:emgPhoneInput?norm(emgPhoneInput.value):'',
        mobility:mobilityInput?norm(mobilityInput.value):'',
        checkinDate:checkinInput?parseDateSmart(checkinInput.value):'',
        leaveStatus:statusInput?norm(statusInput.value):''
      };
      await db.collection(dbCol).doc(name).set(payload,{merge:true});
      if(modal) modal.hide();
      load();
    });
  }
  if(tbody){
    tbody.addEventListener('click', async (e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const row=btn.closest('tr'); const id=row?.dataset.id; if(!id) return;
      if(btn.classList.contains('btn-edit')){
        if(!modal) return;
        modalTitle && (modalTitle.textContent='編輯住民資料');
        if(nameInput){ nameInput.disabled=true; nameInput.value=id; }
        const doc=await db.collection(dbCol).doc(id).get();
        if(doc.exists){
          const d=doc.data();
          if(stationInput) stationInput.value=d.nursingStation||'';
          if(bedInput) bedInput.value=d.bedNumber||'';
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
          await db.collection(dbCol).doc(id).delete();
          load();
        }
      }
    });
  }

  load();
});
