document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 foley-care.html 存在的獨特元件，來判斷我們是否在正確的頁面
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) {
        return; // 如果找不到，代表不在照護評估頁，直接結束
    }

    // --- 元件宣告 ---
    const listView = document.getElementById('list-view');
    const formView = document.getElementById('form-view');
    const residentNameSelect = document.getElementById('resident-name-select');
    const searchResidentInput = document.getElementById('search-resident-input');
    const statusBtnGroup = document.querySelector('.btn-group');
    const careFormListTitle = document.getElementById('care-form-list-title');
    const careFormList = document.getElementById('care-form-list');
    const addNewFormBtn = document.getElementById('add-new-form-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    
    const residentNameDisplay = document.getElementById('resident-name-display'); // This is now a select element, but we'll use its ID to target it
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
    let currentSearchTerm = '';

    // --- 函式定義 ---
    async function loadResidentsDropdown() {
        residentNameSelect.innerHTML = `<option value="">${getText('loading')}</option>`;
        try {
            const snapshot = await db.collection(residentsCollection).orderBy('sortOrder').get();
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
        careFormList.innerHTML = `<div class="list-group-item">${getText('loading')}</div>`;
        careFormListTitle.textContent = (currentView === 'ongoing') ? '進行中的照護單' : '已結案的照護單';

        try {
            let query = db.collection(careFormsCollection);
            query = (currentView === 'ongoing') 
                ? query.where('closingDate', '==', null) 
                : query.where('closingDate', '!=', null);

            const snapshot = await query.orderBy('placementDate', 'desc').get();
            let filteredDocs = snapshot.docs;

            if (currentSearchTerm) {
                filteredDocs = filteredDocs.filter(doc => doc.data().residentName.includes(currentSearchTerm));
            }

            if (filteredDocs.length === 0) {
                careFormList.innerHTML = `<p class="text-muted mt-2">找不到符合條件的照護單紀錄。</p>`;
                return;
            }

            let listHTML = '';
            filteredDocs.forEach(doc => {
                const data = doc.data();
                const status = data.closingDate ? `<span class="badge bg-secondary">已結案</span>` : `<span class="badge bg-success">進行中</span>`;
                listHTML += `<a href="#" class="list-group-item list-group-item-action" data-id="${doc.id}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h5 class="mb-1">${data.residentName} (${residentsData[data.residentName]?.bedNumber || 'N/A'})</h5>
                                    <small>${status}</small>
                                </div>
                                <p class="mb-1">置放日期: ${data.placementDate}</p>
                             </a>`;
            });
            careFormList.innerHTML = listHTML;
        } catch (error) {
            console.error("讀取照護單列表失敗:", error);
            if (error.code === 'failed-precondition') {
                careFormList.innerHTML = `<div class="alert alert-warning">系統正在建立新的資料庫索引以支援查詢，請等待幾分鐘後再試。</div>`;
            } else {
                careFormList.innerHTML = `<div class="alert alert-danger">讀取列表失敗。</div>`;
            }
        }
    }
    
    function renderCareTable(placementDate, closingDate, careData = {}) {
        const startDate = new Date(placementDate + 'T00:00:00');
        const endDate = closingDate ? new Date(closingDate + 'T00:00:00') : new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0);

        tableMonthTitle.textContent = `照護期間: ${placementDate} ~ ${closingDate || '持續中'}`;
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
                itemCells += `<td><div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="${itemKey}-${dateString}" value="Yes" ${value === 'Yes' ? 'checked' : ''}><label class="form-check-label">${getText('yes')}</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="${itemKey}-${dateString}" value="No" ${value === 'No' ? 'checked' : ''}><label class="form-check-label">${getText('no')}</label></div></td>`;
            });
            
            const caregiverSign = dailyRecord.caregiverSign || '';
            const nurseSign = dailyRecord.nurseSign || '';
            const row = `<tr data-date="${dateString}"><th>${month}/${day}</th>${itemCells}<td><input type="text" class="form-control form-control-sm signature-field" data-signature="caregiver" placeholder="${getText('signature')}" value="${caregiverSign}"></td><td><input type="text" class="form-control form-control-sm signature-field" data-signature="nurse" placeholder="${getText('signature')}" value="${nurseSign}"></td></tr>`;
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
        document.querySelectorAll('#form-view .form-check-input, #form-view .signature-field[data-signature="caregiver"]').forEach(el => el.disabled = !caregiverEnabled);
        document.querySelectorAll('#form-view .signature-field[data-signature="nurse"]').forEach(el => el.disabled = !nurseEnabled);
    }

    function generateReportHTML() {
        // ... (This function is now more complex)
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
        
        // Reset form state
        residentNameSelect.disabled = isNew ? false : true;
        
        if (isNew) {
            // ... (New form logic) ...
            deleteCareFormBtn.classList.add('d-none');
        } else {
            // ... (Edit form logic) ...
            deleteCareFormBtn.classList.remove('d-none');
        }
    }

    async function handleSave() {
        // ... (This function is now more complex)
    }

    // --- 事件監聽器 ---
    searchResidentInput.addEventListener('keyup', (e) => {
        currentSearchTerm = e.target.value.trim();
        loadCareFormList();
    });

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
            alert("載入照護單失敗！");
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

    // ... (Export and Print event listeners) ...

    // --- 初始操作 ---
    loadResidentsDropdown();
    loadCareFormList();
    setInterval(checkTimePermissions, 60 * 1000);
});
