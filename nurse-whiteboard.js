/* nurse-whiteboard.v5.3.js
 * 護理師系統：電子白板（修正語法錯誤、移除手動天氣、設定改彈窗）
 * - Firestore doc: nurse_whiteboards/{YYYY-MM-DD}
 * - residents：用 bedNumber 查住民（供待轉床選擇）
 * - bookings：date==YYYY-MM-DD 且 time in 14:30..16:30（自動帶入探視）
 */
(() => {
  const BOARD_COL = 'nurse_whiteboards';
  const CURRENT_DOC_ID = 'current';
  const RESIDENTS_COL = 'residents';
  const BOOKINGS_COL = 'bookings';

  const BEISHI_LAT = 22.506545;
  const BEISHI_LON = 120.50190; // 北勢村中正路附近（以 840 號周邊為基準）
  const WEATHER_REFRESH_MS = 5 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const safeEl = (id) => document.getElementById(id);

  const els = {
    boardRoot: $('boardRoot'),
    boardDate: $('boardDate'),
    btnToday: $('btnToday'),
    btnSettings: $('btnSettings'),
    btnSave: $('btnSave'),
    btnFullscreen: $('btnFullscreen'),
    saveHint: $('saveHint'),

    wbDateText: $('wbDateText'),
    wbTimeText: $('wbTimeText'),
    wbWxEmoji: $('wbWxEmoji'),
    wbWxText: $('wbWxText'),
    wbTemp: $('wbTemp'),
    wbRain: $('wbRain'),
    wbHiLo: $('wbHiLo'),

    morningText: $('morningText'),
    noonText: $('noonText'),
    notesText: $('notesText'),

    // Lists on main board
    preList: $('preList'),
    moveList: $('moveList'),
    isoList: $('isoList'),

    // Visits
    btnAutoVisits: $('btnAutoVisits'),
    visit1430: $('visit1430'),
    visit1500: $('visit1500'),
    visit1530: $('visit1530'),
    visit1600: $('visit1600'),
    visit1630: $('visit1630'),

    // Open modal buttons
    btnOpenPre: $('btnOpenPre'),
    btnOpenMove: $('btnOpenMove'),
    btnOpenIso: $('btnOpenIso'),

    // Modal inputs
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
  let bsModal = null;

  const VISIT_SLOTS = ['14:30','15:00','15:30','16:00','16:30'];


// ===== v4.9 Night mode (20:00-06:00) =====
let nightModeTimer = null;

function applyNightMode() {
  const h = new Date().getHours();
  const isNight = (h >= 20 || h < 6);
  const before = document.body.classList.contains('night-mode');
  document.body.classList.toggle('night-mode', isNight);

  // add a short-lived class so browsers reliably animate the switch
  if (before !== isNight) {
    document.body.classList.add('theme-transition');
    clearTimeout(document.body.__wbThemeT);
    document.body.__wbThemeT = setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 900);
  }
}

function startNightModeWatcher() {
  if (nightModeTimer) clearInterval(nightModeTimer);
  applyNightMode();
  nightModeTimer = setInterval(applyNightMode, 5 * 1000);
  window.addEventListener('focus', applyNightMode);
  document.addEventListener('visibilitychange', applyNightMode);
}


// ===== v4.8+ Info cards language toggle (Fullscreen only) =====
let currentInfoLang = 'zh'; // 'zh' or 'en'
let infoLangTimer = null;
let lastWeatherCode = null;

const INFO_LABELS = {
  zh: { date: '日期', time: '時間', weather: '天氣', temp: '溫度', rain: '降雨機率', hilo: '最高/最低' },
  en: { date: 'Date', time: 'Time', weather: 'Weather', temp: 'Temp', rain: 'Rain %', hilo: 'High / Low' },
};

const WX_ZH_TO_EN = {
  '晴': 'Clear',
  '多雲': 'Partly cloudy',
  '霧': 'Fog',
  '毛毛雨': 'Drizzle',
  '雨': 'Rain',
  '陣雨': 'Showers',
  '雪': 'Snow',
  '雷雨': 'Thunderstorm',
  '天氣': 'Weather',
};

function getInfoLabelElByValueId(valueId) {
  const v = safeEl(valueId);
  if (!v) return null;
  const card = v.closest ? v.closest('.info-card') : null;
  if (!card) return null;
  return card.querySelector('.info-label');
}

function getWeatherTextByCode(code, lang) {
  const zh = weatherFromCode(code).t;
  if (lang === 'en') return WX_ZH_TO_EN[zh] || 'Weather';
  return zh;
}

// this function is referenced by init flow; must exist
function applyInfoLang(lang) {
  currentInfoLang = (lang === 'en') ? 'en' : 'zh';

  // labels
  const lz = INFO_LABELS[currentInfoLang];
  const dLab = getInfoLabelElByValueId('wbDateText');
  const tLab = getInfoLabelElByValueId('wbTimeText');
  const wLab = getInfoLabelElByValueId('wbWxText');
  const tempLab = getInfoLabelElByValueId('wbTemp');
  const rainLab = getInfoLabelElByValueId('wbRain');
  const hiloLab = getInfoLabelElByValueId('wbHiLo');
  if (dLab) dLab.textContent = lz.date;
  if (tLab) tLab.textContent = lz.time;
  if (wLab) wLab.textContent = lz.weather;
  if (tempLab) tempLab.textContent = lz.temp;
  if (rainLab) rainLab.textContent = lz.rain;
  if (hiloLab) hiloLab.textContent = lz.hilo;

  // weather text
  const wxTextEl = safeEl('wbWxText');
  if (wxTextEl) {
    if (lastWeatherCode !== null && lastWeatherCode !== undefined && lastWeatherCode !== '') {
      wxTextEl.textContent = getWeatherTextByCode(lastWeatherCode, currentInfoLang);
    } else {
      // best effort translate existing
      const cur = (wxTextEl.textContent || '').trim();
      wxTextEl.textContent = (currentInfoLang === 'en') ? (WX_ZH_TO_EN[cur] || cur || 'Weather') : cur;
    }
  }
}

function startInfoLangTicker() {
  stopInfoLangTicker();
  if (!document.fullscreenElement) return;
  applyInfoLang('zh');
  infoLangTimer = setInterval(() => {
    currentInfoLang = (currentInfoLang === 'zh') ? 'en' : 'zh';
    applyInfoLang(currentInfoLang);
  }, 10000);
}

function stopInfoLangTicker() {
  if (infoLangTimer) clearInterval(infoLangTimer);
  infoLangTimer = null;
  currentInfoLang = 'zh';
  applyInfoLang('zh');
}

  const pad2 = (n) => String(n).padStart(2, '0');

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

  // Keep the date info-card updated daily (data still saves to a single 'current' doc)
  let dateRolloverTimer = null;
  function startDateRolloverWatcher() {
    if (dateRolloverTimer) clearInterval(dateRolloverTimer);
    dateRolloverTimer = setInterval(() => {
      const nowISO = todayISO();
      if (nowISO !== boardDate) {
        boardDate = nowISO;
        if (els.boardDate) els.boardDate.value = boardDate;
        if (els.wbDateText) els.wbDateText.textContent = formatDateZH(boardDate);
      }
    }, 10 * 1000);
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
    const x = div.querySelector('.x');
    x.addEventListener('click', () => onRemove && onRemove());
    return div;
  }

  function renderPills(container, items, formatter, onRemoveAt) {
    if (!container) return;
    container.innerHTML = '';
    (items || []).forEach((it, idx) => {
      const txt = formatter(it);
      container.appendChild(pill(txt, () => onRemoveAt && onRemoveAt(idx)));
    });
  }

  function renderAllPills() {
    // 預入住
    const fmtPre = (it) => {
      const d = it.date ? `${String(it.date).replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')}`.trim();
    };
    const rmPre = (idx) => {
      if (isReadonly) return;
      boardData.preAdmits.splice(idx, 1);
      applyToUI();
      hint('已修改，請儲存');
    };
    renderPills(els.preList, boardData.preAdmits, fmtPre, rmPre);
    renderPills(els.preListModal, boardData.preAdmits, fmtPre, rmPre);

    // 待轉床
    const fmtMove = (it) => `${it.fromBed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    const rmMove = (idx) => {
      if (isReadonly) return;
      boardData.bedMoves.splice(idx, 1);
      applyToUI();
      hint('已修改，請儲存');
    };
    renderPills(els.moveList, boardData.bedMoves, fmtMove, rmMove);
    renderPills(els.moveListModal, boardData.bedMoves, fmtMove, rmMove);

    // 預解隔
    const fmtIso = (it) => {
      const d = it.date ? `${String(it.date).replace(/^\d{4}-/,'')}` : '';
      return `${d} ${it.bed || ''} ${maskName(it.name || '')} ⮕ ${it.toBed || ''}`.trim();
    };
    const rmIso = (idx) => {
      if (isReadonly) return;
      boardData.deIsos.splice(idx, 1);
      applyToUI();
      hint('已修改，請儲存');
    };
    renderPills(els.isoList, boardData.deIsos, fmtIso, rmIso);
    renderPills(els.isoListModal, boardData.deIsos, fmtIso, rmIso);
  }

  function docRef() {
    return db.collection(BOARD_COL).doc(CURRENT_DOC_ID);
  }

  async function loadBoard(dateISO) {
    boardDate = dateISO;
    if (els.boardDate) els.boardDate.value = boardDate;
    if (els.wbDateText) els.wbDateText.textContent = formatDateZH(boardDate);

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
    if (!boardData) return;

    els.morningText.value = boardData.morningText || '';
    els.noonText.value = boardData.noonText || '';
    els.notesText.value = boardData.notesText || '';

    const v = boardData.visits || {};
    els.visit1430.value = v['14:30'] || '';
    els.visit1500.value = v['15:00'] || '';
    els.visit1530.value = v['15:30'] || '';
    els.visit1600.value = v['16:00'] || '';
    els.visit1630.value = v['16:30'] || '';

    renderAllPills();
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

  function weatherFromCode(code) {
    // Open-Meteo weather_code mapping (簡化)
    // 0 clear, 1/2/3 partly cloudy, 45/48 fog, 51/53/55 drizzle, 61/63/65 rain, 71/73/75 snow,
    // 80/81/82 rain showers, 95 thunderstorm, 96/99 hail
    const c = Number(code);
    if (c === 0) return { e:'☀️', t:'晴' };
    if ([1,2,3].includes(c)) return { e:'⛅', t:'多雲' };
    if ([45,48].includes(c)) return { e:'🌫️', t:'霧' };
    if ([51,53,55].includes(c)) return { e:'🌦️', t:'毛毛雨' };
    if ([61,63,65].includes(c)) return { e:'🌧️', t:'雨' };
    if ([80,81,82].includes(c)) return { e:'🌧️', t:'陣雨' };
    if ([71,73,75].includes(c)) return { e:'🌨️', t:'雪' };
    if (c === 95) return { e:'⛈️', t:'雷雨' };
    if ([96,99].includes(c)) return { e:'⛈️', t:'雷雨' };
    return { e:'⛅', t:'天氣' };
  }

  async function fetchAndApplyWeather() {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${BEISHI_LAT}&longitude=${BEISHI_LON}` +
        `&current=temperature_2m,weather_code` +
        `&hourly=precipitation_probability` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&forecast_days=1&timezone=Asia%2FTaipei`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      const temp = data && data.current ? data.current.temperature_2m : null;
      const code = data && data.current ? data.current.weather_code : null;

      lastWeatherCode = code;

      // rain probability (current hour, fallback to daily max if needed)
      let rainProb = null;
      try {
        const curTime = data && data.current && data.current.time ? String(data.current.time) : null;
        const h = data && data.hourly ? data.hourly : null;
        if (curTime && h && Array.isArray(h.time) && Array.isArray(h.precipitation_probability)) {
          let idx = h.time.indexOf(curTime);
          if (idx < 0) {
            // best effort: choose nearest hour
            const curTs = Date.parse(curTime);
            if (!Number.isNaN(curTs)) {
              let bestI = -1, bestD = Infinity;
              for (let i = 0; i < h.time.length; i++) {
                const ts = Date.parse(h.time[i]);
                if (Number.isNaN(ts)) continue;
                const d = Math.abs(ts - curTs);
                if (d < bestD) { bestD = d; bestI = i; }
              }
              idx = bestI;
            }
          }
          if (idx >= 0) {
            const v = h.precipitation_probability[idx];
            if (v !== null && v !== undefined && v !== '') rainProb = Number(v);
          }
        }
        if ((rainProb === null || Number.isNaN(rainProb)) && data && data.daily && Array.isArray(data.daily.precipitation_probability_max)) {
          const v = data.daily.precipitation_probability_max[0];
          if (v !== null && v !== undefined && v !== '') rainProb = Number(v);
        }
      } catch (_) {}

      // daily high/low
      let hi = null, lo = null;
      try {
        const dly = data && data.daily ? data.daily : null;
        if (dly && Array.isArray(dly.temperature_2m_max) && Array.isArray(dly.temperature_2m_min)) {
          hi = dly.temperature_2m_max[0];
          lo = dly.temperature_2m_min[0];
        }
      } catch (_) {}

      // apply rain + hi/lo to UI
      if (els.wbRain) {
        if (rainProb !== null && !Number.isNaN(rainProb)) {
          const rp = Math.round(rainProb);
          els.wbRain.textContent = `${rp}%`;
          const rIcon = safeEl('wbRainIcon');
          if (rIcon) rIcon.textContent = (rp >= 60) ? '🌧️' : (rp >= 30 ? '☔' : '🌂');
        } else {
          els.wbRain.textContent = '—';
          const rIcon = safeEl('wbRainIcon');
          if (rIcon) rIcon.textContent = '☔';
        }
      }

      if (els.wbHiLo) {
        const hival = (hi !== null && hi !== undefined && hi !== '') ? Math.round(Number(hi)) : null;
        const loval = (lo !== null && lo !== undefined && lo !== '') ? Math.round(Number(lo)) : null;
        if (hival !== null && !Number.isNaN(hival) && loval !== null && !Number.isNaN(loval)) {
          els.wbHiLo.textContent = `${hival} / ${loval}℃`;
        } else {
          els.wbHiLo.textContent = '—';
        }
      }


      const wx = weatherFromCode(code);
      els.wbWxEmoji.textContent = wx.e;
      els.wbWxText.textContent = getWeatherTextByCode(code, currentInfoLang);

      if (temp !== null && temp !== undefined && temp !== '') {
        const t = Math.round(Number(temp));
        els.wbTemp.textContent = `${t}℃`;
        const iconEl = safeEl('wbTempIcon');
        if (iconEl) iconEl.textContent = (t >= 25) ? '🌡️🔥' : '🌡️❄️';
      } else {
        els.wbTemp.textContent = '—';
        const iconEl = safeEl('wbTempIcon');
        if (iconEl) iconEl.textContent = '🌡️';
      }
    } catch (e) {
      // 失敗就保持現有顯示
      console.warn('[whiteboard] weather fetch failed', e);
    }
  }

  async function loadResidentsByBed(bed) {
    if (!els.residentByBed) return;
    const b = (bed || '').trim();
    if (!b) {
      els.residentByBed.innerHTML = `<option value="">（先輸入原床，載入住民）</option>`;
      return;
    }
    els.residentByBed.innerHTML = `<option value="">載入中...</option>`;
    try {
      const snap = await db.collection(RESIDENTS_COL).where('bedNumber','==', b).get();
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
          return `<option value="${o.id}" data-name="${encodeURIComponent(o.name)}" data-bed="${encodeURIComponent(o.bed)}">${o.bed}｜${maskName(o.name)}</option>`;
        }).join('');
    } catch (e) {
      console.error(e);
      els.residentByBed.innerHTML = `<option value="">載入失敗</option>`;
    }
  }

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
        const t = String(d.time || '').trim();
        if (!VISIT_SLOTS.includes(t)) return;

        const bed = String(d.bedNumber || '').trim();
        const rn = maskName(d.residentName || '');
        const rel = String(d.visitorRelationship || '').trim();
        const line = [bed, rn, rel].filter(Boolean).join(' ');
        grouped[t].push(line);
      });

      boardData.visits ||= {};
      VISIT_SLOTS.forEach(t => { boardData.visits[t] = grouped[t].join('\n'); });

      applyToUI();
      hint('已帶入探視（請記得儲存）');
    } catch (e) {
      console.error(e);
      hint('探視載入失敗');
      alert('探視資料載入失敗，請稍後再試');
    }
  }

  function ensureModal() {
    const modalEl = safeEl('settingsModal');
    if (!modalEl) return null;
    if (bsModal) return bsModal;
    if (!window.bootstrap || !window.bootstrap.Modal) {
      console.warn('[whiteboard] bootstrap Modal not ready');
      return null;
    }
    bsModal = new window.bootstrap.Modal(modalEl);
    return bsModal;
  }

  function openSettings(tabId) {
    const m = ensureModal();
    if (!m) return;
    m.show();
    if (tabId) {
      const btn = safeEl(tabId);
      if (btn) btn.click();
    }
  }

  function bindEvents() {
    // time ticker
    const tick = () => {
      const d = new Date();
      if (els.wbTimeText) els.wbTimeText.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);

    // date controls
    els.btnToday.addEventListener('click', () => loadBoard(todayISO()));
    els.boardDate.addEventListener('change', () => {
      const v = els.boardDate.value;
      if (v) loadBoard(v);
    });

    // save
    els.btnSave.addEventListener('click', () => saveBoard());

    // fullscreen read-only
    els.btnFullscreen.addEventListener('click', async () => {
      if (!document.fullscreenElement) await els.boardRoot.requestFullscreen();
      else await document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      // v4.8: fullscreen info cards language toggle
      if (document.fullscreenElement) startInfoLangTicker();
      else stopInfoLangTicker();
      setReadonly(!!document.fullscreenElement);
      els.btnFullscreen.textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕';
      hint(document.fullscreenElement ? '全螢幕只讀' : '可編輯（別忘儲存）');
    });

    // settings buttons
    if (els.btnSettings) els.btnSettings.addEventListener('click', () => openSettings('tab-pre'));
    const btnLowerSettings = safeEl('btnLowerSettings');
    if (btnLowerSettings) btnLowerSettings.addEventListener('click', () => openSettings('tab-pre'));

    // modal add: pre-admit
    if (els.btnAddPre) {
      els.btnAddPre.addEventListener('click', () => {
        const date = els.preDate.value || '';
        const bed = (els.preBed.value || '').trim();
        const name = (els.preName.value || '').trim();
        if (!bed || !name) { alert('預入住：請填床號與姓名'); return; }
        boardData.preAdmits.push({ date, bed, name });
        els.preName.value = '';
        hint('已修改，請儲存');
        applyToUI();
      });
    }

    // modal: load residents by bed
    if (els.fromBed) {
      const onBedChange = () => {
        const bed = (els.fromBed.value || '').trim();
        if (bed.length >= 1) loadResidentsByBed(bed);
        else loadResidentsByBed('');
      };
      els.fromBed.addEventListener('input', onBedChange);
      els.fromBed.addEventListener('change', onBedChange);
    }

    // modal add: move
    if (els.btnAddMove) {
      els.btnAddMove.addEventListener('click', () => {
        const fromBed = (els.fromBed.value || '').trim();
        const toBed = (els.toBed.value || '').trim();
        if (!fromBed || !toBed) { alert('待轉床：請填原床與目標床'); return; }

        let name = '';
        const sel = els.residentByBed;
        const opt = sel && sel.options ? sel.options[sel.selectedIndex] : null;
        if (opt && opt.value) name = decodeURIComponent(opt.getAttribute('data-name') || '');

        if (!name) { alert('待轉床：請先從下拉選擇住民'); return; }
        boardData.bedMoves.push({ fromBed, toBed, name });
        hint('已修改，請儲存');
        applyToUI();
      });
    }

    // modal add: iso
    if (els.btnAddIso) {
      els.btnAddIso.addEventListener('click', () => {
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
    }

    // visits
    if (els.btnAutoVisits) els.btnAutoVisits.addEventListener('click', () => autoFillVisitsFromBookings());

    // mark dirty on input
    [
      els.morningText, els.noonText, els.notesText,
      els.visit1430, els.visit1500, els.visit1530, els.visit1600, els.visit1630
    ].forEach(t => {
      if (!t) return;
      t.addEventListener('input', () => { if (!isReadonly) hint('已修改，請儲存'); });
    });
  }

  document.addEventListener('firebase-ready', async () => {
    try {
      db = firebase.firestore();

      const initDate = todayISO();
      els.boardDate.value = initDate;
      els.wbDateText.textContent = formatDateZH(initDate);

      bindEvents();
      startNightModeWatcher();
      startDateRolloverWatcher();
      await loadBoard(initDate);
      setReadonly(false);

      // weather
      await fetchAndApplyWeather();
      setInterval(fetchAndApplyWeather, WEATHER_REFRESH_MS);
    } catch (e) {
      console.error(e);
      alert('電子白板初始化失敗，請確認 firebase-init.js 與 Firestore 權限');
    }
  });
})();
