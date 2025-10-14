document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 residents-admin.html 存在的獨特元件，來判斷我們是否在正確的頁面
    const residentsTableBody = document.getElementById('residents-table-body');
    if (!residentsTableBody) {
        return; // 如果找不到，代表不在住民管理頁，直接結束
    }

    // --- 元件宣告 ---
    const addResidentBtn = document.getElementById('add-resident-btn');
    const residentModalEl = document.getElementById('resident-modal');
    const residentModal = new bootstrap.Modal(residentModalEl);
    const residentModalTitle = document.getElementById('resident-modal-title');
    const saveResidentBtn = document.getElementById('save-resident-btn');
    const residentForm = document.getElementById('resident-form');
    
    const nameInput = document.getElementById('resident-name');
    const bedNumberInput = document.getElementById('resident-bedNumber');
    const genderInput = document.getElementById('resident-gender');
    const birthdayInput = document.getElementById('resident-birthday');
    const checkinDateInput = document.getElementById('resident-checkinDate');
    const sortOrderInput = document.getElementById('resident-sortOrder');

    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const importStatus = document.getElementById('import-status');
    const tableHeaders = document.querySelectorAll('.sortable-header');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    
    // --- 變數 ---
    const collectionName = 'residents';
    let currentEditingId = null; 
    let sortConfig = { key: 'sortOrder', order: 'asc' }; // 預設使用自訂排序

    // --- 函式定義 ---
    async function loadAndRenderResidents() {
        residentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">讀取中...</td></tr>';
        try {
            const snapshot = await db.collection(collectionName)
                .orderBy(sortConfig.key, sortConfig.order)
                .orderBy('bedNumber', 'asc') // 當 sortOrder 相同時，用床號做次要排序
                .get();
            
            if (snapshot.empty) {
                residentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">尚無住民資料，請點擊「新增住民」或「從 Excel 匯入」開始建立。</td></tr>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const resident = doc.data();
                html += `
                    <tr data-id="${doc.id}">
                        <td>${resident.sortOrder || 999}</td>
                        <td>${doc.id}</td>
                        <td>${resident.bedNumber || ''}</td>
                        <td>${resident.gender || ''}</td>
                        <td>${resident.birthday || ''}</td>
                        <td>${resident.checkinDate || ''}</td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-edit">編輯</button>
                            <button class="btn btn-sm btn-danger btn-delete">刪除</button>
                        </td>
                    </tr>
                `;
            });
            residentsTableBody.innerHTML = html;
            updateHeaderSortUI();

        } catch (error) {
            console.error("讀取住民資料失敗:", error);
            residentsTableBody.innerHTML = '<tr><td colspan="7"><div class="alert alert-danger">讀取資料失敗，請重新整理頁面。</div></td></tr>';
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
        residentModalTitle.textContent = '新增住民';
        residentForm.reset();
        sortOrderInput.value = 999;
        nameInput.disabled = false;
        residentModal.show();
    }

    async function handleSave() {
        const name = nameInput.value.trim();
        if (!name) {
            alert('請務必填寫住民姓名！');
            return;
        }

        const residentData = {
            bedNumber: bedNumberInput.value,
            gender: genderInput.value,
            birthday: birthdayInput.value,
            checkinDate: checkinDateInput.value,
            sortOrder: parseInt(sortOrderInput.value) || 999
        };

        saveResidentBtn.disabled = true;
        try {
            if (currentEditingId && currentEditingId !== name) {
                await db.collection(collectionName).doc(currentEditingId).delete();
            }
            await db.collection(collectionName).doc(name).set(residentData);
            residentModal.hide();
            loadAndRenderResidents();
        } catch (error) {
            console.error("儲存住民資料失敗:", error);
            alert("儲存失敗，請稍後再試。");
        } finally {
            saveResidentBtn.disabled = false;
        }
    }

    async function handleExcelImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        importStatus.className = 'alert alert-info';
        importStatus.classList.remove('d-none');
        importStatus.textContent = '正在讀取檔案...';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
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

                const batch = db.batch();
                residents.forEach((resident, index) => {
                    const name = String(resident.姓名).trim();
                    if (name) {
                        const docRef = db.collection(collectionName).doc(name);
                        
                        const formatDate = (date) => {
                            if (!date) return '';
                            if (date instanceof Date) {
                                return date.toISOString().split('T')[0];
                            }
                            return String(date);
                        };

                        batch.set(docRef, {
                            bedNumber: String(resident.床號 || ''),
                            gender: String(resident.性別 || ''),
                            birthday: formatDate(resident.生日),
                            checkinDate: formatDate(resident.入住日期),
                            sortOrder: parseInt(resident.排序) || (index + 1) * 10 
                        });
                    }
                });

                await batch.commit();

                importStatus.className = 'alert alert-success';
                importStatus.textContent = `成功匯入 ${residents.length} 筆住民資料！頁面將重新載入。`;
                
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
    addResidentBtn.addEventListener('click', openModalForNew);

    residentsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const residentId = row.dataset.id;

        if (target.classList.contains('btn-edit')) {
            currentEditingId = residentId;
            residentModalTitle.textContent = '編輯住民資料';
            residentForm.reset();
            
            try {
                const docRef = db.collection(collectionName).doc(residentId);
                const doc = await docRef.get();
                if (doc.exists) {
                    const data = doc.data();
                    nameInput.value = residentId;
                    nameInput.disabled = true;
                    bedNumberInput.value = data.bedNumber || '';
                    genderInput.value = data.gender || '';
                    birthdayInput.value = data.birthday || '';
                    checkinDateInput.value = data.checkinDate || '';
                    sortOrderInput.value = data.sortOrder || 999;
                    residentModal.show();
                }
            } catch (error) {
                alert('讀取住民資料失敗！');
            }
        }

        if (target.classList.contains('btn-delete')) {
            if (confirm(`您確定要刪除住民「${residentId}」的資料嗎？\n此操作無法復原！`)) {
                try {
                    await db.collection(collectionName).doc(residentId).delete();
                    loadAndRenderResidents();
                } catch (error) {
                    alert('刪除失敗，請稍後再試。');
                }
            }
        }
    });

    saveResidentBtn.addEventListener('click', handleSave);

    importExcelBtn.addEventListener('click', () => {
        excelFileInput.click();
    });
    excelFileInput.addEventListener('change', handleExcelImport);

    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const newKey = header.dataset.sort;
            if (sortConfig.key === newKey) {
                sortConfig.order = (sortConfig.order === 'asc') ? 'desc' : 'asc';
            } else {
                sortConfig.key = newKey;
                sortConfig.order = 'asc';
            }
            loadAndRenderResidents();
        });
    });
    
    // --- 初始操作 ---
    loadAndRenderResidents();
});
