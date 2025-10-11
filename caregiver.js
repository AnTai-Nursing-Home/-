document.addEventListener('DOMContentLoaded', function() {
    const passwordSection = document.getElementById('password-section-caregiver');
    const dashboardSection = document.getElementById('dashboard-section-caregiver');
    const passwordInput = document.getElementById('passwordInput-caregiver');
    const loginButton = document.getElementById('loginButton-caregiver');
    const errorMessage = document.getElementById('errorMessage-caregiver');

    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) { alert('請輸入密碼'); return; }
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
            alert('登入時發生網路錯誤，請稍後再試。');
        } finally {
            loginButton.disabled = false;
        }
    }

    if (loginButton) { loginButton.addEventListener('click', handleLogin); }
    if (passwordInput) { passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleLogin(); }); }
});
