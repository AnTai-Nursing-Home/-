document.addEventListener('DOMContentLoaded', function() {
    // ===============================================================
    // ==== 已更新為您提供的住民名單 ====
    const residentDatabase = {
        "楊仲富": "101-1", "洪坤玉": "101-2", "古金山": "102-1", "張元耀": "102-2", "許明通": "103-1",
        "阮茂松": "103-2", "蔡調榮": "105-1", "潘樹杉": "105-2", "阮麗華": "106-2", "林秋豊": "107-1",
        "洪輝童": "108-1", "王萬福": "108-2", "黃桂女": "109-1", "黃蕭琴": "109-2", "林瑞滿": "110-1",
        "鄭錦足": "110-2", "吳葉聰霞": "111-1", "謝美": "111-2", "洪周金好": "112-1", "陳秀美大": "112-2",
        "陳秀美": "115-1", "呂蕭秀琴": "115-2", "林麗香": "116-1", "孔伍櫻桃": "116-2", "王慧雅": "202-1",
        "賴淑芬": "202-2", "潘麗珍": "203-2", "吳邱芳梅": "206-1", "莊雪娥": "206-2", "王文賢": "207-1",
        "戴榮興": "207-2", "穆顯侗": "208-1", "黃萬吉": "208-2", "黃亮達": "208-3", "曾和成": "208-5",
        "陳佳駿": "209-1", "李閏源": "209-2", "林麗真": "210-1", "蔡郭米": "210-2", "呂曾芳妹": "210-3",
        "余劉春花": "210-5", "李秀花": "211-1", "王葉招枝": "211-2", "洪清富": "213-1", "邱文標": "213-2",
        "鄞進發": "215-1", "郭蜜琴": "217-1", "高葉銀成": "217-2", "紀余日仔": "217-3", "許陳金鉛": "217-5",
        "王蘇罔腰": "218-1", "王玉蘭": "218-2", "葉曾順妹": "218-3", "鄭張貴英": "218-5", "許謝運珍": "219-1",
        "潘陳採綢": "219-2", "王秀珠": "219-3", "張秋淑": "219-5", "潘張清雲": "219-6", "曾光亮": "220-1",
        "杜典崑": "220-2", "王進武": "221-1", "陳寶財": "221-2", "楊受滿": "221-3", "許居鎰": "303-1",
        "許坤忠": "303-2", "黃國清": "303-3", "郭良吉": "303-5", "許湘玲": "305-1", "李職如": "306-1",
        "朱全明": "307-1", "潘景宏": "308-1", "曾清火": "308-2", "林烈雲": "309-1", "葉正良": "309-2",
        "張梅心": "311-1", "許陳菊季": "311-2", "林黃金枝": "311-3", "陳林金枝": "311-5", "邱桂英": "312-1",
        "潘郁豐": "312-2", "宋進興": "312-3", "賴盈賢": "312-5", "林泰安": "312-6", "林文立": "313-1",
        "張元平": "313-2", "林安允": "313-3", "林楊智": "313-5", "林昌輝": "313-6", "劉藍麗珠": "315-1",
        "王周絲": "315-2", "吳政達": "318-1", "許榮成": "318-2", "測試住民": "501-1"
    };
    // ===============================================================

    // --- 頁面主要元素 ---
    const visitDateInput = document.getElementById('visitDate');
    const timeSlotsContainer = document.getElementById('time-slots');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const bookingForm = document.getElementById('bookingForm');
    const backButton = document.getElementById('backButton');
    const successMessage = document.getElementById('successMessage');
    const selectedTimeDisplay = document.getElementById('selected-time-display');
    const residentNameInput = document.getElementById('residentName');
    const bedNumberInput = document.getElementById('bedNumber');
    const nameFeedback = document.getElementById('nameFeedback');

    // --- 查詢功能所需元素 ---
    const queryPhoneInput = document.getElementById('queryPhoneInput');
    const searchButton = document.getElementById('searchButton');
    const queryResultsContainer = document.getElementById('queryResults');

    const availableTimes = ["14:30", "15:00", "15:30", "16:00", "16:30"];
    const maxBookingsPerSlot = 4;
    let selectedDate = '';
    let selectedTime = '';

    let bookings = JSON.parse(localStorage.getItem('bookings')) || {};

    // --- 初始化日期 ---
    const today = new Date().toISOString().split('T')[0];
    visitDateInput.setAttribute('min', today);
    visitDateInput.value = today;
    selectedDate = today;

    // --- 渲染時段按鈕 ---
    function renderTimeSlots() {
        timeSlotsContainer.innerHTML = '';
        const dateBookings = bookings[selectedDate] || {};
        availableTimes.forEach(time => {
            const count = dateBookings[time] ? dateBookings[time].length : 0;
            const remaining = maxBookingsPerSlot - count;
            const isFull = remaining <= 0;
            const button = document.createElement('button');
            button.className = `btn ${isFull ? 'btn-outline-secondary full' : 'btn-outline-primary'} time-slot`;
            button.textContent = `${time} (剩餘 ${remaining} 組)`;
            button.dataset.time = time;
            if (isFull) {
                button.disabled = true;
                button.textContent = `${time} (已額滿)`;
            }
            timeSlotsContainer.appendChild(button);
        });
    }

    // --- 事件監聽器 ---
    visitDateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        renderTimeSlots();
    });

    timeSlotsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
            selectedTime = e.target.dataset.time;
            selectedTimeDisplay.textContent = `${selectedDate} ${selectedTime}`;
            step1.classList.add('d-none');
            step2.classList.remove('d-none');
        }
    });
    
    backButton.addEventListener('click', () => {
        step2.classList.add('d-none');
        step1.classList.remove('d-none');
        bookingForm.reset();
        residentNameInput.classList.remove('is-valid', 'is-invalid');
        bedNumberInput.value = '';
    });

    residentNameInput.addEventListener('input', function() {
        const name = this.value.trim();
        if (residentDatabase[name]) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
            bedNumberInput.value = residentDatabase[name];
            nameFeedback.textContent = '姓名驗證成功！';
            nameFeedback.className = 'valid-feedback';
        } else {
            this.classList.remove('is-valid');
            this.classList.add('is-invalid');
            bedNumberInput.value = '';
            nameFeedback.textContent = '查無此住民姓名，請確認輸入是否正確。';
            nameFeedback.className = 'invalid-feedback';
        }
    });

    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const residentName = residentNameInput.value.trim();
        if (!residentDatabase[residentName]) {
            alert('住民姓名不正確，無法提交預約！');
            return;
        }
        const newBooking = {
            residentName,
            bedNumber: bedNumberInput.value,
            visitorName: document.getElementById('visitorName').value,
            visitorPhone: document.getElementById('visitorPhone').value,
            timestamp: new Date().toISOString()
        };
        if (!bookings[selectedDate]) bookings[selectedDate] = {};
        if (!bookings[selectedDate][selectedTime]) bookings[selectedDate][selectedTime] = [];
        bookings[selectedDate][selectedTime].push(newBooking);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        
        document.getElementById('confirmDate').textContent = selectedDate;
        document.getElementById('confirmTime').textContent = selectedTime;
        document.getElementById('confirmResidentName').textContent = newBooking.residentName;
        document.getElementById('confirmBedNumber').textContent = newBooking.bedNumber;
        document.getElementById('confirmVisitorName').textContent = newBooking.visitorName;
        document.getElementById('confirmVisitorPhone').textContent = newBooking.visitorPhone;
        step1.classList.add('d-none');
        step2.classList.add('d-none');
        successMessage.classList.remove('d-none');
    });

    // --- 查詢與取消功能邏輯 ---
    searchButton.addEventListener('click', function() {
        const phone = queryPhoneInput.value.trim();
        if (!phone) {
            alert('請輸入電話號碼！');
            return;
        }
        const foundBookings = [];
        const today = new Date().toISOString().split('T')[0];
        Object.keys(bookings).forEach(date => {
            if (date >= today) {
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
    });

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
                    if (bookings[date][time].length === 0) delete bookings[date][time];
                    if (Object.keys(bookings[date]).length === 0) delete bookings[date];
                    localStorage.setItem('bookings', JSON.stringify(bookings));
                    alert('預約已成功取消！');
                    renderTimeSlots();
                    searchButton.click();
                }
            }
        }
    });

    // --- 初始渲染 ---
    renderTimeSlots();

    // --- 檢查 URL 指令並自動開啟查詢視窗 ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'query') {
        const queryModalElement = document.getElementById('queryModal');
        // 確保 Bootstrap Modal 類別存在
        if (typeof bootstrap !== 'undefined') {
            const queryModal = new bootstrap.Modal(queryModalElement);
            queryModal.show();
        }
    }
});
