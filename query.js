document.addEventListener('firebase-ready', () => {
    const queryNameInput = document.getElementById('queryNameInput');
    if (!queryNameInput) return;

    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('admin.html')) {
        backButtonGeneral.href = 'admin.html?view=dashboard';
        const icon = backButtonGeneral.querySelector('i');
        backButtonGeneral.innerHTML = '';
        if (icon) backButtonGeneral.appendChild(icon);
        backButtonGeneral.append(` ${getText ? getText('back_to_dashboard') : '返回儀表板'}`);
    }
    
    const searchButton = document.getElementById('searchButton');
    const queryResultsContainer = document.getElementById('queryResults');

    function displaySearchResults(results) {
        if (!results || results.length === 0) {
            queryResultsContainer.innerHTML = `<p class="text-center text-muted">${getText ? getText('no_records_found') : '查無相關預約紀錄。'}</p>`;
            return;
        }
        let html = '<ul class="list-group">';
        results.forEach(b => {
            const res = b.residentName || '';
            const vis = b.visitorName || '';
            html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${b.date} ${b.time}</strong><br>
                            <small>住民：${res}　/　家屬：${vis}</small>
                        </div>
                        <button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">${getText ? getText('cancel') : '取消'}</button>
                    </li>`;
        });
        html += '</ul>';
        queryResultsContainer.innerHTML = html;
    }

    function normalize(str) {
        return String(str || '').trim();
    }

    async function performSearch() {
        const name = normalize(queryNameInput.value);
        if (!name) {
            alert(getText ? (getText('please_fill_resident_name') || '請輸入姓名！') : '請輸入姓名！');
            return;
        }
        queryResultsContainer.innerHTML = getText ? getText('querying') : '查詢中...';
        try {
            const today = new Date().toISOString().split('T')[0];

            // 以日期做伺服器端篩選與排序，名稱在前端做部分比對，避免索引需求
            const snapshot = await db.collection('bookings')
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();

            const foundBookings = [];
            const kw = name;
            snapshot.forEach(doc => {
                const data = doc.data() || {};
                const rName = normalize(data.residentName);
                const vName = normalize(data.visitorName);
                // 支援「住民姓名」或「家屬姓名」的包含式比對
                if (rName.includes(kw) || vName.includes(kw)) {
                    foundBookings.push({ id: doc.id, ...data });
                }
            });

            displaySearchResults(foundBookings);
        } catch (error) {
            console.error("查詢失敗:", error);
            queryResultsContainer.innerHTML = `<div class="alert alert-danger">${getText ? getText('query_failed') : '查詢失敗，請稍後再試。'}</div>`;
        }
    }

    searchButton.addEventListener('click', performSearch);
    queryNameInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    queryResultsContainer.addEventListener('click', async function(e) {
        if (e.target.classList.contains('btn-cancel')) {
            if (confirm(getText ? getText('confirm_cancel_booking') : '您確定要取消這個預約嗎？')) {
                const docId = e.target.dataset.id;
                try {
                    e.target.disabled = true;
                    await db.collection('bookings').doc(docId).delete();
                    alert(getText ? getText('booking_cancelled_success') : '預約已成功取消！');
                    performSearch();
                } catch (error) {
                    console.error("刪除失敗:", error);
                    alert(getText ? getText('delete_failed') : '刪除失敗，請稍後再試。');
                    e.target.disabled = false;
                }
            }
        }
    });
});
