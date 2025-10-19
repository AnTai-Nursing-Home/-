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

function showLoader(msg = "資料載入中...") {
  let loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "block";
  const text = loader?.querySelector("p");
  if (text) text.textContent = msg;
}
function hideLoader() {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "none";
}

// 🟦 載入分類
async function loadCategories() {
  showLoader("正在載入分類...");
  try {
    const snap = await db.collection("announcementCategories").orderBy("createdAt", "desc").get();
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
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">目前沒有公告</td></tr>`;
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
  await db.collection("announcementCategories").add({
    name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  alert("✅ 分類已新增");
  hideLoader();
  loadCategories();
  bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
}

// 🟢 新增公告
function showAnnouncementModal() {
  const modal = new bootstrap.Modal(document.getElementById("announcementModal"));
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  document.getElementById("is-marquee").checked = false;
  document.getElementById("marqueeColorGroup").style.display = "none";
  modal.show();
}

async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const categoryId = document.getElementById("category").value;
  const isMarquee = document.getElementById("is-marquee").checked;
  const marqueeColor = document.getElementById("marqueeColor").value;

  if (!title || !content) return alert("請輸入標題與內容！");

  showLoader("正在儲存公告...");

  const catSnap = await db.collection("announcementCategories").doc(categoryId).get();
  const categoryName = catSnap.exists ? catSnap.data().name : "未分類";

  await db.collection("announcements").add({
    title,
    content,
    category: categoryName,
    categoryId,
    isMarquee,
    marqueeColor,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  alert("✅ 公告已新增！");
  hideLoader();
  bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
  await loadAnnouncements();
}

// 🗑️ 刪除公告
async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;
  showLoader("正在刪除公告...");
  await db.collection("announcements").doc(id).delete();
  alert("🗑️ 公告已刪除");
  hideLoader();
  loadAnnouncements();
}
