document.addEventListener('DOMContentLoaded', function () {
    const inventoryData = [
        { category: '一、管路相關', items: [ { name: '14FR尿管', threshold: '＜5枝=缺' }, { name: '16FR尿管', threshold: '＜5枝=缺' }, { name: '18FR尿管', threshold: '＜5枝=缺' }, { name: '20FR尿管', threshold: '＜5枝=缺' }, { name: '12FR抽痰管', threshold: '＜3袋=缺' }, { name: '14FR抽痰管', threshold: '＜3袋=缺' }, { name: '18FR鼻胃管', threshold: '＜5條=缺' }, { name: '尿袋', threshold: '＜5個=缺' }, { name: '氧氣鼻導管', threshold: '＜10個=缺' }, { name: '氣切面罩', threshold: '＜10個=缺' }, { name: '氧氣面罩', threshold: '＜10個=缺' }, { name: 'AMBU', threshold: '＜2顆=缺' }, ] },
        { category: '二、注射與輸液', items: [ { name: '頭皮針(23G)', threshold: '＜1盒=缺' }, { name: '3CC空針', threshold: '＜10枝=缺' }, { name: '5CC空針', threshold: '＜10枝=缺' }, { name: '10CC空針', threshold: '＜10枝=缺' }, { name: '20CC空針', threshold: '＜10枝=缺' }, { name: '灌食空針', threshold: '＜10枝=缺' }, { name: '灌食奶袋', threshold: '＜20袋=缺' }, { name: '注射用水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(20ML)', threshold: '＜1盒=缺' }, { name: '生理食鹽水(500ML)', threshold: '＜3瓶=缺' }, ] },
        { category: '三、清潔與消毒', items: [ { name: '消毒錠', threshold: '＜1盒=缺' }, { name: '酒精棉片', threshold: '＜1盒=缺' }, { name: '生理沖洗瓶', threshold: '＜10瓶=缺' }, { name: '沖洗棉棒', threshold: '＜2大袋=缺' }, { name: '普通棉棒', threshold: '＜2大袋=缺' }, { name: '口腔棉棒', threshold: '＜2大袋=缺' }, { name: '2*2紗布', threshold: '＜10包=缺' }, { name: '3*3紗布', threshold: '＜10包=缺' }, { name: '4*4紗布', threshold: '＜10包=缺' }, { name: '平紗', threshold: '＜5包=缺' }, ] },
        { category: '四、輔助耗材', items: [ { name: 'Jelly(潤滑液)', threshold: '＜3瓶=缺' }, { name: '3M膠布', threshold: '＜1盒=缺' }, { name: '血糖試紙', threshold: '＜1大箱=缺' }, ] }
    ];

    const printButton = document.getElementById('print-button');
    const exportWordButton = document.getElementById('export-word-button');
    const exportRangeBtn = document.getElementById('export-range-btn');
    const reportModalElement = document.getElementById('report-modal');
    const reportModal = new bootstrap.Modal(reportModalElement);
    const generateReportBtn = document.getElementById('generate-report-btn');
    
    // ... 其他元件宣告不變 ...

    function generateReport() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!startDate || !endDate) {
            alert('請選擇開始日期與結束日期。');
            return;
        }

        const suppliesHistory = JSON.parse(localStorage.getItem('suppliesHistory')) || {};
        const datesInRange = Object.keys(suppliesHistory)
            .filter(date => date >= startDate && date <= endDate)
            .sort();

        if (datesInRange.length === 0) {
            alert('您選擇的日期區間內沒有任何盤點紀錄。');
            return;
        }

        let reportHTML = `
            <!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>衛材盤點區間報表</title>
            <style>
                body { font-family: 'Segoe UI', 'Microsoft JhengHei', sans-serif; }
                .report-container { width: 95%; margin: auto; }
                h1, h2 { text-align: center; }
                .daily-record { page-break-before: always; margin-top: 2rem; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .table-category { background-color: #e9ecef; font-weight: bold; text-align: center; }
                .item-threshold { font-size: 0.8em; color: #666; }
                .status-danger { color: red; font-weight: bold; }
            </style>
            </head><body>
            <div class="report-container">
                <h1>衛材盤點區間報表</h1>
                <h2>${startDate} 至 ${endDate}</h2>
        `;

        datesInRange.forEach(date => {
            const dailyData = suppliesHistory[date];
            reportHTML += `<div class="daily-record">`;
            reportHTML += `<h3>盤點日期：${date}</h3>`;
            reportHTML += `<p><strong>盤點護理師：</strong>${dailyData.header.nurse || ''} &nbsp;&nbsp;&nbsp; <strong>補齊者：</strong>${dailyData.header.restocker || ''}</p>`;
            reportHTML += `<table>
                            <thead><tr><th style="width:40%">品項</th><th style="width:30%">護理師</th><th style="width:30%">補齊狀態</th></tr></thead>
                            <tbody>`;

            inventoryData.forEach(category => {
                reportHTML += `<tr><td colspan="3" class="table-category">${category.category}</td></tr>`;
                category.items.forEach(item => {
                    const itemStatus = dailyData.items[item.name];
                    const nurseCheck = itemStatus?.status || '-';
                    const restockCheck = itemStatus?.restockStatus || '-';
                    reportHTML += `<tr>
                                    <td>${item.name}<div class="item-threshold">${item.threshold}</div></td>
                                    <td class="${nurseCheck === '缺項' ? 'status-danger' : ''}">${nurseCheck}</td>
                                    <td>${restockCheck}</td>
                                  </tr>`;
                });
            });

            reportHTML += `</tbody></table></div>`;
        });

        reportHTML += `</div></body></html>`;

        reportModal.hide();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500); // 等待內容渲染後再列印
    }

    exportRangeBtn.addEventListener('click', () => {
        reportModal.show();
    });

    generateReportBtn.addEventListener('click', generateReport);
    
    // ... 其他所有函式和事件監聽器保持不變 ...
}
