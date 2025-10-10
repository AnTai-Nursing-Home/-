// 這是一個後端 Serverless Function，它會安全地在 Vercel 伺服器上運行
export default function handler(request, response) {
  // 只接受 POST 方法的請求
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '僅允許 POST 方法' });
  }

  // 從 Vercel 的環境變數中讀取我們安全儲存的真實密碼
  const correctPassword = process.env.ADMIN_PASSWORD;

  // 從前端送來的請求中讀取使用者輸入的密碼
  const submittedPassword = request.body.password;

  // 進行比對
  if (submittedPassword === correctPassword) {
    // 密碼正確，回傳成功訊息
    response.status(200).json({ success: true, message: '驗證成功' });
  } else {
    // 密碼錯誤，回傳失敗訊息
    response.status(401).json({ success: false, message: '密碼錯誤' });
  }
}
