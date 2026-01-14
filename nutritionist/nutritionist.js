// nutritionist-auth.js
// 營養師系統：不改版面樣式，使用瀏覽器 prompt 做帳密登入
// 權限來源：Firestore userAccounts/{staffId}
// 放行條件：canNutritionist===true 或 canOffice===true（辦公室備援）
//
// 小技巧：若想強制重新輸入帳密，在網址加上 ?logout=1

(function () {
  const AUTH_KEY = 'nutritionistAuth';
  const FALLBACK_REDIRECT = '../affairs.html?view=dashboard';

  function getAuth() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function setAuth(obj) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(obj));
  }
  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  async function waitForDbReady() {
    // 你專案的 firebase-init.js 會 dispatch 'firebase-ready'
    if (typeof db !== 'undefined' && db) return true;

    return await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; resolve(v); };

      document.addEventListener('firebase-ready', () => finish(true), { once: true });

      // 退一步：最多等 2 秒，避免卡死
      setTimeout(() => finish(typeof db !== 'undefined' && !!db), 2000);
    });
  }

  async function promptLogin() {
    const username = (window.prompt('請輸入帳號') || '').trim();
    if (!username) return null;

    const password = (window.prompt('請輸入密碼') || '').trim();
    if (!password) return null;

    return { username, password };
  }

  async function findAccountByUsername(username) {
    // userAccounts 文件 id 通常是 staffId，所以用 where 查 username
    try {
      const snap = await db.collection('userAccounts').where('username', '==', username).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { staffId: doc.id, ...(doc.data() || {}) };
    } catch (e) {
      console.error('查詢帳號失敗:', e);
      return null;
    }
  }

  function hasNutritionistAccess(acc) {
    return (acc && (acc.canNutritionist === true || acc.canOffice === true));
  }

  async function ensureLogin() {
    // 強制登出模式（不改 UI）
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('logout') === '1') clearAuth();

    // 已登入就直接放行（避免每次都跳 prompt）
    const existing = getAuth();
    if (existing && (existing.canNutritionist === true || existing.canOffice === true)) {
      return existing;
    }

    // 等 Firebase 初始化
    const ok = await waitForDbReady();
    if (!ok) {
      alert('系統初始化失敗（Firebase 尚未就緒），請重新整理頁面。');
      return null;
    }

    // 要求輸入帳密（prompt 不影響版面）
    const cred = await promptLogin();
    if (!cred) {
      // 使用者取消
      window.location.href = FALLBACK_REDIRECT;
      return null;
    }

    const acc = await findAccountByUsername(cred.username);
    if (!acc) {
      alert('帳號不存在或尚未建立。');
      window.location.href = FALLBACK_REDIRECT;
      return null;
    }

    if ((acc.password || '') !== cred.password) {
      alert('密碼錯誤。');
      window.location.href = FALLBACK_REDIRECT;
      return null;
    }

    if (!hasNutritionistAccess(acc)) {
      alert('此帳號沒有營養師系統權限。');
      window.location.href = FALLBACK_REDIRECT;
      return null;
    }

    const auth = {
      staffId: acc.staffId || acc.staffId === '' ? acc.staffId : (acc.staffId || ''),
      displayName: acc.displayName || acc.fullName || acc.name || cred.username,
      username: acc.username || cred.username,
      source: acc.source || '',
      canNutritionist: acc.canNutritionist === true,
      canOffice: acc.canOffice === true,
      loginAt: Date.now()
    };

    setAuth(auth);
    return auth;
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureLogin();
  });
})();
