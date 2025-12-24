/* consult.js
   照會系統（護理師 ↔ 營養師）
   - 住民資料：Firestore collection 'residents'（bedNumber + name）
   - 照會資料：Firestore collection 'consults'
   - 附件：Firebase Storage（可上傳檔案、照片）
   - 通知：頁面 Toast + (可選) 瀏覽器 Notification
*/

(function () {
  const ROLE = getRoleFromQuery(); // 'nurse' | 'nutritionist'
  const roleBadge = document.getElementById('roleBadge');
  const dbStatus = document.getElementById('dbStatus');
  const createCard = document.getElementById('createCard');

  const notifyToggle = document.getElementById('notifyToggle');
  const btnAskNotification = document.getElementById('btnAskNotification');
  const notifyHint = document.getElementById('notifyHint');

  const bedSelect = document.getElementById('bedSelect');
  const nameInput = document.getElementById('nameInput');
  const subjectInput = document.getElementById('subjectInput');
  const descInput = document.getElementById('descInput');
  const nurseFiles = document.getElementById('nurseFiles');

  const btnSubmit = document.getElementById('btnSubmit');
  const btnClear = document.getElementById('btnClear');

  const refTableBody = document.getElementById('refTableBody');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnBack = document.getElementById('btnBack');

  // Modal elements
  const refModalEl = document.getElementById('refModal');
  const mBed = document.getElementById('mBed');
  const mName = document.getElementById('mName');
  const mSubject = document.getElementById('mSubject');
  const mDesc = document.getElementById('mDesc');
  const mNurseFiles = document.getElementById('mNurseFiles');
  const mReply = document.getElementById('mReply');
  const replyHint = document.getElementById('replyHint');
  const mNutFiles = document.getElementById('mNutFiles');
  const mNutFilesList = document.getElementById('mNutFilesList');
  const btnSaveReply = document.getElementById('btnSaveReply');
  // 動態加入「刪除照會單」按鈕（僅護理師顯示）
  let btnDeleteConsult = null;
  (function ensureDeleteBtn(){
    if (ROLE !== 'nurse') return;
    const modalEl = document.getElementById('refModal');
    const footer = modalEl?.querySelector('.modal-footer');
    if (!footer) return;
    btnDeleteConsult = document.createElement('button');
    btnDeleteConsult.type = 'button';
    btnDeleteConsult.className = 'btn btn-outline-danger me-auto';
    btnDeleteConsult.innerHTML = '<i class="fa-solid fa-trash-can me-1"></i>刪除照會單';
    btnDeleteConsult.addEventListener('click', () => {
      if (!currentModalId) return;
      deleteConsultById(currentModalId);
    });
    footer.insertBefore(btnDeleteConsult, footer.firstChild);
  })();


  // 動態加入「列印 / 匯出 Word」按鈕（護理師、營養師皆可用）
  let btnPrintConsult = null;
  let btnExportWord = null;
  (function ensurePrintExportBtns(){
    const modalEl = document.getElementById('refModal');
    const footer = modalEl?.querySelector('.modal-footer');
    if (!footer) return;

    // 列印
    btnPrintConsult = document.createElement('button');
    btnPrintConsult.type = 'button';
    btnPrintConsult.className = 'btn btn-outline-secondary';
    btnPrintConsult.id = 'btnPrintConsult';
    btnPrintConsult.innerHTML = '<i class="fa-solid fa-print me-1"></i>列印照會單';
    btnPrintConsult.addEventListener('click', () => {
      const c = consults.find(x => x.id === currentModalId);
      if (!c) return toast('找不到此照會資料', 'warning');
      printConsult(c);
    });

    // 匯出 Word
    btnExportWord = document.createElement('button');
    btnExportWord.type = 'button';
    btnExportWord.className = 'btn btn-outline-primary';
    btnExportWord.id = 'btnExportWord';
    btnExportWord.innerHTML = '<i class="fa-solid fa-file-word me-1"></i>匯出 Word';
    btnExportWord.addEventListener('click', async () => {
      const c = consults.find(x => x.id === currentModalId);
      if (!c) return toast('找不到此照會資料', 'warning');
      await exportConsultToWord(c);
    });

    // 插入位置：放在「關閉」之前（footer 最左側若有刪除按鈕則保持在最左）
    const closeBtn = footer.querySelector('[data-bs-dismiss="modal"]');
    if (closeBtn) {
      footer.insertBefore(btnExportWord, closeBtn);
      footer.insertBefore(btnPrintConsult, btnExportWord);
    } else {
      footer.appendChild(btnPrintConsult);
      footer.appendChild(btnExportWord);
    }
  })();


  let db = null;
  let storage = null;
  let residents = [];         // {id, bedNumber, name, residentNumber}
  let consults = [];          // full list from db
  let currentModalId = null;

  // notification tracking
  const LS_NOTIFY = 'consult_notify_enabled';
  const LS_LAST_SEEN = ROLE === 'nurse' ? 'consult_last_seen_nurse' : 'consult_last_seen_nut';
  let unsubConsults = null;

  initUIBasics();

  // -------- Init flow --------
  if (window.db && window.firebase) {
    setupFirebase();
    start();
  } else {
    // Try listen to custom event used elsewhere in your system
    document.addEventListener('firebase-ready', () => {
      setupFirebase();
      start();
    });
    // fallback: wait briefly for firebase-init.js
    window.addEventListener('load', () => {
      if (!db && window.db && window.firebase) {
        setupFirebase();
        start();
      }
    });
  }

  function setupFirebase() {
    db = window.db || (window.firebase && firebase.firestore());
    try {
      storage = firebase.storage();
    } catch (e) {
      storage = null;
    }
  }

  async function start() {
    try {
      if (!db) {
      setDbStatus(false, 'Firebase 尚未初始化，請確認 firebase-init.js');
      toast('Firebase 尚未初始化，請確認 firebase-init.js', 'danger');
      return;
    }
    setDbStatus(true, 'Firebase 已連線');

    // back button default
    // ✅ 依 from / referrer / 角色決定返回位置（避免回到輸入密碼頁）
    const spBack = new URLSearchParams(location.search);
    const from = (spBack.get('from') || '').toLowerCase();
    const ref = (document.referrer || '').toLowerCase();
    const sameOrigin = document.referrer && document.referrer.startsWith(location.origin);

    // 預設：回各自系統入口
    let backHref = (ROLE === 'nutritionist')
      ? './nutritionist/nutritionist.html'
      : './admin.html?view=dashboard';

    // 明確指定 from
    if (from.includes('nutritionist')) backHref = '/nutritionist/nutritionist.html';
    if (from.includes('nurse')) backHref = '/admin.html?view=dashboard';

    // 如果 referrer 是同站且不是 consult 頁，就優先回 referrer（最符合你實際入口路徑）
    // 但：護理師一律回護理師儀表板（避免回到密碼頁）
    if (ROLE !== 'nurse' && sameOrigin && ref && !ref.includes('consult')) {
      // 但若 referrer 是事務登入（密碼頁），改回「事務儀表板」參數版
      if (ref.includes('affairs') && (ref.includes('password') || ref.includes('login'))) {
        backHref = './affairs.html?view=dashboard';
      } else {
        backHref = document.referrer;
      }
    }

    // 護理師：一律回護理師儀表板（避免回到密碼頁）
    if (ROLE === 'nurse') {
      backHref = '/admin.html?view=dashboard';
    }

    btnBack.href = backHref;

    
    // 強制用 JS 導航，避免被外部頁面/快取 referrer 影響
    btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.assign(backHref);
    });
await loadResidents();
    wireCreateForm();
    wireListControls();
    await loadConsultsOnce();
    renderTable();

    startRealtimeIfEnabled();
      } catch (e) {
      console.error(e);
      setDbStatus(false, '載入失敗：' + (e.message || e));
      toast('載入失敗：' + (e.message || e), 'danger');
      // show error row
      refTableBody.innerHTML = `<tr><td colspan=\"6\" class=\"text-center text-danger py-4\">載入失敗：${escapeHtml(e.message || String(e))}</td></tr>`;
    }
  }

  function initUIBasics() {
    const roleText = ROLE === 'nutritionist' ? '營養師' : '護理師';
    roleBadge.textContent = `角色：${roleText}`;
    createCard.style.display = (ROLE === 'nurse') ? '' : 'none';

    // nutritionist can edit reply; nurse read-only in modal
    const canReply = ROLE === 'nutritionist';
    mReply.readOnly = !canReply;
    mNutFiles.disabled = !canReply;
    btnSaveReply.style.display = canReply ? '' : 'none';
    replyHint.textContent = canReply
      ? '營養師：填寫回覆後按「儲存回覆」。'
      : '護理師：此區由營養師回覆。';

    // notifications toggle
    notifyToggle.checked = (localStorage.getItem(LS_NOTIFY) === '1');
    updateNotifyHint();
    notifyToggle.addEventListener('change', () => {
      localStorage.setItem(LS_NOTIFY, notifyToggle.checked ? '1' : '0');
      updateNotifyHint();
      startRealtimeIfEnabled(true);
    });

    window.addEventListener('resize', () => forceTableLayoutFix());

    btnAskNotification.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        toast('此瀏覽器不支援 Notification API。', 'warning');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') toast('已允許瀏覽器通知。', 'success');
      else toast('瀏覽器通知未允許（你仍可使用頁面內訊息）。', 'warning');
      updateNotifyHint();
    });
  }

  function updateNotifyHint() {
    const enabled = notifyToggle.checked;
    let msg = enabled ? '已開啟：有新照會/新回覆會跳出訊息。' : '關閉中：不會跳出即時訊息。';
    if ('Notification' in window) {
      msg += `（瀏覽器通知：${Notification.permission}）`;
    }
    notifyHint.textContent = msg;
  }

  function setDbStatus(ok, msg) {
    dbStatus.textContent = ok ? msg : msg;
    dbStatus.className = ok ? 'text-success' : 'text-danger';
  }

  // -------- Residents --------
  async function loadResidents() {
    // Pull residents and sort by bedNumber (custom sort)
    const snap = await db.collection('residents').get();
    residents = snap.docs
      .map(d => ({ id: d.id, _docId: d.id, ...d.data() }))
      .filter(r => r && r.bedNumber)
      .map(r => ({
        id: r.id,
        bedNumber: String(r.bedNumber || '').trim(),
        // 有些住民文件沒有 name 欄位（文件 ID 可能就是姓名），所以用欄位優先、再用 docId 當備援
        name: String(r.name || r.residentName || r.resident || r._docId || '').trim(),
        residentNumber: r.residentNumber || ''
      }));

    residents.sort((a, b) => compareBed(a.bedNumber, b.bedNumber));
    buildBedDropdown();
  }

  function buildBedDropdown() {
    if (!bedSelect) return;
    bedSelect.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '請選擇床號';
    bedSelect.appendChild(opt0);

    for (const r of residents) {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.bedNumber;
      opt.dataset.name = r.name || '';
      opt.dataset.bed = r.bedNumber;
      bedSelect.appendChild(opt);
    }
  }

  function wireCreateForm() {
    if (ROLE !== 'nurse') return;

    bedSelect.addEventListener('change', () => {
      const selected = bedSelect.options[bedSelect.selectedIndex];
      let nm = (selected && selected.dataset && selected.dataset.name) ? selected.dataset.name : '';
      if (!nm) {
        // fallback: 用 residentId 去 residents 陣列找
        const rid = bedSelect.value;
        const r = residents.find(x => x.id === rid);
        nm = r ? (r.name || '') : '';
      }
      nameInput.value = nm;
    });

    btnClear.addEventListener('click', () => {
      bedSelect.value = '';
      nameInput.value = '';
      subjectInput.value = '';
      descInput.value = '';
      nurseFiles.value = '';
    });

    btnSubmit.addEventListener('click', async () => {
      try {
        const residentId = bedSelect.value;
        if (!residentId) return toast('請先選擇床號。', 'warning');
        const selected = bedSelect.options[bedSelect.selectedIndex];
        const bedNumber = selected.dataset.bed || '';
        const residentName = selected.dataset.name || '';
        const subject = (subjectInput.value || '').trim();
        const desc = (descInput.value || '').trim();

        if (!subject) return toast('請填寫照會主旨。', 'warning');
        if (!desc) return toast('請填寫照會說明。', 'warning');

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>送出中…';

        const createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const baseDoc = {
          residentId,
          bedNumber,
          residentName,
          subject,
          description: desc,
          nurseAttachments: [],
          nutritionistReply: '',
          nutritionistAttachments: [],
          status: 'open',
          createdAt,
          updatedAt: createdAt,
          lastActionBy: 'nurse',
          nurseReadAt: createdAt,         // nurse created → considered read by nurse
          nutritionistReadAt: null
        };

        // create doc first to get id for storage folder
        const ref = await db.collection('consults').add(baseDoc);

        // upload attachments
        const files = nurseFiles.files ? Array.from(nurseFiles.files) : [];
        const uploaded = await uploadFilesIfAny(ref.id, 'nurse', files);
        if (uploaded.length) {
          await db.collection('consults').doc(ref.id).update({
            nurseAttachments: uploaded,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        toast('照會單已送出。', 'success');
        btnClear.click();

        // refresh local list quickly
        await loadConsultsOnce();
        renderTable();
        bumpLastSeen();

      } catch (e) {
        console.error(e);
        toast('送出失敗：' + (e.message || e), 'danger');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>送出照會單';
      }
    });
  }

  // -------- Consults list --------
  function wireListControls() {
    btnRefresh.addEventListener('click', async () => {
      await loadConsultsOnce();
      renderTable();
    });

    const rerender = () => renderTable();
    searchInput.addEventListener('input', rerender);
    statusFilter.addEventListener('change', rerender);

    btnSaveReply.addEventListener('click', async () => {
      if (ROLE !== 'nutritionist') return;
      if (!currentModalId) return;

      const reply = (mReply.value || '').trim();
      const files = mNutFiles.files ? Array.from(mNutFiles.files) : [];

      try {
        btnSaveReply.disabled = true;
        btnSaveReply.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>儲存中…';

        const uploaded = await uploadFilesIfAny(currentModalId, 'nutritionist', files);

        const update = {
          nutritionistReply: reply,
          status: 'replied',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastActionBy: 'nutritionist',
          nurseReadAt: null, // make nurse "unread" again
          nutritionistReadAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (uploaded.length) {
          // merge with existing already in modal list (which reflects db)
          const existing = consults.find(c => c.id === currentModalId)?.nutritionistAttachments || [];
          update.nutritionistAttachments = existing.concat(uploaded);
        }

        await db.collection('consults').doc(currentModalId).update(update);

        toast('回覆已儲存。', 'success');
        mNutFiles.value = '';

        await loadConsultsOnce();
        renderTable();
        openModalById(currentModalId); // refresh modal content
        bumpLastSeen();

      } catch (e) {
        console.error(e);
        toast('儲存失敗：' + (e.message || e), 'danger');
      } finally {
        btnSaveReply.disabled = false;
        btnSaveReply.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>儲存回覆';
      }
    });
  }

  async function loadConsultsOnce() {
    try {
      const snap = await db.collection('consults').orderBy('createdAt', 'desc').limit(500).get();
      consults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      // 可能是權限/索引/欄位問題 → 退回不用 orderBy 的查詢，再用前端排序
      console.warn('loadConsultsOnce fallback:', e);
      const snap = await db.collection('consults').limit(500).get();
      consults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      consults.sort((a,b) => {
        const da = tsToDate(a.createdAt) || new Date(0);
        const dbb = tsToDate(b.createdAt) || new Date(0);
        return dbb - da;
      });
    }
  }

  function renderTable() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const st = statusFilter.value;

    let rows = consults.slice();

    if (st !== 'all') rows = rows.filter(r => (r.status || 'open') === st);
    if (q) {
      rows = rows.filter(r => {
        const hay = `${r.bedNumber||''} ${r.residentName||''} ${r.subject||''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (!rows.length) {
      refTableBody.innerHTML = `<tr><td colspan="6" class="text-center small-muted py-4">沒有資料</td></tr>`;
      forceTableLayoutFix();
      return;
    }

    refTableBody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      const status = (r.status === 'replied') ? '已回覆' : '待回覆';
      const badgeClass = (r.status === 'replied') ? 'bg-success' : 'bg-warning text-dark';

      const created = formatTs(r.createdAt);
      const unread = isUnreadForRole(r);

      tr.innerHTML = `
        <td><span class="fw-bold">${escapeHtml(r.bedNumber || '')}</span>${unread ? ' <span class="badge bg-danger ms-1">NEW</span>' : ''}</td>
        <td>${escapeHtml(r.residentName || '')}</td>
        <td>
          <div class="fw-semibold">${escapeHtml(r.subject || '')}</div>
          <div class="small-muted">${escapeHtml(truncate(r.description || '', 60))}</div>
        </td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td class="small-muted">${created}</td>
        <td>
          <div class="d-flex flex-column gap-2">
            <button class="btn btn-sm btn-outline-primary btn-view"><i class="fa-regular fa-eye me-1"></i>查看照會紀錄</button>
            ${ROLE === 'nurse' ? `<button class="btn btn-sm btn-outline-danger btn-del"><i class="fa-solid fa-trash-can me-1"></i>刪除</button>` : ``}
          </div>
        </td>
      `;

      tr.querySelector('.btn-view').addEventListener('click', () => openModalById(r.id));
      const delBtn = tr.querySelector('.btn-del');
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteConsultById(r.id); });
      refTableBody.appendChild(tr);
    }

    // ensure layout is stable even if global CSS overrides table semantics
    forceTableLayoutFix();
  }

  function openModalById(id) {
    const r = consults.find(x => x.id === id);
    if (!r) return;

    currentModalId = id;
    mBed.value = r.bedNumber || '';
    mName.value = r.residentName || '';
    mSubject.value = r.subject || '';
    mDesc.value = r.description || '';

    if (btnDeleteConsult) btnDeleteConsult.disabled = (ROLE !== 'nurse');

    // nurse attachments
    mNurseFiles.innerHTML = renderFileList(r.nurseAttachments);

    // reply + nut attachments
    mReply.value = r.nutritionistReply || '';
    mNutFilesList.innerHTML = renderFileList(r.nutritionistAttachments);

    // mark as read for role
    markRead(id).catch(console.error);

    const modal = bootstrap.Modal.getOrCreateInstance(refModalEl);
    modal.show();
  }

  async function markRead(id) {
    const ref = db.collection('consults').doc(id);
    if (ROLE === 'nutritionist') {
      await ref.update({ nutritionistReadAt: firebase.firestore.FieldValue.serverTimestamp() });
    } else {
      await ref.update({ nurseReadAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  }

  // -------- Real-time notifications --------
  function startRealtimeIfEnabled(forceRestart = false) {
    const enabled = notifyToggle.checked;
    if (!enabled) {
      if (unsubConsults) { unsubConsults(); unsubConsults = null; }
      return;
    }
    if (unsubConsults && !forceRestart) return;

    if (unsubConsults) { unsubConsults(); unsubConsults = null; }

    const lastSeen = getLastSeenDate();
    // Listen recent changes
    unsubConsults = db.collection('consults')
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .onSnapshot((snap) => {
        snap.docChanges().forEach((chg) => {
          if (chg.type === 'added' || chg.type === 'modified') {
            const doc = { id: chg.doc.id, ...chg.doc.data() };
            const updated = tsToDate(doc.updatedAt);
            if (!updated) return;

            // Only notify if after lastSeen AND unread for role
            if (updated > lastSeen && isUnreadForRole(doc)) {
              const title = (ROLE === 'nutritionist')
                ? '護理之家照會系統通知:有新的照會單'
                : '護理之家照會系統通知:營養師已回覆照會';
              const body = `${doc.bedNumber || ''} ${doc.residentName || ''}｜${doc.subject || ''}`;

              toast(`${title}：${body}`, 'info');

              if ('Notification' in window && Notification.permission === 'granted') {
                try { new Notification(title, {
                  body,
                  icon: '/icons/notify-512.png',
                  badge: '/icons/badge-72.png',
                  tag: 'consult-notify',
                  renotify: true
                }); } catch (_) {}
              }
            }
          }
        });

        // merge into local list quickly
        // (re-fetch for simplicity & correctness)
        loadConsultsOnce().then(renderTable).catch(console.error);
      });
  }

  function isUnreadForRole(doc) {
    // If the other side acted and this side hasn't read since, show NEW
    const nurseRead = tsToDate(doc.nurseReadAt);
    const nutRead = tsToDate(doc.nutritionistReadAt);
    const updated = tsToDate(doc.updatedAt);

    if (!updated) return false;

    if (ROLE === 'nutritionist') {
      // new consult is created by nurse → nutritionistReadAt null or older than updated
      if (!nutRead) return true;
      return nutRead < updated;
    } else {
      // reply by nutritionist → nurseReadAt null or older than updated
      if (!nurseRead) return (doc.lastActionBy === 'nutritionist'); // only mark NEW when nutritionist touched it
      return nurseRead < updated && doc.lastActionBy === 'nutritionist';
    }
  }

  function bumpLastSeen() {
    localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());
  }
  function getLastSeenDate() {
    const s = localStorage.getItem(LS_LAST_SEEN);
    const d = s ? new Date(s) : new Date(0);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  // -------- Storage upload --------

  // -------- Attachments (UPLOAD via Vercel API; avoids browser-to-GCS CORS) --------
  async function uploadFilesIfAny(docId, who, files) {
    if (!files || !files.length) return [];

    const form = new FormData();
    form.append('docId', docId);
    form.append('who', who);
    for (const f of files) form.append('files', f, f.name || 'file');

    try {
      const resp = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data && (data.error || data.message) ? (data.error || data.message) : ('HTTP ' + resp.status);
        throw new Error(msg);
      }
      return Array.isArray(data.uploaded) ? data.uploaded : [];
    } catch (e) {
      console.error(e);
      toast('附件上傳失敗：' + (e.message || e), 'danger');
      return [];
    }
  }


  
  // -------- Print / Export (A4 正式版型) --------
  function buildConsultPrintHTML(c) {
    const header = '安泰醫療社團法人附設安泰護理之家';
    const title = '照 會 單';
    const created = formatTs(c.createdAt) || '';
    const reply = (c.nutritionistReply || '').trim() || '—';

    const safe = (v) => escapeHtml(String(v ?? ''));
    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${header}${title}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Noto Sans TC","Microsoft JhengHei", Arial, sans-serif; color:#111; }
  .head { text-align:center; margin-bottom: 10mm; }
  .org { font-size: 16pt; font-weight: 800; letter-spacing: .5px; }
  .doc { font-size: 18pt; font-weight: 900; margin-top: 6px; letter-spacing: 6px; }
  .meta { margin-top: 6mm; font-size: 10.5pt; color:#333; text-align:right; }
  table { width:100%; border-collapse:collapse; table-layout: fixed; }
  th, td { border:1px solid #000; padding: 8px 10px; vertical-align: top; font-size: 11.5pt; line-height: 1.5; }
  th { width: 20%; background: #f3f4f6; font-weight: 800; }
  .section-title { margin: 10mm 0 4mm; font-size: 12pt; font-weight: 800; }
  .files a { color:#111; text-decoration: underline; word-break: break-all; }
  .muted { color:#444; }
</style>
</head>
<body>
  <div class="head">
    <div class="org">${header}</div>
    <div class="doc">${title}</div>
    <div class="meta">建立時間：${safe(created)}</div>
  </div>

  <table>
    <tr><th>住民床號</th><td>${safe(c.bedNumber || '')}</td></tr>
    <tr><th>姓名</th><td>${safe(c.residentName || '')}</td></tr>
    <tr><th>照會主旨</th><td>${safe(c.subject || '')}</td></tr>
    <tr><th>照會說明</th><td>${safe(c.description || '')}</td></tr>
    <tr><th>營養師回覆</th><td>${safe(reply)}</td></tr>
  </table>

  <div class="section-title">附件</div>
  <div class="muted">護理師附件：</div>
  <div class="files">${buildFilesForPrint(c.nurseAttachments)}</div>
  <div style="height:4mm"></div>
  <div class="muted">營養師附件：</div>
  <div class="files">${buildFilesForPrint(c.nutritionistAttachments)}</div>
</body>
</html>`;
  }

  function buildFilesForPrint(list) {
    if (!list || !list.length) return '<div class="muted">—</div>';
    return list.map(f => {
      const name = escapeHtml(f?.name || '附件');
      const url = f?.url || '';
      if (!url) return `<div>${name}</div>`;
      return `<div><a href="${url}" target="_blank" rel="noopener">${name}</a></div>`;
    }).join('');
  }

  function printConsult(c) {
    const html = buildConsultPrintHTML(c);
    const win = window.open('', '_blank');
    if (!win) {
      toast('瀏覽器阻擋彈出視窗，請允許後再試一次。', 'warning');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    // 等待資源載入後再列印
    win.onload = () => {
      try { win.focus(); win.print(); } catch (_) {}
    };
  }

  async function exportConsultToWord(c) {
    // ✅ 兼容度最高的 Word 匯出：使用「HTML + .doc」格式（Word 可直接開啟/編輯）
    // （避免部分環境/版本對前端產生 .docx 內容嚴格檢查而出現「檔案內容有問題」）
    const header = '安泰醫療社團法人附設安泰護理之家';
    const title = '照會單';
    const created = formatTs(c.createdAt) || '';
    const reply = (c.nutritionistReply || '').trim() || '—';

    const nurseAttach = (c.nurseAttachments || []).map(f => escapeHtml(f.name || '附件')).join('、') || '—';
    const nutAttach = (c.nutritionistAttachments || []).map(f => escapeHtml(f.name || '附件')).join('、') || '—';

    const html = buildWordHTML({
      header, title,
      bedNumber: c.bedNumber || '',
      residentName: c.residentName || '',
      subject: c.subject || '',
      description: c.description || '',
      nutritionistReply: reply,
      createdAt: created,
      nurseAttachments: nurseAttach,
      nutritionistAttachments: nutAttach,
    });

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const fileName = `照會單_${sanitizeForFile(c.bedNumber)}_${sanitizeForFile(c.residentName)}.doc`;
    downloadBlob(blob, fileName);
    toast('Word 已匯出', 'success');
  }

  function buildWordHTML(data) {
    // Word 會以 HTML 方式開啟 .doc，這裡用「正式公文感」的版面：置中抬頭 + 表格
    const nlToBr = (s) => escapeHtml(String(s || '')).replace(/\r?\n/g, '<br>');
    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.title)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif; font-size: 12pt; color:#000; }
  .header { text-align:center; font-weight:700; font-size: 16pt; margin-bottom: 8mm; }
  .title { text-align:center; font-weight:800; font-size: 18pt; letter-spacing: 2px; margin-bottom: 6mm; }
  table { width:100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 8px 10px; vertical-align: top; word-wrap: break-word; }
  th { width: 20%; background: #f3f4f6; text-align:left; font-weight:700; }
  .meta { margin-top: 6mm; font-size: 11pt; color:#111; }
</style>
</head>
<body>
  <div class="header">${escapeHtml(data.header)}</div>
  <div class="title">${escapeHtml(data.title)}</div>

  <table>
    <tr><th>床號</th><td>${escapeHtml(data.bedNumber)}</td></tr>
    <tr><th>姓名</th><td>${escapeHtml(data.residentName)}</td></tr>
    <tr><th>照會主旨</th><td>${escapeHtml(data.subject)}</td></tr>
    <tr><th>照會說明</th><td>${nlToBr(data.description)}</td></tr>
    <tr><th>護理師附件</th><td>${escapeHtml(data.nurseAttachments)}</td></tr>
    <tr><th>營養師回覆</th><td>${nlToBr(data.nutritionistReply)}</td></tr>
    <tr><th>營養師附件</th><td>${escapeHtml(data.nutritionistAttachments)}</td></tr>
  </table>

  <div class="meta">照會日期：${escapeHtml(data.createdAt)}</div>
</body>
</html>`;
  }


  function sanitizeForFile(s) {
    return String(s || '').trim().replace(/[\\\/:*?"<>|]+/g, '_');
  }


// -------- Helpers --------

  // ===== 強制修正：若全站 CSS 破壞 table 結構（thead/tbody 跑位、資料跑到標題上方），這裡用 JS 直接鎖回 table layout =====
  function forceTableLayoutFix() {
    try {
      const body = document.getElementById('refTableBody');
      if (!body) return;
      const table = body.closest('table');
      if (!table) return;
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');

      // Lock critical display modes back to table semantics
      table.style.display = 'table';
      table.style.width = '100%';
      table.style.tableLayout = 'fixed';

      if (thead) {
        thead.style.display = 'table-header-group';
        thead.style.position = 'relative';
        thead.style.zIndex = '1';
      }
      if (tbody) {
        tbody.style.display = 'table-row-group';
      }

      table.querySelectorAll('tr').forEach(tr => tr.style.display = 'table-row');
      table.querySelectorAll('th,td').forEach(cell => cell.style.display = 'table-cell');
    } catch (e) {
      // silent
    }
  }

  function getRoleFromQuery() {
    const sp = new URLSearchParams(location.search);
    const r = (sp.get('role') || '').toLowerCase();
    if (r === 'nutritionist' || r === 'nut') return 'nutritionist';
    if (r === 'nurse') return 'nurse';

    // ✅ 兼容：若未帶 role，改用 from / referrer 推斷
    const from = (sp.get('from') || '').toLowerCase();
    if (from.includes('nutritionist')) return 'nutritionist';
    if (from.includes('nurse')) return 'nurse';

    const ref = (document.referrer || '').toLowerCase();
    if (ref.includes('/nutritionist/')) return 'nutritionist';
    if (ref.includes('nutritionist')) return 'nutritionist';

    return 'nurse';
  }

  function compareBed(a, b) {
    // sort like 101-1, 101-2, 102-1 ...
    const pa = parseBed(a);
    const pb = parseBed(b);
    if (pa.main !== pb.main) return pa.main - pb.main;
    return pa.sub - pb.sub;
  }
  function parseBed(s) {
    const m = String(s || '').trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return { main: parseInt(m[1], 10), sub: parseInt(m[2], 10) };
    const n = parseInt(String(s||'').replace(/\D/g,''),10);
    return { main: isNaN(n) ? 999999 : n, sub: 0 };
  }

  function formatTs(ts) {
    const d = tsToDate(ts);
    if (!d) return '';
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  }
  function tsToDate(ts) {
    if (!ts) return null;
    // Firestore Timestamp has toDate()
    if (typeof ts.toDate === 'function') return ts.toDate();
    // ISO string
    if (typeof ts === 'string') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
    // {seconds, nanoseconds}
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    return null;
  }
  // ===== 刪除照會單（僅護理師可用）=====
  async function deleteConsultById(id) {
    if (ROLE !== 'nurse') {
      toast('只有護理師可以刪除照會單', 'warning');
      return;
    }
    const r = consults.find(x => x.id === id);
    if (!r) return;

    const ok = confirm(`確定要刪除照會單嗎？\n\n床號：${r.bedNumber || ''}\n姓名：${r.residentName || ''}\n主旨：${r.subject || ''}\n\n⚠️ 刪除後無法復原。`);
    if (!ok) return;

    try {
      // 1) 先嘗試刪除附件（若失敗不影響刪除主資料）
      await tryDeleteAttachments(r.nurseAttachments);
      await tryDeleteAttachments(r.nutritionistAttachments);

      // 2) 刪除 Firestore 文件
      await db.collection('consults').doc(id).delete();

      toast('已刪除照會單', 'success');

      // 3) UI 更新
      consults = consults.filter(x => x.id !== id);
      renderTable();
      bumpLastSeen();

      // 若目前 modal 正在看這張，關閉它
      if (currentModalId === id) {
        currentModalId = null;
        try { refModal?.hide(); } catch(e) {}
      }
    } catch (e) {
      console.error(e);
      toast('刪除失敗：' + (e.message || e), 'danger');
    }
  }

  async function tryDeleteAttachments(arr) {
    if (!arr || !arr.length) return;
    const tasks = arr.map(async (f) => {
      try {
        const url = f?.url;
        if (!url) return;
        // Firebase v8
        await firebase.storage().refFromURL(url).delete();
      } catch (e) {
        // ignore per-file error
      }
    });
    await Promise.all(tasks);
  }


  function renderFileList(list) {
    if (!list || !list.length) return '<span class="small-muted">—</span>';
    return list.map(f => {
      const name = escapeHtml(f.name || '附件');
      const url = f.url || '';
      const icon = pickIcon(f.contentType || '');
      if (!url) return `<span class="file-chip"><i class="fa-regular ${icon}"></i><span>${name}</span></span>`;
      return `<a class="file-chip" href="${url}" target="_blank" rel="noopener">
        <i class="fa-regular ${icon}"></i><span title="${name}">${name}</span>
      </a>`;
    }).join('');
  }

  function pickIcon(ct) {
    if (!ct) return 'fa-file';
    if (ct.startsWith('image/')) return 'fa-file-image';
    if (ct.includes('pdf')) return 'fa-file-pdf';
    if (ct.includes('excel') || ct.includes('spreadsheet')) return 'fa-file-excel';
    if (ct.includes('word')) return 'fa-file-word';
    if (ct.includes('zip') || ct.includes('compressed')) return 'fa-file-zipper';
    return 'fa-file';
  }

  function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const id = 't_' + Math.random().toString(16).slice(2);
    const html = `
      <div class="toast align-items-center text-bg-${type} border-0 mb-2" id="${id}" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${escapeHtml(message)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const t = new bootstrap.Toast(el, { delay: 4500 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  function truncate(s, n) {
    s = String(s || '');
    if (s.length <= n) return s;
    return s.slice(0, n) + '…';
  }

  function sanitizeFileName(name) {
    return String(name || 'file').replace(/[\\\/:*?"<>|]+/g, '_');
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
