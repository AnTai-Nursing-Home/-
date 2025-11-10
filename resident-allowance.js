(function () {
  // 等待 Firebase 初始化
  if (window.firebase?.apps?.length) {
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
    let currentEditingTxId = "";

    // 載入住民清單並依床號排序
    try {
      const snap = await colResidents.get();
      let residents = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          bed: data.bedNumber || data.bed || "",
        };
      });

      residents.sort((a, b) => {
        const numA = a.bed.match(/\d+/g)?.map(Number) || [0];
        const numB = b.bed.match(/\d+/g)?.map(Number) || [0];
        for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
          if ((numA[i] || 0) !== (numB[i] || 0)) {
            return (numA[i] || 0) - (numB[i] || 0);
          }
        }
        return a.bed.localeCompare(b.bed, "zh-Hant");
      });

      sel.innerHTML =
        '<option value="">請選擇</option>' +
        residents
          .map((r) => {
            const label = r.bed ? `${r.bed} - ${r.id}` : r.id;
            return `<option value="${r.id}" data-bed="${r.bed}">${label}</option>`;
          })
          .join("");
    } catch (err) {
      console.error("[allowance] load residents error", err);
      sel.innerHTML =
        '<option value="">載入失敗，請重新整理</option>';
    }

    // 選擇住民事件
    sel.addEventListener("change", () => {
      const name = sel.value;
      const opt = sel.options[sel.selectedIndex];
      const bed = opt ? opt.getAttribute("data-bed") || "" : "";
      currentResident = name;

      if (!name) {
        balanceEl.textContent = "--";
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-muted">請選擇住民</td></tr>';
        return;
      }
      renderResident(name);
    });

    // 渲染指定住民的交易紀錄，並重算餘額
    async function renderResident(name) {
      if (!name) return;
      const docRef = colAllowance.doc(name);
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>';

      try {
        const txSnap = await docRef
          .collection("transactions")
          .orderBy("date", "desc")
          .get();

        if (txSnap.empty) {
          balanceEl.textContent = "0 元";
          tbody.innerHTML =
            '<tr><td colspan="6" class="text-center text-muted">目前無交易紀錄</td></tr>';
          await docRef.set(
            {
              totalBalance: 0,
              lastUpdated:
                firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
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

          rows.push(`
            <tr data-id="${id}">
              <td>${escapeHTML(date)}</td>
              <td>${type}</td>
              <td>${amount}</td>
              <td>${escapeHTML(reason)}</td>
              <td>${escapeHTML(recorder)}</td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1 editBtn">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delBtn">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          `);
        });

        tbody.innerHTML = rows.join("");
        balanceEl.textContent = balance + " 元";

        await docRef.set(
          {
            totalBalance: balance,
            lastUpdated:
              firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 綁定按鈕事件
        tbody
          .querySelectorAll(".editBtn")
          .forEach((btn) =>
            btn.addEventListener("click", onEditClick)
          );
        tbody
          .querySelectorAll(".delBtn")
          .forEach((btn) =>
            btn.addEventListener("click", onDeleteClick)
          );
      } catch (err) {
        console.error("[allowance] renderResident error", err);
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-danger">讀取失敗，請重新整理</td></tr>';
      }
    }

    // 新增交易紀錄
    btnSubmit.addEventListener("click", async () => {
      const name = sel.value;
      if (!name) return alert("請先選擇住民");

      const date = $("#txDate").value;
      const type = $("#txType").value === "取用" ? "取用" : "存入";
      const amount = Number($("#txAmount").value);
      const reason = $("#txReason").value.trim();
      const recorder = $("#txRecorder").value.trim();

      if (!date || !amount || amount <= 0) {
        return alert("請填寫正確的日期與金額");
      }

      try {
        const docRef = colAllowance.doc(name);
        await docRef.collection("transactions").add({
          date,
          type,
          amount,
          reason,
          recorder,
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 清空輸入（保留類型以方便連續輸入）
        $("#txAmount").value = "";
        $("#txReason").value = "";

        await renderResident(name);
      } catch (err) {
        console.error("[allowance] add tx error", err);
        alert("新增失敗，請稍後再試");
      }
    });

    // 點擊「編輯」按鈕：打開 Modal，帶入該列資料
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

    // 儲存 Modal 編輯
    if (btnSaveEdit) {
      btnSaveEdit.addEventListener("click", async () => {
        if (!currentResident || !currentEditingTxId) {
          return editModal && editModal.hide();
        }

        const newDate = editDate.value;
        const newType =
          editType.value === "取用" ? "取用" : "存入";
        const newAmount = Number(editAmount.value);
        const newReason = editReason.value.trim();
        const newRecorder = editRecorder.value.trim();

        if (!newDate || !newAmount || newAmount <= 0) {
          return alert("請填寫正確的日期與金額");
        }

        try:
          const txRef = colAllowance
            .doc(currentResident)
            .collection("transactions")
            .doc(currentEditingTxId);

          await txRef.update({
            date: newDate,
            type: newType,
            amount: newAmount,
            reason: newReason,
            recorder: newRecorder,
          });

          editModal.hide();
          currentEditingTxId = "";
          await renderResident(currentResident);
        } catch (err) {
          console.error("[allowance] save edit error", err);
          alert("更新失敗，請稍後再試");
        }
      });
    }

    // 刪除紀錄
    async function onDeleteClick(e) {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (!window.confirm("確定要刪除此筆紀錄？")) return;

      try {
        await colAllowance
          .doc(currentResident)
          .collection("transactions")
          .doc(id)
          .delete();
        await renderResident(currentResident);
      } catch (err) {
        console.error("[allowance] delete tx error", err);
        alert("刪除失敗，請稍後再試");
      }
    }

    // 匯出 Excel（匯出當前表格）
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const XLSX_URL =
          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        if (typeof XLSX === "undefined") {
          const script = document.createElement("script");
          script.src = XLSX_URL;
          script.onload = exportToExcel;
          document.body.appendChild(script);
        } else {
          exportToExcel();
        }
      });
    }

    function exportToExcel() {
      if (!currentResident) {
        return alert("請先選擇住民再匯出。");
      }
      const table = document.querySelector("table");
      if (!table) return alert("找不到表格");

      const wb = XLSX.utils.table_to_book(table, {
        sheet: "零用金紀錄",
      });
      const filename = `${currentResident}_零用金紀錄.xlsx`;
      XLSX.writeFile(wb, filename);
    }

    // HTML escape
    function escapeHTML(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  }
})();
