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

                // ✅ 自動找到「員編 / 姓名」所在的工作表（避免讀到日期模板或月曆頁）
                let targetSheetName = workbook.SheetNames.find(name => {
                    const ws = workbook.Sheets[name];
                    const a1 = (ws?.A1?.v ?? '').toString().trim();
                    const b1 = (ws?.B1?.v ?? '').toString().trim();
                    return a1.includes('員編') && (b1.includes('姓名') || b1.includes('姓') || b1.includes('名'));
                });

                // 次佳：工作表名稱包含「班表」
                if (!targetSheetName) {
                    targetSheetName = workbook.SheetNames.find(n => /班表/.test(n));
                }

                // 最後退回：第一張
                if (!targetSheetName) targetSheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[targetSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                // ✅ 清掉空白列、移除標題列，並確保至少有「員編、姓名」
                const employeeData = rows
                    .filter(r => r && r.some(v => String(v).trim() !== ''))
                    .filter((r, idx) => idx !== 0) // 去掉第 1 列標題
                    .filter(r => String(r[0]).trim() && String(r[1]).trim());

                generateAndDisplayReport(employeeData);

            } catch (error) {
                console.error("讀取 Excel 失敗:", error);
                reportContainer.innerHTML = '<p class="text-center text-danger">讀取 Excel 檔案失敗，請確認檔案格式是否正確。</p>';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    

// --- 將不同格式的班表統一成 [員編, 姓名, day1..day31] ---
function normalizeScheduleData(rows, daysInMonth) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const isDayHeader = (v) => {
        const n = Number(String(v).trim());
        return Number.isFinite(n) && n >= 1 && n <= 31;
    };

    // 找到標題列（包含「員編」且包含「姓名/姓 名」）
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

    // 找不到標題列就退回預設 A=員編、B=姓名、C 起是日期
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

function generateAndDisplayReport(data) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        let tableHeader = `<tr><th>員編</th><th>姓名</th>`;
        for(let i = 1; i <= daysInMonth; i++) {
            tableHeader += `<th>${i}</th>`;
        }
        tableHeader += `</tr>`;
        
        let tableBody = '';
        const normalized = normalizeScheduleData(data, daysInMonth);

        normalized.forEach(row => {
            const empId = row[0];
            const empName = row[1];

            if(empId && empName) {
                tableBody += `<tr><td>${empId}</td><td>${empName}</td>`;
                for(let i = 1; i <= daysInMonth; i++) {
                    const shift = row[i + 1] ? String(row[i + 1]).toUpperCase() : ''; 
                    let temp = '';
                    
                    // **** 關鍵修改：同步所有班別判斷邏輯 ****
                    if (['OFF', 'OFH', 'OF', 'V', '病', '公'].includes(shift)) {
                        temp = shift;
                    } else if (shift) { // 只要有班別 (不是休假，也不是空白)，就產生體溫
                        // 現在 H, PM, Dd, D1, E2 等都會被包含在此邏輯中
                        temp = (Math.random() * (37.2 - 36.0) + 36.0).toFixed(1);
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
