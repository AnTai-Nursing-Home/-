// doctor-rounds.js - 醫師巡診系統 (畫面 Bootstrap、列印 Excel 風格)

document.addEventListener('firebase-ready', () => {
  const db = firebase.firestore();

  const tbody = document.getElementById('round-tbody');
  const dateInput = document.getElementById('round-date');
  const displayDateEl = document.getElementById('display-date');
  const signDateEl = document.getElementById('sign-date');
  const patientCountEl = document.getElementById('patient-count');

  const loadBtn = document.getElementById('load-btn');
  const addRowBtn = document.getElementById('add-row-btn');
  const saveBtn = document.getElementById('save-btn');
  const exportBtn = document.getElementById('export-btn');
  const printBtn = document.getElementById('print-btn');

  const COLLECTION = 'doctor_rounds';
  const MIN_ROWS = 6;

  const RESIDENTS_BY_BED = {}; // { bedNumber: { name, idNumber } }

  // 讀取住民資料作為床號來源
  async function loadResidents() {
    const snap = await db.collection('residents').get();
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!d.bedNumber) return;
      RESIDENTS_BY_BED[d.bedNumber] = {
        name: doc.id || d.name || '',
        idNumber: d.idNumber || ''
      };
    });
  }

  // 床號下拉
  function buildBedOptions(selected) {
    const beds = Object.keys(RESIDENTS_BY_BED).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return String(a).localeCompare(String(b), 'zh-Hant');
    });
    let html = '<option value=\"\">選擇床號</option>';
    beds.forEach(b => {
      const sel = (b === selected) ? 'selected' : '';
      html += `<option value="${b}" ${sel}>${b}</option>`;
    });
    return html;
  }

  // 西元 → 民國
  function toRoc(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${y - 1911}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  // 更新排序、人數、日期顯示
  function refreshMeta() {
    const rows = [...tbody.querySelectorAll('tr')];
    let count = 0;
    rows.forEach((tr, i) => {
      const idxEl = tr.querySelector('.idx');
      if (idxEl) idxEl.textContent = i + 1;
      const bed = tr.querySelector('.bed-select')?.value?.trim();
      if (bed) count++;
    });
    patientCountEl.textContent = count;

    const roc = toRoc(dateInput.value);
    displayDateEl.textContent = roc;
    signDateEl.textContent = roc;
  }

  // 建立一列
  function createRow(row = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center idx"></td>
      <td>
        <select class="form-select form-select-sm cell-select bed-select">
          ${buildBedOptions(row.bedNumber || '')}
        </select>
      </td>
      <td><input type="text" class="cell-input name-input" value="${row.name || ''}" readonly></td>
      <td><input type="text" class="cell-input id-input" value="${row.idNumber || ''}" readonly></td>
      <td><input type="text" class="cell-input vitals-input" value="${row.vitals || ''}"></td>
      <td><textarea class="cell-input cond-input" rows="1">${row.condition || ''}</textarea></td>
      <td><textarea class="cell-input note-input" rows="1">${row.doctorNote || ''}</textarea></td>
      <td class="no-print text-center">
        <button type="button" class="btn btn-sm btn-outline-danger del-btn">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;

    const bedSelect = tr.querySelector('.bed-select');
    const nameInput = tr.querySelector('.name-input');
    const idInput = tr.querySelector('.id-input');

    bedSelect.addEventListener('change', () => {
      const bed = bedSelect.value;
      const r = RESIDENTS_BY_BED[bed];
      if (bed && r) {
        nameInput.value = r.name || '';
        idInput.value = r.idNumber || '';
      } else {
        nameInput.value = '';
        idInput.value = '';
      }
      refreshMeta();
    });

    tr.querySelector('.del-btn').addEventListener('click', () => {
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

  // 收集畫面資料
  function collectData() {
    const date = dateInput.value;
    if (!date) {
      alert('請先選擇巡診日期');
      throw new Error('no-date');
    }

    const entries = [];
    [...tbody.querySelectorAll('tr')].forEach(tr => {
      const bed = (tr.querySelector('.bed-select')?.value || '').trim();
      const name = (tr.querySelector('.name-input')?.value || '').trim();
      const idNumber = (tr.querySelector('.id-input')?.value || '').trim();
      const vitals = (tr.querySelector('.vitals-input')?.value || '').trim();
      const condition = (tr.querySelector('.cond-input')?.value || '').trim();
      const doctorNote = (tr.querySelector('.note-input')?.value || '').trim();

      if (!bed && !name && !idNumber && !vitals && !condition && !doctorNote) {
        return; // 全空白不存
      }

      entries.push({ bedNumber: bed, name, idNumber, vitals, condition, doctorNote });
    });

    return {
      id: date,
      date,
      entries,
      totalPatients: entries.length,
      updatedAt: new Date().toISOString()
    };
  }

  // 載入醫巡單
  async function loadSheet() {
    const date = dateInput.value;
    if (!date) {
      alert('請先選擇巡診日期');
      return;
    }

    const snap = await db.collection(COLLECTION).doc(date).get();
    tbody.innerHTML = '';

    if (snap.exists) {
      const d = snap.data() || {};
      (d.entries || []).forEach(e => createRow(e));
    }

    ensureMinRows();
    refreshMeta();
  }

  // 儲存醫巡單
  async function saveSheet() {
    let data;
    try {
      data = collectData();
    } catch {
      return;
    }

    await db.collection(COLLECTION)
      .doc(data.id)
      .set({
        date: data.date,
        entries: data.entries,
        totalPatients: data.totalPatients,
        updatedAt: data.updatedAt
      }, { merge: true });

    alert('已儲存醫巡單');
    refreshMeta();
  }

  // 匯出 Excel
  function exportExcel() {
    let data;
    try {
      data = collectData();
    } catch {
      return;
    }

    const rocDate = toRoc(data.date);
    const header = ['排序','床號','姓名','身分證字號','生命徵象','病情簡述 / 主訴','醫師手記 / 囑語'];

    const rows = data.entries.map((e, idx) => ([
      idx + 1,
      e.bedNumber || '',
      e.name || '',
      e.idNumber || '',
      e.vitals || '',
      e.condition || '',
      e.doctorNote || ''
    ]));

    while (rows.length < MIN_ROWS) {
      rows.push(['','','','','','','']);
    }

    const aoa = [
      ['特約醫師巡診掛號及就診狀況單'],
      [`醫巡日期：${rocDate}`, `看診人數：${data.totalPatients}`],
      [],
      header,
      ...rows,
      [],
      ['特約醫巡醫師簽章：','','','','','當日跟診護理師簽名：',''],
      [`醫巡日期：${rocDate}`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 欄寬設定接近原稿
    ws['!cols'] = [
      { wch: 6 },   // 排序
      { wch: 8 },   // 床號
      { wch: 10 },  // 姓名
      { wch: 18 },  // 身分證
      { wch: 26 },  // 生命徵象
      { wch: 26 },  // 病情
      { wch: 26 }   // 醫師手記
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '醫巡單');

    const filename = `特約醫師巡診掛號及就診狀況單_${data.date}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // 列印：確保補滿列與日期顯示
  function printSheet() {
    ensureMinRows();
    refreshMeta();
    window.print();
  }

  // 綁定事件
  loadBtn.addEventListener('click', loadSheet);
  addRowBtn.addEventListener('click', () => {
    createRow();
    ensureMinRows();
    refreshMeta();
  });
  saveBtn.addEventListener('click', saveSheet);
  exportBtn.addEventListener('click', exportExcel);
  printBtn.addEventListener('click', printSheet);
  dateInput.addEventListener('change', () => {
    ensureMinRows();
    refreshMeta();
  });

  // 初始化
  (async () => {
    await loadResidents();
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadSheet();
  })();
});
