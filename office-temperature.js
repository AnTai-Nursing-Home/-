document.addEventListener('DOMContentLoaded', function() {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportContainer = document.getElementById('temperature-report-container');
    const reportControls = document.getElementById('report-controls');
    const exportWordBtn = document.getElementById('export-word-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const printBtn = document.getElementById('print-btn');

    // 設定月份選擇器的預設值為本月
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    monthSelect.value = `${year}-${month}`;

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !monthSelect.value) {
            alert('請先選擇月份！');
            return;
        }
        reportContainer.innerHTML = '<p class="text-center">正在讀取班表並生成體溫紀錄...</p>';

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
                console.error("讀取 Excel 失敗:", error);
                reportContainer.innerHTML = '<p class="text-center text-danger">讀取 Excel 檔案失敗，請確認檔案格式是否正確。</p>';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function generateAndDisplayReport(data) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        let tableHeader = `<tr><th>員編</th><th>姓名</th>`;
        for(let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th>${i}</th>`;
        }
        tableHeader += `</tr>`;
        
        let tableBody = '';
        data.forEach(row => {
            const empId = row[0];
            const empName = row[1];

            if(empId && empName) {
                tableBody += `<tr><td>${empId}</td><td>${empName}</td>`;
                for(let i = 1; i <= daysInMonth; i++) {
                    const shift = row[i + 1] ? String(row[i + 1]).toUpperCase() : ''; // 日期從第3欄開始(索引2)
                    let temp = '';
                    
                    // **** 關鍵修改：智慧判斷邏輯 ****
                    if (shift === 'OFF' || shift === 'OFH') {
                        temp = shift;
                    } else if (shift) { // 只要有班別 (不是 OFF/OFH，也不是空白)，就產生體溫
                        // 現在 "Dd" 也會被包含在此邏輯中
                        temp = (Math.random() * (37.4 - 36.0) + 36.0).toFixed(1);
                    }
                    tableBody += `<td>${temp}</td>`;
                }
                tableBody += `</tr>`;
            }
        });

        const fullTableHTML = `<table class="table table-bordered table-sm text-center report-table"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;
        reportContainer.innerHTML = fullTableHTML;
        reportControls.classList.remove('d-none');
    }

    function generateReportHTML(title) {
        const monthName = monthSelect.value;
        const tableContent = reportContainer.innerHTML;
        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:'BiauKai','標楷體',serif;}@page{size:A4 landscape;margin:15mm;}h1,h2{text-align:center;margin:5px 0;font-weight:bold;}h1{font-size:16pt;}h2{font-size:14pt;}table,th,td{border:1px solid black;padding:2px;text-align:center;font-size:8pt;}.report-table{width:100%;border-collapse:collapse;}</style></head><body><h1>安泰醫療社團法人附設安泰護理之家</h1><h2>${title} (${monthName})</h2>${tableContent}</body></html>`;
    }
    
    exportWordBtn.addEventListener('click', () => {
        const title = "員工體溫紀錄總表";
        const content = generateReportHTML(title);
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `體溫紀錄總表-${monthSelect.value}.doc`; a.click();
        window.URL.revokeObjectURL(url);
    });

    exportExcelBtn.addEventListener('click', () => {
        const title = "員工體溫紀錄總表";
        const content = generateReportHTML(title);
        const blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `體溫紀錄總表-${monthSelect.value}.xls`; a.click();
        window.URL.revokeObjectURL(url);
    });

    printBtn.addEventListener('click', () => {
        const title = "員工體溫紀錄總表";
        const content = generateReportHTML(title);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    });
});
