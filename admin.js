document.addEventListener('DOMContentLoaded', function() {
    // ===============================================================
    // ==== 管理者請在此處設定您的登入密碼 ====
    const ADMIN_PASSWORD = "1060816"; // <-- 請務必修改成您自己的密碼
    // ===============================================================

    const passwordSection = document.getElementById('password-section');
    const resultsSection = document.getElementById('results-section');
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const bookingListContainer = document.getElementById('booking-list');

    // 處理登入事件
    loginButton.addEventListener('click', function() {
        if (passwordInput.value === ADMIN_PASSWORD) {
            // 密碼正確
            passwordSection.classList.add('d-none');
            resultsSection.classList.remove('d-none');
            errorMessage.classList.add('d-none');
            displayBookings();
        } else {
            // 密碼錯誤
            errorMessage.classList.remove('d-none');
        }
    });
    
    // 讓按 Enter 也能觸發登入
    passwordInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            loginButton.click();
        }
    });

    // 顯示預約資料的函式
    function displayBookings() {
        const bookings = JSON.parse(localStorage.getItem('bookings')) || {};
        const dates = Object.keys(bookings).sort(); // 將日期排序

        if (dates.length === 0) {
            bookingListContainer.innerHTML = '<p class="text-center">目前沒有任何預約紀錄。</p>';
            return;
        }

        let html = '';
        dates.forEach(date => {
            // 只顯示今天及未來的預約
            const today = new Date().toISOString().split('T')[0];
            if (date < today) return; // 如果日期比今天早，就跳過不顯示

            html += `<h4>${date}</h4>`;
            html += `
                <table class="table table-bordered table-striped table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>時段</th>
                            <th>住民姓名</th>
                            <th>床號</th>
                            <th>家屬姓名</th>
                            <th>聯絡電話</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            const times = Object.keys(bookings[date]).sort(); // 將時段排序
            times.forEach(time => {
                bookings[date][time].forEach(booking => {
                    html += `
                        <tr>
                            <td>${time}</td>
                            <td>${booking.residentName}</td>
                            <td>${booking.bedNumber}</td>
                            <td>${booking.visitorName}</td>
                            <td>${booking.visitorPhone}</td>
                        </tr>
                    `;
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
