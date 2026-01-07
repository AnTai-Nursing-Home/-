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


  // === 新版新增報修單：分類/位置/物品下拉 ===
  const categorySel = document.getElementById("category");
  const locationSel = document.getElementById("location");
  const itemSel = document.getElementById("item");

  // 從住民系統抓床號，建立每樓層床號清單（供「房間」使用）
  const bedsByFloor = { "1F": [], "2F": [], "3F": [] };
  let bedsLoaded = false;

  function normalizeBedToken(v) {
    const s = String(v || "").trim().replace(/_/g, "-");
    // 接受 3 碼房號 + 子床號，例如 101-1
    const m = s.match(/^(\d{3})-(\w+)$/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  function uniqSortBeds(arr) {
    const uniq = Array.from(new Set(arr.filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true }));
    return uniq;
  }

  async function loadBedsOnce() {
    if (bedsLoaded) return;
    try {
      const snap = await db.collection("residents").get();
      const f1 = [], f2 = [], f3 = [];
      snap.forEach(doc => {
        const data = doc.data() || {};
        const bed = normalizeBedToken(data.bedNumber);
        if (!bed) return;
        if (bed.startsWith("1")) f1.push(bed);
        else if (bed.startsWith("2")) f2.push(bed);
        else if (bed.startsWith("3")) f3.push(bed);
      });
      bedsByFloor["1F"] = uniqSortBeds(f1);
      bedsByFloor["2F"] = uniqSortBeds(f2);
      bedsByFloor["3F"] = uniqSortBeds(f3);
      bedsLoaded = true;
    } catch (e) {
      console.warn("loadBedsOnce failed:", e);
      bedsLoaded = true; // 避免一直重試卡住
    }
  }

  function setSelectOptions(sel, options, placeholder) {
    if (!sel) return;
    sel.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.selected = true;
    ph.textContent = placeholder || "請選擇";
    sel.appendChild(ph);

    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value ?? opt;
      o.textContent = opt.label ?? opt;
      sel.appendChild(o);
    });

    sel.disabled = options.length === 0;
  }

  function buildItemOptions(category, location) {
    // 其他：位置只能其他，物品固定
    if (category === "其他") {
      return [
        { value: "洗澡床", label: "洗澡床" },
        { value: "洗澡椅", label: "洗澡椅" },
        { value: "輪椅", label: "輪椅" }
      ];
    }

    // 1F/2F/3F
    if (location === "護理站") {
      return [{ value: "飲水機", label: "飲水機" }];
    }

    if (location === "房間") {
      const beds = bedsByFloor[category] || [];
      // 每床：床 + 叫人鈴
      const opts = [];
      beds.forEach(b => {
        opts.push({ value: `${b}床`, label: `${b}床` });
        opts.push({ value: `${b}叫人鈴`, label: `${b}叫人鈴` });
      });
      return opts;
    }

    return [];
  }

  function onCategoryChange() {
    const cat = categorySel?.value || "";

    if (!cat) {
      setSelectOptions(locationSel, [], "請先選擇分類");
      setSelectOptions(itemSel, [], "請先選擇位置");
      return;
    }

    if (cat === "其他") {
      setSelectOptions(locationSel, [{ value: "其他", label: "其他" }], "請選擇位置");
      setSelectOptions(itemSel, buildItemOptions(cat, "其他"), "請選擇報修物品");
      return;
    }

    // 1F/2F/3F
    setSelectOptions(locationSel, [
      { value: "護理站", label: "護理站" },
      { value: "房間", label: "房間" }
    ], "請選擇位置");
    setSelectOptions(itemSel, [], "請先選擇位置");
  }

  async function onLocationChange() {
    const cat = categorySel?.value || "";
    const loc = locationSel?.value || "";

    if (!cat || !loc) {
      setSelectOptions(itemSel, [], "請先選擇位置");
      return;
    }

    if (loc === "房間") {
      await loadBedsOnce();
    }

    setSelectOptions(itemSel, buildItemOptions(cat, loc), "請選擇報修物品");
  }

  categorySel?.addEventListener("change", onCategoryChange);
  locationSel?.addEventListener("change", onLocationChange);


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
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">目前沒有報修單</td></tr>`;
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
        <td>${req.category || ""}</td>
        <td>${req.location || ""}</td>
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
  addRequestBtn.onclick = async () => {
    // 重置欄位
    document.getElementById("detail").value = "";
    document.getElementById("reporter").value = "";

    if (categorySel) categorySel.value = "";
    setSelectOptions(locationSel, [], "請先選擇分類");
    setSelectOptions(itemSel, [], "請先選擇位置");

    addModal.show();
  };

  saveRequestBtn.onclick = async () => {
    const category = (categorySel?.value || "").trim();
    const location = (locationSel?.value || "").trim();
    const item = (itemSel?.value || "").trim();
    const detail = document.getElementById("detail").value.trim();
    const reporter = document.getElementById("reporter").value.trim();

    if (!category || !location || !item || !reporter) {
      return alert("請選擇分類/位置/報修物品，並輸入報修人");
    }

    await colReq.add({
      category,
      location,
      item,
      detail,
      reporter,
      status: "待處理",
      note: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      // 舊欄位保留（舊資料可能仍有），此系統目前以 subcollection comments 為主
      comments: []
    });

    addModal.hide();
    await loadRequests();
  };

  await loadStatusColors();
  await loadRequests();
});
