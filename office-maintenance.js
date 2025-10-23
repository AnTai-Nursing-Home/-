document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const refreshBtn = document.getElementById("refreshBtn");
  const statusList = document.getElementById("statusList");
  const addStatusBtn = document.getElementById("addStatusBtn");
  const newStatusName = document.getElementById("newStatusName");
  const newStatusColor = document.getElementById("newStatusColor");

  let cachedStatuses = [];

  // ===== 共用 =====
  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中...</td></tr>`;
  }

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ===== 載入狀態 =====
  async function loadStatuses() {
    const snap = await colStatus.orderBy("order", "asc").get();
    cachedStatuses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStatusList();
  }

  function renderStatusList() {
    statusList.innerHTML = "";
    cachedStatuses.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `
        <div>
          <span class="badge me-2" style="background:${s.color || "#6c757d"};">&nbsp;&nbsp;</span>
          ${s.name}
        </div>
        <span class="text-muted small">順序：${i + 1}</span>
      `;
      statusList.appendChild(li);
    });
  }

  // ===== 新增狀態 =====
  addStatusBtn.addEventListener("click", async () => {
    const name = newStatusName.value.trim();
    const color = newStatusColor.value.trim() || "#6c757d";
    if (!name) return alert("請輸入狀態名稱");
    const order = cachedStatuses.length + 1;

    await colStatus.add({ name, order, color });

    newStatusName.value = "";
    newStatusColor.value = "#007bff";
    loadStatuses();
  });

  // ===== 載入報修清單 =====
  async function loadRequests() {
    showLoading();
    const snap = await colReq.orderBy("createdAt", "desc").get();
    tbody.innerHTML = "";

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const statusObj = cachedStatuses.find(s => s.name === d.status);
      const color = statusObj ? statusObj.color : "#6c757d";
      const badge = `<span class="status-badge" style="background:${color}">${d.status || "—"}</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.item || ""}</td>
        <td>${d.detail || ""}</td>
        <td>${d.reporter || ""}</td>
        <td>${badge}</td>
        <td>${fmt(d.createdAt)}</td>
        <td>${d.note || ""}</td>`;
      tbody.appendChild(tr);
    });
  }

  refreshBtn.addEventListener("click", () => loadRequests());

  await loadStatuses();
  await loadRequests();
});
