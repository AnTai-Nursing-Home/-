
// 醫療巡迴門診掛號及就診狀況交班單 - 最終版
// ✅ 自動載入今日與日期切換
// ✅ 移除「載入／建立」按鈕
// ✅ 保留框線的 Excel 匯出 (.xls)
// ✅ 手機版自適應

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

  function buildBedOptions(selected) {
    const beds = Object.keys(RESIDENTS_BY_BED).sort((a, b) => String(a).localeCompare(String(b), "zh-Hant"));
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
    return `${y - 1911}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  }

  function refreshMeta() {
    const rows = [...tbody.querySelectorAll("tr")];
    rows.forEach((tr, i) => tr.querySelector(".idx").textContent = i + 1);
    patientCountEl.textContent = rows.filter(r => r.querySelector(".bed-select")?.value).length;
    const roc = toRoc(dateInput.value);
    displayDateEl.textContent = roc || "—";
    signDateEl.textContent = roc || "";
  }

  function createRow(row = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class='text-center idx'></td>
      <td><select class='form-select form-select-sm cell-select bed-select'>${buildBedOptions(row.bedNumber || "")}</select></td>
      <td><input type='text' class='cell-input name-input' value='${row.name || ""}' readonly></td>
      <td><input type='text' class='cell-input id-input' value='${row.idNumber || ""}' readonly></td>
      <td><input type='text' class='cell-input vitals-input' value='${row.vitals || ""}'></td>
      <td><textarea class='cell-input cond-input'>${row.condition || ""}</textarea></td>
      <td><textarea class='cell-input note-input'>${row.doctorNote || ""}</textarea></td>
      <td class='text-center'><button class='btn btn-outline-danger btn-xs-icon del-btn'><i class='fas fa-trash-alt'></i></button></td>
    `;
    tr.querySelector(".bed-select").addEventListener("change", e => {
      const bed = e.target.value;
      const info = RESIDENTS_BY_BED[bed];
      tr.querySelector(".name-input").value = info?.name || "";
      tr.querySelector(".id-input").value = info?.idNumber || "";
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
    const entries = [...tbody.querySelectorAll("tr")].map(tr => ({
      bedNumber: tr.querySelector(".bed-select")?.value || "",
      name: tr.querySelector(".name-input")?.value || "",
      idNumber: tr.querySelector(".id-input")?.value || "",
      vitals: tr.querySelector(".vitals-input")?.value || "",
      condition: tr.querySelector(".cond-input")?.value || "",
      doctorNote: tr.querySelector(".note-input")?.value || ""
    })).filter(e => Object.values(e).some(v => v.trim() !== ""));
    return { id: date, date, entries, totalPatients: entries.length, updatedAt: new Date().toISOString() };
  }

  async function loadSheet(auto = false) {
    const date = dateInput.value;
    if (!date) return;
    tbody.innerHTML = "";
    const snap = await db.collection(COLLECTION).doc(date).get();
    if (snap.exists) {
      (snap.data().entries || []).forEach(e => createRow(e));
    } else if (auto) {
      await db.collection(COLLECTION).doc(date).set({ id: date, date, entries: [], totalPatients: 0 });
    }
    ensureMinRows();
    refreshMeta();
  }

  async function saveSheet() {
    let data;
    try { data = collectData(); } catch { return alert("請先選擇日期"); }
    await db.collection(COLLECTION).doc(data.id).set(data);
    alert("✅ 已儲存醫巡單");
  }

  function exportExcel() {
    let data;
    try { data = collectData(); } catch { return alert("請先選擇日期"); }

    const rocDate = toRoc(data.date);
    const tableHTML = `
      <table border="1" style="border-collapse:collapse;text-align:center;vertical-align:middle;">
        <thead>
          <tr><th colspan="7" style="font-size:16px;">醫療巡迴門診掛號及就診狀況交班單</th></tr>
          <tr>
            <th colspan="3" style="text-align:left;">醫巡日期：${rocDate}</th>
            <th colspan="4" style="text-align:left;">看診人數：${data.totalPatients}</th>
          </tr>
          <tr>
            <th>排序</th>
            <th>床號</th>
            <th>姓名</th>
            <th>身分證字號</th>
            <th>生命徵象</th>
            <th>病情簡述 / 主訴</th>
            <th>醫師手記 / 囑語</th>
          </tr>
        </thead>
        <tbody>
          ${data.entries.map((e, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${e.bedNumber || ""}</td>
              <td>${e.name || ""}</td>
              <td>${e.idNumber || ""}</td>
              <td>${e.vitals || ""}</td>
              <td>${e.condition || ""}</td>
              <td>${e.doctorNote || ""}</td>
            </tr>`).join("")}
          ${Array(Math.max(0, MIN_ROWS - data.entries.length)).fill("<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("")}
        </tbody>
      </table>
    `;

    const blob = new Blob([`\ufeff${tableHTML}`], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `醫療巡迴門診掛號及就診狀況交班單_${data.date}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  addRowBtn.addEventListener("click", () => { createRow(); ensureMinRows(); refreshMeta(); });
  saveBtn.addEventListener("click", saveSheet);
  exportBtn.addEventListener("click", exportExcel);

  dateInput.addEventListener("change", async () => {
    await loadSheet(true);
  });

  (async () => {
    await loadResidents();
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
    await loadSheet(true);
  })();
});
