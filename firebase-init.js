// 這個檔案會被所有需要連接資料庫的頁面共用
let db;       // Firestore 連線
let storage;  // Firebase Storage 連線（照會附件上傳/下載會用到）

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

    // 5. 通知其他系統 Firebase 已就緒
    document.dispatchEvent(new Event('firebase-ready'));
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
    alert("錯誤：無法連接到雲端資料庫/Storage，請聯繫管理員。");
  }
}

// ✅ 保留你原本的保險邏輯：若已初始化成功（window.db 已存在），就直接發出 firebase-ready
if (window.db) {
  document.dispatchEvent(new Event("firebase-ready"));
} else {
  // 否則執行初始化
  initializeFirebase();
}
