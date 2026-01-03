// admin.js - 護理師端登入（改為個人帳號密碼）
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件
(function () {
  const SESSION_KEY = 'antai_session_user'; // 與辦公室端共用

  function qs(id) { return document.getElementById(id); }
  function setVisible(el, visible) { if (el) el.classList.toggle('d-none', !visible); }

  function showError(msg) {
    const el = qs('errorMessage');
    if (!el) return;
    el.textContent = msg || '帳號或密碼錯誤，請重試！';
    el.classList.remove('d-none');
  }
  function hideError() { const el = qs('errorMessage'); if (el) el.classList.add('d-none'); }

  function saveSession(user) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (e) {} }
  function loadSession() { try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function renderLoginInfo(user) {
    qs('loginStaffId').textContent = user?.staffId || '';
    qs('loginStaffName').textContent = user?.displayName || '';
    setVisible(qs('loginInfoNurse'), true);
  }
  function hideLoginInfo() {
    setVisible(qs('loginInfoNurse'), false);
    if (qs('loginStaffId')) qs('loginStaffId').textContent = '';
    if (qs('loginStaffName')) qs('loginStaffName').textContent = '';
  }

  function showDashboard() {
    setVisible(qs('password-section'), false);
    setVisible(qs('dashboard-section'), true);
  }
  function showLogin() {
    setVisible(qs('dashboard-section'), false);
    setVisible(qs('password-section'), true);
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
    const privacyCheck = qs('privacyCheck');
    if (privacyCheck && !privacyCheck.checked) {
      alert('請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》');
      return;
    }

    const username = (qs('usernameInput')?.value || '').trim();
    const password = (qs('passwordInput')?.value || '').trim();
    if (!username || !password) {
      showError('請輸入帳號與密碼');
      return;
    }

    const btn = qs('loginButton');
    if (btn) btn.disabled = true;
    hideError();

    try {
      const acc = await findAccountByUsername(username);
      if (!acc) { showError('帳號或密碼錯誤，請重試！'); return; }

      if (acc.canNurse !== true) { showError('此帳號沒有護理師系統權限'); return; }
      if ((acc.password || '') !== password) { showError('帳號或密碼錯誤，請重試！'); return; }

      const user = {
        staffId: acc.staffId || acc.id || acc.username || '',
        displayName: acc.displayName || acc.name || '',
        username: acc.username || '',
        source: acc.source || '',
        canOffice: acc.canOffice === true,
        canNurse: acc.canNurse === true,
        role: 'nurse',
        loginAt: Date.now()
      };

      saveSession(user);
      renderLoginInfo(user);
      showDashboard();
    } catch (e) {
      console.error('護理師登入錯誤：', e);
      showError('登入時發生錯誤，請稍後再試');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindUI() {
    const loginBtn = qs('loginButton');
    const u = qs('usernameInput');
    const p = qs('passwordInput');

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (u) u.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // 在帳號輸入框按 Enter：跳到密碼欄位
        if (p) p.focus();
      }
    });

    if (p) p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // 在密碼輸入框按 Enter：直接登入
        handleLogin();
      }
    });

});

    const logoutBtn = qs('logoutBtnNurse');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearSession();
        hideLoginInfo();
        if (qs('usernameInput')) qs('usernameInput').value = '';
        if (qs('passwordInput')) qs('passwordInput').value = '';
        showLogin();
      });
    }
  }

  document.addEventListener('firebase-ready', () => {
    bindUI();

    const sess = loadSession();
    if (sess && sess.canNurse === true) {
      renderLoginInfo(sess);
      showDashboard();
    } else {
      hideLoginInfo();
      showLogin();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    // 即使 firebase-ready 延遲，也先把按鈕事件掛好（登入真正查詢 db 仍需 firebase-ready）
    bindUI();
  });
})();
