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

  // 暫存未送出的輸入
  const tempInputs = new Map();

  // 本機識別（用於限制「只可刪除自己新增」）
  function getClientId() {
    const KEY = "nm_client_id";
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, v);
    }
    return v;
  }
  const clientId = getClientId();

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function loadStatusColors() {
    const snap = await colStatus.get();
    snap.forEach(doc => {
      const data = doc.data();
      statusColorMap[doc.id] = data.color || "#6c757d";
    });
  }

  // 讀取清單 + 各筆註解（最新在上）
  async function loadRequests() {
    const snap = await colReq.orderBy("createdAt","desc").get().catch(()=> colReq.get());
    const docs = snap.docs;

    // 將每筆請求 + comments 一次取回
    allRequests = await Promise.all(docs.map(async (doc) => {
      const data = { _id: doc.id, ...doc.data() };

      // 新版 comments（subcollection）
      const cSnap = await colReq.doc(doc.id).collection("comments")
        .orderBy("time","desc").get();
      const subComments = cSnap.docs.map(c => ({ _cid: c.id, ...c.data() }));

      // 兼容舊資料（陣列型），只顯示、不可刪
      const legacy = Array.isArray(data.comments) ? data.comments : [];
      const legacyComments = legacy
        .map(lc => ({
          _cid: null,
          author: lc.author || lc.authorName || "未紀錄",
          message: lc.message || "",
          role: lc.role || "admin",
          time: lc.time || null,
          _legacy: true
        }))
        .sort((a,b) => (b.time?.seconds||0) - (a.time?.seconds||0));

      data._comments = [...subComments, ...legacyComments];
      return data;
    }));

    renderRequests();
  }

  function renderRequests() {
    tbody.innerHTML = "";

    if (allRequests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有報修單</td></tr>`;
      return;
    }

    allRequests.forEach(req => {
      const reqId = req._id;
      const color = statusColorMap[req.status] || "#6c757d";

      const commentsHtml = (req._comments || []).map(c => {
        const role = c.role || "admin";
        const roleLabel = role === "nurse" ? "護理師" : "管理端";
        const canDelete = role === "nurse" && !c._legacy && c.clientId === clientId; // 只有自己新增的可刪
        return `
          <div class="comment border rounded p-2 mb-1 d-flex justify-content-between align-items-start">
            <div>
              <strong>${(c.author || "未紀錄")}（${roleLabel}）</strong><br>
              ${c.message || ""}
              <div class="text-muted small">${fmt(c.time)}</div>
            </div>
            ${canDelete ? `
              <button class="btn btn-sm btn-outline-danger btn-del-comment"
                data-cid="${c._cid}">刪除</button>` : ""}
          </div>
        `;
      }).join("") || `<span class="text-muted">—</span>`;

      const savedAuthor = tempInputs.get(reqId+"-author") || "";
      const savedMsg = tempInputs.get(reqId+"-msg") || "";

      const tr = document.createElement("tr");
      tr.dataset.id = reqId;

      tr.innerHTML = `
        <td>${req.item || ""}</td>
        <td>${req.detail || ""}</td>
        <td>${req.reporter || ""}</td>
        <td><span class="badge" style="background:${color}">${req.status || "—"}</span></td>
        <td>${fmt(req.createdAt)}</td>
        <td style="min-width:260px;">
          <strong>註解：</strong>
          <div class="mb-2">${commentsHtml}</div>

          <input type="text" class="form-control form-control-sm comment-author mb-1"
            placeholder="留言者名稱" value="${savedAuthor}">
          <textarea class="form-control form-control-sm comment-input mb-1"
            placeholder="輸入註解...">${savedMsg}</textarea>
          <button class="btn btn-sm btn-secondary btn-add-comment">新增註解</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 保留未送出內容
    document.querySelectorAll(".comment-author, .comment-input").forEach(input => {
      input.addEventListener("input", e => {
        const id = e.target.closest("tr").dataset.id;
        tempInputs.set(
          id + (e.target.classList.contains("comment-author") ? "-author" : "-msg"),
          e.target.value
        );
      });
    });
  }

  // 新增註解（subcollection：安全使用 serverTimestamp）
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

    tempInputs.delete(id+"-author");
    tempInputs.delete(id+"-msg");

    await colReq.doc(id).collection("comments").add({
      author,
      message,
      role: "nurse",
      clientId, // 用於限制刪除權限
      time: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("註解新增成功 ✅");
    await loadRequests();
  });

  // 刪除註解（僅刪自己新增的：UI 已限制，這裡直接刪）
  tbody.addEventListener("click", async e => {
    if (!e.target.classList.contains("btn-del-comment")) return;
    if (!confirm("確定要刪除此註解？")) return;

    const row = e.target.closest("tr");
    const id = row.dataset.id;
    const cid = e.target.dataset.cid;
    if (!cid) return;

    await colReq.doc(id).collection("comments").doc(cid).delete();
    alert("已刪除 ✅");
    await loadRequests();
  });

  // 原本新增報修單功能保持不變
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
      item, detail, reporter,
      status: "待處理",
      note: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      // 舊欄位保留以免既有流程依賴，但不再使用 arrayUnion
      comments: []
    });

    addModal.hide();
    await loadRequests();
  };

  await loadStatusColors();
  await loadRequests();
});
