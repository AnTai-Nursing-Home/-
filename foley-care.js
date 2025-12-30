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
    const nurseLoginBtn = document.getElementById('nurse-login-btn');
    const nurseLoginStatus = document.getElementById('nurse-login-status');
    const nurseLoginLabel = document.getElementById('nurse-login-label');
    
    // --- 變數 ---
    const careItems = ['handHygiene', 'fixedPosition', 'urineBagPosition', 'unobstructedDrainage', 'avoidOverfill', 'urethralCleaning', 'singleUseContainer'];
    const residentsCollection = 'residents';
    const careFormsCollection = 'foley_care_records';
    const nursesCollection = 'nurses';
    let nursesList = [];
    const nurseNameSelect = document.getElementById('nurse-name-select');
    const nurseNameConfirmBtn = document.getElementById('nurse-name-confirm-btn');
    const nurseNameError = document.getElementById('nurse-name-error');
    let nurseNameModal = null;

    function buildNurseDisplay(nurseId, data) {
        const name = data.name || '';
        return `${nurseId} ${name}`.trim();
    }

    async function loadNursesList() {
        if (!db) return;
        try {
            const snapshot = await db.collection(nursesCollection).orderBy('id').get();
            nursesList = [];
            let options = '<option value="">請選擇</option>';
            snapshot.forEach(doc => {
                const data = doc.data();
                const display = buildNurseDisplay(doc.id, data);
                nursesList.push({ id: doc.id, name: data.name || '', display });
                options += `<option value="${display}">${display}</option>`;
            });
            if (nurseNameSelect) {
                nurseNameSelect.innerHTML = options;
            }
        } catch (err) {
            console.error('讀取護理師名單失敗：', err);
            if (nurseNameSelect) {
                nurseNameSelect.innerHTML = '<option value="">讀取護理師名單失敗</option>';
            }
        }
    }

    let currentCareFormId = null;
    let isCurrentFormClosed = false;
    let residentsData = {};

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
    let isNurseLoggedIn = false;
    let currentNurseName = '';


    function updateNurseUI() {
        if (!nurseLoginBtn) return;
        if (isNurseLoggedIn) {
            if (nurseLoginLabel) nurseLoginLabel.textContent = '護理師登出';
            if (nurseLoginStatus) {
                nurseLoginStatus.textContent = currentNurseName ? `已登入：${currentNurseName}` : '已登入';
                nurseLoginStatus.classList.remove('text-danger');
                nurseLoginStatus.classList.add('text-success');
            }
            nurseLoginBtn.classList.remove('btn-outline-danger');
            nurseLoginBtn.classList.add('btn-outline-secondary');
        } else {
            if (nurseLoginLabel) nurseLoginLabel.textContent = '護理師登入';
            if (nurseLoginStatus) {
                nurseLoginStatus.textContent = '';
                nurseLoginStatus.classList.remove('text-success');
                nurseLoginStatus.classList.add('text-danger');
            }
            nurseLoginBtn.classList.add('btn-outline-danger');
            nurseLoginBtn.classList.remove('btn-outline-secondary');
        }
        if (batchDeleteBtn) {
            if (currentView === 'closed') {
                batchDeleteBtn.classList.remove('d-none');
            } else {
                batchDeleteBtn.classList.add('d-none');
            }
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
                el.disabled = !isNurseLoggedIn;
            }
        });

        // 新增與刪除照護單：僅護理師可操作
        if (addNewFormBtn) {
            addNewFormBtn.disabled = !isNurseLoggedIn;
            addNewFormBtn.classList.toggle('disabled', !isNurseLoggedIn);
        }
        if (deleteCareFormBtn) {
            deleteCareFormBtn.disabled = !isNurseLoggedIn;
        }
    }

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

            // 解析床號（例如 "302-2" -> 302），若無法解析則排到最後
            const bedNum = (residentName) => {
                const b = residentsData[residentName]?.bedNumber || '';
                const firstPart = String(b).split('-')[0];
                const n = parseInt(firstPart, 10);
                return Number.isFinite(n) ? n : 999999;
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

            filteredDocs.sort((a, b) => bedNum(a.data.residentName) - bedNum(b.data.residentName));


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
    }

    
function checkTimePermissions() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    // 今日字串，用來和每列 data-date 比較（YYYY-MM-DD）
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 🕒 時間範圍：
    // 一般：照服員 08:00~22:00 可以操作；護理師登入不受時間限制
    // 已結案單：僅護理師登入才可操作，照服員一律鎖定
    let caregiverEnabled;

    if (isCurrentFormClosed) {
        caregiverEnabled = isNurseLoggedIn;
    } else {
        caregiverEnabled = (currentTime >= 8 && currentTime < 22) || isNurseLoggedIn;
    }

    // radio + 簽名欄位
    document.querySelectorAll('#form-view .form-check-input, #form-view [data-signature="caregiver"]').forEach(el => {
        const row = el.closest('tr[data-date]');
        let isFuture = false;
        if (row && row.dataset.date) {
            // 日期格式都是 YYYY-MM-DD，可以直接字串比較
            isFuture = row.dataset.date > todayStr;
        }

        if (isFuture) {
            // 今天以後（未來的日期）一律鎖定，不可操作
            el.disabled = true;
        } else {
            // 今天與今天以前依照原本的時間/護理師登入規則
            el.disabled = !caregiverEnabled;
        }
    });

    // 一鍵全Yes按鈕
    careTableBody.querySelectorAll('.fill-yes-btn').forEach(btn => {
        const dateStr = btn.getAttribute('data-date');
        const isFuture = dateStr && dateStr > todayStr;
        // 未來日期永遠不可按；今天/以前依時間與登入狀態決定
        btn.disabled = !caregiverEnabled || !!isFuture;
    });

    console.log(`目前時間：${now.toLocaleTimeString('zh-TW')} | 已結案:${isCurrentFormClosed} | 可填寫:${caregiverEnabled}`);
}
 bedNumberInput.value || residentData.bedNumber || '';
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
                createdByInput.value = isNurseLoggedIn ? currentNurseName : '';
            }
            renderCareTable(placementDateInput.value, null);
            deleteCareFormBtn.classList.add('d-none');
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
            renderCareTable(docData.placementDate, docData.closingDate, docData.dailyData || {});
            deleteCareFormBtn.classList.remove('d-none');
        }
    }

    async function handleSave() {
        const residentName = residentNameSelectForm.value;
        const placementDate = placementDateInput.value;
        if (!residentName || !placementDate) {
            alert(getText('fill_form_first'));
            return;
        }
        const dailyData = {};
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
        const dataToSave = {
            residentName,
            month: placementDate.substring(0, 7),
            placementDate,
            recordStartDate: recordStartDateInput.value || '',
            closingDate: closingDateInput.value || null,
            closingReason: closingReasonSelect.value || '',
            chartNumber: chartNumberInput.value || '',
            createdByNurse: createdByInput ? (createdByInput.value || '') : '',
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
            alert(getText('care_form_saved'));
        } catch (error) {
            console.error("儲存失敗:", error);
            alert(getText('save_failed'));
        } finally {
            saveCareFormBtn.disabled = false;
        }
    }


    async function handleNurseLogin() {
        if (!nurseLoginBtn) return;

        // 登出
        if (isNurseLoggedIn) {
            if (confirm('確定要登出護理師嗎？')) {
                isNurseLoggedIn = false;
                currentNurseName = '';
                if (createdByInput) {
                    createdByInput.value = '';
                }
                updateNurseUI();
        const filterRow = document.getElementById('closed-date-filter');
        if (filterRow) {
            if (currentView === 'closed') {
                filterRow.classList.remove('d-none');
            } else {
                filterRow.classList.add('d-none');
            }
        }

                updateFormPermissions();
                checkTimePermissions();
            }
            return;
        }

        const password = prompt('請輸入護理師密碼：');
        if (!password) return;

        nurseLoginBtn.disabled = true;
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                // 密碼正確，改用 Modal 方式選護理師姓名
                if (!nurseNameModal) {
                    const modalEl = document.getElementById('nurseNameModal');
                    if (modalEl && window.bootstrap) {
                        nurseNameModal = new bootstrap.Modal(modalEl);
                    }
                }
                if (nurseNameError) nurseNameError.classList.add('d-none');
                if (nurseNameSelect) nurseNameSelect.value = '';
                await loadNursesList();
                if (nurseNameModal) {
                    nurseNameModal.show();
                } else {
                    alert('登入成功，但護理師選擇視窗初始化失敗');
                }
            } else {
                alert('密碼錯誤，登入失敗');
            }
        } catch (error) {
            console.error('護理師登入時發生錯誤:', error);
            alert('登入時發生錯誤，請稍後再試。');
        } finally {
            nurseLoginBtn.disabled = false;
        }
    }

    // --- 事件監聽器 ---

    if (nurseNameConfirmBtn) {
        nurseNameConfirmBtn.addEventListener('click', () => {
            if (!nurseNameSelect) return;
            const value = nurseNameSelect.value.trim();
            if (!value) {
                if (nurseNameError) nurseNameError.classList.remove('d-none');
                return;
            }
            isNurseLoggedIn = true;
            currentNurseName = value;
            if (createdByInput && !createdByInput.value) {
                createdByInput.value = value;
            }
            updateNurseUI();
        const filterRow = document.getElementById('closed-date-filter');
        if (filterRow) {
            if (currentView === 'closed') {
                filterRow.classList.remove('d-none');
            } else {
                filterRow.classList.add('d-none');
            }
        }

            updateFormPermissions();
            checkTimePermissions();
            if (nurseNameModal) nurseNameModal.hide();
            alert('護理師登入成功');
        });
    }



    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            if (!isNurseLoggedIn) {
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
        addNewFormBtn.addEventListener('click', () => {
            if (!isNurseLoggedIn) {
                alert('僅限護理師登入後才能新增導尿管照護單');
                return;
            }
            switchToFormView(true);
        });
    }

    if (nurseLoginBtn) {
        nurseLoginBtn.addEventListener('click', handleNurseLogin);
    }
    backToListBtn.addEventListener('click', switchToListView);

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
                switchToFormView(false, doc.data(), doc.id);
            }
        } catch (error) {
            alert(getText('load_care_form_failed'));
        }
    });

    saveCareFormBtn.addEventListener('click', handleSave);

    careTableBody.addEventListener('blur', (e) => {
        const target = e.target;
        if (target.classList.contains('signature-field')) {
            const nameOnly = target.value.split('@')[0].trim();
            if (nameOnly) {
                const now = new Date();
                const dateString = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
                const timeString = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
                target.value = `${nameOnly} ${dateString} @ ${timeString}`;
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
        await loadResidentsDropdowns();
        await loadCareFormList();
        await loadNursesList();
        const modalEl = document.getElementById('nurseNameModal');
        if (modalEl && window.bootstrap) {
            nurseNameModal = new bootstrap.Modal(modalEl);
        }
        updateNurseUI();
        const filterRow = document.getElementById('closed-date-filter');
        if (filterRow) {
            if (currentView === 'closed') {
                filterRow.classList.remove('d-none');
            } else {
                filterRow.classList.add('d-none');
            }
        }

        updateFormPermissions();
        checkTimePermissions();
        setInterval(checkTimePermissions, 30 * 1000);
    }

    initializePage();
});
