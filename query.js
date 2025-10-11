document.addEventListener('firebase-ready', () => {
    // 透過尋找 queryPhoneInput 來判斷是否在查詢頁面
    const queryPhoneInput = document.getElementById('queryPhoneInput');
    if (!queryPhoneInput) return;

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('admin.html')) {
        backButtonGeneral.href = 'admin.html?view=dashboard';
        const icon = backButtonGeneral.querySelector('i');
        backButtonGeneral.innerHTML = '';
        backButtonGeneral.appendChild(icon);
        backButtonGeneral.append(' 返回儀表板');
    }
    
    const searchButton = document.getElementById('searchButton');
    const queryResultsContainer = document.getElementById('queryResults');

    function displaySearchResults(results) {
        if (results.length === 0) {
            queryResultsContainer.innerHTML = '<p class="text-center text-muted">查無相關預約紀錄。</p>';
            return;
        }
        let html = '<ul class="list-group">';
        results.forEach(b => {
            html += `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${b.date} ${b.time}</strong><br><small>住民: ${b.residentName} / 家屬: ${b.visitorName}</small></div><button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">取消預約</button></li>`;
        });
        html += '</ul>';
        queryResultsContainer.innerHTML = html;
    }

    async function performSearch() {
        const phone = queryPhoneInput.value.trim();
        if (!phone) {
            alert('請輸入電話號碼！');
            return;
        }
        queryResultsContainer.innerHTML = '查詢中...';
        try {
            const today = new Date().toISOString().split('T')[0];
            const snapshot = await db.collection('bookings')
                .where('visitorPhone', '==', phone)
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();
            const foundBookings = [];
            snapshot.forEach(doc => {
                foundBookings.push({ id: doc.id, ...doc.data() });
            });
            displaySearchResults(foundBookings);
        } catch (error) {
            console.error("查詢失敗:", error);
            queryResultsContainer.innerHTML = '<div class="alert alert-danger">查詢失敗，請稍後再試。</div>';
        }
    }

    searchButton.addEventListener('click', performSearch);
    queryPhoneInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    queryResultsContainer.addEventListener('click', async function(e) {
        if (e.target.classList.contains('btn-cancel')) {
            const docId = e.target.dataset.id;
            if (confirm(`您確定要取消這個預約嗎？`)) {
                try {
                    e.target.disabled = true;
                    await db.collection('bookings').doc(docId).delete();
                    alert('預約已成功取消！');
                    performSearch();
                } catch (error) {
                    console.error("刪除失敗:", error);
                    alert("刪除失敗，請稍後再試。");
                    e.target.disabled = false;
                }
            }
        }
    });
});
