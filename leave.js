document.addEventListener('DOMContentLoaded', function () {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarDiv = document.getElementById('leave-calendar');
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
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    
    const settingsKey = 'leavePeriodSettings';
    const requestsKey = 'leaveRequests';

    let isRequestPeriodOpen = false;

    function renderCalendar() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const year = nextMonth.getFullYear();
        const month = nextMonth.getMonth(); // 0-11

        calendarTitle.textContent = `${year}年 ${month + 1}月`;
        calendarDiv.innerHTML = '';
        
        const settings = JSON.parse(localStorage.getItem(settingsKey)) || {};
        const startDate = settings.startDate ? new Date(settings.startDate) : null;
        const endDate = settings.endDate ? new Date(settings.endDate) : null;

        if (startDate && endDate && today >= startDate && today <= new Date(endDate + 'T23:59:59')) {
            isRequestPeriodOpen = true;
            statusNotice.className = 'alert alert-success';
            statusNotice.textContent = `預假開放中！期間為 ${settings.startDate} 至 ${settings.endDate}。`;
        } else {
            isRequestPeriodOpen = false;
            statusNotice.className = 'alert alert-warning';
            statusNotice.textContent = `目前非預假開放期間。下次開放期間為 ${settings.startDate || '未設定'} 至 ${settings.endDate || '未設定'}。`;
        }
        
        saveLeaveBtn.disabled = !isRequestPeriodOpen;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun, 6=Sat

        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-weekday';
            dayEl.textContent = day;
            calendarDiv.appendChild(dayEl);
        });

        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarDiv.appendChild(document.createElement('div'));
        }

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
        
        alert('您的預假已儲存！');
    });

    employeeNameInput.addEventListener('input', renderCalendar);

    // --- Admin Logic ---
    adminSettingsBtn.addEventListener('click', () => adminPasswordModal.show());

    adminLoginBtn.addEventListener('click', async () => {
        const password = adminPasswordInput.value;
        try {
            const response = await fetch('/api/leave-admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            if (response.ok) {
                adminPasswordModal.hide();
                adminSettingsPanel.classList.remove('d-none');
                const settings = JSON.parse(localStorage.getItem(settingsKey)) || {};
                document.getElementById('leave-start-date').value = settings.startDate || '';
                document.getElementById('leave-end-date').value = settings.endDate || '';
            } else {
                adminErrorMsg.classList.remove('d-none');
            }
        } catch (error) {
            console.error(error);
            alert('驗證時發生網路錯誤');
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;
        if (!startDate || !endDate) {
            alert('請設定開始與結束日期');
            return;
        }
        const settings = { startDate, endDate };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        alert('預假期間已儲存！');
        window.location.reload();
    });

    renderCalendar();
});
