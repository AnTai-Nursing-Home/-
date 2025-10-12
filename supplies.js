document.addEventListener('DOMContentLoaded', function () {
    // 透過尋找一個只在 supplies.html 存在的獨特元件，來判斷我們是否在盤點頁面
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) {
        // 如果找不到表格主體，代表不在盤點頁，直接結束，避免出錯
        return;
    }

    const inventoryData = [
        { category: '一、管路相關', items: [ { name: '14FR尿管', threshold: '＜5枝=缺' }, { name: '16FR尿管', threshold: '＜5枝=缺' }, { name: '18FR尿管', threshold: '＜5枝=缺' }, { name: '20FR尿管', threshold: '＜5枝=缺' }, { name: '12FR抽痰管', threshold: '＜3袋=缺' }, { name: '14FR抽痰管', threshold: '＜3袋=缺' }, { name: '18FR鼻胃管', threshold: '＜5條=缺' }, { name: '尿袋', threshold: '＜5個=缺' }, { name: '氧氣鼻導管', threshold: '＜10個=缺' }, { name: '氣切面罩', threshold: '＜10個=缺' }, { name: '氧氣面罩', threshold: '＜10個=缺' }, { name: 'AMBU', threshold: '＜2顆=缺' }, ] },
        { category: '二、注射與輸液', items: [ { name: '頭皮針(23G)', threshold: '＜1盒=缺' }, { name: '3CC空針', threshold: '＜10枝=缺' }, { name: '5CC空針', threshold: '＜10枝=缺' }, { name: '10CC空針', threshold: '＜10枝=缺' }, { name: '20CC空針', threshold: '＜10枝=缺' }, { name: '灌食空針', threshold: '＜10枝=缺' }, { name: '灌食奶袋', threshold: '＜20袋=缺' }, { name: '注射用水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(500ML)', threshold: '＜3瓶=缺' }, ] },
        { category: '三、清潔與消毒', items: [ { name: '消毒錠', threshold: '＜1盒=缺' }, { name: '酒精棉片', threshold: '＜1盒=缺' }, { name: '生理沖洗瓶', threshold: '＜10瓶=缺' }, { name: '沖洗棉棒', threshold: '＜2大袋=缺' }, { name: '普通棉棒', threshold: '＜2大袋=缺' }, { name: '口腔棉棒', threshold: '＜2大袋=缺' }, { name: '2*2紗布', threshold: '＜10包=缺' }, { name: '3*3紗布', threshold: '＜10包=缺' }, { name: '4*4紗布', threshold: '＜10包=缺' }, { name: '平紗', threshold: '＜5包=缺' }, ] },
        { category: '四、輔助耗材', items: [ { name: 'Jelly(潤滑液)', threshold: '＜3瓶=缺' }, { name: '3M膠布', threshold: '＜1盒=缺' }, { name: '血糖試紙', threshold: '＜1大箱=缺' }, ] }
    ];

    const tableBody = inventoryTableBody; // 已經在上方宣告
    const resetButton = document.getElementById('reset-button');
    const saveButton = document.getElementById('save-button');
    const dateInput = document.getElementById('inventory-date');
    const nurseInput = document.getElementById('inventory-nurse');
    const restockerInput = document.getElementById('inventory-restocker');
    const printButton = document.getElementById('print-button');
    const exportWordButton = document.getElementById('export-word-button');
    const exportExcelButton = document.getElementById('export-excel-button');
    const exportRangeBtn = document.getElementById('export-range-btn');
    const reportModalElement = document.getElementById('report-modal');
    const reportModal = new bootstrap.Modal(reportModalElement);
    const generateReportBtn = document.getElementById('generate-report-btn');
    
    const historyStorageKey = 'suppliesHistory';

    function loadAndRenderDataForDate(date) {
        const suppliesHistory = JSON.parse(localStorage.getItem(historyStorageKey)) || {};
        const dailyData = suppliesHistory[date] || {};
        
        nurseInput.value = dailyData.header?.nurse || '';
        restockerInput.value = dailyData.header?.restocker || '';
        
        const itemsStatus = dailyData.items || {};
        tableBody.innerHTML = '';
        inventoryData.forEach(categoryData => {
            const categoryRow = document.createElement('tr');
            categoryRow.innerHTML = `<td colspan="3" class="table-category">${categoryData.category}</td>`;
            tableBody.appendChild(categoryRow);
            categoryData.items.forEach(item => {
                const itemRow = document.createElement('tr');
                itemRow.dataset.itemName = item.name;
                const status = itemsStatus[item.name]?.status || '-';
                const restockStatus = itemsStatus[item.name]?.restockStatus || '-';
                if (status === '缺項') itemRow.classList.add('table-danger');
                else if (status === '無缺項') itemRow.classList.add('table-success');
                itemRow.innerHTML = `<td>${item.name}<div class="item-threshold">${item.threshold}</div></td><td><select class="form-select" data-field="status"><option value="-" ${status==='-'?'selected':''}>-</option><option value="缺項" ${status==='缺項'?'selected':''}>缺項</option><option value="無缺項" ${status==='無缺項'?'selected':''}>無缺項</option></select></td><td><select class="form-select" data-field="restockStatus"><option value="-" ${restockStatus==='-'?'selected':''}>-</option><option value="已補齊" ${restockStatus==='已補齊'?'selected':''}>已補齊</option><option value="缺貨" ${restockStatus==='缺貨'?'selected':''}>缺貨</option></select></td>`;
                tableBody.appendChild(itemRow);
            });
        });
    }

    function saveTodaysData() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('錯誤：請選擇盤點日期！'); return; }
        
        nurseInput.classList.remove('is-invalid');
        if (!nurseInput.value.trim()) { alert('錯誤：請填寫「盤點護理師」姓名！'); nurseInput.classList.add('is-invalid'); return; }
        
        let allItemsValid = true;
        const newItemsStatus = {};
        
        tableBody.querySelectorAll('tr.table-row-invalid').forEach(row => row.classList.remove('table-row-invalid'));
        inventoryData.forEach(categoryData => {
            categoryData.items.forEach(item => {
                const row = tableBody.querySelector(`tr[data-item-name="${item.name}"]`);
                if (!row) return;
                const statusSelect = row.querySelector('select[data-field="status"]');
                const restockSelect = row.querySelector('select[data-field="restockStatus"]');
                if (statusSelect.value === '-') { allItemsValid = false; row.classList.add('table-row-invalid'); }
                newItemsStatus[item.name] = { status: statusSelect.value, restockStatus: restockSelect.value };
            });
        });

        if (!allItemsValid) { alert('錯誤：請完成所有「護理師」欄位的盤點（不可為 "-"）。'); return; }

        const suppliesHistory = JSON.parse(localStorage.getItem(historyStorageKey)) || {};
        suppliesHistory[selectedDate] = { header: { date: selectedDate, nurse: nurseInput.value, restocker: restockerInput.value }, items: newItemsStatus };
        localStorage.setItem(historyStorageKey, JSON.stringify(suppliesHistory));
        alert(`日期 ${selectedDate} 的盤點紀錄已成功儲存！`);
        loadAndRenderDataForDate(selectedDate);
    }

    function generateExportHTML(isSingleDay = true) {
        let tableHTML = `<table><thead>...</thead><tbody>...</tbody></table>`; // Simplified
        let headerInfo = '';
        if(isSingleDay){
            headerInfo = `<p><strong>盤點日期:</strong> ${dateInput.value}</p>...`;
        }
        let content = `<html>...<body>...${headerInfo}${tableHTML}</body></html>`;
        return content;
    }

    function generateReport() {
        // ... (This function is now more complex)
    }
    
    dateInput.addEventListener('change', function() { loadAndRenderDataForDate(this.value); });
    saveButton.addEventListener('click', saveTodaysData);
    resetButton.addEventListener('click', function() { /* ... */ });
    nurseInput.addEventListener('input', function() { if (nurseInput.classList.contains('is-invalid')) nurseInput.classList.remove('is-invalid'); });
    printButton.addEventListener('click', () => {
        const content = generateExportHTML(true);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });
    exportWordButton.addEventListener('click', function() { /* ... */ });
    exportExcelButton.addEventListener('click', function() { /* ... */ });
    exportRangeBtn.addEventListener('click', () => reportModal.show());
    generateReportBtn.addEventListener('click', generateReport);

    const todayString = new Date().toISOString().split('T')[0];
    dateInput.value = todayString;
    loadAndRenderDataForDate(todayString);
});
