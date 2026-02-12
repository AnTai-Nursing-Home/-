/* nurse-whiteboard.v5.js
 * 乾淨重構版（避免 syntax error）
 * - Firestore: nurse_whiteboards/{YYYY-MM-DD}
 * - residents: 依 bedNumber 查住民（待轉床）
 * - bookings: date==YYYY-MM-DD, time in 14:30..16:30（探視）
 *
 * 重要規則：
 * - 全螢幕只讀（不能修改）
 * - 白板上顯示姓名時，自動遮罩：至少中間 1 個字改成「0」
 */

(() => {
  'use strict';

  const BOARD_COL = 'nurse_whiteboards';
  const RESIDENTS_COL = 'residents';
  const BOOKINGS_COL = 'bookings';

  // 北勢村中正路附近座標（崁頂鄉）
  const BEISHI_LAT = 22.506545;
  const BEISHI_LON = 120.50190;
  const WEATHER_REFRESH_MS = 10 * 60 * 1000;

  const VISIT_SLOTS = ['14:30', '15:00', '15:30', '16:00', '16:30'];

  const $ = (id) => document.getElementById(id);

  const els = {
    boardRoot: $('boardRoot'),
    boardDate: $('boardDate'),
    btnToday: $('btnToday'),
    btnLowerSettings: $('btnLowerSettings'),
    btnSave: $('btnSave'),
    btnFullscreen: $('btnFullscreen'),
    saveHint: $('saveHint'),

    wbDateText: $('wbDateText'),
    wbTimeText: $('wbTimeText'),
    wbWxEmoji: $('wbWxEmoji'),
    wbWxText: $('wbWxText'),
    wbTemp: $('wbTemp'),

    morningText: $('morningText'),
    noonText: $('noonText'),
    notesText: $('notesText'),

    preList: $('preList'),
    moveList: $('moveList'),
    isoList: $('isoList'),

    btnAutoVisits: $('btnAutoVisits'),
    visit1430: $('visit1430'),
    visit1500: $('visit1500'),
    visit1530: $('visit1530'),
    visit1600: $('visit1600'),
    visit1630: $('visit1630'),

    // Modal
    lowerSettingsModal: $('lowerSettingsModal'),

    preDate: $('preDate'),
    preBed: $('preBed'),
    preName: $('preName'),
    btnAddPre: $('btnAddPre'),
    preListModal: $('preListModal'),

    fromBed: $('fromBed'),
    toBed: $('toBed'),
    residentByBed: $('residentByBed'),
    btnAddMove: $('btnAddMove'),
    moveListModal: $('moveListModal'),

    isoDate: $('isoDate'),
    isoBed: $('isoBed'),
    isoToBed: $('isoToBed'),
    isoName: $('isoName'),
    btnAddIso: $('btnAddIso'),
    isoListModal: $('isoListModal'),
  };

  let db = null;
  let boardDate = null; // YYYY-MM-DD
  let boardData = null;
  let isReadonly = false;
  let modal = null;

  const pad2 = (n) => String(n).padStart(2, '0');

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function dayOfWeekZH(d) {
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  }

  function formatDateZH(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}/${d}(${dayOfWeekZH(dt)})`;
  }

  function setHint(text) {
    if (els.saveHint) els.saveHint.textContent = text || '—';
  }

  function setReadonly(on) {
    isReadonly = !!on;
    if (isReadonly) els.boardRoot.classList.add('readonly');
    else els.boardRoot.classList.remove('readonly');
  }

  function maskName(name) {
    const s = String(name || '').trim();
    if (!s) return '';
    const arr = Array.from(s);
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + '0';
    const mid = Math.floor(arr.length / 2);
    arr[mid] = '0';
    return arr.join('');
  }

  function docRef() {
    return db.collection(BOARD_COL).doc(boardDate);
  }

  function ensureDefaults() {
    boardData ||= {};
    boardData.morningText ||= '';
    boardData.noonText ||= '';
    boardData.notesText ||= '';

    boardData.preAdmits ||= []; // {date, bed, name}
    boardData.bedMoves ||= [];  // {fromBed, toBed, name}
    boardData.deIsos ||= [];    // {date, bed, toBed, name}

    boardData.visits ||= {};
    VISIT_SLOTS.forEach(t => { if (boardData.visits[t] === undefined) boardData.visits[t] = ''; });
  }

  function pillNode(text, onRemove) {
    const div = document.createElement('div');
    div.className = 'pill';
    div.innerHTML = `<span class="t"></span><span class="x">×</span>`;
    div.querySelector('.t').textContent = text;
    div.querySelector('.x').addEventListener('click', () => onRemove && onRemove());
    return div;
  }

  function renderPills(container, items, formatter, onRemoveAt) {
    if (!container) return;
    container.innerHTML = '';
    (items || []).forEach((it, idx) => {
      const text = formatter(it);
      container.appendChild(pillNode(text, () => {
        if (isReadonly) return;
        onRemoveAt && onRemoveAt(idx);
      }));
    });
  }

  function applyToUI() {
    if (!boardData) return;
    ensureDefaults();

    // Header date text
    els.wbDateText.textContent = formatDateZH(boardDate);

    // Upper text
    els.morningText.value = boardData.morningText || '';
    els.noonText.value = boardData.noonText || '';
    els.notesText.value = boardData.notesText || '';

    // Visits
    const v = boardData.visits || {};
    els.visit1430.value = v['14:30'] || '';
    els.visit1500.value = v['15:00'] || '';
    els.visit1530.value = v['15:30'] || '';
    els.visit1600.value = v['16:00'] || '';
    els.visit1630.value = v['16:30'] || '';

    // Pills (main + modal)
    const fmtPre = (it) => {
      const d = it.date ? String(it.date).replace(/^\d{4}-/, '') : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')}`.trim();
    };
    const fmtMove = (it) => `${it.fromBed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    const fmtIso = (it) => {
      const d = it.date ? String(it.date).replace(/^\d{4}-/, '') : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    };

    renderPills(els.preList, boardData.preAdmits, fmtPre, (idx) => { boardData.preAdmits.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });
    renderPills(els.moveList, boardData.bedMoves, fmtMove, (idx) => { boardData.bedMoves.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });
    renderPills(els.isoList, boardData.deIsos, fmtIso, (idx) => { boardData.deIsos.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });

    renderPills(els.preListModal, boardData.preAdmits, fmtPre, (idx) => { boardData.preAdmits.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });
    renderPills(els.moveListModal, boardData.bedMoves, fmtMove, (idx) => { boardData.bedMoves.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });
    renderPills(els.isoListModal, boardData.deIsos, fmtIso, (idx) => { boardData.deIsos.splice(idx, 1); applyToUI(); setHint('已修改，請儲存'); });
  }

  function collectFromUI() {
    ensureDefaults();
    boardData.morningText = els.morningText.value || '';
    boardData.noonText = els.noonText.value || '';
    boardData.notesText = els.notesText.value || '';
    boardData.visits = {
      '14:30': els.visit1430.value || '',
      '15:00': els.visit1500.value || '',
      '15:30': els.visit1530.value || '',
      '16:00': els.visit1600.value || '',
      '16:30': els.visit1630.value || '',
    };
  }

  async function loadBoard(dateISO) {
    boardDate = dateISO;
    els.boardDate.value = boardDate;
    els.wbDateText.textContent = formatDateZH(boardDate);

    setHint('讀取中...');
    const snap = await docRef().get();
    boardData = snap.exists ? (snap.data() || {}) : {};
    ensureDefaults();
    applyToUI();
    setHint(snap.exists ? '已讀取' : '新白板（尚未儲存）');
  }

  async function saveBoard() {
    if (isReadonly) return;
    if (!boardData) return;

    collectFromUI();
    setHint('儲存中...');

    const payload = {
      ...boardData,
      boardDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: (sessionStorage.getItem('staffId') || localStorage.getItem('staffId') || ''),
    };

    await docRef().set(payload, { merge: true });
    setHint('已儲存');
  }

  function weatherFromCode(code) {
    const c = Number(code);
    if (c === 0) return { e: '☀️', t: '晴' };
    if ([1, 2, 3].includes(c)) return { e: '⛅', t: '多雲' };
    if ([45, 48].includes(c)) return { e: '🌫️', t: '霧' };
    if ([51, 53, 55].includes(c)) return { e: '🌦️', t: '毛毛雨' };
    if ([61, 63, 65].includes(c)) return { e: '🌧️', t: '雨' };
    if ([80, 81, 82].includes(c)) return { e: '🌧️', t: '陣雨' };
    if ([71, 73, 75].includes(c)) return { e: '🌨️', t: '雪' };
    if (c === 95 || c === 96 || c === 99) return { e: '⛈️', t: '雷雨' };
    return { e: '⛅', t: '天氣' };
  }

  async function fetchAndApplyWeather() {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${BEISHI_LAT}&longitude=${BEISHI_LON}` +
        `&current=temperature_2m,weather_code&timezone=Asia%2FTaipei`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      const temp = data?.current?.temperature_2m;
      const code = data?.current?.weather_code;

      const wx = weatherFromCode(code);
      els.wbWxEmoji.textContent = wx.e;
      els.wbWxText.textContent = wx.t;

      if (temp !== null && temp !== undefined && temp !== '') {
        els.wbTemp.textContent = `${Math.round(Number(temp))}℃`;
      } else {
        els.wbTemp.textContent = '—';
      }
    } catch (e) {
      console.warn('[whiteboard] weather fetch failed', e);
    }
  }

  function startClock() {
    const tick = () => {
      const d = new Date();
      els.wbTimeText.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  async function loadResidentsByBed(bed) {
    const b = String(bed || '').trim();
    if (!b) {
      els.residentByBed.innerHTML = `<option value="">先輸入原床</option>`;
      return;
    }
    els.residentByBed.innerHTML = `<option value="">載入中...</option>`;

    try {
      const snap = await db.collection(RESIDENTS_COL).where('bedNumber', '==', b).get();
      if (snap.empty) {
        els.residentByBed.innerHTML = `<option value="">找不到此床住民</option>`;
        return;
      }
      const opts = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        opts.push({ id: doc.id, name: d.residentName || '', bed: d.bedNumber || b });
      });
      els.residentByBed.innerHTML =
        `<option value="">選擇住民（姓名已遮罩）</option>` +
        opts.map(o => {
          const dn = encodeURIComponent(o.name);
          const dbed = encodeURIComponent(o.bed);
          return `<option value="${o.id}" data-name="${dn}" data-bed="${dbed}">${o.bed}｜${maskName(o.name)}</option>`;
        }).join('');
    } catch (e) {
      console.error(e);
      els.residentByBed.innerHTML = `<option value="">載入失敗</option>`;
    }
  }

  async function autoFillVisitsFromBookings() {
    if (isReadonly) return;
    if (!boardDate) return;
    ensureDefaults();

    setHint('載入探視中...');
    try {
      const snap = await db.collection(BOOKINGS_COL).where('date', '==', boardDate).get();

      const grouped = {};
      VISIT_SLOTS.forEach(t => (grouped[t] = []));

      snap.forEach(doc => {
        const d = doc.data() || {};
        const t = String(d.time || '').trim();
        if (!VISIT_SLOTS.includes(t)) return;

        const bed = String(d.bedNumber || '').trim();
        const rn = maskName(d.residentName || '');
        const rel = String(d.visitorRelationship || '').trim();
        const line = [bed, rn, rel].filter(Boolean).join(' ');
        grouped[t].push(line);
      });

      VISIT_SLOTS.forEach(t => { boardData.visits[t] = grouped[t].join('\n'); });
      applyToUI();
      setHint('已帶入探視（請記得儲存）');
    } catch (e) {
      console.error(e);
      setHint('探視載入失敗');
      alert('探視資料載入失敗，請稍後再試');
    }
  }

  function openLowerSettings() {
    if (!modal) modal = new bootstrap.Modal(els.lowerSettingsModal);
    modal.show();
  }

  function bindEvents() {
    // Date controls
    els.btnToday.addEventListener('click', () => loadBoard(todayISO()));
    els.boardDate.addEventListener('change', () => {
      const v = els.boardDate.value;
      if (v) loadBoard(v);
    });

    // Save
    els.btnSave.addEventListener('click', () => saveBoard());

    // Lower settings modal open
    els.btnLowerSettings.addEventListener('click', () => openLowerSettings());

    // Fullscreen toggle
    els.btnFullscreen.addEventListener('click', async () => {
      if (!document.fullscreenElement) await els.boardRoot.requestFullscreen();
      else await document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      setReadonly(!!document.fullscreenElement);
      els.btnFullscreen.textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕';
      setHint(document.fullscreenElement ? '全螢幕只讀' : '可編輯（別忘儲存）');
    });

    // Dirty hint on input
    [
      els.morningText, els.noonText, els.notesText,
      els.visit1430, els.visit1500, els.visit1530, els.visit1600, els.visit1630,
    ].forEach(el => {
      el.addEventListener('input', () => { if (!isReadonly) setHint('已修改，請儲存'); });
    });

    // Auto visits
    els.btnAutoVisits.addEventListener('click', () => autoFillVisitsFromBookings());

    // Modal add: pre
    els.btnAddPre.addEventListener('click', () => {
      if (isReadonly) return;
      if (!boardData) return;
      ensureDefaults();

      const date = els.preDate.value || '';
      const bed = String(els.preBed.value || '').trim();
      const name = String(els.preName.value || '').trim();
      if (!bed || !name) { alert('預入住：請填床號與姓名'); return; }

      boardData.preAdmits.push({ date, bed, name });
      els.preName.value = '';
      setHint('已修改，請儲存');
      applyToUI();
    });

    // Modal: residents by bed
    const onFromBedChange = () => loadResidentsByBed(els.fromBed.value);
    els.fromBed.addEventListener('input', onFromBedChange);
    els.fromBed.addEventListener('change', onFromBedChange);

    // Modal add: move
    els.btnAddMove.addEventListener('click', () => {
      if (isReadonly) return;
      if (!boardData) return;
      ensureDefaults();

      const fromBed = String(els.fromBed.value || '').trim();
      const toBed = String(els.toBed.value || '').trim();
      if (!fromBed || !toBed) { alert('待轉床：請填原床與目標床'); return; }

      const sel = els.residentByBed;
      const opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) { alert('待轉床：請先選擇住民'); return; }

      const name = decodeURIComponent(opt.getAttribute('data-name') || '');
      if (!name) { alert('待轉床：住民姓名讀取失敗'); return; }

      boardData.bedMoves.push({ fromBed, toBed, name });
      setHint('已修改，請儲存');
      applyToUI();
    });

    // Modal add: iso
    els.btnAddIso.addEventListener('click', () => {
      if (isReadonly) return;
      if (!boardData) return;
      ensureDefaults();

      const date = els.isoDate.value || '';
      const bed = String(els.isoBed.value || '').trim();
      const toBed = String(els.isoToBed.value || '').trim();
      const name = String(els.isoName.value || '').trim();
      if (!date || !bed || !toBed || !name) { alert('預解隔：請填日期/床號/預到床/姓名'); return; }

      boardData.deIsos.push({ date, bed, toBed, name });
      els.isoName.value = '';
      setHint('已修改，請儲存');
      applyToUI();
    });
  }

  // ---- init ----
  document.addEventListener('firebase-ready', async () => {
    try {
      db = firebase.firestore();

      startClock();
      bindEvents();

      // initial date
      await loadBoard(todayISO());

      // weather
      await fetchAndApplyWeather();
      setInterval(fetchAndApplyWeather, WEATHER_REFRESH_MS);
    } catch (e) {
      console.error(e);
      alert('電子白板初始化失敗：請確認 firebase-init.js / Firestore 權限 / 事件 firebase-ready');
    }
  });

})();
