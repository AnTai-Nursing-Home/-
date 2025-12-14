// meal-caregiver.js
// 點餐系統（照服員端）- 表單版（每日餐點登記表）
// 規則：用餐日期 = 送單日期 + 1 天
// - 只需要選送單日期，系統自動帶出用餐日期（不可手動調整）
// - 送單日期一改就會自動載入該「用餐日期」的點餐數量（不需要再按載入）
// - 儲存時必須簽名，記錄「誰負責定餐」(早班A)
// - Firestore: collection = mealOrders, docId = YYYY-MM-DD（用餐日期）

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

  function addDaysISO(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function safeDb() {
    if (typeof db !== "undefined" && db) return db;
    if (window.db) return window.db;
    return null;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function setHeaderInfo(mealISO) {
    const y = Number(mealISO?.slice(0, 4));
    if (!Number.isFinite(y)) {
      $("rocYearLabel").textContent = "";
      $("weekdayText").textContent = "";
      return;
    }
    $("rocYearLabel").textContent = `${y - 1911}年(Y)`;

    const d = new Date(mealISO + "T00:00:00");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    $("weekdayText").textContent = weekday;

    // 農曆/節氣：目前先留空（如要精準可再接計算）
    if (!$("lunarText").textContent) $("lunarText").textContent = "";
    if (!$("solarTermText").textContent) $("solarTermText").textContent = "";
  }

  function numVal(id) {
    const v = Number($(id).value);
    return Number.isFinite(v) ? v : 0;
  }

  function setNum(id, v) {
    $(id).value = Number.isFinite(v) ? String(v) : "0";
  }

  function recalc() {
    const meat =
      numVal("meat_blenderized") +
      numVal("meat_congeeVeg") +
      numVal("meat_cookedRiceMinced") +
      numVal("meat_general");
    const veg =
      numVal("veg_blenderized") +
      numVal("veg_congeeVeg") +
      numVal("veg_cookedRiceMinced") +
      numVal("veg_general");

    setNum("meat_subtotal", meat);
    setNum("veg_subtotal", veg);
    setNum("grandTotal", meat + veg);
  }

  function clearSignatureUI() {
    $("signatureDisplay").textContent = "—";
    $("signatureTimeDisplay").textContent = "";
    $("signatureNoteDisplay").textContent = "";
    setLastSignedInfo("");
  }

  function setSignatureUI(signedBy, signedAt, signedNote) {
    $("signatureDisplay").textContent = signedBy ? signedBy : "—";
    const timeText = signedAt ? signedAt.toLocaleString() : "";
    $("signatureTimeDisplay").textContent = timeText ? timeText : "";
    $("signatureNoteDisplay").textContent = signedNote ? signedNote : "";

    if (signedBy) {
      const note = signedNote ? `（${escapeHtml(String(signedNote))}）` : "";
      setLastSignedInfo(
        `<i class="fas fa-pen-fancy me-2"></i>${escapeHtml(getText("meal_last_signature"))}：<b>${escapeHtml(
          String(signedBy)
        )}</b>${note} <span class="text-muted">(${escapeHtml(timeText)})</span>`
      );
    }
  }

  function setFormNumbers(data) {
    setNum("meat_blenderized", data?.meat?.blenderized ?? 0);
    setNum("meat_congeeVeg", data?.meat?.congeeVeg ?? 0);
    setNum("meat_cookedRiceMinced", data?.meat?.cookedRiceMinced ?? 0);
    setNum("meat_general", data?.meat?.general ?? 0);

    setNum("veg_blenderized", data?.vegetarian?.blenderized ?? 0);
    setNum("veg_congeeVeg", data?.vegetarian?.congeeVeg ?? 0);
    setNum("veg_cookedRiceMinced", data?.vegetarian?.cookedRiceMinced ?? 0);
    setNum("veg_general", data?.vegetarian?.general ?? 0);

    recalc();
  }

  function getPayload() {
    return {
      // 用餐日期 docId（不可手動）
      mealDate: $("mealDate").value,
      // 送單日期（由使用者選）
      deliveryDate: $("deliveryDate").value,

      meat: {
        blenderized: numVal("meat_blenderized"),
        congeeVeg: numVal("meat_congeeVeg"),
        cookedRiceMinced: numVal("meat_cookedRiceMinced"),
        general: numVal("meat_general"),
        subtotal: numVal("meat_subtotal"),
      },
      vegetarian: {
        blenderized: numVal("veg_blenderized"),
        congeeVeg: numVal("veg_congeeVeg"),
        cookedRiceMinced: numVal("veg_cookedRiceMinced"),
        general: numVal("veg_general"),
        subtotal: numVal("veg_subtotal"),
      },
      grandTotal: numVal("grandTotal"),

      lunarText: $("lunarText").textContent || "",
      solarTermText: $("solarTermText").textContent || "",
      weekdayText: $("weekdayText").textContent || "",
    };
  }

  function validateBeforeSave(payload) {
    if (!payload.deliveryDate) return getText("meal_msg_select_delivery_date");
    // mealDate 由 deliveryDate 自動算出
    if (!payload.mealDate) return getText("meal_msg_select_date");
    if ((payload.grandTotal ?? 0) <= 0) return getText("meal_msg_need_any_people");
    return null;
  }

  async function loadForMealDate(mealISO, deliveryISO) {
    const _db = safeDb();
    if (!_db) {
      alert(getText("meal_msg_firebase_not_ready"));
      return;
    }

    clearStatus();
    clearSignatureUI();

    try {
      showStatus(getText("meal_msg_loading"), "secondary");
      const docRef = _db.collection("mealOrders").doc(mealISO);
      const snap = await docRef.get();

      // 先把日期與表頭更新（不管有沒有資料）
      $("mealDate").value = mealISO;
      $("deliveryDate").value = deliveryISO;
      setHeaderInfo(mealISO);

      if (!snap.exists) {
        // 沒資料就清空數字
        setFormNumbers({});
        showStatus(getText("meal_msg_no_data"), "secondary");
        return;
      }

      const data = snap.data() || {};
      // 以資料庫為準填數字
      setFormNumbers(data);

      if (data.signedBy) {
        const signedAt = data.signedAt?.toDate ? data.signedAt.toDate() : (data.signedAt ? new Date(data.signedAt) : null);
        setSignatureUI(data.signedBy, signedAt, data.signedNote || "");
        showStatus(getText("meal_msg_loaded_with_sign"), "success");
      } else {
        showStatus(getText("meal_msg_loaded"), "success");
      }
    } catch (err) {
      console.error(err);
      alert(getText("meal_msg_load_failed"));
      showStatus(getText("meal_msg_load_failed"), "danger");
    }
  }

  async function saveWithSignature(payload, signerName, signerNote) {
    const _db = safeDb();
    if (!_db) {
      alert(getText("meal_msg_firebase_not_ready"));
      return;
    }

    try {
      showStatus(getText("meal_msg_saving"), "secondary");

      const now = new Date();
      const docId = payload.mealDate;
      const docRef = _db.collection("mealOrders").doc(docId);

      const dataToSave = {
        ...payload,
        signedBy: signerName,
        signedNote: signerNote || "",
        signedAt: firebase.firestore.Timestamp.fromDate(now),
        updatedAt: firebase.firestore.Timestamp.fromDate(now),
      };

      const snap = await docRef.get();
      if (!snap.exists) {
        dataToSave.createdAt = firebase.firestore.Timestamp.fromDate(now);
      }

      await docRef.set(dataToSave, { merge: true });

      showStatus(getText("meal_msg_saved"), "success");
      setSignatureUI(signerName, now, signerNote || "");
    } catch (err) {
      console.error(err);
      alert(getText("meal_msg_save_failed"));
      showStatus(getText("meal_msg_save_failed"), "danger");
    }
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
        alert(getText("meal_msg_enter_signer"));
        return;
      }

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

  async function syncByDeliveryDate() {
    const deliveryISO = $("deliveryDate").value;
    if (!deliveryISO) {
      clearStatus();
      clearSignatureUI();
      return;
    }
    const mealISO = addDaysISO(deliveryISO, 1);
    // mealDate 不可手動：在這裡統一計算並自動載入
    await loadForMealDate(mealISO, deliveryISO);
  }

  function wireUI() {
    // 預設：送單=今天，用餐=明天（自動算）
    $("deliveryDate").value = todayISO();
    $("mealDate").value = addDaysISO($("deliveryDate").value, 1);
    setHeaderInfo($("mealDate").value);

    // 任何數字改變都重算
    document.querySelectorAll(".meal-num").forEach((el) => {
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });

    // 送單日期改變 => 用餐日期自動 +1 且自動載入
    $("deliveryDate").addEventListener("change", () => {
      syncByDeliveryDate();
      showStatus(getText("meal_msg_auto_loaded"), "secondary");
    });

    // 儲存
    $("saveBtn").addEventListener("click", async () => {
      recalc();
      const payload = getPayload();
      const msg = validateBeforeSave(payload);
      if (msg) return alert(msg);

      openSignModal(async (name, note) => {
        await saveWithSignature(payload, name, note);
      });
    });

    // 初次進入就自動載入（不用按載入）
    syncByDeliveryDate();
    recalc();
  }

  document.addEventListener("firebase-ready", () => {
    wireUI();
  });
})();
