let dbReady = false;
let allAnnouncements = [];
let currentCategory = "全部";

document.addEventListener("firebase-ready", () => {
  dbReady = true;
  loadAnnouncements();
});

async function loadAnnouncements() {
  if (!dbReady) return;
  const list = document.getElementById("announcement-list");
  const tabs = document.getElementById("categoryTabs");
  list.innerHTML = "載入中...";
  tabs.innerHTML = "";

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = `<div class="text-muted text-center">目前沒有公告。</div>`;
      return;
    }

    // 收集公告
    allAnnouncements = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));

    // 🔧 自動生成分類
    const categories = Array.from(new Set(allAnnouncements.map(a => a.category || "未分類")));
    const allCats = ["全部", ...categories];

    // 產生分類標籤
    allCats.forEach(cat => {
      const li = document.createElement("li");
      li.classList.add("nav-item");
      li.innerHTML = `
        <button class="nav-link ${cat === currentCategory ? "active" : ""}" 
                onclick="filterCategory('${cat}')">${cat}</button>`;
      tabs.appendChild(li);
    });

    renderAnnouncements(currentCategory);
  } catch (err) {
    console.error("❌ 無法載入公告：", err);
    list.innerHTML = `<div class="text-danger text-center">載入公告時發生錯誤。</div>`;
  }
}

function filterCategory(category) {
  currentCategory = category;
  document.querySelectorAll("#categoryTabs .nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.textContent === category);
  });
  renderAnnouncements(category);
}

function renderAnnouncements(category) {
  const list = document.getElementById("announcement-list");
  list.innerHTML = "";

  const filtered = category === "全部"
    ? allAnnouncements
    : allAnnouncements.filter(a => (a.category || "未分類") === category);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-muted text-center">此分類目前沒有公告。</div>`;
    return;
  }

  filtered.forEach(a => {
    const row = document.createElement("div");
    row.className = "announcement-row";
    row.innerHTML = `
      <h5><a href="announcement-view.html?id=${a.id}" class="title">${a.title}</a></h5>
      <div class="text-muted small">${a.category || "未分類"}　${a.createdAt.toLocaleString("zh-TW")}</div>
    `;
    list.appendChild(row);
  });
}
