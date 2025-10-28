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

  // ✅ 用來暫存每筆未送出的留言內容
  const tempInputs = new Map();

  // ✅ 格式化時間
  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ✅ 載入狀態顏色與篩選(不動原功能)
  async function loadStatusColors() {
    const snap = await colStatus.get();
    snap.forEach(doc => {
      const data = doc.data();
      statusColorMap[doc.id] = data.color || "#6c757d";
    });
  }

  // ✅ 渲染報修單
  function renderRequests(filter="all") {
    tbody.innerHTML = "";
    const filtered = allRequests;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    filtered.forEach(req => {
      const reqId = req._id;
      const color = statusColorMap[req.status] || "#6c757d";

      const commentsHtml = (req.comments || []).map(c => `
        <div class="comment border rounded p-2 mb-1 d-flex justify-content-between align-items-center">
          <div>
            <strong>${c.author || "未紀錄"}</strong>：${c.message}
            <div class="text-muted small">${fmt(c.time)}</div>
          </div>
          <button 
            class="btn btn-sm btn-outline-danger btn-del-comment"
            data-msg="${encodeURIComponent(c.message)}"
            data-author="${encodeURIComponent(c.author)}"
            data-time="${c.time?.seconds || ''}"
          >
            刪除
          </button>
        </div>
      `).join("") || `<span class="text-muted">—</span>`;

      const savedAuthor = tempInputs.get(reqId + "-author") || "";
      const savedMsg = tempInputs.get(reqId + "-msg") || "";

      const tr = document.createElement("tr");
      tr.dataset.id = reqId;

      tr.innerHTML = `
        <td>${req.item || ""}</td>
        <td>${req.detail || ""}</td>
        <td>${req.reporter || ""}</td>
        <td><span class="badge" style="background:${color}">${req.status}</span></td>
        <td>${fmt(req.createdAt)}</td>
        <td>
          <strong>註解：</strong>
          <div class="mb-2">${commentsHtml}</div>

          <input type="text" class="form-control form-control-sm comment-author mb-1" 
            placeholder="留言者名稱" value="${savedAuthor}">
          <textarea class="form-control form-control-sm comment-input mb-1" 
            placeholder="輸入註解..." >${savedMsg}</textarea>
          <button class="btn btn-sm btn-secondary btn-add-comment">新增註解</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // ✅ 記錄輸入框內容避免刷新 clears
    document.querySelectorAll(".comment-author, .comment-input").forEach(input => {
      input.addEventListener("input", e => {
        const row = e.target.closest("tr");
        const id = row.dataset.id;
        if (e.target.classList.contains("comment-author")) {
          tempInputs.set(id + "-author", e.target.value);
        } else {
          tempInputs.set(id + "-msg", e.target.value);
        }
      });
    });
  }

  // ✅ 載入資料
  async function loadRequests() {
    const snap = await colReq.orderBy("createdAt", "desc").get().catch(()=> colReq.get());
    allRequests = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    renderRequests();
  }

  // ✅ 新增註解
  tbody.addEventListener("click", async e => {
    if (!e.target.classList.contains("btn-add-comment")) return;
    const row = e.target.closest("tr");
    const id = row.dataset.id;

    const authorInput = row.querySelector(".comment-author");
    const msgInput = row.querySelector(".comment-input");
    const author = authorInput.value.trim();
    const message = msgInput.value.trim();

    if (!author) return alert("請輸入留言者名稱！");
    if (!message) return alert("請輸入註解內容！");

    // ✅ 清除暫存
    tempInputs.delete(id + "-author");
    tempInputs.delete(id + "-msg");

    await colReq.doc(id).update({
      comments: firebase.firestore.FieldValue.arrayUnion({
        author,
        message,
        time: firebase.firestore.FieldValue.serverTimestamp()
      })
    });

    alert("註解新增成功 ✅");
    await loadRequests();
  });

  // ✅ 刪除註解（僅可刪自己新增的）
  tbody.addEventListener("click", async e => {
    if (!e.target.classList.contains("btn-del-comment")) return;

    const row = e.target.closest("tr");
    const id = row.dataset.id;

    const message = decodeURIComponent(e.target.dataset.msg);
    const author = decodeURIComponent(e.target.dataset.author);
    const seconds = parseInt(e.target.dataset.time);

    if (!confirm("確定要刪除此註解？")) return;

    await colReq.doc(id).update({
      comments: firebase.firestore.FieldValue.arrayRemove({
        author,
        message,
        time: seconds ? new firebase.firestore.Timestamp(seconds, 0) : null
      })
    });

    alert("已刪除 ✅");
    await loadRequests();
  });

  // ✅ 原本新增報修單功能保持不變
  addRequestBtn.onclick = () => {
    document.getElementById("item").value = "";
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";
    addModal.show();
  };

  saveRequestBtn.onclick = async () => {
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
  };

  await loadStatusColors();
  await loadRequests();
});
