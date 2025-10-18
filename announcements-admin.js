let dbReady = false;
const tbody = document.getElementById("announcement-tbody");
const categorySelect = document.getElementById("announcement-category");
const colorSection = document.getElementById("color-section");
const colorPickers = document.getElementById("color-pickers");

// 等待 firebase 初始化完成後再執行
document.addEventListener("firebase-ready", () => {
  dbReady = true;
  console.log("✅ Firebase 已初始化，可以使用 Firestore");
  initializeAnnouncementPage();
});

function initializeAnnouncementPage() {
  // 確保 db 已準備好
  if (typeof db === "undefined") {
    console.error("❌ Firestore 尚未初始化！");
    return;
  }

  loadCategories();
  loadAnnouncements();

  document.getElementById("btn-add-announcement").addEventListener("click", () => {
    document.getElementById("announcement-form").reset();
    colorSection.classList.add("d-none");
    colorPickers.innerHTML = "";
    new bootstrap.Modal(document.getElementById("announcementModal")).show();
  });

  document.getElementById("btn-add-category").addEventListener("click", () => {
    new bootstrap.Modal(document.getElementById("categoryModal")).show();
  });

  document.getElementById("is-marquee").addEventListener("change", e => {
    colorSection.classList.toggle("d-none", !e.target.checked);
  });

  document.getElementById("add-color").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "color";
    input.className = "form-control-color";
    colorPickers.appendChild(input);
  });

  document.getElementById("save-category").addEventListener("click", saveCategory);
  document.getElementById("save-announcement").addEventListener("click", saveAnnouncement);
}

// === Firestore 功能 ===
async function loadCategories() {
  if (!dbReady) return;
  categorySelect.innerHTML = "";
  const snap = await db.collection("announcementCategories").get();
  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.data().name;
    opt.textContent = doc.data().name;
    categorySelect.appendChild(opt);
  });
}

async function loadAnnouncements() {
  if (!dbReady) return;
  tbody.innerHTML = "";
  const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();
  snap.forEach(doc => {
    const d = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.title}</td>
      <td>${d.category || "-"}</td>
      <td>${d.createdAt?.toDate().toLocaleString() || ""}</td>
      <td>${d.isMarquee ? "是" : "否"}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${doc.id}')">刪除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveCategory() {
  const name = document.getElementById("new-category-name").value.trim();
  if (!name) return alert("請輸入分類名稱");
  await db.collection("announcementCategories").add({ name });
  document.getElementById("new-category-name").value = "";
  bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
  loadCategories();
}

async function saveAnnouncement() {
  const title = document.getElementById("announcement-title").value.trim();
  const content = document.getElementById("announcement-content").value.trim();
  const category = categorySelect.value;
  const isMarquee = document.getElementById("is-marquee").checked;
  const colors = Array.from(colorPickers.querySelectorAll("input[type=color]")).map(i => i.value);

  if (!title || !content) return alert("請填寫完整資訊");

  await db.collection("announcements").add({
    title,
    content,
    category,
    isMarquee,
    marqueeColors: colors,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
  loadAnnouncements();
}

async function deleteAnnouncement(id) {
  if (confirm("確定要刪除這則公告嗎？")) {
    await db.collection("announcements").doc(id).delete();
    loadAnnouncements();
  }
}
