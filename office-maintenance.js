document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const refreshBtn = document.getElementById("refreshBtn");
  const statusList = document.getElementById("statusList");
  const addStatusBtn = document.getElementById("btn-add-status");
  const newStatusEl = document.getElementById("new-status");
  const newStatusColorEl = document.getElementById("new-status-color");

  let statuses = [];

  // ===== 顯示「讀取中...」 =====
  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
  }

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ===== 載入狀態 =====
  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get().catch(() => colStatus.get());
    statuses = snap.docs.map(d => ({ name: d.id, ...d.data() }));

    if (statuses.length === 0) {
      const batch = db.batch();
      const defaults = [
        ["待處理", 0, "#6c757d"],
        ["維修中", 1, "#ffc107"],
        ["已完成", 2, "#28a745"]
      ];
      defaults.forEach(([name, order, color]) => batch.set(colStatus.doc(name), { order, color }));
      await batch.commit();
      return loadStatuses();
    }

    // 狀態列表顯示
    statusList.innerHTML = statuses
      .map((s, idx) => `
        <span class="badge me-2 mb-2" style="background:${s.color || "#6c757d"};color:#fff;">
          ${idx + 1}. ${s.name}
        </span>
      `)
      .join("");
  }

  // ===== 新增狀態 =====
  async function addStatus() {
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
  }

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

        // 狀態選項顯示顏色
        const options = statuses.map(
          s => `<option value="${s.name}" ${s.name === d.status ? "selected" : ""} style="background:${s.color};color:#fff;">${s.name}</option>`
        ).join("");

        const commentsHtml = (d.comments || [])
          .map((c, i) => `
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
      // 結束讀取提示
    }
  }

  refreshBtn.addEventListener("click", loadRequests);
  addStatusBtn.addEventListener("click", addStatus);

  await loadStatuses();
  await loadRequests();
});
