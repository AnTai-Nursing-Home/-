document.addEventListener('firebase-ready', () => {
  const colReq = db.collection('maintenance_requests');
  const colStatus = db.collection('maintenance_status');

  const itemEl = document.getElementById('item');
  const detailEl = document.getElementById('detail');
  const reporterEl = document.getElementById('reporter');
  const btnCreate = document.getElementById('btn-create');

  const newStatusEl = document.getElementById('new-status');
  const btnAddStatus = document.getElementById('btn-add-status');
  const statusListEl = document.getElementById('status-list');

  const tbody = document.getElementById('req-tbody');
  const loading = document.getElementById('loading');

  // comment modal
  const commentModalEl = document.getElementById('commentModal');
  const commentModal = new bootstrap.Modal(commentModalEl);
  const commentList = document.getElementById('comment-list');
  const commentInput = document.getElementById('comment-input');
  const commentSave = document.getElementById('comment-save');
  let editingReqId = null;

  let statuses = []; // string array

  function nowTs(){ return firebase.firestore.FieldValue.serverTimestamp(); }
  function fmt(ts){
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate(); const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function createRequest() {
    const item = itemEl.value.trim();
    const detail = detailEl.value.trim();
    const reporter = reporterEl.value.trim();
    if (!item || !detail || !reporter) return alert('請完整填寫修繕物品、詳細資訊、報修人');
    const defaultStatus = statuses[0] || '已報修';
    await colReq.add({ item, detail, reporter, status: defaultStatus, createdAt: nowTs(), comments: [] });
    itemEl.value=''; detailEl.value=''; reporterEl.value='';
    alert('報修已建立');
    loadRequests();
  }

  async function loadStatuses() {
    statusListEl.innerHTML = `<div class="text-muted"><span class="spinner-border spinner-border-sm"></span> 載入狀態…</div>`;
    const snap = await colStatus.orderBy('order','asc').get().catch(()=>colStatus.get());
    statuses = snap.docs.map(d=>d.id);

    // 如果空集合，預設補三個常用狀態（僅第一次）
    if (statuses.length === 0) {
      const batch = db.batch();
      [['已報修',0],['維修中',1],['已完成',2]].forEach(([name,order])=>{
        batch.set(colStatus.doc(name), { order });
      });
      await batch.commit();
      return loadStatuses();
    }

    // render
    statusListEl.innerHTML = '';
    statuses.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'd-inline-flex align-items-center gap-2 border rounded px-2 py-1 me-2 mb-2';
      div.innerHTML = `
        <span class="badge text-bg-secondary">${idx+1}</span>
        <span>${s}</span>
        <button class="btn btn-sm btn-outline-danger" data-del="${s}">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
      statusListEl.appendChild(div);
    });

    // 事件：刪除狀態
    statusListEl.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-del');
        if (!confirm(`確定刪除狀態「${name}」？`)) return;
        await colStatus.doc(name).delete();
        // 將該狀態中的報修單標記為「已報修」
        const snapReq = await colReq.where('status','==',name).get();
        const batch = db.batch();
        snapReq.forEach(d=>batch.update(colReq.doc(d.id), { status: '已報修' }));
        await batch.commit();
        await loadStatuses();
        await loadRequests();
      });
    });
  }

  async function addStatus() {
    const name = newStatusEl.value.trim();
    if (!name) return alert('請輸入狀態名稱');
    // 取最大 order + 1
    let max = -1;
    const snap = await colStatus.get();
    snap.forEach(d => { max = Math.max(max, d.data().order ?? -1); });
    await colStatus.doc(name).set({ order: max+1 });
    newStatusEl.value = '';
    await loadStatuses();
  }

  async function loadRequests() {
    loading.style.display = 'inline-block';
    tbody.innerHTML = '';
    try {
      const snap = await colReq.orderBy('createdAt','desc').get().catch(()=>colReq.get());
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有報修單</td></tr>`;
        return;
      }
      snap.forEach(doc=>{
        const d = doc.data();
        const tr = document.createElement('tr');

        // 狀態選單
        const options = statuses.map(s => `<option value="${s}" ${s===d.status?'selected':''}>${s}</option>`).join('');
        const selectHtml = `<select class="form-select form-select-sm status-pill" data-id="${doc.id}">${options}</select>`;

        const commentsHtml = (d.comments||[])
          .sort((a,b)=> (a.time?.seconds||0)-(b.time?.seconds||0))
          .map(c => `<div class="comment"><div>${c.message||''}</div><time>${fmt(c.time)}</time></div>`)
          .join('') || '<span class="text-muted">—</span>';

        tr.innerHTML = `
          <td>${d.item||''}</td>
          <td>${d.detail||''}</td>
          <td>${selectHtml}</td>
          <td>${fmt(d.createdAt)}</td>
          <td style="min-width:240px;">${commentsHtml}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary" data-comment="${doc.id}">
              <i class="fa-solid fa-message"></i> 註解
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-delreq="${doc.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // 綁定：更改狀態
      tbody.querySelectorAll('select[data-id]').forEach(sel=>{
        sel.addEventListener('change', async ()=>{
          const id = sel.getAttribute('data-id');
          const val = sel.value;
          await colReq.doc(id).update({ status: val });
          // 不彈窗，靜默成功
        });
      });

      // 綁定：開啟註解
      tbody.querySelectorAll('button[data-comment]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          editingReqId = btn.getAttribute('data-comment');
          commentInput.value = '';
          // 載入舊註解
          const doc = await colReq.doc(editingReqId).get();
          const d = doc.data();
          commentList.innerHTML = (d.comments||[])
            .sort((a,b)=> (a.time?.seconds||0)-(b.time?.seconds||0))
            .map(c => `<div class="comment"><div>${c.message||''}</div><time>${fmt(c.time)}</time></div>`)
            .join('') || '<div class="text-muted">目前沒有註解</div>';
          commentModal.show();
        });
      });

      // 綁定：刪除報修單
      tbody.querySelectorAll('button[data-delreq]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-delreq');
          if (!confirm('確定刪除這筆報修單？')) return;
          await colReq.doc(id).delete();
          await loadRequests();
        });
      });

    } finally {
      loading.style.display = 'none';
    }
  }

  async function saveComment() {
    const msg = commentInput.value.trim();
    if (!editingReqId) return;
    if (!msg) return alert('請輸入註解內容');
    const docRef = colReq.doc(editingReqId);
    await docRef.update({
      comments: firebase.firestore.FieldValue.arrayUnion({
        message: msg,
        time: nowTs()
      })
    });
    // 重新刷新當前註解區塊
    const doc = await docRef.get();
    const d = doc.data();
    commentList.innerHTML = (d.comments||[])
      .sort((a,b)=> (a.time?.seconds||0)-(b.time?.seconds||0))
      .map(c => `<div class="comment"><div>${c.message||''}</div><time>${fmt(c.time)}</time></div>`)
      .join('');
    commentInput.value = '';
  }

  // 綁定
  btnCreate.addEventListener('click', createRequest);
  btnAddStatus.addEventListener('click', addStatus);
  commentSave.addEventListener('click', saveComment);

  // 初始化
  (async () => {
    await loadStatuses();
    await loadRequests();
  })();
});
