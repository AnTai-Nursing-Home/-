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
    const careFormListTitle = document.getElementById('care-form-list-title');
    const careFormList = document.getElementById('care-form-list');
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
    
    // --- 變數 ---
    const careItems = ['handHygiene', 'fixedPosition', 'urineBagPosition', 'unobstructedDrainage', 'avoidOverfill', 'urethralCleaning', 'singleUseContainer'];
    const residentsCollection = 'residents';
    const careFormsCollection = 'foley_care_records';
    let currentCareFormId = null;
    let residentsData = {};
    let currentView = 'ongoing';

    // --- 函式定義 ---
    async function loadResidentsDropdowns() {
        const dropdowns = [residentFilterSelect, residentNameSelectForm];
        dropdowns.forEach(dropdown => dropdown.innerHTML = `<option value="">${getText('loading')}</option>`);
        try {
            const snapshot = await db.collection(residentsCollection).orderBy('bedNumber').get();
            let filterOptionsHTML = `<option value="" selected>${getText('all_residents')}</option>`;
            let formOptionsHTML = `<option value="" selected disabled>${getText('please_select_resident')}</option>`;
            
            snapshot.forEach(doc => {
                residentsData[doc.id] = doc.data();
                const option = `<option value="${doc.id}">${doc.id} (${doc.data().bedNumber})</option>`;
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

            let listHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const status = data.closingDate
                    ? `<span class="badge bg-secondary">${getText('status_closed')}</span>`
                    : `<span class="badge bg-success">${getText('status_ongoing')}</span>`;

                listHTML += `
                    <a href="#" class="list-group-item list-group-item-action" data-id="${doc.id}">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${data.residentName} (${residentsData[data.residentName]?.bedNumber || 'N/A'})</h5>
                            <small>${status}</small>
                        </div>
                        <p class="mb-1">${getText('placement_date')}: ${data.placementDate}</p>
                    </a>`;
            });
            careFormList.innerHTML = listHTML;

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
        // 預設從置放日+1 天開始
        let startDate = new Date(placementDate + 'T00:00:00');
        // 若有填寫「開始紀錄日期」，以該日期為主（例如住民回機構當天）
        if (recordStartDateInput && recordStartDateInput.value) {
            startDate = new Date(recordStartDateInput.value + 'T00:00:00');
        } else {
            startDate.setDate(startDate.getDate() + 1);
        }
        const endDate = closingDate ? new Date(closingDate + 'T00:00:00') : new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0);

        tableMonthTitle.textContent = `${getText('care_period')}: ${placementDate} ~ ${closingDate || getText('ongoing')}`;
        careTableBody.innerHTML = '';

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
            const row = `<tr data-date="${dateString}">
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

    // 🕒 時間範圍設定：僅控制照顧員填寫及簽名時間（10:00~14:30）
    const caregiverEnabled = (currentTime >= 10 && currentTime < 14.5);

    // 🧤 照顧員：radio + 簽名
    document.querySelectorAll('#form-view .form-check-input, #form-view [data-signature="caregiver"]').forEach(el => {
        el.disabled = !caregiverEnabled;
    });

    // 一鍵全Yes按鈕也跟著照顧員時間規則
    careTableBody.querySelectorAll('.fill-yes-btn').forEach(btn => { btn.disabled = !caregiverEnabled; });

    // 🕓 除錯訊息（可刪除）
    console.log(`目前時間：${now.toLocaleTimeString('zh-TW')} | 照顧員填寫:${caregiverEnabled}`);
}
    
    
    function generateReportHTML() {
        const residentName = residentNameSelectForm.value;
        const residentData = residentsData[residentName] || {};
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
            <td style="border:1px solid #000; padding:6px;"><b>${getText('name')}</b>：${residentName || ''}</td>
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
            renderCareTable(placementDateInput.value, null);
            deleteCareFormBtn.classList.add('d-none');
        } else {
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

    // --- 事件監聽器 ---
    residentFilterSelect.addEventListener('change', loadCareFormList);

    statusBtnGroup.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            statusBtnGroup.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentView = e.target.dataset.status;
            loadCareFormList();
        }
    });

    addNewFormBtn.addEventListener('click', () => switchToFormView(true));
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
        setInterval(checkTimePermissions, 30 * 1000);
    }

    initializePage();
});
