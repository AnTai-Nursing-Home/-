// 這個檔案會被所有需要連接資料庫的頁面共用
let db; // 宣告一個全域變數，用來存放資料庫的連線

async function initializeFirebase() {
    try {
        // 1. 從我們的後端 API 安全地取得 Firebase 設定金鑰
        const response = await fetch('/api/get-firebase-config');
        if (!response.ok) {
            throw new Error('無法取得 Firebase 設定');
        }
        const firebaseConfig = await response.json();

        // 2. 初始化 Firebase App
        firebase.initializeApp(firebaseConfig);

        // 3. 取得 Firestore 資料庫的連線，並存到 db 變數中
        db = firebase.firestore();
        
        // 觸發一個自訂事件，通知其他 JS 檔案「資料庫已準備就緒」
        document.dispatchEvent(new Event('firebase-ready'));

    } catch (error) {
        console.error("Firebase 初始化失敗:", error);
        alert("錯誤：無法連接到雲端資料庫，請聯繫管理員。");
    }
}

// 執行初始化
initializeFirebase();
