document.addEventListener('firebase-ready', () => {
    const careTableBody = document.getElementById('care-table-body');
    if (!careTableBody) return;

    const residentNameSelect = document.getElementById('resident-name');
    const tableMonthTitle = document.getElementById('table-month-title');
    
    // 評估項目列表，方便後續使用
    const careItems = [
        'handHygiene', 'fixedPosition', 'unobstructedDrainage', 
        'avoidOverfill', 'urethralCleaning', 'singleUseContainer'
    ];

    // 動態產生下個月的日期列表
    function renderMonthTable() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const year = nextMonth.getFullYear();
        const month = nextMonth.getMonth(); // 0-11

        tableMonthTitle.textContent = `${year}年 ${month + 1}月`;
        careTableBody.innerHTML = '';

        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
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

    // 初始載入
    renderMonthTable();
});
