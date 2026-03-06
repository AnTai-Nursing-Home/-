/* idle-timeout.secure.js
 * 安泰護家系統通用插件版（自動啟動）
 * - 閒置 3 分鐘跳提示，倒數 120 秒仍無動作則強制登出
 * - 預設使用 sessionStorage key: "antai_session_user"
 * - 預設登出：移除 session 並重新載入目前頁面
 *
 * ✅ 用法（最簡）
 *   <script src="idle-timeout.js"></script>
 */

(function (global) {
  const DEFAULTS = {
    idleSeconds: 180,
    countdownSeconds: 120,
    checkIntervalMs: 1000,
    sessionKey: "antai_session_user",
    redirectUrl: null,
    autoStart: true,
    storageKeysToClear: [],
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

  const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
  const now = () => Date.now();
  const safeParseJSON = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };

  function defaultIsLoggedIn() {
    if (!cfg) return false;
    const raw = sessionStorage.getItem(cfg.sessionKey);
    if (!raw) return false;
    return !!safeParseJSON(raw);
  }

  async function defaultSignOut(reason) {
    try { sessionStorage.removeItem(cfg.sessionKey); } catch (_) {}
    if (cfg.storageKeysToClear && cfg.storageKeysToClear.length) {
      cfg.storageKeysToClear.forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
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
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  function removeListeners() {
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  function onVisibilityChange() { if (!document.hidden) onActivity(); }
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
    if (!isWarningShown && idleMs >= cfg.idleSeconds * 1000) showWarning();
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
      if (warnRemaining <= 0) forceLogout("idle_timeout");
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
    const mm = String(Math.floor(warnRemaining / 60)).padStart(2, "0");
    const ss = String(warnRemaining % 60).padStart(2, "0");
    countdownEl.textContent = `${mm}:${ss}`;
  }
  async function forceLogout(reason) {
    hideWarning();
    clearInterval(idleTimer);
    try { await cfg.signOutFn(reason); } catch (err) {
      console.error("[idle-timeout] signOutFn failed:", err);
      window.location.reload();
    }
  }
  function ensureOverlay() {
    if (overlayEl) return;
    const style = document.createElement("style");
    style.textContent = `
      .it-overlay{position:fixed;inset:0;background:rgba(10,18,35,.52);z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px}
      .it-card{width:min(92vw,420px);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.22);padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",Arial,sans-serif}
      .it-title{font-size:22px;font-weight:800;color:#14243b;margin-bottom:10px}
      .it-msg{font-size:15px;line-height:1.75;color:#4c5b70}
      .it-timer{margin-top:16px;font-size:15px;color:#2f425a}
      .it-timer span{font-size:28px;font-weight:900;color:#1859d1;letter-spacing:1px}
      .it-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}
      .it-btn{border:none;border-radius:12px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer}
      .it-btn-primary{background:#1d63e9;color:#fff}
      .it-btn-ghost{background:#eef3fb;color:#1f3654}
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
      </div>`;
    document.body.appendChild(overlayEl);
    countdownEl = overlayEl.querySelector("#it-countdown");
    overlayEl.querySelector("#it-continue").addEventListener("click", onActivity);
    overlayEl.querySelector("#it-logout").addEventListener("click", () => forceLogout("manual_logout"));
  }
  function init(userOptions = {}) {
    cfg = Object.assign({}, DEFAULTS, userOptions || {});
    cfg.isLoggedInFn = typeof cfg.isLoggedInFn === "function" ? cfg.isLoggedInFn : defaultIsLoggedIn;
    cfg.signOutFn = typeof cfg.signOutFn === "function" ? cfg.signOutFn : defaultSignOut;
    lastActivityAt = now();
    addListeners();
    resetIdleCheck();
  }
  function destroy() {
    clearInterval(idleTimer);
    clearInterval(warnCountdownTimer);
    removeListeners();
    hideWarning();
    cfg = null;
  }
  global.IdleTimeout = { init, destroy, forceLogout, touch: onActivity };
  const options = global.IDLE_TIMEOUT_CONFIG || {};
  if (options.autoStart !== false) init(options);
})(window);

/* ---------- Antai Sidebar Shell (auto) ---------- */
(function () {
  const page = ((location.pathname || '').split('/').pop() || '').toLowerCase();
  if (!page) return;
  if (document.getElementById('antai-sidebar-root')) return;

  const SYSTEMS = {
    nurse: {
      label: '護理師系統',
      items: [
        ['admin.html', '護理師首頁'],
        ['admin-visit.html', '探視系統'],
        ['admin-duty.html', '班務系統'],
        ['admin-supplies-system.html', '器材／衛材系統'],
        ['admin-resident-system.html', '住民系統'],
        ['wound-care.html', '傷口照護'],
        ['doctor-rounds.html', '醫師巡診系統'],
        ['nurse-primary-cases.html', '主責個案分配'],
        ['nurse-whiteboard.html', '電子白板'],
        ['temperature-nurse.html', '體溫系統']
      ]
    },
    caregiver: {
      label: '照服員系統',
      items: [
        ['caregiver.html', '照服員首頁'],
        ['leave-caregiver.html', '請假系統'],
        ['stay-caregiver.html', '外宿系統'],
        ['foley-care.html', '導尿管系統'],
        ['meal-caregiver.html', '餐食系統'],
        ['temperature-caregiver.html', '體溫系統']
      ]
    },
    office: {
      label: '辦公室系統',
      items: [
        ['office.html', '辦公室首頁'],
        ['office-evaluation.html', '評鑑系統'],
        ['office-duty.html', '班務系統'],
        ['employees-admin.html', '員工資料'],
        ['office-maintenance.html', '維修系統'],
        ['office-stay.html', '外宿系統'],
        ['announcements-admin.html', '公告管理'],
        ['meal-fee-admin.html', '餐費管理'],
        ['account-admin.html', '帳號管理']
      ]
    }
  };

  function detectSystem() {
    for (const [key, sys] of Object.entries(SYSTEMS)) {
      if (sys.items.some(([href]) => href.toLowerCase() === page)) return key;
    }
    return null;
  }

  const systemKey = detectSystem();
  if (!systemKey) return;
  const system = SYSTEMS[systemKey];

  const style = document.createElement('style');
  style.id = 'antai-sidebar-style';
  style.textContent = `
    body.antai-sidebar-ready{padding-left:340px;transition:padding-left .25s ease}
    #antai-sidebar-root{position:fixed;left:16px;top:16px;bottom:16px;width:300px;z-index:2147483000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",Arial,sans-serif}
    .antai-sidebar-panel{height:100%;display:flex;flex-direction:column;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(246,249,255,.88));backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.65);box-shadow:0 16px 44px rgba(23,38,71,.16)}
    .antai-sidebar-scroll{padding:14px;overflow:auto;min-height:0;display:flex;flex-direction:column;gap:12px}
    .antai-weather-card{position:relative;border-radius:22px;padding:16px 16px 14px;background:linear-gradient(135deg,#1c2431,#46576e);color:#fff;overflow:hidden;box-shadow:0 10px 24px rgba(28,36,49,.22)}
    .antai-weather-card:before,.antai-weather-card:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.08);animation:antaiFloat 8s ease-in-out infinite}
    .antai-weather-card:before{width:140px;height:140px;right:-34px;top:-46px}
    .antai-weather-card:after{width:100px;height:100px;left:-24px;bottom:-34px;animation-delay:-3s}
    @keyframes antaiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
    .antai-date{position:relative;z-index:1;font-size:20px;font-weight:900;letter-spacing:.5px}
    .antai-weather-line,.antai-temp-line{position:relative;z-index:1;display:flex;align-items:center;gap:8px;margin-top:10px;font-size:15px;font-weight:700}
    .antai-weather-line small,.antai-temp-line small{opacity:.75;font-size:12px;font-weight:600;margin-left:auto}
    .antai-menu-card{background:#fff;border:1px solid rgba(233,238,247,.95);border-radius:22px;box-shadow:0 8px 22px rgba(30,50,90,.08);padding:10px}
    .antai-menu-head{font-size:14px;font-weight:900;color:#24364d;padding:8px 10px 10px}
    .antai-menu-list{display:flex;flex-direction:column;gap:6px}
    .antai-menu-item{display:flex;align-items:center;gap:10px;text-decoration:none;color:#2a3d57;padding:11px 12px;border-radius:14px;transition:.2s ease;background:transparent}
    .antai-menu-item:hover{background:#f4f7fd;transform:translateX(2px)}
    .antai-menu-item.is-active{background:linear-gradient(135deg,rgba(56,114,255,.13),rgba(102,183,255,.18));color:#1546a0;font-weight:800}
    .antai-dot{width:9px;height:9px;border-radius:50%;background:#9eb3cc;flex:0 0 auto}.antai-menu-item.is-active .antai-dot{background:#2d72ff}
    .antai-menu-text{min-width:0}.antai-menu-title{font-size:14px;font-weight:800;line-height:1.2}.antai-menu-sub{font-size:12px;color:#6c7d95;margin-top:2px}
    .antai-sidebar-toggle{display:none}
    @media (max-width: 1100px){
      body.antai-sidebar-ready{padding-left:0}
      #antai-sidebar-root{transform:translateX(-112%);transition:transform .25s ease}
      #antai-sidebar-root.is-open{transform:translateX(0)}
      .antai-sidebar-toggle{position:fixed;left:14px;top:14px;z-index:2147483001;display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border:none;border-radius:14px;background:#fff;box-shadow:0 10px 22px rgba(22,40,78,.16);font-size:20px}
    }
  `;
  document.head.appendChild(style);

  const dayMap = ['日', '一', '二', '三', '四', '五', '六'];
  const now = new Date();
  const dateText = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}(${dayMap[now.getDay()]})`;

  const root = document.createElement('aside');
  root.id = 'antai-sidebar-root';
  root.innerHTML = `
    <div class="antai-sidebar-panel">
      <div class="antai-sidebar-scroll">
        <section class="antai-weather-card">
          <div class="antai-date" id="antai-date">${dateText}</div>
          <div class="antai-weather-line"><span id="antai-weather-icon">☀️</span><span id="antai-weather-text">天氣載入中…</span><small>東港</small></div>
          <div class="antai-temp-line"><span>🌡️</span><span id="antai-temp-text">--°C</span><small>每 5 分更新</small></div>
        </section>
        <section class="antai-menu-card">
          <div class="antai-menu-head">${system.label}</div>
          <nav class="antai-menu-list">
            ${system.items.map(([href, label]) => `
              <a class="antai-menu-item ${href.toLowerCase() === page ? 'is-active' : ''}" href="${href}">
                <span class="antai-dot"></span>
                <span class="antai-menu-text">
                  <span class="antai-menu-title">${label}</span>
                  <span class="antai-menu-sub">${href}</span>
                </span>
              </a>
            `).join('')}
          </nav>
        </section>
      </div>
    </div>`;

  const toggle = document.createElement('button');
  toggle.className = 'antai-sidebar-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '開啟系統選單');
  toggle.textContent = '☰';
  toggle.addEventListener('click', () => root.classList.toggle('is-open'));

  function mount() {
    if (!document.body) return;
    document.body.classList.add('antai-sidebar-ready');
    document.body.appendChild(root);
    document.body.appendChild(toggle);
  }

  function updateWeather() {
    const iconEl = document.getElementById('antai-weather-icon');
    const textEl = document.getElementById('antai-weather-text');
    const tempEl = document.getElementById('antai-temp-text');
    if (!iconEl || !textEl || !tempEl) return;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=22.465&longitude=120.449&current=temperature_2m,weather_code&timezone=Asia%2FTaipei';
    fetch(url).then(r => r.json()).then(data => {
      const current = data && data.current ? data.current : {};
      const code = Number(current.weather_code);
      const temp = current.temperature_2m;
      const map = {
        0:['☀️','晴'],1:['🌤️','大致晴朗'],2:['⛅','局部多雲'],3:['☁️','陰'],45:['🌫️','霧'],48:['🌫️','霧'],51:['🌦️','毛毛雨'],53:['🌦️','細雨'],55:['🌧️','小雨'],61:['🌧️','陣雨'],63:['🌧️','雨'],65:['🌧️','大雨'],71:['🌨️','小雪'],80:['🌦️','短暫陣雨'],95:['⛈️','雷雨']
      };
      const pair = map[code] || ['🌤️', '天氣'];
      iconEl.textContent = pair[0];
      textEl.textContent = pair[1];
      tempEl.textContent = typeof temp === 'number' ? `${Math.round(temp)}°C` : '--°C';
    }).catch(() => {
      textEl.textContent = '天氣暫時無法取得';
      tempEl.textContent = '--°C';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { mount(); updateWeather(); });
  } else {
    mount(); updateWeather();
  }
  setInterval(updateWeather, 5 * 60 * 1000);
})();
