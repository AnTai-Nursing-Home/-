// nutritionist-tube.js
// 目標：
// 1) 以「Excel 原檔模板」為版面基準（tube-template.xlsx）
// 2) 網頁可直接編輯儲存至 Firestore（自動儲存）
// 3) 匯出 Excel 會把你修改過的儲存格寫回模板，再下載（版面一致）
//
// 存放：collection 'nutrition_tube' / doc 'tube' （固定一份，不分日期）

const TEMPLATE_XLSX = 'tube-template.xlsx';
const FS_COLLECTION = 'nutrition_tube';
const FS_DOC = 'tube';

const initialSheets = {"單獨泡製": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], [1, "103-1", "賴坤財\nLai Kuntsai", 250, 2.5, "X", "水腫限水", 1635, 67, ""], [2, "101-2", "洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [3, "105-1", "戴喜垣\nTai Hsiyuan", "", "", 200, "", 1506, 53, "自備奶(管灌安素*6餐)"], [4, "105-2", "洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [5, "106-2", "阮麗華  Ruan Lihua", 150, 2.5, "X", "水腫限水", 1635, 67, ""], [6, "206-1", "吳邱芳梅 Wu Qiufangmei", 200, 2, 200, "", 1308, 53.4, "太胖，減重"], [7, "211-1", "李秀花  \nLi Xiuhua", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [8, "212-2", "葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [9, "217-3", "紀余日仔\nRi zi", 200, 2, 200, "", 1046, 43, "只要2匙*4餐(醫囑)"], [10, "218-2", "王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [11, "220-3", "王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [12, "221-2", "陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "221-3", "楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "總計\ntotal", "", "=SUM(D5:D14)", "=SUM(E5:E14)", "=SUM(F5:F14)", "", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", "", ""]], "奶粉2.5匙": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)"], [1, "101-1", "楊仲富    Zhongfu ", 250, 2.5, 200, "", 1635, 67], [2, "107-2", "蔡調榮\nCai Diaorong", 250, 2.5, 200, "", 1635, 67], [3, "108-1", "呂曾芳妹\nLyu-Zeng Fangmei\n", 250, 2.5, 200, "", 1635, 67], [4, "108-2", "林麗真\nLin Lizhen", 250, 2.5, 200, "", 1635, 67], [5, "112-1", "洪周金好\nJin Hao", 250, 2.5, 200, "", 1635, 67], [6, "202-1", "余劉春花  YU LIU CHUN HUA", 250, 2.5, 200, "", 1635, 67], [7, "202-2", "賴淑芬\nLai Shufen", 250, 2.5, "", "由口喝牛奶", 1635, 67], [8, "203-1", "王蘇罔腰\n Su's waist", 250, 2.5, 200, "", 1635, 67], [9, "203-2", "許陳金鉛  Xu Chenjin lead", 250, 2.5, 200, "", 1635, 67], [10, "205-2", "潘麗珍\nPan Lijhen", 250, 2.5, 200, "", 1635, 67], [11, "207-2", "戴榮興\nDai Rongsing", 250, 2.5, 200, "", 1635, 67], [12, "209-2", "李閠源\nLI YUAN", 250, 2.5, 200, "", 1635, 67], [13, "215-1", "鄞進發    \nYin Jinfa ", 250, 2.5, 200, "", 1635, 67], [14, "216-1", "王萬福\nWang Wanfu", 250, 2.5, 200, "", 1635, 67], [15, "216-2", "陳佳駿\nChen Chiachun", 250, 2.5, 200, "", 1635, 67], [16, "217-1", "郭蜜琴\nMiqin", 250, 2.5, "", "由口喝全奶", 1635, 67], [17, "217-5", "王慧雅\nWang Hueiya", 250, 2.5, 200, "", 1635, 67], [18, "218-1", "蔡郭米  Guomi", 250, 2.5, 200, "", 1635, 67], [19, "218-5", "鄭張貴英\nGuiying", 250, 2.5, 200, "", 1635, 67], [20, "219-1", "許謝運珍YUN-CHEN", 250, 2.5, 200, "", 1635, 67], [21, "219-3", "王秀珠 \nWang Xiuzhu", 250, 2.5, 200, "", 1635, 67], [22, "220-1", "曾光亮\nTseng Kuangliang", 250, 2.5, 200, "", 1635, 67], [23, "308-2", "曾清火  Qinghuo", 250, 2.5, "", "由口喝牛奶", 1635, 67], [23, "總計\ntotal", "", "=SUM(D3:D25)", "=SUM(E3:E25)", "=SUM(F3:F25)", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", ""]], "奶粉匙數": [["奶粉/匙/30克", "喝牛奶人數", "去住院人數", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, "='奶粉2.5匙'!A26", "", "=B2*A2", "=D2*H2", "=D2*H2*5", "=D2*5*30*H2", 30, 3021, 3, 35], [3, 3, "", "=B3*A3", "=D3*H2", "=D3*H2*5", "=D3*5*30*H2", "", "", "", 105], [3.5, 5, "", "=B4*A4", "=D4*H2", "=D4*H2*5", "=D4*5*30*H2", "", "", "", ""], ["合計", "=SUM(B2:B4)", "", "=SUM(D2:D4)", "=SUM(E2:E4)", "=SUM(F2:F4)", "=SUM(G2:G4)", "", "", "", ""], [2.5, "", 6, "=C6*A6", "=D6*H2", "=E6*5", "=F6*30", "", "", "", ""], ["", "", "", "換算包數", "=(E5-E6)/3021", "=(F5-F6)/3021", "=(G5-G6)/3021", "", "", "", ""], ["", "", "", "", "", "", "", "", "", "", ""], ["奶粉/匙/57克", "喝牛奶人數", "", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, 36, "", "=B10*A10", "=D10*H10", "=D10*H10*5", "=D10*5*30*H10", 30, 3021, 3, 35], ["", "", "", "換算包數", "=E10/3021", "=F10/3021", "=G10/3021", "", "", "", ""]], "加餐-牛奶名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐", "", "", "", "", "", "", "", "", "", "", ""], ["", "飲食型態 Diet pattern", "供應\n餐別", "主食Meal\n(碗 bowl)", "", "", "蔬菜類\nvegetables\n(碗 bowl)", "豆魚蛋肉類\nChicken, Meat, egg, fish\nsoybean", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)", "額\n外\n補\n充", "特\n殊\n指\n示"], ["姓名\nName", "食物型態", "", "", "", "", "", "", "", "", "", ""], ["", "", "", "飯\nRice", "粥\nCongee", "麵\nnoodle", "", "", "", "", "", ""], ["古金山\nGU JIN SHAN", "一般\nnormal", "洗腎餐\ndialysis", 1, 2, 2, 1, 3, 1800, 90, "護力養罐裝\n(22點)", ""], ["黃亮達\nLiangda", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["杜典崑\nDudian kun", "剁碎+乾飯\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["林烈雲\nLieyun", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["潘郁豐 \nPan Yufeng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["林安允\nAnyun", "剁碎\nChopped", "糖尿病\ndiabetes", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["劉藍麗珠 Li Jue", "一般+稀飯\nnormal+\ncongee", "高蛋白\nHigt  protein", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["許榮成  Rongceng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["邱桂英\nGuiying", "攪打\nGrind", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""]], "第六餐加餐名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", ""], ["姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], ["洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["李秀花  \nLi Xiuhua", 250, 3, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"]]};
const sheetMeta = {"單獨泡製": {"max_row": 20, "max_col": 10, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 10}, {"r1": 19, "c1": 2, "r2": 19, "c2": 10}, {"r1": 20, "c1": 2, "r2": 20, "c2": 10}, {"r1": 17, "c1": 1, "r2": 20, "c2": 1}, {"r1": 17, "c1": 2, "r2": 17, "c2": 10}, {"r1": 18, "c1": 2, "r2": 18, "c2": 10}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉2.5匙": {"max_row": 30, "max_col": 9, "merges": [{"r1": 27, "c1": 1, "r2": 30, "c2": 1}, {"r1": 30, "c1": 2, "r2": 30, "c2": 9}, {"r1": 29, "c1": 2, "r2": 29, "c2": 9}, {"r1": 1, "c1": 1, "r2": 1, "c2": 9}, {"r1": 28, "c1": 2, "r2": 28, "c2": 9}, {"r1": 27, "c1": 2, "r2": 27, "c2": 9}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉匙數": {"max_row": 11, "max_col": 11, "merges": [], "title": "奶粉/匙/30克"}, "加餐-牛奶名單": {"max_row": 13, "max_col": 12, "merges": [{"r1": 2, "c1": 9, "r2": 4, "c2": 9}, {"r1": 2, "c1": 4, "r2": 3, "c2": 6}, {"r1": 2, "c1": 3, "r2": 4, "c2": 3}, {"r1": 1, "c1": 1, "r2": 1, "c2": 12}, {"r1": 2, "c1": 7, "r2": 4, "c2": 7}, {"r1": 3, "c1": 1, "r2": 4, "c2": 1}, {"r1": 2, "c1": 10, "r2": 4, "c2": 10}, {"r1": 2, "c1": 8, "r2": 4, "c2": 8}, {"r1": 2, "c1": 11, "r2": 4, "c2": 11}, {"r1": 2, "c1": 12, "r2": 4, "c2": 12}, {"r1": 3, "c1": 2, "r2": 4, "c2": 2}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐"}, "第六餐加餐名單": {"max_row": 10, "max_col": 8, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 8}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}};

const SHEETS = ['單獨泡製','奶粉2.5匙','奶粉匙數','加餐-牛奶名單','第六餐加餐名單'];

let currentSheet = '單獨泡製';
let state = structuredClone(initialSheets);

let saveTimer = null;

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function setSaveStatus(text) {
  const el = $('#saveStatus');
  if (el) el.textContent = text;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function getMergeMaps(sheetName) {
  const meta = sheetMeta[sheetName];
  const merges = (meta?.merges) || [];
  const skip = new Set();
  const topLeft = new Map(); // "r,c" -> {rowspan,colspan}
  for (const m of merges) {
    const r1=m.r1, c1=m.c1, r2=m.r2, c2=m.c2;
    topLeft.set(`${r1},${c1}`, { rowspan: (r2-r1+1), colspan: (c2-c1+1) });
    for (let r=r1; r<=r2; r++) {
      for (let c=c1; c<=c2; c++) {
        if (r===r1 && c===c1) continue;
        skip.add(`${r},${c}`);
      }
    }
  }
  return { skip, topLeft };
}

function isProbablyReadonly(sheetName, r, c, value) {
  // 基本保護：標題列（第 1 列）與「奶粉匙數」整張表（多為參考表）預設唯讀
  if (r === 1) return true;
  if (sheetName === '奶粉匙數') return true;
  // 常見的左側標籤欄：第一欄有文字、且右邊多為輸入區 → 先保護第一欄
  if (c === 1 && String(value||'').trim() !== '') return true;
  return false;
}

function renderTabs() {
  $all('#tubeTabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sheet === currentSheet);
  });
}

function renderTable() {
  const wrap = $('#tableWrap');
  const grid = state[currentSheet] || [[]];
  const mr = sheetMeta[currentSheet]?.max_row || grid.length;
  const mc = sheetMeta[currentSheet]?.max_col || (grid[0]?.length || 0);

  const { skip, topLeft } = getMergeMaps(currentSheet);

  const html = [];
  html.push('<table class="grid">');

  // 做一行欄標（A,B,C...）
  html.push('<thead><tr>');
  html.push('<th style="min-width:70px">列\欄</th>');
  for (let c=1; c<=mc; c++) {
    html.push(`<th style="min-width:110px">${String.fromCharCode(64+c)}</th>`);
  }
  html.push('</tr></thead>');

  html.push('<tbody>');
  for (let r=1; r<=mr; r++) {
    html.push('<tr>');
    html.push(`<th class="center" style="background:#f2f2f2">${r}</th>`);
    for (let c=1; c<=mc; c++) {
      if (skip.has(`${r},${c}`)) continue;

      const span = topLeft.get(`${r},${c}`);
      const v = (grid[r-1] && grid[r-1][c-1] != null) ? grid[r-1][c-1] : '';

      const readonly = isProbablyReadonly(currentSheet, r, c, v);
      const cls = [readonly ? 'readonly' : '', ''].filter(Boolean).join(' ');
      const attrs = [];
      if (span) {
        attrs.push(`rowspan="${span.rowspan}"`);
        attrs.push(`colspan="${span.colspan}"`);
      }
      attrs.push(`data-r="${r}" data-c="${c}"`);
      html.push(`<td class="${cls}" ${attrs.join(' ')}>${renderCellInput(currentSheet, r, c, v, readonly)}</td>`);
    }
    html.push('</tr>');
  }
  html.push('</tbody></table>');

  wrap.innerHTML = html.join('');
}

function renderCellInput(sheetName, r, c, v, readonly) {
  const safe = escapeHtml(String(v ?? ''));
  if (readonly) return safe.replace(/\n/g, '<br>');

  // 長字用 textarea（內容含換行或字數較多）
  const s = String(v ?? '');
  if (s.includes('\n') || s.length > 16) {
    return `<textarea class="cell" data-r="${r}" data-c="${c}">${safe}</textarea>`;
  }
  return `<input class="cell" data-r="${r}" data-c="${c}" value="${safe}">`;
}

function bindEvents() {
  const wrap = $('#tableWrap');
  wrap.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.classList.contains('cell')) return;
    const r = Number(t.dataset.r);
    const c = Number(t.dataset.c);
    if (!r || !c) return;

    if (!state[currentSheet]) state[currentSheet] = [];
    if (!state[currentSheet][r-1]) state[currentSheet][r-1] = [];
    state[currentSheet][r-1][c-1] = t.value;

    scheduleSave('修改');
  }, { passive: true });
}

function scheduleSave(reason='儲存') {
  if (!window.db) {
    setSaveStatus('（尚未連上 Firebase，不會儲存）');
    return;
  }
  setSaveStatus(`已變更：${reason}（準備儲存…）`);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToFirestore(), 700);
}

async function loadFromFirestore() {
  if (!window.db) return false;
  try {
    setSaveStatus('讀取 Firebase…');
    const ref = window.db.collection(FS_COLLECTION).doc(FS_DOC);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.sheets) {
        state = structuredClone(data.sheets);
        // 補齊缺的 sheet
        for (const s of SHEETS) {
          if (!Array.isArray(state[s])) state[s] = structuredClone(initialSheets[s] || [[]]);
        }
        setSaveStatus('已載入 Firebase 資料');
        return true;
      }
    }
    setSaveStatus('Firebase 無資料（使用模板預設）');
    return false;
  } catch (err) {
    console.error('loadFromFirestore error', err);
    setSaveStatus('讀取 Firebase 失敗（使用模板預設）');
    return false;
  }
}

async function saveToFirestore() {
  if (!window.db) return;
  try {
    setSaveStatus('儲存中…');
    const ref = window.db.collection(FS_COLLECTION).doc(FS_DOC);
    await ref.set({
      sheets: state,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setSaveStatus(`已儲存（${new Date().toLocaleTimeString()}）`);
  } catch (err) {
    console.error('saveToFirestore error', err);
    setSaveStatus('儲存失敗（請檢查 Firestore 權限/網路）');
  }
}

async function exportExcel() {
  const wb = new ExcelJS.Workbook();
  const res = await fetch(TEMPLATE_XLSX, { cache: 'no-store' });
  if (!res.ok) {
    alert('找不到 tube-template.xlsx，請確認已放到同一個資料夾（與 nutritionist-tube.html 同層）');
    return;
  }
  const buf = await res.arrayBuffer();
  await wb.xlsx.load(buf);

  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const grid = state[sheetName] || [];
    const mr = sheetMeta[sheetName]?.max_row || grid.length;
    const mc = sheetMeta[sheetName]?.max_col || (grid[0]?.length || 0);

    for (let r=1; r<=mr; r++) {
      for (let c=1; c<=mc; c++) {
        const v = (grid[r-1] && grid[r-1][c-1] != null) ? grid[r-1][c-1] : '';
        // 保留模板格式，只改值
        ws.getCell(r,c).value = (v === '' ? null : v);
      }
    }
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `管灌_營養師.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

function printCurrent() {
  window.print();
}

document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  renderTable();
  bindEvents();

  // tabs
  $('#tubeTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sheet]');
    if (!btn) return;
    currentSheet = btn.dataset.sheet;
    renderTabs();
    renderTable();
  });

  $('#btnExport').addEventListener('click', exportExcel);
  $('#btnPrint').addEventListener('click', printCurrent);

  // Firebase ready
  document.addEventListener('firebase-ready', async () => {
    if (!window.db) {
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
      return;
    }
    setSaveStatus('Firebase 已就緒');
    await loadFromFirestore();
    renderTable();
  });
});
