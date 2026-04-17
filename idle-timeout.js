/* idle-timeout.js (patched weather fix) */
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
    },
    unauthenticatedRedirectUrl: 'index.html',
    unauthenticatedAlertText: '尚未登入，系統將返回登入頁。',
    unauthenticatedAlertTitle: '尚未登入',
    publicPageNames: ['index.html', '']
  };

  function isPublicPage() {
    const page = pageName();
    const list = Array.isArray(cfg?.publicPageNames) ? cfg.publicPageNames : ['index.html', ''];
    return list.map((v) => String(v || '').toLowerCase()).includes(page);
  }

  function redirectUnauthenticated() {
    if (!cfg || isPublicPage()) return;
    const message = String(cfg.unauthenticatedAlertText || '尚未登入，系統將返回登入頁。');
    const title = String(cfg.unauthenticatedAlertTitle || '尚未登入');
    try { alert(`${title}\n\n${message}`); } catch (_) {}
    const target = cfg.unauthenticatedRedirectUrl || cfg.redirectUrl || 'index.html';
    const joiner = String(target).includes('?') ? '&' : '?';
    location.replace(`${target}${joiner}reason=not_logged_in`);
  }

  const PAGE_GROUPS = {
    nurse: {
      label: '護理師系統',
      items: [
        ['admin.html', '護理師首頁'],
        {
          label: '探視系統',
          href: 'admin-visit.html',
          children: [
            ['bookings-list.html', '預約名單查詢']
          ]
        },
        {
          label: '班務系統',
          href: 'admin-duty.html',
          children: [
            ['leave.html', '預假／預班系統'],
            ['nurse-request.html', '請假／調班系統'],
            ['nurse-overtime.html', '加／扣班系統']
          ]
        },
        {
          label: '器材／衛材系統',
          href: 'admin-supplies-system.html',
          children: [
            ['supplies.html', '衛材盤點'],
            ['nurse-maintenance.html', '器材報修']
          ]
        },
        {
          label: '住民系統',
          href: 'admin-resident-system.html',
          children: [
            ['residents-admin.html', '住民資料管理'],
            ['mobility-assessment.html', '行動能力評估'],
            ['nurse-pipeline.html', '住民管路管理'],
            ['consult.html', '照會營養師']
          ]
        },
        ['qc-incident-nurse.html', '意外事件系統'],
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
  const SIDEBAR_COLLAPSED_KEY = 'antai_sidebar_collapsed';

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
      redirectUnauthenticated();
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
      const matched = (group.items || []).some((item) => {
        if (Array.isArray(item)) {
          const href = String(item[0] || '').toLowerCase();
          return href === page;
        }
        if (item && typeof item === 'object') {
          const parentHref = String(item.href || '').toLowerCase();
          if (parentHref === page) return true;
          const children = Array.isArray(item.children) ? item.children : [];
          return children.some((child) => String((Array.isArray(child) ? child[0] : '') || '').toLowerCase() === page);
        }
        return false;
      });
      if (matched) return { key, group };
    }
    return null;
  }

  function removeShell() {
    clearInterval(shellRefreshTimer);
    shellRefreshTimer = null;
    document.body.classList.remove('antai-shell-body', 'antai-shell-collapsed');
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
      body.antai-shell-body{padding-left:284px;box-sizing:border-box;transition:padding-left .2s ease}
      body.antai-shell-body.antai-shell-collapsed{padding-left:96px}
      #antai-shell-root{position:fixed;left:16px;top:18px;bottom:18px;width:252px;z-index:2147482000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",Arial,sans-serif;transition:width .2s ease}
      #antai-shell-root.collapsed{width:64px}
      .antai-shell-wrap{height:100%;display:flex;flex-direction:column;gap:12px}
      .antai-shell-topbar{display:flex;justify-content:flex-end;margin-bottom:-2px}
      .antai-shell-collapse-btn{width:36px;height:36px;border:none;border-radius:12px;background:rgba(255,255,255,.92);color:#38506b;box-shadow:0 6px 18px rgba(34,48,76,.10);cursor:pointer;font-size:18px;font-weight:800;line-height:1;transition:.18s ease}
      .antai-shell-collapse-btn:hover{background:#f3f7fd;transform:translateY(-1px)}
      .antai-weather-card{position:relative;padding:16px;border-radius:22px;color:#fff;background-color:#5f738d;background-size:cover;background-position:center;background-repeat:no-repeat;box-shadow:0 16px 34px rgba(36,48,72,.22);overflow:hidden;isolation:isolate}
      .antai-weather-card:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,18,33,.10) 0%,rgba(8,20,36,.20) 45%,rgba(6,14,26,.38) 100%);z-index:0}
      .antai-weather-card:after{content:"";position:absolute;inset:auto -18% -45% -18%;height:70%;background:radial-gradient(ellipse at center,rgba(255,255,255,.16) 0%,rgba(255,255,255,.05) 28%,rgba(255,255,255,0) 68%);filter:blur(14px);z-index:0}
      .antai-weather-card > *{position:relative;z-index:2}
      .antai-weather-card .antai-weather-anim,.antai-weather-card .antai-weather-overlay{position:absolute;inset:0;pointer-events:none;z-index:1}
      .antai-weather-card.weather-sunny .antai-weather-anim:before{content:"";position:absolute;right:-18px;top:-18px;width:132px;height:132px;border-radius:50%;background:radial-gradient(circle,rgba(255,233,165,.96) 0%,rgba(255,224,127,.62) 28%,rgba(255,214,94,.12) 56%,transparent 72%);animation:antai-sun-pulse 7s ease-in-out infinite}
      .antai-weather-card.weather-sunny .antai-weather-overlay{background:linear-gradient(180deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 45%,rgba(10,18,30,.12) 100%)}
      .antai-weather-card.weather-cloudy .antai-weather-anim:before,.antai-weather-card.weather-cloudy .antai-weather-anim:after,.antai-weather-card.weather-rain .antai-weather-anim:before{content:"";position:absolute;background:rgba(255,255,255,.18);border-radius:999px;filter:blur(2px)}
      .antai-weather-card.weather-cloudy .antai-weather-anim:before{width:132px;height:36px;left:18px;top:32px;animation:antai-cloud-drift 11s ease-in-out infinite}
      .antai-weather-card.weather-cloudy .antai-weather-anim:after{width:92px;height:28px;right:16px;top:72px;animation:antai-cloud-drift 13s ease-in-out infinite reverse}
      .antai-weather-card.weather-rain .antai-weather-overlay{background-image:linear-gradient(180deg,rgba(255,255,255,.00) 0%,rgba(255,255,255,.04) 100%),repeating-linear-gradient(118deg,transparent 0 12px,rgba(190,220,255,.42) 12px 14px,transparent 14px 26px);background-size:100% 100%,150px 150px;animation:antai-rain-fall .95s linear infinite;opacity:.7}
      .antai-weather-card.weather-rain .antai-weather-anim:before{width:120px;height:34px;left:16px;top:24px}
      .antai-weather-card.weather-storm .antai-weather-overlay{background-image:repeating-linear-gradient(118deg,transparent 0 16px,rgba(181,219,255,.26) 16px 18px,transparent 18px 30px);background-size:170px 170px;animation:antai-rain-fall 1.05s linear infinite;opacity:.48}
      .antai-weather-card.weather-storm .antai-weather-anim:before{content:"";position:absolute;inset:0;background:rgba(255,255,255,0);animation:antai-lightning 6s linear infinite}
      .antai-weather-card.weather-snow .antai-weather-overlay{background-image:radial-gradient(circle,rgba(255,255,255,.92) 0 2px,transparent 2.2px),radial-gradient(circle,rgba(255,255,255,.78) 0 1.6px,transparent 1.8px),radial-gradient(circle,rgba(255,255,255,.84) 0 1.8px,transparent 2px);background-size:90px 90px,120px 120px,140px 140px;background-position:0 0,30px 20px,60px 40px;animation:antai-snow-fall 6s linear infinite;opacity:.9}
      @keyframes antai-sun-pulse{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.08);opacity:1}}
      @keyframes antai-cloud-drift{0%,100%{transform:translateX(0)}50%{transform:translateX(10px)}}
      @keyframes antai-rain-fall{0%{background-position:0 0,0 -120px}100%{background-position:0 0,-18px 40px}}
      @keyframes antai-snow-fall{0%{background-position:0 -80px,30px -40px,60px -100px}100%{background-position:18px 70px,8px 90px,78px 80px}}
      @keyframes antai-lightning{0%,87%,100%{background:rgba(255,255,255,0)}88%{background:rgba(255,255,255,.18)}89%{background:rgba(255,255,255,.02)}90%{background:rgba(255,255,255,.28)}91%{background:rgba(255,255,255,0)}97%{background:rgba(255,255,255,0)}98%{background:rgba(255,255,255,.12)}99%{background:rgba(255,255,255,0)}}
      .antai-w-date{position:relative;z-index:1;font-size:16px;font-weight:900;margin-bottom:10px}
      .antai-w-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:700;margin-top:8px}
      .antai-w-left{display:flex;align-items:center;gap:8px;min-width:0}.antai-w-left svg{width:18px;height:18px;display:block;flex:0 0 auto}.antai-w-left span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .antai-menu{background:rgba(255,255,255,.92);border:1px solid rgba(227,234,244,.92);border-radius:22px;box-shadow:0 10px 30px rgba(34,48,76,.08);padding:10px;min-height:0;flex:1;overflow:auto}
      .antai-menu-head{font-size:15px;font-weight:900;color:#22354b;padding:8px 10px 10px}.antai-menu-list{display:flex;flex-direction:column;gap:6px}
      .antai-menu-item{display:flex;align-items:center;gap:12px;text-decoration:none;color:#2b3d55;padding:14px 16px;border-radius:16px;transition:.18s ease}.antai-menu-item:hover{background:#f3f7fd;transform:translateX(2px)}
      .antai-menu-item.active{background:linear-gradient(135deg,rgba(71,123,255,.14),rgba(126,180,255,.18));color:#1d4ea6;font-weight:800}
      .antai-menu-group{display:flex;flex-direction:column;gap:6px}
      .antai-menu-parent{padding:0;gap:0;overflow:hidden}
      .antai-parent-link{display:flex;align-items:center;gap:12px;flex:1 1 auto;min-width:0;padding:14px 8px 14px 16px;text-decoration:none;color:inherit}
      .antai-parent-link:hover{color:inherit}
      .antai-toggle-btn{display:flex;align-items:center;justify-content:center;align-self:stretch;width:42px;border:none;background:transparent;color:#5f7088;cursor:pointer;transition:.18s ease}
      .antai-toggle-btn:hover{background:rgba(47,116,255,.08);color:#2f74ff}
      .antai-menu-group.expanded .antai-toggle-chevron{transform:rotate(90deg)}
      .antai-toggle-chevron{display:inline-block;transition:transform .18s ease;font-size:15px;line-height:1}
      .antai-submenu{display:none;flex-direction:column;gap:6px;padding:0 0 2px 24px}
      .antai-submenu-item{display:flex;align-items:center;gap:10px;text-decoration:none;color:#3c4e67;padding:10px 12px;border-radius:14px;transition:.18s ease}
      .antai-submenu-item:hover{background:#f3f7fd;transform:translateX(2px)}
      .antai-submenu-item.active{background:linear-gradient(135deg,rgba(71,123,255,.10),rgba(126,180,255,.14));color:#1d4ea6;font-weight:800}
      .antai-submenu-dot{width:8px;height:8px;border-radius:50%;background:#b3c1d5;flex:0 0 auto}
      .antai-submenu-item.active .antai-submenu-dot{background:#2f74ff}
      .antai-dot{width:10px;height:10px;border-radius:50%;background:#9db0c9;flex:0 0 auto}.antai-menu-item.active .antai-dot{background:#2f74ff}
      .antai-text{min-width:0}.antai-title{font-size:16px;font-weight:800;line-height:1.35}
      #antai-shell-root.collapsed .antai-weather-card,
      #antai-shell-root.collapsed .antai-menu-head,
      #antai-shell-root.collapsed .antai-text,
      #antai-shell-root.collapsed .antai-toggle-btn,
      #antai-shell-root.collapsed .antai-submenu{display:none !important}
      #antai-shell-root.collapsed .antai-menu{padding:10px 8px}
      #antai-shell-root.collapsed .antai-menu-item,
      #antai-shell-root.collapsed .antai-parent-link{justify-content:center;padding:14px 10px;gap:0}
      #antai-shell-root.collapsed .antai-menu-parent{padding:0}
      #antai-shell-root.collapsed .antai-menu-group{gap:8px}
      #antai-shell-root.collapsed .antai-dot{margin:0}
      @media (max-width: 1200px){body.antai-shell-body,body.antai-shell-body.antai-shell-collapsed{padding-left:0}#antai-shell-root{display:none}}
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

  function svgToDataUri(svg) {
    return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
  }

  function weatherSceneBackground(kind) {
    const base = {
      sunny: { skyTop: '#5ca6ff', skyMid: '#97d2ff', skyBottom: '#f3d59a', haze: 'rgba(255,242,214,.46)' },
      cloudy: { skyTop: '#6f8398', skyMid: '#9db0c2', skyBottom: '#d9dfdf', haze: 'rgba(246,247,248,.34)' },
      rain: { skyTop: '#526173', skyMid: '#79889b', skyBottom: '#bcc6cd', haze: 'rgba(226,233,239,.20)' },
      storm: { skyTop: '#2a3442', skyMid: '#465261', skyBottom: '#67707a', haze: 'rgba(220,229,238,.12)' },
      snow: { skyTop: '#8fa4b8', skyMid: '#bccddb', skyBottom: '#eff5fb', haze: 'rgba(255,255,255,.38)' }
    }[kind] || { skyTop: '#6f8398', skyMid: '#9db0c2', skyBottom: '#d9dfdf', haze: 'rgba(246,247,248,.34)' };

    const extras = {
      sunny: `
        <circle cx="255" cy="38" r="24" fill="rgba(255,237,168,.98)"/>
        <circle cx="255" cy="38" r="42" fill="rgba(255,232,150,.28)"/>
        <ellipse cx="82" cy="58" rx="42" ry="14" fill="rgba(255,255,255,.56)"/>
        <ellipse cx="112" cy="56" rx="24" ry="10" fill="rgba(255,255,255,.48)"/>
        <ellipse cx="205" cy="78" rx="34" ry="12" fill="rgba(255,255,255,.40)"/>
      `,
      cloudy: `
        <ellipse cx="78" cy="56" rx="54" ry="18" fill="rgba(255,255,255,.54)"/>
        <ellipse cx="112" cy="54" rx="30" ry="13" fill="rgba(255,255,255,.46)"/>
        <ellipse cx="205" cy="76" rx="48" ry="17" fill="rgba(255,255,255,.38)"/>
        <ellipse cx="232" cy="74" rx="26" ry="11" fill="rgba(255,255,255,.30)"/>
      `,
      rain: `
        <ellipse cx="88" cy="52" rx="62" ry="19" fill="rgba(233,239,245,.46)"/>
        <ellipse cx="126" cy="51" rx="34" ry="12" fill="rgba(233,239,245,.34)"/>
        <ellipse cx="210" cy="70" rx="54" ry="18" fill="rgba(219,228,236,.28)"/>
        <g stroke="rgba(185,210,232,.44)" stroke-width="2" stroke-linecap="round">
          <path d="M52 86l-8 16"/><path d="M76 88l-8 16"/><path d="M104 90l-8 16"/><path d="M192 92l-8 16"/><path d="M220 94l-8 16"/><path d="M246 96l-8 16"/>
        </g>
      `,
      storm: `
        <ellipse cx="94" cy="54" rx="68" ry="20" fill="rgba(216,223,232,.28)"/>
        <ellipse cx="138" cy="54" rx="36" ry="12" fill="rgba(216,223,232,.20)"/>
        <ellipse cx="214" cy="70" rx="58" ry="18" fill="rgba(216,223,232,.16)"/>
        <path d="M198 62l-10 24h10l-8 20 26-31h-11l10-13z" fill="rgba(255,238,159,.72)"/>
      `,
      snow: `
        <ellipse cx="88" cy="52" rx="60" ry="18" fill="rgba(255,255,255,.42)"/>
        <ellipse cx="126" cy="51" rx="32" ry="12" fill="rgba(255,255,255,.30)"/>
        <ellipse cx="210" cy="72" rx="56" ry="18" fill="rgba(255,255,255,.26)"/>
        <g fill="rgba(255,255,255,.86)">
          <circle cx="60" cy="90" r="2"/><circle cx="88" cy="98" r="2"/><circle cx="112" cy="86" r="1.8"/><circle cx="178" cy="92" r="2"/><circle cx="210" cy="101" r="2"/><circle cx="238" cy="89" r="1.8"/>
        </g>
      `
    }[kind] || '';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${base.skyTop}"/>
            <stop offset="58%" stop-color="${base.skyMid}"/>
            <stop offset="100%" stop-color="${base.skyBottom}"/>
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(28,44,60,.12)"/>
            <stop offset="100%" stop-color="rgba(10,19,30,.54)"/>
          </linearGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
        </defs>
        <rect width="300" height="140" fill="url(#sky)"/>
        <ellipse cx="150" cy="104" rx="190" ry="54" fill="${base.haze}" filter="url(#blur)"/>
        ${extras}
        <path d="M0 116 C35 105,72 112,110 104 C144 96,170 108,204 100 C236 93,262 101,300 92 L300 140 L0 140 Z" fill="rgba(18,33,49,.28)"/>
        <path d="M0 122 C42 112,74 118,118 109 C152 102,184 112,220 106 C252 101,274 106,300 101 L300 140 L0 140 Z" fill="url(#ground)"/>
      </svg>
    `;
    return `linear-gradient(180deg, rgba(7,18,33,.04) 0%, rgba(7,18,33,.10) 100%), ${svgToDataUri(svg)}`;
  }

  function setWeatherBackground(root, weather) {
    const card = root.querySelector('.antai-weather-card');
    if (!card) return;

    card.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rain', 'weather-storm', 'weather-snow');

    const t = String(weather || '');
    let kind = 'cloudy';

    if (t.includes('雷')) kind = 'storm';
    else if (t.includes('雪')) kind = 'snow';
    else if (t.includes('雨') || t.includes('毛毛雨')) kind = 'rain';
    else if (t.includes('晴')) kind = 'sunny';

    card.classList.add(`weather-${kind}`);
    card.style.backgroundImage = weatherSceneBackground(kind);
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(pos.lat)}&longitude=${encodeURIComponent(pos.lon)}&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=Asia%2FTaipei&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    const isDay = Number(data?.current?.is_day || 0) === 1;
    const cloudCover = Number(data?.current?.cloud_cover ?? 0);

    const text = weatherCodeText(code, { isDay, cloudCover });
    return { temp, text, label: pos.label };
  }
  function weatherCodeText(code, extra = {}) {
    const isDay = !!extra.isDay;
    const cloudCover = Number(extra.cloudCover ?? 0);

    if (code === 0) return isDay ? '晴' : '夜間晴朗';

    if (code === 1) {
      if (cloudCover <= 20) return isDay ? '晴' : '夜間晴朗';
      return isDay ? '晴時多雲' : '夜間少雲';
    }

    if (code === 2) {
      if (cloudCover <= 35) return isDay ? '晴時多雲' : '夜間少雲';
      return '局部多雲';
    }

    if (code === 3) return '陰';
    if ([45, 48].includes(code)) return '霧';
    if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '下雨';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '下雪';
    if ([95, 96, 99].includes(code)) return '雷雨';

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
      setWeatherBackground(root, info.text);
      tempEl.innerHTML = `${thermometerIcon()}<span>${Math.round(info.temp)}°C</span>`;
      placeEl.textContent = info.label || '目前位置';
    } catch (err) {
      weatherEl.innerHTML = `${weatherIcon('多雲')}<span>天氣讀取中</span>`;
      setWeatherBackground(root, '多雲');
      tempEl.innerHTML = `${thermometerIcon()}<span>--°C</span>`;
      placeEl.textContent = '無法定位';
    }
  }

  function setShellCollapsedState(root, collapsed) {
    if (!root) return;
    root.classList.toggle('collapsed', !!collapsed);
    document.body.classList.toggle('antai-shell-collapsed', !!collapsed);
    const btn = root.querySelector('#antai-shell-collapse-btn');
    if (btn) {
      btn.setAttribute('aria-label', collapsed ? '展開側邊欄' : '收合側邊欄');
      btn.textContent = collapsed ? '☰' : '×';
      btn.title = collapsed ? '展開側邊欄' : '收合側邊欄';
    }
  }

  function getSavedShellCollapsed() {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch (_) { return false; }
  }

  function saveShellCollapsed(collapsed) {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (_) {}
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
    const links = found.group.items.map((item, idx) => {
      if (Array.isArray(item)) {
        const [href, label] = item;
        return `
          <a class="antai-menu-item${href.toLowerCase() === current ? ' active' : ''}" href="${href}">
            <span class="antai-dot"></span>
            <span class="antai-text">
              <span class="antai-title">${label}</span>
            </span>
          </a>
        `;
      }

      const parentHref = String(item.href || '').toLowerCase();
      const children = Array.isArray(item.children) ? item.children : [];
      const hasActiveChild = children.some(([href]) => String(href).toLowerCase() === current);
      const isParentActive = parentHref === current;
      const expanded = isParentActive || hasActiveChild;
      const sectionId = `antai-submenu-${found.key}-${idx}`;

      const childLinks = children.map(([href, label]) => `
        <a class="antai-submenu-item${String(href).toLowerCase() === current ? ' active' : ''}" href="${href}">
          <span class="antai-submenu-dot"></span>
          <span class="antai-submenu-title">${label}</span>
        </a>
      `).join('');

      return `
        <div class="antai-menu-group${expanded ? ' expanded' : ''}">
          <div class="antai-menu-item antai-menu-parent${isParentActive ? ' active' : ''}">
            <a class="antai-parent-link" href="${item.href}">
              <span class="antai-dot"></span>
              <span class="antai-text">
                <span class="antai-title">${item.label}</span>
              </span>
            </a>
            <button type="button" class="antai-toggle-btn" data-target="${sectionId}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="展開${item.label}子選單">
              <span class="antai-toggle-chevron">▸</span>
            </button>
          </div>
          <div class="antai-submenu" id="${sectionId}" style="display:${expanded ? 'flex' : 'none'}">
            ${childLinks}
          </div>
        </div>
      `;
    }).join('');
    root.innerHTML = `
      <div class="antai-shell-wrap">
        <div class="antai-shell-topbar">
          <button type="button" class="antai-shell-collapse-btn" id="antai-shell-collapse-btn" aria-label="收合側邊欄" title="收合側邊欄">×</button>
        </div>
        <section class="antai-weather-card weather-cloudy">
          <div class="antai-weather-anim"></div>
          <div class="antai-weather-overlay"></div>
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
    setShellCollapsedState(root, getSavedShellCollapsed());

    const collapseBtn = root.querySelector('#antai-shell-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const collapsed = !root.classList.contains('collapsed');
        setShellCollapsedState(root, collapsed);
        saveShellCollapsed(collapsed);
      });
    }

    root.querySelectorAll('.antai-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const submenu = targetId ? root.querySelector(`#${targetId}`) : null;
        const group = btn.closest('.antai-menu-group');
        if (!submenu || !group) return;
        const expanded = submenu.style.display === 'flex';
        submenu.style.display = expanded ? 'none' : 'flex';
        group.classList.toggle('expanded', !expanded);
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });
    });

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

    if (!cfg.isLoggedInFn()) {
      removeShell();
      if (!isPublicPage()) redirectUnauthenticated();
      return;
    }

    addListeners();
    resetIdleCheck();
    mountShell();
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
