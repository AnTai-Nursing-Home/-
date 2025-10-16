document.addEventListener('firebase-ready', () => {
    // **** 關鍵修正：確保只在 foley-care.html 頁面執行 ****
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) return;

    // --- 元件宣告 ---
    const listView = document.getElementById('list-view');
    const formView = document.getElementById('form-view');
    const residentFilterSelect = document.getElementById('resident-filter-select');
    const residentNameSelectForm = document.getElementById('resident-name-select-form'); // **** 修正：取得正確的 ID ****
    const statusBtnGroup = document.querySelector('.btn-group');
    const careFormListTitle = document.getElementById('care-form-list-title');
    const careFormList = document.getElementById('care-form-list');
    const addNewFormBtn = document.getElementById('add-new-form-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const bedNumberInput = document.getElementById('resident-bedNumber');
    const genderInput = document.getElementById('resident-gender');
    const birthdayInput = document.getElementById('resident-birthday');
    const checkinDateInput = document.getElementById('resident-checkinDate');
    // ... (其他元件宣告) ...

    // --- 變數 ---
    let residentsData = {};
    let currentView = 'ongoing';
    
    // --- 函式 ---
    async function loadResidentsDropdowns() {
        const dropdowns = [residentFilterSelect, residentNameSelectForm];
        dropdowns.forEach(dropdown => dropdown.innerHTML = `<option value="">${getText('loading')}</option>`);
        try {
            const snapshot = await db.collection('residents').orderBy('sortOrder').get();
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

    async function loadCareFormList() {
        // ... (內容不變) ...
    }
    
    function switchToFormView(isNew, docData = {}, docId = null) {
        // ... (切換畫面的邏輯不變) ...
        if (isNew) {
            const selectedResident = residentFilterSelect.value;
            if (!selectedResident) {
                alert(getText('please_select_resident_first'));
                return; // 如果沒選住民就點新增，則直接返回
            }
            // **** 關鍵修正：正確帶入資料 ****
            const residentData = residentsData[selectedResident];
            residentNameSelectForm.value = selectedResident;
            bedNumberInput.value = residentData.bedNumber;
            genderInput.value = residentData.gender;
            birthdayInput.value = residentData.birthday;
            checkinDateInput.value = residentData.checkinDate;
            residentNameSelectForm.disabled = true; // 新增時，姓名自動鎖定
        } else {
            // ... (編輯模式的邏輯不變) ...
            residentNameSelectForm.disabled = true;
        }
    }

    // --- 事件監聽器 ---
    residentFilterSelect.addEventListener('change', loadCareFormList);
    statusBtnGroup.addEventListener('click', (e) => { /* ... */ });
    addNewFormBtn.addEventListener('click', () => switchToFormView(true));
    backToListBtn.addEventListener('click', switchToListView);
    
    // ** 修正：監聽表單內的下拉選單 **
    residentNameSelectForm.addEventListener('change', () => {
        const residentData = residentsData[residentNameSelectForm.value];
        if(residentData){
            bedNumberInput.value = residentData.bedNumber;
            genderInput.value = residentData.gender;
            birthdayInput.value = residentData.birthday;
            checkinDateInput.value = residentData.checkinDate;
        }
    });
    
    // ... (其他所有事件監聽器不變) ...
    
    // --- 初始操作 ---
    async function initializePage() {
        await loadResidentsDropdowns();
        await loadCareFormList();
        setInterval(checkTimePermissions, 30 * 1000);
    }
    
    initializePage();
});
