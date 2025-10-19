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

// 跑馬燈顏色顯示控制
document.getElementById("is-marquee")?.addEventListener("change", (e) => {
  document.getElementById("marqueeColorGroup").style.display = e.target.checked ? "block" : "none";
});

// 🖼️ 預覽上傳圖片
const imageInput = document.getElementById("imageUpload");
const preview = document.getElementById("previewImage");
if (imageInput) {
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });
}

// 🟢 顯示 / 隱藏載入提示（修正版）
function showLoader(message = "資料載入中，請稍候...") {
  let loader = document.getElementById("loadingIndicator");

  // 若 loader 不存在，建立新的
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loadingIndicator";
    loader.style = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
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
  } else {
    // 若已存在，但 loaderText 不存在 → 新增
    let textNode = loader.querySelector("#loaderText");
    if (!textNode) {
      textNode = document.createElement("p");
      textNode.id = "loaderText";
      textNode.className = "mt-2";
      loader.appendChild(textNode);
    }
    textNode.textContent = message;
  }

  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "none";
}

// 🟦 載入分類
async function loadCategories() {
  showLoader("正在載入分類...");
  try {
    let snap;
    try {
      snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
    } catch {
      snap = await db.collection("announcementCategories").get();
    }

    const select = document.getElementById("category");
    select.innerHTML = "";

    if (snap.empty) {
      select.innerHTML = "<option disabled>目前沒有分類</option>";
    } else {
      snap.forEach((doc) => {
        const data = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = data.name || "未命名分類";
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("❌ 載入分類失敗:", err);
  } finally {
    hideLoader();
  }
}

// 🟨 載入公告
async function loadAnnouncements() {
  showLoader("正在載入公告...");
  try {
    const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();
    const tbody = document.getElementById("announcement-tbody");
    tbody.innerHTML = "";

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前沒有公告</td></tr>`;
      return;
    }

    snap.forEach((doc) => {
      const data = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.title || "未命名"}</td>
        <td>${data.category || "未分類"}</td>
        <td>${data.createdAt ? data.createdAt.toDate().toLocaleString("zh-TW") : ""}</td>
        <td>${data.isMarquee ? "✅" : "❌"}</td>
        <td>${data.imageUrl ? `<img src="${data.imageUrl}" style="height:50px;border-radius:6px;">` : ""}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${doc.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("❌ 載入公告失敗:", err);
  } finally {
    hideLoader();
  }
}

// 🟢 新增分類
function showCategoryModal() {
  const modal = new bootstrap.Modal(document.getElementById("categoryModal"));
  document.getElementById("new-category-name").value = "";
  modal.show();
}

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
    loadCategories();
    bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
  } finally {
    hideLoader();
  }
}

// 🟢 新增公告
function showAnnouncementModal() {
  const modal = new bootstrap.Modal(document.getElementById("announcementModal"));
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  document.getElementById("is-marquee").checked = false;
  document.getElementById("marqueeColorGroup").style.display = "none";
  preview.style.display = "none";
  modal.show();
}

async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const categoryId = document.getElementById("category").value;
  const isMarquee = document.getElementById("is-marquee").checked;
  const marqueeColor = document.getElementById("marqueeColor").value;
  const imageFile = document.getElementById("imageUpload").files[0];
  let imageUrl = "";

  if (!title || !content) return alert("請輸入標題與內容！");

  showLoader("正在儲存公告...");

  try {
    if (imageFile) {
      const ref = firebase.storage().ref(`announcement_images/${Date.now()}_${imageFile.name}`);
      await ref.put(imageFile);
      imageUrl = await ref.getDownloadURL();
    }

    const catSnap = await db.collection("announcementCategories").doc(categoryId).get();
    const categoryName = catSnap.exists ? catSnap.data().name : "未分類";

    await db.collection("announcements").add({
      title,
      content,
      category: categoryName,
      categoryId,
      isMarquee,
      marqueeColor,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert("✅ 公告已新增！");
    bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
    await loadAnnouncements();
  } catch (err) {
    console.error("❌ 儲存公告失敗:", err);
  } finally {
    hideLoader();
  }
}

// 🗑️ 刪除公告
async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;
  showLoader("正在刪除公告...");
  await db.collection("announcements").doc(id).delete();
  alert("🗑️ 公告已刪除");
  loadAnnouncements();
  hideLoader();
}

// 🟣 編輯分類
document.getElementById("btn-edit-category")?.addEventListener("click", async () => {
  const select = document.getElementById("edit-category-select");
  select.innerHTML = "<option disabled selected>載入中...</option>";

  const snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
  select.innerHTML = snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join("");
  new bootstrap.Modal(document.getElementById("editCategoryModal")).show();
});

document.getElementById("save-edit-category")?.addEventListener("click", async () => {
  const id = document.getElementById("edit-category-select").value;
  const newName = document.getElementById("new-category-name-edit").value.trim();
  if (!id || !newName) return alert("請輸入新名稱！");

  await db.collection("announcementCategories").doc(id).update({ name: newName });
  alert("✅ 分類名稱已更新！");
  loadCategories();
  bootstrap.Modal.getInstance(document.getElementById("editCategoryModal")).hide();
});
