// account-admin.js - 辦公室端帳號管理
// 讀取員工資料：adminStaff / caregivers / localCaregivers / nurses
// 帳號資料：userAccounts/{staffId}

(function(){
  const AUTH_KEY = 'officeAuth';

  // 資料來源顯示中文（value 仍維持原本的 collection 名稱，避免影響既有資料/邏輯）
  const SOURCE_LABEL = {
    adminStaff: '管理員/辦公室',
    caregivers: '照服員',
    localCaregivers: '本國照服員',
    nurses: '護理師'
  };

  const tbody = document.getElementById('tbody');
  const msg = document.getElementById('msg');
  const btnRefresh = document.getElementById('btnRefresh');
  const qInput = document.getElementById('q');
  const sourceFilter = document.getElementById('sourceFilter');
  const statusFilter = document.getElementById('statusFilter');
  const btnCreateMissing = document.getElementById('btnCreateMissing');

  function getAuth(){
    try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch(e){ return null; }
  }

  async function waitForDbReady(){
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }

  function escapeHtml(s){
    return (s ?? '').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  async function ensureOfficeLogin(){
    const auth = getAuth();
    if (!auth || auth.canOffice !== true) {
      alert('請先以可進辦公室的帳號登入。');
      window.location.href = 'office.html';
      return false;
    }
    return true;
  }

  async function loadAllStaff(){
    const sources = ['adminStaff', 'caregivers', 'localCaregivers', 'nurses'];
    const staff = [];

    for (const col of sources) {
      try {
        // 若你有 sortOrder 就用，沒有就直接 get 後排序
        const snap = await db.collection(col).get();
        snap.forEach(doc => {
          const d = doc.data() || {};
          const name = d.name || d.fullName || d.displayName || doc.id;
          staff.push({
            staffId: doc.id,
            name,
            source: col,
          });
        });
      } catch (e) {
        console.warn('讀取集合失敗:', col, e);
      }
    }

    // 去重：同 staffId 若跨表重複，以先出現者為主
    const seen = new Set();
    const uniq = [];
    for (const s of staff) {
      if (seen.has(s.staffId)) continue;
      seen.add(s.staffId);
      uniq.push(s);
    }

    // 排序：先 source 再 staffId
    uniq.sort((a,b)=> (a.source+ a.staffId).localeCompare(b.source+b.staffId,'zh-Hant'));
    return uniq;
  }

  async function loadAccountsMap(){
    const map = new Map();
    try {
      const snap = await db.collection('userAccounts').get();
      snap.forEach(doc => map.set(doc.id, { id: doc.id, ...(doc.data()||{}) }));
    } catch (e) {
      console.warn('讀取 userAccounts 失敗:', e);
    }
    return map;
  }

  function applyFilters(rows){
    const q = (qInput.value || '').trim().toLowerCase();
    const src = sourceFilter.value || '';
    const st = statusFilter.value || '';

    return rows.filter(r=>{
      if (src && r.source !== src) return false;

      const hasAcc = !!r.account;
      if (st === 'has' && !hasAcc) return false;
      if (st === 'none' && hasAcc) return false;

      if (!q) return true;
      const hay = `${r.staffId} ${r.name} ${(r.account?.username||'')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function render(rows){
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">沒有資料</td></tr>`;
      return;
    }

    for (const r of rows) {
      const acc = r.account || {};
      const tr = document.createElement('tr');

      const sourceText = SOURCE_LABEL[r.source] || r.source;

      tr.innerHTML = `
        <td><span class="badge bg-secondary">${escapeHtml(sourceText)}</span></td>
        <td class="mono">${escapeHtml(r.staffId)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>
          <input class="form-control form-control-sm" data-k="username" value="${escapeHtml(acc.username || '')}" placeholder="帳號">
        </td>
        <td>
          <input class="form-control form-control-sm" data-k="password" value="${escapeHtml(acc.password || '')}" placeholder="密碼">
        </td>
        <td class="text-center">
          <input type="checkbox" class="form-check-input" data-k="canOffice" ${acc.canOffice===true?'checked':''}>
        </td>
        <td class="text-center">
          <input type="checkbox" class="form-check-input" data-k="canNurse" ${acc.canNurse===true?'checked':''}>
        </td>
        <td class="text-center">
          <input type="checkbox" class="form-check-input" data-k="canAnnualLeave" ${acc.canAnnualLeave===true?'checked':''}>
        </td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary" data-act="save"><i class="fas fa-floppy-disk me-1"></i>儲存</button>
            <button class="btn btn-sm btn-outline-danger" data-act="clear"><i class="fas fa-trash me-1"></i>清空</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-act="save"]').addEventListener('click', () => saveRow(tr, r));
      tr.querySelector('[data-act="clear"]').addEventListener('click', () => clearRow(tr, r));
      tbody.appendChild(tr);
    }
  }

  function readRowInputs(tr){
    const out = {};
    tr.querySelectorAll('[data-k]').forEach(el=>{
      const k = el.getAttribute('data-k');
      if (el.type === 'checkbox') out[k] = el.checked;
      else out[k] = (el.value || '').trim();
    });
    return out;
  }

  async function saveRow(tr, r){
    const v = readRowInputs(tr);

    if (!v.username) { alert('請輸入帳號'); return; }
    if (!v.password) { alert('請輸入密碼'); return; }

    // 基本資訊同步寫入，方便查詢與顯示
    const payload = {
      staffId: r.staffId,
      displayName: r.name,
      source: r.source,
      username: v.username,
      password: v.password,
      canOffice: !!v.canOffice,
      canNurse: !!v.canNurse,
      canAnnualLeave: !!v.canAnnualLeave,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const ref = db.collection('userAccounts').doc(r.staffId);
      const snap = await ref.get();
      if (!snap.exists) {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      await ref.set(payload, { merge: true });
      msg.textContent = `已儲存：${r.staffId} ${r.name}`;
      // 更新內存
      r.account = payload;
    } catch (e) {
      console.error(e);
      alert('儲存失敗，請稍後再試');
    }
  }

  async function clearRow(tr, r){
    if (!confirm(`確定要清空/刪除 ${r.staffId} ${r.name} 的帳號資料嗎？`)) return;
    try {
      await db.collection('userAccounts').doc(r.staffId).delete();
      msg.textContent = `已刪除：${r.staffId} ${r.name}`;
      // 清空畫面
      tr.querySelectorAll('[data-k]').forEach(el=>{
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
      r.account = null;
    } catch (e) {
      console.error(e);
      alert('刪除失敗，請稍後再試');
    }
  }

  async function createMissing(rows){
    const missing = rows.filter(r => !r.account);
    if (!missing.length) {
      alert('沒有缺少帳號的員工。');
      return;
    }
    if (!confirm(`將為 ${missing.length} 位員工建立帳號（username/password=員工編號），確定嗎？`)) return;

    const batch = db.batch();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    missing.forEach(r=>{
      const ref = db.collection('userAccounts').doc(r.staffId);
      batch.set(ref, {
        staffId: r.staffId,
        displayName: r.name,
        source: r.source,
        username: r.staffId,
        password: r.staffId,
        canOffice: (r.source === 'adminStaff' || r.source === 'localCaregivers'), // 你可自行調整預設
        canNurse: (r.source === 'nurses'),
        canAnnualLeave: false,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    });

    try {
      await batch.commit();
      alert('已建立缺少帳號（可再修改密碼/權限）。');
      await refresh();
    } catch (e) {
      console.error(e);
      alert('批次建立失敗，請稍後再試');
    }
  }

  let allRows = [];

  async function refresh(){
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">載入中...</td></tr>`;
    msg.textContent = '';

    await waitForDbReady();

    const staff = await loadAllStaff();
    const accountsMap = await loadAccountsMap();

    allRows = staff.map(s => ({
      ...s,
      account: accountsMap.get(s.staffId) || null
    }));

    const filtered = applyFilters(allRows);
    render(filtered);
    msg.textContent = `共 ${filtered.length} 筆（總員工 ${allRows.length}）`;
  }

  // 綁定事件
  btnRefresh.addEventListener('click', refresh);
  qInput.addEventListener('input', () => render(applyFilters(allRows)));
  sourceFilter.addEventListener('change', () => render(applyFilters(allRows)));
  statusFilter.addEventListener('change', () => render(applyFilters(allRows)));
  btnCreateMissing.addEventListener('click', () => createMissing(allRows));

  // 啟動
  (async function boot(){
    if (!await ensureOfficeLogin()) return;
    await refresh();
  })();

})();
