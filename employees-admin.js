document.addEventListener('firebase-ready', () => {
    const nursesTableBody = document.getElementById('nurses-table-body');
    if (!nursesTableBody) return; // 頁面偵測

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
    const nursesTab = document.getElementById('nurses-tab');
    
    // --- 變數 ---
    const nursesCollection = 'nurses';
    const caregiversCollection = 'caregivers';
    let currentEditingId = null;

    // --- 函式 ---
    async function loadAndRenderEmployees(collectionName, tableBody) {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center">讀取中...</td></tr>`;
        try {
            const snapshot = await db.collection(collectionName).orderBy('id').get();
            if (snapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="3" class="text-center">尚無資料。</td></tr>`;
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const employee = doc.data();
                html += `<tr data-id="${doc.id}"><td>${employee.id}</td><td>${employee.name}</td><td><button class="btn btn-sm btn-primary btn-edit">編輯</button> <button class="btn btn-sm btn-danger btn-delete">刪除</button></td></tr>`;
            });
            tableBody.innerHTML = html;
        } catch (error) {
            console.error(`讀取 ${collectionName} 資料失敗:`, error);
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">讀取失敗！</td></tr>`;
        }
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
        const type = employeeTypeInput.value;
        if (!id || !name) { alert('請填寫員編和姓名！'); return; }

        const collectionName = (type === 'nurse') ? nursesCollection : caregiversCollection;
        
        saveEmployeeBtn.disabled = true;
        try {
            // 如果是編輯，且ID被修改，需要先刪除舊的再新增
            if (currentEditingId && currentEditingId !== id) {
                await db.collection(collectionName).doc(currentEditingId).delete();
            }
            await db.collection(collectionName).doc(id).set({ id, name });
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
                id: row.cells[0].textContent,
                name: row.cells[1].textContent
            };
            currentEditingId = docId;
            employeeModalTitle.textContent = '編輯員工';
            employeeIdInput.value = employeeData.id;
            employeeNameInput.value = employeeData.name;
            employeeTypeInput.value = (collectionName === nursesCollection) ? 'nurse' : 'caregiver';
            employeeIdInput.disabled = false; // ID可以被修改
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

    // --- 初始載入 ---
    loadAll();
});
