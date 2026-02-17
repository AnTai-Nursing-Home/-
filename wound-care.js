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
    'tabOpen','tabClosed','btnNew','loginBadge','btnDelete','btnDashBack',
    'listSection','editorSection','listBox','loadingText','listEmpty',
    'btnBack','btnSave','btnCloseCase','btnExportDocx','btnPrint',
    'facilityName','recordDate','recordTime','recorderName',
    'residentSelect','bedNumber','residentNumber',
    'woundType','onsetDate','woundLocation','pressureStage','woundCount','recentDebridement',
    'lengthCm','widthCm','depthCm','exudateAmount','exudateNature','tissueType','woundEdge','surroundingSkin','painScore','infectionSigns',
    'cleaningMethod','dressingUsed','medicationOrder','repositioning',
    'improved','noChange','worsened','needDebridementAdvice','needOPD','supervisorName',
    'nursingSummary','printArea','caseViewSection','caseSummaryCard','caseSummaryTitle','caseSummarySub','caseSummaryBasics','btnViewCaseDetail','caseDetailBody','reassessYear','btnNewReassess','reassessLoading','reassessEmpty','reassessListBox','reassessFormSection'
  ]);

  let currentStatus = 'open'; // open|closed
  let currentDocId = null;
  let currentCaseData = null;          // 原始單張資料（建立時）
  let mode = 'case';                   // 'case' | 'reassess'
  let isEditingCaseDetail = false;     // 是否正在編輯「原始單張完整內容」
  let currentReassessId = null;        // 復評 doc id
  const REASSESS_COL = 'woundCareReassessments'; // 復評集合（獨立 collection）

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
    $.loginBadge.textContent = `登入者：${recorder.staffId} ${recorder.displayName}`.trim();
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


  function updateDashBackVisibility() {
    // 只有在「清單頁」才顯示返回儀表板按鈕；在新增/編輯單張（表單頁）隱藏
    const show = !($.editorSection && !$.editorSection.classList.contains('d-none'));
    if (!$.btnDashBack) return;
    if (show) $.btnDashBack.classList.remove('d-none');
    else $.btnDashBack.classList.add('d-none');
  }


  function showList() {
    $.editorSection.classList.add('d-none');
    $.listSection.classList.remove('d-none');
    mode = 'case';
    currentReassessId = null;
    currentCaseData = null;
    updateDashBackVisibility();
  }
  function showForm() {
    $.listSection.classList.add('d-none');
    $.editorSection.classList.remove('d-none');
    updateDashBackVisibility();
  }

  function showCaseView() {
    mode = 'case';
    if ($.caseViewSection) $.caseViewSection.classList.remove('d-none');
    if ($.reassessFormSection) $.reassessFormSection.classList.add('d-none');
  }

  function showReassessForm() {
    mode = 'reassess';
    if ($.caseViewSection) $.caseViewSection.classList.add('d-none');
    if ($.reassessFormSection) $.reassessFormSection.classList.remove('d-none');
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
      'woundType','onsetDate','woundLocation','pressureStage','woundCount','recentDebridement',
      'lengthCm','widthCm','depthCm','exudateAmount','exudateNature','tissueType','woundEdge','surroundingSkin','painScore','infectionSigns',
      'cleaningMethod','dressingUsed','medicationOrder','repositioning',
      'improved','noChange','worsened','needDebridementAdvice','needOPD','supervisorName','nursingSummary'
    ].forEach(id => { if ($[id]) $[id].value = ''; });

    $.btnCloseCase.classList.remove('d-none');
  }

  
  function renderCaseSummary(caseData) {
    if (!caseData) return;
    const title = `${caseData.residentName || '(未填住民)'}｜${caseData.woundLocation || '未填部位'}`;
    const sub = `${caseData.recordDate || ''} ${caseData.recordTime || ''} · 建單：${caseData.recorderName || ''}`;
    const basics = [
      `床號：${caseData.bedNumber || '—'}`,
      `病歷號：${caseData.residentNumber || '—'}`,
      `傷口類型：${caseData.woundType || '—'}`,
      `分期：${caseData.pressureStage || '—'}`,
      `數量：${caseData.woundCount || '—'}`,
      `發生日：${caseData.onsetDate || '—'}`
    ].join('　｜　');

    if ($.caseSummaryTitle) $.caseSummaryTitle.textContent = title;
    if ($.caseSummarySub) $.caseSummarySub.textContent = sub;
    if ($.caseSummaryBasics) $.caseSummaryBasics.textContent = basics;
  }

  function buildCaseDetailHtml(caseData) {
    const rows = [
      ['機構名稱', caseData.facilityName || FACILITY_NAME],
      ['紀錄日期/時間', `${caseData.recordDate || ''} ${caseData.recordTime || ''}`.trim()],
      ['記錄人員', caseData.recorderName || ''],
      ['住民姓名', caseData.residentName || ''],
      ['床號', caseData.bedNumber || ''],
      ['病歷號', caseData.residentNumber || ''],
      ['傷口類型', caseData.woundType || ''],
      ['發生日期', caseData.onsetDate || ''],
      ['傷口位置', caseData.woundLocation || ''],
      ['壓力性損傷分期', caseData.pressureStage || ''],
      ['傷口數量', caseData.woundCount || ''],
      ['最近是否曾經清創', caseData.recentDebridement || ''],
      ['長/寬/深 (cm)', `${caseData.lengthCm || ''} / ${caseData.widthCm || ''} / ${caseData.depthCm || ''}`],
      ['滲出液量', caseData.exudateAmount || ''],
      ['滲出液性質', caseData.exudateNature || ''],
      ['傷口組織', caseData.tissueType || ''],
      ['傷口邊緣', caseData.woundEdge || ''],
      ['周圍皮膚', caseData.surroundingSkin || ''],
      ['疼痛程度', caseData.painScore || ''],
      ['感染徵象', caseData.infectionSigns || ''],
      ['清潔方式', caseData.cleaningMethod || ''],
      ['使用敷料', caseData.dressingUsed || ''],
      ['醫囑用藥', caseData.medicationOrder || ''],
      ['翻身減壓措施', caseData.repositioning || ''],
      ['傷口改善', caseData.improved || ''],
      ['無明顯變化', caseData.noChange || ''],
      ['傷口惡化', caseData.worsened || ''],
      ['評估後是否建議清創', caseData.needDebridementAdvice || caseData.needNotifyDoctor || ''],
      ['評估後是否掛門診', caseData.needOPD || caseData.needReferral || ''],
      ['護理長/主管覆核', caseData.supervisorName || ''],
      ['護理紀錄摘要', caseData.nursingSummary || ''],
    ];

    return `
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <tbody>
            ${rows.map(([k,v]) => `
              <tr>
                <th class="text-nowrap" style="width: 180px;">${escapeHtml(k)}</th>
                <td>${escapeHtml(v)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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


    // backward compatibility: old fields -> new fields
    if ($.needDebridementAdvice && !$.needDebridementAdvice.value && data.needNotifyDoctor != null) {
      $.needDebridementAdvice.value = data.needNotifyDoctor;
    }
    if ($.needOPD && !$.needOPD.value && data.needReferral != null) {
      $.needOPD.value = data.needReferral;
    }


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
      recentDebridement: $.recentDebridement.value || '',
      cleaningMethod: $.cleaningMethod.value || '',
      dressingUsed: $.dressingUsed.value || '',
      medicationOrder: $.medicationOrder.value || '',
      repositioning: $.repositioning.value || '',
      improved: $.improved.value || '',
      noChange: $.noChange.value || '',
      worsened: $.worsened.value || '',
      needDebridementAdvice: $.needDebridementAdvice.value || '',
      needOPD: $.needOPD.value || '',
      supervisorName: $.supervisorName.value || '',
      nursingSummary: $.nursingSummary.value || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  async function saveRecord() {
    const data = collectForm();
    if (!data.residentId) { alert('請先選擇住民'); return; }

    if (mode === 'reassess') {
      if (!currentDocId) { alert('未選擇原始單張'); return; }
      data.caseId = currentDocId;
      data.caseResidentId = currentCaseData?.residentId || data.residentId;
      data.caseResidentName = currentCaseData?.residentName || data.residentName;
      data.reassessYear = yearFromISO(data.recordDate);
      data.status = currentStatus;

      if (currentReassessId) {
        await db.collection(REASSESS_COL).doc(currentReassessId).set(data, { merge: true });
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = recorder.staffId || '';
        const ref = await db.collection(REASSESS_COL).add(data);
        currentReassessId = ref.id;
      }

      alert('復評已儲存');
      showCaseView();
      const years = await loadReassessYears();
      setReassessYearOptions(years, yearFromISO(data.recordDate));
      await loadReassessmentsByYear($.reassessYear.value);
      return;
    }

    if (currentDocId) {
      await db.collection('woundCareRecords').doc(currentDocId).set(data, { merge: true });
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = recorder.staffId || '';
      const ref = await db.collection('woundCareRecords').add(data);
      currentDocId = ref.id;
    }
    alert('已儲存');
    if (isEditingCaseDetail && currentDocId) {
      const snap = await db.collection('woundCareRecords').doc(currentDocId).get();
      currentCaseData = snap.data() || currentCaseData;
      renderCaseSummary(currentCaseData);
      showCaseView();
      isEditingCaseDetail = false;
      const years = await loadReassessYears();
      setReassessYearOptions(years, $.reassessYear.value);
      await loadReassessmentsByYear($.reassessYear.value);
      return;
    }
    await loadList();
  }

  
  async function deleteRecord() {
    if (mode === 'reassess') {
      if (!currentReassessId) {
        alert('尚未儲存，無法刪除');
        return;
      }
      if (!confirm('確定要刪除此復評？此動作無法復原。')) return;

      await db.collection(REASSESS_COL).doc(currentReassessId).delete();
      alert('復評已刪除');
      currentReassessId = null;

      showCaseView();
      const years = await loadReassessYears();
      setReassessYearOptions(years, $.reassessYear.value);
      await loadReassessmentsByYear($.reassessYear.value);
      return;
    }

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
    if (mode === 'reassess') { alert('復評不提供結案'); return; }

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

  
  function yearFromISO(dateStr) {
    const m = /^\d{4}/.exec(dateStr || '');
    return m ? Number(m[0]) : (new Date()).getFullYear();
  }

  function setReassessYearOptions(years, selectedYear) {
    const nowY = (new Date()).getFullYear();
    const ys = Array.from(new Set([nowY, ...(years || [])])).sort((a,b)=>b-a);
    if (!$.reassessYear) return;
    $.reassessYear.innerHTML = ys.map(y => `<option value="${y}">${y}</option>`).join('');
    $.reassessYear.value = String(selectedYear || nowY);
  }

  function buildReassessItem(docId, d) {
    const title = `${d.recordDate || ''} ${d.recordTime || ''}`.trim() || '(未填日期)';
    const sub = `${d.woundLocation || currentCaseData?.woundLocation || ''} · 記錄：${d.recorderName || ''}`;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';
    el.innerHTML = `
      <div class="me-3">
        <div class="fw-semibold">${escapeHtml(title)}</div>
        <div class="text-muted small">${escapeHtml(sub)}</div>
      </div>
      <div class="text-muted small mono">${escapeHtml(docId.slice(0,6))}</div>
    `;
    el.addEventListener('click', async () => {
      const snap = await db.collection(REASSESS_COL).doc(docId).get();
      const data = snap.data();
      if (!data) return;
      currentReassessId = docId;
      fillForm(data);
      showReassessForm();
      if ($.btnCloseCase) $.btnCloseCase.classList.add('d-none');
      if ($.btnDelete) $.btnDelete.classList.remove('d-none');
    });
    return el;
  }

  async function loadReassessmentsByYear(year) {
    if (!currentDocId || !$.reassessListBox) return;
    try {
      $.reassessListBox.innerHTML = '';
      if ($.reassessEmpty) $.reassessEmpty.classList.add('d-none');
      if ($.reassessLoading) $.reassessLoading.classList.remove('d-none');

      const y = Number(year) || (new Date()).getFullYear();

      const q = db.collection(REASSESS_COL)
        .where('caseId','==', currentDocId)
        .where('reassessYear','==', y)
        .orderBy('recordDate','desc')
        .orderBy('recordTime','desc');

      const snap = await q.get();

      if ($.reassessLoading) $.reassessLoading.classList.add('d-none');
      if (snap.empty) {
        if ($.reassessEmpty) $.reassessEmpty.classList.remove('d-none');
        return;
      }
      snap.forEach(doc => {
        $.reassessListBox.appendChild(buildReassessItem(doc.id, doc.data() || {}));
      });
    } catch (e) {
      if ($.reassessLoading) $.reassessLoading.classList.add('d-none');
      console.error(e);
      alert('讀取復評資料失敗，請稍後再試');
    }
  }

  async function loadReassessYears() {
    if (!currentDocId) return [];
    const snap = await db.collection(REASSESS_COL).where('caseId','==', currentDocId).get();
    const years = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.reassessYear) years.push(Number(d.reassessYear));
      else if (d.recordDate) years.push(yearFromISO(d.recordDate));
    });
    return years;
  }

  function beginNewReassess() {
    if (!currentCaseData || !currentDocId) return;

    isEditingCaseDetail = false;
    currentReassessId = null;
    resetFormForNew();

    $.residentSelect.value = currentCaseData.residentId || '';
    $.bedNumber.value = currentCaseData.bedNumber || '';
    $.residentNumber.value = currentCaseData.residentNumber || '';

    $.woundType.value = currentCaseData.woundType || '';
    $.onsetDate.value = currentCaseData.onsetDate || '';
    $.woundLocation.value = currentCaseData.woundLocation || '';
    $.pressureStage.value = currentCaseData.pressureStage || '';
    $.woundCount.value = currentCaseData.woundCount || '';

    showReassessForm();
    if ($.btnCloseCase) $.btnCloseCase.classList.add('d-none');
    if ($.btnDelete) $.btnDelete.classList.add('d-none');
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
      currentCaseData = data;
      renderCaseSummary(currentCaseData);
      showForm();
      showCaseView();
      const years = await loadReassessYears();
      setReassessYearOptions(years, (new Date()).getFullYear());
      await loadReassessmentsByYear($.reassessYear.value);
      if ($.caseDetailBody) $.caseDetailBody.innerHTML = buildCaseDetailHtml(currentCaseData);

    });
    return el;
  }

  async function loadList() {
    try {
          setTabs();
          $.listBox.innerHTML = '';
          $.listEmpty.classList.add('d-none');
          if ($.loadingText) $.loadingText.classList.remove('d-none');
      
          const q = db.collection('woundCareRecords')
            .where('status','==', currentStatus)
            .orderBy('updatedAt','desc');
      
          const snap = await q.get();
      
          if ($.loadingText) $.loadingText.classList.add('d-none');
          if (snap.empty) {
            $.listEmpty.classList.remove('d-none');
            return;
          }
          snap.forEach(doc => {
            $.listBox.appendChild(buildListItem(doc.id, doc.data() || {}));
          });
    } catch (e) {
      if ($.loadingText) $.loadingText.classList.add('d-none');
      console.error(e);
      alert('讀取資料失敗，請稍後再試');
    }

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
      recentDebridement: data.recentDebridement,
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
      medicationOrder: data.medicationOrder,
      repositioning: data.repositioning,
      improved: data.improved,
      noChange: data.noChange,
      worsened: data.worsened,
      needDebridementAdvice: data.needDebridementAdvice || data.needNotifyDoctor,
      needOPD: data.needOPD || data.needReferral,
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

    const facilityTitle = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: d.facilityName || '安泰醫療社團法人附設安泰護理之家', font, size: 28, bold: true }) ],
      spacing: { after: 120 }
    });

    const title = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: '傷口紀錄單', font, size: 32, bold: true }) ],
      spacing: { after: 240 }
    });

    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [        fieldRow('紀錄日期', d.recordDate),
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
          facilityTitle,
          title,
          headerTable,

          h('一、傷口基本資料'),
          p(`傷口類型：${d.woundType}`),
          p(`發生日期：${d.onsetDate}`),
          p(`傷口位置：${d.woundLocation}`),
          p(`壓力性損傷分期：${d.pressureStage}`),
          p(`傷口數量：${d.woundCount}`),
          p(`最近是否曾經清創：${d.recentDebridement}`),

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

          h('三、照護措施'),
          p(`清潔方式：${d.cleaningMethod}`),
          p(`使用敷料：${d.dressingUsed}`),
          p(`醫囑用藥：${d.medicationOrder}`),
          p(`翻身減壓措施：${d.repositioning}`),

          h('四、傷口變化評估'),
          p(`傷口改善：${d.improved}`),
          p(`無明顯變化：${d.noChange}`),
          p(`傷口惡化：${d.worsened}`),
          p(`評估後是否建議清創：${d.needDebridementAdvice}`),
          p(`評估後是否掛門診：${d.needOPD}`),

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
    const base = (mode === 'reassess' || isEditingCaseDetail) ? collectForm() : (currentCaseData || collectForm());

    // 舊資料相容（舊欄位名 → 新欄位名）
    const data = { ...base };
    if (!data.needDebridementAdvice && data.needNotifyDoctor) data.needDebridementAdvice = data.needNotifyDoctor;
    if (!data.needOPD && data.needReferral) data.needOPD = data.needReferral;

    const html = buildPrintHtml(data);

    const w = window.open('', '_blank');
    if (!w) { alert('無法開啟列印視窗（可能被瀏覽器阻擋）'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // 等待資源載入後列印
    w.onload = () => {
      w.print();
      w.close();
    };
  }

  function buildPrintHtml(d) {
    const facility = '安泰醫療社團法人附設安泰護理之家';
    const title = '傷口紀錄單';

    const row = (k, v) => `
      <tr>
        <th>${escapeHtml(k)}</th>
        <td>${escapeHtml(v ?? '')}</td>
      </tr>`;

    const section = (name, rowsHtml) => `
      <div class="section">
        <div class="section-title">${escapeHtml(name)}</div>
        <table class="tbl">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

    const headerRows = [
      row('紀錄日期/時間', `${d.recordDate || ''} ${d.recordTime || ''}`.trim()),
      row('記錄人員', d.recorderName || ''),
      row('住民姓名', d.residentName || ''),
      row('床號', d.bedNumber || ''),
      row('病歷號', d.residentNumber || ''),
    ].join('');

    const s1 = [
      row('傷口類型', d.woundType || ''),
      row('發生日期', d.onsetDate || ''),
      row('傷口位置', d.woundLocation || ''),
      row('壓力性損傷分期', d.pressureStage || ''),
      row('傷口數量（處）', d.woundCount || ''),
      row('最近是否曾經清創', d.recentDebridement || ''),
    ].join('');

    const s2 = [
      row('長度（cm）', d.lengthCm || ''),
      row('寬度（cm）', d.widthCm || ''),
      row('深度（cm）', d.depthCm || ''),
      row('滲出液量', d.exudateAmount || ''),
      row('滲出液性質', d.exudateNature || ''),
      row('傷口組織', d.tissueType || ''),
      row('傷口邊緣', d.woundEdge || ''),
      row('周圍皮膚', d.surroundingSkin || ''),
      row('疼痛程度（0–10）', d.painScore || ''),
      row('感染徵象', d.infectionSigns || ''),
    ].join('');

    const s3 = [
      row('清潔方式', d.cleaningMethod || ''),
      row('使用敷料', d.dressingUsed || ''),
      row('醫囑用藥', d.medicationOrder || ''),
      row('翻身減壓措施', d.repositioning || ''),
    ].join('');

    const s4 = [
      row('傷口改善', d.improved || ''),
      row('無明顯變化', d.noChange || ''),
      row('傷口惡化', d.worsened || ''),
      row('評估後是否建議清創', d.needDebridementAdvice || ''),
      row('評估後是否掛門診', d.needOPD || ''),
      row('護理長／主管覆核', d.supervisorName || ''),
    ].join('');

    const s5 = `
      <div class="section">
        <div class="section-title">五、護理紀錄摘要</div>
        <div class="box">${escapeHtml(d.nursingSummary || '')}</div>
      </div>
    `;

    return `
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${facility}｜${title}</title>
  <style>
    body{font-family:"Microsoft JhengHei", Arial, sans-serif; margin:0; padding:24px; color:#111;}
    .header{text-align:center; margin-bottom:14px;}
    .facility{font-size:18px; font-weight:700; letter-spacing:.04em;}
    .title{font-size:22px; font-weight:800; margin-top:6px; letter-spacing:.08em;}
    .section{margin-top:14px;}
    .section-title{font-size:16px; font-weight:800; margin:10px 0 6px;}
    .tbl{width:100%; border-collapse:collapse; font-size:14px;}
    .tbl th,.tbl td{border:1px solid #333; padding:8px 10px; vertical-align:top;}
    .tbl th{width:26%; background:#f3f4f6; text-align:left; white-space:nowrap;}
    .box{border:1px solid #333; padding:10px; min-height:110px; white-space:pre-wrap;}
    @media print { body{padding:10mm;} }
  </style>
</head>
<body>
  <div class="header">
    <div class="facility">${facility}</div>
    <div class="title">${title}</div>
  </div>

  ${section('基本資料', headerRows)}
  ${section('一、傷口基本資料', s1)}
  ${section('二、傷口評估', s2)}
  ${section('三、照護措施', s3)}
  ${section('四、傷口變化評估', s4)}
  ${s5}
</body>
</html>`;
  }



  // --- Wiring ---
  function wire() {
    $.tabOpen.addEventListener('click', async () => { currentStatus='open'; await loadList(); });
    $.tabClosed.addEventListener('click', async () => { currentStatus='closed'; await loadList(); });
    $.btnNew.addEventListener('click', () => { isEditingCaseDetail = false;  currentStatus='open'; setTabs(); resetFormForNew(); showForm(); mode='case'; currentCaseData=null; showReassessForm(); if ($.btnCloseCase) $.btnCloseCase.classList.remove('d-none'); if ($.btnDelete) $.btnDelete.classList.add('d-none'); });
    $.btnBack.addEventListener('click', async () => {
      // 復評編輯 or 原始單張完整內容編輯 → 回到案例摘要頁（CaseView）
      if (mode === 'reassess' || isEditingCaseDetail) {
        showCaseView();
        isEditingCaseDetail = false;
        const years = await loadReassessYears();
        setReassessYearOptions(years, $.reassessYear.value);
        await loadReassessmentsByYear($.reassessYear.value);
      } else {
        showList();
      }
    });

    $.btnSave.addEventListener('click', saveRecord);
    $.btnDelete.addEventListener('click', deleteRecord);
    $.btnCloseCase.addEventListener('click', closeCase);
    $.btnExportDocx.addEventListener('click', exportDocx);
    $.btnPrint.addEventListener('click', printNow);
    bindResidentAutoFill();

    if ($.btnViewCaseDetail) {
      $.btnViewCaseDetail.addEventListener('click', () => {
        // 需求：點「查看完整單張」要看到「單張樣式（可編輯）」而不是敘述性表格
        if (!currentCaseData) return;
        isEditingCaseDetail = true;
        mode = 'case';
        currentReassessId = null;

        const mapped = { ...currentCaseData };
        if (!mapped.needDebridementAdvice && mapped.needNotifyDoctor) mapped.needDebridementAdvice = mapped.needNotifyDoctor;
        if (!mapped.needOPD && mapped.needReferral) mapped.needOPD = mapped.needReferral;
        fillForm(mapped);
        showReassessForm();

        // 原始單張可刪除；結案按鈕依 status 由 fillForm 控制顯示
        if ($.btnDelete) $.btnDelete.classList.remove('d-none');
      });
    }

    if ($.reassessYear) {
      $.reassessYear.addEventListener('change', async () => {
        await loadReassessmentsByYear($.reassessYear.value);
      });
    }

    if ($.btnNewReassess) {
      $.btnNewReassess.addEventListener('click', () => {
        beginNewReassess();
      });
    }

  }

  document.addEventListener('firebase-ready', async () => {
    if (!requireNurse()) return;
    $.facilityName.value = FACILITY_NAME;
    $.recorderName.value = recorder.displayName || '';
    await loadResidents();
    wire();
    updateDashBackVisibility();
    await loadList();
  });
})();
