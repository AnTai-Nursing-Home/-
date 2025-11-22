// INIT-FIX: start either on 'firebase-ready' or when DOM is ready; retry until db is available.
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
  // safety retry: if db晚一點才掛上，也會啟動
  let tries = 0;
  const t = setInterval(()=>{
    if(started) { clearInterval(t); return; }
    if(canStart()){ startNow(); clearInterval(t); }
    if(++tries > 20) clearInterval(t);
  }, 500);
})();

// Residents Admin — keep style + tabs + floor template + full wiring (firebase-ready)
document.addEventListener('residents-init', () => {
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

  // Modal & fields
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

  // ===== Local storage template (optional) =====
  const LS_KEY = 'FLOOR_TEMPLATE_V1';
  function getSavedTemplate(){
    try { const j = localStorage.getItem(LS_KEY); return j ? JSON.parse(j) : null; } catch { return null; }
  }
  function saveTemplate(tpl){
    try { localStorage.setItem(LS_KEY, JSON.stringify(tpl)); } catch {}
  }
  function getTemplate(){ return getSavedTemplate() || {'1':[], '2':[], '3':[]}; }

  // ===== Helpers =====
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
  const norm = v => (v==null ? '' : String(v).trim());

  // Smart Date parsing (ROC / Excel serial / common strings)
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

  // ===== State =====
  let cache = [];

  // ===== Data load =====
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

  // ===== Import binding (Excel residents) =====
  if (importBtn && fileInput){
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleExcelImport);
  }

  function pick(row, aliases){
    // tolerant header picking (ignores spaces)
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
          const birthdayRaw = pick(r, ['生日','生日','出生日期','出生年月日','Birth','BirthDate']);
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

  // ===== Add / Edit / Delete =====
  if (addBtn && modal){
    addBtn.addEventListener('click', () => {
      if(!modal) return;
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

  // ===== Floors & Stats (uses existing template in localStorage) =====
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
    const tokens = (tpl[String(floor)] || []).slice(); // e.g., ['101-1','101-2',...]
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

  // Go!
  load();
});
