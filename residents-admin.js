document.addEventListener('firebase-ready', () => {
    const residentsTableBody = document.getElementById('residents-table-body');
    if (!residentsTableBody) return;

    // --- 元件宣告 ---
    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const importStatus = document.getElementById('import-status');
    // ... (其他元件宣告不變) ...

    // --- 函式定義 ---
    async function loadAndRenderResidents() { /* ... 內容不變 ... */ }
    async function handleSave() { /* ... 內容不變 ... */ }

    // ==== 新增：處理 Excel 匯入的函式 ====
    async function handleExcelImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        importStatus.classList.remove('d-none');
        importStatus.textContent = '正在讀取檔案...';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const residents = XLSX.utils.sheet_to_json(worksheet);

                if (residents.length === 0) {
                    importStatus.textContent = '錯誤：Excel 檔案中沒有資料。';
                    return;
                }

                if (!residents[0].hasOwnProperty('姓名')) {
                    importStatus.textContent = '錯誤：Excel 檔案缺少必要的「姓名」欄位，請確認第一列的欄位標題是否正確。';
                    return;
                }

                importStatus.textContent = `偵測到 ${residents.length} 筆資料，正在批次寫入雲端...`;

                // 使用 Firebase 的批次寫入功能，效率更高
                const batch = db.batch();
                residents.forEach(resident => {
                    const name = String(resident.姓名).trim();
                    if (name) {
                        const docRef = db.collection(collectionName).doc(name);
                        batch.set(docRef, {
                            bedNumber: String(resident.床號 || ''),
                            gender: String(resident.性別 || ''),
                            birthday: String(resident.生日 || ''),
                            checkinDate: String(resident.入住日期 || ''),
                        });
                    }
                });

                await batch.commit(); // 一次性提交所有寫入操作

                importStatus.className = 'alert alert-success';
                importStatus.textContent = `成功匯入 ${residents.length} 筆住民資料！頁面將重新載入。`;
                
                setTimeout(() => window.location.reload(), 2000);

            } catch (error) {
                console.error("Excel 匯入失敗:", error);
                importStatus.className = 'alert alert-danger';
                importStatus.textContent = '匯入失敗，請檢查檔案格式或聯繫管理員。';
            } finally {
                excelFileInput.value = ''; // 清空選擇，以便下次可以選擇同一個檔案
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- 事件監聽器 ---
    importExcelBtn.addEventListener('click', () => {
        excelFileInput.click(); // 點擊按鈕時，觸發隱藏的檔案選擇器
    });
    excelFileInput.addEventListener('change', handleExcelImport);
    // ... (其他事件監聽器不變) ...
    
    // --- 初始操作 ---
    loadAndRenderResidents();
});
