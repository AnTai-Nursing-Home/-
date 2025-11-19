document.addEventListener('DOMContentLoaded', function() {
    // --- 元件宣告 ---
    const passwordSection = document.getElementById('password-section');
    const dashboardSection = document.getElementById('dashboard-section');
// removed booking-list:     const resultsSection = document.getElementById('results-section');
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
// removed booking-list:     const showBookingsBtn = document.getElementById('show-bookings-btn');
// removed booking-list:     const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
// removed booking-list:     const bookingListContainer = document.getElementById('booking-list');

    // --- 登入邏輯 (不需要等待 Firebase) ---
    async function handleLogin() {
        // ✅ 新增：未勾選不得登入
        const privacyCheck = document.getElementById('privacyCheck');
        if (!privacyCheck.checked) {
            alert("請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》");
            return;
        }
        const password = passwordInput.value;
        if (!password) { alert('請輸入密碼'); return; }
        loginButton.disabled = true;
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                passwordSection.classList.add('d-none');
                dashboardSection.classList.remove('d-none');
                errorMessage.classList.add('d-none');
            } else {
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('登入時發生錯誤:', error);
            alert('登入時發生網路錯誤，請稍後再試。');
        } finally {
            loginButton.disabled = false;
        }
    }

    if (loginButton) { loginButton.addEventListener('click', handleLogin); }
    if (passwordInput) { passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleLogin(); }); }

    // --- 需要 Firebase 的功能，在 firebase-ready 後才綁定 ---
    document.addEventListener('firebase-ready', () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'dashboard') {
            passwordSection.classList.add('d-none');
            dashboardSection.classList.remove('d-none');
        }

        /* removed booking-list function:
// removed booking-list: async function displayBookings() {
            bookingListContainer.innerHTML = '讀取中...';
            try {
                const todayString = new Date().toISOString().split('T')[0];
                const snapshot = await db.collection('bookings')
                    .where('date', '>=', todayString)
                    .orderBy('date', 'asc')
                    .orderBy('time', 'asc')
                    .get();

                const bookingsByDate = {};
                snapshot.forEach(doc => {
                    const booking = { id: doc.id, ...doc.data() };
                    if (!bookingsByDate[booking.date]) bookingsByDate[booking.date] = [];
                    bookingsByDate[booking.date].push(booking);
                });

                const upcomingDates = Object.keys(bookingsByDate).sort();
                if (upcomingDates.length === 0) {
                    bookingListContainer.innerHTML = '<p class="text-center">目前沒有未來或今日的預約紀錄。</p>';
                    return;
                }

                let html = '';
                upcomingDates.forEach(date => {
                    html += `<h4>${date}</h4>`;
                    html += `<table class="table table-bordered table-striped table-hover"><thead class="table-light"><tr><th>時段</th><th>住民姓名</th><th>床號</th><th>家屬姓名</th><th>與住民關係</th><th>聯絡電話</th><th>操作</th></tr></thead><tbody>`;
                    bookingsByDate[date].forEach(booking => {
                        html += `<tr><td>${booking.time}</td><td>${booking.residentName}</td><td>${booking.bedNumber}</td><td>${booking.visitorName}</td><td>${booking.visitorRelationship || '未填寫'}</td><td>${booking.visitorPhone}</td><td><button class="btn btn-sm btn-danger btn-admin-delete" data-id="${booking.id}">刪除</button></td></tr>`;
                    });
                    html += `</tbody></table>`;
                });
                bookingListContainer.innerHTML = html;
            } catch (error) {
                console.error("讀取預約列表失敗:", error);
                bookingListContainer.innerHTML = '<div class="alert alert-danger">讀取預約列表失敗，請重新整理頁面。</div>';
            }
        }

// removed booking-list:         if (showBookingsBtn) { showBookingsBtn.addEventListener('click', (e) => { e.preventDefault(); dashboardSection.classList.add('d-none'); resultsSection.classList.remove('d-none'); displayBookings(); }); }
// removed booking-list:         if (backToDashboardBtn) { backToDashboardBtn.addEventListener('click', () => { resultsSection.classList.add('d-none'); dashboardSection.classList.remove('d-none'); }); }
// removed booking-list:         if (bookingListContainer) { bookingListContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-admin-delete')) {
                const docId = e.target.dataset.id;
                if (confirm(`確定要刪除這筆預約嗎？\n此操作無法復原。`)) {
                    try {
                        e.target.disabled = true;
                        await db.collection('bookings').doc(docId).delete();
                        alert('預約已刪除！');
// removed booking-list:                         displayBookings();
                    } catch (error) {
                        console.error("管理員刪除失敗:", error);
                        alert("刪除失敗，請稍後再試。");
                        e.target.disabled = false;
                    }
                }
            }
        }); }
    });
}
*/
    });
});
