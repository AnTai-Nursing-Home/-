document.addEventListener('firebase-ready', () => {
  const colReq = db.collection('maintenance_requests');
  const colStatus = db.collection('maintenance_status');

  const itemEl = document.getElementById('item');
  const detailEl = document.getElementById('detail');
  const reporterEl = document.getElementById('reporter');
  const btnCreate = document.getElementById('btn-create');
  const tbody = document.getElementById('req-tbody');
  const loading = document.getElementById('loading'); // 顯示「讀取中...」

  let cachedStatuses = []; // 狀態由辦公室端維護

  async function loadStatuses() {
    const snap = await colStatus.orderBy('order', 'asc').get().catch(() => colStatus.get());
    cachedStatuses = snap.docs.map(d => d.id);
  }

  function nowTs() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function fmt(ts) {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function createRequest() {
    const item = itemEl.value.trim();
    const detail = detailEl.value.trim();
    const reporter = reporterEl.value.trim();
    if (!item || !detail || !reporter) return alert('請完整填寫修繕物品、詳細資訊、報修人');

    const defaultStatus = cachedStatuses[0] || '已報修';

    await colReq.add({
      item,
      detail,
      reporter,
      status: defaultStatus,
      createdAt: nowTs(),
      comments: [] // 只讀，辦公室端可新增
    });

    itemEl.value = '';
    detailEl.value = '';
    reporterEl.value = '';
    alert('報修已送出');
    loadList();
  }

  async function loadList() {
    // 顯示「讀取中...」
    loading.style.display = 'block';
    loading.textContent = '讀取中...';
    tbody.innerHTML = '';

    try {
      const snap = await colReq.orderBy('createdAt', 'desc').get().catch(() => colReq.get());
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">目前沒有報修單</td></tr>`;
        return;
      }

      snap.forEach(doc => {
        const d = doc.data();
        const commentsHtml =
          (d.comments || [])
            .sort((a, b) => (a.time?.seconds || 0) - (b.time?.seconds || 0))
            .map(
              c => `
              <div class="comment">
                <div>${c.message || ''}</div>
                <time>${fmt(c.time)}</time>
              </div>
            `
            )
            .join('') || '<span class="text-muted">—</span>';

        const badge = `<span class="badge bg-secondary status-badge">${d.status || '—'}</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${d.item || ''}</td>
          <td>${d.detail || ''}</td>
          <td>${d.reporter || ''}</td>
          <td>${badge}</td>
          <td>${fmt(d.createdAt)}</td>
          <td style="min-width:240px;">${commentsHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('❌ 載入報修清單錯誤：', err);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">資料載入失敗，請稍後重試</td></tr>`;
    } finally {
      // 載入完成隱藏提示
      loading.style.display = 'none';
    }
  }

  btnCreate.addEventListener('click', createRequest);

  (async () => {
    await loadStatuses();
    await loadList();
  })();
});
