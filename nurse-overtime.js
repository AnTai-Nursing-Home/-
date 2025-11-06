document.addEventListener('firebase-ready', () => {
  // ==== Firestore 集合 ====
  const overtimeCollection = 'overtime_requests';
  const deductCollection   = 'deduct_requests';
  const nursesCollection   = 'nurses';

  // ==== 狀態（固定，無管理 UI）====
  const DEFAULT_STATUSES = [
    { name: '待審', color: '#6c757d' },
    { name: '核准', color: '#198754' },
    { name: '退回', color: '#dc3545' }
  ];
  function getStatuses(type){ const v = localStorage.getItem(`status_${type}`); return v? JSON.parse(v): DEFAULT_STATUSES; }

  const modalEntry  = new bootstrap.Modal(document.getElementById('entry-modal'));

  // ==== 讀取護理師名單 ====
  async function loadNurses(){
    const sel = document.getElementById('employee-select');
    sel.innerHTML = '<option value="">讀取中...</option>';
    try{
      const nSnap = await db.collection(nursesCollection).orderBy('sortOrder').get();
      let html = '<option value="">請選擇護理師</option>';
      nSnap.forEach(d=>{ const e=d.data(); html += `<option value="${e.name}" data-id="${e.id||''}">${e.name}</option>`; });
      sel.innerHTML = html;
    }catch(err){
      console.error(err);
      sel.innerHTML = '<option value="">讀取失敗</option>';
    }
  }

  // ==== 儲存（固定 status=待審） ====
  async function saveEntry(){
    const type   = document.getElementById('form-type').value; // 'ot' | 'deduct'
    const editId = document.getElementById('edit-id').value;   // 護理師端不可編輯，僅保留欄位
    const name   = document.getElementById('employee-select').value;
    const opt    = document.querySelector(`#employee-select option[value="${name}"]`);
    const id     = opt ? opt.dataset.id : '';
    const applyDate = document.getElementById('apply-date-input').value || new Date().toISOString().slice(0,10);
    const date   = document.getElementById('date-input').value;
    const hours  = parseFloat(document.getElementById('hours-input').value);
    const reason = document.getElementById('reason-input').value.trim();

    if(!name || !date || !hours || !reason){ return showAlert('提示','請完整填寫必要欄位。','warning'); }

    const coll = (type==='ot')? overtimeCollection : deductCollection;
    const ref  = db.collection(coll);
    const payload = {
      name, id, applyDate, date, hours, reason,
      status: '待審',              // 護理師端不可改狀態
      signName: '',               // 不允許填寫，但保留欄位
      note: '',                   // 不允許填寫，但保留欄位
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
      if(editId){
        return showAlert('限制','護理師端不可編輯已送出的單。','warning');
      }else{
        await ref.add(payload);
      }
      modalEntry.hide();
      renderTable(type);
      alert('✅ 已送出！');
    }catch(err){
      console.error(err);
      showAlert('錯誤','送出失敗，請稍後再試。','danger');
    }
  }

  // ==== 列表渲染（全體資料；唯讀欄位含 signName, note） ====
  async function renderTable(type){
    const tbody = document.querySelector(`#table-${type==='ot'?'ot':'deduct'} tbody`);
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">讀取中...</td></tr>';
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

        html += `<tr>
          <td>${idx++}</td>
          <td>${escapeHTML(e.name||'')}</td>
          <td>${escapeHTML(e.applyDate||'')}</td>
          <td>${escapeHTML(e.date||'')}</td>
          <td>${e.hours||''}</td>
          <td>${escapeHTML(e.reason||'')}</td>
          <td><span class="badge-status" style="color:${color};background:${hexToRgba(color,0.15)};">${escapeHTML(e.status||'')}</span></td>
          <td>${escapeHTML(e.signName||'')}</td>
          <td>${escapeHTML(e.note||'')}</td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="9" class="text-center text-muted">尚無資料</td></tr>';
    }catch(err){
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="9" class="text-danger text-center">讀取失敗</td></tr>';
    }
  }

  // ==== 列印 ====
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
      if (statusFilter && (e.status || '').trim() !== statusFilter.trim()) return;
      if (from && new Date(e.date) < new Date(from)) return;
      if (to && new Date(e.date) > new Date(to)) return;
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
  <th>時數</th><th>原因</th><th>狀態</th><th>主管簽名</th><th>註解</th>
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
  function showAlert(title, message, type='success'){
    const old = document.getElementById('top-alert'); if(old) old.remove();
    const box = document.createElement('div');
    box.id = 'top-alert';
    box.style.position = 'fixed'; box.style.top = '20px'; box.style.left = '50%';
    box.style.transform = 'translateX(-50%)'; box.style.zIndex = '99999';
    box.style.minWidth = '320px'; box.style.maxWidth = '90%';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)'; box.style.borderRadius = '12px';
    box.style.overflow = 'hidden'; box.style.background = '#fff'; box.style.border = '1px solid rgba(0,0,0,.1)';
    const colors = { success:'#198754', danger:'#dc3545', warning:'#ffc107' };
    const bar = document.createElement('div'); bar.style.height = '6px'; bar.style.background = colors[type] || '#0d6efd'; box.appendChild(bar);
    const content = document.createElement('div'); content.style.padding = '14px 16px';
    content.innerHTML = `
      <div style="font-weight:700; font-size:16px; margin-bottom:6px;">${escapeHTML(title)}</div>
      <div style="font-size:14px; margin-bottom:12px;">${escapeHTML(message)}</div>
      <div style="text-align:right;"><button id="top-alert-ok" class="btn btn-primary btn-sm">確定</button></div>`;
    box.appendChild(content);
    document.body.appendChild(box);
    document.getElementById('top-alert-ok').addEventListener('click', ()=> box.remove());
  }

  // ==== 綁定 ====
  document.getElementById('btn-save-entry').addEventListener('click', saveEntry);

  // 加班
  document.getElementById("btn-new-ot").addEventListener('click', async ()=>{
    await loadNurses();
    document.getElementById('form-type').value='ot';
    document.getElementById('entry-form').reset();
    document.getElementById('edit-id').value='';
    document.getElementById('apply-date-input').value = new Date().toISOString().slice(0,10);
    document.getElementById('entry-modal-title').textContent='新增加班單';
    document.getElementById('date-label').textContent='加班日';
    modalEntry.show();
  });
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
  document.getElementById("btn-new-deduct").addEventListener('click', async ()=>{
    await loadNurses();
    document.getElementById('form-type').value='deduct';
    document.getElementById('entry-form').reset();
    document.getElementById('edit-id').value='';
    document.getElementById('apply-date-input').value = new Date().toISOString().slice(0,10);
    document.getElementById('entry-modal-title').textContent='新增扣班單';
    document.getElementById('date-label').textContent='扣班日';
    modalEntry.show();
  });
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
  function fillFilterOptions(type){
    const sel = document.getElementById(`filter-status-${type}`);
    if(!sel) return;
    sel.innerHTML = '<option value="">全部狀態</option>';
    getStatuses(type).forEach(s=>{
      const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; sel.appendChild(o);
    });
  }
  fillFilterOptions('ot');
  fillFilterOptions('deduct');
  renderTable('ot');
  renderTable('deduct');

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', e => {
      const tabId = e.target.id;
      if (tabId === 'ot-tab') renderTable('ot');
      else if (tabId === 'deduct-tab') renderTable('deduct');
    });
  });
});
