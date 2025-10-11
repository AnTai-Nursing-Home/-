const translations = {
    'zh-TW': {
        // --- 通用 ---
        'lang_switch': 'English',
        'back_to_dashboard': '返回儀表板',
        'back_to_main_menu': '返回首頁選單',
        'back_to_caregiver_system': '返回照服員系統',
        'save': '儲存',
        'confirm': '確認',
        'cancel': '取消',
        'error_enter_name_first': '請先輸入您的姓名！',
        'loading': '讀取中...',

        // --- 主選單 (index.html) ---
        'main_menu_title': '服務選單',
        'booking_visit': '預約探視',
        'query_cancel_booking': '查詢/取消預約',
        'hospital_booking': '安泰醫院門診掛號',
        'hospital_query': '安泰醫院掛號查詢',
        'visit_rules': '探視規範',
        'contact_us': '聯絡我們',
        'nurse_login': '護理師登入',
        'caregiver_login': '照服員登入',
        
        // --- 預約系統 (booking.html) ---
        'booking_system_title': '預約探視系統',
        'admin_mode_notice': '管理員模式：您現在可以預約今天已過中午的時段。',
        'step1_title': '步驟一：選擇探視日期與時段',
        'choose_date': '選擇日期',
        'today_past_noon': '今日已過中午12點，無法預約當天時段，請選擇其他日期。',
        'step2_title': '步驟二：填寫預約資料',
        'resident_name': '住民姓名',
        'bed_number': '床號',
        'visitor_name': '家屬姓名',
        'visitor_relationship': '與住民關係',
        'contact_phone': '聯絡電話',
        'confirm_booking': '確認預約',
        'back_to_time_select': '返回選擇時段',
        'booking_success_title': '✔ 預約成功！',
        'booking_success_info': '感謝您的預約，以下是您的預約資訊：',
        'date': '日期',
        'time': '時間',
        'important_notice': '重要提醒：未来若需查詢或取消預約，請使用您的「電話號碼」作為憑證。',

        // --- 照服員預假 (leave-caregiver.html) ---
        'caregiver_leave_system': '照服員預假系統',
        'your_name': '您的姓名',
        'admin_settings': '管理員設定',
        'calendar_title_prefix': '年',
        'calendar_title_suffix': '月',
        'leave_period_open': '預假開放中！期間為',
        'leave_period_closed': '目前非預假開放期間。下次開放期間為',
        'to': '至',
        'not_set': '未設定',
        'save_my_leave': '儲存我的預假',
        'week_sun': '日', 'week_mon': '一', 'week_tue': '二', 'week_wed': '三', 'week_thu': '四', 'week_fri': '五', 'week_sat': '六',

    },
    'en': {
        // --- Common ---
        'lang_switch': '中文',
        'back_to_dashboard': 'Back to Dashboard',
        'back_to_main_menu': 'Back to Main Menu',
        'back_to_caregiver_system': 'Back to Caregiver System',
        'save': 'Save',
        'confirm': 'Confirm',
        'cancel': 'Cancel',
        'error_enter_name_first': 'Please enter your name first!',
        'loading': 'Loading...',
        
        // --- Main Menu (index.html) ---
        'main_menu_title': 'Service Menu',
        'booking_visit': 'Visit Booking',
        'query_cancel_booking': 'Query/Cancel Booking',
        'hospital_booking': 'Hospital Appointment',
        'hospital_query': 'Appointment Query',
        'visit_rules': 'Visitation Rules',
        'contact_us': 'Contact Us',
        'nurse_login': 'Nurse Login',
        'caregiver_login': 'Caregiver Login',
        
        // --- Booking System (booking.html) ---
        'booking_system_title': 'Visit Booking System',
        'admin_mode_notice': 'Admin Mode: You can now book slots for today after 12:00 PM.',
        'step1_title': 'Step 1: Select Date and Time',
        'choose_date': 'Select Date',
        'today_past_noon': 'Booking for today is closed after 12:00 PM. Please select another date.',
        'step2_title': 'Step 2: Fill in Information',
        'resident_name': 'Resident\'s Name',
        'bed_number': 'Bed Number',
        'visitor_name': 'Visitor\'s Name',
        'visitor_relationship': 'Relationship to Resident',
        'contact_phone': 'Contact Phone',
        'confirm_booking': 'Confirm Booking',
        'back_to_time_select': 'Back to Time Selection',
        'booking_success_title': '✔ Booking Successful!',
        'booking_success_info': 'Thank you for your booking. Here is your information:',
        'date': 'Date',
        'time': 'Time',
        'important_notice': 'Important: To query or cancel your booking in the future, please use your phone number.',

        // --- Caregiver Leave (leave-caregiver.html) ---
        'caregiver_leave_system': 'Caregiver Leave System',
        'your_name': 'Your Name',
        'admin_settings': 'Admin Settings',
        'calendar_title_prefix': '',
        'calendar_title_suffix': '',
        'leave_period_open': 'Leave request period is open! From',
        'leave_period_closed': 'Leave request period is currently closed. Next period:',
        'to': 'to',
        'not_set': 'Not set',
        'save_my_leave': 'Save My Leave Requests',
        'week_sun': 'Sun', 'week_mon': 'Mon', 'week_tue': 'Tue', 'week_wed': 'Wed', 'week_thu': 'Thu', 'week_fri': 'Fri', 'week_sat': 'Sat',
    }
};

function setLanguage(lang) {
    localStorage.setItem('language', lang);
}

function getLanguage() {
    return localStorage.getItem('language') || 'zh-TW'; // 預設為中文
}

function getText(key) {
    const lang = getLanguage();
    return translations[lang][key] || key; // 如果找不到翻譯，就返回 key 本身
}
