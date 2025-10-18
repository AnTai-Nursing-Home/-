let dbReady = false;

document.addEventListener("firebase-ready", () => {
  dbReady = true;
  loadAnnouncements();
});

async function saveAnnouncement() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const category = document.getElementById("category").value.trim() || "未分類";
  const imageFile = document.getElementById("imageFile").files[0];

  if (!title || !content) {
    alert("請輸入公告標題與內容！");
    return;
  }

  let imageUrl = "";

  try {
    // ✅ 如果有上傳圖片，先存到 Firebase Storage
    if (imageFile) {
      const storageRef = firebase.storage().ref(`announcements/${Date.now()}_${imageFile.name}`);
      await storageRef.put(imageFile);
      imageUrl = await storageRef.getDownloadURL();
    }

    // ✅ 儲存公告到 Firestore
    await db.collection("announcements").add({
      title,
      content,
      category,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ 公告已發布！");
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    document.getElementById("category").value = "";
    document.getElementById("imageFile").value = "";
    loadAnnouncements();

  } catch (error) {
    console.error("❌ 儲存公告時發生錯誤:", error);
    alert("儲存公告失敗！");
  }
}

async function loadAnnouncements() {
  if (!dbReady) return;
  const list = document.getElementById("announcement-tbody"); // ✅ 改成 tbody
  if (!list) {
    console.error("⚠️ 找不到 #announcement-tbody 元素！");
    return;
  }

  list.innerHTML = "<tr><td colspan='5' class='text-center'>載入中...</td></tr>";

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>目前沒有公告。</td></tr>";
      return;
    }

    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const row = document.createElement("tr"); // ✅ tbody → tr
      row.innerHTML = `
        <td>
          <div class="fw-bold">${d.title}</div>
          ${d.imageUrl ? `<img src="${d.imageUrl}" class="img-fluid rounded mt-1" style="max-height:60px;">` : ""}
        </td>
        <td>${d.category || "未分類"}</td>
        <td>${d.createdAt?.toDate().toLocaleString("zh-TW") || ""}</td>
        <td>${d.marquee ? "✅" : "❌"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAnnouncement('${doc.id}')">
            刪除
          </button>
        </td>
      `;
      list.appendChild(row);
    });
  } catch (error) {
    console.error("❌ 載入公告失敗:", error);
    list.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>載入公告時發生錯誤。</td></tr>";
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("確定要刪除此公告嗎？")) return;
  try {
    await db.collection("announcements").doc(id).delete();
    alert("✅ 公告已刪除！");
    loadAnnouncements();
  } catch (error) {
    console.error("❌ 刪除公告時發生錯誤:", error);
    alert("刪除公告失敗！");
  }
}
