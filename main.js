// main.js
document.addEventListener('DOMContentLoaded', function() {
    const langSwitcher = document.getElementById('lang-switcher');

    function applyTranslations() {
        const lang = getLanguage();
        document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getText(key);
            
            if (element.placeholder) {
                element.placeholder = translation;
            } else {
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
