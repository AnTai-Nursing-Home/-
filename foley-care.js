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
    const tableMonthTitle = document.getElementById('table-month-title');
    const saveCareFormBtn = document.getElementById('save-care-form');
    const deleteCareFormBtn = document.getElementById('delete-care-form-btn');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    
    // --- 變數 ---
    const careItems = ['handHygiene', 'fixedPosition', 'unobstructedDrainage', 'avoidOverfill', 'urethralCleaning', 'singleUseContainer'];
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
        const startDate = new Date(placementDate + 'T00:00:00');
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
            const nurseSign = dailyRecord.nurseSign || '';
            const row = `<tr data-date="${dateString}">
                <th>${month}/${day}</th>${itemCells}
                <td><input type="text" class="form-control form-control-sm signature-field" data-signature="caregiver" placeholder="${getText('signature')}" value="${caregiverSign}"></td>
                <td><input type="text" class="form-control form-control-sm signature-field" data-signature="nurse" placeholder="${getText('signature')}" value="${nurseSign}"></td>
            </tr>`;
            careTableBody.innerHTML += row;
        }
        checkTimePermissions();
    }

    function checkTimePermissions() {
        const caregiverEnabled = true;
        const nurseEnabled = true;
        document.querySelectorAll('#form-view .form-check-input, #form-view [data-signature="caregiver"]').forEach(el => el.disabled = !caregiverEnabled);
        document.querySelectorAll('#form-view [data-signature="nurse"]').forEach(el => el.disabled = !nurseEnabled);
    }

    function generateReportHTML() {
        const residentName = residentNameSelectForm.value;
        const residentData = residentsData[residentName];
        let tableContent = `<table style="width:100%; border-collapse: collapse; font-size: 9pt;">
        <thead>
        <tr style="text-align: center; font-weight: bold; background-color: #f2f2f2;">
        <th rowspan="2" style="border: 1px solid black;">${getText('date')}</th>
        <th colspan="6" style="border: 1px solid black;">${getText('assessment_items')}</th>
        <th colspan="2" style="border: 1px solid black;">${getText('signature')}</th></tr>
        <tr style="text-align:center;font-weight:bold;background-color:#f2f2f2;">
        <th>${getText('hand_hygiene')}</th><th>${getText('fixed_position')}</th><th>${getText('unobstructed_drainage')}</th>
        <th>${getText('avoid_overfill')}</th><th>${getText('urethral_cleaning')}</th><th>${getText('single_use_container')}</th>
        <th>${getText('caregiver')}</th><th>${getText('nurse')}</th></tr></thead><tbody>`;

        careTableBody.querySelectorAll('tr').forEach(row => {
            const date = row.querySelector('th').textContent;
            let rowContent = `<tr><td style="border:1px solid black;">${date}</td>`;
            row.querySelectorAll('td').forEach((cell, index) => {
                let cellValue = '';
                if (index < careItems.length) {
                    const checkedRadio = cell.querySelector('input:checked');
                    cellValue = checkedRadio ? checkedRadio.value : '';
                } else {
                    cellValue = (cell.querySelector('input').value || '').split('@')[0].trim();
                }
                rowContent += `<td style="border:1px solid black;">${cellValue}</td>`;
            });
            rowContent += '</tr>';
            tableContent += rowContent;
        });

        tableContent += '</tbody></table>';
        const headerContent = `<div style="text-align: center;"><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${getText('foley_care_title')}</h2></div>`;
        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${getText('foley_care_assessment')}</title></head><body>${headerContent}${tableContent}</body></html>`;
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
            placementDateInput.value = docData.placementDate;
            closingDateInput.value = docData.closingDate || '';
            renderCareTable(docData.placementDate, docData.closingDate, docData.dailyData);
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
            const nurseSignInput = row.querySelector('[data-signature="nurse"]');
            if (caregiverSignInput.value) { record.caregiverSign = caregiverSignInput.value; hasData = true; }
            if (nurseSignInput.value) { record.nurseSign = nurseSignInput.value; hasData = true; }
            if (hasData) { dailyData[date] = record; }
        });
        const dataToSave = {
            residentName,
            month: placementDate.substring(0, 7),
            placementDate,
            closingDate: closingDateInput.value || null,
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
        if(residentData){
            bedNumberInput.value = residentData.bedNumber;
            genderInput.value = residentData.gender;
            birthdayInput.value = residentData.birthday;
            checkinDateInput.value = residentData.checkinDate;
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
