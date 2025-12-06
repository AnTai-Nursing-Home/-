document.addEventListener("firebase-ready", async () => {
  const marquee = document.getElementById("marquee-text");
  const container = document.getElementById("announcement-marquee");
  if (!marquee || !container) return;

  try {
    const snap = await db.collection("announcements")
      .where("isMarquee", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      container.style.display = "none";
      return;
    }

    const data = snap.docs[0].data();
    const text = data.title || "";
    // ✅ 兼容兩種儲存方式：marqueeColors(Array) 或 marqueeColor(String)
    let colors = Array.isArray(data.marqueeColors) && data.marqueeColors.length
      ? data.marqueeColors
      : (data.marqueeColor ? [data.marqueeColor] : ["#000000"]);

    // 建立彩色字元
    let html = "";
    for (let i = 0; i < text.length; i++) {
      const color = colors[i % colors.length];
      html += `<span style="color:${color}">${text[i]}</span>`;
    }
    marquee.innerHTML = html;
  } catch (err) {
    console.error("❌ 載入跑馬燈公告失敗：", err);
    container.style.display = "none";
  }
});
