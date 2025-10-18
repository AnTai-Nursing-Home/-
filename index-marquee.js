// index-marquee.js
document.addEventListener("firebase-ready", async () => {
  const marquee = document.getElementById("marquee-text");
  if (!marquee) return;

  try {
    const snap = await db.collection("announcements")
      .where("isMarquee", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      marquee.textContent = "";
      return;
    }

    const data = snap.docs[0].data();
    const text = data.title;
    const colors = data.marqueeColors || ["#000000"];
    let html = "";

    for (let i = 0; i < text.length; i++) {
      const color = colors[i % colors.length];
      html += `<span style="color:${color}">${text[i]}</span>`;
    }

    marquee.innerHTML = html;
  } catch (err) {
    console.error("❌ 載入跑馬燈公告失敗：", err);
  }
});
