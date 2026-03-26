// meal-caregiver.js
// 點餐系統（照服員端）- 表單版（每日餐點登記表）
// 規則：用餐日期 = 送單日期 + 1 天
// - 只需要選送單日期，系統自動帶出用餐日期（不可手動調整）
// - 送單日期一改就會自動載入該「用餐日期」的點餐數量（不需要再按載入）
// - 儲存時會自動優先帶入登入者資料作為簽名
// - Firestore: collection = mealOrders, docId = YYYY-MM-DD（用餐日期）

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let currentLoginUser = null;

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

  function getText(key, fallback = "") {
    try {
      if (typeof window.getText === "function") return window.getText(key);
      if (typeof getText === "function") return getText(key);
    } catch (_) {}
    return fallback || key;
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
    if (!badge) return;
    badge.style.display = "inline-block";
    badge.className = `badge text-bg-${type}`;
    badge.textContent = text;
  }

  function clearStatus() {
    const badge = $("statusBadge");
    if (!badge) return;
    badge.style.display = "none";
    badge.textContent = "";
  }

  function setLastSignedInfo(info) {
    const el = $("lastSignedInfo");
    if (el) el.innerHTML = info || "";
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

  function readJsonStorage(key) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getLoginUser() {
    const candidates = [
      "antai_session_user",
      "caregiverAuth",
      "officeAuth",
      "nurseAuth",
      "nutritionistAuth",
      "rehabAuth"
    ];

    for (const key of candidates) {
      const user = readJsonStorage(key);
      if (user && (user.displayName || user.staffId || user.username)) {
        return {
          staffId: String(user.staffId || user.username || "").trim(),
          displayName: String(user.displayName || user.name || user.username || "").trim(),
          username: String(user.username || "").trim(),
          role: String(user.role || user.source || "").trim(),
          sourceKey: key
        };
      }
    }

    return null;
  }

  function signerTextFromUser(user) {
    if (!user) return "";
    const parts = [];
    if (user.staffId) parts.push(user.staffId);
    if (user.displayName) parts.push(user.displayName);
    return parts.join(" ").trim();
  }

  function renderLoginUser() {
    currentLoginUser = getLoginUser();
    const loginUserDisplay = $("loginUserDisplay");
    if (!loginUserDisplay) return;

    if (!currentLoginUser) {
      loginUserDisplay.textContent = "未登入";
      return;
    }

    const roleText = currentLoginUser.role ? ` / ${currentLoginUser.role}` : "";
    loginUserDisplay.textContent = `${signerTextFromUser(currentLoginUser) || currentLoginUser.displayName}${roleText}`;
  }

  function clearSignatureUI() {
    $("signatureDisplay").textContent = "—";
    if ($("signatureStaffIdDisplay")) $("signatureStaffIdDisplay").textContent = "";
    $("signatureTimeDisplay").textContent = "";
    $("signatureNoteDisplay").textContent = "";
    setLastSignedInfo("");
  }

  function setSignatureUI(signedBy, signedAt, signedNote, signedStaffId) {
    $("signatureDisplay").textContent = signedBy ? signedBy : "—";
    if ($("signatureStaffIdDisplay")) {
      $("signatureStaffIdDisplay").textContent = signedStaffId ? `員編 / Staff ID：${signedStaffId}` : "";
    }
    const timeText = signedAt ? signedAt.toLocaleString() : "";
    $("signatureTimeDisplay").textContent = timeText ? timeText : "";
    $("signatureNoteDisplay").textContent = signedNote ? signedNote : "";

    if (signedBy) {
      const note = signedNote ? `（${escapeHtml(String(signedNote))}）` : "";
      const staffIdText = signedStaffId ? ` <span class="text-muted">[${escapeHtml(String(signedStaffId))}]</span>` : "";
      setLastSignedInfo(
        `<i class="fas fa-pen-fancy me-2"></i>${escapeHtml(getText("meal_last_signature", "最後簽名"))}：<b>${escapeHtml(
          String(signedBy)
        )}</b>${staffIdText}${note} <span class="text-muted">(${escapeHtml(timeText)})</span>`
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
      mealDate: $("mealDate").value,
      deliveryDate: $("deliveryDate").value,
      meat: {
        blenderized: numVal("meat_blenderized"),
        congeeVeg: numVal("meat_congeeVeg"),
        cookedRiceMinced: numVal("meat_cookedRiceMinced"),
        general: numVal("meat_general"),
        subtotal: numVal("meat_subtotal")
      },
      vegetarian: {
        blenderized: numVal("veg_blenderized"),
        congeeVeg: numVal("veg_congeeVeg"),
        cookedRiceMinced: numVal("veg_cookedRiceMinced"),
        general: numVal("veg_general"),
        subtotal: numVal("veg_subtotal")
      },
      grandTotal: numVal("grandTotal"),
      lunarText: $("lunarText").textContent || "",
      solarTermText: $("solarTermText").textContent || "",
      weekdayText: $("weekdayText").textContent || ""
    };
  }

  function validateBeforeSave(payload) {
    if (!payload.deliveryDate) return getText("meal_msg_select_delivery_date", "請先選擇送單日期");
    if (!payload.mealDate) return getText("meal_msg_select_date", "請先選擇日期");
    if ((payload.grandTotal ?? 0) <= 0) return getText("meal_msg_need_any_people", "請至少輸入一項餐點人數");
    return null;
  }

  async function loadForMealDate(mealISO, deliveryISO) {
    const _db = safeDb();
    if (!_db) {
      alert(getText("meal_msg_firebase_not_ready", "Firebase 尚未就緒"));
      return;
    }

    clearStatus();
    clearSignatureUI();

    try {
      showStatus(getText("meal_msg_loading", "載入中..."), "secondary");
      const docRef = _db.collection("mealOrders").doc(mealISO);
      const snap = await docRef.get();

      $("mealDate").value = mealISO;
      $("deliveryDate").value = deliveryISO;
      setHeaderInfo(mealISO);

      if (!snap.exists) {
        setFormNumbers({});
        showStatus(getText("meal_msg_no_data", "尚無資料"), "secondary");
        return;
      }

      const data = snap.data() || {};
      setFormNumbers(data);

      if (data.signedBy) {
        const signedAt = data.signedAt?.toDate ? data.signedAt.toDate() : (data.signedAt ? new Date(data.signedAt) : null);
        setSignatureUI(data.signedBy, signedAt, data.signedNote || "", data.signedStaffId || "");
        showStatus(getText("meal_msg_loaded_with_sign", "已載入資料（含簽名）"), "success");
      } else {
        showStatus(getText("meal_msg_loaded", "已載入資料"), "success");
      }
    } catch (err) {
      console.error(err);
      alert(getText("meal_msg_load_failed", "載入失敗"));
      showStatus(getText("meal_msg_load_failed", "載入失敗"), "danger");
    }
  }

  async function saveWithSignature(payload, signerName, signerNote, signerStaffId) {
    const _db = safeDb();
    if (!_db) {
      alert(getText("meal_msg_firebase_not_ready", "Firebase 尚未就緒"));
      return;
    }

    try {
      showStatus(getText("meal_msg_saving", "儲存中..."), "secondary");

      const now = new Date();
      const docId = payload.mealDate;
      const docRef = _db.collection("mealOrders").doc(docId);

      const dataToSave = {
        ...payload,
        signedBy: signerName,
        signedStaffId: signerStaffId || "",
        signedNote: signerNote || "",
        signerSource: currentLoginUser?.sourceKey || "",
        signerRole: currentLoginUser?.role || "",
        updatedBy: signerName,
        updatedByStaffId: signerStaffId || "",
        signedAt: firebase.firestore.Timestamp.fromDate(now),
        updatedAt: firebase.firestore.Timestamp.fromDate(now)
      };

      const snap = await docRef.get();
      if (!snap.exists) {
        dataToSave.createdAt = firebase.firestore.Timestamp.fromDate(now);
        dataToSave.createdBy = signerName;
        dataToSave.createdByStaffId = signerStaffId || "";
      }

      await docRef.set(dataToSave, { merge: true });

      showStatus(getText("meal_msg_saved", "儲存成功"), "success");
      setSignatureUI(signerName, now, signerNote || "", signerStaffId || "");
    } catch (err) {
      console.error(err);
      alert(getText("meal_msg_save_failed", "儲存失敗"));
      showStatus(getText("meal_msg_save_failed", "儲存失敗"), "danger");
    }
  }

  function openSignModal(onConfirm) {
    const modalEl = $("signModal");
    const modal = new bootstrap.Modal(modalEl, { backdrop: "static" });

    const defaultName = currentLoginUser?.displayName || "";
    const defaultStaffId = currentLoginUser?.staffId || "";

    $("signerName").value = defaultName;
    $("signerStaffId").value = defaultStaffId;
    $("signerNote").value = "";

    $("signerName").readOnly = !!defaultName;
    $("signerStaffId").readOnly = !!defaultStaffId;

    const confirmBtn = $("confirmSignBtn");

    const handler = async () => {
      const name = $("signerName").value.trim();
      const staffId = $("signerStaffId").value.trim();
      const note = $("signerNote").value.trim();

      if (!name) {
        alert(getText("meal_msg_enter_signer", "請輸入簽名姓名"));
        return;
      }

      confirmBtn.disabled = true;
      try {
        await onConfirm(name, note, staffId);
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
    await loadForMealDate(mealISO, deliveryISO);
  }

  function preserveBilingualText() {
    document.documentElement.lang = "zh-Hant";
    const switcher = $("lang-switcher");
    if (switcher) {
      switcher.textContent = "中 / EN";
    }
  }

  function wireUI() {
    renderLoginUser();
    preserveBilingualText();

    $("deliveryDate").value = todayISO();
    $("mealDate").value = addDaysISO($("deliveryDate").value, 1);
    setHeaderInfo($("mealDate").value);

    document.querySelectorAll(".meal-num").forEach((el) => {
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });

    $("deliveryDate").addEventListener("change", () => {
      syncByDeliveryDate();
      showStatus(getText("meal_msg_auto_loaded", "已依送單日期自動載入"), "secondary");
    });

    $("saveBtn").addEventListener("click", async () => {
      renderLoginUser();
      recalc();
      const payload = getPayload();
      const msg = validateBeforeSave(payload);
      if (msg) return alert(msg);

      openSignModal(async (name, note, staffId) => {
        await saveWithSignature(payload, name, note, staffId);
      });
    });

    syncByDeliveryDate();
    recalc();
  }

  document.addEventListener("firebase-ready", () => {
    wireUI();
  });
})();
