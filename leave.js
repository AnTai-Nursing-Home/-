document.addEventListener('DOMContentLoaded', function () {
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) { return; }

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
    
    const settingsKey = 'leavePeriodSettings';
    const requestsKey = 'leaveRequests';
    let isRequestPeriodOpen = false;

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
                if (names.includes(currentEmployee)) {
                    dayEl.classList.add('selected');
                } else {
                    dayEl.classList.add('has-other-requests');
                }
                namesHTML = '<ul class="leave-names-list">';
                names.forEach(name => { namesHTML += `<li>${name}</li>`; });
                namesHTML += '</ul>';
            }
            dayEl.innerHTML = `<div class="day-number">${i}</div>${namesHTML}`;
            
            if (!isRequestPeriodOpen) {
                dayEl.classList.add('disabled');
            }
            calendarDiv.appendChild(dayEl);
        }
    }

    function renderAdminView() { /* ... 內容不變 ... */ }
    
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl) {
                if (!employeeNameInput.value.trim()) { alert('請先輸入您的姓名！'); employeeNameInput.focus(); return; }
                dayEl.classList.toggle('selected');
                dayEl.classList.remove('has-other-requests');
            }
        }
    });

    saveLeaveBtn.addEventListener('click', () => { /* ... 內容不變 ... */ });
    employeeNameInput.addEventListener('input', renderCalendar);
    adminSettingsBtn.addEventListener('click', () => adminPasswordModal.show());
    adminLoginBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });
    saveSettingsBtn.addEventListener('click', () => { /* ... 內容不變 ... */ });

    renderCalendar();
});
