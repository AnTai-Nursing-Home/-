// =========================================================
// 公開端公告系統 - 修正版 (2025-10)
// 等待 firebase-init.js 初始化完成後再執行
// =========================================================

let dbReady = false;

// 等 Firebase 初始化完成後再執行
document.addEventListener("firebase-ready", () => {
  dbReady = true;
  console.log("✅ Firebase 已初始化，可讀取公告");
  initializeAnnouncements();
});

function initializeAnnouncements() {
  if (typeof db === "undefined") {
    console.error("❌ Firestore 尚未初始化！");
    return;
  }

  loadCategories();
  loadAnnouncements();
  loadMarquee();

  const categoryFilter = document.getElementById("category-filter");
  const resetFilter = document.getElementById("reset-filter");

  if (categoryFilter) {
    categoryFilter.addEventListener("change", e => {
      loadAnnouncements(e.target.value);
    });
  }

  if (resetFilter) {
    resetFilter.addEventListener("click", () => {
      categoryFilter.value = "";
      loadAnnouncements();
    });
  }
}

// =========================================================
// Firestore 相關函式
// =========================================================

// 載入分類
async function loadCategories() {
  if (!dbReady) return;
  const select = document.getElementById("category-filter");
  if (!select) return;

  select.innerHTML = `<option value="">選擇分類</option>`;
  try {
    const snap = await db.collection("announcementCategories").get();
    snap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().name;
      opt.textContent = doc.data().name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ 無法載入分類：", err);
  }
}

// 載入公告
async function loadAnnouncements(category = "") {
  if (!dbReady) return;
  const list = document.getElementById("announcement-list");
  if (!list) return;

  list.innerHTML = "";
  try {
    let query = db.collection("announcements").orderBy("createdAt", "desc");
    if (category) query = query.where("category", "==", category);
    const snap = await query.get();

    if (snap.empty) {
      list.innerHTML = `<div class="text-muted">目前沒有公告。</div>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const item = document.createElement("div");
      item.className = "list-group-item";
      item.innerHTML = `
        <h5>${d.title}</h5>
        <p class="mb-1">${d.content}</p>
        <small class="text-muted">
          ${d.category || "未分類"}　
          ${d.createdAt?.toDate().toLocaleString() || ""}
        </small>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    console.error("❌ 無法載入公告：", err);
  }
}

// 載入跑馬燈公告
async function loadMarquee() {
  if (!dbReady) return;
  const marqueeEl = document.getElementById("marquee");
  if (!marqueeEl) return;

  try {
    const snap = await db.collection("announcements")
      .where("isMarquee", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      marqueeEl.textContent = "";
      return;
    }

    const data = snap.docs[0].data();
    const text = data.title;
    const colors = data.marqueeColors || ["#000000"];
    let html = "";
    for (let i = 0; i < text.length; i++) {
      const color = colors[i % colors.length];
      html += `<span style="color:${color}">${text[i]}</span>`;
    }
    marqueeEl.innerHTML = html;
  } catch (err) {
    console.error("❌ 載入跑馬燈公告失敗：", err);
  }
}
