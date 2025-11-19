(function(){
  const $ = (id) => document.getElementById(id);
  const state = {
    all: [],        // 原始查詢結果（符合日期條件）
    filtered: [],   // 經搜尋/未來勾選等過濾後
  };

  function fmtDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.toISOString().split('T')[0];
  }

  // --- 登入 ---
  async function handleLogin() {
    const privacyCheck = $('privacyCheck');
    if (!privacyCheck.checked) {
      alert("請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》");
      return;
    }
    const password = $('passwordInput').value;
    if (!password) { alert('請輸入密碼'); return; }

    $('loginButton').disabled = true;
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password })
      });
      const result = await resp.json();
      if (resp.ok && result.success) {
        $('password-section').classList.add('d-none');
        $('toolbar-section').classList.remove('d-none');
        $('stats-section').classList.remove('d-none');
        $('results-section').classList.remove('d-none');
        $('errorMessage').classList.add('d-none');

        // 預設日期：起始=今天 結束=空（代表不限上限）
        const today = fmtDate(new Date());
        $('dateFrom').value = today;
        $('dateTo').value = '';
        loadAndRender();
      } else {
        $('errorMessage').classList.remove('d-none');
      }
    } catch (e) {
      console.error(e);
      alert('登入時發生錯誤，請稍後再試');
    } finally {
      $('loginButton').disabled = false;
    }
  }

  // --- Firestore 查詢 ---
  async function queryBookings(dateFrom, dateTo) {
    const db = window.db;
    if (!db) throw new Error('Firestore 尚未初始化');
    let q = db.collection('bookings');

    if (dateFrom) q = q.where('date', '>=', dateFrom);
    if (dateTo)   q = q.where('date', '<=', dateTo);

    q = q.orderBy('date', 'asc').orderBy('time', 'asc');
    const snap = await q.get();
    const rows = [];
    snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
    return rows;
  }

  function applyFilters() {
    const kw = ($('searchInput').value || '').trim().toLowerCase();
    const futureOnly = $('futureOnly').checked;
    const today = fmtDate(new Date());

    const filtered = state.all.filter(b => {
      if (futureOnly && b.date < today) return false;
      if (!kw) return true;
      const hay = `${b.residentName||''} ${b.bedNumber||''} ${b.visitorRelationship||''}`.toLowerCase();
      return hay.includes(kw);
    });

    state.filtered = filtered;
  }

  function render() {
    const container = $('booking-list');
    if (!state.filtered.length) {
      container.innerHTML = '<p class="text-center my-4">沒有符合條件的預約紀錄。</p>';
      $('stat-total').textContent = '0';
      const from = $('dateFrom').value || '—';
      const to = $('dateTo').value || '—';
      $('stat-range').textContent = `${from} ~ ${to}`;
      return;
    }

    // 依日期分組
    const byDate = {};
    for (const b of state.filtered) {
      if (!byDate[b.date]) byDate[b.date] = [];
      byDate[b.date].push(b);
    }
    const dates = Object.keys(byDate).sort();

    let html = '';
    let total = 0;
    for (const date of dates) {
      const group = byDate[date];
      total += group.length;
      html += `<h5 class="mt-4">${date}</h5>`;
      html += `<table class="table table-sm table-hover table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th style="width: 120px;">時段</th>
            <th>住民姓名</th>
            <th style="width: 110px;">床號</th>
            <th>與住民關係</th>
            <th style="width: 100px;">操作</th>
          </tr>
        </thead>
        <tbody>`;
      for (const b of group) {
        html += `<tr>
          <td>${b.time || ''}</td>
          <td>${b.residentName || ''}</td>
          <td>${b.bedNumber || ''}</td>
          <td>${b.visitorRelationship || '—'}</td>
          <td><button class="btn btn-sm btn-danger btn-admin-delete" data-id="${b.id}">刪除</button></td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }
    $('stat-total').textContent = String(total);
    const from = $('dateFrom').value || '—';
    const to = $('dateTo').value || '—';
    $('stat-range').textContent = `${from} ~ ${to}`;
    $('booking-list').innerHTML = html;
  }

  async function loadAndRender() {
    try {
      const from = $('dateFrom').value || '';
      const to = $('dateTo').value || '';
      $('booking-list').innerHTML = '讀取中...';
      state.all = await queryBookings(from, to);
      applyFilters();
      render();
    } catch (e) {
      console.error('讀取失敗', e);
      $('booking-list').innerHTML = '<div class="alert alert-danger">讀取失敗，請檢查網路或權限。</div>';
    }
  }

  function exportCSV() {
    // 扁平輸出 CSV
    const rows = state.filtered.map(b => ({
      date: b.date || '',
      time: b.time || '',
      residentName: b.residentName || '',
      bedNumber: b.bedNumber || '',
      visitorRelationship: b.visitorRelationship || ''
    }));
    const header = ['日期','時段','住民姓名','床號','與住民關係'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const vals = [r.date, r.time, r.residentName, r.bedNumber, r.visitorRelationship].map(v => {
        v = String(v).replace(/"/g, '""');
        if (v.search(/([",\\n])/g) >= 0) v = `"${v}"`;
        return v;
      });
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\\n')], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const from = $('dateFrom').value || 'ALL';
    const to = $('dateTo').value || 'ALL';
    a.download = `預約名單_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 刪除委派
  function bindDelegates() {
    $('booking-list').addEventListener('click', async (e) => {
      if (!e.target.classList.contains('btn-admin-delete')) return;
      const id = e.target.dataset.id;
      if (!confirm('確定要刪除這筆預約嗎？\\n此操作無法復原。')) return;
      try {
        e.target.disabled = true;
        await db.collection('bookings').doc(id).delete();
        await loadAndRender();
      } catch (err) {
        console.error('刪除失敗', err);
        alert('刪除失敗，請稍後再試。');
        e.target.disabled = false;
      }
    });
  }

  // 事件
  document.addEventListener('DOMContentLoaded', function(){
    $('loginButton').addEventListener('click', handleLogin);
    $('passwordInput').addEventListener('keyup', (e)=>{ if (e.key==='Enter') handleLogin(); });
    $('refresh-btn').addEventListener('click', loadAndRender);
    $('export-btn').addEventListener('click', exportCSV);
    $('dateFrom').addEventListener('change', loadAndRender);
    $('dateTo').addEventListener('change', loadAndRender);
    $('futureOnly').addEventListener('change', ()=>{ applyFilters(); render(); });
    // search debounce
    let t = null;
    $('searchInput').addEventListener('input', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{ applyFilters(); render(); }, 200);
    });
    bindDelegates();
  });
})();
