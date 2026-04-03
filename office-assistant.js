(function(){
  const AUTH_KEY = 'officeAuth';
  const SETTINGS_COLLECTION = 'officeAssistantSettings';
  const REMINDER_COLLECTION = 'officeAssistantReminders';
  const POPUP_SHOWN_KEY = 'officeAssistant_popup_shown_for_login';

  let loginUser = null;
  let popupModal = null;
  let reminderModal = null;
  let cachedTodoData = { incident: [], maintenance: [], stay: [] };
  let stayStatusMap = {};
  let popupOpening = false;
  let currentTodoSourceSettings = { incident:true, maintenance:true, stay:true };

  function $(id){ return document.getElementById(id); }
  function esc(input){ return String(input ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function tsToDate(ts){
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    try { const d = new Date(ts); return isNaN(d.getTime()) ? null : d; } catch(_) { return null; }
  }
  function fmtDate(d, withTime=false){
    const dt = tsToDate(d); if (!dt) return '';
    const y = dt.getFullYear(), m = pad2(dt.getMonth()+1), day = pad2(dt.getDate());
    return withTime ? `${y}/${m}/${day} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : `${y}/${m}/${day}`;
  }
  function combineDateTime(dateStr, timeStr){
    if (!dateStr) return null;
    const [y,m,d] = dateStr.split('-').map(v=>parseInt(v,10));
    let hh=0, mm=0;
    if (timeStr){ const p = timeStr.split(':').map(v=>parseInt(v,10)); hh=p[0]||0; mm=p[1]||0; }
    return new Date(y,(m||1)-1,d||1,hh,mm,0,0);
  }
  function getLoadingHtml(text='讀取中...'){ return `<div class="loading-box"><div class="spinner-border text-primary" role="status"></div><div>${esc(text)}</div></div>`; }
  function isSameDay(a,b){ return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }

  function getAuth(){ try{ const raw=sessionStorage.getItem(AUTH_KEY); return raw?JSON.parse(raw):null; }catch(_){ return null; } }
  function getCurrentLoginToken(){ const auth=getAuth(); return String(auth?.loginAt || ''); }
  function hasShownPopupForCurrentLogin(){ const token=getCurrentLoginToken(); return token ? sessionStorage.getItem(POPUP_SHOWN_KEY)===token : false; }
  function markPopupShownForCurrentLogin(){ const token=getCurrentLoginToken(); if (token) sessionStorage.setItem(POPUP_SHOWN_KEY, token); }

  function getCurrentUser(){
    const auth = getAuth();
    if (!auth) { loginUser = null; return null; }
    if (!loginUser || loginUser.staffId !== String(auth.staffId || auth.username || auth.id || '').trim() || loginUser.displayName !== String(auth.displayName || auth.name || auth.username || '').trim()) {
      loginUser = {
        staffId: String(auth.staffId || auth.username || auth.id || '').trim(),
        displayName: String(auth.displayName || auth.name || auth.username || '').trim(),
        username: String(auth.username || '').trim(),
        role: String(auth.role || 'office').trim()
      };
    }
    return loginUser;
  }
  function getUserKey(){ const me = getCurrentUser(); return String(me?.staffId || me?.username || '').trim(); }

  async function waitForDbReady(){
    if (typeof db !== 'undefined' && db) return;
    await new Promise(resolve => {
      document.addEventListener('firebase-ready', ()=>resolve(), { once:true });
      setTimeout(resolve, 2500);
    });
  }

  function toast(message, type='primary'){
    const wrap = $('assistantToastWrap'); if (!wrap) return;
    const id = 'toast_' + Math.random().toString(16).slice(2);
    wrap.insertAdjacentHTML('beforeend', `<div id="${id}" class="toast align-items-center text-bg-${esc(type)} border-0" role="alert"><div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
    const el = $(id); const t = new bootstrap.Toast(el, { delay:3200 }); t.show(); el.addEventListener('hidden.bs.toast', ()=>el.remove());
  }

  function isOnAssistantPage(){ return !!$('assistantLoginUser'); }
  function isOnOfficeDashboard(){ const dashboard = $('dashboard-section-office'); return !!dashboard && !dashboard.classList.contains('d-none'); }
  function renderLoginUser(){ const me=getCurrentUser(); if ($('assistantLoginUser')) $('assistantLoginUser').textContent = me ? `${me.staffId || ''} ${me.displayName || ''}`.trim() : '未登入'; }

  async function getUserSettings(){
    const key=getUserKey(); if (!key) return null;
    const ref=db.collection(SETTINGS_COLLECTION).doc(key); const snap=await ref.get();
    if (!snap.exists){
      const initial={ staffId:key, displayName:getCurrentUser()?.displayName || '', todoSources:{ incident:true, maintenance:true, stay:true }, updatedAt:firebase.firestore.FieldValue.serverTimestamp() };
      await ref.set(initial,{merge:true}); currentTodoSourceSettings=initial.todoSources; return { id:key, ...initial };
    }
    const data={ id:snap.id, ...snap.data() };
    currentTodoSourceSettings={ incident:true, maintenance:true, stay:true, ...(data.todoSources||{}) };
    return data;
  }
  async function saveUserSettings(partial){
    const key=getUserKey(); if (!key) throw new Error('尚未登入');
    await db.collection(SETTINGS_COLLECTION).doc(key).set({ staffId:key, displayName:getCurrentUser()?.displayName || '', ...partial, updatedAt:firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
  }

  async function loadReminders(){
    const key=getUserKey(); if (!key) return [];
    const snap=await db.collection(REMINDER_COLLECTION).where('staffId','==',key).get();
    const list=[]; snap.forEach(doc=>list.push({ id:doc.id, ...doc.data() }));
    list.sort((a,b)=>(tsToDate(a.remindAt)?.getTime()||0)-(tsToDate(b.remindAt)?.getTime()||0));
    return list;
  }
  function getPriorityBadge(priority){
    const p=String(priority||'normal');
    if (p==='urgent') return '<span class="badge text-bg-danger">緊急</span>';
    if (p==='important') return '<span class="badge text-bg-warning text-dark">重要</span>';
    return '<span class="badge text-bg-secondary">一般</span>';
  }
  function applyReminderFilterSort(list){
    let out=Array.isArray(list)?list.slice():[];
    const status=$('filterReminderStatus')?.value || 'pending';
    const sort=$('sortReminder')?.value || 'asc';
    if (status==='pending') out=out.filter(x=>x.done!==true);
    if (status==='done') out=out.filter(x=>x.done===true);
    out.sort((a,b)=>{
      const ta=tsToDate(a.remindAt)?.getTime()||0, tb=tsToDate(b.remindAt)?.getTime()||0;
      const ca=tsToDate(a.createdAt)?.getTime()||0, cb=tsToDate(b.createdAt)?.getTime()||0;
      if (sort==='desc') return tb-ta;
      if (sort==='createdDesc') return cb-ca;
      if (sort==='createdAsc') return ca-cb;
      return ta-tb;
    });
    return out;
  }
  function renderReminderRows(list){
    if (!list.length) return '<div class="assistant-empty">目前沒有資料</div>';
    return `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>日期</th><th>內容</th><th>狀態</th><th>優先</th><th class="text-end">操作</th></tr></thead><tbody>${list.map(item=>{ const done=item.done===true; return `<tr class="${done?'opacity-50':''}"><td>${esc(fmtDate(item.remindAt,true))}</td><td><div style="${done?'text-decoration:line-through;':''}">${esc(item.text||'')}</div><div class="small text-muted mt-1">建立：${esc(fmtDate(item.createdAt,true))}</div></td><td>${done?'<span class="badge text-bg-success">已完成</span>':'<span class="badge text-bg-primary">未完成</span>'}</td><td>${getPriorityBadge(item.priority)}</td><td class="text-end"><div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-action="toggle-reminder" data-id="${esc(item.id)}">${done?'取消完成':'完成'}</button><button class="btn btn-outline-primary" data-action="edit-reminder" data-id="${esc(item.id)}">編輯</button><button class="btn btn-outline-danger" data-action="delete-reminder" data-id="${esc(item.id)}">刪除</button></div></td></tr>`; }).join('')}</tbody></table></div>`;
  }

  async function renderReminderList(){
    const todayWrap=$('todayReminderWrap'), futureWrap=$('futureReminderWrap');
    if (!todayWrap || !futureWrap) return;
    todayWrap.innerHTML=getLoadingHtml('今日提醒讀取中...');
    futureWrap.innerHTML=getLoadingHtml('之後提醒讀取中...');
    const list=applyReminderFilterSort(await loadReminders());
    const now=new Date(), todayList=[], futureList=[];
    list.forEach(item=>{ const dt=tsToDate(item.remindAt); if (!dt) return; if (isSameDay(dt,now)) todayList.push(item); else if (dt.getTime()>now.getTime()) futureList.push(item); else todayList.push(item); });
    if ($('todayReminderCount')) $('todayReminderCount').textContent=String(todayList.length);
    if ($('futureReminderCount')) $('futureReminderCount').textContent=String(futureList.length);
    todayWrap.innerHTML=renderReminderRows(todayList);
    futureWrap.innerHTML=renderReminderRows(futureList);
  }

  function openReminderModal(item=null){
    $('reminderModalTitle').textContent=item?'編輯提醒':'新增提醒';
    $('editingReminderId').value=item?.id||'';
    const dt=tsToDate(item?.remindAt);
    $('reminderDate').value=dt?`${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`:'';
    $('reminderTime').value=dt?`${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`:'';
    $('reminderPriority').value=item?.priority||'normal';
    $('reminderText').value=item?.text||'';
    $('reminderDone').checked=item?.done===true;
    $('reminderError').classList.add('d-none');
    reminderModal.show();
  }
  async function saveReminderFromModal(){
    const dateStr=$('reminderDate').value, timeStr=$('reminderTime').value, text=String($('reminderText').value||'').trim();
    const priority=$('reminderPriority').value||'normal', done=$('reminderDone').checked===true, remindAt=combineDateTime(dateStr,timeStr);
    const id=$('editingReminderId').value||'', key=getUserKey();
    if (!key || !dateStr || !text || !remindAt){ $('reminderError').classList.remove('d-none'); return; }
    const payload={ staffId:key, displayName:getCurrentUser()?.displayName||'', text, priority, done, remindAt, updatedAt:firebase.firestore.FieldValue.serverTimestamp() };
    if (id){ await db.collection(REMINDER_COLLECTION).doc(id).set(payload,{merge:true}); toast('提醒已更新','success'); }
    else { payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(REMINDER_COLLECTION).add(payload); toast('提醒已新增','success'); }
    reminderModal.hide(); await renderReminderList(); await refreshTodoPreview();
  }
  async function toggleReminderDone(id){
    const ref=db.collection(REMINDER_COLLECTION).doc(id), snap=await ref.get(); if (!snap.exists) return;
    const curr=snap.data()||{}; await ref.set({ done:curr.done!==true, updatedAt:firebase.firestore.FieldValue.serverTimestamp() },{merge:true});
    await renderReminderList(); await refreshTodoPreview();
  }
  async function deleteReminder(id){
    if (!confirm('確定要刪除這筆提醒嗎？')) return;
    await db.collection(REMINDER_COLLECTION).doc(id).delete(); toast('提醒已刪除','secondary'); await renderReminderList(); await refreshTodoPreview();
  }
  async function bindReminderTableActions(e){
    const btn=e.target.closest('button[data-action]'); if (!btn) return;
    const action=btn.dataset.action, id=btn.dataset.id; if (!action || !id) return;
    if (action==='toggle-reminder') return toggleReminderDone(id);
    if (action==='delete-reminder') return deleteReminder(id);
    if (action==='edit-reminder'){ const snap=await db.collection(REMINDER_COLLECTION).doc(id).get(); if (snap.exists) openReminderModal({ id:snap.id, ...snap.data() }); }
  }

  function isReviewedIncident(d){ return !!(d && d.review && d.review.reviewedBy && (d.review.reviewedBy.name || d.review.reviewedBy.uid)); }
  async function tryLoadIncidentCollection(name){
    try{
      const snap=await db.collection(name).get(), out=[];
      snap.forEach(doc=>{ const d=doc.data()||{}; if (isReviewedIncident(d)) return; out.push({ id:doc.id, type:d.incidentType||d.type||'意外事件', resident:d.residentName||d.name||d.resident||'', occurredAt:d.occurredAt||d.eventTime||d.createdAt||null, note:d.summary||d.description||d.incidentSummary||'' }); });
      return out;
    }catch(_){ return null; }
  }
  async function loadIncidentTodos(){ let out=await tryLoadIncidentCollection('qc_incidents'); if (out===null) out=await tryLoadIncidentCollection('qcIncidents'); if (out===null) out=await tryLoadIncidentCollection('incidents'); cachedTodoData.incident=Array.isArray(out)?out:[]; }
  function isMaintenanceClosed(status){ const v=String(status||'').trim(); return ['已完成','紀錄','無法修復'].includes(v); }
  async function loadMaintenanceTodos(){
    const snap=await db.collection('maintenance_requests').get(), out=[];
    snap.forEach(doc=>{ const d=doc.data()||{}; if (isMaintenanceClosed(d.status)) return; out.push({ id:doc.id, category:d.category||'', location:d.location||'', item:d.item||'', detail:d.detail||'', reporter:d.reporter||'', status:d.status||'待處理', createdAt:d.createdAt||null }); });
    cachedTodoData.maintenance=out;
  }
  function normalizeText(v){ return String(v||'').trim().toLowerCase(); }
  function isStayClosedByName(name){
    const v=normalizeText(name);
    const keywords=['已完成','完成','結案','已結案','已返家','已返院','已銷案','已取消','取消','核准','退回','駁回','批准','approve','approved','reject','rejected','return','returned'].map(s=>String(s).toLowerCase());
    return keywords.some(k=>v.includes(k));
  }
  async function loadStayStatusMap(){
    stayStatusMap={}; const snap=await db.collection('stayStatusDefs').get();
    snap.forEach(doc=>{ const d=doc.data()||{}; stayStatusMap[doc.id]={ id:doc.id, name:d.name||doc.id }; });
  }
  async function loadStayTodos(){
    await loadStayStatusMap(); const snap=await db.collection('stayApplications').get(), out=[];
    snap.forEach(doc=>{ const d=doc.data()||{}; const statusId=d.statusId||''; const statusName=stayStatusMap[statusId]?.name || statusId || d.status || ''; if (isStayClosedByName(statusName)) return; out.push({ id:doc.id, applicantName:d.applicantName||'', startDateTime:d.startDateTime||null, endDateTime:d.endDateTime||null, statusId, statusName }); });
    cachedTodoData.stay=out;
  }

  function updateSourceBadges(){
    if ($('countIncident')) $('countIncident').textContent=String(cachedTodoData.incident.length);
    if ($('countMaintenance')) $('countMaintenance').textContent=String(cachedTodoData.maintenance.length);
    if ($('countStay')) $('countStay').textContent=String(cachedTodoData.stay.length);
    if ($('kpiIncident')) $('kpiIncident').textContent=String(cachedTodoData.incident.length);
    if ($('kpiMaintenance')) $('kpiMaintenance').textContent=String(cachedTodoData.maintenance.length);
    if ($('kpiStay')) $('kpiStay').textContent=String(cachedTodoData.stay.length);
  }
  async function loadTodoData(){
    const settings=await getUserSettings();
    const sources={ incident:true, maintenance:true, stay:true, ...(settings?.todoSources||{}) };
    currentTodoSourceSettings=sources;
    if (sources.incident) await loadIncidentTodos(); else cachedTodoData.incident=[];
    if (sources.maintenance) await loadMaintenanceTodos(); else cachedTodoData.maintenance=[];
    if (sources.stay) await loadStayTodos(); else cachedTodoData.stay=[];
    updateSourceBadges();
  }
  function renderTodoPreview(){
    const wrap=$('todoPreviewWrap'); if (!wrap) return;
    const blocks=[];
    if (currentTodoSourceSettings.incident && cachedTodoData.incident.length) blocks.push(`<div class="mb-4"><div class="fw-bold mb-2">意外事件未審核（${cachedTodoData.incident.length}）</div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>類別</th><th>住民</th><th>日期</th><th>摘要</th></tr></thead><tbody>${cachedTodoData.incident.map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.resident)}</td><td>${esc(fmtDate(x.occurredAt,true))}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table></div></div>`);
    if (currentTodoSourceSettings.maintenance && cachedTodoData.maintenance.length) blocks.push(`<div class="mb-4"><div class="fw-bold mb-2">器材報修未完成（${cachedTodoData.maintenance.length}）</div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>分類</th><th>位置</th><th>物品</th><th>狀態</th><th>建立</th></tr></thead><tbody>${cachedTodoData.maintenance.map(x=>`<tr><td>${esc(x.category)}</td><td>${esc(x.location)}</td><td>${esc(x.item)}</td><td>${esc(x.status)}</td><td>${esc(fmtDate(x.createdAt,true))}</td></tr>`).join('')}</tbody></table></div></div>`);
    if (currentTodoSourceSettings.stay && cachedTodoData.stay.length) blocks.push(`<div class="mb-4"><div class="fw-bold mb-2">外宿申請待辦（${cachedTodoData.stay.length}）</div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>申請人</th><th>開始</th><th>結束</th><th>狀態</th></tr></thead><tbody>${cachedTodoData.stay.map(x=>`<tr><td>${esc(x.applicantName)}</td><td>${esc(fmtDate(x.startDateTime,true))}</td><td>${esc(fmtDate(x.endDateTime,true))}</td><td>${esc(x.statusName || x.statusId)}</td></tr>`).join('')}</tbody></table></div></div>`);
    wrap.innerHTML=blocks.length?blocks.join(''):'<div class="assistant-empty">目前沒有待辦事項</div>';
  }
  async function refreshTodoPreview(){
    if (!getCurrentUser()) return;
    if ($('todoPreviewWrap')) $('todoPreviewWrap').innerHTML=getLoadingHtml('待辦資料讀取中...');
    if (isOnAssistantPage()) await renderReminderList();
    await loadTodoData();
    renderTodoPreview();
  }

  async function loadSettingsIntoToggles(){
    const settings=await getUserSettings();
    const s={ incident:true, maintenance:true, stay:true, ...(settings?.todoSources||{}) };
    currentTodoSourceSettings=s;
    if ($('toggleIncident')) $('toggleIncident').checked=s.incident===true;
    if ($('toggleMaintenance')) $('toggleMaintenance').checked=s.maintenance===true;
    if ($('toggleStay')) $('toggleStay').checked=s.stay===true;
  }
  async function handleToggleChange(e){
    const el=e.target; if (!el.classList.contains('todo-source-toggle')) return;
    const source=el.dataset.source;
    const settings=await getUserSettings();
    const todoSources={ incident:true, maintenance:true, stay:true, ...(settings?.todoSources||{}) };
    todoSources[source]=el.checked===true;
    currentTodoSourceSettings=todoSources;
    await saveUserSettings({ todoSources });
    toast('待辦來源設定已更新','success');
    await refreshTodoPreview();
  }

  function renderPopupReminderCards(list){
    if (!list.length) return '<div class="assistant-empty p-3">目前沒有資料</div>';
    return list.map(x=>`<div class="popup-item"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-bold">${esc(x.text||'')}</div><div class="small text-muted mt-1">${esc(fmtDate(x.remindAt,true))}</div></div><div class="d-flex flex-column align-items-end gap-2"><span class="popup-tag tag-reminder">提醒</span>${getPriorityBadge(x.priority)}</div></div></div>`).join('');
  }
  function renderPopupReminderList(reminders){
    const now=new Date(), todayList=[], futureList=[];
    reminders.forEach(item=>{ const dt=tsToDate(item.remindAt); if (!dt) return; if (isSameDay(dt,now)) todayList.push(item); else if (dt.getTime()>now.getTime()) futureList.push(item); else todayList.push(item); });
    if ($('popupReminderCount')) $('popupReminderCount').textContent=String(reminders.length);
    if ($('popupTodayReminderCount')) $('popupTodayReminderCount').textContent=String(todayList.length);
    if ($('popupFutureReminderCount')) $('popupFutureReminderCount').textContent=String(futureList.length);
    if ($('popupTodayReminderList')) $('popupTodayReminderList').innerHTML=renderPopupReminderCards(todayList);
    if ($('popupFutureReminderList')) $('popupFutureReminderList').innerHTML=renderPopupReminderCards(futureList);
  }
  function setTodoSectionVisibility(source, visible){
    const map={ incident:'popupSectionIncident', maintenance:'popupSectionMaintenance', stay:'popupSectionStay' };
    const el=$(map[source]); if (el) el.hidden=!visible;
  }
  function renderPopupTodoGroup(targetId, countId, items, source){
    const target=$(targetId), count=$(countId); if (!target||!count) return;
    count.textContent=String(items.length);
    const tagClass=source==='incident'?'tag-incident':source==='maintenance'?'tag-maintenance':'tag-stay';
    const tagText=source==='incident'?'意外事件':source==='maintenance'?'器材報修':'外宿申請';
    if (!items.length){ target.innerHTML='<div class="assistant-empty p-3">目前沒有資料</div>'; return; }
    if (source==='incident'){ target.innerHTML=items.map(x=>`<div class="popup-item"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-bold">${esc(x.type)}${x.resident ? '｜'+esc(x.resident):''}</div><div class="small text-muted mt-1">${esc(fmtDate(x.occurredAt,true))}</div>${x.note?`<div class="mt-2">${esc(x.note)}</div>`:''}</div><span class="popup-tag ${tagClass}">${tagText}</span></div></div>`).join(''); return; }
    if (source==='maintenance'){ target.innerHTML=items.map(x=>`<div class="popup-item"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-bold">${esc([x.category,x.location,x.item].filter(Boolean).join('｜'))}</div><div class="small text-muted mt-1">${esc(x.status||'')}</div>${x.detail?`<div class="mt-2">${esc(x.detail)}</div>`:''}</div><span class="popup-tag ${tagClass}">${tagText}</span></div></div>`).join(''); return; }
    target.innerHTML=items.map(x=>`<div class="popup-item"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-bold">${esc(x.applicantName||'')}</div><div class="small text-muted mt-1">${esc(fmtDate(x.startDateTime,true))} ～ ${esc(fmtDate(x.endDateTime,true))}</div><div class="mt-2">${esc(x.statusName||x.statusId||'')}</div></div><span class="popup-tag ${tagClass}">${tagText}</span></div></div>`).join('');
  }

  async function buildPopupData(){
    const reminders=(await loadReminders()).filter(x=>x.done!==true).sort((a,b)=>(tsToDate(a.remindAt)?.getTime()||0)-(tsToDate(b.remindAt)?.getTime()||0));
    await loadTodoData();
    return { reminders };
  }
  async function showHomepagePopup(force=false){
    if (!getCurrentUser()) return;
    if (popupOpening) return;
    if (!force && hasShownPopupForCurrentLogin()) return;
    popupOpening=true;
    if (!popupModal && $('assistantPopupModal')) popupModal=new bootstrap.Modal($('assistantPopupModal'));
    if (!popupModal){ popupOpening=false; return; }
    if ($('popupLoadingWrap')) $('popupLoadingWrap').innerHTML=getLoadingHtml('通知與待辦讀取中...');
    if ($('popupBodyWrap')) $('popupBodyWrap').style.display='none';
    try{
      const data=await buildPopupData();
      renderPopupReminderList(data.reminders);
      setTodoSectionVisibility('incident', !!currentTodoSourceSettings.incident);
      setTodoSectionVisibility('maintenance', !!currentTodoSourceSettings.maintenance);
      setTodoSectionVisibility('stay', !!currentTodoSourceSettings.stay);
      if (currentTodoSourceSettings.incident) renderPopupTodoGroup('popupTodoIncident','popupCountIncident',cachedTodoData.incident,'incident');
      if (currentTodoSourceSettings.maintenance) renderPopupTodoGroup('popupTodoMaintenance','popupCountMaintenance',cachedTodoData.maintenance,'maintenance');
      if (currentTodoSourceSettings.stay) renderPopupTodoGroup('popupTodoStay','popupCountStay',cachedTodoData.stay,'stay');
      const totalTodo=(currentTodoSourceSettings.incident?cachedTodoData.incident.length:0)+(currentTodoSourceSettings.maintenance?cachedTodoData.maintenance.length:0)+(currentTodoSourceSettings.stay?cachedTodoData.stay.length:0);
      if ($('popupTodoCount')) $('popupTodoCount').textContent=String(totalTodo);
      if ($('popupLoadingWrap')) $('popupLoadingWrap').innerHTML='';
      if ($('popupBodyWrap')) $('popupBodyWrap').style.display='';
      popupModal.show();
      if (!force) markPopupShownForCurrentLogin();
    }catch(err){
      console.error('showHomepagePopup error:',err);
      toast(err?.message || '彈窗載入失敗','danger');
    }finally{ popupOpening=false; }
  }

  function bindAssistantPageUI(){
    $('btnNewReminder')?.addEventListener('click',()=>openReminderModal(null));
    $('btnSaveReminder')?.addEventListener('click',saveReminderFromModal);
    $('btnRefreshReminder')?.addEventListener('click',renderReminderList);
    $('filterReminderStatus')?.addEventListener('change',renderReminderList);
    $('sortReminder')?.addEventListener('change',renderReminderList);
    $('todayReminderWrap')?.addEventListener('click',bindReminderTableActions);
    $('futureReminderWrap')?.addEventListener('click',bindReminderTableActions);
    document.querySelectorAll('.todo-source-toggle').forEach(el=>el.addEventListener('change',handleToggleChange));
    $('btnPreviewPopup')?.addEventListener('click',()=>showHomepagePopup(true));
  }

  async function initAssistantPage(){
    renderLoginUser();
    if ($('todoPreviewWrap')) $('todoPreviewWrap').innerHTML=getLoadingHtml('待辦資料讀取中...');
    if ($('todayReminderWrap')) $('todayReminderWrap').innerHTML=getLoadingHtml('今日提醒讀取中...');
    if ($('futureReminderWrap')) $('futureReminderWrap').innerHTML=getLoadingHtml('之後提醒讀取中...');
    await loadSettingsIntoToggles();
    await renderReminderList();
    await refreshTodoPreview();
  }

  function watchOfficeDashboard(){
    const dashboard=$('dashboard-section-office');
    if (!dashboard) return;
    let lastVisible=isOnOfficeDashboard();
    const tryPopup=async()=>{ loginUser=null; if (isOnOfficeDashboard() && getCurrentUser()) await showHomepagePopup(false); };
    if (lastVisible) setTimeout(tryPopup,700);
    const obs=new MutationObserver(()=>{ const visible=isOnOfficeDashboard(); if (visible && !lastVisible) setTimeout(tryPopup,500); lastVisible=visible; });
    obs.observe(dashboard,{ attributes:true, attributeFilter:['class'] });
    window.addEventListener('office-login-success', ()=>setTimeout(tryPopup, 300));
    document.addEventListener('office-login-success', ()=>setTimeout(tryPopup, 300));
  }

  async function boot(){
    await waitForDbReady();
    if ($('assistantPopupModal')) popupModal=new bootstrap.Modal($('assistantPopupModal'));
    if ($('reminderModal')) reminderModal=new bootstrap.Modal($('reminderModal'));
    if (isOnAssistantPage() && getCurrentUser()){
      renderLoginUser();
      bindAssistantPageUI();
      await initAssistantPage();
    }
    watchOfficeDashboard();
    if (!isOnAssistantPage()) {
      setTimeout(async()=>{ loginUser=null; if (isOnOfficeDashboard() && getCurrentUser()) await showHomepagePopup(false); }, 900);
    }
  }

  window.officeAssistant = { showPopup: ()=>showHomepagePopup(true) };

  document.addEventListener('DOMContentLoaded', ()=>{
    boot().catch(err=>{ console.error('office-assistant boot failed:',err); toast(err?.message || '輔助系統初始化失敗','danger'); });
  });
})();
