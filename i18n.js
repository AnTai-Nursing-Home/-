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
        'caregiver_system': '照服員系統',
        'enter_caregiver_password': '請輸入照服員密碼',
        'caregiver_leave_system_menu': '預假系統',
        'login_network_error': '登入時發生網路錯誤，請稍後再試。',
        'foley_care_assessment_menu': '導尿管照護評估',
        'temperature_record_menu': '體溫登錄', // ✅ 新增

        // --- 預假/預班系統 ---
        'your_name': '您的姓名',
        'enter_your_name_to_book': '請輸入您的姓名以預排',
        'calendar_title_prefix': '年',
        'calendar_title_suffix': '月',
        'leave_period_open': '預假/預班開放中！期間：',
        'leave_period_closed': '目前非預假/預班開放期間。下次開放：',
        'week_sun': '日', 'week_mon': '一', 'week_tue': '二', 'week_wed': '三', 'week_thu': '四', 'week_fri': '五', 'week_sat': '六',
        'admin_verification': '管理員驗證',
        'enter_admin_password_for_settings': '請輸入管理員密碼以設定預假期間。',
        'set_next_month_leave_period': '設定下個月的預假/預班開放期間',
        'start_date': '開始日期與時間',
        'end_date': '結束日期與時間',

        // --- 導尿管照護評估 ---
        'foley_care_assessment': '導尿管照護評估表',
        'foley_care_title': '照護機構預防導尿管相關泌尿道感染每日照護評估表',

        // --- 辦公室系統 ---
        'office_system': '辦公室系統',
        'enter_office_password': '請輸入辦公室密碼',
        'auto_temp_system': '自動化體溫紀錄系統',
        'auto_clockin_system': '自動化打卡紀錄系統',
        'temperature_system': '體溫系統',
        'clockin_system': '打卡系統'
    },
    'en': {
        // --- Common ---
        'lang_switch': 'Chinese',
        'back_to_dashboard': 'Back to Dashboard',
        'back_to_main_menu': 'Back to Main Menu',
        'back_to_caregiver_system': 'Back to Caregiver System',
        'back_to_office_system': 'Back to Office System',
        'save': 'Save',
        'confirm': 'Confirm',
        'cancel': 'Cancel',
        'error_enter_name_first': 'Please enter your name first!',
        'loading': 'Loading...',
        'confirm_submission': 'Confirm Submission',
        'return_to_modify': 'Return to Modify',
        'admin_settings': 'Admin Settings',
        'please_enter_password': 'Please enter password',
        'login': 'Login',
        'password_error': 'Password incorrect, please try again!',
        'back_to_home': 'Back to Home',

        // --- Employee Systems ---
        'nurse_system': 'Nurse System',
        'caregiver_system': 'Caregiver System',
        'enter_caregiver_password': 'Please enter caregiver password',
        'caregiver_leave_system_menu': 'Leave Request System',
        'foley_care_assessment_menu': 'Foley Care Assessment',
        'temperature_record_menu': 'Temperature Recording', // ✅ 新增
        'login_network_error': 'A network error occurred during login, please try again later.',

        // --- Office System ---
        'office_system': 'Office System',
        'enter_office_password': 'Please enter office password',
        'temperature_system': 'Temperature System',
        'clockin_system': 'Clock-in System'
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
