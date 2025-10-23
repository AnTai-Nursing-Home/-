document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const colReq = db.collection("maintenance_requests");
  const colStatus = db.collection("maintenance_status");

  const tbody = document.getElementById("maintenanceTableBody");
  const addRequestBtn = document.getElementById("addRequestBtn");
  const saveRequestBtn = document.getElementById("saveRequestBtn");
  const addModal = new bootstrap.Modal(document.getElementById("addRequestModal"));
  const statusColorMap = {};
  let allRequests = [];

  // ===== 格式化時間 =====
  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ===== 顯示讀取中 =====
  function showLoading() {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== 載入狀態顏色 =====
  async function loadStatusColors() {
    const snap = await colStatus.get();
    snap.forEach(doc => {
      const data = doc.data();
      statusColorMap[doc.id] = data.color || "#6c757d";
    });

    // 建立篩選選單
    const filterContainer = document.createElement("div");
    filterContainer.className = "mb-3";
    filterContainer.innerHTML = `
      <label class="form-label fw-bold me-2">狀態篩選：</label>
      <select id="statusFilter" class="form-select d-inline-block" style="width:auto; display:inline-block;">
        <option value="all">全部</option>
        ${Object.keys(statusColorMap)
          .map(s => `<option value="${s}">${s}</option>`)
          .join("")}
      </select>
    `;
    const cardBody = document.querySelector(".card-body");
    cardBody.insertBefore(filterContainer, cardBody.firstChild);

    document.getElementById("statusFilter").addEventListener("change", e => {
      renderRequests(e.target.value);
    });
  }

  // ===== 渲染報修清單（含篩選） =====
  function renderRequests(filter = "all") {
    tbody.innerHTML = "";
    const filtered = filter === "all" ? allRequests : allRequests.filter(d => d.status === filter);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    filtered.forEach(d => {
      const color = statusColorMap[d.status] || "#6c757d";
      const commentsHtml = (d.comments || []).map(c => `
        <div class="comment border rounded p-2 mb-2">
          <div>${c.message || ""}</div>
          <time class="text-muted small">${fmt(c.time)}</time>
        </div>
      `).join("") || `<span class="text-muted">—</span>`;

      const noteHtml = d.note ? `<div class="border rounded p-2 bg-light">${d.note}</div>` : `<span class="text-muted">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.item || ""}</td>
        <td>${d.detail || ""}</td>
        <td>${d.reporter || ""}</td>
        <td><span class="badge text-white" style="background:${color};">${d.status || "—"}</span></td>
        <td>${fmt(d.createdAt)}</td>
        <td style="min-width:200px;">
          <div><strong>備註：</strong>${noteHtml}</div>
          <div class="mt-2"><strong>註解：</strong>${commentsHtml}</div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== 載入報修清單 =====
  async function loadRequests() {
    showLoading();
    try {
      const snap = await colReq.orderBy("createdAt", "desc").get().catch(() => colReq.get());
      allRequests = snap.docs.map(d => d.data());
      renderRequests();
    } finally {
      // 無動畫
    }
  }

  // ===== 新增報修單 =====
  addRequestBtn.addEventListener("click", () => {
    document.getElementById("item").value = "";
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";
    addModal.show();
  });

  saveRequestBtn.addEventListener("click", async () => {
    const item = document.getElementById("item").value.trim();
    const detail = document.getElementById("detail").value.trim();
    const reporter = document.getElementById("reporter").value.trim();
    if (!item || !detail || !reporter) return alert("請輸入完整資料");

    await colReq.add({
      item,
      detail,
      reporter,
      status: "待處理",
      note: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      comments: []
    });

    addModal.hide();
    await loadRequests();
  });

  // ===== 初始化 =====
  await loadStatusColors();
  await loadRequests();
});
