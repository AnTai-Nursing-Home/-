document.addEventListener('DOMContentLoaded', function () {
  const passwordSection = document.getElementById('password-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const passwordInput = document.getElementById('passwordInput');
  const loginButton = document.getElementById('loginButton');
  const errorMessage = document.getElementById('errorMessage');

  const LOGIN_API = '/api/verify-affairs';

  // ✅ 只在「同一個分頁（tab）」內記住登入
  // - 你關掉分頁、或離開事務系統（點返回首頁）就會需要再登入
  const AUTH_KEY = 'affairs_authed';
  const AUTH_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時（仍在同一分頁內才有效）

  function setAuthed() {
    try { sessionStorage.setItem(AUTH_KEY, String(Date.now())); } catch (_) {}
  }
  function clearAuthed() {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (_) {}
  }
  function isAuthed() {
    try {
      const ts = Number(sessionStorage.getItem(AUTH_KEY) || 0);
      return ts && (Date.now() - ts) < AUTH_TTL_MS;
    } catch (_) { return false; }
  }

  function showDashboard() {
    passwordSection?.classList.add('d-none');
    dashboardSection?.classList.remove('d-none');
    errorMessage?.classList.add('d-none');
  }
  function showLogin() {
    dashboardSection?.classList.add('d-none');
    passwordSection?.classList.remove('d-none');
  }

  const urlParams = new URLSearchParams(window.location.search);

  // ✅ 支援 logout：清掉登入狀態
  if (urlParams.get('logout') === '1') {
    clearAuthed();
    showLogin();
  } else if (urlParams.get('view') === 'dashboard') {
    showDashboard();
    setAuthed();
  } else if (isAuthed()) {
    showDashboard();
  }

  async function handleLogin() {
    const privacyCheck = document.getElementById('privacyCheck');
    if (!privacyCheck || !privacyCheck.checked) {
      alert('請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》');
      return;
    }

    const password = (passwordInput?.value || '').trim();
    if (!password) {
      alert('請輸入密碼');
      return;
    }

    loginButton && (loginButton.disabled = true);

    try {
      const response = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      let result = {};
      try { result = await response.json(); } catch (_) {}

      const ok = response.ok && (result.success === true || Object.keys(result).length === 0);
      if (ok) {
        setAuthed();
        showDashboard();
      } else {
        errorMessage?.classList.remove('d-none');
      }
    } catch (err) {
      console.error('登入時發生錯誤:', err);
      alert('登入時發生網路錯誤，請稍後再試。');
    } finally {
      loginButton && (loginButton.disabled = false);
    }
  }

  loginButton?.addEventListener('click', handleLogin);
  passwordInput?.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') handleLogin();
  });
});
