document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在體溫登錄頁存在的獨特元件，來判斷我們是否在正確的頁面
    const container = document.getElementById('employee-list-container');
    if (!container) return;

    // --- 元件宣告 ---
    const recordDateInput = document.getElementById('record-date');
    const saveTempsBtn = document.getElementById('save-temps-btn');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    
    // --- 變數 ---
    const employeesCollection = 'caregivers';
    const tempsCollection = 'caregiver_temperatures';
    let employeeList = [];

    // --- 函式 ---
    async function loadAndRenderEmployees() {
        container.innerHTML = '讀取中...';
        try {
            const snapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">員工名冊尚無資料。</p>';
                return;
            }
            
            employeeList = [];
            let html = '<ul class="list-group">';
            snapshot.forEach(doc => {
                const emp = doc.data();
                employeeList.push(emp);
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${emp.name} (${emp.id})</span>
                        <div class="input-group" style="width: 150px;">
                            <input type="number" class="form-control temp-input" placeholder="體溫" data-id="${emp.id}" step="0.1">
                            <span class="input-group-text">°C</span>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;
            await loadTemperaturesForDate();
        } catch (error) {
            console.error("讀取員工列表失敗:", error);
            container.innerHTML = '<div class="alert alert-danger">讀取員工列表失敗。</div>';
        }
    }

    async function loadTemperaturesForDate() {
        const date = recordDateInput.value;
        if (!date) return;
        
        container.querySelectorAll('.temp-input').forEach(input => {
            input.value = '';
            input.classList.remove('is-invalid');
        });

        try {
            const docRef = db.collection(tempsCollection).doc(date);
            const doc = await docRef.get();
            if (doc.exists) {
                const temps = doc.data();
                container.querySelectorAll('.temp-input').forEach(input => {
                    const empId = input.dataset.id;
                    if (temps[empId] !== undefined) {
                        input.value = temps[empId];
                        validateTemperature(input);
                    }
                });
            }
        } catch (error) {
            console.error("讀取體溫紀錄失敗:", error);
            alert("讀取本日體溫紀錄失敗！");
        }
    }

    function validateTemperature(inputElement) {
        if (!inputElement.value) {
            inputElement.classList.remove('is-invalid');
            return true;
        }
        const temp = parseFloat(inputElement.value);
        if (temp < 36.0 || temp > 37.5) {
            inputElement.classList.add('is-invalid');
            return false;
        } else {
            inputElement.classList.remove('is-invalid');
            return true;
        }
    }
    
    async function handleSave() {
        const date = recordDateInput.value;
        if (!date) {
            alert('請先選擇登錄日期！');
            return;
        }
        let allValid = true;
        const tempsToSave = {};
        container.querySelectorAll('.temp-input').forEach(input => {
            if (!validateTemperature(input)) {
                allValid = false;
            }
            const empId = input.dataset.id;
            const tempValue = input.value;
            if (tempValue) {
                tempsToSave[empId] = parseFloat(tempValue);
            }
        });
        if (!allValid) {
            alert('體溫有異常值(低於36.0或高於37.5)，請確認後再儲存！');
            return;
        }
        saveTempsBtn.disabled = true;
        try {
            await db.collection(tempsCollection).doc(date).set(tempsToSave, { merge: true });
            alert(`日期 ${date} 的體溫紀錄已成功儲存！`);
        } catch (error) {
            console.error("儲存體溫紀錄失敗:", error);
            alert("儲存失敗，請稍後再試。");
        } finally {
            saveTempsBtn.disabled = false;
        }
    }

    async function generateMonthlyReportHTML() {
        const selectedDate = new Date(recordDateInput.value);
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthName = `${year}年 ${month + 1}月`;
        const reportTitle = "照服員每月體溫紀錄總表";

        const sortedEmployees = employeeList;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const promises = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            promises.push(db.collection(tempsCollection).doc(dateStr).get());
        }
        const docSnaps = await Promise.all(promises);
        const tempsByDate = {};
        docSnaps.forEach((doc, index) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
            if (doc.exists) {
                tempsByDate[dateStr] = doc.data();
            }
        });

        let tableHeaderHTML = '<tr><th>員編</th><th>姓名</th>';
        for (let i = 1; i <= daysInMonth; i++) {
            tableHeaderHTML += `<th>${i}</th>`;
        }
        tableHeaderHTML += '</tr>';

        let tableBodyHTML = '';
        sortedEmployees.forEach(emp => {
            tableBodyHTML += `<tr><td>${emp.id}</td><td>${emp.name}</td>`;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const tempValue = tempsByDate[dateStr]?.[emp.id];
                const displayValue = tempValue !== undefined ? tempValue : 'Off';
                const isAbnormal = tempValue !== undefined && (parseFloat(tempValue) < 36.0 || parseFloat(tempValue) > 37.5);
                const style = isAbnormal ? 'style="color: red; font-weight: bold;"' : '';
                tableBodyHTML += `<td ${style}>${displayValue}</td>`;
            }
            tableBodyHTML += '</tr>';
        });

        const tableContent = `<table style="width: 100%; border-collapse: collapse; font-size: 9pt;"><thead>${tableHeaderHTML}</thead><tbody>${tableBodyHTML}</tbody></table>`;
        const headerTable = `<div style="text-align: center; margin-bottom: 20px;"><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${reportTitle} (${monthName})</h2></div>`;

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${reportTitle}</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}@page{size:A4 landscape;margin:15mm;}table,th,td{border:1px solid black;padding:2px;text-align:center;}</style></head><body>${headerTable}${tableContent}</body></html>`;
    }

    // --- 事件監聽器 ---
    recordDateInput.addEventListener('change', loadTemperaturesForDate);

    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('temp-input')) {
            validateTemperature(e.target);
        }
    });

    saveTempsBtn.addEventListener('click', handleSave);

    exportWordBtn.addEventListener('click', async () => {
        const content = await generateMonthlyReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `照服員體溫月報表-${recordDateInput.value.substring(0, 7)}.doc`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', async () => {
        const content = await generateMonthlyReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `照服員體溫月報表-${recordDateInput.value.substring(0, 7)}.xls`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', async () => {
        const content = await generateMonthlyReportHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    });

    // --- 初始操作 ---
    recordDateInput.value = new Date().toISOString().split('T')[0];
    loadAndRenderEmployees();
});
