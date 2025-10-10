document.addEventListener('DOMContentLoaded', function () {
    const inventoryData = [
        { category: '一、管路相關', items: [ { name: '14FR尿管', threshold: '＜5枝=缺' }, { name: '16FR尿管', threshold: '＜5枝=缺' }, { name: '18FR尿管', threshold: '＜5枝=缺' }, { name: '20FR尿管', threshold: '＜5枝=缺' }, { name: '12FR抽痰管', threshold: '＜3袋=缺' }, { name: '14FR抽痰管', threshold: '＜3袋=缺' }, { name: '18FR鼻胃管', threshold: '＜5條=缺' }, { name: '尿袋', threshold: '＜5個=缺' }, { name: '氧氣鼻導管', threshold: '＜10個=缺' }, { name: '氣切面罩', threshold: '＜10個=缺' }, { name: '氧氣面罩', threshold: '＜10個=缺' }, { name: 'AMBU', threshold: '＜2顆=缺' }, ] },
        { category: '二、注射與輸液', items: [ { name: '頭皮針(23G)', threshold: '＜1盒=缺' }, { name: '3CC空針', threshold: '＜10枝=缺' }, { name: '5CC空針', threshold: '＜10枝=缺' }, { name: '10CC空針', threshold: '＜10枝=缺' }, { name: '20CC空針', threshold: '＜10枝=缺' }, { name: '灌食空針', threshold: '＜10枝=缺' }, { name: '灌食奶袋', threshold: '＜20袋=缺' }, { name: '注射用水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(500ML)', threshold: '＜3瓶=缺' }, ] },
        { category: '三、清潔與消毒', items: [ { name: '消毒錠', threshold: '＜1盒=缺' }, { name: '酒精棉片', threshold: '＜1盒=缺' }, { name: '生理沖洗瓶', threshold: '＜10瓶=缺' }, { name: '沖洗棉棒', threshold: '＜2大袋=缺' }, { name: '普通棉棒', threshold: '＜2大袋=缺' }, { name: '口腔棉棒', threshold: '＜2大袋=缺' }, { name: '2*2紗布', threshold: '＜10包=缺' }, { name: '3*3紗布', threshold: '＜10包=缺' }, { name: '4*4紗布', threshold: '＜10包=缺' }, { name: '平紗', threshold: '＜5包=缺' }, ] },
        { category: '四、輔助耗材', items: [ { name: 'Jelly(潤滑液)', threshold: '＜3瓶=缺' }, { name: '3M膠布', threshold: '＜1盒=缺' }, { name: '血糖試紙', threshold: '＜1大箱=缺' }, ] }
    ];

    const tableBody = document.getElementById('inventory-table-body');
    const resetButton = document.getElementById('reset-button');
    const saveButton = document.getElementById('save-button');
    const dateInput = document.getElementById('inventory-date');
    const nurseInput = document.getElementById('inventory-nurse');
    const restockerInput = document.getElementById('inventory-restocker');
    
    const itemsStorageKey = 'inventoryStatus';
    const headerStorageKey = 'inventoryHeader';

    function renderTable() {
        const inventoryStatus = JSON.parse(localStorage.getItem(itemsStorageKey)) || {};
        tableBody.innerHTML = '';
        inventoryData.forEach(categoryData => {
            const categoryRow = document.createElement('tr');
            categoryRow.innerHTML = `<td colspan="3" class="table-category">${categoryData.category}</td>`;
            tableBody.appendChild(categoryRow);

            categoryData.items.forEach(item => {
                const itemRow = document.createElement('tr');
                itemRow.dataset.itemName = item.name;

                const status = inventoryStatus[item.name]?.status || '-';
                const restockStatus = inventoryStatus[item.name]?.restockStatus || '-'; // 改為讀取 restockStatus

                if (status === '缺項') {
                    itemRow.classList.add('table-danger');
                } else if (status === '無缺項') {
                    itemRow.classList.add('table-success');
                }

                // **** 修改：將原本的 input 改為 select ****
                itemRow.innerHTML = `
                    <td>${item.name}<div class="item-threshold">${item.threshold}</div></td>
                    <td>
                        <select class="form-select" data-field="status">
                            <option value="-" ${status === '-' ? 'selected' : ''}>-</option>
                            <option value="缺項" ${status === '缺項' ? 'selected' : ''}>缺項</option>
                            <option value="無缺項" ${status === '無缺項' ? 'selected' : ''}>無缺項</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select" data-field="restockStatus">
                            <option value="-" ${restockStatus === '-' ? 'selected' : ''}>-</option>
                            <option value="已補齊" ${restockStatus === '已補齊' ? 'selected' : ''}>已補齊</option>
                        </select>
                    </td>
                `;
                tableBody.appendChild(itemRow);
            });
        });
    }

    function saveAllData() {
        let allValid = true;
        const newStatus = {};
        
        tableBody.querySelectorAll('tr.table-row-invalid').forEach(row => {
            row.classList.remove('table-row-invalid');
        });

        inventoryData.forEach(categoryData => {
            categoryData.items.forEach(item => {
                const row = tableBody.querySelector(`tr[data-item-name="${item.name}"]`);
                if (!row) return;

                const statusSelect = row.querySelector('select[data-field="status"]');
                const restockSelect = row.querySelector('select[data-field="restockStatus"]'); // 改為讀取下拉選單

                if (statusSelect.value === '-') {
                    allValid = false;
                    row.classList.add('table-row-invalid');
                }

                newStatus[item.name] = {
                    status: statusSelect.value,
                    restockStatus: restockSelect.value // 改為儲存 restockStatus
                };
            });
        });

        if (!allValid) {
            alert('錯誤：請完成所有「護理師」欄位的盤點（不可為 "-"）。');
            return;
        }

        const headerData = { date: dateInput.value, nurse: nurseInput.value, restocker: restockerInput.value };
        localStorage.setItem(headerStorageKey, JSON.stringify(headerData));
        localStorage.setItem(itemsStorageKey, JSON.stringify(newStatus));
        alert('盤點紀錄已成功儲存！');
        renderTable();
    }
    
    function loadHeaderData() {
        const savedHeader = JSON.parse(localStorage.getItem(headerStorageKey));
        if (savedHeader) {
            dateInput.value = savedHeader.date;
            nurseInput.value = savedHeader.nurse;
            restockerInput.value = savedHeader.restocker;
        } else {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    saveButton.addEventListener('click', saveAllData);

    resetButton.addEventListener('click', function() {
        if (confirm('您確定要清空本次所有盤點紀錄與簽名嗎？此操作將無法復原。')) {
            localStorage.removeItem(itemsStorageKey);
            localStorage.removeItem(headerStorageKey);
            // 清空後重新渲染
            renderTable(); 
            // 清空後重新載入表頭，會恢復預設值
            dateInput.value = '';
            nurseInput.value = '';
            restockerInput.value = '';
            loadHeaderData();
            alert('所有紀錄已清空。');
        }
    });

    loadHeaderData();
    renderTable();
});
