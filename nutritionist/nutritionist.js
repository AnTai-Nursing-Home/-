// nutritionist-auth.js - 營養師系統個人帳號密碼登入（參考 office.js）
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件
(function () {
  const AUTH_KEY = 'nutritionistAuth';

  const loginSection = document.getElementById('login-section-nutritionist');
  const dashboardSection = document.getElementById('dashboard-section-nutritionist');

  if (!loginSection || !dashboardSection) return;

  const usernameInput = document.getElementById('usernameInput-nutritionist');
  const passwordInput = document.getElementById('passwordInput-nutritionist');
  const loginButton = document.getElementById('loginButton-nutritionist');
  const errorMessage = document.getElementById('errorMessage-nutritionist');
  const privacyCheck = document.getElementById('privacyCheck-nutritionist');

  const headerLoginBox = document.getElementById('loginInfoNutritionist');
  const headerStaffId = document.getElementById('loginStaffId-nutritionist');
  const headerStaffName = document.getElementById('loginStaffName-nutritionist');
  const logoutBtn = document.getElementById('logoutBtnNutritionist');

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

  function hasNutritionistPermission(acc) {
    // ✅ 兼容多種欄位命名（你之後可以在 userAccounts 加 canNutritionist）
    if (acc?.canNutritionist === true) return true;
    if (acc?.role === 'nutritionist') return true;
    if (acc?.canOffice === true) return true;   // 若你希望只有辦公室可進，保留這行即可
    if (acc?.canNurse === true) return true;    // 若護理師也需要進營養師系統，保留這行
    return false;
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

      if (!hasNutritionistPermission(acc)) { showError('此帳號沒有營養師系統權限'); return; }
      if ((acc.password || '') !== password) { showError('帳號或密碼錯誤，請重試！'); return; }

      const user = {
        staffId: acc.staffId || acc.id || acc.username || '',
        displayName: acc.displayName || acc.name || '',
        username: acc.username || '',
        source: acc.source || '',
        canOffice: acc.canOffice === true,
        canNurse: acc.canNurse === true,
        canNutritionist: acc.canNutritionist === true,
        role: 'nutritionist',
        loginAt: Date.now()
      };

      setAuth(user);
      showDashboard(user);
    } catch (e) {
      console.error('營養師登入錯誤：', e);
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
    if (sess && (sess.canNutritionist === true || sess.canOffice === true || sess.canNurse === true || sess.role === 'nutritionist')) {
      showDashboard(sess);
      return;
    }

    showLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
