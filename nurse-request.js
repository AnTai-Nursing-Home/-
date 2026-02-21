document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();

  // Collections
  const nurseCol = db.collection("nurses"); // ✅ 人員資料庫改成從 nurses 抓
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");
  const statusCol = db.collection("request_status_list");

  // DOM
  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");
  const recordBody = document.getElementById("recordTableBody");

  const leaveApplicantSelect =
    document.getElementById("leaveApplicant") ||
    document.querySelector("#leaveForm select[name='applicant']");
  const swapApplicantSelect = document.getElementById("swapApplicant");

  const loginUserDisplay = document.getElementById("loginUserDisplay");

  // Record tab controls
  const recordTypeEl = document.getElementById("recordType");
  const recordStatusEl = document.getElementById("recordStatus");
  const recordFromEl = document.getElementById("recordFrom");
  const recordToEl = document.getElementById("recordTo");
  const recordSearchBtn = document.getElementById("recordSearchBtn");
  const recordResetBtn = document.getElementById("recordResetBtn");

  let statusList = [];

  // ===== Login / Session (防呆：支援多種既有系統存法) =====
  function safeJsonParse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function pick(obj, keys) {
    if (!obj) return "";
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

  
// ========== Login（完全對齊 nurse-primary-cases.js：參考 supplies.js） ==========
function getLoginUser() {
  // 系統共用登入資訊
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem('antai_session_user');
      if (raw) {
        const a = JSON.parse(raw);
        const staffId = (a?.staffId || a?.username || a?.id || '').toString().trim();
        const displayName = (a?.displayName || a?.name || a?.staffName || '').toString().trim();
        if (staffId || displayName) return { staffId, displayName };
      }
    } catch (e) {}

    for (const k of ['officeAuth', 'nurseAuth', 'caregiverAuth']) {
      try {
        const raw = store.getItem(k);
        if (!raw) continue;
        const a = JSON.parse(raw);
        const staffId = (a?.staffId || a?.username || a?.id || '').toString().trim();
        const displayName = (a?.displayName || a?.name || a?.staffName || '').toString().trim();
        if (staffId || displayName) return { staffId, displayName };
      } catch (e) {}
    }
  }

  // 常見單值 key
  const maybeNameKeys = ['loginName','userName','displayName','currentUserName','staffName','caregiverName','nurseName','officeName'];
  for (const k of maybeNameKeys) {
    const v = sessionStorage.getItem(k) || localStorage.getItem(k);
    if (v) return { staffId: '', displayName: String(v).trim() };
  }
  return { staffId: '', displayName: '' };
}

// 讓下游流程（resolveLoggedInNurse / pick()）可以照舊運作：回傳相容欄位
function getLoginContext() {
  const u = getLoginUser();
  return {
    staffId: u.staffId,
    employeeId: u.staffId,
    userId: u.staffId,
    uid: u.staffId,
    id: u.staffId,
    displayName: u.displayName,
    name: u.displayName
  };
}

  async function resolveLoggedInNurse() {
    const ctx = getLoginContext();
    const rawId = pick(ctx, ["nurseId", "userId", "uid", "id", "employeeId", "staffId"]);
    const rawName = pick(ctx, ["name", "displayName", "fullName", "username"]);

    // 先嘗試用 ID 對 nurses doc.id 直接比對
    if (rawId) {
      try {
        const snap = await nurseCol.doc(String(rawId)).get();
        if (snap.exists) {
          const n = snap.data() || {};
          const name = n.name || n.fullName || n.displayName || rawName || String(rawId);
          return { nurseId: snap.id, nurseName: name };
        }
      } catch {}
    }

    // 再用姓名查（若你 nurses 有 name 欄位）
    if (rawName) {
      try {
        const q = await nurseCol.where("name", "==", String(rawName)).limit(1).get();
        if (!q.empty) {
          const doc = q.docs[0];
          return { nurseId: doc.id, nurseName: (doc.data()?.name || rawName) };
        }
      } catch {
        // fallback：抓全部比對
        try {
          const all = await nurseCol.get();
          const found = all.docs.find(d => (d.data()?.name || "").trim() === String(rawName).trim());
          if (found) return { nurseId: found.id, nurseName: found.data()?.name || rawName };
        } catch {}
      }
    }

    // 如果完全抓不到，至少顯示登入者名稱（但無法鎖定申請/紀錄）
    if (rawName) return { nurseId: "", nurseName: rawName };
    return { nurseId: "", nurseName: "" };
  }

  function renderLoginUser(nurseName) {
    if (!loginUserDisplay) return;
    loginUserDisplay.textContent = nurseName ? `登入者：${nurseName}` : "登入者：未登入 / 讀取失敗";
  }

  // ===== 狀態樣式顯示 =====
  async function loadStatuses() {
    const snap = await statusCol.orderBy("name").get().catch(() => statusCol.get());
    statusList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function getStatusBadge(statusName) {
    const found = statusList.find(s => s.name === statusName);
    return found
      ? `<span class="badge" style="background:${found.color};color:#fff;">${found.name}</span>`
      : `<span class="badge bg-secondary">${statusName || ""}</span>`;
  }

  function buildRecordStatusOptions() {
    if (!recordStatusEl) return;
    recordStatusEl.innerHTML = `<option value="">全部</option>`;
    statusList.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      recordStatusEl.appendChild(opt);
    });
  }

  // ===== 護理師名冊（從 nurses 抓）=====
  function clearSelect(sel) {
    if (!sel) return;
    sel.innerHTML = `<option value="">請選擇護理師</option>`;
  }

  async function loadNurses() {
    clearSelect(leaveApplicantSelect);
    clearSelect(swapApplicantSelect);

    // 優先只抓在職；若資料庫沒有 status 欄位或無索引，則回退抓全部
    let snap;
    try {
      snap = await nurseCol.where("status", "==", "在職").orderBy("name").get();
    } catch (err) {
      snap = await nurseCol.orderBy("name").get().catch(() => nurseCol.get());
    }

    if (snap.empty) return;

    snap.forEach(doc => {
      const n = doc.data() || {};
      const name = n.name || n.fullName || n.displayName || "";
      if (!name) return;

      [leaveApplicantSelect, swapApplicantSelect].forEach(sel => {
        if (!sel) return;
        const opt = document.createElement("option");
        opt.value = doc.id;      // nurseId
        opt.textContent = name;  // 顯示姓名
        sel.appendChild(opt);
      });
    });
  }

  async function getNurseNameById(nurseId) {
    if (!nurseId) return "";
    try {
      const snap = await nurseCol.doc(nurseId).get();
      const n = snap.data() || {};
      return n.name || n.fullName || n.displayName || "";
    } catch {
      return "";
    }
  }

  // ===== 載入請假申請（總覽）=====
  function hoursText(d) {
    const v = Number(d?.durationValue ?? 0);
    if (v > 0) return v + " 小時";
    return "";
  }

  async function loadLeaveRequests() {
    leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await leaveCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有申請資料</td></tr>`;
      return;
    }

    leaveBody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${hoursText(d)}</td>
        <td>${d.reason || ""}</td>
        <td>${getStatusBadge(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
        <td>${d.note || ""}</td>
      `;
      leaveBody.appendChild(tr);
    });
  }

  // ===== 載入調班申請（總覽）=====
  async function loadSwapRequests() {
    swapBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">載入中...</td></tr>`;
    const snap = await swapCol.orderBy("applyDate", "desc").get();

    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">目前沒有調班資料</td></tr>`;
      return;
    }

    swapBody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data() || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>${getStatusBadge(d.status)}</td>
        <td>${d.supervisorSign || ""}</td>
        <td>${d.note || ""}</td>
      `;
      swapBody.appendChild(tr);
    });
  }

  // ===== 申請紀錄（只顯示登入者）=====
  function dateInRange(dateStr, fromStr, toStr) {
    if (!dateStr) return false;
    if (fromStr && dateStr < fromStr) return false; // YYYY-MM-DD 字串可直接比較
    if (toStr && dateStr > toStr) return false;
    return true;
  }

  function renderRecordRows(rows) {
    if (!recordBody) return;
    if (!rows.length) {
      recordBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">查無資料</td></tr>`;
      return;
    }

    recordBody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.typeLabel}</td>
        <td>${r.applyDate || ""}</td>
        <td>${r.applicant || ""}</td>
        <td>${r.summary || ""}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td>${r.supervisorSign || ""}</td>
        <td>${r.note || ""}</td>
      `;
      recordBody.appendChild(tr);
    });
  }

  async function getMyDocs(col, nurseId) {
    if (!nurseId) return [];
    // 優先 where 篩選；若遇到索引或權限問題，回退抓全部再前端過濾
    try {
      const q = await col.where("nurseId", "==", nurseId).get();
      return q.docs;
    } catch {
      const all = await col.get();
      return all.docs.filter(d => (d.data()?.nurseId || "") === nurseId);
    }
  }

  async function loadMyRecords(loggedIn) {
    if (!recordBody) return;
    recordBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">載入中...</td></tr>`;

    const nurseId = loggedIn?.nurseId || "";
    const nurseName = loggedIn?.nurseName || "";

    if (!nurseId) {
      recordBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">⚠️ 無法取得登入者的 nurseId，因此無法查詢個人申請紀錄（請確認登入者資料是否有對應 nurses 的 doc.id）。</td></tr>`;
      return;
    }

    const type = recordTypeEl?.value || "all";
    const status = recordStatusEl?.value || "";
    const from = recordFromEl?.value || "";
    const to = recordToEl?.value || "";

    const rows = [];

    if (type === "all" || type === "leave") {
      const docs = await getMyDocs(leaveCol, nurseId);
      docs.forEach(doc => {
        const d = doc.data() || {};
        rows.push({
          type: "leave",
          typeLabel: "請假",
          applyDate: d.applyDate || "",
          applicant: d.applicant || nurseName,
          status: d.status || "",
          supervisorSign: d.supervisorSign || "",
          note: d.note || "",
          summary: `假別：${d.leaveType || ""}\n日期：${d.leaveDate || ""}\n班別：${d.shift || ""}\n時數：${hoursText(d)}\n理由：${d.reason || ""}`.trim()
        });
      });
    }

    if (type === "all" || type === "swap") {
      const docs = await getMyDocs(swapCol, nurseId);
      docs.forEach(doc => {
        const d = doc.data() || {};
        rows.push({
          type: "swap",
          typeLabel: "調班",
          applyDate: d.applyDate || "",
          applicant: d.applicant || nurseName,
          status: d.status || "",
          supervisorSign: d.supervisorSign || "",
          note: d.note || "",
          summary: `日期：${d.swapDate || ""}\n原班：${d.originalShift || ""}\n欲換：${d.newShift || ""}\n理由：${d.reason || ""}`.trim()
        });
      });
    }

    // 篩選
    let filtered = rows.slice();

    if (status) filtered = filtered.filter(r => (r.status || "") === status);
    if (from || to) filtered = filtered.filter(r => dateInRange(r.applyDate, from, to));

    // 依申請日期新到舊
    filtered.sort((a, b) => (b.applyDate || "").localeCompare(a.applyDate || ""));

    renderRecordRows(filtered);
  }

  // ===== 送出請假申請 =====
  document.getElementById("leaveForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const nurseId = leaveApplicantSelect?.value || form.applicant?.value || "";
    const nurseName = await getNurseNameById(nurseId);

    if (!nurseId || !nurseName) {
      alert("⚠️ 請先選擇/確認申請人（護理師）");
      return;
    }

    const data = {
      nurseId,
      applicant: nurseName,
      applyDate: new Date().toISOString().split("T")[0],
      leaveType: form.leaveType.value,
      leaveDate: form.leaveDate.value,
      shift: form.shift.value,
      reason: form.reason.value,
      durationValue: Number(form.durationValue.value),
      durationUnit: "hour",
      status: "待審核",
      note: "",
      supervisorSign: "",
      // 登入者欄位（便於稽核/追蹤）
      createdById: nurseId,
      createdByName: nurseName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await leaveCol.add(data);
    alert(`✅ 已送出請假申請！（申請人：${nurseName}）`);
    form.reset();

    // 送出後，申請人維持為登入者
    if (leaveApplicantSelect) leaveApplicantSelect.value = nurseId;
  });

  // ===== 送出調班申請 =====
  document.getElementById("swapForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const nurseId = swapApplicantSelect?.value || form.applicant?.value || "";
    const nurseName = await getNurseNameById(nurseId);

    if (!nurseId || !nurseName) {
      alert("⚠️ 請先選擇/確認申請人（護理師）");
      return;
    }

    const data = {
      nurseId,
      applicant: nurseName,
      applyDate: new Date().toISOString().split("T")[0],
      swapDate: form.swapDate.value,
      originalShift: form.originalShift.value,
      newShift: form.newShift.value,
      reason: form.reason.value,
      status: "待審核",
      note: "",
      supervisorSign: "",
      // 登入者欄位（便於稽核/追蹤）
      createdById: nurseId,
      createdByName: nurseName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await swapCol.add(data);
    alert(`✅ 已送出調班申請！（申請人：${nurseName}）`);
    form.reset();

    // 送出後，申請人維持為登入者
    if (swapApplicantSelect) swapApplicantSelect.value = nurseId;
  });

  // ===== 初始化 =====
  await loadStatuses();
  buildRecordStatusOptions();

  await loadNurses();

  const loggedIn = await resolveLoggedInNurse();
  renderLoginUser(loggedIn.nurseName);

  // 申請人自動帶入登入者，並鎖定不可選
  if (loggedIn?.nurseId) {
    if (leaveApplicantSelect) {
      leaveApplicantSelect.value = loggedIn.nurseId;
      leaveApplicantSelect.disabled = true;
    }
    if (swapApplicantSelect) {
      swapApplicantSelect.value = loggedIn.nurseId;
      swapApplicantSelect.disabled = true;
    }
  }

  await loadLeaveRequests();
  await loadSwapRequests();
  await loadMyRecords(loggedIn);

  // Record tab actions
  recordSearchBtn?.addEventListener("click", () => loadMyRecords(loggedIn));
  recordResetBtn?.addEventListener("click", () => {
    if (recordTypeEl) recordTypeEl.value = "all";
    if (recordStatusEl) recordStatusEl.value = "";
    if (recordFromEl) recordFromEl.value = "";
    if (recordToEl) recordToEl.value = "";
    loadMyRecords(loggedIn);
  });

  // 即時同步 Firestore 更新（總覽表格）
  leaveCol.onSnapshot(loadLeaveRequests);
  swapCol.onSnapshot(loadSwapRequests);

  // 個人紀錄也同步（只要該 collection 有變動就重刷）
  leaveCol.onSnapshot(() => loadMyRecords(loggedIn));
  swapCol.onSnapshot(() => loadMyRecords(loggedIn));
});
