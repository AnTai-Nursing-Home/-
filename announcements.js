const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {
  loadCategories();
  loadAnnouncements();
  loadMarquee();

  document.getElementById("category-filter").addEventListener("change", e => {
    loadAnnouncements(e.target.value);
  });

  document.getElementById("reset-filter").addEventListener("click", () => {
    document.getElementById("category-filter").value = "";
    loadAnnouncements();
  });
});

async function loadCategories() {
  const select = document.getElementById("category-filter");
  select.innerHTML = `<option value="">選擇分類</option>`;
  const snap = await db.collection("announcementCategories").get();
  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.data().name;
    opt.textContent = doc.data().name;
    select.appendChild(opt);
  });
}

async function loadAnnouncements(category = "") {
  const list = document.getElementById("announcement-list");
  list.innerHTML = "";
  let query = db.collection("announcements").orderBy("createdAt", "desc");
  if (category) query = query.where("category", "==", category);
  const snap = await query.get();

  snap.forEach(doc => {
    const d = doc.data();
    const item = document.createElement("div");
    item.className = "list-group-item";
    item.innerHTML = `
      <h5>${d.title}</h5>
      <p class="mb-1">${d.content}</p>
      <small class="text-muted">${d.category || ""}　${d.createdAt?.toDate().toLocaleString() || ""}</small>
    `;
    list.appendChild(item);
  });
}

async function loadMarquee() {
  const marqueeEl = document.getElementById("marquee");
  const snap = await db.collection("announcements").where("isMarquee", "==", true).orderBy("createdAt", "desc").limit(1).get();
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
}
