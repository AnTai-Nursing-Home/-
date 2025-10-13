document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 supplies.html 存在的獨特元件，來判斷我們是否在盤點頁面
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) {
        return; // 如果找不到表格主體，代表不在盤點頁，直接結束，避免在其他頁面出錯
    }

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral) {
        if (document.referrer.includes('admin.html')) {
            backButtonGeneral.href = 'admin.html?view=dashboard';
            const icon = backButtonGeneral.querySelector('i');
            backButtonGeneral.innerHTML = '';
            backButtonGeneral.appendChild(icon);
            backButtonGeneral.append(' 返回儀表板');
        }
    }
    
    // ===============================================================
    // ==== 衛材項目資料 ====
    // ===============================================================
    const inventoryData = [ { category: '一、管路相關', items: [ { name: '14FR尿管', threshold: '＜5枝=缺' }, { name: '16FR尿管', threshold: '＜5枝=缺' }, { name: '18FR尿管', threshold: '＜5枝=缺' }, { name: '20FR尿管', threshold: '＜5枝=缺' }, { name: '12FR抽痰管', threshold: '＜3袋=缺' }, { name: '14FR抽痰管', threshold: '＜3袋=缺' }, { name: '18FR鼻胃管', threshold: '＜5條=缺' }, { name: '尿袋', threshold: '＜5個=缺' }, { name: '氧氣鼻導管', threshold: '＜10個=缺' }, { name: '氣切面罩', threshold: '＜10個=缺' }, { name: '氧氣面罩', threshold: '＜10個=缺' }, { name: 'AMBU', threshold: '＜2顆=缺' }, ] }, { category: '二、注射與輸液', items: [ { name: '頭皮針(23G)', threshold: '＜1盒=缺' }, { name: '3CC空針', threshold: '＜10枝=缺' }, { name: '5CC空針', threshold: '＜10枝=缺' }, { name: '10CC空針', threshold: '＜10枝=缺' }, { name: '20CC空針', threshold: '＜10枝=缺' }, { name: '灌食空針', threshold: '＜10枝=缺' }, { name: '灌食奶袋', threshold: '＜20袋=缺' }, { name: '注射用水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(500ML)', threshold: '＜3瓶=缺' }, ] }, { category: '三、清潔與消毒', items: [ { name: '消毒錠', threshold: '＜1盒=缺' }, { name: '酒精棉片', threshold: '＜1盒=缺' }, { name: '生理沖洗瓶', threshold: '＜10瓶=缺' }, { name: '沖洗棉棒', threshold: '＜2大袋=缺' }, { name: '普通棉棒', threshold: '＜2大袋=缺' }, { name: '口腔棉棒', threshold: '＜2大袋=缺' }, { name: '2*2紗布', threshold: '＜10包=缺' }, { name: '3*3紗布', threshold: '＜10包=缺' }, { name: '4*4紗布', threshold: '＜10包=缺' }, { name: '平紗', threshold: '＜5包=缺' }, ] }, { category: '四、輔助耗材', items: [ { name: 'Jelly(潤滑液)', threshold: '＜3瓶=缺' }, { name: '3M膠布', threshold: '＜1盒=缺' }, { name: '血糖試紙', threshold: '＜1大箱=缺' }, ] } ];
    const tableBody = inventoryTableBody;
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
    const collectionName = 'supplies_inventory';

    async function loadAndRenderDataForDate(date) { /* ... */ }
    async function saveTodaysData() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('錯誤：請選擇盤點日期！'); return; }
        nurseInput.classList.remove('is-invalid');
        if (!nurseInput.value.trim()) {
            alert('錯誤：請填寫「盤點者」姓名！');
            nurseInput.classList.add('is-invalid'); return;
        }
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
        if (!allItemsValid) {
            alert('錯誤：請完成所有「盤點者」欄位的盤點（不可為 "-"）。');
            return;
        }
        const dataToSave = {
            header: { date: selectedDate, nurse: nurseInput.value, restocker: restockerInput.value, timestamp: firebase.firestore.FieldValue.serverTimestamp() },
            items: newItemsStatus
        };
        try {
            saveButton.disabled = true;
            await db.collection(collectionName).doc(selectedDate).set(dataToSave);
            alert(`日期 ${selectedDate} 的盤點紀錄已成功儲存！`);
            loadAndRenderDataForDate(selectedDate);
        } catch (error) {
            console.error("儲存失敗:", error);
            alert("儲存失敗，請稍後再試。");
        } finally {
            saveButton.disabled = false;
        }
    }
    
    function generateExportHTML(isSingleDay = true) { /* ... */ }

    async function generateReport() { /* ... */ }
    
    dateInput.addEventListener('change', function() { loadAndRenderDataForDate(this.value); });
    saveButton.addEventListener('click', saveTodaysData);
    resetButton.addEventListener('click', async function() { /* ... */ });
    nurseInput.addEventListener('input', function() { if (nurseInput.classList.contains('is-invalid')) nurseInput.classList.remove('is-invalid'); });
    printButton.addEventListener('click', function() {
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
