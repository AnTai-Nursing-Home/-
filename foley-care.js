document.addEventListener('firebase-ready', () => {
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) return;

    // --- 元件宣告 ---
    const residentNameSelect = document.getElementById('resident-name');
    const bedNumberInput = document.getElementById('resident-bedNumber');
    const genderInput = document.getElementById('resident-gender');
    const birthdayInput = document.getElementById('resident-birthday');
    const checkinDateInput = document.getElementById('resident-checkinDate');
    const tableMonthTitle = document.getElementById('table-month-title');
    
    const careItems = [
        'handHygiene', 'fixedPosition', 'unobstructedDrainage', 
        'avoidOverfill', 'urethralCleaning', 'singleUseContainer'
    ];

    // --- 函式定義 ---

    // **** 新增：從 Firebase 載入所有住民到下拉選單 ****
    async function loadResidentsDropdown() {
        residentNameSelect.innerHTML = '<option value="">讀取中...</option>';
        try {
            const snapshot = await db.collection('residents').orderBy('bedNumber').get();
            let optionsHTML = '<option value="" selected disabled>請選擇住民</option>';
            snapshot.forEach(doc => {
                optionsHTML += `<option value="${doc.id}">${doc.id} (${doc.data().bedNumber})</option>`;
            });
            residentNameSelect.innerHTML = optionsHTML;
        } catch (error) {
            console.error("讀取住民列表失敗:", error);
            residentNameSelect.innerHTML = '<option value="">讀取失敗</option>';
        }
    }

    // **** 新增：根據選擇的住民姓名，填入其餘資料 ****
    async function populateResidentInfo(residentName) {
        // 先清空欄位
        bedNumberInput.value = '';
        genderInput.value = '';
        birthdayInput.value = '';
        checkinDateInput.value = '';

        if (!residentName) return;

        try {
            const docRef = db.collection('residents').doc(residentName);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                bedNumberInput.value = data.bedNumber || '';
                genderInput.value = data.gender || '';
                birthdayInput.value = data.birthday || '';
                checkinDateInput.value = data.checkinDate || '';
            }
        } catch (error) {
            console.error("讀取住民詳細資料失敗:", error);
            alert('讀取住民資料時發生錯誤。');
        }
    }

    function renderMonthTable() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const year = nextMonth.getFullYear();
        const month = nextMonth.getMonth(); // 0-11

        tableMonthTitle.textContent = `${year}年 ${month + 1}月`;
        careTableBody.innerHTML = '';

        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            let itemCells = '';
            careItems.forEach(itemKey => {
                itemCells += `
                    <td>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="${itemKey}-${i}" value="Yes">
                            <label class="form-check-label">Yes</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="${itemKey}-${i}" value="No">
                            <label class="form-check-label">No</label>
                        </div>
                    </td>
                `;
            });

            const row = `
                <tr data-date="${dateString}">
                    <th>${month + 1}/${i}</th>
                    ${itemCells}
                    <td><input type="text" class="form-control form-control-sm signature-field" data-signature="caregiver" placeholder="簽名"></td>
                    <td><input type="text" class="form-control form-control-sm signature-field" data-signature="nurse" placeholder="簽名"></td>
                </tr>
            `;
            careTableBody.innerHTML += row;
        }
    }

    // --- 事件監聽器 ---

    // **** 新增：當使用者從下拉選單選擇住民時，觸發資料填入 ****
    residentNameSelect.addEventListener('change', (event) => {
        const selectedName = event.target.value;
        populateResidentInfo(selectedName);
    });

    // --- 初始操作 ---
    loadResidentsDropdown(); // 頁面載入時，自動去抓取住民列表
    renderMonthTable();
});
