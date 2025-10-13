document.addEventListener('DOMContentLoaded', function() {
    const passwordSection = document.getElementById('password-section-caregiver');
    const dashboardSection = document.getElementById('dashboard-section-caregiver');
    const passwordInput = document.getElementById('passwordInput-caregiver');
    const loginButton = document.getElementById('loginButton-caregiver');
    const errorMessage = document.getElementById('errorMessage-caregiver');

    // **** 新增：檢查 URL 參數，如果指定了儀表板，就直接顯示 ****
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'dashboard') {
        passwordSection.classList.add('d-none');
        dashboardSection.classList.remove('d-none');
    }

    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) { alert(getText('please_enter_password')); return; }
        loginButton.disabled = true;
        try {
            const response = await fetch('/api/caregiver-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password }),
            });
            if (response.ok) {
                passwordSection.classList.add('d-none');
                dashboardSection.classList.remove('d-none');
            } else {
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('登入時發生錯誤:', error);
            alert(getText('login_network_error'));
        } finally {
            loginButton.disabled = false;
        }
    }

    if (loginButton) { loginButton.addEventListener('click', handleLogin); }
    if (passwordInput) { passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleLogin(); }); }
});
