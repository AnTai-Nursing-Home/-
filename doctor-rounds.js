
// 醫療巡迴門診掛號及就診狀況交班單 - 表格內讀取中版本
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

  function createRow(row = {}) {
    const tr = document.createElement("tr");
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
      tr.remove();
      ensureMinRows();
      refreshMeta();
    });

    tbody.appendChild(tr);
  }

  function ensureMinRows() {
    while (tbody.children.length < MIN_ROWS) createRow();
  }

  function collectData() {
    const date = dateInput.value;
    if (!date) throw new Error("no-date");
    const entries = [...tbody.querySelectorAll("tr")].map(tr => {
      const bedNumber = tr.querySelector(".bed-select")?.value || "";
      const name = tr.querySelector(".name-input")?.value || "";
      const idNumber = tr.querySelector(".id-input")?.value || "";
      const vitals = tr.querySelector(".vitals-input")?.value || "";
      const condition = tr.querySelector(".cond-input")?.value || "";
      const doctorNote = tr.querySelector(".note-input")?.value || "";
      return { bedNumber, name, idNumber, vitals, condition, doctorNote };
    }).filter(e => Object.values(e).some(v => v !== ""));
    return { id: date, date, entries, totalPatients: entries.length, updatedAt: new Date().toISOString() };
  }

  async function loadSheet(auto = false) {
    const date = dateInput.value;
    if (!date) return;
    showLoadingRow();
    const snap = await db.collection(COLLECTION).doc(date).get();
    tbody.innerHTML = "";
    if (snap.exists) {
      const d = snap.data() || {};
      (d.entries || []).forEach(e => createRow(e));
    } else if (auto) {
      await db.collection(COLLECTION).doc(date).set({ id: date, date, entries: [], totalPatients: 0 });
    }
    ensureMinRows();
    sortTableByBed();
    refreshMeta();
  }

  async function saveSheet() {
    let data;
    try {
      data = collectData();
    } catch {
      alert("請先選擇日期");
      return;
    }
    showLoadingRow();
    await db.collection(COLLECTION).doc(data.id).set(data);
    clearLoadingRow();
    alert("✅ 已儲存醫巡單");
  }

  

function exportExcel() {
  let data;
  try {
    data = collectData();
  } catch (e) {
    alert("請先選擇日期");
    return;
  }

  // Prefer ExcelJS styled export (same logic family as residents system)
  if (typeof ExcelJS === 'undefined') {
    // fallback to legacy HTML-based export
    console.warn('[doctor-rounds] ExcelJS missing, fallback to legacy HTML export');
    exportExcelLegacy();
    return;
  }

  if (window.__exportingDoctorRoundsXlsx) return;
  window.__exportingDoctorRoundsXlsx = true;

  (async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NH System';
    wb.created = new Date();

    const fontTitle  = { name:'Microsoft JhengHei', bold:true, size:16 };
    const fontHeader = { name:'Microsoft JhengHei', bold:true, size:12 };
    const fontCell   = { name:'Microsoft JhengHei', size:11 };

    const fillHeader = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF1F3F5'} };
    const borderThin = {
      top:{style:'thin',color:{argb:'FF000000'}},
      left:{style:'thin',color:{argb:'FF000000'}},
      bottom:{style:'thin',color:{argb:'FF000000'}},
      right:{style:'thin',color:{argb:'FF000000'}}
    };

    const rocDate = toRoc(data.date);
    const titleText = '醫療巡迴門診掛號及就診狀況交班單';

    function styleRow(row, {isHeader=false, height=22, wrap=false} = {}) {
      row.eachCell((c) => {
        c.font = isHeader ? fontHeader : fontCell;
        c.border = borderThin;
        c.alignment = { vertical:'middle', horizontal:'center', wrapText: wrap };
        if (isHeader) c.fill = fillHeader;
      });
      row.height = height;
    }

    function setAllBorders(ws, fromRow, toRow, fromCol, toCol) {
      for (let r = fromRow; r <= toRow; r++) {
        for (let c = fromCol; c <= toCol; c++) {
          const cell = ws.getCell(r, c);
          cell.border = borderThin;
        }
      }
    }

    // ===== Sheet 1: 交班單 =====
    const ws = wb.addWorksheet('醫巡交班單', {views:[{state:'frozen', ySplit:3}]});
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left:0.25, right:0.25, top:0.75, bottom:0.75, header:0.3, footer:0.3 }
    };

    ws.columns = [
      { key:'idx', width: 6 },
      { key:'bed', width: 10 },
      { key:'name', width: 12 },
      { key:'id', width: 14 },
      { key:'vitals', width: 18 },
      { key:'cond', width: 28 },
      { key:'note', width: 28 }
    ];

    // Title row
    ws.mergeCells(1,1,1,7);
    const titleCell = ws.getCell(1,1);
    titleCell.value = titleText;
    titleCell.font = fontTitle;
    titleCell.alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(1).height = 28;

    // Info row
    ws.mergeCells(2,1,2,3);
    ws.getCell(2,1).value = `醫巡日期：${rocDate || ''}`;
    ws.mergeCells(2,4,2,5);
    ws.getCell(2,4).value = `看診人數：${data.totalPatients ?? (data.entries||[]).length}`;
    ws.mergeCells(2,6,2,7);
    ws.getCell(2,6).value = `簽名日期：${rocDate || ''}`;
    ws.getRow(2).height = 20;
    for (let c=1;c<=7;c++){
      const cell = ws.getCell(2,c);
      cell.font = fontHeader;
      cell.alignment = { vertical:'middle', horizontal:'center' };
    }

    // Header row
    const header = ws.addRow(['排序','床號','姓名','身分證字號','生命徵象','病情簡述','醫師手記']);
    styleRow(header, {isHeader:true, height:24});

    // Data rows
    const entries = (data.entries || []).slice();
    // Keep the same sorting rule as UI: by bed number numeric
    entries.sort((a,b)=> String(a.bedNumber||'').localeCompare(String(b.bedNumber||''),'zh-Hant'));
    for (let i=0;i<entries.length;i++){
      const e = entries[i] || {};
      const row = ws.addRow([
        i+1,
        e.bedNumber || '',
        e.name || '',
        e.idNumber || '',
        e.vitals || '',
        e.condition || '',
        e.doctorNote || ''
      ]);
      styleRow(row, {height:60, wrap:true});
    }

    // If no entries, still show a couple empty lines for printing
    if (entries.length === 0) {
      for (let i=0;i<6;i++){
        const row = ws.addRow([i+1,'','','','','','']);
        styleRow(row, {height:60, wrap:true});
      }
    }

    // Apply borders to title/info rows (ExcelJS doesn't auto for merged ranges)
    setAllBorders(ws, 1, 2, 1, 7);

    // ===== Sheet 2: 摘要 =====
    const ws2 = wb.addWorksheet('摘要');
    ws2.columns = [{width:22},{width:18},{width:22},{width:18}];

    ws2.mergeCells(1,1,1,4);
    const t2 = ws2.getCell(1,1);
    t2.value = `醫巡摘要（${rocDate || ''}）`;
    t2.font = fontTitle;
    t2.alignment = { vertical:'middle', horizontal:'center' };
    ws2.getRow(1).height = 26;

    const total = entries.length;
    const vitalsFilled = entries.filter(e=>String(e.vitals||'').trim()!=='').length;
    const condFilled   = entries.filter(e=>String(e.condition||'').trim()!=='').length;
    const noteFilled   = entries.filter(e=>String(e.doctorNote||'').trim()!=='').length;

    const r2h = ws2.addRow(['項目','數量','項目','數量']);
    styleRow(r2h, {isHeader:true, height:22});

    const r3 = ws2.addRow(['看診人數', total, '生命徵象已填', vitalsFilled]);
    const r4 = ws2.addRow(['病情簡述已填', condFilled, '醫師手記已填', noteFilled]);
    styleRow(r3, {height:20});
    styleRow(r4, {height:20});

    ws2.addRow([]);
    ws2.mergeCells(6,1,6,4);
    const hint = ws2.getCell(6,1);
    hint.value = '提示：若要追資料，可用「生命徵象/病情簡述/醫師手記」未填的床號做回頭補寫。';
    hint.font = { name:'Microsoft JhengHei', size:10, italic:true, color:{argb:'FF555555'} };
    hint.alignment = { vertical:'middle', horizontal:'left', wrapText:true };
    ws2.getRow(6).height = 30;

    // Download
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const fileName = `醫巡交班單_${data.date || 'export'}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  })().catch(err=>{
    console.error(err);
    alert('匯出失敗：' + (err && err.message ? err.message : err));
  }).finally(()=>{
    window.__exportingDoctorRoundsXlsx = false;
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
  const rowsHtml = data.entries.map((e, i) => `
    <tr style="height:60pt;">
      <td style="text-align:center;vertical-align:middle;">${i + 1}</td>
      <td style="text-align:center;vertical-align:middle;">${e.bedNumber}</td>
      <td style="text-align:center;vertical-align:middle;">${e.name}</td>
      <td style="text-align:center;vertical-align:middle;">${e.idNumber}</td>
      <td style="text-align:center;vertical-align:middle;">${e.vitals}</td>
      <td style="text-align:center;vertical-align:middle;">${e.condition}</td>
      <td style="text-align:center;vertical-align:middle;">${e.doctorNote}</td>
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
          <td class="info" colspan="4">看診人數：${data.totalPatients}</td>
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
addRowBtn.addEventListener("click", () => { createRow(); sortTableByBed(); ensureMinRows(); refreshMeta(); });
  saveBtn.addEventListener("click", saveSheet);
  exportBtn.addEventListener("click", exportExcel);
  

dateInput.addEventListener("change", async () => { await loadSheet(true); });

  (async () => {
    await loadResidents();
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    await loadSheet(true);
  })();
});
