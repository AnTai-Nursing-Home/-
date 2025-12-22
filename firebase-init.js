// 這個檔案會被所有需要連接資料庫的頁面共用
let db;
let storage;

async function initializeFirebase() {
  try {
    // 1. 從後端 API 取得 Firebase 設定
    const response = await fetch('/api/get-firebase-config');
    if (!response.ok) {
      throw new Error('無法取得 Firebase 設定');
    }
    const firebaseConfig = await response.json();

    // 2. 初始化 Firebase App（避免重複初始化）
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // 3. 初始化 Firestore
    db = firebase.firestore();
    window.db = db;

    // 4. ✅ 初始化 Firebase Storage（關鍵）
    storage = firebase.storage();
    window.storage = storage;

    // 5. 通知其他系統 Firebase 已就緒
    document.dispatchEvent(new Event('firebase-ready'));

  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
    alert("錯誤：無法連接到雲端資料庫，請聯繫管理員。");
  }
}

initializeFirebase();
