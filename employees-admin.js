document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 employees-admin.html 存在的獨特元件，來判斷我們是否在正確的頁面
    const nursesTableBody = document.getElementById('nurses-table-body');
    if (!nursesTableBody) {
        return; // 如果找不到，代表不在員工管理頁，直接結束
    }

    // --- 元件宣告 ---
    const caregiversTableBody = document.getElementById('caregivers-table-body');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const employeeModalEl = document.getElementById('employee-modal');
    const employeeModal = new bootstrap.Modal(employeeModalEl);
    const employeeModalTitle = document.getElementById('employee-modal-title');
    const saveEmployeeBtn = document.getElementById('save-employee-btn');
    const employeeForm = document.getElementById('employee-form');
    const employeeIdInput = document.getElementById('employee-id');
    const employeeNameInput = document.getElementById('employee-name');
    const employeeTypeInput = document.getElementById('employee-type');
    const employeeSortOrderInput = document.getElementById('employee-sortOrder');
    const tableHeaders = document.querySelectorAll('.sortable-header');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const importStatus = document.getElementById('import-status');
    
    // --- 變數 ---
    const nursesCollection = 'nurses';
    const caregiversCollection = 'caregivers';
    let currentEditingId = null;
    let sortConfig = { key: 'sortOrder', order: 'asc' }; // 預設使用自訂排序

    // --- 函式定義 ---
    async function loadAndRenderEmployees(collectionName, tableBody) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center">讀取中...</td></tr>`;
        try {
            const snapshot = await db.collection(collectionName)
                .orderBy(sortConfig.key, sortConfig.order)
                .orderBy('id', 'asc') // 當 sortOrder 相同時，用員編做次要排序
                .get();
            if (snapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center">尚無資料。</td></tr>`;
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const employee = doc.data();
                html += `<tr data-id="${doc.id}"><td>${employee.sortOrder || 999}</td><td>${employee.id}</td><td>${employee.name}</td><td><button class="btn btn-sm btn-primary btn-edit">編輯</button> <button class="btn btn-sm btn-danger btn-delete">刪除</button></td></tr>`;
            });
            tableBody.innerHTML = html;
        } catch (error) {
            console.error(`讀取 ${collectionName} 資料失敗:`, error);
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">讀取失敗！</td></tr>`;
        }
    }

    function updateHeaderSortUI() {
        tableHeaders.forEach(header => {
            const sortKey = header.dataset.sort;
            header.classList.remove('sort-asc', 'sort-desc');
            if (sortKey === sortConfig.key) {
                header.classList.add(sortConfig.order === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    function openModalForNew() {
        currentEditingId = null;
        employeeModalTitle.textContent = '新增員工';
        employeeForm.reset();
        employeeIdInput.disabled = false;
        employeeModal.show();
    }

    async function handleSave() {
        const id = employeeIdInput.value.trim();
        const name = employeeNameInput.value.trim();
        const sortOrder = parseInt(employeeSortOrderInput.value) || 999;
        const type = employeeTypeInput.value;
        if (!id || !name) { alert('請填寫員編和姓名！'); return; }

        const collectionName = (type === 'nurse') ? nursesCollection : caregiversCollection;
        
        saveEmployeeBtn.disabled = true;
        try {
            if (currentEditingId && currentEditingId !== id) {
                await db.collection(collectionName).doc(currentEditingId).delete();
            }
            await db.collection(collectionName).doc(id).set({ id, name, sortOrder });
            employeeModal.hide();
            loadAll();
        } catch (error) {
            alert('儲存失敗！');
        } finally {
            saveEmployeeBtn.disabled = false;
        }
    }

    function loadAll() {
        loadAndRenderEmployees(nursesCollection, nursesTableBody);
        loadAndRenderEmployees(caregiversCollection, caregiversTableBody);
        updateHeaderSortUI();
    }

    async function generateEmployeeReportHTML() {
        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        const isNurses = activeTab.id === 'nurses-tab';
        const collectionName = isNurses ? nursesCollection : caregiversCollection;
        const reportTitle = isNurses ? '護理師名冊' : '照服員名冊';

        const snapshot = await db.collection(collectionName).orderBy('sortOrder', 'asc').orderBy('id', 'asc').get();
        
        let tableHTML = `<table style="width: 60%; margin: 20px auto; border-collapse: collapse; text-align: center;">
                            <thead>
                                <tr style="background-color: #f2f2f2;">
                                    <th style="border: 1px solid black; padding: 8px;">員編</th>
                                    <th style="border: 1px solid black; padding: 8px;">姓名</th>
                                </tr>
                            </thead>
                            <tbody>`;
        
        snapshot.forEach(doc => {
            const employee = doc.data();
            tableHTML += `<tr>
                            <td style="border: 1px solid black; padding: 8px;">${employee.id}</td>
                            <td style="border: 1px solid black; padding: 8px;">${employee.name}</td>
                          </tr>`;
        });
        tableHTML += '</tbody></table>';

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${reportTitle}</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}@page{size:A4;margin:20mm;}h1,h2{text-align:center;margin:5px 0;}</style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${reportTitle}</h2>${tableHTML}</body></html>`;
    }

    async function handleExcelImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        const isNurses = activeTab.id === 'nurses-tab';
        const collectionName = isNurses ? nursesCollection : caregiversCollection;
        const employeeTypeText = isNurses ? '護理師' : '照服員';

        importStatus.className = 'alert alert-info';
        importStatus.classList.remove('d-none');
        importStatus.textContent = `正在讀取檔案並匯入至「${employeeTypeText}」名冊...`;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const employees = XLSX.utils.sheet_to_json(worksheet);

                if (employees.length === 0) {
                    importStatus.textContent = '錯誤：Excel 檔案中沒有資料。';
                    return;
                }

                if (!employees[0].hasOwnProperty('員編') || !employees[0].hasOwnProperty('姓名')) {
                    importStatus.textContent = '錯誤：Excel 檔案缺少必要的「員編」或「姓名」欄位，請確認第一列的欄位標題是否正確。';
                    return;
                }

                importStatus.textContent = `偵測到 ${employees.length} 筆資料，正在批次寫入雲端...`;
                const batch = db.batch();
                employees.forEach((emp) => {
                    const id = String(emp.員編).trim();
                    const name = String(emp.姓名).trim();
                    if (id && name) {
                        const docRef = db.collection(collectionName).doc(id);
                        batch.set(docRef, {
                            id: id,
                            name: name,
                            sortOrder: parseInt(emp.排序) || 999
                        });
                    }
                });

                await batch.commit();

                importStatus.className = 'alert alert-success';
                importStatus.textContent = `成功匯入 ${employees.length} 筆資料至「${employeeTypeText}」名冊！頁面將重新整理。`;
                
                setTimeout(() => window.location.reload(), 2000);

            } catch (error) {
                console.error("Excel 匯入失敗:", error);
                importStatus.className = 'alert alert-danger';
                importStatus.textContent = '匯入失敗，請檢查檔案格式或聯繫管理員。';
            } finally {
                excelFileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    // --- 事件監聽器 ---
    addEmployeeBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        employeeTypeInput.value = (activeTab.id === 'nurses-tab') ? 'nurse' : 'caregiver';
        openModalForNew();
    });

    nursesTableBody.addEventListener('click', (e) => handleTableClick(e, nursesCollection));
    caregiversTableBody.addEventListener('click', (e) => handleTableClick(e, caregiversCollection));

    async function handleTableClick(e, collectionName) {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const docId = row.dataset.id;
        
        if (target.classList.contains('btn-edit')) {
            const employeeData = { 
                sortOrder: row.cells[0].textContent,
                id: row.cells[1].textContent, 
                name: row.cells[2].textContent 
            };
            currentEditingId = docId;
            employeeModalTitle.textContent = '編輯員工';
            employeeSortOrderInput.value = employeeData.sortOrder;
            employeeIdInput.value = employeeData.id;
            employeeNameInput.value = employeeData.name;
            employeeTypeInput.value = (collectionName === nursesCollection) ? 'nurse' : 'caregiver';
            employeeIdInput.disabled = false;
            employeeModal.show();
        } else if (target.classList.contains('btn-delete')) {
            if (confirm(`確定要刪除員工 ${docId} 嗎？`)) {
                try {
                    await db.collection(collectionName).doc(docId).delete();
                    loadAll();
                } catch {
                    alert('刪除失敗！');
                }
            }
        }
    }

    saveEmployeeBtn.addEventListener('click', handleSave);

    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const newKey = header.dataset.sort;
            if (sortConfig.key === newKey) {
                sortConfig.order = (sortConfig.order === 'asc') ? 'desc' : 'asc';
            } else {
                sortConfig.key = newKey;
                sortConfig.order = 'asc';
            }
            loadAll();
        });
    });

    importExcelBtn.addEventListener('click', () => {
        excelFileInput.click();
    });
    excelFileInput.addEventListener('change', handleExcelImport);

    exportWordBtn.addEventListener('click', async () => {
        const reportTitle = document.querySelector('#employeeTabs .nav-link.active').textContent;
        const content = await generateEmployeeReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${reportTitle}名冊.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', async () => {
        const reportTitle = document.querySelector('#employeeTabs .nav-link.active').textContent;
        const content = await generateEmployeeReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${reportTitle}名冊.xls`; a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', async () => {
        const content = await generateEmployeeReportHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });

    // --- 初始載入 ---
    loadAll();
});
