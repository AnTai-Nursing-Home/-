/*
 * antai-shell-sidebar.js
 * 安泰護家系統共用側邊欄插件
 *
 * 功能：
 * - 左側側邊清單
 * - 最上方天氣/日期資訊卡（日期、天氣、圖示、溫度、溫度計圖示）
 * - 只顯示目前系統群組可進入的功能
 * - 支援簡約動態效果、手機/桌機版自適應
 * - 不破壞原本頁面，會自動把 body 內容包進主內容區
 *
 * 用法：
 *   <script>
 *     window.ANTAI_SHELL_CONFIG = {
 *       systemKey: 'nurse',
 *       mountMode: 'wrap-body',
 *       weather: {
 *         enabled: true,
 *         locationName: '屏東縣東港鎮',
 *         latitude: 22.465,
 *         longitude: 120.449,
 *       },
 *       systems: {
 *         nurse: {
 *           label: '護理師系統',
 *           items: [
 *             { key:'dashboard', label:'護理儀表板', href:'nurse-dashboard.html', icon:'grid' },
 *             { key:'wound', label:'傷口照護', href:'wound-care.html', icon:'bandage' },
 *             { key:'foley', label:'導尿管', href:'foley-care.html', icon:'droplet' }
 *           ]
 *         }
 *       }
 *     };
 *   </script>
 *   <script src="antai-shell-sidebar.js"></script>
 */
(function (global) {
  const DEFAULTS = {
    autoStart: true,
    mountMode: 'wrap-body',
    systemKey: '',
    activeKey: '',
    sidebarWidth: 306,
    collapsedWidth: 88,
    startCollapsed: false,
    mobileBreakpoint: 1024,
    showSectionTitle: true,
    weatherRefreshMinutes: 10,
    weather: {
      enabled: true,
      locationName: '目前位置',
      latitude: null,
      longitude: null,
      useGeolocation: false,
      apiBase: 'https://api.open-meteo.com/v1/forecast',
    },
    systems: {},
    onNavigate: null,
  };

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  let cfg = null;
  let rootEl = null;
  let sidebarEl = null;
  let weatherTimer = null;
  let dateTimer = null;
  let contentShellEl = null;
  let isMobileDrawerOpen = false;
  let hasBooted = false;

  function mergeDeep(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra || typeof extra !== 'object') return out;
    Object.keys(extra).forEach((key) => {
      const a = out[key];
      const b = extra[key];
      if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        out[key] = mergeDeep(a, b);
      } else {
        out[key] = b;
      }
    });
    return out;
  }

  function ensureStyles() {
    if (document.getElementById('antai-shell-sidebar-style')) return;
    const style = document.createElement('style');
    style.id = 'antai-shell-sidebar-style';
    style.textContent = `
      :root{
        --antai-shell-bg: linear-gradient(180deg, #f7fafc 0%, #eef3f9 100%);
        --antai-sidebar-bg: rgba(255,255,255,.76);
        --antai-sidebar-border: rgba(15, 23, 42, .08);
        --antai-card-bg: linear-gradient(180deg, rgba(255,255,255,.88), rgba(248,250,252,.96));
        --antai-card-border: rgba(255,255,255,.65);
        --antai-shadow: 0 18px 40px rgba(15,23,42,.08);
        --antai-text: #0f172a;
        --antai-muted: #64748b;
        --antai-primary: #2563eb;
        --antai-primary-soft: rgba(37,99,235,.12);
        --antai-active: linear-gradient(135deg, rgba(59,130,246,.14), rgba(14,165,233,.12));
        --antai-danger: #ef4444;
        --antai-sidebar-width: 306px;
        --antai-sidebar-collapsed: 88px;
        --antai-main-gap: 18px;
        --antai-top-offset: 14px;
      }
      html.antai-shell-html, body.antai-shell-body {
        min-height: 100%;
        background: var(--antai-shell-bg);
      }
      body.antai-shell-body {
        margin: 0;
      }
      .antai-shell {
        display: flex;
        min-height: 100vh;
        width: 100%;
        color: var(--antai-text);
      }
      .antai-shell-sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        width: var(--antai-sidebar-width);
        min-width: var(--antai-sidebar-width);
        padding: 14px;
        box-sizing: border-box;
        z-index: 40;
      }
      .antai-shell-sidebar-inner {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
        height: calc(100vh - 28px);
        padding: 14px;
        border: 1px solid var(--antai-sidebar-border);
        background: var(--antai-sidebar-bg);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border-radius: 28px;
        box-shadow: var(--antai-shadow);
        overflow: hidden;
      }
      .antai-shell-sidebar-inner::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 12% 12%, rgba(56,189,248,.18), transparent 28%),
          radial-gradient(circle at 88% 8%, rgba(99,102,241,.16), transparent 26%),
          radial-gradient(circle at 50% 100%, rgba(34,197,94,.08), transparent 32%);
        pointer-events: none;
      }
      .antai-shell-collapse,
      .antai-shell-mobile-toggle {
        border: 0;
        outline: 0;
        cursor: pointer;
        border-radius: 14px;
        background: rgba(255,255,255,.72);
        color: var(--antai-text);
        box-shadow: 0 8px 16px rgba(15,23,42,.08);
        transition: transform .18s ease, background .18s ease;
      }
      .antai-shell-collapse:hover,
      .antai-shell-mobile-toggle:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,.92);
      }
      .antai-shell-collapse {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
      }
      .antai-shell-mobile-toggle {
        display: none;
        position: fixed;
        top: 14px;
        left: 14px;
        width: 42px;
        height: 42px;
        z-index: 70;
      }
      .antai-shell-weather {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        padding: 16px 16px 15px;
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(255,255,255,.88), rgba(237,242,247,.98));
        border: 1px solid rgba(255,255,255,.65);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 12px 24px rgba(15,23,42,.06);
      }
      .antai-shell-weather::before,
      .antai-shell-weather::after {
        content: '';
        position: absolute;
        border-radius: 999px;
        filter: blur(8px);
        opacity: .9;
      }
      .antai-shell-weather::before {
        width: 120px;
        height: 120px;
        right: -22px;
        top: -34px;
        background: radial-gradient(circle, rgba(251,191,36,.26) 0%, rgba(251,191,36,0) 70%);
        animation: antaiWeatherFloat 8s ease-in-out infinite;
      }
      .antai-shell-weather::after {
        width: 110px;
        height: 110px;
        left: -28px;
        bottom: -42px;
        background: radial-gradient(circle, rgba(56,189,248,.22) 0%, rgba(56,189,248,0) 72%);
        animation: antaiWeatherFloat 10s ease-in-out infinite reverse;
      }
      @keyframes antaiWeatherFloat {
        0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
        50% { transform: translateY(-6px) translateX(5px) scale(1.04); }
      }
      @keyframes antaiPulse {
        0%, 100% { opacity: .55; transform: scale(1); }
        50% { opacity: .95; transform: scale(1.08); }
      }
      .antai-shell-weather-main {
        position: relative;
        z-index: 1;
        min-width: 0;
      }
      .antai-shell-date {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: .02em;
        margin-bottom: 6px;
      }
      .antai-shell-location {
        font-size: .78rem;
        color: var(--antai-muted);
        margin-bottom: 10px;
      }
      .antai-shell-weather-row,
      .antai-shell-temp-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .antai-shell-weather-row + .antai-shell-temp-row {
        margin-top: 8px;
      }
      .antai-shell-meta-icon {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        opacity: .8;
      }
      .antai-shell-meta-label {
        font-size: .92rem;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .antai-shell-temp {
        font-size: 1.42rem;
        font-weight: 900;
        letter-spacing: -.02em;
      }
      .antai-shell-weather-icon-wrap {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 76px;
      }
      .antai-shell-weather-icon {
        width: 58px;
        height: 58px;
        animation: antaiPulse 3.6s ease-in-out infinite;
        filter: drop-shadow(0 10px 12px rgba(15,23,42,.1));
      }
      .antai-shell-section-title {
        position: relative;
        z-index: 1;
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .12em;
        color: var(--antai-muted);
        padding: 4px 6px 0;
      }
      .antai-shell-menu {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        overflow: auto;
        padding-right: 2px;
      }
      .antai-shell-menu::-webkit-scrollbar { width: 8px; }
      .antai-shell-menu::-webkit-scrollbar-thumb {
        background: rgba(100,116,139,.22);
        border-radius: 999px;
      }
      .antai-shell-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 12px;
        border-radius: 18px;
        color: inherit;
        text-decoration: none;
        transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
        background: rgba(255,255,255,.42);
        border: 1px solid rgba(255,255,255,.45);
      }
      .antai-shell-link:hover {
        transform: translateX(2px);
        background: rgba(255,255,255,.82);
        box-shadow: 0 10px 18px rgba(15,23,42,.06);
      }
      .antai-shell-link.is-active {
        background: var(--antai-active);
        border-color: rgba(59,130,246,.18);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.65), 0 10px 22px rgba(59,130,246,.08);
      }
      .antai-shell-link-icon {
        width: 42px;
        height: 42px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,.76);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 6px 14px rgba(15,23,42,.06);
        flex: 0 0 42px;
      }
      .antai-shell-link-icon svg {
        width: 20px;
        height: 20px;
      }
      .antai-shell-link-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .antai-shell-link-label {
        font-size: .95rem;
        font-weight: 800;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .antai-shell-link-desc {
        font-size: .76rem;
        color: var(--antai-muted);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .antai-shell-main {
        min-width: 0;
        flex: 1 1 auto;
        padding: 14px 14px 14px 0;
      }
      .antai-shell-main-inner {
        min-height: calc(100vh - 28px);
      }
      body.antai-shell-has-sidebar {
        background: var(--antai-shell-bg);
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-sidebar {
        width: var(--antai-sidebar-collapsed);
        min-width: var(--antai-sidebar-collapsed);
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-collapse svg {
        transform: rotate(180deg);
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-weather {
        grid-template-columns: 1fr;
        padding: 14px 10px;
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-weather-main,
      body.antai-shell-body.antai-shell-collapsed .antai-shell-section-title,
      body.antai-shell-body.antai-shell-collapsed .antai-shell-link-text {
        display: none;
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-weather-icon-wrap {
        min-width: 0;
        justify-content: center;
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-weather-icon {
        width: 44px;
        height: 44px;
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-link {
        justify-content: center;
        padding-left: 8px;
        padding-right: 8px;
      }
      body.antai-shell-body.antai-shell-collapsed .antai-shell-link-icon {
        margin: 0;
      }
      .antai-shell-empty {
        position: relative;
        z-index: 1;
        padding: 16px 14px;
        color: var(--antai-muted);
        font-size: .92rem;
        border-radius: 18px;
        background: rgba(255,255,255,.42);
      }
      @media (max-width: 1023px) {
        .antai-shell {
          display: block;
        }
        .antai-shell-mobile-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .antai-shell-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: min(88vw, 340px);
          min-width: min(88vw, 340px);
          transform: translateX(calc(-100% - 16px));
          transition: transform .24s ease;
          padding: 10px;
          z-index: 65;
        }
        .antai-shell-sidebar.is-open {
          transform: translateX(0);
        }
        .antai-shell-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.24);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s ease;
          z-index: 60;
        }
        .antai-shell-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .antai-shell-main {
          padding: 62px 10px 10px;
        }
        .antai-shell-main-inner {
          min-height: calc(100vh - 72px);
        }
        .antai-shell-collapse {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function svgIcon(name) {
    const map = {
      menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
      weather: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v2M16 2v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/><circle cx="12" cy="12" r="4.5"/></svg>',
      thermometer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/><path d="M12 9v8"/></svg>',
      grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>',
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z"/><path d="M3 9h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      bandage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m10.2 13.8-4 4a3 3 0 1 1-4.2-4.2l4-4"/><path d="m13.8 10.2 4-4a3 3 0 1 1 4.2 4.2l-4 4"/><path d="m7 7 10 10"/><path d="M8.5 10.5h.01"/><path d="M10.5 8.5h.01"/><path d="M13.5 15.5h.01"/><path d="M15.5 13.5h.01"/></svg>',
      droplet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7s6 6.2 6 10.7a6 6 0 0 1-12 0c0-4.5 6-10.7 6-10.7Z"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/></svg>',
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 20-1.45-1.32C5.4 14.03 2 10.95 2 7.2 2 4.12 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.12 22 7.2c0 3.75-3.4 6.83-8.55 11.49Z"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.3l.06.06A1.65 1.65 0 0 0 8 4.6c.37 0 .72-.13 1-.33.28-.2.48-.5.6-.82V3a2 2 0 1 1 4 0v.09c.12.32.32.62.6.82.28.2.63.33 1 .33a1.65 1.65 0 0 0 1-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c0 .37.13.72.33 1 .2.28.5.48.82.6H21a2 2 0 1 1 0 4h-.09c-.32.12-.62.32-.82.6-.2.28-.33.63-.33 1Z"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3.5 9.74 7 11 3.5-1.26 7-6 7-11V5l-7-3Z"/></svg>',
    };
    return map[name] || map.folder;
  }

  function weatherSvgByCode(code, isDay) {
    const colorSun = '#f59e0b';
    const colorCloud = '#94a3b8';
    const colorRain = '#38bdf8';
    const colorMoon = '#818cf8';
    if ([0].includes(code)) {
      return isDay
        ? `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="13" fill="${colorSun}"/><g stroke="${colorSun}" stroke-width="4" stroke-linecap="round"><path d="M32 6v8"/><path d="M32 50v8"/><path d="M6 32h8"/><path d="M50 32h8"/><path d="m13 13 6 6"/><path d="m45 45 6 6"/><path d="m13 51 6-6"/><path d="m45 19 6-6"/></g></svg>`
        : `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M39 10a18 18 0 1 0 15 27.8A22 22 0 1 1 39 10Z" fill="${colorMoon}"/></svg>`;
    }
    if ([1, 2, 3].includes(code)) {
      return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><circle cx="23" cy="22" r="10" fill="${isDay ? colorSun : colorMoon}" opacity=".9"/><path d="M18 43h27a9 9 0 1 0-1.2-17.92A13 13 0 0 0 18.98 27 8 8 0 0 0 18 43Z" fill="${colorCloud}"/></svg>`;
    }
    if ([45, 48].includes(code)) {
      return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M19 40h26a9 9 0 1 0-.96-17.95A13.5 13.5 0 0 0 18.77 25 8 8 0 0 0 19 40Z" fill="#cbd5e1"/><path d="M14 47h36" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/><path d="M19 54h26" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/></svg>`;
    }
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) {
      return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M18 35h28a9 9 0 1 0-.96-17.95A13.5 13.5 0 0 0 19.2 20 8 8 0 0 0 18 35Z" fill="${colorCloud}"/><path d="M22 42l-3 7" stroke="${colorRain}" stroke-width="4" stroke-linecap="round"/><path d="M33 42l-3 9" stroke="${colorRain}" stroke-width="4" stroke-linecap="round"/><path d="M44 42l-3 7" stroke="${colorRain}" stroke-width="4" stroke-linecap="round"/></svg>`;
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M18 35h28a9 9 0 1 0-.96-17.95A13.5 13.5 0 0 0 19.2 20 8 8 0 0 0 18 35Z" fill="#cbd5e1"/><circle cx="22" cy="47" r="2.5" fill="#e2e8f0"/><circle cx="32" cy="51" r="2.5" fill="#e2e8f0"/><circle cx="43" cy="47" r="2.5" fill="#e2e8f0"/></svg>`;
    }
    if ([95, 96, 99].includes(code)) {
      return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M18 35h28a9 9 0 1 0-.96-17.95A13.5 13.5 0 0 0 19.2 20 8 8 0 0 0 18 35Z" fill="#94a3b8"/><path d="m30 41-6 10h6l-4 9 14-16h-7l4-8Z" fill="#fbbf24"/></svg>`;
    }
    return `<svg class="antai-shell-weather-icon" viewBox="0 0 64 64" fill="none"><path d="M18 35h28a9 9 0 1 0-.96-17.95A13.5 13.5 0 0 0 19.2 20 8 8 0 0 0 18 35Z" fill="${colorCloud}"/></svg>`;
  }

  function weatherTextByCode(code) {
    if (code === 0) return '晴';
    if ([1].includes(code)) return '大致晴朗';
    if ([2].includes(code)) return '局部多雲';
    if ([3].includes(code)) return '陰天';
    if ([45, 48].includes(code)) return '霧';
    if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return '下雨';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '下雪';
    if ([95, 96, 99].includes(code)) return '雷雨';
    return '天氣更新中';
  }

  function formatDate(d) {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentGroup() {
    return cfg.systemKey || document.body.dataset.systemKey || document.documentElement.dataset.systemKey || '';
  }

  function getCurrentItems() {
    const groupKey = getCurrentGroup();
    const group = cfg.systems[groupKey];
    if (!group || !Array.isArray(group.items)) return [];
    return group.items;
  }

  function getActiveKey(items) {
    if (cfg.activeKey) return cfg.activeKey;
    const path = location.pathname.split('/').pop() || '';
    const found = items.find((item) => item.active || (item.href && item.href.split('?')[0] === path));
    return found ? found.key : '';
  }

  function renderMenu() {
    const items = getCurrentItems();
    const menuEl = rootEl.querySelector('[data-antai-shell-menu]');
    const titleEl = rootEl.querySelector('[data-antai-shell-group-title]');
    const groupKey = getCurrentGroup();
    const group = cfg.systems[groupKey];
    if (titleEl) titleEl.textContent = group && group.label ? group.label : '系統清單';
    if (!menuEl) return;

    if (!items.length) {
      menuEl.innerHTML = '<div class="antai-shell-empty">目前這個系統群組尚未設定可切換清單。</div>';
      return;
    }

    const activeKey = getActiveKey(items);
    menuEl.innerHTML = items.map((item) => {
      const isActive = item.key === activeKey;
      return `
        <a class="antai-shell-link ${isActive ? 'is-active' : ''}" href="${escapeHtml(item.href || '#')}" data-antai-shell-item="${escapeHtml(item.key || '')}">
          <span class="antai-shell-link-icon">${svgIcon(item.icon || 'folder')}</span>
          <span class="antai-shell-link-text">
            <span class="antai-shell-link-label">${escapeHtml(item.label || '')}</span>
            ${item.description ? `<span class="antai-shell-link-desc">${escapeHtml(item.description)}</span>` : ''}
          </span>
        </a>
      `;
    }).join('');

    menuEl.querySelectorAll('[data-antai-shell-item]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const key = link.getAttribute('data-antai-shell-item') || '';
        const item = items.find((x) => String(x.key) === String(key));
        if (typeof cfg.onNavigate === 'function' && item) {
          const result = cfg.onNavigate(item, event);
          if (result === false) event.preventDefault();
        }
        if (window.innerWidth <= cfg.mobileBreakpoint) {
          closeMobileDrawer();
        }
      });
    });
  }

  function wrapBodyChildren() {
    const mainInner = document.createElement('div');
    mainInner.className = 'antai-shell-main-inner';
    const frag = document.createDocumentFragment();
    while (document.body.firstChild) {
      frag.appendChild(document.body.firstChild);
    }
    mainInner.appendChild(frag);
    return mainInner;
  }

  function buildShell() {
    rootEl = document.createElement('div');
    rootEl.className = 'antai-shell';

    const backdrop = document.createElement('div');
    backdrop.className = 'antai-shell-backdrop';
    backdrop.addEventListener('click', closeMobileDrawer);

    sidebarEl = document.createElement('aside');
    sidebarEl.className = 'antai-shell-sidebar';
    sidebarEl.innerHTML = `
      <div class="antai-shell-sidebar-inner">
        <button type="button" class="antai-shell-collapse" aria-label="收合側邊欄">${svgIcon('chevron')}</button>
        <section class="antai-shell-weather" data-antai-shell-weather>
          <div class="antai-shell-weather-main">
            <div class="antai-shell-date" data-antai-shell-date>${formatDate(new Date())}</div>
            <div class="antai-shell-location" data-antai-shell-location>${escapeHtml(cfg.weather.locationName || '目前位置')}</div>
            <div class="antai-shell-weather-row">
              <span class="antai-shell-meta-icon">${svgIcon('weather')}</span>
              <span class="antai-shell-meta-label" data-antai-shell-weather-text>天氣更新中</span>
            </div>
            <div class="antai-shell-temp-row">
              <span class="antai-shell-meta-icon">${svgIcon('thermometer')}</span>
              <span class="antai-shell-temp" data-antai-shell-temp>--°C</span>
            </div>
          </div>
          <div class="antai-shell-weather-icon-wrap" data-antai-shell-weather-icon>${weatherSvgByCode(0, true)}</div>
        </section>
        ${cfg.showSectionTitle ? '<div class="antai-shell-section-title" data-antai-shell-group-title>系統清單</div>' : ''}
        <nav class="antai-shell-menu" data-antai-shell-menu></nav>
      </div>
    `;

    const main = document.createElement('main');
    main.className = 'antai-shell-main';
    contentShellEl = document.createElement('div');
    contentShellEl.className = 'antai-shell-main-inner';

    if (cfg.mountMode === 'wrap-body') {
      const bodyWrapped = wrapBodyChildren();
      contentShellEl.replaceWith(bodyWrapped);
      contentShellEl = bodyWrapped;
    }

    main.appendChild(contentShellEl);
    rootEl.appendChild(sidebarEl);
    rootEl.appendChild(main);

    document.body.appendChild(backdrop);
    document.body.appendChild(rootEl);

    const mobileBtn = document.createElement('button');
    mobileBtn.type = 'button';
    mobileBtn.className = 'antai-shell-mobile-toggle';
    mobileBtn.setAttribute('aria-label', '打開系統清單');
    mobileBtn.innerHTML = svgIcon('menu');
    mobileBtn.addEventListener('click', toggleMobileDrawer);
    document.body.appendChild(mobileBtn);

    sidebarEl.querySelector('.antai-shell-collapse').addEventListener('click', toggleCollapsed);
    renderMenu();
  }

  function toggleCollapsed() {
    document.body.classList.toggle('antai-shell-collapsed');
  }

  function toggleMobileDrawer() {
    if (isMobileDrawerOpen) closeMobileDrawer();
    else openMobileDrawer();
  }

  function openMobileDrawer() {
    isMobileDrawerOpen = true;
    const backdrop = document.querySelector('.antai-shell-backdrop');
    if (sidebarEl) sidebarEl.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-open');
  }

  function closeMobileDrawer() {
    isMobileDrawerOpen = false;
    const backdrop = document.querySelector('.antai-shell-backdrop');
    if (sidebarEl) sidebarEl.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
  }

  function setWeatherState(state) {
    const dateEl = rootEl && rootEl.querySelector('[data-antai-shell-date]');
    const locationEl = rootEl && rootEl.querySelector('[data-antai-shell-location]');
    const weatherTextEl = rootEl && rootEl.querySelector('[data-antai-shell-weather-text]');
    const tempEl = rootEl && rootEl.querySelector('[data-antai-shell-temp]');
    const iconWrapEl = rootEl && rootEl.querySelector('[data-antai-shell-weather-icon]');
    if (dateEl) dateEl.textContent = formatDate(new Date());
    if (locationEl) locationEl.textContent = state.locationName || cfg.weather.locationName || '目前位置';
    if (weatherTextEl) weatherTextEl.textContent = state.weatherText || '天氣更新中';
    if (tempEl) tempEl.textContent = typeof state.temperature === 'number' ? `${Math.round(state.temperature)}°C` : '--°C';
    if (iconWrapEl) iconWrapEl.innerHTML = state.iconSvg || weatherSvgByCode(0, true);
  }

  async function resolveCoords() {
    if (Number.isFinite(cfg.weather.latitude) && Number.isFinite(cfg.weather.longitude)) {
      return { latitude: cfg.weather.latitude, longitude: cfg.weather.longitude };
    }
    if (!cfg.weather.useGeolocation || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }

  async function refreshWeather() {
    if (!cfg.weather.enabled) return;
    try {
      const coords = await resolveCoords();
      if (!coords) {
        setWeatherState({
          weatherText: '請設定天氣座標',
          temperature: null,
          locationName: cfg.weather.locationName,
          iconSvg: weatherSvgByCode(1, true),
        });
        return;
      }
      const url = new URL(cfg.weather.apiBase);
      url.searchParams.set('latitude', coords.latitude);
      url.searchParams.set('longitude', coords.longitude);
      url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
      url.searchParams.set('timezone', 'Asia/Taipei');
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`weather ${res.status}`);
      const data = await res.json();
      const current = data && data.current ? data.current : {};
      const code = Number(current.weather_code || 0);
      const isDay = Number(current.is_day || 1) === 1;
      const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : null;
      setWeatherState({
        weatherText: weatherTextByCode(code),
        temperature: temp,
        locationName: cfg.weather.locationName,
        iconSvg: weatherSvgByCode(code, isDay),
      });
    } catch (err) {
      console.error('[AntaiShellSidebar] refreshWeather error:', err);
      setWeatherState({
        weatherText: '天氣讀取失敗',
        temperature: null,
        locationName: cfg.weather.locationName,
        iconSvg: weatherSvgByCode(3, true),
      });
    }
  }

  function startTimers() {
    clearInterval(dateTimer);
    clearInterval(weatherTimer);
    dateTimer = setInterval(() => {
      const dateEl = rootEl && rootEl.querySelector('[data-antai-shell-date]');
      if (dateEl) dateEl.textContent = formatDate(new Date());
    }, 60 * 1000);

    if (cfg.weather.enabled) {
      refreshWeather();
      weatherTimer = setInterval(refreshWeather, Math.max(1, Number(cfg.weatherRefreshMinutes || 10)) * 60 * 1000);
    }
  }

  function applyBodyState() {
    document.documentElement.classList.add('antai-shell-html');
    document.body.classList.add('antai-shell-body', 'antai-shell-has-sidebar');
    document.documentElement.style.setProperty('--antai-sidebar-width', `${Number(cfg.sidebarWidth) || 306}px`);
    document.documentElement.style.setProperty('--antai-sidebar-collapsed', `${Number(cfg.collapsedWidth) || 88}px`);
    if (cfg.startCollapsed && window.innerWidth > cfg.mobileBreakpoint) {
      document.body.classList.add('antai-shell-collapsed');
    }
  }

  function mount(targetSelector) {
    if (hasBooted) return;
    hasBooted = true;
    ensureStyles();
    applyBodyState();

    if (cfg.mountMode === 'target' && targetSelector) {
      const target = document.querySelector(targetSelector);
      if (!target) {
        console.warn('[AntaiShellSidebar] mount target not found:', targetSelector);
      }
    }

    buildShell();
    startTimers();
    window.addEventListener('resize', () => {
      if (window.innerWidth > cfg.mobileBreakpoint) closeMobileDrawer();
    });
  }

  function start(options) {
    cfg = mergeDeep(DEFAULTS, options || {});
    mount(cfg.targetSelector || null);
  }

  function stop() {
    clearInterval(dateTimer);
    clearInterval(weatherTimer);
    dateTimer = null;
    weatherTimer = null;
  }

  global.AntaiShellSidebar = {
    start,
    stop,
    refreshWeather,
    rerenderMenu: renderMenu,
  };

  function autoBoot() {
    const userCfg = global.ANTAI_SHELL_CONFIG && typeof global.ANTAI_SHELL_CONFIG === 'object'
      ? global.ANTAI_SHELL_CONFIG
      : null;
    if (!userCfg) return;
    if (userCfg.autoStart === false) return;
    start(userCfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBoot);
  } else {
    autoBoot();
  }
})(window);
