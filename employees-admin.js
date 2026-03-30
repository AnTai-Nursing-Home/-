function buildTableHTML(tabId) {
    const tbodyId = `${tabId}-tbody`;
    const isForeignTab = tabId === 'foreignCaregivers';
    const extraHead = (tabId === 'inactiveEmployees') ? `<th class="sortable-header" data-sort="sourceLabel">職類</th><th class="sortable-header" data-sort="inactiveDate">離職日期</th>` : '';
    return `
      <div class="tab-pane fade${tabId==='nurses'?' show active':''}" id="${tabId}-panel" role="tabpanel">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th class="sortable-header sticky-col-1" data-sort="sortOrder">排序</th>
                <th class="sortable-header sticky-col-2" data-sort="id">員編</th>
                <th class="sortable-header sticky-col-3" data-sort="name">姓名</th>
                ${isForeignTab ? '<th>英文姓名</th>' : ''}
                ${extraHead}
                <th>性別</th>
                <th>生日</th>
                ${isForeignTab ? '<th>身分證字號(ARC)</th><th>承接日期</th><th>續聘日期</th><th>ARC有效期限迄日</th>' : '<th>身分證字號</th>'}
                <th>到職日</th>
                <th>組別</th>
                <th>職稱</th>
                <th>手機</th>
                <th>日間電話</th>
                <th>地址</th>
                <th>緊急聯絡人</th>
                <th>關係</th>
                <th>緊急電話</th>
                ${isForeignTab ? '<th>國籍</th>' : ''}
                <th>證書摘要</th>
                <th>換證日期</th>
                <th>長照證號</th>
                <th>長照證效期</th>
                <th>學歷</th>
                <th>畢業學校</th>
                <th>畢業證書</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="${tbodyId}"></tbody>
          </table>
        </div>
      </div>
    `;
  }


window.addEventListener("load", async () => {
  console.log("頁面載入完成，開始初始化 Firebase");
  
// ====== 分頁表格排版修正 ======
const styleFix = document.createElement('style');
styleFix.textContent = `
  .tab-pane { min-height: 100%; overflow: auto; padding-bottom: 20px; }
  .table-responsive { overflow: auto; }
  .table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; }
  .table td, .table th { vertical-align: middle; }
  .table .sticky-col-1,.table .sticky-col-2,.table .sticky-col-3{position:sticky;z-index:3;background:inherit;}
  .table thead .sticky-col-1,.table thead .sticky-col-2,.table thead .sticky-col-3{z-index:8;}
  .table .sticky-col-1{left:0;min-width:64px;}
  .table .sticky-col-2{left:64px;min-width:104px;}
  .table .sticky-col-3{left:168px;min-width:132px;}
  .btn-cert-summary{min-width:72px;}
`;
document.head.appendChild(styleFix);

// ====== 修正建表邏輯：每個表格放入對應分頁 ======
function buildTableHTMLForPanel(tabId) {
  const panel = document.getElementById(`${tabId}-panel`);
  if (!panel) return;
  const html = buildTableHTML(tabId);
  panel.innerHTML = html;
}


document.addEventListener('firebase-ready', () => {
  // 假設 firebase-init.js 內建立了全域 db = firebase.firestore()
  const tablesWrap = document.getElementById('tables-wrap');
  const addEmployeeBtn = document.getElementById('add-employee-btn');
  const employeeModalEl = document.getElementById('employee-modal');
  const employeeModal = new bootstrap.Modal(employeeModalEl);
  const saveEmployeeBtn = document.getElementById('save-employee-btn');
  const importExcelBtn = document.getElementById('import-excel-btn');
  const exportWordBtn = document.getElementById('export-word-btn');
  const exportExcelBtn = document.getElementById('export-excel-btn');
  const printBtn = document.getElementById('print-btn');
  const excelFileInput = document.getElementById('excel-file-input');
  const importStatus = document.getElementById('import-status');


  // ====================== 登入者（顯示與匯出使用） ======================
  const loginBadgeEl = document.getElementById('loginBadge');

  const CURRENT_USER = { staffId: '', name: '' };

  function setLoginBadge(text) {
    if (!loginBadgeEl) return;
    loginBadgeEl.textContent = text || '登入者：—';
  }


  function getSessionUser() {
    try {
      const candidateKeys = ['antai_session_user', 'officeAuth'];

      for (const key of candidateKeys) {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;

        const u = JSON.parse(raw);
        if (!u) continue;

        const staffId = u.staffId || u.id || u.employeeId || u.empId || '';
        const name = u.displayName || u.name || u.staffName || u.username || '';

        if (!staffId && !name) continue;

        return {
          staffId,
          name,
          sourceKey: key,
          raw: u
        };
      }

      return null;
    } catch (e) {
      console.warn('[employees-admin] getSessionUser failed:', e);
      return null;
    }
  }

  function syncLoginBadgeFromSession() {
    const su = getSessionUser();

    if (!su) {
      CURRENT_USER.staffId = '';
      CURRENT_USER.name = '';
      setLoginBadge('登入者：—');
      return null;
    }

    CURRENT_USER.staffId = su.staffId || '';
    CURRENT_USER.name = su.name || '';

    const label = `登入者：${CURRENT_USER.staffId} ${CURRENT_USER.name}`
      .replace(/\s+/g, ' ')
      .trim();

    setLoginBadge(label || '登入者：—');
    console.log('[employees-admin] login user from session =', su.sourceKey, su);

    return su;
  }

  async function loadCurrentUserForEmployees() {
    const su = syncLoginBadgeFromSession();
    if (su) return CURRENT_USER;

    try {
      if (firebase && typeof firebase.auth === 'function') {
        const auth = firebase.auth();
        const u = auth.currentUser || await new Promise(resolve => {
          const off = auth.onAuthStateChanged(user => {
            off && off();
            resolve(user || null);
          }, () => resolve(null));
          setTimeout(() => resolve(auth.currentUser || null), 1500);
        });
        if (u && u.uid) {
          const acc = await db.collection('userAccounts').doc(u.uid).get();
          if (acc.exists) {
            const d = acc.data() || {};
            CURRENT_USER.staffId = d.staffId || d.id || d.employeeId || '';
            CURRENT_USER.name = d.displayName || d.name || d.staffName || d.username || '';
            const label = `登入者：${CURRENT_USER.staffId} ${CURRENT_USER.name}`
              .replace(/\s+/g, ' ')
              .trim();
            setLoginBadge(label || '登入者：—');
            return CURRENT_USER;
          }
        }
      }
    } catch (e) {
      console.warn('[employees-admin] loadCurrentUserForEmployees fallback failed:', e);
    }

    setLoginBadge('登入者：—');
    return CURRENT_USER;
  }


  function formatExportTime(dt = new Date()) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}`;
  }

  const employeeForm = document.getElementById('employee-form');
  const typeInput = document.getElementById('employee-type');
  const sortOrderInput = document.getElementById('employee-sortOrder');
  const idInput = document.getElementById('employee-id');
  const nameInput = document.getElementById('employee-name');
  const englishNameInput = document.getElementById('employee-englishName');
  const genderInput = document.getElementById('employee-gender');
  const birthdayInput = document.getElementById('employee-birthday');
  const idCardInput = document.getElementById('employee-idCard');
  const arcStartInput = document.getElementById('employee-arcStart');
  const arcExpiryInput = document.getElementById('employee-arcExpiry');
  const renewalDateInput = document.getElementById('employee-renewalDate');
  const hireDateInput = document.getElementById('employee-hireDate');
  const titleInput = document.getElementById('employee-title');
  const groupNoInput = document.getElementById('employee-groupNo');
  const phoneInput = document.getElementById('employee-phone');
  const daytimePhoneInput = document.getElementById('employee-daytimePhone');
  const addressInput = document.getElementById('employee-address');
  const emgNameInput = document.getElementById('employee-emgName');
  const emgRelationInput = document.getElementById('employee-emgRelation');
  const emgPhoneInput = document.getElementById('employee-emgPhone');
  const nationalityInput = document.getElementById('employee-nationality');
  const certificatesListEl = document.getElementById('certificates-list');
  const addCertificateBtn = document.getElementById('add-certificate-btn');
  const certificateFileModalEl = document.getElementById('certificate-file-modal');
  const certificateFileModal = certificateFileModalEl ? new bootstrap.Modal(certificateFileModalEl) : null;
  const certificateFileModalMeta = document.getElementById('certificate-file-modal-meta');
  const certificateFrontFileInput = document.getElementById('certificate-front-file');
  const certificateBackFileInput = document.getElementById('certificate-back-file');
  const certificateFrontLinkWrap = document.getElementById('certificate-front-link-wrap');
  const certificateBackLinkWrap = document.getElementById('certificate-back-link-wrap');
  const certificateSummaryModalEl = document.getElementById('certificate-summary-modal');
  const certificateSummaryModal = certificateSummaryModalEl ? new bootstrap.Modal(certificateSummaryModalEl) : null;
  const certificateSummaryModalMeta = document.getElementById('certificate-summary-modal-meta');
  const certificateSummaryModalList = document.getElementById('certificate-summary-modal-list');
  const graduationCertificateManageBtn = document.getElementById('graduation-certificate-manage-btn');
  const graduationCertificateStatusEl = document.getElementById('graduation-certificate-status');
  const graduationCertificateModalEl = document.getElementById('graduation-certificate-modal');
  const graduationCertificateModal = graduationCertificateModalEl ? new bootstrap.Modal(graduationCertificateModalEl) : null;
  const graduationCertificateModalMeta = document.getElementById('graduation-certificate-modal-meta');
  const graduationCertificateFileInput = document.getElementById('graduation-certificate-file');
  const graduationCertificatePreviewWrap = document.getElementById('graduation-certificate-preview-wrap');
  const licenseTypeInput = null;
  const licenseNumberInput = null;
  const licenseRenewDateInput = document.getElementById('employee-licenseRenewDate');
  const educationInput = document.getElementById('employee-education');
  const schoolInput = document.getElementById('employee-school');
  const inactiveDateInput = document.getElementById('employee-inactiveDate');
  const inactiveWrap = document.getElementById('employee-inactiveDate-wrap');

  let currentEditing = { collection: null, docId: null };
  let sortConfig = { key: 'sortOrder', order: 'asc' };

  const TAB_DEFS = [
    { id: 'nurses', label: '護理師', collection: 'nurses' },
    { id: 'foreignCaregivers', label: '外籍照服員', collection: 'caregivers' },
    { id: 'localCaregivers', label: '台籍照服員', collection: 'localCaregivers' },
    { id: 'adminStaff', label: '行政/其他', collection: 'adminStaff' },
      { id: 'inactiveEmployees', label: '離職員工', collection: null },
  ];

  
  // 建出四個面板
  TAB_DEFS.forEach(d => {
  const html = buildTableHTML(d.id);
  tablesWrap.insertAdjacentHTML('beforeend', html);
});

  // 取得各 tbody & header
  const tbodys = {};
  TAB_DEFS.forEach(d => tbodys[d.id] = document.getElementById(`${d.id}-tbody`));
  const tableHeaders = document.querySelectorAll('.sortable-header');

  syncLoginBadgeFromSession();
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'antai_session_user') syncLoginBadgeFromSession();
  });

  function formatDateInput(v) {
    if (!v) return "";
    v = String(v).replace(/\./g, "/").replace(/-/g, "/");
    const parts = v.split("/");
    if (parts.length === 3) {
      let [y, mm, dd] = parts;
      mm = String(mm).padStart(2, "0");
      dd = String(dd).padStart(2, "0");
      return `${y}/${mm}/${dd}`;
    }
    return v;
  }

  function updateHeaderSortUI() {
    tableHeaders.forEach(h => {
      const sortKey = h.dataset.sort;
      h.classList.remove('sort-asc','sort-desc');
      if (sortKey === sortConfig.key)
        h.classList.add(sortConfig.order === 'asc' ? 'sort-asc' : 'sort-desc');
    });
  }

  
  function getColspan(tabId) {
    if (tabId === 'inactiveEmployees') return 28;
    if (tabId === 'foreignCaregivers') return 27;
    return 24;
  }

  async function loadAndRenderActive(collectionName, tbody, tabId) {
    const colspan = getColspan(tabId);
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中…</td></tr>`;
    try {
      const snap = await db.collection(collectionName)
        .orderBy(sortConfig.key, sortConfig.order)
        .orderBy('id','asc')
        .get();

      // 只顯示在職：isActive === false 視為離職；undefined/true 視為在職
      const rows = [];
      snap.forEach(doc => {
        const e = doc.data() || {};
        if (e.isActive === false) return;
        rows.push({ docId: doc.id, collection: collectionName, sourceLabel: '', ...e });
      });

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">尚無資料</td></tr>`;
        return;
      }

      let html = "";
      rows.forEach(e => {
        html += buildRowHTML(e, { includeSource: false, actionLabel: '設為離職' });
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-danger">讀取失敗</td></tr>`;
    }
  }

  async function loadAndRenderInactive(tbody) {
    const colspan = getColspan('inactiveEmployees');
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">讀取中…</td></tr>`;
    try {
      const rows = [];
      // 合併四個集合的離職員工
      for (const def of TAB_DEFS) {
        if (def.id === 'inactiveEmployees') continue;
        const snap = await db.collection(def.collection)
          .orderBy('id','asc')
          .get();

        snap.forEach(doc => {
          const e = doc.data() || {};
          if (e.isActive !== false) return;
          rows.push({ docId: doc.id, collection: def.collection, sourceLabel: def.label, ...e });
        });
      }

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">尚無資料</td></tr>`;
        return;
      }

      // 依目前 sortConfig 在前端排序
      const k = sortConfig.key;
      const order = sortConfig.order === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = (k === 'sourceLabel') ? (a.sourceLabel || '') : (a[k] ?? '');
        const bv = (k === 'sourceLabel') ? (b.sourceLabel || '') : (b[k] ?? '');
        if (av === bv) return String(a.id ?? '').localeCompare(String(b.id ?? '')) * order;
        // 數字優先比
        const an = Number(av), bn = Number(bv);
        const bothNum = !Number.isNaN(an) && !Number.isNaN(bn);
        return (bothNum ? (an - bn) : String(av).localeCompare(String(bv))) * order;
      });

      let html = "";
      rows.forEach(e => {
        html += buildRowHTML(e, { includeSource: true, actionLabel: '恢復在職' });
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-danger">讀取失敗</td></tr>`;
    }
  }

  
  // 取值容錯：支援舊欄位/新欄位混用（避免表格顯示一堆空白）
  function pick(e, keys, fallback="") {
    for (const k of keys) {
      const v = e?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return fallback;
  }


  const CERTIFICATE_TYPE_OPTIONS = [
    { value: '01:護理師執照', label: '01:護理師執照' },
    { value: '02:護理師證書', label: '02:護理師證書' },
    { value: '03:社工師證書', label: '03:社工師證書' },
    { value: '04:社工師執照', label: '04:社工師執照' },
    { value: '05:BLS', label: '05:BLS' },
    { value: '06:勞動部聘雇許可函', label: '06:勞動部聘雇許可函' },
    { value: '07:長照小卡', label: '07:長照小卡' },
  ];

  const BLS_ORGANIZER_OPTIONS = [
    '安泰醫療社團法人安泰醫院',
    '臺灣急救教育推廣與諮詢中心',
  ];

  let certificateItems = [];
  let activeCertificateIndex = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function isNurseLicenseType(type = '') {
    return String(type || '').trim() === '01:護理師執照';
  }

  function isSocialWorkerLicenseType(type = '') {
    return String(type || '').trim() === '04:社工師執照';
  }

  function isBLSType(type = '') {
    const value = String(type || '').trim().toUpperCase();
    return value === '03:BLS' || value === '04:BLS' || value === '04BLS' || value === '05:BLS' || value === '05BLS' || value === 'BLS';
  }

  function isLongtermCardType(type = '') {
    const value = String(type || '').trim();
    return value === '07:長照小卡' || value === '長照小卡';
  }

  function getCertificateNumberLabel(type = '') {
    if (isBLSType(type)) return '證書字號';
    if (isLongtermCardType(type)) return '長照證號';
    return '發證字號';
  }

  function buildCertificateExtraFields(item = {}) {
    const type = String(item.type || '').trim();
    if (isNurseLicenseType(type) || isSocialWorkerLicenseType(type)) {
      return `
        <div class="col-12 col-md-4">
          <label class="form-label">執照應更新日期</label>
          <input type="text" class="form-control cert-renew-date" placeholder="例：115/06/30 或 2026/06/30" value="${escapeHtml(item.renewDate || '')}">
        </div>
      `;
    }
    if (isBLSType(type)) {
      const organizerOptions = ['<option value="">請選擇</option>']
        .concat(BLS_ORGANIZER_OPTIONS.map(opt => `<option value="${escapeHtml(opt)}" ${String(item.organizer || '').trim() === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`))
        .join('');
      return `
        <div class="col-12 col-md-4">
          <label class="form-label">主辦單位</label>
          <select class="form-select cert-organizer">${organizerOptions}</select>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">有效日期</label>
          <input type="text" class="form-control cert-valid-date" placeholder="例：115/06/30 或 2026/06/30" value="${escapeHtml(item.validDate || '')}">
        </div>
      `;
    }
    if (isLongtermCardType(type)) {
      return `
        <div class="col-12 col-md-4">
          <label class="form-label">長照證效期</label>
          <input type="text" class="form-control cert-longterm-expire-date" placeholder="例：109/10/23-115/10/22" value="${escapeHtml(item.longtermExpireDate || item.validDate || '')}">
        </div>
      `;
    }
    return '';
  }

  function normalizeCertificatesFromEmployee(e = {}) {
    const fromArray = Array.isArray(e.certificates) ? e.certificates.filter(Boolean).map(item => ({
      type: String(item.type || '').trim(),
      number: String(item.number || '').trim(),
      renewDate: String(item.renewDate || item.licenseRenewDate || '').trim(),
      organizer: String(item.organizer || item.hostOrg || '').trim(),
      validDate: String(item.validDate || item.expireDate || '').trim(),
      longtermExpireDate: String(item.longtermExpireDate || item.longtermExpiry || item.ltcExpiry || '').trim(),
      frontUrl: String(item.frontUrl || '').trim(),
      frontName: String(item.frontName || '').trim(),
      frontPath: String(item.frontPath || '').trim(),
      frontContentType: String(item.frontContentType || '').trim(),
      frontSize: Number(item.frontSize || 0) || 0,
      backUrl: String(item.backUrl || '').trim(),
      backName: String(item.backName || '').trim(),
      backPath: String(item.backPath || '').trim(),
      backContentType: String(item.backContentType || '').trim(),
      backSize: Number(item.backSize || 0) || 0,
    })) : [];

    if (fromArray.length) {
      const hasLongterm = fromArray.some(item => isLongtermCardType(item.type));
      if (!hasLongterm && (String(e.longtermCertNumber || e.ltcNo || '').trim() || String(e.longtermExpireDate || e.ltcExpiry || '').trim())) {
        fromArray.push({
          type: '07:長照小卡',
          number: String(e.longtermCertNumber || e.ltcNo || '').trim(),
          renewDate: '',
          organizer: '',
          validDate: '',
          longtermExpireDate: String(e.longtermExpireDate || e.ltcExpiry || '').trim(),
          frontUrl: '',
          frontName: '',
          backUrl: '',
          backName: '',
        });
      }
      return fromArray;
    }

    const result = [];
    const legacyType = String(e.licenseType || '').trim();
    const legacyNo = String(e.licenseNumber || e.licenseNo || '').trim();
    if (legacyType || legacyNo) {
      result.push({
        type: legacyType,
        number: legacyNo,
        renewDate: String(e.licenseRenewDate || '').trim(),
        organizer: String(e.blsOrganizer || e.hostOrg || '').trim(),
        validDate: String(e.blsValidDate || '').trim(),
        longtermExpireDate: '',
        frontUrl: '',
        frontName: '',
        backUrl: '',
        backName: '',
      });
    }
    if (String(e.longtermCertNumber || e.ltcNo || '').trim() || String(e.longtermExpireDate || e.ltcExpiry || '').trim()) {
      result.push({
        type: '07:長照小卡',
        number: String(e.longtermCertNumber || e.ltcNo || '').trim(),
        renewDate: '',
        organizer: '',
        validDate: '',
        longtermExpireDate: String(e.longtermExpireDate || e.ltcExpiry || '').trim(),
        frontUrl: '',
        frontName: '',
        backUrl: '',
        backName: '',
      });
    }
    return result;
  }

  function getCertificatesSummary(list = certificateItems) {
    return (list || [])
      .filter(item => (item.type || '').trim() || (item.number || '').trim() || (item.renewDate || '').trim() || (item.organizer || '').trim() || (item.validDate || '').trim())
      .map(item => {
        const parts = [item.type];
        if ((item.number || '').trim()) parts.push(`${getCertificateNumberLabel(item.type)}:${item.number}`);
        if ((item.renewDate || '').trim()) parts.push(`更新:${item.renewDate}`);
        if ((item.validDate || '').trim()) parts.push(`有效:${item.validDate}`);
        if ((item.longtermExpireDate || '').trim()) parts.push(`長照證效期:${item.longtermExpireDate}`);
        return parts.filter(Boolean).join(' / ');
      })
      .join('；');
  }

  function renderCertificateSummaryModal(employee = {}) {
    const certs = normalizeCertificatesFromEmployee(employee).filter(item =>
      (item.type || '').trim() || (item.number || '').trim() || (item.frontUrl || '').trim() || (item.backUrl || '').trim()
    );

    if (certificateSummaryModalMeta) {
      certificateSummaryModalMeta.innerHTML =
        `員編：<strong>${escapeHtml(employee.id || employee.docId || '—')}</strong><br>` +
        `姓名：<strong>${escapeHtml(employee.name || '—')}</strong>`;
    }

    if (certificateSummaryModalList) {
      if (!certs.length) {
        certificateSummaryModalList.innerHTML = '<div class="text-muted">此員工目前沒有證書資料。</div>';
      } else {
        certificateSummaryModalList.innerHTML = certs.map((item, idx) => {
          const title = [item.type, item.number].filter(Boolean).join(' / ') || `第 ${idx + 1} 筆`;
          const front = item.frontUrl
            ? `<a class="upload-preview-link" href="${escapeHtml(item.frontUrl)}" target="_blank" rel="noopener">查看正面${item.frontName ? `：${escapeHtml(item.frontName)}` : ''}</a>`
            : '<span class="text-muted">未上傳正面</span>';
          const back = item.backUrl
            ? `<a class="upload-preview-link" href="${escapeHtml(item.backUrl)}" target="_blank" rel="noopener">查看反面${item.backName ? `：${escapeHtml(item.backName)}` : ''}</a>`
            : '<span class="text-muted">未上傳反面</span>';
          const detailRows = [
            item.number ? `<div>證書字號：<strong>${escapeHtml(item.number)}</strong></div>` : '',
            item.renewDate ? `<div>執照應更新日期：<strong>${escapeHtml(item.renewDate)}</strong></div>` : '',
            item.organizer ? `<div>主辦單位：<strong>${escapeHtml(item.organizer)}</strong></div>` : '',
            item.validDate ? `<div>有效日期：<strong>${escapeHtml(item.validDate)}</strong></div>` : '',
            item.longtermExpireDate ? `<div>長照證效期：<strong>${escapeHtml(item.longtermExpireDate)}</strong></div>` : '',
          ].filter(Boolean).join('');
          return `
            <div class="border rounded-3 p-3 mb-3 bg-light-subtle">
              <div class="fw-semibold mb-2">${escapeHtml(String(idx + 1))}. ${escapeHtml(title)}</div>
              <div class="small d-flex flex-column gap-2">
                ${detailRows ? `<div class="d-flex flex-column gap-1">${detailRows}</div>` : ''}
                ${front}
                ${back}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (certificateSummaryModal) certificateSummaryModal.show();
  }

  function renderCertificateRows() {
    if (!certificatesListEl) return;
    if (!certificateItems.length) {
      certificatesListEl.innerHTML = '<div class="cert-empty">尚未新增證書，請按右上角「新增證書」。</div>';
      return;
    }
    certificatesListEl.innerHTML = certificateItems.map((item, idx) => {
      const options = ['<option value="">請選擇</option>']
        .concat(CERTIFICATE_TYPE_OPTIONS.map(opt => `<option value="${escapeHtml(opt.value)}" ${item.type === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`))
        .join('');
      const numberLabel = getCertificateNumberLabel(item.type);
      const extraFields = buildCertificateExtraFields(item);
      const frontLabel = item.frontUrl ? `已上傳：${escapeHtml(item.frontName || '正面檔案')}` : '尚未上傳正面';
      const backLabel = item.backUrl ? `已上傳：${escapeHtml(item.backName || '反面檔案')}` : '尚未上傳反面';
      return `
        <div class="cert-row" data-cert-index="${idx}">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label">證書種類</label>
              <select class="form-select cert-type">${options}</select>
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label">${escapeHtml(numberLabel)}</label>
              <input type="text" class="form-control cert-number" value="${escapeHtml(item.number)}">
            </div>
            ${extraFields}
            <div class="col-12 col-md-4">
              <div class="cert-actions">
                <button type="button" class="btn btn-outline-primary btn-sm btn-cert-files">查看/新增</button>
                <button type="button" class="btn btn-outline-danger btn-sm btn-cert-remove">刪除</button>
              </div>
              <div class="cert-meta mt-2">${frontLabel}<br>${backLabel}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function resetCertificateState() {
    certificateItems = [];
    activeCertificateIndex = null;
    if (certificateFrontFileInput) certificateFrontFileInput.value = '';
    if (certificateBackFileInput) certificateBackFileInput.value = '';
    renderCertificateRows();
  }

  function syncCertificateInputsFromDOM() {
    if (!certificatesListEl) return;
    certificatesListEl.querySelectorAll('.cert-row').forEach(row => {
      const idx = Number(row.dataset.certIndex);
      if (!certificateItems[idx]) return;
      const typeEl = row.querySelector('.cert-type');
      const numberEl = row.querySelector('.cert-number');
      const renewDateEl = row.querySelector('.cert-renew-date');
      const organizerEl = row.querySelector('.cert-organizer');
      const validDateEl = row.querySelector('.cert-valid-date');
      const longtermExpireDateEl = row.querySelector('.cert-longterm-expire-date');
      certificateItems[idx].type = typeEl?.value?.trim() || '';
      certificateItems[idx].number = numberEl?.value?.trim() || '';
      certificateItems[idx].renewDate = renewDateEl?.value?.trim() || '';
      certificateItems[idx].organizer = organizerEl?.value?.trim() || '';
      certificateItems[idx].validDate = validDateEl?.value?.trim() || '';
      certificateItems[idx].longtermExpireDate = longtermExpireDateEl?.value?.trim() || '';
    });
  }

  function refreshCertificateModalLinks() {
    const cert = certificateItems[activeCertificateIndex] || {};
    if (certificateFileModalMeta) {
      const metaLines = [
        `證書種類：<strong>${escapeHtml(cert.type || '未選擇')}</strong>`,
        `${escapeHtml(getCertificateNumberLabel(cert.type))}：<strong>${escapeHtml(cert.number || '未填寫')}</strong>`,
      ];
      if (cert.renewDate) metaLines.push(`執照應更新日期：<strong>${escapeHtml(cert.renewDate)}</strong>`);
      if (cert.organizer) metaLines.push(`主辦單位：<strong>${escapeHtml(cert.organizer)}</strong>`);
      if (cert.validDate) metaLines.push(`有效日期：<strong>${escapeHtml(cert.validDate)}</strong>`);
      if (cert.longtermExpireDate) metaLines.push(`長照證效期：<strong>${escapeHtml(cert.longtermExpireDate)}</strong>`);
      certificateFileModalMeta.innerHTML = metaLines.join('<br>');
    }
    if (certificateFrontLinkWrap) {
      certificateFrontLinkWrap.innerHTML = cert.frontUrl
        ? `<a class="upload-preview-link" href="${escapeHtml(cert.frontUrl)}" target="_blank" rel="noopener">查看正面：${escapeHtml(cert.frontName || '檔案')}</a>`
        : '<span class="text-muted">尚未上傳正面檔案</span>';
    }
    if (certificateBackLinkWrap) {
      certificateBackLinkWrap.innerHTML = cert.backUrl
        ? `<a class="upload-preview-link" href="${escapeHtml(cert.backUrl)}" target="_blank" rel="noopener">查看反面：${escapeHtml(cert.backName || '檔案')}</a>`
        : '<span class="text-muted">尚未上傳反面檔案</span>';
    }
  }


  let graduationCertificateData = {
    url: '',
    name: '',
    path: '',
    contentType: '',
    size: 0,
  };
  let graduationCertificateModalMetaOverride = '';
  let graduationCertificateUploadEnabled = true;

  function resetGraduationCertificateState() {
    graduationCertificateData = { url: '', name: '', path: '', contentType: '', size: 0 };
    graduationCertificateModalMetaOverride = '';
    graduationCertificateUploadEnabled = true;
    if (graduationCertificateFileInput) graduationCertificateFileInput.value = '';
    refreshGraduationCertificateUI();
  }

  function refreshGraduationCertificateUI() {
    if (graduationCertificateStatusEl) {
      graduationCertificateStatusEl.textContent = graduationCertificateData.url
        ? `已上傳：${graduationCertificateData.name || '畢業證書圖片'}`
        : '尚未上傳';
    }
    if (graduationCertificateModalMeta) {
      if (graduationCertificateModalMetaOverride) {
        graduationCertificateModalMeta.innerHTML = graduationCertificateModalMetaOverride;
      } else {
        const lines = [
          `畢業學校：<strong>${escapeHtml(schoolInput?.value?.trim() || '未填寫')}</strong>`,
          `檔案名稱：<strong>${escapeHtml(graduationCertificateData.name || '未上傳')}</strong>`,
        ];
        graduationCertificateModalMeta.innerHTML = lines.join('<br>');
      }
    }
    if (graduationCertificateFileInput) graduationCertificateFileInput.disabled = !graduationCertificateUploadEnabled;
    if (graduationCertificatePreviewWrap) {
      graduationCertificatePreviewWrap.innerHTML = graduationCertificateData.url
        ? `<img src="${escapeHtml(graduationCertificateData.url)}" alt="畢業證書" class="img-fluid rounded-3 shadow-sm" style="max-height:70vh;object-fit:contain;">`
        : '<div class="text-muted">尚未上傳畢業證書</div>';
    }
  }

  function loadGraduationCertificateFromEmployee(data = {}) {
    graduationCertificateData = {
      url: String(data.graduationCertificateUrl || '').trim(),
      name: String(data.graduationCertificateName || '').trim(),
      path: String(data.graduationCertificatePath || '').trim(),
      contentType: String(data.graduationCertificateContentType || '').trim(),
      size: Number(data.graduationCertificateSize || 0) || 0,
    };
    refreshGraduationCertificateUI();
  }

  async function uploadGraduationCertificate(file) {
    if (!file) return;
    const employeeId = idInput.value.trim();
    const collection = currentEditing?.collection || typeInput.value;
    if (!employeeId) {
      alert('請先填寫員編，再上傳畢業證書。');
      if (graduationCertificateFileInput) graduationCertificateFileInput.value = '';
      return;
    }
    if (!collection) {
      alert('目前無法判定員工類別，請先選擇分頁後再操作。');
      return;
    }
    try {
      const uploads = await uploadEmployeeCertificateFilesViaApi(
        `${collection}-${employeeId}`,
        `employees-graduation-certificate-${collection}`,
        [file]
      );
      const uploaded = uploads[0];
      if (!uploaded || !uploaded.url) throw new Error('上傳完成，但未取得檔案連結');
      graduationCertificateData = {
        url: String(uploaded.url || '').trim(),
        name: String(uploaded.name || file.name || '畢業證書').trim(),
        path: String(uploaded.path || '').trim(),
        contentType: String(uploaded.contentType || file.type || '').trim(),
        size: Number(uploaded.size || file.size || 0) || 0,
      };
      refreshGraduationCertificateUI();
    } catch (err) {
      console.error(err);
      alert('畢業證書上傳失敗：' + (err.message || err));
    } finally {
      if (graduationCertificateFileInput) graduationCertificateFileInput.value = '';
    }
  }

  async function uploadEmployeeCertificateFilesViaApi(docId, who, files) {
    if (!files || !files.length) return [];
    const form = new FormData();
    form.append('docId', docId);
    form.append('who', who);
    for (const f of files) form.append('files', f, f.name || 'file');

    const resp = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data && (data.error || data.message) ? (data.error || data.message) : ('HTTP ' + resp.status);
      throw new Error(msg);
    }
    return Array.isArray(data.uploaded) ? data.uploaded : [];
  }

  async function uploadCertificateFile(which, file) {
    if (!file) return;
    syncCertificateInputsFromDOM();
    const employeeId = idInput.value.trim();
    const collection = currentEditing?.collection || typeInput.value;
    if (!employeeId) {
      alert('請先填寫員編，再上傳證書檔案。');
      if (which === 'front' && certificateFrontFileInput) certificateFrontFileInput.value = '';
      if (which === 'back' && certificateBackFileInput) certificateBackFileInput.value = '';
      return;
    }
    if (!collection) {
      alert('目前無法判定員工類別，請先選擇分頁後再操作。');
      return;
    }
    const cert = certificateItems[activeCertificateIndex];
    if (!cert) return;

    try {
      const uploads = await uploadEmployeeCertificateFilesViaApi(
        `${collection}-${employeeId}`,
        `employees-certificates-${collection}-${which}`,
        [file]
      );
      const uploaded = uploads[0];
      if (!uploaded || !uploaded.url) throw new Error('上傳完成，但未取得檔案連結');

      cert[which === 'front' ? 'frontUrl' : 'backUrl'] = String(uploaded.url || '').trim();
      cert[which === 'front' ? 'frontName' : 'backName'] = String(uploaded.name || file.name || '檔案').trim();

      if (which === 'front') {
        cert.frontPath = String(uploaded.path || '').trim();
        cert.frontContentType = String(uploaded.contentType || file.type || '').trim();
        cert.frontSize = Number(uploaded.size || file.size || 0) || 0;
      } else {
        cert.backPath = String(uploaded.path || '').trim();
        cert.backContentType = String(uploaded.contentType || file.type || '').trim();
        cert.backSize = Number(uploaded.size || file.size || 0) || 0;
      }

      refreshCertificateModalLinks();
      renderCertificateRows();
    } catch (err) {
      console.error(err);
      alert('證書檔案上傳失敗：' + (err.message || err));
    } finally {
      if (which === 'front' && certificateFrontFileInput) certificateFrontFileInput.value = '';
      if (which === 'back' && certificateBackFileInput) certificateBackFileInput.value = '';
    }
  }
  function isForeignRow(e) {
    return pick(e, ['collection']) === 'caregivers' || pick(e, ['sourceLabel']) === '外籍照服員';
  }

  function getArcStatusClass(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (!m) return '';
    const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(target.getTime())) return '';
    target.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.ceil((target - today) / 86400000);
    if (diffDays < 0) return 'text-danger fw-bold';
    if (diffDays <= 30) return 'text-warning fw-bold';
    return '';
  }

  function syncForeignFieldVisibility(collectionName) {
    const isForeign = collectionName === 'caregivers';
    const englishNameWrap = document.getElementById('employee-englishName-wrap');
    const arcStartWrap = document.getElementById('employee-arcStart-wrap');
    const renewalDateWrap = document.getElementById('employee-renewalDate-wrap');
    const arcExpiryWrap = document.getElementById('employee-arcExpiry-wrap');
    const nationalityWrap = document.getElementById('employee-nationality-wrap');
    const idCardLabel = document.getElementById('employee-idCard-label');
    if (englishNameWrap) englishNameWrap.classList.toggle('d-none', !isForeign);
    if (arcStartWrap) arcStartWrap.classList.toggle('d-none', !isForeign);
    if (renewalDateWrap) renewalDateWrap.classList.toggle('d-none', !isForeign);
    if (arcExpiryWrap) arcExpiryWrap.classList.toggle('d-none', !isForeign);
    if (nationalityWrap) nationalityWrap.classList.toggle('d-none', !isForeign);
    if (idCardLabel) idCardLabel.textContent = isForeign ? '身分證字號(ARC)' : '身分證字號';
    if (!isForeign) {
      englishNameInput.value = '';
      arcStartInput.value = '';
      renewalDateInput.value = '';
      arcExpiryInput.value = '';
      renewalDateInput.value = '';
      nationalityInput.value = '';
    }
  }


  function buildRowHTML(e, opts) {
    const includeSource = !!opts.includeSource;
    const actionLabel = opts.actionLabel || '操作';
    const sourceTd = includeSource ? `<td>${pick(e, ['sourceLabel'])}</td>` : '';
    const inactiveDateTd = includeSource ? `<td>${pick(e, ['inactiveDate'])}</td>` : '';
    const isForeign = !includeSource && isForeignRow(e);
    const handoverDateValue = pick(e, ['handoverDate','arcStart','arcStartDate','arcValidFrom']);
    const renewalDateValue = pick(e, ['renewalDate']);
    const arcExpiryValue = pick(e, ['arcExpiry','arcExpireDate','arcValidUntil']);
    const arcExpiryClass = getArcStatusClass(arcExpiryValue);
    const certSummary = getCertificatesSummary(normalizeCertificatesFromEmployee(e)) || pick(e, ['licenseType']);

    return `
      <tr data-id="${pick(e, ['docId','id'])}" data-collection="${pick(e, ['collection'])}">
        <td class="sticky-col-1">${pick(e, ['sortOrder'])}</td>
        <td class="sticky-col-2">${pick(e, ['id','docId'])}</td>
        <td class="sticky-col-3">${pick(e, ['name'])}</td>
        ${isForeign ? `<td>${pick(e, ['englishName'])}</td>` : ''}
        ${includeSource ? sourceTd : ""}
        ${includeSource ? inactiveDateTd : ""}
        <td>${pick(e, ['gender'])}</td>
        <td>${pick(e, ['birthday'])}</td>
        <td>${pick(e, ['idCard','nationalId','idNumber'])}</td>
        ${isForeign ? `<td>${handoverDateValue}</td><td>${renewalDateValue}</td><td class="${arcExpiryClass}">${arcExpiryValue}</td>` : ''}
        <td>${pick(e, ['hireDate'])}</td>
        <td>${pick(e, ['groupNo','group','teamGroup'])}</td>
        <td>${pick(e, ['title'])}</td>
        <td>${pick(e, ['phone'])}</td>
        <td>${pick(e, ['daytimePhone','email'])}</td>
        <td>${pick(e, ['address'])}</td>
        <td>${pick(e, ['emergencyName','emgName'])}</td>
        <td>${pick(e, ['emergencyRelation','emgRelation'])}</td>
        <td>${pick(e, ['emergencyPhone','emgPhone'])}</td>
        ${isForeign ? `<td>${pick(e, ['nationality'])}</td>` : ''}
        <td>${certSummary ? `<button type="button" class="btn btn-sm btn-outline-secondary btn-cert-summary">查看</button>` : '<span class="text-muted">—</span>'}</td>
        <td>${pick(e, ['licenseRenewDate'])}</td>
        <td>${pick(e, ['longtermCertNumber','ltcNo'])}</td>
        <td>${pick(e, ['longtermExpireDate','ltcExpiry'])}</td>
        <td>${pick(e, ['education'])}</td>
        <td>${pick(e, ['school'])}</td>
        <td>${pick(e, ['graduationCertificateUrl']) ? `<button type="button" class="btn btn-sm btn-outline-secondary btn-graduation-cert-summary">查看</button>` : '<span class="text-muted">—</span>'}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-edit">編輯</button>
          <button class="btn btn-sm btn-danger btn-del ms-1">${actionLabel}</button>
        </td>
      </tr>
    `;
  }


function loadAll() {
    TAB_DEFS.forEach(d => {
      if (d.id === 'inactiveEmployees') {
        loadAndRenderInactive(tbodys[d.id]);
      } else {
        loadAndRenderActive(d.collection, tbodys[d.id], d.id);
      }
    });
    updateHeaderSortUI();
  }

  function activeTabDef() {
    const active = document.querySelector('#employeeTabs .nav-link.active');
    const id = active.id.replace('-tab','');
    return TAB_DEFS.find(x => x.id === id);
  }

  function openForCreate() {
    employeeForm.reset();
    const tab = activeTabDef();
    typeInput.value = tab.collection;
    currentEditing = { collection: tab.collection, docId: null };
    document.getElementById('employee-modal-title').textContent = `新增 - ${tab.label}`;
    syncForeignFieldVisibility(tab.collection);
    resetCertificateState();
    resetGraduationCertificateState();
    idInput.disabled = false;
    if (inactiveWrap) inactiveWrap.classList.add('d-none');
    if (inactiveDateInput) inactiveDateInput.value = '';
    employeeModal.show();
  }

  
  function toISODateForInput(v){
    if(!v) return "";
    let s = String(v).trim();
    if(!s) return "";
    // accept yyyy-mm-dd directly
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // normalize separators
    s = s.replace(/\./g,'/').replace(/-/g,'/').replace(/\s+/g,'');
    const m = s.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/);
    if(!m) return "";
    let y = parseInt(m[1],10);
    const mm = String(parseInt(m[2],10)).padStart(2,'0');
    const dd = String(parseInt(m[3],10)).padStart(2,'0');
    // ROC year (1~3 digits) => AD
    if(y < 1911) y = y + 1911;
    return `${y}-${mm}-${dd}`;
  }

function fillFormFromRow(row) {
    const values = Array.from(row.cells).map(cell => (cell?.textContent || '').trim());
    const isInactive = !!row.closest('#inactiveEmployees-panel');
    const collection = currentEditing?.collection || row.dataset.collection || '';
    const isForeign = collection === 'caregivers';

    let i = 0;
    sortOrderInput.value = values[i++] || '';
    idInput.value = values[i++] || '';
    nameInput.value = values[i++] || '';

    if (isForeign) {
      englishNameInput.value = values[i++] || '';
    } else {
      englishNameInput.value = '';
    }

    if (isInactive) {
      values[i++]; // 職類
      inactiveDateInput.value = toISODateForInput(values[i++] || '');
    } else {
      inactiveDateInput.value = '';
    }

    genderInput.value = values[i++] || '';
    birthdayInput.value = toISODateForInput(values[i++] || '');
    idCardInput.value = values[i++] || '';
    arcStartInput.value = isForeign ? toISODateForInput(values[i++] || '') : '';
    renewalDateInput.value = isForeign ? toISODateForInput(values[i++] || '') : '';
    arcExpiryInput.value = isForeign ? toISODateForInput(values[i++] || '') : '';
    hireDateInput.value = toISODateForInput(values[i++] || '');
    groupNoInput.value = values[i++] || '';
    titleInput.value = values[i++] || '';
    phoneInput.value = values[i++] || '';
    daytimePhoneInput.value = values[i++] || '';
    addressInput.value = values[i++] || '';
    emgNameInput.value = values[i++] || '';
    emgRelationInput.value = values[i++] || '';
    emgPhoneInput.value = values[i++] || '';
    nationalityInput.value = isForeign ? (values[i++] || '') : '';
    i++; // 證書摘要（實際以 DB 為準）
    licenseRenewDateInput.value = toISODateForInput(values[i++] || '');
    i += 2; // 長照證號、長照證效期改由證書資料管理
    educationInput.value = values[i++] || '';
    schoolInput.value = values[i++] || '';
    i++; // 畢業證書欄位（查看按鈕）

    if (inactiveWrap) inactiveWrap.classList.toggle('d-none', !isInactive);
    syncForeignFieldVisibility(collection);
  }

  async function handleSave() {
    const id = idInput.value.trim();
    syncCertificateInputsFromDOM();
    const cleanedCertificates = certificateItems
      .map(item => ({
        type: String(item.type || '').trim(),
        number: String(item.number || '').trim(),
        renewDate: formatDateInput(String(item.renewDate || '').trim()),
        organizer: String(item.organizer || '').trim(),
        validDate: formatDateInput(String(item.validDate || '').trim()),
        longtermExpireDate: String(item.longtermExpireDate || '').trim(),
        frontUrl: String(item.frontUrl || '').trim(),
        frontName: String(item.frontName || '').trim(),
        backUrl: String(item.backUrl || '').trim(),
        backName: String(item.backName || '').trim(),
      }))
      .map(item => {
        if (isNurseLicenseType(item.type) || isSocialWorkerLicenseType(item.type)) {
          item.organizer = '';
          item.validDate = '';
        } else if (isBLSType(item.type)) {
          item.renewDate = '';
          item.longtermExpireDate = '';
        } else if (isLongtermCardType(item.type)) {
          item.renewDate = '';
          item.organizer = '';
          item.validDate = '';
        } else {
          item.renewDate = '';
          item.organizer = '';
          item.validDate = '';
          item.longtermExpireDate = '';
        }
        return item;
      })
      .filter(item => item.type || item.number || item.renewDate || item.organizer || item.validDate || item.longtermExpireDate || item.frontUrl || item.backUrl);

    const longtermCard = cleanedCertificates.find(item => isLongtermCardType(item.type)) || {};

    const payload = {
      sortOrder: parseInt(sortOrderInput.value) || 999,
      id,
      name: nameInput.value.trim(),
      englishName: (currentEditing?.collection === 'caregivers') ? englishNameInput.value.trim() : '',
      gender: genderInput.value,
      birthday: formatDateInput(birthdayInput.value.trim()),
      idCard: idCardInput.value.trim().toUpperCase(),
      handoverDate: (currentEditing?.collection === 'caregivers') ? formatDateInput(arcStartInput.value.trim()) : '',
      renewalDate: (currentEditing?.collection === 'caregivers') ? formatDateInput(renewalDateInput.value.trim()) : '',
      arcStart: (currentEditing?.collection === 'caregivers') ? formatDateInput(arcStartInput.value.trim()) : '',
      arcExpiry: (currentEditing?.collection === 'caregivers') ? formatDateInput(arcExpiryInput.value.trim()) : '',
      hireDate: formatDateInput(hireDateInput.value.trim()),
      groupNo: groupNoInput.value.trim(),
      title: titleInput.value.trim(),
      phone: phoneInput.value.trim(),
      daytimePhone: daytimePhoneInput.value.trim(),
      address: addressInput.value.trim(),
      emergencyName: emgNameInput.value.trim(),
      emergencyRelation: emgRelationInput.value.trim(),
      emergencyPhone: emgPhoneInput.value.trim(),
      nationality: (currentEditing?.collection === 'caregivers') ? nationalityInput.value.trim() : '',
      certificates: cleanedCertificates,
      licenseType: cleanedCertificates.map(item => item.type).filter(Boolean).join('；'),
      licenseNumber: cleanedCertificates.map(item => item.number).filter(Boolean).join('；'),
      licenseRenewDate: formatDateInput(licenseRenewDateInput.value.trim()),
      longtermCertNumber: String(longtermCard.number || '').trim(),
      longtermExpireDate: String(longtermCard.longtermExpireDate || '').trim(),
      education: educationInput.value.trim(),
      school: schoolInput.value.trim(),
      graduationCertificateUrl: graduationCertificateData.url || '',
      graduationCertificateName: graduationCertificateData.name || '',
      graduationCertificatePath: graduationCertificateData.path || '',
      graduationCertificateContentType: graduationCertificateData.contentType || '',
      graduationCertificateSize: graduationCertificateData.size || 0,
      inactiveDate: formatDateInput(inactiveDateInput.value.trim()),
    };

    if (!id || !payload.name) {
      alert("請填寫『員編』與『姓名』");
      return;
    }

    const col = currentEditing.collection || typeInput.value;
    saveEmployeeBtn.disabled = true;
    try {
      // 若更改了員編，刪舊建新
      const docId = currentEditing.docId && currentEditing.docId !== id ? currentEditing.docId : id;
      if (currentEditing.docId && currentEditing.docId !== id) {
        await db.collection(col).doc(currentEditing.docId).delete();
      }
      await db.collection(col).doc(id).set(payload);
      employeeModal.hide();
      loadAll();
    } catch (err) {
      console.error(err);
      alert("儲存失敗");
    } finally {
      saveEmployeeBtn.disabled = false;
    }
  }

  // 事件委派（四個表）
  TAB_DEFS.forEach(def => {
    tbodys[def.id].addEventListener('click', e => {
      const row = e.target.closest('tr');
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.classList.contains('btn-edit')) {
        const collection = def.collection || row.dataset.collection;
        const label = def.collection ? def.label : (TAB_DEFS.find(x => x.collection === collection)?.label || '員工');
        currentEditing = { collection, docId: id };
        typeInput.value = collection;
        fillFormFromRow(row);
        syncForeignFieldVisibility(collection);
        db.collection(collection).doc(id).get().then(docSnap => {
          const data = docSnap.exists ? (docSnap.data() || {}) : {};
          arcStartInput.value = collection === 'caregivers' ? toISODateForInput(data.handoverDate || data.arcStart || '') : '';
          renewalDateInput.value = collection === 'caregivers' ? toISODateForInput(data.renewalDate || '') : '';
          arcExpiryInput.value = collection === 'caregivers' ? toISODateForInput(data.arcExpiry || '') : '';
          nationalityInput.value = collection === 'caregivers' ? (data.nationality || '') : '';
          certificateItems = normalizeCertificatesFromEmployee(data);
          renderCertificateRows();
          loadGraduationCertificateFromEmployee(data);
        }).catch(err => {
          console.error(err);
          resetCertificateState();
          resetGraduationCertificateState();
        });
        document.getElementById('employee-modal-title').textContent = `編輯 - ${label}`;
        idInput.disabled = false;
        employeeModal.show();
      } else if (e.target.classList.contains('btn-cert-summary')) {
        const collection = def.collection || row.dataset.collection;
        db.collection(collection).doc(id).get().then(docSnap => {
          const data = docSnap.exists ? (docSnap.data() || {}) : {};
          renderCertificateSummaryModal({ docId: id, id: data.id || id, name: data.name || '', ...data });
        }).catch(err => {
          console.error(err);
          alert('讀取證書摘要失敗');
        });
      } else if (e.target.classList.contains('btn-del')) {
        const collection = def.collection || row.dataset.collection;
        if (def.id === 'inactiveEmployees') {
          if (confirm(`確定恢復在職：${id}？`)) {
            db.collection(collection).doc(id).set({ isActive: true, inactiveDate: firebase.firestore.FieldValue.delete() }, { merge: true }).then(loadAll);
          }
        } else {
          if (confirm(`確定設為離職：${id}？`)) {
            db.collection(collection).doc(id).set({ isActive: false, inactiveDate: formatDateInput(new Date().toISOString().slice(0,10)) }, { merge: true }).then(loadAll);
          }
        }
      }
});
  });


  if (addCertificateBtn) {
    addCertificateBtn.addEventListener('click', () => {
      syncCertificateInputsFromDOM();
      certificateItems.push({ type: '', number: '', renewDate: '', organizer: '', validDate: '', longtermExpireDate: '', frontUrl: '', frontName: '', backUrl: '', backName: '' });
      renderCertificateRows();
    });
  }

  if (certificatesListEl) {
    certificatesListEl.addEventListener('input', (e) => {
      const row = e.target.closest('.cert-row');
      if (!row) return;
      const idx = Number(row.dataset.certIndex);
      if (!certificateItems[idx]) return;
      if (e.target.classList.contains('cert-type')) certificateItems[idx].type = e.target.value.trim();
      if (e.target.classList.contains('cert-number')) certificateItems[idx].number = e.target.value.trim();
      if (e.target.classList.contains('cert-renew-date')) certificateItems[idx].renewDate = e.target.value.trim();
      if (e.target.classList.contains('cert-organizer')) certificateItems[idx].organizer = e.target.value.trim();
      if (e.target.classList.contains('cert-valid-date')) certificateItems[idx].validDate = e.target.value.trim();
      if (e.target.classList.contains('cert-longterm-expire-date')) certificateItems[idx].longtermExpireDate = e.target.value.trim();
    });

    certificatesListEl.addEventListener('change', (e) => {
      const row = e.target.closest('.cert-row');
      if (!row) return;
      const idx = Number(row.dataset.certIndex);
      if (!certificateItems[idx]) return;
      if (e.target.classList.contains('cert-type')) {
        const prevType = certificateItems[idx].type || '';
        const nextType = e.target.value.trim();
        certificateItems[idx].type = nextType;
        if (isNurseLicenseType(nextType) || isSocialWorkerLicenseType(nextType)) {
          certificateItems[idx].organizer = '';
          certificateItems[idx].validDate = '';
        } else if (isBLSType(nextType)) {
          certificateItems[idx].renewDate = '';
          certificateItems[idx].longtermExpireDate = '';
        } else if (isLongtermCardType(nextType)) {
          certificateItems[idx].renewDate = '';
          certificateItems[idx].organizer = '';
          certificateItems[idx].validDate = '';
        } else if (prevType !== nextType) {
          certificateItems[idx].renewDate = '';
          certificateItems[idx].organizer = '';
          certificateItems[idx].validDate = '';
          certificateItems[idx].longtermExpireDate = '';
        }
        renderCertificateRows();
      }
    });

    certificatesListEl.addEventListener('click', (e) => {
      const row = e.target.closest('.cert-row');
      if (!row) return;
      const idx = Number(row.dataset.certIndex);
      if (e.target.classList.contains('btn-cert-remove')) {
        certificateItems.splice(idx, 1);
        renderCertificateRows();
        return;
      }
      if (e.target.classList.contains('btn-cert-files')) {
        syncCertificateInputsFromDOM();
        activeCertificateIndex = idx;
        refreshCertificateModalLinks();
        certificateFileModal?.show();
      }
    });
  }

  certificateFrontFileInput?.addEventListener('change', (e) => uploadCertificateFile('front', e.target.files?.[0]));
  certificateBackFileInput?.addEventListener('change', (e) => uploadCertificateFile('back', e.target.files?.[0]));
  graduationCertificateManageBtn?.addEventListener('click', () => {
    graduationCertificateModalMetaOverride = '';
    graduationCertificateUploadEnabled = true;
    refreshGraduationCertificateUI();
    graduationCertificateModal?.show();
  });
  graduationCertificateFileInput?.addEventListener('change', (e) => uploadGraduationCertificate(e.target.files?.[0]));
  schoolInput?.addEventListener('input', refreshGraduationCertificateUI);
  // 排序 header
  document.querySelectorAll('.sortable-header').forEach(h => {
    h.addEventListener('click', () => {
      const k = h.dataset.sort;
      if (sortConfig.key === k) sortConfig.order = sortConfig.order === 'asc' ? 'desc' : 'asc';
      else { sortConfig.key = k; sortConfig.order = 'asc'; }
      loadAll();
    });
  });

  function excelSerialToDateString(serial) {
    if (!serial || isNaN(serial)) return "";
    const utc_days = serial - 25569;
    const utc_value = utc_days * 86400;
    const date = new Date(utc_value * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  }

  function normalizeDateMaybe(v) {
    if (v === undefined || v === null || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}/${m}/${d}`;
    }
    if (typeof v === "number") return excelSerialToDateString(v);
    if (typeof v === "string") return formatDateInput(v);
    return "";
  }

  
  async function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const tab = activeTabDef();
    const col = tab.collection;
    importStatus.className = "alert alert-info";
    importStatus.classList.remove('d-none');
    importStatus.textContent = `正在匯入到「${tab.label}」…`;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);

        // ✅ 重要：cellDates:true 讓日期更穩；raw:true 保留原值；defval:"" 保留空欄
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const list = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

        if (list.length === 0) {
          importStatus.className = "alert alert-danger";
          importStatus.textContent = "表內沒有資料";
          return;
        }

        // ✅ 欄名同義字：Excel 表頭常常不一致，這裡全部吃
        const map = {
          "排序": "sortOrder",
          "員編": "id",
          "姓名": "name",
          "性別": "gender",
          "生日": "birthday",
          "出生年月日": "birthday",
          "身分證": "idCard",
          "身分證字號": "idCard",
          "身分證字號(ARC)": "idCard",
          "英文姓名": "englishName",
          "ARC有效期限起日": "handoverDate",
          "承接日期": "handoverDate",
          "續聘日期": "renewalDate",
          "ARC有效期限迄日": "arcExpiry",
          "ARC有效期限": "arcExpiry",
          "身份證字號": "idCard",
          "身份証字號": "idCard",
          "到職日": "hireDate",
          "到職日期": "hireDate",
          "組別": "groupNo",
          "組": "groupNo",
          "Group": "groupNo",
          "group": "groupNo",
          "職稱": "title",
          "手機": "phone",
          "日間電話": "daytimePhone",
          "地址": "address",
          "緊急聯絡人": "emergencyName",
          "緊急連絡人": "emergencyName",
          "緊急連絡人姓名": "emergencyName",
          "關係": "emergencyRelation",
          "緊急聯絡人關係": "emergencyRelation",
          "緊急連絡人關係": "emergencyRelation",
          "緊急電話": "emergencyPhone",
          "緊急聯絡人電話": "emergencyPhone",
          "緊急連絡人電話": "emergencyPhone",
          "國籍": "nationality",
          "證照種類": "licenseType",
          "發證字號": "licenseNumber",
          "證書字號": "licenseNumber",
          "換證日期": "licenseRenewDate",
          "證書換證日期": "licenseRenewDate",
          "長照證號": "longtermCertNumber",
          "長照證號(長照證號碼)": "longtermCertNumber",
          "長照人員證照文件證號": "longtermCertNumber",
          "長照證效期": "longtermExpireDate",      // 可能是區間字串，保留原樣
          "長照證有效期限": "longtermExpireDate",
          "長照人員服務證明期限": "longtermExpireDate",
          "學歷": "education",
          "畢業學校": "school",
        };

        // 必填欄檢查（只要表頭中有任一同義欄名即可）
        const headers = Object.keys(list[0] || {});
        const hasAny = (names) => names.some(n => headers.includes(n));
        if (!hasAny(["員編"])) {
          importStatus.className = "alert alert-danger";
          importStatus.textContent = "缺少必要欄位：員編";
          return;
        }
        if (!hasAny(["姓名"])) {
          importStatus.className = "alert alert-danger";
          importStatus.textContent = "缺少必要欄位：姓名";
          return;
        }

        const batch = db.batch();

        list.forEach(row => {
          const id = String(row["員編"] || row["員編 "] || "").trim();
          if (!id) return;

          const ref = db.collection(col).doc(id);
          const payload = {};

          // 把 row 裡的每一欄，若表頭在 map 裡就寫入 payload
          Object.keys(row).forEach((cn) => {
            const key = map[cn];
            if (!key) return;

            let v = row[cn];

            // 日期欄：支援 Excel serial / Date / 字串（yyyy/mm/dd、民國、yyyy-mm-dd）
            if (["birthday", "hireDate", "licenseRenewDate", "handoverDate", "renewalDate", "arcStart", "arcExpiry"].includes(key)) {
              v = normalizeDateMaybe(v);
            }

            if (key === "sortOrder") v = parseInt(v, 10) || 999;
            if (typeof v === "string") v = v.trim();

            payload[key] = v ?? "";
          });

          // 補齊必填
          payload.id = id;
          if (!payload.sortOrder) payload.sortOrder = 999;
          if (payload.handoverDate && !payload.arcStart) payload.arcStart = payload.handoverDate;

          batch.set(ref, payload, { merge: true });
        });

        await batch.commit();

        importStatus.className = "alert alert-success";
        importStatus.textContent = "匯入完成，將重新整理…";
        setTimeout(() => window.location.reload(), 1200);

      } catch (err) {
        console.error(err);
        importStatus.className = "alert alert-danger";
        importStatus.textContent = "匯入失敗";
      } finally {
        excelFileInput.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  }


async function generateReportHTML() {
    const exportTime = formatExportTime(new Date());
    const exportUser = `${CURRENT_USER.staffId} ${CURRENT_USER.name}`.trim() || '—';
    const tab = activeTabDef();
    const col = tab.collection;

    const snap = await db.collection(col).orderBy('sortOrder').orderBy('id').get();
    let rows = "";
    snap.forEach(doc => {
      const e = doc.data();
      rows += `
        <tr>
          <td>${e.sortOrder ?? ''}</td>
          <td>${e.id ?? ''}</td>
          <td>${e.name ?? ''}</td>
          ${tab.id === 'foreignCaregivers' ? `<td>${e.englishName ?? ''}</td>` : ''}
          <td>${e.gender ?? ''}</td>
          <td>${e.birthday ?? ''}</td>
          <td>${e.idCard ?? ''}</td>
          ${tab.id === 'foreignCaregivers' ? `<td>${e.handoverDate ?? e.arcStart ?? ''}</td><td>${e.renewalDate ?? ''}</td><td class="${getArcStatusClass(e.arcExpiry ?? '')}">${e.arcExpiry ?? ''}</td>` : ''}
          <td>${e.hireDate ?? ''}</td>
          <td>${e.groupNo ?? ''}</td>
          <td>${e.title ?? ''}</td>
          <td>${e.phone ?? ''}</td>
          <td>${e.daytimePhone ?? ''}</td>
          <td>${e.address ?? ''}</td>
          <td>${e.emergencyName ?? ''}</td>
          <td>${e.emergencyRelation ?? ''}</td>
          <td>${e.emergencyPhone ?? ''}</td>
          ${tab.id === 'foreignCaregivers' ? `<td>${e.nationality ?? ''}</td>` : ''}
          <td>${getCertificatesSummary(normalizeCertificatesFromEmployee(e)) || e.licenseType || ''}</td>
          <td>${e.licenseRenewDate ?? ''}</td>
          <td>${e.longtermCertNumber ?? ''}</td>
          <td>${e.longtermExpireDate ?? ''}</td>
          <td>${e.education ?? ''}</td>
          <td>${e.school ?? ''}</td>
          <td>${e.graduationCertificateUrl ? '有' : '—'}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8">
      <title>${tab.label}名冊</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'Noto Sans','PingFang TC','Heiti TC',sans-serif}
        table{width:95%;margin:auto;border-collapse:collapse;text-align:center;font-size:12px}
        th,td{border:1px solid #000;padding:6px}
        thead{background:#eee}
        h1,h2{text-align:center}
      </style></head><body>
      <h1>安泰醫療社團法人附設安泰護理之家</h1>
      <h2>${tab.label}名冊</h2>
      <table><thead><tr>
        ${tab.id === 'foreignCaregivers'
        ? '<th>排序</th><th>員編</th><th>姓名</th><th>英文姓名</th><th>性別</th><th>生日</th><th>身分證字號(ARC)</th><th>承接日期</th><th>續聘日期</th><th>ARC有效期限迄日</th><th>到職日</th><th>組別</th><th>職稱</th><th>手機</th><th>日間電話</th><th>地址</th><th>緊急聯絡人</th><th>關係</th><th>緊急電話</th><th>國籍</th><th>證書摘要</th><th>換證日期</th><th>長照證號</th><th>長照證效期</th><th>學歷</th><th>畢業學校</th><th>畢業證書</th>'
        : '<th>排序</th><th>員編</th><th>姓名</th><th>性別</th><th>生日</th><th>身分證字號</th><th>到職日</th><th>組別</th><th>職稱</th><th>手機</th><th>日間電話</th><th>地址</th><th>緊急聯絡人</th><th>關係</th><th>緊急電話</th><th>證書摘要</th><th>換證日期</th><th>長照證號</th><th>長照證效期</th><th>學歷</th><th>畢業學校</th><th>畢業證書</th>'}
      </tr></thead><tbody>${rows}</tbody></table>

      <div style="width:95%;margin:18px auto 0 auto;font-size:12px;text-align:right;color:#333">
        匯出時間：${exportTime}&nbsp;&nbsp;&nbsp;&nbsp;匯出人員：${exportUser}
      </div>

      </body></html>
    `;
  }

  
  
  // ========= Word 匯出（真正 .docx，整合所有名冊） =========
  async function exportAllToWordDocx() {
    const exportTime = formatExportTime(new Date());
    const exportUser = `${CURRENT_USER.staffId} ${CURRENT_USER.name}`.trim() || '—';
    if (window.__exportingEmployeesDocx) return;
    window.__exportingEmployeesDocx = true;

    try {
      if (typeof docx === 'undefined' || !docx.Document) {
        alert('docx 套件尚未載入，請確認 employees-admin.html 已加入 docx CDN。');
        return;
      }
      if (typeof saveAs === 'undefined') {
        alert('FileSaver 尚未載入，無法下載檔案。');
        return;
      }

      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, PageBreak, BorderStyle } = docx;

      const TAB_DOCX_DEFS = [
        { label: '護理師', collection: 'nurses', includeSource: false },
        { label: '外籍照服員', collection: 'caregivers', includeSource: false },
        { label: '台籍照服員', collection: 'localCaregivers', includeSource: false },
        { label: '行政/其他', collection: 'adminStaff', includeSource: false },
        { label: '離職員工（合併）', collection: null, includeSource: true },
      ];

      const getVal = (obj, keys) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      };

      async function fetchActiveFromCollection(collectionName) {
        const snap = await db.collection(collectionName).orderBy('sortOrder').orderBy('id').get();
        const rows = [];
        snap.forEach(doc => {
          const e = doc.data() || {};
          if (e.isActive === false) return;
          rows.push({ docId: doc.id, ...e });
        });
        return rows;
      }

      async function fetchInactiveMerged() {
        const rows = [];
        for (const def of TAB_DEFS) {
          if (def.id === 'inactiveEmployees') continue;
          const snap = await db.collection(def.collection).orderBy('id').get();
          snap.forEach(doc => {
            const e = doc.data() || {};
            if (e.isActive !== false) return;
            rows.push({ docId: doc.id, sourceLabel: def.label, ...e });
          });
        }
        rows.sort((a,b)=>String(a.id||a.docId||'').localeCompare(String(b.id||b.docId||''), 'zh-Hant'));
        return rows;
      }

      const headersBase = (tab.id === 'foreignCaregivers')
        ? ['排序','員編','姓名','英文姓名','性別','生日','身分證字號(ARC)','承接日期','續聘日期','ARC有效期限迄日','到職日','組別','職稱','手機','日間電話','地址',
           '緊急聯絡人','關係','緊急電話','國籍','證書摘要','換證日期','長照證號','長照證效期','學歷','畢業學校']
        : ['排序','員編','姓名','性別','生日','身分證字號','到職日','組別','職稱','手機','日間電話','地址',
           '緊急聯絡人','關係','緊急電話','證書摘要','換證日期','長照證號','長照證效期','學歷','畢業學校'];

      function buildRowValues(e, includeSource) {
        const base = [
          getVal(e, ['sortOrder']),
          getVal(e, ['id','docId']),
          getVal(e, ['name']),
          ...(tab.id === 'foreignCaregivers' ? [getVal(e, ['englishName'])] : []),
          getVal(e, ['gender']),
          getVal(e, ['birthday']),
          getVal(e, ['idCard','nationalId','idNumber']),
          ...(tab.id === 'foreignCaregivers' ? [getVal(e, ['handoverDate','arcStart','arcStartDate','arcValidFrom']), getVal(e, ['renewalDate']), getVal(e, ['arcExpiry','arcExpireDate','arcValidUntil'])] : []),
          getVal(e, ['hireDate']),
          getVal(e, ['groupNo','group','teamGroup']),
          getVal(e, ['title']),
          getVal(e, ['phone']),
          getVal(e, ['daytimePhone','email']),
          getVal(e, ['address']),
          getVal(e, ['emergencyName','emgName','emergencyContact']),
          getVal(e, ['emergencyRelation','emgRelation']),
          getVal(e, ['emergencyPhone','emgPhone']),
          ...(tab.id === 'foreignCaregivers' ? [getVal(e, ['nationality'])] : []),
          getCertificatesSummary(normalizeCertificatesFromEmployee(e)) || getVal(e, ['licenseType']),
          getVal(e, ['licenseRenewDate']),
          getVal(e, ['longtermCertNumber','ltcNo']),
          getVal(e, ['longtermExpireDate','ltcExpiry']),
          getVal(e, ['education']),
          getVal(e, ['school']),
          getVal(e, ['graduationCertificateUrl']) ? '有' : '—',
        ];
        return includeSource ? [getVal(e, ['sourceLabel']), ...base] : base;
      }

      function makeTable(rows, includeSource) {
        const headers = includeSource ? ['職類', ...headersBase] : headersBase;

        const border = {
          top:    { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left:   { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right:  { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        };

        const headerRow = new TableRow({
          children: headers.map(h => new TableCell({
            borders: border,
            width: { size: 100/headers.length, type: WidthType.PERCENTAGE },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  font: "DFKai-SB",
                  size: 22   // 11pt
                })
              ]
            })]
          }))
        });

        const dataRows = rows.map(e => {
          const vals = buildRowValues(e, includeSource);
          return new TableRow({
            children: vals.map(v => new TableCell({
              borders: border,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(v ?? ''),
                    font: "DFKai-SB",
                    size: 20   // 10pt
                  })
                ]
              })]
            }))
          });
        });

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        });
      }

      // 組文件內容
      const children = [];

      // 主標題
      children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: '安泰醫療社團法人附設安泰護理之家',
          bold: true,
          font: "DFKai-SB",
          size: 32
        })]
      }));
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '人員名冊（全體員工）', bold: true })]
      }));
      children.push(new Paragraph({ children: [new TextRun(' ')] }));

      // 逐類加入
      for (let i = 0; i < TAB_DOCX_DEFS.length; i++) {
        const d = TAB_DOCX_DEFS[i];
        let rows = [];
        if (d.collection) rows = await fetchActiveFromCollection(d.collection);
        else rows = await fetchInactiveMerged();

        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: d.label, bold: true })]
        }));

        if (!rows.length) {
          children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('（尚無資料）')]}));
        } else {
          children.push(makeTable(rows, d.includeSource));
        }

        if (i !== TAB_DOCX_DEFS.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }

      // 匯出資訊（文件末尾）
      children.push(new Paragraph({ children: [new TextRun(' ')] }));
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `匯出時間：${exportTime}    匯出人員：${exportUser}`, font: 'DFKai-SB', size: 20 })]
      }));

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { orientation: "landscape" }, // 讓大表格更好放
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            }
          },
          children
        }]
      });

      const buf = await Packer.toBlob(doc);

      const y = new Date().getFullYear();
      const m = String(new Date().getMonth()+1).padStart(2,'0');
      const d = String(new Date().getDate()).padStart(2,'0');
      const filename = `人員名冊整合_${y}${m}${d}.docx`;

      saveAs(buf, filename);

    } catch (err) {
      console.error(err);
      alert('匯出失敗，請看 console');
    } finally {
      window.__exportingEmployeesDocx = false;
    }
  }

// ========= Excel 匯出（整合所有名冊到同一個 .xlsx，分頁區分） =========
  async function exportAllToExcelXlsx() {
    const exportTime = formatExportTime(new Date());
    const exportUser = `${CURRENT_USER.staffId} ${CURRENT_USER.name}`.trim() || '—';
    if (window.__exportingEmployeesXlsx) return;
    window.__exportingEmployeesXlsx = true;

    try {
      if (typeof ExcelJS === 'undefined') {
        alert('ExcelJS 尚未載入，無法匯出 .xlsx（含樣式）。');
        return;
      }

      // ---- 欄位定義：與表頭一致 ----
      // 注意：歷史資料可能有不同欄位名稱，這裡做多 key fallback
      const COLS_NORMAL = [
        { header: '排序', key: 'sortOrder', width: 6 },
        { header: '員編', key: 'id', width: 10 },
        { header: '姓名', key: 'name', width: 14 },
        { header: '性別', key: 'gender', width: 6 },
        { header: '生日', key: 'birthday', width: 12 },
        { header: '身分證字號', key: 'idCard', width: 16 },
        { header: '到職日', key: 'hireDate', width: 12 },
        { header: '組別', key: 'groupNo', width: 8 },
        { header: '職稱', key: 'title', width: 12 },
        { header: '手機', key: 'phone', width: 16 },
        { header: '日間電話', key: 'daytimePhone', width: 16 },
        { header: '地址', key: 'address', width: 32 },
        { header: '緊急聯絡人', key: 'emergencyName', width: 14 },
        { header: '關係', key: 'emergencyRelation', width: 10 },
        { header: '緊急電話', key: 'emergencyPhone', width: 16 },
        { header: '證書摘要', key: 'licenseType', width: 30 },
        { header: '換證日期', key: 'licenseRenewDate', width: 12 },
        { header: '長照證號', key: 'longtermCertNumber', width: 20 },
        { header: '長照證效期', key: 'longtermExpireDate', width: 14 },
        { header: '學歷', key: 'education', width: 12 },
        { header: '畢業學校', key: 'school', width: 26 },
        { header: '畢業證書', key: 'graduationCertificate', width: 12 },
      ];
      const COLS_FOREIGN = [
        { header: '排序', key: 'sortOrder', width: 6 },
        { header: '員編', key: 'id', width: 10 },
        { header: '姓名', key: 'name', width: 14 },
        { header: '英文姓名', key: 'englishName', width: 18 },
        { header: '性別', key: 'gender', width: 6 },
        { header: '生日', key: 'birthday', width: 12 },
        { header: '身分證字號(ARC)', key: 'idCard', width: 16 },
        { header: '承接日期', key: 'handoverDate', width: 12 },
        { header: '續聘日期', key: 'renewalDate', width: 12 },
        { header: 'ARC有效期限迄日', key: 'arcExpiry', width: 14 },
        { header: '到職日', key: 'hireDate', width: 12 },
        { header: '組別', key: 'groupNo', width: 8 },
        { header: '職稱', key: 'title', width: 12 },
        { header: '手機', key: 'phone', width: 16 },
        { header: '日間電話', key: 'daytimePhone', width: 16 },
        { header: '地址', key: 'address', width: 32 },
        { header: '緊急聯絡人', key: 'emergencyName', width: 14 },
        { header: '關係', key: 'emergencyRelation', width: 10 },
        { header: '緊急電話', key: 'emergencyPhone', width: 16 },
        { header: '證書摘要', key: 'licenseType', width: 30 },
        { header: '換證日期', key: 'licenseRenewDate', width: 12 },
        { header: '長照證號', key: 'longtermCertNumber', width: 20 },
        { header: '長照證效期', key: 'longtermExpireDate', width: 14 },
        { header: '學歷', key: 'education', width: 12 },
        { header: '畢業學校', key: 'school', width: 26 },
        { header: '畢業證書', key: 'graduationCertificate', width: 12 },
      ];

      const getVal = (obj, keys) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      };

      // ---- 讀取資料 ----
      async function fetchActiveFromCollection(collectionName) {
        const snap = await db.collection(collectionName).orderBy('sortOrder').orderBy('id').get();
        const rows = [];
        snap.forEach(doc => {
          const e = doc.data() || {};
          if (e.isActive === false) return;
          rows.push({ docId: doc.id, ...e });
        });
        return rows;
      }

      async function fetchInactiveMerged() {
        const rows = [];
        for (const def of TAB_DEFS) {
          if (def.id === 'inactiveEmployees') continue;
          const snap = await db.collection(def.collection).orderBy('id').get();
          snap.forEach(doc => {
            const e = doc.data() || {};
            if (e.isActive !== false) return;
            rows.push({ docId: doc.id, sourceLabel: def.label, ...e });
          });
        }
        // 預設用員編排序
        rows.sort((a,b)=>String(a.id||a.docId||'').localeCompare(String(b.id||b.docId||''), 'zh-Hant'));
        return rows;
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Antai';
      wb.created = new Date();

      // ---- 共用樣式 ----
      const fontTitle  = { name:'Microsoft JhengHei', bold:true, size:16 };
      const fontHeader = { name:'Microsoft JhengHei', bold:true, size:12 };
      const fontCell   = { name:'Microsoft JhengHei', size:11 };
      const fillHeader = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF1F3F5' } };
      const borderThin = {
        top:{style:'thin',color:{argb:'FF000000'}},
        left:{style:'thin',color:{argb:'FF000000'}},
        bottom:{style:'thin',color:{argb:'FF000000'}},
        right:{style:'thin',color:{argb:'FF000000'}}
      };


      function buildEmployeeExportRow(e, isForeign) {
        return {
          sortOrder: getVal(e, ['sortOrder']),
          id: getVal(e, ['id','docId']),
          name: getVal(e, ['name']),
          englishName: isForeign ? getVal(e, ['englishName']) : '',
          gender: getVal(e, ['gender']),
          birthday: getVal(e, ['birthday']),
          idCard: getVal(e, ['idCard','nationalId','idNumber']),
          handoverDate: isForeign ? getVal(e, ['handoverDate','arcStart','arcStartDate','arcValidFrom']) : '',
          renewalDate: isForeign ? getVal(e, ['renewalDate']) : '',
          arcExpiry: isForeign ? getVal(e, ['arcExpiry','arcExpireDate','arcValidUntil']) : '',
          hireDate: getVal(e, ['hireDate']),
          groupNo: getVal(e, ['groupNo','group','teamGroup']),
          title: getVal(e, ['title']),
          phone: getVal(e, ['phone']),
          daytimePhone: getVal(e, ['daytimePhone','email']),
          address: getVal(e, ['address']),
          emergencyName: getVal(e, ['emergencyName','emgName','emergencyContact']),
          emergencyRelation: getVal(e, ['emergencyRelation','emgRelation']),
          emergencyPhone: getVal(e, ['emergencyPhone','emgPhone']),
          nationality: isForeign ? getVal(e, ['nationality']) : '',
          licenseType: getCertificatesSummary(normalizeCertificatesFromEmployee(e)) || getVal(e, ['licenseType']),
          licenseRenewDate: getVal(e, ['licenseRenewDate']),
          longtermCertNumber: getVal(e, ['longtermCertNumber','ltcNo']),
          longtermExpireDate: getVal(e, ['longtermExpireDate','ltcExpiry']),
          education: getVal(e, ['education']),
          school: getVal(e, ['school']),
          graduationCertificate: getVal(e, ['graduationCertificateUrl']) ? '有' : '—',
        };
      }

      async function fetchImageBuffer(url) {
        if (!url) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const mime = (blob.type || '').toLowerCase();
          const ext = mime.includes('png') ? 'png' : (mime.includes('webp') ? 'png' : 'jpeg');
          const arrayBuffer = await blob.arrayBuffer();
          return { buffer: arrayBuffer, extension: ext };
        } catch (err) {
          console.warn('證書圖片下載失敗：', url, err);
          return null;
        }
      }

      async function addCertificatePhotoSheet(sheetName, employees) {
        const ws = wb.addWorksheet(sheetName);
        ws.columns = [
          { header: '員工類別', key: 'category', width: 12 },
          { header: '員編', key: 'id', width: 12 },
          { header: '姓名', key: 'name', width: 14 },
          { header: '證書種類', key: 'certType', width: 24 },
          { header: '發證字號', key: 'certNo', width: 24 },
          { header: '正面', key: 'front', width: 18 },
          { header: '反面', key: 'back', width: 18 },
          { header: '正面連結', key: 'frontUrl', width: 42 },
          { header: '反面連結', key: 'backUrl', width: 42 },
        ];
        applyRowStyle(ws.getRow(1), { header:true });
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        let rowIndex = 2;
        for (const emp of employees) {
          const certs = normalizeCertificatesFromEmployee(emp).filter(c => c && (c.type || c.number || c.frontUrl || c.backUrl));
          if (!certs.length) continue;
          for (const cert of certs) {
            const row = ws.getRow(rowIndex);
            row.values = {
              category: emp.__categoryLabel || '',
              id: emp.id || '',
              name: emp.name || '',
              certType: cert.type || '',
              certNo: cert.number || '',
              front: cert.frontUrl ? '見圖' : '',
              back: cert.backUrl ? '見圖' : '',
              frontUrl: cert.frontUrl || '',
              backUrl: cert.backUrl || '',
            };
            applyRowStyle(row);
            row.height = 90;
            if (cert.frontUrl) ws.getCell(`H${rowIndex}`).value = { text: cert.frontUrl, hyperlink: cert.frontUrl };
            if (cert.backUrl) ws.getCell(`I${rowIndex}`).value = { text: cert.backUrl, hyperlink: cert.backUrl };

            const frontImg = await fetchImageBuffer(cert.frontUrl);
            if (frontImg) {
              const imgId = wb.addImage({ buffer: frontImg.buffer, extension: frontImg.extension });
              ws.addImage(imgId, { tl: { col: 5, row: rowIndex - 1 + 0.1 }, ext: { width: 110, height: 110 } });
            }
            const backImg = await fetchImageBuffer(cert.backUrl);
            if (backImg) {
              const imgId = wb.addImage({ buffer: backImg.buffer, extension: backImg.extension });
              ws.addImage(imgId, { tl: { col: 6, row: rowIndex - 1 + 0.1 }, ext: { width: 110, height: 110 } });
            }
            rowIndex += 1;
          }
        }
        if (rowIndex === 2) {
          ws.mergeCells('A2:I2');
          ws.getCell('A2').value = '此分類目前沒有已上傳的證書照片';
          ws.getCell('A2').alignment = { vertical:'middle', horizontal:'center' };
          ws.getCell('A2').font = fontCell;
          ws.getCell('A2').border = borderThin;
        }
      }

      function applyRowStyle(row, { header=false } = {}) {
        row.height = header ? 22 : 26;
        row.eachCell(c => {
          c.font = header ? fontHeader : fontCell;
          c.border = borderThin;
          c.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
          if (header) c.fill = fillHeader;
        });
      }

      function setPrint(ws) {
        ws.pageSetup = {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left:0.4, right:0.4, top:0.75, bottom:0.75, header:0.3, footer:0.3 } // inch
        };
      }

      function addSheet(sheetName, title, cols, dataRows, { includeSource=false, isForeignSheet=false } = {}) {
        const ws = wb.addWorksheet(sheetName, { views:[{ state:'frozen', ySplit:2 }] });

        const finalCols = includeSource
          ? [
              { header:'職類', key:'sourceLabel', width: 10 },
              ...cols
            ]
          : cols;

        ws.columns = finalCols.map(c => ({ header: c.header, key: c.key, width: c.width }));

        // Title row
        const lastCol = finalCols.length;
        ws.mergeCells(1,1,1,lastCol);
        ws.getRow(1).height = 28;
        const tcell = ws.getCell(1,1);
        tcell.value = title;
        tcell.font = fontTitle;
        tcell.alignment = { vertical:'middle', horizontal:'center' };

        // Header row
        const headerRow = ws.getRow(2);
        headerRow.values = finalCols.map(c => c.header);
        applyRowStyle(headerRow, { header:true });

        // Data rows
        dataRows.forEach((e) => {
          const rowObj = {
            sortOrder: getVal(e, ['sortOrder']),
            id: getVal(e, ['id','docId']),
            name: getVal(e, ['name']),
            englishName: isForeignSheet ? getVal(e, ['englishName']) : '',
            gender: getVal(e, ['gender']),
            birthday: getVal(e, ['birthday']),
            idCard: getVal(e, ['idCard','nationalId','idNumber']),
            handoverDate: isForeignSheet ? getVal(e, ['handoverDate','arcStart','arcStartDate','arcValidFrom']) : '',
            renewalDate: isForeignSheet ? getVal(e, ['renewalDate']) : '',
            arcExpiry: isForeignSheet ? getVal(e, ['arcExpiry','arcExpireDate','arcValidUntil']) : '',
            hireDate: getVal(e, ['hireDate']),
            groupNo: getVal(e, ['groupNo','group','teamGroup']),
            title: getVal(e, ['title']),
            phone: getVal(e, ['phone']),
            daytimePhone: getVal(e, ['daytimePhone','email']), // 舊資料誤用 email
            address: getVal(e, ['address']),
            emergencyName: getVal(e, ['emergencyName','emgName','emergencyContact']),
            emergencyRelation: getVal(e, ['emergencyRelation','emgRelation']),
            emergencyPhone: getVal(e, ['emergencyPhone','emgPhone']),
            nationality: isForeignSheet ? getVal(e, ['nationality']) : '',
            licenseType: getCertificatesSummary(normalizeCertificatesFromEmployee(e)) || getVal(e, ['licenseType']),
            licenseRenewDate: getVal(e, ['licenseRenewDate']),
            longtermCertNumber: getVal(e, ['longtermCertNumber','ltcNo']),
            longtermExpireDate: getVal(e, ['longtermExpireDate','ltcExpiry']),
            education: getVal(e, ['education']),
            school: getVal(e, ['school']),
          graduationCertificate: getVal(e, ['graduationCertificateUrl']) ? '有' : '—',
            sourceLabel: includeSource ? getVal(e, ['sourceLabel']) : undefined
          };

          const values = finalCols.map(c => rowObj[c.key] ?? '');
          const r = ws.addRow(values);
          applyRowStyle(r, { header:false });
        });


        // Footer: 匯出資訊（表格下方）
        const footerRowIdx = ws.lastRow.number + 2;
        ws.mergeCells(footerRowIdx, 1, footerRowIdx, finalCols.length);
        const fc = ws.getCell(footerRowIdx, 1);
        fc.value = `匯出時間：${exportTime}    匯出人員：${exportUser}`;
        fc.font = { name: 'Microsoft JhengHei', size: 11 };
        fc.alignment = { vertical: 'middle', horizontal: 'right' };

        // Auto filter
        ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: finalCols.length } };

        setPrint(ws);
        return ws;
      }

      // ---- 建立各名冊 Sheet ----
      // 1) 護理師
      const nurses = await fetchActiveFromCollection('nurses');
      addSheet('護理師', '護理師名冊', COLS_NORMAL, nurses);

      // 2) 外籍照服員 caregivers
      const foreign = await fetchActiveFromCollection('caregivers');
      addSheet('外籍照服員', '外籍照服員名冊', COLS_FOREIGN, foreign, { isForeignSheet:true });

      // 3) 台籍照服員 localCaregivers
      const local = await fetchActiveFromCollection('localCaregivers');
      addSheet('台籍照服員', '台籍照服員名冊', COLS_NORMAL, local);

      // 4) 行政/其他 adminStaff
      const admin = await fetchActiveFromCollection('adminStaff');
      addSheet('行政其他', '行政/其他名冊', COLS_NORMAL, admin);

      // 5) 離職員工（合併）
      const inactive = await fetchInactiveMerged();
      addSheet('離職員工', '離職員工名冊（合併）', COLS_NORMAL, inactive, { includeSource:true });

      // 6) 證書照片分頁
      await addCertificatePhotoSheet('證書照片-護理師', nurses.map(e => ({ ...e, __categoryLabel: '護理師' })));
      await addCertificatePhotoSheet('證書照片-外籍照服員', foreign.map(e => ({ ...e, __categoryLabel: '外籍照服員' })));
      await addCertificatePhotoSheet('證書照片-其他', [
        ...local.map(e => ({ ...e, __categoryLabel: '台籍照服員' })),
        ...admin.map(e => ({ ...e, __categoryLabel: '行政/其他' }))
      ]);

      // ---- 下載 ----
      const y = new Date().getFullYear();
      const m = String(new Date().getMonth()+1).padStart(2,'0');
      const d = String(new Date().getDate()).padStart(2,'0');
      const filename = `人員名冊整合_${y}${m}${d}.xlsx`;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert('匯出失敗，請看 console');
    } finally {
      window.__exportingEmployeesXlsx = false;
    }
  }

// 綁定
  addEmployeeBtn.onclick = openForCreate;
  saveEmployeeBtn.onclick = handleSave;
  importExcelBtn.onclick = () => excelFileInput.click();
  excelFileInput.onchange = handleExcelImport;

  exportWordBtn.onclick = async () => {
    await exportAllToWordDocx();
  };

  exportExcelBtn.onclick = async () => {
    await exportAllToExcelXlsx();
  };

  printBtn.onclick = async () => {
    const content = await generateReportHTML();
    const w = window.open("", "_blank");
    w.document.write(content);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };


  // 一鍵刪除此分頁所有資料
  const deleteAllBtn = document.getElementById('delete-all-btn');
  const fixedScroll = document.getElementById('fixed-h-scroll');
  const scrollProxy = document.getElementById('scroll-proxy');

  if (scrollProxy) {
    // 設定一個足夠寬的 proxy 來產生橫向滑條
    scrollProxy.style.width = '4000px';
  }

  if (deleteAllBtn) {
    deleteAllBtn.onclick = async () => {
      const tab = activeTabDef();
      if (!tab) return;
      const col = tab.collection;
      const label = tab.label;

      if (!confirm(`⚠️ 確定要刪除「${label}」所有資料？此操作無法復原！`)) return;

      try {
        const snap = await db.collection(col).get();
        if (snap.empty) {
          alert('此分頁沒有資料可刪除');
          return;
        }
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert(`✔ 已刪除「${label}」所有資料`);
        loadAll();
      } catch (err) {
        console.error(err);
        alert('刪除失敗，請查看 console');
      }
    };
  }

  // 固定橫向滑條：同步所有表格的 scrollLeft
  if (fixedScroll) {
    fixedScroll.addEventListener('scroll', () => {
      TAB_DEFS.forEach(d => {
        const container = document.querySelector(`#${d.id}-panel .table-responsive`);
        if (container) container.scrollLeft = fixedScroll.scrollLeft;
      });
    });
  }

  certificateFileModalEl?.addEventListener('hidden.bs.modal', () => {
    activeCertificateIndex = null;
  });

  // 初始載入
  loadCurrentUserForEmployees().then(() => {
    loadAll();
  });
});
});
