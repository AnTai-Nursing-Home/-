document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody  = document.getElementById("swapTableBody");

  const leaveModal = new bootstrap.Modal(document.getElementById("leaveModal"));
  const swapModal  = new bootstrap.Modal(document.getElementById("swapModal"));

  // ===== 共用函式 =====
  function showLoading(tbody, colspan) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中...</td></tr>`;
  }

  function getStatusClass(status) {
    if (status === "通過") return "status-通過";
    if (status === "駁回") return "status-駁回";
    return "status-審核中";
  }

  // ===== 請假：載入 =====
  async function loadLeaveRequests(startDate = "", endDate = "") {
    showLoading(leaveBody, 10);
    let query = leaveCol.orderBy("applyDate", "desc");
    if (startDate && endDate) {
      query = query.where("applyDate", ">=", startDate).where("applyDate", "<=", endDate);
    }
    const snap = await query.get();
    leaveBody.innerHTML = "";
    if (snap.empty) {
      leaveBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.leaveType || ""}</td>
        <td>${d.leaveDate || ""}</td>
        <td>${d.shift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>
          <select class="form-select form-select-sm statusSelect ${getStatusClass(d.status)}">
            <option value="審核中" ${d.status === "審核中" ? "selected" : ""}>審核中</option>
            <option value="通過" ${d.status === "通過" ? "selected" : ""}>通過</option>
            <option value="駁回" ${d.status === "駁回" ? "selected" : ""}>駁回</option>
          </select>
        </td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}" placeholder="簽名"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between align-items-center">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      leaveBody.appendChild(tr);

      // 狀態變更
      const statusSelect = tr.querySelector(".statusSelect");
      statusSelect.addEventListener("change", async (e) => {
        const val = e.target.value;
        e.target.className = `form-select form-select-sm statusSelect ${getStatusClass(val)}`;
        await leaveCol.doc(doc.id).update({ status: val });
      });

      // 主管簽名
      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await leaveCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      // 刪除
      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此請假單？")) {
          await leaveCol.doc(doc.id).delete();
          loadLeaveRequests(startDate, endDate);
        }
      });

      // 新增註解
      tr.querySelector(".btn-add-note").addEventListener("click", async () => {
        const input = tr.querySelector(".newNoteInput");
        const val = input.value.trim();
        if (!val) return;
        await leaveCol.doc(doc.id).update({
          notes: firebase.firestore.FieldValue.arrayUnion(val)
        });
        loadLeaveRequests(startDate, endDate);
      });

      // 刪除註解
      tr.querySelectorAll(".btn-del-note").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = parseInt(btn.dataset.i);
          const arr = d.notes || [];
          arr.splice(i, 1);
          await leaveCol.doc(doc.id).update({ notes: arr });
          loadLeaveRequests(startDate, endDate);
        });
      });
    });
  }

  // ===== 調班：載入 =====
  async function loadSwapRequests(startDate = "", endDate = "") {
    showLoading(swapBody, 10);
    let query = swapCol.orderBy("applyDate", "desc");
    if (startDate && endDate) {
      query = query.where("applyDate", ">=", startDate).where("applyDate", "<=", endDate);
    }
    const snap = await query.get();
    swapBody.innerHTML = "";
    if (snap.empty) {
      swapBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }
    snap.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.applyDate || ""}</td>
        <td>${d.applicant || ""}</td>
        <td>${d.swapDate || ""}</td>
        <td>${d.originalShift || ""}</td>
        <td>${d.newShift || ""}</td>
        <td>${d.reason || ""}</td>
        <td>
          <select class="form-select form-select-sm statusSelect ${getStatusClass(d.status)}">
            <option value="審核中" ${d.status === "審核中" ? "selected" : ""}>審核中</option>
            <option value="通過" ${d.status === "通過" ? "selected" : ""}>通過</option>
            <option value="駁回" ${d.status === "駁回" ? "selected" : ""}>駁回</option>
          </select>
        </td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}" placeholder="簽名"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between align-items-center">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      swapBody.appendChild(tr);

      const statusSelect = tr.querySelector(".statusSelect");
      statusSelect.addEventListener("change", async (e) => {
        const val = e.target.value;
        e.target.className = `form-select form-select-sm statusSelect ${getStatusClass(val)}`;
        await swapCol.doc(doc.id).update({ status: val });
      });

      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await swapCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });
      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此調班單？")) {
          await swapCol.doc(doc.id).delete();
          loadSwapRequests(startDate, endDate);
        }
      });
      tr.querySelector(".btn-add-note").addEventListener("click", async () => {
        const input = tr.querySelector(".newNoteInput");
        const val = input.value.trim();
        if (!val) return;
        await swapCol.doc(doc.id).update({
          notes: firebase.firestore.FieldValue.arrayUnion(val)
        });
        loadSwapRequests(startDate, endDate);
      });
      tr.querySelectorAll(".btn-del-note").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = parseInt(btn.dataset.i);
          const arr = d.notes || [];
          arr.splice(i, 1);
          await swapCol.doc(doc.id).update({ notes: arr });
          loadSwapRequests(startDate, endDate);
        });
      });
    });
  }

  // ===== 篩選按鈕 =====
  document.getElementById("filterLeaveBtn").addEventListener("click", () => {
    const s = document.getElementById("leaveStartDate").value;
    const e = document.getElementById("leaveEndDate").value;
    loadLeaveRequests(s, e);
  });
  document.getElementById("filterSwapBtn").addEventListener("click", () => {
    const s = document.getElementById("swapStartDate").value;
    const e = document.getElementById("swapEndDate").value;
    loadSwapRequests(s, e);
  });

  // ===== 新增請假 =====
  document.getElementById("addLeaveBtn").addEventListener("click", () => {
    document.getElementById("leaveApplicant").value = "";
    document.getElementById("leaveType").value = "病假";
    document.getElementById("leaveDate").value = "";
    document.getElementById("leaveShift").value = "";
    document.getElementById("leaveReason").value = "";
    leaveModal.show();
  });
  document.getElementById("saveLeave").addEventListener("click", async () => {
    await leaveCol.add({
      applyDate: new Date().toISOString().slice(0,10),
      applicant: document.getElementById("leaveApplicant").value,
      leaveType: document.getElementById("leaveType").value,
      leaveDate: document.getElementById("leaveDate").value,
      shift: document.getElementById("leaveShift").value,
      reason: document.getElementById("leaveReason").value,
      status: "審核中",
      supervisorSign: "",
      notes: []
    });
    leaveModal.hide();
    loadLeaveRequests();
  });

  // ===== 新增調班 =====
  document.getElementById("addSwapBtn").addEventListener("click", () => {
    document.getElementById("swapApplicant").value = "";
    document.getElementById("swapDate").value = "";
    document.getElementById("swapOldShift").value = "";
    document.getElementById("swapNewShift").value = "";
    document.getElementById("swapReason").value = "";
    swapModal.show();
  });
  document.getElementById("saveSwap").addEventListener("click", async () => {
    await swapCol.add({
      applyDate: new Date().toISOString().slice(0,10),
      applicant: document.getElementById("swapApplicant").value,
      swapDate: document.getElementById("swapDate").value,
      originalShift: document.getElementById("swapOldShift").value,
      newShift: document.getElementById("swapNewShift").value,
      reason: document.getElementById("swapReason").value,
      status: "審核中",
      supervisorSign: "",
      notes: []
    });
    swapModal.hide();
    loadSwapRequests();
  });

  // ===== 匯出與列印 =====
  function exportTableToExcel(tbody, title, rangeTitle = "") {
    const headers = [...tbody.closest("table").querySelectorAll("th")].map(th => th.innerText);
    const rows = [...tbody.querySelectorAll("tr")];
    const data = [
      [`安泰醫療社團法人附設安泰護理之家　${title}`],
      [rangeTitle ? rangeTitle : ""],
      [`列印日期：${new Date().toLocaleDateString()}`],
      [],
      headers.slice(0, headers.length - 1)
    ];
    rows.forEach(r => {
      const cells = [...r.querySelectorAll("td")].slice(0, headers.length - 1).map(td => td.innerText);
      data.push(cells);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function printTable(title, tbody, rangeTitle = "") {
    const rowsHTML = [...tbody.querySelectorAll("tr")].map(tr => {
      const clone = tr.cloneNode(true);
      clone.querySelectorAll("button, input, select").forEach(el => el.remove());
      return `<tr>${clone.innerHTML}</tr>`;
    }).join("");
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        body{font-family:'Microsoft JhengHei';}
        table{width:100%;border-collapse:collapse;}
        th,td{border:1px solid #000;padding:4px;white-space:pre-wrap;word-break:break-all;}
        th{background:#eee;}
        @page{size: landscape;}
      </style></head><body>
      <h3 style="text-align:center;">安泰醫療社團法人附設安泰護理之家　${title}</h3>
      <p style="text-align:center;">${rangeTitle}</p>
      <p style="text-align:right;">列印日期：${new Date().toLocaleDateString()}</p>
      <table>
        ${tbody.closest("table").querySelector("thead").outerHTML}
        <tbody>${rowsHTML}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  // ===== 匯出與列印按鈕 =====
  document.getElementById("exportLeaveExcel").addEventListener("click", () => {
    const s = document.getElementById("leaveStartDate").value;
    const e = document.getElementById("leaveEndDate").value;
    const range = (s && e) ? `(${s} 至 ${e})` : "";
    exportTableToExcel(leaveBody, "請假申請總表", range);
  });
  document.getElementById("exportSwapExcel").addEventListener("click", () => {
    const s = document.getElementById("swapStartDate").value;
    const e = document.getElementById("swapEndDate").value;
    const range = (s && e) ? `(${s} 至 ${e})` : "";
    exportTableToExcel(swapBody, "調班申請總表", range);
  });
  document.getElementById("printLeave").addEventListener("click", () => {
    const s = document.getElementById("leaveStartDate").value;
    const e = document.getElementById("leaveEndDate").value;
    const range = (s && e) ? `(${s} 至 ${e})` : "";
    printTable("請假申請總表", leaveBody, range);
  });
  document.getElementById("printSwap").addEventListener("click", () => {
    const s = document.getElementById("swapStartDate").value;
    const e = document.getElementById("swapEndDate").value;
    const range = (s && e) ? `(${s} 至 ${e})` : "";
    printTable("調班申請總表", swapBody, range);
  });

  // ===== 初次載入 =====
  loadLeaveRequests();
  loadSwapRequests();
});
