document.addEventListener('firebase-ready', () => {
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) return;

    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('caregiver.html')) {
        backButtonGeneral.href = 'caregiver.html';
    }
    
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
    
    const settingsCollection = 'caregiver_leave_settings';
    const requestsCollection = 'caregiver_leave_requests';
    let isRequestPeriodOpen = false;

    async function renderCalendar() {
        calendarDiv.innerHTML = `<div class="text-center">${getText('loading')}...</div>`;
        try {
            const settingsDoc = await db.collection(settingsCollection).doc('period').get();
            const settings = settingsDoc.exists ? settingsDoc.data() : {};
            const startDate = settings.startDate ? new Date(settings.startDate + 'T00:00:00') : null;
            const endDate = settings.endDate ? new Date(settings.endDate + 'T23:59:59') : null;
            const today = new Date();
            if (startDate && endDate && today >= startDate && today <= endDate) {
                isRequestPeriodOpen = true;
                statusNotice.className = 'alert alert-success';
                statusNotice.textContent = `${getText('leave_period_open')} ${settings.startDate} ${getText('to')} ${settings.endDate}`;
            } else {
                isRequestPeriodOpen = false;
                statusNotice.className = 'alert alert-warning';
                statusNotice.textContent = `${getText('leave_period_closed')} ${settings.startDate || getText('not_set')} ${getText('to')} ${settings.endDate || getText('not_set')}`;
            }
            saveLeaveBtn.disabled = !isRequestPeriodOpen;

            const snapshot = await db.collection(requestsCollection).get();
            const leaveRequests = {};
            snapshot.forEach(doc => { leaveRequests[doc.id] = doc.data().dates; });
            
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const year = nextMonth.getFullYear();
            const month = nextMonth.getMonth();
            const lang = getLanguage();
            if (lang === 'en') {
                const monthName = nextMonth.toLocaleString('en-US', { month: 'long' });
                calendarTitle.textContent = `${monthName} ${year}`;
            } else {
                calendarTitle.textContent = `${year}${getText('calendar_title_prefix')} ${month + 1}${getText('calendar_title_suffix')}`;
            }

            calendarDiv.innerHTML = '';
            const weekdays = [getText('week_sun'), getText('week_mon'), getText('week_tue'), getText('week_wed'), getText('week_thu'), getText('week_fri'), getText('week_sat')];
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
            calendarDiv.innerHTML = `<div class="alert alert-danger">${getText('read_calendar_failed')}</div>`;
        }
    }

    async function renderAdminView() { /* ... 內容不變 ... */ }
    
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl && !dayEl.classList.contains('disabled')) {
                if (!employeeNameInput.value.trim()) { alert(getText('error_enter_name_first')); employeeNameInput.focus(); return; }
                dayEl.classList.toggle('selected');
            }
        }
    });

    saveLeaveBtn.addEventListener('click', async () => {
        const currentEmployee = employeeNameInput.value.trim();
        if (!currentEmployee) { alert(getText('error_enter_name_first')); return; }
        const selectedEls = calendarDiv.querySelectorAll('.calendar-day.selected');
        const selectedDates = Array.from(selectedEls).map(el => el.dataset.date);
        saveLeaveBtn.disabled = true;
        try {
            await db.collection(requestsCollection).doc(currentEmployee).set({ dates: selectedDates });
            alert(`${getText('employee')} "${currentEmployee}" ${getText('leave_saved')}`);
            renderCalendar();
        } catch (error) {
            console.error("儲存預假失敗:", error);
            alert(getText('save_failed'));
        } finally {
            saveLeaveBtn.disabled = false;
        }
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
                adminViewPanel.classList.remove('d-none');
                renderAdminView();
                const settingsDoc = await db.collection(settingsCollection).doc('period').get();
                const settings = settingsDoc.exists ? settingsDoc.data() : {};
                document.getElementById('leave-start-date').value = settings.startDate || '';
                document.getElementById('leave-end-date').value = settings.endDate || '';
            } else {
                adminErrorMsg.classList.remove('d-none');
            }
        } catch (error) {
            console.error(error);
            alert(getText('verification_failed'));
        } finally {
            adminLoginBtn.disabled = false;
            spinner.classList.add('d-none');
            adminPasswordInput.value = '';
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;
        if (!startDate || !endDate) { alert(getText('set_start_end_date')); return; }
        if (new Date(endDate) < new Date(startDate)) { alert(getText('end_date_cannot_be_earlier')); return; }
        saveSettingsBtn.disabled = true;
        try {
            await db.collection(settingsCollection).doc('period').set({ startDate, endDate });
            alert(getText('settings_saved'));
            window.location.reload();
        } catch (error) {
            console.error("儲存設定失敗:", error);
            alert(getText('settings_save_failed'));
        } finally {
            saveSettingsBtn.disabled = false;
        }
    });

    renderCalendar();
});
