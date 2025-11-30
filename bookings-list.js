document.addEventListener('DOMContentLoaded', () => {
  const bookingListContainer = document.getElementById('booking-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const printBtn = document.getElementById('print-btn');
  const filterDate = document.getElementById('filter-date');
  const filterResident = document.getElementById('filter-resident');
  const countTotal = document.getElementById('count-total');

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
    for (let i = filterResident.options.length - 1; i >= 1; i--) filterResident.remove(i);
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

  function render(rows) {
    if (!rows || rows.length === 0) {
      bookingListContainer.innerHTML = '<p class="text-center">目前沒有未來或今日的預約紀錄。</p>';
      countTotal.textContent = 0;
      return;
    }

    // group by date
    const groups = {};
    rows.forEach(b => {
      const k = b.date || '';
      if (!groups[k]) groups[k] = [];
      groups[k].push(b);
    });
    const dates = Object.keys(groups).sort();
    let html = '';
    let total = 0;

    dates.forEach(date => {
      const list = groups[date];
      total += list.length;
      html += `<h4>${date}</h4>`;
      html += `<table class="table table-bordered table-striped table-hover">
        <thead class="table-light">
          <tr>
            <th>時段</th>
            <th>住民姓名</th>
            <th>床號</th>
            <th>與住民關係</th>
            <th style="width:100px;" class="no-print">操作</th>
          </tr>
        </thead>
        <tbody>`;
      list.forEach(b => {
        html += `<tr>
          <td>${b.time || ''}</td>
          <td>${b.residentName || ''}</td>
          <td>${b.bedNumber || ''}</td>
          <td>${b.visitorRelationship || '未填寫'}</td>
          <td class="no-print"><button class="btn btn-sm btn-danger btn-admin-delete" data-id="${b.id}">刪除</button></td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });

    bookingListContainer.innerHTML = html;
    countTotal.textContent = total;
  }

  async function displayBookings() {
    bookingListContainer.innerHTML = '讀取中...';
    try {
      // 讀取原始資料
      const raw = await loadRawRows();

      // 先填住民下拉
      populateResidentFilter(raw);

      // 下拉篩選
      const mode = filterDate.value || 'all';
      const who = filterResident.value || 'all';
      let rows = raw.filter(r => inDateRange(r, mode));
      if (who !== 'all') rows = rows.filter(r => r.residentName === who);

      // 同日期內再排序：時段 → 床號 → 住民（盡量不動視覺樣式）
      const normDash = s => String(s || '').replace(/[－—–ｰ‒﹣－]/g, '-');
      const parseBed = (bed) => {
        if (!bed) return { floor: Number.MAX_SAFE_INTEGER, pos: Number.MAX_SAFE_INTEGER };
        const s = normDash(String(bed).trim());
        const m = s.match(/^(\\d{1,4})(?:-([A-Za-z]|\\d{1,3}))?$/);
        if (!m) return { floor: Number.MAX_SAFE_INTEGER, pos: Number.MAX_SAFE_INTEGER };
        const floor = parseInt(m[1], 10);
        let pos = 0;
        if (m[2]) pos = /^[A-Za-z]$/.test(m[2]) ? (m[2].toUpperCase().charCodeAt(0)-64)+1000 : parseInt(m[2],10);
        return { floor, pos };
      };
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
    if (!e.target.classList.contains('btn-admin-delete')) return;
    const docId = e.target.dataset.id;
    if (confirm('確定要刪除這筆預約嗎？\\n此操作無法復原。')) {
      try {
        e.target.disabled = true;
        await db.collection('bookings').doc(docId).delete();
        alert('預約已刪除！');
        displayBookings();
      } catch (error) {
        console.error("管理員刪除失敗:", error);
        alert("刪除失敗，請稍後再試。");
        e.target.disabled = false;
      }
    }
  });
});
