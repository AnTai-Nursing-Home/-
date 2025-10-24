document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  // ✅ 直接使用你現有的集合名稱
  const statusCol = db.collection("request_status_list");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const statusBody = document.getElementById("statusTableBody");

  const leaveModal = new bootstrap.Modal(document.getElementById("leaveModal"));
  const swapModal = new bootstrap.Modal(document.getElementById("swapModal"));
  const statusModal = new bootstrap.Modal(document.getElementById("statusSettingsModal"));

  let statusList = [];

  // ===== 狀態初始化 =====
  async function ensureDefaultStatuses() {
    const snap = await statusCol.get();
    if (snap.empty) {
      console.log("⚙️ 初始化預設狀態中...");
      const defaultStatuses = [
        { name: "審核中", color: "#d39e00" },
        { name: "通過", color: "#198754" },
        { name: "駁回", color: "#dc3545" }
      ];
      for (const s of defaultStatuses) await statusCol.add(s);
      console.log("✅ 已自動建立預設狀態");
    }
  }

  // ===== 狀態設定載入 =====
  async function loadStatuses() {
    statusBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await statusCol.orderBy("name").get();
    statusList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (statusList.length === 0) {
      statusBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">目前沒有狀態設定</td></tr>`;
      return;
    }

    statusBody.innerHTML = "";
    statusList.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name}</td>
        <td><input type="color" value="${s.color || "#6c757d"}" class="form-control form-control-color status-color-input" data-id="${s.id}" title="修改顏色"></td>
        <td><span class="status-badge" style="background:${s.color || "#6c757d"};">${s.name}</span></td>
        <td><button class="btn btn-sm btn-danger btn-del-status" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></td>
      `;
      statusBody.appendChild(tr);
    });

    // 修改顏色
    document.querySelectorAll(".status-color-input").forEach(input => {
      input.addEventListener("change", async e => {
        const id = e.target.dataset.id;
        const newColor = e.target.value;
        await statusCol.doc(id).update({ color: newColor });
        loadStatuses();
        loadLeaveRequests();
        loadSwapRequests();
      });
    });

    // 刪除狀態
    document.querySelectorAll(".btn-del-status").forEach(btn => {
      btn.addEventListener("click", async e => {
        const id = e.target.dataset.id;
        if (confirm("確定刪除此狀態？")) {
          await statusCol.doc(id).delete();
          loadStatuses();
          loadLeaveRequests();
          loadSwapRequests();
        }
      });
    });
  }

  // ===== 新增狀態 =====
  document.getElementById("addStatusBtn").addEventListener("click", async () => {
    const name = document.getElementById("newStatusName").value.trim();
    const color = document.getElementById("newStatusColor").value;
    if (!name) return alert("請輸入狀態名稱");
    await statusCol.add({ name, color });
    document.getElementById("newStatusName").value = "";
    loadStatuses();
    loadLeaveRequests();
    loadSwapRequests();
  });

  // ===== 開啟設定視窗 =====
  document.getElementById("openStatusSettings").addEventListener("click", () => {
    statusModal.show();
    loadStatuses();
  });

  // ===== 工具 =====
  function generateStatusSelect(currentStatus) {
    return `
      <select class="form-select form-select-sm statusSelect">
        ${statusList.map(s => `
          <option value="${s.name}" ${s.name === currentStatus ? "selected" : ""} style="color:${s.color || "#000"};">
            ${s.name}
          </option>`).join("")}
      </select>
    `;
  }

  function applyStatusColor(select) {
    const selected = statusList.find(s => s.name === select.value);
    select.style.color = selected ? selected.color : "#000";
  }

  function showLoading(tbody, colspan) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中...</td></tr>`;
  }

  // ===== 請假與調班載入（省略重複邏輯，保留核心） =====
  async function loadLeaveRequests(startDate = "", endDate = "") {
    showLoading(leaveBody, 10);
    let query = leaveCol.orderBy("applyDate", "desc");
    if (startDate && endDate)
      query = query.where("applyDate", ">=", startDate).where("applyDate", "<=", endDate);
    const snap = await query.get();
    leaveBody.innerHTML = snap.empty
      ? `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`
      : "";

    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>${generateStatusSelect(d.status)}</td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}" placeholder="簽名"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between align-items-center">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      leaveBody.appendChild(tr);

      const select = tr.querySelector(".statusSelect");
      applyStatusColor(select);
      select.addEventListener("change", async e => {
        const val = e.target.value;
        applyStatusColor(e.target);
        await leaveCol.doc(doc.id).update({ status: val });
      });

      tr.querySelector(".supervisorInput").addEventListener("change", async e => {
        await leaveCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此請假單？")) {
          await leaveCol.doc(doc.id).delete();
          loadLeaveRequests();
        }
      });
    });
  }

  async function loadSwapRequests(startDate = "", endDate = "") {
    showLoading(swapBody, 10);
    let query = swapCol.orderBy("applyDate", "desc");
    if (startDate && endDate)
      query = query.where("applyDate", ">=", startDate).where("applyDate", "<=", endDate);
    const snap = await query.get();
    swapBody.innerHTML = snap.empty
      ? `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`
      : "";

    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>${generateStatusSelect(d.status)}</td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}" placeholder="簽名"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between align-items-center">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      swapBody.appendChild(tr);

      const select = tr.querySelector(".statusSelect");
      applyStatusColor(select);
      select.addEventListener("change", async e => {
        const val = e.target.value;
        applyStatusColor(e.target);
        await swapCol.doc(doc.id).update({ status: val });
      });

      tr.querySelector(".supervisorInput").addEventListener("change", async e => {
        await swapCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此調班單？")) {
          await swapCol.doc(doc.id).delete();
          loadSwapRequests();
        }
      });
    });
  }

  // ===== 篩選 =====
  document.getElementById("filterLeaveBtn").addEventListener("click", () => {
    loadLeaveRequests(
      document.getElementById("leaveStartDate").value,
      document.getElementById("leaveEndDate").value
    );
  });

  document.getElementById("filterSwapBtn").addEventListener("click", () => {
    loadSwapRequests(
      document.getElementById("swapStartDate").value,
      document.getElementById("swapEndDate").value
    );
  });

  // ===== 初始化 =====
  await ensureDefaultStatuses();
  await loadStatuses();
  await loadLeaveRequests();
  await loadSwapRequests();
});
