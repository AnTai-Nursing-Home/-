// 年假系統 - 兩分頁：特休單（唯讀） / 年假統計
// 規則：8小時=1天；支援整數小時與半天(4小時)；特休單顯示請假原因；匯出Excel
// 依你的架構：等 Firebase 初始化完成後觸發 'firebase-ready'
document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();

  // ====== 你現有的員工集合（只讀，不寫入） ======
  const NURSES_COL = "nurses";
  const CAREGIVERS_COL = "caregivers";

  // ====== 年假系統集合（新建） ======
  // 已核准特休單的唯讀存檔：從請假系統拋轉而來
  const AL_REQ_COL = "annual_leave_requests";

  // ====== 參數與對照表 ======
  const HOURS_PER_DAY = 8;
  // 年資(年) → 當年度可放天數（依你提供的表）
  const ENTITLE_TABLE = new Map([
    [0,0],[0.5,3],[1,7],[2,10],[3,14],[4,14],
    [5,15],[6,15],[7,15],[8,15],[9,15],
    [10,16],[11,17],[12,18],[13,19],[14,20],
    [15,21],[16,22],[17,23],[18,24],[19,25],
    [20,26],[21,27],[22,28],[23,29],
    [24,30],[25,30],[26,30],[27,30],[28,30],[29,30],[30,30]
  ]);

  // ====== 小工具 ======
  const escapeHTML = (s) =>
    String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear())*12 + (b.getMonth() - a.getMonth());
  }

  // 累計「可放年假天數」：0.5年先給對應天數；每滿整年再加上當年的天數（逐年累加）
  function accumEntitledDays(hireDateStr, today = new Date()) {
    if (!hireDateStr) return 0;
    const [y, m, d] = hireDateStr.split("/").map(Number);
    const hire = new Date(y, (m || 1)-1, d || 1);
    const mm = monthsBetween(hire, today);

    let days = 0;
    if (mm >= 6) days += ENTITLE_TABLE.get(0.5) || 0; // 半年門檻
    const fullYears = Math.floor(mm / 12);
    for (let yr = 1; yr <= fullYears; yr++) {
      days += ENTITLE_TABLE.get(yr) || 0;
    }
    return days;
  }

  function fmtHoursToDH(hours) {
    hours = Math.max(0, Math.round(Number(hours) || 0));
    const d = Math.floor(hours / HOURS_PER_DAY);
    const h = hours % HOURS_PER_DAY;
    return `${d}天${h}小時`;
  }

  function fmtTenure(hireDateStr) {
    if (!hireDateStr) return "";
    const [y, m, d] = hireDateStr.split("/").map(Number);
    const hire = new Date(y, (m||1)-1, d || 1);
    const now = new Date();
    const mm = monthsBetween(hire, now);
    const Y = Math.floor(mm / 12);
    const M = mm % 12;
    return `${Y}年${M}個月`;
  }

  // ====== 讀員工（兩集合合併，只讀） ======
  async function loadEmployees() {
    const out = [];
    const plan = [[NURSES_COL, "護理師"], [CAREGIVERS_COL, "照服員"]];
    for (const [col] of plan) {
      const snap = await db.collection(col).orderBy("sortOrder").orderBy("id").get();
      snap.forEach(d => {
        const e = d.data();
        out.push({
          id: e.id,
          name: e.name,
          hireDate: e.hireDate || "",
          type: col
        });
      });
    }
    return out;
  }

  // ====== 讀年假特休單（唯讀） ======
  async function loadApprovedRequests() {
    const list = [];
    const snap = await db.collection(AL_REQ_COL).orderBy("date", "desc").get();
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  // ====== 匯出 Excel（把 table 轉成 XLSX） ======
  function exportTableToExcel(filename, tableTbodyId) {
    const tbody = document.getElementById(tableTbodyId);
    const theadRow = [...tbody.parentElement.querySelectorAll("thead th")].map(th => th.innerText);
    const data = [[...theadRow]];
    tbody.querySelectorAll("tr").forEach(tr => {
      data.push([...tr.children].map(td => td.innerText));
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // ====== 畫面：特休單（唯讀） ======
  async function renderRequests() {
    const body = document.getElementById("al-req-body");
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
    const list = await loadApprovedRequests();
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">目前沒有資料</td></tr>`;
      return;
    }
    body.innerHTML = list.map(r => `
      <tr>
        <td>${escapeHTML(r.date || "")}</td>
        <td>${escapeHTML(r.empId || "")}</td>
        <td>${escapeHTML(r.name || "")}</td>
        <td>${Number(r.hoursUsed || 0)} 小時</td>
        <td>${escapeHTML(r.reason || "")}</td>
        <td>${escapeHTML(r.approvedBy || "")}</td>
        <td>${escapeHTML(r.id || "")}</td>
      </tr>
    `).join("");

    const btn = document.getElementById("export-req-excel");
    if (btn) btn.onclick = () => exportTableToExcel("特休單.xlsx", "al-req-body");
  }

  // ====== 畫面：年假統計（動態計算） ======
  async function renderStats() {
    const body = document.getElementById("al-stat-body");
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;

    const [emps, reqs] = await Promise.all([loadEmployees(), loadApprovedRequests()]);

    // empId -> 已使用小時
    const usedHoursByEmp = reqs.reduce((acc, r) => {
      const id = r.empId;
      const h = Math.max(0, Math.round(Number(r.hoursUsed || 0)));
      acc[id] = (acc[id] || 0) + h;
      return acc;
    }, {});

    const rows = emps.map(e => {
      const entitledDays = accumEntitledDays(e.hireDate);
      const entitledHours = entitledDays * HOURS_PER_DAY;
      const used = usedHoursByEmp[e.id] || 0;
      const remain = Math.max(entitledHours - used, 0);
      return {
        id: e.id,
        name: e.name || "",
        hire: e.hireDate || "",
        tenure: fmtTenure(e.hireDate),
        entitled: `${entitledDays} 天`,
        used: fmtHoursToDH(used),
        remain: fmtHoursToDH(remain)
      };
    });

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">尚無員工資料</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHTML(r.id)}</td>
        <td>${escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.hire)}</td>
        <td>${escapeHTML(r.tenure)}</td>
        <td>${escapeHTML(r.entitled)}</td>
        <td>${escapeHTML(r.used)}</td>
        <td>${escapeHTML(r.remain)}</td>
      </tr>
    `).join("");

    const btn = document.getElementById("export-stat-excel");
    if (btn) btn.onclick = () => exportTableToExcel("年假統計.xlsx", "al-stat-body");
  }

  // ====== 啟動 ======
  await renderRequests();
  await renderStats();
});
