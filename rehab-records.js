const db = firebase.firestore();

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
let selectedYear = currentYear;
let selectedMonth = currentMonth;
let residents = [];
let records = [];
let rows = [];
let editingRecord = null;
let editingResident = null;

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
    .limit(3000)
    .get();
  const arr = [];
  snap.forEach(ds => arr.push({ id: ds.id, ...ds.data() }));
  return arr;
}

function buildRows() {
  const recordMap = new Map(records.map(r => [r.residentId, r]));
  rows = residents.map(r => {
    const rec = recordMap.get(r.id) || null;
    return {
      resident: r,
      record: rec,
      status: rec ? "done" : "empty"
    };
  });
}

function updateStats(filteredRows = rows) {
  statResidents.textContent = rows.length;
  const done = rows.filter(r => r.status === "done").length;
  statDone.textContent = done;
  statPending.textContent = rows.length - done;
  monthTitle.textContent = `${ymText(selectedYear, selectedMonth)}復健紀錄`;
  monthSubtitle.textContent = `目前顯示 ${filteredRows.length} 位住民，可新增、編輯，或從上月複製資料。`;
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

  if (!data.length) {
    recordsTbody.innerHTML = `<tr><td colspan="8"><div class="empty-box">目前沒有符合條件的住民資料</div></td></tr>`;
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
        <td>
          ${rec
            ? `<span class="badge done"><i class="fas fa-circle-check"></i> 已建立</span>`
            : `<span class="badge empty"><i class="fas fa-hourglass-half"></i> 未建立</span>`}
        </td>
        <td>${escapeHtml(formatUpdatedAt(rec))}</td>
        <td>
          <div class="row-actions">
            <button class="mini-btn primary" data-action="edit" data-id="${escapeHtml(r.id)}">${rec ? "編輯" : "新增"}</button>
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
      if (btn.dataset.action === "edit") {
        openDrawer(item.resident, item.record);
      } else {
        await copyPreviousSingle(item.resident);
      }
    });
  });
}

async function loadMonthData() {
  recordsTbody.innerHTML = `<tr><td colspan="8" class="loading">讀取中...</td></tr>`;
  monthTitle.textContent = `${ymText(selectedYear, selectedMonth)}復健紀錄`;
  monthSubtitle.textContent = "資料讀取中...";
  records = await loadRecordsByYM(selectedYear, selectedMonth);
  buildRows();
  renderTable();
}

function openDrawer(resident, record = null) {
  editingResident = resident;
  editingRecord = record;
  drawerTitle.textContent = record ? "編輯復健紀錄" : "新增復健紀錄";
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
    createdById: editingRecord?.createdById || user?.staffId || "",
    createdByName: editingRecord?.createdByName || user?.displayName || user?.username || "",
    updatedById: user?.staffId || "",
    updatedByName: user?.displayName || user?.username || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (editingRecord?.id) {
      await db.collection("rehabRecords").doc(editingRecord.id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("rehabRecords").add(payload);
    }
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

async function copyPreviousSingle(resident = editingResident) {
  if (!resident) return;
  formStatus.textContent = "複製上月資料中...";
  try {
    const prev = await findPrevRecordByResident(resident.id);
    if (!prev) {
      formStatus.textContent = "上個月找不到此住民資料";
      return;
    }

    if (editingResident?.id === resident.id && recordDrawer.classList.contains("show")) {
      el("fType").value = prev.rehabType || "";
      el("fGoal").value = prev.rehabGoal || prev.goal || "";
      el("fPlan").value = prev.rehabPlan || "";
      el("fContent").value = prev.rehabContent || prev.content || "";
      el("fResponse").value = prev.rehabResponse || prev.response || "";
      el("fNote").value = prev.note || "";
      formStatus.textContent = "已帶入上月此住民資料，請確認後儲存";
      return;
    }

    const exists = rows.find(x => x.resident.id === resident.id)?.record;
    const user = getLoginUser();
    const payload = {
      residentId: resident.id,
      residentName: resident.residentName || "",
      residentNumber: resident.residentNumber || "",
      bedNumber: resident.bedNumber || resident.bed || resident.roomBed || "",
      gender: resident.gender || "",
      diagnosis: resident.diagnosis || "",
      mobility: resident.mobility || "",
      year: selectedYear,
      month: selectedMonth,
      ym: ymValue(selectedYear, selectedMonth),
      recordDate: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
      rehabType: prev.rehabType || "",
      rehabGoal: prev.rehabGoal || prev.goal || "",
      rehabPlan: prev.rehabPlan || "",
      rehabContent: prev.rehabContent || prev.content || "",
      rehabResponse: prev.rehabResponse || prev.response || "",
      note: prev.note || "",
      createdById: exists?.createdById || user?.staffId || "",
      createdByName: exists?.createdByName || user?.displayName || user?.username || "",
      updatedById: user?.staffId || "",
      updatedByName: user?.displayName || user?.username || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (exists?.id) {
      await db.collection("rehabRecords").doc(exists.id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("rehabRecords").add(payload);
    }

    await loadMonthData();
    formStatus.textContent = "已複製上月此住民資料";
  } catch (e) {
    console.error(e);
    formStatus.textContent = `複製失敗：${e.message || e}`;
  }
}

async function copyPreviousAll() {
  const prev = prevYM(selectedYear, selectedMonth);
  if (!confirm(`要將 ${ymText(prev.year, prev.month)} 的全部住民資料複製到 ${ymText(selectedYear, selectedMonth)} 嗎？\n已有資料者會覆蓋。`)) return;

  monthSubtitle.textContent = "批次複製中，請稍候...";
  try {
    const prevRecords = await loadRecordsByYM(prev.year, prev.month);
    if (!prevRecords.length) {
      monthSubtitle.textContent = "上個月沒有可複製的資料";
      return;
    }

    const user = getLoginUser();
    const existingMap = new Map(records.map(r => [r.residentId, r]));
    const residentMap = new Map(residents.map(r => [r.id, r]));

    for (const prevRec of prevRecords) {
      const resident = residentMap.get(prevRec.residentId);
      if (!resident) continue;

      const exists = existingMap.get(prevRec.residentId);
      const payload = {
        residentId: resident.id,
        residentName: resident.residentName || prevRec.residentName || "",
        residentNumber: resident.residentNumber || prevRec.residentNumber || "",
        bedNumber: resident.bedNumber || resident.bed || resident.roomBed || prevRec.bedNumber || "",
        gender: resident.gender || prevRec.gender || "",
        diagnosis: resident.diagnosis || prevRec.diagnosis || "",
        mobility: resident.mobility || prevRec.mobility || "",
        year: selectedYear,
        month: selectedMonth,
        ym: ymValue(selectedYear, selectedMonth),
        recordDate: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
        rehabType: prevRec.rehabType || "",
        rehabGoal: prevRec.rehabGoal || prevRec.goal || "",
        rehabPlan: prevRec.rehabPlan || "",
        rehabContent: prevRec.rehabContent || prevRec.content || "",
        rehabResponse: prevRec.rehabResponse || prevRec.response || "",
        note: prevRec.note || "",
        createdById: exists?.createdById || user?.staffId || "",
        createdByName: exists?.createdByName || user?.displayName || user?.username || "",
        updatedById: user?.staffId || "",
        updatedByName: user?.displayName || user?.username || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (exists?.id) {
        await db.collection("rehabRecords").doc(exists.id).update(payload);
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection("rehabRecords").add(payload);
      }
    }

    await loadMonthData();
    monthSubtitle.textContent = "已完成複製上月全部住民資料";
  } catch (e) {
    console.error(e);
    monthSubtitle.textContent = `批次複製失敗：${e.message || e}`;
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
    const firstEmpty = rows.find(r => r.status === "empty");
    if (firstEmpty) openDrawer(firstEmpty.resident, null);
    else alert("目前本月全部住民都已有紀錄，可直接編輯既有資料。");
  });

  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);
  drawerBackdrop.addEventListener("click", closeDrawer);
  el("closeDrawerBtn").addEventListener("click", closeDrawer);
  saveBtn.addEventListener("click", saveRecord);
  copyPrevSingleBtn.addEventListener("click", () => copyPreviousSingle(editingResident));
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
    recordsTbody.innerHTML = `<tr><td colspan="8"><div class="empty-box">系統初始化失敗：${escapeHtml(err.message || err)}</div></td></tr>`;
  });
});

if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
  document.dispatchEvent(new Event("firebase-ready"));
}
