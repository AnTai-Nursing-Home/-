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
    { id: 'foreignCaregivers', label: '外籍照服員', collection: 'foreignCaregivers' },
    { id: 'localCaregivers', label: '台籍照服員', collection: 'localCaregivers' },
    { id: 'adminStaff', label: '行政/其他', collection: 'adminStaff' },
  ];

  function buildTableHTML(tabId) {
    const tbodyId = `${tabId}-tbody`;
    return `
      <div class="tab-pane fade${tabId==='nurses'?' show active':''}" id="${tabId}-panel" role="tabpanel">
        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th class="sortable-header" data-sort="sortOrder">排序</th>
                <th class="sortable-header" data-sort="id">員編</th>
                <th class="sortable-header" data-sort="name">姓名</th>
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

  // 建出四個面板
  tablesWrap.innerHTML = TAB_DEFS.map(d => buildTableHTML(d.id)).join("");

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

  async function loadAndRender(collectionName, tbody) {
    tbody.innerHTML = `<tr><td colspan="23" class="text-center text-muted">讀取中…</td></tr>`;
    try {
      const snap = await db.collection(collectionName)
        .orderBy(sortConfig.key, sortConfig.order)
        .orderBy('id','asc')
        .get();

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="23" class="text-center text-muted">尚無資料</td></tr>`;
        return;
      }

      let html = "";
      snap.forEach(doc => {
        const e = doc.data();
        html += `
          <tr data-id="${doc.id}">
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
            <td>
              <button class="btn btn-sm btn-primary btn-edit">編輯</button>
              <button class="btn btn-sm btn-danger btn-del ms-1">刪除</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="23" class="text-center text-danger">讀取失敗</td></tr>`;
    }
  }

  function loadAll() {
    TAB_DEFS.forEach(d => loadAndRender(d.collection, tbodys[d.id]));
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

  function fillFormFromRow(row) {
    const cell = idx => (row.cells[idx]?.textContent || '').trim();
    // 依表頭順序
    sortOrderInput.value = cell(0);
    idInput.value = cell(1);
    nameInput.value = cell(2);
    genderInput.value = cell(3);
    birthdayInput.value = cell(4);
    idCardInput.value = cell(5);
    hireDateInput.value = cell(6);
    titleInput.value = cell(7);
    phoneInput.value = cell(8);
    daytimePhoneInput.value = cell(9);
    addressInput.value = cell(10);
    emgNameInput.value = cell(11);
    emgRelationInput.value = cell(12);
    emgPhoneInput.value = cell(13);
    nationalityInput.value = cell(14);
    licenseTypeInput.value = cell(15);
    licenseNumberInput.value = cell(16);
    licenseRenewDateInput.value = cell(17);
    longtermCertNumberInput.value = cell(18);
    longtermExpireDateInput.value = cell(19);
    educationInput.value = cell(20);
    schoolInput.value = cell(21);
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
      longtermExpireDate: formatDateInput(longtermExpireDateInput.value.trim()),
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
        currentEditing = { collection: def.collection, docId: id };
        typeInput.value = def.collection;
        fillFormFromRow(row);
        document.getElementById('employee-modal-title').textContent = `編輯 - ${def.label}`;
        idInput.disabled = false;
        employeeModal.show();
      } else if (e.target.classList.contains('btn-del')) {
        if (confirm(`確定刪除 ${id}？`)) {
          db.collection(def.collection).doc(id).delete().then(loadAll);
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
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const list = XLSX.utils.sheet_to_json(sheet);
        if (list.length === 0) {
          importStatus.className = "alert alert-danger";
          importStatus.textContent = "表內沒有資料";
          return;
        }

        // 映射：Excel 欄名 -> 欄位
        const map = {
          "排序": "sortOrder",
          "員編": "id",
          "姓名": "name",
          "性別": "gender",
          "生日": "birthday",
          "身分證字號": "idCard",
          "到職日": "hireDate",
          "職稱": "title",
          "手機": "phone",
          "日間電話": "daytimePhone",
          "地址": "address",
          "緊急聯絡人姓名": "emergencyName",
          "緊急聯絡人關係": "emergencyRelation",
          "緊急聯絡人電話": "emergencyPhone",
          "國籍": "nationality",
          "證照種類": "licenseType",
          "發證字號": "licenseNumber",
          "換證日期": "licenseRenewDate",
          "長照證號": "longtermCertNumber",
          "長照證效期": "longtermExpireDate",
          "學歷": "education",
          "畢業學校": "school",
        };

        const requires = ["員編","姓名"];
        for (const c of requires) {
          if (!list[0].hasOwnProperty(c)) {
            importStatus.className = "alert alert-danger";
            importStatus.textContent = `缺少必要欄位：${c}`;
            return;
          }
        }

        const batch = db.batch();
        list.forEach(row => {
          const id = String(row["員編"] || "").trim();
          if (!id) return;
          const ref = db.collection(col).doc(id);
          const payload = {};
          Object.entries(map).forEach(([cn, key]) => {
            let v = row[cn];
            if (["生日","到職日","換證日期","長照證效期"].includes(cn)) v = normalizeDateMaybe(v);
            if (cn === "排序") v = parseInt(v) || 999;
            if (typeof v === "string") v = v.trim();
            payload[key] = v ?? "";
          });
          // 必填修正
          payload.id = id;
          if (!payload.sortOrder) payload.sortOrder = 999;
          batch.set(ref, payload, { merge: true });
        });

        await batch.commit();
        importStatus.className = "alert alert-success";
        importStatus.textContent = "匯入完成，將重新整理…";
        setTimeout(() => window.location.reload(), 1500);
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
    const content = await generateReportHTML();
    const blob = new Blob(['\ufeff', content], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "人員名冊.xls"; a.click();
    URL.revokeObjectURL(url);
  };

  printBtn.onclick = async () => {
    const content = await generateReportHTML();
    const w = window.open("", "_blank");
    w.document.write(content);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  // 初始載入
  loadAll();
});
