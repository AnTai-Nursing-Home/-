// 這個檔案會被所有需要連接資料庫的頁面共用
let db;       // Firestore 連線
let storage;  // Firebase Storage 連線（照會附件上傳/下載會用到）

/** 解析目前登入資訊（你原本存的 antai_session_user）
 *  兼容兩種格式：
 *  1) localStorage = JSON.stringify({staffId, displayName, ...})
 *  2) localStorage = JSON.stringify(JSON.stringify({staffId, displayName, ...}))  // 你之前貼的就是這種「雙層字串」
 */
function getSessionUser() {
  const parseMaybe = (raw) => {
    if (!raw) return null;
    let v = raw;

    // 第一次解析
    try { v = JSON.parse(v); } catch (_) {}

    // 若解析後仍是字串，代表是「雙層字串」，再解析一次
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch (_) {}
    }

    if (!v || typeof v !== 'object') return null;

    // 常見欄位：staffId / username / displayName / role / canNurse / canOffice
    const hasAnyKey = Object.keys(v).length > 0;
    if (!hasAnyKey) return null;

    // 粗略判定像不像使用者物件（避免誤抓到其它 JSON）
    const looksLikeUser =
      ('staffId' in v) ||
      ('displayName' in v) ||
      ('username' in v) ||
      ('role' in v) ||
      ('canNurse' in v) ||
      ('canOffice' in v);

    return looksLikeUser ? v : null;
  };

  try {
    // 1) 先看明確 key（你主要的兩種存法：sessionStorage / localStorage）
    const raw =
      sessionStorage.getItem('antai_session_user') ||
      localStorage.getItem('antai_session_user');

    const direct = parseMaybe(raw);
    if (direct) return direct;

    // 2) 掃描所有 storage key（有些頁面會用不同 key 存使用者）
    const scanStores = [sessionStorage, localStorage];
    for (const store of scanStores) {
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          const v = store.getItem(k);
          const obj = parseMaybe(v);
          if (obj) return obj;
        }
      } catch (_) {}
    }

    return null;
  } catch (_) {

    // 3) 兼容「分散存 key」的頁面（例如 office-maintenance.js 只存 empId/employeeName 之類）
    const pickFirst = (store, keys) => {
      for (const k of keys) {
        try {
          const v = store.getItem(k);
          if (v && String(v).trim()) return String(v).trim();
        } catch (_) {}
      }
      return '';
    };

    const idKeys = ['empId','employeeId','staffId','employeeNo','empNo','username'];
    const nameKeys = ['employeeName','displayName','name','staffName'];

    const empId =
      pickFirst(sessionStorage, idKeys) || pickFirst(localStorage, idKeys);
    const name =
      pickFirst(sessionStorage, nameKeys) || pickFirst(localStorage, nameKeys);

    if (empId || name) {
      const u = { staffId: empId || '', username: empId || '', displayName: name || '', name: name || '', source: 'legacy_keys' };
      // 同步到 sessionStorage，讓其它頁面/共用防護能一致判定（不動 localStorage，避免跨入口污染）
      try { sessionStorage.setItem('antai_session_user', JSON.stringify(u)); } catch (_) {}
      return u;
    }

    return null;

  }
}


function domSeemsLoggedIn() {
  try {
    // 有些頁面沒有把 session 存到 storage，但 UI 已經顯示登入者。
    // 我們用「登入者：xxx」且不是「未登入」當作保守判斷，避免誤鎖。
    const text = (document.body && document.body.innerText) ? document.body.innerText : '';
    if (!text) return false;
    if (text.includes('登入者') && !text.includes('未登入')) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function isLoggedIn() {
  const u = getSessionUser();
  if (u) return true;
  return domSeemsLoggedIn();
}

/** 判斷目前頁面屬於哪個入口（護理/辦公室/營養/照服…）；用來決定導向與是否需要強制登入 */
function inferPortal() {
  const p = (location.pathname || '').toLowerCase();

  // 入口/登入頁（依你目前站台檔名）
  if (p.endsWith('/admin.html') || p.includes('nurse')) return 'nurse';
  if (p.endsWith('/office.html') || p.includes('office')) return 'office';
  if (p.includes('/nutritionist/') || p.includes('nutritionist') || p.includes('nutrition')) return 'nutritionist';
  if (p.endsWith('/caregiver.html') || p.includes('caregiver')) return 'caregiver';

  // 事務系統入口（屬於辦公室體系）
  if (p.endsWith('/affairs.html') || p.includes('affairs')) return 'office';

  return null;
}

/** 這些頁面允許未登入也可使用（例如主選單/登入頁） */
function isPublicPage() {
  const p = (location.pathname || '').toLowerCase();

  // 主選單
  if (p === '/' || p.endsWith('/index.html') || p.endsWith('/home.html')) return true;

  // 各入口登入頁（這些頁面本來就允許未登入）
  if (p.endsWith('/admin.html')) return true;          // 護理師登入
  if (p.endsWith('/office.html')) return true;         // 辦公室登入
  if (p.endsWith('/caregiver.html')) return true;      // 照服員登入
  if (p.endsWith('/affairs.html')) return true;        // 事務系統入口（含營養師入口卡片）
  if (p.includes('/nutritionist/') && p.endsWith('nutritionist.html')) return true; // 營養師登入

  // 其他通用登入頁（若你有）
  if (p.endsWith('/login.html')) return true;

  return false;
}

/** 是否要在此頁面啟用「未登入鎖定 + 禁止寫入」 */
function isLegacyUnprotectedPage() {
  // ✅ 若你有「尚未導入登入」但仍需可操作的舊系統，把路徑（檔名）加在這裡
  // 例：if (p.endsWith('/some-legacy.html')) return true;
  const p = (location.pathname || '').toLowerCase();
  // 目前先不放任何舊系統白名單：預設所有非入口頁都必須登入
  return false;
}

/** 是否要在此頁面啟用「未登入鎖定 + 禁止寫入」 */
function shouldEnforceLoginGuard() {
  if (isPublicPage()) return false;
  if (isLegacyUnprotectedPage()) return false;
  // ✅ 預設：所有非入口頁都啟用（避免「複製網址開新分頁仍可操作」的漏洞）
  return true;
}

/** 依入口回推正確的儀表板與登入頁（集中在這裡改一次就好） */
function getPortalLinks() {
  const portal = inferPortal();
  const dashboards = {
    nurse: 'admin.html',
    office: 'office.html',
    // 營養師「返回儀表板」建議回事務系統入口（你的營養師登入頁本來就有「返回事務系統」）
    nutritionist: 'affairs.html',
    caregiver: 'caregiver.html'
  };
  const logins = {
    nurse: 'admin.html',
    office: 'office.html',
    nutritionist: 'nutritionist/nutritionist.html',
    caregiver: 'caregiver.html'
  };

  return {
    portal,
    dashboardUrl: dashboards[portal] || 'index.html',
    loginUrl: logins[portal] || 'index.html'
  };
}

/** 未登入時：鎖住 UI（仍保留 <a> 連結可返回儀表板/登入） */
function lockUIIfNotLoggedIn() {
  if (!shouldEnforceLoginGuard()) return;
  if (isLoggedIn()) return;

  // 1) 覆蓋式提示（不阻擋你返回/登入的 <a> 連結）
  if (!document.getElementById('antaiSecurityOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'antaiSecurityOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.zIndex = '9999';
    overlay.style.padding = '10px 12px';
    overlay.style.background = '#fff3cd';
    overlay.style.borderBottom = '1px solid rgba(0,0,0,.15)';
    overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "PingFang TC", "Microsoft JhengHei", sans-serif';
    const { dashboardUrl, loginUrl } = getPortalLinks();
    overlay.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
        <div style="font-weight:700;">⚠️ 未登入：此頁面已鎖定（禁止操作 / 禁止寫入）。</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <a href="${dashboardUrl}" style="text-decoration:none; padding:6px 10px; border-radius:8px; background:#0d6efd; color:#fff;">返回儀表板</a>
          <a href="${loginUrl}" style="text-decoration:none; padding:6px 10px; border-radius:8px; background:#6c757d; color:#fff;">重新登入</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // 避免遮住原本內容
    document.body.style.paddingTop = '52px';
  }

  // 2) 禁用所有表單控制項與按鈕（保留 a 連結可點）
  const disableAll = () => {
    const nodes = document.querySelectorAll('input, select, textarea, button');
    nodes.forEach(el => {
      // 若你有某些按鈕要在未登入也能使用，可加 data-no-lock="1"
      if (el.getAttribute('data-no-lock') === '1') return;
      el.disabled = true;
      el.setAttribute('aria-disabled', 'true');
      el.classList.add('antai-locked');
    });
  };

  // 初次鎖
  disableAll();

  // 避免動態插入的控制項繞過：監聽 DOM 變更再鎖一次（很輕量）
  if (!window.__antai_lock_observer) {
    const obs = new MutationObserver(() => disableAll());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window.__antai_lock_observer = obs;
  }

  // 3) 防止表單送出（即便 disabled 也再保險）
  if (!window.__antai_block_submit) {
    window.__antai_block_submit = true;
    document.addEventListener('submit', (e) => {
      if (isLoggedIn()) return;
      e.preventDefault();
      e.stopPropagation();
      alert('未登入：禁止送出/寫入。請從儀表板重新進入或登入。');
    }, true);
  }
}

/** 未登入時：阻擋 Firestore/Storage 寫入（最後一道前端防線） */
function installWriteGuardsIfNotLoggedIn() {
  if (!shouldEnforceLoginGuard()) return;
  if (isLoggedIn()) return;
  if (window.__antai_write_guards_installed) return;
  window.__antai_write_guards_installed = true;

  const deny = (op) => {
    const err = new Error('未登入：禁止執行寫入操作（' + op + '）。');
    err.code = 'antai/not-authenticated';
    throw err;
  };

  // Firestore: Collection.add / Doc.set/update/delete
  try {
    const fs = firebase?.firestore;
    if (fs) {
      const DocRefProto = fs.DocumentReference && fs.DocumentReference.prototype;
      const ColRefProto = fs.CollectionReference && fs.CollectionReference.prototype;
      const BatchProto = fs.WriteBatch && fs.WriteBatch.prototype;
      const TxProto = fs.Transaction && fs.Transaction.prototype;
      const FirestoreProto = fs.Firestore && fs.Firestore.prototype;

      if (ColRefProto && !ColRefProto.__antai_patched_add) {
        const origAdd = ColRefProto.add;
        ColRefProto.add = function(...args) { deny('collection.add'); };
        ColRefProto.__antai_patched_add = true;
        ColRefProto.__antai_orig_add = origAdd;
      }

      if (DocRefProto) {
        ['set','update','delete'].forEach((m) => {
          const key = '__antai_patched_' + m;
          if (DocRefProto[m] && !DocRefProto[key]) {
            const orig = DocRefProto[m];
            DocRefProto[m] = function(...args) { deny('doc.' + m); };
            DocRefProto[key] = true;
            DocRefProto['__antai_orig_' + m] = orig;
          }
        });
      }

      if (BatchProto && !BatchProto.__antai_patched_commit) {
        const origCommit = BatchProto.commit;
        BatchProto.commit = function(...args) { deny('batch.commit'); };
        BatchProto.__antai_patched_commit = true;
        BatchProto.__antai_orig_commit = origCommit;
      }

      if (TxProto) {
        ['set','update','delete'].forEach((m) => {
          const key = '__antai_patched_tx_' + m;
          if (TxProto[m] && !TxProto[key]) {
            const orig = TxProto[m];
            TxProto[m] = function(...args) { deny('transaction.' + m); };
            TxProto[key] = true;
            TxProto['__antai_orig_tx_' + m] = orig;
          }
        });
      }

      if (FirestoreProto && FirestoreProto.runTransaction && !FirestoreProto.__antai_patched_runTransaction) {
        const origRT = FirestoreProto.runTransaction;
        FirestoreProto.runTransaction = function(...args) { deny('firestore.runTransaction'); };
        FirestoreProto.__antai_patched_runTransaction = true;
        FirestoreProto.__antai_orig_runTransaction = origRT;
      }
    }
  } catch (e) {
    console.warn('installWriteGuardsIfNotLoggedIn (firestore) failed:', e);
  }

  // Storage: ref.put / ref.putString / ref.delete
  try {
    const st = firebase?.storage;
    if (st) {
      const RefProto = st.Reference && st.Reference.prototype;
      if (RefProto) {
        ['put','putString','delete'].forEach((m) => {
          const key = '__antai_patched_st_' + m;
          if (RefProto[m] && !RefProto[key]) {
            const orig = RefProto[m];
            RefProto[m] = function(...args) { deny('storage.' + m); };
            RefProto[key] = true;
            RefProto['__antai_orig_st_' + m] = orig;
          }
        });
      }
    }
  } catch (e) {
    console.warn('installWriteGuardsIfNotLoggedIn (storage) failed:', e);
  }
}

/** 統一套用安全護欄（先鎖 UI，再裝寫入守門） */
function applySecurityGuards() {
  // 等 DOM 有了再鎖 UI（但我們也會先試一次）
  try { lockUIIfNotLoggedIn(); } catch (_) {}
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { lockUIIfNotLoggedIn(); } catch (_) {}
    });
  }
  try { installWriteGuardsIfNotLoggedIn(); } catch (_) {}
}

async function initializeFirebase() {
  try {
    // 1. 從後端 API 安全地取得 Firebase 設定
    const response = await fetch('/api/get-firebase-config');
    if (!response.ok) throw new Error('無法取得 Firebase 設定');
    const firebaseConfig = await response.json();

    // 2. 初始化 Firebase App（避免重複初始化）
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // 3. 取得 Firestore
    db = firebase.firestore();
    window.db = db;

    // 4. 取得 Storage（需要有載入 firebase-storage-compat.js）
    storage = firebase.storage();
    window.storage = storage;

    // ✅ 5. 套用安全護欄（未登入就鎖 UI + 阻擋寫入）
    applySecurityGuards();

    // 6. 通知其他系統 Firebase 已就緒
    document.dispatchEvent(new Event('firebase-ready'));
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
    alert("錯誤：無法連接到雲端資料庫/Storage，請聯繫管理員。");
  }
}

// ✅ 保留你原本的保險邏輯：若已初始化成功（window.db 已存在），就直接發出 firebase-ready
if (window.db) {
  // ✅ 既然已有 db，仍要補上安全護欄（避免某些頁面繞過）
  applySecurityGuards();
  document.dispatchEvent(new Event("firebase-ready"));
} else {
  // 否則執行初始化
  initializeFirebase();
}
