document.addEventListener('firebase-ready', () => {
    const residentsTableBody = document.getElementById('residents-table-body');
    if (!residentsTableBody) return;

    // --- 元件 ---
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
        const statusInput = document.getElementById('resident-status');
const idNumberInput = document.getElementById('resident-idNumber'); 
    
    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const importStatus = document.getElementById('import-status');

    const collectionName = 'residents';

    // === 床號解析函式（用來正確排序） ===
    function bedToSortValue(bed) {
        if (!bed) return 0;
        const match = bed.match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
        if (!match) return 0;
        const base = parseInt(match[1]);
        const sub = match[2] ? parseFloat("0." + match[2].replace(/\D/g, "")) : 0;
        return base + sub;
    }

    // === 載入與顯示資料 ===
    async function loadAndRenderResidents() {
        residentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">讀取中...</td></tr>';

        try {
            const snapshot = await db.collection(collectionName).get();
            if (snapshot.empty) {
                residentsTableBody.innerHTML =
                    '<tr><td colspan="7" class="text-center">尚無住民資料，請點擊「新增住民」或「從 Excel 匯入」建立資料。</td></tr>';
                return;
            }

            // 收集資料並排序
            const residents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            residents.sort((a, b) => bedToSortValue(a.bedNumber) - bedToSortValue(b.bedNumber));

            // 產生 HTML
            let html = '';
            residents.forEach((r, index) => {
                html += `
                    <tr data-id="${r.id}">
                        <td>${index + 1}</td>
                        <td>${r.id}</td>
                        <td>${r.bedNumber || ''}</td>
                        <td>${r.gender || ''}</td>
                        <td>${r.idNumber || ''}</td>
                        <td>${r.birthday || ''}</td>
                        <td>${r.checkinDate || ''}</td>
                        <td>${r.leaveStatus || ""}</td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-edit">編輯</button>
                            <button class="btn btn-sm btn-danger btn-delete">刪除</button>
                        </td>
                    </tr>`;
            });
            residentsTableBody.innerHTML = html;

        } catch (error) {
            console.error("讀取住民資料失敗:", error);
            residentsTableBody.innerHTML =
                '<tr><td colspan="7"><div class="alert alert-danger">讀取資料失敗，請重新整理頁面。</div></td></tr>';
        }
    }

    // === 儲存資料 ===
    async function handleSave() {
        const name = nameInput.value.trim();
        if (!name) return alert('請填寫住民姓名');

        const residentData = {
            bedNumber: bedNumberInput.value,
            gender: genderInput.value,
            birthday: birthdayInput.value,
            checkinDate: checkinDateInput.value,
            idNumber: idNumberInput.value.trim(),
            leaveStatus: (statusInput ? statusInput.value : "")
        };

        saveResidentBtn.disabled = true;
        try {
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

    // === 匯入 Excel ===
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
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const residents = XLSX.utils.sheet_to_json(worksheet);

                if (residents.length === 0) {
                    importStatus.textContent = '錯誤：Excel 檔案中沒有資料。';
                    return;
                }

                if (!residents[0].hasOwnProperty('姓名')) {
                    importStatus.textContent = '錯誤：缺少必要的「姓名」欄位，請確認欄位標題。';
                    return;
                }

                importStatus.textContent = `偵測到 ${residents.length} 筆資料，正在批次寫入...`;

                const batch = db.batch();
                residents.forEach(r => {
                    const name = String(r.姓名).trim();
                    if (name) {
                        const docRef = db.collection(collectionName).doc(name);
                        const formatDate = (d) =>
                            d instanceof Date ? d.toISOString().split('T')[0] : (d || '');
                        batch.set(docRef, {
                            bedNumber: String(r.床號 || ''),
                            gender: String(r.性別 || ''),
                            idNumber: String(r.身分證字號 || ''), 
                            birthday: formatDate(r.生日),
                            checkinDate: formatDate(r.入住日期),
                                    leaveStatus: String(r['請假/住院'] || ''),
                        });
                    }
                });

                await batch.commit();
                importStatus.className = 'alert alert-success';
                importStatus.textContent = `成功匯入 ${residents.length} 筆住民資料！即將重新載入。`;
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

    // === 事件綁定 ===
    addResidentBtn.addEventListener('click', () => {
        residentModalTitle.textContent = '新增住民';
        residentForm.reset();
        nameInput.disabled = false;
        residentModal.show();
    });

    residentsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const residentId = row.dataset.id;

        if (target.classList.contains('btn-edit')) {
            residentModalTitle.textContent = '編輯住民資料';
            residentForm.reset();
            try {
                const doc = await db.collection(collectionName).doc(residentId).get();
                if (doc.exists) {
                    const d = doc.data();
                    nameInput.value = residentId;
                    nameInput.disabled = true;
                    bedNumberInput.value = d.bedNumber || '';
                    genderInput.value = d.gender || '';
                    idNumberInput.value = d.idNumber || ''; // ✅ 顯示身分證字號
                    birthdayInput.value = d.birthday || '';
                    checkinDateInput.value = d.checkinDate || '';
                    document.getElementById('resident-status').value = d.leaveStatus || '';
                    residentModal.show();
                }
            } catch {
                alert('讀取住民資料失敗！');
            }
        }

        if (target.classList.contains('btn-delete')) {
            if (confirm(`確定要刪除住民「${residentId}」的資料嗎？`)) {
                await db.collection(collectionName).doc(residentId).delete();
                loadAndRenderResidents();
            }
        }
    });

    saveResidentBtn.addEventListener('click', handleSave);
    importExcelBtn.addEventListener('click', () => excelFileInput.click());
    excelFileInput.addEventListener('change', handleExcelImport);

    loadAndRenderResidents();
});
