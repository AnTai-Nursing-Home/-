document.addEventListener("firebase-ready", () => {
  const db = firebase.firestore();
  const tbody = document.getElementById("round-tbody");
  const dateInput = document.getElementById("round-date");
  const patientCountEl = document.getElementById("patient-count");
  const displayDateEl = document.getElementById("display-date");
  const signDateEl = document.getElementById("sign-date");

  const COLLECTION = "doctor_rounds";
  const RESIDENTS = {};

  async function loadResidents() {
    const snap = await db.collection("residents").get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.bedNumber) RESIDENTS[d.bedNumber] = { name: doc.id, idNumber: d.idNumber || "" };
    });
  }

  function toRoc(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${y - 1911}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  }

  function refreshCount() {
    const count = [...tbody.querySelectorAll("tr")].filter(tr => tr.querySelector(".bed").value).length;
    patientCountEl.textContent = count;
    const roc = toRoc(dateInput.value);
    displayDateEl.textContent = roc;
    signDateEl.textContent = roc;
  }

  function addRow(row = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-center idx"></td>
      <td><input type="text" class="form-control form-control-sm bed" value="${row.bedNumber || ""}"></td>
      <td><input type="text" class="form-control form-control-sm name" value="${row.name || ""}" readonly></td>
      <td><input type="text" class="form-control form-control-sm idnum" value="${row.idNumber || ""}" readonly></td>
      <td><input type="text" class="form-control form-control-sm vs" value="${row.vitals || ""}"></td>
      <td><textarea class="form-control form-control-sm cond" rows="1">${row.condition || ""}</textarea></td>
      <td><textarea class="form-control form-control-sm note" rows="1">${row.doctorNote || ""}</textarea></td>
      <td class="no-print text-center"><button class="btn btn-sm btn-outline-danger del"><i class="fas fa-trash-alt"></i></button></td>`;
    tr.querySelector(".bed").addEventListener("change", e => {
      const b = e.target.value.trim();
      if (RESIDENTS[b]) {
        tr.querySelector(".name").value = RESIDENTS[b].name;
        tr.querySelector(".idnum").value = RESIDENTS[b].idNumber;
      } else {
        tr.querySelector(".name").value = "";
        tr.querySelector(".idnum").value = "";
      }
      refreshCount();
    });
    tr.querySelector(".del").addEventListener("click", () => { tr.remove(); refreshCount(); });
    tbody.appendChild(tr);
    updateIndex();
  }

  function updateIndex() {
    [...tbody.querySelectorAll("tr")].forEach((tr, i) => tr.querySelector(".idx").textContent = i + 1);
    refreshCount();
  }

  function collectData() {
    const date = dateInput.value;
    if (!date) throw new Error("no-date");
    const entries = [...tbody.querySelectorAll("tr")].map(tr => ({
      bedNumber: tr.querySelector(".bed").value.trim(),
      name: tr.querySelector(".name").value.trim(),
      idNumber: tr.querySelector(".idnum").value.trim(),
      vitals: tr.querySelector(".vs").value.trim(),
      condition: tr.querySelector(".cond").value.trim(),
      doctorNote: tr.querySelector(".note").value.trim(),
    })).filter(e => e.bedNumber);
    return { id: date, date, entries, total: entries.length, updatedAt: new Date().toISOString() };
  }

  async function loadSheet() {
    const date = dateInput.value;
    if (!date) return alert("請選擇日期");
    const doc = await db.collection(COLLECTION).doc(date).get();
    tbody.innerHTML = "";
    const d = doc.exists ? doc.data() : {};
    (d.entries || []).forEach(e => addRow(e));
    while (tbody.children.length < 6) addRow(); // 保證 6 行
    updateIndex();
  }

  async function saveSheet() {
    let data;
    try { data = collectData(); } catch { return alert("請選擇日期"); }
    await db.collection(COLLECTION).doc(data.id).set(data, { merge: true });
    alert("已儲存");
  }

  function exportExcel() {
    let data;
    try { data = collectData(); } catch { return; }
    const header = ["排序","床號","姓名","身分證字號","生命徵象","病情簡述 / 主訴","醫師手記 / 囑語"];
    const rows = data.entries.map((e, i) => [i + 1, e.bedNumber, e.name, e.idNumber, e.vitals, e.condition, e.doctorNote]);
    while (rows.length < 6) rows.push(["", "", "", "", "", "", ""]); // 補滿 6 行

    const rocDate = toRoc(data.date);
    const aoa = [
      ["特約醫師巡診掛號及就診狀況單"],
      [`醫巡日期：${rocDate}`, `看診人數：${data.entries.length}`],
      [],
      header,
      ...rows,
      [],
      ["特約醫巡醫師簽章：","","","","","當日跟診護理師簽名："],
      [`醫巡日期：${rocDate}`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:5},{wch:8},{wch:10},{wch:15},{wch:25},{wch:25},{wch:25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "醫巡單");
    XLSX.writeFile(wb, `特約醫師巡診掛號及就診狀況單_${data.date}.xlsx`);
  }

  function printSheet() { window.print(); }

  document.getElementById("load-btn").onclick = loadSheet;
  document.getElementById("add-row-btn").onclick = () => { addRow(); updateIndex(); };
  document.getElementById("save-btn").onclick = saveSheet;
  document.getElementById("export-btn").onclick = exportExcel;
  document.getElementById("print-btn").onclick = printSheet;

  (async () => {
    await loadResidents();
    dateInput.value ||= new Date().toISOString().slice(0,10);
    await loadSheet();
  })();
});
