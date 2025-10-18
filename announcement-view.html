// 公告列表頁
let dbReady = false;

document.addEventListener("firebase-ready", () => {
  dbReady = true;
  loadAnnouncements();
});

async function loadAnnouncements() {
  if (!dbReady) return;
  const list = document.getElementById("announcement-list");
  list.innerHTML = "";

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = `<div class="text-muted text-center">目前沒有公告。</div>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const link = document.createElement("a");
      link.href = `announcement-view.html?id=${doc.id}`;
      link.className = "list-group-item list-group-item-action";
      link.innerHTML = `
        <h5 class="mb-1">${d.title}</h5>
        <p class="mb-1 text-secondary small">${d.category || "未分類"}　
          ${d.createdAt?.toDate().toLocaleString() || ""}
        </p>
      `;
      list.appendChild(link);
    });
  } catch (err) {
    console.error("❌ 無法載入公告：", err);
    list.innerHTML = `<div class="text-danger text-center">載入公告時發生錯誤。</div>`;
  }
}
