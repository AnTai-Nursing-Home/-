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
            // 從 Firebase 讀取設定
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

            // 從 Firebase 讀取所有預假紀錄
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

    async function renderAdminView() {
        try {
            const snapshot = await db.collection(requestsCollection).get();
            const leaveRequests = {};
            snapshot.forEach(doc => { leaveRequests[doc.id] = doc.data().dates; });
            
            const requestsByDate = {};
            for (const employee in leaveRequests) {
                if (leaveRequests[employee].length > 0) {
                    leaveRequests[employee].forEach(date => {
                        if (!requestsByDate[date]) { requestsByDate[date] = []; }
                        requestsByDate[date].push(employee);
                    });
                }
            }

            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const year = nextMonth.getFullYear();
            const month = nextMonth.getMonth();

            adminCalendarDiv.innerHTML = '';
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdays.forEach(day => {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-weekday';
                dayEl.textContent = day;
                adminCalendarDiv.appendChild(dayEl);
            });

            const firstDayOfWeek = new Date(year, month, 1).getDay();
            for (let i = 0; i < firstDayOfWeek; i++) {
                adminCalendarDiv.appendChild(document.createElement('div'));
            }

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-day admin-day';
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                let namesHTML = '';
                if (requestsByDate[dateStr]) {
                    dayEl.classList.add('has-requests');
                    namesHTML = '<ul>';
                    requestsByDate[dateStr].forEach(name => { namesHTML += `<li>${name}</li>`; });
                    namesHTML += '</ul>';
                }
                dayEl.innerHTML = `<div class="day-number">${i}</div>${namesHTML}`;
                adminCalendarDiv.appendChild(dayEl);
            }

            const sortedDates = Object.keys(requestsByDate).sort();
            if (sortedDates.length === 0) {
                adminSummaryTableDiv.innerHTML = '<p class="text-center text-muted">下個月尚無預假紀錄。</p>';
                return;
            }

            let tableHTML = '<table class="table table-sm table-bordered"><thead><tr><th>日期</th><th>預假人員</th></tr></thead><tbody>';
            sortedDates.forEach(date => {
                tableHTML += `<tr><td>${date}</td><td>${requestsByDate[date].join(', ')}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            adminSummaryTableDiv.innerHTML = tableHTML;
        } catch (error) {
            console.error("渲染管理員視圖失敗:", error);
            adminViewPanel.innerHTML = '<div class="alert alert-danger">讀取總覽資料失敗。</div>';
        }
    }
    
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl && !dayEl.classList.contains('disabled')) {
                if (!employeeNameInput.value.trim()) { alert('請先輸入您的姓名！'); employeeNameInput.focus(); return; }
                dayEl.classList.toggle('selected');
                renderCalendar();
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
            alert('驗證時發生網路錯誤，請檢查網路連線或稍後再試。');
        } finally {
            adminLoginBtn.disabled = false;
            spinner.classList.add('d-none');
            adminPasswordInput.value = '';
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;
        if (!startDate || !endDate) { alert('請設定開始與結束日期'); return; }
        if (new Date(endDate) < new Date(startDate)) { alert('結束日期不可早於開始日期'); return; }
        
        saveSettingsBtn.disabled = true;
        try {
            await db.collection(settingsCollection).doc('period').set({ startDate, endDate });
            alert('預假期間已儲存！頁面將會重新載入以套用新設定。');
            window.location.reload();
        } catch (error) {
            console.error("儲存設定失敗:", error);
            alert("儲存失敗，請稍後再試。");
        } finally {
            saveSettingsBtn.disabled = false;
        }
    });

    renderCalendar();
});
