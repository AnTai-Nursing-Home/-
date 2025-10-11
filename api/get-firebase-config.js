// 檔案路徑: api/get-firebase-config.js
export default function handler(request, response) {
  const config = {
    apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.PUBLIC_FIREBASE_APP_ID,
  };

  // 檢查是否有任何一個環境變數是空的
  if (Object.values(config).some(value => !value)) {
    console.error("Firebase 環境變數未完全設定！");
    return response.status(500).json({ error: "伺服器設定不完整。" });
  }

  response.status(200).json(config);
}
