// 這個檔案會被所有需要連接資料庫的頁面共用
let db;       // Firestore 連線
let storage;  // Firebase Storage 連線（照會附件上傳/下載會用到）

async function initializeFirebase() {
  try {
    // 1. 從我們的後端 API 安全地取得 Firebase 設定金鑰
    const response = await fetch('/api/get-firebase-config');
    if (!response.ok) {
      throw new Error('無法取得 Firebase 設定');
    }
    const firebaseConfig = await response.json();

    // 2. 初始化 Firebase App（避免重複初始化）
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // 3. 取得 Firestore 資料庫的連線
    db = firebase.firestore();
    window.db = db; // ✅ 讓其他系統可用 window.db

    // 4. ✅ 初始化 Firebase Storage（需要有載入 firebase-storage-compat.js）
    // 若未載入 Storage SDK，這裡會丟錯，會進 catch 提示你補上 SDK
    storage = firebase.storage();
    window.storage = storage;

    // 5. 觸發一個自訂事件，通知其他 JS 檔案「Firebase 已準備就緒」
    document.dispatchEvent(new Event('firebase-ready'));
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);

    // 常見：未載入 firebase-storage-compat.js 會出現 firebase.storage is not a function
    // 你可以在 HTML 加上：
    // <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
    alert("錯誤：無法連接到雲端資料庫/Storage，請聯繫管理員。");
  }
}

// 執行初始化
initializeFirebase();
