document.addEventListener("firebase-ready", async () => {
  console.log("✅ Firebase ready, loading single announcement...");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const loader = document.getElementById("loadingIndicator");
  const content = document.getElementById("announcement-content");
  const imageContainer = document.getElementById("image-container");

  // 顯示讀取中
  loader.style.display = "block";
  content.style.display = "none";

  if (!id) {
    loader.style.display = "none";
    content.style.display = "block";
    content.innerHTML = "<p class='text-danger'>找不到這則公告。</p>";
    return;
  }

  try {
    const docSnap = await db.collection("announcements").doc(id).get();

    if (!docSnap.exists) {
      loader.style.display = "none";
      content.style.display = "block";
      content.innerHTML = "<p class='text-danger'>這則公告不存在或已刪除。</p>";
      return;
    }

    const data = docSnap.data();

    // 顯示公告標題與內容
    document.getElementById("announcement-title").textContent = data.title || "(未命名公告)";
    document.getElementById("announcement-body").innerHTML = (data.content || "").replace(/\n/g, "<br>");
    document.getElementById("announcement-meta").textContent =
      `${data.category || "未分類"}　${data.createdAt?.toDate().toLocaleString() || ""}`;

    // 顯示圖片
    imageContainer.innerHTML = "";
    if (data.imageUrl) {
      const img = document.createElement("img");
      img.src = data.imageUrl;
      img.className = "img-fluid rounded shadow-sm my-3";
      img.alt = "公告圖片";

      img.onload = () => console.log("🖼️ 圖片載入成功");
      img.onerror = (e) => {
        console.warn("⚠️ 圖片載入失敗：", e);
        imageContainer.innerHTML = `<p class="text-muted">（圖片無法顯示）</p>`;
      };

      imageContainer.appendChild(img);
    }

    // 顯示內容、隱藏載入動畫
    loader.style.display = "none";
    content.style.display = "block";
  } catch (error) {
    console.error("❌ 無法載入公告：", error);
    loader.style.display = "none";
    content.style.display = "block";
    content.innerHTML = "<p class='text-danger'>載入公告時發生錯誤，請稍後再試。</p>";
  }
});
