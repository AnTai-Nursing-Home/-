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

  const tempInputs = new Map();

  function fmt(ts) {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function loadStatusColors() {
    const snap = await colStatus.get();
    snap.forEach(doc => {
      statusColorMap[doc.id] = doc.data().color || "#6c757d";
    });
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

      const commentsHtml = (req.comments || []).map(c => {
        const role = c.role || "admin"; // 舊資料保護
        const roleLabel = role === "nurse" ? "護理師" : "管理端";

        return `
        <div class="comment border rounded p-2 mb-1">
          <div>
            <strong>${roleLabel}：${c.author || "未紀錄"}</strong><br>
            ${c.message}
            <div class="text-muted small">${fmt(c.time)}</div>
          </div>

          ${role === "nurse" ? `
            <div class="text-end">
              <button class="btn btn-sm btn-outline-danger btn-del-comment"
                data-msg="${encodeURIComponent(c.message)}"
                data-author="${encodeURIComponent(c.author)}"
                data-time="${c.time?.seconds || ''}">
                刪除
              </button>
            </div>
          ` : ""}
        </div>`;
      }).join("") || `<span class="text-muted">—</span>`;

      const savedAuthor = tempInputs.get(reqId+"-author") || "";
      const savedMsg = tempInputs.get(reqId+"-msg") || "";

      const tr = document.createElement("tr");
      tr.dataset.id = reqId;

      tr.innerHTML = `
        <td>${req.item}</td>
        <td>${req.detail}</td>
        <td>${req.reporter}</td>
        <td><span class="badge" style="background:${color}">${req.status}</span></td>
        <td>${fmt(req.createdAt)}</td>
        <td style="min-width:260px;">
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

  async function loadRequests() {
    const snap = await colReq.orderBy("createdAt","desc").get().catch(()=>colReq.get());
    allRequests = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    renderRequests();
  }

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
  
    tempInputs.delete(id + "-author");
    tempInputs.delete(id + "-msg");
  
    const newComment = {
      author,
      message,
      role: "nurse",
      time: null // ✅ 先以 null 佔位
    };
  
    const docRef = colReq.doc(id);
  
    // ✅ 第一步：先加入註解物件
    await docRef.update({
      comments: firebase.firestore.FieldValue.arrayUnion(newComment)
    });
  
    // ✅ 第二步：更新這筆註解的時間戳記
    await docRef.update({
      comments: firebase.firestore.FieldValue.arrayRemove(newComment)
    });
    newComment.time = firebase.firestore.FieldValue.serverTimestamp();
    await docRef.update({
      comments: firebase.firestore.FieldValue.arrayUnion(newComment)
    });
  
    alert("註解新增成功 ✅");
    await loadRequests();
  });

  tbody.addEventListener("click", async e => {
    if (!e.target.classList.contains("btn-del-comment")) return;

    if (!confirm("確定要刪除此註解？")) return;

    const row = e.target.closest("tr");
    const id = row.dataset.id;

    const message = decodeURIComponent(e.target.dataset.msg);
    const author = decodeURIComponent(e.target.dataset.author);
    const seconds = parseInt(e.target.dataset.time);

    await colReq.doc(id).update({
      comments: firebase.firestore.FieldValue.arrayRemove({
        author,
        message,
        role: "nurse", // ✅ 只能刪「護理師新增」的
        time: seconds ? new firebase.firestore.Timestamp(seconds, 0) : null
      })
    });

    alert("已刪除 ✅");
    await loadRequests();
  });

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
