// wound-care.js
// Firestore Collections:
// - residents
// - woundCareRecords
// Uses sessionStorage antai_session_user for recorder auto-fill.

(function () {
  const FACILITY_NAME = '安泰醫療社團法人附設安泰護理之家';
  const SESSION_KEY = 'antai_session_user';

  const els = (ids) => Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

  const $ = els([
    'tabOpen','tabClosed','btnNew','loginBadge','btnDelete',
    'viewList','viewForm','listBox','listEmpty',
    'btnBack','btnSave','btnCloseCase','btnExportDocx','btnPrint',
    'facilityName','recordDate','recordTime','recorderName',
    'residentSelect','bedNumber','residentNumber',
    'woundType','onsetDate','woundLocation','pressureStage','woundCount',
    'lengthCm','widthCm','depthCm','exudateAmount','exudateNature','tissueType','woundEdge','surroundingSkin','painScore','infectionSigns',
    'cleaningMethod','dressingUsed','debridement','medicationOrder','repositioning',
    'improved','noChange','worsened','needNotifyDoctor','needReferral','supervisorName',
    'nursingSummary','printArea'
  ]);

  let currentStatus = 'open'; // open|closed
  let currentDocId = null;
  let residents = [];
  let recorder = { staffId:'', displayName:'' };

  function loadSessionUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function requireNurse() {
    const s = loadSessionUser();
    const isNurse = !!(s && (s.canNurse === true || s.role === 'nurse' || s.source === 'nurses'));
    if (!isNurse) {
      alert('此系統僅供護理師使用（未偵測到護理師登入）');
      location.href = 'index.html';
      return false;
    }
    recorder = { staffId: s.staffId || '', displayName: s.displayName || '' };
    $.loginBadge.textContent = `護理師：${recorder.staffId} ${recorder.displayName}`.trim();
    return true;
  }

  function fmtDateISO(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function fmtTimeHHMM(d) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  async function loadResidents() {
    const snap = await db.collection('residents').orderBy('residentName').get();
    residents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    $.residentSelect.innerHTML = '<option value="">請選擇住民</option>' + residents.map(r =>
      `<option value="${r.id}">${escapeHtml(r.residentName || r.id)}</option>`
    ).join('');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function bindResidentAutoFill() {
    $.residentSelect.addEventListener('change', () => {
      const id = $.residentSelect.value;
      const r = residents.find(x => x.id === id);
      $.bedNumber.value = r?.bedNumber || '';
      $.residentNumber.value = r?.residentNumber || '';
    });
  }

  function setTabs() {
    if (currentStatus === 'open') {
      $.tabOpen.className = 'btn btn-dark pill';
      $.tabClosed.className = 'btn btn-outline-dark pill';
    } else {
      $.tabOpen.className = 'btn btn-outline-dark pill';
      $.tabClosed.className = 'btn btn-dark pill';
    }
  }

  function showList() {
    $.viewForm.classList.add('d-none');
    $.viewList.classList.remove('d-none');
  }
  function showForm() {
    $.viewList.classList.add('d-none');
    $.viewForm.classList.remove('d-none');
  }

  function resetFormForNew() {
    currentDocId = null;
    $.facilityName.value = FACILITY_NAME;
    const now = new Date();
    $.recordDate.value = fmtDateISO(now);
    $.recordTime.value = fmtTimeHHMM(now);
    $.recorderName.value = recorder.displayName || '';

    $.residentSelect.value = '';
    $.bedNumber.value = '';
    $.residentNumber.value = '';

    [
      'woundType','onsetDate','woundLocation','pressureStage','woundCount',
      'lengthCm','widthCm','depthCm','exudateAmount','exudateNature','tissueType','woundEdge','surroundingSkin','painScore','infectionSigns',
      'cleaningMethod','dressingUsed','debridement','medicationOrder','repositioning',
      'improved','noChange','worsened','needNotifyDoctor','needReferral','supervisorName','nursingSummary'
    ].forEach(id => { if ($[id]) $[id].value = ''; });

    $.btnCloseCase.classList.remove('d-none');
  }

  function fillForm(data) {
    $.facilityName.value = data.facilityName || FACILITY_NAME;
    $.recordDate.value = data.recordDate || '';
    $.recordTime.value = data.recordTime || '';
    $.recorderName.value = data.recorderName || '';
    $.residentSelect.value = data.residentId || '';
    $.bedNumber.value = data.bedNumber || '';
    $.residentNumber.value = data.residentNumber || '';

    Object.keys($).forEach(k => {
      if (data[k] != null && $[k] && typeof $[k].value !== 'undefined') {
        $[k].value = data[k];
      }
    });

    // close button only for open
    if (data.status === 'closed') $.btnCloseCase.classList.add('d-none');
    else $.btnCloseCase.classList.remove('d-none');
  }

  function collectForm() {
    const residentId = $.residentSelect.value || '';
    const resident = residents.find(r => r.id === residentId);

    return {
      status: currentStatus,
      facilityName: FACILITY_NAME,
      recordDate: $.recordDate.value || '',
      recordTime: $.recordTime.value || '',
      residentId,
      residentName: resident?.residentName || '',
      bedNumber: $.bedNumber.value || resident?.bedNumber || '',
      residentNumber: $.residentNumber.value || resident?.residentNumber || '',
      recorderStaffId: recorder.staffId || '',
      recorderName: recorder.displayName || '',
      woundType: $.woundType.value || '',
      onsetDate: $.onsetDate.value || '',
      woundLocation: $.woundLocation.value || '',
      pressureStage: $.pressureStage.value || '',
      woundCount: $.woundCount.value || '',
      lengthCm: $.lengthCm.value || '',
      widthCm: $.widthCm.value || '',
      depthCm: $.depthCm.value || '',
      exudateAmount: $.exudateAmount.value || '',
      exudateNature: $.exudateNature.value || '',
      tissueType: $.tissueType.value || '',
      woundEdge: $.woundEdge.value || '',
      surroundingSkin: $.surroundingSkin.value || '',
      painScore: $.painScore.value || '',
      infectionSigns: $.infectionSigns.value || '',
      cleaningMethod: $.cleaningMethod.value || '',
      dressingUsed: $.dressingUsed.value || '',
      debridement: $.debridement.value || '',
      medicationOrder: $.medicationOrder.value || '',
      repositioning: $.repositioning.value || '',
      improved: $.improved.value || '',
      noChange: $.noChange.value || '',
      worsened: $.worsened.value || '',
      needNotifyDoctor: $.needNotifyDoctor.value || '',
      needReferral: $.needReferral.value || '',
      supervisorName: $.supervisorName.value || '',
      nursingSummary: $.nursingSummary.value || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  async function saveRecord() {
    const data = collectForm();
    if (!data.residentId) { alert('請先選擇住民'); return; }

    if (currentDocId) {
      await db.collection('woundCareRecords').doc(currentDocId).set(data, { merge: true });
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = recorder.staffId || '';
      const ref = await db.collection('woundCareRecords').add(data);
      currentDocId = ref.id;
    }
    alert('已儲存');
    await loadList();
  }

  
  async function deleteRecord() {
    if (!currentDocId) {
      alert('尚未儲存，無法刪除');
      return;
    }
    if (!confirm('確定要刪除此單張？此動作無法復原。')) return;

    await db.collection('woundCareRecords').doc(currentDocId).delete();
    alert('已刪除');
    currentDocId = null;
    showList();
    await loadList();
  }

  async function closeCase() {
    if (!currentDocId) return;
    if (!confirm('確定要結案嗎？結案後會移到「已結案」清單。')) return;
    await db.collection('woundCareRecords').doc(currentDocId).set({
      status: 'closed',
      closedAt: firebase.firestore.FieldValue.serverTimestamp(),
      closedBy: recorder.staffId || ''
    }, { merge: true });
    currentStatus = 'closed';
    await loadList();
    alert('已結案');
    showList();
  }

  function buildListItem(docId, d) {
    const title = `${d.residentName || '(未填住民)'}｜${d.woundLocation || '未填部位'}`;
    const sub = `${d.recordDate || ''} ${d.recordTime || ''} · 記錄：${d.recorderName || ''}`;
    const badge = d.status === 'closed'
      ? '<span class="badge text-bg-secondary ms-2">已結案</span>'
      : '<span class="badge text-bg-success ms-2">進行中</span>';

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'list-group-item list-group-item-action list-item d-flex justify-content-between align-items-start';
    el.innerHTML = `
      <div class="me-3">
        <div class="fw-semibold">${escapeHtml(title)} ${badge}</div>
        <div class="text-muted small">${escapeHtml(sub)}</div>
      </div>
      <div class="text-muted small mono">${escapeHtml(docId.slice(0,6))}</div>
    `;
    el.addEventListener('click', async () => {
      const snap = await db.collection('woundCareRecords').doc(docId).get();
      const data = snap.data();
      if (!data) return;
      currentDocId = docId;
      currentStatus = data.status || 'open';
      setTabs();
      fillForm(data);
      showForm();
    });
    return el;
  }

  async function loadList() {
    setTabs();
    $.listBox.innerHTML = '';
    $.listEmpty.classList.add('d-none');

    const q = db.collection('woundCareRecords')
      .where('status','==', currentStatus)
      .orderBy('updatedAt','desc');

    const snap = await q.get();
    if (snap.empty) {
      $.listEmpty.classList.remove('d-none');
      return;
    }
    snap.forEach(doc => {
      $.listBox.appendChild(buildListItem(doc.id, doc.data() || {}));
    });
  }

  // --- Export / Print ---
  function getDocxData() {
    const data = collectForm();
    // map values to template keys (same names, but ensure human friendly)
    return {
      facilityName: data.facilityName,
      recordDate: data.recordDate ? data.recordDate.replaceAll('-','/') : '',
      residentName: data.residentName,
      bedNumber: data.bedNumber,
      residentNumber: data.residentNumber,
      recordTime: data.recordTime,
      woundType: data.woundType,
      onsetDate: data.onsetDate ? data.onsetDate.replaceAll('-','/') : '',
      woundLocation: data.woundLocation,
      pressureStage: data.pressureStage,
      woundCount: data.woundCount,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      depthCm: data.depthCm,
      exudateAmount: data.exudateAmount,
      exudateNature: data.exudateNature,
      tissueType: data.tissueType,
      woundEdge: data.woundEdge,
      surroundingSkin: data.surroundingSkin,
      painScore: data.painScore,
      infectionSigns: data.infectionSigns,
      cleaningMethod: data.cleaningMethod,
      dressingUsed: data.dressingUsed,
      debridement: data.debridement,
      medicationOrder: data.medicationOrder,
      repositioning: data.repositioning,
      improved: data.improved,
      noChange: data.noChange,
      worsened: data.worsened,
      needNotifyDoctor: data.needNotifyDoctor,
      needReferral: data.needReferral,
      nursingSummary: data.nursingSummary,
      recorderName: data.recorderName,
      supervisorName: data.supervisorName
    };
  }

  
  async function exportDocx() {
    if (!$.residentSelect.value) { alert('請先選擇住民'); return; }

    const d = getDocxData();
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel } = window.docx;

    const font = 'Microsoft JhengHei';
    const labelRun = (t) => new TextRun({ text: t, font, size: 24, bold: true });
    const valRun = (t) => new TextRun({ text: t || '', font, size: 24 });

    const noBorders = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };

    const fieldRow = (label, value) => new TableRow({
      children: [
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders,
          children: [ new Paragraph({ children: [labelRun(label)] }) ] }),
        new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders,
          children: [ new Paragraph({ children: [valRun(value)] }) ] }),
      ]
    });

    const title = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: '護理之家傷口紀錄單', font, size: 32, bold: true }) ],
      spacing: { after: 240 }
    });

    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        fieldRow('機構名稱', d.facilityName),
        fieldRow('紀錄日期', d.recordDate),
        fieldRow('住民姓名', d.residentName),
        fieldRow('床號', d.bedNumber),
        fieldRow('病歷號', d.residentNumber),
        fieldRow('紀錄時間', d.recordTime),
        fieldRow('記錄人員', d.recorderName),
      ]
    });

    const h = (text) => new Paragraph({
      children: [ new TextRun({ text, font, size: 26, bold: true }) ],
      spacing: { before: 240, after: 120 }
    });

    const p = (text) => new Paragraph({
      children: [ new TextRun({ text, font, size: 24 }) ],
      spacing: { after: 80 }
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 1 inch
          }
        },
        children: [
          title,
          headerTable,

          h('一、傷口基本資料'),
          p(`傷口類型：${d.woundType}`),
          p(`發生日期：${d.onsetDate}`),
          p(`傷口位置：${d.woundLocation}`),
          p(`壓力性損傷分期：${d.pressureStage}`),
          p(`傷口數量：${d.woundCount}`),

          h('二、傷口評估'),
          p(`傷口長度：${d.lengthCm} cm`),
          p(`傷口寬度：${d.widthCm} cm`),
          p(`傷口深度：${d.depthCm} cm`),
          p(`滲出液量：${d.exudateAmount}`),
          p(`滲出液性質：${d.exudateNature}`),
          p(`傷口組織：${d.tissueType}`),
          p(`傷口邊緣：${d.woundEdge}`),
          p(`周圍皮膚：${d.surroundingSkin}`),
          p(`疼痛程度（0–10分）：${d.painScore}`),
          p(`感染徵象：${d.infectionSigns}`),

          h('三、處置措施'),
          p(`清潔方式：${d.cleaningMethod}`),
          p(`使用敷料：${d.dressingUsed}`),
          p(`是否清創：${d.debridement}`),
          p(`醫囑用藥：${d.medicationOrder}`),
          p(`翻身減壓措施：${d.repositioning}`),

          h('四、傷口變化評估'),
          p(`傷口改善：${d.improved}`),
          p(`無明顯變化：${d.noChange}`),
          p(`傷口惡化：${d.worsened}`),
          p(`需通報醫師：${d.needNotifyDoctor}`),
          p(`需轉診：${d.needReferral}`),

          h('五、護理紀錄摘要'),
          p(d.nursingSummary || ''),

          new Paragraph({ text: '' }),
          p(`紀錄人員：${d.recorderName}`),
          p(`護理長／主管覆核：${d.supervisorName}`),
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const filename = `傷口紀錄單_${($.residentSelect.options[$.residentSelect.selectedIndex].text || '')}_${$.recordDate.value}.docx`;
    saveAs(blob, filename);
  }


  function printNow() {
    window.print();
  }

  // --- Wiring ---
  function wire() {
    $.tabOpen.addEventListener('click', async () => { currentStatus='open'; await loadList(); });
    $.tabClosed.addEventListener('click', async () => { currentStatus='closed'; await loadList(); });
    $.btnNew.addEventListener('click', () => { currentStatus='open'; setTabs(); resetFormForNew(); showForm(); });
    $.btnBack.addEventListener('click', () => { showList(); });
    $.btnSave.addEventListener('click', saveRecord);
    $.btnDelete.addEventListener('click', deleteRecord);
    $.btnCloseCase.addEventListener('click', closeCase);
    $.btnExportDocx.addEventListener('click', exportDocx);
    $.btnPrint.addEventListener('click', printNow);
    bindResidentAutoFill();
  }

  document.addEventListener('firebase-ready', async () => {
    if (!requireNurse()) return;
    $.facilityName.value = FACILITY_NAME;
    $.recorderName.value = recorder.displayName || '';
    await loadResidents();
    wire();
    await loadList();
  });
})();
