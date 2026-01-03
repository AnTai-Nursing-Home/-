// office.js - 辦公室端登入（個人帳號密碼版）
// 依 Firestore 集合 userAccounts 驗證帳號/密碼與權限（canOffice=true）
//
// userAccounts/{staffId} 建議欄位：
// - username: string
// - password: string   (⚠️ 明文；若你之後要更安全可改成 hash)
// - displayName: string
// - staffId: string
// - source: 'adminStaff'|'caregivers'|'localCaregivers'|'nurses'
// - canOffice: boolean
// - canNurse: boolean
// - updatedAt, createdAt: serverTimestamp()

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

  // Header login info (右上角)
  const loginInfoOffice = document.getElementById('loginInfoOffice');
  const loginStaffIdEl = document.getElementById('loginStaffId');
  const loginStaffNameEl = document.getElementById('loginStaffName');
  const logoutBtnOffice = document.getElementById('logoutBtnOffice');

  function setAuth(user) {
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (e) {}
  }
  function getAuth() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearAuth() {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
  }

  function showLogin() {
    passwordSection.classList.remove('d-none');
    dashboardSection.classList.add('d-none');

    // header 右上角資訊隱藏
    if (loginInfoOffice) loginInfoOffice.classList.add('d-none');

    // 清空欄位/狀態
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    errorMessage?.classList.add('d-none');

    // 恢復登入按鈕
    if (loginButton) loginButton.disabled = false;
  }

  function showDashboard(user) {
    passwordSection.classList.add('d-none');
    dashboardSection.classList.remove('d-none');

    // 顯示右上角登入資訊
    if (loginInfoOffice) loginInfoOffice.classList.remove('d-none');
    if (loginStaffIdEl) loginStaffIdEl.textContent = (user?.staffId || user?.username || '');
    if (loginStaffNameEl) loginStaffNameEl.textContent = (user?.displayName || user?.name || '');
  }

  async function findAccountByUsername(username) {
    // db 由 firebase-init.js 提供
    if (typeof db === 'undefined' || !db?.collection) {
      throw new Error('Firebase 尚未初始化（db 不存在）');
    }

    // username 建索引前：用 where 查詢（建議你之後在 Firebase Console 建 composite index）
    const snap = await db.collection('userAccounts')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() || {}) };
  }

  async function handleLogin() {
    // ✅ 未勾選不得登入
    if (privacyCheck && !privacyCheck.checked) {
      alert('請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》');
      return;
    }

    const username = (usernameInput?.value || '').trim();
    const password = (passwordInput?.value || '').trim();

    if (!username || !password) {
      alert('請輸入帳號與密碼');
      return;
    }

    loginButton && (loginButton.disabled = true);
    errorMessage?.classList.add('d-none');

    try {
      const account = await findAccountByUsername(username);
      if (!account) {
        errorMessage && (errorMessage.textContent = '查無此帳號，請洽辦公室建立帳號');
        errorMessage?.classList.remove('d-none');
        return;
      }

      // 密碼比對（目前為明文）
      if ((account.password || '') !== password) {
        errorMessage && (errorMessage.textContent = '帳號或密碼錯誤，請重試！');
        errorMessage?.classList.remove('d-none');
        return;
      }

      // 權限檢查
      if (account.canOffice !== true) {
        errorMessage && (errorMessage.textContent = '此帳號未授權進入辦公室系統');
        errorMessage?.classList.remove('d-none');
        return;
      }

      // 存 session
      const user = {
        staffId: account.staffId || account.id || '',
        displayName: account.displayName || '',
        username: account.username || '',
        canOffice: account.canOffice === true,
        canNurse: account.canNurse === true,
        source: account.source || '',
      };

      setAuth(user);
      showDashboard(user);
    } catch (err) {
      console.error('office login error:', err);
      alert(err?.message || '登入失敗，請稍後再試');
    } finally {
      loginButton && (loginButton.disabled = false);
    }
  }

  function handleLogout() {
    if (!confirm('確定要登出嗎？')) return;
    clearAuth();
    showLogin();
  }

  // --- 綁定事件 ---
  loginButton?.addEventListener('click', handleLogin);
  usernameInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });
  passwordInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });
  logoutBtnOffice?.addEventListener('click', handleLogout);

  // --- 自動登入 ---
  (function boot() {
    const auth = getAuth();
    if (auth && auth.canOffice === true) {
      showDashboard(auth);
    } else {
      showLogin();
    }
  })();
})();
