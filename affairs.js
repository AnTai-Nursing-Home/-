document.addEventListener('DOMContentLoaded', function () {
  // ✅ 事務系統已改為「不需密碼」：直接顯示儀表板
  const passwordSection = document.getElementById('password-section');
  const dashboardSection = document.getElementById('dashboard-section');

  if (passwordSection) passwordSection.classList.add('d-none');
  if (dashboardSection) dashboardSection.classList.remove('d-none');

  // 如需保留原本 ?view=dashboard 的相容性，這裡不做額外處理即可。
});
