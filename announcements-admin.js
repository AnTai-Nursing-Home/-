document.addEventListener("firebase-ready", async () => {
  console.log("✅ Firebase ready, loading categories and announcements...");
  await loadCategories();
  await loadAnnouncements();
});

// 監聽按鈕事件
document.getElementById("addCategoryBtn")?.addEventListener("click", showCategoryModal);
document.getElementById("saveCategoryBtn")?.addEventListener("click", saveCategory);
document.getElementById("addAnnouncementBtn")?.addEventListener("click", showAnnouncementModal);
document.getElementById("saveAnnouncementBtn")?.addEventListener("click", saveAnnouncement);

async function loadCategories() {
  try {
    const snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
    const select = document.getElementById("category");
    select.innerHTML = "";

    if (snap.empty) {
      const option = document.createElement("option");
      option.textContent = "目前沒有分類";
      select.appendChild(option);
      return;
    }

    snap.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().name;
      select.appendChild(option);
    });

    console.log("📁 Categories loaded:", snap.size);
  } catch (error) {
    console.error("❌ Error loading categories:", error);
  }
}

async function loadAnnouncements() {
  try {
    const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();
    const list = document.getElementById("announcementList");
    if (!list) return;

    list.innerHTML = "";

    snap.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.classList.add("border", "p-3", "mb-2", "rounded");
      div.innerHTML = `
        <h5>${data.title}</h5>
        <p class="text-muted">${data.categoryName || "未分類"} ｜ ${data.createdAt?.toDate().toLocaleString() || ""}</p>
        <p>${data.content}</p>
      `;
      list.appendChild(div);
    });

    console.log("📄 Announcements loaded:", snap.size);
  } catch (error) {
    console.error("❌ Error loading announcements:", error);
  }
}

function showCategoryModal() {
  const modal = new bootstrap.Modal(document.getElementById("categoryModal"));
  document.getElementById("newCategoryName").value = "";
  modal.show();
}

async function saveCategory() {
  const name = document.getElementById("newCategoryName").value.trim();
  if (!name) return alert("請輸入分類名稱");

  try {
    await db.collection("announcementCategories").add({
      name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("✅ 分類已新增");
    loadCategories();
    bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
  } catch (error) {
    console.error("❌ Error saving category:", error);
    alert("儲存失敗");
  }
}

function showAnnouncementModal() {
  const modal = new bootstrap.Modal(document.getElementById("announcementModal"));
  document.getElementById("newAnnouncementTitle").value = "";
  document.getElementById("newAnnouncementContent").value = "";
  modal.show();
}

async function saveAnnouncement() {
  const title = document.getElementById("newAnnouncementTitle").value.trim();
  const content = document.getElementById("newAnnouncementContent").value.trim();
  const categoryId = document.getElementById("category").value;
  const marquee = document.getElementById("marqueeCheck")?.checked || false;

  if (!title || !content) return alert("請輸入完整內容");

  try {
    let categoryName = "未分類";
    if (categoryId && categoryId !== "目前沒有分類") {
      const catDoc = await db.collection("announcementCategories").doc(categoryId).get();
      if (catDoc.exists) categoryName = catDoc.data().name;
    }

    await db.collection("announcements").add({
      title,
      content,
      categoryId,
      categoryName,
      marquee,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 公告已新增");
    loadAnnouncements();
    bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
  } catch (error) {
    console.error("❌ Error saving announcement:", error);
    alert("儲存失敗");
  }
}
