document.addEventListener('firebase-ready', () => {
    // 頁面偵測
    const announcementsTableBody = document.getElementById('announcements-table-body');
    if (!announcementsTableBody) return;

    // --- 元件宣告 ---
    const categoryList = document.getElementById('category-list');
    const categoryForm = document.getElementById('category-form');
    const categoryNameInput = document.getElementById('category-name');
    const addAnnouncementBtn = document.getElementById('add-announcement-btn');
    const announcementModalEl = document.getElementById('announcement-modal');
    const announcementModal = new bootstrap.Modal(announcementModalEl);
    const announcementModalTitle = document.getElementById('announcement-modal-title');
    const saveAnnouncementBtn = document.getElementById('save-announcement-btn');
    const announcementForm = document.getElementById('announcement-form');
    const announcementIdInput = document.getElementById('announcement-id');
    const announcementTitleInput = document.getElementById('announcement-title');
    const announcementCategorySelect = document.getElementById('announcement-category');
    const announcementContentInput = document.getElementById('announcement-content');
    const announcementMarqueeCheckbox = document.getElementById('announcement-marquee');

    // --- 變數 ---
    const categoriesCollection = 'announcement_categories';
    const announcementsCollection = 'announcements';
    let categoriesCache = {};

    // --- 分類管理 (Categories) ---
    async function loadCategories() {
        categoriesCache = {};
        categoryList.innerHTML = `<p>${getText('loading')}</p>`;
        announcementCategorySelect.innerHTML = `<option value="">${getText('loading')}</option>`;
        
        try {
            const snapshot = await db.collection(categoriesCollection).orderBy('name').get();
            let listHTML = '';
            let selectHTML = `<option value="">未分類</option>`;
            
            if (snapshot.empty) {
                listHTML = `<p class="text-muted">尚無分類。</p>`;
            } else {
                snapshot.forEach(doc => {
                    const category = doc.data();
                    categoriesCache[doc.id] = category;
                    listHTML += `
                        <div class="category-list-item" data-id="${doc.id}">
                            <span>${category.name}</span>
                            <button class="btn btn-sm btn-danger btn-delete-category"><i class="fas fa-trash"></i></button>
                        </div>`;
                    selectHTML += `<option value="${doc.id}">${category.name}</option>`;
                });
            }
            categoryList.innerHTML = listHTML;
            announcementCategorySelect.innerHTML = selectHTML;
        } catch (error) {
            console.error("讀取分類失敗:", error);
            categoryList.innerHTML = `<p class="text-danger">${getText('read_failed')}</p>`;
        }
    }

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = categoryNameInput.value.trim();
        if (!categoryName) return;
        
        try {
            await db.collection(categoriesCollection).add({ name: categoryName });
            categoryNameInput.value = '';
            loadCategories();
            loadAnnouncements(); // 重新載入公告，以防分類名稱更新
        } catch (error) {
            alert(getText('save_failed'));
        }
    });

    categoryList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.btn-delete-category');
        if (deleteBtn) {
            const item = deleteBtn.closest('.category-list-item');
            const docId = item.dataset.id;
            const categoryName = item.querySelector('span').textContent;
            
            if (confirm(getText('confirm_delete_category', { name: categoryName }))) {
                try {
                    await db.collection(categoriesCollection).doc(docId).delete();
                    loadCategories();
                    loadAnnouncements();
                } catch (error) {
                    alert(getText('delete_failed'));
                }
            }
        }
    });

    // --- 公告管理 (Announcements) ---
    async function loadAnnouncements() {
        announcementsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">${getText('loading')}</td></tr>`;
        try {
            const snapshot = await db.collection(announcementsCollection).orderBy('timestamp', 'desc').get();
            if (snapshot.empty) {
                announcementsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">尚無公告。</td></tr>`;
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const categoryName = data.categoryId ? (categoriesCache[data.categoryId]?.name || '分類已刪除') : '未分類';
                const isMarquee = data.isMarquee ? '是' : '否';
                html += `
                    <tr data-id="${doc.id}">
                        <td>${data.title}</td>
                        <td>${categoryName}</td>
                        <td>${isMarquee}</td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-edit-announcement">編輯</button>
                            <button class="btn btn-sm btn-danger btn-delete-announcement">刪除</button>
                        </td>
                    </tr>
                `;
            });
            announcementsTableBody.innerHTML = html;
        } catch (error) {
            console.error("讀取公告失敗:", error);
            announcementsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${getText('read_failed')}</td></tr>`;
        }
    }

    addAnnouncementBtn.addEventListener('click', () => {
        announcementForm.reset();
        announcementIdInput.value = '';
        announcementModalTitle.textContent = getText('add_announcement');
        announcementModal.show();
    });

    announcementsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const docId = row.dataset.id;

        if (target.classList.contains('btn-edit-announcement')) {
            try {
                const doc = await db.collection(announcementsCollection).doc(docId).get();
                if (doc.exists) {
                    const data = doc.data();
                    announcementIdInput.value = doc.id;
                    announcementTitleInput.value = data.title;
                    announcementCategorySelect.value = data.categoryId || '';
                    announcementContentInput.value = data.content;
                    announcementMarqueeCheckbox.checked = data.isMarquee || false;
                    announcementModalTitle.textContent = '編輯公告';
                    announcementModal.show();
                }
            } catch (error) {
                alert(getText('read_failed'));
            }
        }
        if (target.classList.contains('btn-delete-announcement')) {
            if (confirm(getText('confirm_delete_announcement'))) {
                try {
                    await db.collection(announcementsCollection).doc(docId).delete();
                    loadAnnouncements();
                } catch (error) {
                    alert(getText('delete_failed'));
                }
            }
        }
    });

    saveAnnouncementBtn.addEventListener('click', async () => {
        const id = announcementIdInput.value;
        const title = announcementTitleInput.value.trim();
        const content = announcementContentInput.value.trim();
        const categoryId = announcementCategorySelect.value;
        const isMarquee = announcementMarqueeCheckbox.checked;

        if (!title || !content) {
            alert(getText('error_fill_all_fields'));
            return;
        }

        saveAnnouncementBtn.disabled = true;
        try {
            const dataToSave = {
                title,
                content,
                categoryId: categoryId || null,
                isMarquee,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (id) {
                // 編輯
                await db.collection(announcementsCollection).doc(id).update(dataToSave);
            } else {
                // 新增
                await db.collection(announcementsCollection).add(dataToSave);
            }
            announcementModal.hide();
            loadAnnouncements();
        } catch (error) {
            alert(getText('save_failed'));
        } finally {
            saveAnnouncementBtn.disabled = false;
        }
    });

    // --- 初始操作 ---
    async function initializePage() {
        await loadCategories();
        loadAnnouncements();
    }
    
    initializePage();
});
