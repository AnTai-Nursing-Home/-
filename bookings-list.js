document.addEventListener('DOMContentLoaded', () => {
  const bookingListContainer = document.getElementById('booking-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const printBtn = document.getElementById('print-btn');
  const filterDate = document.getElementById('filter-date');
  const filterResident = document.getElementById('filter-resident');
  const countTotal = document.getElementById('count-total');
  const rangeHint = document.getElementById('range-hint');

  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const offsetToMonday = (day + 6) % 7; // Monday=0
    const start = addDays(dateStr, -offsetToMonday);
    const end = addDays(start, 6);
    return { start, end };
  }

  async function loadRawRows() {
    const start = todayStr();
    const snapshot = await db.collection('bookings')
      .where('date', '>=', start)
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

    // 清空保留第一個「全部住民」
    while (filterResident.options.length > 1) filterResident.remove(1);
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
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
    return true; // 'all'
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

  function render(rows) {
    if (!rows || rows.length === 0) {
      bookingListContainer.innerHTML = `
        <div class="state-card">
          <i class="fa-regular fa-calendar-xmark"></i>
          <div class="fw-bold mb-1">目前沒有未來或今日的預約紀錄</div>
          <div class="small">你可以切換「日期篩選 / 住民篩選」再確認一次</div>
        </div>`;
      countTotal.textContent = 0;
      return;
    }

    // group by date
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

      // group by time within this date
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
                    <div class="name">${name}</div>
                    <div class="meta">
                      <span class="badge badge-bed me-1">${bed || '床號未填'}</span>
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

  async function displayBookings() {
    bookingListContainer.innerHTML = `
      <div class="state-card">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <div class="fw-bold">讀取中...</div>
        <div class="small">正在取得今日（含）以後的預約資料</div>
      </div>`;

    try {
      const raw = await loadRawRows();

      populateResidentFilter(raw);

      const mode = filterDate.value || 'all';
      const who = filterResident.value || 'all';
      let rows = raw.filter(r => inDateRange(r, mode));
      if (who !== 'all') rows = rows.filter(r => r.residentName === who);

      // hint
      if (rangeHint) {
        if (mode === 'today') rangeHint.textContent = '僅顯示今天';
        else if (mode === 'tomorrow') rangeHint.textContent = '僅顯示明天';
        else if (mode === 'week') rangeHint.textContent = '僅顯示本週（週一至週日）';
        else rangeHint.textContent = '僅顯示今日（含）以後';
      }

      // Sort by date -> time -> bed -> resident
      rows.sort((a,b)=>{
        if ((a.date||'') !== (b.date||'')) return (a.date||'').localeCompare(b.date||'');
        if ((a.time||'') !== (b.time||'')) return (a.time||'').localeCompare(b.time||'');
        const A = parseBed(a.bedNumber), B = parseBed(b.bedNumber);
        if (A.floor !== B.floor) return A.floor - B.floor;
        if (A.pos !== B.pos) return A.pos - B.pos;
        return String(a.residentName||'').localeCompare(String(b.residentName||''), 'zh-Hant-u-kn-true');
      });

      render(rows);
    } catch (error) {
      console.error("讀取預約列表失敗:", error);
      bookingListContainer.innerHTML = '<div class="alert alert-danger">讀取預約列表失敗，請重新整理頁面。</div>';
    }
  }

  // 初始化：firebase-ready 後載入
  document.addEventListener('firebase-ready', () => displayBookings());
  if (refreshBtn) refreshBtn.addEventListener('click', displayBookings);
  if (printBtn) printBtn.addEventListener('click', () => window.print());
  if (filterDate) filterDate.addEventListener('change', displayBookings);
  if (filterResident) filterResident.addEventListener('change', displayBookings);

  // 刪除
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
