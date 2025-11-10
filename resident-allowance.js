(function () {
  // 等待 Firebase 初始化完成
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
    const infoEl = $("#residentInfo");
    const btnSubmit = $("#txSubmit");
    const btnExport = $("#exportExcel");

    const colResidents = db.collection("residents");
    const colAllowance = db.collection("resident_allowance");

    // 載入住民清單
    try {
      const snap = await colResidents.get();
      if (snap.empty) {
        sel.innerHTML = '<option value=\"\">尚無住民資料</option>';
      } else {
        sel.innerHTML =
          '<option value=\"\">請選擇</option>' +
          snap.docs
            .map((d) => {
              const data = d.data() || {};
              const bed = data.bedNumber || data.bed || "";
              const name = d.id;
              return `<option value="${name}" data-bed="${bed}">${bed ? bed + " - " : ""}${name}</option>`;
            })
            .join("");
      }
    } catch (err) {
      console.error("[allowance] load residents error", err);
      sel.innerHTML = '<option value=\"\">載入失敗，請重新整理</option>';
    }

    sel.addEventListener("change", () => {
      const name = sel.value;
      const opt = sel.options[sel.selectedIndex];
      const bed = opt ? opt.getAttribute("data-bed") || "" : "";
      if (!name) {
        infoEl.textContent = "";
        balanceEl.textContent = "--";
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-muted">請選擇住民</td></tr>';
        return;
      }
      infoEl.textContent = bed ? `床號：${bed}　姓名：${name}` : `姓名：${name}`;
      renderResident(name);
    });

    // 渲染指定住民紀錄 + 重算餘額
    async function renderResident(name) {
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
          // 同步 totalBalance
          await docRef.set(
            {
              totalBalance: 0,
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
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
          else if (type === "取用") balance -= amount;

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
        balanceEl.textContent = balance + " 元";

        // 更新 totalBalance
        await docRef.set(
          {
            totalBalance: balance,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 綁定編輯 / 刪除事件
        tbody
          .querySelectorAll(".editBtn")
          .forEach((btn) =>
            btn.addEventListener("click", (e) => onEditTx(e, name))
          );
        tbody
          .querySelectorAll(".delBtn")
          .forEach((btn) =>
            btn.addEventListener("click", (e) => onDeleteTx(e, name))
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
      const recorder =
        localStorage.getItem("staffName") ||
        localStorage.getItem("adminName") ||
        "系統紀錄";

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
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 清空輸入欄位（保留類型，方便連續輸入）
        $("#txAmount").value = "";
        $("#txReason").value = "";

        await renderResident(name);
      } catch (err) {
        console.error("[allowance] add tx error", err);
        alert("新增失敗，請稍後再試");
      }
    });

    // 編輯交易
    async function onEditTx(e, name) {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      const tds = tr.querySelectorAll("td");
      const oldDate = tds[0].textContent.trim();
      const oldType = tds[1].textContent.trim();
      const oldAmount = tds[2].textContent.trim();
      const oldReason = tds[3].textContent.trim();

      const newDate = window.prompt("修改日期", oldDate) || oldDate;
      let newType =
        window.prompt("修改類型（存入 / 取用）", oldType) || oldType;
      newType = newType === "取用" ? "取用" : "存入";
      const amtInput =
        window.prompt("修改金額", oldAmount) || String(oldAmount);
      const newAmount = Number(amtInput);
      const newReason =
        window.prompt("修改原因", oldReason) || oldReason;

      if (!newDate || !newAmount || newAmount <= 0) {
        return alert("金額或日期不正確，已取消修改");
      }

      try {
        const txRef = colAllowance
          .doc(name)
          .collection("transactions")
          .doc(id);
        await txRef.update({
          date: newDate,
          type: newType,
          amount: newAmount,
          reason: newReason,
        });
        await renderResident(name);
      } catch (err) {
        console.error("[allowance] edit tx error", err);
        alert("更新失敗，請稍後再試");
      }
    }

    // 刪除交易
    async function onDeleteTx(e, name) {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (!window.confirm("確定要刪除此筆紀錄？")) return;

      try {
        const txRef = colAllowance
          .doc(name)
          .collection("transactions")
          .doc(id);
        await txRef.delete();
        await renderResident(name);
      } catch (err) {
        console.error("[allowance] delete tx error", err);
        alert("刪除失敗，請稍後再試");
      }
    }

    // 匯出 Excel（目前匯出畫面中的表格）
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
      const table = document.querySelector("table");
      if (!table) return alert("找不到表格");
      if (!sel.value)
        return alert("請先選擇住民，再匯出該住民的零用金紀錄");

      const wb = XLSX.utils.table_to_book(table, {
        sheet: "零用金紀錄",
      });
      const filename = `${sel.value}_零用金紀錄.xlsx`;
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
