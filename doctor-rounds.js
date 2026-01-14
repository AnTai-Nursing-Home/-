// 醫療巡迴門診掛號及就診狀況交班單 - 方案 C（每列一筆 subcollection，避免整天覆寫）
// ✅ Firestore 結構：doctor_rounds/{YYYY-MM-DD}（meta） + doctor_rounds/{date}/entries/{entryId}（每列一筆）
// ✅ 具備 legacy 自動搬移：若舊版 doc 內有 entries 陣列且 subcollection 為空，會自動搬移一次
// ✅ 讀取時表格中顯示「讀取中...」
// ✅ 匯出 Excel、儲存、自動載入功能齊全

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

  // 目前日期已載入的 entry doc ids（用於儲存時判斷哪些被刪除）
  let LOADED_ENTRY_IDS = new Set();

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

  function sortTableByBed() {
    const rows = [...tbody.querySelectorAll("tr")];
    rows.sort((a, b) => {
      const bedA = a.querySelector(".bed-select")?.value || "";
      const bedB = b.querySelector(".bed-select")?.value || "";
      const parseBed = bed => bed.match(/\d+/g)?.map(Number) || [0];
      const [a1, a2 = 0] = parseBed(bedA);
      const [b1, b2 = 0] = parseBed(bedB);
      return a1 - b1 || a2 - b2;
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

  // row._docId 會存放 entries/{entryId} 的 id
  function createRow(row = {}) {
    const tr = document.createElement("tr");
    if (row._docId) tr.dataset.docId = row._docId;

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
      refreshMeta();
    });

    tr.querySelector(".del-btn").addEventListener("click", () => {
      // 注意：刪除列不會立刻刪 Firestore，會在按「儲存」時同步刪除
      tr.remove();
      ensureMinRows();
      refreshMeta();
    });

    tbody.appendChild(tr);
  }

  function ensureMinRows() {
    while (tbody.children.length < MIN_ROWS) createRow();
  }

  // 蒐集 UI 資料（用於匯出 Excel / 儲存）
  function collectData() {
    const date = dateInput.value;
    if (!date) throw new Error("no-date");

    const rows = [...tbody.querySelectorAll("tr")];

    const entries = rows.map(tr => {
      const bedNumber = tr.querySelector(".bed-select")?.value || "";
      const name = tr.querySelector(".name-input")?.value || "";
      const idNumber = tr.querySelector(".id-input")?.value || "";
      const vitals = tr.querySelector(".vitals-input")?.value || "";
      const condition = tr.querySelector(".cond-input")?.value || "";
      const doctorNote = tr.querySelector(".note-input")?.value || "";
      const _docId = tr.dataset.docId || ""; // subcollection doc id
      return { _docId, bedNumber, name, idNumber, vitals, condition, doctorNote };
    }).filter(e => Object.values(e).some(v => (v || "") !== "")); // 只要有任何欄位有值就算一筆

    const totalPatients = entries.filter(e => (e.bedNumber || "").trim() !== "").length;

    return {
      id: date,
      date,
      entries,              // 注意：entries 只作為前端運算/匯出，不再直接整包存進 doc
      totalPatients,
      updatedAt: new Date().toISOString()
    };
  }

  // ====== Legacy migration (舊版：doc 內有 entries array) ======
  async function migrateLegacyIfNeeded(dayRef) {
    const daySnap = await dayRef.get();
    if (!daySnap.exists) return;

    const d = daySnap.data() || {};
    if (d.legacyMigrated) return;

    const legacyEntries = Array.isArray(d.entries) ? d.entries : [];
    if (!legacyEntries.length) return;

    const entriesCol = dayRef.collection("entries");
    const subSnap = await entriesCol.limit(1).get();
    if (!subSnap.empty) {
      // subcollection 已有資料，就不做搬移
      await dayRef.set({ legacyMigrated: true, legacyMigratedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    // 開始搬移
    const batch = db.batch();
    legacyEntries.forEach(e => {
      const ref = entriesCol.doc(); // auto id
      batch.set(ref, {
        bedNumber: e.bedNumber || "",
        name: e.name || "",
        idNumber: e.idNumber || "",
        vitals: e.vitals || "",
        condition: e.condition || "",
        doctorNote: e.doctorNote || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // 標記已搬移（保留舊 entries 不刪除，避免誤刪；之後讀取一律以 subcollection 為準）
    batch.set(dayRef, {
      legacyMigrated: true,
      legacyMigratedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
  }

  // ====== Load (subcollection) ======
  async function loadSheet() {
    const date = dateInput.value;
    if (!date) return;

    showLoadingRow();
    tbody.innerHTML = "";
    LOADED_ENTRY_IDS = new Set();

    const dayRef = db.collection(COLLECTION).doc(date);

    // 若此日是舊版資料，先搬移一次
    try {
      await migrateLegacyIfNeeded(dayRef);
    } catch (e) {
      console.warn("[doctor-rounds] legacy migrate failed (ignored):", e);
    }

    // 讀取 subcollection entries
    const entriesSnap = await dayRef.collection("entries").get();
    entriesSnap.forEach(doc => {
      const e = doc.data() || {};
      LOADED_ENTRY_IDS.add(doc.id);
      createRow({
        _docId: doc.id,
        bedNumber: e.bedNumber || "",
        name: e.name || "",
        idNumber: e.idNumber || "",
        vitals: e.vitals || "",
        condition: e.condition || "",
        doctorNote: e.doctorNote || ""
      });
    });

    ensureMinRows();
    sortTableByBed();
    refreshMeta();
  }

  // ====== Save (batch upsert + delete removed) ======
  async function saveSheet() {
    let data;
    try {
      data = collectData();
    } catch {
      alert("請先選擇日期");
      return;
    }

    const date = data.date;
    const dayRef = db.collection(COLLECTION).doc(date);
    const entriesCol = dayRef.collection("entries");

    showLoadingRow();

    // 用 batch 保證一致性
    const batch = db.batch();
    const keptIds = new Set();

    // 1) upsert：把目前畫面上的每一筆寫回 subcollection
    //    - 有 docId：覆寫該列
    //    - 無 docId：建立新 doc，並回填到 DOM（commit 後我們再回填）
    const rows = [...tbody.querySelectorAll("tr")];
    const toBackfill = []; // { tr, refId }

    rows.forEach(tr => {
      const bedNumber = tr.querySelector(".bed-select")?.value || "";
      const name = tr.querySelector(".name-input")?.value || "";
      const idNumber = tr.querySelector(".id-input")?.value || "";
      const vitals = tr.querySelector(".vitals-input")?.value || "";
      const condition = tr.querySelector(".cond-input")?.value || "";
      const doctorNote = tr.querySelector(".note-input")?.value || "";

      const hasAny = [bedNumber, name, idNumber, vitals, condition, doctorNote].some(v => (v || "").trim() !== "");
      if (!hasAny) return; // 空列不存

      const existingId = tr.dataset.docId || "";
      const ref = existingId ? entriesCol.doc(existingId) : entriesCol.doc();

      batch.set(ref, {
        bedNumber, name, idNumber, vitals, condition, doctorNote,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...(existingId ? {} : { createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      }, { merge: true });

      keptIds.add(ref.id);

      if (!existingId) {
        // 新增列：先記下，commit 後把 docId 回填到該列，避免下次又新增一筆
        toBackfill.push({ tr, refId: ref.id });
      }
    });

    // 2) delete：載入時存在，但現在畫面上沒有的 entry，視為刪除
    LOADED_ENTRY_IDS.forEach(id => {
      if (!keptIds.has(id)) {
        batch.delete(entriesCol.doc(id));
      }
    });

    // 3) meta：更新母文件（不存 entries，避免整天覆寫風險）
    batch.set(dayRef, {
      id: date,
      date,
      totalPatients: data.totalPatients,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      schema: "vC-subcollection"
    }, { merge: true });

    try {
      await batch.commit();

      // 回填新 docId
      toBackfill.forEach(({ tr, refId }) => {
        tr.dataset.docId = refId;
      });

      LOADED_ENTRY_IDS = keptIds;

      clearLoadingRow();
      alert("✅ 已儲存醫巡單");
      refreshMeta();
    } catch (e) {
      console.error("[doctor-rounds] save failed:", e);
      clearLoadingRow();
      alert("❌ 儲存失敗，請稍後再試");
    }
  }

  // ===== Export Excel（沿用你原本 ExcelJS 範本匯出，資料來源改用 collectData()） =====
  function exportExcel() {
    let data;
    try {
      data = collectData();
    } catch (e) {
      alert("請先選擇日期");
      return;
    }

    // Prefer ExcelJS template-matched export (same logic family as residents system)
    if (typeof ExcelJS === 'undefined') {
      console.warn('[doctor-rounds] ExcelJS missing, fallback to legacy HTML export');
      exportExcelLegacy();
      return;
    }

    const rocDate = toRoc(data.date);
    const count = (data.entries || []).filter(e => (e.bedNumber || '').trim() !== '').length;

    // ===== Workbook =====
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NH System';
    wb.created = new Date();

    // ===== Common =====
    const borderThinBlack = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };

    // =========================
    // Sheet 1: 醫巡交班單（完全比照範本）
    // =========================
    const ws = wb.addWorksheet('醫巡交班單', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] // freeze panes at A4
    });

    // Page setup (match template)
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'portrait',
      scale: 85,
      fitToPage: false,
      margins: {
        left: 0.251969,
        right: 0.251969,
        top: 0.751969,
        bottom: 0.751969,
        header: 0.299213,
        footer: 0.299213
      }
    };
    ws.pageMargins = { left: 0.251969, right: 0.251969, top: 0.751969, bottom: 0.751969, header: 0.299213, footer: 0.299213 };

    // Column widths A-G
    ws.columns = [
      { key: 'A', width: 6.0 },           // 排序
      { key: 'B', width: 8.0 },           // 床號
      { key: 'C', width: 14.7109375 },    // 姓名
      { key: 'D', width: 14.0 },          // 身分證字號
      { key: 'E', width: 27.29 },         // 生命徵象
      { key: 'F', width: 27.29 },         // 病情簡述
      { key: 'G', width: 27.29 }          // 醫師手記
    ];

    // Row heights 1-19 all 60
    for (let r = 1; r <= 19; r++) ws.getRow(r).height = 60;

    // Merges (match template)
    ws.mergeCells('A1:G1');
    ws.mergeCells('A2:C2');
    ws.mergeCells('D2:E2');
    ws.mergeCells('F2:G2');
    ws.mergeCells('A19:E19');
    ws.mergeCells('F19:G19');

    // Fonts (match template)
    const fontTitle = { name: '標楷體', size: 16, bold: true };
    const fontInfo  = { name: '標楷體', size: 12, bold: true };
    const fontHead  = { name: '標楷體', size: 12, bold: true };
    const fontBody  = { name: '標楷體', size: 11 };

    // Helpers
    function setCell(addr, value, { font, align, fill, border, wrap } = {}) {
      const c = ws.getCell(addr);
      c.value = value;
      if (font) c.font = font;
      c.alignment = Object.assign(
        { vertical: 'middle', horizontal: 'center', wrapText: !!wrap },
        align || {}
      );
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

    // Title
    setCell('A1', '醫療巡迴門診掛號及就診狀況交班單', { font: fontTitle, align: { horizontal: 'center' }, border: borderThinBlack });

    // Info row
    setCell('A2', `醫巡日期：${rocDate}`, { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });
    setCell('D2', '醫巡醫師：王冠勛醫師', { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });
    setCell('F2', `看診人數：${count}`, { font: fontInfo, align: { horizontal: 'center' }, border: borderThinBlack });

    // Header row (row 3)
    const headers = ['排序', '床號', '姓名', '身分證字號', '生命徵象', '病情簡述', '醫師手記'];
    ['A','B','C','D','E','F','G'].forEach((col, i) => {
      setCell(`${col}3`, headers[i], { font: fontHead, fill: fillHeader, border: borderThinBlack });
    });

    // Body rows (固定 15 列：row 4-18)
    const body = (data.entries || []).slice(0, 15);
    for (let i = 0; i < 15; i++) {
      const r = 4 + i;
      const e = body[i] || {};
      setCell(`A${r}`, (body[i] ? (i + 1) : ''), { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`B${r}`, e.bedNumber || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`C${r}`, e.name || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`D${r}`, e.idNumber || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`E${r}`, e.vitals || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`F${r}`, e.condition || '', { font: fontBody, border: borderThinBlack, wrap: true });
      setCell(`G${r}`, e.doctorNote || '', { font: fontBody, border: borderThinBlack, wrap: true });
    }

    // Signature row (row 19)
    setCell('A19', '醫巡醫師簽章:', { font: fontInfo, align: { horizontal: 'left' }, border: borderThinBlack, wrap: true });
    setCell('F19', '跟診護理師簽章:', { font: fontInfo, align: { horizontal: 'left' }, border: borderThinBlack, wrap: true });

    // Ensure full border grid A1:G19 (including merged areas)
    applyBorderToRange('A1', 'G19');

    // =========================
    // Sheet 2: 摘要（比照範本）
    // =========================
    const ws2 = wb.addWorksheet('摘要');

    ws2.columns = [
      { width: 22.0 }, { width: 18.0 }, { width: 22.0 }, { width: 18.0 }
    ];
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

    // header row
    ['A2','B2','C2','D2'].forEach((addr, idx) => {
      const text = ['項目','數量','項目','數量'][idx];
      set2(addr, text, { font: fontSumHead, fill: fillHeader, border: borderThinBlack });
    });

    // row 3-4 stats
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

    // ===== Export =====
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

  function exportExcelLegacy() {
    let data;
    try {
      data = collectData();
    } catch (e) {
      alert("請先選擇日期");
      return;
    }

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
          table {
            border-collapse: collapse;
            mso-border-alt: solid #000 1px;
          }
          table, td, th {
            border: 1px solid #000;
            font-family: "DFKai-SB", "標楷體";
            mso-font-charset: 136;
          }
          td, th {
            text-align: center;
            vertical-align: middle;
          }
          .title {
            font-size: 16pt;
            font-weight: bold;
          }
          .info {
            font-size: 12pt;
            font-weight: bold;
          }
          .header {
            font-size: 12pt;
            font-weight: bold;
          }
          .body {
            font-size: 12pt;
          }
          .sign {
            font-size: 12pt;
          }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col width="5.33" style="mso-width-source:userset;mso-width-alt:1365;" />
            <col width="6.89" style="mso-width-source:userset;mso-width-alt:1763;" />
            <col width="12" style="mso-width-source:userset;mso-width-alt:2589;" />
            <col width="12" style="mso-width-source:userset;mso-width-alt:2816;" />
            <col width="19.5" style="mso-width-source:userset;mso-width-alt:4864;" />
            <col width="19.5" style="mso-width-source:userset;mso-width-alt:4864;" />
            <col width="19.5" style="mso-width-source:userset;mso-width-alt:4864;" />
          </colgroup>
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

  // ===== Events =====
  addRowBtn.addEventListener("click", () => { createRow(); sortTableByBed(); ensureMinRows(); refreshMeta(); });
  saveBtn.addEventListener("click", saveSheet);
  exportBtn.addEventListener("click", exportExcel);

  dateInput.addEventListener("change", async () => { await loadSheet(); });

  (async () => {
    await loadResidents();
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    await loadSheet();
  })();
});
