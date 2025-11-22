// Residents Admin - Export with template support (see previous cell for description)
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

  (function injectTemplateExportControls(){
    if(!statsArea) return;
    const holder = document.createElement('div');
    holder.className = 'col-12';
    holder.innerHTML = `
      <div class="d-flex justify-content-end gap-2 mt-2">
        <input type="file" id="export-template-input" accept=".xlsx,.xls" class="d-none">
        <button id="export-excel-btn" class="btn btn-success btn-sm"><i class="fa-solid fa-file-excel me-2"></i>匯出 Excel</button>
        <button id="export-with-template-btn" class="btn btn-outline-success btn-sm"><i class="fa-solid fa-file-excel me-2"></i>套用模板匯出</button>
      </div>`;
    statsArea.parentElement && statsArea.parentElement.appendChild(holder);
  })();

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
    if(Object.prototype.toString.call(v)==='[object Date]' && !isNaN(v)) {
      return v.toISOString().slice(0,10);
    }
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
        </div></div>
      </div>
    `;
  }

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

  
  // ===== Filename builder (ROC date) =====
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
  async function exportWithTemplate(file){
    if(typeof XLSX === 'undefined'){ alert('缺少 XLSX 外掛，無法匯出'); return; }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    const put = (name, aoa)=>{
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const idx = wb.SheetNames.indexOf(name);
      if(idx >= 0){
        wb.Sheets[name] = ws;
      }else{
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    };
    put('基本資料', aoaBasic());
    put('1樓床位配置', aoaFloor(1));
    put('2樓床位配置', aoaFloor(2));
    put('3樓床位配置', aoaFloor(3));
    put('總人數統計', aoaStats());
    XLSX.writeFile(wb, buildExportName()+'.xlsx');
  }

  document.addEventListener('click', async (e)=>{
    const t = e.target;
    if(t.closest('#export-excel-btn')) exportDirect();
    if(t.closest('#export-with-template-btn')){
      const input = document.getElementById('export-template-input');
      if(!input) return;
      input.onchange = async (ev)=>{
        const f = ev.target.files[0]; if(!f) return;
        await exportWithTemplate(f);
        input.value='';
      };
      input.click();
    }
  });

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
