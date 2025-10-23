document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const addStatusBtn = document.getElementById("btn-add-status");
  const newStatusEl = document.getElementById("new-status");
  const newStatusColorEl = document.getElementById("new-status-color");
  const statusListEl = document.getElementById("statusList");
  const addRequestBtn = document.getElementById("addRequestBtn");
  const saveRequestBtn = document.getElementById("saveRequestBtn");
  const statusSelect = document.getElementById("statusSelect");
  const addModal = new bootstrap.Modal(document.getElementById("addRequestModal"));

  let statuses = [];

  // ===== 格式化時間 =====
  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ===== 顯示讀取中 =====
  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== 載入狀態 =====
  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
    statuses = snap.docs.map(d => ({ name: d.id, ...d.data() }));

    if (statuses.length === 0) {
      const batch = db.batch();
      [["待處理", 0, "#6c757d"], ["維修中", 1, "#ffc107"], ["已完成", 2, "#28a745"]].forEach(([name, order, color]) => {
        batch.set(colStatus.doc(name), { order, color });
      });
      await batch.commit();
      return loadStatuses();
    }

    statusListEl.innerHTML = statuses.map((s, idx) => `
      <span class="badge me-2 mb-2" style="background:${s.color || "#6c757d"};color:#fff;">
        ${idx + 1}. ${s.name}
      </span>
    `).join("");

    // 更新 modal 下拉選單
    statusSelect.innerHTML = statuses.map(s => `
      <option value="${s.name}" style="background:${s.color || "#6c757d"};color:#fff;">${s.name}</option>
    `).join("");
  }

  // ===== 新增狀態 =====
  addStatusBtn.addEventListener("click", async () => {
    const name = newStatusEl.value.trim();
    const color = newStatusColorEl.value.trim() || "#6c757d";
    if (!name) return alert("請輸入狀態名稱");

    let max = -1;
    const snap = await colStatus.get();
    snap.forEach(d => (max = Math.max(max, d.data().order ?? -1)));

    await colStatus.doc(name).set({ order: max + 1, color });
    newStatusEl.value = "";
    newStatusColorEl.value = "#007bff";
    await loadStatuses();
  });

  // ===== 載入報修清單 =====
  async function loadRequests() {
    showLoading();
    try {
      const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
        return;
      }

      tbody.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data();
        const statusObj = statuses.find(s => s.name === d.status);
        const color = statusObj ? statusObj.color : "#6c757d";

        const options = statuses.map(
          s => `<option value="${s.name}" ${s.name === d.status ? "selected" : ""} style="background:${s.color};color:#fff;">${s.name}</option>`
        ).join("");

        const commentsHtml = (d.comments || []).map((c, i) => `
          <div class="comment border rounded p-2 mb-2">
            <div>${c.message || ""}</div>
            <time>${fmt(c.time)}</time>
            <div class="text-end mt-1">
              <button class="btn btn-sm btn-outline-secondary me-1 editCommentBtn" data-id="${doc.id}" data-idx="${i}">✏️</button>
              <button class="btn btn-sm btn-outline-danger delCommentBtn" data-id="${doc.id}" data-idx="${i}">🗑️</button>
            </div>
          </div>
        `).join("") || `<span class="text-muted">—</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.item || ""}</td>
          <td>${d.detail || ""}</td>
          <td>${d.reporter || ""}</td>
          <td>
            <span class="badge text-white mb-1" style="background:${color};">${d.status || "—"}</span>
            <select class="form-select form-select-sm status-pill" data-id="${doc.id}">
              ${options}
            </select>
          </td>
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
    } finally {
      // 結束讀取中提示
    }
  }

  // ===== 新增報修單 =====
  addRequestBtn.addEventListener("click", () => {
    document.getElementById("item").value = "";
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";
    document.getElementById("note").value = "";
    addModal.show();
  });

  saveRequestBtn.addEventListener("click", async () => {
    const item = document.getElementById("item").value.trim();
    const detail = document.getElementById("detail").value.trim();
    const reporter = document.getElementById("reporter").value.trim();
    const status = statusSelect.value;
    const note = document.getElementById("note").value.trim();
    if (!item || !detail || !reporter) return alert("請輸入完整資料");

    await colReq.add({
      item,
      detail,
      reporter,
      status,
      note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      comments: []
    });

    addModal.hide();
    await loadRequests();
  });

  // ===== 初始化 =====
  await loadStatuses();
  await loadRequests();
});
