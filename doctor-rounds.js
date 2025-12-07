
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
  var data;
  try {
    data = collectData();
  } catch (e) {
    alert('請先選擇日期');
    return;
  }
  var rocDate = toRoc(data.date);

  var colHtml = '<colgroup>' +
    '<col style="width:6.5624%">' +   // 排序 5.33/81.22
    '<col style="width:8.4831%">' +   // 床號 6.89/81.22
    '<col style="width:12.4477%">' +  // 姓名 10.11/81.22
    '<col style="width:13.5435%">' +  // 身分證字號 11/81.22
    '<col style="width:19.5641%">' +  // 生命徵象 15.89/81.22
    '<col style="width:20.5245%">' +  // 病情簡述/主訴 16.67/81.22
    '<col style="width:18.8747%">' +  // 醫師手記/囑語 15.33/81.22
  '</colgroup>';

  var TITLE_ROW_HEIGHT  = 60;
  var META_ROW_HEIGHT   = 33.6;
  var HEADER_ROW_HEIGHT = 60;
  var BODY_ROW_HEIGHT   = 60;

  function esc(v){ return (v==null?'':String(v)).replace(/\\n/g,'<br>'); }

  var rows = [];
  for (var i = 0; i < data.entries.length; i++) {
    var e = data.entries[i] || {};
    rows.push(
      '<tr style="height:' + BODY_ROW_HEIGHT + 'px">' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + (i+1) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.bedNumber) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.name) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.idNumber) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.vitals) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.condition) + '</td>' +
      '<td style="text-align:center;vertical-align:middle;font-size:10px;">' + esc(e.doctorNote) + '</td>' +
      '</tr>'
    );
  }

  var css = '@page { size: A4 portrait; margin: 10mm; } ' +
            'table{border-collapse:collapse;font-family:Microsoft JhengHei,Arial,sans-serif;font-size:11px;width:100%;} ' +
            'th,td{border:1px solid #000;} thead th{background:#f3f6f9;font-weight:600;}';

  var parts = [];
  parts.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">');
  parts.push('<head><meta charset="UTF-8"><style>' + css + '</style></head>');
  parts.push('<body>');
  parts.push('<table border="1" style="width:100%">');
  parts.push(colHtml);

  parts.push('<thead>');
  parts.push('<tr><th colspan="7" style="text-align:center;height:' + TITLE_ROW_HEIGHT + 'px;font-size:16px;font-weight:bold;">醫療巡迴門診掛號及就診狀況交班單</th></tr>');
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px">' +
             '<th colspan="3" style="text-align:left;padding-left:6px;font-size:10px;width:50%">醫巡日期：' + rocDate + '</th>' +
             '<th colspan="4" style="text-align:right;padding-right:6px;font-size:10px;width:50%">看診人數：' + data.totalPatients + '</th>' +
             '</tr>');
  parts.push('<tr style="height:' + HEADER_ROW_HEIGHT + 'px">' +
             '<th style="font-size:10px">排序</th>' +
             '<th style="font-size:10px">床號</th>' +
             '<th style="font-size:10px">姓名</th>' +
             '<th style="font-size:10px">身分證字號</th>' +
             '<th style="font-size:10px">生命徵象</th>' +
             '<th style="font-size:10px">病情簡述/主訴</th>' +
             '<th style="font-size:10px">醫師手記/囑語</th>' +
             '</tr>');
  parts.push('</thead>');

  parts.push('<tbody>');
  parts.push(rows.join(''));
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px">' +
             '<td colspan="3" style="text-align:left;font-size:10px;padding:6px;width:50%">巡診醫師簽名：</td>' +
             '<td colspan="4" style="text-align:left;font-size:10px;padding:6px;width:50%">跟診護理師簽名：</td>' +
             '</tr>');
  parts.push('</tbody>');

  parts.push('</table>');
  parts.push('</body></html>');

  var html = parts.join('');

  // Use UTF-8 without BOM to avoid unexpected tokens on some parsers
  var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = (window.URL || window.webkitURL).createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '醫療巡迴門診掛號及就診狀況交班單_' + data.date + '.xls';
  a.click();
  setTimeout(function(){ (window.URL || window.webkitURL).revokeObjectURL(url); }, 0);
}
