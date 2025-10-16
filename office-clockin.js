document.addEventListener('DOMContentLoaded', function() {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportContainer = document.getElementById('clockin-report-container');
    const reportControls = document.getElementById('report-controls');

    // --- 班別時間定義 ---
    const shiftTimes = {
        // 護理師
        'D': { start: '08:00', end: '16:00' },
        'E': { start: '16:00', end: '24:00' },
        'N': { start: '00:00', end: '08:00' }, // 跨日班
        // 行政
        'DA': { start: '08:00', end: '17:00' },
        // 照服員
        'D_CAREGIVER': { start: '08:00', end: '20:00' },
        'N_CAREGIVER': { start: '20:00', end: '08:00' }, // 跨日班
        '8-17': { start: '08:00', end: '17:00' },
        // 新增的 Dd 班
        'DD': { start: '08:00', end: '17:00' },
    };
    
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
    
    function generateAndDisplayReport(data) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        let tableHeader = `<tr><th rowspan="2">員編</th><th rowspan="2">姓名</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th colspan="2">${i}</th>`;
        }
        tableHeader += `</tr><tr>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th>上班</th><th>下班</th>`;
        }
        tableHeader += `</tr>`;

        let tableBody = '';
        data.forEach(row => {
            const empId = row[0];
            const empName = row[1];
            if (empId && empName) {
                tableBody += `<tr><td>${empId}</td><td>${empName}</td>`;
                for (let i = 1; i <= daysInMonth; i++) {
                    let shift = row[i + 1] ? String(row[i + 1]).toUpperCase() : '';
                    let clockIn = '';
                    let clockOut = '';

                    let effectiveShift = shift;
                    if (shift.startsWith('D') && shift !== 'DA' && shift !== 'DD') {
                         effectiveShift = 'D';
                    } else if (shift.startsWith('E')) {
                         effectiveShift = 'E';
                    }

                    if (empId.toString().startsWith('C') || empName.includes('照服員')) {
                        if (effectiveShift === 'D') effectiveShift = 'D_CAREGIVER';
                        if (effectiveShift === 'N') effectiveShift = 'N_CAREGIVER';
                    }

                    if (shiftTimes[effectiveShift]) {
                        const shiftInfo = shiftTimes[effectiveShift];
                        clockIn = getRandomTime(shiftInfo.start, 12, true);
                        clockOut = getRandomTime(shiftInfo.end, 12, false);
                    } else if (shift === 'OFF' || shift === 'OFH' || shift === 'OF') {
                        clockIn = shift;
                        clockOut = shift;
                    }
                    tableBody += `<td>${clockIn}</td><td>${clockOut}</td>`;
                }
                tableBody += `</tr>`;
            }
        });

        const fullTableHTML = `<table class="table table-bordered table-sm text-center report-table"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;
        reportContainer.innerHTML = fullTableHTML;
        reportControls.classList.remove('d-none');
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
                const employeeData = rows.slice(2);
                generateAndDisplayReport(employeeData);
            } catch (error) {
                reportContainer.innerHTML = '<p class="text-center text-danger">讀取 Excel 檔案失敗，請確認檔案格式是否正確。</p>';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('export-word-btn').addEventListener('click', () => {
        const title = "員工打卡紀錄總表";
        const content = generateReportHTML(title);
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `打卡紀錄總表-${monthSelect.value}.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });
    document.getElementById('export-excel-btn').addEventListener('click', () => {
        const title = "員工打卡紀錄總表";
        const content = generateReportHTML(title);
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `打卡紀錄總表-${monthSelect.value}.xls`; a.click();
        window.URL.revokeObjectURL(url);
    });
    document.getElementById('print-btn').addEventListener('click', () => {
        const title = "員工打卡紀錄總表";
        const content = generateReportHTML(title);
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
