document.addEventListener('DOMContentLoaded', function() {
    // 前端不再儲存任何密碼！
    
    const passwordSection = document.getElementById('password-section');
    const resultsSection = document.getElementById('results-section');
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const bookingListContainer = document.getElementById('booking-list');

    // 將登入函式改為異步 (async) 以便使用 fetch
    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            alert('請輸入密碼');
            return;
        }

        try {
            // 將密碼發送到我們的後端 API (/api/login)
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: password }),
            });

            // 解析後端回傳的結果
            const result = await response.json();

            if (response.ok && result.success) {
                // 後端說密碼正確
                passwordSection.classList.add('d-none');
                resultsSection.classList.remove('d-none');
                errorMessage.classList.add('d-none');
                displayBookings();
            } else {
                // 後端說密碼錯誤
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('登入時發生錯誤:', error);
            alert('登入時發生網路錯誤，請稍後再試。');
        }
    }

    loginButton.addEventListener('click', handleLogin);
    
    passwordInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });

    // 清理並顯示預約資料的函式
    function displayBookings() {
        let bookings = JSON.parse(localStorage.getItem('bookings')) || {};

        // ===============================================================
        // ==== START: 新增 - 過期預約自動清理邏輯 ====
        // ===============================================================
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 將時間標準化為今日凌晨0點

        const datesToDelete = [];
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒數

        // 找出所有超過30天的預約日期
        Object.keys(bookings).forEach(date => {
            const bookingDate = new Date(date);
            const timeDifference = today.getTime() - bookingDate.getTime();

            // 如果預約日期比今天早，且差距超過30天
            if (timeDifference > thirtyDaysInMs) {
                datesToDelete.push(date);
            }
        });

        // 如果有需要刪除的日期，就執行刪除並更新儲存
        if (datesToDelete.length > 0) {
            console.log('正在清理過期預約:', datesToDelete);
            datesToDelete.forEach(date => {
                delete bookings[date];
            });
            localStorage.setItem('bookings', JSON.stringify(bookings));
        }
        // ===============================================================
        // ==== END: 過期預約自動清理邏輯 ====
        // ===============================================================

        const dates = Object.keys(bookings).sort();
        if (dates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有任何預約紀錄。</p>';
            return;
        }

        let html = '';
        // 我們只顯示今天及未來的預約，但過期的資料已在上方被清理
        dates.forEach(date => {
            const currentDate = new Date().toISOString().split('T')[0];
            if (date < currentDate) return; // 僅顯示今天及未來的預約

            html += `<h4>${date}</h4>`;
            html += `<table class="table table-bordered table-striped table-hover"><thead class="table-light"><tr><th>時段</th><th>住民姓名</th><th>床號</th><th>家屬姓名</th><th>聯絡電話</th></tr></thead><tbody>`;
            const times = Object.keys(bookings[date]).sort();
            times.forEach(time => {
                bookings[date][time].forEach(booking => {
                    html += `<tr><td>${time}</td><td>${booking.residentName}</td><td>${booking.bedNumber}</td><td>${booking.visitorName}</td><td>${booking.visitorPhone}</td></tr>`;
                });
            });
            html += `</tbody></table>`;
        });

        if (html === '') {
             bookingListContainer.innerHTML = '<p class="text-center">目前沒有未來或今日的預約紀錄。</p>';
        } else {
            bookingListContainer.innerHTML = html;
        }
    }
});
