(function () {
  if (window.firebase && firebase.apps && firebase.apps.length) {
    init();
  } else {
    document.addEventListener("firebase-ready", init);
  }

  async function init() {
    const db = firebase.firestore();
    const $ = (s) => document.querySelector(s);
    const sel = $("#residentSelect");
    const tbody = $("#txTableBody");
    const balanceEl = $("#balanceDisplay");
    const btnSubmit = $("#txSubmit");
    const btnExport = $("#exportExcel");
    const editModalEl = document.getElementById("editModal");
    const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;
    const editIdInput = $("#editId");
    const editDate = $("#editDate");
    const editType = $("#editType");
    const editAmount = $("#editAmount");
    const editReason = $("#editReason");
    const editRecorder = $("#editRecorder");
    const btnSaveEdit = $("#saveEdit");
    const colResidents = db.collection("residents");
    const colAllowance = db.collection("resident_allowance");
    let currentResident = "";
    let currentResidentBed = "";
    let currentBalance = 0;
    let currentEditingTxId = "";

    // 載入住民清單（依床號排序）
    try {
      const snap = await colResidents.get();
      const residents = snap.docs.map((d) => {
        const data = d.data() || {};
        return { id: d.id, bed: data.bedNumber || data.bed || "" };
      });
      residents.sort((a, b) => {
        const numsA = a.bed.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.bed.match(/\d+/g)?.map(Number) || [0];
        const len = Math.max(numsA.length, numsB.length);
        for (let i = 0; i < len; i++) {
          const na = numsA[i] || 0;
          const nb = numsB[i] || 0;
          if (na !== nb) return na - nb;
        }
        return a.bed.localeCompare(b.bed, "zh-Hant");
      });
      sel.innerHTML =
        '<option value="">請選擇</option>' +
        residents
          .map((r) => `<option value="${r.id}" data-bed="${r.bed}">${r.bed ? `${r.bed} - ${r.id}` : r.id}</option>`)
          .join("");
    } catch (err) {
      console.error("[allowance] load residents error", err);
      sel.innerHTML = '<option value="">載入失敗，請重新整理</option>';
    }

    sel.addEventListener("change", () => {
      const name = sel.value;
      const opt = sel.options[sel.selectedIndex];
      const bed = opt ? opt.getAttribute("data-bed") || "" : "";
      currentResident = name;
      currentResidentBed = bed;
      if (!name) {
        currentBalance = 0;
        balanceEl.textContent = "--";
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">請選擇住民</td></tr>';
        return;
      }
      renderResident(name);
    });

    async function renderResident(name) {
      const docRef = colAllowance.doc(name);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>';
      try {
        const txSnap = await docRef.collection("transactions").orderBy("date", "asc").get();
        if (txSnap.empty) {
          currentBalance = 0;
          balanceEl.textContent = "0 元";
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">目前無交易紀錄</td></tr>';
          await docRef.set({ totalBalance: 0, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          return;
        }
        let balance = 0;
        const rows = [];
        txSnap.forEach((d) => {
          const t = d.data() || {};
          const id = d.id;
          const date = t.date || "";
          const type = t.type === "取用" ? "取用" : "存入";
          const amount = Number(t.amount) || 0;
          const reason = t.reason || "";
          const recorder = t.recorder || "";
          if (type === "存入") balance += amount;
          else balance -= amount;
          rows.push(`<tr data-id="${id}"><td>${escapeHTML(date)}</td><td>${type}</td><td style='text-align:right;'>${amount}</td><td>${escapeHTML(reason)}</td><td>${escapeHTML(recorder)}</td><td class='text-center'><button class='btn btn-sm btn-outline-primary me-1 editBtn'><i class='fa-solid fa-pen'></i></button><button class='btn btn-sm btn-outline-danger delBtn'><i class='fa-solid fa-trash'></i></button></td></tr>`);
        });
        tbody.innerHTML = rows.join("");
        currentBalance = balance;
        balanceEl.textContent = balance + " 元";
        await docRef.set({ totalBalance: balance, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        tbody.querySelectorAll(".editBtn").forEach((b) => b.addEventListener("click", onEditClick));
        tbody.querySelectorAll(".delBtn").forEach((b) => b.addEventListener("click", onDeleteClick));
      } catch (err) {
        console.error("[allowance] renderResident error", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">讀取失敗，請重新整理</td></tr>';
      }
    }

    btnSubmit.addEventListener("click", async () => {
      const name = sel.value;
      if (!name) return alert("請先選擇住民");
      const date = $("#txDate").value;
      const type = $("#txType").value === "取用" ? "取用" : "存入";
      const amount = Number($("#txAmount").value);
      const reason = $("#txReason").value.trim();
      const recorder = $("#txRecorder").value.trim();
      if (!date || !amount || amount <= 0) return alert("請填寫正確的日期與金額");
      try {
        const docRef = colAllowance.doc(name);
        await docRef.collection("transactions").add({ date, type, amount, reason, recorder, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        $("#txAmount").value = "";
        $("#txReason").value = "";
        await renderResident(name);
      } catch (err) {
        console.error("[allowance] add tx error", err);
        alert("新增失敗，請稍後再試");
      }
    });

    function onEditClick(e) {
      const tr = e.target.closest("tr");
      if (!tr || !editModal) return;
      const id = tr.dataset.id;
      const tds = tr.querySelectorAll("td");
      currentEditingTxId = id;
      editIdInput.value = id;
      editDate.value = tds[0].textContent.trim();
      editType.value = tds[1].textContent.trim() === "取用" ? "取用" : "存入";
      editAmount.value = tds[2].textContent.trim();
      editReason.value = tds[3].textContent.trim();
      editRecorder.value = tds[4].textContent.trim();
      editModal.show();
    }

    if (btnSaveEdit) {
      btnSaveEdit.addEventListener("click", async () => {
        if (!currentResident || !currentEditingTxId) {
          if (editModal) editModal.hide();
          return;
        }
        const newDate = editDate.value;
        const newType = editType.value === "取用" ? "取用" : "存入";
        const newAmount = Number(editAmount.value);
        const newReason = editReason.value.trim();
        const newRecorder = editRecorder.value.trim();
        if (!newDate || !newAmount || newAmount <= 0) return alert("請填寫正確的日期與金額");
        try {
          const txRef = colAllowance.doc(currentResident).collection("transactions").doc(currentEditingTxId);
          await txRef.update({ date: newDate, type: newType, amount: newAmount, reason: newReason, recorder: newRecorder });
          currentEditingTxId = "";
          if (editModal) editModal.hide();
          await renderResident(currentResident);
        } catch (err) {
          console.error("[allowance] save edit error", err);
          alert("更新失敗，請稍後再試");
        }
      });
    }

    async function onDeleteClick(e) {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (!confirm("確定要刪除此筆紀錄？")) return;
      await colAllowance.doc(currentResident).collection("transactions").doc(id).delete();
      await renderResident(currentResident);
    }

    // 匯出 Excel（緊湊樣式）
    btnExport.addEventListener("click", () => {
      if (!currentResident) return alert("請先選擇住民再匯出。");
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const filename = `零用金紀錄表-${yyyy}.${mm}.${dd}.xls`;
      const bed = currentResidentBed || "";
      const name = currentResident || "";
      let html = `<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='UTF-8'><style>
        table{border-collapse:collapse;width:100%;table-layout:auto;}
        th,td{border:1px solid #000;padding:3px;font-family:'Microsoft JhengHei',sans-serif;font-size:10pt;}
        th{background:#f2f2f2;font-weight:bold;text-align:center;}
        td{text-align:center;vertical-align:middle;}
        .title{font-weight:bold;font-size:14pt;text-align:center;}
        .subtitle{text-align:left;font-weight:bold;border:none !important;}
        .amount{text-align:right;}
      </style></head><body>`;
      html += `<table><tr><td colspan='5' class='title'>住民零用金紀錄表</td></tr>`;
      html += `<tr><td colspan='5' class='subtitle'>床號：${escapeHTML(bed)}　姓名：${escapeHTML(name)}</td></tr>`;
      html += `<tr><th>日期</th><th>類型</th><th>金額</th><th>原因</th><th>登錄人</th></tr>`;
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 5) return;
        const date = tds[0].textContent.trim();
        const type = tds[1].textContent.trim();
        const amount = tds[2].textContent.trim();
        const reason = tds[3].textContent.trim();
        const recorder = tds[4].textContent.trim();
        if (/目前無交易紀錄|請選擇住民|讀取中/.test(date + type + amount + reason + recorder)) return;
        html += `<tr><td>${escapeHTML(date)}</td><td>${escapeHTML(type)}</td><td class='amount'>${escapeHTML(amount)}</td><td>${escapeHTML(reason)}</td><td>${escapeHTML(recorder)}</td></tr>`;
      });
      html += `<tr><td colspan='4'></td><td style='text-align:right;font-weight:bold;'>總餘額：${currentBalance} 元</td></tr></table></body></html>`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    });

    function escapeHTML(str) {
      return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    }
  }
})();
