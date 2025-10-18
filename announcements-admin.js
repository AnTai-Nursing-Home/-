let dbReady = false;

document.addEventListener("firebase-ready", () => {
  dbReady = true;
  loadAnnouncements();
});

async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const category = document.getElementById("category").value.trim() || "未分類";
  const imageFile = document.getElementById("imageFile").files[0];

  if (!title || !content) {
    alert("請輸入公告標題與內容！");
    return;
  }

  let imageUrl = "";

  try {
    // ✅ 如果有上傳圖片，先存到 Firebase Storage
    if (imageFile) {
      const storageRef = firebase.storage().ref(`announcements/${Date.now()}_${imageFile.name}`);
      await storageRef.put(imageFile);
      imageUrl = await storageRef.getDownloadURL();
    }

    // ✅ 儲存公告到 Firestore
    await db.collection("announcements").add({
      title,
      content,
      category,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 公告已發布！");
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    document.getElementById("category").value = "";
    document.getElementById("imageFile").value = "";
    loadAnnouncements();

  } catch (error) {
    console.error("❌ 儲存公告時發生錯誤:", error);
    alert("儲存公告失敗！");
  }
}

async function loadAnnouncements() {
  if (!dbReady) return;
  const list = document.getElementById("announcement-list");
  list.innerHTML = "載入中...";

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = "<div class='text-muted text-center'>目前沒有公告。</div>";
      return;
    }

    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const item = document.createElement("div");
      item.className = "list-group-item";
      item.innerHTML = `
        <h6 class="fw-bold mb-1">${d.title}</h6>
        <div class="small text-secondary">${d.category || "未分類"}　
          ${d.createdAt?.toDate().toLocaleString("zh-TW") || ""}
        </div>
        ${d.imageUrl ? `<img src="${d.imageUrl}" class="img-fluid rounded my-2" style="max-height:100px;">` : ""}
      `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error("❌ 載入公告失敗:", error);
    list.innerHTML = "<div class='text-danger text-center'>載入公告時發生錯誤。</div>";
  }
}
