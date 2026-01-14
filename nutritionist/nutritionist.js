// nutritionist-auth.js
// 使用 userAccounts/{staffId} 進行登入，並檢查 canNutritionist 權限（或 canOffice 可作為管理者備援）。
(function () {
  const AUTH_KEY = 'nutritionistAuth';

  const elLogin = document.getElementById('login');
  const elApp = document.getElementById('app');
  const elU = document.getElementById('loginUsername');
  const elP = document.getElementById('loginPassword');
  const elBtn = document.getElementById('btnLogin');
  const elMsg = document.getElementById('loginMsg');

  const elAuthInfo = document.getElementById('authInfo');
  const elLogout = document.getElementById('btnLogout');

  function setMsg(s) { if (elMsg) elMsg.textContent = s || ''; }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function getAuth() {
    return safeJsonParse(sessionStorage.getItem(AUTH_KEY) || 'null');
  }

  function setAuth(auth) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth || null));
  }

  async function waitForDbReady() {
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }

  function showApp(auth) {
    if (elLogin) elLogin.style.display = 'none';
    if (elApp) elApp.style.display = '';
    if (elLogout) elLogout.style.display = '';
    if (elAuthInfo) {
      const name = auth?.displayName || auth?.name || auth?.staffId || '';
      const id = auth?.staffId || '';
      elAuthInfo.textContent = id && name ? `${id} ${name}` : (name || id || '已登入');
    }
  }

  function showLogin() {
    if (elApp) elApp.style.display = 'none';
    if (elLogin) elLogin.style.display = '';
    if (elLogout) elLogout.style.display = 'none';
    if (elAuthInfo) elAuthInfo.textContent = '';
  }

  async function doLogin() {
    const username = (elU?.value || '').trim();
    const password = (elP?.value || '').trim();

    if (!username || !password) {
      setMsg('請輸入帳號與密碼。');
      return;
    }

    elBtn.disabled = true;
    setMsg('登入中...');

    try {
      await waitForDbReady();

      // 從 userAccounts 以 username 查找（你原本設計是 staffId 為 docId，但 username 可能不同）
      // 這裡採用全表掃描 + 比對（資料量通常不大）；若你之後想優化可改成建立 username 索引集合。
      const snap = await db.collection('userAccounts').get();

      let found = null;
      snap.forEach(doc => {
        const d = doc.data() || {};
        if ((d.username || '').trim() === username) found = { id: doc.id, ...d };
      });

      if (!found) {
        setMsg('帳號不存在或輸入錯誤。');
        return;
      }
      if ((found.password || '').toString() !== password) {
        setMsg('密碼錯誤。');
        return;
      }

      const allowed = (found.canNutritionist === true) || (found.canOffice === true);
      if (!allowed) {
        setMsg('此帳號沒有營養師系統權限，請洽管理員。');
        return;
      }

      const auth = {
        staffId: found.staffId || found.id || '',
        displayName: found.displayName || '',
        username: found.username || '',
        source: found.source || '',
        canNutritionist: !!found.canNutritionist,
        canOffice: !!found.canOffice,
        loginAt: Date.now()
      };

      setAuth(auth);
      showApp(auth);
      setMsg('');
    } catch (e) {
      console.error(e);
      setMsg('登入失敗，請稍後再試。');
    } finally {
      elBtn.disabled = false;
    }
  }

  function bind() {
    if (elBtn) elBtn.addEventListener('click', doLogin);
    if (elP) elP.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
    if (elU) elU.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });

    if (elLogout) {
      elLogout.addEventListener('click', () => {
        if (!confirm('確定要登出嗎？')) return;
        sessionStorage.removeItem(AUTH_KEY);
        showLogin();
        if (elU) elU.value = '';
        if (elP) elP.value = '';
        setMsg('');
      });
    }
  }

  (async function boot() {
    bind();
    await waitForDbReady();

    const auth = getAuth();
    if (auth) {
      // 重新整理後維持登入
      showApp(auth);
    } else {
      showLogin();
    }
  })();
})();
