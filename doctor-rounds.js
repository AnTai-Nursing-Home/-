
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
    tbody.innerHTML = <tr><td colspan="8" class="text-center text-secondary py-4">讀取中...</td></tr>;
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
  let html = "<option value=''>選擇床號</option>";
  beds.forEach(function(b){
    const sel = (b === selected) ? "selected" : "";
    html += "<option value='" + b + "' " + sel + ">" + b + "</option>";
  });
  return html;
}
    });
    return html;
  }

  function toRoc(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  var y = parseInt(parts[0], 10) || 0;
  var m = parseInt(parts[1], 10) || 0;
  var d = parseInt(parts[2], 10) || 0;
  if (!y || !m || !d) return "";
  var ry = (y - 1911);
  var mm = String(m).padStart(2, "0");
  var dd = String(d).padStart(2, "0");
  return ry + "/" + mm + "/" + dd;
}
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
  function escAttr(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  var html = ""
    + '<td class="text-center idx"></td>'
    + '<td><select class="form-select form-select-sm bed-select">' + buildBedOptions(row.bedNumber || "") + '</select></td>'
    + '<td><input type="text" class="form-control form-control-sm name-input text-center" value="' + escAttr(row.name || "") + '" readonly></td>'
    + '<td><input type="text" class="form-control form-control-sm id-input text-center" value="' + escAttr(row.idNumber || "") + '" readonly></td>'
    + '<td><input type="text" class="form-control form-control-sm vitals-input text-center" value="' + escAttr(row.vitals || "") + '"></td>'
    + '<td><textarea class="form-control form-control-sm condition-input text-center" rows="1">' + escAttr(row.condition || "") + '</textarea></td>'
    + '<td><textarea class="form-control form-control-sm note-input text-center" rows="1">' + escAttr(row.doctorNote || "") + '</textarea></td>'
    + '<td class="text-center"><button class="btn btn-outline-danger btn-sm del-btn"><i class="fa fa-trash"></i></button></td>';
  tr.innerHTML = html;

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
  try { data = collectData(); } catch (e) { alert('請先選擇日期'); return; }
  var rocDate = toRoc(data.date);

  var colHtml = '<colgroup>' +
    '<col style="width:6.5624%">' +
    '<col style="width:8.4831%">' +
    '<col style="width:12.4477%">' +
    '<col style="width:13.5435%">' +
    '<col style="width:19.5641%">' +
    '<col style="width:20.5245%">' +
    '<col style="width:18.8747%">' +
  '</colgroup>';

  var TITLE_ROW_HEIGHT  = 60;
  var META_ROW_HEIGHT   = 33.6;
  var HEADER_ROW_HEIGHT = 60;
  var BODY_ROW_HEIGHT   = 60;

  function esc(v){ return (v==null?'':String(v)).replace(/\n/g,'<br>'); }

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
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px"><th colspan="3" style="text-align:left;padding-left:6px;font-size:10px;width:50%">醫巡日期：' + rocDate + '</th><th colspan="4" style="text-align:right;padding-right:6px;font-size:10px;width:50%">看診人數：' + data.totalPatients + '</th></tr>');
  parts.push('<tr style="height:' + HEADER_ROW_HEIGHT + 'px"><th style="font-size:10px">排序</th><th style="font-size:10px">床號</th><th style="font-size:10px">姓名</th><th style="font-size:10px">身分證字號</th><th style="font-size:10px">生命徵象</th><th style="font-size:10px">病情簡述/主訴</th><th style="font-size:10px">醫師手記/囑語</th></tr>');
  parts.push('</thead>');
  parts.push('<tbody>');
  parts.push(rows.join(''));
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px"><td colspan="3" style="text-align:left;font-size:10px;padding:6px;width:50%">巡診醫師簽名：</td><td colspan="4" style="text-align:left;font-size:10px;padding:6px;width:50%">跟診護理師簽名：</td></tr>');
  parts.push('</tbody>');
  parts.push('</table>');
  parts.push('</body></html>');

  var html = parts.join('');
  var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = (window.URL || window.webkitURL).createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '醫療巡迴門診掛號及就診狀況交班單_' + data.date + '.xls';
  a.click();
  setTimeout(function(){ (window.URL || window.webkitURL).revokeObjectURL(url); }, 0);
}

  var rocDate = toRoc(data.date);

  // 欄寬百分比（以總寬 81.22 換算）
  var colHtml = '<colgroup>' +
    '<col style="width:6.5624%">' +   // 排序 5.33
    '<col style="width:8.4831%">' +   // 床號 6.89
    '<col style="width:12.4477%">' +  // 姓名 10.11
    '<col style="width:13.5435%">' +  // 身分證字號 11
    '<col style="width:19.5641%">' +  // 生命徵象 15.89
    '<col style="width:20.5245%">' +  // 病情簡述/主訴 16.67
    '<col style="width:18.8747%">' +  // 醫師手記/囑語 15.33
  '</colgroup>';

  // 列高與字體（px）
  var TITLE_ROW_HEIGHT  = 60;    // 標題列
  var META_ROW_HEIGHT   = 33.6;  // 日期/人數、簽名列
  var HEADER_ROW_HEIGHT = 60;    // 表頭列
  var BODY_ROW_HEIGHT   = 60;    // 內容列

  function esc(v){ return (v==null?'':String(v)).replace(/\n/g,'<br>'); }

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

  // 標題（欄寬 81.22、列高 60、字體 16）
  parts.push('<thead>');
  parts.push('<tr><th colspan="7" style="text-align:center;height:' + TITLE_ROW_HEIGHT + 'px;font-size:16px;font-weight:bold;">醫療巡迴門診掛號及就診狀況交班單</th></tr>');

  // 醫巡日期 / 看診人數（同一行、不同格，各 40.61 -> 50%/50%，列高 33.6、字體 10）
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px">' +
             '<th colspan="3" style="text-align:left;padding-left:6px;font-size:10px;width:50%">醫巡日期：' + rocDate + '</th>' +
             '<th colspan="4" style="text-align:right;padding-right:6px;font-size:10px;width:50%">看診人數：' + data.totalPatients + '</th>' +
             '</tr>');

  // 表頭（依指定欄寬、列高 60、字體 10）
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

  // 內容
  parts.push('<tbody>');
  parts.push(rows.join(''));

  // 簽名列（同一行、不同格，各 40.61 -> 50%/50%，列高 33.6、字體 10）
  parts.push('<tr style="height:' + META_ROW_HEIGHT + 'px">' +
             '<td colspan="3" style="text-align:left;font-size:10px;padding:6px;width:50%">巡診醫師簽名：</td>' +
             '<td colspan="4" style="text-align:left;font-size:10px;padding:6px;width:50%">跟診護理師簽名：</td>' +
             '</tr>');

  parts.push('</tbody>');
  parts.push('</table>');
  parts.push('</body></html>');

  var html = parts.join('');
  var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = (window.URL || window.webkitURL).createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '醫療巡迴門診掛號及就診狀況交班單_' + data.date + '.xls';
  a.click();
  setTimeout(function(){ (window.URL || window.webkitURL).revokeObjectURL(url); }, 0);
}

  var rocDate = toRoc(data.date);

  var colHtml = '<colgroup>' +
    '<col style="width:42px">' +
    '<col style="width:70px">' +
    '<col style="width:120px">' +
    '<col style="width:180px">' +
    '<col style="width:180px">' +
    '<col style="width:260px">' +
    '<col style="width:260px">' +
  '</colgroup>';

  var rows = [];
  for (var i = 0; i < data.entries.length; i++) {
    var e = data.entries[i] || {};
    function esc(v){ return (v==null?'':String(v)).replace(/\n/g,'<br>'); }
    rows.push(
      "<tr><td style='text-align:center;vertical-align:middle;'>" + (i+1) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.bedNumber) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.name) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.idNumber) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.vitals) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.condition) + "</td>" +
      "<td style='text-align:center;vertical-align:middle;'>" + esc(e.doctorNote) + "</td></tr>"
    );
  }

  var parts = [];
  parts.push("<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>");
  parts.push("<head><meta charset='UTF-8'><style>@page { size: A4 portrait; margin: 10mm; } table{border-collapse:collapse;font-family:Microsoft JhengHei,Arial,sans-serif;font-size:11px;} th,td{border:1px solid #000;} thead th{background:#f3f6f9;font-weight:600;}</style></head>");
  parts.push("<body>");
  parts.push("<table border='1'>");
  parts.push(colHtml);
  parts.push("<thead>");
  parts.push("<tr><th colspan='7' style='text-align:center;height:42px;font-size:16px;font-weight:bold;'>醫療巡迴門診掛號及就診狀況交班單</th></tr>");
  parts.push("<tr style='height:32px'><th colspan='3' style='text-align:left;padding-left:6px;'>醫巡日期：" + rocDate + "</th><th colspan='4' style='text-align:right;padding-right:6px;'>看診人數：" + data.totalPatients + "</th></tr>");
  parts.push("<tr><td colspan='7' style='text-align:left;font-size:12px;padding:4px 0;'>※ 請於就診當日完成掛號與交班紀錄；生命徵象請以最新測量值填寫</td></tr>");
  parts.push("<tr style='height:32px'><th>排序</th><th>床號</th><th>姓名</th><th>身分證字號</th><th>生命徵象</th><th>病情簡述/主訴</th><th>醫師手記/囑語</th></tr>");
  parts.push("</thead>");
  parts.push("<tbody>");
  parts.push(rows.join(""));
  parts.push("<tr><td colspan='7' style='text-align:left;font-size:12px;padding:8px 0 0 0;'>備註：病情簡述可包含主訴、現況重點、需追蹤事項；醫師手記請書寫可辨識之醫囑與建議</td></tr>");
  parts.push("<tr><td colspan='7' style='text-align:right;padding:6px 8px;'>簽名日期：" + rocDate + "</td></tr>");
  parts.push("</tbody>");
  parts.push("</table>");
  parts.push("</body></html>");

  var html = parts.join("");
  var blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "醫療巡迴門診掛號及就診狀況交班單_" + data.date + ".xls";
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
