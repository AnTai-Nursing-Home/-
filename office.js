// office.js - 辦公室端個人帳號密碼登入（含 Enter 換格）
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件
(function () {
  const AUTH_KEY = 'officeAuth';

  const passwordSection = document.getElementById('password-section-office');
  if (!passwordSection) return;

  const dashboardSection = document.getElementById('dashboard-section-office');

  const usernameInput = document.getElementById('usernameInput-office');
  const passwordInput = document.getElementById('passwordInput-office');
  const loginButton = document.getElementById('loginButton-office');
  const errorMessage = document.getElementById('errorMessage-office');
  const privacyCheck = document.getElementById('privacyCheck');

  // 兼容多版 HTML：登入資訊 / 登出按鈕可能有不同 id
  const loginInfo =
    document.getElementById('loginInfoOffice') ||
    document.getElementById('loginInfo-office');

  const logoutBtn =
    document.getElementById('logoutBtnOffice') ||
    document.getElementById('logoutButton-office') ||
    document.getElementById('btnLogoutTop');

  const loginStaffIdEl = document.getElementById('loginStaffId');
  const loginStaffNameEl = document.getElementById('loginStaffName');

  function setVisible(el, visible) {
    if (!el) return;
    el.classList.toggle('d-none', !visible);
  }

  function showError(msg) {
    if (!errorMessage) return;
    errorMessage.textContent = msg || '帳號或密碼錯誤，請重試！';
    errorMessage.classList.remove('d-none');
  }

  function hideError() {
    if (!errorMessage) return;
    errorMessage.classList.add('d-none');
  }

  function setAuth(user) {
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (e) {}
  }

  function getAuth() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearAuth() {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
  }

  async function waitForDbReady() {
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }

  function renderHeaderUser(user) {
    // 如果你的 office.html 是「header 右上角顯示」那版
    if (loginStaffIdEl && loginStaffNameEl) {
      loginStaffIdEl.textContent = user?.staffId || '';
      loginStaffNameEl.textContent = user?.displayName || '';
      // header 區塊容器（若存在）
      const loginInfoOffice = document.getElementById('loginInfoOffice');
      if (loginInfoOffice) loginInfoOffice.classList.remove('d-none');
      return;
    }
    // 舊版：直接顯示文字
    if (loginInfo) {
      const name = user?.displayName || user?.username || '';
      loginInfo.textContent = `${user?.staffId || ''} ${name}`.trim();
      loginInfo.classList.remove('d-none');
    }
  }

  function clearHeaderUser() {
    const loginInfoOffice = document.getElementById('loginInfoOffice');
    if (loginInfoOffice) loginInfoOffice.classList.add('d-none');
    if (loginStaffIdEl) loginStaffIdEl.textContent = '';
    if (loginStaffNameEl) loginStaffNameEl.textContent = '';
    if (loginInfo) loginInfo.classList.add('d-none');
  }

  function showLogin() {
    setVisible(passwordSection, true);
    setVisible(dashboardSection, false);
    setVisible(logoutBtn, false);
    hideError();
  }

  function showDashboard(user) {
    setVisible(passwordSection, false);
    setVisible(dashboardSection, true);
    setVisible(logoutBtn, true);
    hideError();
    renderHeaderUser(user);
  }

  async function findAccountByUsername(username) {
    const snap = await db.collection('userAccounts')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async function handleLogin() {
    if (privacyCheck && !privacyCheck.checked) {
      alert('請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》');
      return;
    }

    const username = (usernameInput?.value || '').trim();
    const password = (passwordInput?.value || '').trim();

    if (!username || !password) {
      showError('請輸入帳號與密碼');
      return;
    }

    if (loginButton) loginButton.disabled = true;
    hideError();

    try {
      await waitForDbReady();

      const acc = await findAccountByUsername(username);
      if (!acc) { showError('帳號或密碼錯誤，請重試！'); return; }

      if (acc.canOffice !== true) { showError('此帳號沒有辦公室系統權限'); return; }
      if ((acc.password || '') !== password) { showError('帳號或密碼錯誤，請重試！'); return; }

      const user = {
        staffId: acc.staffId || acc.id || acc.username || '',
        displayName: acc.displayName || acc.name || '',
        username: acc.username || '',
        source: acc.source || '',
        canOffice: acc.canOffice === true,
        canNurse: acc.canNurse === true,
        role: 'office',
        loginAt: Date.now()
      };

      setAuth(user);
      showDashboard(user);
    } catch (e) {
      console.error('辦公室登入錯誤：', e);
      showError('登入時發生錯誤，請稍後再試');
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  }

  function bindUI() {
    if (loginButton) loginButton.addEventListener('click', handleLogin);

    // Enter 行為：帳號 Enter → 跳到密碼；密碼 Enter → 直接登入
    if (usernameInput) {
      usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (passwordInput) passwordInput.focus();
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLogin();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (!confirm('確定要登出嗎？')) return;
        clearAuth();
        clearHeaderUser();
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        showLogin();
      });
    }
  }

  async function boot() {
    bindUI();

    const urlParams = new URLSearchParams(window.location.search);
    const wantsDashboard = (urlParams.get('view') === 'dashboard');

    const sess = getAuth();
    if (sess && sess.canOffice === true) {
      showDashboard(sess);
      if (wantsDashboard) {
        // 已登入：保持在儀表板
      }
      return;
    }

    clearHeaderUser();
    showLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
