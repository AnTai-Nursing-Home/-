// ✅ V3-Full-Sync — leave-caregiver.js
// 完整整合版 + 匯出月份永遠與日曆顯示月份同步（系統固定顯示「下個月」）
// 重點：doc.id 當日期、姓名比對、sortOrder、OFF→OF、六日淡底、nowrap、一頁化

document.addEventListener('firebase-ready', () => {
  // ===== DOM refs =====
  const calendarDiv = document.getElementById('leave-calendar');
  if (!calendarDiv) return; // 不在此頁則跳出

  const calendarTitle = document.getElementById('calendar-title');
  const statusNotice = document.getElementById('status-notice');
  const employeeNameSelect = document.getElementById('employee-name-select');
  const employeeIdDisplay = document.getElementById('employee-id-display');

  const adminSettingsBtn = document.getElementById('admin-settings-btn');
  const adminPasswordModalEl = document.getElementById('admin-password-modal');
  const adminPasswordModal = adminPasswordModalEl ? new bootstrap.Modal(adminPasswordModalEl) : null;
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminPasswordInput = document.getElementById('admin-password-input');
  const adminErrorMsg = document.getElementById('admin-error-msg');
  const adminSettingsPanel = document.getElementById('admin-settings-panel');
  const adminHr = document.getElementById('admin-hr');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const adminViewPanel = document.getElementById('admin-view-panel');
  const adminSummaryTableDiv = document.getElementById('admin-summary-table');

  const exportAdminWordBtn = document.getElementById('export-admin-word');
  const exportAdminExcelBtn = document.getElementById('export-admin-excel');
  const printAdminReportBtn = document.getElementById('print-admin-report');

  const shiftModalEl = document.getElementById('shift-modal');
  const shiftModal = shiftModalEl ? new bootstrap.Modal(shiftModalEl) : null;
  let currentlyEditingDate = null;

  // ===== Firestore collections =====
  const employeesCollection = 'caregivers';
  const settingsCollection = 'caregiver_leave_settings';
  const requestsCollection = 'caregiver_leave_requests';

  // ===== State =====
  let isRequestPeriodOpen = false;
  let employeesData = {}; // { name: {id, name, sortOrder, ...} }

  // ===== Helpers =====
  const SYS_KEYS = new Set(['status', 'date', 'leaveDate']);
  const getTextSafe = (k, def) => (typeof getText === 'function' ? getText(k) : def);

  function fmtOF(code) {
    const v = String(code || '').trim().toUpperCase();
    return v === 'OFF' ? 'OF' : v; // D/N/OF
  }

  function isWeekendDate(y, m0, d) {
    const day = new Date(y, m0, d).getDay();
    return day === 0 || day === 6;
  }

  // ===== Load employees (dropdown + cache) =====
  async function loadEmployeesDropdown() {
    const db = firebase.firestore();
    if (employeeNameSelect) employeeNameSelect.innerHTML = `<option value="">讀取中...</option>`;
    try {
      const snapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
      let optionsHTML = `<option value="" selected disabled>請選擇姓名</option>`;
      snapshot.forEach(doc => {
        const emp = doc.data();
        if (!emp || !emp.name) return;
        employeesData[emp.name] = emp;
        optionsHTML += `<option value="${emp.name}">${emp.name}</option>`;
      });
      if (employeeNameSelect) employeeNameSelect.innerHTML = optionsHTML;
    } catch (err) {
      console.error('讀取員工列表失敗:', err);
      if (employeeNameSelect) employeeNameSelect.innerHTML = `<option value="">讀取失敗</option>`;
    }
  }

  // ===== Render calendar (always NEXT month) =====
  async function renderCalendar() {
    const db = firebase.firestore();
    calendarDiv.innerHTML = '<div class="text-center">讀取中...</div>';

    try {
      // 預假期間狀態
      if (statusNotice) {
        const settingsDoc = await db.collection(settingsCollection).doc('period').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const startDate = settings.startDate ? new Date(settings.startDate) : null;
        const endDate = settings.endDate ? new Date(settings.endDate) : null;
        const today = new Date();
        if (startDate && endDate && today >= startDate && today <= endDate) {
          isRequestPeriodOpen = true;
          statusNotice.className = 'alert alert-success';
          statusNotice.textContent = `${getTextSafe('leave_period_open','可預班/預假')} ${settings.startDate?.replace?.('T',' ') || ''} - ${settings.endDate?.replace?.('T',' ') || ''}`;
        } else {
          isRequestPeriodOpen = false;
          statusNotice.className = 'alert alert-warning';
          statusNotice.textContent = `${getTextSafe('leave_period_closed','目前非預班/預假期間')} ${settings.startDate ? settings.startDate.replace('T',' ') : '未設定'} - ${settings.endDate ? settings.endDate.replace('T',' ') : '未設定'}`;
        }
      }

      // Always show NEXT month
      const today = new Date();
      const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const y = target.getFullYear();
      const m0 = target.getMonth(); // 0-based
      const m = m0 + 1;
      const daysInMonth = new Date(y, m, 0).getDate();
      if (calendarTitle) calendarTitle.textContent = `${y}年 ${m}月`;

      // 讀取所有請求（以 doc.id 為日期）
      const snap = await db.collection(requestsCollection).get();
      const byDate = {}; // { 'YYYY-MM-DD': { name: 'D' ... } }
      snap.forEach(doc => {
        const id = doc.id; // ← 日期在文件 ID
        const d = new Date(id);
        if (isNaN(d)) return;
        if (d.getFullYear() !== y || (d.getMonth()+1) !== m) return;
        byDate[id] = doc.data() || {};
      });

      // Render grid
      calendarDiv.innerHTML = '';
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      weekdays.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-weekday';
        dayEl.textContent = day;
        calendarDiv.appendChild(dayEl);
      });

      const firstDayOfWeek = new Date(y, m0, 1).getDay();
      for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDiv.appendChild(document.createElement('div'));
      }

      const currentEmployee = employeeNameSelect ? employeeNameSelect.value : '';
      if (employeeIdDisplay && currentEmployee) {
        employeeIdDisplay.value = employeesData[currentEmployee]?.id || '';
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.dataset.date = dateStr;

        const rec = byDate[dateStr] || {};
        const names = Object.keys(rec).filter(k => !SYS_KEYS.has(k)).sort();

        let namesHTML = '';
        if (names.length > 0) {
          if (currentEmployee && names.includes(currentEmployee)) {
            dayEl.classList.add('selected');
            dayEl.classList.add(`shift-${String(rec[currentEmployee]).toLowerCase()}`);
          } else {
            dayEl.classList.add('has-other-requests');
          }
          namesHTML = '<ul class="leave-names-list">';
          names.forEach(name => {
            const shift = fmtOF(rec[name]);
            const dn = (currentEmployee && name === currentEmployee) ? `<strong>${name}</strong>` : name;
            namesHTML += `<li>${dn}: ${shift}</li>`;
          });
          namesHTML += '</ul>';
        }

        dayEl.innerHTML = `<div class="day-number">${d}</div>${namesHTML}`;
        if (!isRequestPeriodOpen) dayEl.classList.add('disabled');
        calendarDiv.appendChild(dayEl);
      }
    } catch (err) {
      console.error('讀取日曆資料失敗:', err);
      calendarDiv.innerHTML = '<div class="alert alert-danger">讀取日曆失敗，請重新整理。</div>';
    }
  }

  // ===== Admin overview =====
  async function renderAdminView() {
    const db = firebase.firestore();
    try {
      const snapshot = await db.collection(requestsCollection).get();
      const rows = [];
      snapshot.forEach(doc => {
        const date = doc.id;
        const d = doc.data() || {};
        const entries = Object.keys(d)
          .filter(k => !SYS_KEYS.has(k))
          .map(name => `${name}: ${fmtOF(d[name])}`);
        rows.push({ date, line: entries.join(', ') });
      });
      rows.sort((a,b) => a.date.localeCompare(b.date));
      if (rows.length === 0) {
        if (adminSummaryTableDiv) adminSummaryTableDiv.innerHTML = '<p class="text-center text-muted">尚無預假/預班紀錄。</p>';
        return;
      }
      let html = '<table class="table table-sm table-bordered"><thead><tr><th>日期</th><th>預排人員及班別</th></tr></thead><tbody>';
      rows.forEach(r => {
        html += `<tr><td>${r.date}</td><td>${r.line}</td></tr>`;
      });
      html += '</tbody></table>';
      if (adminSummaryTableDiv) adminSummaryTableDiv.innerHTML = html;
    } catch (err) {
      console.error('讀取總覽失敗:', err);
      if (adminViewPanel) adminViewPanel.innerHTML = '<div class="alert alert-danger">讀取總覽資料失敗。</div>';
    }
  }

  // ===== Shift modal interactions =====
  if (calendarDiv && shiftModalEl && shiftModal) {
    calendarDiv.addEventListener('click', (e) => {
      if (!isRequestPeriodOpen) return;
      const dayEl = e.target.closest('.calendar-day');
      if (dayEl && !dayEl.classList.contains('disabled')) {
        if (!employeeNameSelect || !employeeNameSelect.value) { alert('請先選擇您的姓名！'); return; }
        currentlyEditingDate = dayEl.dataset.date;
        const titleEl = document.getElementById('shift-modal-title');
        if (titleEl) titleEl.textContent = `選擇 ${currentlyEditingDate} 的班別`;
        shiftModal.show();
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
  }

  async function saveShiftForCurrentUser(date, shift) {
    const db = firebase.firestore();
    const currentEmployee = employeeNameSelect ? employeeNameSelect.value : '';
    if (!currentEmployee || !date) return;
    try {
      const docRef = db.collection(requestsCollection).doc(date);
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const data = doc.exists ? (doc.data() || {}) : {};
        if (shift) {
          data[currentEmployee] = shift;
        } else {
          delete data[currentEmployee];
        }
        if (Object.keys(data).filter(k => !SYS_KEYS.has(k)).length > 0) {
          transaction.set(docRef, data);
        } else {
          transaction.delete(docRef);
        }
      });
      renderCalendar();
    } catch (err) {
      console.error('儲存班別失敗:', err);
      alert('儲存失敗，請稍後再試。');
    }
  }

  // ===== Export (Admin) — Month ALWAYS follows calendar (NEXT month) =====
  async function generateCaregiverReportHTML() {
    const db = firebase.firestore();

    // 🔁 匯出月份一律與日曆同步（下個月）
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // 取得照服員清單（依 sortOrder）
    const caregivers = [];
    const caregiversSnap = await db.collection('caregivers').orderBy('sortOrder').get();
    caregiversSnap.forEach(doc => {
      const d = doc.data();
      if (d && d.name) caregivers.push({ id: d.id || '', name: d.name });
    });

    // 建立姓名為 key 的日曆表
    const schedule = {};
    caregivers.forEach(c => (schedule[c.name] = {}));

    // 讀取請求（以 doc.id 當日期）
    const requestSnap = await db.collection('caregiver_leave_requests').get();
    requestSnap.forEach(doc => {
      const dateStr = doc.id;
      const dt = new Date(dateStr);
      if (isNaN(dt)) return;
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const day = dt.getDate();
      if (y !== year || m !== month) return;

      const data = doc.data() || {};
      // 智能審核：若 root 有 status，僅在通過時輸出
      if (Object.prototype.hasOwnProperty.call(data, 'status') && data.status !== '審核通過') return;

      Object.keys(data).forEach(k => {
        if (SYS_KEYS.has(k)) return;
        if (!schedule.hasOwnProperty(k)) return;
        let code = fmtOF(data[k]);
        schedule[k][day] = code || '';
      });
    });

    // 表頭（週末淡灰底）
    const headCells = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const weekend = isWeekendDate(year, month - 1, d);
      headCells.push(`<th class="c day${weekend ? ' weekend' : ''}">${d}</th>`);
    }

    // 逐列輸出（員編 → 姓名 → 1..31）
    const bodyRows = caregivers.map(c => {
      const tds = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const weekend = isWeekendDate(year, month - 1, d);
        tds.push(`<td class="c cell${weekend ? ' weekend' : ''}">${schedule[c.name][d] || ''}</td>`);
      }
      return `<tr class="rowline">
        <td class="c id-col">${c.id}</td>
        <td class="c name-col">${c.name}</td>
        ${tds.join('')}
      </tr>`;
    }).join('') || `<tr><td class="c" colspan="${daysInMonth + 2}">本月無資料</td></tr>`;

    // 完整 HTML（A4 橫向、一頁化）
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>照服員預班總表_${year}_${month}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: "Microsoft JhengHei","Noto Sans CJK TC",Arial,sans-serif; margin: 0; }
  @media print { body { zoom: 0.90; } }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 3px; font-size: 12px; white-space: nowrap; }
  th { background: #e9eefb; }
  .c { text-align: center; }
  .weekend { background: #f2f2f2 !important; }

  .id-col { width: 22mm; white-space: nowrap; }
  .name-col { width: 32mm; white-space: nowrap; }

  h2, h3 { margin: 2px 0; text-align:center; }
</style>
</head>
<body>
  <h2>安泰醫療社團法人附設安泰護理之家</h2>
  <h3>照服員預班/預假總表（${year}年 ${month}月）</h3>
  <table>
    <thead>
      <tr>
        <th class="c id-col">員編</th>
        <th class="c name-col">姓名</th>
        ${headCells.join('')}
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</body>
</html>`;
  }

  async function exportCaregiverWord() {
    const content = await generateCaregiverReportHTML();
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '照服員預班總表.doc'; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCaregiverExcel() {
    const content = await generateCaregiverReportHTML();
    const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '照服員預班總表.xls'; a.click();
    URL.revokeObjectURL(url);
  }

  async function printCaregiverReport() {
    const content = await generateCaregiverReportHTML();
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  // ===== Bindings =====
  if (employeeNameSelect) employeeNameSelect.addEventListener('change', renderCalendar);
  if (adminSettingsBtn && adminPasswordModal) {
    adminSettingsBtn.addEventListener('click', () => {
      if (adminPasswordInput) adminPasswordInput.value = '';
      if (adminErrorMsg) adminErrorMsg.classList.add('d-none');
      adminPasswordModal.show();
    });
  }
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', async () => {
      const password = adminPasswordInput ? adminPasswordInput.value : '';
      if (!password) return;
      const spinner = adminLoginBtn.querySelector('.spinner-border');
      adminLoginBtn.disabled = true;
      if (spinner) spinner.classList.remove('d-none');
      if (adminErrorMsg) adminErrorMsg.classList.add('d-none');
      try {
        const res = await fetch('/api/leave-admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res.ok) {
          if (adminPasswordModal) adminPasswordModal.hide();
          if (adminSettingsPanel) adminSettingsPanel.classList.remove('d-none');
          if (adminHr) adminHr.classList.remove('d-none');
          if (adminViewPanel) adminViewPanel.classList.remove('d-none');
          renderAdminView();
        } else {
          if (adminErrorMsg) adminErrorMsg.classList.remove('d-none');
        }
      } catch (e) {
        alert('驗證時發生網路錯誤，請稍後再試。');
      } finally {
        adminLoginBtn.disabled = false;
        if (spinner) spinner.classList.add('d-none');
      }
    });
  }
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const db = firebase.firestore();
      const sd = document.getElementById('leave-start-date')?.value;
      const ed = document.getElementById('leave-end-date')?.value;
      if (!sd || !ed) { alert('請設定開始與結束日期'); return; }
      if (new Date(ed) < new Date(sd)) { alert('結束日期不可早於開始日期'); return; }
      saveSettingsBtn.disabled = true;
      try {
        await db.collection(settingsCollection).doc('period').set({ startDate: sd, endDate: ed });
        alert('預假期間已儲存！頁面將重新載入以套用新設定。');
        window.location.reload();
      } catch (e) {
        alert('儲存失敗，請稍後再試。');
      } finally {
        saveSettingsBtn.disabled = false;
      }
    });
  }
  if (exportAdminWordBtn) exportAdminWordBtn.addEventListener('click', exportCaregiverWord);
  if (exportAdminExcelBtn) exportAdminExcelBtn.addEventListener('click', exportCaregiverExcel);
  if (printAdminReportBtn) printAdminReportBtn = printAdminReportBtn?.addEventListener('click', printCaregiverReport);

  // ===== Init =====
  loadEmployeesDropdown();
  renderCalendar();
  if (typeof applyTranslations === 'function') applyTranslations();
});
