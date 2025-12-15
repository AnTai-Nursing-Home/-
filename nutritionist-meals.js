// nutritionist-meals.js
// 目標：用「meal-template.xlsx」當模板（保留版面），只把資料寫回去再匯出。
// 注意：這裡不做翻譯、不做密碼。

const TEMPLATE_XLSX = 'meal-template.xlsx';

// 從你提供的 Excel 讀出來的初始資料（可直接編輯）
const initialTitle = "安泰醫療社團法人附設安泰-護理之家餐單總表Meal List 114.12.10";
const initialData = {"正常餐": [{"bed": "102-1", "name": "古金山\nGU JIN SHAN", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "護力養罐裝\n(22點)", "special": ""}, {"bed": "102-2", "name": "張元耀  Yuanyao", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "106-1", "name": "蘇隆豐\nSu Lungfeng", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "107-1", "name": "潘樹杉   shu shan", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "110-2", "name": "鄭錦足   CHIN-TSU", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "111-2", "name": "謝美\nXIE MEI", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "112-2", "name": "陳秀美大\nHsiu-Mei", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "自備奶", "special": ""}, {"bed": "115-1", "name": "陳秀美\nHsiu-Mei", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": ""}, {"bed": "115-2", "name": "呂蕭秀琴\nXiù qín", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "初一\n十五素"}, {"bed": "116-1", "name": "林麗香\nLin Lihsiang", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "116-2", "name": "孔伍櫻桃\nyīngtáo", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "211-2", "name": "王葉招枝\nWang Ye Zhaozhi", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "減重飲食", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "212-2", "name": "蘇嘉弘\nSu Chiahung", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "213-2", "name": "邱文標\nQIU WENBIAO", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "減重飲食", "rice": 0.8, "congee": 1.5, "noodle": 1.5, "veg": 1, "protein": 2.5, "kcal": 1500, "protein_g": 73, "extra": "", "special": ""}, {"bed": "221-1", "name": "王進武  Jinwu", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "少糖\n(less sugar)"}, {"bed": "302-1", "name": "林文立\nWen Li", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": ""}, {"bed": "302-3", "name": "潘景宏  jinghong", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "303-1", "name": "許居鎰\nHsu Chuyi", "side": "█", "plate": "█", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "自備奶", "special": ""}, {"bed": "303-2", "name": "許坤忠\nHsu Kunchung", "side": "█", "plate": "", "bowl": "", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "自備奶", "special": "不供湯\nno soup"}, {"bed": "303-3", "name": "黃國清 Guoqing", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "洗腎餐\ndialysis", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 3, "kcal": 1800, "protein_g": 90, "extra": "", "special": "不供湯\nno soup"}, {"bed": "303-5", "name": "郭良吉\nGuo LiangJi", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": "不供湯\nno soup"}, {"bed": "306-2", "name": "許湘玲\nHsu Hsiangling", "side": "█", "plate": "", "bowl": "█", "diet_type": "剁碎\nChopped", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "自備奶", "special": ""}, {"bed": "308-1", "name": "朱全明\nChu Chuanming", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "一般\nnormal", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "312-3", "name": "宋進興\nJinxing", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "糖尿病\ndiabetes", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": "少糖\n(less sugar)"}, {"bed": "312-6", "name": "林泰安\nTaian", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般+稀飯\nnormal", "meal_supply": "減重飲食", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "", "special": ""}, {"bed": "315-1", "name": "劉藍麗珠 Li Jue", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般+稀飯\nnormal+\ncongee", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2, "kcal": 1600, "protein_g": 70, "extra": "22點\n(護力養2.5匙)", "special": ""}, {"bed": "315-2", "name": "李職如\nLI\nJHIH-RU", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "高蛋白\nHigt  protein", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}, {"bed": "318-1", "name": "吳政達\nZheng Da", "side": "█", "plate": "", "bowl": "█", "diet_type": "一般\nnormal", "meal_supply": "糖尿病\ndiabetes", "rice": 1, "congee": 2, "noodle": 2, "veg": 1, "protein": 2.5, "kcal": 1700, "protein_g": 80, "extra": "", "special": ""}], "剁碎餐": [{"bed": "103-2", "name": "阮茂松\nJUAN\nMAO SUNG", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶\n(不定時補充)", "extra": "", "special": ""}, {"bed": "109-1", "name": "黃桂女\nGuinu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "減重飲食", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2, "protein": 1400, "kcal": 60, "protein_g": "", "extra": "", "special": ""}, {"bed": "110-1", "name": "林瑞滿\nRuiman", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "111-1", "name": "吳葉聰霞\nWu Yeh-tsunghsia", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "201-1", "name": "李美麗\nLi Meili", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "205-1", "name": "郭秀惠\nKuo Hsiuhui", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-2", "name": "黃萬吉\nHUANG\nWAN JI", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-3", "name": "黃亮達\nLiangda", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "208-5", "name": "曾和成   Hecheng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "安素\n(不定時)", "extra": "", "special": ""}, {"bed": "213-1", "name": "洪清富\nHung Chingfu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "217-2", "name": "高葉銀成\nKao Yeh-yincheng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "218-3", "name": "葉曾順妹 Shunmei", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2, "protein": 1400, "kcal": 60, "protein_g": "", "extra": "", "special": ""}, {"bed": "219-5", "name": "張秋淑\nQiushu", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "", "extra": "", "special": ""}, {"bed": "219-6", "name": "潘張清雲\nQingyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "自備奶", "extra": "少糖\n(less sugar)", "special": ""}, {"bed": "220-2", "name": "杜典崑\nDudian kun", "side": "█", "plate": "█", "bowl": "剁碎+乾飯\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "301-1", "name": "林安允\nAnyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "糖尿病\ndiabetes", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "301-2", "name": "林烈雲\nLieyun", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "302-2", "name": "林楊智\nYangzhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "302-5", "name": "林昌輝\nLIN\nCHANG-HUEI", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "洗腎餐\ndialysis", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "桂格透析\n(不定時)", "extra": "瀝乾菜湯", "special": ""}, {"bed": "309-2", "name": "莊學霖\nChuang Hsuehlin", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "311-1", "name": "張梅心\nJhang Meisin", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "自備奶\n(不定時補充)", "extra": "", "special": ""}, {"bed": "311-2", "name": "許陳菊季\nHsuchen Chuchi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "311-3", "name": "林黃金枝  Lin huang jin zhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "311-5", "name": "陳林金枝\nChen Lin Jinzhi", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "高蛋白\nHigt  protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 1, "veg": 2.5, "protein": 1500, "kcal": 73, "protein_g": "", "extra": "", "special": ""}, {"bed": "312-2", "name": "潘郁豐 \nPan Yufeng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}, {"bed": "312-5", "name": "賴盈賢  Yingxian", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "", "extra": "", "special": ""}, {"bed": "318-2", "name": "許榮成  Rongceng", "side": "█", "plate": "█", "bowl": "剁碎\nChopped", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}], "攪打餐": [{"bed": "109-2", "name": "黃蕭琴  Xiaoqin", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "206-2", "name": "莊雪娥  XUE E ", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "高蛋白餐\nHight protein", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 0.5, "veg": 2.5, "protein": 1500, "kcal": 74, "protein_g": "", "extra": "", "special": ""}, {"bed": "208-1", "name": "穆顯侗  Xiandong", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "低蛋白餐\nLow\nprotein", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 1.5, "protein": 1600, "kcal": 58, "protein_g": "自備奶\n(桂格未洗腎配方)", "extra": "", "special": ""}, {"bed": "219-2", "name": "潘陳採綢  Pan Chen Caisi", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "高蛋白\nnormal", "meal_supply": 0.8, "rice": 1.5, "congee": 1.5, "noodle": 0.5, "veg": 2.5, "protein": 1500, "kcal": 74, "protein_g": "", "extra": "", "special": ""}, {"bed": "301-5", "name": "張元平  YUAN PING", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2.5, "protein": 1700, "kcal": 80, "protein_g": "自備奶", "extra": "", "special": ""}, {"bed": "312-1", "name": "邱桂英\nGuiying", "side": "█", "plate": "█", "bowl": "攪打\nGrind", "diet_type": "一般\nnormal", "meal_supply": 1, "rice": 2, "congee": 2, "noodle": 1, "veg": 2, "protein": 1600, "kcal": 70, "protein_g": "22點\n(護力養2.5匙)", "extra": "", "special": ""}]};

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

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function markToBool(v) {
  return String(v || '').trim() === '█';
}
function boolToMark(b) {
  return b ? '█' : '';
}

function toRocString(isoDate) {
  // 2025-12-15 -> 114.12.15 （民國）
  if (!isoDate) return '';
  const [y,m,d] = isoDate.split('-').map(x=>parseInt(x,10));
  if (!y || !m || !d) return '';
  return `${y-1911}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')}`;
}
function buildTitleWithDate(isoDate) {
  const base = initialTitle.replace(/\s*\d{3}\.\d{2}\.\d{2}\s*$/, '').trim();
  const roc = toRocString(isoDate);
  return roc ? `${base} ${roc}` : initialTitle;
}

function renderTabs() {
  $all('#mealTabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sheet === currentSheet);
  });
}

function renderTable() {
  const wrap = $('#tableWrap');
  const rows = state[currentSheet] || [];
  const html = [];

  html.push('<table class="meal">');
  html.push('<thead>');
  html.push('<tr>');
  for (const col of COLS) {
    html.push(`<th style="min-width:${col.width}px">${col.label}</th>`);
  }
  html.push('</tr>');
  html.push('</thead>');

  html.push('<tbody>');
  rows.forEach((row, idx) => {
    html.push('<tr>');
    COLS.forEach((col) => {
      const v = row[col.key] ?? '';
      const readonly = col.readonly ? 'readonly' : '';
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

      const inputType = (col.type === 'number') ? 'number' : 'text';
      const stepAttr = (col.type === 'number') ? ' step="1" ' : '';
      html.push(`<td class="${tdClass}">
        <input class="cell" type="${inputType}" ${stepAttr} data-idx="${idx}" data-key="${col.key}" value="${escapeAttr(String(v))}">
      </td>`);
    });
    html.push('</tr>');
  });
  html.push('</tbody>');
  html.push('</table>');

  wrap.innerHTML = html.join('');
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
      return;
    }

    // number/text/textarea
    row[key] = t.value;
  }, { passive: true });
}

async function exportExcel() {
  const dateIso = $('#mealDate').value;
  const newTitle = buildTitleWithDate(dateIso);

  const wb = new ExcelJS.Workbook();
  const res = await fetch(TEMPLATE_XLSX, { cache: 'no-store' });
  if (!res.ok) {
    alert('找不到 meal-template.xlsx，請確認已放到同一個資料夾（與 nutritionist-meals.html 同層）');
    return;
  }
  const buf = await res.arrayBuffer();
  await wb.xlsx.load(buf);

  for (const sheetName of ['正常餐','剁碎餐','攪打餐']) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    // 更新 A1 標題（含日期）
    ws.getCell(1,1).value = newTitle;

    // 寫入資料（從第 5 列開始，A~P 共 16 欄）
    const rows = state[sheetName] || [];
    for (let i=0; i<rows.length; i++) {
      const r = 5 + i;
      const row = rows[i];
      const values = [
        row.bed, row.name, row.side, row.plate, row.bowl,
        row.diet_type, row.meal_supply,
        normNum(row.rice), normNum(row.congee), normNum(row.noodle),
        normNum(row.veg), normNum(row.protein),
        normNum(row.kcal), normNum(row.protein_g),
        row.extra, row.special
      ];

      for (let c=1; c<=16; c++) {
        ws.getCell(r,c).value = values[c-1] === '' ? null : values[c-1];
      }
    }

    // 如果模板比資料多（例如末端有空白列），把後面清掉避免殘留
    const maxDataRow = 5 + rows.length;
    for (let r = maxDataRow; r <= ws.rowCount; r++) {
      const bed = ws.getCell(r,1).value;
      const name = ws.getCell(r,2).value;
      if (bed == null && name == null) continue;
      // 超過我們資料長度的列：清空可編輯欄位（C~P）
      if (r > 5 + rows.length - 1) {
        for (let c=3; c<=16; c++) ws.getCell(r,c).value = null;
      }
    }
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  const filename = `餐食_營養師_${dateIso || '未填日期'}.xlsx`;
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

function normNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).trim());
  if (Number.isNaN(n)) return v; // 如果不是數字，就保留原字串
  return n;
}

function printCurrent() {
  // 用目前畫面 table 直接列印（已盡量做成像 Excel）
  window.print();
}

function initDateDefault() {
  // 盡量從標題抓日期，抓不到就用今天
  const m = String(initialTitle).match(/(\d{3})\.(\d{2})\.(\d{2})/);
  const input = $('#mealDate');
  if (!input) return;
  if (m) {
    const y = Number(m[1]) + 1911;
    const mm = m[2];
    const dd = m[3];
    input.value = `${y}-${mm}-${dd}`;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    input.value = `${y}-${mm}-${dd}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDateDefault();

  renderTabs();
  renderTable();
  bindTableEvents();

  // tabs
  $('#mealTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sheet]');
    if (!btn) return;
    currentSheet = btn.dataset.sheet;
    renderTabs();
    renderTable();
  });

  $('#btnExport').addEventListener('click', exportExcel);
  $('#btnPrint').addEventListener('click', printCurrent);
});
