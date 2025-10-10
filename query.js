document.addEventListener('DOMContentLoaded', function() {
    const queryPhoneInput = document.getElementById('queryPhoneInput');
    const searchButton = document.getElementById('searchButton');
    const queryResultsContainer = document.getElementById('queryResults');
    let bookings = JSON.parse(localStorage.getItem('bookings')) || {};

    function displaySearchResults(results) {
        if (results.length === 0) {
            queryResultsContainer.innerHTML = '<p class="text-center text-muted">查無相關預約紀錄。</p>';
            return;
        }

        let html = '<ul class="list-group">';
        results.forEach(b => {
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${b.date} ${b.time}</strong><br>
                        <small>住民: ${b.residentName} / 家屬: ${b.visitorName}</small>
                    </div>
                    <button class="btn btn-danger btn-sm btn-cancel" 
                            data-date="${b.date}" 
                            data-time="${b.time}" 
                            data-timestamp="${b.timestamp}">
                        取消預約
                    </button>
                </li>
            `;
        });
        html += '</ul>';
        queryResultsContainer.innerHTML = html;
    }

    function performSearch() {
        const phone = queryPhoneInput.value.trim();
        if (!phone) {
            alert('請輸入電話號碼！');
            return;
        }

        const foundBookings = [];
        const today = new Date().toISOString().split('T')[0];
        
        Object.keys(bookings).forEach(date => {
            if (date >= today) { // 只搜尋今天及未來的
                Object.keys(bookings[date]).forEach(time => {
                    bookings[date][time].forEach(booking => {
                        if (booking.visitorPhone === phone) {
                            foundBookings.push({ date, time, ...booking });
                        }
                    });
                });
            }
        });

        displaySearchResults(foundBookings);
    }

    searchButton.addEventListener('click', performSearch);
    queryPhoneInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    queryResultsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-cancel')) {
            const button = e.target;
            const date = button.dataset.date;
            const time = button.dataset.time;
            const timestamp = button.dataset.timestamp;

            if (confirm(`您確定要取消 ${date} ${time} 的預約嗎？`)) {
                const bookingsForSlot = bookings[date][time];
                const indexToDelete = bookingsForSlot.findIndex(b => b.timestamp === timestamp);
                
                if (indexToDelete > -1) {
                    bookingsForSlot.splice(indexToDelete, 1);
                    if (bookingsForSlot.length === 0) delete bookings[date][time];
                    if (Object.keys(bookings[date]).length === 0) delete bookings[date];
                    
                    localStorage.setItem('bookings', JSON.stringify(bookings));
                    alert('預約已成功取消！');
                    
                    // 重新載入 bookings 資料並再次執行搜尋，以更新畫面
                    bookings = JSON.parse(localStorage.getItem('bookings')) || {};
                    performSearch();
                }
            }
        }
    });
});
