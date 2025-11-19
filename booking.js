const translations = {
    'zh-TW': {
        // --- 通用 ---
        'lang_switch': 'English',
        'back_to_dashboard': '返回儀表板',
        'back_to_main_menu': '返回首頁選單',
        'back_to_caregiver_system': '返回照服員系統',
        'back_to_office_system': '返回辦公室系統',
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
        'read_failed': '讀取失敗',
        'status_ongoing': '進行中',
        'status_closed': '已結案',
        'not_set': '未設定',
        'read_list_failed': '讀取列表失敗。',
        'save_failed': '儲存失敗，請稍後再試。',

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
        'office_login': '辦公室登入',
        
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

        // --- 員工系統 (通用) ---
        'nurse_system': '護理師系統',
        'enter_nurse_password': '請輸入護理師密碼',
        'booking_list_query': '預約名單查詢',
        'proxy_booking': '代客預約',
        'supplies_inventory': '衛材點班',
        'leave_system': '預假系統',
        'all_booking_records': '所有預約紀錄',
        'resident_data_management': '住民資料管理',
        'employee_data_management': '員工資料管理',
        'temperature_log': '體溫登錄',
        'save_today_temps': '儲存今日體溫',
        'caregiver_system': '照服員系統',
        'enter_caregiver_password': '請輸入照服員密碼',
        'temperature_log_caregiver': '照服員體溫登錄',
        'caregiver_temperature_log_title': '照服員每日體溫登錄',
        'temperature_log_nurse': '護理師體溫登錄',
        'nurse_temperature_log_title': '護理師每日體溫登錄',
        'caregiver_leave_system_menu': '預假系統',
        'login_network_error': '登入時發生網路錯誤，請稍後再試。',
        'foley_care_assessment_menu': '導尿管照護評估',
        'temperature_record_menu': '體溫登錄',
        'caregiver_leave_system': '照服員 預假/預班系統',

        // --- 預假/預班系統 ---
        'your_name': '您的姓名',
        'enter_your_name_to_book': '請輸入您的姓名以預排',
        'calendar_title_prefix': '年',
        'calendar_title_suffix': '月',
        'leave_period_open': '預假/預班開放中！期間：',
        'leave_period_closed': '目前非預假/預班開放期間。下次開放：',
        'leave_period_open': '預假/預班開放中！期間：',
        'week_sun': '日', 'week_mon': '一', 'week_tue': '二', 'week_wed': '三', 'week_thu': '四', 'week_fri': '五', 'week_sat': '六',
        'next_month_overview': '下個月預假/預班總覽',
        'export_word': '匯出 Word',
        'export_excel': '匯出 Excel',
        'print_report': '列印報表',
        'employee_id': '員編',
        'admin_verification': '管理員驗證',
        'enter_admin_password_for_settings': '請輸入管理員密碼以設定預假期間。',
        'set_next_month_leave_period': '設定下個月的預假/預班開放期間',
        'start_date': '開始日期與時間',
        'end_date': '結束日期與時間',
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
        'shift_d': 'D (白班)', 'shift_n': 'N (大夜)', 'shift_off': 'OFF (休假)',

        // --- 導尿管照護評估 ---
        'foley_care_assessment': '導尿管照護評估表',
        'foley_care_title': '照護機構預防導尿管相關泌尿道感染每日照護評估表',
        'please_select_resident': '請選擇住民',
        'all_residents': '全部住民',
        'please_select_resident_first': '請先從上方選擇一位住民！',
        'ongoing_care_forms': '進行中的照護單',
        'closed_care_forms': '已結案的照護單',
        'add_new_form': '新增照護單',
        'no_care_forms_found': '找不到符合條件的照護單紀錄。',
        'resident_basic_info': '住民基本資料',
        'placement_date': '置放日期',
        'closing_date': '結案日期',
        'care_period': '照護期間',
        'ongoing': '持續中',
        'assessment_items': '每日評估項目',
        'signature': '簽章',
        'caregiver': '照服員',
        'nurse': '護理師',
        'hand_hygiene': '1. 手部衛生',
        'fixed_position': '2. 固定位置',
        'unobstructed_drainage': '3. 無菌暢通',
        'avoid_overfill': '4. 避免過滿',
        'urethral_cleaning': '5. 尿道口清潔',
        'single_use_container': '6. 單一非共用容器',
        'yes': 'Yes',
        'no': 'No',
        'save_this_care_form': '儲存此張照護單',
        'delete_this_care_form': '刪除此張照護單',
        'back_to_list': '返回列表',
        'load_care_form_failed': '載入照護單失敗，請稍後再試。',
        'fill_form_first': '請先選擇住民並填寫置放日期！',
        'care_form_saved': '照護單已成功儲存！',
        'confirm_delete_care_form': '您確定要永久刪除此張照護單嗎？\n此操作無法復原！',
        'care_form_deleted': '照護單已成功刪除！',
        'index_building_warning': '系統正在建立新的資料庫索引以支援查詢，請等待幾分鐘後再試。',
        
        // --- 辦公室系統 ---
        'office_system': '辦公室系統', 'enter_office_password': '請輸入辦公室密碼',
        'auto_temp_system': '自動化體溫紀錄系統', 'auto_clockin_system': '自動化打卡紀錄系統',
        'temperature_system': '體溫系統','temperature_label': '體溫','clockin_system': '打卡系統',
        'select_month': '選擇月份', 'upload_schedule': '上傳班表',
        'upload_and_generate': '上傳班表並生成紀錄', 'reading_schedule_and_generating': '正在讀取班表並生成紀錄...',
        'error_select_month_first': '請先選擇月份！', 'error_read_excel': '讀取 Excel 檔案失敗，請確認檔案格式是否正確。',
        'export_word': '匯出 Word', 'export_excel': '匯出 Excel', 'print_report': '列印報表',
        'no_report_generated': '請先選擇月份並上傳當月份的 Excel 班表檔案。',
        'temp_report_title': '員工體溫紀錄總表', 'clockin_report_title': '員工打卡紀錄總表',
        'clock_in': '上班', 'clock_out': '下班',

        // ... (其他靜態頁面翻譯不變) ...
    },
    'en': {
        // --- Common ---
        'lang_switch': 'Chinese', 'back_to_dashboard': 'Back to Dashboard', 'back_to_main_menu': 'Back to Main Menu',
        'back_to_caregiver_system': 'Back to Caregiver System', 'back_to_office_system': 'Back to Office System', 'save': 'Save',
        'confirm': 'Confirm', 'cancel': 'Cancel', 'error_enter_name_first': 'Please enter your name first!', 'loading': 'Loading...',
        'confirm_submission': 'Confirm Submission', 'return_to_modify': 'Return to Modify', 'admin_settings': 'Admin Settings',
        'please_enter_password': 'Please enter password', 'login': 'Login', 'password_error': 'Password incorrect, please try again!',
        'back_to_home': 'Back to Home', 'querying': 'Querying...', 'no_records_found': 'No relevant booking records found.',
        'query_failed': 'Query failed, please try again later.', 'confirm_cancel_booking': 'Are you sure you want to cancel this booking?',
        'booking_cancelled_success': 'Booking has been cancelled successfully!', 'delete_failed': 'Delete failed, please try again later.',
        'please_enter_phone': 'Please enter phone number!', 'start_query': 'Start Query', 'read_failed': 'Read failed',
        'status_ongoing': 'Ongoing', 'status_closed': 'Closed', 'not_set': 'Not set', 'read_list_failed': 'Failed to load list.',
        'save_failed': 'Save failed, please try again later.',

        // --- Main Menu ---
        'main_title_full': 'Antai Medical Corporation Antai Nursing Home', 'main_menu_title': 'Service Menu',
        'booking_visit': 'Visit Booking', 'query_cancel_booking': 'Query/Cancel Booking', 'hospital_booking': 'Hospital Appointment',
        'hospital_query': 'Appointment Query', 'visit_rules': 'Visitation Rules', 'contact_us': 'Contact Us',
        'nurse_login': 'Nurse Login', 'caregiver_login': 'Caregiver Login', 'office_login': 'Office Login',

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
        'enter_phone_to_query': 'Please enter the phone number used for the booking:', 'please_fill_resident_name': 'Please fill in resident\'s name.',
        'please_fill_visitor_name': 'Please fill in your name.', 'please_fill_visitor_relationship': 'Please fill in your relationship to the resident.',
        'please_fill_contact_phone': 'Please fill in your contact phone.', 'confirm_booking_info_title': 'Please confirm your booking information',

        // --- Employee Systems (Common) ---
        'nurse_system': 'Nurse System', 'enter_nurse_password': 'Please enter nurse password', 'booking_list_query': 'Booking List Query',
        'proxy_booking': 'Proxy Booking', 'supplies_inventory': 'Supplies Inventory', 'leave_system': 'Leave Request System',
        'all_booking_records': 'All Booking Records', 'resident_data_management': 'Resident Data Management',
        'employee_data_management': 'Employee Data Management', 'temperature_log': 'Temperature Log', 'caregiver_system': 'Caregiver System',
        'enter_caregiver_password': 'Please enter caregiver password', 'caregiver_leave_system_menu': 'Leave Request System','temperature_log_caregiver': 'Caregiver Temperature Log',
        'caregiver_temperature_log_title': 'Daily Temperature Log for Caregivers','temperature_log_nurse': 'Nurse Temperature Log',
        'nurse_temperature_log_title': 'Daily Temperature Log for Nurses',
        'login_network_error': 'A network error occurred during login, please try again later.', 'foley_care_assessment_menu': 'Foley Care Assessment',
        'temperature_record_menu': 'Temperature Recording','caregiver_leave_system': 'Caregiver Leave/Shift System','save_today_temps': 'Save Today\'s Temperatures',

        // --- Leave Request System ---
        'your_name': 'Your Name', 'enter_your_name_to_book': 'Please enter your name to request', 'calendar_title_prefix': '',
        'calendar_title_suffix': '', 'leave_period_open': 'Leave/Shift request period is open! From',
        'leave_period_closed': 'Leave/Shift request period is currently closed. Next period:','leave_period_open': 'Leave scheduling period open! Period:',
        'week_sun': 'Sun', 'week_mon': 'Mon', 'week_tue': 'Tue', 'week_wed': 'Wed', 'week_thu': 'Thu', 'week_fri': 'Fri', 'week_sat': 'Sat',
        'admin_verification': 'Admin Verification', 'enter_admin_password_for_settings': 'Please enter admin password to set the leave/shift request period.',
        'set_next_month_leave_period': 'Set Leave/Shift Request Period for Next Month', 'start_date': 'Start Date & Time', 'end_date': 'End Date & Time',
        'verification_failed': 'A network error occurred during verification, please check your connection or try again later.',
        'set_start_end_date': 'Please set both start and end dates', 'end_date_cannot_be_earlier': 'End date cannot be earlier than start date',
        'settings_saved': 'Leave request period has been saved! The page will now reload to apply the new settings.',
        'settings_save_failed': 'Failed to save settings, please try again later.', 'read_calendar_failed': 'Failed to load calendar data. Please refresh.',
        'select_shift_for': 'Select shift for {date}', 'clear_this_day': 'Clear This Day', 'no_leave_requests_next_month': 'No leave/shift requests for next month yet.',
        'load_summary_failed': 'Failed to load summary data.', 'shift_d': 'D (Day)', 'shift_n': 'N (Night)', 'shift_off': 'OFF',
        'next_month_overview': 'Next Month Leave/Shift Overview',
        'export_word': 'Export Word',
        'export_excel': 'Export Excel',
        'print_report': 'Print Report',
        'employee_id': 'Employee ID',


        // --- Foley Care Assessment ---
        'foley_care_assessment': 'Foley Care Assessment Form', 'foley_care_title': 'Daily Care Assessment Form for Preventing Catheter-Associated Urinary Tract Infections',
        'please_select_resident': 'Please select a resident', 'all_residents': 'All Residents', 'please_select_resident_first': 'Please select a resident from the top menu first!',
        'ongoing_care_forms': 'Ongoing Care Forms', 'closed_care_forms': 'Closed Care Forms', 'add_new_form': 'Add New Care Form',
        'no_care_forms_found': 'No matching care form records found.', 'resident_basic_info': 'Resident\'s Basic Information',
        'placement_date': 'Placement Date', 'closing_date': 'Closing Date', 'care_period': 'Care Period', 'ongoing': 'Ongoing',
        'assessment_items': 'Daily Assessment Items', 'signature': 'Signature', 'caregiver': 'Caregiver', 'nurse': 'Nurse',
        'hand_hygiene': '1. Hand Hygiene', 'fixed_position': '2. Fixed Position', 'unobstructed_drainage': '3. Unobstructed Drainage',
        'avoid_overfill': '4. Avoid Overfill', 'urethral_cleaning': '5. Urethral Cleaning', 'single_use_container': '6. Single Use Container',
        'yes': 'Yes', 'no': 'No', 'save_this_care_form': 'Save This Care Form', 'delete_this_care_form': 'Delete This Care Form',
        'back_to_list': 'Back to List', 'load_care_form_failed': 'Failed to load care form, please try again later.',
        'fill_form_first': 'Please select a resident and fill in the placement date first!', 'care_form_saved': 'Care form has been saved successfully!',
        'confirm_delete_care_form': 'Are you sure you want to permanently delete this care form?\nThis action cannot be undone!',
        'care_form_deleted': 'Care form has been deleted successfully!', 'index_building_warning': 'The system is building a new index to support this query. Please wait a few minutes and try again.',
        
        // --- Office System ---
        'office_system': 'Office System', 'enter_office_password': 'Please enter office password',
        'auto_temp_system': 'Automated Temperature Log System', 'auto_clockin_system': 'Automated Clock-in/out System',
        'temperature_label': 'Temperature','temperature_system': 'Temperature System', 'clockin_system': 'Clock-in/out System', 'select_month': 'Select Month',
        'upload_schedule': 'Upload Schedule', 'upload_and_generate': 'Upload Schedule & Generate Records',
        'reading_schedule_and_generating': 'Reading schedule and generating records...', 'error_select_month_first': 'Please select a month first!',
        'error_read_excel': 'Failed to read Excel file. Please check the file format.', 'export_word': 'Export Word',
        'export_excel': 'Export Excel', 'print_report': 'Print Report', 'no_report_generated': 'Please select a month and upload the corresponding Excel schedule file.',
        'temp_report_title': 'Employee Temperature Log', 'clockin_report_title': 'Employee Clock-in/out Log',
        'clock_in': 'Clock In', 'clock_out': 'Clock Out',
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
    const langDict = translations[lang] || translations['zh-TW'];
    let text = langDict[key] || key;
    
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
}

function applyTranslations() {
    const lang = getLanguage();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = getText(key);
        if (el.placeholder !== undefined && el.tagName === 'INPUT') {
            el.placeholder = text;
        } else {
            el.textContent = text;
        }
    });
}


// (embedded) Apply translations immediately on load if DOM is ready
try { applyTranslations(); } catch (e) { /* ignore until DOM ready */ }

document.addEventListener('firebase-ready', () => {
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
        document.getElementById('confirmVisitorRelationship').textContent = bookingData.visitorRelationship;
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
            visitorRelationship: document.getElementById('visitorRelationship').value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        document.getElementById('modal-confirm-date').textContent = selectedDate;
        document.getElementById('modal-confirm-time').textContent = selectedTime;
        document.getElementById('modal-confirm-residentName').textContent = pendingBookingData.residentName;
        document.getElementById('modal-confirm-visitorRelationship').textContent = pendingBookingData.visitorRelationship;
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



// === Final hardening: lock UI after success so nothing can hide it ===
(function(){
  function detachAll(el){
    if (!el) return el;
    var clone = el.cloneNode(true);
    el.parentNode && el.parentNode.replaceChild(clone, el);
    return clone;
  }
  window.__bookingCompleted = false;
  // Override (or define) displaySuccessMessage: prefer our version after original definitions
  window.displaySuccessMessage = function(bookingData, selectedDate, selectedTime){
    try {
      // Hide modal
      var modalEl = document.getElementById('confirmationModal');
      if (modalEl && window.bootstrap) {
        try { var inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl); inst.hide(); } catch(e){}
      }

      // Sections
      var step1 = document.getElementById('step1');
      var step2 = document.getElementById('step2');
      var successMessage = document.getElementById('successMessage');

      if (step1) step1.classList.add('d-none');
      if (step2) step2.classList.add('d-none');
      if (successMessage) successMessage.classList.remove('d-none');

      // Fill summary (be tolerant to missing nodes)
      function fill(id, v){ var el=document.getElementById(id); if (el) el.textContent = (v && String(v).trim()) ? v : '—'; }
      fill('confirmDate', selectedDate);
      fill('confirmTime', selectedTime);
      fill('confirmResidentName', bookingData && bookingData.residentName);
      fill('confirmBedNumber', bookingData && bookingData.bedNumber);
      fill('confirmVisitorRelationship', bookingData && bookingData.visitorRelationship);

      // HARD LOCK: neutralize any further UI actions that could re-render
      window.__bookingCompleted = true;

      // disable interactive areas
      var dateInput = document.getElementById('visitDate');
      var slots = document.getElementById('time-slots');
      var backBtn = document.getElementById('backButton');
      if (dateInput) { dateInput.setAttribute('disabled','disabled'); }
      if (slots) { slots.style.pointerEvents = 'none'; slots.classList.add('disabled'); }
      // remove listeners by cloning
      detachAll(dateInput);
      detachAll(slots);
      detachAll(backBtn);

      // guard the most common re-renderers if present
      var guardFns = ['renderTimeSlots','renderTimeSlotsForDate','showStep1','resetUI'];
      guardFns.forEach(function(name){
        if (typeof window[name] === 'function') {
          var orig = window[name];
          window[name] = function(){
            if (window.__bookingCompleted) return;
            return orig.apply(this, arguments);
          };
        }
      });

      // optional: scroll to success section
      try { window.scrollTo({top: 0, behavior: 'smooth'}); } catch(e){}
    } catch(err){
      console.error('displaySuccessMessage override error:', err);
    }
  };
})();
