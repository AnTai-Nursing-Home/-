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
  let allRequests = [];

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
    statuses = snap.docs.map(d => ({ id: d.id, name: d.id, ...d.data() }));

    if (statuses.length === 0) {
      const batch = db.batch();
      [["待處理", 0, "#6c757d"], ["維修中", 1, "#ffc107"], ["已完成", 2, "#28a745"]].forEach(([name, order, color]) => {
        batch.set(colStatus.doc(name), { order, color });
      });
      await batch.commit();
      return loadStatuses();
    }

    statusListEl.innerHTML = statuses.map((s, idx) => `
      <li class="list-group-item d-flex justify-content-between align-items-center" data-id="${s.id}">
        <div>
          <span class="badge me-2 mb-0" style="background:${s.color || "#6c757d"};color:#fff;">
            ${s.name}
          </span>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-danger btn-del-status" data-id="${s.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </li>
    `).join("");

    statusSelect.innerHTML = statuses.map(s => `
      <option value="${s.name}" style="background:${s.color || "#6c757d"};color:#fff;">
        ${s.name}
      </option>
    `).join("");

    // 建立篩選選單
    setupFilterSelect();

    document.querySelectorAll(".btn-del-status").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm(`確定刪除狀態「${id}」嗎？`)) return;
        await colStatus.doc(id).delete();
        await loadStatuses();
        await loadRequests();
      });
    });
  }

  function setupFilterSelect() {
    const existingFilter = document.getElementById("statusFilter");
    if (existingFilter) existingFilter.remove();

    const filterContainer = document.createElement("div");
    filterContainer.className = "mb-3 d-flex align-items-center";
    filterContainer.innerHTML = `
      <label class="form-label fw-bold me-2 mb-0">狀態篩選：</label>
      <select id="statusFilter" class="form-select" style="width:auto;display:inline-block;">
        <option value="all">全部</option>
        ${statuses.map(s => `<option value="${s.name}">${s.name}</option>`).join("")}
      </select>
    `;

    const cardBody = document.querySelector(".card-body");
    cardBody.insertBefore(filterContainer, cardBody.firstChild);

    document.getElementById("statusFilter").addEventListener("change", e => {
      renderRequests(e.target.value);
    });
  }

  function renderRequests(filter = "all") {
    tbody.innerHTML = "";
    const filtered = filter === "all" ? allRequests : allRequests.filter(r => r.status === filter);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    filtered.forEach(entry => {
      const d = entry;
      const color = statuses.find(s => s.name === d.status)?.color || "#6c757d";

      const options = statuses.map(
        s => `<option value="${s.name}" ${s.name === d.status ? "selected" : ""} style="background:${s.color};color:#fff;">
                ${s.name}
              </option>`
      ).join("");

      const commentsHtml = (d.comments || []).map((c, i) => `
        <div class="comment border rounded p-2 mb-2">
          <div>${c.message || ""}</div>
          <time>${fmt(c.time)}</time>
          <div class="text-end mt-1">
            <button class="btn btn-sm btn-outline-secondary me-1 editCommentBtn" data-id="${d.id}" data-idx="${i}">✏️</button>
            <button class="btn btn-sm btn-outline-danger delCommentBtn" data-id="${d.id}" data-idx="${i}">🗑️</button>
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
          <select class="form-select form-select-sm status-pill" data-id="${d.id}">
            ${options}
          </select>
        </td>
        <td>${fmt(d.createdAt)}</td>
        <td style="min-width:240px;">${commentsHtml}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary" data-comment="${d.id}">
            <i class="fa-solid fa-message"></i> 新增註解
          </button>
          <button class="btn btn-sm btn-outline-danger ms-1" data-delreq="${d.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    // 綁定狀態變更事件
    tbody.querySelectorAll(".status-pill").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        await colReq.doc(id).update({ status: newStatus });
        await loadRequests(); // 重新載入清單以更新顏色與顯示
      });
    });
  }

  async function loadRequests() {
    showLoading();
    const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
    allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRequests(document.getElementById("statusFilter")?.value || "all");
  }

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

  await loadStatuses();
  await loadRequests();
});
