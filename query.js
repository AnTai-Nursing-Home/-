document.addEventListener('firebase-ready', () => {
    const queryPhoneInput = document.getElementById('queryPhoneInput');
    if (!queryPhoneInput) return;

    const backButtonGeneral = document.querySelector('.btn-back-menu');
    if (backButtonGeneral && document.referrer.includes('admin.html')) {
        backButtonGeneral.href = 'admin.html?view=dashboard';
        const icon = backButtonGeneral.querySelector('i');
        backButtonGeneral.innerHTML = '';
        backButtonGeneral.appendChild(icon);
        backButtonGeneral.append(` ${getText('back_to_dashboard')}`);
    }
    
    const searchButton = document.getElementById('searchButton');
    const queryResultsContainer = document.getElementById('queryResults');

    function displaySearchResults(results) {
        if (results.length === 0) {
            queryResultsContainer.innerHTML = `<p class="text-center text-muted">${getText('no_records_found')}</p>`;
            return;
        }
        let html = '<ul class="list-group">';
        results.forEach(b => {
            html += `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${b.date} ${b.time}</strong><br><small>住民: ${b.residentName} / 家屬: ${b.visitorName}</small></div><button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">${getText('cancel')}</button></li>`;
        });
        html += '</ul>';
        queryResultsContainer.innerHTML = html;
    }

    async function performSearch() {
        const phone = queryPhoneInput.value.trim();
        if (!phone) {
            alert(getText('please_enter_phone'));
            return;
        }
        queryResultsContainer.innerHTML = getText('querying');
        try {
            const today = new Date().toISOString().split('T')[0];
            const snapshot = await db.collection('bookings')
                .where('visitorPhone', '==', phone)
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();
            const foundBookings = [];
            snapshot.forEach(doc => {
                foundBookings.push({ id: doc.id, ...doc.data() });
            });
            displaySearchResults(foundBookings);
        } catch (error) {
            console.error("查詢失敗:", error);
            queryResultsContainer.innerHTML = `<div class="alert alert-danger">${getText('query_failed')}</div>`;
        }
    }

    searchButton.addEventListener('click', performSearch);
    queryPhoneInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    queryResultsContainer.addEventListener('click', async function(e) {
        if (e.target.classList.contains('btn-cancel')) {
            if (confirm(getText('confirm_cancel_booking'))) {
                const docId = e.target.dataset.id;
                try {
                    e.target.disabled = true;
                    await db.collection('bookings').doc(docId).delete();
                    alert(getText('booking_cancelled_success'));
                    performSearch();
                } catch (error) {
                    console.error("刪除失敗:", error);
                    alert(getText('delete_failed'));
                    e.target.disabled = false;
                }
            }
        }
    });
});
