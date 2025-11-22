// 住民資料管理（含樓層分頁與統計）
document.addEventListener('firebase-ready', () => {
  // DOM 參照
  const tbody = document.getElementById('residents-table-body');
  const addBtn = document.getElementById('add-resident-btn');
  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  const importStatus = document.getElementById('import-status');

  const floor1Grid = document.getElementById('floor1-grid');
  const floor2Grid = document.getElementById('floor2-grid');
  const floor3Grid = document.getElementById('floor3-grid');
  const statsArea = document.getElementById('stats-area');

  // Modal 參照
  const modalEl = document.getElementById('resident-modal');
  const modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById('resident-modal-title');
  const saveBtn = document.getElementById('save-resident-btn');
  const form = document.getElementById('resident-form');
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

  const collectionName = 'residents';

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

  let cache = [];
  async function fetchResidents(){
    tbody.innerHTML = '<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap = await db.collection(collectionName).get();
      cache = snap.docs.map(d => ({id:d.id, ...d.data()}));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber) - bedToSortValue(b.bedNumber));
      renderBasic();
      renderFloors();
      renderStats();
    }catch(err){
      console.error('讀取住民失敗:', err);
      tbody.innerHTML = '<tr><td colspan="13"><div class="alert alert-danger">讀取失敗</div></td></tr>';
    }
  }

  function renderBasic(){
    let html = '';
    cache.forEach(r => {
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

  function isFloor(bed, floor){
    if(!bed) return false;
    // 以床號開頭的數字判斷樓層（100/200/300 或 1xx/2xx/3xx）
    const num = parseInt(String(bed).match(/^(\d+)/)?.[1] || '0',10);
    if(floor===1) return num >=100 && num <200 || num<100; // 若只有個位數/雙位數，也視為1樓
    if(floor===2) return num >=200 && num <300;
    if(floor===3) return num >=300 && num <400;
    return false;
  }

  function bedCard(r){
    const badge = r.leaveStatus ? `<span class="badge bg-warning ms-1">${r.leaveStatus}</span>` : '';
    return `<div class="bed-card">
      <div class="title">${r.bedNumber || '—'} ${badge}</div>
      <div>${r.id || ''} <small class="text-muted">(${r.gender || ''}${r.birthday ? '・'+calcAge(r.birthday)+'歲':''})</small></div>
      <div class="small text-muted">行動：${r.mobility || '—'}</div>
      <div class="small text-muted">聯絡：${r.emergencyContact || '—'} ${r.emergencyPhone ? ' / '+r.emergencyPhone : ''}</div>
    </div>`;
  }

  function renderFloors(){
    [floor1Grid,floor2Grid,floor3Grid].forEach(el=> el.innerHTML='');
    const f1 = cache.filter(r=> (r.nursingStation && /1/.test(r.nursingStation)) || isFloor(r.bedNumber,1));
    const f2 = cache.filter(r=> (r.nursingStation && /2/.test(r.nursingStation)) || isFloor(r.bedNumber,2));
    const f3 = cache.filter(r=> (r.nursingStation && /3/.test(r.nursingStation)) || isFloor(r.bedNumber,3));
    f1.forEach(r=> floor1Grid.insertAdjacentHTML('beforeend', bedCard(r)));
    f2.forEach(r=> floor2Grid.insertAdjacentHTML('beforeend', bedCard(r)));
    f3.forEach(r=> floor3Grid.insertAdjacentHTML('beforeend', bedCard(r)));
  }

  function renderStats(){
    const total = cache.length;
    const male = cache.filter(r=> r.gender==='男').length;
    const female = cache.filter(r=> r.gender==='女').length;
    const leave = cache.filter(r=> r.leaveStatus==='請假').length;
    const hosp = cache.filter(r=> r.leaveStatus==='住院').length;

    const byFloor = [1,2,3].map(f=> cache.filter(r=> isFloor(r.bedNumber,f) || (r.nursingStation && r.nursingStation.includes(String(f)))).length);

    statsArea.innerHTML = `
      <div class="col-md-3">
        <div class="card"><div class="card-body">
          <div class="h5 mb-1">總人數</div><div class="display-6">${total}</div>
          <div class="text-muted small">男：${male} ・ 女：${female}</div>
        </div></div>
      </div>
      <div class="col-md-3"><div class="card"><div class="card-body">
        <div class="h5 mb-1">1樓</div><div class="display-6">${byFloor[0]}</div>
      </div></div></div>
      <div class="col-md-3"><div class="card"><div class="card-body">
        <div class="h5 mb-1">2樓</div><div class="display-6">${byFloor[1]}</div>
      </div></div></div>
      <div class="col-md-3"><div class="card"><div class="card-body">
        <div class="h5 mb-1">3樓</div><div class="display-6">${byFloor[2]}</div>
      </div></div></div>
      <div class="col-md-6"><div class="card mt-3"><div class="card-body">
        <div class="h6">外出/住院</div>
        <div class="text-muted">請假：${leave} ・ 住院：${hosp}</div>
      </div></div></div>
    `;
  }

  // 列表事件：編輯/刪除
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    const row = btn.closest('tr');
    const id = row?.dataset.id;
    if(!id) return;

    if(btn.classList.contains('btn-edit')){
      modalTitle.textContent = '編輯住民資料';
      form.reset();
      try{
        const doc = await db.collection(collectionName).doc(id).get();
        if(doc.exists){
          const d = doc.data();
          nameInput.value = id; nameInput.disabled = true;
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
          modal.show();
        }
      }catch{
        alert('讀取住民資料失敗！');
      }
    }

    if(btn.classList.contains('btn-delete')){
      if(confirm(`確定刪除「${id}」資料？`)){
        await db.collection(collectionName).doc(id).delete();
        fetchResidents();
      }
    }
  });

  addBtn.addEventListener('click', () => {
    modalTitle.textContent = '新增住民';
    form.reset();
    nameInput.disabled = false;
    modal.show();
  });

  saveBtn.addEventListener('click', async () => {
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
    saveBtn.disabled = true;
    try{
      await db.collection(collectionName).doc(name).set(payload, {merge:true});
      modal.hide();
      fetchResidents();
    }catch(err){
      console.error('儲存失敗', err);
      alert('儲存失敗');
    }finally{
      saveBtn.disabled = false;
    }
  });

  // Excel 匯入
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleExcelImport);

  function norm(v){
    if(v===undefined || v===null) return '';
    return String(v).trim();
  }
  function fmtDate(d){
    if(!d) return '';
    if(d instanceof Date && !isNaN(d)) return d.toISOString().slice(0,10);
    // try parse
    const dd = new Date(d);
    return isNaN(dd) ? '' : dd.toISOString().slice(0,10);
  }

  async function handleExcelImport(evt){
    const file = evt.target.files[0];
    if(!file) return;
    importStatus.className = 'alert alert-info';
    importStatus.classList.remove('d-none');
    importStatus.textContent = '正在讀取檔案...';

    const reader = new FileReader();
    reader.onload = async (e)=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

        // 欄位對應（容錯常見別名）
        const pick = (r, keys)=>{
          for(const k of keys){ if(r.hasOwnProperty(k)) return r[k]; }
          return '';
        };

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
          const ref = db.collection(collectionName).doc(name);
          batch.set(ref, payload, {merge:true});
          count++;
        });

        await batch.commit();
        importStatus.className = 'alert alert-success';
        importStatus.textContent = `成功匯入 ${count} 筆資料！重新載入中...`;
        setTimeout(()=> location.reload(), 1500);
      }catch(err){
        console.error('匯入失敗', err);
        importStatus.className = 'alert alert-danger';
        importStatus.textContent = '匯入失敗，請檢查檔案格式。';
      }finally{
        fileInput.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 初始載入
  fetchResidents();
});
