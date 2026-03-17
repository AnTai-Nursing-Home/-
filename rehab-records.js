const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
let selectedYear = currentYear;
let selectedMonth = currentMonth;
let residents = [];
let recordSessions = [];
let rosterIds = [];
let rows = [];
let editingRecord = null;
let editingResident = null;
let rosterDraftIds = [];

const el = id => document.getElementById(id);
const yearText = el("yearText");
const monthGrid = el("monthGrid");
const monthTitle = el("monthTitle");
const monthSubtitle = el("monthSubtitle");
const recordsTbody = el("recordsTbody");
const loginUserText = el("loginUserText");
const searchInput = el("searchInput");
const statusFilter = el("statusFilter");
const statResidents = el("statResidents");
const statDone = el("statDone");
const statPending = el("statPending");
const drawerBackdrop = el("drawerBackdrop");
const recordDrawer = el("recordDrawer");
const drawerTitle = el("drawerTitle");
const drawerSub = el("drawerSub");
const formStatus = el("formStatus");
const saveBtn = el("saveBtn");
const copyPrevSingleBtn = el("copyPrevSingleBtn");
const copyLastSessionBtn = el("copyLastSessionBtn");

const manageRosterBtn = el("manageRosterBtn");
const copyRosterBtn = el("copyRosterBtn");
const rosterModal = el("rosterModal");
const rosterModalBackdrop = el("rosterModalBackdrop");
const closeRosterModalBtn = el("closeRosterModalBtn");
const cancelRosterBtn = el("cancelRosterBtn");
const rosterSearchInput = el("rosterSearchInput");
const selectAllRosterBtn = el("selectAllRosterBtn");
const clearAllRosterBtn = el("clearAllRosterBtn");
const rosterCheckGrid = el("rosterCheckGrid");
const rosterSummaryText = el("rosterSummaryText");
const rosterStatus = el("rosterStatus");
const saveRosterBtn = el("saveRosterBtn");

const copyRosterModal = el("copyRosterModal");
const closeCopyRosterModalBtn = el("closeCopyRosterModalBtn");
const cancelCopyRosterBtn = el("cancelCopyRosterBtn");
const copyRosterYear = el("copyRosterYear");
const copyRosterMonth = el("copyRosterMonth");
const copyRosterWithRecords = el("copyRosterWithRecords");
const copyRosterStatus = el("copyRosterStatus");
const confirmCopyRosterBtn = el("confirmCopyRosterBtn");

const sessionListModal = el("sessionListModal");
const closeSessionListModalBtn = el("closeSessionListModalBtn");
const cancelSessionListModalBtn = el("cancelSessionListModalBtn");
const sessionListTitle = el("sessionListTitle");
const sessionListSub = el("sessionListSub");
const sessionListWrap = el("sessionListWrap");
const sessionListStatus = el("sessionListStatus");
let sessionListResident = null;

function getLoginUser() {
  for (const key of ["rehabAuth", "nutritionistAuth", "antai_session_user"]) {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!raw) continue;
    try { return JSON.parse(raw); } catch (_) {}
  }
  return null;
}

function renderLoginUser() {
  const u = getLoginUser();
  loginUserText.innerHTML = `<i class="fas fa-user"></i> 登入者：${escapeHtml((u?.staffId || "--") + " " + (u?.displayName || u?.username || "未登入"))}`;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ymText(y, m) {
  return `${y} 年 ${String(m).padStart(2, "0")} 月`;
}

function ymValue(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function prevYM(y, m) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

function parseBedSort(v) {
  const s = String(v || "").trim();
  const match = s.match(/^(\d+)(?:-(\d+))?/);
  if (!match) return [999999, 999999, s];
  return [Number(match[1] || 999999), Number(match[2] || 999999), s];
}

function compareResident(a, b) {
  const bedA = a.bedNumber || a.bed || a.roomBed || "";
  const bedB = b.bedNumber || b.bed || b.roomBed || "";
  const pa = parseBedSort(bedA);
  const pb = parseBedSort(bedB);
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return String(a.residentName || "").localeCompare(String(b.residentName || ""), "zh-Hant-u-kn-true");
}

function sortSessions(list) {
  return list.slice().sort((a, b) => {
    const da = String(a.recordDate || "");
    const db = String(b.recordDate || "");
    if (da !== db) return db.localeCompare(da);
    const ta = a.updatedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
    const tb = b.updatedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
    return tb - ta;
  });
}

function renderMonths() {
  yearText.textContent = selectedYear;
  monthGrid.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const active = m === selectedMonth ? "active" : "";
    return `
      <button type="button" class="month-btn ${active}" data-month="${m}">
        <div class="m">${String(m).padStart(2, "0")} 月</div>
        <div class="s">查看本月紀錄</div>
      </button>
    `;
  }).join("");

  monthGrid.querySelectorAll(".month-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      selectedMonth = Number(btn.dataset.month);
      renderMonths();
      await loadMonthData();
    });
  });
}

async function loadResidents() {
  const snap = await db.collection("residents").get();
  residents = [];
  snap.forEach(ds => residents.push({ id: ds.id, ...ds.data() }));
  residents.sort(compareResident);
}

async function loadRecordsByYM(year, month) {
  const ym = ymValue(year, month);
  const snap = await db.collection("rehabRecords")
    .where("ym", "==", ym)
    .limit(5000)
    .get();
  const arr = [];
  snap.forEach(ds => arr.push({ id: ds.id, ...ds.data() }));
  return arr;
}

async function loadRosterByYM(year, month) {
  const ym = ymValue(year, month);
  const docSnap = await db.collection("rehabMonthRoster").doc(ym).get();
  if (!docSnap.exists) return [];
  const data = docSnap.data() || {};
  return Array.isArray(data.residentIds) ? data.residentIds : [];
}

function buildRows() {
  const useRoster = Array.isArray(rosterIds) && rosterIds.length > 0;
  const sourceResidents = useRoster ? residents.filter(r => rosterIds.includes(r.id)) : [];
  const sessionMap = new Map();

  for (const rec of recordSessions) {
    const arr = sessionMap.get(rec.residentId) || [];
    arr.push(rec);
    sessionMap.set(rec.residentId, arr);
  }

  rows = sourceResidents.map(r => {
    const sessions = sortSessions(sessionMap.get(r.id) || []);
    return {
      resident: r,
      sessions,
      record: sessions[0] || null,
      count: sessions.length,
      status: sessions.length ? "done" : "empty"
    };
  });
}

function updateStats(filteredRows = rows) {
  statResidents.textContent = rows.length;
  const done = rows.filter(r => r.status === "done").length;
  statDone.textContent = done;
  statPending.textContent = rows.length - done;
  monthTitle.textContent = `${ymText(selectedYear, selectedMonth)}復健紀錄`;
  const totalSessions = rows.reduce((sum, r) => sum + (r.count || 0), 0);
  monthSubtitle.textContent = rows.length
    ? `目前顯示 ${filteredRows.length} 位復健住民，本月名單共 ${rows.length} 人，累計復健 ${totalSessions} 次。`
    : `本月尚未設定復健名單，請先點「設定本月復健名單」。`;
}

function getFilteredRows() {
  const kw = (searchInput.value || "").trim().toLowerCase();
  const st = statusFilter.value;
  return rows.filter(item => {
    if (st !== "all" && item.status !== st) return false;
    if (!kw) return true;
    const r = item.resident;
    const text = [r.bedNumber, r.bed, r.residentName, r.residentNumber].join(" ").toLowerCase();
    return text.includes(kw);
  });
}

function formatUpdatedAt(rec) {
  const d = rec?.updatedAt?.toDate?.() || rec?.createdAt?.toDate?.();
  if (!d) return "--";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function renderTable() {
  const data = getFilteredRows();
  updateStats(data);

  if (!rows.length) {
    recordsTbody.innerHTML = `<tr><td colspan="9"><div class="empty-box">本月尚未設定復健名單。請先按上方「設定本月復健名單」，選擇本月需要復健的住民。</div></td></tr>`;
    return;
  }

  if (!data.length) {
    recordsTbody.innerHTML = `<tr><td colspan="9"><div class="empty-box">目前沒有符合條件的復健住民資料</div></td></tr>`;
    return;
  }

  recordsTbody.innerHTML = data.map(item => {
    const r = item.resident;
    const rec = item.record;
    const bed = r.bedNumber || r.bed || r.roomBed || "--";
    return `
      <tr>
        <td>${escapeHtml(bed)}</td>
        <td class="name-cell">${escapeHtml(r.residentName || "--")}</td>
        <td>${escapeHtml(r.residentNumber || "--")}</td>
        <td>${escapeHtml(r.diagnosis || "--")}</td>
        <td>${escapeHtml(r.mobility || "--")}</td>
        <td>${item.count || 0} 次</td>
        <td>
          ${rec
            ? `<span class="badge done"><i class="fas fa-circle-check"></i> 已建立</span>`
            : `<span class="badge empty"><i class="fas fa-hourglass-half"></i> 未建立</span>`}
        </td>
        <td>${escapeHtml(formatUpdatedAt(rec))}</td>
        <td>
          <div class="row-actions">
            <button class="mini-btn primary" data-action="add" data-id="${escapeHtml(r.id)}"><i class="fas fa-plus"></i> 新增一次</button>
            <button class="mini-btn" data-action="view" data-id="${escapeHtml(r.id)}">查看紀錄</button>
            <button class="mini-btn" data-action="copy" data-id="${escapeHtml(r.id)}">複製上月</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  recordsTbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const residentId = btn.dataset.id;
      const item = rows.find(x => x.resident.id === residentId);
      if (!item) return;
      if (btn.dataset.action === "add") {
        openDrawer(item.resident, null);
      } else if (btn.dataset.action === "view") {
        openSessionListModal(item.resident, item.sessions || []);
      } else {
        await copyPreviousSingle(item.resident);
      }
    });
  });
}

async function loadMonthData() {
  recordsTbody.innerHTML = `<tr><td colspan="9" class="loading">讀取中...</td></tr>`;
  monthTitle.textContent = `${ymText(selectedYear, selectedMonth)}復健紀錄`;
  monthSubtitle.textContent = "資料讀取中...";
  recordSessions = await loadRecordsByYM(selectedYear, selectedMonth);
  rosterIds = await loadRosterByYM(selectedYear, selectedMonth);
  buildRows();
  renderTable();

  if (copyRosterYear) copyRosterYear.value = selectedYear;
  if (copyRosterMonth) copyRosterMonth.value = String(selectedMonth);
  if (manageRosterBtn) manageRosterBtn.innerHTML = `<i class="fas fa-users"></i> ${rows.length ? "編輯本月復健名單" : "設定本月復健名單"}`;
}

function openDrawer(resident, record = null) {
  editingResident = resident;
  editingRecord = record;
  drawerTitle.textContent = record ? "編輯本次復健紀錄" : "新增本次復健紀錄";
  drawerSub.textContent = `${ymText(selectedYear, selectedMonth)}｜${resident.residentName || ""}`;
  el("dBed").textContent = resident.bedNumber || resident.bed || resident.roomBed || "--";
  el("dName").textContent = resident.residentName || "--";
  el("dNo").textContent = resident.residentNumber || "--";
  el("dGender").textContent = resident.gender || "--";
  el("dDiagnosis").textContent = resident.diagnosis || "--";
  el("dMobility").textContent = resident.mobility || "--";

  el("fDate").value = record?.recordDate || `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
  el("fType").value = record?.rehabType || "";
  el("fGoal").value = record?.rehabGoal || record?.goal || "";
  el("fPlan").value = record?.rehabPlan || "";
  el("fContent").value = record?.rehabContent || record?.content || "";
  el("fResponse").value = record?.rehabResponse || record?.response || "";
  el("fNote").value = record?.note || "";
  formStatus.textContent = "";
  drawerBackdrop.classList.add("show");
  recordDrawer.classList.add("show");
}

function closeDrawer() {
  drawerBackdrop.classList.remove("show");
  recordDrawer.classList.remove("show");
}

function collectFormData() {
  return {
    recordDate: el("fDate").value,
    rehabType: el("fType").value,
    rehabGoal: el("fGoal").value.trim(),
    rehabPlan: el("fPlan").value.trim(),
    rehabContent: el("fContent").value.trim(),
    rehabResponse: el("fResponse").value.trim(),
    note: el("fNote").value.trim()
  };
}

function validateForm(data) {
  if (!editingResident) return "找不到住民資料";
  if (!data.recordDate) return "請選擇紀錄日期";
  return "";
}

async function saveRecord() {
  const user = getLoginUser();
  const data = collectFormData();
  const err = validateForm(data);
  if (err) {
    formStatus.textContent = err;
    return;
  }

  saveBtn.disabled = true;
  formStatus.textContent = "儲存中...";

  const payload = {
    residentId: editingResident.id,
    residentName: editingResident.residentName || "",
    residentNumber: editingResident.residentNumber || "",
    bedNumber: editingResident.bedNumber || editingResident.bed || editingResident.roomBed || "",
    gender: editingResident.gender || "",
    diagnosis: editingResident.diagnosis || "",
    mobility: editingResident.mobility || "",
    year: selectedYear,
    month: selectedMonth,
    ym: ymValue(selectedYear, selectedMonth),
    ...data,
    createdById: user?.staffId || "",
    createdByName: user?.displayName || user?.username || "",
    updatedById: user?.staffId || "",
    updatedByName: user?.displayName || user?.username || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("rehabRecords").add(payload);
    formStatus.textContent = "儲存成功";
    await loadMonthData();
    closeDrawer();
  } catch (e) {
    console.error(e);
    formStatus.textContent = `儲存失敗：${e.message || e}`;
  } finally {
    saveBtn.disabled = false;
  }
}

async function findPrevRecordByResident(residentId) {
  const prev = prevYM(selectedYear, selectedMonth);
  const snap = await db.collection("rehabRecords")
    .where("ym", "==", ymValue(prev.year, prev.month))
    .where("residentId", "==", residentId)
    .limit(1)
    .get();

  let found = null;
  snap.forEach(ds => { found = { id: ds.id, ...ds.data() }; });
  return found;
}

async function findLastSessionByResident(residentId) {
  const list = recordSessions
    .filter(r => r.residentId === residentId)
    .slice()
    .sort((a, b) => {
      const da = String(a.recordDate || "");
      const db = String(b.recordDate || "");
      if (da !== db) return db.localeCompare(da);
      const ta = a.updatedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const tb = b.updatedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return tb - ta;
    });
  return list[0] || null;
}

async function copyLastSessionToForm(resident = editingResident) {
  if (!resident) return;
  formStatus.textContent = "讀取前次紀錄中...";
  try {
    const prev = await findLastSessionByResident(resident.id);
    if (!prev) {
      formStatus.textContent = "本月尚無前次紀錄可複製";
      return;
    }
    el("fType").value = prev.rehabType || "";
    el("fGoal").value = prev.rehabGoal || prev.goal || "";
    el("fPlan").value = prev.rehabPlan || "";
    el("fContent").value = prev.rehabContent || prev.content || "";
    el("fResponse").value = prev.rehabResponse || prev.response || "";
    el("fNote").value = prev.note || "";
    formStatus.textContent = "已帶入前次紀錄，請確認後儲存";
  } catch (e) {
    console.error(e);
    formStatus.textContent = `複製前次失敗：${e.message || e}`;
  }
}

async function deleteSessionRecord(recordId) {
  if (!recordId) return;
  if (!confirm("確定要刪除這筆當日復健紀錄嗎？\n此操作無法復原。")) return;

  if (sessionListStatus) sessionListStatus.textContent = "刪除中...";
  try {
    await db.collection("rehabRecords").doc(recordId).delete();
    await loadMonthData();

    if (!sessionListResident) {
      closeSessionListModal();
      return;
    }

    const row = rows.find(x => x.resident.id === sessionListResident.id);
    const sessions = row?.sessions || [];

    if (!sessions.length) {
      closeSessionListModal();
      return;
    }

    openSessionListModal(sessionListResident, sessions);
    if (sessionListStatus) sessionListStatus.textContent = "已刪除該筆紀錄";
  } catch (e) {
    console.error(e);
    if (sessionListStatus) sessionListStatus.textContent = `刪除失敗：${e.message || e}`;
    alert(`刪除失敗：${e.message || e}`);
  }
}

function bindEvents() {
  el("prevYearBtn").addEventListener("click", async () => {
    selectedYear -= 1;
    renderMonths();
    await loadMonthData();
  });

  el("nextYearBtn").addEventListener("click", async () => {
    selectedYear += 1;
    renderMonths();
    await loadMonthData();
  });

  el("goTodayBtn").addEventListener("click", async () => {
    selectedYear = currentYear;
    selectedMonth = currentMonth;
    renderMonths();
    await loadMonthData();
  });

  el("refreshBtn").addEventListener("click", loadMonthData);
  el("copyAllBtn").addEventListener("click", copyPreviousAll);

  el("showOnlyEmptyBtn").addEventListener("click", () => {
    statusFilter.value = statusFilter.value === "empty" ? "all" : "empty";
    renderTable();
  });

  el("addSelectedBtn").addEventListener("click", () => {
    if (!rows.length) {
      alert("本月尚未設定復健名單，請先設定本月復健名單。");
      return;
    }
    if (rows[0]) openDrawer(rows[0].resident, null);
    else alert("本月沒有可新增的復健住民。");
  });

  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);
  drawerBackdrop.addEventListener("click", closeDrawer);
  el("closeDrawerBtn").addEventListener("click", closeDrawer);
  saveBtn.addEventListener("click", saveRecord);
  copyPrevSingleBtn.addEventListener("click", () => copyPreviousSingle(editingResident));
  if (copyLastSessionBtn) copyLastSessionBtn.addEventListener("click", () => copyLastSessionToForm(editingResident));

  manageRosterBtn.addEventListener("click", openRosterModal);
  copyRosterBtn.addEventListener("click", openCopyRosterModal);

  closeRosterModalBtn.addEventListener("click", closeRosterModal);
  cancelRosterBtn.addEventListener("click", closeRosterModal);
  rosterModalBackdrop.addEventListener("click", () => {
    closeRosterModal();
    closeCopyRosterModal();
    closeSessionListModal();
  });
  rosterSearchInput.addEventListener("input", renderRosterChecklist);

  selectAllRosterBtn.addEventListener("click", () => {
    const ids = getRosterFilteredResidents().map(r => r.id);
    rosterDraftIds = [...new Set([...rosterDraftIds, ...ids])];
    renderRosterChecklist();
  });

  clearAllRosterBtn.addEventListener("click", () => {
    const ids = getRosterFilteredResidents().map(r => r.id);
    rosterDraftIds = rosterDraftIds.filter(id => !ids.includes(id));
    renderRosterChecklist();
  });

  saveRosterBtn.addEventListener("click", saveRoster);

  closeCopyRosterModalBtn.addEventListener("click", closeCopyRosterModal);
  cancelCopyRosterBtn.addEventListener("click", closeCopyRosterModal);
  confirmCopyRosterBtn.addEventListener("click", copyRosterFromMonth);

  closeSessionListModalBtn.addEventListener("click", closeSessionListModal);
  cancelSessionListModalBtn.addEventListener("click", closeSessionListModal);
}

async function init() {
  renderLoginUser();
  renderMonths();
  bindEvents();
  await loadResidents();
  await loadMonthData();
}

document.addEventListener("firebase-ready", () => {
  init().catch(err => {
    console.error(err);
    recordsTbody.innerHTML = `<tr><td colspan="9"><div class="empty-box">系統初始化失敗：${escapeHtml(err.message || err)}</div></td></tr>`;
  });
});

if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
  document.dispatchEvent(new Event("firebase-ready"));
}
