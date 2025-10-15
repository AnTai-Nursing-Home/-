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
            await loadTemperaturesForDate(); // 載入員工後，接著載入本日體溫
        } catch (error) {
            console.error("讀取員工列表失敗:", error);
            container.innerHTML = '<div class="alert alert-danger">讀取員工列表失敗。</div>';
        }
    }

    async function loadTemperaturesForDate() {
        const date = recordDateInput.value;
        if (!date) return;

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
                    } else {
                        input.value = '';
                    }
                });
            } else {
                // 如果那天沒資料，清空所有輸入框
                container.querySelectorAll('.temp-input').forEach(input => input.value = '');
            }
        } catch (error) {
            console.error("讀取體溫紀錄失敗:", error);
            alert("讀取本日體溫紀錄失敗！");
        }
    }

    function validateTemperature(inputElement) {
        const temp = parseFloat(inputElement.value);
        if (inputElement.value && (temp < 36.0 || temp > 37.5)) {
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
            if (tempValue) { // 只儲存有填寫的體溫
                tempsToSave[empId] = parseFloat(tempValue);
            }
        });

        if (!allValid) {
            alert('體溫有異常值，請確認後再儲存！');
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

    function generateReportHTML() {
        const date = recordDateInput.value;
        const reportTitle = "照服員每日體溫紀錄總表";

        let tableHTML = `<table style="width: 80%; margin: 20px auto; border-collapse: collapse; text-align: center;"><thead><tr style="background-color: #f2f2f2;"><th style="border: 1px solid black; padding: 8px;">員編</th><th style="border: 1px solid black; padding: 8px;">姓名</th><th style="border: 1px solid black; padding: 8px;">體溫 (°C)</th></tr></thead><tbody>`;
        
        employeeList.forEach(emp => {
            const inputEl = container.querySelector(`.temp-input[data-id="${emp.id}"]`);
            const tempValue = inputEl ? inputEl.value : '';
            const isAbnormal = tempValue && (parseFloat(tempValue) < 36.0 || parseFloat(tempValue) > 37.5);
            const style = isAbnormal ? 'style="color: red; font-weight: bold;"' : '';

            tableHTML += `<tr><td style="border: 1px solid black; padding: 8px;">${emp.id}</td><td style="border: 1px solid black; padding: 8px;">${emp.name}</td><td ${style} style="border: 1px solid black; padding: 8px;">${tempValue}</td></tr>`;
        });
        tableHTML += '</tbody></table>';

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${reportTitle}</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}@page{size:A4 portrait;margin:20mm;}h1,h2{text-align:center;margin:5px 0;}</style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${reportTitle} (${date})</h2>${tableHTML}</body></html>`;
    }

    // --- 事件監聽器 ---
    recordDateInput.addEventListener('change', loadTemperaturesForDate);
    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('temp-input')) {
            validateTemperature(e.target);
        }
    });
    saveTempsBtn.addEventListener('click', handleSave);

    exportWordBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `照服員體溫紀錄-${recordDateInput.value}.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', () => {
        const content = generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `照服員體溫紀錄-${recordDateInput.value}.xls`; a.click();
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
