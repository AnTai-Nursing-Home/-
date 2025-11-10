(function () {
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

    // 載入住民清單並依床號排序
    try {
      const snap = await colResidents.get();
      let residents = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          bed: data.bedNumber || "",
          name: d.id,
        };
      });

      // 依床號數字排序（例如 101-1, 101-2, 102-1 ...）
      residents.sort((a, b) => {
        const numA = a.bed.match(/\d+/g)?.map(Number) || [0];
        const numB = b.bed.match(/\d+/g)?.map(Number) || [0];
        for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
          if ((numA[i] || 0) !== (numB[i] || 0)) return (numA[i] || 0) - (numB[i] || 0);
        }
        return a.bed.localeCompare(b.bed, "zh-Hant");
      });

      sel.innerHTML =
        '<option value=\"\">請選擇</option>' +
        residents.map((r) => `<option value=\"${r.name}\">${r.bed} - ${r.name}</option>`).join("");
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
          '<tr><td colspan=\"6\" class=\"text-center text-muted\">請選擇住民</td></tr>';
        return;
      }
      infoEl.textContent = bed ? `床號：${bed}　姓名：${name}` : `姓名：${name}`;
      renderResident(name);
    });

    async function renderResident(name) {
      const docRef = colAllowance.doc(name);
      tbody.innerHTML =
        '<tr><td colspan=\"6\" class=\"text-center text-muted\">讀取中…</td></tr>';

      try {
        const txSnap = await docRef
          .collection("transactions")
          .orderBy("date", "desc")
          .get();

        if (txSnap.empty) {
          balanceEl.textContent = "0 元";
          tbody.innerHTML =
            '<tr><td colspan=\"6\" class=\"text-center text-muted\">目前無交易紀錄</td></tr>';
          await docRef.set(
            { totalBalance: 0, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
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
            `<tr data-id=\"${id}\"><td>${date}</td><td>${type}</td><td>${amount}</td><td>${reason}</td><td>${recorder}</td><td><button class='btn btn-sm btn-outline-primary me-1 editBtn'><i class='fa-solid fa-pen'></i></button><button class='btn btn-sm btn-outline-danger delBtn'><i class='fa-solid fa-trash'></i></button></td></tr>`
          );
        });
        tbody.innerHTML = rows.join("");
        balanceEl.textContent = balance + " 元";
        await docRef.set(
          { totalBalance: balance, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );

        tbody.querySelectorAll(".editBtn").forEach((btn) =>
          btn.addEventListener("click", (e) => onEditTx(e, name))
        );
        tbody.querySelectorAll(".delBtn").forEach((btn) =>
          btn.addEventListener("click", (e) => onDeleteTx(e, name))
        );
      } catch (err) {
        console.error("[allowance] renderResident error", err);
        tbody.innerHTML =
          '<tr><td colspan=\"6\" class=\"text-center text-danger\">讀取失敗，請重新整理</td></tr>';
      }
    }

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
      let newType = window.prompt("修改類型（存入 / 取用）", oldType) || oldType;
      newType = newType === "取用" ? "取用" : "存入";
      const newAmount = Number(window.prompt("修改金額", oldAmount) || oldAmount);
      const newReason = window.prompt("修改原因", oldReason) || oldReason;

      if (!newDate || !newAmount || newAmount <= 0) {
        return alert("金額或日期不正確，已取消修改");
      }

      const txRef = colAllowance.doc(name).collection("transactions").doc(id);
      await txRef.update({ date: newDate, type: newType, amount: newAmount, reason: newReason });
      await renderResident(name);
    }

    async function onDeleteTx(e, name) {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (!window.confirm("確定要刪除此筆紀錄？")) return;
      await colAllowance.doc(name).collection("transactions").doc(id).delete();
      await renderResident(name);
    }

    btnSubmit.addEventListener("click", async () => {
      const name = sel.value;
      if (!name) return alert("請先選擇住民");
      const date = $("#txDate").value;
      const type = $("#txType").value === "取用" ? "取用" : "存入";
      const amount = Number($("#txAmount").value);
      const reason = $("#txReason").value.trim();
      const recorder = "張振達";

      if (!date || !amount || amount <= 0) return alert("請填寫正確的日期與金額");

      const docRef = colAllowance.doc(name);
      await docRef.collection("transactions").add({
        date,
        type,
        amount,
        reason,
        recorder,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $("#txAmount").value = "";
      $("#txReason").value = "";
      await renderResident(name);
    });

    btnExport.addEventListener("click", () => {
      const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      if (typeof XLSX === "undefined") {
        const script = document.createElement("script");
        script.src = XLSX_URL;
        script.onload = exportToExcel;
        document.body.appendChild(script);
      } else {
        exportToExcel();
      }
    });

    function exportToExcel() {
      const table = document.querySelector("table");
      if (!table) return alert("找不到表格");
      const wb = XLSX.utils.table_to_book(table, { sheet: "零用金紀錄" });
      const filename = `${sel.value || "未命名住民"}_零用金紀錄.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  }
})();
