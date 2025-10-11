document.addEventListener('firebase-ready', () => {
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) return;

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
    const exportRangeBtn = document.getElementById('export-range-btn');
    const reportModalElement = document.getElementById('report-modal');
    const reportModal = new bootstrap.Modal(reportModalElement);
    const generateReportBtn = document.getElementById('generate-report-btn');
    const collectionName = 'supplies_inventory';

    async function loadAndRenderDataForDate(date) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">讀取中...</td></tr>';
        try {
            const docRef = db.collection(collectionName).doc(date);
            const doc = await docRef.get();
            const dailyData = doc.exists ? doc.data() : {};
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
        } catch (error) {
            console.error("讀取衛材資料失敗:", error);
            tableBody.innerHTML = '<tr><td colspan="3"><div class="alert alert-danger">讀取資料失敗，請重新整理頁面。</div></td></tr>';
        }
    }
    async function saveTodaysData() {
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
            let reportHTML = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>衛材盤點區間報表</title><style>body{font-family:'Segoe UI','Microsoft JhengHei',sans-serif;}.report-container{width:95%;margin:auto;}h1,h2{text-align:center;}.daily-record{page-break-before:always;margin-top:2rem;}table{width:100%;border-collapse:collapse;margin-top:1rem;}th,td{border:1px solid #ccc;padding:8px;text-align:left;}th{background-color:#f2f2f2;}.table-category{background-color:#e9ecef;font-weight:bold;text-align:center;}.item-threshold{font-size:0.8em;color:#666;}.status-danger{color:red;font-weight:bold;}</style></head><body><div class="report-container"><h1>衛材盤點區間報表</h1><h2>${startDate} 至 ${endDate}</h2>`;
            for (const date of datesInRange) {
                const doc = await db.collection(collectionName).doc(date).get();
                if (doc.exists) {
                    const dailyData = doc.data();
                    reportHTML += `<div class="daily-record"><h3>盤點日期：${date}</h3><p><strong>盤點護理師：</strong>${dailyData.header.nurse||''} &nbsp;&nbsp;&nbsp; <strong>補齊者：</strong>${dailyData.header.restocker||''}</p><table><thead><tr><th style="width:40%">品項</th><th style="width:30%">護理師</th><th style="width:30%">補齊狀態</th></tr></thead><tbody>`;
                    inventoryData.forEach(category => {
                        reportHTML += `<tr><td colspan="3" class="table-category">${category.category}</td></tr>`;
                        category.items.forEach(item => {
                            const itemStatus = dailyData.items[item.name];
                            const nurseCheck = itemStatus?.status || '-';
                            const restockCheck = itemStatus?.restockStatus || '-';
                            reportHTML += `<tr><td>${item.name}<div class="item-threshold">${item.threshold}</div></td><td class="${nurseCheck==='缺項'?'status-danger':''}">${nurseCheck}</td><td>${restockCheck}</td></tr>`;
                        });
                    });
                    reportHTML += `</tbody></table></div>`;
                }
            }
            reportHTML += `</div></body></html>`;
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
    dateInput.addEventListener('change', function() { loadAndRenderDataForDate(this.value); });
    saveButton.addEventListener('click', saveTodaysData);
    resetButton.addEventListener('click', async function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('請先選擇要清空的日期。'); return; }
        if (confirm(`您確定要清空日期 ${selectedDate} 的所有紀錄嗎？`)) {
            try {
                resetButton.disabled = true;
                await db.collection(collectionName).doc(selectedDate).delete();
                alert(`日期 ${selectedDate} 的紀錄已清空。`);
                loadAndRenderDataForDate(selectedDate);
            } catch (error) {
                console.error("刪除失敗:", error);
                alert("刪除失敗，請稍後再試。");
            } finally {
                resetButton.disabled = false;
            }
        }
    });
    nurseInput.addEventListener('input', function() { if (nurseInput.classList.contains('is-invalid')) nurseInput.classList.remove('is-invalid'); });
    printButton.addEventListener('click', () => window.print());
    exportWordButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { alert('請先選擇日期！'); return; }
        const printableTable = document.querySelector('.table-responsive').cloneNode(true);
        printableTable.querySelectorAll('tr[data-item-name]').forEach(row => {
            const itemName = row.dataset.itemName;
            const originalRow = tableBody.querySelector(`tr[data-item-name="${itemName}"]`);
            if (originalRow) {
                row.cells[1].innerHTML = originalRow.querySelector('select[data-field="status"]').value;
                row.cells[2].innerHTML = originalRow.querySelector('select[data-field="restockStatus"]').value;
            }
        });
        let content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>衛材盤點表</title><style>table,th,td{border:1px solid black;border-collapse:collapse;padding:5px;}th{background-color:#f2f2f2;}.table-category{background-color:#e9ecef;font-weight:bold;text-align:center;}</style></head><body><h2>衛材盤點表</h2><p><strong>盤點日期:</strong> ${dateInput.value}</p><p><strong>盤點護理師:</strong> ${nurseInput.value}</p><p><strong>補齊者:</strong> ${restockerInput.value}</p>${printableTable.innerHTML}</body></html>`;
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a); a.style = "display: none"; a.href = url; a.download = `衛材盤點表-${selectedDate}.doc`; a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
    });
    exportRangeBtn.addEventListener('click', () => reportModal.show());
    generateReportBtn.addEventListener('click', generateReport);
    const todayString = new Date().toISOString().split('T')[0];
    dateInput.value = todayString;
    loadAndRenderDataForDate(todayString);
});
