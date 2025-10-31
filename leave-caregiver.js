document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 leave-caregiver.html 存在的獨特元件，來判斷我們是否在預假頁面
    const calendarDiv = document.getElementById('leave-calendar');
    if (!calendarDiv) {
        return; // 如果找不到日曆，代表不在預假頁，直接結束
    }

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral) {
        if (document.referrer.includes('caregiver.html')) {
            backButtonGeneral.href = 'caregiver.html?view=dashboard';
        }
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
    const employeesCollection = 'caregivers';
    const settingsCollection = 'caregiver_leave_settings';
    const requestsCollection = 'caregiver_leave_requests';
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
                statusNotice.textContent = `${getText('leave_period_open')} ${settings.startDate.replace('T', ' ')} - ${settings.endDate.replace('T', ' ')}`;
            } else {
                isRequestPeriodOpen = false;
                statusNotice.className = 'alert alert-warning';
                statusNotice.textContent = `${getText('leave_period_closed')} ${settings.startDate ? settings.startDate.replace('T', ' ') : '未設定'} - ${settings.endDate ? settings.endDate.replace('T', ' ') : '未設定'}`;
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
            const requestsByDate = {};
            snapshot.forEach(doc => {
                requestsByDate[doc.id] = doc.data();
            });
            const sortedDates = Object.keys(requestsByDate).sort();
            if (sortedDates.length === 0) {
                adminSummaryTableDiv.innerHTML = '<p class="text-center text-muted">下個月尚無預假/預班紀錄。</p>';
                return;
            }
            let tableHTML = '<table class="table table-sm table-bordered"><thead><tr><th>日期</th><th>預排人員及班別</th></tr></thead><tbody>';
            sortedDates.forEach(date => {
                const dailyRequests = requestsByDate[date];
                const entries = Object.entries(dailyRequests).map(([name, shift]) => `${name}: ${shift}`);
                tableHTML += `<tr><td>${date}</td><td>${entries.join(', ')}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            adminSummaryTableDiv.innerHTML = tableHTML;
        } catch (error) {
            console.error("渲染管理員視圖失敗:", error);
            adminViewPanel.innerHTML = '<div class="alert alert-danger">讀取總覽資料失敗。</div>';
        }
    }
    
    // 🔧(更新) 重新設計列印模板：A4 橫向、自動適印寬、標準版（平衡）、D/N/OF 顯示
    async function generateCaregiverReportHTML() {
        const db = firebase.firestore();

        // 依畫面所選年月（若無選擇則用現在時間）
        const yearSelect = document.getElementById('filterYear') || document.getElementById('yearSelect');
        const monthSelect = document.getElementById('filterMonth') || document.getElementById('monthSelect');
        const today = new Date();
        const year = yearSelect ? Number(yearSelect.value) : today.getFullYear();
        const month = monthSelect ? Number(monthSelect.value) : (today.getMonth() + 1);

        // 月天數
        const daysInMonth = new Date(year, month, 0).getDate();

        // 取得照服員名單（依員編排序）
        const caregivers = [];
        const caregiversSnap = await db.collection('caregivers').orderBy('id').get();
        caregiversSnap.forEach(doc => {
            const d = doc.data();
            caregivers.push({
                empId: d.id || "",
                name: d.name || ""
            });
        });

        // 整理照服員每一天的班別：D/N/OF（空白不顯示）
        const schedule = {};
        caregivers.forEach(c => (schedule[c.empId] = {}));

        const requestSnap = await db.collection('caregiver_leave_requests').get(); // 🆕 不過濾 status（支援無審核）

        requestSnap.forEach(doc => {
            const d = doc.data();

            // 🆕 自動偵測是否有審核欄位：有則只顯示「審核通過」，沒有就全部顯示
            const hasStatusField = Object.prototype.hasOwnProperty.call(d, 'status');
            if (hasStatusField && d.status !== '審核通過') return;

            const dateStr = d.date || d.leaveDate;
            if (!dateStr) return;

            const dateObj = new Date(dateStr);
            if (isNaN(dateObj)) return;

            const y = dateObj.getFullYear();
            const m = dateObj.getMonth() + 1;
            const day = dateObj.getDate();

            if (y === year && m === month) {
                const empId = d.empId || d.applicantId || d.id;
                if (!schedule[empId]) return;
                let code = (d.shift || d.code || "").toString().trim().toUpperCase();

                // 🆕 OFF -> OF 規則
                if (code === 'OFF') code = 'OF';

                schedule[empId][day] = code || ""; // 直接顯示 D / N / OF 或空白
            }
        });

        // 產生表頭 1~31
        const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => `<th class="c day">${i + 1}</th>`).join("");

        // 每位照服員生成一列
        const rows = caregivers.map(c => {
            const tds = [];
            for (let d = 1; d <= daysInMonth; d++) {
                tds.push(`<td class="c cell">${schedule[c.empId][d] || ""}</td>`);
            }
            return `
              <tr class="rowline">
                <td class="c id-col">${c.empId}</td>
                <td class="c name-col">${c.name}</td>
                ${tds.join("")}
              </tr>`;
        }).join("");

        // 完整 HTML（A4 橫向、表格自適印寬、標準版：字級 11.5~12、留白適中）
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>照服員預班總表_${year}_${month}</title>
<style>
  /* === 版面 === */
  @page { size: A4 landscape; margin: 10mm; }
  html, body { height: 100%; }
  body {
    font-family: "Microsoft JhengHei", "Noto Sans CJK TC", Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    margin: 0;
  }

  /* 列印時自動縮放（標準版） */
  @media print {
    body { zoom: 0.92; }       /* 可調 0.88~0.96 視人數多寡調整 */
    table { page-break-inside: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }
  }

  .wrap { padding: 10px 16px; }

  /* 標題 */
  .title {
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    margin: 2px 0 4px 0;
  }
  .sub {
    text-align: center;
    font-size: 15px;
    margin: 0 0 8px 0;
  }

  /* 表格樣式（適印寬 + 標準留白） */
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #000;
    padding: 3px;            /* 標準版內距 */
    font-size: 12px;         /* 標準版字級 */
    word-break: break-all;
  }
  th { background: #e9eefb; color: #000; }
  .c { text-align: center; }

  /* 前兩欄較寬，天數欄均分 */
  .id-col   { width: 22mm; }   /* 員編 */
  .name-col { width: 28mm; }   /* 姓名 */

  .rowline { break-inside: avoid; }
  .cell { letter-spacing: 0.2px; } /* D/N/OF 清晰度 */
</style>
</head>
<body>
  <div class="wrap">
    <div class="title">安泰醫療社團法人附設安泰護理之家</div>
    <div class="sub">照服員預班/預假總表（${year}年 ${month}月）</div>

    <table>
      <thead>
        <tr>
          <th class="c id-col">員編</th>
          <th class="c name-col">姓名</th>
          ${dayHeaders}
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td class="c" colspan="${daysInMonth + 2}">本月無資料</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>`;
    }
    
    /* ==== 匯出 Word / Excel / 列印（維持原綁定，檔名保持A選項） ===== */
    
    async function exportCaregiverWord() {
        const content = await generateCaregiverReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = '照服員預班總表.doc';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async function exportCaregiverExcel() {
        const content = await generateCaregiverReportHTML();
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = '照服員預班總表.xls';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async function printCaregiverReport() {
        const content = await generateCaregiverReportHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
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
    adminSettingsBtn.addEventListener('click', () => {
        adminPasswordInput.value = '';
        adminErrorMsg.classList.add('d-none');
        adminPasswordModal.show();
    });

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
    
    /* ====== 綁定事件：維持既有綁定 ====== */
    if (exportAdminWordBtn) {
        exportAdminWordBtn.addEventListener('click', exportCaregiverWord);
    }
    
    if (exportAdminExcelBtn) {
        exportAdminExcelBtn.addEventListener('click', exportCaregiverExcel);
    }
    
    if (printAdminReportBtn) {
        printAdminReportBtn.addEventListener('click', printCaregiverReport);
    }
    
    loadEmployeesDropdown();
    renderCalendar();
    applyTranslations();
});
