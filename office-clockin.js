document.addEventListener('DOMContentLoaded', function() {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportContainer = document.getElementById('clockin-report-container');
    const reportControls = document.getElementById('report-controls');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');

    // --- 班別時間定義 ---
    const shiftTimes = {
        'D': { start: '08:00', end: '16:00' },
        'E': { start: '16:00', end: '24:00' },
        'N': { start: '00:00', end: '08:00' },
        'DA': { start: '08:00', end: '17:00' },
        'D_CAREGIVER': { start: '08:00', end: '20:00' },
        'N_CAREGIVER': { start: '20:00', end: '08:00' },
        '8-17': { start: '08:00', end: '17:00' },
        'DD': { start: '08:00', end: '17:00' },
        'PM': { start: '08:00', end: '12:00' },
        'H': { start: '08:00', end: '18:00' }
    };
    
    let employeeDataCache = []; // 用來暫存從 Excel 讀取的原始資料

    // --- 核心功能函式 ---
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
        if(is24Hour && !before) {
             return "23:" + String(50 + Math.floor(Math.random() * 10)).padStart(2, '0');
        }
        return baseDate.toTimeString().substring(0, 5);
    }
    
    function generateReportData(employeeData) {
        const report = [];
        employeeData.forEach(row => {
            const empId = row[0];
            const empName = row[1];
            if (empId && empName) {
                const dailyRecords = [];
                for (let i = 1; i <= 31; i++) {
                    let shift = row[i + 1] ? String(row[i + 1]).toUpperCase() : '';
                    let clockIn = '';
                    let clockOut = '';
                    let effectiveShift = shift;
                    if (shift.startsWith('D') && shift !== 'DA' && shift !== 'DD') { effectiveShift = 'D'; } 
                    else if (shift.startsWith('E')) { effectiveShift = 'E'; }

                    if (empId.toString().startsWith('C') || empName.includes('照服員')) {
                        if (effectiveShift === 'D') effectiveShift = 'D_CAREGIVER';
                        if (effectiveShift === 'N') effectiveShift = 'N_CAREGIVER';
                    }

                    if (shiftTimes[effectiveShift]) {
                        const shiftInfo = shiftTimes[effectiveShift];
                        clockIn = getRandomTime(shiftInfo.start, 12, true);
                        clockOut = getRandomTime(shiftInfo.end, 12, false);
                    } else if (['OFF', 'OFH', 'OF', 'V', '病', '公'].includes(shift)) {
                        clockIn = shift;
                        clockOut = shift;
                    }
                    // ✅ 新增喪假邏輯（不影響原本 OFF、OF 等規則）
                      else if (shift === '喪' || shift === '喪假') {
                        clockIn = '喪';
                        clockOut = '喪';
                    }
                    dailyRecords.push({ clockIn, clockOut });
                }
                report.push({ empId, empName, dailyRecords });
            }
        });
        return report;
    }

    function generateReportHTML(reportData, forExport = false) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        // **** 關鍵修改：全新的表頭 ****
        let tableHeader = `<tr><th>員編</th><th>姓名</th><th>項目</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th>${i}</th>`;
        }
        tableHeader += `</tr>`;

        let tableBody = '';
        reportData.forEach(employee => {
            let clockInCells = '';
            let clockOutCells = '';
            for (let i = 0; i < daysInMonth; i++) {
                clockInCells += `<td>${employee.dailyRecords[i].clockIn}</td>`;
                clockOutCells += `<td>${employee.dailyRecords[i].clockOut}</td>`;
            }
            // **** 關鍵修改：使用 rowspan 來合併儲存格 ****
            tableBody += `
                <tr>
                    <td rowspan="2">${employee.empId}</td>
                    <td rowspan="2" style="min-width: 80px; writing-mode: vertical-rl;">${employee.empName}</td>
                    <td style="background-color: #f2f2f2;">上班</td>
                    ${clockInCells}
                </tr>
                <tr>
                    <td style="background-color: #f2f2f2;">下班</td>
                    ${clockOutCells}
                </tr>
            `;
        });

        const tableClass = forExport ? '' : 'class="table table-bordered table-sm text-center report-table"';
        const fullTableHTML = `<table ${tableClass}><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;

        if (forExport) {
            const monthName = monthSelect.value;
            const title = "員工打卡紀錄總表";
            return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:'BiauKai','標楷體',serif;}@page{size:A4 landscape;margin:15mm;}h1,h2{text-align:center;margin:5px 0;font-weight:bold;}h1{font-size:16pt;}h2{font-size:14pt;}table,th,td{border:1px solid black;padding:2px;text-align:center;font-size:8pt;border-collapse:collapse;}</style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${title} (${monthName})</h2>${fullTableHTML}</body></html>`;
        }
        
        return fullTableHTML;
    }
    
    // --- 事件監聽器 ---
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !monthSelect.value) {
            alert('請先選擇月份！');
            return;
        }
        reportContainer.innerHTML = '<p class="text-center">正在讀取班表並生成打卡紀錄...</p>';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                employeeDataCache = rows.slice(2);
                const reportData = generateReportData(employeeDataCache);
                const tableHTML = generateReportHTML(reportData, false);
                
                reportContainer.innerHTML = tableHTML;
                reportControls.classList.remove('d-none');
            } catch (error) {
                console.error("處理 Excel 失敗:", error);
                reportContainer.innerHTML = '<p class="text-center text-danger">處理 Excel 檔案失敗，請確認檔案格式是否正確。</p>';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    exportWordBtn.addEventListener('click', () => {
        const reportData = generateReportData(employeeDataCache);
        const content = generateReportHTML(reportData, true);
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `打卡紀錄總表-${monthSelect.value}.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });
    
    exportExcelBtn.addEventListener('click', () => {
        const reportData = generateReportData(employeeDataCache);
        const content = generateReportHTML(reportData, true);
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `打卡紀錄總表-${monthSelect.value}.xls`; a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', () => {
        const reportData = generateReportData(employeeDataCache);
        const content = generateReportHTML(reportData, true);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });
    
    // --- 初始操作 ---
    const today = new Date();
    monthSelect.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
});
