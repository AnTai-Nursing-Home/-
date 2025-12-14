// meal-caregiver.js
// 點餐系統（照服員端）
// - 每天選擇日期並填寫早餐/午餐/晚餐/備註
// - 儲存時必須簽名，記錄「誰負責定餐」
// - Firestore: collection = mealOrders, docId = YYYY-MM-DD

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toISODate(inputValue) {
    // input type="date" already returns YYYY-MM-DD
    return inputValue;
  }

  function safeDb() {
    // firebase-init.js 會建立全域 db 變數
    // 有些環境會在 window.db
    if (typeof db !== "undefined" && db) return db;
    if (window.db) return window.db;
    return null;
  }

  function showStatus(text, type = "secondary") {
    const badge = $("statusBadge");
    badge.style.display = "inline-block";
    badge.className = `badge text-bg-${type}`;
    badge.textContent = text;
  }

  function clearStatus() {
    const badge = $("statusBadge");
    badge.style.display = "none";
    badge.textContent = "";
  }

  function setLastSignedInfo(info) {
    $("lastSignedInfo").innerHTML = info || "";
  }

  function getFormData() {
    return {
      date: toISODate($("mealDate").value),
      breakfast: $("breakfast").value.trim(),
      lunch: $("lunch").value.trim(),
      dinner: $("dinner").value.trim(),
      notes: $("notes").value.trim(),
    };
  }

  function setFormData(data) {
    $("breakfast").value = data?.breakfast || "";
    $("lunch").value = data?.lunch || "";
    $("dinner").value = data?.dinner || "";
    $("notes").value = data?.notes || "";
  }

  function validateBeforeSave(payload) {
    if (!payload.date) return "請先選擇日期";
    // 允許有空餐別（例如特殊狀況），但至少要有一個欄位有內容才讓存
    const hasAny =
      (payload.breakfast && payload.breakfast.length > 0) ||
      (payload.lunch && payload.lunch.length > 0) ||
      (payload.dinner && payload.dinner.length > 0) ||
      (payload.notes && payload.notes.length > 0);
    if (!hasAny) return "請至少輸入一項餐點內容或備註";
    return null;
  }

  async function loadForDate(dateISO) {
    const _db = safeDb();
    if (!_db) {
      alert("Firebase 尚未初始化，請確認 firebase-init.js");
      return;
    }

    clearStatus();
    setLastSignedInfo("");

    try {
      showStatus("載入中…", "secondary");
      const docRef = _db.collection("mealOrders").doc(dateISO);
      const snap = await docRef.get();

      if (!snap.exists) {
        setFormData({});
        showStatus("此日期尚無資料", "secondary");
        return;
      }

      const data = snap.data() || {};
      setFormData(data);

      if (data.signedBy) {
        const signedAt = data.signedAt?.toDate ? data.signedAt.toDate() : (data.signedAt ? new Date(data.signedAt) : null);
        const t = signedAt ? signedAt.toLocaleString() : "";
        const note = data.signedNote ? `（${escapeHtml(String(data.signedNote))}）` : "";
        setLastSignedInfo(
          `<i class="fas fa-pen-fancy me-2"></i>最後簽名：<b>${escapeHtml(String(data.signedBy))}</b>${note} <span class="text-muted">(${escapeHtml(t)})</span>`
        );
        showStatus("已載入（含簽名紀錄）", "success");
      } else {
        showStatus("已載入", "success");
      }
    } catch (err) {
      console.error(err);
      alert("載入失敗，請稍後再試");
      showStatus("載入失敗", "danger");
    }
  }

  async function saveWithSignature(payload, signerName, signerNote) {
    const _db = safeDb();
    if (!_db) {
      alert("Firebase 尚未初始化，請確認 firebase-init.js");
      return;
    }

    try {
      showStatus("儲存中…", "secondary");

      const now = new Date();
      const docId = payload.date;
      const docRef = _db.collection("mealOrders").doc(docId);

      const dataToSave = {
        ...payload,
        signedBy: signerName,
        signedNote: signerNote || "",
        signedAt: firebase.firestore.Timestamp.fromDate(now),
        updatedAt: firebase.firestore.Timestamp.fromDate(now),
      };

      // 若首次建立也補 createdAt
      const snap = await docRef.get();
      if (!snap.exists) {
        dataToSave.createdAt = firebase.firestore.Timestamp.fromDate(now);
      }

      await docRef.set(dataToSave, { merge: true });

      showStatus("已儲存", "success");
      const note = signerNote ? `（${escapeHtml(String(signerNote))}）` : "";
      setLastSignedInfo(
        `<i class="fas fa-pen-fancy me-2"></i>最後簽名：<b>${escapeHtml(String(signerName))}</b>${note} <span class="text-muted">(${escapeHtml(now.toLocaleString())})</span>`
      );
    } catch (err) {
      console.error(err);
      alert("儲存失敗，請稍後再試");
      showStatus("儲存失敗", "danger");
    }
  }

  // 基礎 escape（避免備註直接插入 HTML）
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openSignModal(onConfirm) {
    const modalEl = $("signModal");
    const modal = new bootstrap.Modal(modalEl, { backdrop: "static" });

    $("signerName").value = "";
    $("signerNote").value = "";

    const confirmBtn = $("confirmSignBtn");

    const handler = async () => {
      const name = $("signerName").value.trim();
      const note = $("signerNote").value.trim();

      if (!name) {
        alert("請輸入簽名（姓名）");
        return;
      }

      // 防止重複綁定
      confirmBtn.disabled = true;
      try {
        await onConfirm(name, note);
        modal.hide();
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.removeEventListener("click", handler);
      }
    };

    confirmBtn.addEventListener("click", handler);
    modal.show();
  }

  function wireUI() {
    // 預設日期：今天
    $("mealDate").value = todayISO();

    $("loadBtn").addEventListener("click", async () => {
      const d = $("mealDate").value;
      if (!d) return alert("請先選擇日期");
      await loadForDate(toISODate(d));
    });

    $("saveBtn").addEventListener("click", async () => {
      const payload = getFormData();
      const msg = validateBeforeSave(payload);
      if (msg) return alert(msg);

      openSignModal(async (name, note) => {
        await saveWithSignature(payload, name, note);
      });
    });

    // 日期改變就提示可按載入
    $("mealDate").addEventListener("change", () => {
      clearStatus();
      setLastSignedInfo("");
      showStatus("日期已變更，請按「載入」或直接填寫後儲存", "secondary");
    });
  }

  // 等待 firebase-ready（你的系統慣用方式）
  document.addEventListener("firebase-ready", () => {
    wireUI();
    // 初次進頁面先載入今天
    loadForDate(todayISO());
  });
})();
