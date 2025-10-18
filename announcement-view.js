document.addEventListener("firebase-ready", async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    document.getElementById("announcement-content").innerHTML = "<p>找不到這則公告。</p>";
    return;
  }

  try {
    const docSnap = await db.collection("announcements").doc(id).get();
    if (!docSnap.exists) {
      document.getElementById("announcement-content").innerHTML = "<p>這則公告不存在或已被刪除。</p>";
      return;
    }

    const data = docSnap.data();
    document.getElementById("announcement-title").textContent = data.title;
    document.getElementById("announcement-body").innerHTML = data.content.replace(/\n/g, "<br>");
    document.getElementById("announcement-meta").textContent =
      `${data.category || "未分類"}　${data.createdAt?.toDate().toLocaleString() || ""}`;
  } catch (err) {
    console.error("❌ 無法載入公告：", err);
  }
});
