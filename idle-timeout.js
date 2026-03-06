/* idle-timeout.secure.js + Antai Shell Sidebar
 * 安泰護家系統通用插件整合版（自動啟動）
 * - 閒置 3 分鐘跳提示，倒數 120 秒仍無動作則強制登出
 * - 左側系統側邊欄（日期 / 天氣 / 溫度 / 系統清單）
 * - 只需引用這一支 script 即可自動依頁面判斷系統群組
 *
 * ✅ 最簡用法
 *   <script src="idle-timeout.js"></script>
 *
 * ✅ 如需覆寫閒置秒數或自訂 shell，仍可在載入前設定 window.IDLE_TIMEOUT_CONFIG
 * ✅ 也支援獨立配置 window.ANTAI_SHELL_CONFIG
 */

(function (global) {
  const DEFAULTS = {
    // 規則
    idleSeconds: 180,
    countdownSeconds: 120,
    checkIntervalMs: 1000,

    // 安泰 session
    sessionKey: "antai_session_user",

    // 行為
    redirectUrl: null,
    autoStart: true,
    storageKeysToClear: [],

    // UI 文案
    titleText: "閒置提醒",
    messageText: "你已閒置一段時間。若未繼續操作，系統將自動登出以保護資料安全。",
    continueBtnText: "我還在使用",
    logoutBtnText: "立即登出",

    // Shell sidebar
    shell: {
      enabled: false,
      side: "left",
      collapsed: false,
      width: 316,
      mobileBreakpoint: 980,
      mountToBody: true,
      pageContainerSelector: null,
      zIndex: 9998,
      autoInjectToggle: true,
      dateFormatter: null,
      systemKey: "default",
      activeKey: null,
      title: "系統選單",
      homeHref: null,
      weather: {
        enabled: true,
        locationName: "目前位置",
        latitude: null,
        longitude: null,
        units: "celsius",
        refreshMinutes: 5,
        provider: "open-meteo"
      },
      systems: {
        default: {
          label: "系統選單",
          items: []
        }
      }
    }
  };

  let cfg = null;
  let lastActivityAt = 0;
  let idleTimer = null;
  let warnCountdownTimer = null;
  let warnRemaining = 0;
  let isWarningShown = false;

  let overlayEl = null;
  let countdownEl = null;

  let shellState = {
    cfg: null,
    rootEl: null,
    styleEl: null,
    contentWrapper: null,
    weatherTempEl: null,
    weatherTextEl: null,
    weatherIconEl: null,
    dateEl: null,
    collapseBtn: null,
    mobileToggleBtn: null,
    drawerBackdropEl: null,
    refreshTimer: null,
    isMounted: false
  };

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

  function deepMerge(base, override) {
    const output = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!override || typeof override !== "object") return output;

    Object.keys(override).forEach((key) => {
      const baseVal = output[key];
      const overVal = override[key];

      if (Array.isArray(overVal)) {
        output[key] = overVal.slice();
      } else if (
        baseVal && typeof baseVal === "object" && !Array.isArray(baseVal) &&
        overVal && typeof overVal === "object" && !Array.isArray(overVal)
      ) {
        output[key] = deepMerge(baseVal, overVal);
      } else {
        output[key] = overVal;
      }
    });

    return output;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function defaultIsLoggedIn() {
    if (!cfg) return false;
    const raw = sessionStorage.getItem(cfg.sessionKey);
    if (!raw) return false;
    return !!safeParseJSON(raw);
  }

  async function defaultSignOut(reason) {
    try { sessionStorage.removeItem(cfg.sessionKey); } catch (_) {}

    if (cfg.storageKeysToClear && cfg.storageKeysToClear.length) {
      cfg.storageKeysToClear.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }

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
    window.addEventListener("resize", onShellResize, { passive: true });
  }

  function removeListeners() {
    ACTIVITY_EVENTS.forEach((evt) =>
      window.removeEventListener(evt, onActivity)
    );
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", onShellResize);
  }

  function onVisibilityChange() {
    if (!document.hidden) onActivity();
  }

  function onActivity() {
    if (!cfg) return;
    if (cfg.isLoggedInFn && !cfg.isLoggedInFn()) return;

    lastActivityAt = now();

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
        <div class="it-title">${escapeHtml(cfg.titleText)}</div>
        <div class="it-msg">${escapeHtml(cfg.messageText)}</div>
        <div class="it-timer">倒數：<span id="it-countdown">02:00</span></div>
        <div class="it-actions">
          <button class="it-btn it-btn-ghost" id="it-logout">${escapeHtml(cfg.logoutBtnText)}</button>
          <button class="it-btn it-btn-primary" id="it-continue">${escapeHtml(cfg.continueBtnText)}</button>
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

  const AUTO_SHELL_DEFAULTS = {
    enabled: true,
    title: "安泰護家系統",
    weather: {
      enabled: true,
      locationName: "屏東縣東港鎮",
      latitude: 22.465,
      longitude: 120.449,
      refreshMinutes: 5,
      provider: "open-meteo"
    },
    systems: {
      nurse: {
        label: "護理師系統",
        items: [
          { key: "dashboard", label: "護理師儀表板", href: "nurse-dashboard.html", icon: "grid", description: "總覽與快速操作" },
          { key: "whiteboard", label: "白板資訊", href: "nurse-whiteboard.html", icon: "sparkles", description: "交班與即時看板" },
          { key: "residents", label: "住民資料", href: "residents-admin.html", icon: "users", description: "住民基本與照護資料" },
          { key: "wound", label: "傷口照護", href: "wound-care.html", icon: "bandage", description: "傷口紀錄與追蹤" },
          { key: "foley", label: "導尿管系統", href: "foley-care.html", icon: "droplet", description: "導尿管紀錄與提醒" },
          { key: "rounds", label: "醫師巡診", href: "doctor-rounds.html", icon: "heart", description: "巡診與醫囑紀錄" },
          { key: "quality", label: "品管事件", href: "qc-incident.html", icon: "shield", description: "事件登錄與統計" }
        ]
      },
      admin: {
        label: "行政管理系統",
        items: [
          { key: "accounts", label: "帳號管理", href: "account-admin.html", icon: "settings", description: "權限與帳號設定" },
          { key: "employees", label: "員工資料", href: "employees-admin.html", icon: "users", description: "員工名冊與資料管理" },
          { key: "officeStay", label: "外宿系統", href: "office-stay.html", icon: "grid", description: "外宿申請與審核" },
          { key: "education", label: "繼續教育", href: "education-training-admin.html", icon: "sparkles", description: "課程與訓練管理" },
          { key: "bookingList", label: "探視管理", href: "bookings-list.html", icon: "heart", description: "探視預約後台管理" }
        ]
      },
      nutrition: {
        label: "營養師系統",
        items: [
          { key: "meals", label: "餐食管理", href: "nutritionist-meals.html", icon: "grid", description: "餐食與飲食安排" },
          { key: "consult", label: "營養會診", href: "consult.html", icon: "heart", description: "會診與追蹤紀錄" }
        ]
      },
      family: {
        label: "家屬探視系統",
        items: [
          { key: "booking", label: "預約探視", href: "bookings.html", icon: "users", description: "家屬探視預約" }
        ]
      }
    }
  };

  const AUTO_PAGE_RULES = [
    { match: ["nurse-dashboard"], systemKey: "nurse", activeKey: "dashboard" },
    { match: ["nurse-whiteboard"], systemKey: "nurse", activeKey: "whiteboard" },
    { match: ["residents-admin"], systemKey: "nurse", activeKey: "residents" },
    { match: ["wound-care"], systemKey: "nurse", activeKey: "wound" },
    { match: ["foley-care"], systemKey: "nurse", activeKey: "foley" },
    { match: ["doctor-rounds"], systemKey: "nurse", activeKey: "rounds" },
    { match: ["qc-incident"], systemKey: "nurse", activeKey: "quality" },
    { match: ["account-admin"], systemKey: "admin", activeKey: "accounts" },
    { match: ["employees-admin"], systemKey: "admin", activeKey: "employees" },
    { match: ["office-stay"], systemKey: "admin", activeKey: "officeStay" },
    { match: ["education-training-admin"], systemKey: "admin", activeKey: "education" },
    { match: ["bookings-list"], systemKey: "admin", activeKey: "bookingList" },
    { match: ["nutritionist-meals"], systemKey: "nutrition", activeKey: "meals" },
    { match: ["consult"], systemKey: "nutrition", activeKey: "consult" },
    { match: ["bookings"], systemKey: "family", activeKey: "booking" }
  ];

  function getCurrentPageName() {
    try {
      const pathname = String(window.location.pathname || "");
      const cleaned = pathname.split("?")[0].split("#")[0];
      return (cleaned.split("/").pop() || "").toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function inferShellFromLocation() {
    const page = getCurrentPageName();
    if (!page) return { enabled: false };

    const hit = AUTO_PAGE_RULES.find((rule) => Array.isArray(rule.match) && rule.match.some((token) => page.includes(String(token).toLowerCase())));
    if (!hit) return { enabled: false };

    return {
      enabled: true,
      title: AUTO_SHELL_DEFAULTS.title,
      systemKey: hit.systemKey,
      activeKey: hit.activeKey,
      systems: AUTO_SHELL_DEFAULTS.systems,
      weather: AUTO_SHELL_DEFAULTS.weather
    };
  }

  function getShellConfig(options) {
    const embeddedShell = options && typeof options.shell === "object" ? options.shell : null;
    const externalShell = global.ANTAI_SHELL_CONFIG && typeof global.ANTAI_SHELL_CONFIG === "object"
      ? global.ANTAI_SHELL_CONFIG
      : null;
    const inferredShell = inferShellFromLocation();

    const merged = deepMerge(
      DEFAULTS.shell,
      deepMerge(AUTO_SHELL_DEFAULTS, deepMerge(inferredShell, embeddedShell || externalShell || {}))
    );

    if (!inferredShell.enabled && !embeddedShell && !externalShell) merged.enabled = false;
    return merged;
  }

  function mountShell(options) {
    const shellCfg = getShellConfig(options);
    shellState.cfg = shellCfg;

    if (!shellCfg.enabled) return;
    if (shellState.isMounted) return;

    injectShellStyles(shellCfg);
    createShellDOM(shellCfg);
    bindShellEvents(shellCfg);
    renderShellDate(shellCfg);
    renderShellMenu(shellCfg);
    renderShellWeather(shellCfg);
    applyShellResponsiveState();
    shellState.isMounted = true;
  }

  function injectShellStyles(shellCfg) {
    if (shellState.styleEl) return;

    const style = document.createElement("style");
    style.id = "antai-shell-sidebar-style";
    style.textContent = `
      :root{
        --antai-shell-width:${Number(shellCfg.width) || 316}px;
        --antai-shell-radius:24px;
        --antai-shell-blur:18px;
        --antai-shell-bg:linear-gradient(180deg, rgba(255,255,255,.88), rgba(248,250,255,.82));
        --antai-shell-border:rgba(255,255,255,.58);
        --antai-shell-shadow:0 14px 38px rgba(18,32,73,.12);
        --antai-shell-text:#19324d;
        --antai-shell-muted:#5f7187;
        --antai-shell-accent:#3f7cff;
        --antai-shell-accent-soft:rgba(63,124,255,.10);
      }
      .antai-shell-root, .antai-shell-root *{ box-sizing:border-box; }
      .antai-shell-root{
        position:fixed;
        top:14px;
        left:14px;
        bottom:14px;
        width:var(--antai-shell-width);
        z-index:${Number(shellCfg.zIndex) || 9998};
        display:flex;
        flex-direction:column;
        gap:12px;
        transform:translateX(0);
        transition:transform .28s ease, width .28s ease, opacity .28s ease;
        font-family:system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", Arial, sans-serif;
      }
      .antai-shell-root.is-collapsed{
        width:84px;
      }
      .antai-shell-panel{
        flex:1;
        min-height:0;
        border-radius:28px;
        border:1px solid var(--antai-shell-border);
        background:var(--antai-shell-bg);
        box-shadow:var(--antai-shell-shadow);
        backdrop-filter:blur(var(--antai-shell-blur));
        -webkit-backdrop-filter:blur(var(--antai-shell-blur));
        overflow:hidden;
        display:flex;
        flex-direction:column;
        position:relative;
      }
      .antai-shell-panel::before{
        content:"";
        position:absolute;
        inset:0 0 auto 0;
        height:170px;
        background:radial-gradient(circle at top right, rgba(102,157,255,.20), transparent 52%),
                   radial-gradient(circle at top left, rgba(62,204,255,.14), transparent 48%);
        pointer-events:none;
      }
      .antai-shell-scroll{
        position:relative;
        z-index:1;
        padding:14px;
        overflow:auto;
        min-height:0;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .antai-shell-topbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .antai-shell-brand{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }
      .antai-shell-badge{
        width:40px; height:40px; border-radius:14px;
        display:grid; place-items:center;
        background:linear-gradient(135deg, rgba(63,124,255,.16), rgba(86,180,255,.18));
        color:var(--antai-shell-accent);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.6);
        flex:0 0 auto;
      }
      .antai-shell-title-wrap{ min-width:0; }
      .antai-shell-title{
        color:var(--antai-shell-text);
        font-size:15px; font-weight:800; line-height:1.2;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .antai-shell-subtitle{
        color:var(--antai-shell-muted);
        font-size:12px; margin-top:2px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .antai-shell-collapse-btn,
      .antai-shell-mobile-toggle{
        border:0; cursor:pointer;
        border-radius:14px;
        background:rgba(255,255,255,.72);
        color:var(--antai-shell-text);
        box-shadow:0 8px 18px rgba(14,33,73,.08);
        transition:transform .18s ease, background .18s ease;
      }
      .antai-shell-collapse-btn:hover,
      .antai-shell-mobile-toggle:hover{ transform:translateY(-1px); }
      .antai-shell-collapse-btn{
        width:38px; height:38px;
        display:grid; place-items:center;
        flex:0 0 auto;
      }
      .antai-shell-mobile-toggle{
        position:fixed;
        left:14px; top:14px;
        width:46px; height:46px;
        z-index:${(Number(shellCfg.zIndex) || 9998) + 1};
        display:none;
      }
      .antai-shell-mobile-backdrop{
        position:fixed; inset:0;
        background:rgba(14,22,38,.28);
        backdrop-filter:blur(2px);
        -webkit-backdrop-filter:blur(2px);
        z-index:${Number(shellCfg.zIndex) || 9997};
        display:none;
      }
      .antai-shell-weather{
        position:relative;
        overflow:hidden;
        border-radius:24px;
        padding:16px 16px 15px;
        color:#fff;
        background:linear-gradient(155deg, #5f9dff, #70c8ff 52%, #89d8ff);
        box-shadow:0 14px 26px rgba(65,128,255,.24);
      }
      .antai-shell-weather::before,
      .antai-shell-weather::after{
        content:"";
        position:absolute;
        border-radius:999px;
        background:rgba(255,255,255,.18);
        filter:blur(2px);
        animation:antaiFloat 7.2s ease-in-out infinite;
      }
      .antai-shell-weather::before{ width:140px; height:140px; top:-68px; right:-36px; }
      .antai-shell-weather::after{ width:92px; height:92px; bottom:-34px; left:-24px; animation-delay:-2.4s; }
      .antai-shell-weather-row{
        display:flex; align-items:flex-start; justify-content:space-between; gap:14px;
        position:relative; z-index:1;
      }
      .antai-shell-weather-date{
        font-size:14px; font-weight:700; opacity:.96;
      }
      .antai-shell-weather-place{
        margin-top:6px; font-size:12px; opacity:.88;
      }
      .antai-shell-weather-right{ text-align:right; flex:0 0 auto; }
      .antai-shell-weather-icon{
        width:44px; height:44px; margin-left:auto; margin-bottom:8px;
        display:grid; place-items:center;
      }
      .antai-shell-weather-icon svg{ width:44px; height:44px; display:block; }
      .antai-shell-weather-text{
        font-size:13px; font-weight:700; opacity:.95;
      }
      .antai-shell-weather-temp{
        margin-top:6px; display:flex; align-items:center; justify-content:flex-end; gap:6px;
        font-size:26px; font-weight:800; letter-spacing:-.02em;
      }
      .antai-shell-thermo{ width:18px; height:18px; opacity:.95; }
      .antai-shell-section-title{
        padding:2px 4px 0;
        font-size:12px; font-weight:800;
        color:var(--antai-shell-muted);
        letter-spacing:.06em;
      }
      .antai-shell-menu{
        display:flex; flex-direction:column; gap:8px;
      }
      .antai-shell-item{
        display:flex; align-items:flex-start; gap:12px;
        text-decoration:none;
        color:var(--antai-shell-text);
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.58);
        border:1px solid rgba(255,255,255,.62);
        box-shadow:0 8px 20px rgba(31,51,84,.06);
        transition:transform .16s ease, box-shadow .16s ease, background .16s ease, border-color .16s ease;
      }
      .antai-shell-item:hover{
        transform:translateY(-1px);
        box-shadow:0 12px 24px rgba(31,51,84,.10);
        background:rgba(255,255,255,.84);
      }
      .antai-shell-item.is-active{
        background:linear-gradient(180deg, rgba(63,124,255,.15), rgba(63,124,255,.10));
        border-color:rgba(63,124,255,.30);
      }
      .antai-shell-item-icon{
        width:40px; height:40px; border-radius:14px;
        display:grid; place-items:center;
        background:var(--antai-shell-accent-soft);
        color:var(--antai-shell-accent);
        flex:0 0 auto;
      }
      .antai-shell-item-icon svg{ width:22px; height:22px; }
      .antai-shell-item-content{ min-width:0; flex:1; }
      .antai-shell-item-label{
        font-size:14px; font-weight:800; line-height:1.25;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .antai-shell-item-desc{
        margin-top:4px; font-size:12px; color:var(--antai-shell-muted); line-height:1.45;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
      }
      .antai-shell-root.is-collapsed .antai-shell-title-wrap,
      .antai-shell-root.is-collapsed .antai-shell-section-title,
      .antai-shell-root.is-collapsed .antai-shell-item-content,
      .antai-shell-root.is-collapsed .antai-shell-weather-place,
      .antai-shell-root.is-collapsed .antai-shell-weather-text,
      .antai-shell-root.is-collapsed .antai-shell-weather-temp span,
      .antai-shell-root.is-collapsed .antai-shell-weather-date{
        display:none;
      }
      .antai-shell-root.is-collapsed .antai-shell-weather{
        padding:12px;
      }
      .antai-shell-root.is-collapsed .antai-shell-weather-row{
        justify-content:center;
      }
      .antai-shell-root.is-collapsed .antai-shell-weather-icon{
        margin:0 auto 8px;
      }
      .antai-shell-root.is-collapsed .antai-shell-item{
        justify-content:center; padding:12px 8px;
      }
      .antai-shell-root.is-collapsed .antai-shell-item-icon{
        width:44px; height:44px;
      }
      .antai-shell-page-shift{
        transition:padding-left .28s ease, margin-left .28s ease;
      }
      body.antai-shell-has-sidebar .antai-shell-page-shift,
      body.antai-shell-has-sidebar[data-antai-shell-shift="body"]{
        padding-left:calc(var(--antai-shell-width) + 28px);
      }
      body.antai-shell-has-sidebar .antai-shell-root.is-collapsed ~ .antai-shell-page-shift,
      body.antai-shell-has-sidebar.antai-shell-collapsed .antai-shell-page-shift,
      body.antai-shell-has-sidebar.antai-shell-collapsed[data-antai-shell-shift="body"]{
        padding-left:112px;
      }
      @keyframes antaiFloat{
        0%,100%{ transform:translate3d(0,0,0) scale(1); }
        50%{ transform:translate3d(8px,-8px,0) scale(1.05); }
      }
      @keyframes antaiSunPulse{
        0%,100%{ transform:scale(1); opacity:.98; }
        50%{ transform:scale(1.06); opacity:1; }
      }
      @keyframes antaiCloudDrift{
        0%,100%{ transform:translateX(0); }
        50%{ transform:translateX(4px); }
      }
      @keyframes antaiRainDrop{
        0%{ transform:translateY(-1px); opacity:0; }
        30%{ opacity:1; }
        100%{ transform:translateY(9px); opacity:0; }
      }
      @keyframes antaiSnowDrop{
        0%{ transform:translateY(-1px); opacity:.2; }
        50%{ opacity:1; }
        100%{ transform:translateY(8px); opacity:.15; }
      }
      @media (max-width:${Number(shellCfg.mobileBreakpoint) || 980}px){
        .antai-shell-mobile-toggle{ display:grid; place-items:center; }
        .antai-shell-root{
          top:12px; left:12px; bottom:12px;
          transform:translateX(calc(-100% - 18px));
          width:min(calc(100vw - 24px), var(--antai-shell-width));
        }
        .antai-shell-root.is-mobile-open{ transform:translateX(0); }
        .antai-shell-root.is-collapsed{ width:min(calc(100vw - 24px), var(--antai-shell-width)); }
        body.antai-shell-has-sidebar .antai-shell-page-shift,
        body.antai-shell-has-sidebar[data-antai-shell-shift="body"]{
          padding-left:0 !important;
        }
      }
    `;

    document.head.appendChild(style);
    shellState.styleEl = style;
  }

  function createShellDOM(shellCfg) {
    const root = document.createElement("aside");
    root.className = `antai-shell-root${shellCfg.collapsed ? " is-collapsed" : ""}`;
    root.setAttribute("aria-label", "系統側邊欄");

    const panel = document.createElement("div");
    panel.className = "antai-shell-panel";

    panel.innerHTML = `
      <div class="antai-shell-scroll">
        <div class="antai-shell-topbar">
          <div class="antai-shell-brand">
            <div class="antai-shell-badge">${getIconSvg("sparkles")}</div>
            <div class="antai-shell-title-wrap">
              <div class="antai-shell-title">${escapeHtml(shellCfg.title || "系統選單")}</div>
              <div class="antai-shell-subtitle">${escapeHtml(getSystemLabel(shellCfg))}</div>
            </div>
          </div>
          <button type="button" class="antai-shell-collapse-btn" aria-label="收合側邊欄">${getIconSvg("chevronLeft")}</button>
        </div>

        <section class="antai-shell-weather" data-role="weather-card">
          <div class="antai-shell-weather-row">
            <div>
              <div class="antai-shell-weather-date" data-role="date-text"></div>
              <div class="antai-shell-weather-place">${escapeHtml(shellCfg.weather && shellCfg.weather.locationName ? shellCfg.weather.locationName : "目前位置")}</div>
            </div>
            <div class="antai-shell-weather-right">
              <div class="antai-shell-weather-icon" data-role="weather-icon">${getWeatherVisual("loading")}</div>
              <div class="antai-shell-weather-text" data-role="weather-text">讀取中</div>
              <div class="antai-shell-weather-temp">
                ${getThermometerSvg()}
                <span data-role="weather-temp">--°C</span>
              </div>
            </div>
          </div>
        </section>

        <div class="antai-shell-section-title">功能清單</div>
        <nav class="antai-shell-menu" data-role="menu"></nav>
      </div>
    `;

    root.appendChild(panel);
    (shellCfg.mountToBody === false && shellCfg.pageContainerSelector
      ? document.querySelector(shellCfg.pageContainerSelector)
      : document.body
    ).appendChild(root);

    const mobileToggle = document.createElement("button");
    mobileToggle.type = "button";
    mobileToggle.className = "antai-shell-mobile-toggle";
    mobileToggle.setAttribute("aria-label", "開啟系統側邊欄");
    mobileToggle.innerHTML = getIconSvg("menu");
    document.body.appendChild(mobileToggle);

    const backdrop = document.createElement("div");
    backdrop.className = "antai-shell-mobile-backdrop";
    document.body.appendChild(backdrop);

    shellState.rootEl = root;
    shellState.dateEl = root.querySelector('[data-role="date-text"]');
    shellState.weatherIconEl = root.querySelector('[data-role="weather-icon"]');
    shellState.weatherTextEl = root.querySelector('[data-role="weather-text"]');
    shellState.weatherTempEl = root.querySelector('[data-role="weather-temp"]');
    shellState.collapseBtn = root.querySelector('.antai-shell-collapse-btn');
    shellState.mobileToggleBtn = mobileToggle;
    shellState.drawerBackdropEl = backdrop;

    applyShellLayoutShift(shellCfg);
  }

  function bindShellEvents(shellCfg) {
    if (shellState.collapseBtn) {
      shellState.collapseBtn.addEventListener("click", () => {
        if (window.innerWidth <= shellCfg.mobileBreakpoint) {
          toggleMobileShell();
          return;
        }
        shellState.rootEl.classList.toggle("is-collapsed");
        document.body.classList.toggle("antai-shell-collapsed", shellState.rootEl.classList.contains("is-collapsed"));
        const iconName = shellState.rootEl.classList.contains("is-collapsed") ? "chevronRight" : "chevronLeft";
        shellState.collapseBtn.innerHTML = getIconSvg(iconName);
      });
    }

    if (shellState.mobileToggleBtn) {
      shellState.mobileToggleBtn.addEventListener("click", () => {
        toggleMobileShell();
      });
    }

    if (shellState.drawerBackdropEl) {
      shellState.drawerBackdropEl.addEventListener("click", () => {
        closeMobileShell();
      });
    }
  }

  function applyShellLayoutShift(shellCfg) {
    document.body.classList.add("antai-shell-has-sidebar");

    if (shellCfg.pageContainerSelector) {
      const target = document.querySelector(shellCfg.pageContainerSelector);
      if (target) target.classList.add("antai-shell-page-shift");
      return;
    }

    document.body.setAttribute("data-antai-shell-shift", "body");
  }

  function getSystemLabel(shellCfg) {
    const group = shellCfg.systems && shellCfg.systems[shellCfg.systemKey];
    return group && group.label ? group.label : shellCfg.title || "系統選單";
  }

  function renderShellDate(shellCfg) {
    if (!shellState.dateEl) return;
    const formatter = typeof shellCfg.dateFormatter === "function"
      ? shellCfg.dateFormatter
      : defaultDateFormatter;
    shellState.dateEl.textContent = formatter(new Date());
  }

  function defaultDateFormatter(date) {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
  }

  function renderShellMenu(shellCfg) {
    const menuEl = shellState.rootEl && shellState.rootEl.querySelector('[data-role="menu"]');
    if (!menuEl) return;

    const group = shellCfg.systems && shellCfg.systems[shellCfg.systemKey];
    const items = group && Array.isArray(group.items) ? group.items : [];

    menuEl.innerHTML = items.map((item) => {
      const isActive = shellCfg.activeKey && item.key === shellCfg.activeKey;
      const href = item.href || "javascript:void(0)";
      return `
        <a class="antai-shell-item${isActive ? " is-active" : ""}" href="${escapeHtml(href)}" data-key="${escapeHtml(item.key || "")}">
          <div class="antai-shell-item-icon">${getIconSvg(item.icon || "grid")}</div>
          <div class="antai-shell-item-content">
            <div class="antai-shell-item-label">${escapeHtml(item.label || "未命名系統")}</div>
            <div class="antai-shell-item-desc">${escapeHtml(item.description || item.desc || "")}</div>
          </div>
        </a>
      `;
    }).join("") || `
      <div class="antai-shell-item">
        <div class="antai-shell-item-icon">${getIconSvg("info")}</div>
        <div class="antai-shell-item-content">
          <div class="antai-shell-item-label">尚未設定系統清單</div>
          <div class="antai-shell-item-desc">請在 shell.systems.${escapeHtml(shellCfg.systemKey)}.items 設定要顯示的系統。</div>
        </div>
      </div>
    `;

    menuEl.querySelectorAll('a.antai-shell-item').forEach((anchor) => {
      anchor.addEventListener('click', () => {
        if (window.innerWidth <= shellCfg.mobileBreakpoint) closeMobileShell();
      });
    });
  }

  function renderShellWeather(shellCfg) {
    if (!shellCfg.weather || !shellCfg.weather.enabled) {
      if (shellState.weatherTextEl) shellState.weatherTextEl.textContent = "未啟用";
      if (shellState.weatherTempEl) shellState.weatherTempEl.textContent = "--°C";
      if (shellState.weatherIconEl) shellState.weatherIconEl.innerHTML = getWeatherVisual("disabled");
      return;
    }

    updateWeatherDisplay({ text: "讀取中", temp: null, visual: "loading" });
    fetchWeather(shellCfg.weather).catch((err) => {
      console.error('[AntaiShell] fetchWeather error:', err);
      updateWeatherDisplay({ text: "天氣讀取失敗", temp: null, visual: "cloud" });
    });

    clearInterval(shellState.refreshTimer);
    const refreshMs = Math.max(1, Number(shellCfg.weather.refreshMinutes) || 5) * 60 * 1000;
    shellState.refreshTimer = setInterval(() => {
      fetchWeather(shellCfg.weather).catch((err) => {
        console.error('[AntaiShell] fetchWeather refresh error:', err);
      });
    }, refreshMs);
  }

  async function fetchWeather(weatherCfg) {
    if (weatherCfg.provider !== "open-meteo") {
      throw new Error("目前僅支援 open-meteo provider");
    }

    let lat = weatherCfg.latitude;
    let lon = weatherCfg.longitude;

    if ((lat == null || lon == null) && navigator.geolocation) {
      const pos = await getCurrentPosition({ timeout: 4500, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    }

    if (lat == null || lon == null) {
      throw new Error("缺少 weather latitude / longitude");
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
    url.searchParams.set('timezone', 'Asia/Taipei');

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error(`天氣 API 失敗: ${res.status}`);
    const data = await res.json();
    const current = data && data.current ? data.current : null;
    if (!current) throw new Error('天氣資料格式錯誤');

    const mapped = mapWeatherCode(current.weather_code, current.is_day);
    updateWeatherDisplay({
      text: mapped.label,
      temp: typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
      visual: mapped.visual
    });
  }

  function getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options || {});
    });
  }

  function updateWeatherDisplay(payload) {
    if (shellState.weatherTextEl) shellState.weatherTextEl.textContent = payload.text || '--';
    if (shellState.weatherTempEl) {
      shellState.weatherTempEl.textContent = payload.temp == null ? '--°C' : `${Math.round(payload.temp)}°C`;
    }
    if (shellState.weatherIconEl) {
      shellState.weatherIconEl.innerHTML = getWeatherVisual(payload.visual || 'cloud');
    }
  }

  function mapWeatherCode(code, isDay) {
    const day = Number(isDay) !== 0;
    const rules = {
      0: { label: day ? '晴' : '晴朗', visual: day ? 'sunny' : 'moon' },
      1: { label: day ? '大致晴' : '少雲', visual: day ? 'partly' : 'moonCloud' },
      2: { label: '多雲時晴', visual: 'partly' },
      3: { label: '陰天', visual: 'cloud' },
      45: { label: '霧', visual: 'fog' },
      48: { label: '霧', visual: 'fog' },
      51: { label: '毛毛雨', visual: 'drizzle' },
      53: { label: '短暫毛雨', visual: 'drizzle' },
      55: { label: '細雨', visual: 'rain' },
      56: { label: '凍雨', visual: 'rain' },
      57: { label: '凍雨', visual: 'rain' },
      61: { label: '小雨', visual: 'rain' },
      63: { label: '雨', visual: 'rain' },
      65: { label: '大雨', visual: 'rain' },
      66: { label: '凍雨', visual: 'rain' },
      67: { label: '凍雨', visual: 'rain' },
      71: { label: '小雪', visual: 'snow' },
      73: { label: '下雪', visual: 'snow' },
      75: { label: '大雪', visual: 'snow' },
      77: { label: '雪粒', visual: 'snow' },
      80: { label: '陣雨', visual: 'rain' },
      81: { label: '陣雨', visual: 'rain' },
      82: { label: '強陣雨', visual: 'rain' },
      85: { label: '陣雪', visual: 'snow' },
      86: { label: '陣雪', visual: 'snow' },
      95: { label: '雷雨', visual: 'storm' },
      96: { label: '雷雨', visual: 'storm' },
      99: { label: '雷雨', visual: 'storm' }
    };
    return rules[Number(code)] || { label: '天氣', visual: 'cloud' };
  }

  function getWeatherVisual(type) {
    const visuals = {
      loading: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="10" stroke="rgba(255,255,255,.95)" stroke-width="5" stroke-linecap="round" stroke-dasharray="20 18">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </svg>`,
      sunny: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <g style="animation:antaiSunPulse 3s ease-in-out infinite; transform-origin:32px 32px;">
            <circle cx="32" cy="28" r="10" fill="rgba(255,214,102,.98)" />
            <g stroke="rgba(255,245,193,.95)" stroke-linecap="round" stroke-width="3">
              <path d="M32 8V14"/><path d="M32 42V48"/><path d="M12 28H18"/><path d="M46 28H52"/>
              <path d="M18.5 14.5L22.5 18.5"/><path d="M41.5 37.5L45.5 41.5"/>
              <path d="M18.5 41.5L22.5 37.5"/><path d="M41.5 18.5L45.5 14.5"/>
            </g>
          </g>
        </svg>`,
      moon: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M38 13c-8.8 2-15 9.9-15 19.1C23 42.6 31.4 51 41.8 51c3.8 0 7.3-1.1 10.2-3.1-2.1.5-4.2.8-6.5.8-13.1 0-23.7-10.6-23.7-23.7 0-4.3 1.1-8.3 3.2-11.8A19.1 19.1 0 0 1 38 13Z" fill="rgba(255,244,191,.95)"/>
        </svg>`,
      moonCloud: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M36 11c-7.6 1.8-13 8.6-13 16.6 0 9.2 7.5 16.7 16.7 16.7 2.4 0 4.8-.5 6.9-1.5A18.3 18.3 0 0 1 33 24.9c0-5 1.1-9.7 3-13.9Z" fill="rgba(255,244,191,.95)"/>
          <g style="animation:antaiCloudDrift 4s ease-in-out infinite; transform-origin:34px 40px;">
            <path d="M21 46c-4.4 0-8-3.2-8-7.2 0-3.4 2.7-6.3 6.3-7 1-5.3 5.6-9.3 11.1-9.3 5 0 9.3 3.2 10.8 7.7h.4c5.1 0 9.3 3.7 9.3 8.3 0 4.6-4.2 8.3-9.3 8.3H21Z" fill="rgba(255,255,255,.95)"/>
          </g>
        </svg>`,
      partly: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <g style="animation:antaiSunPulse 3.2s ease-in-out infinite; transform-origin:21px 20px;">
            <circle cx="21" cy="20" r="8" fill="rgba(255,214,102,.96)"/>
          </g>
          <g style="animation:antaiCloudDrift 4s ease-in-out infinite; transform-origin:36px 38px;">
            <path d="M21 47c-4.4 0-8-3.2-8-7.2 0-3.4 2.7-6.3 6.3-7 1-5.3 5.6-9.3 11.1-9.3 5 0 9.3 3.2 10.8 7.7h.4c5.1 0 9.3 3.7 9.3 8.3 0 4.6-4.2 8.3-9.3 8.3H21Z" fill="rgba(255,255,255,.95)"/>
          </g>
        </svg>`,
      cloud: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <g style="animation:antaiCloudDrift 4s ease-in-out infinite; transform-origin:34px 38px;">
            <path d="M18 47c-4.9 0-9-3.7-9-8.2 0-4 3.1-7.3 7.1-8.1 1.2-5.8 6.3-10.1 12.3-10.1 5.4 0 10.1 3.5 11.8 8.5h.5c5.6 0 10.2 4.1 10.2 9 0 4.9-4.6 8.9-10.2 8.9H18Z" fill="rgba(255,255,255,.96)"/>
          </g>
        </svg>`,
      fog: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M16 24h32" stroke="rgba(255,255,255,.95)" stroke-width="4" stroke-linecap="round"/>
          <path d="M10 33h44" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linecap="round">
            <animate attributeName="opacity" values=".45;.95;.45" dur="2.8s" repeatCount="indefinite" />
          </path>
          <path d="M16 42h32" stroke="rgba(255,255,255,.75)" stroke-width="4" stroke-linecap="round"/>
        </svg>`,
      drizzle: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M18 35c-4.9 0-9-3.7-9-8.2 0-4 3.1-7.3 7.1-8.1 1.2-5.8 6.3-10.1 12.3-10.1 5.4 0 10.1 3.5 11.8 8.5h.5c5.6 0 10.2 4.1 10.2 9 0 4.9-4.6 8.9-10.2 8.9H18Z" fill="rgba(255,255,255,.96)"/>
          <g fill="rgba(187,231,255,.95)">
            <circle cx="24" cy="46" r="2">
              <animateTransform attributeName="transform" type="translate" values="0 -2;0 5;0 -2" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="34" cy="48" r="2">
              <animateTransform attributeName="transform" type="translate" values="0 -1;0 6;0 -1" dur="1.1s" repeatCount="indefinite" />
            </circle>
            <circle cx="44" cy="46" r="2">
              <animateTransform attributeName="transform" type="translate" values="0 -2;0 5;0 -2" dur="1.25s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>`,
      rain: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M18 35c-4.9 0-9-3.7-9-8.2 0-4 3.1-7.3 7.1-8.1 1.2-5.8 6.3-10.1 12.3-10.1 5.4 0 10.1 3.5 11.8 8.5h.5c5.6 0 10.2 4.1 10.2 9 0 4.9-4.6 8.9-10.2 8.9H18Z" fill="rgba(255,255,255,.96)"/>
          <g stroke="rgba(171,230,255,.96)" stroke-linecap="round" stroke-width="3">
            <path d="M24 42l-2 8" style="animation:antaiRainDrop 1s linear infinite; transform-origin:24px 46px;"/>
            <path d="M34 43l-2 8" style="animation:antaiRainDrop 1.2s linear infinite; animation-delay:-.3s; transform-origin:34px 47px;"/>
            <path d="M44 42l-2 8" style="animation:antaiRainDrop 1.05s linear infinite; animation-delay:-.6s; transform-origin:44px 46px;"/>
          </g>
        </svg>`,
      snow: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M18 35c-4.9 0-9-3.7-9-8.2 0-4 3.1-7.3 7.1-8.1 1.2-5.8 6.3-10.1 12.3-10.1 5.4 0 10.1 3.5 11.8 8.5h.5c5.6 0 10.2 4.1 10.2 9 0 4.9-4.6 8.9-10.2 8.9H18Z" fill="rgba(255,255,255,.96)"/>
          <g stroke="rgba(224,245,255,.98)" stroke-width="2" stroke-linecap="round">
            <path d="M24 43v7" style="animation:antaiSnowDrop 1.5s ease-in-out infinite;"/>
            <path d="M20.5 46.5h7" style="animation:antaiSnowDrop 1.5s ease-in-out infinite;"/>
            <path d="M21.5 44l5 5" style="animation:antaiSnowDrop 1.5s ease-in-out infinite;"/>
            <path d="M26.5 44l-5 5" style="animation:antaiSnowDrop 1.5s ease-in-out infinite;"/>
            <path d="M38 45v7" style="animation:antaiSnowDrop 1.8s ease-in-out infinite; animation-delay:-.4s;"/>
            <path d="M34.5 48.5h7" style="animation:antaiSnowDrop 1.8s ease-in-out infinite; animation-delay:-.4s;"/>
            <path d="M35.5 46l5 5" style="animation:antaiSnowDrop 1.8s ease-in-out infinite; animation-delay:-.4s;"/>
            <path d="M40.5 46l-5 5" style="animation:antaiSnowDrop 1.8s ease-in-out infinite; animation-delay:-.4s;"/>
          </g>
        </svg>`,
      storm: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M18 35c-4.9 0-9-3.7-9-8.2 0-4 3.1-7.3 7.1-8.1 1.2-5.8 6.3-10.1 12.3-10.1 5.4 0 10.1 3.5 11.8 8.5h.5c5.6 0 10.2 4.1 10.2 9 0 4.9-4.6 8.9-10.2 8.9H18Z" fill="rgba(255,255,255,.96)"/>
          <path d="M32 40l-6 10h5l-3 10 12-14h-6l4-6Z" fill="rgba(255,224,110,.98)">
            <animate attributeName="opacity" values="1;.7;1" dur=".9s" repeatCount="indefinite" />
          </path>
        </svg>`,
      disabled: `
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="16" stroke="rgba(255,255,255,.85)" stroke-width="4"/>
          <path d="M24 32h16" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linecap="round"/>
        </svg>`
    };
    return visuals[type] || visuals.cloud;
  }

  function getThermometerSvg() {
    return `
      <svg class="antai-shell-thermo" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
        <path d="M12 11v6" stroke="rgba(255,255,255,.95)" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }

  function getIconSvg(name) {
    const icons = {
      sparkles: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Zm6 10l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13ZM6 14l1.1 2.4L9.5 17 7.1 18.1 6 20.5l-1.1-2.4L2.5 17l2.4-.6L6 14Z" fill="currentColor"/></svg>`,
      menu: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      chevronLeft: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      chevronRight: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      grid: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 7v-7h7v7h-7Z" fill="currentColor"/></svg>`,
      users: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2c-2.7 0-8 1.35-8 4v2h16v-2c0-2.65-5.3-4-8-4ZM8 15c-.35 0-.73.02-1.12.05C4.4 15.28 0 16.52 0 19v2h6v-2c0-1.48.8-2.82 2.13-3.9A8.7 8.7 0 0 0 8 15Z" fill="currentColor"/></svg>`,
      bandage: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.3 3.7a4.95 4.95 0 0 0-7 0L3.7 13.3a4.95 4.95 0 0 0 0 7 4.95 4.95 0 0 0 7 0l9.6-9.6a4.95 4.95 0 0 0 0-7ZM7.5 20.5l-4-4m12.99-12.99 4 4M8 8l8 8M9 11h.01M12 14h.01M13 10h.01M16 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      droplet: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z" fill="currentColor"/></svg>`,
      heart: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.65-9.5 9-9.5 9Z" fill="currentColor"/></svg>`,
      shield: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 6v6c0 5 3.4 8.6 7 10 3.6-1.4 7-5 7-10V6l-7-3Z" fill="currentColor"/></svg>`,
      settings: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8 3.5-.94-.32a7.83 7.83 0 0 0-.5-1.2l.45-.9a1 1 0 0 0-.18-1.15l-1.58-1.58a1 1 0 0 0-1.15-.18l-.9.45c-.38-.2-.78-.37-1.2-.5L14 4a1 1 0 0 0-.97-1h-2.06A1 1 0 0 0 10 4l-.32.94c-.42.13-.82.3-1.2.5l-.9-.45a1 1 0 0 0-1.15.18L4.85 6.75a1 1 0 0 0-.18 1.15l.45.9c-.2.38-.37.78-.5 1.2L4 10a1 1 0 0 0-1 1v2.06a1 1 0 0 0 1 .97l.94.32c.13.42.3.82.5 1.2l-.45.9a1 1 0 0 0 .18 1.15l1.58 1.58a1 1 0 0 0 1.15.18l.9-.45c.38.2.78.37 1.2.5L10 20a1 1 0 0 0 .97 1h2.06A1 1 0 0 0 14 20l.32-.94c.42-.13.82-.3 1.2-.5l.9.45a1 1 0 0 0 1.15-.18l1.58-1.58a1 1 0 0 0 .18-1.15l-.45-.9c.2-.38.37-.78.5-1.2L20 14a1 1 0 0 0 1-.97V11a1 1 0 0 0-1-1Z" fill="currentColor"/></svg>`,
      info: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 5.5a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 7.5ZM13.5 17h-3v-1.5H12v-4h-1.5V10H13.5v5.5H15V17Z" fill="currentColor"/></svg>`
    };
    return icons[name] || icons.grid;
  }

  function onShellResize() {
    applyShellResponsiveState();
  }

  function applyShellResponsiveState() {
    const shellCfg = shellState.cfg;
    if (!shellCfg || !shellState.rootEl) return;
    const isMobile = window.innerWidth <= shellCfg.mobileBreakpoint;
    if (!isMobile) {
      shellState.rootEl.classList.remove('is-mobile-open');
      if (shellState.drawerBackdropEl) shellState.drawerBackdropEl.style.display = 'none';
      if (shellState.mobileToggleBtn) shellState.mobileToggleBtn.style.display = '';
    }
  }

  function toggleMobileShell() {
    const shellCfg = shellState.cfg;
    if (!shellCfg || !shellState.rootEl) return;
    const isOpen = shellState.rootEl.classList.toggle('is-mobile-open');
    if (shellState.drawerBackdropEl) shellState.drawerBackdropEl.style.display = isOpen ? 'block' : 'none';
  }

  function closeMobileShell() {
    if (!shellState.rootEl) return;
    shellState.rootEl.classList.remove('is-mobile-open');
    if (shellState.drawerBackdropEl) shellState.drawerBackdropEl.style.display = 'none';
  }

  function destroyShell() {
    clearInterval(shellState.refreshTimer);
    shellState.refreshTimer = null;

    if (shellState.rootEl && shellState.rootEl.parentNode) shellState.rootEl.parentNode.removeChild(shellState.rootEl);
    if (shellState.mobileToggleBtn && shellState.mobileToggleBtn.parentNode) shellState.mobileToggleBtn.parentNode.removeChild(shellState.mobileToggleBtn);
    if (shellState.drawerBackdropEl && shellState.drawerBackdropEl.parentNode) shellState.drawerBackdropEl.parentNode.removeChild(shellState.drawerBackdropEl);
    if (shellState.styleEl && shellState.styleEl.parentNode) shellState.styleEl.parentNode.removeChild(shellState.styleEl);

    document.body.classList.remove('antai-shell-has-sidebar', 'antai-shell-collapsed');
    document.body.removeAttribute('data-antai-shell-shift');

    shellState = {
      cfg: null,
      rootEl: null,
      styleEl: null,
      contentWrapper: null,
      weatherTempEl: null,
      weatherTextEl: null,
      weatherIconEl: null,
      dateEl: null,
      collapseBtn: null,
      mobileToggleBtn: null,
      drawerBackdropEl: null,
      refreshTimer: null,
      isMounted: false
    };
  }

  function start(options) {
    cfg = deepMerge(DEFAULTS, options || {});

    if (typeof cfg.isLoggedInFn !== "function") cfg.isLoggedInFn = defaultIsLoggedIn;

    lastActivityAt = now();
    addListeners();
    resetIdleCheck();
    mountShell(cfg);
  }

  function stop() {
    hideWarning();
    clearInterval(idleTimer);
    idleTimer = null;
    cfg = null;
    removeListeners();
    destroyShell();
  }

  global.IdleTimeoutSecure = {
    start,
    stop,
    forceLogout,
    mountShell,
    destroyShell,
    refreshShellWeather: () => shellState.cfg && renderShellWeather(shellState.cfg),
  };

  function autoBoot() {
    if (global.__IDLE_TIMEOUT_SECURE_STARTED__) return;
    global.__IDLE_TIMEOUT_SECURE_STARTED__ = true;

    const userCfg = global.IDLE_TIMEOUT_CONFIG && typeof global.IDLE_TIMEOUT_CONFIG === "object"
      ? global.IDLE_TIMEOUT_CONFIG
      : {};

    const inferredShell = inferShellFromLocation();
    const merged = deepMerge(DEFAULTS, userCfg);
    if (!userCfg.shell && !global.ANTAI_SHELL_CONFIG) {
      merged.shell = deepMerge(merged.shell || {}, inferredShell);
    }

    if (!merged.autoStart) return;
    start(merged);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBoot);
  } else {
    autoBoot();
  }
})(window);
