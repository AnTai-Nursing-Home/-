document.addEventListener('DOMContentLoaded', function () {
    // ... (衛材項目定義不變) ...
    const inventoryData = [ /* ... 內容省略 ... */ ];

    const tableBody = document.getElementById('inventory-table-body');
    const resetButton = document.getElementById('reset-button');
    const saveButton = document.getElementById('save-button');
    const dateInput = document.getElementById('inventory-date');
    const nurseInput = document.getElementById('inventory-nurse');
    const restockerInput = document.getElementById('inventory-restocker');
    
    const itemsStorageKey = 'inventoryStatus';
    const headerStorageKey = 'inventoryHeader';

    function renderTable() {
        // ... (渲染表格的邏輯不變，但不再監聽 change 事件) ...
    }

    // 儲存所有資料到 LocalStorage
    function saveAllData() {
        let allValid = true;
        const newStatus = {};
        
        // 移除所有舊的錯誤提示樣式
        tableBody.querySelectorAll('tr.table-row-invalid').forEach(row => {
            row.classList.remove('table-row-invalid');
        });

        inventoryData.forEach(categoryData => {
            categoryData.items.forEach(item => {
                const row = tableBody.querySelector(`tr[data-item-name="${item.name}"]`);
                if (!row) return;

                const statusSelect = row.querySelector('select[data-field="status"]');
                const restockerInput = row.querySelector('input[data-field="restocker"]');

                // 驗證護理師欄位是否已填
                if (statusSelect.value === '-') {
                    allValid = false;
                    row.classList.add('table-row-invalid'); // 標示錯誤的行
                }

                newStatus[item.name] = {
                    status: statusSelect.value,
                    restocker: restockerInput.value
                };
            });
        });

        if (!allValid) {
            alert('錯誤：請完成所有「護理師」欄位的盤點（不可為 \"-\"）。');
            return; // 中斷儲存
        }

        // 儲存表頭資料
        const headerData = {
            date: dateInput.value,
            nurse: nurseInput.value,
            restocker: restockerInput.value,
        };
        localStorage.setItem(headerStorageKey, JSON.stringify(headerData));

        // 儲存品項資料
        localStorage.setItem(itemsStorageKey, JSON.stringify(newStatus));

        alert('盤點紀錄已成功儲存！');
        
        // 為了讓行顏色即時更新，儲存後重新渲染一次
        renderTable();
    }
    
    // 頁面載入時，載入並設定表頭
    function loadHeaderData() {
        const savedHeader = JSON.parse(localStorage.getItem(headerStorageKey));
        if (savedHeader) {
            dateInput.value = savedHeader.date;
            nurseInput.value = savedHeader.nurse;
            restockerInput.value = savedHeader.restocker;
        } else {
            // 如果沒有儲存的資料，預設為今天
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    saveButton.addEventListener('click', saveAllData);

    resetButton.addEventListener('click', function() {
        if (confirm('您確定要清空本次所有盤點紀錄與簽名嗎？')) {
            localStorage.removeItem(itemsStorageKey);
            localStorage.removeItem(headerStorageKey);
            renderTable(); // 會自動載入空狀態
            loadHeaderData(); // 會自動設定回今天
            alert('所有紀錄已清空。');
        }
    });

    loadHeaderData();
    renderTable(); // 初始渲染
});
