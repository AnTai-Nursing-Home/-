// doctor-rounds.js
document.addEventListener('firebase-ready', () => {
  const db = firebase.firestore();

  const tbody = document.getElementById('doctor-rounds-tbody');
  const patientCountEl = document.getElementById('patient-count');
  const displayDateEl = document.getElementById('display-date');
  const signatureDateEl = document.getElementById('signature-date');

  const roundDateInput = document.getElementById('round-date');
  const loadBtn = document.getElementById('load-sheet-btn');
  const addRowBtn = document.getElementById('add-row-btn');
  const saveBtn = document.getElementById('save-sheet-btn');
  const exportBtn = document.getElementById('export-excel-btn');
  const printBtn = document.getElementById('print-btn');

  const COLLECTION = 'doctor_rounds';

  // 住民：依床號查姓名+身分證
  const RESIDENTS_BY_BED = {};

  // === 讀取 residents 資料 ===
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

  function bedOptions(selected) {
    const beds = Object.keys(RESIDENTS_BY_BED).sort((a, b) => {
      const na = parseInt(a) || 0;
      const nb = parseInt(b) || 0;
      return na === nb ? a.localeCompare(b) : na - nb;
    });
    let html = '<option value="">選擇床號</option>';
    beds.forEach(b => {
      const sel = b === selected ? 'selected' : '';
      html += `<option value="${b}" ${sel}>${b}</option>`;
    });
    return html;
  }

  function toRoc(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return '';
    const rocY = y - 1911;
    return `${rocY}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  // 更新序號與看診人數與日期顯示
  function refreshMeta() {
    let count = 0;
    [...tbody.querySelectorAll('tr')].forEach((tr, idx) => {
      tr.querySelector('.row-index').textContent = idx + 1;
      const bed = tr.querySelector('.bed-select')?.value || '';
      if (bed) count++;
    });
    patientCountEl.textContent = count;

    const date = roundDateInput.value || '';
    displayDateEl.textContent = toRoc(date);
    signatureDateEl.textContent = toRoc(date);
  }

  // 新增一列
  function addRow(row = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center row-index"></td>
      <td>
        <select class="form-select form-select-sm bed-select">
          ${bedOptions(row.bedNumber || '')}
        </select>
      </td>
      <td><input type="text" class="form-control form-control-sm name-input" value="${row.name || ''}" readonly></td>
      <td><input type="text" class="form-control form-control-sm id-input" value="${row.idNumber || ''}" readonly></td>
      <td><input type="text" class="form-control form-control-sm vs-temp"  value="${row.temp || ''}"></td>
      <td><input type="text" class="form-control form-control-sm vs-pulse" value="${row.pulse || ''}"></td>
      <td><input type="text" class="form-control form-control-sm vs-rr"    value="${row.rr || ''}"></td>
      <td><input type="text" class="form-control form-control-sm vs-bp"    value="${row.bp || ''}"></td>
      <td><input type="text" class="form-control form-control-sm vs-sat"   value="${row.sat || ''}"></td>
      <td><textarea class="form-control form-control-sm cond-note" rows="1">${row.condition || ''}</textarea></td>
      <td><textarea class="form-control form-control-sm dr-note" rows="1">${row.doctorNote || ''}</textarea></td>
      <td class="no-print text-center">
        <button class="btn btn-sm btn-outline-danger btn-del-row">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;

    const bedSelect = tr.querySelector('.bed-select');
    const nameInput = tr.querySelector('.name-input');
    const idInput = tr.querySelector('.id-input');

    bedSelect.addEventListener('change', () => {
      const bed = bedSelect.value;
      if (bed && RESIDENTS_BY_BED[bed]) {
        const r = RESIDENTS_BY_BED[bed];
        nameInput.value = r.name || '';
        idInput.value = r.idNumber || '';
      } else {
        nameInput.value = '';
        idInput.value = '';
      }
      refreshMeta();
    });

    tr.querySelector('.btn-del-row').addEventListener('click', () => {
      tr.remove();
      refreshMeta();
    });

    tbody.appendChild(tr);
    refreshMeta();
  }

  // 收集整張醫巡單資料
  function collectData() {
    const date = roundDateInput.value;
    if (!date) {
      alert('請先選擇醫巡日期');
      throw new Error('no-date');
    }

    const entries = [];
    [...tbody.querySelectorAll('tr')].forEach(tr => {
      const bed = tr.querySelector('.bed-select').value.trim();
      if (!bed) return; // 空列不算
      entries.push({
        bedNumber: bed,
        name: tr.querySelector('.name-input').value.trim(),
        idNumber: tr.querySelector('.id-input').value.trim(),
        temp: tr.querySelector('.vs-temp').value.trim(),
        pulse: tr.querySelector('.vs-pulse').value.trim(),
        rr: tr.querySelector('.vs-rr').value.trim(),
        bp: tr.querySelector('.vs-bp').value.trim(),
        sat: tr.querySelector('.vs-sat').value.trim(),
        condition: tr.querySelector('.cond-note').value.trim(),
        doctorNote: tr.querySelector('.dr-note').value.trim(),
      });
    });

    return {
      id: date, // 每日一張
      date,
      entries,
      totalPatients: entries.length,
      updatedAt: new Date().toISOString()
    };
  }

  // 載入 / 建立
  async function loadSheet() {
    const date = roundDateInput.value;
    if (!date) {
      alert('請先選擇醫巡日期');
      return;
    }
    const doc = await db.collection(COLLECTION).doc(date).get();
    tbody.innerHTML = '';

    if (doc.exists) {
      const d = doc.data() || {};
      (d.entries || []).forEach(e => addRow(e));
    } else {
      // 新醫巡單：預設幾列空白
      for (let i = 0; i < 8; i++) addRow();
    }
    refreshMeta();
  }

  // 儲存
  async function saveSheet() {
    let data;
    try { data = collectData(); }
    catch { return; }

    saveBtn.disabled = true;
    try {
      await db.collection(COLLECTION).doc(data.id).set(data, { merge: true });
      alert('已儲存醫巡單');
      refreshMeta();
    } catch (e) {
      console.error(e);
      alert('儲存失敗，請稍後重試');
    } finally {
      saveBtn.disabled = false;
    }
  }

  // 匯出 Excel：抬頭 + 醫巡日期 + 看診人數 + 表格 (欄位與畫面一致)
  function exportExcel() {
    let data;
    try { data = collectData(); }
    catch { return; }

    const headerRow = [
      '序', '床號', '姓名', '身分證字號',
      '體溫', '脈搏', '呼吸', '血壓', '血氧',
      '病情簡述 / 主訴', '醫師手記 / 囑語'
    ];

    const rows = data.entries.map((e, i) => ([
      i + 1,
      e.bedNumber,
      e.name,
      e.idNumber,
      e.temp,
      e.pulse,
      e.rr,
      e.bp,
      e.sat,
      e.condition,
      e.doctorNote
    ]));

    const rocDate = toRoc(data.date);

    const aoa = [
      ['特約醫師巡診掛號及就診狀況單'],
      [`醫巡日期：${rocDate}`, `看診人數：${data.totalPatients}`],
      [],
      headerRow,
      ...rows,
      [],
      [
        '特約醫巡醫師簽章：',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '當日跟診護理師簽名：',
        ''
      ],
      [
        `醫巡日期：${rocDate}`,
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // 合併與格式可視需要再微調
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '醫巡單');

    const filename = `特約醫師巡診掛號及就診狀況單_${data.date}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // 列印
  function printSheet() {
    try { collectData(); } catch { return; }
    window.print();
  }

  // 綁定事件
  loadBtn.addEventListener('click', loadSheet);
  addRowBtn.addEventListener('click', () => addRow());
  saveBtn.addEventListener('click', saveSheet);
  exportBtn.addEventListener('click', exportExcel);
  printBtn.addEventListener('click', printSheet);
  roundDateInput.addEventListener('change', refreshMeta);

  // 初始化
  (async () => {
    await loadResidents();
    if (!roundDateInput.value) {
      roundDateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadSheet();
  })();
});
