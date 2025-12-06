// announcements-grid.js
// 重新設計：頂部「最新消息」、下方「分類卡片」一格一分類。
// 相容兩種結構：announcement.category(文字) 或 announcement.categoryId(文件ID)

let ANNOUNCEMENT_LIMIT_LATEST = 8;     // 最新消息顯示幾則
let ANNOUNCEMENT_LIMIT_PER_CAT = 6;    // 每個分類卡片顯示幾則

const latestList = document.getElementById('latestList');
const categoryGrid = document.getElementById('categoryGrid');

let categoryMap = {};   // {categoryId: name}
let reverseCatMap = {}; // {name: categoryId} 方便對應
let allAnnouncements = [];

document.addEventListener("firebase-ready", () => {
  bootstrapPage().catch(err => {
    console.error(err);
    latestList.innerHTML = `<div class="error w-100">載入失敗</div>`;
    categoryGrid.innerHTML = `<div class="error w-100">載入失敗</div>`;
  });
});

async function bootstrapPage() {
  // 1) 讀分類
  await loadCategories();
  // 2) 讀公告
  await loadAnnouncements();
  // 3) 渲染
  renderLatest();
  renderCategoryCards();
}

async function loadCategories() {
  categoryMap = {};
  reverseCatMap = {};

  const catSnap = await db.collection("announcementCategories").get();
  catSnap.forEach(doc => {
    const name = (doc.data().name || "未命名").trim();
    categoryMap[doc.id] = name;
    reverseCatMap[name] = doc.id;
  });
}

async function loadAnnouncements() {
  const snap = await db.collection("announcements").orderBy("createdAt", "desc").get();

  allAnnouncements = snap.docs.map(d => {
    const data = d.data();
    const created = data.createdAt?.toDate?.() || new Date(0);
    // 優先用 categoryId，其次 fallback 到 category 名稱
    let categoryId = data.categoryId || null;
    let categoryName = data.category || null;
    if (!categoryId && categoryName && reverseCatMap[categoryName]) {
      categoryId = reverseCatMap[categoryName];
    }
    if (!categoryName && categoryId && categoryMap[categoryId]) {
      categoryName = categoryMap[categoryId];
    }
    return {
      id: d.id,
      title: data.title || "(未命名)",
      createdAt: created,
      categoryId,
      categoryName: categoryName || "未分類"
    };
  });
}

function renderLatest() {
  if (!allAnnouncements.length) {
    latestList.innerHTML = `<div class="text-center text-muted w-100">目前沒有最新消息</div>`;
    return;
  }
  const items = allAnnouncements.slice(0, ANNOUNCEMENT_LIMIT_LATEST);
  latestList.innerHTML = items.map(a => latestItemTemplate(a)).join("");
}

function latestItemTemplate(a) {
  const dateStr = toTWDateTime(a.createdAt);
  const chip = `<span class="cat-chip">${escapeHTML(a.categoryName || "未分類")}</span>`;
  return `
    <div class="latest-item">
      <div class="latest-date">${dateStr}</div>
      <a class="latest-title flex-grow-1" href="announcement-view.html?id=${a.id}">${escapeHTML(a.title)}</a>
      ${chip}
    </div>
  `;
}

function renderCategoryCards() {
  if (!Object.keys(categoryMap).length && !allAnnouncements.length) {
    categoryGrid.innerHTML = `<div class="text-center text-muted w-100">沒有資料</div>`;
    return;
  }

  // 先依分類分組
  const byCatId = new Map(); // key = categoryId (可為 null), val = Array<announcement>
  for (const a of allAnnouncements) {
    const key = a.categoryId || "__uncategorized__";
    if (!byCatId.has(key)) byCatId.set(key, []);
    byCatId.get(key).push(a);
  }

  // 準備 render：已存在的分類 + 落單(未分類) 一起排
  const cards = [];

  // 1) 已在 announcementCategories 集合中的分類
  for (const [catId, catName] of Object.entries(categoryMap)) {
    const list = (byCatId.get(catId) || []).slice(0, ANNOUNCEMENT_LIMIT_PER_CAT);
    cards.push(categoryCardTemplate(catId, catName, list));
  }

  // 2) 未分類或找不到對應 categoryId 的
  const leftovers = byCatId.get("__uncategorized__") || [];
  if (leftovers.length) {
    const list = leftovers.slice(0, ANNOUNCEMENT_LIMIT_PER_CAT);
    cards.push(categoryCardTemplate("__uncategorized__", "未分類", list));
  }

  categoryGrid.innerHTML = cards.join("");
}

function categoryCardTemplate(catId, catName, list) {
  const body = list.length
    ? list.map(a => annRowTemplate(a)).join("")
    : `<div class="text-muted py-3 text-center">此分類目前沒有公告</div>`;

  // 這裡的「查看全部」使用查詢參數跳轉，可在另一頁或本頁讀取 ?category=catId 來做完整清單
  const allHref = `announcement-list.html?category=${encodeURIComponent(catId)}`;

  return `
    <article class="cat-card">
      <header class="cat-head">
        <div class="cat-name"><i class="fa-solid fa-folder-open me-2"></i>${escapeHTML(catName)}</div>
        <a class="view-all" href="${allHref}" title="查看全部">查看全部</a>
      </header>
      <div class="cat-body">
        ${body}
      </div>
    </article>
  `;
}

function annRowTemplate(a) {
  return `
    <div class="ann-row">
      <div class="ann-dot"></div>
      <a class="ann-title" href="announcement-view.html?id=${a.id}">${escapeHTML(a.title)}</a>
      <div class="ann-meta">${escapeHTML(a.categoryName || "未分類")} ・ ${toTWDateTime(a.createdAt)}</div>
    </div>
  `;
}

function toTWDateTime(date) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  } catch {
    return new Date(date).toLocaleString("zh-TW");
  }
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}
