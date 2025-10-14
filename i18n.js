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
        'confirm_submission': '確認送出',
        'return_to_modify': '返回修改',
        'admin_settings': '管理員設定',
        'please_enter_password': '請輸入密碼',
        'login': '登入',
        'password_error': '密碼錯誤，請重試！',
        'back_to_home': '返回首頁',
        'querying': '查詢中...',
        'no_records_found': '查無相關預約紀錄。',
        'query_failed': '查詢失敗，請稍後再試。',
        'confirm_cancel_booking': '您確定要取消這個預約嗎？',
        'booking_cancelled_success': '預約已成功取消！',
        'delete_failed': '刪除失敗，請稍後再試。',
        'please_enter_phone': '請輸入電話號碼！',
        'start_query': '開始查詢',

        // --- 主選單 ---
        'main_title_full': '安泰醫療社團法人附設安泰護理之家',
        'main_menu_title': '服務選單',
        'booking_visit': '預約探視',
        'query_cancel_booking': '查詢/取消預約',
        'hospital_booking': '安泰醫院門診掛號',
        'hospital_query': '安泰醫院掛號查詢',
        'visit_rules': '探視規範',
        'contact_us': '聯絡我們',
        'nurse_login': '護理師登入',
        'caregiver_login': '照服員登入',
        
        // --- 預約系統 ---
        'booking_system_title': '預約探視系統',
        'admin_mode_notice': '管理員模式：您現在可以預約今天已過中午的時段。',
        'step1_title': '步驟一：選擇探視日期與時段',
        'choose_date': '選擇日期',
        'today_past_noon': '今日已過中午12點，無法預約當天時段，請選擇其他日期。',
        'reading_slots': '讀取中...',
        'read_slots_failed': '讀取時段失敗，請重新整理頁面。',
        'slot_full': '已額滿',
        'slot_past': '已逾時',
        'slot_remaining': '剩餘 {remaining} 組',
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
        'important_notice': '重要提醒：未來若需查詢或取消預約，請使用您的「電話號碼」作為憑證。',
        'error_resident_name_invalid': '住民姓名不正確，無法提交預約！',
        'name_validation_success': '姓名驗證成功！',
        'name_validation_fail': '查無此住民姓名，請確認輸入是否正確。',
        'booking_failed': '預約失敗，請稍後再試。',
        'enter_phone_to_query': '請輸入您預約時使用的電話號碼：',
        'please_fill_resident_name': '請填寫住民姓名。',
        'please_fill_visitor_name': '請填寫您的姓名。',
        'please_fill_visitor_relationship': '請填寫您與住民的關係。',
        'please_fill_contact_phone': '請填寫您的聯絡電話。',
        'confirm_booking_info_title': '請確認您的預約資訊',

        // --- 護理師系統 ---
        'nurse_system': '護理師系統',
        'enter_nurse_password': '請輸入護理師密碼',
        'booking_list_query': '預約名單查詢',
        'proxy_booking': '代客預約',
        'supplies_inventory': '衛材點班',
        'leave_system': '預假系統',
        'all_booking_records': '所有預約紀錄',
        'resident_data_management': '住民資料管理',

        // --- 照服員系統 ---
        'caregiver_system': '照服員系統',
        'enter_caregiver_password': '請輸入照服員密碼',
        'caregiver_leave_system_menu': '預假系統',
        'login_network_error': '登入時發生網路錯誤，請稍後再試。',
        'foley_care_assessment_menu': '導尿管照護評估',

        // --- 預假/預班系統 (通用) ---
        'leave_system_title': '預假/預班系統',
        'nurse_leave_system': '護理師 預假/預班系統',
        'caregiver_leave_system': '照服員 預假/預班系統',
        'your_name': '您的姓名',
        'enter_your_name_to_book': '請輸入您的姓名以預排',
        'calendar_title_prefix': '年',
        'calendar_title_suffix': '月',
        'leave_period_open': '預假/預班開放中！期間：',
        'leave_period_closed': '目前非預假/預班開放期間。下次開放：',
        'to': '至',
        'not_set': '未設定',
        'week_sun': '日', 'week_mon': '一', 'week_tue': '二', 'week_wed': '三', 'week_thu': '四', 'week_fri': '五', 'week_sat': '六',
        'admin_verification': '管理員驗證',
        'enter_admin_password_for_settings': '請輸入管理員密碼以設定預假期間。',
        'set_next_month_leave_period': '設定下個月的預假/預班開放期間',
        'start_date': '開始日期與時間',
        'end_date': '結束日期與時間',
        'employee': '員工',
        'leave_saved': '的預假已儲存！',
        'save_failed': '儲存失敗，請稍後再試。',
        'verification_failed': '驗證時發生網路錯誤，請檢查網路連線或稍後再試。',
        'set_start_end_date': '請設定開始與結束日期',
        'end_date_cannot_be_earlier': '結束日期不可早於開始日期',
        'settings_saved': '預假期間已儲存！頁面將會重新載入以套用新設定。',
        'settings_save_failed': '儲存設定失敗，請稍後再試。',
        'read_calendar_failed': '讀取日曆失敗，請重新整理。',
        'select_shift_for': '選擇 {date} 的班別',
        'clear_this_day': '清除此日',
        'no_leave_requests_next_month': '下個月尚無預假/預班紀錄。',
        'load_summary_failed': '讀取總覽資料失敗。',
        'shift_d': 'D (白班)',
        'shift_n': 'N (大夜)',
        'shift_off': 'OFF (休假)',
        
        // --- 探視規範 ---
        'visit_rules_title': '訪客探視規範',
        'rules_intro': '為維護住民健康及安全，並確保住民能有安靜、舒適的休養環境，請訪客務必配合下列事項：',
        'rules_time_header': '一、 探視時間與限制', 'rule_time_1': '訪客探視時間：下午 2:30 至 5:00，並請於 5:00 準時離開。',
        'rule_time_2': '每週開放探視兩次，一次 30 分鐘。', 'rule_time_3': '為保障住民安全，每次探視最多三人為限（含兒童）。',
        'rules_booking_header': '二、 預約方式', 'rule_booking_1': '預約請提前一天使用此系統或打電話告知。',
        'rule_booking_2': '請至服務台填寫或手機掃描登入訪客紀錄單。', 'rules_health_header': '三、 訪客健康與衛生須知',
        'rule_health_1': '進入機構請配戴口罩。', 'rule_health_2': '如身體有不適之任何症狀（如：發燒或咳嗽），請勿探視住民。',
        'rule_health_3': '請落實量測體溫及洗手。', 'rules_thanks': '感謝您的理解與配合，共同為住民營造優質的照護環境。',

        // --- 聯絡我們 ---
        'address': '地址', 'phone': '電話', 'service_hours': '行政人員/社工師服務時間', 'service_hours_time': '週一至週五 08:00 - 17:00',

        // --- 住民資料管理 ---
        'add_resident': '新增住民', 'import_from_excel': '從 Excel 匯入',
        'name': '姓名', 'gender': '性別', 'birthday': '生日', 'checkin_date': '入住日期',
        'actions': '操作', 'edit': '編輯', 'delete': '刪除',
        'reading_residents': '讀取中...', 'no_residents_yet': '尚無住民資料，請點擊「新增住民」或「從 Excel 匯入」開始建立。',
        'read_failed': '讀取資料失敗，請重新整理頁面。', 'fill_resident_name': '請務必填寫住民姓名！',
        'save_failed_try_again': '儲存失敗，請稍後再試。',
        'confirm_delete_resident': '您確定要刪除住民「{name}」的資料嗎？\n此操作無法復原！',

        // --- 導尿管照護評估 ---
        'foley_care_assessment': '導尿管照護評估表',
        'foley_care_title': '照護機構預防導尿管相關泌尿道感染每日照護評估表',
        'save_this_month_record': '儲存本月紀錄', 'resident_basic_info': '住民基本資料',
        'please_select_resident': '請選擇住民', 'select_month': '選擇月份',
        'care_form_list_for': '{name} - {year}年 {month}月 的照護單',
        'add_this_month_form': '新增本月照護單', 'no_records_for_month': '尚無此月份的照護單紀錄。',
        'placement_date': '置放日期', 'closing_date': '結案日期', 'assessment_items': '每日評估項目',
        'signature': '簽章', 'caregiver': '照服員', 'nurse': '護理師',
        'hand_hygiene': '1. 手部衛生', 'fixed_position': '2. 固定位置', 'unobstructed_drainage': '3. 無菌暢通',
        'avoid_overfill': '4. 避免過滿', 'urethral_cleaning': '5. 尿道口清潔', 'single_use_container': '6. 單一非共用容器',
        'yes': 'Yes', 'no': 'No', 'save_this_care_form': '儲存此張照護單',
    },
    'en': {
        // --- Common ---
        'lang_switch': '中文', 'back_to_dashboard': 'Back to Dashboard', 'back_to_main_menu': 'Back to Main Menu',
        'back_to_caregiver_system': 'Back to Caregiver System', 'save': 'Save', 'confirm': 'Confirm', 'cancel': 'Cancel',
        'error_enter_name_first': 'Please enter your name first!', 'loading': 'Loading...', 'confirm_submission': 'Confirm Submission',
        'return_to_modify': 'Return to Modify', 'admin_settings': 'Admin Settings', 'please_enter_password': 'Please enter password',
        'login': 'Login', 'password_error': 'Password incorrect, please try again!', 'back_to_home': 'Back to Home',
        'querying': 'Querying...', 'no_records_found': 'No relevant booking records found.',
        'query_failed': 'Query failed, please try again later.', 'confirm_cancel_booking': 'Are you sure you want to cancel this booking?',
        'booking_cancelled_success': 'Booking has been cancelled successfully!', 'delete_failed': 'Delete failed, please try again later.',
        'please_enter_phone': 'Please enter phone number!', 'start_query': 'Start Query',

        // --- Main Menu ---
        'main_title_full': 'Antai Medical Corporation Antai Nursing Home', 'main_menu_title': 'Service Menu',
        'booking_visit': 'Visit Booking', 'query_cancel_booking': 'Query/Cancel Booking', 'hospital_booking': 'Hospital Appointment',
        'hospital_query': 'Appointment Query', 'visit_rules': 'Visitation Rules', 'contact_us': 'Contact Us',
        'nurse_login': 'Nurse Login', 'caregiver_login': 'Caregiver Login',
        
        // --- Booking System ---
        'booking_system_title': 'Visit Booking System', 'admin_mode_notice': 'Admin Mode: You can now book slots for today after 12:00 PM.',
        'step1_title': 'Step 1: Select Date and Time', 'choose_date': 'Select Date',
        'today_past_noon': 'Booking for today is closed after 12:00 PM. Please select another date.', 'reading_slots': 'Loading...',
        'read_slots_failed': 'Failed to load time slots, please refresh the page.', 'slot_full': 'Full', 'slot_past': 'Past',
        'slot_remaining': 'Remaining: {remaining}', 'step2_title': 'Step 2: Fill in Information', 'resident_name': 'Resident\'s Name',
        'bed_number': 'Bed Number', 'visitor_name': 'Visitor\'s Name', 'visitor_relationship': 'Relationship to Resident',
        'contact_phone': 'Contact Phone', 'confirm_booking': 'Confirm Booking', 'back_to_time_select': 'Back to Time Selection',
        'booking_success_title': '✔ Booking Successful!', 'booking_success_info': 'Thank you for your booking. Here is your information:',
        'date': 'Date', 'time': 'Time', 'important_notice': 'Important: To query or cancel your booking in the future, please use your phone number.',
        'error_resident_name_invalid': 'Resident name is incorrect, cannot submit booking!', 'name_validation_success': 'Name verification successful!',
        'name_validation_fail': 'Resident name not found, please check your input.', 'booking_failed': 'Booking failed, please try again later.',
        'enter_phone_to_query': 'Please enter the phone number used for the booking:',
        'please_fill_resident_name': 'Please fill in resident\'s name.', 'please_fill_visitor_name': 'Please fill in your name.',
        'please_fill_visitor_relationship': 'Please fill in your relationship to the resident.', 'please_fill_contact_phone': 'Please fill in your contact phone.',
        'confirm_booking_info_title': 'Please confirm your booking information',

        // --- Nurse System ---
        'nurse_system': 'Nurse System', 'enter_nurse_password': 'Please enter nurse password',
        'booking_list_query': 'Booking List Query', 'proxy_booking': 'Proxy Booking', 'supplies_inventory': 'Supplies Inventory',
        'leave_system': 'Leave Request System', 'all_booking_records': 'All Booking Records',
        'resident_data_management': 'Resident Data Management',

        // --- Caregiver System ---
        'caregiver_system': 'Caregiver System', 'enter_caregiver_password': 'Please enter caregiver password',
        'caregiver_leave_system_menu': 'Leave Request System', 'login_network_error': 'A network error occurred during login, please try again later.',
        'foley_care_assessment_menu': 'Foley Care Assessment',

        // --- Leave Request System (Common) ---
        'leave_system_title': 'Leave/Shift Request System', 'nurse_leave_system': 'Nurse Leave/Shift System',
        'caregiver_leave_system': 'Caregiver Leave/Shift System', 'your_name': 'Your Name', 'enter_your_name_to_book': 'Please enter your name to request',
        'calendar_title_prefix': '', 'calendar_title_suffix': '', 'leave_period_open': 'Leave/Shift request period is open! From',
        'leave_period_closed': 'Leave/Shift request period is currently closed. Next period:', 'to': 'to', 'not_set': 'Not set',
        'week_sun': 'Sun', 'week_mon': 'Mon', 'week_tue': 'Tue', 'week_wed': 'Wed', 'week_thu': 'Thu', 'week_fri': 'Fri', 'week_sat': 'Sat',
        'admin_verification': 'Admin Verification', 'enter_admin_password_for_settings': 'Please enter admin password to set the leave/shift request period.',
        'set_next_month_leave_period': 'Set Leave/Shift Request Period for Next Month', 'start_date': 'Start Date & Time', 'end_date': 'End Date & Time',
        'employee': 'Employee', 'leave_saved': '\'s leave request has been saved!', 'save_failed': 'Save failed, please try again later.',
        'verification_failed': 'A network error occurred during verification, please check your connection or try again later.',
        'set_start_end_date': 'Please set both start and end dates', 'end_date_cannot_be_earlier': 'End date cannot be earlier than start date',
        'settings_saved': 'Leave request period has been saved! The page will now reload to apply the new settings.',
        'settings_save_failed': 'Failed to save settings, please try again later.',
        'read_calendar_failed': 'Failed to load calendar data. Please refresh.', 'select_shift_for': 'Select shift for {date}',
        'clear_this_day': 'Clear This Day', 'no_leave_requests_next_month': 'No leave/shift requests for next month yet.',
        'load_summary_failed': 'Failed to load summary data.',
        'shift_d': 'D (Day)', 'shift_n': 'N (Night)', 'shift_off': 'OFF',
        
        // --- Visitation Rules ---
        'visit_rules_title': 'Visitor Guidelines', 'rules_intro': 'To maintain the health and safety of our residents and to ensure a quiet and comfortable environment, all visitors are requested to comply with the following:',
        'rules_time_header': '1. Visiting Hours & Restrictions', 'rule_time_1': 'Visiting hours are from 2:30 PM to 5:00 PM. Please leave on time at 5:00 PM.',
        'rule_time_2': 'Visits are allowed twice a week, for 30 minutes each time.', 'rule_time_3': 'For the safety of our residents, a maximum of three visitors (including children) are allowed per resident at a time.',
        'rules_booking_header': '2. Booking Method', 'rule_booking_1': 'Please make a reservation one day in advance using this system or by phone.',
        'rule_booking_2': 'Please fill out the visitor log at the front desk or scan the QR code to register.',
        'rules_health_header': '3. Health & Hygiene Guidelines for Visitors', 'rule_health_1': 'Please wear a mask upon entering the facility.',
        'rule_health_2': 'If you have any symptoms of illness (e.g., fever or cough), please refrain from visiting.',
        'rule_health_3': 'Please have your temperature checked and wash your hands.', 'rules_thanks': 'Thank you for your understanding and cooperation in creating a quality care environment for our residents.',

        // --- Contact Us ---
        'address': 'Address', 'phone': 'Phone', 'service_hours': 'Admin/Social Worker Service Hours', 'service_hours_time': 'Monday to Friday 08:00 - 17:00',
        
        // --- Resident Data Management ---
        'add_resident': 'Add Resident', 'import_from_excel': 'Import from Excel',
        'name': 'Name', 'gender': 'Gender', 'birthday': 'Birthday', 'checkin_date': 'Check-in Date',
        'actions': 'Actions', 'edit': 'Edit', 'delete': 'Delete',
        'reading_residents': 'Loading...', 'no_residents_yet': 'No resident data found. Click "Add Resident" or "Import from Excel" to start.',
        'read_failed': 'Failed to load data, please refresh the page.', 'fill_resident_name': 'Resident name is required!',
        'save_failed_try_again': 'Save failed, please try again later.',
        'confirm_delete_resident': 'Are you sure you want to delete the record for "{name}"?\nThis action cannot be undone!',

        // --- Foley Care Assessment ---
        'foley_care_assessment': 'Foley Care Assessment Form',
        'foley_care_title': 'Daily Care Assessment Form for Preventing Catheter-Associated Urinary Tract Infections',
        'save_this_month_record': 'Save This Month\'s Record', 'resident_basic_info': 'Resident\'s Basic Information',
        'please_select_resident': 'Please select a resident', 'select_month': 'Select Month',
        'care_form_list_for': 'Care Forms for {name} - {month}/{year}',
        'add_this_month_form': 'Add New Form for This Month',
        'no_records_for_month': 'No care form records for this month yet.',
        'placement_date': 'Placement Date', 'closing_date': 'Closing Date', 'assessment_items': 'Daily Assessment Items',
        'signature': 'Signature', 'caregiver': 'Caregiver', 'nurse': 'Nurse',
        'hand_hygiene': '1. Hand Hygiene', 'fixed_position': '2. Fixed Position', 'unobstructed_drainage': '3. Unobstructed Drainage',
        'avoid_overfill': '4. Avoid Overfill', 'urethral_cleaning': '5. Urethral Cleaning', 'single_use_container': '6. Single Use Container',
        'yes': 'Yes', 'no': 'No', 'save_this_care_form': 'Save This Care Form',
    }
};

function setLanguage(lang) {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
}

function getLanguage() {
    return localStorage.getItem('language') || 'zh-TW';
}

function getText(key, replacements = {}) {
    const lang = getLanguage();
    let text = translations[lang][key] || key;
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
}
