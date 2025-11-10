(function () {
  // 等待 Firebase 初始化完成後執行
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

    // 載入住民清單並依床號排序
    try {
      const snap = await colResidents.get();
      const residents = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          bed: data.bedNumber || data.bed || ""
        };
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

    // 切換住民
    sel.addEventListener("change", () => {
      const name = sel.value;
      const opt = sel.options[sel.selectedIndex];
      const bed = opt ? (opt.getAttribute("data-bed") || "") : "";
      currentResident = name;
      currentResidentBed = bed;

      if (!name) {
        currentBalance = 0;
        balanceEl.textContent = "--";
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-muted">請選擇住民</td></tr>';
        return;
      }
      renderResident(name);
    });

    // 渲染交易紀錄 & 計算餘額
    async function renderResident(name) {
      if (!name) return;
      const docRef = colAllowance.doc(name);
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">讀取中…</td></tr>';

      try {
        const txSnap = await docRef
          .collection("transactions")
          .orderBy("date", "asc")
          .get();

        if (txSnap.empty) {
          currentBalance = 0;
          balanceEl.textContent = "0 元";
          tbody.innerHTML =
            '<tr><td colspan="6" class="text-center text-muted">目前無交易紀錄</td></tr>';
          await docRef.set(
            {
              totalBalance: 0,
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
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

          rows.push(
            `<tr data-id="${id}">
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
            </tr>`
          );
        });

        tbody.innerHTML = rows.join("");
        currentBalance = balance;
        balanceEl.textContent = balance + " 元";

        await docRef.set(
          {
            totalBalance: balance,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        // 綁定按鈕
        tbody.querySelectorAll(".editBtn").forEach((btn) => {
          btn.addEventListener("click", onEditClick);
        });
        tbody.querySelectorAll(".delBtn").forEach((btn) => {
          btn.addEventListener("click", onDeleteClick);
        });
      } catch (err) {
        console.error("[allowance] renderResident error", err);
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-danger">讀取失敗，請重新整理</td></tr>';
      }
    }

    // 新增紀錄
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
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        $("#txAmount").value = "";
        $("#txReason").value = "";
        // 登錄人欄位依需求決定是否清空，這裡保留

        await renderResident(name);
      } catch (err) {
        console.error("[allowance] add tx error", err);
        alert("新增失敗，請稍後再試");
      }
    });

    // 編輯：開啟 Modal
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

    // 儲存編輯
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

        if (!newDate || !newAmount || newAmount <= 0) {
          return alert("請填寫正確的日期與金額");
        }

        try {
          const txRef = colAllowance
            .doc(currentResident)
            .collection("transactions")
            .doc(currentEditingTxId);

          await txRef.update({
            date: newDate,
            type: newType,
            amount: newAmount,
            reason: newReason,
            recorder: newRecorder
          });

          currentEditingTxId = "";
          if (editModal) editModal.hide();
          await renderResident(currentResident);
        } catch (err) {
          console.error("[allowance] save edit error", err);
          alert("更新失敗，請稍後再試");
        }
      });
    }

    // 刪除
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

    // 匯出：使用自訂版型
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        if (!currentResident) {
          return alert("請先選擇住民再匯出。");
        }
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
      const aoa = [];

      // 第1列：標題
      aoa.push(["住民零用金紀錄表"]);

      // 第2列：床號＋姓名
      const bed = currentResidentBed || "";
      const name = currentResident || "";
      aoa.push([`床號：${bed}　姓名：${name}`]);

      // 第3列：表頭
      aoa.push(["日期", "類型", "金額", "原因", "登錄人"]);

      // 資料列：從畫面表格擷取（不含操作欄）
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 5) return;
        const date = tds[0].textContent.trim();
        const type = tds[1].textContent.trim();
        const amountText = tds[2].textContent.trim();
        const reason = tds[3].textContent.trim();
        const recorder = tds[4].textContent.trim();

        if (!date && !type && !amountText && !reason && !recorder) return;
        const joined = (date + type + amountText + reason + recorder);
        if (/目前無交易紀錄|請選擇住民|讀取中/.test(joined)) return;

        const amount = Number(amountText) || 0;
        aoa.push([date, type, amount, reason, recorder]);
      });

      // 最後一列：總餘額顯示在第5欄（右下角）
      const totalText = `總餘額：${currentBalance} 元`;
      aoa.push(["", "", "", "", totalText]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 合併標題（A1:E1）
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
      ];

      // 自動欄寬
      const colCount = 5;
      const colWidths = [];
      for (let c = 0; c < colCount; c++) {
        let maxLen = 8;
        for (let r = 0; r < aoa.length; r++) {
          const v = aoa[r][c];
          if (v == null) continue;
          const len = String(v).length;
          if (len > maxLen) maxLen = len;
        }
        colWidths.push({ wch: maxLen + 2 });
      }
      ws["!cols"] = colWidths;

      // 設定樣式與框線
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = 0; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          let cell = ws[cellRef];
          if (!cell) {
            const v = aoa[R] && aoa[R][C];
            if (v == null || v === "") continue;
            cell = ws[cellRef] = { t: "s", v: String(v) };
          }

          cell.s = cell.s || {};

          // 標題列
          if (R === 0) {
            cell.s.font = { bold: true, sz: 14 };
            cell.s.alignment = { horizontal: "center", vertical: "center" };
          }

          // 床號姓名列
          if (R === 1 && C === 0) {
            cell.s.font = { bold: true };
          }

          // 表頭列
          if (R === 2) {
            cell.s.font = { bold: true };
            cell.s.alignment = { horizontal: "center", vertical: "center" };
            cell.s.border = {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            };
          }

          // 資料列框線
          if (R >= 3) {
            cell.s.border = {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            };
          }

          // 金額欄右對齊（資料列）
          if (R >= 3 && C === 2 && cell.v !== "" && !isNaN(Number(cell.v))) {
            cell.t = "n";
            cell.s.alignment = { horizontal: "right", vertical: "center" };
          }

          // 最後一列右下角總餘額
          if (R === range.e.r && C === 4) {
            cell.s.font = { bold: true };
            cell.s.alignment = { horizontal: "right", vertical: "center" };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "零用金紀錄");

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const filename = `零用金紀錄表-${yyyy}.${mm}.${dd}.xlsx`;

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
