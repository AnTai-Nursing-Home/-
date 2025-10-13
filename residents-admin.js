document.addEventListener('firebase-ready', () => {
    const residentsTableBody = document.getElementById('residents-table-body');
    if (!residentsTableBody) return;

    const collectionName = 'residents';

    async function loadAndRenderResidents() {
        residentsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">讀取中...</td></tr>';
        try {
            const snapshot = await db.collection(collectionName).orderBy('bedNumber').get();
            
            if (snapshot.empty) {
                residentsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">尚無住民資料，請點擊「新增住民」開始建立。</td></tr>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const resident = doc.data();
                html += `
                    <tr>
                        <td>${doc.id}</td>
                        <td>${resident.bedNumber || ''}</td>
                        <td>${resident.gender || ''}</td>
                        <td>${resident.birthday || ''}</td>
                        <td>${resident.checkinDate || ''}</td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-edit" data-id="${doc.id}">編輯</button>
                            <button class="btn btn-sm btn-danger btn-delete" data-id="${doc.id}">刪除</button>
                        </td>
                    </tr>
                `;
            });
            residentsTableBody.innerHTML = html;

        } catch (error) {
            console.error("讀取住民資料失敗:", error);
            residentsTableBody.innerHTML = '<tr><td colspan="6"><div class="alert alert-danger">讀取資料失敗，請重新整理頁面。</div></td></tr>';
        }
    }

    // 頁面載入時立即執行
    loadAndRenderResidents();
});
