document.addEventListener('DOMContentLoaded', function() {
    const monthSelect = document.getElementById('month-select');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const fileInput = document.getElementById('schedule-file-input');
    const reportContainer = document.getElementById('temperature-report-container');
    const reportControls = document.getElementById('report-controls');

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
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 將整個工作表轉換為二維陣列
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // 從第3列開始是員工資料 (索引為2)
            const employeeData = rows.slice(2); 

            generateAndDisplayReport(employeeData);
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
                    const shift = row[i + 1]; // 日期從第3欄開始(索引2)
                    let temp = '';
                    if (shift === 'OFF' || shift === 'OFH') {
                        temp = shift;
                    } else if (shift) { // 只要有班別，就產生體溫
                        // 產生 36.0 到 37.4 之間的隨機體溫，保留一位小數
                        temp = (Math.random() * (37.4 - 36.0) + 36.0).toFixed(1);
                    }
                    tableBody += `<td>${temp}</td>`;
                }
                tableBody += `</tr>`;
            }
        });

        const fullTableHTML = `<table class="table table-bordered table-sm text-center"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>`;
        reportContainer.innerHTML = fullTableHTML;
        reportControls.classList.remove('d-none');
    }
    
    // 報表匯出功能 (之後會完成)
    document.getElementById('export-word-btn').addEventListener('click', () => alert('匯出 Word 功能將在下一階段完成。'));
    document.getElementById('export-excel-btn').addEventListener('click', () => alert('匯出 Excel 功能將在下一階段完成。'));
    document.getElementById('print-btn').addEventListener('click', () => alert('列印功能將在下一階段完成。'));
});
