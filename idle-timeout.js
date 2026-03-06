/* idle-timeout.js
 * 安泰系統通用插件
 * - 閒置過久自動登出
 * - 已登入後才顯示側邊欄 / 天氣卡
 * - 未登入頁面完全不顯示側邊欄，避免直接跳進其他系統
 */
(function (global) {
  const DEFAULTS = {
    idleSeconds: 180,
    countdownSeconds: 120,
    checkIntervalMs: 1000,
    sessionKey: 'antai_session_user',
    redirectUrl: null,
    autoStart: true,
    storageKeysToClear: [],
    titleText: '閒置提醒',
    messageText: '你已閒置一段時間。若未繼續操作，系統將自動登出以保護資料安全。',
    continueBtnText: '我還在使用',
    logoutBtnText: '立即登出',
    weather: {
      latitude: null,
      longitude: null,
      locationLabel: '定位中',
      refreshMinutes: 5,
    }
  };

  const PAGE_GROUPS = {
    nurse: {
      label: '護理師系統',
      items: [
        ['admin.html', '護理師首頁'],
        ['admin-visit.html', '探視系統'],
        ['admin-duty.html', '班務系統'],
        ['nurse-request.html', '請假/調班系統'],
        ['admin-supplies-system.html', '器材／衛材系統'],
        ['supplies.html', '衛材盤點'],
        ['nurse-maintenance.html', '器材報修'],
        ['admin-resident-system.html', '住民系統'],
        ['residents-admin.html', '住民資料管理'],
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

  let cfg = null;
  let lastActivityAt = 0;
  let idleTimer = null;
  let warnCountdownTimer = null;
  let warnRemaining = 0;
  let isWarningShown = false;
  let overlayEl = null;
  let countdownEl = null;
  let shellRefreshTimer = null;

  const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  const now = () => Date.now();
  const safeParseJSON = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  const pageName = () => ((location.pathname || '').split('/').pop() || '').toLowerCase();

  function defaultIsLoggedIn() {
    if (!cfg) return false;
    const raw = sessionStorage.getItem(cfg.sessionKey);
    if (!raw) return false;
    return !!safeParseJSON(raw);
  }

  async function defaultSignOut(reason) {
    try { sessionStorage.removeItem(cfg.sessionKey); } catch (_) {}
    (cfg.storageKeysToClear || []).forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
    if (cfg.redirectUrl) {
      const joiner = cfg.redirectUrl.includes('?') ? '&' : '?';
      location.href = `${cfg.redirectUrl}${joiner}reason=${encodeURIComponent(reason)}`;
    } else {
      location.reload();
    }
  }

  function addListeners() {
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  function removeListeners() {
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    document.removeEventListener('visibilitychange', onVisibilityChange);
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
      removeShell();
      return;
    }
    if (!document.getElementById('antai-shell-root')) mountShell();
    const idleMs = now() - lastActivityAt;
    if (!isWarningShown && idleMs >= cfg.idleSeconds * 1000) showWarning();
  }
  function showWarning() {
    isWarningShown = true;
    warnRemaining = cfg.countdownSeconds;
    ensureOverlay();
    overlayEl.style.display = 'flex';
    updateCountdownText();
    clearInterval(warnCountdownTimer);
    warnCountdownTimer = setInterval(() => {
      warnRemaining -= 1;
      updateCountdownText();
      if (warnRemaining <= 0) forceLogout('idle_timeout');
    }, 1000);
  }
  function hideWarning() {
    isWarningShown = false;
    clearInterval(warnCountdownTimer);
    warnCountdownTimer = null;
    if (overlayEl) overlayEl.style.display = 'none';
  }
  function updateCountdownText() {
    if (!countdownEl) return;
    countdownEl.textContent = `${String(Math.floor(warnRemaining / 60)).padStart(2, '0')}:${String(warnRemaining % 60).padStart(2, '0')}`;
  }
  async function forceLogout(reason) {
    hideWarning();
    clearInterval(idleTimer);
    removeShell();
    try { await cfg.signOutFn(reason); } catch (err) {
      console.error('[idle-timeout] signOutFn failed:', err);
      location.reload();
    }
  }

  function ensureOverlay() {
    if (overlayEl) return;
    const style = document.createElement('style');
    style.textContent = `
      .it-overlay{position:fixed;inset:0;background:rgba(10,18,35,.52);z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px}
      .it-card{width:min(92vw,420px);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.22);padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",Arial,sans-serif}
      .it-title{font-size:22px;font-weight:800;color:#14243b;margin-bottom:10px}
      .it-msg{font-size:15px;line-height:1.75;color:#4c5b70}
      .it-timer{margin-top:16px;font-size:15px;color:#2f425a}.it-timer span{font-size:28px;font-weight:900;color:#1859d1;letter-spacing:1px}
      .it-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}.it-btn{border:none;border-radius:12px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer}
      .it-btn-primary{background:#1d63e9;color:#fff}.it-btn-ghost{background:#eef3fb;color:#1f3654}
    `;
    document.head.appendChild(style);
    overlayEl = document.createElement('div');
    overlayEl.className = 'it-overlay';
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
    countdownEl = overlayEl.querySelector('#it-countdown');
    overlayEl.querySelector('#it-continue').addEventListener('click', onActivity);
    overlayEl.querySelector('#it-logout').addEventListener('click', () => forceLogout('manual_logout'));
  }

  function detectSystem() {
    const page = pageName();
    for (const [key, group] of Object.entries(PAGE_GROUPS)) {
      if (group.items.some(([href]) => href.toLowerCase() === page)) return { key, group };
    }
    return null;
  }

  function removeShell() {
    clearInterval(shellRefreshTimer);
    shellRefreshTimer = null;
    document.body.classList.remove('antai-shell-body');
    const root = document.getElementById('antai-shell-root');
    if (root) root.remove();
    const style = document.getElementById('antai-shell-style');
    if (style) style.remove();
  }

  function ensureShellStyle() {
    if (document.getElementById('antai-shell-style')) return;
    const style = document.createElement('style');
    style.id = 'antai-shell-style';
    style.textContent = `
      body.antai-shell-body{padding-left:284px;box-sizing:border-box}
      #antai-shell-root{position:fixed;left:16px;top:18px;bottom:18px;width:252px;z-index:2147482000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",Arial,sans-serif}
      .antai-shell-wrap{height:100%;display:flex;flex-direction:column;gap:12px}
      .antai-weather-card{position:relative;padding:16px;border-radius:22px;color:#fff;background:linear-gradient(135deg,#2a3444,#4e5f78);box-shadow:0 16px 34px rgba(36,48,72,.22);overflow:hidden}
      .antai-weather-card:before,.antai-weather-card:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.07);animation:antai-float 7s ease-in-out infinite}.antai-weather-card:before{width:120px;height:120px;right:-18px;top:-28px}.antai-weather-card:after{width:90px;height:90px;left:-24px;bottom:-26px;animation-delay:-2s}
      @keyframes antai-float{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
      .antai-w-date{position:relative;z-index:1;font-size:16px;font-weight:900;margin-bottom:10px}
      .antai-w-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:700;margin-top:8px}
      .antai-w-left{display:flex;align-items:center;gap:8px;min-width:0}.antai-w-left svg{width:18px;height:18px;display:block;flex:0 0 auto}.antai-w-left span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .antai-menu{background:rgba(255,255,255,.92);border:1px solid rgba(227,234,244,.92);border-radius:22px;box-shadow:0 10px 30px rgba(34,48,76,.08);padding:10px;min-height:0;flex:1;overflow:auto}
      .antai-menu-head{font-size:15px;font-weight:900;color:#22354b;padding:8px 10px 10px}.antai-menu-list{display:flex;flex-direction:column;gap:6px}
      .antai-menu-item{display:flex;align-items:center;gap:10px;text-decoration:none;color:#2b3d55;padding:12px 12px;border-radius:14px;transition:.18s ease}.antai-menu-item:hover{background:#f3f7fd;transform:translateX(2px)}
      .antai-menu-item.active{background:linear-gradient(135deg,rgba(71,123,255,.14),rgba(126,180,255,.18));color:#1d4ea6;font-weight:800}
      .antai-dot{width:9px;height:9px;border-radius:50%;background:#9db0c9;flex:0 0 auto}.antai-menu-item.active .antai-dot{background:#2f74ff}
      .antai-text{min-width:0}.antai-title{font-size:14px;font-weight:800;line-height:1.25}
      @media (max-width: 1200px){body.antai-shell-body{padding-left:0}#antai-shell-root{display:none}}
    `;
    document.head.appendChild(style);
  }

  function weatherIcon(text) {
    const t = String(text || '').toLowerCase();
    if (t.includes('雨') || t.includes('rain')) return '<svg viewBox="0 0 24 24" fill="none"><path d="M7 15a4 4 0 1 1 .6-8A5 5 0 0 1 17 9h1a3 3 0 0 1 0 6H7Z" fill="rgba(255,255,255,.96)"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="rgba(180,231,255,.98)" stroke-width="2" stroke-linecap="round"/></svg>';
    if (t.includes('晴') || t.includes('clear')) return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="rgba(255,214,102,.98)"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="rgba(255,233,170,.98)" stroke-width="1.7" stroke-linecap="round"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M7 15a4 4 0 1 1 .6-8A5 5 0 0 1 17 9h1a3 3 0 0 1 0 6H7Z" fill="rgba(255,255,255,.96)"/></svg>';
  }
  function thermometerIcon() {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" stroke="rgba(255,255,255,.96)" stroke-width="2"/><path d="M12 11v6" stroke="rgba(255,255,255,.96)" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function formatDate() {
    const d = new Date();
    const week = '日一二三四五六'[d.getDay()];
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}(${week})`;
  }

  function getCurrentPositionAsync() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation_not_supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 5 * 60 * 1000
        }
      );
    });
  }

  async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=zh-TW`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    const addr = data?.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.county ||
      addr.state ||
      data?.name ||
      '目前位置'
    );
  }

  async function resolveWeatherPosition() {
    const w = cfg.weather || {};
    if (typeof w.latitude === 'number' && typeof w.longitude === 'number') {
      return {
        lat: w.latitude,
        lon: w.longitude,
        label: w.locationLabel || '目前位置'
      };
    }

    const pos = await getCurrentPositionAsync();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    let label = '目前位置';
    try {
      label = await reverseGeocode(lat, lon);
    } catch (_) {}

    return { lat, lon, label };
  }

  async function fetchWeather() {
    const pos = await resolveWeatherPosition();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(pos.lat)}&longitude=${encodeURIComponent(pos.lon)}&current=temperature_2m,weather_code&timezone=Asia%2FTaipei`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    const text = weatherCodeText(code);
    return { temp, text, label: pos.label };
  }
  function weatherCodeText(code) {
    if (code === 0) return '晴';
    if ([1,2].includes(code)) return '局部多雲';
    if (code === 3) return '陰';
    if ([45,48].includes(code)) return '霧';
    if ([51,53,55,56,57].includes(code)) return '毛毛雨';
    if ([61,63,65,66,67,80,81,82].includes(code)) return '下雨';
    if ([71,73,75,77,85,86].includes(code)) return '下雪';
    if ([95,96,99].includes(code)) return '雷雨';
    return '多雲';
  }

  async function renderWeather(root) {
    const dateEl = root.querySelector('[data-role="date"]');
    const weatherEl = root.querySelector('[data-role="weather"]');
    const tempEl = root.querySelector('[data-role="temp"]');
    const placeEl = root.querySelector('[data-role="place"]');
    dateEl.textContent = formatDate();
    placeEl.textContent = '定位中';
    try {
      const info = await fetchWeather();
      weatherEl.innerHTML = `${weatherIcon(info.text)}<span>${info.text}</span>`;
      tempEl.innerHTML = `${thermometerIcon()}<span>${Math.round(info.temp)}°C</span>`;
      placeEl.textContent = info.label || '目前位置';
    } catch (err) {
      weatherEl.innerHTML = `${weatherIcon('多雲')}<span>天氣讀取中</span>`;
      tempEl.innerHTML = `${thermometerIcon()}<span>--°C</span>`;
      placeEl.textContent = '無法定位';
    }
  }

  function mountShell() {
    if (!cfg || !cfg.isLoggedInFn || !cfg.isLoggedInFn()) return;
    if (document.getElementById('antai-shell-root')) return;
    const found = detectSystem();
    if (!found) return;
    ensureShellStyle();
    const root = document.createElement('aside');
    root.id = 'antai-shell-root';
    const current = pageName();
    const links = found.group.items.map(([href, label]) => `
      <a class="antai-menu-item${href.toLowerCase() === current ? ' active' : ''}" href="${href}">
        <span class="antai-dot"></span>
        <span class="antai-text">
          <span class="antai-title">${label}</span>
        </span>
      </a>
    `).join('');
    root.innerHTML = `
      <div class="antai-shell-wrap">
        <section class="antai-weather-card">
          <div class="antai-w-date" data-role="date"></div>
          <div class="antai-w-row"><div class="antai-w-left" data-role="weather"></div><small data-role="place"></small></div>
          <div class="antai-w-row"><div class="antai-w-left" data-role="temp"></div><small>每 ${((cfg.weather && cfg.weather.refreshMinutes) || 5)} 分更新</small></div>
        </section>
        <section class="antai-menu">
          <div class="antai-menu-head">${found.group.label}</div>
          <div class="antai-menu-list">${links}</div>
        </section>
      </div>
    `;
    document.body.appendChild(root);
    document.body.classList.add('antai-shell-body');
    renderWeather(root);
    clearInterval(shellRefreshTimer);
    shellRefreshTimer = setInterval(() => {
      const r = document.getElementById('antai-shell-root');
      if (r) renderWeather(r);
    }, (((cfg.weather && cfg.weather.refreshMinutes) || 5) * 60 * 1000));
  }

  function init(userOptions = {}) {
    cfg = Object.assign({}, DEFAULTS, userOptions || {});
    cfg.weather = Object.assign({}, DEFAULTS.weather, (userOptions && userOptions.weather) || {});
    cfg.isLoggedInFn = typeof cfg.isLoggedInFn === 'function' ? cfg.isLoggedInFn : defaultIsLoggedIn;
    cfg.signOutFn = typeof cfg.signOutFn === 'function' ? cfg.signOutFn : defaultSignOut;
    lastActivityAt = now();
    addListeners();
    resetIdleCheck();
    if (cfg.isLoggedInFn()) mountShell();
    else removeShell();
  }

  function destroy() {
    clearInterval(idleTimer);
    clearInterval(warnCountdownTimer);
    removeListeners();
    hideWarning();
    removeShell();
    cfg = null;
  }

  global.IdleTimeout = { init, destroy, forceLogout, touch: onActivity, mountShell, removeShell };
  const options = global.IDLE_TIMEOUT_CONFIG || {};
  if (options.autoStart !== false) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(options), { once: true });
    else init(options);
  }
})(window);
