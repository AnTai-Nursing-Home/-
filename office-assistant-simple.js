// 輔助系統（簡化版）

const KEY = "assistant_reminders";

function getUser(){
    try{
        return JSON.parse(sessionStorage.getItem("officeAuth")) || {};
    }catch(e){ return {}; }
}

function loadReminders(){
    const user = getUser();
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    return data[user.staffId] || [];
}

function saveReminders(list){
    const user = getUser();
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    data[user.staffId] = list;
    localStorage.setItem(KEY, JSON.stringify(data));
}

function render(){
    const list = loadReminders();
    const ul = document.getElementById("reminderList");
    if(!ul) return;

    ul.innerHTML = "";
    list.forEach((r,i)=>{
        const li = document.createElement("li");
        li.innerHTML = r.date + " - " + r.text + 
        ` <button onclick="del(${i})">刪除</button>`;
        ul.appendChild(li);
    });
}

function addReminder(){
    const date = document.getElementById("reminderDate").value;
    const text = document.getElementById("reminderText").value;
    if(!date || !text) return alert("請輸入");

    const list = loadReminders();
    list.push({date,text});
    saveReminders(list);
    render();
}

function del(i){
    const list = loadReminders();
    list.splice(i,1);
    saveReminders(list);
    render();
}

// ====== 首頁彈窗 ======
function showPopupIfNeeded(){
    const list = loadReminders();
    if(!list.length) return;

    let msg = "提醒事項:\n";
    list.forEach(r=>{
        msg += r.date + " - " + r.text + "\n";
    });

    alert(msg);
}

// 判斷是否在辦公室首頁
document.addEventListener("DOMContentLoaded", ()=>{
    render();

    // 如果有 dashboard 就代表登入後首頁
    if(document.getElementById("dashboard-section-office")){
        setTimeout(showPopupIfNeeded, 800);
    }
});
