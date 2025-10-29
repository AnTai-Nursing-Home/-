// 年假系統 - 版面參考 overtime.html；年度下拉、可結轉無期限（累加）
// 特休單：日期範圍/員工關鍵字/清除/匯出
// 年假統計：年份下拉/員工關鍵字/年資範圍/清除/匯出
document.addEventListener("firebase-ready", async () => {
  const db = firebase.firestore();

  // === 只讀員工集合 ===
  const NURSES_COL = "nurses";
  const CAREGIVERS_COL = "caregivers";

  // === 年假系統集合（唯讀特休單存檔） ===
  const AL_REQ_COL = "annual_leave_requests";

  // === 常數 ===
  const HOURS_PER_DAY = 8;

  // 年資→年假（年度配額）表
  const ENTITLE_TABLE = new Map([
    [0,0],[0.5,3],[1,7],[2,10],[3,14],[4,14],
    [5,15],[6,15],[7,15],[8,15],[9,15],
    [10,16],[11,17],[12,18],[13,19],[14,20],
    [15,21],[16,22],[17,23],[18,24],[19,25],
    [20,26],[21,27],[22,28],[23,29],[24,30],
    [25,30],[26,30],[27,30],[28,30],[29,30],[30,30]
  ]);

  // ==== 工具 ====
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  function parseYMD(str){ // "YYYY/MM/DD" → Date (local 00:00)
    if(!str) return null;
    const [y,m,d] = String(str).split(/[\/\-]/).map(Number);
    if(!y||!m||!d) return null;
    return new Date(y, m-1, d);
  }
  function formatYMD(d){
    const p = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`;
  }
  function monthsBetween(a, b){
    return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth());
  }
  function tenureYM(hireStr, asOf){
    const h = parseYMD(hireStr); if(!h) return {Y:0,M:0};
    const mm = monthsBetween(h, asOf);
    return {Y: Math.floor(mm/12), M: mm%12};
  }
  function fmtTenure(hireStr, asOf){
    const {Y,M} = tenureYM(hireStr, asOf);
    return `${Y}年${M}個月`;
  }
  function fmtHoursToDH(hours){
    hours = Math.max(0, Math.round(Number(hours)||0));
    const d = Math.floor(hours / HOURS_PER_DAY);
    const h = hours % HOURS_PER_DAY;
    return `${d}天${h}小時`;
  }

  // 「可結轉無期限」的定義：
  // 選擇某年度 Y 時，權益基準日 = Y-12-31
  // 可用總配額 = 0.5 年在「權益基準日」之前達標則 +3天；每滿整年各加對應天數（逐年累計）
  function accumEntitledDays(hireStr, asOf){ // asOf = 12/31 of selected year
    if(!hireStr) return 0;
    const h = parseYMD(hireStr);
    if(!h || h > asOf) return 0;
    const mm = monthsBetween(h, asOf);
    let days = 0;
    if(mm >= 6) days += ENTITLE_TABLE.get(0.5) || 0; // 半年門檻
    const fullYears = Math.floor(mm/12);
    for(let y=1; y<=fullYears; y++){
      days += ENTITLE_TABLE.get(y) || 0;
    }
    return days;
  }

  // === 載員工（兩集合合併，唯讀）===
  async function loadEmployees(){
    const out = [];
    for(const col of [NURSES_COL, CAREGIVERS_COL]){
      const snap = await db.collection(col).orderBy("sortOrder").orderBy("id").get();
      snap.forEach(d=>{
        const e = d.data();
        out.push({ id:e.id, name:e.name||"", hireDate:e.hireDate||"", type:col });
      });
    }
    return out;
  }

  // === 讀年假特休單（唯讀）===
  async function loadALRequests(){
    const list = [];
    const snap = await db.collection(AL_REQ_COL).orderBy("date","desc").get();
    snap.forEach(d=> list.push({ id:d.id, ...d.data() }));
    // 正規化：hoursUsed 整數化
    list.forEach(r => r.hoursUsed = Math.max(0, parseInt(r.hoursUsed||0,10)));
    return list;
  }

  // === Excel 匯出（將 table 轉成 xlsx）===
  function exportTableToExcel(filename, tbodyId){
    const tbody = $(tbodyId);
    const headers = [...tbody.parentElement.querySelectorAll("thead th")].map(th=>th.innerText);
    const data = [[...headers]];
    tbody.querySelectorAll("tr").forEach(tr=>{
      data.push([...tr.children].map(td=>td.innerText));
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  }

  // === 年度下拉 ===
  function buildYearOptions(){
    const sel = $("yearSelect");
    const now = new Date();
    const thisY = now.getFullYear();
    const start = thisY - 5; // 近期五年，可自行調整
    const end   = thisY + 1; // 明年也能先看
    sel.innerHTML = "";
    for(let y=end; y>=start; y--){
      const opt = document.createElement("option");
      opt.value = y; opt.textContent = y;
      if(y===thisY) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  // ====== 狀態（資料快取） ======
  let EMPLOYEES = [];
  let REQS = [];
  function selectedYear(){
    const y = parseInt($("yearSelect").value,10);
    return isNaN(y) ? (new Date()).getFullYear() : y;
  }
  function yearStartEnd(y){
    return { start:new Date(y,0,1), end:new Date(y,11,31) };
  }

  // ====== 特休單畫面 ======
  function applyReqFilters(list){
    const y = selectedYear();
    const {start,end} = yearStartEnd(y);
    // 預設以「所選年」為基礎先篩一次（方便查年資料）
    let out = list.filter(r=>{
      const d = parseYMD(r.date);
      return d && d >= start && d <= end;
    });

    const df = $("reqDateFrom").value ? new Date($("reqDateFrom").value) : null;
    const dt = $("reqDateTo").value   ? new Date($("reqDateTo").value)   : null;
    const kw = $("reqEmpKeyword").value.trim();

    if(df) out = out.filter(r => parseYMD(r.date) >= df);
    if(dt) out = out.filter(r => parseYMD(r.date) <= dt);
    if(kw){
      const k = kw.toLowerCase();
      out = out.filter(r =>
        String(r.empId||"").toLowerCase().includes(k) ||
        String(r.name||"").toLowerCase().includes(k)
      );
    }
    return out;
  }
  async function renderRequests(){
    const body = $("al-req-body");
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
    const filtered = applyReqFilters(REQS);
    if(!filtered.length){
      body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">沒有符合條件的資料</td></tr>`;
      return;
    }
    body.innerHTML = filtered.map(r=>`
      <tr>
        <td>${esc(r.date||"")}</td>
        <td>${esc(r.empId||"")}</td>
        <td>${esc(r.name||"")}</td>
        <td>${r.hoursUsed} 小時</td>
        <td>${esc(r.reason||"")}</td>
        <td>${esc(r.approvedBy||"")}</td>
        <td>${esc(r.id||"")}</td>
      </tr>
    `).join("");

    $("export-req-excel").onclick = ()=> exportTableToExcel("特休單.xlsx", "al-req-body");
    $("reqFilterBtn").onclick = ()=> renderRequests();
    $("reqClearBtn").onclick = ()=>{
      $("reqDateFrom").value = "";
      $("reqDateTo").value   = "";
      $("reqEmpKeyword").value = "";
      renderRequests();
    };
  }

  // ====== 年假統計畫面 ======
  // 可結轉無期限：選定年度年終為基準日，計算截至該日的「總可用配額（天→小時）」再扣除「歷年截至該年度的已用小時」。
  function applyStatFilters(rows){
    const kw = $("statEmpKeyword").value.trim().toLowerCase();
    const tmin = $("tenureMin").value ? Number($("tenureMin").value) : null;
    const tmax = $("tenureMax").value ? Number($("tenureMax").value) : null;

    return rows.filter(r=>{
      let ok = true;
      if(kw){
        ok = ok && (r.id.toLowerCase().includes(kw) || (r.name||"").toLowerCase().includes(kw));
      }
      if(tmin!=null){
        ok = ok && (r.tenureY >= tmin);
      }
      if(tmax!=null){
        ok = ok && (r.tenureY <= tmax);
      }
      return ok;
    });
  }

  async function renderStats(){
    const body = $("al-stat-body");
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;

    const y = selectedYear();
    const asOf = new Date(y,11,31);

    // 累計每人已用（到該年度為止，因為是可結轉無期限）
    const usedHoursByEmp = REQS
      .filter(r=>{ const d=parseYMD(r.date); return d && d <= asOf; })
      .reduce((m,r)=>{ m[r.empId]=(m[r.empId]||0)+Number(r.hoursUsed||0); return m; },{});

    const rows = EMPLOYEES.map(e=>{
      const entitledDays = accumEntitledDays(e.hireDate, asOf);
      const entitledHours = entitledDays * HOURS_PER_DAY;
      const used = usedHoursByEmp[e.id] || 0;
      const remain = Math.max(entitledHours - used, 0);

      const {Y} = tenureYM(e.hireDate, asOf);
      return {
        id: e.id,
        name: e.name,
        hire: e.hireDate,
        tenureStr: fmtTenure(e.hireDate, asOf),
        tenureY: Y,
        entitledDays,
        used,
        remain
      };
    });

    const filtered = applyStatFilters(rows);
    if(!filtered.length){
      body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">沒有符合條件的資料</td></tr>`;
      return;
    }
    body.innerHTML = filtered.map(r=>`
      <tr>
        <td>${esc(r.id)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.hire)}</td>
        <td>${esc(r.tenureStr)}</td>
        <td>${r.entitledDays} 天</td>
        <td>${fmtHoursToDH(r.used)}</td>
        <td>${fmtHoursToDH(r.remain)}</td>
      </tr>
    `).join("");

    $("export-stat-excel").onclick = ()=> exportTableToExcel("年假統計.xlsx", "al-stat-body");
    $("statFilterBtn").onclick = ()=> renderStats();
    $("statClearBtn").onclick = ()=>{
      $("statEmpKeyword").value = "";
      $("tenureMin").value = "";
      $("tenureMax").value = "";
      renderStats();
    };
  }

  // === 年度選擇事件 ===
  function bindYearChange(){
    $("yearSelect").addEventListener("change", ()=>{
      // 兩個分頁都需反映新年度
      renderRequests();
      renderStats();
    });
  }

  // === 初始 ===
  buildYearOptions();
  EMPLOYEES = await loadEmployees();
  REQS = await loadALRequests();
  bindYearChange();

  await renderRequests();
  await renderStats();
});
