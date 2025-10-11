document.addEventListener('DOMContentLoaded', function() {
    const langSwitcher = document.getElementById('lang-switcher');

    function applyTranslations() {
        const lang = getLanguage();
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (element.placeholder) {
                element.placeholder = getText(key);
            } else {
                element.textContent = getText(key);
            }
        });
        // 更新切換按鈕的文字
        if (langSwitcher) {
            langSwitcher.textContent = getText('lang_switch');
        }
    }

    if (langSwitcher) {
        langSwitcher.addEventListener('click', () => {
            const currentLang = getLanguage();
            const newLang = currentLang === 'zh-TW' ? 'en' : 'zh-TW';
            setLanguage(newLang);
            window.location.reload(); // 重新載入頁面以套用新語言
        });
    }

    // 頁面載入時立即套用翻譯
    applyTranslations();
});
