
document.addEventListener('DOMContentLoaded', () => {
  const bookingListContainer = document.getElementById('booking-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const printBtn = document.getElementById('print-btn');
  const filterDate = document.getElementById('filter-date');
  const filterResident = document.getElementById('filter-resident');
  const countTotal = document.getElementById('count-total');
  const rangeHint = document.getElementById('range-hint');
  const printStartInput = document.getElementById('print-start');
  const printEndInput = document.getElementById('print-end');
  const confirmPrintBtn = document.getElementById('confirm-print-btn');

  const printRangeModal = document.getElementById('printRangeModal');
  const printModal = (printRangeModal && window.bootstrap)
    ? new bootstrap.Modal(printRangeModal)
    : null;

  let lastRawRows = [];
  let isPrintingRange = false;
  let restoreAfterPrint = null;

  function getLoginUser(){
    const candidates = [
      {store: sessionStorage, key: 'antai_session_user'},
      {store: localStorage,  key: 'antai_session_user'},
      {store: sessionStorage, key: 'currentUser'},
      {store: localStorage,  key: 'currentUser'},
      {store: sessionStorage, key: 'loginUser'},
      {store: localStorage,  key: 'loginUser'},
    ];
    for (const c of candidates){
      try{
        const raw = c.store.getItem(c.key);
        if(!raw) continue;
        const u = JSON.parse(raw);
        const empNo = String(u?.staffId || u?.empNo || u?.username || u?.id || '').trim();
        const name  = String(u?.displayName || u?.name || u?.staffName || '').trim();
        if(empNo || name) return { empNo, name };
      }catch(e){}
    }
    return { empNo: '', name: '' };
  }

  function setPrintFooter(rangeText=''){
    const footer = document.getElementById('print-footer');
    if(!footer) return;
    const u = getLoginUser();
    const label = [u.empNo, u.name].filter(Boolean).join(' ');
    const who = label ? `列印人: ${label}` : '列印人:（未登入）';
    footer.textContent = rangeText ? `${who}　｜　列印區間: ${rangeText}` : who;
  }

  function todayStr() {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    const pad = (x) => String(x).padStart(2, '0');
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

  async function loadRawRows(startDate = todayStr(), endDate = '') {
    let query = db.collection('bookings');

    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate) query = query.where('date', '<=', endDate);

    const snapshot = await query
      .orderBy('date', 'asc')
      .orderBy('time', 'asc')
      .get();

    const rows = [];
    snapshot.forEach(doc => rows.push({ id: doc.id, ...(doc.data() || {}) }));
    return rows;
  }

  function populateResidentFilter(rows) {
    const set = new Set();
    rows.forEach(r => { if (r.residentName) set.add(r.residentName); });
    const names = Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant-u-kn-true'));

    while (filterResident.options.length > 1) filterResident.remove(1);
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      filterResident.appendChild(opt);
    });
  }

  function inDateRange(row, mode) {
    const t = row.date || '';
    const today = todayStr();
    if (mode === 'today') return t === today;
    if (mode === 'tomorrow') return t === addDays(today, 1);
    if (mode === 'week') {
      const { start, end } = getWeekRange(today);
      return t >= start && t <= end;
    }
    return true;
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

  function safeId(s){
    return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }

  function render(rows, options = {}) {
    const {
      emptyTitle = '目前沒有未來或今日的預約紀錄',
      emptyDesc = '你可以切換「日期篩選 / 住民篩選」再確認一次'
    } = options;

    if (!rows || rows.length === 0) {
      bookingListContainer.innerHTML = `
        <div class="state-card">
          <i class="fa-regular fa-calendar-xmark"></i>
          <div class="fw-bold mb-1">${emptyTitle}</div>
          <div class="small">${emptyDesc}</div>
        </div>`;
      countTotal.textContent = 0;
      return;
    }

    const byDate = {};
    rows.forEach(b => {
      const k = b.date || '';
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push(b);
    });

    const dates = Object.keys(byDate).sort();
    let total = 0;

    let html = `<div class="accordion" id="bookingAccordion">`;

    dates.forEach((date, idx) => {
      const list = byDate[date];
      total += list.length;

      const byTime = {};
      list.forEach(b => {
        const t = b.time || '';
        if (!byTime[t]) byTime[t] = [];
        byTime[t].push(b);
      });
      const times = Object.keys(byTime).sort();

      const accId = `acc-${safeId(date)}-${idx}`;
      const collapseId = `col-${safeId(date)}-${idx}`;

      html += `
        <div class="accordion-item">
          <h2 class="accordion-header" id="${accId}">
            <button class="accordion-button ${idx === 0 ? '' : 'collapsed'}" type="button"
              data-bs-toggle="collapse" data-bs-target="#${collapseId}"
              aria-expanded="${idx === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
              <div class="d-flex align-items-center justify-content-between w-100 pe-2">
                <div class="d-flex align-items-center gap-2">
                  <i class="fa-regular fa-calendar"></i>
                  <span>${date}</span>
                </div>
                <span class="badge bg-secondary">${list.length} 筆</span>
              </div>
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}" aria-labelledby="${accId}" data-bs-parent="#bookingAccordion">
            <div class="accordion-body">`;

      times.forEach(time => {
        const items = byTime[time].slice().sort((a,b)=>{
          const A = parseBed(a.bedNumber), B = parseBed(b.bedNumber);
          if (A.floor !== B.floor) return A.floor - B.floor;
          if (A.pos !== B.pos) return A.pos - B.pos;
          return String(a.residentName||'').localeCompare(String(b.residentName||''), 'zh-Hant-u-kn-true');
        });

        html += `
          <div class="slot-card">
            <div class="slot-head">
              <div>
                <div class="slot-time"><i class="fa-regular fa-clock me-1"></i>${time}</div>
                <div class="slot-meta">${items.length} 筆｜床號排序</div>
              </div>
              <span class="badge bg-light text-dark" style="border-radius:999px;border:1px solid rgba(17,24,39,.08);">時段</span>
            </div>
            <div class="list-group list-group-flush">`;

        items.forEach(b => {
          const rel = b.visitorRelationship || '未填寫';
          const bed = b.bedNumber || '';
          const name = b.residentName || '';
          html += `
              <div class="list-group-item">
                <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <div class="me-auto">
                    <div class="name">
                      ${name}
                      <span class="badge badge-bed">${bed || '床號未填'}</span>
                    </div>
                    <div class="meta">
                      <span><i class="fa-solid fa-people-arrows me-1"></i>${rel}</span>
                    </div>
                  </div>
                  <div class="no-print">
                    <button class="btn btn-sm btn-danger btn-admin-delete" data-id="${b.id}">
                      <i class="fa-solid fa-trash-can me-1"></i>刪除
                    </button>
                  </div>
                </div>
              </div>`;
        });

        html += `
            </div>
          </div>`;
      });

      html += `</div></div></div>`;
    });

    html += `</div>`;

    bookingListContainer.innerHTML = html;
    countTotal.textContent = total;
  }

  function sortRows(rows){
    return rows.slice().sort((a,b)=>{
      if ((a.date||'') !== (b.date||'')) return (a.date||'').localeCompare(b.date||'');
      if ((a.time||'') !== (b.time||'')) return (a.time||'').localeCompare(b.time||'');
      const A = parseBed(a.bedNumber), B = parseBed(b.bedNumber);
      if (A.floor !== B.floor) return A.floor - B.floor;
      if (A.pos !== B.pos) return A.pos - B.pos;
      return String(a.residentName||'').localeCompare(String(b.residentName||''), 'zh-Hant-u-kn-true');
    });
  }

  async function displayBookings() {
    bookingListContainer.innerHTML = `
      <div class="state-card">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <div class="fw-bold">讀取中...</div>
        <div class="small">正在取得今日（含）以後的預約資料</div>
      </div>`;

    try {
      const raw = await loadRawRows(todayStr(), '');
      lastRawRows = raw.slice();

      populateResidentFilter(raw);

      const mode = filterDate.value || 'all';
      const who = filterResident.value || 'all';
      let rows = raw.filter(r => inDateRange(r, mode));
      if (who !== 'all') rows = rows.filter(r => r.residentName === who);

      if (rangeHint) {
        if (mode === 'today') rangeHint.textContent = '僅顯示今天';
        else if (mode === 'tomorrow') rangeHint.textContent = '僅顯示明天';
        else if (mode === 'week') rangeHint.textContent = '僅顯示本週（週一至週日）';
        else rangeHint.textContent = '僅顯示今日（含）以後';
      }

      render(sortRows(rows), {
        emptyTitle: '目前沒有未來或今日的預約紀錄',
        emptyDesc: '你可以切換「日期篩選 / 住民篩選」再確認一次'
      });
    } catch (error) {
      console.error("讀取預約列表失敗:", error);
      bookingListContainer.innerHTML = '<div class="alert alert-danger">讀取預約列表失敗，請重新整理頁面。</div>';
    }
  }

  async function printWithRange() {
    const start = (printStartInput?.value || '').trim();
    const end = (printEndInput?.value || '').trim();

    if (start && end && start > end) {
      alert('開始日期不能晚於結束日期。');
      return;
    }

    bookingListContainer.innerHTML = `
      <div class="state-card">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <div class="fw-bold">準備列印中...</div>
        <div class="small">正在取得你選擇區間的預約資料</div>
      </div>`;

    try {
      isPrintingRange = true;
      restoreAfterPrint = {
        filterDate: filterDate?.value || 'all',
        filterResident: filterResident?.value || 'all'
      };

      const raw = await loadRawRows(start || '', end || '');
      let rows = sortRows(raw);

      const rangeText = `${start || '最早'} ～ ${end || '最晚'}`;
      setPrintFooter(rangeText);

      if (rangeHint) rangeHint.textContent = `列印區間：${rangeText}`;

      render(rows, {
        emptyTitle: '此列印區間沒有預約資料',
        emptyDesc: '請重新選擇列印開始日與結束日。'
      });

      if (printModal) printModal.hide();

      setTimeout(() => {
        window.print();
      }, 220);

    } catch (error) {
      console.error('列印區間讀取失敗:', error);
      alert('讀取列印區間資料失敗，請稍後再試。');
      isPrintingRange = false;
      await displayBookings();
    }
  }

  async function restoreNormalViewIfNeeded() {
    if (!isPrintingRange) return;
    isPrintingRange = false;
    setPrintFooter('');

    if (restoreAfterPrint) {
      if (filterDate) filterDate.value = restoreAfterPrint.filterDate || 'all';
      if (filterResident) filterResident.value = restoreAfterPrint.filterResident || 'all';
    }
    await displayBookings();
  }

  document.addEventListener('firebase-ready', () => {
    if (printStartInput) printStartInput.value = todayStr();
    if (printEndInput) printEndInput.value = '';
    displayBookings();
  });

  if (refreshBtn) refreshBtn.addEventListener('click', displayBookings);

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const today = todayStr();
      if (printStartInput && !printStartInput.value) printStartInput.value = today;
      if (printModal) printModal.show();
      else printWithRange();
    });
  }

  if (confirmPrintBtn) confirmPrintBtn.addEventListener('click', printWithRange);

  if (filterDate) filterDate.addEventListener('change', displayBookings);
  if (filterResident) filterResident.addEventListener('change', displayBookings);

  window.addEventListener('beforeprint', () => {
    try { if (!isPrintingRange) setPrintFooter(''); } catch(e){}
  });

  window.addEventListener('afterprint', () => {
    restoreNormalViewIfNeeded();
  });

  bookingListContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-admin-delete');
    if (!btn) return;
    const docId = btn.dataset.id;
    if (confirm('確定要刪除這筆預約嗎？\n此操作無法復原。')) {
      try {
        btn.disabled = true;
        await db.collection('bookings').doc(docId).delete();
        alert('預約已刪除！');
        displayBookings();
      } catch (error) {
        console.error("管理員刪除失敗:", error);
        alert("刪除失敗，請稍後再試。");
        btn.disabled = false;
      }
    }
  });
});
