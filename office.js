document.addEventListener('DOMContentLoaded', function() {
    const passwordSection = document.getElementById('password-section-office');
    if (!passwordSection) return;

    const dashboardSection = document.getElementById('dashboard-section-office');
    const passwordInput = document.getElementById('passwordInput-office');
    const loginButton = document.getElementById('loginButton-office');
    const errorMessage = document.getElementById('errorMessage-office');
    
    // 辦公室系統的密碼，您可以自行修改
    const CORRECT_PASSWORD = "660216"; // 請務必修改為一個安全的密碼

    function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            alert('請輸入密碼');
            return;
        }

        // 為了簡單起見，我們先用前端直接比對的方式。
        // 未來如果需要更高安全性，可以改為後端驗證。
        if (password === CORRECT_PASSWORD) {
            passwordSection.classList.add('d-none');
            dashboardSection.classList.remove('d-none');
        } else {
            errorMessage.classList.remove('d-none');
        }
    }

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
});
