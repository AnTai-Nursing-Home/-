document.addEventListener('firebase-ready', () => {
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) return;

    // --- 元件宣告 ---
    const residentNameSelect = document.getElementById('resident-name-select');
    const monthSelect = document.getElementById('month-select');
    const careFormListSection = document.getElementById('care-form-list-section');
    const careFormListTitle = document.getElementById('care-form-list-title');
    const careFormList = document.getElementById('care-form-list');
    const addNewFormBtn = document.getElementById('add-new-form-btn');
    const careFormSection = document.getElementById('care-form-section');
    const residentNameDisplay = document.getElementById('resident-name-display');
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

    // --- 函式定義 ---
    async function loadResidentsDropdown() {
        residentNameSelect.innerHTML = `<option value="">${getText('loading')}</option>`;
        try {
            const snapshot = await db.collection(residentsCollection).orderBy('bedNumber').get();
            let optionsHTML = `<option value="" selected disabled>${getText('please_select_resident')}</option>`;
            snapshot.forEach(doc => {
                residentsData[doc.id] = doc.data();
                optionsHTML += `<option value="${doc.id}">${doc.id} (${doc.data().bedNumber})</option>`;
            });
            residentNameSelect.innerHTML = optionsHTML;
        } catch (error) {
            console.error("讀取住民列表失敗:", error);
            residentNameSelect.innerHTML = `<option value="">${getText('read_failed')}</option>`;
        }
    }

    async function loadCareFormList() {
        const residentName = residentNameSelect.value;
        const month = monthSelect.value;
        if (!residentName || !month) {
            careFormListSection.classList.add('d-none');
            careFormSection.classList.add('d-none');
            return;
        }

        careFormListSection.classList.remove('d-none');
        careFormSection.classList.add('d-none');
        const [year, monthNum] = month.split('-');
        const lang = getLanguage();
        const title = lang === 'en'
            ? getText('care_form_list_for', { name: residentName, year: year, month: parseInt(monthNum, 10) })
            : getText('care_form_list_for', { name: residentName, year: year, month: parseInt(monthNum, 10) });
        careFormListTitle.textContent = title;
        
        careFormList.innerHTML = `<div class="list-group-item">${getText('loading')}</div>`;

        try {
            const snapshot = await db.collection(careFormsCollection)
                .where('residentName', '==', residentName)
                .where('month', '==', month)
                .orderBy('placementDate', 'desc')
                .get();

            if (snapshot.empty) {
                careFormList.innerHTML = `<p class="text-muted mt-2">${getText('no_records_for_month')}</p>`;
                return;
            }

            let listHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const status = data.closingDate ? `<span class="badge bg-secondary">${getText('status_closed')}</span>` : `<span class="badge bg-success">${getText('status_ongoing')}</span>`;
                listHTML += `<a href="#" class="list-group-item list-group-item-action" data-id="${doc.id}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h5 class="mb-1">${getText('placement_date')}: ${data.placementDate}</h5>
                                    <small>${status}</small>
                                </div>
                                <p class="mb-1">${getText('closing_date')}: ${data.closingDate || getText('not_set')}</p>
                             </a>`;
            });
            careFormList.innerHTML = listHTML;
        } catch (error) {
            console.error("讀取照護單列表失敗:", error);
            careFormList.innerHTML = `<div class="alert alert-danger">${getText('read_list_failed')}</div>`;
        }
    }

    function renderCareTable(careData = {}) {
        const month = monthSelect.value;
        const [year, monthNum] = month.split('-').map(Number);
        tableMonthTitle.textContent = `${year}年 ${monthNum}月`;
        careTableBody.innerHTML = '';
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateString = `${year}-${String(monthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dailyRecord = careData[dateString] || {};
            let itemCells = '';
            careItems.forEach(itemKey => {
                const value = dailyRecord[itemKey];
                itemCells += `<td>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="${itemKey}-${i}" value="Yes" ${value === 'Yes' ? 'checked' : ''}>
                                    <label class="form-check-label">${getText('yes')}</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="${itemKey}-${i}" value="No" ${value === 'No' ? 'checked' : ''}>
                                    <label class="form-check-label">${getText('no')}</label>
                                </div>
                            </td>`;
            });
            const caregiverSign = dailyRecord.caregiverSign || '';
            const nurseSign = dailyRecord.nurseSign || '';
            const row = `<tr data-date="${dateString}">
                            <th>${monthNum}/${i}</th>
                            ${itemCells}
                            <td><input type="text" class="form-control form-control-sm signature-field" data-signature="caregiver" placeholder="${getText('signature')}" value="${caregiverSign}"></td>
                            <td><input type="text" class="form-control form-control-sm signature-field" data-signature="nurse" placeholder="${getText('signature')}" value="${nurseSign}"></td>
                         </tr>`;
            careTableBody.innerHTML += row;
        }
        checkTimePermissions();
    }

    function checkTimePermissions() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour + currentMinute / 60;
        const caregiverEnabled = (currentTime >= 10 && currentTime < 14.5);
        const nurseEnabled = (currentTime >= 14.5 && currentTime < 16);
        document.querySelectorAll('.form-check-input, .signature-field[data-signature="caregiver"]').forEach(el => el.disabled = !caregiverEnabled);
        document.querySelectorAll('.signature-field[data-signature="nurse"]').forEach(el => el.disabled = !nurseEnabled);
    }
    
    function generateReportHTML() {
        // ... (This function is now more complex)
    }

    // --- 事件監聽器 ---
    residentNameSelect.addEventListener('change', loadCareFormList);
    monthSelect.addEventListener('change', loadCareFormList);

    addNewFormBtn.addEventListener('click', () => {
        currentCareFormId = null;
        deleteCareFormBtn.classList.add('d-none'); // 新增時隱藏刪除按鈕
        const residentName = residentNameSelect.value;
        const residentData = residentsData[residentName];
        if (!residentData) return;
        residentNameDisplay.value = residentName;
        bedNumberInput.value = residentData.bedNumber;
        genderInput.value = residentData.gender;
        birthdayInput.value = residentData.birthday;
        checkinDateInput.value = residentData.checkinDate;
        placementDateInput.value = new Date().toISOString().split('T')[0];
        closingDateInput.value = '';
        renderCareTable({});
        careFormSection.classList.remove('d-none');
        careFormListSection.classList.add('d-none');
    });

    careFormList.addEventListener('click', async (e) => {
        e.preventDefault();
        const link = e.target.closest('a.list-group-item');
        if (!link) return;
        const docId = link.dataset.id;
        currentCareFormId = docId;
        deleteCareFormBtn.classList.remove('d-none'); // 載入舊表單時顯示刪除按鈕
        try {
            const docRef = db.collection(careFormsCollection).doc(docId);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                const residentData = residentsData[data.residentName];
                residentNameDisplay.value = data.residentName;
                bedNumberInput.value = residentData.bedNumber;
                genderInput.value = residentData.gender;
                birthdayInput.value = residentData.birthday;
                checkinDateInput.value = residentData.checkinDate;
                placementDateInput.value = data.placementDate;
                closingDateInput.value = data.closingDate || '';
                renderCareTable(data.dailyData || {});
                careFormSection.classList.remove('d-none');
                careFormListSection.classList.add('d-none');
            }
        } catch (error) {
            console.error("載入照護單失敗:", error);
            alert(getText('load_care_form_failed'));
        }
    });

    saveCareFormBtn.addEventListener('click', async () => {
        const residentName = residentNameDisplay.value;
        const month = monthSelect.value;
        const placementDate = placementDateInput.value;
        if (!residentName || !month || !placementDate) {
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
                if (checkedRadio) {
                    record[itemKey] = checkedRadio.value;
                    hasData = true;
                }
            });
            const caregiverSignInput = row.querySelector('[data-signature="caregiver"]');
            const nurseSignInput = row.querySelector('[data-signature="nurse"]');
            if (caregiverSignInput.value) { record.caregiverSign = caregiverSignInput.value; hasData = true; }
            if (nurseSignInput.value) { record.nurseSign = nurseSignInput.value; hasData = true; }
            if (hasData) { dailyData[date] = record; }
        });
        const dataToSave = { residentName, month, placementDate, closingDate: closingDateInput.value || null, dailyData };
        saveCareFormBtn.disabled = true;
        try {
            if (currentCareFormId) {
                await db.collection(careFormsCollection).doc(currentCareFormId).set(dataToSave, { merge: true });
            } else {
                const docRef = await db.collection(careFormsCollection).add(dataToSave);
                currentCareFormId = docRef.id;
            }
            alert(getText('care_form_saved'));
            careFormSection.classList.add('d-none');
            loadCareFormList();
        } catch (error) {
            console.error("儲存失敗:", error);
            alert(getText('save_failed'));
        } finally {
            saveCareFormBtn.disabled = false;
        }
    });
    
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
                careFormSection.classList.add('d-none');
                loadCareFormList();
            } catch (error) {
                console.error("刪除失敗:", error);
                alert(getText('delete_failed'));
            } finally {
                deleteCareFormBtn.disabled = false;
            }
        }
    });
    
    // --- 初始操作 ---
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    monthSelect.value = `${currentYear}-${currentMonth}`;
    loadResidentsDropdown();
    setInterval(checkTimePermissions, 60 * 1000);
});
