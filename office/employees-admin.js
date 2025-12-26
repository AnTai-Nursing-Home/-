function buildTableHTML(tabId) {
    const tbodyId = `${tabId}-tbody`;
    const extraHead = (tabId === 'inactiveEmployees') ? `<th class="sortable-header" data-sort="sourceLabel">職類</th>` : '';
    return `
      <div class="tab-pane fade${tabId==='nurses'?' show active':''}" id="${tabId}-panel" role="tabpanel">
        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th class="sortable-header" data-sort="sortOrder">排序</th>
                <th class="sortable-header" data-sort="id">員編</th>
                <th class="sortable-header" data-sort="name">姓名</th>
                ${extraHead}
                <th>性別</th>
                <th>生日</th>
                <th>身分證字號</th>
                <th>到職日</th>
                <th>職稱</th>
                <th>手機</th>
                <th>日間電話</th>
                <th>地址</th>
                <th>緊急聯絡人</th>
                <th>關係</th>
                <th>緊急電話</th>
                <th>國籍</th>
                <th>證照種類</th>
                <th>發證字號</th>
                <th>換證日期</th>
                <th>長照證號</th>
                <th>長照證效期</th>
                <th>學歷</th>
                <th>畢業學校</th>
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
  .tab-pane { min-height: 600px; overflow-y: auto; padding-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  table td, table th { padding: 6px 8px; vertical-align: top; }
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

  const employeeForm = document.getElementById('employee-form');
  const typeInput = document.getElementById('employee-type');
  const sortOrderInput = document.getElementById('employee-sortOrder');
  const idInput = document.getElementById('employee-id');
  const nameInput = document.getElementById('employee-name');
  const genderInput = document.getElementById('employee-gender');
  const birthdayInput = document.getElementById('employee-birthday');
  const idCardInput = document.getElementById('employee-idCard');
  const hireDateInput = document.getElementById('employee-hireDate');
  const titleInput = document.getElementById('employee-title');
  const phoneInput = document.getElementById('employee-phone');
  const daytimePhoneInput = document.getElementById('employee-daytimePhone');
  const addressInput = document.getElementById('employee-address');
  const emgNameInput = document.getElementById('employee-emgName');
  const emgRelationInput = document.getElementById('employee-emgRelation');
  const emgPhoneInput = document.getElementById('employee-emgPhone');
  const nationalityInput = document.getElementById('employee-nationality');
  const licenseTypeInput = document.getElementById('employee-licenseType');
  const licenseNumberInput = document.getElementById('employee-licenseNumber');
  const licenseRenewDateInput = document.getElementById('employee-licenseRenewDate');
  const longtermCertNumberInput = document.getElementById('employee-longtermCertNumber');
  const longtermExpireDateInput = document.getElementById('employee-longtermExpireDate');
  const educationInput = document.getElementById('employee-education');
  const schoolInput = document.getElementById('employee-school');

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
    return (tabId === 'inactiveEmployees') ? 24 : 23;
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


  function buildRowHTML(e, opts) {
    const includeSource = !!opts.includeSource;
    const actionLabel = opts.actionLabel || '操作';
    const sourceTd = includeSource ? `<td>${pick(e, ['sourceLabel'])}</td>` : '';

    return `
      <tr data-id="${pick(e, ['docId','id'])}" data-collection="${pick(e, ['collection'])}">
        <td>${pick(e, ['sortOrder'])}</td>
        <td>${pick(e, ['id','docId'])}</td>
        <td>${pick(e, ['name'])}</td>
        ${includeSource ? sourceTd : ""}
        <td>${pick(e, ['gender'])}</td>
        <td>${pick(e, ['birthday'])}</td>
        <td>${pick(e, ['idCard','nationalId','idNumber'])}</td>
        <td>${pick(e, ['hireDate'])}</td>
        <td>${pick(e, ['title'])}</td>
        <td>${pick(e, ['phone'])}</td>
        <td>${pick(e, ['daytimePhone','email'])}</td>
        <td>${pick(e, ['address'])}</td>
        <td>${pick(e, ['emergencyName','emgName'])}</td>
        <td>${pick(e, ['emergencyRelation','emgRelation'])}</td>
        <td>${pick(e, ['emergencyPhone','emgPhone'])}</td>
        <td>${pick(e, ['nationality'])}</td>
        <td>${pick(e, ['licenseType'])}</td>
        <td>${pick(e, ['licenseNumber','licenseNo'])}</td>
        <td>${pick(e, ['licenseRenewDate'])}</td>
        <td>${pick(e, ['longtermCertNumber','ltcNo'])}</td>
        <td>${pick(e, ['longtermExpireDate','ltcExpiry'])}</td>
        <td>${pick(e, ['education'])}</td>
        <td>${pick(e, ['school'])}</td>
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
    idInput.disabled = false;
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
    const cell = idx => (row.cells[idx]?.textContent || '').trim();
    const isInactive = !!row.closest('#inactiveEmployees-panel');
    const off = isInactive ? 1 : 0; // 離職分頁多一欄「職類」

    // 依表頭順序
    sortOrderInput.value = cell(0);
    idInput.value = cell(1);
    nameInput.value = cell(2);

    genderInput.value = cell(3 + off);
    birthdayInput.value = toISODateForInput(cell(4 + off));
    idCardInput.value = cell(5 + off);
    hireDateInput.value = toISODateForInput(cell(6 + off));
    titleInput.value = cell(7 + off);
    phoneInput.value = cell(8 + off);
    daytimePhoneInput.value = cell(9 + off);
    addressInput.value = cell(10 + off);
    emgNameInput.value = cell(11 + off);
    emgRelationInput.value = cell(12 + off);
    emgPhoneInput.value = cell(13 + off);
    nationalityInput.value = cell(14 + off);
    licenseTypeInput.value = cell(15 + off);
    licenseNumberInput.value = cell(16 + off);
    licenseRenewDateInput.value = toISODateForInput(cell(17 + off));
    longtermCertNumberInput.value = cell(18 + off);
        // 長照證效期常是「起-迄」區間字串，不能用 <input type=date> 的 ISO 轉換
    longtermExpireDateInput.value = cell(19 + off);

    educationInput.value = cell(20 + off);
    schoolInput.value = cell(21 + off);
  }

  async function handleSave() {
    const id = idInput.value.trim();
    const payload = {
      sortOrder: parseInt(sortOrderInput.value) || 999,
      id,
      name: nameInput.value.trim(),
      gender: genderInput.value,
      birthday: formatDateInput(birthdayInput.value.trim()),
      idCard: idCardInput.value.trim().toUpperCase(),
      hireDate: formatDateInput(hireDateInput.value.trim()),
      title: titleInput.value.trim(),
      phone: phoneInput.value.trim(),
      daytimePhone: daytimePhoneInput.value.trim(),
      address: addressInput.value.trim(),
      emergencyName: emgNameInput.value.trim(),
      emergencyRelation: emgRelationInput.value.trim(),
      emergencyPhone: emgPhoneInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      licenseType: licenseTypeInput.value.trim(),
      licenseNumber: licenseNumberInput.value.trim(),
      licenseRenewDate: formatDateInput(licenseRenewDateInput.value.trim()),
      longtermCertNumber: longtermCertNumberInput.value.trim(),
      // 長照證效期保留原樣（可能是區間字串，例如 109/10/23-115/10/22）
      longtermExpireDate: longtermExpireDateInput.value.trim(),
      education: educationInput.value.trim(),
      school: schoolInput.value.trim(),
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
        document.getElementById('employee-modal-title').textContent = `編輯 - ${label}`;
        idInput.disabled = false;
        employeeModal.show();
      } else if (e.target.classList.contains('btn-del')) {
        const collection = def.collection || row.dataset.collection;
        if (def.id === 'inactiveEmployees') {
          if (confirm(`確定恢復在職：${id}？`)) {
            db.collection(collection).doc(id).set({ isActive: true }, { merge: true }).then(loadAll);
          }
        } else {
          if (confirm(`確定設為離職：${id}？`)) {
            db.collection(collection).doc(id).set({ isActive: false }, { merge: true }).then(loadAll);
          }
        }
      }
});
  });

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
          "身份證字號": "idCard",
          "身份証字號": "idCard",
          "到職日": "hireDate",
          "到職日期": "hireDate",
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
            if (["birthday", "hireDate", "licenseRenewDate"].includes(key)) {
              v = normalizeDateMaybe(v);
            }

            if (key === "sortOrder") v = parseInt(v, 10) || 999;
            if (typeof v === "string") v = v.trim();

            payload[key] = v ?? "";
          });

          // 補齊必填
          payload.id = id;
          if (!payload.sortOrder) payload.sortOrder = 999;

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
          <td>${e.gender ?? ''}</td>
          <td>${e.birthday ?? ''}</td>
          <td>${e.idCard ?? ''}</td>
          <td>${e.hireDate ?? ''}</td>
          <td>${e.title ?? ''}</td>
          <td>${e.phone ?? ''}</td>
          <td>${e.daytimePhone ?? ''}</td>
          <td>${e.address ?? ''}</td>
          <td>${e.emergencyName ?? ''}</td>
          <td>${e.emergencyRelation ?? ''}</td>
          <td>${e.emergencyPhone ?? ''}</td>
          <td>${e.nationality ?? ''}</td>
          <td>${e.licenseType ?? ''}</td>
          <td>${e.licenseNumber ?? ''}</td>
          <td>${e.licenseRenewDate ?? ''}</td>
          <td>${e.longtermCertNumber ?? ''}</td>
          <td>${e.longtermExpireDate ?? ''}</td>
          <td>${e.education ?? ''}</td>
          <td>${e.school ?? ''}</td>
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
        <th>排序</th><th>員編</th><th>姓名</th><th>性別</th><th>生日</th><th>身分證字號</th>
        <th>到職日</th><th>職稱</th><th>手機</th><th>日間電話</th><th>地址</th>
        <th>緊急聯絡人</th><th>關係</th><th>緊急電話</th><th>國籍</th>
        <th>證照種類</th><th>發證字號</th><th>換證日期</th><th>長照證號</th><th>長照證效期</th>
        <th>學歷</th><th>畢業學校</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>
    `;
  }

  
  // ========= Excel 匯出（整合所有名冊到同一個 .xlsx，分頁區分） =========
  async function exportAllToExcelXlsx() {
    if (window.__exportingEmployeesXlsx) return;
    window.__exportingEmployeesXlsx = true;

    try {
      if (typeof ExcelJS === 'undefined') {
        alert('ExcelJS 尚未載入，無法匯出 .xlsx（含樣式）。');
        return;
      }

      // ---- 欄位定義：與表頭一致 ----
      // 注意：歷史資料可能有不同欄位名稱，這裡做多 key fallback
      const COLS_BASE = [
        { header: '排序', key: 'sortOrder', width: 6 },
        { header: '員編', key: 'id', width: 10 },
        { header: '姓名', key: 'name', width: 14 },
        // 離職分頁才有「職類」
        { header: '性別', key: 'gender', width: 6 },
        { header: '生日', key: 'birthday', width: 12 },
        { header: '身分證字號', key: 'idCard', width: 16 },
        { header: '到職日', key: 'hireDate', width: 12 },
        { header: '職稱', key: 'title', width: 12 },
        { header: '手機', key: 'phone', width: 16 },
        { header: '日間電話', key: 'daytimePhone', width: 16 },
        { header: '地址', key: 'address', width: 32 },
        { header: '緊急聯絡人', key: 'emergencyName', width: 14 },
        { header: '關係', key: 'emergencyRelation', width: 10 },
        { header: '緊急電話', key: 'emergencyPhone', width: 16 },
        { header: '國籍', key: 'nationality', width: 10 },
        { header: '證照種類', key: 'licenseType', width: 16 },
        { header: '發證字號', key: 'licenseNumber', width: 20 },
        { header: '換證日期', key: 'licenseRenewDate', width: 12 },
        { header: '長照證號', key: 'longtermCertNumber', width: 20 },
        { header: '長照證效期', key: 'longtermExpireDate', width: 14 },
        { header: '學歷', key: 'education', width: 12 },
        { header: '畢業學校', key: 'school', width: 26 },
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

      function addSheet(sheetName, title, cols, dataRows, { includeSource=false } = {}) {
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
            gender: getVal(e, ['gender']),
            birthday: getVal(e, ['birthday']),
            idCard: getVal(e, ['idCard','nationalId','idNumber']),
            hireDate: getVal(e, ['hireDate']),
            title: getVal(e, ['title']),
            phone: getVal(e, ['phone']),
            daytimePhone: getVal(e, ['daytimePhone','email']), // 舊資料誤用 email
            address: getVal(e, ['address']),
            emergencyName: getVal(e, ['emergencyName','emgName','emergencyContact']),
            emergencyRelation: getVal(e, ['emergencyRelation','emgRelation']),
            emergencyPhone: getVal(e, ['emergencyPhone','emgPhone']),
            nationality: getVal(e, ['nationality']),
            licenseType: getVal(e, ['licenseType']),
            licenseNumber: getVal(e, ['licenseNumber','licenseNo']),
            licenseRenewDate: getVal(e, ['licenseRenewDate']),
            longtermCertNumber: getVal(e, ['longtermCertNumber','ltcNo']),
            longtermExpireDate: getVal(e, ['longtermExpireDate','ltcExpiry']),
            education: getVal(e, ['education']),
            school: getVal(e, ['school']),
            sourceLabel: includeSource ? getVal(e, ['sourceLabel']) : undefined
          };

          const values = finalCols.map(c => rowObj[c.key] ?? '');
          const r = ws.addRow(values);
          applyRowStyle(r, { header:false });
        });

        // Auto filter
        ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: finalCols.length } };

        setPrint(ws);
        return ws;
      }

      // ---- 建立各名冊 Sheet ----
      // 1) 護理師
      const nurses = await fetchActiveFromCollection('nurses');
      addSheet('護理師', '護理師名冊', COLS_BASE, nurses);

      // 2) 外籍照服員 caregivers
      const foreign = await fetchActiveFromCollection('caregivers');
      addSheet('外籍照服員', '外籍照服員名冊', COLS_BASE, foreign);

      // 3) 台籍照服員 localCaregivers
      const local = await fetchActiveFromCollection('localCaregivers');
      addSheet('台籍照服員', '台籍照服員名冊', COLS_BASE, local);

      // 4) 行政/其他 adminStaff
      const admin = await fetchActiveFromCollection('adminStaff');
      addSheet('行政其他', '行政/其他名冊', COLS_BASE, admin);

      // 5) 離職員工（合併）
      const inactive = await fetchInactiveMerged();
      addSheet('離職員工', '離職員工名冊（合併）', COLS_BASE, inactive, { includeSource:true });

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
    const content = await generateReportHTML();
    const blob = new Blob(['\ufeff', content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "人員名冊.doc"; a.click();
    URL.revokeObjectURL(url);
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

  // 初始載入
  loadAll();
});
});
