document.addEventListener('DOMContentLoaded', function () {
    // 透過尋找一個只在 leave.html 存在的獨特元件，來判斷我們是否在預假頁面
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) {
        return; // 如果找不到日曆，代表不在預假頁，直接結束
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
    
    // --- 變數 ---
    const settingsKey = 'leavePeriodSettings';
    const requestsKey = 'leaveRequests';
    let isRequestPeriodOpen = false;

    // --- 函式定義 ---
    function renderCalendar() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const year = nextMonth.getFullYear();
        const month = nextMonth.getMonth();

        calendarTitle.textContent = `${year}年 ${month + 1}月`;
        calendarDiv.innerHTML = '';
        
        const settings = JSON.parse(localStorage.getItem(settingsKey)) || {};
        const startDate = settings.startDate ? new Date(settings.startDate + 'T00:00:00') : null;
        const endDate = settings.endDate ? new Date(settings.endDate + 'T23:59:59') : null;

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
        const leaveRequests = JSON.parse(localStorage.getItem(requestsKey)) || {};
        const currentEmployee = employeeNameInput.value.trim();
        const myLeaveDates = leaveRequests[currentEmployee] || [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dayEl.dataset.date = dateStr;

            if (myLeaveDates.includes(dateStr)) {
                dayEl.classList.add('selected');
            }
            if (!isRequestPeriodOpen) {
                dayEl.classList.add('disabled');
            }
            calendarDiv.appendChild(dayEl);
        }
    }

    // --- 事件監聽器 ---
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen && e.target.classList.contains('calendar-day')) {
            if (!employeeNameInput.value.trim()) {
                alert('請先輸入您的姓名！');
                employeeNameInput.focus();
                return;
            }
            e.target.classList.toggle('selected');
        }
    });

    saveLeaveBtn.addEventListener('click', () => {
        const currentEmployee = employeeNameInput.value.trim();
        if (!currentEmployee) {
            alert('請先輸入您的姓名！');
            return;
        }
        const selectedEls = calendarDiv.querySelectorAll('.calendar-day.selected');
        const selectedDates = Array.from(selectedEls).map(el => el.dataset.date);

        const leaveRequests = JSON.parse(localStorage.getItem(requestsKey)) || {};
        leaveRequests[currentEmployee] = selectedDates;
        localStorage.setItem(requestsKey, JSON.stringify(leaveRequests));
        
        alert(`員工「${currentEmployee}」的預假已儲存！`);
    });

    employeeNameInput.addEventListener('input', renderCalendar);

    adminSettingsBtn.addEventListener('click', () => adminPasswordModal.show());

    adminLoginBtn.addEventListener('click', async () => {
        const password = adminPasswordInput.value;
        if (!password) { return; }

        const spinner = adminLoginBtn.querySelector('.spinner-border');
        adminLoginBtn.disabled = true;
        spinner.classList.remove('d-none');
        adminErrorMsg.classList.add('d-none');

        try {
            const response = await fetch('/api/leave-admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            if (response.ok) {
                adminPasswordModal.hide();
                adminSettingsPanel.classList.remove('d-none');
                adminHr.classList.remove('d-none');
                const settings = JSON.parse(localStorage.getItem(settingsKey)) || {};
                document.getElementById('leave-start-date').value = settings.startDate || '';
                document.getElementById('leave-end-date').value = settings.endDate || '';
            } else {
                adminErrorMsg.classList.remove('d-none');
            }
        } catch (error) {
            console.error(error);
            alert('驗證時發生網路錯誤，請檢查網路連線或稍後再試。');
        } finally {
            adminLoginBtn.disabled = false;
            spinner.classList.add('d-none');
            adminPasswordInput.value = '';
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;
        if (!startDate || !endDate) {
            alert('請設定開始與結束日期');
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            alert('結束日期不可早於開始日期');
            return;
        }
        const settings = { startDate, endDate };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        alert('預假期間已儲存！頁面將會重新載入以套用新設定。');
        window.location.reload();
    });

    // --- 初始操作 ---
    renderCalendar();
});
