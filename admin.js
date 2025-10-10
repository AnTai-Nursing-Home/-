document.addEventListener('DOMContentLoaded', function() {
    // --- 元件宣告 ---
    const passwordSection = document.getElementById('password-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const resultsSection = document.getElementById('results-section');
    
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    
    const showBookingsBtn = document.getElementById('show-bookings-btn');
    const showSuppliesBtn = document.getElementById('show-supplies-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    
    const bookingListContainer = document.getElementById('booking-list');
    
    // --- 函式定義 ---
    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            alert('請輸入密碼');
            return;
        }
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
        }
    }

    function displayBookings() {
        let bookings = JSON.parse(localStorage.getItem('bookings')) || {};

        // 過期資料清理
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const datesToDelete = [];
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        Object.keys(bookings).forEach(date => {
            const bookingDate = new Date(date);
            const timeDifference = today.getTime() - bookingDate.getTime();
            if (timeDifference > thirtyDaysInMs) {
                datesToDelete.push(date);
            }
        });
        if (datesToDelete.length > 0) {
            datesToDelete.forEach(date => { delete bookings[date]; });
            localStorage.setItem('bookings', JSON.stringify(bookings));
        }

        const dates = Object.keys(bookings).sort();
        if (dates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有任何預約紀錄。</p>';
            return;
        }

        let html = '';
        const todayString = new Date().toISOString().split('T')[0];
        
        // 過濾掉已過期的日期，只顯示今天及未來的
        const upcomingDates = dates.filter(date => date >= todayString);

        if (upcomingDates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有未來或今日的預約紀錄。</p>';
            return;
        }

        upcomingDates.forEach(date => {
            html += `<h4>${date}</h4>`;
            html += `<table class="table table-bordered table-striped table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>時段</th>
                                <th>住民姓名</th>
                                <th>床號</th>
                                <th>家屬姓名</th>
                                <th>與住民關係</th>
                                <th>聯絡電話</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            const times = Object.keys(bookings[date]).sort();
            times.forEach(time => {
                bookings[date][time].forEach(booking => {
                    html += `<tr>
                                <td>${time}</td>
                                <td>${booking.residentName}</td>
                                <td>${booking.bedNumber}</td>
                                <td>${booking.visitorName}</td>
                                <td>${booking.visitorRelationship || '未填寫'}</td>
                                <td>${booking.visitorPhone}</td>
                                <td>
                                    <button class="btn btn-sm btn-danger btn-admin-delete"
                                            data-date="${date}"
                                            data-time="${time}"
                                            data-timestamp="${booking.timestamp}">
                                        刪除
                                    </button>
                                </td>
                            </tr>`;
                });
            });
            html += `</tbody></table>`;
        });
        bookingListContainer.innerHTML = html;
    }
    
    // --- 事件監聽器 ---
    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleLogin(); });

    showBookingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dashboardSection.classList.add('d-none');
        resultsSection.classList.remove('d-none');
        displayBookings();
    });

    showSuppliesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('衛材點班功能開發中...');
    });

    backToDashboardBtn.addEventListener('click', () => {
        resultsSection.classList.add('d-none');
        dashboardSection.classList.remove('d-none');
    });

    bookingListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-admin-delete')) {
            const button = e.target;
            const date = button.dataset.date;
            const time = button.dataset.time;
            const timestamp = button.dataset.timestamp;

            if (confirm(`確定要刪除 ${date} ${time} 的這筆預約嗎？\n此操作無法復原。`)) {
                let bookings = JSON.parse(localStorage.getItem('bookings')) || {};
                
                const bookingsForSlot = bookings[date]?.[time];
                if (!bookingsForSlot) return;

                const indexToDelete = bookingsForSlot.findIndex(b => b.timestamp === timestamp);
                
                if (indexToDelete > -1) {
                    bookingsForSlot.splice(indexToDelete, 1);
                    if (bookingsForSlot.length === 0) delete bookings[date][time];
                    if (Object.keys(bookings[date] || {}).length === 0) delete bookings[date];

                    localStorage.setItem('bookings', JSON.stringify(bookings));
                    alert('預約已刪除！');
                    
                    displayBookings();
                }
            }
        }
    });
});
