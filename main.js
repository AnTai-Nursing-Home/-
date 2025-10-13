// main.js
document.addEventListener('DOMContentLoaded', function() {
    const langSwitcher = document.getElementById('lang-switcher');

    function applyTranslations() {
        const lang = getLanguage();
        document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getText(key);
            
            // 檢查是否有 title 屬性需要翻譯
            const titleKey = element.getAttribute('data-i18n-title');
            if (titleKey) {
                element.title = getText(titleKey);
            }

            // 檢查是否有 placeholder 屬性需要翻譯
            const placeholderKey = element.getAttribute('data-i18n-placeholder');
            if (placeholderKey) {
                element.placeholder = getText(placeholderKey);
            }

            // 處理一般文字內容
            if (element.tagName !== 'INPUT') {
                element.textContent = translation;
            }
        });
        
        if (langSwitcher) {
            langSwitcher.textContent = getText('lang_switch');
        }
    }

    if (langSwitcher) {
        langSwitcher.addEventListener('click', () => {
            const newLang = getLanguage() === 'zh-TW' ? 'en' : 'zh-TW';
            setLanguage(newLang);
            window.location.reload();
        });
    }

    applyTranslations();
});
