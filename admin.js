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

    // displayBookings 函式維持不變...
    function displayBookings() {
        const bookings = JSON.parse(localStorage.getItem('bookings')) || {};
        const dates = Object.keys(bookings).sort();
        if (dates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有任何預約紀錄。</p>';
            return;
        }
        let html = '';
        dates.forEach(date => {
            const today = new Date().toISOString().split('T')[0];
            if (date < today) return;
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
