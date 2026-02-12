/* idle-timeout.secure.js
 * 安泰護家系統通用插件版（自動啟動）
 * - 閒置 3 分鐘跳提示，倒數 120 秒仍無動作則強制登出
 * - 預設使用 sessionStorage key: "antai_session_user"
 * - 預設登出：移除 session 並重新載入目前頁面
 *
 * ✅ 用法（最簡）
 *   <script src="idle-timeout.secure.js"></script>
 *
 * ✅ 覆寫設定（可選）：在載入本檔案前設定 window.IDLE_TIMEOUT_CONFIG
 *   <script>
 *     window.IDLE_TIMEOUT_CONFIG = { idleSeconds: 300, countdownSeconds: 60, sessionKey: "xxx", redirectUrl: "login.html" };
 *   </script>
 *   <script src="idle-timeout.secure.js"></script>
 *
 * ✅ 若你想完全手動控制（不自動啟動）：
 *   window.IDLE_TIMEOUT_CONFIG = { autoStart: false };
 */

(function (global) {
  const DEFAULTS = {
    // 規則
    idleSeconds: 10,
    countdownSeconds: 120,
    checkIntervalMs: 1000,

    // 安泰 session
    sessionKey: "antai_session_user",

    // 行為
    redirectUrl: null,        // 預設：留在目前頁（reload）
    autoStart: true,          // ✅ 預設自動啟動
    storageKeysToClear: [],   // 若你還有 localStorage 需要清，可填

    // UI 文案
    titleText: "閒置提醒",
    messageText: "你已閒置一段時間。若未繼續操作，系統將自動登出以保護資料安全。",
    continueBtnText: "我還在使用",
    logoutBtnText: "立即登出",
  };

  let cfg = null;
  let lastActivityAt = 0;
  let idleTimer = null;
  let warnCountdownTimer = null;
  let warnRemaining = 0;
  let isWarningShown = false;

  let overlayEl = null;
  let countdownEl = null;

  const ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "click",
  ];

  function now() {
    return Date.now();
  }

  function safeParseJSON(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  // ✅ 預設登入判斷：只要 sessionKey 存在且 JSON 可解析就算登入
  function defaultIsLoggedIn() {
    if (!cfg) return false;
    const raw = sessionStorage.getItem(cfg.sessionKey);
    if (!raw) return false;
    return !!safeParseJSON(raw);
  }

  // ✅ 預設登出：清 session + 清 localStorage keys（可選）+ reload/redirect
  async function defaultSignOut(reason) {
    try { sessionStorage.removeItem(cfg.sessionKey); } catch (_) {}

    if (cfg.storageKeysToClear && cfg.storageKeysToClear.length) {
      cfg.storageKeysToClear.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }

    // redirectUrl 優先；否則 reload
    if (cfg.redirectUrl) {
      const url = cfg.redirectUrl.includes("?")
        ? `${cfg.redirectUrl}&reason=${encodeURIComponent(reason)}`
        : `${cfg.redirectUrl}?reason=${encodeURIComponent(reason)}`;
      window.location.href = url;
    } else {
      window.location.reload();
    }
  }

  function addListeners() {
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function removeListeners() {
    ACTIVITY_EVENTS.forEach((evt) =>
      window.removeEventListener(evt, onActivity)
    );
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function onVisibilityChange() {
    if (!document.hidden) onActivity();
  }

  function onActivity() {
    if (!cfg) return;
    if (cfg.isLoggedInFn && !cfg.isLoggedInFn()) return;

    lastActivityAt = now();

    // 警告視窗倒數中，只要有任何動作就視為仍在使用
    if (isWarningShown) {
      hideWarning();
      resetIdleCheck();
    }
  }

  function resetIdleCheck() {
    clearInterval(idleTimer);
    idleTimer = setInterval(tickIdleCheck, cfg.checkIntervalMs);
  }

  function tickIdleCheck() {
    if (!cfg) return;

    if (cfg.isLoggedInFn && !cfg.isLoggedInFn()) {
      if (isWarningShown) hideWarning();
      return;
    }

    const idleMs = now() - lastActivityAt;
    if (!isWarningShown && idleMs >= cfg.idleSeconds * 1000) {
      showWarning();
    }
  }

  function showWarning() {
    isWarningShown = true;
    warnRemaining = cfg.countdownSeconds;

    ensureOverlay();
    overlayEl.style.display = "flex";
    updateCountdownText();

    clearInterval(warnCountdownTimer);
    warnCountdownTimer = setInterval(() => {
      warnRemaining -= 1;
      updateCountdownText();

      if (warnRemaining <= 0) {
        clearInterval(warnCountdownTimer);
        forceLogout("idle_timeout");
      }
    }, 1000);
  }

  function hideWarning() {
    isWarningShown = false;
    clearInterval(warnCountdownTimer);
    warnCountdownTimer = null;
    if (overlayEl) overlayEl.style.display = "none";
  }

  function updateCountdownText() {
    if (!countdownEl) return;
    const mm = Math.floor(warnRemaining / 60);
    const ss = warnRemaining % 60;
    const pad = (n) => String(n).padStart(2, "0");
    countdownEl.textContent = `${pad(mm)}:${pad(ss)}`;
  }

  async function forceLogout(reason) {
    try {
      hideWarning();
      if (typeof cfg.signOutFn === "function") {
        await cfg.signOutFn(reason);
      } else {
        await defaultSignOut(reason);
      }
    } catch (err) {
      console.error("[IdleTimeoutSecure] forceLogout error:", err);
      // 就算出錯也至少 reload/redirect
      try { await defaultSignOut(reason); } catch (_) {}
    }
  }

  function ensureOverlay() {
    if (overlayEl) return;

    const style = document.createElement("style");
    style.textContent = `
      .it-overlay{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.45);
        display:none; align-items:center; justify-content:center;
        z-index: 99999;
      }
      .it-card{
        width: min(520px, calc(100vw - 32px));
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 18px 50px rgba(0,0,0,.25);
        padding: 18px;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", Arial, sans-serif;
      }
      .it-title{ font-size: 18px; font-weight: 700; margin-bottom: 10px; }
      .it-msg{ font-size: 14px; line-height: 1.6; margin-bottom: 14px; }
      .it-timer{
        font-size: 22px; font-weight: 800;
        margin-bottom: 14px; color:#b00020;
      }
      .it-actions{ display:flex; gap:10px; justify-content:flex-end; }
      .it-btn{
        border:0; border-radius: 10px;
        padding: 10px 12px; cursor:pointer; font-size: 14px;
      }
      .it-btn-primary{ background:#111; color:#fff; }
      .it-btn-ghost{ background:#eee; color:#111; }
    `;
    document.head.appendChild(style);

    overlayEl = document.createElement("div");
    overlayEl.className = "it-overlay";
    overlayEl.innerHTML = `
      <div class="it-card">
        <div class="it-title">${cfg.titleText}</div>
        <div class="it-msg">${cfg.messageText}</div>
        <div class="it-timer">倒數：<span id="it-countdown">02:00</span></div>
        <div class="it-actions">
          <button class="it-btn it-btn-ghost" id="it-logout">${cfg.logoutBtnText}</button>
          <button class="it-btn it-btn-primary" id="it-continue">${cfg.continueBtnText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    countdownEl = overlayEl.querySelector("#it-countdown");

    overlayEl.querySelector("#it-continue").addEventListener("click", () => {
      onActivity();
    });

    overlayEl.querySelector("#it-logout").addEventListener("click", () => {
      forceLogout("manual_logout");
    });
  }

  function start(options) {
    cfg = Object.assign({}, DEFAULTS, options || {});

    // 若外部沒給登入判斷，就用預設
    if (typeof cfg.isLoggedInFn !== "function") cfg.isLoggedInFn = defaultIsLoggedIn;

    lastActivityAt = now();
    addListeners();
    resetIdleCheck();
  }

  function stop() {
    hideWarning();
    clearInterval(idleTimer);
    idleTimer = null;
    cfg = null;
    removeListeners();
  }

  // 公開 API（若你某些頁想手動控制仍可用）
  global.IdleTimeoutSecure = {
    start,
    stop,
    forceLogout,
  };

  // ✅ 自動啟動（可用 window.IDLE_TIMEOUT_CONFIG 覆寫）
  function autoBoot() {
    if (global.__IDLE_TIMEOUT_SECURE_STARTED__) return;
    global.__IDLE_TIMEOUT_SECURE_STARTED__ = true;

    const userCfg = global.IDLE_TIMEOUT_CONFIG && typeof global.IDLE_TIMEOUT_CONFIG === "object"
      ? global.IDLE_TIMEOUT_CONFIG
      : {};

    const merged = Object.assign({}, DEFAULTS, userCfg);

    if (!merged.autoStart) return;

    // start() 會補 defaultIsLoggedIn
    start(merged);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBoot);
  } else {
    autoBoot();
  }
})(window);
