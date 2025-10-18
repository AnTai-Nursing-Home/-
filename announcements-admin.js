document.addEventListener("firebase-ready", async () => {
  console.log("✅ Firebase ready, loading categories and announcements...");
  await loadCategories();
  await loadAnnouncements();
});

// 綁定按鈕事件
document.getElementById("btn-add-category")?.addEventListener("click", showCategoryModal);
document.getElementById("save-category")?.addEventListener("click", saveCategory);
document.getElementById("btn-add-announcement")?.addEventListener("click", showAnnouncementModal);
document.getElementById("save-announcement")?.addEventListener("click", saveAnnouncement);

//
// 🟦 載入分類（含錯誤回退）
async function loadCategories() {
  try {
    let snap;
    try {
      // 嘗試用 createdAt 排序載入
      snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
    } catch (error) {
      console.warn("⚠️ 沒有 createdAt 欄位，改用無排序載入分類");
      snap = await db.collection("announcementCategories").get();
    }

    const select = document.getElementById("category");
    if (!select) return;

    select.innerHTML = "";

    if (snap.empty) {
      const option = document.createElement("option");
      option.textContent = "目前沒有分類";
      select.appendChild(option);
      return;
    }

    snap.forEach((doc) => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = data.name || "未命名分類";
      option.textContent = data.name || "未命名分類";
      select.appendChild(option);
    });

    console.log("📁 Categories loaded:", snap.size);
  } catch (error) {
    console.error("❌ Error loading categories:", error);
  }
}

//
// 🟨 載入公告
async function loadAnnouncements() {
  try {
    const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();
    const tbody = document.getElementById("announcement-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    snap.forEach((doc) => {
      const data = doc.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.title || "(未命名)"}</td>
        <td>${data.category || "未分類"}</td>
        <td>${data.createdAt ? data.createdAt.toDate().toLocaleString() : ""}</td>
        <td>${data.isMarquee ? "✅" : "❌"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${doc.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    console.log("📄 Announcements loaded:", snap.size);
  } catch (error) {
    console.error("❌ Error loading announcements:", error);
  }
}

//
// 🟢 顯示分類新增視窗
function showCategoryModal() {
  const modal = new bootstrap.Modal(document.getElementById("categoryModal"));
  document.getElementById("new-category-name").value = "";
  modal.show();
}

//
// 🟢 儲存分類
async function saveCategory() {
  const name = document.getElementById("new-category-name").value.trim();
  if (!name) return alert("請輸入分類名稱");

  try {
    await db.collection("announcementCategories").add({
      name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 分類已新增");
    await loadCategories();
    bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
  } catch (error) {
    console.error("❌ Error saving category:", error);
    alert("儲存失敗");
  }
}

//
// 🟢 顯示公告新增視窗
function showAnnouncementModal() {
  const modal = new bootstrap.Modal(document.getElementById("announcementModal"));
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  modal.show();
}

//
// 🟢 儲存公告
async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const category = document.getElementById("category").value;
  const isMarquee = document.getElementById("is-marquee")?.checked || false;

  if (!title || !content) return alert("請輸入完整內容");

  try {
    await db.collection("announcements").add({
      title,
      content,
      category,
      isMarquee,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 公告已新增");
    await loadAnnouncements();
    bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
  } catch (error) {
    console.error("❌ Error saving announcement:", error);
    alert("儲存失敗");
  }
}

//
// 🗑️ 刪除公告
async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;
  try {
    await db.collection("announcements").doc(id).delete();
    alert("🗑️ 公告已刪除");
    await loadAnnouncements();
  } catch (error) {
    console.error("❌ Error deleting announcement:", error);
  }
}
