// meal-caregiver.js
// 點餐系統（照服員端）- 表單版（像每日餐點登記表）
// - 送單日期(Delivery date) + 用餐日期(Meal date)
// - 葷/素 × (搗打餐 / 糊餐+蔬菜 / 燉碎+飯 / 一般餐) -> 自動小計/總計
// - 儲存時必須簽名，記錄「誰負責定餐」(早班A)
// - Firestore: collection = mealOrders, docId = YYYY-MM-DD（用餐日期）
//
// 依賴：i18n.js（getText / applyTranslations）+ firebase-init.js（觸發 firebase-ready, 建立 db）

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
    // 民國年
    const y = Number(mealISO?.slice(0, 4));
    if (!Number.isFinite(y)) {
      $("rocYearLabel").textContent = "";
      $("weekdayText").textContent = "";
      return;
    }
    $("rocYearLabel").textContent = `${y - 1911}年(Y)`;

    // 星期
    const d = new Date(mealISO + "T00:00:00");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    $("weekdayText").textContent = weekday;

    // 農曆 / 節氣：若你之後要精準計算，可接外部函式；目前先留空（可手動）
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

  function getFormData() {
    return {
      mealDate: $("mealDate").value,
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

      // 可選：農曆/節氣（目前頁面只顯示，不強制存；你若要手動也可加 input）
      lunarText: $("lunarText").textContent || "",
      solarTermText: $("solarTermText").textContent || "",
      weekdayText: $("weekdayText").textContent || "",
    };
  }

  function setFormData(data) {
    $("mealDate").value = data?.mealDate || "";
    $("deliveryDate").value = data?.deliveryDate || "";

    setNum("meat_blenderized", data?.meat?.blenderized ?? 0);
    setNum("meat_congeeVeg", data?.meat?.congeeVeg ?? 0);
    setNum("meat_cookedRiceMinced", data?.meat?.cookedRiceMinced ?? 0);
    setNum("meat_general", data?.meat?.general ?? 0);

    setNum("veg_blenderized", data?.vegetarian?.blenderized ?? 0);
    setNum("veg_congeeVeg", data?.vegetarian?.congeeVeg ?? 0);
    setNum("veg_cookedRiceMinced", data?.vegetarian?.cookedRiceMinced ?? 0);
    setNum("veg_general", data?.vegetarian?.general ?? 0);

    recalc();

    $("lunarText").textContent = data?.lunarText || "";
    $("solarTermText").textContent = data?.solarTermText || "";
    $("weekdayText").textContent = data?.weekdayText || "";
    setHeaderInfo($("mealDate").value);
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

  function validateBeforeSave(payload) {
    if (!payload.mealDate) return getText("meal_msg_select_date");
    if (!payload.deliveryDate) return getText("meal_msg_select_delivery_date");

    // 至少要有一個數字 > 0
    if ((payload.grandTotal ?? 0) <= 0) return getText("meal_msg_need_any_people");
    return null;
  }

  async function loadForMealDate(mealISO) {
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

      if (!snap.exists) {
        // 新增模式：預設送單日期=前一天（你圖上是 送單=12/13, 用餐=12/14）
        $("mealDate").value = mealISO;
        $("deliveryDate").value = addDaysISO(mealISO, -1);
        setHeaderInfo(mealISO);
        recalc();
        showStatus(getText("meal_msg_no_data"), "secondary");
        return;
      }

      const data = snap.data() || {};
      setFormData(data);

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
      const docId = payload.mealDate; // 用餐日期作為 docId
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

  function wireUI() {
    // 預設：用餐=明天，送單=今天（常見：今天填明天餐）
    const today = todayISO();
    $("deliveryDate").value = today;
    $("mealDate").value = addDaysISO(today, 1);
    setHeaderInfo($("mealDate").value);

    // 任何數字改變都重算
    document.querySelectorAll(".meal-num").forEach((el) => {
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });

    $("mealDate").addEventListener("change", () => {
      setHeaderInfo($("mealDate").value);
      clearStatus();
      clearSignatureUI();
      showStatus(getText("meal_msg_date_changed"), "secondary");
    });

    $("loadBtn").addEventListener("click", async () => {
      const d = $("mealDate").value;
      if (!d) return alert(getText("meal_msg_select_date"));
      await loadForMealDate(d);
    });

    $("saveBtn").addEventListener("click", async () => {
      recalc();
      const payload = getFormData();
      const msg = validateBeforeSave(payload);
      if (msg) return alert(msg);

      openSignModal(async (name, note) => {
        await saveWithSignature(payload, name, note);
      });
    });

    recalc();
    // 初次進入就自動載入預設用餐日
    loadForMealDate($("mealDate").value);
  }

  document.addEventListener("firebase-ready", () => {
    wireUI();
  });
})();
