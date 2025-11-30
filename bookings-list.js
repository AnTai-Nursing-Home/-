// 美觀 + 直觀的預約名單
document.addEventListener('DOMContentLoaded', () => {
  const $list = document.getElementById('booking-list');
  const $refresh = document.getElementById('refresh-btn');
  const $filterName = document.getElementById('filter-name');
  const $filterStart = document.getElementById('filter-start');
  const $btnToday = document.getElementById('btn-today');
  const $btnTomorrow = document.getElementById('btn-tomorrow');
  const $btnWeek = document.getElementById('btn-week');
  const $btnExport = document.getElementById('btn-export');
  const $btnPrint = document.getElementById('btn-print');
  const $countTotal = document.getElementById('count-total');

  const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
  const $delResident = document.getElementById('del-resident');
  const $delDatetime = document.getElementById('del-datetime');
  const $btnConfirmDelete = document.getElementById('btn-confirm-delete');
  let pendingDeleteId = null;

  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate()+n);
    const pad = (x)=>String(x).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const offsetToMonday = (day + 6) % 7;
    const start = addDays(dateStr, -offsetToMonday);
    const end = addDays(start, 6);
    return { start, end };
  }
  function normalizeDash(s){ return String(s||'').replace(/[－—–ｰ‒﹣－]/g,'-'); }
  function parseBed(bed){
    if(!bed) return {floor:Number.MAX_SAFE_INTEGER, pos:Number.MAX_SAFE_INTEGER};
    const s = normalizeDash(String(bed).trim());
    const m = s.match(/^(\d{1,4})(?:-([A-Za-z]|\d{1,3}))?$/);
    if(!m) return {floor:Number.MAX_SAFE_INTEGER, pos:Number.MAX_SAFE_INTEGER};
    const floor = parseInt(m[1],10);
    let pos = 0;
    if(m[2]) pos = /^[A-Za-z]$/.test(m[2]) ? (m[2].toUpperCase().charCodeAt(0)-64)+1000 : parseInt(m[2],10);
    return {floor,pos};
  }

  async function fetchBookings(startDate) {
    const start = startDate || todayStr();
    const snap = await db.collection('bookings')
      .where('date','>=', start)
      .orderBy('date','asc').orderBy('time','asc').get();
    const rows = [];
    snap.forEach(doc => rows.push({ id: doc.id, ...(doc.data()||{}) }));
    return rows;
  }

  function render(list) {
    if(!list || list.length===0){
      $list.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open fa-2x mb-2"></i><div>目前沒有符合條件的預約</div></div>`;
      $countTotal.textContent = 0;
      return;
    }
    // group by date
    const groups = {};
    list.forEach(b => {
      const key = b.date || '';
      if(!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    const dates = Object.keys(groups).sort();
    let html = '';
    let total = 0;
    dates.forEach(date => {
      const items = groups[date].slice().sort((a,b)=>{
        // time asc, then bed number, then residentName
        if((a.time||'') !== (b.time||'')) return (a.time||'').localeCompare(b.time||'');
        const A = parseBed(a.bedNumber), B = parseBed(b.bedNumber);
        if(A.floor !== B.floor) return A.floor - B.floor;
        if(A.pos !== B.pos) return A.pos - B.pos;
        return String(a.residentName||'').localeCompare(String(b.residentName||''), 'zh-Hant-u-kn-true');
      });
      total += items.length;

      html += `<div class="date-divider bg-light p-2 border rounded-2 mt-3 mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <div><i class="fa-regular fa-calendar-days me-2 text-primary"></i><strong>${date}</strong></div>
          <div class="chip">共 ${items.length} 筆</div>
        </div>
      </div>`;

      html += `<table class="table table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th style="width:90px">時段</th>
            <th style="width:140px">床號｜住民</th>
            <th>與住民關係</th>
            <th class="text-end no-print" style="width:100px">操作</th>
          </tr>
        </thead><tbody>`;

      items.forEach(b => {
        const bed = b.bedNumber ? `${b.bedNumber}｜` : '';
        const rel = b.visitorRelationship || '<span class="text-muted">未填寫</span>';
        html += `<tr data-id="${b.id}" data-date="${b.date||''}" data-time="${b.time||''}" data-resident="${b.residentName||''}">
          <td><span class="badge bg-primary-subtle border text-primary">${b.time||''}</span></td>
          <td><div class="fw-semibold">${bed}${b.residentName||''}</div></td>
          <td>${rel}</td>
          <td class="text-end no-print">
            <button class="btn btn-sm btn-outline-danger btn-del"><i class="fa-solid fa-trash-can me-1"></i>刪除</button>
          </td>
        </tr>`;
      });

      html += `</tbody></table>`;
    });
    $list.innerHTML = html;
    $countTotal.textContent = total;
  }

  async function loadAndRender() {
    $list.innerHTML = '<div class="skeleton rounded-3" style="height: 140px;"></div>';
    const start = $filterStart.value || todayStr();
    let rows = await fetchBookings(start);
    // filter by keyword (resident or visitor)
    const kw = ($filterName.value || '').trim();
    if(kw){
      rows = rows.filter(r => String(r.residentName||'').includes(kw) || String(r.visitorName||'').includes(kw) || String(r.visitorRelationship||'').includes(kw));
    }
    render(rows);
  }

  // events
  document.addEventListener('firebase-ready', () => {
    $filterStart.value = todayStr();
    loadAndRender();
  });
  $refresh.addEventListener('click', loadAndRender);
  $filterName.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadAndRender(); });
  $filterStart.addEventListener('change', loadAndRender);
  $btnToday.addEventListener('click', ()=>{ $filterStart.value = todayStr(); loadAndRender(); });
  $btnTomorrow.addEventListener('click', ()=>{ $filterStart.value = addDays(todayStr(),1); loadAndRender(); });
  $btnWeek.addEventListener('click', ()=>{ $filterStart.value = getWeekRange(todayStr()).start; loadAndRender(); });
  $btnPrint.addEventListener('click', ()=> window.print());

  $btnExport.addEventListener('click', async ()=>{
    const start = $filterStart.value || todayStr();
    let rows = await fetchBookings(start);
    const kw = ($filterName.value || '').trim();
    if(kw){
      rows = rows.filter(r => String(r.residentName||'').includes(kw) || String(r.visitorName||'').includes(kw) || String(r.visitorRelationship||'').includes(kw));
    }
    // CSV
    const header = ['日期','時段','住民姓名','床號','與住民關係','文件ID'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      const cells = [r.date||'', r.time||'', r.residentName||'', r.bedNumber||'', r.visitorRelationship||'', r.id||''];
      lines.push(cells.map(x => `"${String(x).replace(/"/g,'""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '預約名單.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // delete with modal confirm
  $list.addEventListener('click', (e)=>{
    const btn = e.target.closest('.btn-del');
    if(!btn) return;
    const tr = btn.closest('tr');
    pendingDeleteId = tr.dataset.id;
    $delResident.textContent = `${tr.dataset.resident}`;
    $delDatetime.textContent = `${tr.dataset.date} ${tr.dataset.time}`;
    modal.show();
  });

  $btnConfirmDelete.addEventListener('click', async ()=>{
    if(!pendingDeleteId) return;
    try {
      $btnConfirmDelete.disabled = true;
      await db.collection('bookings').doc(pendingDeleteId).delete();
      modal.hide();
      pendingDeleteId = null;
      loadAndRender();
    } catch (err) {
      alert('刪除失敗，請稍後再試。');
      console.error(err);
    } finally {
      $btnConfirmDelete.disabled = false;
    }
  });
});
