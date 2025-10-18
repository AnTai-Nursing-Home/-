// ==========================
// 🔧 按鈕事件初始化區
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const addAnnouncementBtn = document.getElementById("btn-add-announcement");
  const addCategoryBtn = document.getElementById("btn-add-category");
  const saveAnnouncementBtn = document.getElementById("save-announcement");
  const saveCategoryBtn = document.getElementById("save-category");

  const announcementModalEl = document.getElementById("announcementModal");
  const categoryModalEl = document.getElementById("categoryModal");

  const announcementModal = announcementModalEl ? new bootstrap.Modal(announcementModalEl) : null;
  const categoryModal = categoryModalEl ? new bootstrap.Modal(categoryModalEl) : null;

  // 🔹 新增公告按鈕：開啟公告 Modal
  if (addAnnouncementBtn && announcementModal) {
    addAnnouncementBtn.addEventListener("click", () => {
      document.getElementById("announcement-form").reset();
      document.getElementById("color-section")?.classList.add("d-none");
      document.getElementById("color-pickers").innerHTML = "";
      announcementModal.show();
    });
  }

  // 🔹 新增分類按鈕：開啟分類 Modal
  if (addCategoryBtn && categoryModal) {
    addCategoryBtn.addEventListener("click", () => {
      document.getElementById("new-category-name").value = "";
      categoryModal.show();
    });
  }

  // 🔹 儲存公告按鈕
  if (saveAnnouncementBtn && announcementModal) {
    saveAnnouncementBtn.addEventListener("click", async () => {
      await saveAnnouncement();
      announcementModal.hide();
    });
  }

  // 🔹 儲存分類按鈕
  if (saveCategoryBtn && categoryModal) {
    saveCategoryBtn.addEventListener("click", async () => {
      const name = document.getElementById("new-category-name").value.trim();
      if (!name) return alert("請輸入分類名稱！");
      await db.collection("announcement_categories").add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("✅ 新分類已新增！");
      categoryModal.hide();
    });
  }

  // 🔹 是否顯示顏色設定（當勾選跑馬燈時）
  const marqueeToggle = document.getElementById("is-marquee");
  if (marqueeToggle) {
    marqueeToggle.addEventListener("change", (e) => {
      document.getElementById("color-section")?.classList.toggle("d-none", !e.target.checked);
    });
  }

  // 🔹 新增顏色按鈕
  const addColorBtn = document.getElementById("add-color");
  if (addColorBtn) {
    addColorBtn.addEventListener("click", () => {
      const div = document.createElement("div");
      div.innerHTML = `<input type="color" class="form-control form-control-color my-1" value="#ff0000">`;
      document.getElementById("color-pickers")?.appendChild(div);
    });
  }
});

// ==========================
// 📦 Firebase 資料操作區
// ==========================
let dbReady = false;

document.addEventListener("firebase-ready", () => {
  dbReady = true;
  loadAnnouncements();
});

// 儲存公告
async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const category = document.getElementById("category").value.trim() || "未分類";
  const imageFile = document.getElementById("imageFile").files[0];
  const isMarquee = document.getElementById("is-marquee").checked;

  if (!title || !content) {
    alert("請輸入公告標題與內容！");
    return;
  }

  // 收集跑馬燈顏色
  const colors = Array.from(document.querySelectorAll("#color-pickers input[type=color]"))
    .map(i => i.value);

  let imageUrl = "";

  try {
    // ✅ 如果有上傳圖片，先存到 Firebase Storage
    if (imageFile) {
      if (imageFile.size > 2 * 1024 * 1024) { // 限制 2MB
        alert("❌ 圖片檔案太大，請選擇 2MB 以下的圖片！");
        return;
      }
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
      isMarquee,
      marqueeColors: colors,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 公告已發布！");
    document.getElementById("announcement-form").reset();
    document.getElementById("color-pickers").innerHTML = "";
    loadAnnouncements();

  } catch (error) {
    console.error("❌ 儲存公告時發生錯誤:", error);
    alert("儲存公告失敗！");
  }
}

// 載入公告
async function loadAnnouncements() {
  if (!dbReady) return;
  const list = document.getElementById("announcement-tbody"); // ✅ 對應你的 HTML
  if (!list) {
    console.error("⚠️ 找不到 #announcement-tbody 元素！");
    return;
  }

  list.innerHTML = "<tr><td colspan='5' class='text-center'>載入中...</td></tr>";

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>目前沒有公告。</td></tr>";
      return;
    }

    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="fw-bold">${d.title}</div>
          ${d.imageUrl ? `<img src="${d.imageUrl}" class="img-fluid rounded mt-1" style="max-height:60px;">` : ""}
        </td>
        <td>${d.category || "未分類"}</td>
        <td>${d.createdAt?.toDate().toLocaleString("zh-TW") || ""}</td>
        <td>${d.isMarquee ? "✅" : "❌"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAnnouncement('${doc.id}')">
            刪除
          </button>
        </td>
      `;
      list.appendChild(row);
    });
  } catch (error) {
    console.error("❌ 載入公告失敗:", error);
    list.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>載入公告時發生錯誤。</td></tr>";
  }
}

// 刪除公告
async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;
  try {
    await db.collection("announcements").doc(id).delete();
    alert("✅ 公告已刪除！");
    loadAnnouncements();
  } catch (error) {
    console.error("❌ 刪除公告時發生錯誤:", error);
    alert("刪除公告失敗！");
  }
}
