document.addEventListener('DOMContentLoaded', function() {
    const residentDatabase = { /* ... 您的住民資料庫內容不變 ... */ };
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        // ... 其他元件宣告不變 ...
        const residentNameInput = document.getElementById('residentName');
        const bedNumberInput = document.getElementById('bedNumber');
        // ==== 新增：取得關係輸入框的元件 ====
        const visitorRelationshipInput = document.getElementById('visitorRelationship');
        const nameFeedback = document.getElementById('nameFeedback');
        // ... 其他元件宣告不變 ...

        // ... 省略大部分程式碼，只顯示修改處 ...

        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const residentName = residentNameInput.value.trim();
            if (!residentDatabase[residentName]) {
                alert('住民姓名不正確，無法提交預約！');
                return;
            }
            pendingBookingData = {
                residentName,
                bedNumber: bedNumberInput.value,
                visitorName: document.getElementById('visitorName').value,
                // ==== 新增：讀取關係欄位的值 ====
                visitorRelationship: visitorRelationshipInput.value,
                visitorPhone: document.getElementById('visitorPhone').value,
                timestamp: new Date().toISOString()
            };
            document.getElementById('modal-confirm-date').textContent = selectedDate;
            document.getElementById('modal-confirm-time').textContent = selectedTime;
            document.getElementById('modal-confirm-residentName').textContent = pendingBookingData.residentName;
            document.getElementById('modal-confirm-visitorName').textContent = pendingBookingData.visitorName;
            // ==== 新增：在確認視窗中顯示關係 ====
            document.getElementById('modal-confirm-visitorRelationship').textContent = pendingBookingData.visitorRelationship;
            document.getElementById('modal-confirm-visitorPhone').textContent = pendingBookingData.visitorPhone;
            confirmationModal.show();
        });

        function displaySuccessMessage(bookingData) {
            document.getElementById('confirmDate').textContent = selectedDate;
            document.getElementById('confirmTime').textContent = selectedTime;
            document.getElementById('confirmResidentName').textContent = bookingData.residentName;
            document.getElementById('confirmBedNumber').textContent = bookingData.bedNumber;
            document.getElementById('confirmVisitorName').textContent = bookingData.visitorName;
            // ==== 新增：在成功頁面中顯示關係 ====
            document.getElementById('confirmVisitorRelationship').textContent = bookingData.visitorRelationship;
            document.getElementById('confirmVisitorPhone').textContent = bookingData.visitorPhone;
            step1.classList.add('d-none');
            step2.classList.add('d-none');
            successMessage.classList.remove('d-none');
        }

        // ... 其他所有函式和邏輯保持不變 ...
    }
});
