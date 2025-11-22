// residents-admin.merged.gridlike.js
// 合併版：保留原有頁面行為（載入/渲染/匯入/新增/編輯/刪除/統計）
// + 新增「窗格樣式」匯出（不套模板，非純文字，房號區塊感）
// + 保留原本的「匯出 Excel」（表格式）
// + 檔名：民國年月日-床位配置-消防位置圖-報告詞 -.xlsx

(function(){
  let started = false;
  function canStart(){ return typeof db !== 'undefined' && db && typeof db.collection === 'function'; }
  function startNow(){ if(started) return; started = true; document.dispatchEvent(new Event('residents-init')); }
  document.addEventListener('firebase-ready', ()=> startNow());
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(()=> { if(canStart()) startNow(); }, 300);
  } else {
    document.addEventListener('DOMContentLoaded', ()=> { setTimeout(()=> { if(canStart()) startNow(); }, 300); });
  }
  let tries = 0;
  const t = setInterval(()=>{
    if(started) { clearInterval(t); return; }
    if(canStart()){ startNow(); clearInterval(t); }
    if(++tries > 20) clearInterval(t);
  }, 500);
})();

document.addEventListener('residents-init', () => {
  const dbCol = 'residents';
  const tbody = document.getElementById('residents-table-body');
  const floor1Grid = document.getElementById('floor1-grid');
  const floor2Grid = document.getElementById('floor2-grid');
  const floor3Grid = document.getElementById('floor3-grid');
  const statsArea = document.getElementById('stats-area');

  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  const importStatus = document.getElementById('import-status');
  const addBtn = document.getElementById('add-resident-btn');

  // 版型模板（用於顯示與匯出表格式樓層）
  const LS_KEY = 'FLOOR_TEMPLATE_V1';
  function getTemplate(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {'1':[], '2':[], '3':[]}; }catch{ return {'1':[], '2':[], '3':[]}; }
  }
  const norm = v => (v==null ? '' : String(v).trim());
  function bedToSortValue(bed){
    if(!bed) return 0;
    const m = String(bed).match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    if(!m) return 0;
    const base = parseInt(m[1], 10);
    const sub = m[2] ? parseInt(String(m[2]).replace(/\D/g,''),10) || 0 : 0;
    return base + sub/100;
  }
  function calcAge(isoDate){
    if(!isoDate) return '';
    const d = new Date(isoDate);
    if(isNaN(d)) return '';
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }
  function sexBadge(g){
    if(g === '男') return '<span class="badge bg-primary">男</span>';
    if(g === '女') return '<span class="badge" style="background:#d63384;color:#fff">女</span>';
    return '<span class="badge bg-secondary">—</span>';
  }
  function statusBadge(s){
    if(s === '請假') return '<span class="badge bg-warning text-dark">請假</span>';
    if(s === '住院') return '<span class="badge bg-danger">住院</span>';
    return '';
  }
  function parseDateSmart(v){
    if(!v && v!==0) return '';
    if(Object.prototype.toString.call(v)==='[object Date]' && !isNaN(v)) return v.toISOString().slice(0,10);
    if(typeof v === 'number' && isFinite(v)){
      const ms = (v - 25569) * 86400000;
      const d = new Date(ms);
      if(!isNaN(d)) return new Date(d.getTime() + d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    }
    let s = String(v).trim();
    if(!s) return '';
    s = s.replace(/[\.年\/\-]/g, '-').replace(/月/g,'-').replace(/日/g,'').replace(/\s+/g,'');
    const m = s.match(/^(\d{1,4})-?(\d{1,2})-?(\d{1,2})$/);
    if(m){
      let y = parseInt(m[1],10), mo = parseInt(m[2],10), da = parseInt(m[3],10);
      if(y < 1911) y += 1911;
      const dd = new Date(Date.UTC(y, mo-1, da));
      if(!isNaN(dd)) return dd.toISOString().slice(0,10);
    }
    const d2 = new Date(s);
    if(!isNaN(d2)) return d2.toISOString().slice(0,10);
    return '';
  }

  let cache = [];

  // ===== Basic 表格 =====
  function renderBasic(){
    if(!tbody) return;
    let html = '';
    cache.forEach(r=>{
      const age = calcAge(r.birthday);
      html += `<tr data-id="${r.id}">
        <td>${r.nursingStation || ''}</td>
        <td>${r.bedNumber || ''}</td>
        <td>${r.id || ''}</td>
        <td>${r.idNumber || ''}</td>
        <td>${r.birthday || ''}</td>
        <td>${r.gender || ''}</td>
        <td>${age !== '' ? age : ''}</td>
        <td>${r.emergencyContact || ''}</td>
        <td>${r.emergencyPhone || ''}</td>
        <td>${r.mobility || ''}</td>
        <td>${r.checkinDate || ''}</td>
        <td>${r.leaveStatus || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-edit">編輯</button>
          <button class="btn btn-sm btn-danger btn-delete">刪除</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  // ===== 樓層卡片（顯示用） =====
  function parseBedToken(s){
    const m = String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
    if(!m) return null;
    return { room: m[1], sub: m[2], token: `${m[1]}-${m[2]}` };
  }
  function personLine(res){
    if(!res) return '<div class="text-muted">空床</div>';
    const age = calcAge(res.birthday);
    const sb = sexBadge(res.gender);
    const st = statusBadge(res.leaveStatus);
    const name = res.id || '';
    const ageStr = (age!==''? `${age}歲` : '');
    return `<div>${name} ${sb} ${st} <small class="text-muted">${ageStr}</small></div>`;
  }
  function roomCardGeneric(room, bedKeys, bedMap){
    let rows = '';
    bedKeys.forEach(sub=>{
      const res = bedMap[sub];
      rows += `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
        <div class="small text-muted">床位 ${room}-${sub}</div>
        <div>${res ? sexBadge(res.gender) : ''}</div>
      </div>
      <div class="py-1">${personLine(res)}</div>`;
    });
    return `<div class="col-12 col-sm-6 col-lg-3">
      <div class="card h-100">
        <div class="card-header fw-bold">房號 ${room}</div>
        <div class="card-body"> ${rows} </div>
      </div>
    </div>`;
  }
  function renderFloorTo(container, list, floor){
    if(!container) return;
    container.innerHTML = '';
    const tpl = getTemplate();
    const tokens = (tpl[String(floor)] || []).slice();
    const grouped = new Map();
    tokens.forEach(tok => {
      const t = parseBedToken(tok);
      if(!t) return;
      if(!grouped.has(t.room)) grouped.set(t.room, {});
      const g = grouped.get(t.room);
      if(!g.__keys) g.__keys = new Set();
      g.__keys.add(t.sub);
    });
    list.forEach(r=>{
      const t = parseBedToken(r.bedNumber);
      if(!t) return;
      if(!grouped.has(t.room)) return;
      const g = grouped.get(t.room);
      if(!g.__keys || !g.__keys.has(t.sub)) return;
      g[t.sub] = r;
    });
    const totalBeds = tokens.length;
    let used = 0;
    const emptyList = [];
    const rooms = Array.from(grouped.keys()).sort((a,b)=> parseInt(a,10)-parseInt(b,10));
    rooms.forEach(room=>{
      const g = grouped.get(room);
      const keys = Array.from(g.__keys).sort((a,b)=> (parseInt(a.replace(/\D/g,''),10)||0) - (parseInt(b.replace(/\D/g,''),10)||0));
      keys.forEach(sub=>{
        if (g[sub]) used++;
        else emptyList.push(`${room}-${sub}`);
      });
    });
    const empty = totalBeds - used;

    const statsHtml = `
    <div class="mb-2">
      <div class="row g-2">
        <div class="col-md-3"><div class="card"><div class="card-body text-center">
          <div class="small text-muted">樓層床位數</div>
          <div class="h3 m-0">${totalBeds}</div>
        </div></div></div>
        <div class="col-md-3"><div class="card"><div class="card-body text-center">
          <div class="small text-muted">空床數</div>
          <div class="h3 m-0">${empty}</div>
        </div></div></div>
        <div class="col-md-3"><div class="card"><div class="card-body text-center">
          <div class="small text-muted">已使用床位數</div>
          <div class="h3 m-0">${used}</div>
        </div></div></div>
        <div class="col-md-3"><div class="card"><div class="card-body">
          <div class="small text-muted">空床</div>
          <div class="d-flex flex-wrap gap-2">${emptyList.length ? emptyList.map(b=>`<span class="badge bg-secondary">${b}</span>`).join('') : '—'}</div>
        </div></div></div>
      </div>
    </div>`;

    let html = statsHtml + '<div class="row g-2">';
    rooms.forEach(room=>{
      const g = grouped.get(room);
      const keys = Array.from(g.__keys).sort((a,b)=> (parseInt(a.replace(/\D/g,''),10)||0) - (parseInt(b.replace(/\D/g,''),10)||0));
      html += roomCardGeneric(room, keys, g);
    });
    html += '</div>';
    container.innerHTML = html;
  }
  function renderFloors(){
    const f1 = cache.filter(r=> /^1\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /1/.test(r.nursingStation)));
    const f2 = cache.filter(r=> /^2\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /2/.test(r.nursingStation)));
    const f3 = cache.filter(r=> /^3\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /3/.test(r.nursingStation)));
    renderFloorTo(floor1Grid, f1, 1);
    renderFloorTo(floor2Grid, f2, 2);
    renderFloorTo(floor3Grid, f3, 3);
  }

  // ===== 總人數統計（含按鈕） =====
  function renderStats(){
    if(!statsArea) return;
    const total = cache.length;
    const male = cache.filter(r=> r.gender==='男').length;
    const female = cache.filter(r=> r.gender==='女').length;
    const leave = cache.filter(r=> r.leaveStatus==='請假').length;
    const hosp = cache.filter(r=> r.leaveStatus==='住院').length;
    const present = total - (leave + hosp);
    const byFloor = [1,2,3].map(f=> cache.filter(r=> new RegExp('^'+f+'\\d\\d').test(String(r.bedNumber)) || (r.nursingStation && r.nursingStation.includes(String(f)))).length);
    const normv = (s)=> (s==null?'':String(s));
    const WHEEL = /(輪椅)/i, TROLLEY=/(推床|臥床|平車|推車)/i, WALK=/(步行|可獨立|助行|拐杖|walker)/i;
    function countMob(list, re){ return list.filter(r=> re.test(normv(r.mobility))).length; }
    const floors = {
      1: cache.filter(r=> /^1\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /1/.test(r.nursingStation))),
      2: cache.filter(r=> /^2\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /2/.test(r.nursingStation))),
      3: cache.filter(r=> /^3\d\d/.test(String(r.bedNumber)) || (r.nursingStation && /3/.test(r.nursingStation)))
    };
    const mobByFloor = [1,2,3].map(f=>({ 
      wheel: countMob(floors[f], WHEEL),
      trolley: countMob(floors[f], TROLLEY),
      walk: countMob(floors[f], WALK)
    }));
    statsArea.innerHTML = `
      <div class="col-md-4">
        <div class="card"><div class="card-body">
          <div class="h5 mb-2">總人數</div>
          <div class="display-6">${total}</div>
          <div class="text-muted">男：${male} ・ 女：${female}</div>
          <div class="mt-2">實到人數：<strong>${present}</strong></div>
        </div></div>
      </div>
      <div class="col-md-8">
        <div class="card"><div class="card-body">
          <div class="h6 mb-2">各樓層人數</div>
          <div class="d-flex gap-3 flex-wrap">
            <div>1樓：<strong>${byFloor[0]}</strong></div>
            <div>2樓：<strong>${byFloor[1]}</strong></div>
            <div>3樓：<strong>${byFloor[2]}</strong></div>
          </div>
          <hr/>
          <div class="h6 mb-2">外出 / 住院</div>
          <div class="d-flex gap-3 flex-wrap">
            <div>請假：<strong>${leave}</strong></div>
            <div>住院：<strong>${hosp}</strong></div>
          </div>
          <hr/>
          <div class="h6 mb-2">行動方式（分樓層）</div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>樓層</th><th>輪椅</th><th>推床</th><th>步行</th></tr></thead>
              <tbody>
                <tr><td>1F</td><td>${mobByFloor[0].wheel}</td><td>${mobByFloor[0].trolley}</td><td>${mobByFloor[0].walk}</td></tr>
                <tr><td>2F</td><td>${mobByFloor[1].wheel}</td><td>${mobByFloor[1].trolley}</td><td>${mobByFloor[1].walk}</td></tr>
                <tr><td>3F</td><td>${mobByFloor[2].wheel}</td><td>${mobByFloor[2].trolley}</td><td>${mobByFloor[2].walk}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="text-end mt-2">
            <input type="file" id="export-template-input" accept=".xlsx,.xls" class="d-none">
            <button id="export-excel-btn" class="btn btn-success btn-sm"><i class="fa-solid fa-file-excel me-2"></i>匯出 Excel</button>
            <button id="export-excel-gridlike" class="btn btn-outline-success btn-sm"><i class="fa-solid fa-border-all me-2"></i>匯出 Excel（窗格樣式）</button>
          </div>
        </div></div>
      </div>
    `;
  }

  // ===== 匯出（表格式） =====
  function aoaBasic(){
    const header = ['護理站','床號','姓名','身份證字號','生日','性別','住民年齡','緊急連絡人或家屬','連絡電話','行動方式','入住日期','住民請假'];
    const rows = cache.map(r=>[
      r.nursingStation||'', r.bedNumber||'', r.id||'', r.idNumber||'', r.birthday||'', r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)), r.emergencyContact||'', r.emergencyPhone||'',
      r.mobility||'', r.checkinDate||'', r.leaveStatus||''
    ]);
    return [header, ...rows];
  }
  function aoaFloor(floor){
    const tpl = getTemplate();
    const tokens = (tpl[String(floor)] || []).slice();
    const map = new Map();
    tokens.forEach(t=>{ map.set(t, null); });
    cache.forEach(r=>{
      const key = String(r.bedNumber||'').replace('_','-');
      if(map.has(key)) map.set(key, r);
    });
    const header = ['床位','姓名','性別','狀態','年齡'];
    const rows = [];
    tokens.forEach(t=>{
      const r = map.get(t);
      rows.push([t, r ? (r.id||'') : '', r ? (r.gender||'') : '', r ? (r.leaveStatus||'') : '空床', r ? (function(a){return a!==''?a:'';})(calcAge(r.birthday)) : '']);
    });
    return [header, ...rows];
  }
  function aoaStats(){
    const total = cache.length;
    const male = cache.filter(r=> r.gender==='男').length;
    const female = cache.filter(r=> r.gender==='女').length;
    const leave = cache.filter(r=> r.leaveStatus==='請假').length;
    const hosp = cache.filter(r=> r.leaveStatus==='住院').length;
    const present = total - (leave + hosp);
    const floors = {
      1: cache.filter(r=> /^1\\d\\d/.test(String(r.bedNumber)) || (r.nursingStation && /1/.test(r.nursingStation))),
      2: cache.filter(r=> /^2\\d\\d/.test(String(r.bedNumber)) || (r.nursingStation && /2/.test(r.nursingStation))),
      3: cache.filter(r=> /^3\\d\\d/.test(String(r.bedNumber)) || (r.nursingStation && /3/.test(r.nursingStation)))
    };
    const normv = (s)=> (s==null?'':String(s));
    const WHEEL = /(輪椅)/i, TROLLEY=/(推床|臥床|平車|推車)/i, WALK=/(步行|可獨立|助行|拐杖|walker)/i;
    function countMob(list, re){ return list.filter(r=> re.test(normv(r.mobility))).length; }
    const head1 = ['總人數', total, '', '男', male, '女', female, '實到', present, '請假', leave, '住院', hosp];
    const head2 = ['樓層','輪椅','推床','步行'];
    const row1 = ['1F', countMob(floors[1],WHEEL), countMob(floors[1],TROLLEY), countMob(floors[1],WALK)];
    const row2 = ['2F', countMob(floors[2],WHEEL), countMob(floors[2],TROLLEY), countMob(floors[2],WALK)];
    const row3 = ['3F', countMob(floors[3],WHEEL), countMob(floors[3],TROLLEY), countMob(floors[3],WALK)];
    return [head1, [], head2, row1, row2, row3];
  }

  function buildExportName(){
    const d = new Date();
    const rocY = d.getFullYear() - 1911;
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${rocY}${mm}${dd}-床位配置-消防位置圖-報告詞 -`;
  }

  function exportDirect(){
    if(typeof XLSX === 'undefined'){ alert('缺少 XLSX 外掛，無法匯出'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaBasic()), '基本資料');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaFloor(1)), '1樓床位配置');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaFloor(2)), '2樓床位配置');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaFloor(3)), '3樓床位配置');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaStats()), '總人數統計');
    XLSX.writeFile(wb, buildExportName()+'.xlsx');
  }

  // ===== 匯出（窗格樣式，不套模板） =====
  function buildFloorPaneSheet(all,floor){
    // group by room
    const list = all.filter(r=> new RegExp('^'+floor+'\\d\\d').test(String(r.bedNumber||'')) || (r.nursingStation && r.nursingStation.includes(String(floor))));
    const map = new Map();
    list.forEach(r=>{
      const m = String(r.bedNumber||'').match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      if(!m) return;
      const room=m[1], sub=m[2];
      if(!map.has(room)) map.set(room,{});
      map.get(room)[sub]=r;
    });
    const rooms = [...map.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));

    const aoa=[]; const merges=[];
    const ROOM_PER_ROW=3;
    const BLOCK_W=6; // 3資料欄 + 3間隔/美觀
    const TITLE_COLS=BLOCK_W*ROOM_PER_ROW;

    // title
    setCell(aoa,0,0, `${floor}樓床位配置`);
    merges.push({s:{r:0,c:0}, e:{r:0,c:TITLE_COLS-1}});

    let rCur=2, cCur=0, rowMax=0;
    rooms.forEach((room, idx)=>{
      // 房號 header 合併三格
      setCell(aoa, rCur, cCur, `房號 ${room}`);
      merges.push({s:{r:rCur,c:cCur}, e:{r:rCur,c:cCur+2}});
      // 床位列
      const subs = Object.keys(map.get(room)).sort((a,b)=> (parseInt(String(a).replace(/\D/g,''),10)||0) - (parseInt(String(b).replace(/\D/g,''),10)||0));
      const lines = Math.max(2, subs.length||2);
      for(let i=0;i<lines;i++){
        const targetR = rCur+1+i;
        const sub = subs[i];
        const res = sub ? map.get(room)[sub] : null;
        const label = sub ? `${room}-${sub}` : '';
        const name  = res ? (res.id||'') : '';
        const sexAge = res ? `${res.gender||''}${calcAge(res.birthday) !== '' ? ' / '+calcAge(res.birthday)+'歲' : ''}` : '';

        setCell(aoa, targetR, cCur,   label);
        setCell(aoa, targetR, cCur+1, name);
        setCell(aoa, targetR, cCur+2, sexAge);
      }
      rowMax = Math.max(rowMax, lines+1);
      // 下一間房的起始欄（含美觀間隔）
      cCur += BLOCK_W;
      // 每 3 間換行
      if((idx+1)%ROOM_PER_ROW===0){
        rCur += rowMax + 1; // +1 為區塊間留白
        cCur = 0;
        rowMax = 0;
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = Array(TITLE_COLS).fill(0).map((_,i)=>({wch: i%BLOCK_W===3? 2 : 12})); // 狹窄間隔欄
    return ws;
  }

  async function exportGridlike(){
    if(typeof XLSX === 'undefined'){ alert('缺少 XLSX 外掛，無法匯出'); return; }
    const wb = XLSX.utils.book_new();
    // 重新以目前 cache 為主
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaBasic()), '基本資料');
    XLSX.utils.book_append_sheet(wb, buildFloorPaneSheet(cache,1), '1樓床位配置');
    XLSX.utils.book_append_sheet(wb, buildFloorPaneSheet(cache,2), '2樓床位配置');
    XLSX.utils.book_append_sheet(wb, buildFloorPaneSheet(cache,3), '3樓床位配置');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaStats()), '總人數統計');
    XLSX.writeFile(wb, buildExportName()+'.xlsx');
  }

  function setCell(aoa, r, c, v){
    if(!aoa[r]) aoa[r]=[];
    aoa[r][c]=v;
  }

  // ===== 事件 =====
  document.addEventListener('click', async (e)=>{
    const t = e.target;
    if(t.closest('#export-excel-btn')) exportDirect();
    if(t.closest('#export-excel-gridlike')) exportGridlike();
  });

  // ===== 匯入 =====
  if (importBtn && fileInput){
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleExcelImport);
  }
  function pick(row, aliases){
    const map = {};
    Object.keys(row).forEach(k => { map[String(k).replace(/\s+/g,'').trim()] = row[k]; });
    for(const a of aliases){
      const kk = String(a).replace(/\s+/g,'').trim();
      if(Object.prototype.hasOwnProperty.call(map, kk)) return map[kk];
    }
    return '';
  }
  async function handleExcelImport(evt){
    const file = evt.target.files[0];
    if(!file) return;
    if(importStatus){ importStatus.className = 'alert alert-info'; importStatus.classList.remove('d-none'); importStatus.textContent = '正在讀取檔案...'; }
    const reader = new FileReader();
    reader.onload = async (e)=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:true});
        const batch = db.batch();
        let count = 0;
        rows.forEach(r=>{
          const name = norm(pick(r, ['姓名','住民姓名','Name']));
          if(!name) return;
          const birthdayRaw = pick(r, ['生日','出生日期','出生年月日','Birth','BirthDate']);
          const checkinRaw = pick(r, ['入住日期','入住日','入院日期','Checkin','Admission']);
          const payload = {
            nursingStation: norm(pick(r, ['護理站','站別','樓層','Floor'])),
            bedNumber: norm(pick(r, ['床號','床位','Bed'])),
            gender: norm(pick(r, ['性別','Gender'])),
            idNumber: norm(pick(r, ['身份證字號','身份証字號','ID','身分證'])),
            birthday: parseDateSmart(birthdayRaw),
            checkinDate: parseDateSmart(checkinRaw),
            emergencyContact: norm(pick(r, ['緊急連絡人或家屬','緊急聯絡人','家屬','EmergencyContact'])),
            emergencyPhone: norm(pick(r, ['連絡電話','聯絡電話','電話','Phone'])),
            mobility: norm(pick(r, ['行動方式','行動','Mobility'])),
            leaveStatus: norm(pick(r, ['住民請假','請假','住院','LeaveHosp','Leave/Hosp']))
          };
          batch.set(db.collection(dbCol).doc(name), payload, {merge:true});
          count++;
        });
        await batch.commit();
        if(importStatus){ importStatus.className = 'alert alert-success'; importStatus.textContent = `成功匯入 ${count} 筆資料！重新載入中...`; }
        setTimeout(()=> location.reload(), 1000);
      }catch(err){
        console.error(err);
        if(importStatus){ importStatus.className = 'alert alert-danger'; importStatus.textContent = '匯入失敗，請檢查檔案。'; }
      }finally{ if(fileInput) fileInput.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  }

  // ===== 新增 / 編輯 / 刪除 =====
  let modal;
  const modalEl = document.getElementById('resident-modal');
  if (window.bootstrap && modalEl) modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById('resident-modal-title');
  const saveBtn = document.getElementById('save-resident-btn');
  const nameInput = document.getElementById('resident-name');
  const stationInput = document.getElementById('resident-station');
  const bedInput = document.getElementById('resident-bedNumber');
  const genderInput = document.getElementById('resident-gender');
  const birthdayInput = document.getElementById('resident-birthday');
  const idInput = document.getElementById('resident-idNumber');
  const emgNameInput = document.getElementById('resident-emgName');
  const emgPhoneInput = document.getElementById('resident-emgPhone');
  const mobilityInput = document.getElementById('resident-mobility');
  const checkinInput = document.getElementById('resident-checkinDate');
  const statusInput = document.getElementById('resident-status');

  if (addBtn && modal){
    addBtn.addEventListener('click', () => {
      modalTitle && (modalTitle.textContent = '新增住民');
      const form = document.getElementById('resident-form');
      if(form) form.reset();
      if(nameInput) { nameInput.disabled = false; nameInput.value = ''; }
      modal.show();
    });
  }
  if (saveBtn){
    saveBtn.addEventListener('click', async () => {
      const name = nameInput ? nameInput.value.trim() : '';
      if(!name) return alert('請填寫姓名');
      const payload = {
        nursingStation: stationInput ? norm(stationInput.value) : '',
        bedNumber: bedInput ? norm(bedInput.value) : '',
        gender: genderInput ? genderInput.value : '',
        birthday: birthdayInput ? parseDateSmart(birthdayInput.value) : '',
        idNumber: idInput ? norm(idInput.value) : '',
        emergencyContact: emgNameInput ? norm(emgNameInput.value) : '',
        emergencyPhone: emgPhoneInput ? norm(emgPhoneInput.value) : '',
        mobility: mobilityInput ? norm(mobilityInput.value) : '',
        checkinDate: checkinInput ? parseDateSmart(checkinInput.value) : '',
        leaveStatus: statusInput ? norm(statusInput.value) : ''
      };
      await db.collection(dbCol).doc(name).set(payload, {merge:true});
      if(modal) modal.hide();
      load();
    });
  }
  if (tbody){
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if(!btn) return;
      const row = btn.closest('tr');
      const id = row?.dataset.id;
      if(!id) return;
      if(btn.classList.contains('btn-edit')){
        if(!modal) return;
        modalTitle && (modalTitle.textContent = '編輯住民資料');
        if(nameInput){ nameInput.disabled = true; nameInput.value = id; }
        const doc = await db.collection(dbCol).doc(id).get();
        if(doc.exists){
          const d = doc.data();
          if(stationInput) stationInput.value = d.nursingStation || '';
          if(bedInput) bedInput.value = d.bedNumber || '';
          if(genderInput) genderInput.value = d.gender || '';
          if(birthdayInput) birthdayInput.value = d.birthday || '';
          if(idInput) idInput.value = d.idNumber || '';
          if(emgNameInput) emgNameInput.value = d.emergencyContact || '';
          if(emgPhoneInput) emgPhoneInput.value = d.emergencyPhone || '';
          if(mobilityInput) mobilityInput.value = d.mobility || '';
          if(checkinInput) checkinInput.value = d.checkinDate || '';
          if(statusInput) statusInput.value = d.leaveStatus || '';
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

  async function load(){
    if(tbody) tbody.innerHTML = '<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap = await db.collection(dbCol).get();
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber) - bedToSortValue(b.bedNumber));
      renderBasic();
      renderFloors();
      renderStats();
    }catch(e){
      console.error(e);
      if(tbody) tbody.innerHTML = '<tr><td colspan="13"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
    }
  }
  load();
});
