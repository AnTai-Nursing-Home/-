// caregiver.js - 照服員端登入（改為個人帳號密碼）
// 參考護理師端 admin.js：使用 Firestore 的 userAccounts、共用 sessionStorage 的 antai_session_user
// 依賴 firebase-init.js 提供 db 與 firebase-ready 事件
(function () {
  const SESSION_KEY = 'antai_session_user'; // 與護理師/辦公室端共用

  function qs(id) { return document.getElementById(id); }
  function setVisible(el, visible) { if (el) el.classList.toggle('d-none', !visible); }

  function showError(msg) {
    const el = qs('errorMessageCaregiver');
    if (!el) return;
    el.textContent = msg || '帳號或密碼錯誤，請重試！';
    el.classList.remove('d-none');
  }
  function hideError() { const el = qs('errorMessageCaregiver'); if (el) el.classList.add('d-none'); }

  function saveSession(user) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (e) {} }
  function loadSession() { try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function renderLoginInfo(user) {
    qs('loginStaffId').textContent = user?.staffId || '';
    qs('loginStaffName').textContent = user?.displayName || '';
    setVisible(qs('loginInfoCaregiver'), true);
  }
  function hideLoginInfo() {
    setVisible(qs('loginInfoCaregiver'), false);
    if (qs('loginStaffId')) qs('loginStaffId').textContent = '';
    if (qs('loginStaffName')) qs('loginStaffName').textContent = '';
  }

  function showDashboard() {
    setVisible(qs('password-section-caregiver'), false);
    setVisible(qs('dashboard-section-caregiver'), true);
  }
  function showLogin() {
    setVisible(qs('dashboard-section-caregiver'), false);
    setVisible(qs('password-section-caregiver'), true);
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

  function hasCaregiverPermission(acc) {
    // 兼容舊欄位命名：canCaregiver / canCare / role / source
    if (acc?.canCaregiver === true) return true;
    if (acc?.canCare === true) return true;
    if ((acc?.role || '') === 'caregiver') return true;
    if ((acc?.source || '') === 'caregivers') return true;
    return false;
  }

  async function handleLogin() {
    const privacyCheck = qs('privacyCheckCaregiver');
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

    const btn = qs('loginButtonCaregiver');
    if (btn) btn.disabled = true;
    hideError();

    try {
      const acc = await findAccountByUsername(username);
      if (!acc) { showError('帳號或密碼錯誤，請重試！'); return; }

      if (!hasCaregiverPermission(acc)) { showError('此帳號沒有照服員系統權限'); return; }
      if ((acc.password || '') !== password) { showError('帳號或密碼錯誤，請重試！'); return; }

      const user = {
        staffId: acc.staffId || acc.id || acc.username || '',
        displayName: acc.displayName || acc.name || '',
        username: acc.username || '',
        source: acc.source || '',
        canOffice: acc.canOffice === true,
        canNurse: acc.canNurse === true,
        canCaregiver: acc.canCaregiver === true || acc.canCare === true || (acc.role === 'caregiver'),
        role: 'caregiver',
        loginAt: Date.now()
      };

      saveSession(user);
      renderLoginInfo(user);
      showDashboard();
    } catch (e) {
      console.error('照服員登入錯誤：', e);
      showError('登入時發生錯誤，請稍後再試');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindUI() {
    const loginBtn = qs('loginButtonCaregiver');
    const u = qs('usernameInput');
    const p = qs('passwordInput');

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    if (u) u.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (p) p.focus();
      }
    });

    if (p) p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });

    const logoutBtn = qs('logoutBtnCaregiver');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (!confirm('確定要登出嗎？')) return;

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
    // 若同一個 session 也能進照服員，允許直接進入（兼容 canCaregiver / role）
    if (sess && (sess.canCaregiver === true || sess.role === 'caregiver' || sess.source === 'caregivers')) {
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
