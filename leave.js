document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 leave.html 存在的獨特元件，來判斷我們是否在預假頁面
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) {
        return; // 如果找不到日曆，代表不在預假頁，直接結束
    }

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('admin.html')) {
        backButtonGeneral.href = 'admin.html?view=dashboard';
    }
    
    // --- 元件宣告 ---
    const calendarTitle = document.getElementById('calendar-title');
    const statusNotice = document.getElementById('status-notice');
    const employeeNameSelect = document.getElementById('employee-name-select');
    const employeeIdDisplay = document.getElementById('employee-id-display');
    const adminSettingsBtn = document.getElementById('admin-settings-btn');
    const adminPasswordModalEl = document.getElementById('admin-password-modal');
    const adminPasswordModal = new bootstrap.Modal(adminPasswordModalEl);
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPasswordInput = document.getElementById('admin-password-input');
    const adminErrorMsg = document.getElementById('admin-error-msg');
    const adminSettingsPanel = document.getElementById('admin-settings-panel');
    const adminHr = document.getElementById('admin-hr');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const adminViewPanel = document.getElementById('admin-view-panel');
    const adminSummaryTableDiv = document.getElementById('admin-summary-table');
    const shiftModalEl = document.getElementById('shift-modal');
    const shiftModal = new bootstrap.Modal(shiftModalEl);
    const exportAdminWordBtn = document.getElementById('export-admin-word');
    const exportAdminExcelBtn = document.getElementById('export-admin-excel');
    const printAdminReportBtn = document.getElementById('print-admin-report');
    let currentlyEditingDate = null;
    
    // --- 變數 ---
    const employeesCollection = 'nurses';
    const settingsCollection = 'leave_settings';
    const requestsCollection = 'leave_requests';
    let isRequestPeriodOpen = false;
    let employeesData = {};

    // --- 函式定義 ---
    async function loadEmployeesDropdown() {
        employeeNameSelect.innerHTML = `<option value="">讀取中...</option>`;
        try {
            const snapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
            let optionsHTML = `<option value="" selected disabled>請選擇姓名</option>`;
            snapshot.forEach(doc => {
                const emp = doc.data();
                employeesData[emp.name] = emp;
                optionsHTML += `<option value="${emp.name}">${emp.name}</option>`;
            });
            employeeNameSelect.innerHTML = optionsHTML;
        } catch (error) {
            console.error("讀取員工列表失敗:", error);
            employeeNameSelect.innerHTML = `<option value="">讀取失敗</option>`;
        }
    }

    async function renderCalendar() {
        calendarDiv.innerHTML = '<div class="text-center">讀取中...</div>';
        try {
            const settingsDoc = await db.collection(settingsCollection).doc('period').get();
            const settings = settingsDoc.exists ? settingsDoc.data() : {};
            const startDate = settings.startDate ? new Date(settings.startDate) : null;
            const endDate = settings.endDate ? new Date(settings.endDate) : null;
            const today = new Date();

            if (startDate && endDate && today >= startDate && today <= endDate) {
                isRequestPeriodOpen = true;
                statusNotice.className = 'alert alert-success';
                statusNotice.textContent = `預假/預班開放中！期間： ${settings.startDate.replace('T', ' ')} 至 ${settings.endDate.replace('T', ' ')}`;
            } else {
                isRequestPeriodOpen = false;
                statusNotice.className = 'alert alert-warning';
                statusNotice.textContent = `目前非預假/預班開放期間。下次開放： ${settings.startDate ? settings.startDate.replace('T', ' ') : '未設定'} 至 ${settings.endDate ? settings.endDate.replace('T', ' ') : '未設定'}`;
            }

            const currentEmployee = employeeNameSelect.value;
            employeeIdDisplay.value = employeesData[currentEmployee]?.id || '';

            const snapshot = await db.collection(requestsCollection).get();
            const requestsByDate = {};
            snapshot.forEach(doc => {
                requestsByDate[doc.id] = doc.data();
            });
            
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const year = nextMonth.getFullYear();
            const month = nextMonth.getMonth();
            calendarTitle.textContent = `${year}年 ${month + 1}月`;
            calendarDiv.innerHTML = '';

            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdays.forEach(day => { /* ... */ });

            const firstDayOfWeek = new Date(year, month, 1).getDay();
            for (let i = 0; i < firstDayOfWeek; i++) { calendarDiv.appendChild(document.createElement('div')); }

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            for (let i = 1; i <= daysInMonth; i++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-day';
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                dayEl.dataset.date = dateStr;

                const dailyRequests = requestsByDate[dateStr] || {};
                let namesHTML = '';
                if (Object.keys(dailyRequests).length > 0) {
                    const names = Object.keys(dailyRequests).sort();
                    if (currentEmployee && names.includes(currentEmployee)) {
                        dayEl.classList.add('selected');
                        const myShift = dailyRequests[currentEmployee];
                        dayEl.classList.add(`shift-${String(myShift).toLowerCase()}`);
                    } else {
                        dayEl.classList.add('has-other-requests');
                    }
                    namesHTML = '<ul class="leave-names-list">';
                    names.forEach(name => {
                        const shift = dailyRequests[name];
                        const displayName = (currentEmployee && name === currentEmployee) ? `<strong>${name}</strong>` : name;
                        namesHTML += `<li>${displayName}: ${shift}</li>`;
                    });
                    namesHTML += '</ul>';
                }
                dayEl.innerHTML = `<div class="day-number">${i}</div>${namesHTML}`;
                
                if (!isRequestPeriodOpen) { dayEl.classList.add('disabled'); }
                calendarDiv.appendChild(dayEl);
            }
        } catch (error) {
            console.error("讀取日曆資料失敗:", error);
            calendarDiv.innerHTML = '<div class="alert alert-danger">讀取日曆失敗，請重新整理。</div>';
        }
    }

    async function renderAdminView() { /* ... 內容不變 ... */ }
    
    async function generateProfessionalReportHTML() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const year = nextMonth.getFullYear();
        const month = nextMonth.getMonth();
        const monthName = `${year}年 ${month + 1}月`;
        
        const reqSnapshot = await db.collection(requestsCollection).get();
        const requestsByDate = {};
        reqSnapshot.forEach(doc => { requestsByDate[doc.id] = doc.data(); });
        
        const empSnapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
        const sortedEmployees = [];
        empSnapshot.forEach(doc => sortedEmployees.push(doc.data()));

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let tableHeaderHTML = '<tr><th>員編</th><th>姓名</th>';
        for (let i = 1; i <= daysInMonth; i++) { tableHeaderHTML += `<th>${i}</th>`; }
        tableHeaderHTML += '</tr>';

        let tableBodyHTML = '';
        sortedEmployees.forEach(employee => {
            if (!employee.id || !employee.name) return;
            tableBodyHTML += `<tr><td>${employee.id}</td><td>${employee.name}</td>`;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const shift = requestsByDate[dateStr]?.[employee.name] || '';
                tableBodyHTML += `<td>${shift}</td>`;
            }
            tableBodyHTML += '</tr>';
        });

        const tableContent = `<table><thead>${tableHeaderHTML}</thead><tbody>${tableBodyHTML}</tbody></table>`;
        const title = "護理師預假/預班總表";
        return `<!DOCTYPE html><html>...<body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${title} (${monthName})</h2>${tableContent}</body></html>`;
    }

    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl && !dayEl.classList.contains('disabled')) {
                if (!employeeNameSelect.value) { alert('請先選擇您的姓名！'); return; }
                currentlyEditingDate = dayEl.dataset.date;
                document.getElementById('shift-modal-title').textContent = `選擇 ${currentlyEditingDate} 的班別`;
                shiftModal.show();
            }
        }
    });

    shiftModalEl.addEventListener('click', async (e) => {
        if (e.target.classList.contains('shift-btn')) {
            const shift = e.target.dataset.shift;
            await saveShiftForCurrentUser(currentlyEditingDate, shift);
            shiftModal.hide();
        } else if (e.target.id === 'clear-shift-btn') {
            await saveShiftForCurrentUser(currentlyEditingDate, null);
            shiftModal.hide();
        }
    });

    async function saveShiftForCurrentUser(date, shift) {
        const currentEmployee = employeeNameSelect.value;
        if (!currentEmployee || !date) return;
        try {
            const docRef = db.collection(requestsCollection).doc(date);
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                const data = doc.exists ? doc.data() : {};
                if (shift) {
                    data[currentEmployee] = shift;
                } else {
                    delete data[currentEmployee];
                }
                if (Object.keys(data).length > 0) {
                    transaction.set(docRef, data);
                } else {
                    transaction.delete(docRef);
                }
            });
            renderCalendar();
        } catch (error) {
            console.error("儲存班別失敗:", error);
            alert("儲存失敗，請稍後再試。");
        }
    }

    employeeNameSelect.addEventListener('change', renderCalendar);
    adminSettingsBtn.addEventListener('click', () => { /* ... 內容不變 ... */ });
    adminLoginBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });
    saveSettingsBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });
    
    if(exportAdminWordBtn) { exportAdminWordBtn.addEventListener('click', async () => { /* ... */ }); }
    if(exportAdminExcelBtn) { exportAdminExcelBtn.addEventListener('click', async () => { /* ... */ }); }
    if(printAdminReportBtn) { printAdminReportBtn.addEventListener('click', async () => { /* ... */ }); }
    
    loadEmployeesDropdown();
    renderCalendar();
});
