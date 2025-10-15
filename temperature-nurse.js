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
    const employeesCollection = 'nurses';
    const tempsCollection = 'nurse_temperatures';
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
            input.value = ''; // 先清空
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

    function generateReportHTML() { /* ... 內容與上一則回覆相同 ... */ }

    // --- 事件監聽器 ---
    recordDateInput.addEventListener('change', loadTemperaturesForDate);
    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('temp-input')) {
            validateTemperature(e.target);
        }
    });
    saveTempsBtn.addEventListener('click', handleSave);
    exportWordBtn.addEventListener('click', () => { /* ... 內容與上一則回覆相同 ... */ });
    exportExcelBtn.addEventListener('click', () => { /* ... 內容與上一則回覆相同 ... */ });
    printBtn.addEventListener('click', () => { /* ... 內容與上一則回覆相同 ... */ });

    // --- 初始操作 ---
    recordDateInput.value = new Date().toISOString().split('T')[0];
    loadAndRenderEmployees();
});
