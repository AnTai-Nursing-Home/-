// 檔案路徑: api/office-login.js
export default function handler(request, response) {
  // 從 Vercel 的環境變數中讀取正確的密碼
  const correctPassword = process.env.OFFICE_PASSWORD;
  
  // 取得使用者從前端傳來的密碼
  const { password } = request.body;

  // 檢查環境變數是否存在
  if (!correctPassword) {
    // 如果伺服器沒有設定密碼，回傳 500 伺服器設定錯誤
    return response.status(500).json({ error: 'Server configuration error' });
  }

  // 比對密碼
  if (password === correctPassword) {
    // 密碼正確，回傳 200 成功狀態
    response.status(200).json({ message: 'Login successful' });
  } else {
    // 密碼錯誤，回傳 401 未授權狀態
    response.status(401).json({ error: 'Invalid password' });
  }
}
