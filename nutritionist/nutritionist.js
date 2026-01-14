// nutritionist-auth.js
// 營養師系統：不改版面樣式，使用瀏覽器 prompt 做帳密登入
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件（與辦公室系統一致）

(function () {
  const AUTH_KEY = 'nutritionistAuth';
  const FALLBACK_REDIRECT = '../affairs.html?view=dashboard';

  function getAuth() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function setAuth(obj) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(obj));
  }

  async function waitForDbReady() {
    if (typeof db !== 'undefined' && db) return;
    await new Promise((resolve) => {
      document.addEventListener('firebase-ready', () => resolve(), { once: true });
      setTimeout(resolve, 2500);
    });
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

  function hasNutritionistAccess(acc) {
    // 管控：可進營養師 或 可進辦公室（管理者備援）
    return acc?.canNutritionist === true || acc?.canOffice === true;
  }

  async function promptLogin() {
    const username = (prompt('營養師系統登入\n\n請輸入帳號：') || '').trim();
    if (!username) return null;

    const password = (prompt('請輸入密碼：') || '').trim();
    if (!password) return null;

    await waitForDbReady();
    const acc = await findAccountByUsername(username);

    if (!acc) {
      alert('查無此帳號，請確認後再試。');
      return null;
    }
    if ((acc.password || '') !== password) {
      alert('密碼錯誤，請再試一次。');
      return null;
    }
    if (!hasNutritionistAccess(acc)) {
      alert('此帳號沒有營養師系統權限。');
      return null;
    }

    const auth = {
      staffId: acc.staffId || acc.id || '',
      displayName: acc.displayName || acc.name || username,
      username: acc.username || username,
      source: acc.source || '',
      canNutritionist: acc.canNutritionist === true,
      canOffice: acc.canOffice === true,
      loginAt: Date.now()
    };
    setAuth(auth);
    return auth;
  }

  async function ensureLogin() {
    const existing = getAuth();
    if (existing && (existing.canNutritionist === true || existing.canOffice === true)) {
      return existing;
    }

    // 不改版面：先暫時把頁面隱藏，登入成功才顯示
    const prevDisplay = document.body.style.display;
    document.body.style.display = 'none';

    for (let i = 0; i < 3; i++) {
      const auth = await promptLogin();
      if (auth) {
        document.body.style.display = prevDisplay || '';
        return auth;
      }
    }

    // 失敗或取消 → 回到事務系統
    window.location.href = FALLBACK_REDIRECT;
    return null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 啟動登入檢查（不新增任何 UI 元件）
    ensureLogin();
  });
})();
