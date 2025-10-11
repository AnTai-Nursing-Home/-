document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 leave.html 存在的獨特元件，來判斷我們是否在預假頁面
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) {
        return; // 如果找不到日曆，代表不在預假頁，直接結束
    }

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral) {
        if (document.referrer.includes('admin.html')) {
            backButtonGeneral.href = 'admin.html?view=dashboard';
            const icon = backButtonGeneral.querySelector('i');
            backButtonGeneral.innerHTML = '';
            backButtonGeneral.appendChild(icon);
            backButtonGeneral.append(' 返回儀表板');
        }
    }
    
    // --- 元件宣告 ---
    const calendarTitle = document.getElementById('calendar-title');
    const statusNotice = document.getElementById('status-notice');
    const employeeNameInput = document.getElementById('employee-name');
    const saveLeaveBtn = document.getElementById('save-leave-btn');
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
    const adminCalendarDiv = document.getElementById('admin-calendar');
    const adminSummaryTableDiv = document.getElementById('admin-summary-table');
    
    // --- 變數 ---
    const settingsCollection = 'leave_settings';
    const requestsCollection = 'leave_requests';
    let isRequestPeriodOpen = false;

    // --- 函式定義 ---
    async function renderCalendar() {
        calendarDiv.innerHTML = '<div class="text-center">讀取中...</div>';
        try {
            const settingsDoc = await db.collection(settingsCollection).doc('period').get();
            const settings = settingsDoc.exists ? settingsDoc.data() : {};
            const startDate = settings.startDate ? new Date(settings.startDate + 'T00:00:00') : null;
            const endDate = settings.endDate ? new Date(settings.endDate + 'T23:59:59') : null;
            const today = new Date();
            if (startDate && endDate && today >= startDate && today <= endDate) {
                isRequestPeriodOpen = true;
                statusNotice.className = 'alert alert-success';
                statusNotice.textContent = `預假開放中！期間為 ${settings.startDate} 至 ${settings.endDate}。`;
            } else {
                isRequestPeriodOpen = false;
                statusNotice.className = 'alert alert-warning';
                statusNotice.textContent = `目前非預假開放期間。下次開放期間為 ${settings.startDate || '未設定'} 至 ${settings.endDate || '未設定'}。`;
            }
            saveLeaveBtn.disabled = !isRequestPeriodOpen;
            const snapshot = await db.collection(requestsCollection).get();
            const leaveRequests = {};
            snapshot.forEach(doc => {
                leaveRequests[doc.id] = doc.data().dates;
            });
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const year = nextMonth.getFullYear();
            const month = nextMonth.getMonth();
            calendarTitle.textContent = `${year}年 ${month + 1}月`;
            calendarDiv.innerHTML = '';
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdays.forEach(day => {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-weekday';
                dayEl.textContent = day;
                calendarDiv.appendChild(dayEl);
            });
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            for (let i = 0; i < firstDayOfWeek; i++) {
                calendarDiv.appendChild(document.createElement('div'));
            }
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const currentEmployee = employeeNameInput.value.trim();
            const requestsByDate = {};
            for (const employee in leaveRequests) {
                if (leaveRequests[employee].length > 0) {
                    leaveRequests[employee].forEach(date => {
                        if (!requestsByDate[date]) { requestsByDate[date] = []; }
                        requestsByDate[date].push(employee);
                    });
                }
            }
            for (let i = 1; i <= daysInMonth; i++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-day';
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                dayEl.dataset.date = dateStr;
                let namesHTML = '';
                if (requestsByDate[dateStr]) {
                    const names = requestsByDate[dateStr];
                    if (currentEmployee && names.includes(currentEmployee)) {
                        dayEl.classList.add('selected');
                    } else {
                        dayEl.classList.add('has-other-requests');
                    }
                    namesHTML = '<ul class="leave-names-list">';
                    names.forEach(name => {
                        const displayName = (currentEmployee && name === currentEmployee) ? `<strong>${name}</strong>` : name;
                        namesHTML += `<li>${displayName}</li>`;
                    });
                    namesHTML += '</ul>';
                }
                dayEl.innerHTML = `<div class="day-number">${i}</div>${namesHTML}`;
                if (!isRequestPeriodOpen) {
                    dayEl.classList.add('disabled');
                }
                calendarDiv.appendChild(dayEl);
            }
        } catch (error) {
            console.error("讀取日曆資料失敗:", error);
            calendarDiv.innerHTML = '<div class="alert alert-danger">讀取日曆失敗，請重新整理。</div>';
        }
    }
    async function renderAdminView() { /* ... 內容不變 ... */ }
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl && !dayEl.classList.contains('disabled')) {
                if (!employeeNameInput.value.trim()) { alert('請先輸入您的姓名！'); employeeNameInput.focus(); return; }
                dayEl.classList.toggle('selected');
            }
        }
    });
    saveLeaveBtn.addEventListener('click', async () => {
        const currentEmployee = employeeNameInput.value.trim();
        if (!currentEmployee) { alert('請先輸入您的姓名！'); return; }
        const selectedEls = calendarDiv.querySelectorAll('.calendar-day.selected');
        const selectedDates = Array.from(selectedEls).map(el => el.dataset.date);
        saveLeaveBtn.disabled = true;
        try {
            await db.collection(requestsCollection).doc(currentEmployee).set({ dates: selectedDates });
            alert(`員工「${currentEmployee}」的預假已儲存！`);
            renderCalendar();
        } catch (error) {
            console.error("儲存預假失敗:", error);
            alert("儲存失敗，請稍後再試。");
        } finally {
            saveLeaveBtn.disabled = false;
        }
    });
    employeeNameInput.addEventListener('input', renderCalendar);
    adminSettingsBtn.addEventListener('click', () => adminPasswordModal.show());
    adminLoginBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });
    saveSettingsBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });

    // --- 初始操作 ---
    renderCalendar();
});
