document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 supplies.html 存在的獨特元件，來判斷我們是否在盤點頁面
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) {
        return; // 如果找不到表格主體，代表不在盤點頁，直接結束
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

    async function loadAndRenderDataForDate(date) { /* ... 內容不變 ... */ }
    async function saveTodaysData() { /* ... 內容不變 ... */ }

    // ==== 修改：產生格式化報表的共用函式 ====
    function generateExportHTML(isSingleDay = true) {
        let tableHTML = `<table style="width:100%; border-collapse: collapse;">
                            <thead style="background-color: #f2f2f2;">
                                <tr style="text-align: center;">
                                    <th style="width: 40%; border: 1px solid black; padding: 5px;">品項</th>
                                    <th style="width: 30%; border: 1px solid black; padding: 5px;">護理師</th>
                                    <th style="width: 30%; border: 1px solid black; padding: 5px;">補齊狀態</th>
                                </tr>
                            </thead>
                            <tbody>`;
        
        inventoryData.forEach(categoryData => {
            tableHTML += `<tr><td colspan="3" style="border: 1px solid black; padding: 5px; background-color: #e9ecef; font-weight: bold; text-align: center;">${categoryData.category}</td></tr>`;
            categoryData.items.forEach(item => {
                const originalRow = tableBody.querySelector(`tr[data-item-name="${item.name}"]`);
                if (originalRow) {
                    const statusValue = originalRow.querySelector('select[data-field="status"]').value;
                    const restockValue = originalRow.querySelector('select[data-field="restockStatus"]').value;
                    const statusStyle = (statusValue === '缺項') ? 'style="color: red; font-weight: bold;"' : '';
                    const restockStyle = (restockValue === '缺貨') ? 'style="color: red; font-weight: bold;"' : '';
                    tableHTML += `<tr>
                                    <td style="border: 1px solid black; padding: 5px;">${item.name}<div style="font-size: 0.8em; color: #666;">${item.threshold}</div></td>
                                    <td ${statusStyle} style="border: 1px solid black; padding: 5px; text-align: center;">${statusValue}</td>
                                    <td ${restockStyle} style="border: 1px solid black; padding: 5px; text-align: center;">${restockValue}</td>
                                  </tr>`;
                }
            });
        });
        tableHTML += '</tbody></table>';

        let headerInfo = '';
        if(isSingleDay){
            headerInfo = `
                <p><strong>盤點日期:</strong> ${dateInput.value}</p>
                <p><strong>盤點護理師:</strong> ${nurseInput.value}</p>
                <p><strong>補齊者:</strong> ${restockerInput.value}</p>
            `;
        }

        let content = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>衛材盤點表</title></head>
            <body>
                <div style="font-family: 'Microsoft JhengHei', sans-serif;">
                    <h1 style="text-align: center;">安泰醫療社團法人附設安泰護理之家</h1>
                    <h2 style="text-align: center;">衛材盤點表</h2>
                    ${headerInfo}
                    ${tableHTML}
                </div>
            </body>
            </html>
        `;
        return content;
    }

    // ==== 修改：產生區間報表的函式 ====
    async function generateReport() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        if (!startDate || !endDate) { alert('請選擇開始日期與結束日期。'); return; }
        try {
            const snapshot = await db.collection(collectionName)
                .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endDate)
                .get();
            const datesInRange = [];
            snapshot.forEach(doc => datesInRange.push(doc.id));
            datesInRange.sort();
            if (datesInRange.length === 0) { alert('您選擇的日期區間內沒有任何盤點紀錄。'); return; }
            
            let allDaysHTML = '';
            for (const date of datesInRange) {
                const doc = await db.collection(collectionName).doc(date).get();
                if (doc.exists) {
                    const dailyData = doc.data();
                    let dailyTable = '<table><thead>...</thead><tbody>';
                    inventoryData.forEach(category => {
                        dailyTable += `<tr><td colspan="3" class="table-category">${category.category}</td></tr>`;
                        category.items.forEach(item => {
                            const itemStatus = dailyData.items[item.name];
                            const nurseCheck = itemStatus?.status || '-';
                            const restockCheck = itemStatus?.restockStatus || '-';
                            const statusClass = nurseCheck === '缺項' ? 'class="status-missing"' : '';
                            const restockClass = restockCheck === '缺貨' ? 'class="status-outofstock"' : '';
                            dailyTable += `<tr><td>${item.name}<div class="item-threshold">${item.threshold}</div></td><td ${statusClass}>${nurseCheck}</td><td ${restockClass}>${restockCheck}</td></tr>`;
                        });
                    });
                    dailyTable += '</tbody></table>';

                    allDaysHTML += `<div class="daily-record">
                                      <h3>盤點日期：${date}</h3>
                                      <p><strong>盤點護理師：</strong>${dailyData.header.nurse||''} &nbsp;&nbsp;&nbsp; <strong>補齊者：</strong>${dailyData.header.restocker||''}</p>
                                      ${dailyTable}
                                  </div>`;
                }
            }

            let reportHTML = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>衛材盤點區間報表</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}.report-container{width:95%;margin:auto;}h1,h2,h3{text-align:center;}.daily-record{page-break-before:always;margin-top:2rem;}table,th,td{border:1px solid black;border-collapse:collapse;padding:5px;text-align:center;}th{background-color:#f2f2f2;}.table-category{background-color:#e9ecef;font-weight:bold;}.item-threshold{font-size:0.8em;color:#666;}.status-missing,.status-outofstock{color:red;font-weight:bold;}</style></head><body><div class="report-container"><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>衛材盤點區間報表 (${startDate} 至 ${endDate})</h2>${allDaysHTML}</div></body></html>`;

            reportModal.hide();
            const printWindow = window.open('', '_blank');
            printWindow.document.write(reportHTML);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); }, 500);
        } catch (error) {
            console.error("產生報表失敗:", error);
            alert("產生報表失敗，請稍後再試。");
        }
    }
    
    // --- 事件監聽器 ---
    dateInput.addEventListener('change', function() { loadAndRenderDataForDate(this.value); });
    saveButton.addEventListener('click', saveTodaysData);
    resetButton.addEventListener('click', async function() { /* ... 內容不變 ... */ });
    nurseInput.addEventListener('input', function() { if (nurseInput.classList.contains('is-invalid')) nurseInput.classList.remove('is-invalid'); });
    
    printButton.addEventListener('click', function() {
        const content = generateExportHTML(true);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });

    exportWordButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('請先選擇日期！'); return; }
        const content = generateExportHTML(true);
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a); a.style = "display: none"; a.href = url;
        a.download = `衛材盤點表-${selectedDate}.doc`; a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
    });

    exportExcelButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('請先選擇日期！'); return; }
        const content = generateExportHTML(true);
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a); a.style = "display: none"; a.href = url;
        a.download = `衛材盤點表-${selectedDate}.xls`; a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
    });
    
    exportRangeBtn.addEventListener('click', () => reportModal.show());
    generateReportBtn.addEventListener('click', generateReport);

    // --- 初始操作 ---
    const todayString = new Date().toISOString().split('T')[0];
    dateInput.value = todayString;
    loadAndRenderDataForDate(todayString);
});
