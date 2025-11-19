document.addEventListener('DOMContentLoaded', () => {
  const bookingListContainer = document.getElementById('booking-list');
  const refreshBtn = document.getElementById('refresh-btn');

  async function displayBookings() {
    bookingListContainer.innerHTML = '讀取中...';
    try {
      const todayString = new Date().toISOString().split('T')[0];
      const snapshot = await db.collection('bookings')
        .where('date', '>=', todayString)
        .orderBy('date', 'asc')
        .orderBy('time', 'asc')
        .get();

      const bookingsByDate = {};
      snapshot.forEach(doc => {
        const booking = { id: doc.id, ...doc.data() };
        if (!bookingsByDate[booking.date]) bookingsByDate[booking.date] = [];
        bookingsByDate[booking.date].push(booking);
      });

      const upcomingDates = Object.keys(bookingsByDate).sort();
      if (upcomingDates.length === 0) {
        bookingListContainer.innerHTML = '<p class="text-center">目前沒有未來或今日的預約紀錄。</p>';
        return;
      }

      let html = '';
      upcomingDates.forEach(date => {
        html += `<h4>${date}</h4>`;
        html += `<table class="table table-bordered table-striped table-hover">
                  <thead class="table-light">
                    <tr>
                      <th>時段</th>
                      <th>住民姓名</th>
                      <th>床號</th>
                      <th>與住民關係</th>
                      <th style="width:100px;">操作</th>
                    </tr>
                  </thead>
                  <tbody>`;
        bookingsByDate[date].forEach(b => {
          html += `<tr>
                    <td>${b.time || ''}</td>
                    <td>${b.residentName || ''}</td>
                    <td>${b.bedNumber || ''}</td>
                    <td>${b.visitorRelationship || '未填寫'}</td>
                    <td><button class="btn btn-sm btn-danger btn-admin-delete" data-id="${b.id}">刪除</button></td>
                   </tr>`;
        });
        html += `</tbody></table>`;
      });
      bookingListContainer.innerHTML = html;
    } catch (error) {
      console.error("讀取預約列表失敗:", error);
      bookingListContainer.innerHTML = '<div class="alert alert-danger">讀取預約列表失敗，請重新整理頁面。</div>';
    }
  }

  // 初始化：firebase-ready 後載入
  document.addEventListener('firebase-ready', () => displayBookings());
  if (refreshBtn) refreshBtn.addEventListener('click', displayBookings);

  // 刪除
  bookingListContainer.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('btn-admin-delete')) return;
    const docId = e.target.dataset.id;
    if (confirm('確定要刪除這筆預約嗎？\n此操作無法復原。')) {
      try {
        e.target.disabled = true;
        await db.collection('bookings').doc(docId).delete();
        alert('預約已刪除！');
        displayBookings();
      } catch (error) {
        console.error("管理員刪除失敗:", error);
        alert("刪除失敗，請稍後再試。");
        e.target.disabled = false;
      }
    }
  });
});
