// 這個後端函式只用來驗證預假系統的管理員密碼
export default function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '僅允許 POST 方法' });
  }

  // 從 Vercel 的環境變數中讀取我們安全儲存的預假管理員密碼
  const correctPassword = process.env.LEAVE_ADMIN_PASSWORD;

  // 從前端送來的請求中讀取使用者輸入的密碼
  const submittedPassword = request.body.password;

  // 進行比對
  if (submittedPassword === correctPassword) {
    response.status(200).json({ success: true, message: '驗證成功' });
  } else {
    response.status(401).json({ success: false, message: '密碼錯誤' });
  }
}
