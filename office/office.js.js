document.addEventListener('DOMContentLoaded', function() {
    const passwordSection = document.getElementById('password-section-office');
    if (!passwordSection) return;

    const dashboardSection = document.getElementById('dashboard-section-office');
    const passwordInput = document.getElementById('passwordInput-office');
    const loginButton = document.getElementById('loginButton-office');
    const errorMessage = document.getElementById('errorMessage-office');
    
    // 檢查 URL 參數，如果指定了儀表板，就直接顯示
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'dashboard') {
        passwordSection.classList.add('d-none');
        dashboardSection.classList.remove('d-none');
    }

    async function handleLogin() {
         // ✅ 新增：未勾選不得登入
        const privacyCheck = document.getElementById('privacyCheck');
        if (!privacyCheck.checked) {
            alert("請先勾選同意《安泰醫療社團法人附設安泰護理之家服務系統使用協議》");
            return;
        }
        const password = passwordInput.value;
        if (!password) {
            alert('請輸入密碼');
            return;
        }

        // 禁用按鈕並隱藏錯誤訊息
        loginButton.disabled = true;
        errorMessage.classList.add('d-none');

        try {
            // 將密碼傳送到後端 API 進行驗證
            const response = await fetch('/api/office-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password }),
            });

            if (response.ok) {
                // 如果後端回傳成功 (200 OK)
                passwordSection.classList.add('d-none');
                dashboardSection.classList.remove('d-none');
            } else {
                // 如果後端回傳失敗 (例如 401 密碼錯誤)
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('登入時發生錯誤:', error);
            alert('登入時發生網路錯誤，請稍後再試。');
        } finally {
            // 無論成功或失敗，最後都要恢復按鈕
            loginButton.disabled = false;
        }
    }

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
});
