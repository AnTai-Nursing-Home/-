
document.addEventListener('firebase-ready', () => {

    // 將空白欄位隱藏（或可改為顯示 "—"），僅動必要邏輯
    
    function fillOrHide(spanId, value, mode='hide') {
        var span = document.getElementById(spanId);
        if (!span) return;
        var li = span.parentElement;
        var empty = !value || (typeof value === 'string' && value.trim() === '');
        if (empty) {
            if (mode === 'dash') { span.textContent = '—'; if (li) li.classList.remove('d-none'); }
            else { span.textContent = ''; if (li) li.classList.add('d-none'); }
        } else {
            span.textContent = value;
            if (li) li.classList.remove('d-none');
        }
    }
    function setLabelForSpan(spanId, i18nKey) {
        var span = document.getElementById(spanId);
        if (!span) return;
        var label = span.previousElementSibling;
        if (label && label.tagName === 'STRONG') {
            if (typeof getText === 'function') { label.textContent = getText(i18nKey); }
            else { label.textContent = i18nKey; }
        }
    }
    function setText(id, value){ var el = document.getElementById(id); if(el) el.textContent = value; }
    function setLabelForSpan(spanId, i18nKey) {
        var span = document.getElementById(spanId);
        if (!span) return;
        var label = span.previousElementSibling; // <strong data-i18n="..."></strong>
        if (label && label.tagName === 'STRONG') {
            if (typeof getText === 'function') { label.textContent = getText(i18nKey); }
            else { label.textContent = i18nKey; }
        }
    }

    function setText(id, value){ var el = document.getElementById(id); if(el) el.textContent = value; }

        var span = document.getElementById(spanId);
        if (!span) return;
        var li = span.parentElement; // 結構為 <li><strong>..</strong> <span id="..."></span></li>
        var empty = !value || (typeof value === 'string' && value.trim() === '');
        if (empty) {
            if (mode === 'dash') { span.textContent = '—'; if (li) li.classList.remove('d-none'); }
            else { span.textContent = ''; if (li) li.classList.add('d-none'); }
        } else {
            span.textContent = value;
            if (li) li.classList.remove('d-none');
        }
    }

    // 透過尋找 bookingForm 來判斷是否在預約頁面
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    // --- 智慧返回按鈕邏輯 ---
    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral) {
        const urlParams = new URLSearchParams(window.location.search);
        if (document.referrer.includes('admin.html') || urlParams.get('mode') === 'admin') {
            backButtonGeneral.href = 'admin.html?view=dashboard';
            const icon = backButtonGeneral.querySelector('i');
            backButtonGeneral.innerHTML = ''; // 清空按鈕內容
            if(icon) backButtonGeneral.appendChild(icon); // 把圖示加回去
            backButtonGeneral.append(` ${getText('back_to_dashboard')}`); // 加上新文字
        }
    }

    const residentDatabase = { "楊仲富": "101-1", "洪坤玉": "101-2", "古金山": "102-1", "張元耀": "102-2", "許明通": "103-1", "阮茂松": "103-2", "蔡調榮": "105-1", "潘樹杉": "105-2", "阮麗華": "106-2", "林秋豊": "107-1", "洪輝童": "108-1", "王萬福": "108-2", "黃桂女": "109-1", "黃蕭琴": "109-2", "林瑞滿": "110-1", "鄭錦足": "110-2", "吳葉聰霞": "111-1", "謝美": "111-2", "洪周金好": "112-1", "陳秀美大": "112-2", "陳秀美": "115-1", "呂蕭秀琴": "115-2", "林麗香": "116-1", "孔伍櫻桃": "116-2", "王慧雅": "202-1", "賴淑芬": "202-2", "潘麗珍": "203-2", "吳邱芳梅": "206-1", "莊雪娥": "206-2", "王文賢": "207-1", "戴榮興": "207-2", "穆顯侗": "208-1", "黃萬吉": "208-2", "黃亮達": "208-3", "曾和成": "208-5", "陳佳駿": "209-1", "李閏源": "209-2", "林麗真": "210-1", "蔡郭米": "210-2", "呂曾芳妹": "210-3", "余劉春花": "210-5", "李秀花": "211-1", "王葉招枝": "211-2", "洪清富": "213-1", "邱文標": "213-2", "鄞進發": "215-1", "郭蜜琴": "217-1", "高葉銀成": "217-2", "紀余日仔": "217-3", "許陳金鉛": "217-5", "王蘇罔腰": "218-1", "王玉蘭": "218-2", "葉曾順妹": "218-3", "鄭張貴英": "218-5", "許謝運珍": "219-1", "潘陳採綢": "219-2", "王秀珠": "219-3", "張秋淑": "219-5", "潘張清雲": "219-6", "曾光亮": "220-1", "杜典崑": "220-2", "王進武": "221-1", "陳寶財": "221-2", "楊受滿": "221-3", "許居鎰": "303-1", "許坤忠": "303-2", "黃國清": "303-3", "郭良吉": "303-5", "許湘玲": "305-1", "李職如": "306-1", "朱全明": "307-1", "潘景宏": "308-1", "曾清火": "308-2", "林烈雲": "309-1", "葉正良": "309-2", "張梅心": "311-1", "許陳菊季": "311-2", "林黃金枝": "311-3", "陳林金枝": "311-5", "邱桂英": "312-1", "潘郁豐": "312-2", "宋進興": "312-3", "賴盈賢": "312-5", "林泰安": "312-6", "林文立": "313-1", "張元平": "313-2", "林安允": "313-3", "林楊智": "313-5", "林昌輝": "313-6", "劉藍麗珠": "315-1", "王周絲": "315-2", "吳政達": "318-1", "許榮成": "318-2", "測試住民": "501-1" };
    const adminNotice = document.getElementById('admin-mode-notice');
    const visitDateInput = document.getElementById('visitDate');
    const timeSlotsContainer = document.getElementById('time-slots');
    const bookingNotice = document.getElementById('booking-notice');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const backButton = document.getElementById('backButton');
    const successMessage = document.getElementById('successMessage');
    const selectedTimeDisplay = document.getElementById('selected-time-display');
    const residentNameInput = document.getElementById('residentName');
    const bedNumberInput = document.getElementById('bedNumber');
    const nameFeedback = document.getElementById('nameFeedback');
    const confirmationModalElement = document.getElementById('confirmationModal');
    const confirmationModal = new bootstrap.Modal(confirmationModalElement);
    const finalSubmitButton = document.getElementById('final-submit-button');
    
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminMode = urlParams.get('mode') === 'admin';
    if (isAdminMode) {
        adminNotice.classList.remove('d-none');
    }
    
    let pendingBookingData = {};
    const availableTimes = ["14:30", "15:00", "15:30", "16:00", "16:30"];
    const maxBookingsPerSlot = 4;
    let selectedDate = '';
    let selectedTime = '';
    const today = new Date().toISOString().split('T')[0];
    visitDateInput.setAttribute('min', today);
    visitDateInput.value = today;
    selectedDate = today;

    async function renderTimeSlots() {
        timeSlotsContainer.innerHTML = getText('reading_slots');
        bookingNotice.classList.add('d-none');
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];
        if (selectedDate === todayString && now.getHours() >= 12 && !isAdminMode) {
            bookingNotice.textContent = getText('today_past_noon');
            bookingNotice.classList.remove('d-none');
            timeSlotsContainer.innerHTML = '';
            return;
        }
        try {
            const snapshot = await db.collection('bookings').where('date', '==', selectedDate).get();
            const bookingsForDate = {};
            snapshot.forEach(doc => {
                const booking = doc.data();
                if (!bookingsForDate[booking.time]) bookingsForDate[booking.time] = 0;
                bookingsForDate[booking.time]++;
            });
            timeSlotsContainer.innerHTML = '';
            availableTimes.forEach(time => {
                const count = bookingsForDate[time] || 0;
                const remaining = maxBookingsPerSlot - count;
                const isFull = remaining <= 0;
                let isPast = false;
                if (selectedDate === todayString) {
                    const [slotHour, slotMinute] = time.split(':').map(Number);
                    const slotTime = new Date();
                    slotTime.setHours(slotHour, slotMinute, 0, 0);
                    if (now > slotTime) isPast = true;
                }
                const button = document.createElement('button');
                button.className = `btn ${isFull||isPast?'btn-outline-secondary full':'btn-outline-primary'} time-slot`;
                button.dataset.time = time;
                button.disabled = isFull || isPast;
                if (isFull) button.textContent = `${time} (${getText('slot_full')})`;
                else if (isPast) button.textContent = `${time} (${getText('slot_past')})`;
                else button.textContent = `${time} (${getText('slot_remaining', { remaining: remaining })})`;
                timeSlotsContainer.appendChild(button);
            });
        } catch (error) {
            console.error("讀取時段資料失敗:", error);
            timeSlotsContainer.innerHTML = `<div class="alert alert-danger">${getText('read_slots_failed')}</div>`;
        }
    }

    function displaySuccessMessage(bookingData) {
        document.getElementById('confirmDate').textContent = selectedDate;
        document.getElementById('confirmTime').textContent = selectedTime;
        document.getElementById('confirmResidentName').textContent = bookingData.residentName;
        document.getElementById('confirmBedNumber').textContent = bookingData.bedNumber;
        
        fillOrHide('confirmVisitorRelationship', bookingData.visitorRelationship, 'dash');
        
        step1.classList.add('d-none');
        step2.classList.add('d-none');
        successMessage.classList.remove('d-none');
    }

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
        bookingForm.classList.remove('was-validated');
        residentNameInput.classList.remove('is-valid', 'is-invalid');
        bedNumberInput.value = '';
    });
    residentNameInput.addEventListener('input', function() {
        const name = this.value.trim();
        if (residentDatabase[name]) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
            bedNumberInput.value = residentDatabase[name];
            if(nameFeedback) nameFeedback.textContent = getText('name_validation_success');
            if(nameFeedback) nameFeedback.className = 'valid-feedback';
        } else {
            this.classList.remove('is-valid');
            this.classList.add('is-invalid');
            bedNumberInput.value = '';
            if(nameFeedback) nameFeedback.textContent = getText('name_validation_fail');
            if(nameFeedback) nameFeedback.className = 'invalid-feedback';
        }
    });
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        bookingForm.classList.add('was-validated');
        if (!bookingForm.checkValidity()) { return; }
        const residentName = residentNameInput.value.trim();
        if (!residentDatabase[residentName]) {
            bookingForm.classList.remove('was-validated');
            residentNameInput.classList.add('is-invalid');
            if(nameFeedback) nameFeedback.textContent = getText('name_validation_fail');
            if(nameFeedback) nameFeedback.style.display = 'block';
            return;
        }
        pendingBookingData = {
            residentName,
            bedNumber: bedNumberInput.value,
            visitorName: '',
            visitorRelationship: document.getElementById('visitorRelationship').value,
            visitorPhone: '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()};
        setLabelForSpan('modal-confirm-date','visit_date'); setText('modal-confirm-date', selectedDate);
        setLabelForSpan('modal-confirm-time','visit_time'); setText('modal-confirm-time', selectedTime);
        setLabelForSpan('modal-confirm-residentName','resident_name'); setText('modal-confirm-residentName', pendingBookingData.residentName + '（' + pendingBookingData.bedNumber + '）');
        
        fillOrHide('modal-confirm-visitorRelationship', pendingBookingData.visitorRelationship, 'dash');
        
        confirmationModal.show();
    });
    finalSubmitButton.addEventListener('click', async function() {
        finalSubmitButton.disabled = true;
        try {
            await db.collection('bookings').add({
                date: selectedDate,
                time: selectedTime,
                ...pendingBookingData
            });
            confirmationModal.hide();
            displaySuccessMessage(pendingBookingData);
        } catch (error) {
            console.error("預約儲存失敗:", error);
            alert(getText('booking_failed'));
        } finally {
            finalSubmitButton.disabled = false;
        }
    });
    renderTimeSlots();
});
