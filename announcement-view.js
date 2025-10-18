document.addEventListener("firebase-ready", async () => {
  console.log("✅ Firebase ready, loading categories and announcements...");

  const categorySelect = document.getElementById("category");
  const announcementsTable = document.getElementById("announcements-table");
  const tbody = announcementsTable.querySelector("tbody");

  // 🔄 顯示載入中提示
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center text-muted py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-2">資料載入中，請稍候...</div>
      </td>
    </tr>`;

  // 載入分類
  async function loadCategories() {
    console.log("🚀 嘗試載入分類...");
    const snapshot = await db.collection("announcementCategories").get();
    if (snapshot.empty) {
      console.warn("⚠️ Firestore 沒有分類文件");
      categorySelect.innerHTML = `<option value="">目前沒有分類</option>`;
      return;
    }

    let optionsHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name) optionsHTML += `<option value="${data.name}">${data.name}</option>`;
    });
    categorySelect.innerHTML = optionsHTML;
    console.log("📦 撈取到分類筆數:", snapshot.size);
  }

  // 載入公告
  async function loadAnnouncements() {
    const snapshot = await db.collection("announcements").orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">目前尚無公告</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const row = `
        <tr>
          <td>${data.title || "(未命名公告)"}</td>
          <td>${data.category || "未分類"}</td>
          <td>${data.createdAt?.toDate().toLocaleString() || ""}</td>
          <td>${data.isMarquee ? "✅" : ""}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${doc.id}')">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        </tr>`;
      tbody.insertAdjacentHTML("beforeend", row);
    });
    console.log("📄 Announcements loaded:", snapshot.size);
  }

  // 新增公告
  document.getElementById("saveAnnouncementBtn").addEventListener("click", async () => {
    const title = document.getElementById("title").value.trim();
    const content = document.getElementById("content").value.trim();
    const category = categorySelect.value;
    const isMarquee = document.getElementById("isMarquee").checked;
    const fileInput = document.getElementById("imageUpload");
    const file = fileInput.files[0];

    if (!title || !content) {
      alert("請輸入完整的標題與內容！");
      return;
    }

    try {
      let imageUrl = null;

      // ✅ 若有選擇圖片就上傳到 Firebase Storage
      if (file) {
        const storageRef = firebase.storage().ref(`announcements/${Date.now()}_${file.name}`);
        await storageRef.put(file);
        imageUrl = await storageRef.getDownloadURL();
        console.log("🖼️ 圖片已上傳:", imageUrl);
      }

      await db.collection("announcements").add({
        title,
        content,
        category,
        isMarquee,
        imageUrl, // ✅ 存入 Firestore
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("公告已新增！");
      document.getElementById("announcementModal").querySelector(".btn-close").click();
      loadAnnouncements();
    } catch (error) {
      console.error("❌ 新增公告時發生錯誤:", error);
      alert("新增公告失敗，請稍後再試。");
    }
  });

  // 刪除公告
  window.deleteAnnouncement = async (id) => {
    if (!confirm("確定要刪除這則公告嗎？")) return;
    await db.collection("announcements").doc(id).delete();
    alert("公告已刪除");
    loadAnnouncements();
  };

  await loadCategories();
  await loadAnnouncements();
});
