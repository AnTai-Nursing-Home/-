// 這個後端函式只用來驗證照服員的登入密碼
export default function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '僅允許 POST 方法' });
  }
  const correctPassword = process.env.CAREGIVER_PASSWORD;
  const submittedPassword = request.body.password;
  if (submittedPassword === correctPassword) {
    response.status(200).json({ success: true, message: '驗證成功' });
  } else {
    response.status(401).json({ success: false, message: '密碼錯誤' });
  }
}
