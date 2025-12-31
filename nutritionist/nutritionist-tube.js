const TEMPLATE_XLSX = 'tube-template.xlsx';
const FS_COLLECTION = 'nutrition_tube';
const FS_DOC = 'tube';


// 用於匯出檔名日期（YYYY-MM-DD）。若頁面沒有日期選擇器，就用今天。
function getDateKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}



function getDb(){
  try {
    // firebase-init.js 用 `let db`，在瀏覽器屬於全域 binding，但不一定掛在 window 上
    if (typeof db !== 'undefined' && db) return db;
  } catch (e) {}
  return null;
}
const initialSheets = {"單獨泡製": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], [1, "103-1", "賴坤財\nLai Kuntsai", 250, 2.5, "X", "水腫限水", 1635, 67, ""], [2, "101-2", "洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [3, "105-1", "戴喜垣\nTai Hsiyuan", "", "", 200, "", 1506, 53, "自備奶(管灌安素*6餐)"], [4, "105-2", "洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [5, "106-2", "阮麗華  Ruan Lihua", 150, 2.5, "X", "水腫限水", 1635, 67, ""], [6, "206-1", "吳邱芳梅 Wu Qiufangmei", 200, 2, 200, "", 1308, 53.4, "太胖，減重"], [7, "211-1", "李秀花  \nLi Xiuhua", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [8, "212-2", "葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [9, "217-3", "紀余日仔\nRi zi", 200, 2, 200, "", 1046, 43, "只要2匙*4餐(醫囑)"], [10, "218-2", "王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [11, "220-3", "王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [12, "221-2", "陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "221-3", "楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "總計\ntotal", "", "=SUM(D5:D14)", "=SUM(E5:E14)", "=SUM(F5:F14)", "", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", "", ""]], "奶粉2.5匙": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)"], [1, "101-1", "楊仲富    Zhongfu ", 250, 2.5, 200, "", 1635, 67], [2, "107-2", "蔡調榮\nCai Diaorong", 250, 2.5, 200, "", 1635, 67], [3, "108-1", "呂曾芳妹\nLyu-Zeng Fangmei\n", 250, 2.5, 200, "", 1635, 67], [4, "108-2", "林麗真\nLin Lizhen", 250, 2.5, 200, "", 1635, 67], [5, "112-1", "洪周金好\nJin Hao", 250, 2.5, 200, "", 1635, 67], [6, "202-1", "余劉春花  YU LIU CHUN HUA", 250, 2.5, 200, "", 1635, 67], [7, "202-2", "賴淑芬\nLai Shufen", 250, 2.5, "", "由口喝牛奶", 1635, 67], [8, "203-1", "王蘇罔腰\n Su's waist", 250, 2.5, 200, "", 1635, 67], [9, "203-2", "許陳金鉛  Xu Chenjin lead", 250, 2.5, 200, "", 1635, 67], [10, "205-2", "潘麗珍\nPan Lijhen", 250, 2.5, 200, "", 1635, 67], [11, "207-2", "戴榮興\nDai Rongsing", 250, 2.5, 200, "", 1635, 67], [12, "209-2", "李閠源\nLI YUAN", 250, 2.5, 200, "", 1635, 67], [13, "215-1", "鄞進發    \nYin Jinfa ", 250, 2.5, 200, "", 1635, 67], [14, "216-1", "王萬福\nWang Wanfu", 250, 2.5, 200, "", 1635, 67], [15, "216-2", "陳佳駿\nChen Chiachun", 250, 2.5, 200, "", 1635, 67], [16, "217-1", "郭蜜琴\nMiqin", 250, 2.5, "", "由口喝全奶", 1635, 67], [17, "217-5", "王慧雅\nWang Hueiya", 250, 2.5, 200, "", 1635, 67], [18, "218-1", "蔡郭米  Guomi", 250, 2.5, 200, "", 1635, 67], [19, "218-5", "鄭張貴英\nGuiying", 250, 2.5, 200, "", 1635, 67], [20, "219-1", "許謝運珍YUN-CHEN", 250, 2.5, 200, "", 1635, 67], [21, "219-3", "王秀珠 \nWang Xiuzhu", 250, 2.5, 200, "", 1635, 67], [22, "220-1", "曾光亮\nTseng Kuangliang", 250, 2.5, 200, "", 1635, 67], [23, "308-2", "曾清火  Qinghuo", 250, 2.5, "", "由口喝牛奶", 1635, 67], [23, "總計\ntotal", "", "=SUM(D3:D25)", "=SUM(E3:E25)", "=SUM(F3:F25)", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", ""]], "奶粉匙數": [["奶粉/匙/30克", "喝牛奶人數", "去住院人數", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, "='奶粉2.5匙'!A26", "", "=B2*A2", "=D2*H2", "=D2*H2*5", "=D2*5*30*H2", 30, 3021, 3, 35], [3, 3, "", "=B3*A3", "=D3*H2", "=D3*H2*5", "=D3*5*30*H2", "", "", "", 105], [3.5, 5, "", "=B4*A4", "=D4*H2", "=D4*H2*5", "=D4*5*30*H2", "", "", "", ""], ["合計", "=SUM(B2:B4)", "", "=SUM(D2:D4)", "=SUM(E2:E4)", "=SUM(F2:F4)", "=SUM(G2:G4)", "", "", "", ""], [2.5, "", 6, "=C6*A6", "=D6*H2", "=E6*5", "=F6*30", "", "", "", ""], ["", "", "", "換算包數", "=(E5-E6)/3021", "=(F5-F6)/3021", "=(G5-G6)/3021", "", "", "", ""], ["", "", "", "", "", "", "", "", "", "", ""], ["奶粉/匙/57克", "喝牛奶人數", "", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, 36, "", "=B10*A10", "=D10*H10", "=D10*H10*5", "=D10*5*30*H10", 30, 3021, 3, 35], ["", "", "", "換算包數", "=E10/3021", "=F10/3021", "=G10/3021", "", "", "", ""]], "加餐-牛奶名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐", "", "", "", "", "", "", "", "", "", "", ""], ["", "飲食型態 Diet pattern", "供應\n餐別", "主食Meal\n(碗 bowl)", "", "", "蔬菜類\nvegetables\n(碗 bowl)", "豆魚蛋肉類\nChicken, Meat, egg, fish\nsoybean", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)", "額\n外\n補\n充", "特\n殊\n指\n示"], ["姓名\nName", "食物型態", "", "", "", "", "", "", "", "", "", ""], ["", "", "", "飯\nRice", "粥\nCongee", "麵\nnoodle", "", "", "", "", "", ""], ["古金山\nGU JIN SHAN", "一般\nnormal", "洗腎餐\ndialysis", 1, 2, 2, 1, 3, 1800, 90, "護力養罐裝\n(22點)", ""], ["黃亮達\nLiangda", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["杜典崑\nDudian kun", "剁碎+乾飯\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["林烈雲\nLieyun", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["潘郁豐 \nPan Yufeng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["林安允\nAnyun", "剁碎\nChopped", "糖尿病\ndiabetes", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["劉藍麗珠 Li Jue", "一般+稀飯\nnormal+\ncongee", "高蛋白\nHigt  protein", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["許榮成  Rongceng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["邱桂英\nGuiying", "攪打\nGrind", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""]], "第六餐加餐名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", ""], ["姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], ["洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["李秀花  \nLi Xiuhua", 250, 3, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"]]};
const sheetMeta = {"單獨泡製": {"max_row": 20, "max_col": 10, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 10}, {"r1": 19, "c1": 2, "r2": 19, "c2": 10}, {"r1": 20, "c1": 2, "r2": 20, "c2": 10}, {"r1": 17, "c1": 1, "r2": 20, "c2": 1}, {"r1": 17, "c1": 2, "r2": 17, "c2": 10}, {"r1": 18, "c1": 2, "r2": 18, "c2": 10}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉2.5匙": {"max_row": 30, "max_col": 9, "merges": [{"r1": 27, "c1": 1, "r2": 30, "c2": 1}, {"r1": 30, "c1": 2, "r2": 30, "c2": 9}, {"r1": 29, "c1": 2, "r2": 29, "c2": 9}, {"r1": 1, "c1": 1, "r2": 1, "c2": 9}, {"r1": 28, "c1": 2, "r2": 28, "c2": 9}, {"r1": 27, "c1": 2, "r2": 27, "c2": 9}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉匙數": {"max_row": 11, "max_col": 11, "merges": [], "title": "奶粉/匙/30克"}, "加餐-牛奶名單": {"max_row": 13, "max_col": 12, "merges": [{"r1": 2, "c1": 9, "r2": 4, "c2": 9}, {"r1": 2, "c1": 4, "r2": 3, "c2": 6}, {"r1": 2, "c1": 3, "r2": 4, "c2": 3}, {"r1": 1, "c1": 1, "r2": 1, "c2": 12}, {"r1": 2, "c1": 7, "r2": 4, "c2": 7}, {"r1": 3, "c1": 1, "r2": 4, "c2": 1}, {"r1": 2, "c1": 10, "r2": 4, "c2": 10}, {"r1": 2, "c1": 8, "r2": 4, "c2": 8}, {"r1": 2, "c1": 11, "r2": 4, "c2": 11}, {"r1": 2, "c1": 12, "r2": 4, "c2": 12}, {"r1": 3, "c1": 2, "r2": 4, "c2": 2}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐"}, "第六餐加餐名單": {"max_row": 10, "max_col": 8, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 8}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}};

const SHEETS = ['單獨泡製','奶粉2.5匙','奶粉匙數','加餐-牛奶名單','第六餐加餐名單'];

let currentSheet = '單獨泡製';
let stateGrid = structuredClone(initialSheets);
let saveTimer = null;


/**
 * Firestore 不支援「巢狀陣列」（Array 裡面再放 Array）。
 * 我們的 stateGrid 是 2D array（rows x cols），因此儲存前需轉成 Map 結構；
 * 讀取後再還原回 2D array，讓原本 UI 邏輯不必大改。
 */
function encodeSheetsForFirestore(grid){
  const out = {};
  const sheets = grid || {};
  for (const sheetName of Object.keys(sheets)) {
    const rows = Array.isArray(sheets[sheetName]) ? sheets[sheetName] : [];
    const rowMap = {};
    for (let r = 0; r < rows.length; r++) {
      const cols = Array.isArray(rows[r]) ? rows[r] : [];
      const colMap = {};
      for (let c = 0; c < cols.length; c++) {
        const v = cols[c];
        if (v !== undefined) colMap[String(c)] = v;
      }
      // 只在該列有內容時才存（可略省空資料）
      rowMap[String(r)] = colMap;
    }
    out[sheetName] = rowMap;
  }
  return out;
}

function decodeSheetsFromFirestore(sheetsData){
  // 舊版若已經是 2D array，直接回傳
  const out = {};
  const data = sheetsData || {};
  for (const sheetName of Object.keys(data)) {
    const sheetVal = data[sheetName];
    if (Array.isArray(sheetVal)) {
      out[sheetName] = structuredClone(sheetVal);
      continue;
    }
    // Map 形式：{ "0": {"0": "A", "1": "B"}, "1": {...} }
    if (sheetVal && typeof sheetVal === "object") {
      const rowKeys = Object.keys(sheetVal).sort((a,b)=>Number(a)-Number(b));
      const rows = [];
      for (const rk of rowKeys) {
        const rowObj = sheetVal[rk] || {};
        const colKeys = Object.keys(rowObj).sort((a,b)=>Number(a)-Number(b));
        const cols = [];
        for (const ck of colKeys) cols[Number(ck)] = rowObj[ck];
        rows[Number(rk)] = cols;
      }
      out[sheetName] = rows;
      continue;
    }
    out[sheetName] = structuredClone(initialSheets[sheetName] || [[]]);
  }
  return out;
}


function $(sel){ return document.querySelector(sel); }



// 顯示「讀取中…」狀態（參考員工系統的做法）
function showLoading(msg = '讀取中…') {
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="p-4 text-center text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
      <span>${msg}</span>
    </div>
  `;
}
function setFbStatus(ok, text) {
  // UI: <span id="fbStatus">Firebase：未連線</span>
  // 舊版可能有 #fbDot/#fbText；新版只用 #fbStatus
  const el = document.getElementById('fbStatus');
  if (el) {
    el.textContent = ok ? 'Firebase：已連線' : 'Firebase：未連線';
  }

  // Backward-compat (if present)
  const dot = document.getElementById('fbDot');
  const t = document.getElementById('fbText');
  if (dot) {
    dot.classList.toggle('ok', !!ok);
    dot.classList.toggle('bad', ok === false);
  }
  if (t) t.textContent = text || '';
}
function setSaveStatus(text) {
  const el = $('#saveStatus');
  if (el) el.textContent = text;
}
function escapeHtml(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

// ===== 管灌奶粉營養計算（依 0.5 匙基準，預設 5 餐） =====
// 0.5 匙：蛋白質 2.67g、脂肪 2.22g、醣類 8.805g、熱量 65.4kcal
const TUBE_NUTR_PER_HALF_SPOON = {
  protein: 2.67,
  fat: 2.22,
  carb: 8.805,
  kcal: 65.4,
};
const TUBE_DEFAULT_MEALS_PER_DAY = 5;

function toNumber(v){
  if (v == null) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  // 支援像「2.5」、「2,5」
  const s2 = s.replace(/,/g,'');
  const n = Number(s2);
  return Number.isFinite(n) ? n : NaN;
}

function formatSmartNumber(n, decimals=1){
  if (!Number.isFinite(n)) return '';
  const s = n.toFixed(decimals);
  return s.replace(/\.0+$/,'').replace(/(\.\d*[1-9])0+$/,'$1');
}

// 從兩個「備註」欄抓餐數：例如「*6餐」「4餐(醫囑)」
function guessMealsFromNotes(noteText){
  const s = String(noteText || '');
  const m = s.match(/(\d+)\s*餐/);
  if (m) {
    const k = parseInt(m[1], 10);
    if (Number.isFinite(k) && k >= 1 && k <= 10) return k;
  }
  return TUBE_DEFAULT_MEALS_PER_DAY;
}

function calcTubeNutritionBySpoons(spoons, meals){
  const units = spoons / 0.5; // 每 0.5 匙為 1 單位
  const perMealKcal = units * TUBE_NUTR_PER_HALF_SPOON.kcal;
  const perMealProtein = units * TUBE_NUTR_PER_HALF_SPOON.protein;
  const dayKcal = perMealKcal * meals;
  const dayProtein = perMealProtein * meals;
  return { dayKcal, dayProtein };
}

// 記錄目前頁籤的計算欄位（依表頭名稱自動找，不依賴固定欄位序）
let calcColsCache = {}; // { [sheetName]: { milkCol, kcalCol, proteinCol, noteCols: number[] } }

function normalizeHeaderName(s){
  return String(s || '').replace(/\s+/g,'').toLowerCase();
}

function buildCalcColsForSheet(sheet, tableModel){
  const cols = tableModel?.cols || [];
  const findBy = (pred) => {
    for (const col of cols){
      const n = normalizeHeaderName(col.name);
      if (pred(n)) return col.c;
    }
    return null;
  };

  const milkCol = findBy(n => n.includes('奶粉') || n.includes('milkp') || n.includes('milkpowder'));
  const kcalCol = findBy(n => n.includes('總熱量') || (n.includes('熱量') && n.includes('大卡')) || n.includes('kcal'));
  const proteinCol = findBy(n => n.includes('蛋白質') || n.includes('protein'));
  const noteCols = cols.filter(col => normalizeHeaderName(col.name).includes('備註') || normalizeHeaderName(col.name).includes('note')).map(col => col.c);

  calcColsCache[sheet] = { milkCol, kcalCol, proteinCol, noteCols };
}

function maybeRecalcRow(sheet, excelRow){
  const meta = calcColsCache[sheet] || {};
  if (!meta.milkCol || !meta.kcalCol || !meta.proteinCol) return;

  const spoons = toNumber(gridGet(sheet, excelRow, meta.milkCol));
  if (!Number.isFinite(spoons) || spoons <= 0) return;

  // 兩個備註欄合併判斷餐數（沒有就用 5）
  const noteText = (meta.noteCols || []).map(c => String(gridGet(sheet, excelRow, c) || '')).join(' ');
  const meals = guessMealsFromNotes(noteText);
  const { dayKcal, dayProtein } = calcTubeNutritionBySpoons(spoons, meals);

  // 你的表格是「每日總熱量 / 每日蛋白質」
  const kcalVal = Math.round(dayKcal);
  const proteinVal = formatSmartNumber(dayProtein, 1);

  gridSet(sheet, excelRow, meta.kcalCol, kcalVal);
  gridSet(sheet, excelRow, meta.proteinCol, proteinVal);

  // 直接更新畫面（不重 render）
  const wrap = document.getElementById('tableWrap');
  if (wrap){
    const kcalEl = wrap.querySelector(`.cell[data-erow="${excelRow}"][data-ecol="${meta.kcalCol}"]`);
    const proEl = wrap.querySelector(`.cell[data-erow="${excelRow}"][data-ecol="${meta.proteinCol}"]`);
    if (kcalEl) kcalEl.value = String(kcalVal);
    if (proEl) proEl.value = String(proteinVal);
  }
}

function gridGet(sheet, r, c) {
  const g = stateGrid[sheet] || [];
  return (g[r-1] && g[r-1][c-1] != null) ? g[r-1][c-1] : '';
}
function gridSet(sheet, r, c, v) {
  if (!stateGrid[sheet]) stateGrid[sheet] = [];
  if (!stateGrid[sheet][r-1]) stateGrid[sheet][r-1] = [];
  stateGrid[sheet][r-1][c-1] = v;
}

function guessTable(sheet) {
  const meta = sheetMeta[sheet] || {};
  const gridRows = stateGrid[sheet]?.length || 0;
  const gridCols = stateGrid[sheet]?.[0]?.length || 0;
  const mr = Math.max(meta.max_row || 0, gridRows);
  const mc = Math.max(meta.max_col || 0, gridCols);

  let headerRow = 1, best = 0;
  for (let r=1; r<=Math.min(10, mr); r++) {
    let count = 0;
    for (let c=1; c<=mc; c++) {
      const v = gridGet(sheet, r, c);
      if (typeof v === 'string' && v.trim() !== '') count++;
    }
    if (count > best && count >= 3) { best = count; headerRow = r; }
  }

  const startRow = headerRow + 1;

  const cols = [];
  for (let c=1; c<=mc; c++) {
    const name = String(gridGet(sheet, headerRow, c) || '').trim();
    if (name) cols.push({ c, name });
  }
  if (cols.length === 0) {
    const fallback = Math.min(mc || 10, 12);
    for (let c=1; c<=fallback; c++) cols.push({ c, name: String.fromCharCode(64+c) });
  }

  const rows = [];
  const rowMap = [];
  for (let r=startRow; r<=mr; r++) {
    const first = String(gridGet(sheet, r, cols[0].c) || '').trim();
    const second = cols[1] ? String(gridGet(sheet, r, cols[1].c) || '').trim() : '';
    if (!first && !second) {
      const nextFirst = String(gridGet(sheet, r+1, cols[0].c) || '').trim();
      const nextSecond = cols[1] ? String(gridGet(sheet, r+1, cols[1].c) || '').trim() : '';
      if (!nextFirst && !nextSecond) break;
    }
    const obj = {};
    for (const col of cols) obj[col.c] = gridGet(sheet, r, col.c);
    rows.push(obj);
    rowMap.push(r);
  }
  return { cols, rows, rowMap };
}

function renderSheetSelect() {
  // 兩種 UI 都支援：
  // A) 下拉選單 #sheetSelect（舊版）
  // B) Bootstrap Tabs #tubeTabs button[data-sheet]（新版）
  const sel = $('#sheetSelect');
  if (sel) {
    sel.innerHTML = SHEETS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    sel.value = currentSheet;
  }

  // 同步 tabs 的 active 狀態
  document.querySelectorAll('#tubeTabs .nav-link[data-sheet]').forEach(btn => {
    const isActive = btn.getAttribute('data-sheet') === currentSheet;
    btn.classList.toggle('active', isActive);
  });
}

function buildFilter(tableModel) {
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  if (!q) return null;
  return (rowObj) => tableModel.cols.some(col => String(rowObj[col.c] ?? '').toLowerCase().includes(q));
}

function isReadonlySheet(sheet) { return sheet === '奶粉匙數'; }

function isNoteRow(rowObj, tableModel) {
  // 移除模板中「＊灌食時間/作法/備註」等說明列，避免畫面後段一大塊空白格
  const firstCol = tableModel?.cols?.[0]?.c;
  if (!firstCol) return false;
  const v = String(rowObj[firstCol] ?? '').trim();
  if (!v) return false;
  // 常見註解列開頭符號
  if (/^[＊*※]/.test(v)) return true;
  // 其他常見說明列關鍵字（保守）
  if (/(灌食時間|灌食配方|泡法|注意事項|冬天不加鹽|summer|feeding)/i.test(v)) return true;
  return false;
}


let selectedRowKeys = new Set(); // key = `${sheet}|${excelRow}`

function makeRowKey(sheet, excelRow){ return `${sheet}|${excelRow}`; }

function getSelectedExcelRows(sheet){
  const rows = [];
  for (const k of selectedRowKeys){
    const [s, r] = k.split('|');
    if (s === sheet) rows.push(Number(r));
  }
  return rows.sort((a,b)=>a-b);
}

function clearSelectionForSheet(sheet){
  for (const k of Array.from(selectedRowKeys)){
    if (k.startsWith(sheet+'|')) selectedRowKeys.delete(k);
  }
}

function findColByNames(tableModel, names){
  const lowers = names.map(n=>n.toLowerCase());
  for (const col of tableModel.cols){
    const n = String(col.name||'').toLowerCase();
    if (lowers.includes(n)) return col;
  }
  // contains match
  for (const col of tableModel.cols){
    const n = String(col.name||'').toLowerCase();
    if (lowers.some(x=>n.includes(x))) return col;
  }
  return null;
}

function getColClassByName(colName){
  const n = String(colName || '').toLowerCase();
  // Water between meals column is too wide; constrain it and allow wrap
  if (n.includes('餐間水') || n.includes('water supply') || n.includes('between meals')) return 'col-between-water';
  // Notes columns should have more space
  if (n === '備註' || n.includes('備註') || n.includes('note')) return 'col-note';
  // Compact numeric columns
  if (n.includes('總熱量') || (n.includes('熱量') && !n.includes('總計'))) return 'col-kcal';
  if (n.includes('蛋白質')) return 'col-protein';
  if (n.includes('脂肪')) return 'col-fat';
  if (n.includes('醣') || n.includes('carb')) return 'col-carb';
  return '';
}


function firstEmptyDataRow(sheet){
  // Find next row after last non-empty among meta.max_row, but keep within meta.max_row+200 safety
  const meta = sheetMeta[sheet] || {};
  const gridRows = stateGrid[sheet]?.length || 0;
  const gridCols = stateGrid[sheet]?.[0]?.length || 0;
  const mr = Math.max(meta.max_row || 0, gridRows);
  const mc = Math.max(meta.max_col || 0, gridCols);
  // search from bottom up for last non-empty in first few cols
  let last = 0;
  for (let r=1; r<=mr; r++){
    let has = false;
    for (let c=1; c<=Math.min(mc, 6); c++){
      const v = String(gridGet(sheet, r, c) || '').trim();
      if (v){ has=true; break; }
    }
    if (has) last = r;
  }
  return last + 1;
}

function ensureGridSize(sheet, rows, cols){
  if (!stateGrid[sheet]) stateGrid[sheet] = [];
  while (stateGrid[sheet].length < rows) stateGrid[sheet].push([]);
  for (let r=0; r<rows; r++){
    while (stateGrid[sheet][r].length < cols) stateGrid[sheet][r].push('');
  }
}

function deleteExcelRows(sheet, excelRows){
  if (excelRows.length === 0) return;
  const meta = sheetMeta[sheet] || {};
  const mc = meta.max_col || (stateGrid[sheet]?.[0]?.length || 0) || 20;
  // Delete by shifting up: for each row in ascending order, remove that row and shift others up
  // Safer: set selected rows to blank (keep template layout) instead of removing physical rows.
  for (const r of excelRows){
    ensureGridSize(sheet, r, mc);
    for (let c=1; c<=mc; c++){
      gridSet(sheet, r, c, '');
    }
  }
}


function renderTable() {
  const tableModel = guessTable(currentSheet);
  // 建立該分頁的「奶粉/熱量/蛋白質/備註」欄位索引，供自動計算使用
  buildCalcColsForSheet(currentSheet, tableModel);
  const filterFn = buildFilter(tableModel);
  let rows = filterFn ? tableModel.rows.filter(filterFn) : tableModel.rows;
  // 隱藏模板內的說明/註解列（使用者表示不需要）
  rows = rows.filter(r => !isNoteRow(r, tableModel));
  const readonlySheet = isReadonlySheet(currentSheet);

  const html = [];
  html.push('<table class="sys"><thead><tr>');
  // selection column
  html.push('<th style="width:44px" title="勾選要刪除/調動的住民"><i class="fas fa-check"></i></th>');
  for (const col of tableModel.cols) {
    const cls = getColClassByName(col.name);
    html.push(`<th class="${cls}">${escapeHtml(col.name)}</th>`);
  }
  html.push('</tr></thead><tbody>');

  rows.forEach((rowObj) => {
    const excelRow = tableModel.rowMap[tableModel.rows.indexOf(rowObj)];
    const rowKey = makeRowKey(currentSheet, excelRow);
    const checked = selectedRowKeys.has(rowKey) ? 'checked' : '';
    html.push('<tr>');
    html.push(`<td class="text-center"><input class="form-check-input rowcheck" type="checkbox" data-erow="${excelRow}" ${checked}></td>`);
    for (const col of tableModel.cols) {
      const v = rowObj[col.c] ?? '';
      const cls = getColClassByName(col.name);
      if (readonlySheet) {
        html.push(`<td class="readonly ${cls}">${escapeHtml(String(v)).replace(/\n/g,'<br>')}</td>`);
      } else {
        const s = String(v ?? '');
        if (s.includes('\\n') || s.length > 18) {
          html.push(`<td class="${cls}"><textarea class="cell" data-erow="${excelRow}" data-ecol="${col.c}">${escapeHtml(s)}</textarea></td>`);
        } else {
          html.push(`<td class="${cls}"><input class="cell" data-erow="${excelRow}" data-ecol="${col.c}" value="${escapeHtml(s)}"></td>`);
        }
      }
    }
    html.push('</tr>');
  });
  html.push('</tbody></table>');

  const wrap = $('#tableWrap');
  wrap.innerHTML = html.join('');

  // checkbox selection
  wrap.querySelectorAll('.rowcheck').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const r = Number(e.target.dataset.erow);
      if (!r) return;
      const key = makeRowKey(currentSheet, r);
      if (e.target.checked) selectedRowKeys.add(key);
      else selectedRowKeys.delete(key);
    });
  });

  // cell editing
  wrap.oninput = (e) => {
    const t = e.target;
    if (!t.classList.contains('cell')) return;
    const erow = Number(t.dataset.erow);
    const ecol = Number(t.dataset.ecol);
    if (!erow || !ecol) return;
    gridSet(currentSheet, erow, ecol, t.value);

    // 若更動奶粉匙數（或備註餐數），即時重算「總熱量/蛋白質」
    const meta = calcColsCache[currentSheet] || {};
    const noteCols = meta.noteCols || [];
    if (ecol === meta.milkCol || noteCols.includes(ecol)) {
      maybeRecalcRow(currentSheet, erow);
    }

    scheduleSave('修改');
  };
}


function scheduleSave(reason='儲存') {
  if (!getDb()) {
    setSaveStatus('Firebase 尚未初始化（不會儲存）');
    setFbStatus(false, '未連線');
    return;
  }
  setSaveStatus(`已變更：${reason}（準備儲存…）`);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFirestore, 700);
}

async function loadFromFirestore() {
  showLoading('讀取中…');
  if (!getDb()) return false;
  try {
    setSaveStatus('讀取 Firebase…');
    const ref = getDb().collection(FS_COLLECTION).doc(FS_DOC);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.sheets) {
        stateGrid = decodeSheetsFromFirestore(data.sheets);
        for (const s of SHEETS) if (!Array.isArray(stateGrid[s])) stateGrid[s] = structuredClone(initialSheets[s] || [[]]);
        setSaveStatus('已載入 Firebase 資料');
        return true;
      }
    }
    setSaveStatus('Firebase 無資料（使用模板預設）');
    return false;
  } catch (err) {
    console.error(err);
    setSaveStatus('讀取 Firebase 失敗（使用模板預設）');
    return false;
  }
}

async function saveToFirestore() {
  try {
    setSaveStatus('儲存中…');
    const ref = getDb().collection(FS_COLLECTION).doc(FS_DOC);
    await ref.set({
      sheets: encodeSheetsForFirestore(stateGrid),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setSaveStatus(`已儲存（${new Date().toLocaleTimeString()}）`);
  } catch (err) {
    console.error(err);
    setSaveStatus('儲存失敗（請檢查 Firestore 權限/網路）');
  }
}

async function exportExcel() {
  if (typeof ExcelJS === "undefined") {
    alert("ExcelJS 尚未載入，無法匯出 .xlsx（請確認已在 HTML 加入 exceljs + file-saver）。");
    return;
  }

  const dateIso = (typeof getDateKey === 'function') ? getDateKey() : '';
  const wb = new ExcelJS.Workbook();
  wb.creator = "Antai System";
  wb.created = new Date();

  const marginCm = { top: 1.91, bottom: 1.91, left: 0.64, right: 0.64, header: 0.76, footer: 0.76 };
  const cmToIn = (cm) => cm / 2.54;

  const dataBySheet = (stateGrid || {});
  const sheetList = (SHEETS || Object.keys(dataBySheet));

  // 自動欄寬：看每欄最長字串（寬鬆一些）
  const calcColWidths = (grid, maxCols) => {
    const cols = Math.max(maxCols || 1, 1);
    const w = Array(cols).fill(12);
    for (let c = 0; c < cols; c++) {
      let maxLen = 0;
      for (const row of grid) {
        const v = row?.[c];
        const s = (v == null) ? "" : String(v);
        const s2 = s.startsWith("=") ? s.slice(1) : s; // 公式不計 '='
        maxLen = Math.max(maxLen, s2.length);
      }
      // 中文會比較寬，稍微放大
      w[c] = Math.max(10, Math.min(55, Math.round(maxLen * 1.25)));
    }
    return w;
  };

  for (const sheetName of sheetList) {
    const meta = sheetMeta?.[sheetName] || {};
    const maxCols = meta.max_col || 20;

    const grid = (dataBySheet[sheetName] || []).map(r => Array.isArray(r) ? r : []);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 3 }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: cmToIn(marginCm.left),
          right: cmToIn(marginCm.right),
          top: cmToIn(marginCm.top),
          bottom: cmToIn(marginCm.bottom),
          header: cmToIn(marginCm.header),
          footer: cmToIn(marginCm.footer),
        }
      }
    });

    // 欄寬
    const colWidths = calcColWidths(grid, maxCols);
    ws.columns = colWidths.map(w => ({ width: w }));

    // 寫入 grid（注意：ExcelJS 的 row.values 不要塞 [null,...]，會整個右移一欄）
    const rowCount = Math.max(grid.length, meta.max_row || 0);
    for (let r = 0; r < rowCount; r++) {
      const excelRow = r + 1;
      const row = ws.getRow(excelRow);
      const arr = grid[r] || [];

      // 行高（第 1 行標題稍高，其它統一 26）
      row.height = (excelRow === 1) ? 32 : 26;

      for (let c = 0; c < maxCols; c++) {
        const excelCol = c + 1;
        const cell = ws.getCell(excelRow, excelCol);
        let v = arr[c];

        // 公式：用 ExcelJS 的 formula 形式，才會真的被 Excel 當公式
        if (typeof v === 'string' && v.startsWith('=')) {
          cell.value = { formula: v.slice(1) };
        } else {
          cell.value = (v === undefined) ? '' : v;
        }

        // 字體/對齊
        const isTitle = (excelRow === 1);
        const isHeader = (excelRow <= 3); // 通常第 2~3 行是欄名/表頭
        cell.font = { name: "標楷體", size: (isTitle ? 16 : (isHeader ? 12 : 11)), bold: isHeader };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

        // 表頭底色（第 3 行常是欄名列）
        if (excelRow === 3) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6F9" } };
        }

        // 框線
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } }
        };
      }
    }

    // 套用合併儲存格（對齊你提供的 sheetMeta.merges）
    const merges = Array.isArray(meta.merges) ? meta.merges : [];
    for (const m of merges) {
      try {
        // r1/c1/r2/c2 皆為 1-based
        ws.mergeCells(m.r1, m.c1, m.r2, m.c2);
      } catch (e) {
        console.warn('mergeCells failed:', sheetName, m, e);
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = `${(dateIso || "管灌")}_管灌總表.xlsx`;
  if (typeof saveAs !== "undefined") saveAs(blob, filename);
  else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderSheetSelect();
  renderTable();

  // ===== 分頁切換：支援 #sheetSelect 或 #tubeTabs =====
  const sheetSelect = $('#sheetSelect');
  if (sheetSelect) {
    sheetSelect.addEventListener('change', (e) => {
      currentSheet = e.target.value;
      const si = $('#searchInput'); if (si) si.value = '';
      renderSheetSelect();
      renderTable();
    });
  }

  // Tabs（新版 UI）
  document.querySelectorAll('#tubeTabs .nav-link[data-sheet]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-sheet');
      if (!s) return;
      currentSheet = s;
      const si = $('#searchInput'); if (si) si.value = '';
      renderSheetSelect();
      renderTable();
    });
  });

  // 搜尋（若頁面有 searchInput 才啟用）
  const searchInput = $('#searchInput');
  if (searchInput) searchInput.addEventListener('input', renderTable);

  // 列印 / 匯出
  $('#btnPrint')?.addEventListener('click', () => window.print());
  $('#btnExport')?.addEventListener('click', exportExcel);


  // 新增 / 刪除（依勾選列）
  const btnAddRow = document.getElementById('btnAddRow');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');

  function addBlankRow() {
    const meta = sheetMeta[currentSheet] || {};
    const mc = meta.max_col || (stateGrid[currentSheet]?.[0]?.length || 0) || 20;
    const r = firstEmptyDataRow(currentSheet);
    ensureGridSize(currentSheet, r, mc);
    // 預設先把整列清空（避免模板殘值）
    for (let c = 1; c <= mc; c++) gridSet(currentSheet, r, c, '');
    renderTable();
    scheduleSave('新增列');

    // 導向並 focus 新列第一個可編輯欄位
    const wrap = document.getElementById('tableWrap');
    const firstCell = wrap?.querySelector(`.cell[data-erow="${r}"][data-ecol="1"]`) ||
                      wrap?.querySelector(`.cell[data-erow="${r}"]`);
    if (firstCell) {
      firstCell.scrollIntoView({ block: 'center' });
      setTimeout(() => firstCell.focus(), 50);
    }
  }

  function deleteSelectedRows() {
    const rows = getSelectedExcelRows(currentSheet);
    if (!rows.length) {
      alert('請先勾選要刪除的列');
      return;
    }
    if (!confirm(`確定要刪除（清空）已勾選的 ${rows.length} 筆資料？`)) return;
    deleteExcelRows(currentSheet, rows);
    clearSelectionForSheet(currentSheet);
    renderTable();
    scheduleSave('刪除勾選');
  }

  btnAddRow?.addEventListener('click', addBlankRow);
  btnDeleteSelected?.addEventListener('click', deleteSelectedRows);


  document.addEventListener('firebase-ready', async () => {
    if (getDb()) {
      setFbStatus(true, '已連線');
      await loadFromFirestore();
      renderTable();
    } else {
      setFbStatus(false, '未連線');
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
    }
  });

  setTimeout(async () => {
    if (getDb()) {
      setFbStatus(true, '已連線');
      await loadFromFirestore();
      renderTable();
    } else {
      setFbStatus(false, '未連線');
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
    }
  }, 2000);
});
