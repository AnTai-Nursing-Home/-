(function(){
  const AUTH_KEY = 'officeAuth';
  const SETTINGS_COLLECTION = 'officeAssistantSettings';
  const REMINDER_COLLECTION = 'officeAssistantReminders';
  const POPUP_SESSION_KEY = 'officeAssistant_popup_shown_once';

  const SOURCE_META = {
    incident: { label: '意外事件', badgeId: 'countIncident' },
    maintenance: { label: '器材報修', badgeId: 'countMaintenance' },
    stay: { label: '外宿申請', badgeId: 'countStay' }
  };

  let loginUser = null;
  let reminderModal = null;
  let popupModal = null;
  let cachedTodoData = { incident: [], maintenance: [], stay: [] };
  let stayStatusMap = {};

  function $(id){ return document.getElementById(id); }

  function esc(input){
    return String(input ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function pad2(n){ return String(n).padStart(2,'0'); }

  function getAuth(){
    try{
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  function getCurrentUser(){
    if (loginUser) return loginUser;
    const auth = getAuth();
    if (auth) {
      loginUser = {
        staffId: String(auth.staffId || auth.username || auth.id || '').trim(),
        displayName: String(auth.displayName || auth.name || auth.username || '').trim(),
        username: String(auth.username || '').trim(),
        role: String(auth.role || 'office').trim()
      };
      return loginUser;
    }
    return null;
  }

  function getUserKey(){
    const me = getCurrentUser();
    return String(me?.staffId || me?.username || '').trim();
  }

  async function waitForDbReady(){
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve)=>{
      document.addEventListener('firebase-ready', ()=>resolve(), { once:true });
      setTimeout(resolve, 2500);
    });
  }

  function tsToDate(ts){
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    try{
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }catch(_){
      return null;
    }
  }

  function fmtDate(d, withTime=false){
    const dt = tsToDate(d);
    if (!dt) return '';
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth()+1);
    const day = pad2(dt.getDate());
    if (!withTime) return `${y}/${m}/${day}`;
    return `${y}/${m}/${day} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }

  function combineDateTime(dateStr, timeStr){
    if (!dateStr) return null;
    const [y,m,d] = dateStr.split('-').map(v=>parseInt(v,10));
    let hh = 0, mm = 0;
    if (timeStr){
      const parts = timeStr.split(':').map(v=>parseInt(v,10));
      hh = parts[0] || 0;
      mm = parts[1] || 0;
    }
    return new Date(y, (m||1)-1, d||1, hh, mm, 0, 0);
  }

  function toast(message, type='primary'){
    const wrap = $('assistantToastWrap');
    if (!wrap) return;
    const id = 'toast_' + Math.random().toString(16).slice(2);
    wrap.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center text-bg-${esc(type)} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${esc(message)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `);
    const el = $(id);
    const t = new bootstrap.Toast(el, { delay: 3200 });
    t.show();
    el.addEventListener('hidden.bs.toast', ()=>el.remove());
  }

  function isOnAssistantPage(){
    return !!$('assistantLoginUser');
  }

  function isOnOfficeDashboard(){
    const dashboard = $('dashboard-section-office');
    return !!dashboard && !dashboard.classList.contains('d-none');
  }

  function renderLoginUser(){
    const me = getCurrentUser();
    if ($('assistantLoginUser')) {
      $('assistantLoginUser').textContent = me ? `${me.staffId || ''} ${me.displayName || ''}`.trim() : '未登入';
    }
  }

  async function getUserSettings(){
    const key = getUserKey();
    if (!key) return null;
    const ref = db.collection(SETTINGS_COLLECTION).doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      const initial = {
        staffId: key,
        displayName: getCurrentUser()?.displayName || '',
        todoSources: { incident: true, maintenance: true, stay: true },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await ref.set(initial, { merge:true });
      return { id:key, ...initial };
    }
    return { id:snap.id, ...snap.data() };
  }

  async function saveUserSettings(partial){
    const key = getUserKey();
    if (!key) throw new Error('尚未登入');
    await db.collection(SETTINGS_COLLECTION).doc(key).set({
      staffId: key,
      displayName: getCurrentUser()?.displayName || '',
      ...partial,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge:true });
  }

  async function loadReminders(){
    const key = getUserKey();
    if (!key) return [];
    const snap = await db.collection(REMINDER_COLLECTION)
      .where('staffId','==',key)
      .get();
    const list = [];
    snap.forEach(doc=>{
      list.push({ id:doc.id, ...doc.data() });
    });
    list.sort((a,b)=>{
      const da = tsToDate(a.remindAt)?.getTime() || 0;
      const dbb = tsToDate(b.remindAt)?.getTime() || 0;
      return da - dbb;
    });
    return list;
  }

  function getPriorityBadge(priority){
    const p = String(priority || 'normal');
    if (p === 'urgent') return '<span class="badge text-bg-danger">緊急</span>';
    if (p === 'important') return '<span class="badge text-bg-warning text-dark">重要</span>';
    return '<span class="badge text-bg-secondary">一般</span>';
  }

  function applyReminderFilterSort(list){
    let out = Array.isArray(list) ? list.slice() : [];
    const status = $('filterReminderStatus')?.value || 'pending';
    const sort = $('sortReminder')?.value || 'asc';

    if (status === 'pending') out = out.filter(x=>x.done !== true);
    if (status === 'done') out = out.filter(x=>x.done === true);

    out.sort((a,b)=>{
      const ta = tsToDate(a.remindAt)?.getTime() || 0;
      const tb = tsToDate(b.remindAt)?.getTime() || 0;
      const ca = tsToDate(a.createdAt)?.getTime() || 0;
      const cb = tsToDate(b.createdAt)?.getTime() || 0;
      if (sort === 'desc') return tb - ta;
      if (sort === 'createdDesc') return cb - ca;
      if (sort === 'createdAsc') return ca - cb;
      return ta - tb;
    });
    return out;
  }

  async function renderReminderList(){
    const wrap = $('reminderListWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="assistant-empty">載入中...</div>';
    const list = applyReminderFilterSort(await loadReminders());

    if (!list.length){
      wrap.innerHTML = '<div class="assistant-empty">目前沒有符合條件的提醒事項</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th>日期</th>
              <th>內容</th>
              <th>狀態</th>
              <th>優先</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(item=>{
              const done = item.done === true;
              return `
                <tr class="reminder-row ${done ? 'done' : ''}">
                  <td>${esc(fmtDate(item.remindAt, true))}</td>
                  <td>
                    <div class="reminder-text">${esc(item.text || '')}</div>
                    <div class="small text-muted mt-1">建立：${esc(fmtDate(item.createdAt, true))}</div>
                  </td>
                  <td>${done ? '<span class="badge text-bg-success">已完成</span>' : '<span class="badge text-bg-primary">未完成</span>'}</td>
                  <td>${getPriorityBadge(item.priority)}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-secondary" data-action="toggle-reminder" data-id="${esc(item.id)}">${done ? '取消完成' : '完成'}</button>
                      <button class="btn btn-outline-primary" data-action="edit-reminder" data-id="${esc(item.id)}">編輯</button>
                      <button class="btn btn-outline-danger" data-action="delete-reminder" data-id="${esc(item.id)}">刪除</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function openReminderModal(item=null){
    if (!$('reminderModal')) return;
    $('reminderModalTitle').textContent = item ? '編輯提醒' : '新增提醒';
    $('editingReminderId').value = item?.id || '';
    const dt = tsToDate(item?.remindAt);
    $('reminderDate').value = dt ? `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}` : '';
    $('reminderTime').value = dt ? `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : '';
    $('reminderPriority').value = item?.priority || 'normal';
    $('reminderText').value = item?.text || '';
    $('reminderDone').checked = item?.done === true;
    $('reminderError').classList.add('d-none');
    reminderModal.show();
  }

  async function saveReminderFromModal(){
    const dateStr = $('reminderDate').value;
    const timeStr = $('reminderTime').value;
    const text = String($('reminderText').value || '').trim();
    const priority = $('reminderPriority').value || 'normal';
    const done = $('reminderDone').checked === true;
    const remindAt = combineDateTime(dateStr, timeStr);
    const id = $('editingReminderId').value || '';
    const key = getUserKey();

    if (!key || !dateStr || !text || !remindAt){
      $('reminderError').classList.remove('d-none');
      return;
    }

    const payload = {
      staffId: key,
      displayName: getCurrentUser()?.displayName || '',
      text,
      priority,
      done,
      remindAt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      await db.collection(REMINDER_COLLECTION).doc(id).set(payload, { merge:true });
      toast('提醒已更新', 'success');
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(REMINDER_COLLECTION).add(payload);
      toast('提醒已新增', 'success');
    }

    reminderModal.hide();
    await renderReminderList();
    await refreshTodoPreview();
  }

  async function toggleReminderDone(id){
    const ref = db.collection(REMINDER_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const curr = snap.data() || {};
    await ref.set({
      done: curr.done !== true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge:true });
    await renderReminderList();
    await refreshTodoPreview();
  }

  async function deleteReminder(id){
    if (!confirm('確定要刪除這筆提醒嗎？')) return;
    await db.collection(REMINDER_COLLECTION).doc(id).delete();
    toast('提醒已刪除', 'secondary');
    await renderReminderList();
    await refreshTodoPreview();
  }

  async function bindReminderTableActions(e){
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === 'toggle-reminder') return toggleReminderDone(id);
    if (action === 'delete-reminder') return deleteReminder(id);
    if (action === 'edit-reminder') {
      const snap = await db.collection(REMINDER_COLLECTION).doc(id).get();
      if (snap.exists) openReminderModal({ id:snap.id, ...snap.data() });
    }
  }

  async function loadIncidentTodos(){
    const snap = await db.collection('qcIncidents').get().catch(async ()=>{
      return await db.collection('incidents').get();
    });
    const out = [];
    snap.forEach(doc=>{
      const d = doc.data() || {};
      const reviewed = !!(d.review && d.review.reviewedBy && (d.review.reviewedBy.name || d.review.reviewedBy.uid));
      if (reviewed) return;
      out.push({
        id: doc.id,
        type: d.incidentType || d.type || '意外事件',
        resident: d.residentName || d.name || d.resident || '',
        occurredAt: d.occurredAt || d.eventTime || d.createdAt || null,
        note: d.summary || d.description || d.incidentSummary || ''
      });
    });
    cachedTodoData.incident = out;
    return out;
  }

  function isMaintenanceClosed(status){
    const v = String(status || '').trim();
    return v === '已完成' || v === '紀錄';
  }

  async function loadMaintenanceTodos(){
    const snap = await db.collection('maintenance_requests').get();
    const out = [];
    snap.forEach(doc=>{
      const d = doc.data() || {};
      if (isMaintenanceClosed(d.status)) return;
      out.push({
        id: doc.id,
        category: d.category || '',
        location: d.location || '',
        item: d.item || '',
        detail: d.detail || '',
        reporter: d.reporter || '',
        status: d.status || '待處理',
        createdAt: d.createdAt || null
      });
    });
    cachedTodoData.maintenance = out;
    return out;
  }

  function isStayClosedByName(name){
    const v = String(name || '').trim();
    return ['已完成','完成','結案','已結案','已返家','已返院','已銷案','已取消','取消'].includes(v);
  }

  async function loadStayStatusMap(){
    stayStatusMap = {};
    const snap = await db.collection('stayStatusDefs').get();
    snap.forEach(doc=>{
      const d = doc.data() || {};
      stayStatusMap[doc.id] = { id:doc.id, name:d.name || doc.id, color:d.color || '#6c757d', order:d.order ?? 10 };
    });
  }

  async function loadStayTodos(){
    await loadStayStatusMap();
    const snap = await db.collection('stayApplications').get();
    const out = [];
    snap.forEach(doc=>{
      const d = doc.data() || {};
      const statusId = d.statusId || '';
      const statusName = stayStatusMap[statusId]?.name || statusId || '';
      if (isStayClosedByName(statusName)) return;
      out.push({
        id: doc.id,
        applicantName: d.applicantName || '',
        startDateTime: d.startDateTime || null,
        endDateTime: d.endDateTime || null,
        statusId,
        statusName,
        createdByRole: d.createdByRole || '',
        createdByUserId: d.createdByUserId || ''
      });
    });
    cachedTodoData.stay = out;
    return out;
  }

  async function loadTodoData(){
    const settings = await getUserSettings();
    const sources = settings?.todoSources || { incident:true, maintenance:true, stay:true };

    if (sources.incident) await loadIncidentTodos(); else cachedTodoData.incident = [];
    if (sources.maintenance) await loadMaintenanceTodos(); else cachedTodoData.maintenance = [];
    if (sources.stay) await loadStayTodos(); else cachedTodoData.stay = [];

    updateSourceBadges();
    return cachedTodoData;
  }

  function updateSourceBadges(){
    Object.keys(SOURCE_META).forEach(key=>{
      const badge = $(SOURCE_META[key].badgeId);
      if (badge) badge.textContent = String((cachedTodoData[key] || []).length);
    });
  }

  function renderTodoPreview(){
    const wrap = $('todoPreviewWrap');
    if (!wrap) return;
    const sections = [];

    if (cachedTodoData.incident?.length){
      sections.push(`
        <div class="mb-4">
          <div class="fw-bold mb-2">意外事件未審核（${cachedTodoData.incident.length}）</div>
          <div class="table-responsive"><table class="table table-sm align-middle">
            <thead><tr><th>類別</th><th>住民</th><th>日期</th><th>摘要</th></tr></thead>
            <tbody>
              ${cachedTodoData.incident.map(x=>`
                <tr>
                  <td>${esc(x.type)}</td>
                  <td>${esc(x.resident)}</td>
                  <td>${esc(fmtDate(x.occurredAt, true))}</td>
                  <td>${esc(x.note)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `);
    }

    if (cachedTodoData.maintenance?.length){
      sections.push(`
        <div class="mb-4">
          <div class="fw-bold mb-2">器材報修未完成（${cachedTodoData.maintenance.length}）</div>
          <div class="table-responsive"><table class="table table-sm align-middle">
            <thead><tr><th>分類</th><th>位置</th><th>物品</th><th>狀態</th><th>建立</th></tr></thead>
            <tbody>
              ${cachedTodoData.maintenance.map(x=>`
                <tr>
                  <td>${esc(x.category)}</td>
                  <td>${esc(x.location)}</td>
                  <td>${esc(x.item)}</td>
                  <td>${esc(x.status)}</td>
                  <td>${esc(fmtDate(x.createdAt, true))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `);
    }

    if (cachedTodoData.stay?.length){
      sections.push(`
        <div class="mb-4">
          <div class="fw-bold mb-2">外宿申請待辦（${cachedTodoData.stay.length}）</div>
          <div class="table-responsive"><table class="table table-sm align-middle">
            <thead><tr><th>申請人</th><th>開始</th><th>結束</th><th>狀態</th></tr></thead>
            <tbody>
              ${cachedTodoData.stay.map(x=>`
                <tr>
                  <td>${esc(x.applicantName)}</td>
                  <td>${esc(fmtDate(x.startDateTime, true))}</td>
                  <td>${esc(fmtDate(x.endDateTime, true))}</td>
                  <td>${esc(x.statusName || x.statusId)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `);
    }

    wrap.innerHTML = sections.length ? sections.join('') : '<div class="assistant-empty">目前沒有啟用來源的待辦，或目前待辦為 0</div>';
  }

  async function refreshTodoPreview(){
    if (!getCurrentUser()) return;
    if (isOnAssistantPage()){
      await renderReminderList();
    }
    await loadTodoData();
    renderTodoPreview();
  }

  async function loadSettingsIntoToggles(){
    const settings = await getUserSettings();
    const s = settings?.todoSources || { incident:true, maintenance:true, stay:true };
    if ($('toggleIncident')) $('toggleIncident').checked = s.incident === true;
    if ($('toggleMaintenance')) $('toggleMaintenance').checked = s.maintenance === true;
    if ($('toggleStay')) $('toggleStay').checked = s.stay === true;
  }

  async function handleToggleChange(e){
    const el = e.target;
    if (!el.classList.contains('todo-source-toggle')) return;
    const source = el.dataset.source;
    if (!source) return;
    const settings = await getUserSettings();
    const todoSources = { ...(settings?.todoSources || { incident:true, maintenance:true, stay:true }) };
    todoSources[source] = el.checked === true;
    await saveUserSettings({ todoSources });
    toast('待辦來源設定已更新', 'success');
    await refreshTodoPreview();
  }

  async function buildPopupData(){
    const reminders = (await loadReminders())
      .filter(x=>x.done !== true)
      .filter(x=>{
        const d = tsToDate(x.remindAt);
        if (!d) return false;
        const now = new Date();
        return d.getTime() <= now.getTime();
      })
      .sort((a,b)=>(tsToDate(a.remindAt)?.getTime()||0)-(tsToDate(b.remindAt)?.getTime()||0));

    const settings = await getUserSettings();
    const enabled = settings?.todoSources || { incident:true, maintenance:true, stay:true };
    await loadTodoData();

    const todos = [];
    if (enabled.incident) {
      cachedTodoData.incident.forEach(x=>todos.push({
        source:'意外事件',
        title: `${x.type}${x.resident ? '｜' + x.resident : ''}`,
        sub: fmtDate(x.occurredAt, true),
        note: x.note || ''
      }));
    }
    if (enabled.maintenance) {
      cachedTodoData.maintenance.forEach(x=>todos.push({
        source:'器材報修',
        title: `${x.category}｜${x.location}｜${x.item}`,
        sub: x.status || '',
        note: x.detail || ''
      }));
    }
    if (enabled.stay) {
      cachedTodoData.stay.forEach(x=>todos.push({
        source:'外宿申請',
        title: `${x.applicantName}`,
        sub: `${fmtDate(x.startDateTime, true)} ～ ${fmtDate(x.endDateTime, true)}`,
        note: x.statusName || x.statusId || ''
      }));
    }

    return { reminders, todos };
  }

  async function showHomepagePopup(force=false){
    const me = getCurrentUser();
    if (!me) return;
    if (!$('assistantPopupModal')) return;

    if (!force) {
      const shownKey = `${POPUP_SESSION_KEY}_${getUserKey()}`;
      if (sessionStorage.getItem(shownKey) === '1') return;
      sessionStorage.setItem(shownKey, '1');
    }

    const data = await buildPopupData();
    $('popupReminderCount').textContent = String(data.reminders.length);
    $('popupTodoCount').textContent = String(data.todos.length);

    $('popupReminderList').innerHTML = data.reminders.length ? data.reminders.map(x=>`
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between gap-2">
            <div class="fw-bold">${esc(x.text || '')}</div>
            <div>${getPriorityBadge(x.priority)}</div>
          </div>
          <div class="small text-muted mt-1">${esc(fmtDate(x.remindAt, true))}</div>
        </div>
      </div>
    `).join('') : '<div class="assistant-empty">目前沒有已到提醒日期的個人提醒</div>';

    $('popupTodoList').innerHTML = data.todos.length ? data.todos.map(x=>`
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between gap-2">
            <div class="fw-bold">${esc(x.title)}</div>
            <span class="badge text-bg-dark">${esc(x.source)}</span>
          </div>
          <div class="small text-muted mt-1">${esc(x.sub || '')}</div>
          ${x.note ? `<div class="small mt-2">${esc(x.note)}</div>` : ''}
        </div>
      </div>
    `).join('') : '<div class="assistant-empty">目前沒有待辦事項</div>';

    popupModal.show();
  }

  function bindAssistantPageUI(){
    if ($('btnNewReminder')) $('btnNewReminder').addEventListener('click', ()=>openReminderModal(null));
    if ($('btnSaveReminder')) $('btnSaveReminder').addEventListener('click', saveReminderFromModal);
    if ($('btnRefreshReminder')) $('btnRefreshReminder').addEventListener('click', renderReminderList);
    if ($('filterReminderStatus')) $('filterReminderStatus').addEventListener('change', renderReminderList);
    if ($('sortReminder')) $('sortReminder').addEventListener('change', renderReminderList);
    if ($('reminderListWrap')) $('reminderListWrap').addEventListener('click', bindReminderTableActions);
    document.querySelectorAll('.todo-source-toggle').forEach(el=>el.addEventListener('change', handleToggleChange));
    if ($('btnPreviewPopup')) $('btnPreviewPopup').addEventListener('click', ()=>showHomepagePopup(true));
  }

  async function initAssistantPage(){
    renderLoginUser();
    await loadSettingsIntoToggles();
    await renderReminderList();
    await refreshTodoPreview();
  }

  function watchOfficeDashboard(){
    const dashboard = $('dashboard-section-office');
    if (!dashboard) return;
    let lastVisible = isOnOfficeDashboard();

    const tryPopup = async ()=>{
      if (isOnOfficeDashboard()){
        await showHomepagePopup(false);
      }
    };

    if (lastVisible) {
      setTimeout(tryPopup, 600);
    }

    const obs = new MutationObserver(async ()=>{
      const visible = isOnOfficeDashboard();
      if (visible && !lastVisible){
        setTimeout(tryPopup, 450);
      }
      lastVisible = visible;
    });
    obs.observe(dashboard, { attributes:true, attributeFilter:['class'] });
  }

  async function boot(){
    await waitForDbReady();
    if (!getCurrentUser()) return;

    if ($('reminderModal')) reminderModal = new bootstrap.Modal($('reminderModal'));
    if ($('assistantPopupModal')) popupModal = new bootstrap.Modal($('assistantPopupModal'));

    if (isOnAssistantPage()){
      bindAssistantPageUI();
      await initAssistantPage();
    }

    watchOfficeDashboard();
  }

  document.addEventListener('DOMContentLoaded', function(){
    boot().catch(err=>{
      console.error('office-assistant boot failed:', err);
      toast(err?.message || '輔助系統初始化失敗', 'danger');
    });
  });
})();
