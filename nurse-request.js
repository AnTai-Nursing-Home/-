document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();
  const leaveCol = db.collection("nurse_leave_requests");
  const swapCol = db.collection("nurse_shift_requests");

  const leaveBody = document.getElementById("leaveTableBody");
  const swapBody = document.getElementById("swapTableBody");

  const leaveModal = new bootstrap.Modal(document.getElementById("leaveModal"));
  const swapModal = new bootstrap.Modal(document.getElementById("swapModal"));

  // ===== 請假資料 =====
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
        <td>${d.supervisorSign || ""}</td>
        <td>${(d.notes || []).map(n => `<div class="note-item">${n}</div>`).join("")}</td>`;
      leaveBody.appendChild(tr);
    });
  }

  // ===== 調班資料 =====
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
        <td>${d.supervisorSign || ""}</td>
        <td>${(d.notes || []).map(n => `<div class="note-item">${n}</div>`).join("")}</td>`;
      swapBody.appendChild(tr);
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

  loadLeaveRequests();
  loadSwapRequests();
});
