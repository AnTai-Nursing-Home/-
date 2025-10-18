document.addEventListener("DOMContentLoaded", async () => {
  const waitForFirebase = () =>
    new Promise((resolve) => {
      if (typeof db !== "undefined" && db) return resolve();
      document.addEventListener("firebase-ready", resolve);
    });

  await waitForFirebase();
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
// 🟢 顯示 / 隱藏載入提示
function showLoader(message = "資料載入中，請稍候...") {
  let loader = document.getElementById("loadingIndicator");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loadingIndicator";
    loader.style = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      font-size: 18px;
      z-index: 2000;
    `;
    loader.innerHTML = `
      <div class="spinner-border text-primary" role="status" style="width: 2.5rem; height: 2.5rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p id="loaderText" class="mt-2">${message}</p>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "none";
}

//
// 🟧 錯誤提示
function showError(msg) {
  const errorBox = document.createElement("div");
  errorBox.className = "alert alert-danger text-center";
  errorBox.textContent = msg;
  errorBox.style.position = "fixed";
  errorBox.style.top = "10px";
  errorBox.style.left = "50%";
  errorBox.style.transform = "translateX(-50%)";
  errorBox.style.zIndex = "3000";
  document.body.appendChild(errorBox);
  setTimeout(() => errorBox.remove(), 3000);
}

//
// 🟦 載入分類（含 Loading）
async function loadCategories() {
  showLoader("正在載入分類...");
  try {
    let snap;
    try {
      snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
    } catch (error) {
      console.warn("⚠️ 無 createdAt，改用未排序查詢:", error.message);
      snap = await db.collection("announcementCategories").get();
    }

    const select = document.getElementById("category");
    if (!select) {
      console.error("❌ 找不到 #category");
      return;
    }
    select.innerHTML = "";

    if (snap.empty) {
      const option = document.createElement("option");
      option.textContent = "目前沒有分類";
      select.appendChild(option);
    } else {
      snap.forEach((doc) => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = data.name || "未命名分類";
        option.textContent = data.name || "未命名分類";
        select.appendChild(option);
      });
    }

    console.log("✅ 分類載入完成:", snap.size);
  } catch (error) {
    console.error("❌ 載入分類失敗:", error);
    showError("載入分類時發生錯誤！");
  } finally {
    hideLoader();
  }
}

//
// 🟨 載入公告（含 Loading）
async function loadAnnouncements() {
  showLoader("正在載入公告...");
  try {
    const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();
    const tbody = document.getElementById("announcement-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snap.empty) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="text-center text-muted">目前沒有公告</td>`;
      tbody.appendChild(tr);
      return;
    }

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
    console.error("❌ 載入公告失敗:", error);
    showError("載入公告時發生錯誤！");
  } finally {
    hideLoader();
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

  showLoader("正在儲存分類...");
  try {
    await db.collection("announcementCategories").add({
      name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert("✅ 分類已新增");
    await loadCategories();
    bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
  } catch (error) {
    console.error("❌ 儲存分類失敗:", error);
    showError("無法儲存分類，請稍後再試！");
  } finally {
    hideLoader();
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

  showLoader("正在儲存公告...");
  try {
    await db.collection("announcements").add({
      title,
      content,
      category,
      isMarquee,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert("✅ 公告已新增");
    await loadAnnouncements();
    bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
  } catch (error) {
    console.error("❌ 儲存公告失敗:", error);
    showError("無法儲存公告，請稍後再試！");
  } finally {
    hideLoader();
  }
}

//
// 🗑️ 刪除公告
async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;

  showLoader("正在刪除公告...");
  try {
    await db.collection("announcements").doc(id).delete();
    alert("🗑️ 公告已刪除");
    await loadAnnouncements();
  } catch (error) {
    console.error("❌ 刪除公告失敗:", error);
    showError("無法刪除公告！");
  } finally {
    hideLoader();
  }
}

// 🟣 開啟「編輯分類」Modal 並載入現有分類
document.getElementById("btn-edit-category")?.addEventListener("click", async () => {
  const select = document.getElementById("edit-category-select");
  select.innerHTML = "<option disabled selected>載入中...</option>";

  try {
    const snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
    select.innerHTML = "";

    if (snap.empty) {
      select.innerHTML = "<option disabled>目前沒有分類</option>";
    } else {
      snap.forEach(doc => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = data.name || "未命名分類";
        select.appendChild(option);
      });
    }

    const modal = new bootstrap.Modal(document.getElementById("editCategoryModal"));
    modal.show();
  } catch (error) {
    console.error("❌ 載入分類失敗：", error);
    alert("無法載入分類，請稍後再試。");
  }
});

// 🟡 儲存分類修改
document.getElementById("save-edit-category")?.addEventListener("click", async () => {
  const select = document.getElementById("edit-category-select");
  const docId = select.value;
  const newName = document.getElementById("new-category-name-edit").value.trim();

  if (!docId || !newName) {
    alert("請選擇分類並輸入新名稱！");
    return;
  }

  try {
    await db.collection("announcementCategories").doc(docId).update({ name: newName });
    alert("✅ 分類名稱已更新！");
    document.getElementById("new-category-name-edit").value = "";
    loadCategories();

    const modal = bootstrap.Modal.getInstance(document.getElementById("editCategoryModal"));
    modal.hide();
  } catch (error) {
    console.error("❌ 更新分類失敗：", error);
    alert("更新失敗，請稍後再試！");
  }
});
