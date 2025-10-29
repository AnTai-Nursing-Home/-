document.addEventListener('firebase-ready', () => {
    const nursesTableBody = document.getElementById('nurses-table-body');
    if (!nursesTableBody) return;

    const caregiversTableBody = document.getElementById('caregivers-table-body');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const employeeModalEl = document.getElementById('employee-modal');
    const employeeModal = new bootstrap.Modal(employeeModalEl);
    const employeeModalTitle = document.getElementById('employee-modal-title');
    const saveEmployeeBtn = document.getElementById('save-employee-btn');
    const employeeForm = document.getElementById('employee-form');

    const employeeIdInput = document.getElementById('employee-id');
    const employeeNameInput = document.getElementById('employee-name');
    const employeeBirthdayInput = document.getElementById('employee-birthday');
    const employeeIdCardInput = document.getElementById('employeeIdCard');
    const employeeHireDateInput = document.getElementById('employeeHireDate');
    const employeeTypeInput = document.getElementById('employee-type');
    const employeeSortOrderInput = document.getElementById('employee-sortOrder');

    const tableHeaders = document.querySelectorAll('.sortable-header');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const importStatus = document.getElementById('import-status');

    const nursesCollection = 'nurses';
    const caregiversCollection = 'caregivers';
    let currentEditingId = null;
    let sortConfig = { key: 'sortOrder', order: 'asc' };

    function formatDateInput(v) {
        if (!v) return "";
        v = v.replace(/\./g, "/").replace(/-/g, "/");
        const parts = v.split("/");
        if (parts.length === 3) {
            let [y, mm, dd] = parts;
            mm = mm.padStart(2, "0");
            dd = dd.padStart(2, "0");
            return `${y}/${mm}/${dd}`;
        }
        return v;
    }

    async function loadAndRenderEmployees(collectionName, tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center">讀取中...</td></tr>`;
        try {
            const snapshot = await db.collection(collectionName)
                .orderBy(sortConfig.key, sortConfig.order)
                .orderBy('id', 'asc')
                .get();

            if (snapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center">尚無資料。</td></tr>`;
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const e = doc.data();
                html += `
                <tr data-id="${doc.id}">
                    <td>${e.sortOrder || 999}</td>
                    <td>${e.id}</td>
                    <td>${e.name}</td>
                    <td>${e.birthday || ''}</td>
                    <td>${e.idCard || ''}</td>
                    <td>${e.hireDate || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-edit">編輯</button>
                        <button class="btn btn-sm btn-danger btn-delete">刪除</button>
                    </td>
                </tr>`;
            });
            tableBody.innerHTML = html;
        } catch (error) {
            console.error("讀取錯誤:", error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">讀取失敗！</td></tr>`;
        }
    }

    function updateHeaderSortUI() {
        tableHeaders.forEach(h => {
            const sortKey = h.dataset.sort;
            h.classList.remove('sort-asc', 'sort-desc');
            if (sortKey === sortConfig.key) {
                h.classList.add(sortConfig.order === 'asc' ? 'sort-asc' : 'sort-desc');
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
        const birthday = formatDateInput(employeeBirthdayInput.value.trim());
        const idCard = employeeIdCardInput.value.trim().toUpperCase();
        const hireDate = formatDateInput(employeeHireDateInput.value.trim());
        const type = employeeTypeInput.value;
        const sortOrder = parseInt(employeeSortOrderInput.value) || 999;

        if (!id || !name) {
            alert("請填寫員編與姓名！");
            return;
        }

        const collectionName = (type === 'nurse') ? nursesCollection : caregiversCollection;

        saveEmployeeBtn.disabled = true;
        try {
            if (currentEditingId && currentEditingId !== id) {
                await db.collection(collectionName).doc(currentEditingId).delete();
            }

            await db.collection(collectionName).doc(id).set({
                id, name, birthday, idCard, hireDate, sortOrder
            });

            employeeModal.hide();
            loadAll();
        } catch {
            alert("儲存失敗！");
        } finally {
            saveEmployeeBtn.disabled = false;
        }
    }

    function loadAll() {
        loadAndRenderEmployees(nursesCollection, nursesTableBody);
        loadAndRenderEmployees(caregiversCollection, caregiversTableBody);
        updateHeaderSortUI();
    }

    async function generateReportHTML() {
        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        const isNurses = activeTab.id === 'nurses-tab';
        const name = isNurses ? "護理師" : "照服員";
        const collection = isNurses ? nursesCollection : caregiversCollection;

        const snapshot = await db.collection(collection)
            .orderBy("sortOrder")
            .orderBy("id", "asc")
            .get();

        let rows = "";
        snapshot.forEach(doc => {
            const e = doc.data();
            rows += `
                <tr>
                    <td>${e.id}</td>
                    <td>${e.name}</td>
                    <td>${e.birthday || ''}</td>
                    <td>${e.idCard || ''}</td>
                    <td>${e.hireDate || ''}</td>
                </tr>`;
        });

        return `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>${name}名冊</title>
        <style>table{width:85%;margin:auto;border-collapse:collapse;text-align:center;font-size:14px;}
        td,th{border:1px solid #000;padding:6px;}h1,h2{text-align:center;}</style>
        </head><body>
        <h1>安泰醫療社團法人附設安泰護理之家</h1>
        <h2>${name}名冊</h2>
        <table><thead><tr>
            <th>員編</th><th>姓名</th><th>生日</th><th>身分證字號</th><th>入職日期</th>
        </tr></thead><tbody>${rows}</tbody></table>
        </body></html>`;
    }

    function excelSerialToDateString(serial) {
        if (!serial || isNaN(serial)) return "";
        const utc_days = serial - 25569;
        const utc_value = utc_days * 86400;
        const date = new Date(utc_value * 1000);
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(date.getUTCDate()).padStart(2, "0");
        return `${y}/${m}/${d}`;
    }

    async function handleExcelImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        const isNurses = activeTab.id === 'nurses-tab';
        const collectionName = isNurses ? nursesCollection : caregiversCollection;
        const label = isNurses ? "護理師" : "照服員";

        importStatus.className = "alert alert-info";
        importStatus.classList.remove('d-none');
        importStatus.textContent = "讀取與匯入中…";

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const list = XLSX.utils.sheet_to_json(sheet);

                if (list.length === 0) {
                    importStatus.textContent = "錯誤：沒有資料！";
                    return;
                }

                const requireCols = ["排序","員編","姓名","生日","身分證字號","入職日期"];
                for (const c of requireCols) {
                    if (!list[0].hasOwnProperty(c)) {
                        importStatus.textContent = `缺少欄位：${c}`;
                        return;
                    }
                }

                const batch = db.batch();
                list.forEach((row) => {
                    const id = String(row.員編).trim();
                    if (!id) return;
                    const ref = db.collection(collectionName).doc(id);
                    batch.set(ref, {
                        id,
                        name: String(row.姓名).trim(),
                        birthday: excelSerialToDateString(row.生日),
                        idCard: String(row.身分證字號).trim().toUpperCase(),
                        hireDate: excelSerialToDateString(row.入職日期),
                        sortOrder: parseInt(row.排序) || 999
                    });
                });

                await batch.commit();
                importStatus.className = "alert alert-success";
                importStatus.textContent = `成功！頁面將重新整理`;
                setTimeout(() => window.location.reload(), 1800);

            } catch (err) {
                console.error(err);
                importStatus.className = "alert alert-danger";
                importStatus.textContent = "Excel匯入失敗！";
            } finally {
                excelFileInput.value = "";
            }
        };

        reader.readAsArrayBuffer(file);
    }

    addEmployeeBtn.onclick = () => {
        const activeTab = document.querySelector('#employeeTabs .nav-link.active');
        employeeTypeInput.value = activeTab.id === 'nurses-tab' ? "nurse" : "caregiver";
        openModalForNew();
    };

    function tableHandler(e, col) {
        const t = e.target;
        const row = t.closest("tr");
        if (!row) return;
        const id = row.dataset.id;

        if (t.classList.contains("btn-edit")) {
            currentEditingId = id;
            employeeModalTitle.textContent = "編輯員工";

            employeeSortOrderInput.value = row.cells[0].textContent;
            employeeIdInput.value = row.cells[1].textContent;
            employeeNameInput.value = row.cells[2].textContent;
            employeeBirthdayInput.value = row.cells[3].textContent;
            employeeIdCardInput.value = row.cells[4].textContent;
            employeeHireDateInput.value = row.cells[5].textContent;
            employeeIdInput.disabled = false;

            employeeTypeInput.value = col === nursesCollection ? "nurse" : "caregiver";
            employeeModal.show();
        }
        else if (t.classList.contains("btn-delete")) {
            if (confirm(`確定刪除 ${id}？`)) {
                db.collection(col).doc(id).delete().then(loadAll);
            }
        }
    }

    nursesTableBody.addEventListener('click', e => tableHandler(e, nursesCollection));
    caregiversTableBody.addEventListener('click', e => tableHandler(e, caregiversCollection));

    saveEmployeeBtn.onclick = handleSave;

    tableHeaders.forEach(h => {
        h.addEventListener("click", () => {
            const k = h.dataset.sort;
            if (sortConfig.key === k)
                sortConfig.order = sortConfig.order === "asc" ? "desc" : "asc";
            else {
                sortConfig.key = k;
                sortConfig.order = "asc";
            }
            loadAll();
        });
    });

    importExcelBtn.onclick = () => excelFileInput.click();
    excelFileInput.onchange = handleExcelImport;

    exportWordBtn.onclick = async () => {
        const content = await generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "人員名冊.doc"; a.click();
        URL.revokeObjectURL(url);
    };

    exportExcelBtn.onclick = async () => {
        const content = await generateReportHTML();
        const blob = new Blob(['\ufeff', content], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "人員名冊.xls"; a.click();
        URL.revokeObjectURL(url);
    };

    printBtn.onclick = async () => {
        const doc = await generateReportHTML();
        const w = window.open("", "_blank");
        w.document.write(doc);
        w.document.close();
        setTimeout(() => w.print(), 500);
    };

    loadAll();
});
