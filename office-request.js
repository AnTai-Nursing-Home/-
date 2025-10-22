document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  const leaveModal = new bootstrap.Modal(document.getElementById("leaveModal"));
  const swapModal = new bootstrap.Modal(document.getElementById("swapModal"));

  // ===== 載入請假 =====
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
        <td>${d.reason || ""}</td>
        <td>${d.status || ""}</td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      leaveBody.appendChild(tr);

      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await leaveCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此請假單？")) {
          await leaveCol.doc(doc.id).delete();
          loadLeaveRequests();
        }
      });

      tr.querySelector(".btn-add-note").addEventListener("click", async (e) => {
        const noteText = tr.querySelector(".newNoteInput").value.trim();
        if (!noteText) return;
        await leaveCol.doc(doc.id).update({
          notes: firebase.firestore.FieldValue.arrayUnion(noteText)
        });
        loadLeaveRequests();
      });

      tr.querySelectorAll(".btn-del-note").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = parseInt(btn.dataset.i);
          const data = d.notes || [];
          data.splice(i, 1);
          await leaveCol.doc(doc.id).update({ notes: data });
          loadLeaveRequests();
        });
      });
    });
  }

  // ===== 載入調班 =====
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
        <td>${d.reason || ""}</td>
        <td>${d.status || ""}</td>
        <td><input class="form-control form-control-sm supervisorInput" value="${d.supervisorSign || ""}"></td>
        <td>
          ${(d.notes || []).map((n, i) => `
            <div class="note-item d-flex justify-content-between">
              <span>${n}</span>
              <button class="btn btn-sm btn-outline-danger btn-del-note" data-i="${i}" data-id="${doc.id}">×</button>
            </div>`).join("")}
          <input class="form-control form-control-sm mt-1 newNoteInput" placeholder="新增註解">
          <button class="btn btn-sm btn-outline-primary btn-add-note mt-1" data-id="${doc.id}">新增註解</button>
        </td>
        <td><button class="btn btn-sm btn-danger btn-del">刪除</button></td>`;
      swapBody.appendChild(tr);

      tr.querySelector(".supervisorInput").addEventListener("change", async (e) => {
        await swapCol.doc(doc.id).update({ supervisorSign: e.target.value });
      });

      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (confirm("確定刪除此調班單？")) {
          await swapCol.doc(doc.id).delete();
          loadSwapRequests();
        }
      });

      tr.querySelector(".btn-add-note").addEventListener("click", async () => {
        const noteText = tr.querySelector(".newNoteInput").value.trim();
        if (!noteText) return;
        await swapCol.doc(doc.id).update({
          notes: firebase.firestore.FieldValue.arrayUnion(noteText)
        });
        loadSwapRequests();
      });

      tr.querySelectorAll(".btn-del-note").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = parseInt(btn.dataset.i);
          const data = d.notes || [];
          data.splice(i, 1);
          await swapCol.doc(doc.id).update({ notes: data });
          loadSwapRequests();
        });
      });
    });
  }

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
      applyDate: new Date().toISOString().slice(0, 10),
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
      applyDate: new Date().toISOString().slice(0, 10),
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
  function exportTableToExcel(tableBody, title) {
    const rows = [...tableBody.querySelectorAll("tr")];
    const data = [
      [`安泰醫療社團法人附設安泰護理之家　${title}`],
      [`列印日期：${new Date().toLocaleDateString()}`],
      [],
    ];
    const headers = [...tableBody.closest("table").querySelectorAll("th")].map(th => th.innerText);
    data.push(headers.slice(0, headers.length - 1));
    rows.forEach(r => {
      const cells = [...r.querySelectorAll("td")].slice(0, headers.length - 1).map(td => td.innerText);
      data.push(cells);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!rows'] = data.map(() => ({ hpt: 40 }));
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function printTable(title, tableBody) {
    const rows = [...tableBody.querySelectorAll("tr")].map(tr => `<tr>${tr.innerHTML}</tr>`).join("");
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
      body{font-family:'Microsoft JhengHei';}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #000;padding:4px;white-space:pre-wrap;word-break:break-all;}
      th{background:#eee;} @page{size: landscape;}
      </style></head><body
