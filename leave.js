document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 leave.html 存在的獨特元件，來判斷我們是否在預假頁面
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) {
        return; // 如果找不到日曆，代表不在預假頁，直接結束
    }

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral) {
        // 檢查是不是從員工系統來的 (透過 referrer)
        if (document.referrer.includes('admin.html')) {
            // 將返回按鈕的連結直接設定為帶有參數的儀表板頁面
            backButtonGeneral.href = 'admin.html?view=dashboard';
            
            const icon = backButtonGeneral.querySelector('i');
            backButtonGeneral.innerHTML = ''; // 清空按鈕內容
            backButtonGeneral.appendChild(icon); // 把圖示加回去
            backButtonGeneral.append(' 返回儀表板'); // 加上新文字
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
    const shiftModalEl = document.getElementById('shift-modal');
    const shiftModal = new bootstrap.Modal(shiftModalEl);
    let currentlyEditingDate = null;
    
    // --- 變數 ---
    const settingsCollection = 'leave_settings'; // 護理師的設定
    const requestsCollection = 'leave_requests'; // 護理師的預假紀錄
    let isRequestPeriodOpen = false;

    // --- 函式定義 ---
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
                statusNotice.textContent = `預假/預班開放中！期間為 ${settings.startDate} 至 ${settings.endDate}。`;
            } else {
                isRequestPeriodOpen = false;
                statusNotice.className = 'alert alert-warning';
                statusNotice.textContent = `目前非預假/預班開放期間。下次開放期間為 ${settings.startDate || '未設定'} 至 ${settings.endDate || '未設定'}。`;
            }
            saveLeaveBtn.disabled = !isRequestPeriodOpen;

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
            
            for (let i = 1; i <= daysInMonth; i++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-day';
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                dayEl.dataset.date = dateStr;

                const dailyRequests = requestsByDate[dateStr] || {};
                let namesHTML = '';
                if (Object.keys(dailyRequests).length > 0) {
                    const names = Object.keys(dailyRequests);
                    if (currentEmployee && names.includes(currentEmployee)) {
                        dayEl.classList.add('selected');
                        const myShift = dailyRequests[currentEmployee];
                        dayEl.classList.add(`shift-${myShift.toLowerCase()}`);
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
        // ... (管理員總覽的邏輯不變) ...
    }
    
    calendarDiv.addEventListener('click', (e) => {
        if (isRequestPeriodOpen) {
            const dayEl = e.target.closest('.calendar-day');
            if (dayEl && !dayEl.classList.contains('disabled')) {
                if (!employeeNameInput.value.trim()) { alert('請先輸入您的姓名！'); employeeNameInput.focus(); return; }
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
        const currentEmployee = employeeNameInput.value.trim();
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

    saveLeaveBtn.addEventListener('click', () => {
        alert('您的預排會在您選擇班別後自動儲存，無需再按此按鈕。');
    });

    employeeNameInput.addEventListener('input', renderCalendar);
    adminSettingsBtn.addEventListener('click', () => adminPasswordModal.show());
    adminLoginBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });
    saveSettingsBtn.addEventListener('click', async () => { /* ... 內容不變 ... */ });

    renderCalendar();
});
