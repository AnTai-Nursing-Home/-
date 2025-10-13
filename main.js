document.addEventListener('DOMContentLoaded', function() {
    // 找到語言切換按鈕
    const langSwitcher = document.getElementById('lang-switcher');

    // 定義一個函式來套用所有翻譯
    function applyTranslations() {
        // 取得目前設定的語言
        const lang = getLanguage();
        // 設定整個 HTML 頁面的 lang 屬性，有助於 SEO 和無障礙閱讀
        document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';

        // 找到所有帶有 data-i18n 屬性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getText(key);
            
            // 處理像 <input placeholder="..."> 這樣的元素
            if (element.placeholder) {
                element.placeholder = translation;
            } else {
                // 處理一般元素
                element.textContent = translation;
            }
        });
        
        // 更新語言切換按鈕本身的文字
        if (langSwitcher) {
            langSwitcher.textContent = getText('lang_switch');
        }
    }

    // 為語言切換按鈕加上點擊事件
    if (langSwitcher) {
        langSwitcher.addEventListener('click', () => {
            const currentLang = getLanguage();
            // 如果現在是中文，就切換到英文；反之亦然
            const newLang = currentLang === 'zh-TW' ? 'en' : 'zh-TW';
            // 儲存新的語言設定
            setLanguage(newLang);
            // 重新載入頁面以套用新語言
            window.location.reload();
        });
    }

    // 頁面一載入就立刻執行一次翻譯
    applyTranslations();
});
