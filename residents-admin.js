// 住民系統：保留舊樣式 + 五分頁 + 動態床位模板（firebase-ready）
// - 預設仍可運作；若上傳模板（XLSX/CSV/TXT），將以模板為準（支援任意子床，如 -1/-2/-3/-5）
// - 也會把模板存在 localStorage('FLOOR_TEMPLATE_V1')，下次自動使用
// - 可從 Excel 讀取（例如你那份 1/2/3 樓工作表），或直接 CSV/TXT 每行一個床位（e.g., 101-1）

document.addEventListener('firebase-ready', () => {
  const dbCol = 'residents';

  // ===== DOM =====
  const tbody = document.getElementById('residents-table-body');
  const floor1Grid = document.getElementById('floor1-grid');
  const floor2Grid = document.getElementById('floor2-grid');
  const floor3Grid = document.getElementById('floor3-grid');
  const statsArea = document.getElementById('stats-area');

  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  const importStatus = document.getElementById('import-status');
  const addBtn = document.getElementById('add-resident-btn');

  // 工具列：插入「上傳床位模板」
  (function injectTemplateButton(){
    const toolbar = importBtn?.parentElement;
    if(!toolbar) return;
    const tplBtn = document.createElement('button');
    tplBtn.id = 'upload-template-btn';
    tplBtn.className = 'btn btn-outline-primary btn-sm';
    tplBtn.innerHTML = '<i class="fa-solid fa-layer-group me-2"></i>上傳床位模板';
    const tplInput = document.createElement('input');
    tplInput.type = 'file';
    tplInput.id = 'template-file-input';
    tplInput.className = 'd-none';
    tplInput.accept = '.xlsx,.xls,.csv,.txt';
    toolbar.insertBefore(tplBtn, toolbar.firstChild);
    toolbar.appendChild(tplInput);
    tplBtn.addEventListener('click', ()=> tplInput.click());
    tplInput.addEventListener('change', handleTemplateImport);
  })();

  // ===== State =====
  let cache = []; // residents

  // ===== Helpers =====
  const LS_KEY = 'FLOOR_TEMPLATE_V1';
  function getSavedTemplate(){
    try { const j = localStorage.getItem(LS_KEY); return j ? JSON.parse(j) : null; } catch{ return null; }
  }
  function saveTemplate(tpl){
    try { localStorage.setItem(LS_KEY, JSON.stringify(tpl)); } catch{}
  }
  function defaultTemplate(){
    // 仍可運作的安全預設（僅示意；實際以你上傳為準）
    return {'1': [101,102,103,105,106,107,108,109,110,111,112,113,115,116].map(n=>`${n}-1`).concat([101,102,103,105,106,107,108,109,110,111,112,113,115,116].map(n=>`${n}-2`)),
            '2': [], '3': []};
  }
  function getTemplate(){
    return getSavedTemplate() || defaultTemplate();
  }
  function parseBedToken(s){
    // 期望 "101-1" 這種，不合理的就忽略
    const m = String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
    if(!m) return null;
    return { room: m[1], sub: m[2], token: `${m[1]}-${m[2]}` };
  }
  function pickFloorFromToken(token){
    const m = token.match(/^(\d)/);
    return m ? m[1] : null;
  }
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
  const norm = v => (v==null? '': String(v).trim());

  // ===== Data loading =====
  async function load(){
    tbody.innerHTML = '<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap = await db.collection(dbCol).get();
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber) - bedToSortValue(b.bedNumber));
      renderBasic();
      renderFloors();
      renderStats();
    }catch(e){
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="13"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
    }
  }

  
  // ---- Smart date parsing (supports Date, Excel serial, ROC year like 113/08/09, and common strings) ----
  function parseDateSmart(v){
    if(!v && v!==0) return '';
    // If it's already a Date
    if(Object.prototype.toString.call(v)==='[object Date]' && !isNaN(v)) {
      return v.toISOString().slice(0,10);
    }
    // Excel serial (number)
    if(typeof v === 'number' && isFinite(v)){
      // Excel serial: days since 1899-12-30
      const ms = (v - 25569) * 86400000; // 25569 = days between 1899-12-30 and 1970-01-01
      const d = new Date(ms);
      if(!isNaN(d)) return new Date(d.getTime() + d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    }
    // String parsing
    let s = String(v).trim();
    if(!s) return '';
    // Normalize separators
    s = s.replace(/[\.年\/\-]/g, '-').replace(/月/g,'-').replace(/日/g,'');
    s = s.replace(/\s+/g,'').replace(/^0+(\d)/,'$1'); // trim zeros
    // Possible formats: 2024-11-21, 113-11-21, 1131121
    const m = s.match(/^(\d{1,4})-?(\d{1,2})-?(\d{1,2})$/);
    if(m){
      let y = parseInt(m[1],10), mo = parseInt(m[2],10), da = parseInt(m[3],10);
      if(y < 1911) y += 1911; // ROC
      const dd = new Date(Date.UTC(y, mo-1, da));
      if(!isNaN(dd)) return dd.toISOString().slice(0,10);
    }
    // Fallback: Date.parse
    const d2 = new Date(s);
    if(!isNaN(d2)) return d2.toISOString().slice(0,10);
    return '';
  }

  // ===== Template import (XLSX/CSV/TXT) =====
  async function handleTemplateImport(evt){
    const file = evt.target.files[0];
    if(!file) return;
    let floorTpl = {'1':[], '2':[], '3':[]};

    const ext = (file.name.split('.').pop()||'').toLowerCase();
    const buf = await file.arrayBuffer();
    if(ext === 'xlsx' || ext === 'xls'){
      const wb = XLSX.read(buf, {type:'array'});
      const sheetNames = wb.SheetNames;
      // 讀全部工作表，抓出像 "101-1" 的字串
      sheetNames.forEach(sn=>{
        const ws = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true});
        rows.flat().forEach(cell=>{
          const t = parseBedToken(cell);
          if(t){
            const f = pickFloorFromToken(t.token);
            if(f&&floorTpl[f] && !floorTpl[f].includes(t.token)) floorTpl[f].push(t.token);
          }
        });
      });
    }else{
      // CSV / TXT
      const text = new TextDecoder('utf-8').decode(buf);
      text.split(/\r?\n/).forEach(line=>{
        const cols = line.split(/[,\s\t]+/).filter(Boolean);
        cols.forEach(c=>{
          const t = parseBedToken(c);
          if(t){
            const f = pickFloorFromToken(t.token);
            if(f&&floorTpl[f] && !floorTpl[f].includes(t.token)) floorTpl[f].push(t.token);
          }
        });
      });
    }
    // 排序
    ['1','2','3'].forEach(f=> floorTpl[f].sort((a,b)=> bedToSortValue(a)-bedToSortValue(b)));
    saveTemplate(floorTpl);
    // 立即重繪
    renderFloors();
  
  // ===== Residents Excel import (improved header mapping + smart date parsing) =====
  function norm(v){ return (v==null? '' : String(v).trim()); }
  function pick(r, keys){ 
    for(const k of keys){
      for(const kk in r){
        if(Object.prototype.hasOwnProperty.call(r, kk)){
          const key = String(kk).replace(/\s+/g,'').trim();
          if(key === String(k).replace(/\s+/g,'').trim()) return r[kk];
        }
      }
    }
    return '';
  }
  async function handleExcelImport(evt){
    const file = evt.target.files[0];
    if(!file) return;
    importStatus.className = 'alert alert-info'; importStatus.classList.remove('d-none');
    importStatus.textContent = '正在讀取檔案...';

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
          const birthdayRaw = pick(r, ['生日','生 日','出生日期','出生年月日','Birth','BirthDate']);
          const checkinRaw = pick(r, ['入住日期','入 住 日 期','入院日期','入住日','Checkin','Admission']);
          const payload = {
            nursingStation: norm(pick(r, ['護理站','站別','樓層','Floor'])),
            bedNumber: norm(pick(r, ['床號','床位','Bed'])),
            gender: norm(pick(r, ['性別','Gender'])),
            idNumber: norm(pick(r, ['身份證字號','身份証字號','ID','身分證'])),
            birthday: parseDateSmart(birthdayRaw),
            checkinDate: parseDateSmart(checkinRaw),
            emergencyContact: norm(pick(r, ['緊急連絡人或家屬','緊急聯絡人','家屬','Emergency Contact'])),
            emergencyPhone: norm(pick(r, ['連絡電話','聯絡電話','電話','Phone'])),
            mobility: norm(pick(r, ['行動方式','行動','Mobility'])),
            leaveStatus: norm(pick(r, ['住民請假','請假','住院','Leave/Hosp']))
          };
          batch.set(db.collection(dbCol).doc(name), payload, {merge:true});
          count++;
        });
        await batch.commit();
        importStatus.className = 'alert alert-success';
        importStatus.textContent = `成功匯入 ${count} 筆資料！重新載入中...`;
        setTimeout(()=> location.reload(), 1200);
      }catch(err){
        console.error(err);
        importStatus.className = 'alert alert-danger';
        importStatus.textContent = '匯入失敗，請檢查檔案。';
      }finally{ fileInput.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  }
}

  // ===== Render: 基本資料 =====
  function renderBasic(){
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

  // ===== Render: Floors (模板驅動，支援多子床) =====
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
    // bedKeys: ['1','2','3','5', ...]
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
    container.innerHTML = '';
    const tpl = getTemplate();
    const tokens = (tpl[String(floor)] || []).slice(); // ['101-1','101-2',...]
    // 建立 room -> {sub -> resident}
    const grouped = new Map();
    tokens.forEach(tok => {
      const t = parseBedToken(tok);
      if(!t) return;
      if(!grouped.has(t.room)) grouped.set(t.room, {});
      const g = grouped.get(t.room);
      if(!g.__keys) g.__keys = new Set(); // 記錄排序
      g.__keys.add(t.sub);
    });
    // 將住民放入模板槽位
    list.forEach(r=>{
      const t = parseBedToken(r.bedNumber);
      if(!t) return;
      if(!grouped.has(t.room)) return; // 不在模板中就忽略
      const g = grouped.get(t.room);
      if(!g.__keys || !g.__keys.has(t.sub)) return; // 子床不在模板就忽略
      g[t.sub] = r;
    });
    // 統計：用模板的 token 數量為總床位
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

  // ===== Render: Stats =====
  function renderStats(){
    const total = cache.length;
    const male = cache.filter(r=> r.gender==='男').length;
    const female = cache.filter(r=> r.gender==='女').length;
    const leave = cache.filter(r=> r.leaveStatus==='請假').length;
    const hosp = cache.filter(r=> r.leaveStatus==='住院').length;
    const present = total - (leave + hosp);

    const byFloor = [1,2,3].map(f=> cache.filter(r=> new RegExp('^'+f+'\\d\\d').test(String(r.bedNumber)) || (r.nursingStation && r.nursingStation.includes(String(f)))).length);

    const mobi = (s)=> norm(s);
    const wheel = cache.filter(r=> /輪椅/i.test(mobi(r.mobility))).length;
    const trolley = cache.filter(r=> /(推床|臥床|平車|推車)/i.test(mobi(r.mobility))).length;
    const walk = cache.filter(r=> /(步行|可獨立|助行|拐杖|walker)/i.test(mobi(r.mobility))).length;

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
          <div class="h6 mb-2">行動方式</div>
          <div class="d-flex gap-3 flex-wrap">
            <div>輪椅：<strong>${wheel}</strong></div>
            <div>推床：<strong>${trolley}</strong></div>
            <div>步行：<strong>${walk}</strong></div>
          </div>
        </div></div>
      </div>
    `;
  }

  // ===== Load =====
  load();
});
