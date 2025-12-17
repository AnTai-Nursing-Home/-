const TEMPLATE_XLSX = 'tube-template.xlsx';
const FS_COLLECTION = 'nutrition_tube';
const FS_DOC = 'tube';



function getDb(){
  try {
    // firebase-init.js 用 `let db`，在瀏覽器屬於全域 binding，但不一定掛在 window 上
    if (typeof db !== 'undefined' && db) return db;
  } catch (e) {}
  return getDb() || null;
}
const initialSheets = {"單獨泡製": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], [1, "103-1", "賴坤財\nLai Kuntsai", 250, 2.5, "X", "水腫限水", 1635, 67, ""], [2, "101-2", "洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [3, "105-1", "戴喜垣\nTai Hsiyuan", "", "", 200, "", 1506, 53, "自備奶(管灌安素*6餐)"], [4, "105-2", "洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [5, "106-2", "阮麗華  Ruan Lihua", 150, 2.5, "X", "水腫限水", 1635, 67, ""], [6, "206-1", "吳邱芳梅 Wu Qiufangmei", 200, 2, 200, "", 1308, 53.4, "太胖，減重"], [7, "211-1", "李秀花  \nLi Xiuhua", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [8, "212-2", "葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [9, "217-3", "紀余日仔\nRi zi", 200, 2, 200, "", 1046, 43, "只要2匙*4餐(醫囑)"], [10, "218-2", "王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [11, "220-3", "王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [12, "221-2", "陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "221-3", "楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], [13, "總計\ntotal", "", "=SUM(D5:D14)", "=SUM(E5:E14)", "=SUM(F5:F14)", "", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", "", ""]], "奶粉2.5匙": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", "", ""], ["", "編號\nNumbreing", "姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)"], [1, "101-1", "楊仲富    Zhongfu ", 250, 2.5, 200, "", 1635, 67], [2, "107-2", "蔡調榮\nCai Diaorong", 250, 2.5, 200, "", 1635, 67], [3, "108-1", "呂曾芳妹\nLyu-Zeng Fangmei\n", 250, 2.5, 200, "", 1635, 67], [4, "108-2", "林麗真\nLin Lizhen", 250, 2.5, 200, "", 1635, 67], [5, "112-1", "洪周金好\nJin Hao", 250, 2.5, 200, "", 1635, 67], [6, "202-1", "余劉春花  YU LIU CHUN HUA", 250, 2.5, 200, "", 1635, 67], [7, "202-2", "賴淑芬\nLai Shufen", 250, 2.5, "", "由口喝牛奶", 1635, 67], [8, "203-1", "王蘇罔腰\n Su's waist", 250, 2.5, 200, "", 1635, 67], [9, "203-2", "許陳金鉛  Xu Chenjin lead", 250, 2.5, 200, "", 1635, 67], [10, "205-2", "潘麗珍\nPan Lijhen", 250, 2.5, 200, "", 1635, 67], [11, "207-2", "戴榮興\nDai Rongsing", 250, 2.5, 200, "", 1635, 67], [12, "209-2", "李閠源\nLI YUAN", 250, 2.5, 200, "", 1635, 67], [13, "215-1", "鄞進發    \nYin Jinfa ", 250, 2.5, 200, "", 1635, 67], [14, "216-1", "王萬福\nWang Wanfu", 250, 2.5, 200, "", 1635, 67], [15, "216-2", "陳佳駿\nChen Chiachun", 250, 2.5, 200, "", 1635, 67], [16, "217-1", "郭蜜琴\nMiqin", 250, 2.5, "", "由口喝全奶", 1635, 67], [17, "217-5", "王慧雅\nWang Hueiya", 250, 2.5, 200, "", 1635, 67], [18, "218-1", "蔡郭米  Guomi", 250, 2.5, 200, "", 1635, 67], [19, "218-5", "鄭張貴英\nGuiying", 250, 2.5, 200, "", 1635, 67], [20, "219-1", "許謝運珍YUN-CHEN", 250, 2.5, 200, "", 1635, 67], [21, "219-3", "王秀珠 \nWang Xiuzhu", 250, 2.5, 200, "", 1635, 67], [22, "220-1", "曾光亮\nTseng Kuangliang", 250, 2.5, 200, "", 1635, 67], [23, "308-2", "曾清火  Qinghuo", 250, 2.5, "", "由口喝牛奶", 1635, 67], [23, "總計\ntotal", "", "=SUM(D3:D25)", "=SUM(E3:E25)", "=SUM(F3:F25)", "", "", ""], ["", "＊灌食時間(feeding time):06:00、10:00、14:30、18:00、22:00", "", "", "", "", "", "", ""], ["", "＊灌食配方:護力養plus經典(1匙30克，130.8卡，蛋白質5.34克)", "", "", "", "", "", "", ""], ["", "＊泡法:1.先加入所需的水量--->  2.再加入需要的奶粉匙數\n(method: 1. First add the required amount of water ---> 2. Then add the required number of spoons of milk powder)", "", "", "", "", "", "", ""], ["", "＊冬天不加鹽，夏天每日1克", "", "", "", "", "", "", ""]], "奶粉匙數": [["奶粉/匙/30克", "喝牛奶人數", "去住院人數", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, "='奶粉2.5匙'!A26", "", "=B2*A2", "=D2*H2", "=D2*H2*5", "=D2*5*30*H2", 30, 3021, 3, 35], [3, 3, "", "=B3*A3", "=D3*H2", "=D3*H2*5", "=D3*5*30*H2", "", "", "", 105], [3.5, 5, "", "=B4*A4", "=D4*H2", "=D4*H2*5", "=D4*5*30*H2", "", "", "", ""], ["合計", "=SUM(B2:B4)", "", "=SUM(D2:D4)", "=SUM(E2:E4)", "=SUM(F2:F4)", "=SUM(G2:G4)", "", "", "", ""], [2.5, "", 6, "=C6*A6", "=D6*H2", "=E6*5", "=F6*30", "", "", "", ""], ["", "", "", "換算包數", "=(E5-E6)/3021", "=(F5-F6)/3021", "=(G5-G6)/3021", "", "", "", ""], ["", "", "", "", "", "", "", "", "", "", ""], ["奶粉/匙/57克", "喝牛奶人數", "", "每餐匙數小計", "一餐量(g)", "一日量(g)", "一月量(g)", "一匙奶粉   30克", "一箱奶粉3021克", "一箱奶粉    3包", "每次叫貨量35箱"], [2.5, 36, "", "=B10*A10", "=D10*H10", "=D10*H10*5", "=D10*5*30*H10", 30, 3021, 3, 35], ["", "", "", "換算包數", "=E10/3021", "=F10/3021", "=G10/3021", "", "", "", ""]], "加餐-牛奶名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐", "", "", "", "", "", "", "", "", "", "", ""], ["", "飲食型態 Diet pattern", "供應\n餐別", "主食Meal\n(碗 bowl)", "", "", "蔬菜類\nvegetables\n(碗 bowl)", "豆魚蛋肉類\nChicken, Meat, egg, fish\nsoybean", "總\n熱\n量\n(大卡)", "蛋\n白\n質\n(克)", "額\n外\n補\n充", "特\n殊\n指\n示"], ["姓名\nName", "食物型態", "", "", "", "", "", "", "", "", "", ""], ["", "", "", "飯\nRice", "粥\nCongee", "麵\nnoodle", "", "", "", "", "", ""], ["古金山\nGU JIN SHAN", "一般\nnormal", "洗腎餐\ndialysis", 1, 2, 2, 1, 3, 1800, 90, "護力養罐裝\n(22點)", ""], ["黃亮達\nLiangda", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["杜典崑\nDudian kun", "剁碎+乾飯\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["林烈雲\nLieyun", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["潘郁豐 \nPan Yufeng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["林安允\nAnyun", "剁碎\nChopped", "糖尿病\ndiabetes", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["劉藍麗珠 Li Jue", "一般+稀飯\nnormal+\ncongee", "高蛋白\nHigt  protein", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""], ["許榮成  Rongceng", "剁碎\nChopped", "一般\nnormal", 1, 2, 2, 1, 2.5, 1700, 80, "22點\n(護力養2.5匙)", ""], ["邱桂英\nGuiying", "攪打\nGrind", "一般\nnormal", 1, 2, 2, 1, 2, 1600, 70, "22點\n(護力養2.5匙)", ""]], "第六餐加餐名單": [["安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10", "", "", "", "", "", "", ""], ["姓名\nname", "加水量\nwater\n(ml)", "奶粉(匙)\nmilk powder\n(spoon)", "餐間水(2次)\nWater supply \n between meals (ml)", "備註", "總熱量\n(大卡)", "蛋白質\n(克)", "備註"], ["洪坤玉\nHUNG \nKUN-YU", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["洪輝童\nHong HuiTong", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王文賢\nWang Wunsian", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["李秀花  \nLi Xiuhua", 250, 3, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["王玉蘭\nYu lan", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["陳寶財\nBao Cai", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["楊受滿\nYang Shouman", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"], ["葉正良\nYeh Chengliang", 250, 2.5, 200, "", 1962, 80, "中心奶2.5匙*6餐"]]};
const sheetMeta = {"單獨泡製": {"max_row": 20, "max_col": 10, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 10}, {"r1": 19, "c1": 2, "r2": 19, "c2": 10}, {"r1": 20, "c1": 2, "r2": 20, "c2": 10}, {"r1": 17, "c1": 1, "r2": 20, "c2": 1}, {"r1": 17, "c1": 2, "r2": 17, "c2": 10}, {"r1": 18, "c1": 2, "r2": 18, "c2": 10}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉2.5匙": {"max_row": 30, "max_col": 9, "merges": [{"r1": 27, "c1": 1, "r2": 30, "c2": 1}, {"r1": 30, "c1": 2, "r2": 30, "c2": 9}, {"r1": 29, "c1": 2, "r2": 29, "c2": 9}, {"r1": 1, "c1": 1, "r2": 1, "c2": 9}, {"r1": 28, "c1": 2, "r2": 28, "c2": 9}, {"r1": 27, "c1": 2, "r2": 27, "c2": 9}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}, "奶粉匙數": {"max_row": 11, "max_col": 11, "merges": [], "title": "奶粉/匙/30克"}, "加餐-牛奶名單": {"max_row": 13, "max_col": 12, "merges": [{"r1": 2, "c1": 9, "r2": 4, "c2": 9}, {"r1": 2, "c1": 4, "r2": 3, "c2": 6}, {"r1": 2, "c1": 3, "r2": 4, "c2": 3}, {"r1": 1, "c1": 1, "r2": 1, "c2": 12}, {"r1": 2, "c1": 7, "r2": 4, "c2": 7}, {"r1": 3, "c1": 1, "r2": 4, "c2": 1}, {"r1": 2, "c1": 10, "r2": 4, "c2": 10}, {"r1": 2, "c1": 8, "r2": 4, "c2": 8}, {"r1": 2, "c1": 11, "r2": 4, "c2": 11}, {"r1": 2, "c1": 12, "r2": 4, "c2": 12}, {"r1": 3, "c1": 2, "r2": 4, "c2": 2}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10-加餐"}, "第六餐加餐名單": {"max_row": 10, "max_col": 8, "merges": [{"r1": 1, "c1": 1, "r2": 1, "c2": 8}], "title": "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10"}};

const SHEETS = ['單獨泡製','奶粉2.5匙','奶粉匙數','加餐-牛奶名單','第六餐加餐名單'];

let currentSheet = '單獨泡製';
let stateGrid = structuredClone(initialSheets);
let saveTimer = null;

function $(sel){ return document.querySelector(sel); }

function setFbStatus(ok, text) {
  const dot = $('#fbDot');
  const t = $('#fbText');
  if (dot) {
    dot.classList.toggle('ok', !!ok);
    dot.classList.toggle('bad', ok===false);
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
  const mr = meta.max_row || (stateGrid[sheet]?.length || 0);
  const mc = meta.max_col || (stateGrid[sheet]?.[0]?.length || 0);

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
  const sel = $('#sheetSelect');
  sel.innerHTML = SHEETS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.value = currentSheet;
}

function buildFilter(tableModel) {
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  if (!q) return null;
  return (rowObj) => tableModel.cols.some(col => String(rowObj[col.c] ?? '').toLowerCase().includes(q));
}

function isReadonlySheet(sheet) { return sheet === '奶粉匙數'; }


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

function firstEmptyDataRow(sheet){
  // Find next row after last non-empty among meta.max_row, but keep within meta.max_row+200 safety
  const meta = sheetMeta[sheet] || {};
  const mr = meta.max_row || (stateGrid[sheet]?.length || 0);
  const mc = meta.max_col || (stateGrid[sheet]?.[0]?.length || 0);
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
  const filterFn = buildFilter(tableModel);
  const rows = filterFn ? tableModel.rows.filter(filterFn) : tableModel.rows;
  const readonlySheet = isReadonlySheet(currentSheet);

  const html = [];
  html.push('<table class="sys"><thead><tr>');
  // selection column
  html.push('<th style="width:44px" title="勾選要刪除/調動的住民"><i class="fas fa-check"></i></th>');
  for (const col of tableModel.cols) html.push(`<th>${escapeHtml(col.name)}</th>`);
  html.push('</tr></thead><tbody>');

  rows.forEach((rowObj) => {
    const excelRow = tableModel.rowMap[tableModel.rows.indexOf(rowObj)];
    const rowKey = makeRowKey(currentSheet, excelRow);
    const checked = selectedRowKeys.has(rowKey) ? 'checked' : '';
    html.push('<tr>');
    html.push(`<td class="text-center"><input class="form-check-input rowcheck" type="checkbox" data-erow="${excelRow}" ${checked}></td>`);
    for (const col of tableModel.cols) {
      const v = rowObj[col.c] ?? '';
      if (readonlySheet) {
        html.push(`<td class="readonly">${escapeHtml(String(v)).replace(/\n/g,'<br>')}</td>`);
      } else {
        const s = String(v ?? '');
        if (s.includes('\\n') || s.length > 18) {
          html.push(`<td><textarea class="cell" data-erow="${excelRow}" data-ecol="${col.c}">${escapeHtml(s)}</textarea></td>`);
        } else {
          html.push(`<td><input class="cell" data-erow="${excelRow}" data-ecol="${col.c}" value="${escapeHtml(s)}"></td>`);
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
    scheduleSave('修改');
  };
}


function scheduleSave(reason='儲存') {
  if (!getDb()) {
    setSaveStatus('Firebase 尚未初始化（不會儲存）');
    setFbStatus(false, '尚未初始化');
    return;
  }
  setSaveStatus(`已變更：${reason}（準備儲存…）`);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFirestore, 700);
}

async function loadFromFirestore() {
  if (!getDb()) return false;
  try {
    setSaveStatus('讀取 Firebase…');
    const ref = getDb().collection(FS_COLLECTION).doc(FS_DOC);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.sheets) {
        stateGrid = structuredClone(data.sheets);
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
      sheets: stateGrid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setSaveStatus(`已儲存（${new Date().toLocaleTimeString()}）`);
  } catch (err) {
    console.error(err);
    setSaveStatus('儲存失敗（請檢查 Firestore 權限/網路）');
  }
}

async function exportExcel() {
  const wb = new ExcelJS.Workbook();
  const res = await fetch(TEMPLATE_XLSX, { cache: 'no-store' });
  if (!res.ok) {
    alert('找不到 tube-template.xlsx（請放在同層）');
    return;
  }
  const buf = await res.arrayBuffer();
  await wb.xlsx.load(buf);

  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const grid = stateGrid[sheetName] || [];
    const mr = sheetMeta[sheetName]?.max_row || grid.length;
    const mc = sheetMeta[sheetName]?.max_col || (grid[0]?.length || 0);

    for (let r=1; r<=mr; r++) {
      for (let c=1; c<=mc; c++) {
        const v = (grid[r-1] && grid[r-1][c-1] != null) ? grid[r-1][c-1] : '';
        ws.getCell(r,c).value = (v === '' ? null : v);
      }
    }
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '管灌_營養師.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSheetSelect();
  renderTable();

  $('#sheetSelect').addEventListener('change', (e) => {
    currentSheet = e.target.value;
    $('#searchInput').value = '';
    renderTable();
  });
  $('#searchInput').addEventListener('input', renderTable);

  $('#btnPrint').addEventListener('click', () => window.print());
  $('#btnExport').addEventListener('click', exportExcel);

  // 新增 / 刪除 / 調動
  const addModalEl = document.getElementById('addResidentModal');
  const moveModalEl = document.getElementById('moveResidentModal');
  const addModal = addModalEl ? new bootstrap.Modal(addModalEl) : null;
  const moveModal = moveModalEl ? new bootstrap.Modal(moveModalEl) : null;

  // 填入分頁選單
  const addSheetSel = document.getElementById('addSheet');
  const moveSheetSel = document.getElementById('moveToSheet');
  if (addSheetSel) addSheetSel.innerHTML = SHEETS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (moveSheetSel) moveSheetSel.innerHTML = SHEETS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  document.getElementById('btnAddRow')?.addEventListener('click', () => {
    if (addSheetSel) addSheetSel.value = currentSheet;
    document.getElementById('addNumber').value = '';
    document.getElementById('addName').value = '';
    document.getElementById('addNote').value = '';
    addModal?.show();
  });

  document.getElementById('btnConfirmAdd')?.addEventListener('click', () => {
    const targetSheet = (addSheetSel?.value || currentSheet);
    const number = (document.getElementById('addNumber').value || '').trim();
    const name = (document.getElementById('addName').value || '').trim();
    const note = (document.getElementById('addNote').value || '').trim();
    if (!number && !name){
      alert('請至少填「編號」或「姓名」其中一個');
      return;
    }

    // 用目標分頁的欄位標題找對應欄
    const tm = guessTable(targetSheet);
    const colNumber = findColByNames(tm, ['編號','number','numbering','residentnumber','住民編號']) || tm.cols[0];
    const colName = findColByNames(tm, ['姓名','name']) || tm.cols[1] || tm.cols[0];
    const colNote = findColByNames(tm, ['備註','註記','note','remarks']);

    const meta = sheetMeta[targetSheet] || {};
    const mc = meta.max_col || (stateGrid[targetSheet]?.[0]?.length || 0) || 20;

    const newRow = firstEmptyDataRow(targetSheet);
    ensureGridSize(targetSheet, newRow, mc);

    if (colNumber) gridSet(targetSheet, newRow, colNumber.c, number);
    if (colName) gridSet(targetSheet, newRow, colName.c, name);
    if (colNote && note) gridSet(targetSheet, newRow, colNote.c, note);

    addModal?.hide();
    scheduleSave('新增住民');
    // 若目前就在該分頁則即時刷新
    if (targetSheet === currentSheet) renderTable();
    else alert('已新增到「' + targetSheet + '」。如果要查看，請切換分頁。');
  });

  function selectedCount(){
    return getSelectedExcelRows(currentSheet).length;
  }

  document.getElementById('btnDeleteRows')?.addEventListener('click', () => {
    const rows = getSelectedExcelRows(currentSheet);
    if (rows.length === 0){
      alert('請先勾選要刪除的住民');
      return;
    }
    if (!confirm('確定要刪除選取的 ' + rows.length + ' 筆住民？（會清空該列資料）')) return;
    deleteExcelRows(currentSheet, rows);
    clearSelectionForSheet(currentSheet);
    renderTable();
    scheduleSave('刪除住民');
  });

  document.getElementById('btnMoveRows')?.addEventListener('click', () => {
    const rows = getSelectedExcelRows(currentSheet);
    if (rows.length === 0){
      alert('請先勾選要調動的住民');
      return;
    }
    document.getElementById('moveCount').textContent = String(rows.length);
    if (moveSheetSel) moveSheetSel.value = currentSheet;
    moveModal?.show();
  });

  document.getElementById('btnConfirmMove')?.addEventListener('click', () => {
    const toSheet = moveSheetSel?.value || currentSheet;
    if (toSheet === currentSheet){
      alert('請選擇不同的目標分頁');
      return;
    }
    const rows = getSelectedExcelRows(currentSheet);
    if (rows.length === 0) return;

    const fromTM = guessTable(currentSheet);
    const toTM = guessTable(toSheet);

    // header name -> col index
    const fromMap = new Map(fromTM.cols.map(c => [String(c.name||'').toLowerCase(), c.c]));
    const toMap = new Map(toTM.cols.map(c => [String(c.name||'').toLowerCase(), c.c]));

    const toMeta = sheetMeta[toSheet] || {};
    const toMc = toMeta.max_col || (stateGrid[toSheet]?.[0]?.length || 0) || 20;

    for (const r of rows){
      // 讀出一列（依 fromTM 的 col）
      const rowData = {};
      for (const col of fromTM.cols){
        rowData[String(col.name||'').toLowerCase()] = gridGet(currentSheet, r, col.c);
      }

      // 新增到 toSheet
      const newRow = firstEmptyDataRow(toSheet);
      ensureGridSize(toSheet, newRow, toMc);

      // 同名欄位搬過去
      for (const [h, v] of Object.entries(rowData)){
        const tc = toMap.get(h);
        if (tc) gridSet(toSheet, newRow, tc, v);
      }

      // 清空原列
      const fromMeta = sheetMeta[currentSheet] || {};
      const fromMc = fromMeta.max_col || (stateGrid[currentSheet]?.[0]?.length || 0) || 20;
      ensureGridSize(currentSheet, r, fromMc);
      for (let c=1; c<=fromMc; c++) gridSet(currentSheet, r, c, '');
    }

    clearSelectionForSheet(currentSheet);
    moveModal?.hide();
    renderTable();
    scheduleSave('調動住民');
    alert('已調動完成（' + rows.length + ' 筆 → ' + toSheet + '）');
  });

  document.addEventListener('firebase-ready', async () => {
    if (getDb()) {
      setFbStatus(true, '已就緒');
      await loadFromFirestore();
      renderTable();
    } else {
      setFbStatus(false, '尚未初始化');
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
    }
  });

  setTimeout(async () => {
    if (getDb()) {
      setFbStatus(true, '已就緒');
      await loadFromFirestore();
      renderTable();
    } else {
      setFbStatus(false, '尚未初始化');
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
    }
  }, 2000);
});
