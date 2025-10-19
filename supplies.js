document.addEventListener('firebase-ready', () => {
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) return;

    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('admin.html')) {
        backButtonGeneral.href = 'admin.html?view=dashboard';
    }

    const inventoryData = [
        { category: '一、管路相關', items: [ 
            { name: '14FR尿管', threshold: '＜5枝=缺' },
            { name: '16FR尿管', threshold: '＜5枝=缺' },
            { name: '18FR尿管', threshold: '＜5枝=缺' },
            { name: '20FR尿管', threshold: '＜5枝=缺' },
            { name: '12FR抽痰管', threshold: '＜3袋=缺' },
            { name: '14FR抽痰管', threshold: '＜3袋=缺' },
            { name: '18FR鼻胃管', threshold: '＜5條=缺' },
            { name: '尿袋', threshold: '＜5個=缺' },
            { name: '氧氣鼻導管', threshold: '＜10個=缺' },
            { name: '氣切面罩', threshold: '＜10個=缺' },
            { name: '氧氣面罩', threshold: '＜10個=缺' },
            { name: 'AMBU', threshold: '＜2顆=缺' },
        ]},
        { category: '二、注射與輸液', items: [
            { name: '頭皮針(23G)', threshold: '＜1盒=缺' },
            { name: '3CC空針', threshold: '＜10枝=缺' },
            { name: '5CC空針', threshold: '＜10枝=缺' },
            { name: '10CC空針', threshold: '＜10枝=缺' },
            { name: '20CC空針', threshold: '＜10枝=缺' },
            { name: '灌食空針', threshold: '＜10枝=缺' },
            { name: '灌食奶袋', threshold: '＜20袋=缺' },
            { name: '注射用水(20ML)', threshold: '＜1盒=缺' },
            { name: '生理食鹽水(20ML)', threshold: '＜1盒=缺' },
            { name: '生理食鹽水(500ML)', threshold: '＜3瓶=缺' },
        ]},
        { category: '三、清潔與消毒', items: [
            { name: '消毒錠', threshold: '＜1盒=缺' },
            { name: '酒精棉片', threshold: '＜1盒=缺' },
            { name: '生理沖洗瓶', threshold: '＜10瓶=缺' },
            { name: '沖洗棉棒', threshold: '＜2大袋=缺' },
            { name: '普通棉棒', threshold: '＜2大袋=缺' },
            { name: '口腔棉棒', threshold: '＜2大袋=缺' },
            { name: '2*2紗布', threshold: '＜10包=缺' },
            { name: '3*3紗布', threshold: '＜10包=缺' },
            { name: '4*4紗布', threshold: '＜10包=缺' },
            { name: '平紗', threshold: '＜5包=缺' },
        ]},
        { category: '四、輔助耗材', items: [
            { name: 'Jelly(潤滑液)', threshold: '＜3瓶=缺' },
            { name: '3M膠布', threshold: '＜1盒=缺' },
            { name: '血糖試紙', threshold: '＜1大箱=缺' },
        ]}
    ];

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

    async function loadAndRenderDataForDate(date) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">讀取中...</td></tr>';
        try {
            const doc = await db.collection(collectionName).doc(date).get();
            const dailyData = doc.exists ? doc.data() : {};
            nurseInput.value = dailyData.header?.nurse || '';
            restockerInput.value = dailyData.header?.restocker || '';
            const itemsStatus = dailyData.items || {};
            tableBody.innerHTML = '';
            inventoryData.forEach(category => {
                const catRow = document.createElement('tr');
                catRow.innerHTML = `<td colspan="3" class="table-category">${category.category}</td>`;
                tableBody.appendChild(catRow);
                category.items.forEach(item => {
                    const row = document.createElement('tr');
                    const s = itemsStatus[item.name]?.status || '-';
                    const r = itemsStatus[item.name]?.restockStatus || '-';
                    row.dataset.itemName = item.name;
                    if (s === '缺項') row.classList.add('table-danger');
                    else if (s === '無缺項') row.classList.add('table-success');
                    row.innerHTML = `
                        <td>${item.name}<div class="item-threshold">${item.threshold}</div></td>
                        <td><select class="form-select" data-field="status">
                            <option value="-" ${s==='-'?'selected':''}>-</option>
                            <option value="缺項" ${s==='缺項'?'selected':''}>缺項</option>
                            <option value="無缺項" ${s==='無缺項'?'selected':''}>無缺項</option>
                        </select></td>
                        <td><select class="form-select" data-field="restockStatus">
                            <option value="-" ${r==='-'?'selected':''}>-</option>
                            <option value="已補齊" ${r==='已補齊'?'selected':''}>已補齊</option>
                            <option value="缺貨" ${r==='缺貨'?'selected':''}>缺貨</option>
                        </select></td>`;
                    tableBody.appendChild(row);
                });
            });
        } catch {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">讀取失敗</td></tr>';
        }
    }

    async function saveTodaysData() {
        const date = dateInput.value;
        if (!date) return alert('請選擇日期');
        if (!nurseInput.value.trim()) return alert('請填寫盤點者');
        let valid = true;
        const items = {};
        inventoryData.forEach(cat => {
            cat.items.forEach(item => {
                const row = tableBody.querySelector(`tr[data-item-name="${item.name}"]`);
                const s = row.querySelector('select[data-field="status"]').value;
                const r = row.querySelector('select[data-field="restockStatus"]').value;
                if (s === '-') valid = false;
                items[item.name] = { status: s, restockStatus: r };
            });
        });
        if (!valid) return alert('所有項目需完成盤點');
        await db.collection(collectionName).doc(date).set({
            header: { date, nurse: nurseInput.value, restocker: restockerInput.value, timestamp: firebase.firestore.FieldValue.serverTimestamp() },
            items
        });
        alert('已儲存');
        loadAndRenderDataForDate(date);
    }

    // 🔄 改版報表：橫向排列所有日期
    // === 改良版報表，顯示盤點者與補齊者 ===
    // === 改良版報表，顯示盤點者與補齊者 ===
    async function generateReport() {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if (!start || !end) return alert('請選擇日期區間');
    
        const snapshot = await db.collection(collectionName)
            .where(firebase.firestore.FieldPath.documentId(), '>=', start)
            .where(firebase.firestore.FieldPath.documentId(), '<=', end).get();
    
        const allDates = [];
        const allData = {};
        snapshot.forEach(doc => { allDates.push(doc.id); allData[doc.id] = doc.data(); });
        allDates.sort();
        if (allDates.length === 0) return alert('沒有資料');
    
        // 產生表格標題（日期＋人員）
        let html = `
        <table style="border-collapse:collapse;width:100%;font-family:'Microsoft JhengHei',sans-serif;">
        <thead>
            <tr style="background:#f2f2f2;text-align:center;">
                <th style="border:1px solid black;">品項</th>
                <th style="border:1px solid black;">基準</th>
                ${allDates.map(d=>{
                    const h = allData[d]?.header || {};
                    const nurse = h.nurse || '—';
                    const restocker = h.restocker || '—';
                    return `
                    <th colspan="2" style="border:1px solid black;padding:4px;">
                        ${d}<br>
                        <span style="font-size:11px;">盤點：${nurse}</span><br>
                        <span style="font-size:11px;">補齊：${restocker}</span>
                    </th>`;
                }).join('')}
            </tr>
            <tr style="background:#f9f9f9;text-align:center;">
                <th colspan="2"></th>
                ${allDates.map(()=>`<th style="border:1px solid black;">盤點</th><th style="border:1px solid black;">補齊</th>`).join('')}
            </tr>
        </thead><tbody>`;
    
        inventoryData.forEach(cat=>{
            html += `<tr><td colspan="${2+allDates.length*2}" style="background:#e9ecef;font-weight:bold;border:1px solid black;text-align:center;">${cat.category}</td></tr>`;
            cat.items.forEach(item=>{
                html += `<tr><td style="border:1px solid black;">${item.name}</td><td style="border:1px solid black;">${item.threshold}</td>`;
                allDates.forEach(d=>{
                    const data = allData[d]?.items?.[item.name];
                    const s = data?.status || '-';
                    const r = data?.restockStatus || '-';
                    const sStyle = s==='缺項'?'color:red;font-weight:bold;':'';
                    const rStyle = r==='缺貨'?'color:red;font-weight:bold;':'';
                    html += `<td style="border:1px solid black;text-align:center;${sStyle}">${s}</td>`;
                    html += `<td style="border:1px solid black;text-align:center;${rStyle}">${r}</td>`;
                });
                html += `</tr>`;
            });
        });
    
        html += '</tbody></table>';
    
        const reportHTML = `
        <!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
        <title>衛材盤點區間報表</title>
        <style>
            body{font-family:'Microsoft JhengHei',sans-serif;}
            table{font-size:12px;}
            th,td{white-space:nowrap;}
        </style></head>
        <body>
            <h1 style="text-align:center;">安泰醫療社團法人附設安泰護理之家</h1>
            <h2 style="text-align:center;">衛材盤點區間報表 (${start} 至 ${end})</h2>
            ${html}
        </body></html>`;
    
        reportModal.hide();
        const win = window.open('', '_blank');
        win.document.write(reportHTML);
        win.document.close();
        setTimeout(()=>win.print(),500);
    }
    
    dateInput.addEventListener('change',()=>loadAndRenderDataForDate(dateInput.value));
    saveButton.addEventListener('click',saveTodaysData);
    resetButton.addEventListener('click',async()=>{
        const date=dateInput.value;
        if(!date)return alert('請選擇日期');
        if(!confirm(`清空 ${date} 紀錄？`))return;
        await db.collection(collectionName).doc(date).delete();
        alert('已清空');
        loadAndRenderDataForDate(date);
    });
    printButton.addEventListener('click',()=>{
        const win=window.open('','_blank');
        win.document.write(generateExportHTML());
        win.document.close();
        setTimeout(()=>win.print(),500);
    });
    exportRangeBtn.addEventListener('click',()=>reportModal.show());
    generateReportBtn.addEventListener('click',generateReport);

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    loadAndRenderDataForDate(today);
});
