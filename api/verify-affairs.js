export default function handler(req, res) {
  // 允許 POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { password } = req.body || {};
  const correct = process.env.AFFAIRS_PASSWORD;

  if (!correct) {
    // 沒設定環境變數會走到這裡
    return res.status(500).json({ success: false, message: "AFFAIRS_PASSWORD not set" });
  }

  if (password === correct) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false });
}
