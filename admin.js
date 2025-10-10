document.addEventListener('DOMContentLoaded', function() {
    const passwordSection = document.getElementById('password-section');
    const resultsSection = document.getElementById('results-section');
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const bookingListContainer = document.getElementById('booking-list');
    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            alert('請輸入密碼');
            return;
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: password }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                passwordSection.classList.add('d-none');
                resultsSection.classList.remove('d-none');
                errorMessage.classList.add('d-none');
                displayBookings();
            } else {
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
    function displayBookings() {
        let bookings = JSON.parse(localStorage.getItem('bookings')) || {};
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
            console.log('正在清理過期預約:', datesToDelete);
            datesToDelete.forEach(date => {
                delete bookings[date];
            });
            localStorage.setItem('bookings', JSON.stringify(bookings));
        }
        const dates = Object.keys(bookings).sort();
        if (dates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有任何預約紀錄。</p>';
            return;
        }
        let html = '';
        dates.forEach(date => {
            const currentDate = new Date().toISOString().split('T')[0];
            if (date < currentDate) return;
            html += `<h4>${date}</h4>`;
            html += `<table class="table table-bordered table-striped table-hover"><thead class="table-light"><tr><th>時段</th><th>住民姓名</th><th>床號</th><th>家屬姓名</th><th>與住民關係</th><th>聯絡電話</th></tr></thead><tbody>`;
            const times = Object.keys(bookings[date]).sort();
            times.forEach(time => {
                bookings[date][time].forEach(booking => {
                    html += `<tr><td>${time}</td><td>${booking.residentName}</td><td>${booking.bedNumber}</td><td>${booking.visitorName}</td><td>${booking.visitorRelationship || '未填寫'}</td><td>${booking.visitorPhone}</td></tr>`;
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
