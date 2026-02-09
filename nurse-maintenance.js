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

  // ===== 登入者（同 office / office-request 的 sessionStorage 規則） =====
  function readAuthFromSession(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return (u && typeof u === 'object') ? u : null;
    } catch (_) {
      return null;
    }
  }

  function getLoggedUser() {
    // ✅ 先依序嘗試 sessionStorage 常用登入 key
    const sessionKeys = ['nurseAuth','officeAuth','adminAuth','auth','userAuth','loginAuth'];
    for (const k of sessionKeys) {
      const u = readAuthFromSession(k);
      if (u) return u;
    }

    // ✅ 再掃描 sessionStorage：支援 antai_session* / antai_sess*（你系統目前實際使用）
    try {
      const keys = Object.keys(sessionStorage || {});
      for (const k of keys) {
        const lk = String(k).toLowerCase();
        if (lk.startsWith("antai_session") || lk.startsWith("antai_sess")) {
          const u = readAuthFromSession(k);
          if (u) return u;
        }
      }
    } catch (_) {}

    // 其他頁面若有掛全域
    if (window.loginUser && typeof window.loginUser === 'object') return window.loginUser;
    if (window.currentUser && typeof window.currentUser === 'object') return window.currentUser;

    // 兼容：localStorage 可能有 JSON
    const jsonKeys = ['loginUser','currentUser','loggedInUser','nurseUser','user','userInfo','authUser'];
    for (const k of jsonKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') return obj;
      } catch (_) {}
    }

    // 兼容：分散欄位
    const empId = localStorage.getItem('employeeId') || localStorage.getItem('empId') || localStorage.getItem('staffId') || '';
    const name  = localStorage.getItem('employeeName') || localStorage.getItem('name') || localStorage.getItem('staffName') || '';
    if (empId || name) return { empId, employeeId: empId, staffId: empId, name, displayName: name };

    return {};
  }

  function getLoggedEmpId(u) {
    return String(u?.staffId || u?.empId || u?.employeeId || u?.id || '').trim();
  }
  function getLoggedName(u) {
    return String(u?.displayName || u?.name || u?.username || '').trim();
  }

  const loggedUser = getLoggedUser();
  const loggedEmpId = getLoggedEmpId(loggedUser);
  const loggedName  = getLoggedName(loggedUser);

  function getLoggedUserLabel() {
    if (loggedEmpId && loggedName) return `${loggedEmpId} ${loggedName}`;
    if (loggedName) return loggedName;
    if (loggedEmpId) return loggedEmpId;
    return '未登入';
  }

  // 右上角顯示登入者（員編 + 姓名）
  const loginUserInfoEl = document.getElementById('loginUserInfo');
  if (loginUserInfoEl) {
    loginUserInfoEl.textContent = `登入者：${getLoggedUserLabel()}`;
  }



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
        opts.push({ value: `${b}叫人鈴`, label: `${b}中央氣體牆` });
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

          <div class="small text-muted mb-1">留言者：${(loggedName || getLoggedUserLabel())}</div>
          <textarea class="form-control form-control-sm comment-input mb-1"
            placeholder="輸入註解...">${savedMsg}</textarea>
          <button class="btn btn-sm btn-secondary btn-add-comment">新增註解</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 保留未送出內容
    document.querySelectorAll(".comment-input").forEach(input => {
      input.addEventListener("input", e => {
        const id = e.target.closest("tr").dataset.id;
        tempInputs.set(
          id + "-msg",
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

    const msgInput = row.querySelector(".comment-input");
    const author = (loggedName || getLoggedUserLabel()).trim();
    const message = msgInput.value.trim();

    if (!message) return alert("請輸入註解內容！");

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
    // 報修人：自動帶入登入者（姓名為主）
    document.getElementById("reporter").value = (loggedName || getLoggedUserLabel());

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
      return alert("請選擇分類 / 位置 / 報修物品");
    }
    // 重複申請偵測：比對「分類 + 位置 + 報修物品」
    // 只要找到相同三項且狀態不是「已完成/紀錄」，就提示並阻擋送出。
    // ※不使用 orderBy，避免 Firestore 需要額外複合索引導致查詢直接失效
    try {
      const dupSnap = await colReq
        .where("category", "==", category)
        .where("location", "==", location)
        .where("item", "==", item)
        .limit(20)
        .get();

      const isClosedStatus = (s) => {
        const v = String(s || "").trim();
        return v === "已完成" || v === "紀錄";
      };

      let dupDoc = null;
      dupSnap.forEach((d) => {
        if (dupDoc) return;
        const data = d.data() || {};
        if (!isClosedStatus(data.status)) dupDoc = { id: d.id, ...data };
      });

      if (dupDoc) {
        let dayText = "某天";
        try {
          if (dupDoc.createdAt && dupDoc.createdAt.toDate) {
            const dt = dupDoc.createdAt.toDate();
            const y = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, "0");
            const dd = String(dt.getDate()).padStart(2, "0");
            dayText = `${y}-${mm}-${dd}`;
          }
        } catch (_) {}

        alert(`偵測到${dayText}有一筆相同的報修資料（分類/位置/報修物品相同），且狀態尚未「已完成/紀錄」。\n\n為避免重複申請，本次送出已被系統阻擋，請先確認或改在原單補充註解。`);
        return; // 阻擋送出
      }
    } catch (err) {
      console.warn("duplicate check failed:", err);
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
