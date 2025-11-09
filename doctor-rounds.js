// 醫療巡迴門診掛號及就診狀況交班單 - 完整版
// Firestore: doctor_rounds/{YYYY-MM-DD}
// Residents: residents (bedNumber, idNumber, name or doc.id)
// 功能：載入/建立、床號帶入、儲存、匯出 Excel(含邊框)、下載範本(在 HTML)
// 不含列印，版面響應式

document.addEventListener("firebase-ready", () => {
  const db = firebase.firestore();
  const COLLECTION = "doctor_rounds";
  const MIN_ROWS = 6;

  // DOM
  const tbody = document.getElementById("round-tbody");
  const dateInput = document.getElementById("round-date");
  const displayDateEl = document.getElementById("display-date");
  const signDateEl = document.getElementById("sign-date");
  const patientCountEl = document.getElementById("patient-count");

  const loadBtn = document.getElementById("load-btn");
  const addRowBtn = document.getElementById("add-row-btn");
  const saveBtn = document.getElementById("save-btn");
  const exportBtn = document.getElementById("export-btn");

  // 床號 → { name, idNumber }
  const RESIDENTS_BY_BED = {};

  // ===== 讀取 residents 作為床號來源 =====
  async function loadResidents() {
    const snap = await db.collection("residents").get();
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!d.bedNumber) return;
      RESIDENTS_BY_BED[d.bedNumber] = {
        name: d.name || doc.id || "",
        idNumber: d.idNumber || ""
      };
    });
  }

  // 床號下拉選單 HTML
  function buildBedOptions(selected) {
    const beds = Object.keys(RESIDENTS_BY_BED).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return String(a).localeCompare(String(b), "zh-Hant");
    });

    let html = `<option value="">選擇床號</option>`;
    beds.forEach(b => {
      const sel = b === selected ? "selected" : "";
      html += `<option value="${b}" ${sel}>${b}</option>`;
    });
    return html;
  }

  // 西元 yyyy-mm-dd -> 民國 yyy/mm/dd
  function toRoc(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${y - 1911}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  }

  // 更新排序、看診人數、日期顯示
  function refreshMeta() {
    const rows = [...tbody.querySelectorAll("tr")];
    let count = 0;

    rows.forEach((tr, i) => {
      const idxCell = tr.querySelector(".idx");
      if (idxCell) idxCell.textContent = i + 1;

      const bed = tr.querySelector(".bed-select")?.value?.trim();
      if (bed) count++;
    });

    patientCountEl.textContent = count;

    const roc = toRoc(dateInput.value);
    displayDateEl.textContent = roc || "—";
    signDateEl.textContent = roc || "";
  }

  // 建立一列
  function createRow(row = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="text-center idx"></td>
      <td>
        <select class="form-select form-select-sm cell-select bed-select">
          ${buildBedOptions(row.bedNumber || "")}
        </select>
      </td>
      <td><input type="text" class="cell-input name-input" value="${row.name || ""}" readonly></td>
      <td><input type="text" class="cell-input id-input" value="${row.idNumber || ""}" readonly></td>
      <td><input type="text" class="cell-input vitals-input" value="${row.vitals || ""}"></td>
      <td><textarea class="cell-input cond-input" rows="1">${row.condition || ""}</textarea></td>
      <td><textarea class="cell-input note-input" rows="1">${row.doctorNote || ""}</textarea></td>
      <td class="text-center">
        <button type="button" class="btn btn-outline-danger btn-xs-icon del-btn">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;

    const bedSelect = tr.querySelector(".bed-select");
    const nameInput = tr.querySelector(".name-input");
    const idInput = tr.querySelector(".id-input");

    // 床號變更 → 自動帶住民資料
    bedSelect.addEventListener("change", () => {
      const bed = bedSelect.value;
      const info = RESIDENTS_BY_BED[bed];
      if (bed && info) {
        nameInput.value = info.name || "";
        idInput.value = info.idNumber || "";
      } else {
        nameInput.value = "";
        idInput.value = "";
      }
      refreshMeta();
    });

    // 刪除列
    tr.querySelector(".del-btn").addEventListener("click", () => {
      tr.remove();
      ensureMinRows();
      refreshMeta();
    });

    tbody.appendChild(tr);
  }

  // 確保至少 MIN_ROWS 列
  function ensureMinRows() {
    while (tbody.children.length < MIN_ROWS) {
      createRow();
    }
  }

  // 收集目前表格資料
  function collectData() {
    const date = dateInput.value;
    if (!date) {
      throw new Error("no-date");
    }

    const entries = [];
    [...tbody.querySelectorAll("tr")].forEach(tr => {
      const bedNumber = (tr.querySelector(".bed-select")?.value || "").trim();
      const name = (tr.querySelector(".name-input")?.value || "").trim();
      const idNumber = (tr.querySelector(".id-input")?.value || "").trim();
      const vitals = (tr.querySelector(".vitals-input")?.value || "").trim();
      const condition = (tr.querySelector(".cond-input")?.value || "").trim();
      const doctorNote = (tr.querySelector(".note-input")?.value || "").trim();

      // 全空白列不存
      if (!bedNumber && !name && !idNumber && !vitals && !condition && !doctorNote) {
        return;
      }

      entries.push({ bedNumber, name, idNumber, vitals, condition, doctorNote });
    });

    return {
      id: date,
      date,
      entries,
      totalPatients: entries.length,
      updatedAt: new Date().toISOString()
    };
  }

  // 載入指定日期
  async function loadSheet() {
    const date = dateInput.value;
    if (!date) {
      alert("請先選擇巡診日期");
      return;
    }

    tbody.innerHTML = "";

    const snap = await db.collection(COLLECTION).doc(date).get();
    if (snap.exists) {
      const d = snap.data() || {};
      (d.entries || []).forEach(e => createRow(e));
    }

    ensureMinRows();
    refreshMeta();
  }

  // 儲存（只寫入當日 doc，不動其它日期）
  async function saveSheet() {
    let data;
    try {
      data = collectData();
    } catch {
      alert("請先選擇巡診日期");
      return;
    }

    await db.collection(COLLECTION)
      .doc(data.id)
      .set({
        id: data.id,
        date: data.date,
        entries: data.entries,
        totalPatients: data.totalPatients,
        updatedAt: data.updatedAt
      });

    alert("已儲存醫巡單");
    refreshMeta();
  }

  // 匯出 Excel
  function exportExcel() {
    let data;
    try {
      data = collectData();
    } catch {
      alert("請先選擇巡診日期");
      return;
    }

    const rocDate = toRoc(data.date);
    const header = [
      "排序",
      "床號",
      "姓名",
      "身分證字號",
      "生命徵象",
      "病情簡述 / 主訴",
      "醫師手記 / 囑語"
    ];

    const rows = data.entries.map((e, i) => ([
      i + 1,
      e.bedNumber || "",
      e.name || "",
      e.idNumber || "",
      e.vitals || "",
      e.condition || "",
      e.doctorNote || ""
    ]));

    while (rows.length < MIN_ROWS) {
      rows.push(["","","","","","",""]);
    }

    const aoa = [
      ["醫療巡迴門診掛號及就診狀況交班單"],
      [`醫巡日期：${rocDate}`, `看診人數：${data.totalPatients}`],
      [],
      header,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 嘗試加上簡單邊框（需支援樣式的 XLSX 版本才會生效）
    const borderAll = {
      top:    { style: "thin" },
      bottom: { style: "thin" },
      left:   { style: "thin" },
      right:  { style: "thin" }
    };

    Object.keys(ws).forEach(addr => {
      if (addr[0] === "!") return;
      const cell = ws[addr];
      cell.s = cell.s || {};
      cell.s.border = borderAll;
      cell.s.alignment = cell.s.alignment || { vertical: "center" };
    });

    ws["!cols"] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 10 },
      { wch: 18 },
      { wch: 26 },
      { wch: 26 },
      { wch: 26 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "醫巡單");
    XLSX.writeFile(wb, `醫療巡迴門診掛號及就診狀況交班單_${data.date}.xlsx`);
  }

  // 綁定事件
  loadBtn.addEventListener("click", loadSheet);

  addRowBtn.addEventListener("click", () => {
    createRow();
    ensureMinRows();
    refreshMeta();
  });

  saveBtn.addEventListener("click", saveSheet);
  exportBtn.addEventListener("click", exportExcel);

  // 日期變更：只清空畫面，讓使用者按「載入 / 建立」決定要載入還是開新表
  dateInput.addEventListener("change", () => {
    tbody.innerHTML = "";
    ensureMinRows();
    refreshMeta();
  });

  // ===== 初始化 =====
  (async () => {
    await loadResidents();

    // 預設今天
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    // 預設載入當天（如果有）
    await loadSheet();
  })();
});
