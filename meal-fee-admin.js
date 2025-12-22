// meal-fee-admin.js
// 辦公室端：餐費管理（住民餐費金額統計表）
// - 訂餐數(份) 取自照服員點餐系統 mealOrders/{YYYY-MM-DD} 的 grandTotal
// - 1 份 = 210 元
// - 短送/補訂可輸入並儲存到 mealFeeAdjustments/{YYYY-MM-DD}

(function(){
  "use strict";

  const PRICE_PER_PORTION = 210;

  const $ = (id) => document.getElementById(id);

  function safeDb(){
    if (typeof db !== "undefined" && db) return db;
    if (window.db) return window.db;
    return null;
  }

  function pad2(n){ return String(n).padStart(2,'0'); }

  function todayMonthValue(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }

  function monthToRange(monthValue){
    // monthValue = YYYY-MM
    const [y,m] = monthValue.split('-').map(Number);
    const start = new Date(y, m-1, 1);
    const end = new Date(y, m, 1);
    const startISO = `${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`;
    const endISO = `${end.getFullYear()}-${pad2(end.getMonth()+1)}-${pad2(end.getDate())}`;
    return { startISO, endISO, year: y, month: m };
  }

  function daysInMonth(year, month){
    return new Date(year, month, 0).getDate(); // month: 1-12
  }

  function toRoc(iso){
    // YYYY-MM-DD => 114/01/01
    const y = Number(iso.slice(0,4));
    const m = iso.slice(5,7);
    const d = iso.slice(8,10);
    if (!Number.isFinite(y)) return iso;
    return `${y-1911}/${m}/${d}`;
  }

  function money(n){
    const v = Number(n)||0;
    return v.toLocaleString('en-US');
  }

  function showStatus(text, type='info'){
    const el = $('statusBar');
    el.className = `alert alert-${type} small d-print-none`;
    el.textContent = text;
    el.classList.remove('d-none');
  }
  function hideStatus(){ $('statusBar').classList.add('d-none'); }

  function computeRow(orderQty, shortQty, extraQty){
    const oq = Number(orderQty)||0;
    const sq = Number(shortQty)||0;
    const eq = Number(extraQty)||0;
    const orderAmount = oq * PRICE_PER_PORTION;
    const totalAmount = orderAmount + (sq + eq) * PRICE_PER_PORTION;
    return { oq, sq, eq, orderAmount, totalAmount };
  }

  function buildRow(dateISO, orderQty=0, adj={shortQty:0, extraQty:0}){
    const tr = document.createElement('tr');
    tr.dataset.date = dateISO;

    const { oq, sq, eq, orderAmount, totalAmount } = computeRow(orderQty, adj.shortQty, adj.extraQty);

    tr.innerHTML = `
      <td class="text-center">${toRoc(dateISO)}</td>
      <td class="text-end money" data-field="orderAmount">${money(orderAmount)}</td>
      <td class="text-center" data-field="orderQty">${oq}</td>
      <td class="text-center">
        <input type="number" min="0" step="1" class="form-control form-control-sm num-input shortQty d-print-none" value="${sq}">
        <span class="d-none d-print-inline" data-print="shortQty">${sq}</span>
      </td>
      <td class="text-center">
        <input type="number" min="0" step="1" class="form-control form-control-sm num-input extraQty d-print-none" value="${eq}">
        <span class="d-none d-print-inline" data-print="extraQty">${eq}</span>
      </td>
      <td class="text-end money" data-field="totalAmount">${money(totalAmount)}</td>
    `;

    // print 模式要顯示數字，不顯示 input
    // 這裡用 bootstrap 的 d-print-none / d-print-inline

    const shortInput = tr.querySelector('input.shortQty');
    const extraInput = tr.querySelector('input.extraQty');

    const onChange = () => {
      const newSq = Number(shortInput.value)||0;
      const newEq = Number(extraInput.value)||0;
      tr.querySelector('[data-print="shortQty"]').textContent = String(newSq);
      tr.querySelector('[data-print="extraQty"]').textContent = String(newEq);
      const r = computeRow(oq, newSq, newEq);
      tr.querySelector('[data-field="totalAmount"]').textContent = money(r.totalAmount);
      // 標記此列有變更
      tr.dataset.dirty = '1';
      recalcFooter();
    };

    shortInput.addEventListener('input', onChange);
    extraInput.addEventListener('input', onChange);

    return tr;
  }

  async function fetchMealOrdersRange(startISO, endISO){
    const _db = safeDb();
    if (!_db) throw new Error('Firebase not ready');

    // 以 mealDate 欄位查詢（照服員端儲存 payload 內含 mealDate）
    const q = _db.collection('mealOrders')
      .where('mealDate','>=', startISO)
      .where('mealDate','<', endISO)
      .orderBy('mealDate');

    const snap = await q.get();
    const map = new Map();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const key = data.mealDate || doc.id;
      const qty = Number(data.grandTotal) || 0;
      map.set(key, qty);
    });
    return map;
  }

  async function fetchAdjustmentsRange(startISO, endISO){
    const _db = safeDb();
    if (!_db) throw new Error('Firebase not ready');

    const q = _db.collection('mealFeeAdjustments')
      .where('mealDate','>=', startISO)
      .where('mealDate','<', endISO)
      .orderBy('mealDate');

    const snap = await q.get();
    const map = new Map();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const key = data.mealDate || doc.id;
      map.set(key, {
        shortQty: Number(data.shortQty)||0,
        extraQty: Number(data.extraQty)||0,
      });
    });
    return map;
  }

  function recalcFooter(){
    let sumOrderAmount = 0;
    let sumOrderQty = 0;
    let sumShortQty = 0;
    let sumExtraQty = 0;
    let sumTotalAmount = 0;

    document.querySelectorAll('#feeTbody tr').forEach(tr => {
      const orderQty = Number(tr.querySelector('[data-field="orderQty"]').textContent)||0;
      const shortQty = Number(tr.querySelector('[data-print="shortQty"]').textContent)||0;
      const extraQty = Number(tr.querySelector('[data-print="extraQty"]').textContent)||0;
      const r = computeRow(orderQty, shortQty, extraQty);

      sumOrderQty += r.oq;
      sumShortQty += r.sq;
      sumExtraQty += r.eq;
      sumOrderAmount += r.orderAmount;
      sumTotalAmount += r.totalAmount;
    });

    $('sumOrderAmount').textContent = money(sumOrderAmount);
    $('sumOrderQty').textContent = String(sumOrderQty);
    $('sumShortQty').textContent = String(sumShortQty);
    $('sumExtraQty').textContent = String(sumExtraQty);
    $('sumTotalAmount').textContent = money(sumTotalAmount);
  }

  async function buildTableForMonth(monthValue){
    const { startISO, endISO, year, month } = monthToRange(monthValue);

    $('sheetMonthLabel').textContent = `${year}年${month}月（民國${year-1911}年${month}月）`;

    const tbody = $('feeTbody');
    tbody.innerHTML = '';

    showStatus('載入資料中…', 'info');

    let ordersMap = new Map();
    let adjMap = new Map();

    try{
      // 兩個查詢都可能需要 index；若沒有資料也不影響顯示
      [ordersMap, adjMap] = await Promise.all([
        fetchMealOrdersRange(startISO, endISO),
        fetchAdjustmentsRange(startISO, endISO),
      ]);
    }catch(err){
      console.warn(err);
      // 若 adjustments 的 where+orderBy 需要 index / 欄位不存在，則退回逐日讀取（少量月份可接受）
      try{
        ordersMap = await fetchMealOrdersRange(startISO, endISO);
      }catch(e){
        console.error(e);
      }
      try{
        adjMap = await fallbackFetchAdjustmentsByDocId(year, month);
      }catch(e){
        console.error(e);
      }
    }

    const totalDays = daysInMonth(year, month);
    for(let d=1; d<=totalDays; d++){
      const iso = `${year}-${pad2(month)}-${pad2(d)}`;
      const qty = ordersMap.get(iso) ?? 0;
      const adj = adjMap.get(iso) ?? { shortQty:0, extraQty:0 };
      tbody.appendChild(buildRow(iso, qty, adj));
    }

    recalcFooter();
    hideStatus();
  }

  async function fallbackFetchAdjustmentsByDocId(year, month){
    const _db = safeDb();
    if (!_db) throw new Error('Firebase not ready');

    const map = new Map();
    const totalDays = daysInMonth(year, month);

    for(let d=1; d<=totalDays; d++){
      const iso = `${year}-${pad2(month)}-${pad2(d)}`;
      const snap = await _db.collection('mealFeeAdjustments').doc(iso).get();
      if (!snap.exists) continue;
      const data = snap.data() || {};
      map.set(iso, {
        shortQty: Number(data.shortQty)||0,
        extraQty: Number(data.extraQty)||0,
      });
    }

    return map;
  }

  async function saveAllAdjustments(){
    const _db = safeDb();
    if (!_db) return alert('Firebase 尚未初始化，請確認 firebase-init.js');

    const dirtyRows = Array.from(document.querySelectorAll('#feeTbody tr')).filter(tr => tr.dataset.dirty === '1');
    if (!dirtyRows.length){
      showStatus('沒有需要儲存的變更。', 'secondary');
      setTimeout(hideStatus, 1500);
      return;
    }

    showStatus(`儲存中…（${dirtyRows.length} 筆）`, 'info');

    const batch = _db.batch();
    const now = firebase.firestore.Timestamp.fromDate(new Date());

    dirtyRows.forEach(tr => {
      const iso = tr.dataset.date;
      const shortQty = Number(tr.querySelector('[data-print="shortQty"]').textContent)||0;
      const extraQty = Number(tr.querySelector('[data-print="extraQty"]').textContent)||0;

      const ref = _db.collection('mealFeeAdjustments').doc(iso);
      batch.set(ref, {
        mealDate: iso,
        shortQty,
        extraQty,
        pricePerPortion: PRICE_PER_PORTION,
        updatedAt: now,
      }, { merge: true });

      tr.dataset.dirty = '0';
    });

    try{
      await batch.commit();
      showStatus('已儲存完成。', 'success');
      setTimeout(hideStatus, 1500);
    }catch(err){
      console.error(err);
      showStatus('儲存失敗，請稍後再試。', 'danger');
    }
  }

  async   function exportExcel(){
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS 載入失敗，無法匯出 Excel。');
      return;
    }

    const monthValue = $('monthPicker').value;
    const { year, month } = monthToRange(monthValue);
    const dim = daysInMonth(year, month);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Antai Meal Fee';
    wb.created = new Date();

    const ws = wb.addWorksheet('餐費統計', { views: [{ state: 'frozen', ySplit: 4 }] });

    // 直式列印設定
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }
    };

    // ===== 共用樣式（參考 residents-admin.js 的匯出風格） =====
    const fontTitle  = { name:'Microsoft JhengHei', bold:true, size:16 };
    const fontSub    = { name:'Microsoft JhengHei', bold:true, size:13 };
    const fontHeader = { name:'Microsoft JhengHei', bold:true, size:11 };
    const fontCell   = { name:'Microsoft JhengHei', size:11 };

    const fillHeader = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF1F3F5' } };
    const fillAlt    = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8F9FA' } };
    const fillTotal  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE7F1FF' } };

    const borderThin = {
      top:{style:'thin',color:{argb:'FF9E9E9E'}},
      left:{style:'thin',color:{argb:'FF9E9E9E'}},
      bottom:{style:'thin',color:{argb:'FF9E9E9E'}},
      right:{style:'thin',color:{argb:'FF9E9E9E'}}
    };

    function styleRow(row, { isHeader=false, alt=false, height=22, center=false } = {}){
      row.eachCell({ includeEmpty:true }, (c, idx)=>{
        c.font = isHeader ? fontHeader : fontCell;
        c.border = borderThin;
        c.alignment = {
          vertical: 'middle',
          horizontal: (isHeader || center) ? 'center' : (idx === 1 ? 'center' : 'right'),
          wrapText: false,
          shrinkToFit: true
        };
        if (isHeader) c.fill = fillHeader;
        else if (alt) c.fill = fillAlt;
      });
      row.height = height;
    }

    // ===== 欄位 =====
    ws.columns = [
      { key:'day',          width: 12 },
      { key:'orderAmount',  width: 16 },
      { key:'orderQty',     width: 12 },
      { key:'shortQty',     width: 14 },
      { key:'extraQty',     width: 14 },
      { key:'totalAmount',  width: 16 },
    ];

    // ===== 標題 =====
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = '安泰醫療社團法人附設安泰護理之家';
    ws.getCell('A1').font = fontTitle;
    ws.getCell('A1').alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = '住民餐費金額統計表';
    ws.getCell('A2').font = fontSub;
    ws.getCell('A2').alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(2).height = 22;

    ws.mergeCells('A3:F3');
    ws.getCell('A3').value = `${year}年${month}月`;
    ws.getCell('A3').font = { name:'Microsoft JhengHei', bold:true, size:12 };
    ws.getCell('A3').alignment = { vertical:'middle', horizontal:'center' };
    ws.getRow(3).height = 20;

    // ===== 表頭 =====
    const headerRow = ws.getRow(4);
    headerRow.values = ['日期', '訂餐金額', '訂餐數(份)', '短送餐數(份)', '補訂餐數(份)', '總額'];
    styleRow(headerRow, { isHeader:true, height:26, center:true });

    // ===== 內容 =====
    const startDataRow = 5;
    for (let d=1; d<=dim; d++){
      const iso = `${year}-${pad2(month)}-${pad2(d)}`;
      const r = rowsByDate.get(iso) || { orderQty:0, shortQty:0, extraQty:0, orderAmount:0, totalAmount:0 };
      const row = ws.addRow([
        toRoc(iso),
        r.orderAmount || 0,
        r.orderQty || 0,
        r.shortQty || 0,
        r.extraQty || 0,
        r.totalAmount || 0,
      ]);
      const isAlt = ((d % 2) === 0);
      styleRow(row, { alt:isAlt, height:22 });
      // 數字格式
      row.getCell(2).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0';
      row.getCell(3).numFmt = '0';
      row.getCell(4).numFmt = '0';
      row.getCell(5).numFmt = '0';
      // 日期置中
      row.getCell(1).alignment = { vertical:'middle', horizontal:'center', shrinkToFit:true };
    }

    // ===== 合計 =====
    const totalRowNum = startDataRow + dim;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.getCell(1).value = '小計';
    totalRow.getCell(1).font = fontHeader;
    totalRow.getCell(1).alignment = { vertical:'middle', horizontal:'center' };

    // 合計放在「總額」欄
    const totalCell = totalRow.getCell(6);
    totalCell.value = { formula: `SUM(F${startDataRow}:F${totalRowNum-1})` };
    totalCell.font = fontHeader;
    totalCell.numFmt = '#,##0';
    totalCell.alignment = { vertical:'middle', horizontal:'right' };

    // 小計列樣式
    for (let c=1; c<=6; c++){
      const cell = totalRow.getCell(c);
      cell.border = borderThin;
      cell.fill = fillTotal;
      if (!cell.font) cell.font = fontHeader;
      if (!cell.alignment) cell.alignment = { vertical:'middle', horizontal:'center' };
    }
    totalRow.height = 24;

    // ===== 輸出 =====
    const fileName = `餐費統計_${year}-${pad2(month)}.xlsx`;
    wb.xlsx.writeBuffer().then((buf)=>{
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }).catch((e)=>{
      console.error(e);
      alert('匯出 Excel 失敗，請查看 console。');
    });
  }

  function wireUI(){
    $('monthPicker').value = todayMonthValue();

    $('monthPicker').addEventListener('change', async () => {
      await buildTableForMonth($('monthPicker').value);
    });

    $('saveAllBtn').addEventListener('click', saveAllAdjustments);
    $('exportExcelBtn').addEventListener('click', exportExcel);

    buildTableForMonth($('monthPicker').value);
  }

  document.addEventListener('firebase-ready', () => {
    wireUI();
  });

})();
