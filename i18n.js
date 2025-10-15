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
        'read_failed': '讀取失敗',
        'status_ongoing': '進行中',
        'status_closed': '已結案',
        'not_set': '未設定',
        'read_list_failed': '讀取列表失敗。',
        'fill_form_first': '請先選擇住民並填寫置放日期！',
        'care_form_saved': '照護單已成功儲存！',
        'confirm_delete_care_form': '您確定要永久刪除此張照護單嗎？\n此操作無法復原！',
        'care_form_deleted': '照護單已成功刪除！',
        'index_building_warning': '系統正在建立新的資料庫索引以支援查詢，請等待幾分鐘後再試。',
        'load_care_form_failed': '載入照護單失敗，請稍後再試。',

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

        // --- 護理師/照服員系統 ---
        'nurse_system': '護理師系統',
        'enter_nurse_password': '請輸入護理師密碼',
        'booking_list_query': '預約名單查詢',
        'proxy_booking': '代客預約',
        'supplies_inventory': '衛材點班',
        'leave_system': '預假系統',
        'all_booking_records': '所有預約紀錄',
        'resident_data_management': '住民資料管理',
        'caregiver_system': '照服員系統',
        'enter_caregiver_password': '請輸入照服員密碼',
        'caregiver_leave_system_menu': '預假系統',
        'login_network_error': '登入時發生網路錯誤，請稍後再試。',
        'foley_care_assessment_menu': '導尿管照護評估',
        'employee_data_management': '員工資料管理',
        'temperature_log': '體溫登錄',

        // --- 預假/預班系統 ---
        'leave_system_title': '預假/預班系統',
        'nurse_leave_system': '護理師 預假/預班系統',
        'caregiver_leave_system': '照服員 預假/預班系統',
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
        'shift_d': 'D (白班)', 'shift_n': 'N (大夜)', 'shift_off': 'OFF (休假)',

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
        'fill_resident_name': '請務必填寫住民姓名！',
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
        'yes': 'Yes', 'no': 'No', 'save_this_care_form': '儲存此張照護單', 'ongoing_care_forms': '進行中的照護單',
        'closed_care_forms': '已結案的照護單', 'add_new_form': '新增照護單', 'no_care_forms_found': '找不到符合條件的照護單紀錄。',
        'care_period': '照護期間', 'ongoing': '持續中', 'delete_this_care_form': '刪除此張照護單', 'back_to_list': '返回列表',
    },
    'en': {
        // ... (所有英文翻譯) ...
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
