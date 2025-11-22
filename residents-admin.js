// 保留版面 + 五分頁（firebase-ready），床位配置依照消防檔案風格、統計含行動方式分類
document.addEventListener('firebase-ready', () => {
  const FLOOR_TEMPLATE = {'1': [101, 102, 103, 105, 106, 107, 108, 109, 110, 111, 112, 113, 115, 116], '2': [201, 202, 203, 205, 206, 207, 208, 209, 210, 211, 212, 213, 215, 216, 217, 218, 219, 220, 221], '3': [301, 302, 303, 305, 306, 307, 308, 309, 310, 311, 312, 313, 315, 316, 317, 318, 319, 320, 321]};
  const dbCol = 'residents';

  // DOM
  const tbody = document.getElementById('residents-table-body');
  const floor1Grid = document.getElementById('floor1-grid');
  const floor2Grid = document.getElementById('floor2-grid');
  const floor3Grid = document.getElementById('floor3-grid');
  const statsArea = document.getElementById('stats-area');

  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  const importStatus = document.getElementById('import-status');
  const addBtn = document.getElementById('add-resident-btn');

  // modal fields
  const modal = new bootstrap.Modal(document.getElementById('resident-modal'));
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

  // helpers
  function bedToSortValue(bed){
    if(!bed) return 0;
    const m = String(bed).match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    if(!m) return 0;
    const base = parseInt(m[1], 10);
    const sub = m[2] ? parseFloat('0.' + m[2].replace(/\D/g,'')) : 0;
    return base + sub;
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
    if(g === '女') return '<span class="badge bg-pink text-white" style="background:#d63384">女</span>';
    return '<span class="badge bg-secondary">—</span>';
  }
  function statusBadge(s){
    if(s === '請假') return '<span class="badge bg-warning text-dark">請假</span>';
    if(s === '住院') return '<span class="badge bg-danger">住院</span>';
    return '';
  }
  function norm(v){ return (v==null? '': String(v).trim()); }

  let cache = [];

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

  // ===== 基本資料（表格） =====
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

  // ===== 樓層配置（依消防檔案風格：以「房號」為卡片，內含 -1/-2 床） =====
  function isFloor(bed, floor){
    if(!bed) return false;
    const num = parseInt(String(bed).match(/^(\d+)/)?.[1] || '0',10);
    if(floor===1) return (num >=100 && num <200) || num < 100;
    if(floor===2) return (num >=200 && num <300);
    if(floor===3) return (num >=300 && num <400);
    return false;
  }
  // 將床號拆成 {room:101, sub:'1'/'2'/...}
  function splitBed(b){
    const m = String(b||'').match(/^(\d+)[-_]?([A-Za-z0-9]*)/);
    if(!m) return {room:'', sub:''};
    return {room: m[1], sub: m[2] || ''};
  }
  // group: { room -> { '1':resident, '2':resident, others... }, meta }
  function groupByRoom(list){
    const map = new Map();
    list.forEach(r=>{
      const {room, sub} = splitBed(r.bedNumber);
      if(!room) return;
      if(!map.has(room)) map.set(room, {});
      const g = map.get(room);
      const key = sub || '—';
      g[key] = r;
    });
    return map;
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
  function roomCard(room, beds){
    // -2 在上排、-1 在下排（若只有一床則顯示一排）
    const r2 = beds['2'];
    const r1 = beds['1'];
    return `<div class="col-12 col-sm-6 col-lg-3">
      <div class="card h-100">
        <div class="card-header fw-bold">房號 ${room}</div>
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
            <div class="small text-muted">床位 ${room}-2</div>
            <div>${r2 ? sexBadge(r2.gender) : ''}</div>
          </div>
          ${personLine(r2)}
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mt-3 mb-2">
            <div class="small text-muted">床位 ${room}-1</div>
            <div>${r1 ? sexBadge(r1.gender) : ''}</div>
          </div>
          ${personLine(r1)}
        </div>
      </div>
    </div>`;
  }
  function renderFloorTo(container, list, floor){
    container.innerHTML = '';
    const tplRooms = (FLOOR_TEMPLATE[String(floor)] || []).map(n => String(n));
    const grouped = new Map();
    tplRooms.forEach(rm => grouped.set(String(rm), {}));
    // put residents into template slots
    list.forEach(r=>{
      const m = String(r.bedNumber||'').match(/^(\d+)[-_]?([A-Za-z0-9]*)/);
      if(!m) return;
      const room = m[1];
      const sub = m[2] || '';
      if(!grouped.has(room)) return; // skip rooms not in template
      const g = grouped.get(room);
      const key = sub || '—';
      g[key] = r;
    });
    const rooms = tplRooms;

    let used = 0;
    let emptyList = [];
    rooms.forEach(rm=>{
      const beds = grouped.get(rm) || {};
      const has1 = !!beds['1'];
      const has2 = !!beds['2'];
      if (has1) used++; else emptyList.push(`${rm}-1`);
      if (has2) used++; else emptyList.push(`${rm}-2`);
    });
    const totalBeds = rooms.length * 2;
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
      html += roomCard(room, grouped.get(room));
    });
    html += '</div>';
    container.innerHTML = html;
  }
}
  function renderFloors(){
    const f1 = cache.filter(r=> (r.nursingStation && /1/.test(r.nursingStation)) || isFloor(r.bedNumber,1));
    const f2 = cache.filter(r=> (r.nursingStation && /2/.test(r.nursingStation)) || isFloor(r.bedNumber,2));
    const f3 = cache.filter(r=> (r.nursingStation && /3/.test(r.nursingStation)) || isFloor(r.bedNumber,3));
    renderFloorTo(floor1Grid, f1, 1);
    renderFloorTo(floor2Grid, f2, 2);
    renderFloorTo(floor3Grid, f3, 3);
  }

  // ===== 總人數統計（含男/女、樓層、外出/住院、行動方式三類） =====
  function renderStats(){
    const total = cache.length;
    const male = cache.filter(r=> r.gender==='男').length;
    const female = cache.filter(r=> r.gender==='女').length;
    const leave = cache.filter(r=> r.leaveStatus==='請假').length;
    const hosp = cache.filter(r=> r.leaveStatus==='住院').length;
    const present = total - (leave + hosp);

    const byFloor = [1,2,3].map(f=> cache.filter(r=> isFloor(r.bedNumber,f) || (r.nursingStation && r.nursingStation.includes(String(f)))).length);

    // 行動方式（檔案統計的三類：輪椅/推床/步行）—關鍵字對應
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

  // 事件：編輯/刪除
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    const row = btn.closest('tr');
    const id = row?.dataset.id;
    if(!id) return;

    if(btn.classList.contains('btn-edit')){
      modalTitle.textContent = '編輯住民資料';
      nameInput.value = id; nameInput.disabled = true;
      const doc = await db.collection(dbCol).doc(id).get();
      if(doc.exists){
        const d = doc.data();
        stationInput.value = d.nursingStation || '';
        bedInput.value = d.bedNumber || '';
        genderInput.value = d.gender || '';
        birthdayInput.value = d.birthday || '';
        idInput.value = d.idNumber || '';
        emgNameInput.value = d.emergencyContact || '';
        emgPhoneInput.value = d.emergencyPhone || '';
        mobilityInput.value = d.mobility || '';
        checkinInput.value = d.checkinDate || '';
        statusInput.value = d.leaveStatus || '';
      }
      modal.show();
    }
    if(btn.classList.contains('btn-delete')){
      if(confirm(`確定刪除「${id}」資料？`)){
        await db.collection(dbCol).doc(id).delete();
        load();
      }
    }
  });

  addBtn.addEventListener('click', () => {
    modalTitle.textContent = '新增住民';
    document.getElementById('resident-form').reset();
    nameInput.disabled = false;
    modal.show();
  });
  document.getElementById('save-resident-btn').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if(!name) return alert('請填寫姓名');
    const payload = {
      nursingStation: stationInput.value.trim(),
      bedNumber: bedInput.value.trim(),
      gender: genderInput.value,
      birthday: birthdayInput.value,
      idNumber: idInput.value.trim(),
      emergencyContact: emgNameInput.value.trim(),
      emergencyPhone: emgPhoneInput.value.trim(),
      mobility: mobilityInput.value.trim(),
      checkinDate: checkinInput.value,
      leaveStatus: statusInput.value
    };
    await db.collection(dbCol).doc(name).set(payload, {merge:true});
    modal.hide();
    load();
  });

  // 匯入
  importBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', handleExcelImport);

  function fmtDate(d){
    if(!d) return '';
    if(d instanceof Date && !isNaN(d)) return d.toISOString().slice(0,10);
    const dd = new Date(d);
    return isNaN(dd) ? '' : dd.toISOString().slice(0,10);
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
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

        const pick = (r, keys)=>{ for(const k of keys){ if(Object.prototype.hasOwnProperty.call(r,k)) return r[k]; } return ''; };

        const batch = db.batch();
        let count = 0;
        rows.forEach(r=>{
          const name = norm(pick(r, ['姓名','住民姓名','Name']));
          if(!name) return;
          const payload = {
            nursingStation: norm(pick(r, ['護理站','站別','樓層','Floor'])),
            bedNumber: norm(pick(r, ['床號','床位','Bed'])),
            gender: norm(pick(r, ['性別','Gender'])),
            idNumber: norm(pick(r, ['身份證字號','身份証字號','ID','身分證'])),
            birthday: fmtDate(pick(r, ['生日','Birth','BirthDate'])),
            checkinDate: fmtDate(pick(r, ['入住日期','入住日','Checkin','Admission'])),
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
      }finally{ fileInput.value=''; }
    };
    reader.readAsArrayBuffer(file);
  }

  load();
});
