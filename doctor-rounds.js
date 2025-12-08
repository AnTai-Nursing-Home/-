
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

  
// 依照《醫巡格式.xlsx》樣式直接在程式裡產生 Excel（不需要額外樣板檔）
function exportExcel() {
  let data;
  try {
    data = collectData();
  } catch (e) {
    alert("請先選擇日期");
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = {};

  // 欄位寬度（依照樣板 A~G 欄）
  ws["!cols"] = [
    { wch: 5.0 },    // A 排序
    { wch: 6.0 },    // B 床號
    { wch: 10.625 }, // C 姓名
    { wch: 10.25 },  // D 身分證字號
    { wch: 17.75 },  // E 生命徵象
    { wch: 19.5 },   // F 病情簡述/主訴
    { wch: 18.375 }  // G 醫師手記/囑語
  ];

  // 邊框樣式（全部都細框線）
  const thinBorder = {
    top:    { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left:   { style: "thin", color: { rgb: "000000" } },
    right:  { style: "thin", color: { rgb: "000000" } }
  };

  // 共用：置中＋自動換行
  const alignCenter = { horizontal: "center", vertical: "center", wrapText: true };

  // 各種字型樣式（依照樣板）
  const titleStyle = {
    font: { name: "標楷體", sz: 16, bold: true },
    alignment: alignCenter,
    border: thinBorder
  };

  const infoStyle = {
    font: { name: "標楷體", sz: 12, bold: true },
    alignment: alignCenter,
    border: thinBorder
  };

  const headerStyle = {
    font: { name: "標楷體", sz: 10, bold: true },
    alignment: alignCenter,
    border: thinBorder
  };

  const bodyStyle = {
    font: { name: "標楷體", sz: 10, bold: false },
    alignment: alignCenter,
    border: thinBorder
  };

  const signStyle = {
    font: { name: "標楷體", sz: 11, bold: true },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: thinBorder
  };

  function sc(v, style) {
    const isNumber = typeof v === "number";
    return { v: v, t: isNumber ? "n" : "s", s: style };
  }

  // ① 標題列 A1:G1（合併）
  ws["A1"] = sc("醫療巡迴門診掛號及就診狀況交班單", titleStyle);

  // ② 日期 & 看診人數（A2:C2、D2:G2 合併）
  const rocDate = toRoc(data.date) || "";
  ws["A2"] = sc("醫巡日期：" + rocDate, infoStyle);
  ws["D2"] = sc("看診人數：" + data.totalPatients, infoStyle);

  // ③ 表頭（第 3 列）
  const headers = ["排序", "床號", "姓名", "身分證字號", "生命徵象", "病情簡述/主訴", "醫師手記/囑語"];
  for (let c = 0; c < headers.length; c++) {
    const colLetter = String.fromCharCode(65 + c); // 65 => "A"
    const addr = colLetter + "3";
    ws[addr] = sc(headers[c], headerStyle);
  }

  // ④ 寫入明細資料（第 4 列開始）
  const startRow = 4;
  data.entries.forEach((item, index) => {
    const row = startRow + index;
    const rowIndex = row;

    ws["A" + rowIndex] = sc(index + 1, bodyStyle);
    ws["B" + rowIndex] = sc(item.bedNumber || "", bodyStyle);
    ws["C" + rowIndex] = sc(item.name || "", bodyStyle);
    ws["D" + rowIndex] = sc(item.idNumber || "", bodyStyle);
    ws["E" + rowIndex] = sc(item.vitals || "", bodyStyle);
    ws["F" + rowIndex] = sc(item.condition || "", bodyStyle);
    ws["G" + rowIndex] = sc(item.doctorNote || "", bodyStyle);
  });

  // ⑤ N 筆資料 + 6 列空白後的簽章列
  const extraBlankRows = 6;
  const signRow = startRow + data.entries.length + extraBlankRows;

  // 左側：A~E（實際文字在 A 欄）
  ws["A" + signRow] = sc("醫巡醫師簽章：", signStyle);
  // 右側：F~G（實際文字在 F 欄；與樣板接近配置）
  ws["F" + signRow] = sc("跟診護理師簽章：", signStyle);

  // ⑥ 設定列高（依樣板：第 2 列 33，其餘 60）
  const totalRows = signRow;
  const rows = [];
  for (let r = 1; r <= totalRows; r++) {
    if (r === 2) {
      rows.push({ hpt: 33 });
    } else {
      rows.push({ hpt: 60 });
    }
  }
  ws["!rows"] = rows;

  // ⑦ 合併儲存格設定（依樣板）
  ws["!merges"] = [
    // A1:G1 標題
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    // A2:C2 日期
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    // D2:G2 看診人數
    { s: { r: 1, c: 3 }, e: { r: 1, c: 6 } },
    // 簽章列：A~E
    { s: { r: signRow - 1, c: 0 }, e: { r: signRow - 1, c: 4 } },
    // 簽章列：F~G
    { s: { r: signRow - 1, c: 5 }, e: { r: signRow - 1, c: 6 } }
  ];

  // ⑧ 將工作表加入活頁簿並匯出
  XLSX.utils.book_append_sheet(wb, ws, "醫巡交班單");
  XLSX.writeFile(wb, "醫療巡迴門診掛號及就診狀況交班單_" + data.date + ".xlsx");
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
