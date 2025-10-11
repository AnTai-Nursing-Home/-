document.addEventListener('firebase-ready', () => {
    // 透過尋找一個只在 supplies.html 存在的獨特元件，來判斷我們是否在盤點頁面
    const inventoryTableBody = document.getElementById('inventory-table-body');
    if (!inventoryTableBody) return;

    // --- 元件宣告 ---
    const tableBody = inventoryTableBody;
    const resetButton = document.getElementById('reset-button');
    // ... 其他元件宣告 ...
    
    // --- 變數 ---
    const collectionName = 'supplies_inventory'; // 在 Firebase 中的集合名稱

    // --- 函式定義 ---
    async function loadAndRenderDataForDate(date) {
        tableBody.innerHTML = '讀取中...';
        try {
            const docRef = db.collection(collectionName).doc(date);
            const doc = await docRef.get();
            const dailyData = doc.exists ? doc.data() : {};
            
            // ... (後續渲染邏輯與之前幾乎相同) ...

        } catch (error) {
            console.error("讀取衛材資料失敗:", error);
            tableBody.innerHTML = '<tr><td colspan="3"><div class="alert alert-danger">讀取資料失敗，請重新整理頁面。</div></td></tr>';
        }
    }

    async function saveTodaysData() {
        // ... (驗證邏輯不變) ...

        const selectedDate = dateInput.value;
        const suppliesHistory = {
            header: { date: selectedDate, nurse: nurseInput.value, restocker: restockerInput.value },
            items: newItemsStatus
        };

        try {
            // 使用 .set() 將資料寫入 Firebase，會自動建立或覆蓋
            await db.collection(collectionName).doc(selectedDate).set(suppliesHistory);
            alert(`日期 ${selectedDate} 的盤點紀錄已成功儲存！`);
            loadAndRenderDataForDate(selectedDate);
        } catch (error) {
            console.error("儲存失敗:", error);
            alert("儲存失敗，請稍後再試。");
        }
    }

    async function generateReport() {
        // ... (驗證邏輯不變) ...

        try {
            const snapshot = await db.collection(collectionName)
                .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endDate)
                .get();
            
            // ... (後續產生報表的邏輯，資料來源改為 snapshot) ...
            
        } catch (error) {
            console.error("產生報表失敗:", error);
            alert("產生報表失敗，請稍後再試。");
        }
    }
    
    // --- 事件監聽器 ---
    resetButton.addEventListener('click', async function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) { /* ... */ return; }
        if (confirm(`您確定要清空日期 ${selectedDate} 的所有紀錄嗎？`)) {
            try {
                await db.collection(collectionName).doc(selectedDate).delete();
                alert(`日期 ${selectedDate} 的紀錄已清空。`);
                loadAndRenderDataForDate(selectedDate);
            } catch (error) {
                console.error("刪除失敗:", error);
                alert("刪除失敗，請稍後再試。");
            }
        }
    });

    // ... (其他事件監聽器不變) ...
});
