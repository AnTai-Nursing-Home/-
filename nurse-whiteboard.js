/* nurse-whiteboard.js
 * 護理師系統：電子白板
 * - Firestore doc: nurse_whiteboards/{YYYY-MM-DD}
 * - 住民抓取：residents（用 bedNumber 查）
 * - 探視抓取：bookings（date==YYYY-MM-DD 且 time in 14:30..16:30）
 */

(() => {
  const BOARD_COL = 'nurse_whiteboards';
  const RESIDENTS_COL = 'residents';
  const BOOKINGS_COL = 'bookings';

  const $ = (id) => document.getElementById(id);

  const els = {
    boardRoot: $('boardRoot'),
    boardDate: $('boardDate'),
    btnToday: $('btnToday'),
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

    preDate: $('preDate'),
    preBed: $('preBed'),
    preName: $('preName'),
    btnAddPre: $('btnAddPre'),
    preList: $('preList'),

    fromBed: $('fromBed'),
    toBed: $('toBed'),
    residentByBed: $('residentByBed'),
    btnAddMove: $('btnAddMove'),
    moveList: $('moveList'),

    btnAutoVisits: $('btnAutoVisits'),
    visit1430: $('visit1430'),
    visit1500: $('visit1500'),
    visit1530: $('visit1530'),
    visit1600: $('visit1600'),
    visit1630: $('visit1630'),

    isoDate: $('isoDate'),
    isoBed: $('isoBed'),
    isoToBed: $('isoToBed'),
    isoName: $('isoName'),
    btnAddIso: $('btnAddIso'),
    isoList: $('isoList'),
  };

  let db = null;

  let boardDate = null; // YYYY-MM-DD
  let boardData = null; // loaded doc
  let isReadonly = false;

  const pad2 = (n) => String(n).padStart(2, '0');

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${y}-${m}-${dd}`;
  }

  function dayOfWeekZH(d) {
    const map = ['日','一','二','三','四','五','六'];
    return map[d.getDay()];
  }

  function formatDateZH(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}/${d}(${dayOfWeekZH(dt)})`;
  }

  function maskName(name) {
    const s = (name || '').trim();
    if (!s) return '';
    const arr = Array.from(s);
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + '0';
    const mid = Math.floor(arr.length / 2);
    arr[mid] = '0';
    return arr.join('');
  }

  function wxFromValue(v) {
    const map = {
      sunny: { e:'☀️', t:'晴' },
      cloudy:{ e:'⛅', t:'多雲' },
      rain:  { e:'🌧️', t:'雨' },
      thunder:{ e:'⛈️', t:'雷雨' },
      wind:  { e:'💨', t:'風' },
      fog:   { e:'🌫️', t:'霧' },
    };
    return map[v] || map.sunny;
  }

  function setReadonly(on) {
    isReadonly = !!on;
    if (isReadonly) els.boardRoot.classList.add('readonly');
    else els.boardRoot.classList.remove('readonly');
  }

  function hint(text) {
    if (els.saveHint) els.saveHint.textContent = text || '—';
  }

  function pill(text, onRemove) {
    const div = document.createElement('div');
    div.className = 'pill';
    div.innerHTML = `<span>${text}</span><span class="x">×</span>`;
    div.querySelector('.x').addEventListener('click', () => onRemove && onRemove());
    return div;
  }

  function safeEl(id){ return document.getElementById(id); }

  function renderPills(container, items, formatter, onRemoveAt) {
    container.innerHTML = '';
    (items || []).forEach((it, idx) => {
      const txt = formatter(it);
      container.appendChild(pill(txt, () => onRemoveAt(idx)));
    });
  }

  function docRef() {
    return db.collection(BOARD_COL).doc(boardDate);
  }

  async function loadBoard(dateISO) {
    boardDate = dateISO;
    els.boardDate.value = boardDate;
    els.wbDateText.textContent = formatDateZH(boardDate);

    hint('讀取中...');
    const snap = await docRef().get();
    boardData = snap.exists ? (snap.data() || {}) : {};

    boardData.morningText ||= '';
    boardData.noonText ||= '';
    boardData.notesText ||= '';
    boardData.preAdmits ||= [];
    boardData.bedMoves ||= [];
    boardData.deIsos ||= [];
    boardData.visits ||= { '14:30':'', '15:00':'', '15:30':'', '16:00':'', '16:30':'' };

    applyToUI();
    hint(snap.exists ? '已讀取' : '新白板（尚未儲存）');
  }

  function applyToUI() {
    els.wbWxEmoji.textContent = wx.e;
    els.wbWxText.textContent = wx.t;


    els.morningText.value = boardData.morningText || '';
    els.noonText.value = boardData.noonText || '';
    els.notesText.value = boardData.notesText || '';

    const v = boardData.visits || {};
    els.visit1430.value = v['14:30'] || '';
    els.visit1500.value = v['15:00'] || '';
    els.visit1530.value = v['15:30'] || '';
    els.visit1600.value = v['16:00'] || '';
    els.visit1630.value = v['16:30'] || '';

    renderPills(els.preList, boardData.preAdmits, (it) => {
      const d = it.date ? `${it.date.replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')}`.trim();
    const _m_preList = safeEl('preListModal');
    if (_m_preList) {
renderPills(_m_preList, boardData.preAdmits, (it) => {
      const d = it.date ? `${it.date.replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')}`.trim();
    }
    }, (idx) => { if (isReadonly) return; boardData.preAdmits.splice(idx,1); applyToUI(); hint('已修改，請儲存'); });

    renderPills(els.moveList, boardData.bedMoves, (it) => {
      return `${it.fromBed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    const _m_moveList = safeEl('moveListModal');
    if (_m_moveList) {
renderPills(_m_moveList, boardData.bedMoves, (it) => {
      return `${it.fromBed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    }
    }, (idx) => { if (isReadonly) return; boardData.bedMoves.splice(idx,1); applyToUI(); hint('已修改，請儲存'); });

    renderPills(els.isoList, boardData.deIsos, (it) => {
      const d = it.date ? `${it.date.replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    const _m_isoList = safeEl('isoListModal');
    if (_m_isoList) {
renderPills(_m_isoList, boardData.deIsos, (it) => {
      const d = it.date ? `${it.date.replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    }
    }, (idx) => { if (isReadonly) return; boardData.deIsos.splice(idx,1); applyToUI(); hint('已修改，請儲存'); });
  }

  function collectFromUI() {

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

  async function saveBoard() {
    if (isReadonly) return;
    collectFromUI();

    const payload = {
      ...boardData,
      boardDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: (sessionStorage.getItem('staffId') || localStorage.getItem('staffId') || ''),
    };

    hint('儲存中...');
    await docRef().set(payload, { merge: true });
    hint('已儲存');
  }

  async function loadResidentsByBed(bed) {
    if (!bed) {
      els.residentByBed.innerHTML = `<option value="">（先輸入原床，載入住民）</option>`;
      return;
    }
    els.residentByBed.innerHTML = `<option value="">載入中...</option>`;
    try {
      const snap = await db.collection(RESIDENTS_COL).where('bedNumber','==', bed).get();
      if (snap.empty) {
        els.residentByBed.innerHTML = `<option value="">找不到此床住民</option>`;
        return;
      }
      const opts = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        opts.push({ id: doc.id, name: d.residentName || '', bed: d.bedNumber || bed });
      });
      els.residentByBed.innerHTML = `<option value="">選擇住民（將自動遮罩顯示）</option>` + opts.map(o =>
        `<option value="${o.id}" data-name="${encodeURIComponent(o.name)}" data-bed="${encodeURIComponent(o.bed)}">${o.bed}｜${maskName(o.name)}</option>`
      ).join('');
    } catch (e) {
      console.error(e);
      els.residentByBed.innerHTML = `<option value="">載入失敗</option>`;
    }
  }

  const VISIT_SLOTS = ['14:30','15:00','15:30','16:00','16:30'];

  async function autoFillVisitsFromBookings() {
    if (isReadonly) return;
    if (!boardDate) return;

    hint('載入探視中...');
    try {
      const snap = await db.collection(BOOKINGS_COL).where('date','==', boardDate).get();

      const grouped = {};
      VISIT_SLOTS.forEach(t => grouped[t] = []);

      snap.forEach(doc => {
        const d = doc.data() || {};
        const t = (d.time || '').trim();
        if (!VISIT_SLOTS.includes(t)) return;

        const bed = (d.bedNumber || '').trim();
        const rn = maskName(d.residentName || '');
        const rel = (d.visitorRelationship || '').trim();
        const line = [bed, rn, rel].filter(Boolean).join(' ');
        grouped[t].push(line);
      });

      boardData.visits ||= {};
      VISIT_SLOTS.forEach(t => {
        boardData.visits[t] = grouped[t].join('\n');
      });

      applyToUI();
      hint('已帶入探視（請記得儲存）');
    } catch (e) {
      console.error(e);
      hint('探視載入失敗');
      alert('探視資料載入失敗，請稍後再試');
    }
  }

  function bindEvents() {
    setInterval(() => {
      const d = new Date();
      els.wbTimeText.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }, 1000);

    const d = new Date();
    els.wbTimeText.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    els.btnToday.addEventListener('click', () => loadBoard(todayISO()));

    els.boardDate.addEventListener('change', () => {
      const v = els.boardDate.value;
      if (v) loadBoard(v);
    });

      els.wbWxEmoji.textContent = wx.e;
      els.wbWxText.textContent = wx.t;
      hint('已修改，請儲存');
    });
      els.wbTemp.textContent = v ? `${v}℃` : '—';
      hint('已修改，請儲存');
    });

    els.btnSave.addEventListener('click', () => saveBoard());

    els.btnFullscreen.addEventListener('click', async () => {
      if (!document.fullscreenElement) {
        await els.boardRoot.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      setReadonly(!!document.fullscreenElement);
      els.btnFullscreen.textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕';
      hint(document.fullscreenElement ? '全螢幕只讀' : '可編輯（別忘儲存）');
    });

    els.btnAddPre.addEventListener('click', () => {
      if (isReadonly) return;
      const date = els.preDate.value || '';
      const bed = (els.preBed.value || '').trim();
      const name = (els.preName.value || '').trim();
      if (!bed || !name) { alert('預入住：請填床號與姓名'); return; }
      boardData.preAdmits.push({ date, bed, name });
      els.preName.value = '';
      hint('已修改，請儲存');
      applyToUI();
    });

    els.fromBed.addEventListener('input', () => {
      const bed = (els.fromBed.value || '').trim();
      if (bed.length >= 2) loadResidentsByBed(bed);
      else loadResidentsByBed('');
    });

    els.btnAddMove.addEventListener('click', () => {
      if (isReadonly) return;
      const fromBed = (els.fromBed.value || '').trim();
      const toBed = (els.toBed.value || '').trim();
      if (!fromBed || !toBed) { alert('待轉床：請填原床與目標床'); return; }

      let name = '';
      const sel = els.residentByBed;
      const opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) {
        name = decodeURIComponent(opt.getAttribute('data-name') || '');
      }
      if (!name) {
        alert('待轉床：請先從下拉選擇住民（依原床帶入）');
        return;
      }
      boardData.bedMoves.push({ fromBed, toBed, name });
      hint('已修改，請儲存');
      applyToUI();
    });

    els.btnAddIso.addEventListener('click', () => {
      if (isReadonly) return;
      const date = els.isoDate.value || '';
      const bed = (els.isoBed.value || '').trim();
      const toBed = (els.isoToBed.value || '').trim();
      const name = (els.isoName.value || '').trim();
      if (!date || !bed || !toBed || !name) { alert('預解隔：請填日期/床號/預到床/姓名'); return; }
      boardData.deIsos.push({ date, bed, toBed, name });
      els.isoName.value = '';
      hint('已修改，請儲存');
      applyToUI();
    });

    els.btnAutoVisits.addEventListener('click', () => autoFillVisitsFromBookings());

    [els.morningText, els.noonText, els.notesText,
     els.visit1430, els.visit1500, els.visit1530, els.visit1600, els.visit1630
    ].forEach(t => {
      t.addEventListener('input', () => { if (!isReadonly) hint('已修改，請儲存'); });
    });
  }

  document.addEventListener('firebase-ready', async () => {
    try {
      db = firebase.firestore();

      els.boardDate.value = todayISO();
      els.wbDateText.textContent = formatDateZH(els.boardDate.value);

      bindEvents();
      await loadBoard(todayISO());
      setReadonly(false);
    } catch (e) {
      console.error(e);
      alert('電子白板初始化失敗，請確認 firebase-init.js 與 Firestore 權限');
    }
  });
})();
