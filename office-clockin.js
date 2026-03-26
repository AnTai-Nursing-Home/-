document.addEventListener('DOMContentLoaded', function () {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportControls = document.getElementById('report-controls');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');

    const emptyBlock = document.getElementById('clockin-empty');
    const tabsWrapper = document.getElementById('clockin-tabs-wrapper');
    const nurseReportContainer = document.getElementById('nurse-report-container');
    const caregiverReportContainer = document.getElementById('caregiver-report-container');
    const nurseCountBadge = document.getElementById('nurse-count-badge');
    const caregiverCountBadge = document.getElementById('caregiver-count-badge');
    const tabButtons = Array.from(document.querySelectorAll('[data-role-tab]'));

    const SHIFT_TIMES = {
        nurse: {
            'D': { start: '08:00', end: '16:00' },
            'E': { start: '16:00', end: '24:00' },
            'N': { start: '00:00', end: '08:00' },
            'DA': { start: '08:00', end: '17:00' },
            'DD': { start: '08:00', end: '17:00' },
            'PM': { start: '08:00', end: '12:00' },
            'H': { start: '08:00', end: '18:00' },
            '8-17': { start: '08:00', end: '17:00' },
            '8-18': { start: '08:00', end: '18:00' }
        },
        caregiver: {
            'D': { start: '08:00', end: '20:00' },
            'N': { start: '20:00', end: '08:00' },
            '8-17': { start: '08:00', end: '17:00' },
            '8-18': { start: '08:00', end: '18:00' },
            'DA': { start: '08:00', end: '17:00' },
            'DD': { start: '08:00', end: '17:00' }
        }
    };

    const LEAVE_CODES = new Set(['OFF', 'OFH', 'OF', 'V', '病', '公', '喪', '喪假']);

    const state = {
        rows: [],
        reportByRole: { nurse: [], caregiver: [] },
        activeRole: 'nurse'
    };

    function pickScheduleSheet(workbook) {
        let name = workbook.SheetNames.find(n => {
            const ws = workbook.Sheets[n];
            const a1 = (ws && ws.A1 && ws.A1.v != null) ? String(ws.A1.v).trim() : '';
            const b1 = (ws && ws.B1 && ws.B1.v != null) ? String(ws.B1.v).trim() : '';
            return a1.includes('員編') && (b1.includes('姓名') || b1.includes('姓') || b1.includes('名'));
        });
        if (!name) name = workbook.SheetNames.find(n => /班表/.test(n));
        return name || workbook.SheetNames[0];
    }

    function getDaysInSelectedMonth() {
        const [year, month] = monthSelect.value.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    }

    function getRandomTime(baseTime, minuteOffset, before = true) {
        const [hour, minute] = baseTime.split(':').map(Number);
        const is24Hour = hour === 24;
        const effectiveHour = is24Hour ? 23 : hour;
        const effectiveMinute = is24Hour ? 59 : minute;
        const baseDate = new Date(2000, 0, 1, effectiveHour, effectiveMinute);
        const randomMinutes = Math.floor(Math.random() * (minuteOffset + 1));
        baseDate.setMinutes(baseDate.getMinutes() + (before ? -randomMinutes : randomMinutes));
        if (is24Hour && !before) {
            return '23:' + String(50 + Math.floor(Math.random() * 10)).padStart(2, '0');
        }
        return baseDate.toTimeString().substring(0, 5);
    }

    function normalizeShift(rawShift) {
        const shift = String(rawShift ?? '').trim().toUpperCase();
        if (!shift) return '';
        if (shift.startsWith('D') && shift !== 'DA' && shift !== 'DD') return 'D';
        if (shift.startsWith('E')) return 'E';
        if (shift.startsWith('N')) return 'N';
        return shift;
    }

    function detectRole(row) {
        const empId = String(row[0] ?? '').trim().toUpperCase();
        const empName = String(row[1] ?? '').trim();
        const dailyShifts = row.slice(2).map(v => String(v ?? '').trim().toUpperCase());

        if (empId.startsWith('C') || /照服|照顧服務員|照服員/.test(empName)) return 'caregiver';

        const caregiverSpecificShifts = ['8-18'];
        if (dailyShifts.some(s => caregiverSpecificShifts.includes(s))) return 'caregiver';

        const caregiverLongDayCount = dailyShifts.filter(s => s === '8-17' || s === '8-18').length;
        if (caregiverLongDayCount >= 6) return 'caregiver';

        return 'nurse';
    }

    function buildDailyRecord(role, rawShift) {
        const normalizedShift = normalizeShift(rawShift);
        if (!normalizedShift) return { shift: '', clockIn: '', clockOut: '' };

        if (LEAVE_CODES.has(normalizedShift)) {
            const leaveLabel = normalizedShift === '喪假' ? '喪' : normalizedShift;
            return { shift: normalizedShift, clockIn: leaveLabel, clockOut: leaveLabel };
        }

        const shiftInfo = SHIFT_TIMES[role][normalizedShift];
        if (!shiftInfo) {
            return { shift: normalizedShift, clockIn: normalizedShift, clockOut: normalizedShift };
        }

        return {
            shift: normalizedShift,
            clockIn: getRandomTime(shiftInfo.start, 12, true),
            clockOut: getRandomTime(shiftInfo.end, 12, false)
        };
    }

    function generateReportData(employeeRows) {
        const daysInMonth = getDaysInSelectedMonth();
        return employeeRows.map(row => {
            const empId = String(row[0] ?? '').trim();
            const empName = String(row[1] ?? '').trim();
            const role = detectRole(row);
            const dailyRecords = [];

            for (let day = 1; day <= daysInMonth; day++) {
                dailyRecords.push(buildDailyRecord(role, row[day + 1]));
            }

            return { empId, empName, role, dailyRecords };
        }).filter(item => item.empId && item.empName);
    }

    function splitReportByRole(reportData) {
        return {
            nurse: reportData.filter(item => item.role === 'nurse'),
            caregiver: reportData.filter(item => item.role === 'caregiver')
        };
    }

    function generateTableHTML(reportData) {
        const daysInMonth = getDaysInSelectedMonth();
        let tableHeader = '<tr><th>員編</th><th>姓名</th><th>項目</th>';
        for (let i = 1; i <= daysInMonth; i++) tableHeader += `<th>${i}</th>`;
        tableHeader += '</tr>';

        let tableBody = '';
        reportData.forEach(employee => {
            let clockInCells = '';
            let clockOutCells = '';

            for (let i = 0; i < daysInMonth; i++) {
                clockInCells += `<td>${employee.dailyRecords[i]?.clockIn ?? ''}</td>`;
                clockOutCells += `<td>${employee.dailyRecords[i]?.clockOut ?? ''}</td>`;
            }

            tableBody += `
                <tr>
                    <td rowspan="2">${escapeHtml(employee.empId)}</td>
                    <td rowspan="2" class="name-cell">${escapeHtml(employee.empName)}</td>
                    <td style="background-color:#f2f2f2;">上班</td>
                    ${clockInCells}
                </tr>
                <tr>
                    <td style="background-color:#f2f2f2;">下班</td>
                    ${clockOutCells}
                </tr>
            `;
        });

        return `<table class="table table-bordered table-sm text-center report-table"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;
    }

    function buildExportHTML(role) {
        const reportData = state.reportByRole[role] || [];
        const monthName = monthSelect.value;
        const title = role === 'nurse' ? '護理師打卡紀錄總表' : '照服員打卡紀錄總表';
        const fullTableHTML = generateTableHTML(reportData);
        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${title}</title><style>
            body{font-family:'BiauKai','標楷體',serif;}
            @page{size:A4 landscape;margin:15mm;}
            h1,h2{text-align:center;margin:5px 0;font-weight:bold;}
            h1{font-size:16pt;}
            h2{font-size:14pt;}
            table{width:100%;border-collapse:collapse;}
            th,td{border:1px solid black;padding:2px;text-align:center;font-size:8pt;}
            .name-cell{min-width:84px;writing-mode:vertical-rl;text-orientation:mixed;}
        </style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${title} (${monthName})</h2>${fullTableHTML}</body></html>`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderRolePanels() {
        nurseReportContainer.innerHTML = state.reportByRole.nurse.length
            ? generateTableHTML(state.reportByRole.nurse)
            : '<div class="report-empty">本月份班表中沒有辨識到護理師資料。</div>';

        caregiverReportContainer.innerHTML = state.reportByRole.caregiver.length
            ? generateTableHTML(state.reportByRole.caregiver)
            : '<div class="report-empty">本月份班表中沒有辨識到照服員資料。</div>';

        nurseCountBadge.textContent = state.reportByRole.nurse.length;
        caregiverCountBadge.textContent = state.reportByRole.caregiver.length;
    }

    function setActiveRole(role) {
        state.activeRole = role;
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.roleTab === role));
        document.getElementById('clockin-pane-nurse').classList.toggle('active', role === 'nurse');
        document.getElementById('clockin-pane-caregiver').classList.toggle('active', role === 'caregiver');
    }

    function showResults() {
        emptyBlock.classList.add('d-none');
        tabsWrapper.classList.remove('d-none');
        reportControls.classList.remove('d-none');
        renderRolePanels();
        setActiveRole(state.reportByRole.nurse.length ? 'nurse' : 'caregiver');
    }

    function showLoading() {
        emptyBlock.classList.remove('d-none');
        emptyBlock.textContent = '正在讀取班表並生成打卡紀錄...';
        tabsWrapper.classList.add('d-none');
        reportControls.classList.add('d-none');
    }

    function showError(message) {
        emptyBlock.classList.remove('d-none');
        emptyBlock.innerHTML = `<span class="text-danger">${escapeHtml(message)}</span>`;
        tabsWrapper.classList.add('d-none');
        reportControls.classList.add('d-none');
    }

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !monthSelect.value) {
            alert('請先選擇月份！');
            return;
        }

        showLoading();

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const targetSheetName = pickScheduleSheet(workbook);
                const worksheet = workbook.Sheets[targetSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                const daysInMonth = getDaysInSelectedMonth();

                state.rows = normalizeScheduleData(rows, daysInMonth);
                const reportData = generateReportData(state.rows);
                state.reportByRole = splitReportByRole(reportData);
                showResults();
            } catch (error) {
                console.error('處理 Excel 失敗:', error);
                showError('處理 Excel 檔案失敗，請確認檔案格式是否正確。');
            }
        };
        reader.readAsArrayBuffer(file);
    });

    exportWordBtn.addEventListener('click', () => {
        const content = buildExportHTML(state.activeRole);
        const roleName = state.activeRole === 'nurse' ? '護理師' : '照服員';
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${roleName}打卡紀錄總表-${monthSelect.value}.doc`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', () => {
        const content = buildExportHTML(state.activeRole);
        const roleName = state.activeRole === 'nurse' ? '護理師' : '照服員';
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${roleName}打卡紀錄總表-${monthSelect.value}.xls`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', () => {
        const content = buildExportHTML(state.activeRole);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    });

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => setActiveRole(btn.dataset.roleTab));
    });

    const today = new Date();
    monthSelect.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
});

function normalizeScheduleData(rows, daysInMonth) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const isDayHeader = (v) => {
        const n = Number(String(v).trim());
        return Number.isFinite(n) && n >= 1 && n <= 31;
    };

    let headerRowIndex = -1;
    let idIdx = -1, nameIdx = -1, dayStartIdx = -1;

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        const cells = row.map(v => String(v ?? '').trim());

        const foundId = cells.findIndex(c => c.includes('員編'));
        const foundName = cells.findIndex(c => c.replace(/\s+/g, '').includes('姓名') || (c.replace(/\s+/g, '').includes('姓') && c.replace(/\s+/g, '').includes('名')));
        if (foundId !== -1 && foundName !== -1) {
            const dayIdx = row.findIndex(v => isDayHeader(v));
            if (dayIdx !== -1) {
                headerRowIndex = r;
                idIdx = foundId;
                nameIdx = foundName;
                dayStartIdx = dayIdx;
                break;
            }
        }
    }

    if (headerRowIndex === -1) {
        headerRowIndex = 0;
        idIdx = 0;
        nameIdx = 1;
        dayStartIdx = 2;
    }

    const out = [];
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        if (!row.some(v => String(v ?? '').trim() !== '')) continue;

        const empId = String(row[idIdx] ?? '').trim();
        const empName = String(row[nameIdx] ?? '').trim();
        if (!empId || !empName) continue;

        const normRow = [empId, empName];
        for (let d = 1; d <= daysInMonth; d++) {
            normRow.push(row[dayStartIdx + (d - 1)] ?? '');
        }
        out.push(normRow);
    }
    return out;
}
