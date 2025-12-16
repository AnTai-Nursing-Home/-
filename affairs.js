document.addEventListener('DOMContentLoaded', function () {
  // --- 元件宣告 ---
  const passwordSection = document.getElementById('password-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const passwordInput = document.getElementById('passwordInput');
  const loginButton = document.getElementById('loginButton');
  const errorMessage = document.getElementById('errorMessage');

  // ✅ 事務系統登入 API（Vercel Serverless）
  // 如果你想沿用護理師的 /api/login，把下面改成 '/api/login' 也可以。
  const LOGIN_API = '/api/verify-affairs';

  async function handleLogin() {
    // ✅ 未勾選不得登入
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

    if (loginButton) loginButton.disabled = true;

    try {
      const response = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      // 有些後端會回傳空 body，這裡做容錯
      let result = {};
      try { result = await response.json(); } catch (_) {}

      const ok = response.ok && (result.success === true || Object.keys(result).length === 0);
      if (ok) {
        passwordSection?.classList.add('d-none');
        dashboardSection?.classList.remove('d-none');
        errorMessage?.classList.add('d-none');
      } else {
        errorMessage?.classList.remove('d-none');
      }
    } catch (err) {
      console.error('登入時發生錯誤:', err);
      alert('登入時發生網路錯誤，請稍後再試。');
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  }

  if (loginButton) loginButton.addEventListener('click', handleLogin);
  if (passwordInput) {
    passwordInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') handleLogin();
    });
  }

  // --- 需要 Firebase 的功能（如果你之後要用） ---
  document.addEventListener('firebase-ready', () => {
    // 允許用 ?view=dashboard 直接進儀表板（如需停用，刪掉這段即可）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'dashboard') {
      passwordSection?.classList.add('d-none');
      dashboardSection?.classList.remove('d-none');
    }
  });
});
