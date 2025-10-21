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

  const commentModalEl = document.getElementById('commentModal');
  const commentModal = new bootstrap.Modal(commentModalEl);
  const commentList = document.getElementById('comment-list');
  const commentInput = document.getElementById('comment-input');
  const commentSave = document.getElementById('comment-save');
  let editingReqId = null;

  let statuses = [];

  function nowTs() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function fmt(ts) {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function createRequest() {
    const item = itemEl.value.trim();
    const detail = detailEl.value.trim();
    const reporter = reporterEl.value.trim();
    if (!item || !detail || !reporter) return alert('請完整填寫修繕物品、詳細資訊、報修人');

    const defaultStatus = statuses[0] || '待處理';
    await colReq.add({
      item,
      detail,
      reporter,
      status: defaultStatus,
      createdAt: nowTs(),
      comments: []
    });

    itemEl.value = '';
    detailEl.value = '';
    reporterEl.value = '';
    alert('報修已建立');
    loadRequests();
  }

  async function loadStatuses() {
    const snap = await colStatus.orderBy('order', 'asc').get().catch(() => colStatus.get());
    statuses = snap.docs.map((d) => d.id);
    if (statuses.length === 0) {
      const batch = db.batch();
      [['待處理', 0], ['已請修', 1], ['維修中', 2], ['已完成', 3]].forEach(([name, order]) => {
        batch.set(colStatus.doc(name), { order });
      });
      await batch.commit();
      return loadStatuses();
    }
    statusListEl.innerHTML = statuses
      .map((s, idx) => `<div class="badge bg-secondary me-2 mb-2">${idx + 1}. ${s}</div>`)
      .join('');
  }

  async function addStatus() {
    const name = newStatusEl.value.trim();
    if (!name) return alert('請輸入狀態名稱');
    let max = -1;
    const snap = await colStatus.get();
    snap.forEach((d) => (max = Math.max(max, d.data().order ?? -1)));
    await colStatus.doc(name).set({ order: max + 1 });
    newStatusEl.value = '';
    await loadStatuses();
  }

  async function loadRequests() {
    loading.style.display = 'inline-block';
    tbody.innerHTML = '';
    try {
      const snap = await colReq.orderBy('createdAt', 'desc').get().catch(() => colReq.get());
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
        return;
      }
      tbody.innerHTML = '';
      snap.forEach((doc) => {
        const d = doc.data();
        const tr = document.createElement('tr');
        const options = statuses.map((s) => `<option value="${s}" ${s === d.status ? 'selected' : ''}>${s}</option>`).join('');
        const selectHtml = `<select class="form-select form-select-sm status-pill" data-id="${doc.id}">${options}</select>`;

        const commentsHtml = (d.comments || [])
          .map((c, i) => `
            <div class="comment border rounded p-2 mb-2">
              <div>${c.message || ''}</div>
              <time>${fmt(c.time)}</time>
              <div class="text-end mt-1">
                <button class="btn btn-sm btn-outline-secondary me-1 editCommentBtn" data-id="${doc.id}" data-idx="${i}">✏️</button>
                <button class="btn btn-sm btn-outline-danger delCommentBtn" data-id="${doc.id}" data-idx="${i}">🗑️</button>
              </div>
            </div>`)
          .join('') || '<span class="text-muted">—</span>';

        tr.innerHTML = `
          <td>${d.item || ''}</td>
          <td>${d.detail || ''}</td>
          <td>${d.reporter || ''}</td>
          <td>${selectHtml}</td>
          <td>${fmt(d.createdAt)}</td>
          <td style="min-width:240px;">${commentsHtml}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary" data-comment="${doc.id}">
              <i class="fa-solid fa-message"></i> 新增註解
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-delreq="${doc.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // 狀態更新
      tbody.querySelectorAll('select[data-id]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          await colReq.doc(sel.dataset.id).update({ status: sel.value });
        });
      });

      // 新增註解
      tbody.querySelectorAll('button[data-comment]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          editingReqId = btn.dataset.comment;
          commentInput.value = '';
          const doc = await colReq.doc(editingReqId).get();
          const d = doc.data();
          commentList.innerHTML =
            (d.comments || [])
              .map((c) => `<div class="comment"><div>${c.message || ''}</div><time>${fmt(c.time)}</time></div>`)
              .join('') || '<div class="text-muted">目前沒有註解</div>';
          commentModal.show();
        });
      });

      // 刪除報修單
      tbody.querySelectorAll('button[data-delreq]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('確定刪除這筆報修單？')) return;
          await colReq.doc(btn.dataset.delreq).delete();
          await loadRequests();
        });
      });

      // 編輯註解
      tbody.querySelectorAll('.editCommentBtn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idx = parseInt(btn.dataset.idx);
          const docRef = colReq.doc(id);
          const snap = await docRef.get();
          const data = snap.data();
          const comments = data.comments || [];
          const oldMsg = comments[idx].message;
          const newMsg = prompt('修改註解內容：', oldMsg);
          if (newMsg === null) return;
          comments[idx].message = newMsg.trim();
          comments[idx].time = firebase.firestore.Timestamp.now();
          await docRef.update({ comments });
          alert('✅ 註解已更新');
          await loadRequests();
        });
      });

      // 刪除註解
      tbody.querySelectorAll('.delCommentBtn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idx = parseInt(btn.dataset.idx);
          if (!confirm('確定刪除此註解？')) return;
          const docRef = colReq.doc(id);
          const snap = await docRef.get();
          const data = snap.data();
          const comments = data.comments || [];
          comments.splice(idx, 1);
          await docRef.update({ comments });
          alert('🗑️ 註解已刪除');
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
        time: firebase.firestore.Timestamp.now()
      })
    });
    await loadRequests();
    alert('✅ 註解已新增！');
  }

  btnCreate.addEventListener('click', createRequest);
  btnAddStatus.addEventListener('click', addStatus);
  commentSave.addEventListener('click', saveComment);

  (async () => {
    await loadStatuses();
    await loadRequests();
  })();
});
