document.addEventListener('DOMContentLoaded', function () {
  const passwordSection = document.getElementById('password-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const passwordInput = document.getElementById('passwordInput');
  const loginButton = document.getElementById('loginButton');
  const errorMessage = document.getElementById('errorMessage');

  const LOGIN_API = '/api/verify-affairs';

  // ✅ 記住已登入（避免返回時又看到輸入密碼）
  const AUTH_KEY = 'affairs_authed';
  const AUTH_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

  function setAuthed() {
    try { sessionStorage.setItem(AUTH_KEY, String(Date.now())); } catch (_) {}
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

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'dashboard') {
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
