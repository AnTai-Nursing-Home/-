document.addEventListener('firebase-ready', () => {
    const container = document.getElementById('employee-list-container');
    if (!container) return;

    const recordDateInput = document.getElementById('record-date');
    const saveTempsBtn = document.getElementById('save-temps-btn');
    
    const employeesCollection = 'nurses'; // 指定讀取護理師名冊

    async function loadAndRenderEmployees() {
        container.innerHTML = '讀取中...';
        try {
            const snapshot = await db.collection(employeesCollection).orderBy('sortOrder').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">員工名冊尚無資料。</p>';
                return;
            }
            let html = '<ul class="list-group">';
            snapshot.forEach(doc => {
                const emp = doc.data();
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${emp.name} (${emp.id})</span>
                        <div class="input-group" style="width: 120px;">
                            <input type="number" class="form-control temp-input" placeholder="體溫" data-id="${emp.id}">
                            <span class="input-group-text">°C</span>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;
        } catch (error) {
            console.error("讀取員工列表失敗:", error);
            container.innerHTML = '<div class="alert alert-danger">讀取員工列表失敗。</div>';
        }
    }

    // --- 初始操作 ---
    recordDateInput.value = new Date().toISOString().split('T')[0];
    loadAndRenderEmployees();
});
