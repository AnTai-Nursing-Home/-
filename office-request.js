document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  // === 請假 & 調班集合 ===
  const leaveCol = db.collection("leaveRequests");
  const swapCol = db.collection("swapRequests");

  // 載入資料
  async function loadLeaveRequests() {
    const snap = await leaveCol.orderBy("applyDate", "desc").get();
    leaveBody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td style="white-space: pre-wrap;">${d.reason || ""}</td>
        <td>${d.status || ""}</td>
        <td><input type="text" class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}"></td>
        <td>
          <button class="btn btn-sm btn-danger btn-del">刪除</button>
        </td>`;
      leaveBody.appendChild(tr);

      // 儲存主管簽名
      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await leaveCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      // 刪除
      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定要刪除此申請嗎？")) {
          await leaveCol.doc(doc.id).delete();
          loadLeaveRequests();
        }
      });
    });
  }

  async function loadSwapRequests() {
    const snap = await swapCol.orderBy("applyDate", "desc").get();
    swapBody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td style="white-space: pre-wrap;">${d.reason || ""}</td>
        <td>${d.status || ""}</td>
        <td><input type="text" class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}"></td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      swapBody.appendChild(tr);

      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await swapCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定要刪除此申請嗎？")) {
          await swapCol.doc(doc.id).delete();
          loadSwapRequests();
        }
      });
    });
  }

  loadLeaveRequests();
  loadSwapRequests();

  // === 匯出 ===
  function exportTableToExcel(tableBody, title) {
    const rows = [...tableBody.querySelectorAll("tr")];
    const data = [
      [`安泰醫療社團法人附設安泰護理之家　${title}`],
      [`列印日期：${new Date().toLocaleDateString()}`],
      [],
    ];
    const headers = [...tableBody.closest("table").querySelectorAll("th")].map(th => th.innerText);
    data.push(headers.slice(0, headers.length - 1)); // 不要操作欄

    rows.forEach(r => {
      const cells = [...r.querySelectorAll("td")].slice(0, headers.length - 1).map(td => td.innerText);
      data.push(cells);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!rows'] = data.map(() => ({ hpt: 40 }));
    ws['!cols'] = headers.map(() => ({ wch: 18 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function printTable(title, tableBody) {
    const printWindow = window.open("", "_blank");
    const rows = [...tableBody.querySelectorAll("tr")].map(tr => `<tr>${tr.innerHTML}</tr>`).join("");
    printWindow.document.write(`
      <html><head><title>${title}</title>
      <style>
      body{font-family:'Microsoft JhengHei';}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #000;padding:4px;white-space:pre-wrap;word-break:break-all;}
      th{background:#eee;}
      </style>
      </head><body>
      <h3 style="text-align:center;">安泰醫療社團法人附設安泰護理之家　${title}</h3>
      <p style="text-align:right;">列印日期：${new Date().toLocaleDateString()}</p>
      <table>${tableBody.closest("table").querySelector("thead").outerHTML}${rows}</table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  document.getElementById("exportLeaveExcel").addEventListener("click", () => exportTableToExcel(leaveBody, "請假申請總表"));
  document.getElementById("exportSwapExcel").addEventListener("click", () => exportTableToExcel(swapBody, "調班申請總表"));

  document.getElementById("printLeave").addEventListener("click", () => printTable("請假申請總表", leaveBody));
  document.getElementById("printSwap").addEventListener("click", () => printTable("調班申請總表", swapBody));
});
