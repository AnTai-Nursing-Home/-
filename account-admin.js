// account-admin.js - 辦公室端帳號管理
// 讀取員工資料：adminStaff / caregivers / localCaregivers / nurses
// 帳號資料：userAccounts/{staffId}

(function(){
  const AUTH_KEY = 'officeAuth';

  // 資料來源顯示中文（value 仍維持原本的 collection 名稱，避免影響既有資料/邏輯）
  const SOURCE_LABEL = {
    adminStaff: '社工/其他',
    caregivers: '外籍照服員',
    localCaregivers: '本國照服員',
    nurses: '護理師'
  };

  const tbody = document.getElementById('tbody');
  const msg = document.getElementById('msg');
  const btnRefresh = document.getElementById('btnRefresh');
  const saveAllBtn = document.getElementById('saveAllBtn');
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

  // ===== 通知/忙碌狀態（Bootstrap Toast + 文字提示） =====
  function ensureToastContainer() {
    let c = document.getElementById('toastContainer');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(c);
    return c;
  }

  function showToast(message, variant = 'success') {
    try {
      const c = ensureToastContainer();
      const el = document.createElement('div');
      el.className = `toast align-items-center text-bg-${variant} border-0`;
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'assertive');
      el.setAttribute('aria-atomic', 'true');
      el.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${escapeHtml(message)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>`;
      c.appendChild(el);
      const t = new bootstrap.Toast(el, { delay: 2500 });
      t.show();
      el.addEventListener('hidden.bs.toast', () => el.remove());
    } catch (e) {
      // fallback
      const msg = document.getElementById('msg');
      if (msg) msg.textContent = message;
    }
  }

  function setMsg(text) {
    const msg = document.getElementById('msg');
    if (msg) msg.textContent = text || '';
  }

  function setButtonBusy(btn, busy, busyText = '處理中...') {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${busyText}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
      delete btn.dataset.origHtml;
    }
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
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">沒有資料</td></tr>`;
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
          <input type="checkbox" class="form-check-input" data-k="canNutritionist" ${acc.canNutritionist===true?'checked':''}>
        </td>

        <td class="text-center">
          <input type="checkbox" class="form-check-input" data-k="canCaregiver" ${acc.canCaregiver===true?'checked':''}>
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

  async function saveAllAccounts(){
    const btn = document.getElementById('saveAllBtn');
    if (!confirm('確定要一次儲存所有帳號的變更嗎？')) return;

    setButtonBusy(btn, true, '儲存中...');
    setMsg('正在批次儲存中...');

    const rows = document.querySelectorAll('#tbody tr[data-id]');
    let ok = 0, fail = 0;

    for (const tr of rows){
      const id = tr.getAttribute('data-id');
      if (!id) continue;

      try{
        const v = readRowInputs(tr);
        if (!v.username || !v.password) { fail++; continue; }

        const payload = {
          username: v.username,
          password: v.password,
          canOffice: !!v.canOffice,
          canNurse: !!v.canNurse,
          canNutritionist: !!v.canNutritionist,
          canCaregiver: !!v.canCaregiver,
          canAnnualLeave: !!v.canAnnualLeave,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('userAccounts').doc(id).set(payload, { merge: true });
        ok++;
      }catch(e){
        console.error('批次儲存失敗', id, e);
        fail++;
      }
    }

    setButtonBusy(btn, false);
    const summary = `批次儲存完成：成功 ${ok} 筆，失敗 ${fail} 筆`;
    setMsg(summary);
    showToast(summary, fail > 0 ? 'warning' : 'success');
  }

  async function saveRow(tr, r){
    const saveBtn = tr.querySelector('[data-act="save"]');
    setButtonBusy(saveBtn, true, '儲存中...');

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
      canNutritionist: !!v.canNutritionist,
      canCaregiver: !!v.canCaregiver,
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
      showToast('儲存失敗，請稍後再試', 'danger');
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
        canNutritionist: (r.source === 'adminStaff' || r.source === 'nurses'), // 你可自行調整預設
        canCaregiver: (r.source === 'caregivers' || r.source === 'localCaregivers'), // 照服員預設可進
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
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">載入中...</td></tr>`;
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
    if (saveAllBtn) saveAllBtn.addEventListener('click', () => saveAllAccounts());
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
