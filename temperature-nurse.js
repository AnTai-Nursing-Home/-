document.addEventListener('firebase-ready', () => {
    const container = document.getElementById('employee-list-container');
    if (!container) return;

    // --- 元件宣告 ---
    const recordDateInput = document.getElementById('record-date');
    const saveTempsBtn = document.getElementById('save-temps-btn');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    
    // --- 變數 ---
    const employeesCollection = 'nurses';
    let employeeList = []; // 暫存員工列表

    // --- 函式 ---
    async function loadAndRenderEmployees() {
        container.innerHTML = '讀取中...';
        try {
            const snapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">員工名冊尚無資料。</p>';
                return;
            }
            
            employeeList = []; // 清空暫存
            let html = '<ul class="list-group">';
            snapshot.forEach(doc => {
                const emp = doc.data();
                employeeList.push(emp); // 存入暫存列表
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${emp.name} (${emp.id})</span>
                        <div class="input-group" style="width: 120px;">
                            <input type="number" class="form-control temp-input" placeholder="體溫" data-id="${emp.id}">
                            <span class="input-group-text">°C</span>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;
        } catch (error) {
            console.error("讀取員工列表失敗:", error);
            container.innerHTML = '<div class="alert alert-danger">讀取員工列表失敗。</div>';
        }
    }

    function generateReportHTML() {
        const date = recordDateInput.value;
        const reportTitle = "護理師每日體溫紀錄總表";

        let tableHTML = `<table style="width: 80%; margin: 20px auto; border-collapse: collapse; text-align: center;">
                            <thead>
                                <tr style="background-color: #f2f2f2;">
                                    <th style="border: 1px solid black; padding: 8px;">員編</th>
                                    <th style="border: 1px solid black; padding: 8px;">姓名</th>
                                    <th style="border: 1px solid black; padding: 8px;">體溫 (°C)</th>
                                </tr>
                            </thead>
                            <tbody>`;
        
        employeeList.forEach(emp => {
            const inputEl = container.querySelector(`.temp-input[data-id="${emp.id}"]`);
            const tempValue = inputEl ? inputEl.value : '';
            const isAbnormal = tempValue && (parseFloat(tempValue) < 36.0 || parseFloat(tempValue) > 37.5);
            const style = isAbnormal ? 'style="color: red; font-weight: bold;"' : '';

            tableHTML += `<tr>
                            <td style="border: 1px solid black; padding: 8px;">${emp.id}</td>
                            <td style="border: 1px solid black; padding: 8px;">${emp.name}</td>
                            <td ${style} style="border: 1px solid black; padding: 8px;">${tempValue}</td>
                          </tr>`;
        });
        tableHTML += '</tbody></table>';

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${reportTitle}</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}@page{size:A4 portrait;margin:20mm;}h1,h2{text-align:center;margin:5px 0;}</style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${reportTitle} (${date})</h2>${tableHTML}</body></html>`;
    }

    // --- 事件監聽器 ---
    exportWordBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `護理師體溫紀錄-${recordDateInput.value}.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `護理師體溫紀錄-${recordDateInput.value}.xls`; a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });

    // --- 初始操作 ---
    recordDateInput.value = new Date().toISOString().split('T')[0];
    loadAndRenderEmployees();
});
