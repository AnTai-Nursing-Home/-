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

(function(){
  const AUTH_KEY = 'officeAuth';
  const passwordSection = document.getElementById('password-section-office');
  if (!passwordSection) return;

  const dashboardSection = document.getElementById('dashboard-section-office');
  const usernameInput = document.getElementById('usernameInput-office');
  const passwordInput = document.getElementById('passwordInput-office');
  const loginButton = document.getElementById('loginButton-office');
  const logoutButton = document.getElementById('logoutButton-office');
  const errorMessage = document.getElementById('errorMessage-office');
  const loginInfo = document.getElementById('loginInfo-office');
  const btnLogoutTop = document.getElementById('btnLogoutTop');
  const loginUserTopRight = document.getElementById('loginUserTopRight');

  function showLogin(){
    passwordSection.classList.remove('d-none');
    dashboardSection.classList.add('d-none');
    logoutButton.classList.add('d-none');
    errorMessage.classList.add('d-none');
    if (loginUserTopRight) loginUserTopRight.textContent = '';
  }

  function showDashboard(user){
    passwordSection.classList.add('d-none');
    dashboardSection.classList.remove('d-none');
    logoutButton.classList.remove('d-none');
    errorMessage.classList.add('d-none');
    if (loginInfo) {
      const name = user?.displayName || user?.username || '';
      const role = 'Office';
      loginInfo.textContent = `${name}（${role}）`;
    }
    if (loginUserTopRight) {
      const sid = user?.staffId ? String(user.staffId) : '';
      const nm = user?.displayName || user?.username || '';
      loginUserTopRight.textContent = sid && nm ? `${sid} ${nm}` : (nm || sid);
    }
  }

  function setAuth(user){
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch(e){}
  }
  function getAuth(){
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }
  function clearAuth(){
    try { sessionStorage.removeItem(AUTH_KEY); } catch(e){}
  }

  async function waitForDbReady(){
    // firebase-init.js 可能會晚於本檔初始化
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      // 若 firebase-ready 沒有 dispatch，最多等 2 秒後再試一次
      setTimeout(resolve, 2000);
    });
  }

  async function handleLogin(){
    // ✅ 未勾選不得登入
    const privacyCheck = document.getElementById('privacyCheck');
    if (privacyCheck && !privacyCheck.checked) {
      alert("請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》");
      return;
    }

    const username = (usernameInput?.value || '').trim();
    const password = (passwordInput?.value || '').trim();
    if (!username || !password) {
      alert('請輸入帳號與密碼');
      return;
    }

    loginButton.disabled = true;
    errorMessage.classList.add('d-none');

    try {
      await waitForDbReady();
      if (typeof db === 'undefined' || !db) throw new Error('Firestore 尚未初始化');

      // 以 username 查找（userAccounts 量通常不大，這樣最穩）
      const snap = await db.collection('userAccounts')
        .where('username', '==', username)
        .limit(1)
        .get();

      if (snap.empty) {
        errorMessage.classList.remove('d-none');
        return;
      }

      const doc = snap.docs[0];
      const u = doc.data() || {};

      // 密碼比對（明文）
      if ((u.password || '') !== password) {
        errorMessage.classList.remove('d-none');
        return;
      }

      // 權限：必須 canOffice=true 才能進入辦公室
      if (u.canOffice !== true) {
        errorMessage.classList.remove('d-none');
        return;
      }

      const user = {
        staffId: u.staffId || doc.id,
        username: u.username || username,
        displayName: u.displayName || u.name || u.username || username,
        canOffice: !!u.canOffice,
        canNurse: !!u.canNurse,
        source: u.source || '',
        loginAt: Date.now()
      };

      setAuth(user);
      showDashboard(user);
    } catch (err) {
      console.error('登入錯誤:', err);
      alert('登入時發生錯誤，請稍後再試。');
    } finally {
      loginButton.disabled = false;
    }
  }

  function handleLogout(){
    clearAuth();
    showLogin();
  }

  // --- 事件綁定 ---
  loginButton?.addEventListener('click', handleLogin);
  usernameInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });
  passwordInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });
  logoutButton?.addEventListener('click', handleLogout);
  btnLogoutTop?.addEventListener('click', handleLogout);

  // --- 自動登入 ---
  (function boot(){
    const urlParams = new URLSearchParams(window.location.search);
    const auth = getAuth();

    // 只有在 session 有登入且 canOffice=true 才自動進 dashboard
    if (auth && auth.canOffice === true) {
      showDashboard(auth);
      return;
    }

    // 如果有人手動輸入 ?view=dashboard，但沒有 session，就回登入頁
    if (urlParams.get('view') === 'dashboard') {
      showLogin();
      return;
    }

    showLogin();
  })();
})();
