document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 foley-care.html 存在的獨特元件，來判斷我們是否在正確的頁面
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) {
        return; // 如果找不到，代表不在照護評估頁，直接結束
    }

    // --- 元件宣告 ---
    const listView = document.getElementById('list-view');
    const formView = document.getElementById('form-view');
    const residentFilterSelect = document.getElementById('resident-filter-select');
    const residentNameSelectForm = document.getElementById('resident-name-select-form');
    const statusBtnGroup = document.querySelector('.btn-group');
    const closedStartInput = document.getElementById('closed-start-date');
    const closedEndInput = document.getElementById('closed-end-date');

    const careFormListTitle = document.getElementById('care-form-list-title');
    const careFormList = document.getElementById('care-form-list');
    const batchDeleteBtn = document.getElementById('batch-delete-closed-btn');
    const addNewFormBtn = document.getElementById('add-new-form-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const bedNumberInput = document.getElementById('resident-bedNumber');
    const genderInput = document.getElementById('resident-gender');
    const birthdayInput = document.getElementById('resident-birthday');
    const checkinDateInput = document.getElementById('resident-checkinDate');
    const placementDateInput = document.getElementById('foley-placement-date');
    const closingDateInput = document.getElementById('foley-closing-date');
    const chartNumberInput = document.getElementById('resident-chartNumber');
    const recordStartDateInput = document.getElementById('foley-record-start-date');
    const closingReasonSelect = document.getElementById('closing-reason');
    const tableMonthTitle = document.getElementById('table-month-title');
    const saveCareFormBtn = document.getElementById('save-care-form');
    const deleteCareFormBtn = document.getElementById('delete-care-form-btn');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    const createdByInput = document.getElementById('foley-created-by');
    const closedByInput = document.getElementById('foley-closed-by');
    const loginRoleStatus = document.getElementById('login-role-status');

    const auditBtn = document.getElementById('audit-btn');
    const backfillSettingsBtn = document.getElementById('backfill-settings-btn');
    const backfillEnabledInput = document.getElementById('backfill-enabled');
    const backfillOpenStartInput = document.getElementById('backfill-open-start');
    const backfillOpenEndInput = document.getElementById('backfill-open-end');
    const backfillAllowRangeInput = document.getElementById('backfill-allow-range');
    const backfillRangeStartInput = document.getElementById('backfill-range-start');
    const backfillRangeEndInput = document.getElementById('backfill-range-end');
    const backfillAllowSpecificInput = document.getElementById('backfill-allow-specific');
    const backfillSpecificDateInput = document.getElementById('backfill-specific-date-input');
    const backfillAddSpecificDateBtn = document.getElementById('backfill-add-specific-date');
    const backfillClearSpecificDatesBtn = document.getElementById('backfill-clear-specific-dates');
    const backfillSpecificDatesList = document.getElementById('backfill-specific-dates-list');
    const backfillCurrentStatus = document.getElementById('backfill-current-status');
    const backfillSaveBtn = document.getElementById('backfill-save-btn');
    const auditStartInput = document.getElementById('audit-start-date');
    const auditEndInput = document.getElementById('audit-end-date');
    const auditRunBtn = document.getElementById('audit-run-btn');
    const auditResultsBody = document.getElementById('audit-results-body');
    const auditSummary = document.getElementById('audit-summary');
    const auditOnlyIssuesBtn = document.getElementById('audit-only-issues-btn');
    let auditModal = null;
    let backfillModal = null;
    let auditShowOnlyIssues = false;
    let pendingAuditScrollDate = null;


    // --- 變數 ---
    const careItems = ['handHygiene', 'fixedPosition', 'urineBagPosition', 'unobstructedDrainage', 'avoidOverfill', 'urethralCleaning', 'singleUseContainer'];
    const residentsCollection = 'residents';
    const careFormsCollection = 'foley_care_records';

    let currentCareFormId = null;
    let currentLoadedDailyData = {};

    const backfillSettingsCollection = 'foley_care_backfill_settings';
    const backfillSettingsDocId = 'global';
    let currentBackfillConfig = {
        enabled: false,
        openStart: '',
        openEnd: '',
        allowRange: false,
        rangeStart: '',
        rangeEnd: '',
        allowSpecific: false,
        specificDates: [],
        updatedAt: null,
        updatedBy: ''
    };

// --- 未儲存變更偵測（Dirty Check） ---
let isDirty = false;
let lastSavedSnapshot = '';
let unsavedModal = null;

function computeFormSnapshot() {
    // 僅在表單視圖時才計算
    if (!formView || formView.classList.contains('d-none')) return '';
    const residentName = residentNameSelectForm?.value || '';
    const placementDate = placementDateInput?.value || '';
    const recordStartDate = recordStartDateInput?.value || '';
    const closingDate = closingDateInput?.value || '';
    const closingReason = closingReasonSelect?.value || '';
    const chartNumber = chartNumberInput?.value || '';
    const createdBy = createdByInput?.value || '';
    const closedBy = closedByInput?.value || '';

    const dailyData = {};
    if (careTableBody) {
        careTableBody.querySelectorAll('tr[data-date]').forEach(row => {
            const date = row.dataset.date;
            const record = {};
            let hasData = false;
            careItems.forEach(itemKey => {
                const checkedRadio = row.querySelector(`input[name^="${itemKey}"]:checked`);
                if (checkedRadio) { record[itemKey] = checkedRadio.value; hasData = true; }
            });
            const caregiverSignInput = row.querySelector('[data-signature="caregiver"]');
            if (caregiverSignInput && caregiverSignInput.value) { record.caregiverSign = caregiverSignInput.value; hasData = true; }
            if (hasData) { dailyData[date] = record; }
        });
    }

    const snapshotObj = {
        currentCareFormId: currentCareFormId || '',
        residentName, placementDate, recordStartDate, closingDate,
        closingReason, chartNumber, createdBy, closedBy,
        dailyData
    };
    try { return JSON.stringify(snapshotObj); } catch (e) { return String(Date.now()); }
}

function markClean() {
    lastSavedSnapshot = computeFormSnapshot();
    isDirty = false;
}

function markDirty() {
    if (!formView || formView.classList.contains('d-none')) return;
    const nowSnap = computeFormSnapshot();
    if (nowSnap !== lastSavedSnapshot) isDirty = true;
}

function ensureUnsavedModal() {
    if (unsavedModal) return;
    
const wrapper = document.createElement('div');
const _t = (key, fallback) => (typeof getText === 'function' ? getText(key) : fallback);
wrapper.innerHTML = `
<div class="modal fade" id="unsavedChangesModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">${_t('unsaved_changes_title','偵測到未儲存變更')}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        ${_t('unsaved_changes_message','系統偵測到您有做更改但尚未按「儲存」。是否要儲存變更？')}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="unsaved-cancel-btn" data-bs-dismiss="modal">${_t('unsaved_cancel','取消')}</button>
        <button type="button" class="btn btn-outline-danger" id="unsaved-discard-btn">${_t('unsaved_discard','不儲存')}</button>
        <button type="button" class="btn btn-primary" id="unsaved-save-btn">${_t('unsaved_save','儲存')}</button>
      </div>
    </div>
  </div>
</div>`;
        document.body.appendChild(wrapper.firstElementChild);

    const modalEl = document.getElementById('unsavedChangesModal');
    if (modalEl && window.bootstrap) {
        unsavedModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    } else {
        unsavedModal = null;
    }
}

function showUnsavedChangesDialog() {
    // Promise<'save'|'discard'|'cancel'>
    return new Promise((resolve) => {
        ensureUnsavedModal();
        if (!unsavedModal) {
            const ok = confirm('系統偵測到您有做更改但尚未儲存。是否要儲存變更？\\n按「確定」=儲存，按「取消」=不儲存');
            resolve(ok ? 'save' : 'discard');
            return;
        }
        const modalEl = document.getElementById('unsavedChangesModal');
        const btnSave = document.getElementById('unsaved-save-btn');
        const btnDiscard = document.getElementById('unsaved-discard-btn');
        const btnCancel = document.getElementById('unsaved-cancel-btn');

        const cleanup = () => {
            btnSave?.removeEventListener('click', onSave);
            btnDiscard?.removeEventListener('click', onDiscard);
            btnCancel?.removeEventListener('click', onCancel);
        };
        const onSave = () => { cleanup(); unsavedModal.hide(); resolve('save'); };
        const onDiscard = () => { cleanup(); unsavedModal.hide(); resolve('discard'); };
        const onCancel = () => { cleanup(); unsavedModal.hide(); resolve('cancel'); };

        btnSave?.addEventListener('click', onSave);
        btnDiscard?.addEventListener('click', onDiscard);
        btnCancel?.addEventListener('click', onCancel);

        unsavedModal.show();
    });
}

async function guardUnsavedChanges(nextAction) {
    if (!formView || formView.classList.contains('d-none')) {
        await nextAction();
        return true;
    }
    markDirty();
    if (!isDirty) {
        await nextAction();
        return true;
    }
    const choice = await showUnsavedChangesDialog();
    if (choice === 'cancel') return false;

    if (choice === 'save') {
        await handleSave();
        // handleSave 若成功會 markClean；這裡再確認一次
        markDirty();
        if (isDirty) return false;
    } else {
        isDirty = false;
    }
    await nextAction();
    return true;
}

    let isCurrentFormClosed = false;
    let residentsData = {};

    const SESSION_KEY = 'antai_session_user';

    function loadSessionUser() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function computeRoleFromSession(sess) {
        if (!sess) return { isNurse: false, display: '' };
        const display = [sess.staffId, sess.displayName].filter(Boolean).join(' ').trim();
        const nurse = (sess.canNurse === true) || (sess.role === 'nurse') || (sess.source === 'nurses');
        const caregiver = (sess.canCaregiver === true) || (sess.role === 'caregiver') || (sess.source === 'caregivers');
        return { isNurse: !!nurse, isCaregiver: !!caregiver, display };
    }


    function getResidentDisplayName(id, data = {}) {
        const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
        const english = (data.englishName || '').trim();
        if ((lang === 'en' || lang.startsWith('en-')) && english) {
            return english;
        }
        // 預設使用住民文件的 id（中文姓名）
        return id || english || '';
    }

    let currentView = 'ongoing';
    let isNurse = false;
    let currentUserDisplay = '';



    function normalizeBackfillConfig(data = {}) {
        return {
            enabled: data.enabled === true,
            openStart: data.openStart || '',
            openEnd: data.openEnd || '',
            allowRange: data.allowRange === true,
            rangeStart: data.rangeStart || '',
            rangeEnd: data.rangeEnd || '',
            allowSpecific: data.allowSpecific === true,
            specificDates: Array.isArray(data.specificDates) ? Array.from(new Set(data.specificDates.filter(Boolean))).sort() : [],
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || ''
        };
    }

    function parseDateTimeLocalValue(value) {
        if (!value) return null;
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function isCurrentWithinBackfillWindow(config = currentBackfillConfig) {
        if (!config || !config.enabled) return false;
        const now = new Date();
        const start = parseDateTimeLocalValue(config.openStart);
        const end = parseDateTimeLocalValue(config.openEnd);
        if (!start || !end) return false;
        return now >= start && now <= end;
    }

    function isDateAllowedByBackfill(dateStr, config = currentBackfillConfig) {
        if (!config || !config.enabled || !dateStr) return false;
        if (!isCurrentWithinBackfillWindow(config)) return false;

        let matched = false;
        if (config.allowRange && config.rangeStart && config.rangeEnd) {
            matched = matched || (dateStr >= config.rangeStart && dateStr <= config.rangeEnd);
        }
        if (config.allowSpecific && Array.isArray(config.specificDates)) {
            matched = matched || config.specificDates.includes(dateStr);
        }
        return matched;
    }

    function caregiverCanEditDate(dateStr) {
        if (isNurse) return true;
        if (isCurrentFormClosed) return false;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour + currentMinute / 60;
        const withinDailyWindow = (currentTime >= 8 && currentTime < 24);
        if (!withinDailyWindow) return false;

        const today = toISODate(new Date());
        if (dateStr === today) return true;
        return isDateAllowedByBackfill(dateStr);
    }

    async function loadBackfillConfig() {
        try {
            const doc = await db.collection(backfillSettingsCollection).doc(backfillSettingsDocId).get();
            currentBackfillConfig = normalizeBackfillConfig(doc.exists ? doc.data() : {});
        } catch (error) {
            console.error('讀取補登設定失敗：', error);
            currentBackfillConfig = normalizeBackfillConfig({});
        }
        renderBackfillSpecificDates();
        updateBackfillStatusText();
    }

    function renderBackfillSpecificDates() {
        if (!backfillSpecificDatesList) return;
        const dates = Array.isArray(currentBackfillConfig.specificDates) ? currentBackfillConfig.specificDates : [];
        if (!dates.length) {
            backfillSpecificDatesList.innerHTML = '<span class="text-muted small">目前尚未加入指定日期</span>';
            return;
        }
        backfillSpecificDatesList.innerHTML = dates.map(date => `
            <span class="badge rounded-pill text-bg-light border">
                ${date}
                <button type="button" class="btn btn-sm p-0 ms-1 border-0 bg-transparent text-danger backfill-remove-specific-date" data-date="${date}" aria-label="移除 ${date}">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        `).join('');
    }

    function fillBackfillModalFromConfig() {
        if (backfillEnabledInput) backfillEnabledInput.checked = currentBackfillConfig.enabled === true;
        if (backfillOpenStartInput) backfillOpenStartInput.value = currentBackfillConfig.openStart || '';
        if (backfillOpenEndInput) backfillOpenEndInput.value = currentBackfillConfig.openEnd || '';
        if (backfillAllowRangeInput) backfillAllowRangeInput.checked = currentBackfillConfig.allowRange === true;
        if (backfillRangeStartInput) backfillRangeStartInput.value = currentBackfillConfig.rangeStart || '';
        if (backfillRangeEndInput) backfillRangeEndInput.value = currentBackfillConfig.rangeEnd || '';
        if (backfillAllowSpecificInput) backfillAllowSpecificInput.checked = currentBackfillConfig.allowSpecific === true;
        if (backfillSpecificDateInput) backfillSpecificDateInput.value = '';
        renderBackfillSpecificDates();
        updateBackfillModalFieldStates();
        updateBackfillStatusText();
    }

    function updateBackfillModalFieldStates() {
        const enabled = backfillEnabledInput?.checked === true;
        const allowRange = enabled && backfillAllowRangeInput?.checked === true;
        const allowSpecific = enabled && backfillAllowSpecificInput?.checked === true;
        [backfillOpenStartInput, backfillOpenEndInput, backfillAllowRangeInput, backfillAllowSpecificInput].forEach(el => {
            if (el) el.disabled = !enabled;
        });
        [backfillRangeStartInput, backfillRangeEndInput].forEach(el => {
            if (el) el.disabled = !allowRange;
        });
        [backfillSpecificDateInput, backfillAddSpecificDateBtn, backfillClearSpecificDatesBtn].forEach(el => {
            if (el) el.disabled = !allowSpecific;
        });
        if (backfillSpecificDatesList) {
            backfillSpecificDatesList.querySelectorAll('.backfill-remove-specific-date').forEach(btn => {
                btn.disabled = !allowSpecific;
            });
        }
    }

    function updateBackfillStatusText() {
        if (!backfillCurrentStatus) return;
        const cfg = currentBackfillConfig || {};
        if (!cfg.enabled) {
            backfillCurrentStatus.textContent = '目前未開啟照服員補登功能。';
            return;
        }
        const parts = [];
        parts.push(`開放時段：${cfg.openStart || '未設定'} ~ ${cfg.openEnd || '未設定'}`);
        if (cfg.allowRange && cfg.rangeStart && cfg.rangeEnd) {
            parts.push(`區間：${cfg.rangeStart} ~ ${cfg.rangeEnd}`);
        }
        if (cfg.allowSpecific && Array.isArray(cfg.specificDates) && cfg.specificDates.length) {
            parts.push(`指定日期：${cfg.specificDates.join('、')}`);
        }
        if (cfg.updatedBy) {
            parts.push(`最後更新：${cfg.updatedBy}`);
        }
        backfillCurrentStatus.textContent = parts.join('｜');
    }

    function updateRoleUI() {
        // 顯示目前登入身分（由 session 判斷）
        if (loginRoleStatus) {
            loginRoleStatus.textContent = isNurse
                ? `已登入：護理師 ${currentUserDisplay}`
                : (currentUserDisplay ? `已登入：照服員 ${currentUserDisplay}` : '未登入');
            loginRoleStatus.classList.toggle('text-danger', !currentUserDisplay);
            loginRoleStatus.classList.toggle('text-success', !!currentUserDisplay);
        }
        // 一鍵查核 / 補登設定按鈕：僅護理師顯示
        if (auditBtn) auditBtn.classList.toggle('d-none', !isNurse);
        if (backfillSettingsBtn) backfillSettingsBtn.classList.toggle('d-none', !isNurse);

        // 批次刪除按鈕：僅「結案」視圖顯示（實際權限在點擊時再檢查）
        if (batchDeleteBtn) {
            if (currentView === 'closed') batchDeleteBtn.classList.remove('d-none');
            else batchDeleteBtn.classList.add('d-none');
        }
    }
            
function updateFormPermissions() {
        // 基本資料欄位：僅護理師可編輯
        const nurseOnlySelectors = [
            '#resident-name-select-form',
            '#resident-chartNumber',
            '#foley-placement-date',
            '#foley-closing-date',
            '#foley-record-start-date',
            '#closing-reason'
        ];
        nurseOnlySelectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                el.disabled = !isNurse;
            }
        });

        // 新增與刪除照護單：僅護理師可操作
        if (addNewFormBtn) {
            addNewFormBtn.disabled = !isNurse;
            addNewFormBtn.classList.toggle('disabled', !isNurse);
        }
        if (deleteCareFormBtn) {
            deleteCareFormBtn.disabled = !isNurse;
        }
    }


    // --- 結案日期 / 結案原因 綁定（兩者擇一有填，另一個必填） ---
    function syncClosingFieldsUI() {
        if (!closingDateInput || !closingReasonSelect) return;

        const dateVal = (closingDateInput.value || '').trim();
        const reasonVal = (closingReasonSelect.value || '').trim();
        const hasEither = !!dateVal || !!reasonVal;

        // 只要其中一個有填，兩個都視為必填
        closingDateInput.required = hasEither;
        closingReasonSelect.required = hasEither;

        // 清除舊狀態
        closingDateInput.classList.remove('is-invalid');
        closingReasonSelect.classList.remove('is-invalid');

        // Custom validity
        closingDateInput.setCustomValidity('');
        closingReasonSelect.setCustomValidity('');

        if (hasEither) {
            if (!dateVal) {
                closingDateInput.classList.add('is-invalid');
                closingDateInput.setCustomValidity('請選擇結案日期');
            }
            if (!reasonVal) {
                closingReasonSelect.classList.add('is-invalid');
                closingReasonSelect.setCustomValidity('請選擇結案原因');
            }
        }
    }

    function validateClosingFieldsOrAlert() {
        if (!closingDateInput || !closingReasonSelect) return true;
        syncClosingFieldsUI();
        const ok = closingDateInput.checkValidity() && closingReasonSelect.checkValidity();
        if (!ok) {
            const dateVal = (closingDateInput.value || '').trim();
            const reasonVal = (closingReasonSelect.value || '').trim();
            if (!dateVal && reasonVal) {
                alert('已選擇結案原因，請同時選擇結案日期。');
                closingDateInput.focus();
            } else if (dateVal && !reasonVal) {
                alert('已選擇結案日期，請同時選擇結案原因。');
                closingReasonSelect.focus();
            } else {
                alert('結案日期與結案原因需同時填寫。');
            }
        }
        return ok;
    }

    // 在欄位變更時即時同步 UI
    if (closingDateInput) {
        closingDateInput.addEventListener('change', () => { syncClosingFieldsUI(); });
        closingDateInput.addEventListener('input', () => { syncClosingFieldsUI(); });
    }
    if (closingReasonSelect) {
        closingReasonSelect.addEventListener('change', () => { syncClosingFieldsUI(); });
        closingReasonSelect.addEventListener('input', () => { syncClosingFieldsUI(); });
    }

    // 初始同步一次（避免載入既有資料時狀態不一致）
    setTimeout(() => { syncClosingFieldsUI(); }, 0);

    // --- 結案日期 / 結案原因 綁定 END ---

    // --- 置放日期 / 開始記錄日期 必填綁定 ---
    function syncStartFieldsUI() {
        if (!placementDateInput || !recordStartDateInput) return;

        const placementVal = (placementDateInput.value || '').trim();
        const recordStartVal = (recordStartDateInput.value || '').trim();

        placementDateInput.required = true;
        recordStartDateInput.required = true;

        placementDateInput.classList.remove('is-invalid');
        recordStartDateInput.classList.remove('is-invalid');
        placementDateInput.setCustomValidity('');
        recordStartDateInput.setCustomValidity('');

        if (!placementVal) {
            placementDateInput.classList.add('is-invalid');
            placementDateInput.setCustomValidity('請選擇置放日期');
        }
        if (!recordStartVal) {
            recordStartDateInput.classList.add('is-invalid');
            recordStartDateInput.setCustomValidity('請選擇開始記錄日期');
        }
    }

    function validateStartFieldsOrAlert() {
        if (!placementDateInput || !recordStartDateInput) return true;
        syncStartFieldsUI();
        const ok = placementDateInput.checkValidity() && recordStartDateInput.checkValidity();
        if (!ok) {
            if (!placementDateInput.value && !recordStartDateInput.value) {
                alert('置放日期與開始記錄日期都必須填寫。');
                placementDateInput.focus();
            } else if (!placementDateInput.value) {
                alert('請先填寫置放日期。');
                placementDateInput.focus();
            } else if (!recordStartDateInput.value) {
                alert('請先填寫開始記錄日期。');
                recordStartDateInput.focus();
            }
        }
        return ok;
    }

    if (placementDateInput) {
        placementDateInput.addEventListener('change', () => { syncStartFieldsUI(); });
        placementDateInput.addEventListener('input', () => { syncStartFieldsUI(); });
    }
    if (recordStartDateInput) {
        recordStartDateInput.addEventListener('change', () => { syncStartFieldsUI(); });
        recordStartDateInput.addEventListener('input', () => { syncStartFieldsUI(); });
    }

    setTimeout(() => { syncStartFieldsUI(); }, 0);


    // --- 函式定義 ---

    async function loadResidentsDropdowns() {
        const dropdowns = [residentFilterSelect, residentNameSelectForm];
        dropdowns.forEach(dropdown => dropdown.innerHTML = `<option value="">${getText('loading')}</option>`);
        try {
            const snapshot = await db.collection(residentsCollection).orderBy('bedNumber').get();
            let filterOptionsHTML = `<option value="" selected>${getText('all_residents')}</option>`;
            let formOptionsHTML = `<option value="" selected disabled>${getText('please_select_resident')}</option>`;

            snapshot.forEach(doc => {
                const data = doc.data();
                residentsData[doc.id] = data;
                const displayName = getResidentDisplayName(doc.id, data);
                const option = `<option value="${doc.id}">${displayName} (${data.bedNumber || ''})</option>`;
                filterOptionsHTML += option;
                formOptionsHTML += option;
            });

            residentFilterSelect.innerHTML = filterOptionsHTML;
            residentNameSelectForm.innerHTML = formOptionsHTML;
        } catch (error) {
            console.error("讀取住民列表失敗:", error);
            dropdowns.forEach(dropdown => dropdown.innerHTML = `<option value="">${getText('read_failed')}</option>`);
        }
    }

    // ✅ 修正版：解決 Firestore Invalid query 問題
    async function loadCareFormList() {
        const residentName = residentFilterSelect.value;
        careFormList.innerHTML = `<div class="list-group-item">${getText('loading')}</div>`;
        careFormListTitle.textContent =
            (currentView === 'ongoing')
                ? getText('ongoing_care_forms')
                : getText('closed_care_forms');

        try {
            let query = db.collection(careFormsCollection);

            if (residentName) {
                query = query.where('residentName', '==', residentName);
            }

            if (currentView === 'ongoing') {
                query = query.where('closingDate', '==', null);
            } else {
                query = query.where('closingDate', '!=', null);
            }

            // 🔹 修正 Firestore 限制，必須先排序 closingDate
            const snapshot = await query
                .orderBy('closingDate')
                .orderBy('placementDate', 'desc')
                .get();

            if (snapshot.empty) {
                careFormList.innerHTML = `<p class="text-muted mt-2">${getText('no_care_forms_found')}</p>`;
                return;
            }
            // 先收集文件，改由前端依「床號」排序，確保顯示順序穩定且符合使用習慣
            const docs = [];
            snapshot.forEach(doc => {
                docs.push({ id: doc.id, data: doc.data() });
            });

            // 解析床號（例如 "302-2" -> room=302, sub=2），確保 219-1、219-2 依序排列；無法解析則排到最後
            const parseBed = (residentName) => {
                const b = residentsData[residentName]?.bedNumber || '';
                const parts = String(b).split('-');
                const room = parseInt(parts[0], 10);
                const sub = parts[1] ? parseInt(parts[1], 10) : 0;
                return {
                    room: Number.isFinite(room) ? room : 999999,
                    sub: Number.isFinite(sub) ? sub : 0
                };
            };

// 若為結案單且有設定篩選日期，則依「開始記錄日，若無則置放日期」進行前端篩選
            let filteredDocs = docs;
            if (currentView === 'closed' && (closedStartInput?.value || closedEndInput?.value)) {
                const startStr = closedStartInput && closedStartInput.value ? closedStartInput.value : null;
                const endStr = closedEndInput && closedEndInput.value ? closedEndInput.value : null;
                const startDate = startStr ? new Date(startStr + 'T00:00:00') : null;
                const endDate = endStr ? new Date(endStr + 'T23:59:59') : null;

                filteredDocs = docs.filter(({ data }) => {
                    const baseStr = data.recordStartDate || data.placementDate;
                    if (!baseStr) return false;
                    const d = new Date(baseStr + 'T00:00:00');
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                });
            } else {
                filteredDocs = docs;
            }

            filteredDocs.sort((a, b) => {
                const A = parseBed(a.data.residentName);
                const B = parseBed(b.data.residentName);
                if (A.room !== B.room) return A.room - B.room;
                return A.sub - B.sub;
            });
if (filteredDocs.length === 0) {
                careFormList.innerHTML = `<p class="text-muted mt-2">${getText('no_care_forms_found')}</p>`;
                return;
            }

            let listHTML = '';
            filteredDocs.forEach(({ id, data }) => {
                const status = data.closingDate
                    ? `<span class="badge bg-secondary">${getText('status_closed')}</span>`
                    : `<span class="badge bg-success">${getText('status_ongoing')}</span>`;

                const checkboxHtml = (currentView === 'closed')
                    ? `<div class="form-check me-2">
                            <input class="form-check-input care-form-checkbox" type="checkbox" value="${id}" data-id="${id}" onclick="event.stopPropagation();">
                        </div>`
                    : '';

                listHTML += `
                    <a href="#" class="list-group-item list-group-item-action d-flex align-items-center" data-id="${id}">
                        ${checkboxHtml}
                        <div class="flex-grow-1">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1">${getResidentDisplayName(data.residentName, residentsData[data.residentName] || {})} (${residentsData[data.residentName]?.bedNumber || 'N/A'})</h5>
                                <small>${status}</small>
                            </div>
                            <p class="mb-1">${data.recordStartDate ? getText('record_start_date') : getText('placement_date')}: ${data.recordStartDate || data.placementDate || ''}</p>
                        </div>
                    </a>`;
            });

            careFormList.innerHTML = listHTML;

            // 更新批次刪除按鈕狀態（只控制顯示／隱藏，實際權限在點擊時再檢查）
            if (batchDeleteBtn) {
                if (currentView === 'closed' && filteredDocs.length > 0) {
                    batchDeleteBtn.classList.remove('d-none');
                } else {
                    batchDeleteBtn.classList.add('d-none');
                }
            }


        } catch (error) {
            console.error("讀取照護單列表失敗:", error);
            if (error.code === 'failed-precondition') {
                careFormList.innerHTML = `<div class="alert alert-warning">${getText('index_building_warning')}</div>`;
            } else {
                careFormList.innerHTML = `<div class="alert alert-danger">${getText('read_list_failed')}</div>`;
            }
        }
    }

    function renderCareTable(placementDate, closingDate, careData = {}) {
        // 預設從「基準日期 +1 天」開始；基準日期為：若有開始紀錄日則為開始紀錄日，否則為置放日
        let baseDate = new Date(placementDate + 'T00:00:00');
        if (recordStartDateInput && recordStartDateInput.value) {
            baseDate = new Date(recordStartDateInput.value + 'T00:00:00');
        }
        const startDate = new Date(baseDate);
        startDate.setDate(startDate.getDate() + 1);

        const endDate = closingDate ? new Date(closingDate + 'T00:00:00') : new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0);

        tableMonthTitle.textContent = `${getText('care_period')}: ${placementDate} ~ ${closingDate || getText('ongoing')}`;
        careTableBody.innerHTML = '';
        // 今日日期（本地時區）字串，用於高亮顯示
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dailyRecord = careData[dateString] || {};

            let itemCells = '';
            careItems.forEach(itemKey => {
                const value = dailyRecord[itemKey];
                itemCells += `<td>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${itemKey}-${dateString}" value="Yes" ${value === 'Yes' ? 'checked' : ''}>
                        <label class="form-check-label">${getText('yes')}</label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${itemKey}-${dateString}" value="No" ${value === 'No' ? 'checked' : ''}>
                        <label class="form-check-label">${getText('no')}</label>
                    </div>
                </td>`;
            });

            const caregiverSign = dailyRecord.caregiverSign || '';
            const isToday = (dateString === todayStr);
            const row = `<tr class="${isToday ? 'today-row' : ''}" data-date="${dateString}">
                <th>${month}/${day} <button type="button" class="btn btn-sm btn-outline-secondary fill-yes-btn" data-date="${dateString}">${getText('fill_all_yes')}</button></th>${itemCells}
                <td><input type="text" class="form-control form-control-sm signature-field" data-signature="caregiver" placeholder="${getText('signature')}" value="${caregiverSign}"></td>
            </tr>`;
            careTableBody.innerHTML += row;
        }

        // 綁定一鍵全Yes
        careTableBody.querySelectorAll('.fill-yes-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateStr = btn.getAttribute('data-date');
                const row = careTableBody.querySelector(`tr[data-date="${dateStr}"]`);
                if (!row) return;
                // 將該列所有 careItems radio 都設為 Yes
                if (btn.disabled) return;
                const radios = row.querySelectorAll('input[type="radio"][value="Yes"]:not(:disabled)');
                radios.forEach(r => { r.checked = true; });
            });
        });
        checkTimePermissions();

        // 若從「一鍵查核」開啟，則自動捲動到指定日期
        if (pendingAuditScrollDate) {
            const targetRow = careTableBody.querySelector(`tr[data-date="${pendingAuditScrollDate}"]`);
            if (targetRow) {
                targetRow.classList.add('table-warning');
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => targetRow.classList.remove('table-warning'), 2500);
            }
            pendingAuditScrollDate = null;
        }

}

    function checkTimePermissions() {
        document.querySelectorAll('#care-table-body tr[data-date]').forEach(row => {
            const dateStr = row.dataset.date;
            const canEditThisRow = caregiverCanEditDate(dateStr);

            row.querySelectorAll('input[type="radio"]').forEach(el => {
                el.disabled = !canEditThisRow;
            });

            row.querySelectorAll('[data-signature="caregiver"]').forEach(el => {
                el.disabled = !canEditThisRow;
                if (!canEditThisRow) {
                    el.readOnly = true;
                    return;
                }
                const v = (el.value || '').trim();
                el.readOnly = (!isNurse && v && v.includes(' @ '));
            });

            row.querySelectorAll('.fill-yes-btn').forEach(btn => {
                btn.disabled = !canEditThisRow;
            });
        });

        console.log(`已結案:${isCurrentFormClosed} | 護理師:${isNurse} | 補登視窗有效:${isCurrentWithinBackfillWindow()}`);
    }


    // --- 一鍵查核（未結案） ---
    function toISODate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function parseISODate(str) {
        if (!str) return null;
        const d = new Date(str + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function maxDate(a, b) { return (a && b) ? (a > b ? a : b) : (a || b); }
    function minDate(a, b) { return (a && b) ? (a < b ? a : b) : (a || b); }

    function getCareItemLabel(key) {
        const map = {
            handHygiene: getText?.('hand_hygiene') || '洗手',
            fixedPosition: getText?.('fixed_position') || '固定位置',
            urineBagPosition: getText?.('urine_bag_position') || '尿袋位置',
            unobstructedDrainage: getText?.('unobstructed_drainage') || '引流通暢',
            avoidOverfill: getText?.('avoid_overfill') || '避免過滿',
            urethralCleaning: getText?.('urethral_cleaning') || '尿道口清潔',
            singleUseContainer: getText?.('single_use_container') || '單次容器'
        };
        return map[key] || key;
    }

    function computeFormDateRange(docData) {
        const baseStr = docData.recordStartDate || docData.placementDate;
        if (!baseStr) return null;
        const base = new Date(baseStr + 'T00:00:00');
        const start = new Date(base);
        start.setDate(start.getDate() + 1);

        let end;
        if (docData.closingDate) {
            end = new Date(docData.closingDate + 'T00:00:00');
        } else {
            // 與 renderCareTable 一致：到「開始日的次月月底」
            end = new Date(start.getFullYear(), start.getMonth() + 2, 0);
        }
        return { start, end };
    }

    async function runAudit() {
        if (!db) return;
        if (!isNurse) {
            alert('請先以護理師登入後再使用一鍵查核');
            return;
        }
        if (!auditStartInput || !auditEndInput || !auditResultsBody) return;

        const start = parseISODate(auditStartInput.value);
        const end = parseISODate(auditEndInput.value);
        if (!start || !end) {
            alert('請先選擇查核起日與迄日');
            return;
        }
        if (start > end) {
            alert('查核起日不可晚於迄日');
            return;
        }

        auditResultsBody.innerHTML = `<tr><td colspan="5" class="text-muted">查核中…</td></tr>`;
        if (auditSummary) auditSummary.textContent = '';

        const snapshot = await db.collection(careFormsCollection).where('closingDate', '==', null).get();
        let scannedForms = 0;
        let checkedDays = 0;
        let issueDays = 0;

        const results = [];

        snapshot.forEach(doc => {
            scannedForms += 1;
            const data = doc.data() || {};
            const range = computeFormDateRange(data);
            if (!range) return;

            const overlapStart = maxDate(start, range.start);
            const overlapEnd = minDate(end, range.end);
            if (!overlapStart || !overlapEnd || overlapStart > overlapEnd) return;

            const residentId = data.residentName || '';
            const rData = residentsData[residentId] || {};
            const bed = rData.bedNumber || '';
            const residentDisplay = getResidentDisplayName(residentId, rData);

            const dailyData = data.dailyData || {};

            for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                const dateStr = toISODate(d);
                checkedDays += 1;

                const rec = dailyData[dateStr];
                const missing = [];

                if (!rec) {
                    careItems.forEach(k => missing.push(getCareItemLabel(k)));
                    missing.push('簽名');
                } else {
                    careItems.forEach(k => {
                        const v = rec[k];
                        if (!(v === 'Yes' || v === 'No')) missing.push(getCareItemLabel(k));
                    });
                    const sign = (rec.caregiverSign || '').trim();
                    if (!sign) missing.push('簽名');
                }

                if (missing.length > 0) issueDays += 1;

                results.push({
                    docId: doc.id,
                    residentId,
                    residentDisplay,
                    bed,
                    dateStr,
                    missing
                });
            }
        });

        // 渲染
        const filtered = auditShowOnlyIssues ? results.filter(r => r.missing.length > 0) : results;

        if (auditSummary) {
            auditSummary.textContent = `掃描 ${scannedForms} 張｜檢查 ${checkedDays} 天｜缺漏 ${issueDays} 天`;
        }

        if (filtered.length === 0) {
            auditResultsBody.innerHTML = `<tr><td colspan="5" class="text-muted">沒有任何資料（可能日期區間與未結案單無交集）</td></tr>`;
            return;
        }

        auditResultsBody.innerHTML = filtered.map(r => {
            const missingText = r.missing.length
                ? r.missing.map(x => `<span class="badge bg-danger me-1 mb-1">${x}</span>`).join(' ')
                : `<span class="badge bg-success">OK</span>`;
            const openBtn = `<button type="button" class="btn btn-sm btn-outline-primary audit-open-btn" data-id="${r.docId}" data-date="${r.dateStr}">開啟並定位</button>`;
            return `
                <tr>
                  <td>${r.bed || ''}</td>
                  <td>${r.residentDisplay || r.residentId || ''}</td>
                  <td>${r.dateStr}</td>
                  <td>${missingText}</td>
                  <td class="text-center">${openBtn}</td>
                </tr>
            `;
        }).join('');
    }

    async function openFormFromAudit(docId, dateStr) {
        if (!docId) return;
        try {
            const doc = await db.collection(careFormsCollection).doc(docId).get();
            if (!doc.exists) return;
            pendingAuditScrollDate = dateStr || null;
            await guardUnsavedChanges(async () => { switchToFormView(false, doc.data(), doc.id); });
        } catch (e) {
            console.error('openFormFromAudit failed', e);
            alert('開啟照護單失敗，請稍後再試');
        }
    }

function generateReportHTML() {
        const residentId = residentNameSelectForm.value;
        const residentData = residentsData[residentId] || {};
        const displayName = getResidentDisplayName(residentId, residentData);
        const bedNumber = bedNumberInput.value || residentData.bedNumber || '';
        const gender = genderInput.value || residentData.gender || '';
        const birthday = birthdayInput.value || residentData.birthday || '';
        const checkinDate = checkinDateInput.value || residentData.checkinDate || '';
        const placementDate = placementDateInput.value || '';
        const closingDate = closingDateInput.value || '';
        const chartNumber = chartNumberInput.value || '';
        const recordStartDate = recordStartDateInput.value || '';
        const closingReason = closingReasonSelect.value || '';

        // --- 基本資料區塊（列印用） ---
        const basicInfoTable = `
        <table style="width:100%; border-collapse:collapse; font-size:10pt; margin: 10px 0 14px 0;">
          <tr>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('name')}</b>：${displayName || ''}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('bed_number')}</b>：${bedNumber}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('chart_number')}</b>：${chartNumber}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('gender')}</b>：${gender}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('birthday')}</b>：${birthday}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('checkin_date')}</b>：${checkinDate}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('placement_date')}</b>：${placementDate}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('record_start_date')}</b>：${recordStartDate}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('closing_date')}</b>：${closingDate || getText('ongoing')}</td>
            <td style="border:1px solid #000; padding:6px;"><b>${getText('closing_reason')}</b>：${closingReason}</td>
            <td style="border:1px solid #000; padding:6px;"></td>
            <td style="border:1px solid #000; padding:6px;"></td>
          </tr>
        </table>`;

        let tableContent = `<table style="width:100%; border-collapse: collapse; font-size: 9pt;">
        <thead>
        <tr style="text-align: center; font-weight: bold; background-color: #f2f2f2;">
        <th rowspan="2" style="border: 1px solid black;">${getText('date')}</th>
        <th colspan="7" style="border: 1px solid black;">${getText('assessment_items')}</th>
        <th colspan="1" style="border: 1px solid black;">${getText('signature')}</th></tr>
        <tr style="text-align:center;font-weight:bold;background-color:#f2f2f2;">
        <th>${getText('hand_hygiene')}</th>
        <th>${getText('fixed_position')}</th>
        <th>${getText('urine_bag_position')}</th>
        <th>${getText('unobstructed_drainage')}</th>
        <th>${getText('avoid_overfill')}</th>
        <th>${getText('urethral_cleaning')}</th>
        <th>${getText('single_use_container')}</th>
        <th>${getText('caregiver')}</th></tr></thead><tbody>`;

        careTableBody.querySelectorAll('tr').forEach(row => {
            const dateAttr = row.getAttribute('data-date');
            const dObj = new Date(dateAttr + 'T00:00:00');
            const date = `${dObj.getMonth()+1}/${dObj.getDate()}`;
            let rowContent = `<tr><td style="border:1px solid black;">${date}</td>`;
            row.querySelectorAll('td').forEach((cell, index) => {
                let cellValue = '';
                if (index < careItems.length) {
                    const checkedRadio = cell.querySelector('input:checked');
                    cellValue = checkedRadio ? checkedRadio.value : '';
                } else {
                    const rawSign = (cell.querySelector('input').value || '').trim();
                    // 列印/匯出時簽章僅顯示「名字」，不顯示日期與時間
                    cellValue = rawSign ? rawSign.split(' ')[0] : '';
                }
                rowContent += `<td style="border:1px solid black;">${cellValue}</td>`;
            });
            rowContent += '</tr>';
            tableContent += rowContent;
        });

        tableContent += '</tbody></table>';
        const headerContent = `<div style="text-align: center;"><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${getText('foley_care_title')}</h2></div>`;
        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${getText('foley_care_assessment')}</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #000 !important;padding:6px}thead th{border:1px solid #000 !important}.fill-yes-btn{display:none !important}@media print{.fill-yes-btn{display:none !important}}</style></head><body>${headerContent}${basicInfoTable}${tableContent}</body></html>`;
    }

    function switchToListView() {
        listView.classList.remove('d-none');
        formView.classList.add('d-none');
        loadCareFormList();
    }

    function switchToFormView(isNew, docData = {}, docId = null) {
        listView.classList.add('d-none');
        formView.classList.remove('d-none');
        currentCareFormId = docId;

        residentNameSelectForm.disabled = !isNew;

        isCurrentFormClosed = false;
        currentLoadedDailyData = {};
        if (isNew) {
            residentNameSelectForm.value = '';
            bedNumberInput.value = '';
            genderInput.value = '';
            birthdayInput.value = '';
            checkinDateInput.value = '';
            chartNumberInput.value = '';
            recordStartDateInput.value = '';
            closingReasonSelect.value = '';
            placementDateInput.value = new Date().toISOString().split('T')[0];
            closingDateInput.value = '';
            if (createdByInput) {
                createdByInput.value = isNurse ? currentUserDisplay : '';
            }
            if (closedByInput) {
                closedByInput.value = '';
            }

            // 初始化快照（進入表單後視為乾淨狀態）
            markClean();

            renderCareTable(placementDateInput.value, null);
            deleteCareFormBtn.classList.add('d-none');
        
            syncClosingFieldsUI();
            syncStartFieldsUI();
            syncStartFieldsUI();
} else {
            isCurrentFormClosed = !!docData.closingDate;
            const residentData = residentsData[docData.residentName];
            residentNameSelectForm.value = docData.residentName;
            bedNumberInput.value = residentData.bedNumber;
            genderInput.value = residentData.gender;
            birthdayInput.value = residentData.birthday;
            checkinDateInput.value = residentData.checkinDate;
            // 病歷號以住民資料庫的 residentNumber 為主，若無則退回照護單內既有資料
            chartNumberInput.value = residentData.residentNumber || docData.chartNumber || '';
            recordStartDateInput.value = docData.recordStartDate || '';
            closingReasonSelect.value = docData.closingReason || '';
            placementDateInput.value = docData.placementDate;
            closingDateInput.value = docData.closingDate || '';
            if (createdByInput) {
                createdByInput.value = docData.createdByNurse || '';
            }
            if (closedByInput) {
                closedByInput.value = docData.closedByNurse || '';
            }
            currentLoadedDailyData = JSON.parse(JSON.stringify(docData.dailyData || {}));
            renderCareTable(docData.placementDate, docData.closingDate, docData.dailyData || {});
            deleteCareFormBtn.classList.remove('d-none');
        
            syncClosingFieldsUI();
}
    }

    async function handleSave() {
        const residentName = residentNameSelectForm.value;
        const placementDate = placementDateInput.value;
        if (!residentName) {
            alert(getText('fill_form_first'));
            return;
        }

        if (!validateStartFieldsOrAlert()) {
            return;
        }
        
        // 結案日期/原因必須成對
        if (!validateClosingFieldsOrAlert()) {
            return;
        }
let dailyData = {};
        careTableBody.querySelectorAll('tr[data-date]').forEach(row => {
            const date = row.dataset.date;
            const record = {};
            let hasData = false;
            careItems.forEach(itemKey => {
                const checkedRadio = row.querySelector(`input[name^="${itemKey}"]:checked`);
                if (checkedRadio) { record[itemKey] = checkedRadio.value; hasData = true; }
            });
            const caregiverSignInput = row.querySelector('[data-signature="caregiver"]');
            if (caregiverSignInput && caregiverSignInput.value) { record.caregiverSign = caregiverSignInput.value; hasData = true; }
            if (hasData) { dailyData[date] = record; }
        });

        if (!isNurse) {
            const mergedDailyData = JSON.parse(JSON.stringify(currentLoadedDailyData || {}));
            Object.keys(dailyData).forEach(date => {
                if (caregiverCanEditDate(date)) {
                    mergedDailyData[date] = dailyData[date];
                }
            });
            careTableBody.querySelectorAll('tr[data-date]').forEach(row => {
                const date = row.dataset.date;
                if (!caregiverCanEditDate(date)) return;
                if (!dailyData[date] && mergedDailyData[date]) {
                    delete mergedDailyData[date];
                }
            });
            dailyData = mergedDailyData;
        }
        const closingDateValue = closingDateInput.value || null;
        const closingReasonValue = closingReasonSelect.value || '';
        let closedByValue = closedByInput ? (closedByInput.value || '') : '';

        if (closingDateValue) {
            if (isNurse && currentUserDisplay) {
                closedByValue = currentUserDisplay;
                if (closedByInput) closedByInput.value = currentUserDisplay;
            }
        } else {
            closedByValue = '';
            if (closedByInput) closedByInput.value = '';
        }

        const dataToSave = {
            residentName,
            month: placementDate.substring(0, 7),
            placementDate,
            recordStartDate: recordStartDateInput.value || '',
            closingDate: closingDateValue,
            closingReason: closingReasonValue,
            chartNumber: chartNumberInput.value || '',
            createdByNurse: createdByInput ? (createdByInput.value || '') : '',
            closedByNurse: closedByValue,
            dailyData
        };
        saveCareFormBtn.disabled = true;
        try {
            if (currentCareFormId) {
                await db.collection(careFormsCollection).doc(currentCareFormId).set(dataToSave, { merge: true });
            } else {
                const docRef = await db.collection(careFormsCollection).add(dataToSave);
                currentCareFormId = docRef.id;
                deleteCareFormBtn.classList.remove('d-none');
            }
            currentLoadedDailyData = JSON.parse(JSON.stringify(dailyData || {}));
            alert(getText('care_form_saved'));
            // 儲存成功後，更新快照
            markClean();
        } catch (error) {
            console.error("儲存失敗:", error);
            alert(getText('save_failed'));
        } finally {
            saveCareFormBtn.disabled = false;
        }
}

// (已移除護理師手動登入流程，改由 session 判斷身分)

// --- 事件監聽器 ---


    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            if (!isNurse) {
                alert('僅限護理師登入後才能批次刪除結案單');
                return;
            }
            if (currentView !== 'closed') {
                alert('僅能刪除「已結案」的照護單');
                return;
            }
            const checked = Array.from(document.querySelectorAll('.care-form-checkbox:checked'));
            if (checked.length === 0) {
                alert('請先勾選要刪除的結案單');
                return;
            }
            if (!confirm(`確定要刪除選取的 ${checked.length} 張結案照護單嗎？此動作無法復原。`)) {
                return;
            }
            try {
                for (const cb of checked) {
                    const id = cb.dataset.id;
                    await db.collection(careFormsCollection).doc(id).delete();
                }
                alert('已刪除選取的結案照護單');
                loadCareFormList();
            } catch (err) {
                console.error('批次刪除失敗：', err);
                alert('刪除時發生錯誤，請稍後再試');
            }
        });
    }


    if (closedStartInput) {
        closedStartInput.addEventListener('change', () => {
            if (currentView === 'closed') {
                loadCareFormList();
            }
        });
    }
    if (closedEndInput) {
        closedEndInput.addEventListener('change', () => {
            if (currentView === 'closed') {
                loadCareFormList();
            }
        });
    }

    residentFilterSelect.addEventListener('change', loadCareFormList);

    statusBtnGroup.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            statusBtnGroup.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentView = e.target.dataset.status;
            // 結案單模式顯示日期篩選列，其餘隱藏
            const filterRow = document.getElementById('closed-date-filter');
            if (filterRow) {
                if (currentView === 'closed') {
                    filterRow.classList.remove('d-none');
                } else {
                    filterRow.classList.add('d-none');
                }
            }
            loadCareFormList();
        }
    });

    if (addNewFormBtn) {
        addNewFormBtn.addEventListener('click', async () => {
            if (!isNurse) {
                alert('僅限護理師登入後才能新增導尿管照護單');
                return;
            }
            await guardUnsavedChanges(async () => { switchToFormView(true); });
        });
    }

    if (backfillSettingsBtn) {
        backfillSettingsBtn.addEventListener('click', async () => {
            if (!isNurse) {
                alert('僅限護理師登入後才能設定補登功能');
                return;
            }
            const modalEl = document.getElementById('backfillSettingsModal');
            if (!backfillModal && modalEl && window.bootstrap) {
                backfillModal = new bootstrap.Modal(modalEl);
            }
            await loadBackfillConfig();
            fillBackfillModalFromConfig();
            backfillModal?.show();
        });
    }

    if (backfillEnabledInput) backfillEnabledInput.addEventListener('change', updateBackfillModalFieldStates);
    if (backfillAllowRangeInput) backfillAllowRangeInput.addEventListener('change', updateBackfillModalFieldStates);
    if (backfillAllowSpecificInput) backfillAllowSpecificInput.addEventListener('change', updateBackfillModalFieldStates);

    if (backfillAddSpecificDateBtn) {
        backfillAddSpecificDateBtn.addEventListener('click', () => {
            const value = backfillSpecificDateInput?.value || '';
            if (!value) {
                alert('請先選擇要加入的日期');
                return;
            }
            const dates = new Set(currentBackfillConfig.specificDates || []);
            dates.add(value);
            currentBackfillConfig.specificDates = Array.from(dates).sort();
            if (backfillSpecificDateInput) backfillSpecificDateInput.value = '';
            renderBackfillSpecificDates();
            updateBackfillModalFieldStates();
        });
    }

    if (backfillClearSpecificDatesBtn) {
        backfillClearSpecificDatesBtn.addEventListener('click', () => {
            currentBackfillConfig.specificDates = [];
            renderBackfillSpecificDates();
            updateBackfillModalFieldStates();
        });
    }

    if (backfillSpecificDatesList) {
        backfillSpecificDatesList.addEventListener('click', (e) => {
            const btn = e.target.closest('.backfill-remove-specific-date');
            if (!btn) return;
            const date = btn.getAttribute('data-date');
            currentBackfillConfig.specificDates = (currentBackfillConfig.specificDates || []).filter(item => item !== date);
            renderBackfillSpecificDates();
            updateBackfillModalFieldStates();
        });
    }

    if (backfillSaveBtn) {
        backfillSaveBtn.addEventListener('click', async () => {
            if (!isNurse) {
                alert('僅限護理師登入後才能設定補登功能');
                return;
            }

            const enabled = backfillEnabledInput?.checked === true;
            const openStart = backfillOpenStartInput?.value || '';
            const openEnd = backfillOpenEndInput?.value || '';
            const allowRange = backfillAllowRangeInput?.checked === true;
            const rangeStart = backfillRangeStartInput?.value || '';
            const rangeEnd = backfillRangeEndInput?.value || '';
            const allowSpecific = backfillAllowSpecificInput?.checked === true;
            const specificDates = Array.from(new Set(currentBackfillConfig.specificDates || [])).sort();

            if (enabled) {
                if (!openStart || !openEnd) {
                    alert('開啟補登功能時，請設定開放時間與結束時間');
                    return;
                }
                const startDt = parseDateTimeLocalValue(openStart);
                const endDt = parseDateTimeLocalValue(openEnd);
                if (!startDt || !endDt || startDt >= endDt) {
                    alert('補登開放時間設定不正確，請重新確認');
                    return;
                }
                if (!allowRange && !allowSpecific) {
                    alert('請至少選擇一種可補登日期方式（區間或指定日期）');
                    return;
                }
                if (allowRange) {
                    if (!rangeStart || !rangeEnd) {
                        alert('已勾選日期區間，請完整設定區間起日與迄日');
                        return;
                    }
                    if (rangeStart > rangeEnd) {
                        alert('補登區間起日不可晚於迄日');
                        return;
                    }
                }
                if (allowSpecific && specificDates.length === 0) {
                    alert('已勾選指定日期，請至少加入一天');
                    return;
                }
            }

            const dataToSave = {
                enabled,
                openStart,
                openEnd,
                allowRange,
                rangeStart,
                rangeEnd,
                allowSpecific,
                specificDates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUserDisplay || ''
            };

            backfillSaveBtn.disabled = true;
            try {
                await db.collection(backfillSettingsCollection).doc(backfillSettingsDocId).set(dataToSave, { merge: true });
                await loadBackfillConfig();
                fillBackfillModalFromConfig();
                checkTimePermissions();
                alert('補登設定已儲存');
                backfillModal?.hide();
            } catch (error) {
                console.error('儲存補登設定失敗：', error);
                alert('儲存補登設定失敗，請稍後再試');
            } finally {
                backfillSaveBtn.disabled = false;
            }
        });
    }

    // --- 一鍵查核：事件 ---
    if (auditBtn) {
        auditBtn.addEventListener('click', () => {
            const modalEl = document.getElementById('auditModal');
            if (!auditModal && modalEl && window.bootstrap) {
                auditModal = new bootstrap.Modal(modalEl);
            }
            // 預設填入今天
            const today = new Date();
            const todayStr = toISODate(today);
            if (auditStartInput && !auditStartInput.value) auditStartInput.value = todayStr;
            if (auditEndInput && !auditEndInput.value) auditEndInput.value = todayStr;

            auditShowOnlyIssues = false;
            if (auditOnlyIssuesBtn) auditOnlyIssuesBtn.textContent = '只看有缺漏';
            if (auditResultsBody) auditResultsBody.innerHTML = `<tr><td colspan="5" class="text-muted">請先設定日期區間後按「開始查核」</td></tr>`;
            if (auditSummary) auditSummary.textContent = '';
            auditModal?.show();
        });
    }

    if (auditRunBtn) {
        auditRunBtn.addEventListener('click', async () => {
            await runAudit();
        });
    }

    if (auditOnlyIssuesBtn) {
        auditOnlyIssuesBtn.addEventListener('click', async () => {
            auditShowOnlyIssues = !auditShowOnlyIssues;
            auditOnlyIssuesBtn.textContent = auditShowOnlyIssues ? '顯示全部' : '只看有缺漏';
            await runAudit();
        });
    }

    if (auditResultsBody) {
        auditResultsBody.addEventListener('click', async (e) => {
            const btn = e.target.closest('.audit-open-btn');
            if (!btn) return;
            const id = btn.getAttribute('data-id');
            const dateStr = btn.getAttribute('data-date');
            auditModal?.hide();
            await openFormFromAudit(id, dateStr);
        });
    }


    backToListBtn.addEventListener('click', async () => {
        await guardUnsavedChanges(async () => { switchToListView(); });
    });

    residentNameSelectForm.addEventListener('change', () => {
        const residentData = residentsData[residentNameSelectForm.value];
        if (residentData) {
            bedNumberInput.value = residentData.bedNumber;
            genderInput.value = residentData.gender;
            birthdayInput.value = residentData.birthday;
            checkinDateInput.value = residentData.checkinDate;
            // 病歷號跟其他基本資料一樣，從住民資料庫抓取（residents.residentNumber）
            chartNumberInput.value = residentData.residentNumber || '';
        }
    });

    careFormList.addEventListener('click', async (e) => {
        e.preventDefault();
        const link = e.target.closest('a.list-group-item');
        if (!link) return;
        const docId = link.dataset.id;
        try {
            const doc = await db.collection(careFormsCollection).doc(docId).get();
            if (doc.exists) {
                await guardUnsavedChanges(async () => { switchToFormView(false, doc.data(), doc.id); });
            }
        } catch (error) {
            alert(getText('load_care_form_failed'));
        }
    });

    saveCareFormBtn.addEventListener('click', handleSave);


// --- Dirty tracking：任何欄位變更都標記 ---
if (formView) {
    formView.addEventListener('input', () => { markDirty(); }, true);
    formView.addEventListener('change', () => { markDirty(); }, true);
}

// 視窗關閉/重整提示（瀏覽器原生提示）
window.addEventListener('beforeunload', (e) => {
    if (!formView || formView.classList.contains('d-none')) return;
    markDirty();
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
    // 若照服員簽名欄位被設為唯讀，但其實尚未簽名（沒有時間戳），允許再次輸入
    careTableBody.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.classList && target.classList.contains('signature-field')) {
            if (!isNurse) {
                const v = (target.value || '').trim();
                // 未簽名（空白或沒有時間戳）就允許輸入
                if (!v || !v.includes(' @ ')) {
                    target.readOnly = false;
                }
            }
        }
    }, true);

    careTableBody.addEventListener('blur', (e) => {
        const target = e.target;
        if (target.classList.contains('signature-field')) {
            const nameOnly = target.value.split('@')[0].trim();
            if (nameOnly) {
                const now = new Date();
                const dateString = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
                const timeString = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
                target.value = `${nameOnly} ${dateString} @ ${timeString}`;

                // 🔒 簽名後鎖定：避免照服員修改簽名時間（護理師不受限）
                if (!isNurse) {
                    target.readOnly = true;
                }
} else {
                target.value = '';
            }
        }
    }, true);

    deleteCareFormBtn.addEventListener('click', async () => {
        if (!currentCareFormId) return;
        if (confirm(getText('confirm_delete_care_form'))) {
            deleteCareFormBtn.disabled = true;
            try {
                await db.collection(careFormsCollection).doc(currentCareFormId).delete();
                alert(getText('care_form_deleted'));
                switchToListView();
            } catch (error) {
                console.error("刪除失敗:", error);
                alert(getText('delete_failed'));
            } finally {
                deleteCareFormBtn.disabled = false;
            }
        }
    });

    exportWordBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${residentNameSelectForm.value}-${placementDateInput.value}-導尿管照護單.doc`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${residentNameSelectForm.value}-${placementDateInput.value}-導尿管照護單.xls`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    printReportBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });

    // --- 初始操作 ---
    async function initializePage() {
        const sess = loadSessionUser();
        const roleInfo = computeRoleFromSession(sess);
        isNurse = roleInfo.isNurse;
        currentUserDisplay = roleInfo.display || '';
        // 若未登入，先鎖住所有操作（仍可看列表）
        if (!currentUserDisplay) {
            console.warn('[foley-care] no session user');
        }

        await loadResidentsDropdowns();
        await loadCareFormList();
        updateRoleUI();
        const filterRow = document.getElementById('closed-date-filter');
        if (filterRow) {
            if (currentView === 'closed') {
                filterRow.classList.remove('d-none');
            } else {
                filterRow.classList.add('d-none');
            }
        }

        // 護理師身分：若建立護理師尚未有值，先帶入目前登入者
        if (isNurse && createdByInput && !createdByInput.value) {
            createdByInput.value = currentUserDisplay;
        }
        updateFormPermissions();
        checkTimePermissions();
        setInterval(checkTimePermissions, 30 * 1000);
    }

    initializePage();
});
