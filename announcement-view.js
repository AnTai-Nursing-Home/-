document.addEventListener("firebase-ready", async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const content = document.getElementById("announcement-content");
  const loader = document.getElementById("loadingIndicator");
  const imageContainer = document.getElementById("image-container");

  if (!id) {
    loader.style.display = "none";
    content.style.display = "block";
    content.innerHTML = "<p>找不到這則公告。</p>";
    return;
  }

  try {
    const docSnap = await db.collection("announcements").doc(id).get();
    if (!docSnap.exists) {
      loader.style.display = "none";
      content.style.display = "block";
      content.innerHTML = "<p>這則公告不存在或已刪除。</p>";
      return;
    }

    const data = docSnap.data();

    // 設定標題與內容
    document.getElementById("announcement-title").textContent = data.title || "(未命名公告)";
    document.getElementById("announcement-body").innerHTML = (data.content || "").replace(/\n/g, "<br>");
    document.getElementById("announcement-meta").textContent =
      `${data.category || "未分類"}　${data.createdAt?.toDate().toLocaleString() || ""}`;

    // 顯示圖片（若有）
    if (data.imageUrl) {
      const img = document.createElement("img");
      img.src = data.imageUrl;
      img.className = "img-fluid rounded shadow-sm my-3";
      img.alt = "公告圖片";
      imageContainer.appendChild(img);

      // 檢查圖片是否可載入
      img.onerror = () => {
        console.warn("⚠️ 圖片載入失敗，可能是 URL 或權限問題：", data.imageUrl);
        imageContainer.innerHTML = `<p class="text-muted">（圖片無法顯示）</p>`;
      };
    } else {
      imageContainer.innerHTML = `<p class="text-muted">（本公告未附圖片）</p>`;
    }

    // 顯示內容並隱藏 loading
    loader.style.display = "none";
    content.style.display = "block";

  } catch (err) {
    console.error("❌ 無法載入公告：", err);
    loader.style.display = "none";
    content.style.display = "block";
    content.innerHTML = "<p class='text-danger'>載入公告時發生錯誤，請稍後再試。</p>";
  }
});
