document.addEventListener('firebase-ready', () => {
  // ==== Firestore 集合名稱 ====
  const overtimeCollection = 'overtime_requests';
  const deductCollection   = 'deduct_requests';
  const nursesCollection   = 'nurses';
  const caregiversCollection = 'caregivers';

  // ==== 狀態（localStorage 保存）====
  const DEFAULT_STATUSES = [
    { name: '待審', color: '#6c757d' },
    { name: '核准', color: '#198754' },
    { name: '退回', color: '#dc3545' }
  ];
  function getStatuses(type){ const v = localStorage.getItem(`status_${type}`); return v? JSON.parse(v): DEFAULT_STATUSES; }
  function setStatuses(type, arr){ localStorage.setItem(`status_${type}`, JSON.stringify(arr)); fillFilterOptions(type); }

  // ==== Modal ====
  const modalEntry  = new bootstrap.Modal(document.getElementById('entry-modal'));
  const modalStatus = new bootstrap.Modal(document.getElementById('status-modal'));

  // ==== 讀取員工（只讀）====
  async function loadEmployees(){
    const sel = document.getElementById('employee-select');
    sel.innerHTML = '<option value="">讀取中...</option>';
    try{
      const [nSnap, cSnap] = await Promise.all([
        db.collection(nursesCollection).orderBy('sortOrder').get(),
        db.collection(caregiversCollection).orderBy('sortOrder').get()
      ]);
      let html = '<option value="">請選擇員工</option>';
      nSnap.forEach(d=>{ const e=d.data(); html += `<option value="${e.name}" data-id="${e.id}">${e.name}（護理師）</option>`;});
      cSnap.forEach(d=>{ const e=d.data(); html += `<option value="${e.name}" data-id="${e.id}">${e.id?e.name+'（照服員）':e.name}</option>`;});
      sel.innerHTML = html;
    }catch(err){
      console.error(err);
      sel.innerHTML = '<option value="">讀取失敗</option>';
    }
  }

  // ==== 儲存 ====
  async function saveEntry(){
    const type   = document.getElementById('form-type').value; // 'ot'|'deduct'
    const editId = document.getElementById('edit-id').value;
    const name   = document.getElementById('employee-select').value;
    const opt    = document.querySelector(`#employee-select option[value="${name}"]`);
    const id     = opt ? opt.dataset.id : '';
    const applyDate = document.getElementById('apply-date-input').value || new Date().toISOString().slice(0,10);
    const date   = document.getElementById('date-input').value;
    const hours  = parseFloat(document.getElementById('hours-input').value);
    const reason = document.getElementById('reason-input').value.trim();
    const status = document.getElementById('status-select').value;
    const signName = document.getElementById('sign-name-input').value.trim();
    const note     = document.getElementById('note-input').value.trim();
    const file     = document.getElementById('sign-image-input').files[0];

    if(!name || !date || !hours || !reason){ return showAlert('提示','請完整填寫必要欄位。','warning'); }

    const coll = (type==='ot')? overtimeCollection : deductCollection;
    const ref  = db.collection(coll);
    const payload = { name,id,applyDate,date,hours,reason,status,signName,note, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

    const saveToDB = async (imgData)=>{
      if(imgData) payload.signImage = imgData;
      if(editId) await ref.doc(editId).set(payload,{merge:true});
      else       await ref.add(payload);

      document.getElementById('edit-id').value = ''; // 避免覆蓋
      modalEntry.hide();
      renderTable(type);
      showAlert('提示','✅ 資料已成功送出！','success');
    };

    if(file){
      const reader = new FileReader();
      reader.onload = ()=> saveToDB(reader.result);
      reader.readAsDataURL(file);
    }else{
      saveToDB(null);
    }
  }

  // ==== 列表渲染 ====
  async function renderTable(type){
    const tbody = document.querySelector(`#table-${type==='ot'?'ot':'deduct'} tbody`);
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">讀取中...</td></tr>';
    const coll = (type==='ot')? overtimeCollection : deductCollection;

    try{
      const statusFilter = document.getElementById(`filter-status-${type}`).value || '';
      const from = document.getElementById(`filter-from-${type}`).value;
      const to   = document.getElementById(`filter-to-${type}`).value;

      const snap = await db.collection(coll).orderBy('date','desc').get();
      let html = '', idx=1, statuses=getStatuses(type);
      snap.forEach(doc=>{
        const e = doc.data();
        if(statusFilter && e.status!==statusFilter) return;
        if(from && e.date<from) return;
        if(to && e.date>to) return;

        const s = statuses.find(x=>x.name===e.status);
        const color = s? s.color : '#999';
        const signBlock = `${e.signName?`<div>${escapeHTML(e.signName)}</div>`:''}${e.signImage?`<img src="${e.signImage}" class="signature-img">`:''}`;

        html += `<tr>
          <td>${idx++}</td>
          <td>${escapeHTML(e.name||'')}</td>
          <td>${escapeHTML(e.applyDate||'')}</td>
          <td>${escapeHTML(e.date||'')}</td>
          <td>${e.hours||''}</td>
          <td>${escapeHTML(e.reason||'')}</td>
          <td><span class="badge-status" style="color:${color};background:${hexToRgba(color,0.15)};">${escapeHTML(e.status||'')}</span></td>
          <td>${signBlock}</td>
          <td>${escapeHTML(e.note||'')}</td>
          <td class="no-print">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editEntry('${type}','${doc.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger me-1" onclick="deleteEntry('${type}','${doc.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="10" class="text-center text-muted">尚無資料</td></tr>';
    }catch(err){
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="10" class="text-danger text-center">讀取失敗</td></tr>';
    }
  }

  // ==== 編輯 / 刪除 ====
  window.editEntry = async function(type, docId){
    const coll = (type==='ot')? overtimeCollection : deductCollection;
    const d = await db.collection(coll).doc(docId).get();
    if(!d.exists) return;
    const e = d.data();

    document.getElementById('form-type').value = type;
    document.getElementById('edit-id').value = docId;
    document.getElementById('entry-modal-title').textContent = `編輯${type==='ot'?'加班單':'扣班單'}`;
    document.getElementById('date-label').textContent = type==='ot'?'加班日':'扣班日';

    await loadEmployees();
    document.getElementById('employee-select').value = e.name || '';
    document.getElementById('apply-date-input').value = e.applyDate || new Date().toISOString().slice(0,10);
    document.getElementById('date-input').value  = e.date  || '';
    document.getElementById('hours-input').value = e.hours || '';
    document.getElementById('reason-input').value= e.reason|| '';
    document.getElementById('sign-name-input').value = e.signName || '';
    document.getElementById('note-input').value     = e.note || '';
    fillStatusSelect(type, e.status);

    modalEntry.show();
  };

  window.deleteEntry = async function(type, docId){
    if(!confirm('確定要刪除此筆資料嗎？')) return;
    const coll = (type==='ot')? overtimeCollection : deductCollection;
    await db.collection(coll).doc(docId).delete();
    renderTable(type);
    showAlert('提示','🗑️ 資料已刪除','danger');
  };

  // ==== 狀態管理 ====
  let currentStatusType = 'ot';
  function openStatusManager(type){ currentStatusType = type; renderStatusList(type); modalStatus.show(); }
  function renderStatusList(type){
    const box = document.getElementById('status-list');
    const list = getStatuses(type);
    box.innerHTML = '';
    list.forEach((s,i)=>{
      const row = document.createElement('div');
      row.className = 'd-flex justify-content-between align-items-center border rounded p-2';
      row.innerHTML = `
        <div><span class="status-color me-2" style="background:${s.color}"></span>${s.name}</div>
        <div>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editStatus('${type}',${i})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStatus('${type}',${i})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      box.appendChild(row);
    });
  }
  window.editStatus = function(type,i){
    const list = getStatuses(type); const s = list[i];
    const newName = prompt('修改狀態名稱', s.name); if(newName===null) return;
    const newColor= prompt('修改顏色（#RRGGBB）', s.color); if(newColor===null) return;
    list[i] = { name: newName.trim()||s.name, color: (/^#([0-9A-Fa-f]{6})$/.test(newColor)? newColor : s.color) };
    setStatuses(type, list); renderStatusList(type);
  };
  window.deleteStatus = function(type,i){
    const list = getStatuses(type);
    if(!confirm(`刪除狀態「${list[i].name}」？`)) return;
    list.splice(i,1); setStatuses(type,list); renderStatusList(type);
  };
  document.getElementById('btn-add-status').addEventListener('click', ()=>{
    const name = document.getElementById('status-name').value.trim();
    const color= document.getElementById('status-color').value;
    if(!name) return showAlert('提示','請輸入狀態名稱','warning');
    const list = getStatuses(currentStatusType);
    if(list.some(s=>s.name===name)) return showAlert('提示','狀態已存在','warning');
    list.push({name,color}); setStatuses(currentStatusType,list);
    document.getElementById('status-name').value=''; renderStatusList(currentStatusType);
  });
  function fillStatusSelect(type, selected=''){
    const sel = document.getElementById('status-select'); sel.innerHTML='';
    getStatuses(type).forEach(s=>{
      const o = document.createElement('option'); o.value=s.name; o.textContent=s.name;
      if(s.name===selected) o.selected = true; sel.appendChild(o);
    });
  }
  function fillFilterOptions(type){
    const sel = document.getElementById(`filter-status-${type}`);
    sel.innerHTML = '<option value="">全部狀態</option>';
    getStatuses(type).forEach(s=>{
      const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; sel.appendChild(o);
    });
  }

  // ==== 匯出 Excel（需引入 SheetJS） ====
  async function exportExcel(type){
    const coll = (type==='ot')? overtimeCollection : deductCollection;
    const snap = await db.collection(coll).orderBy('date','desc').get();
    const data=[];
    snap.forEach(doc=>{
      const e=doc.data();
      data.push({ 姓名:e.name, 申請日:e.applyDate, 日期:e.date, 時數:e.hours, 原因:e.reason, 狀態:e.status, 主管簽名:e.signName||'', 注解:e.note||'' });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, type==='ot'?'加班單':'扣班單');
    XLSX.writeFile(wb, (type==='ot'?'加班單':'扣班單') + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  // ==== 正式列印（橫向 A4） ====
  async function printFormalTable(type){
    const coll = (type==='ot')? overtimeCollection : deductCollection;
    const title= type==='ot' ? '加班單' : '扣班單';
    const statusFilter = document.getElementById(`filter-status-${type}`).value || '';
    const from = document.getElementById(`filter-from-${type}`).value || '';
    const to   = document.getElementById(`filter-to-${type}`).value   || '';

    const all = await db.collection(coll).orderBy('date','asc').get();
    const rows = [];
    all.forEach(doc=>{
      const e=doc.data();
      if(statusFilter && e.status!==statusFilter) return;
      if(from && e.date<from) return;
      if(to && e.date>to) return;
      rows.push(e);
    });
    if(rows.length===0) return showAlert('提示','目前沒有符合篩選條件的資料可列印','warning');

    let html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: "Microsoft JhengHei", sans-serif; text-align: center; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin: 6px 0 15px; }
  table { width: 100%; border-collapse: collapse; margin: 0 auto; font-size: 14px; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; vertical-align: middle; }
  th { background: #f5f5f5; font-weight: bold; }
</style></head><body>
<h1>安泰醫療社團法人附設安泰護理之家</h1>
<h2>${title}</h2>
<table><thead><tr>
  <th>序號</th><th>姓名</th><th>申請日</th><th>${type==='ot'?'加班日':'扣班日'}</th>
  <th>時數</th><th>原因</th><th>狀態</th><th>主管簽名</th><th>注解</th>
</tr></thead><tbody>`;
    rows.forEach((e,i)=>{
      html += `<tr>
        <td>${i+1}</td>
        <td>${escapeHTML(e.name||'')}</td>
        <td>${escapeHTML(e.applyDate||'')}</td>
        <td>${escapeHTML(e.date||'')}</td>
        <td>${e.hours||''}</td>
        <td>${escapeHTML(e.reason||'')}</td>
        <td>${escapeHTML(e.status||'')}</td>
        <td>${escapeHTML(e.signName||'')}</td>
        <td>${escapeHTML(e.note||'')}</td>
      </tr>`;
    });
    html += `</tbody></table></body></html>`;

    const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  // ==== 公用 ====
  function escapeHTML(str){ return str? str.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : ''; }
  function hexToRgba(hex, a){ const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }

  // ==== 提示（上方置中、需按「確定」才關閉） ====
  function showAlert(title, message, type='success'){
    // 先移除舊框
    const old = document.getElementById('top-alert'); if(old) old.remove();

    // 外層容器
    const box = document.createElement('div');
    box.id = 'top-alert';
    box.style.position = 'fixed';
    box.style.top = '20px';
    box.style.left = '50%';
    box.style.transform = 'translateX(-50%)';
    box.style.zIndex = '99999';
    box.style.minWidth = '320px';
    box.style.maxWidth = '90%';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)';
    box.style.borderRadius = '12px';
    box.style.overflow = 'hidden';
    box.style.background = '#fff';
    box.style.border = '1px solid rgba(0,0,0,.1)';

    // 色條
    const colors = { success:'#198754', danger:'#dc3545', warning:'#ffc107' };
    const bar = document.createElement('div');
    bar.style.height = '6px';
    bar.style.background = colors[type] || '#0d6efd';
    box.appendChild(bar);

    // 內容
    const content = document.createElement('div');
    content.style.padding = '14px 16px';
    content.innerHTML = `
      <div style="font-weight:700; font-size:16px; margin-bottom:6px;">${escapeHTML(title)}</div>
      <div style="font-size:14px; margin-bottom:12px;">${escapeHTML(message)}</div>
      <div style="text-align:right;">
        <button id="top-alert-ok" class="btn btn-primary btn-sm">確定</button>
      </div>`;
    box.appendChild(content);

    document.body.appendChild(box);
    document.getElementById('top-alert-ok').addEventListener('click', ()=> box.remove());
  }

  // ==== 綁定 ====
  document.getElementById('btn-save-entry').addEventListener('click', saveEntry);

  // 加班
  document.getElementById('btn-new-ot').addEventListener('click', async ()=>{
    await loadEmployees(); fillStatusSelect('ot');
    document.getElementById('form-type').value='ot';
    document.getElementById('entry-form').reset();
    document.getElementById('edit-id').value='';
    document.getElementById('apply-date-input').value = new Date().toISOString().slice(0,10);
    document.getElementById('entry-modal-title').textContent='新增加班單';
    document.getElementById('date-label').textContent='加班日'; modalEntry.show();
  });
  document.getElementById('btn-status-ot').addEventListener('click', ()=> openStatusManager('ot'));
  document.getElementById('btn-export-ot').addEventListener('click', ()=> exportExcel('ot'));
  document.getElementById('btn-print-ot').addEventListener('click', ()=> printFormalTable('ot'));
  document.getElementById('btn-clear-ot').addEventListener('click', ()=>{
    document.getElementById('filter-status-ot').value='';
    document.getElementById('filter-from-ot').value='';
    document.getElementById('filter-to-ot').value='';
    renderTable('ot');
  });
  ['filter-status-ot','filter-from-ot','filter-to-ot'].forEach(id=>{
    document.getElementById(id).addEventListener('change', ()=> renderTable('ot'));
  });

  // 扣班
  document.getElementById('btn-new-deduct').addEventListener('click', async ()=>{
    await loadEmployees(); fillStatusSelect('deduct');
    document.getElementById('form-type').value='deduct';
    document.getElementById('entry-form').reset();
    document.getElementById('edit-id').value='';
    document.getElementById('apply-date-input').value = new Date().toISOString().slice(0,10);
    document.getElementById('entry-modal-title').textContent='新增扣班單';
    document.getElementById('date-label').textContent='扣班日'; modalEntry.show();
  });
  document.getElementById('btn-status-deduct').addEventListener('click', ()=> openStatusManager('deduct'));
  document.getElementById('btn-export-deduct').addEventListener('click', ()=> exportExcel('deduct'));
  document.getElementById('btn-print-deduct').addEventListener('click', ()=> printFormalTable('deduct'));
  document.getElementById('btn-clear-deduct').addEventListener('click', ()=>{
    document.getElementById('filter-status-deduct').value='';
    document.getElementById('filter-from-deduct').value='';
    document.getElementById('filter-to-deduct').value='';
    renderTable('deduct');
  });
  ['filter-status-deduct','filter-from-deduct','filter-to-deduct'].forEach(id=>{
    document.getElementById(id).addEventListener('change', ()=> renderTable('deduct'));
  });

  // ==== 初始化 ====
  fillFilterOptions('ot'); fillFilterOptions('deduct');
  renderTable('ot'); renderTable('deduct');
});
