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
  let btnDeleteTop = null;

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
    updateExportButtonLabel();
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


  function ensureDeleteTopButton() {
    if (btnDeleteTop) return;
    const host = document.querySelector('#editorSection .d-flex.gap-2.no-print');
    if (!host) return;
    btnDeleteTop = document.createElement('button');
    btnDeleteTop.id = 'btnDeleteTop';
    btnDeleteTop.type = 'button';
    btnDeleteTop.className = 'btn btn-outline-danger pill';
    btnDeleteTop.textContent = '刪除';
    // 放在結案按鈕左邊（更順手）
    const closeBtn = document.getElementById('btnCloseCase');
    if (closeBtn && closeBtn.parentElement === host) host.insertBefore(btnDeleteTop, closeBtn);
    else host.appendChild(btnDeleteTop);

    btnDeleteTop.addEventListener('click', deleteRecord);
  }

  function updateDeleteButtons() {
    ensureDeleteTopButton();
    const canDeleteTop =
      (mode === 'case' && !!currentDocId) ||
      (mode === 'reassess' && !!currentReassessId);

    if (btnDeleteTop) {
      btnDeleteTop.classList.toggle('d-none', !canDeleteTop);
      btnDeleteTop.disabled = !canDeleteTop;
    }

    // 底部刪除（表單內）依照是否在表單編輯狀態顯示
    const inForm = ($.reassessFormSection && !$.reassessFormSection.classList.contains('d-none'));
    if ($.btnDelete) {
      const canDeleteBottom = inForm && (
        (mode === 'case' && !!currentDocId) ||
        (mode === 'reassess' && !!currentReassessId)
      );
      $.btnDelete.classList.toggle('d-none', !canDeleteBottom);
      $.btnDelete.disabled = !canDeleteBottom;
    }
  }


  function showList() {
    $.editorSection.classList.add('d-none');
    $.listSection.classList.remove('d-none');
    mode = 'case';
    currentReassessId = null;
    currentCaseData = null;
    updateDashBackVisibility();
    updateDeleteButtons();
  }
  function showForm() {
    $.listSection.classList.add('d-none');
    $.editorSection.classList.remove('d-none');
    updateDashBackVisibility();
    updateDeleteButtons();
    updateExportButtonLabel();
  }

  function showCaseView() {
    mode = 'case';
    if ($.caseViewSection) $.caseViewSection.classList.remove('d-none');
    if ($.reassessFormSection) $.reassessFormSection.classList.add('d-none');

    // 回到原始單張：恢復顯示「護理長/主管覆核」與「護理紀錄摘要」
    const supervisorBlock = document.getElementById('supervisorBlock');
    const nursingSummaryBlock = document.getElementById('nursingSummaryBlock');
    if (supervisorBlock) supervisorBlock.classList.remove('d-none');
    if (nursingSummaryBlock) nursingSummaryBlock.classList.remove('d-none');

    updateDeleteButtons();
    updateExportButtonLabel();
  }

  function showReassessForm() {
    mode = 'reassess';
    if ($.caseViewSection) $.caseViewSection.classList.add('d-none');
    if ($.reassessFormSection) $.reassessFormSection.classList.remove('d-none');

    // 復評：不需要「護理長/主管覆核」與「五、護理紀錄摘要」
    const supervisorBlock = document.getElementById('supervisorBlock');
    const nursingSummaryBlock = document.getElementById('nursingSummaryBlock');
    if (supervisorBlock) supervisorBlock.classList.add('d-none');
    if (nursingSummaryBlock) nursingSummaryBlock.classList.add('d-none');

    updateDeleteButtons();
    updateExportButtonLabel();
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

  async function beginNewReassess() {
    if (!currentCaseData || !currentDocId) return;

    // 保留原始 caseId（resetFormForNew 會把 currentDocId 清成 null）
    const caseId = currentDocId;

    isEditingCaseDetail = false;
    currentReassessId = null;

    // 先初始化一張新的復評表單（日期/時間/記錄人以「現在」為準）
    resetFormForNew();
    currentDocId = caseId;
    const keepDate = $.recordDate.value;
    const keepTime = $.recordTime.value;
    const keepRecorder = $.recorderName.value;

    // 需求：
    // - 若已有復評：新增復評時先抓「最新一筆復評」資料做預填
    // - 若為第一次復評：先抓「原始單張」資料做預填
    let sourceData = currentCaseData;

    try {
      const snap = await db.collection(REASSESS_COL)
        .where('caseId', '==', currentDocId)
        .orderBy('recordDate', 'desc')
        .orderBy('recordTime', 'desc')
        .limit(1)
        .get();

      if (!snap.empty) {
        sourceData = snap.docs[0].data() || currentCaseData;
      }
    } catch (e) {
      console.warn('[wound-care] load latest reassess failed, fallback to case', e);
      sourceData = currentCaseData;
    }

    // 預填：避免把舊的日期/時間/記錄人覆蓋掉
    const prefill = { ...(sourceData || {}) };
    delete prefill.recordDate;
    delete prefill.recordTime;
    delete prefill.recorderName;
    delete prefill.recorderStaffId;
    delete prefill.updatedAt;
    delete prefill.createdAt;
    delete prefill.createdBy;
    delete prefill.reassessYear;
    delete prefill.status;

    fillForm(prefill);

    // 恢復「現在」的日期/時間/記錄人
    $.recordDate.value = keepDate;
    $.recordTime.value = keepTime;
    $.recorderName.value = keepRecorder;

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
  function getDocxData(base) {
    const data = base || collectForm();
    // map values to template keys (same names, but ensure human friendly)
    return {
      facilityName: data.facilityName || FACILITY_NAME,
      recordDate: data.recordDate ? String(data.recordDate).replaceAll('-','/') : '',
      residentName: data.residentName || '',
      bedNumber: data.bedNumber || '',
      residentNumber: data.residentNumber || '',
      recordTime: data.recordTime || '',
      woundType: data.woundType || '',
      onsetDate: data.onsetDate ? String(data.onsetDate).replaceAll('-','/') : '',
      woundLocation: data.woundLocation || '',
      pressureStage: data.pressureStage || '',
      woundCount: data.woundCount || '',
      recentDebridement: data.recentDebridement || '',
      lengthCm: data.lengthCm || '',
      widthCm: data.widthCm || '',
      depthCm: data.depthCm || '',
      exudateAmount: data.exudateAmount || '',
      exudateNature: data.exudateNature || '',
      tissueType: data.tissueType || '',
      woundEdge: data.woundEdge || '',
      surroundingSkin: data.surroundingSkin || '',
      painScore: data.painScore || '',
      infectionSigns: data.infectionSigns || '',
      cleaningMethod: data.cleaningMethod || '',
      dressingUsed: data.dressingUsed || '',
      medicationOrder: data.medicationOrder || '',
      repositioning: data.repositioning || '',
      improved: data.improved || '',
      noChange: data.noChange || '',
      worsened: data.worsened || '',
      needDebridementAdvice: data.needDebridementAdvice || data.needNotifyDoctor || '',
      needOPD: data.needOPD || data.needReferral || '',
      nursingSummary: data.nursingSummary || '',
      recorderName: data.recorderName || '',
      supervisorName: data.supervisorName || ''
    };
  }


  // --- DOCX helpers ---
  const DOCX_FONT = 'Microsoft JhengHei';
  
function isCaseSummaryView() {
    return (mode === 'case' && !isEditingCaseDetail && $.caseViewSection && !$.caseViewSection.classList.contains('d-none'));
  }

  function updateExportButtonLabel() {
    if (!$.btnExportDocx) return;
    if (mode === 'reassess') {
      $.btnExportDocx.textContent = '匯出本張復評WORD';
      return;
    }
    if (isCaseSummaryView()) {
      $.btnExportDocx.textContent = '匯出復評';
      return;
    }
    $.btnExportDocx.textContent = '匯出 Word';
  }

  function promptReassessRange(year) {
    const y = Number(year) || (new Date()).getFullYear();
    const defStart = `${y}-01-01`;
    const defEnd = `${y}-12-31`;
    const start = prompt(`請輸入要匯出的起始日期（YYYY-MM-DD）\n（預設：${defStart}）`, defStart);
    if (start === null) return null;
    const end = prompt(`請輸入要匯出的結束日期（YYYY-MM-DD）\n（預設：${defEnd}）`, defEnd);
    if (end === null) return null;

    const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s||'').trim());
    const s = String(start||'').trim();
    const e = String(end||'').trim();
    if (!ok(s) || !ok(e) || s > e) {
      alert('日期格式錯誤或起訖順序不正確，請使用 YYYY-MM-DD，且起始日期需小於等於結束日期。');
      return null;
    }
    return { start: s, end: e, year: y };
  }
const docxSafeText = (v) => {
    let s = String(v ?? '');
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    s = s.replace(/[\uFFFE\uFFFF]/g, '');
    s = s.replace(/[\uD800-\uDFFF]/g, '');
    return s;
  };

  const docxRun = (text, opts = {}) => new window.docx.TextRun({
    text: docxSafeText(text),
    font: DOCX_FONT,
    size: opts.size ?? 24,
    bold: !!opts.bold
  });

  const docxP = (text, opts = {}) => new window.docx.Paragraph({
    children: [docxRun(text, opts)],
    spacing: opts.spacing || { after: 80 }
  });

  const docxH = (text) => new window.docx.Paragraph({
    children: [docxRun(text, { size: 26, bold: true })],
    spacing: { before: 240, after: 120 }
  });

  const docxMultilineP = (text) => {
    const lines = docxSafeText(text || '').split(/\r?\n/);
    const children = [];
    lines.forEach((line, idx) => {
      children.push(new window.docx.TextRun({ text: line, font: DOCX_FONT, size: 24, break: idx === 0 ? 0 : 1 }));
    });
    if (children.length === 0) children.push(new window.docx.TextRun({ text: '', font: DOCX_FONT, size: 24 }));
    return new window.docx.Paragraph({ children, spacing: { after: 80 } });
  };

  const docxNoBorders = {
    top: { style: window.docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: window.docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: window.docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: window.docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const docxFieldRow = (label, value) => new window.docx.TableRow({
    children: [
      new window.docx.TableCell({
        width: { size: 25, type: window.docx.WidthType.PERCENTAGE },
        borders: docxNoBorders,
        children: [ new window.docx.Paragraph({ children: [docxRun(label, { bold: true })] }) ]
      }),
      new window.docx.TableCell({
        width: { size: 75, type: window.docx.WidthType.PERCENTAGE },
        borders: docxNoBorders,
        children: [ new window.docx.Paragraph({ children: [docxRun(value || '')] }) ]
      }),
    ]
  });

  function formatISOToSlash(s) { return (s || '').replaceAll('-', '/'); }

  function compactReassessLines(d) {
    // 將「復評」整理成一個格子內的直觀內容（短行）
    const lines = [];
    const size = [d.lengthCm, d.widthCm, d.depthCm].filter(Boolean).join(' / ');
    if (d.woundLocation) lines.push(`部位：${d.woundLocation}`);
    if (size) lines.push(`長/寬/深(cm)：${size}`);
    if (d.exudateAmount || d.exudateNature) lines.push(`滲出液：${[d.exudateAmount, d.exudateNature].filter(Boolean).join('、')}`);
    if (d.tissueType) lines.push(`組織：${d.tissueType}`);
    if (d.woundEdge) lines.push(`邊緣：${d.woundEdge}`);
    if (d.surroundingSkin) lines.push(`周圍皮膚：${d.surroundingSkin}`);
    if (d.painScore) lines.push(`疼痛：${d.painScore}`);
    if (d.infectionSigns) lines.push(`感染徵象：${d.infectionSigns}`);
    if (d.cleaningMethod) lines.push(`清潔：${d.cleaningMethod}`);
    if (d.dressingUsed) lines.push(`敷料：${d.dressingUsed}`);
    if (d.medicationOrder) lines.push(`醫囑用藥：${d.medicationOrder}`);
    if (d.repositioning) lines.push(`翻身減壓：${d.repositioning}`);
    const change = [d.improved ? `改善:${d.improved}` : '', d.noChange ? `無變化:${d.noChange}` : '', d.worsened ? `惡化:${d.worsened}` : ''].filter(Boolean).join('、');
    if (change) lines.push(`變化：${change}`);
    if (d.needDebridementAdvice) lines.push(`建議清創：${d.needDebridementAdvice}`);
    if (d.needOPD) lines.push(`掛門診：${d.needOPD}`);
    if (d.supervisorName) lines.push(`主管覆核：${d.supervisorName}`);
    if (d.nursingSummary) lines.push(`摘要：${d.nursingSummary}`);
    return lines;
  }

  
  async function exportSingleDocx(base, titleText, opts) {
    const d = getDocxData(base);
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType } = window.docx;

    const facilityTitle = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: docxSafeText(d.facilityName || '安泰醫療社團法人附設安泰護理之家'), font: DOCX_FONT, size: 28, bold: true }) ],
      spacing: { after: 120 }
    });

    const title = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: titleText || '傷口紀錄單', font: DOCX_FONT, size: 32, bold: true }) ],
      spacing: { after: 240 }
    });

    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        docxFieldRow('紀錄日期', d.recordDate),
        docxFieldRow('住民姓名', d.residentName),
        docxFieldRow('床號', d.bedNumber),
        docxFieldRow('病歷號', d.residentNumber),
        docxFieldRow('紀錄時間', d.recordTime),
        docxFieldRow('記錄人員', d.recorderName),
      ]
    });

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          facilityTitle,
          title,
          headerTable,

          docxH('一、傷口基本資料'),
          docxP(`傷口類型：${d.woundType}`),
          docxP(`發生日期：${d.onsetDate}`),
          docxP(`傷口位置：${d.woundLocation}`),
          docxP(`壓力性損傷分期：${d.pressureStage}`),
          docxP(`傷口數量：${d.woundCount}`),
          docxP(`最近是否曾經清創：${d.recentDebridement}`),

          docxH('二、傷口評估'),
          docxP(`傷口長度：${d.lengthCm} cm`),
          docxP(`傷口寬度：${d.widthCm} cm`),
          docxP(`傷口深度：${d.depthCm} cm`),
          docxP(`滲出液量：${d.exudateAmount}`),
          docxP(`滲出液性質：${d.exudateNature}`),
          docxP(`傷口組織：${d.tissueType}`),
          docxP(`傷口邊緣：${d.woundEdge}`),
          docxP(`周圍皮膚：${d.surroundingSkin}`),
          docxP(`疼痛程度（0–10分）：${d.painScore}`),
          docxP(`感染徵象：${d.infectionSigns}`),

          docxH('三、照護措施'),
          docxP(`清潔方式：${d.cleaningMethod}`),
          docxP(`使用敷料：${d.dressingUsed}`),
          docxP(`醫囑用藥：${d.medicationOrder}`),
          docxP(`翻身減壓措施：${d.repositioning}`),

          docxH('四、傷口變化評估'),
          docxP(`傷口改善：${d.improved}`),
          docxP(`無明顯變化：${d.noChange}`),
          docxP(`傷口惡化：${d.worsened}`),
          docxP(`評估後是否建議清創：${d.needDebridementAdvice}`),
          docxP(`評估後是否掛門診：${d.needOPD}`),

          docxH('五、護理紀錄摘要'),
          docxMultilineP(d.nursingSummary || ''),

          new Paragraph({ text: '' }),
          docxP(`紀錄人員：${d.recorderName}`),
          docxP(`護理長／主管覆核：${d.supervisorName}`),
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const name = (opts && opts.filenamePrefix) ? opts.filenamePrefix : (titleText || '傷口紀錄單');
    const resident = (d.residentName || '').trim();
    const filename = `${name}_${resident || ''}_${(d.recordDate || '').replaceAll('/','-')}.docx`;
    saveAs(blob, filename);
  }

  async function exportReassessSummaryDocx(caseId, range) {
    if (!caseId) { alert('未選擇原始單張'); return; }
    const y = Number(range?.year) || (new Date()).getFullYear();
    const start = String(range?.start || `${y}-01-01`);
    const end = String(range?.end || `${y}-12-31`);

    // 讀取此 case 的所有復評（避免 Firestore 複合索引問題：不使用 orderBy/多重 where）
    let snap;
    try {
      snap = await db.collection(REASSESS_COL)
        .where('caseId','==', caseId)
        .get();
    } catch (e) {
      console.error(e);
      alert('讀取復評資料失敗，請稍後再試');
      return;
    }

    const all = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      all.push({ id: doc.id, ...d });
    });

    // 依區間過濾（recordDate 為 YYYY-MM-DD，可用字串比較）
    const filtered = all.filter(d => {
      const rd = String(d.recordDate || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) return false;
      return rd >= start && rd <= end;
    });

    if (filtered.length === 0) {
      alert('所選區間內沒有復評資料');
      return;
    }

    // 排序（由新到舊）
    filtered.sort((a,b) => {
      const da = String(a.recordDate || '');
      const db = String(b.recordDate || '');
      if (da !== db) return da < db ? 1 : -1;
      const ta = String(a.recordTime || '');
      const tb = String(b.recordTime || '');
      return ta < tb ? 1 : -1;
    });

    const rowsByDate = new Map();
    filtered.forEach(d => {
      const date = d.recordDate || '';
      if (!rowsByDate.has(date)) rowsByDate.set(date, []);
      rowsByDate.get(date).push(d);
    });

    const dates = Array.from(rowsByDate.keys()).sort((a,b) => (a < b ? 1 : -1));

    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = window.docx;

    const titleFacility = currentCaseData?.facilityName || FACILITY_NAME;
    const residentName = currentCaseData?.residentName || '';
    const bed = currentCaseData?.bedNumber || '';
    const mrn = currentCaseData?.residentNumber || '';

    const head1 = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: docxSafeText(titleFacility), font: DOCX_FONT, size: 28, bold: true }) ],
      spacing: { after: 120 }
    });
    const head2 = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [ new TextRun({ text: `復評彙整（${formatISOToSlash(start)}～${formatISOToSlash(end)}）`, font: DOCX_FONT, size: 32, bold: true }) ],
      spacing: { after: 200 }
    });

    const info = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        docxFieldRow('住民姓名', residentName),
        docxFieldRow('床號', bed),
        docxFieldRow('病歷號', mrn),
        docxFieldRow('傷口位置', currentCaseData?.woundLocation || ''),
        docxFieldRow('傷口類型', currentCaseData?.woundType || ''),
      ]
    });

    const border = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
    };

    const dayTables = [];
    for (const date of dates) {
      const items = rowsByDate.get(date) || [];

      const leftLines = [];
      leftLines.push(`日期：${formatISOToSlash(date)}`);
      items.forEach(it => {
        const t = (it.recordTime || '').trim();
        const who = (it.recorderName || '').trim();
        leftLines.push(`${t || '—'}　${who || ''}`.trim());
      });

      const rightParas = [];
      items.forEach((it, idx) => {
        const t = (it.recordTime || '').trim();
        const who = (it.recorderName || '').trim();
        rightParas.push(new Paragraph({
          children: [ new TextRun({ text: docxSafeText(`${t || ''} ${who || ''}`.trim()), font: DOCX_FONT, size: 24, bold: true }) ],
          spacing: { after: 60 }
        }));
        const lines = compactReassessLines(it);
        if (lines.length === 0) {
          rightParas.push(docxP('（無填寫內容）', { spacing: { after: 80 } }));
        } else {
          lines.forEach(line => rightParas.push(docxP(line, { spacing: { after: 40 } })));
        }
        if (idx < items.length - 1) {
          rightParas.push(docxP('────────────────', { spacing: { after: 80 } }));
        }
      });

      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: border,
                children: leftLines.map((ln, i) => new Paragraph({
                  children: [ new TextRun({ text: docxSafeText(ln), font: DOCX_FONT, size: 24, bold: i===0 }) ],
                  spacing: { after: 60 }
                }))
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                borders: border,
                children: rightParas
              })
            ]
          })
        ]
      });

      dayTables.push(docxH(`復評日：${formatISOToSlash(date)}`));
      dayTables.push(table);
    }

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          head1,
          head2,
          info,
          ...dayTables
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const filename = `匯出復評_${residentName || ''}_${start}~${end}.docx`;
    saveAs(blob, filename);
  }


  async function exportDocx() {
    // 1) 在「復評單張」裡：匯出該張完整復評（表單內容）
    if (mode === 'reassess') {
      const base = collectForm();
      if (!(base && (base.residentId || base.residentName))) { alert('請先選擇住民'); return; }
      await exportSingleDocx(base, '傷口復評紀錄單', { filenamePrefix: '匯出本張復評' });
      return;
    }

    // 2) 在「案例摘要頁」（第二張圖那個）：匯出所選區間內的所有復評彙整
    if (isCaseSummaryView()) {
      const range = promptReassessRange($.reassessYear?.value);
      if (!range) return;
      await exportReassessSummaryDocx(currentDocId, range);
      return;
    }

    // 3) 其他（例如：查看完整單張 / 原始單張表單編輯中）：匯出目前單張
    const base = (mode === 'case' && currentCaseData) ? currentCaseData : collectForm();
    if (!(base && (base.residentId || base.residentName))) { alert('請先選擇住民'); return; }
    await exportSingleDocx(base, '傷口紀錄單');
  }


  function printNow() {
    const base = (mode === 'reassess' || isEditingCaseDetail) ? collectForm() : (currentCaseData || collectForm());

    const now = new Date();
    const pad2 = (n) => String(n).padStart(2,'0');
    const printedAt = `${now.getFullYear()}/${pad2(now.getMonth()+1)}/${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const exportedBy = `${recorder.staffId || ''} ${recorder.displayName || ''}`.trim();

    // 舊資料相容（舊欄位名 → 新欄位名）
    const data = { ...base };
    if (!data.needDebridementAdvice && data.needNotifyDoctor) data.needDebridementAdvice = data.needNotifyDoctor;
    if (!data.needOPD && data.needReferral) data.needOPD = data.needReferral;

    const html = buildPrintHtml(data, { printedAt, exportedBy });

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

  function buildPrintHtml(d, meta) {
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
    .meta{margin-top:8px; font-size:12px; color:#374151;}
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
    <div class="meta">列印時間：${escapeHtml(meta?.printedAt || "")}　｜　匯出人：${escapeHtml(meta?.exportedBy || "")}</div>
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
    ensureDeleteTopButton();
    updateDeleteButtons();
    $.tabOpen.addEventListener('click', async () => { currentStatus='open'; await loadList(); });
    $.tabClosed.addEventListener('click', async () => { currentStatus='closed'; await loadList(); });
    $.btnNew.addEventListener('click', () => {
      // 新建「原始單張」：進入表單（共用 reassessFormSection），但 mode 必須是 case
      isEditingCaseDetail = false;
      currentReassessId = null;
      currentDocId = null;
      currentCaseData = null;

      currentStatus = 'open';
      setTabs();
      resetFormForNew();
      showForm();

      // 顯示表單區（共用），但避免誤進入復評模式
      showReassessForm();
      mode = 'case';

      if ($.btnCloseCase) $.btnCloseCase.classList.remove('d-none');
      if ($.btnDelete) $.btnDelete.classList.add('d-none');
    });
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
      $.btnNewReassess.addEventListener('click', async () => {
        await beginNewReassess();
      });
    }

  }

  document.addEventListener('firebase-ready', async () => {
    if (!requireNurse()) return;
    $.facilityName.value = FACILITY_NAME;
    $.recorderName.value = recorder.displayName || '';
    await loadResidents();
    wire();
    updateExportButtonLabel();
    updateDashBackVisibility();
    await loadList();
  });
})();
