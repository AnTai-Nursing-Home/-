document.addEventListener('DOMContentLoaded', function() {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportControls = document.getElementById('report-controls');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');
    const tabNurse = document.getElementById('tab-nurse');
    const tabCare = document.getElementById('tab-care');
    const nurseSection = document.getElementById('nurse-section');
    const careSection = document.getElementById('care-section');
    const nurseReportContainer = document.getElementById('nurse-report-container');
    const careReportContainer = document.getElementById('care-report-container');
    const currentRoleBadge = document.getElementById('current-role-badge');

    const TAB_KEY = 'office_clockin_active_tab';
    let currentTab = localStorage.getItem(TAB_KEY) || 'nurse';
    let nurseDataCache = [];
    let careDataCache = [];

    const shiftTimes = {
        nurse: {
            'D': { start: '08:00', end: '16:00' },
            'E': { start: '16:00', end: '24:00' },
            'N': { start: '00:00', end: '08:00' },
            'DA': { start: '08:00', end: '17:00' },
            'DD': { start: '08:00', end: '17:00' },
            'PM': { start: '08:00', end: '12:00' },
            'H': { start: '08:00', end: '18:00' }
        },
        care: {
            'D': { start: '08:00', end: '20:00' },
            'N': { start: '20:00', end: '08:00' },
            '8-17': { start: '08:00', end: '17:00' },
            '8-18': { start: '08:00', end: '18:00' }
        }
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

    function getRandomTime(baseTime, minuteOffset, before = true) {
        const [hour, minute] = baseTime.split(':').map(Number);
        const is24Hour = hour === 24;
        const effectiveHour = is24Hour ? 23 : hour;
        const effectiveMinute = is24Hour ? 59 : minute;
        const baseDate = new Date(2000, 0, 1, effectiveHour, effectiveMinute);
        const randomMinutes = Math.floor(Math.random() * (minuteOffset + 1));
        if (before) {
            baseDate.setMinutes(baseDate.getMinutes() - randomMinutes);
        } else {
            baseDate.setMinutes(baseDate.getMinutes() + randomMinutes);
        }
        if (is24Hour && !before) {
            return '23:' + String(50 + Math.floor(Math.random() * 10)).padStart(2, '0');
        }
        return baseDate.toTimeString().substring(0, 5);
    }

    function normalizeShift(rawShift, role) {
        let shift = String(rawShift || '').trim().toUpperCase();
        if (!shift) return '';
        if (role === 'nurse') {
            if (shift.startsWith('D') && shift !== 'DA' && shift !== 'DD') return 'D';
            if (shift.startsWith('E')) return 'E';
        }
        if (role === 'care') {
            if (shift === 'D班') return 'D';
            if (shift === 'N班') return 'N';
            if (shift === '8-17' || shift === '8:00-17:00') return '8-17';
            if (shift === '8-18' || shift === '8:00-18:00') return '8-18';
        }
        return shift;
    }

    function generateReportData(employeeData, role) {
        const report = [];
        const roleShiftMap = shiftTimes[role];
        employeeData.forEach(row => {
            const empId = row[0];
            const empName = row[1];
            if (empId && empName) {
                const dailyRecords = [];
                for (let i = 1; i <= 31; i++) {
                    const rawShift = row[i + 1] ? String(row[i + 1]) : '';
                    const shift = normalizeShift(rawShift, role);
                    let clockIn = '';
                    let clockOut = '';

                    if (roleShiftMap[shift]) {
                        const shiftInfo = roleShiftMap[shift];
                        clockIn = getRandomTime(shiftInfo.start, 12, true);
                        clockOut = getRandomTime(shiftInfo.end, 12, false);
                    } else if (['OFF', 'OFH', 'OF', 'V', '病', '公'].includes(shift)) {
                        clockIn = shift;
                        clockOut = shift;
                    } else if (shift === '喪' || shift === '喪假') {
                        clockIn = '喪';
                        clockOut = '喪';
                    } else if (rawShift) {
                        clockIn = rawShift;
                        clockOut = rawShift;
                    }
                    dailyRecords.push({ clockIn, clockOut });
                }
                report.push({ empId, empName, dailyRecords });
            }
        });
        return report;
    }

    function generateTableHTML(reportData) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        let tableHeader = `<tr><th class="sticky-col emp-id-col">員編</th><th class="sticky-col-2 emp-name-col">姓名</th><th>項目</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th>${i}</th>`;
        }
        tableHeader += `</tr>`;

        let tableBody = '';
        reportData.forEach(employee => {
            let clockInCells = '';
            let clockOutCells = '';
            for (let i = 0; i < daysInMonth; i++) {
                clockInCells += `<td>${employee.dailyRecords[i].clockIn || ''}</td>`;
                clockOutCells += `<td>${employee.dailyRecords[i].clockOut || ''}</td>`;
            }
            tableBody += `
                <tr>
                    <td rowspan="2" class="sticky-col emp-id-col">${employee.empId}</td>
                    <td rowspan="2" class="sticky-col-2 emp-name-col">${employee.empName}</td>
                    <td style="background-color:#f2f2f2; font-weight:700;">上班</td>
                    ${clockInCells}
                </tr>
                <tr>
                    <td style="background-color:#f2f2f2; font-weight:700;">下班</td>
                    ${clockOutCells}
                </tr>
            `;
        });

        return `<table class="table table-bordered table-sm text-center report-table align-middle"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;
    }

    function generateExportHTML(reportData, role) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const roleLabel = role === 'nurse' ? '護理師' : '照服員';
        const title = `${roleLabel}打卡紀錄總表`;

        let tableHeader = `<tr><th>員編</th><th>姓名</th><th>項目</th>`;
        for (let i = 1; i <= new Date(year, month, 0).getDate(); i++) tableHeader += `<th>${i}</th>`;
        tableHeader += `</tr>`;

        let tableBody = '';
        reportData.forEach(employee => {
            let clockInCells = '';
            let clockOutCells = '';
            employee.dailyRecords.slice(0, new Date(year, month, 0).getDate()).forEach(d => {
                clockInCells += `<td>${d.clockIn || ''}</td>`;
                clockOutCells += `<td>${d.clockOut || ''}</td>`;
            });
            tableBody += `
                <tr>
                    <td rowspan="2">${employee.empId}</td>
                    <td rowspan="2" style="min-width:80px; writing-mode: vertical-rl; letter-spacing:2px;">${employee.empName}</td>
                    <td>上班</td>
                    ${clockInCells}
                </tr>
                <tr>
                    <td>下班</td>
                    ${clockOutCells}
                </tr>`;
        });

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${title}</title><style>
            body{font-family:'BiauKai','標楷體',serif;}
            @page{size:A4 landscape;margin:12mm;}
            h1,h2{text-align:center;margin:4px 0;font-weight:bold;}
            h1{font-size:16pt;} h2{font-size:14pt;}
            table{width:100%;border-collapse:collapse;}
            th,td{border:1px solid #000;padding:2px;text-align:center;font-size:8pt;}
            td[rowspan]{vertical-align:middle;}
        </style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${title} (${monthSelect.value})</h2><table><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table></body></html>`;
    }


    function getRoleLabel(role) {
        return role === 'nurse' ? '護理師' : '照服員';
    }

    function getDaysInSelectedMonth() {
        const [year, month] = monthSelect.value.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    }

    async function exportStyledExcel(reportData, role) {
        if (typeof ExcelJS === 'undefined') {
            alert('ExcelJS 載入失敗，無法匯出 Excel。');
            return;
        }
        const roleLabel = getRoleLabel(role);
        const daysInMonth = getDaysInSelectedMonth();
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ChatGPT';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet(roleLabel, {
            views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }]
        });

        const totalCols = 3 + daysInMonth;
        const lastCol = excelCol(totalCols);
        sheet.mergeCells(`A1:${lastCol}1`);
        sheet.mergeCells(`A2:${lastCol}2`);
        sheet.getCell('A1').value = '安泰醫療社團法人附設安泰護理之家';
        sheet.getCell('A2').value = `${roleLabel}打卡紀錄總表 (${monthSelect.value})`;
        sheet.getCell('A1').font = { name: '標楷體', size: 16, bold: true };
        sheet.getCell('A2').font = { name: '標楷體', size: 13, bold: true };
        sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 24;
        sheet.getRow(2).height = 22;

        const headerRow = 4;
        sheet.getCell(`A${headerRow}`).value = '員編';
        sheet.getCell(`B${headerRow}`).value = '姓名';
        sheet.getCell(`C${headerRow}`).value = '項目';
        for (let i = 1; i <= daysInMonth; i++) {
            sheet.getCell(headerRow, 3 + i).value = i;
        }

        const border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        for (let c = 1; c <= totalCols; c++) {
            const cell = sheet.getCell(headerRow, c);
            cell.font = { name: '標楷體', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
            cell.border = border;
        }

        let rowIndex = 5;
        reportData.forEach(emp => {
            sheet.mergeCells(`A${rowIndex}:A${rowIndex + 1}`);
            sheet.mergeCells(`B${rowIndex}:B${rowIndex + 1}`);
            sheet.getCell(`A${rowIndex}`).value = emp.empId;
            sheet.getCell(`B${rowIndex}`).value = emp.empName;
            sheet.getCell(`C${rowIndex}`).value = '上班';
            sheet.getCell(`C${rowIndex + 1}`).value = '下班';
            sheet.getCell(`C${rowIndex}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            sheet.getCell(`C${rowIndex + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            for (let i = 0; i < daysInMonth; i++) {
                sheet.getCell(rowIndex, 4 + i).value = emp.dailyRecords[i]?.clockIn || '';
                sheet.getCell(rowIndex + 1, 4 + i).value = emp.dailyRecords[i]?.clockOut || '';
            }
            for (let r = rowIndex; r <= rowIndex + 1; r++) {
                for (let c = 1; c <= totalCols; c++) {
                    const cell = sheet.getCell(r, c);
                    cell.font = { name: '標楷體', size: 10 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = border;
                }
                sheet.getRow(r).height = 22;
            }
            rowIndex += 2;
        });

        sheet.columns = [
            { width: 12 },
            { width: 10 },
            { width: 8 },
            ...Array.from({ length: daysInMonth }, () => ({ width: 8 }))
        ];

        sheet.pageSetup = {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${roleLabel}打卡紀錄總表-${monthSelect.value}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function excelCol(n) {
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    function getActiveCache() {
        return currentTab === 'nurse' ? nurseDataCache : careDataCache;
    }

    function getActiveContainer() {
        return currentTab === 'nurse' ? nurseReportContainer : careReportContainer;
    }

    function updateRoleBadge() {
        if (currentTab === 'nurse') {
            currentRoleBadge.innerHTML = '<i class="fas fa-user-nurse"></i>目前分頁：護理師';
        } else {
            currentRoleBadge.innerHTML = '<i class="fas fa-user"></i>目前分頁：照服員';
        }
    }

    function updateControlsVisibility() {
        const hasData = getActiveCache().length > 0;
        reportControls.classList.toggle('d-none', !hasData);
        reportControls.classList.toggle('d-flex', hasData);
    }

    function renderCurrentTab() {
        nurseSection.classList.toggle('active', currentTab === 'nurse');
        careSection.classList.toggle('active', currentTab === 'care');
        tabNurse.classList.toggle('active', currentTab === 'nurse');
        tabCare.classList.toggle('active', currentTab === 'care');
        updateRoleBadge();
        updateControlsVisibility();
    }

    function switchTab(tab) {
        currentTab = tab;
        localStorage.setItem(TAB_KEY, tab);
        renderCurrentTab();
    }

    uploadBtn.addEventListener('click', () => fileInput.click());
    tabNurse.addEventListener('click', () => switchTab('nurse'));
    tabCare.addEventListener('click', () => switchTab('care'));

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !monthSelect.value) {
            alert('請先選擇月份！');
            fileInput.value = '';
            return;
        }

        const activeContainer = getActiveContainer();
        activeContainer.innerHTML = '<p class="text-center my-4">正在讀取班表並生成打卡紀錄...</p>';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const targetSheetName = pickScheduleSheet(workbook);
                const worksheet = workbook.Sheets[targetSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                const [year, month] = monthSelect.value.split('-').map(Number);
                const daysInMonth = new Date(year, month, 0).getDate();
                const normalized = normalizeScheduleData(rows, daysInMonth);
                const reportData = generateReportData(normalized, currentTab);
                const tableHTML = generateTableHTML(reportData);

                if (currentTab === 'nurse') {
                    nurseDataCache = normalized;
                    nurseReportContainer.innerHTML = tableHTML;
                } else {
                    careDataCache = normalized;
                    careReportContainer.innerHTML = tableHTML;
                }
                updateControlsVisibility();
            } catch (error) {
                console.error('處理 Excel 失敗:', error);
                activeContainer.innerHTML = '<p class="text-center text-danger my-4">處理 Excel 檔案失敗，請確認檔案格式是否正確。</p>';
            } finally {
                fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    exportWordBtn.addEventListener('click', () => {
        const reportData = generateReportData(getActiveCache(), currentTab);
        const content = generateExportHTML(reportData, currentTab);
        const roleLabel = currentTab === 'nurse' ? '護理師' : '照服員';
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${roleLabel}打卡紀錄總表-${monthSelect.value}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', async () => {
        const reportData = generateReportData(getActiveCache(), currentTab);
        await exportStyledExcel(reportData, currentTab);
    });

    printBtn.addEventListener('click', () => {
        const reportData = generateReportData(getActiveCache(), currentTab);
        const content = generateExportHTML(reportData, currentTab);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('無法開啟列印視窗，請確認瀏覽器是否封鎖彈出視窗。');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });

    const today = new Date();
    monthSelect.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    renderCurrentTab();
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
        const foundName = cells.findIndex(c => c.replace(/\s+/g,'').includes('姓名') || (c.replace(/\s+/g,'').includes('姓') && c.replace(/\s+/g,'').includes('名')));
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
