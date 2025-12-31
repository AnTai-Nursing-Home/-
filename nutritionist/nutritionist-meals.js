// nutritionist-meals.js
// 目標：
// 1) 依「餐單日期」把三個分頁資料寫入 Firebase（Firestore）
// 2) 表格可直接編輯、可新增住民、可移動住民到其他分頁
// 3) 匯出 Excel：用 meal-template.xlsx 當模板（保留版面），把資料寫回去再下載
//
// 注意：此頁「不做翻譯、不做密碼」。

const TEMPLATE_XLSX = 'meal-template.xlsx';



function getDb(){
  // Prefer a shared helper from firebase-init.js if present
  try {
    if (typeof window !== 'undefined' && typeof window.getDb === 'function') {
      return window.getDb();
    }
  } catch (e) {}

  // Fallback: global `db` from firebase-init.js
  try {
    if (typeof db !== 'undefined' && db) return db;
  } catch (e) {}

  return null;
}
// 你提供的 Excel 讀出來的初始資料（當作「模板預設」）
const initialTitle = "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10";
const initialData = {"正常餐": [{"bed": "102-1", "name": "古金山\nGU JIN SHAN", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "護力養罐裝\n(22點)", "special": ""}, {"bed": "102-2", "name": "張元耀  Yuanyao", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "106-1", "name": "蘇隆豐\nSu Lungfeng", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "107-1", "name": "潘樹杉   shu shan", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "110-2", "name": "鄭錦足   CHIN-TSU", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "111-2", "name": "謝美\nXIE MEI", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "112-2", "name": "陳秀美大\nHsiu-Mei", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "自備奶", "special": ""}, {"bed": "115-1", "name": "陳秀美\nHsiu-Mei", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": ""}, {"bed": "115-2", "name": "呂蕭秀琴\nXiù qín", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "初一\n十五素"}, {"bed": "116-1", "name": "林麗香\nLin Lihsiang", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "116-2", "name": "孔伍櫻桃\nyīngtáo", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "211-2", "name": "王葉招枝\nWang Ye Zhaozhi", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "減重飲食", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "212-2", "name": "蘇嘉弘\nSu Chiahung", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "213-2", "name": "邱文標\nQIU WENBIAO", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "減重飲食", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "221-1", "name": "王進武  Jinwu", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "少糖\n(less sugar)"}, {"bed": "302-1", "name": "林文立\nWen Li", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": ""}, {"bed": "302-3", "name": "潘景宏  jinghong", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "303-1", "name": "許居鎰\nHsu Chuyi", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "自備奶", "special": ""}, {"bed": "303-2", "name": "許坤忠\nHsu Kunchung", "side": "█", "plate": "", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "自備奶", "special": "不供湯\nno soup"}, {"bed": "303-3", "name": "黃國清 Guoqing", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": "不供湯\nno soup"}, {"bed": "303-5", "name": "郭良吉\nGuo LiangJi", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": "不供湯\nno soup"}, {"bed": "306-2", "name": "許湘玲\nHsu Hsiangling", "side": "█", "plate": "", "bowl": "█", "diet_type": "剁碎\nChopped", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "自備奶", "special": ""}, {"bed": "308-1", "name": "朱全明\nChu Chuanming", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "312-3", "name": "宋進興\nJinxing", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "糖尿病\ndiabetes", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "少糖\n(less sugar)"}, {"bed": "312-6", "name": "林泰安\nTaian", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般+稀飯\nnormal", "meal_supply": "減重飲食", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "315-1", "name": "劉藍麗珠 Li Jue", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般+稀飯\nnormal+\ncongee", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "22點\n(護力養2.5匙)", "special": ""}, {"bed": "315-2", "name": "李職如\nLI\nJHIH-RU", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "318-1", "name": "吳政達\nZheng Da", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "糖尿病\ndiabetes", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}], "剁碎餐": [{"bed": "103-2", "name": "阮茂松\nJUAN\nMAO SUNG", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶\n(不定時補充)", "extra": "", "special": ""}, {"bed": "109-1", "name": "黃桂女\nGuinu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "減重飲食", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2, "protein": 1400, "kcal": 60, "protein_g": "", "extra": "", "special": ""}, {"bed": "110-1", "name": "林瑞滿\nRuiman", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "111-1", "name": "吳葉聰霞\nWu Yeh-tsunghsia", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "201-1", "name": "李美麗\nLi Meili", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "205-1", "name": "郭秀惠\nKuo Hsiuhui", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-2", "name": "黃萬吉\nHUANG\nWAN JI", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-3", "name": "黃亮達\nLiangda", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "208-5", "name": "曾和成   Hecheng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "安素\n(不定時)", "extra": "", "special": ""}, {"bed": "213-1", "name": "洪清富\nHung Chingfu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "217-2", "name": "高葉銀成\nKao Yeh-yincheng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "218-3", "name": "葉曾順妹 Shunmei", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2, "protein": 1400, "kcal": 60, "protein_g": "", "extra": "", "special": ""}, {"bed": "219-5", "name": "張秋淑\nQiushu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "219-6", "name": "潘張清雲\nQingyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "自備奶", "extra": "少糖\n(less sugar)", "special": ""}, {"bed": "220-2", "name": "杜典崑\nDudian kun", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "301-1", "name": "林安允\nAnyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "糖尿病\ndiabetes", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "301-2", "name": "林烈雲\nLieyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "302-2", "name": "林楊智\nYangzhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "302-5", "name": "林昌輝\nLIN\nCHANG-HUEI", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "洗腎餐\ndialysis", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "桂格透析\n(不定時)", "extra": "瀝乾菜湯", "special": ""}, {"bed": "309-2", "name": "莊學霖\nChuang Hsuehlin", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "311-1", "name": "張梅心\nJhang Meisin", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶\n(不定時補充)", "extra": "", "special": ""}, {"bed": "311-2", "name": "許陳菊季\nHsuchen Chuchi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "311-3", "name": "林黃金枝  Lin huang jin zhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "311-5", "name": "陳林金枝\nChen Lin Jinzhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "312-2", "name": "潘郁豐 \nPan Yufeng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "312-5", "name": "賴盈賢  Yingxian", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "318-2", "name": "許榮成  Rongceng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}], "攪打餐": [{"bed": "109-2", "name": "黃蕭琴  Xiaoqin", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "206-2", "name": "莊雪娥  XUE E ", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "高蛋白餐\nHight protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 0.5, "veg": 2.5, "protein": 1500, "kcal": 74, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-1", "name": "穆顯侗  Xiandong", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "低蛋白餐\nLow\nprotein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 1.5, "protein": 1600, "kcal": 58, "protein_g": "自備奶\n(桂格未洗腎配方)", "extra": "", "special": ""}, {"bed": "219-2", "name": "潘陳採綢  Pan Chen Caisi", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "高蛋白\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 0.5, "veg": 2.5, "protein": 1500, "kcal": 74, "protein_g": "", "extra": "", "special": ""}, {"bed": "301-5", "name": "張元平  YUAN PING", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "312-1", "name": "邱桂英\nGuiying", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}]};

// Firestore 存放位置：collection 'nutrition_meals' / doc '{YYYY-MM-DD}'
const FS_COLLECTION = 'nutrition_meals';

const SHEETS = ['正常餐','剁碎餐','攪打餐'];

const COLS = [
  { key:'bed', label:'編號', width: 90, readonly:true },
  { key:'name', label:'姓名', width: 160, readonly:true },
  { key:'side', label:'配菜', width: 80, type:'checkboxMark' },
  { key:'plate', label:'餐盤', width: 70, type:'checkboxMark' },
  { key:'bowl', label:'碗', width: 70, type:'checkboxMark' },
  { key:'diet_type', label:'食物型態', width: 140 },
  { key:'meal_supply', label:'供應餐別', width: 140 },
  { key:'rice', label:'飯(碗)', width: 70, type:'number' },
  { key:'congee', label:'粥(碗)', width: 70, type:'number' },
  { key:'noodle', label:'麵(碗)', width: 70, type:'number' },
  { key:'veg', label:'蔬菜(碗)', width: 90, type:'number' },
  { key:'protein', label:'豆魚蛋肉類', width: 100, type:'number' },
  { key:'kcal', label:'總熱量(大卡)', width: 110, type:'number' },
  { key:'protein_g', label:'蛋白質(克)', width: 110, type:'number' },
  { key:'extra', label:'額外補充', width: 160, type:'textarea' },
  { key:'special', label:'特殊指示', width: 180, type:'textarea' },
];

let currentSheet = '正常餐';
let state = structuredClone(initialData);
let currentDateKey = '';

// db 由 firebase-init.js 提供（全域變數）
let saveTimer = null;
let lastSavedAt = 0;

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }


// 表格區顯示「讀取中…」
function showLoading(msg='讀取中…'){
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="p-4 text-center text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
      <span>${msg}</span>
    </div>
  `;
}

function markToBool(v) {
  return String(v || '').trim() === '█';
}
function boolToMark(b) {
  return b ? '█' : '';
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('\n',' ');
}

function toRocString(isoDate) {
  if (!isoDate) return '';
  const [y,m,d] = isoDate.split('-').map(x=>parseInt(x,10));
  if (!y || !m || !d) return '';
  return `${y-1911}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')}`;
}
function buildTitleWithDate(isoDate) {
  const base = String(initialTitle).replace(/\s*\d{3}\.\d{2}\.\d{2}\s*$/, '').trim();
  const roc = toRocString(isoDate);
  return roc ? `${base} ${roc}` : String(initialTitle);
}

function normNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).trim());
  if (Number.isNaN(n)) return v;
  return n;
}

function initDateDefault() {
  const input = $('#mealDate');
  if (!input) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  input.value = `${y}-${m}-${d}`;
}

function renderTabs() {
  $all('#mealTabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sheet === currentSheet);
  });
  const span = $('#modalCurrentSheet');
  if (span) span.textContent = currentSheet;
}

function renderTable() {
  const wrap = $('#tableWrap');
  const rows = state[currentSheet] || [];
  const html = [];

  html.push('<table class="meal">');
  html.push('<thead><tr>');
  for (const col of COLS) {
    html.push(`<th style="min-width:${col.width}px">${col.label}</th>`);
  }
  html.push('</tr></thead>');

  html.push('<tbody>');
  rows.forEach((row, idx) => {
    html.push('<tr>');
    COLS.forEach((col) => {
      const v = row[col.key] ?? '';
      const tdClass = [
        col.readonly ? 'readonly' : '',
        (col.key==='bed' || col.key==='side' || col.key==='plate' || col.key==='bowl' || col.type==='number') ? 'center' : '',
        (col.key==='name') ? 'small' : ''
      ].filter(Boolean).join(' ');

      if (col.readonly) {
        html.push(`<td class="${tdClass}">${escapeHtml(String(v)).replace(/\n/g,'<br>')}</td>`);
        return;
      }

      if (col.type === 'checkboxMark') {
        const checked = markToBool(v);
        html.push(`<td class="${tdClass}">
          <input type="checkbox" class="form-check-input" data-idx="${idx}" data-key="${col.key}" ${checked?'checked':''}>
        </td>`);
        return;
      }

      if (col.type === 'textarea') {
        html.push(`<td class="${tdClass}">
          <textarea class="cell" data-idx="${idx}" data-key="${col.key}">${escapeHtml(String(v))}</textarea>
        </td>`);
        return;
      }

      const isNumCol = (col.type === 'number');
      const sv = String(v ?? '');
      const numOk = (!isNumCol) || sv.trim()==='' || /^-?\d+(?:\.\d+)?$/.test(sv.trim());
      const inputType = (isNumCol && numOk) ? 'number' : 'text';
      const stepAttr = (isNumCol && numOk) ? ' step="1" ' : '';
      html.push(`<td class="${tdClass}">
        <input class="cell" type="${inputType}" ${stepAttr} data-idx="${idx}" data-key="${col.key}" value="${escapeAttr(String(v))}">
      </td>`);
    });
    html.push('</tr>');
  });
  html.push('</tbody></table>');

  wrap.innerHTML = html.join('');
}

function bindTableEvents() {
  const wrap = $('#tableWrap');

  wrap.addEventListener('input', (e) => {
    const t = e.target;
    const idx = t.dataset.idx;
    const key = t.dataset.key;
    if (idx == null || !key) return;

    const row = state[currentSheet][Number(idx)];
    if (!row) return;

    if (t.type === 'checkbox') {
      row[key] = boolToMark(t.checked);
      scheduleSave('表格修改');
      return;
    }

    // number 欄位：允許空白；非數字就先保留文字（避免 input[type=number] 解析錯誤）
    const col = COLS.find(c => c.key === key);
    if (col?.type === 'number') {
      const vv = String(t.value ?? '').trim();
      row[key] = (vv === '' || !/^-?\d+(?:\.\d+)?$/.test(vv)) ? vv : Number(vv);
    } else {
      row[key] = t.value;
    }
    scheduleSave('表格修改');
  }, { passive: true });
}

function setSaveStatus(text) {
  const el = $('#saveStatus');
  if (el) el.textContent = text;
}

function scheduleSave(reason='儲存') {
  setSaveStatus(`已變更：${reason}（準備儲存…）`);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const db = getDb();
    if (!db) {
      setSaveStatus('Firebase 尚未連線，暫時無法儲存（請稍候幾秒再試一次）');
      return;
    }
    saveToFirestore();
  }, 700);
}

function getDateKey() {
  const v = $('#mealDate')?.value;
  return v || '';
}


async function loadNearestPast(dateKey){
  const db = getDb();
  if (!db || !dateKey) return false;

  try {
    // 依照文件 ID（日期字串）排序，取「小於等於目標日期」中最新的一筆
    const snap = await db.collection(FS_COLLECTION)
      .orderBy(firebase.firestore.FieldPath.documentId())
      .endAt(dateKey)
      .limitToLast(1)
      .get();

    if (snap.empty) return false;

    const doc = snap.docs[0];
    const data = doc.data() || {};
    if (!data || !data.sheets) return false;

    state = structuredClone(data.sheets);
    // 補齊缺的分頁
    for (const s of SHEETS) {
      if (!Array.isArray(state[s])) state[s] = [];
    }
    setSaveStatus(`此日期尚無餐單資料，已沿用 ${doc.id} 的餐單作為模板`);
    return true;
  } catch (err) {
    console.error('loadNearestPast error', err);
    setSaveStatus('讀取歷史餐單失敗（使用模板預設）');
    return false;
  }
}

async function loadFromFirestore(dateKey) {
  if (!getDb()) return false;
  if (!dateKey) return false;

  try {
    setSaveStatus('讀取 Firebase…');
    const docRef = getDb().collection(FS_COLLECTION).doc(dateKey);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data && data.sheets) {
        // 用 Firestore 資料覆蓋
        state = structuredClone(data.sheets);
        // 補齊缺的分頁（避免某天沒存完整）
        for (const s of SHEETS) {
          if (!Array.isArray(state[s])) state[s] = [];
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
  const db = getDb();
  const dateKey = getDateKey();
  if (!db || !dateKey) {
    console.warn('saveToFirestore aborted：db 或 dateKey 無效', { db: !!db, dateKey });
    return;
  }

  try {
    setSaveStatus('儲存中…');
    const docRef = db.collection(FS_COLLECTION).doc(dateKey);

    await docRef.set({
      sheets: state,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    lastSavedAt = Date.now();
    setSaveStatus(`已儲存（${new Date(lastSavedAt).toLocaleTimeString()}）`);
  } catch (err) {
    console.error('saveToFirestore error', err);
    setSaveStatus('儲存失敗（請檢查 Firestore 權限/網路；Console 內有詳細錯誤）');
    alert('餐食系統儲存失敗，請打開開發者工具（F12）→ Console 查看錯誤訊息，截圖給開發者。');
  }
}

function refreshMoveSelect() {
  const sel = $('#moveSelect');
  if (!sel) return;
  const rows = state[currentSheet] || [];
  sel.innerHTML = rows.map((r, i) => {
    const label = `${r.bed || ''} ${r.name || ''}`.trim();
    return `<option value="${i}">${escapeHtml(label || ('第 '+(i+1)+'列'))}</option>`;
  }).join('');
}

function openManageModal() {
  renderTabs();
  refreshMoveSelect();
  const modalEl = $('#residentModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function addResident() {
  const bed = ($('#addBed')?.value || '').trim();
  const name = ($('#addName')?.value || '').trim();
  if (!bed || !name) {
    alert('請填「編號」與「姓名」');
    return;
  }

  const dietType = ($('#addDietType')?.value || '').trim();
  const mealSupply = ($('#addMealSupply')?.value || '').trim();

  const newRow = {
    bed, name,
    side:'', plate:'', bowl:'',
    diet_type: dietType,
    meal_supply: mealSupply,
    rice:'', congee:'', noodle:'',
    veg:'', protein:'',
    kcal:'', protein_g:'',
    extra:'', special:''
  };

  if (!Array.isArray(state[currentSheet])) state[currentSheet] = [];
  state[currentSheet].push(newRow);

  // 清空欄位
  $('#addBed').value = '';
  $('#addName').value = '';
  $('#addDietType').value = '';
  $('#addMealSupply').value = '';

  renderTable();
  refreshMoveSelect();
  scheduleSave('新增住民');
}

function moveResident() {
  const idx = Number($('#moveSelect')?.value);
  const target = $('#moveTarget')?.value;

  if (!Number.isFinite(idx)) {
    alert('請先選擇要移動的住民');
    return;
  }
  if (!SHEETS.includes(target)) {
    alert('目標分頁不正確');
    return;
  }
  if (target === currentSheet) {
    alert('目標分頁不能跟目前分頁相同');
    return;
  }

  const src = state[currentSheet] || [];
  const row = src[idx];
  if (!row) return;

  // 從來源刪除
  src.splice(idx, 1);

  // 加到目標
  if (!Array.isArray(state[target])) state[target] = [];
  state[target].push(row);

  renderTable();
  refreshMoveSelect();
  scheduleSave(`移動到「${target}」`);
}

function removeResident() {
  const idx = Number($('#moveSelect')?.value);
  if (!Number.isFinite(idx)) {
    alert('請先選擇要移除的住民');
    return;
  }
  if (!confirm('確定要從目前分頁移除這位住民嗎？')) return;

  const src = state[currentSheet] || [];
  src.splice(idx, 1);

  renderTable();
  refreshMoveSelect();
  scheduleSave('移除住民');
}

async function exportExcel() {
  if (typeof ExcelJS === "undefined") {
    alert("ExcelJS 尚未載入，無法匯出 .xlsx");
    return;
  }
  const dateIso = getDateKey();
  if (!dateIso) { alert("請先選擇餐單日期"); return; }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Antai System";
  wb.created = new Date();

  const titleText = (typeof buildTitleWithDate === 'function')
    ? buildTitleWithDate(dateIso)
    : (typeof buildTitle === 'function' ? buildTitle(dateIso) : (initialTitle || '餐單總表'));

  // Auto column widths (based on current state)
  const calcColWidths = (rows) => {
    const cols = COLS.length;
    const w = Array(cols).fill(12);
    const visualLen = (val) => {
      const s = (val == null) ? "" : String(val);
      const lines = s.split(/\r?\n/);
      const maxLine = Math.max(...lines.map(line => line.length), 0);
      const cjk = (line) => (line.match(/[\u4E00-\u9FFF]/g) || []).length;
      const maxCjk = Math.max(...lines.map(line => cjk(line)), 0);
      return maxLine + maxCjk;
    };
    for (let c = 0; c < cols; c++) {
      let maxLen = visualLen(COLS[c].label);
      for (const r of rows) maxLen = Math.max(maxLen, visualLen(r?.[COLS[c].key]));
      w[c] = Math.max(10, Math.min(60, Math.round(maxLen * 1.15)));
    }
    return w;
  };

  const fmtIsoToRoc = (iso) => {
    if (!iso) return "";
    const [y,m,d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return String(iso);
    return `${y-1911}/${String(m).padStart(2,"0")}/${String(d).padStart(2,"0")}`;
  };

  for (const sheetName of SHEETS) {
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 3 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    const rows = (state && state[sheetName]) ? state[sheetName] : [];
    const widths = calcColWidths(rows);
    ws.columns = COLS.map((c, i) => ({ key: c.key, width: widths[i] }));
    const lastCol = COLS.length;

    // Title row
    ws.mergeCells(1, 1, 1, lastCol);
    ws.getRow(1).height = 60;
    ws.getCell(1, 1).value = titleText;
    ws.getCell(1, 1).font = { name: "標楷體", size: 16, bold: true };
    ws.getCell(1, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Info row
    ws.mergeCells(2, 1, 2, lastCol);
    ws.getRow(2).height = 60;
    ws.getCell(2, 1).value = `餐單日期：${fmtIsoToRoc(dateIso)}    分頁：${sheetName}`;
    ws.getCell(2, 1).font = { name: "標楷體", size: 12, bold: true };
    ws.getCell(2, 1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Header row (no shift)
    const header = ws.getRow(3);
    header.height = 60;
    header.values = COLS.map(c => c.label);
    header.font = { name: "標楷體", size: 12, bold: true };
    header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6F9" } };
    });

    // Data rows
    for (const r of rows) {
      const obj = {};
      for (const c of COLS) obj[c.key] = (r && r[c.key] != null) ? r[c.key] : "";
      ws.addRow(obj);
    }

    // Style data rows
    for (let r = 4; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      row.height = 60;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: "標楷體", size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      });
    }

    // Borders
    const applyBorder = (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } }
      };
    };
    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= lastCol; c++) applyBorder(ws.getCell(r, c));
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = `${dateIso}_餐單總表.xlsx`;
  if (typeof saveAs !== "undefined") saveAs(blob, filename);
  else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
}

function printCurrent() {
  window.print();
}

async function onDateChanged(){
  showLoading('讀取中…');
  const dateKey = getDateKey();
  if (!dateKey) return;

  // 更新目前所在日期
  currentDateKey = dateKey;

  // 先嘗試讀取「這一天」是否已有 Firebase 資料
  const hasExact = await loadFromFirestore(dateKey);

  if (!hasExact) {
    // 若當日完全沒有資料，改為尋找「最近一個在此日期之前的餐單」來當模板
    const loadedPast = await loadNearestPast(dateKey);
    if (!loadedPast) {
      // 完全找不到歷史資料 → 回到最原始模板
      state = structuredClone(initialData);
      setSaveStatus('此日期尚無餐單資料，已使用模板預設');
    }
  }

  renderTabs();
  renderTable();
  refreshMoveSelect();
}

document.addEventListener('DOMContentLoaded', () => {
  initDateDefault();

  // tabs
  $('#mealTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sheet]');
    if (!btn) return;
    currentSheet = btn.dataset.sheet;
    showLoading('讀取中…');
    renderTabs();
    renderTable();
    refreshMoveSelect();
  });

  bindTableEvents();

  $('#btnExport').addEventListener('click', exportExcel);
  $('#btnPrint').addEventListener('click', printCurrent);
  $('#btnManage').addEventListener('click', openManageModal);

  $('#btnAddResident').addEventListener('click', addResident);
  $('#btnMoveResident').addEventListener('click', moveResident);
  $('#btnRemoveResident').addEventListener('click', removeResident);

  $('#mealDate').addEventListener('change', () => {
    scheduleSave('切換日期（會讀取該日期資料）');
    onDateChanged();
  });

  // 等 Firebase 初始化完成（你專案是 firebase-init.js 會觸發 firebase-ready）
  document.addEventListener('firebase-ready', async () => {
    if (!getDb()) {
      setSaveStatus('Firebase 尚未初始化（不會儲存）');
      return;
    }
    setSaveStatus('Firebase 已就緒');
    await onDateChanged(); // 第一次載入：依日期讀取
  });

  // 如果 firebase-ready 沒觸發（極少數情況），仍先渲染模板
  renderTabs();
  renderTable();
  refreshMoveSelect();
});
