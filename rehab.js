// rehab-auth.js - 復健師系統個人帳號密碼登入
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件
(function () {
  const AUTH_KEY = 'rehabAuth';

  const loginSection = document.getElementById('login-section-rehab');
  const dashboardSection = document.getElementById('dashboard-section-rehab');

  if (!loginSection || !dashboardSection) return;

  const usernameInput = document.getElementById('usernameInput-rehab');
  const passwordInput = document.getElementById('passwordInput-rehab');
  const loginButton = document.getElementById('loginButton-rehab');
  const errorMessage = document.getElementById('errorMessage-rehab');
  const privacyCheck = document.getElementById('privacyCheck-rehab');

  const headerLoginBox = document.getElementById('loginInfoRehab');
  const headerStaffId = document.getElementById('loginStaffId-rehab');
  const headerStaffName = document.getElementById('loginStaffName-rehab');
  const logoutBtn = document.getElementById('logoutBtnRehab');

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
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (_) {}
  }

  function getAuth() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearAuth() {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (_) {}
  }

  async function waitForDbReady() {
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }

  function renderHeaderUser(user) {
    if (!headerLoginBox) return;
    if (headerStaffId) headerStaffId.textContent = user?.staffId || '';
    if (headerStaffName) headerStaffName.textContent = user?.displayName || '';
    headerLoginBox.classList.remove('d-none');
  }

  function clearHeaderUser() {
    if (headerLoginBox) headerLoginBox.classList.add('d-none');
    if (headerStaffId) headerStaffId.textContent = '';
    if (headerStaffName) headerStaffName.textContent = '';
  }

  function showLogin() {
    setVisible(loginSection, true);
    setVisible(dashboardSection, false);
    hideError();
    clearHeaderUser();
  }

  function showDashboard(user) {
    setVisible(loginSection, false);
    setVisible(dashboardSection, true);
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

  function hasRehabPermission(acc) {
    return acc?.canRehab === true
      || acc?.canRehabilitation === true
      || acc?.canTherapist === true
      || acc?.canRehabTherapist === true
      || acc?.canOffice === true;
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
      if (!hasRehabPermission(acc)) { showError('此帳號沒有復健師系統權限'); return; }
      if ((acc.password || '') !== password) { showError('帳號或密碼錯誤，請重試！'); return; }

      const user = {
        staffId: acc.staffId || acc.id || acc.username || '',
        displayName: acc.displayName || acc.name || '',
        username: acc.username || '',
        source: acc.source || '',
        canOffice: acc.canOffice === true,
        canRehab: acc.canRehab === true || acc.canRehabilitation === true || acc.canTherapist === true || acc.canRehabTherapist === true,
        role: 'rehab',
        loginAt: Date.now()
      };

      setAuth(user);
      showDashboard(user);
    } catch (e) {
      console.error('復健師登入錯誤：', e);
      showError('登入時發生錯誤，請稍後再試');
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  }

  function bindUI() {
    if (loginButton) loginButton.addEventListener('click', handleLogin);

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
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        showLogin();
      });
    }
  }

  function boot() {
    bindUI();

    const sess = getAuth();
    if (sess && (sess.canRehab === true || sess.canOffice === true)) {
      showDashboard(sess);
      return;
    }

    showLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
