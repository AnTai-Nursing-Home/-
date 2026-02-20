// 醫療巡迴門診掛號及就診狀況交班單 - 方案C（entries subcollection）
// ✅ 讀取時表格中顯示「讀取中...」（維持原本行為）
// ✅ 每列一筆 subcollection，避免整天資料被覆寫清空
// ✅ 自動搬移 legacy：若母文件仍有 entries 陣列且 subcollection 尚無資料，會搬移一次

document.addEventListener("firebase-ready", () => {
  const db = firebase.firestore();
  const COLLECTION = "doctor_rounds";
  const MIN_ROWS = 6;

  const tbody = document.getElementById("round-tbody");
  const dateInput = document.getElementById("round-date");
  const displayDateEl = document.getElementById("display-date");
  const signDateEl = document.getElementById("sign-date");
  const patientCountEl = document.getElementById("patient-count");

  const addRowBtn = document.getElementById("add-row-btn");
  const saveBtn = document.getElementById("save-btn");
  const exportBtn = document.getElementById("export-btn");

  const RESIDENTS_BY_BED = {};

  // =========================
  // Login User (from sessionStorage or Firestore userAccounts)
  // =========================
  const loginUserEl = document.getElementById("login-user");
  const CURRENT_USER = { staffId: "", name: "" };

  function renderLoginUser() {
    if (!loginUserEl) return;
    const label = (CURRENT_USER.staffId || CURRENT_USER.name)
      ? `登入者：${(CURRENT_USER.staffId || '').trim()} ${(CURRENT_USER.name || '').trim()}`.trim()
      : "登入者：—";
    loginUserEl.textContent = label;
  }

  async function initLoginUser() {
    // 1) Prefer sessionStorage (same as other systems)
    try {
      const raw = sessionStorage.getItem("antai_session_user");
      if (raw) {
        const u = JSON.parse(raw);
        CURRENT_USER.staffId = u.staffId || u.employeeId || "";
        CURRENT_USER.name = u.displayName || u.name || "";
        renderLoginUser();
        return;
      }
    } catch (e) {}

    // 2) Fallback to Firebase Auth + userAccounts/{uid}
    try {
      const auth = firebase.auth();
      auth.onAuthStateChanged(async (user) => {
        if (!user) { renderLoginUser(); return; }
        const doc = await db.collection("userAccounts").doc(user.uid).get();
        const d = doc.exists ? (doc.data() || {}) : {};
        CURRENT_USER.staffId = d.staffId || d.employeeId || "";
        CURRENT_USER.name = d.displayName || d.name || "";
        renderLoginUser();
      });
    } catch (e) {
      console.warn("[doctor-rounds] initLoginUser failed", e);
      renderLoginUser();
    }
  }


  function showLoadingRow() {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-secondary py-4">讀取中...</td></tr>`;
  }
  function clearLoadingRow() {
    const tr = tbody.querySelector("tr");
    if (tr && tr.textContent.includes("讀取中")) tbody.innerHTML = "";
  }

  async function loadResidents() {
    showLoadingRow();
    const snap = await db.collection("residents").get();
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!d.bedNumber) return;
      RESIDENTS_BY_BED[d.bedNumber] = {
        name: d.name || doc.id || "",
        idNumber: d.idNumber || ""
      };
    });
    clearLoadingRow();
  }

  function buildBedOptions(selected) {
    const beds = Object.keys(RESIDENTS_BY_BED).sort((a, b) => a.localeCompare(b, "zh-Hant"));
    let html = `<option value=''>選擇床號</option>`;
    beds.forEach(b => {
      const sel = b === selected ? "selected" : "";
      html += `<option value='${b}' ${sel}>${b}</option>`;
    });
    return html;
  }

  function toRoc(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${y - 1911}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  }

  function normalizeBedSortKey(bed) {
    const nums = bed.match(/\d+/g)?.map(Number) || [0];
    const [a1, a2 = 0] = nums;
    return [a1, a2];
  }

  function sortTableByBed() {
    const rows = [...tbody.querySelectorAll("tr")];
    rows.sort((a, b) => {
      const bedA = a.querySelector(".bed-select")?.value || "";
      const bedB = b.querySelector(".bed-select")?.value || "";
      const [a1, a2] = normalizeBedSortKey(bedA);
      const [b1, b2] = normalizeBedSortKey(bedB);
      return a1 - b1 || a2 - b2 || (bedA || "").localeCompare(bedB || "", "zh-Hant");
    });
    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
  }

  function refreshMeta() {
    const rows = [...tbody.querySelectorAll("tr")];
    rows.forEach((tr, i) => {
      const idx = tr.querySelector(".idx");
      if (idx) idx.textContent = i + 1;
    });

    const count = rows.filter(r => {
      const bed = r.querySelector(".bed-select")?.value || "";
      return bed.trim() !== "";
    }).length;

    patientCountEl.textContent = count;

    const roc = toRoc(dateInput.value);
    displayDateEl.textContent = roc || "—";
    signDateEl.textContent = roc || "";
  }

  function genId() {
    // short random id (good enough for Firestore doc id)
    return "e_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function createRow(row = {}) {
    const tr = document.createElement("tr");
    // row._id will be stored in dataset for saving as subcollection doc id
    tr.dataset.entryId = row._id || row.entryId || "";

    tr.innerHTML = `
      <td class="text-center idx"></td>
      <td><select class="form-select form-select-sm bed-select">${buildBedOptions(row.bedNumber || "")}</select></td>
      <td><input type="text" class="form-control form-control-sm name-input text-center" value="${row.name || ""}" readonly></td>
      <td><input type="text" class="form-control form-control-sm id-input text-center" value="${row.idNumber || ""}" readonly></td>
      <td><input type="text" class="form-control form-control-sm vitals-input text-center" value="${row.vitals || ""}"></td>
      <td><textarea class="form-control form-control-sm cond-input text-center" rows="1">${row.condition || ""}</textarea></td>
      <td><textarea class="form-control form-control-sm note-input text-center" rows="1">${row.doctorNote || ""}</textarea></td>
      <td class="text-center"><button class="btn btn-outline-danger btn-sm del-btn"><i class="fa fa-trash"></i></button></td>
    `;

    const bedSelect = tr.querySelector(".bed-select");

    // When bed changes, auto-fill name/idNumber
    bedSelect.addEventListener("change", () => {
      const bed = bedSelect.value;
      const info = RESIDENTS_BY_BED[bed];
      const nameInput = tr.querySelector(".name-input");
      const idInput = tr.querySelector(".id-input");

      if (info) {
        nameInput.value = info.name;
        idInput.value = info.idNumber;
      } else {
        nameInput.value = "";
        idInput.value = "";
      }

      // if entryId not set yet, set it
      if (!tr.dataset.entryId) tr.dataset.entryId = genId();
      refreshMeta();
    });

    tr.querySelector(".del-btn").addEventListener("click", () => {
      tr.remove();
      ensureMinRows();
      refreshMeta();
    });

    // Ensure id exists when any input is edited
    ["input", "change"].forEach(evt => {
      tr.addEventListener(evt, () => {
        if (!tr.dataset.entryId) tr.dataset.entryId = genId();
      }, { passive: true });
    });

    tbody.appendChild(tr);
  }

  function ensureMinRows() {
    while (tbody.children.length < MIN_ROWS) createRow();
  }

  function collectRowsFromUI() {
    const date = dateInput.value;
    if (!date) throw new Error("no-date");

    const rows = [...tbody.querySelectorAll("tr")].map((tr) => {
      const bedNumber = tr.querySelector(".bed-select")?.value || "";
      const name = tr.querySelector(".name-input")?.value || "";
      const idNumber = tr.querySelector(".id-input")?.value || "";
      const vitals = tr.querySelector(".vitals-input")?.value || "";
      const condition = tr.querySelector(".cond-input")?.value || "";
      const doctorNote = tr.querySelector(".note-input")?.value || "";
      const entryId = tr.dataset.entryId || "";

      return { _id: entryId, bedNumber, name, idNumber, vitals, condition, doctorNote };
    }).filter(e => Object.values(e).some(v => (v || "") !== ""));

    // ensure every row has an id for saving
    rows.forEach(r => { if (!r._id) r._id = genId(); });

    const totalPatients = rows.filter(r => (r.bedNumber || "").trim() !== "").length;

    return {
      id: date,
      date,
      rows,
      totalPatients,
      updatedAt: new Date().toISOString()
    };
  }

  async function migrateLegacyIfNeeded(docRef) {
    // Legacy: doc has entries array; New: entries subcollection
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const d = docSnap.data() || {};
    const legacyEntries = Array.isArray(d.entries) ? d.entries : null;
    if (!legacyEntries || legacyEntries.length === 0) return;

    // If subcollection already has entries, don't migrate
    const subSnap = await docRef.collection("entries").limit(1).get();
    if (!subSnap.empty) return;

    const batch = db.batch();
    legacyEntries.forEach((e, idx) => {
      const id = genId();
      const ref = docRef.collection("entries").doc(id);
      batch.set(ref, {
        bedNumber: e.bedNumber || "",
        name: e.name || "",
        idNumber: e.idNumber || "",
        vitals: e.vitals || "",
        condition: e.condition || "",
        doctorNote: e.doctorNote || "",
        orderIndex: idx,
        migratedAt: new Date().toISOString()
      }, { merge: true });
    });

    // Update meta and remove legacy entries field to prevent future confusion
    batch.set(docRef, {
      schema: "vC_subcollection",
      totalPatients: (legacyEntries || []).filter(x => (x.bedNumber || "").trim() !== "").length,
      updatedAt: new Date().toISOString(),
      entries: firebase.firestore.FieldValue.delete()
    }, { merge: true });

    await batch.commit();
  }

  async function loadSheet(auto = false) {
    const date = dateInput.value;
    if (!date) return;

    showLoadingRow();

    const docRef = db.collection(COLLECTION).doc(date);

    // ensure day doc exists (meta only)
    const daySnap = await docRef.get();
    if (!daySnap.exists && auto) {
      await docRef.set({
        id: date,
        date,
        schema: "vC_subcollection",
        totalPatients: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else if (daySnap.exists) {
      // Migrate legacy if needed
      await migrateLegacyIfNeeded(docRef);
    }

    // Read entries subcollection
    const entriesSnap = await docRef.collection("entries").get();

    tbody.innerHTML = "";

    // Convert to row objects
    const rows = [];
    entriesSnap.forEach((doc) => {
      const e = doc.data() || {};
      rows.push({
        _id: doc.id,
        bedNumber: e.bedNumber || "",
        name: e.name || "",
        idNumber: e.idNumber || "",
        vitals: e.vitals || "",
        condition: e.condition || "",
        doctorNote: e.doctorNote || ""
      });
    });

    // Sort by bed like UI
    rows.sort((a, b) => {
      const [a1, a2] = normalizeBedSortKey(a.bedNumber || "");
      const [b1, b2] = normalizeBedSortKey(b.bedNumber || "");
      return a1 - b1 || a2 - b2 || (a.bedNumber || "").localeCompare(b.bedNumber || "", "zh-Hant");
    });

    rows.forEach(r => createRow(r));

    ensureMinRows();
    sortTableByBed();
    refreshMeta();
  }

  async function saveSheet() {
    let payload;
    try {
      payload = collectRowsFromUI();
    } catch {
      alert("請先選擇日期");
      return;
    }

    const date = payload.date;
    const docRef = db.collection(COLLECTION).doc(date);
    const colRef = docRef.collection("entries");

    showLoadingRow();

    // Fetch existing docs to delete removed ones
    const existingSnap = await colRef.get();
    const existingIds = new Set();
    existingSnap.forEach(d => existingIds.add(d.id));

    const batch = db.batch();

    // Upsert current rows
    payload.rows.forEach((r, idx) => {
      const id = r._id || genId();
      const ref = colRef.doc(id);
      batch.set(ref, {
        bedNumber: r.bedNumber || "",
        name: r.name || "",
        idNumber: r.idNumber || "",
        vitals: r.vitals || "",
        condition: r.condition || "",
        doctorNote: r.doctorNote || "",
        orderIndex: idx,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      existingIds.delete(id); // left are removed
    });

    // Delete removed docs
    existingIds.forEach((id) => {
      batch.delete(colRef.doc(id));
    });

    // Update meta doc
    batch.set(docRef, {
      id: date,
      date,
      schema: "vC_subcollection",
      totalPatients: payload.totalPatients,
      updatedAt: payload.updatedAt
    }, { merge: true });

    await batch.commit();

    clearLoadingRow();
    await loadSheet(false); // reload to normalize ordering/index
    alert("✅ 已儲存醫巡單");
  }

  // =========================
  // Export Excel (keep existing implementation, but source data from UI)
  // =========================
  function collectDataForExport() {
    // Keep the same shape as legacy collectData used by exportExcel
    const p = collectRowsFromUI();
    const entries = p.rows.map(r => ({
      bedNumber: r.bedNumber || "",
      name: r.name || "",
      idNumber: r.idNumber || "",
      vitals: r.vitals || "",
      condition: r.condition || "",
      doctorNote: r.doctorNote || ""
    }));
    return { id: p.id, date: p.date, entries, totalPatients: p.totalPatients, updatedAt: p.updatedAt };
  }

  function exportExcel() {
    let data;
    try {
      data = collectDataForExport();
    } catch (e) {
      alert("請先選擇日期");
      return;
    }

    // Prefer ExcelJS template-matched export
    if (typeof ExcelJS === 'undefined') {
      console.warn('[doctor-rounds] ExcelJS missing, fallback to legacy HTML export');
      exportExcelLegacy(data);
      return;
    }

    const rocDate = toRoc(data.date);
    const count = (data.entries || []).filter(e => (e.bedNumber || '').trim() !== '').length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NH System';
    wb.created = new Date();

    const borderThinBlack = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };

    // Sheet 1
    const ws = wb.addWorksheet('醫巡交班單', { views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });

    ws.pageSetup = {
      paperSize: 9,
      orientation: 'portrait',
      scale: 85,
      fitToPage: false,
      margins: { left: 0.251969, right: 0.251969, top: 0.751969, bottom: 0.751969, header: 0.299213, footer: 0.299213 }
    };
    ws.pageMargins = { left: 0.251969, right: 0.251969, top: 0.751969, bottom: 0.751969, header: 0.299213, footer: 0.299213 };

    ws.columns = [
      { key: 'A', width: 6.0 },
      { key: 'B', width: 8.0 },
      { key: 'C', width: 14.7109375 },
      { key: 'D', width: 14.0 },
      { key: 'E', width: 27.29 },
      { key: 'F', width: 27.29 },
      { key: 'G', width: 27.29 }
    ];

    const MIN_EXPORT_ROWS = 15;

    // 動態列數：至少維持 15 列版面，但可依實際看診人數向下延伸
    const exportRows = (data.entries || []);
    const rowCount = Math.max(MIN_EXPORT_ROWS, exportRows.length);
    const startRow = 4; // 資料起始列（第3列是欄位標題）
    const signRow = startRow + rowCount; // 簽名列

    for (let r = 1; r <= signRow; r++) ws.getRow(r).height = 60;

    ws.mergeCells('A1:G1');
    ws.mergeCells('A2:C2');
    ws.mergeCells('D2:E2');
    ws.mergeCells('F2:G2');
    ws.mergeCells(`A${signRow}:E${signRow}`);
    ws.mergeCells(`F${signRow}:G${signRow}`);

    const fontTitle = { name: '標楷體', size: 16, bold: true };
    const fontInfo  = { name: '標楷體', size: 12, bold: true };
    const fontHead  = { name: '標楷體', size: 12, bold: true };
    const fontBody  = { name: '標楷體', size: 11 };

    function setCell(addr, value, { font, align, fill, border, wrap } = {}) {
      const c = ws.getCell(addr);
      c.value = value;
      if (font) c.font = font;
      c.alignment = Object.assign({ vertical: 'middle', horizontal: 'center', wrapText: !!wrap }, align || {});
      if (fill) c.fill = fill;
      if (border) c.border = border;
      return c;
    }
    function applyBorderToRange(a1, a2) {
      const start = ws.getCell(a1);
      const end = ws.getCell(a2);
      for (let r = start.row; r <= end.row; r++) {
        for (let c = start.col; c <= end.col; c++) {
          ws.getCell(r, c).border = borderThinBlack;
        }
      }
    }

    setCell('A1', '醫療巡迴門診掛號及就診狀況交班單', { font: fontTitle, align: { horizontal: 'center' }, border: borderThinBlack });
    setCell('A2', `醫巡日期：${rocDate}`, { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });
    setCell('D2', '醫巡醫師：王冠勛醫師', { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });
    setCell('F2', `看診人數：${count}`, { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });

    const headers = ['排序', '床號', '姓名', '身分證字號', '生命徵象', '病情簡述', '醫師手記'];
    ['A','B','C','D','E','F','G'].forEach((col, i) => {
      setCell(`${col}3`, headers[i], { font: fontHead, fill: fillHeader, border: borderThinBlack });
    });

    const body = exportRows;
    for (let i = 0; i < rowCount; i++) {
      const r = startRow + i;
      const e = body[i] || {};
      setCell(`A${r}`, (body[i] ? (i + 1) : ''), { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`B${r}`, e.bedNumber || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`C${r}`, e.name || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`D${r}`, e.idNumber || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`E${r}`, e.vitals || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`F${r}`, e.condition || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`G${r}`, e.doctorNote || '', { font: fontBody, border: borderThinBlack, wrap: true });
    }

    setCell(`A${signRow}`, '醫巡醫師簽章:', { font: fontInfo, align: { horizontal: 'left' }, border: borderThinBlack, wrap: true });
    setCell(`F${signRow}`, '跟診護理師簽章:', { font: fontInfo, align: { horizontal: 'left' }, border: borderThinBlack, wrap: true });

    applyBorderToRange('A1', `G${signRow}`);

    // 匯出資訊（底部）
    const exportInfoRow = signRow + 2;
    ws.getRow(exportInfoRow).height = 24;
    ws.mergeCells(`A${exportInfoRow}:G${exportInfoRow}`);

    const now = new Date();
    const exportTime =
      `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ` +
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const exporter = `${(CURRENT_USER.staffId || '').trim()} ${(CURRENT_USER.name || '').trim()}`.trim() || '—';
    setCell(`A${exportInfoRow}`, `匯出時間：${exportTime}    匯出人員：${exporter}`, {
      font: fontBody,
      align: { horizontal: 'right' },
      wrap: true
    });

    // Sheet 2
    const ws2 = wb.addWorksheet('摘要');
    ws2.columns = [{ width: 22.0 }, { width: 18.0 }, { width: 22.0 }, { width: 18.0 }];
    ws2.getRow(1).height = 26.1;
    ws2.getRow(2).height = 21.95;
    ws2.getRow(3).height = 20.1;
    ws2.getRow(4).height = 20.1;
    ws2.getRow(6).height = 30.0;

    ws2.mergeCells('A1:D1');
    ws2.mergeCells('A6:D6');

    const fontSumTitle = { name: 'Microsoft JhengHei', size: 16, bold: true };
    const fontSumHead  = { name: 'Microsoft JhengHei', size: 12, bold: true };
    const fontSumBody  = { name: 'Microsoft JhengHei', size: 11 };

    function set2(addr, value, { font, fill, align, border } = {}) {
      const c = ws2.getCell(addr);
      c.value = value;
      if (font) c.font = font;
      c.alignment = Object.assign({ vertical: 'middle', horizontal: 'center', wrapText: true }, align || {});
      if (fill) c.fill = fill;
      if (border) c.border = border;
      return c;
    }

    const filledVitals = (data.entries || []).filter(e => (e.vitals || '').trim() !== '').length;
    const filledCond   = (data.entries || []).filter(e => (e.condition || '').trim() !== '').length;
    const filledNote   = (data.entries || []).filter(e => (e.doctorNote || '').trim() !== '').length;

    set2('A1', `醫巡摘要（${rocDate}）`, { font: fontSumTitle, align: { horizontal: 'center' } });

    ['A2','B2','C2','D2'].forEach((addr, idx) => {
      const text = ['項目','數量','項目','數量'][idx];
      set2(addr, text, { font: fontSumHead, fill: fillHeader, border: borderThinBlack });
    });

    set2('A3', '看診人數', { font: fontSumBody, border: borderThinBlack, align: { horizontal: 'left' } });
    set2('B3', count, { font: fontSumBody, border: borderThinBlack });
    set2('C3', '生命徵象已填', { font: fontSumBody, border: borderThinBlack, align: { horizontal: 'left' } });
    set2('D3', filledVitals, { font: fontSumBody, border: borderThinBlack });

    set2('A4', '病情簡述已填', { font: fontSumBody, border: borderThinBlack, align: { horizontal: 'left' } });
    set2('B4', filledCond, { font: fontSumBody, border: borderThinBlack });
    set2('C4', '醫師手記已填', { font: fontSumBody, border: borderThinBlack, align: { horizontal: 'left' } });
    set2('D4', filledNote, { font: fontSumBody, border: borderThinBlack });

    set2('A6', '提示：若要追資料，可用「生命徵象/病情簡述/醫師手記」未填的床號做回頭補寫。', {
      font: fontSumBody,
      align: { horizontal: 'left', wrapText: true }
    });

    wb.xlsx.writeBuffer().then((buf) => {
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `醫巡交班單_${data.date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }).catch((err) => {
      console.error('[doctor-rounds] ExcelJS export failed', err);
      alert('匯出失敗（ExcelJS）');
    });
  }

  function exportExcelLegacy(data) {
    const rocDate = toRoc(data.date);
    const rowsHtml = (data.entries || []).map((e, i) => `
      <tr style="height:60pt;">
        <td style="text-align:center;vertical-align:middle;">${i + 1}</td>
        <td style="text-align:center;vertical-align:middle;">${e.bedNumber || ""}</td>
        <td style="text-align:center;vertical-align:middle;">${e.name || ""}</td>
        <td style="text-align:center;vertical-align:middle;">${e.idNumber || ""}</td>
        <td style="text-align:center;vertical-align:middle;">${e.vitals || ""}</td>
        <td style="text-align:center;vertical-align:middle;">${e.condition || ""}</td>
        <td style="text-align:center;vertical-align:middle;">${e.doctorNote || ""}</td>
      </tr>`).join("");

    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            margin-top: 1.91cm;
            margin-bottom: 1.91cm;
            margin-left: 0.64cm;
            margin-right: 0.64cm;
          }
          body {
            mso-header-margin: 0.76cm;
            mso-footer-margin: 0.76cm;
          }
          table { border-collapse: collapse; mso-border-alt: solid #000 1px; }
          table, td, th {
            border: 1px solid #000;
            font-family: "DFKai-SB", "標楷體";
            mso-font-charset: 136;
          }
          td, th { text-align: center; vertical-align: middle; }
          .title { font-size: 16pt; font-weight: bold; }
          .info { font-size: 12pt; font-weight: bold; }
          .header { font-size: 12pt; font-weight: bold; }
          .body { font-size: 12pt; }
          .sign { font-size: 12pt; }
        </style>
      </head>
      <body>
        <table>
          <tr style="height:60pt;">
            <td class="title" colspan="7">醫療巡迴門診掛號及就診狀況交班單</td>
          </tr>
          <tr style="height:33.6pt;">
            <td class="info" colspan="3">醫巡日期：${rocDate}</td>
            <td class="info" colspan="4">看診人數：${data.totalPatients || 0}</td>
          </tr>
          <tr style="height:60pt;">
            <th class="header">排序</th>
            <th class="header">床號</th>
            <th class="header">姓名</th>
            <th class="header">身分證字號</th>
            <th class="header">生命徵象</th>
            <th class="header">病情簡述/主訴</th>
            <th class="header">醫師手記/囑語</th>
          </tr>
          ${rowsHtml}
          <tr style="height:33.6pt;">
            <td class="sign" colspan="3">巡診醫師簽名：</td>
            <td class="sign" colspan="4">跟診護理師簽名：</td>
          </tr>

          <tr style="height:24pt;">
            <td colspan="7" style="text-align:right;vertical-align:middle;font-size:10pt;">
              匯出時間：${new Date().toLocaleString('zh-TW', { hour12: false })}&nbsp;&nbsp;&nbsp;&nbsp;匯出人員：${(() => {
                const s = (CURRENT_USER.staffId || '').trim() + ' ' + (CURRENT_USER.name || '').trim();
                return s.trim() || '—';
              })()}
            </td>
          </tr>
        </table>
      </body>
    </html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `醫療巡迴門診掛號及就診狀況交班單_${data.date}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  addRowBtn.addEventListener("click", () => {
    createRow();
    sortTableByBed();
    ensureMinRows();
    refreshMeta();
  });

  saveBtn.addEventListener("click", saveSheet);
  exportBtn.addEventListener("click", exportExcel);

  dateInput.addEventListener("change", async () => { await loadSheet(true); });

  (async () => {
    initLoginUser();
    await loadResidents();
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    await loadSheet(true);
  })();
});
