// education-training-admin.js
// 教育訓練管理：課程管理 / 出席點名 / 員工時數 / Excel 匯出（ExcelJS）
//
// Firestore collections:
// - education_courses
// - education_attendance
//
// Employee sources:
// - adminStaff (社工/其他)
// - caregivers (外籍照服員)
// - localCaregivers (本國照服員)
// - nurses (護理師)

(function(){
  let started=false;
  function canStart(){ return (typeof db !== 'undefined') && db && typeof db.collection === 'function'; }
  function startNow(){ if(started) return; started=true; document.dispatchEvent(new Event('edu-training-init')); }
  document.addEventListener('firebase-ready', ()=>startNow());
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(()=>{ if(canStart()) startNow(); }, 250);
  } else {
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>{ if(canStart()) startNow(); }, 250));
  }
  let tries=0;
  const t=setInterval(()=>{ if(started){clearInterval(t);return;} if(canStart()){startNow();clearInterval(t);} if(++tries>30) clearInterval(t); }, 400);
})();

document.addEventListener('edu-training-init', ()=>{
  // -----------------------------
  // Config
  // -----------------------------
  const COL_COURSES = 'education_courses';
  const COL_ATTEND  = 'education_attendance';

  // For requiredFor mapping (modal checkboxes)
  const REQ_KEYS = ['nurses','caregivers','localCaregivers','adminStaff'];
  const REQ_LABEL = {
    nurses: '護理師',
    caregivers: '外籍照服員',
    localCaregivers: '本國照服員',
    adminStaff: '社工/其他'
  };

  // -----------------------------
  // DOM
  // -----------------------------
  const statusBar = document.getElementById('status-bar');

  const btnRefresh = document.getElementById('btn-refresh');
  const btnAddCourse = document.getElementById('btn-add-course');
  const btnExportExcel = document.getElementById('btn-export-excel');

  const courseSearch = document.getElementById('course-search');
  const courseCategoryFilter = document.getElementById('course-category-filter');
  const courseTypeAllBtn = document.getElementById('course-type-all');
  const courseTypeOnlineBtn = document.getElementById('course-type-online');
  const courseTypeInpersonBtn = document.getElementById('course-type-inperson');
  const courseTypeHint = document.getElementById('course-type-hint');
  const coursesTbody = document.getElementById('courses-tbody');

  const attendanceCourseSelect = document.getElementById('attendance-course-select');
  const attendanceCourseInfo = document.getElementById('attendance-course-info');
  const attendanceTbody = document.getElementById('attendance-tbody');
  const attendanceSearch = document.getElementById('attendance-search');
  const attendanceCountPill = document.getElementById('attendance-count-pill');
  const attendanceCheckedPill = document.getElementById('attendance-checked-pill');
  const attendanceSelectAll = document.getElementById('attendance-select-all');
  const attendanceClearAll = document.getElementById('attendance-clear-all');
  const attendanceSave = document.getElementById('attendance-save');

  // Verify
  const verifyCourseSelect = document.getElementById('verify-course-select');
  const verifyCourseDelivery = document.getElementById('verify-course-delivery');
  const verifyCourseInfo = document.getElementById('verify-course-info');
  const verifySearch = document.getElementById('verify-search');
  const verifyTbody = document.getElementById('verify-tbody');
  const verifyTotalPill = document.getElementById('verify-total-pill');
  const verifyAttendedPill = document.getElementById('verify-attended-pill');
  const verifyMissedPill = document.getElementById('verify-missed-pill');
  const verifyMismatchPill = document.getElementById('verify-mismatch-pill');
  const verifyMode = document.getElementById('verify-mode');
  const verifyModeCourse = document.getElementById('verify-mode-course');
  const verifyModeStaff = document.getElementById('verify-mode-staff');
  const verifyStaffSelect = document.getElementById('verify-staff-select');
  const verifyYear = document.getElementById('verify-year');
  const verifyCategory = document.getElementById('verify-category');
  const verifyDelivery = document.getElementById('verify-delivery');
  const verifyCourseName = document.getElementById('verify-course-name');
  const verifyStaffInfo = document.getElementById('verify-staff-info');

  const hoursYear = document.getElementById('hours-year');
  const hoursRecalc = document.getElementById('hours-recalc');
  const hoursTbody = document.getElementById('hours-tbody');
  const hoursSearch = document.getElementById('hours-search');
  const hoursTotalPill = document.getElementById('hours-total-pill');
  const hoursPeoplePill = document.getElementById('hours-people-pill');

  // Modal (Course)
  const courseModalEl = document.getElementById('course-modal');
  const courseModal = (window.bootstrap && courseModalEl) ? new bootstrap.Modal(courseModalEl) : null;
  const courseModalTitle = document.getElementById('course-modal-title');
  const courseIdEl = document.getElementById('course-id');
  const courseDateEl = document.getElementById('course-date');
  const courseHoursEl = document.getElementById('course-hours');
  const courseTitleEl = document.getElementById('course-title');
  const courseCategoryEl = document.getElementById('course-category');
  const courseInstructorEl = document.getElementById('course-instructor');
  const courseDescEl = document.getElementById('course-desc');
  const courseSaveBtn = document.getElementById('course-save');

  // req checkboxes
  const reqCheckboxes = {
    nurses: document.getElementById('req-nurses'),
    caregivers: document.getElementById('req-caregivers'),
    localCaregivers: document.getElementById('req-localCaregivers'),
    adminStaff: document.getElementById('req-adminStaff'),
  };

  // -----------------------------
  // State
  // -----------------------------
  let actor = { id:'unknown', name:'unknown', username:'' }; // 登入者
  let employees = [];         // unified employees
  let courses = [];           // course docs
  let courseTypeFilter = ''; // '', '線上', '實體'
  let attendanceMap = new Map(); // key: attendDocId -> data
  let currentAttendanceCourseId = '';
  let currentAttendanceRows = []; // view rows (employees filtered)
  let currentVerifyRows = []; // verify view rows
  let staffAttendanceByCourseId = new Map(); // courseId -> attendance doc
  let currentVerifyMode = 'course';

  // -----------------------------
  // Utils
  // -----------------------------
  function showStatus(msg, type='info'){
    if(!statusBar) return;
    statusBar.className = `alert alert-${type}`;
    statusBar.textContent = msg;
    statusBar.classList.remove('d-none');
  }
  function hideStatus(){ if(statusBar) statusBar.classList.add('d-none'); }

  function ymd(d){
    if(!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    if(isNaN(dt)) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const dd = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  function nowStr(){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    const hh=String(d.getHours()).padStart(2,'0');
    const mm=String(d.getMinutes()).padStart(2,'0');
    return `${y}/${m}/${dd} ${hh}:${mm}`;
  }

  function safeStr(v){ return (v==null?'':String(v)); }

  function contains(hay, needle){
    if(!needle) return true;
    return safeStr(hay).toLowerCase().includes(String(needle).trim().toLowerCase());
  }

  function requiredForText(arr){
    if(!arr || !arr.length) return '不限';
    return arr.map(k=>`${REQ_LABEL[k]||k}`).join('、');
  }

  function staffRoleFromSource(source){
    // 用 source 當作職別 key（與 requiredFor 相同）
    return source;
  }

  function staffSourceLabel(source){
    return `${REQ_LABEL[source] || source}（${source}）`;
  }

  function makeAttendDocId(courseId, emp){
    return `${courseId}__${emp.source}__${emp.staffId}`;
  }
  // -----------------------------
  // 登入者 / 匯出人（沿用你站內各系統存法，優先 sessionStorage）
  // -----------------------------
  const AUTH_KEYS = ['officeAuth', 'antai_session_user', 'nurseAuth', 'caregiverAuth'];

  function getAuthUser(){
    const stores = [sessionStorage, localStorage];
    for (const store of stores){
      for (const key of AUTH_KEYS){
        try{
          const raw = store.getItem(key);
          if(!raw) continue;
          const a = JSON.parse(raw);
          const staffId = String(a?.staffId || a?.id || a?.empId || a?.employeeId || a?.uid || a?.username || '').trim();
          const name = String(a?.displayName || a?.name || a?.fullName || a?.staffName || '').trim();
          const username = String(a?.username || a?.user || '').trim();
          if(staffId) return { staffId, name, username, _key:key };
        }catch(_e){}
      }
    }
    return null;
  }

  function getActor(){
    const au = getAuthUser();
    if(!au) return { id:'unknown', name:'unknown', username:'' };
    return {
      id: au.staffId || 'unknown',
      name: au.name || 'unknown',
      username: au.username || ''
    };
  }

  function renderLoginInfo(){
    const el = document.getElementById('loginInfo');
    if(!el) return;
    const a = actor;
    el.textContent = (a.id==='unknown') ? '未登入' : '登入者：' + a.id + ' ' + a.name;
  }

  function ensureLogin(){
    const au = getAuthUser();
    if(!au){
      alert('請先登入後再進入教育訓練管理系統。');
      // 辦公室入口
      location.href = 'office.html';
      return false;
    }
    return true;
  }

  function getExportUser(){
    const a = actor;
    if(a && a.id && a.id!=='unknown'){
      return [a.id, a.name].filter(Boolean).join(' ').trim();
    }
    // fallback
    const au = getAuthUser();
    if(!au) return '';
    return [au.staffId, au.name].filter(Boolean).join(' ').trim();
  }

  function nowIso(){
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function attachAuditFields(obj, isNew){
    const a = actor;
    const time = nowIso();
    if(isNew){
      obj.createdAt = obj.createdAt || time;
      obj.createdBy = obj.createdBy || getExportUser();
      obj.createdById = obj.createdById || a.id;
      obj.createdByName = obj.createdByName || a.name;
      obj.createdByUsername = obj.createdByUsername || (a.username||'');
    }
    obj.updatedAt = time;
    obj.updatedBy = getExportUser();
    obj.updatedById = a.id;
    obj.updatedByName = a.name;
    obj.updatedByUsername = a.username || '';
    return obj;
  }

  // -----------------------------
  // Load employees (4 collections)
  // -----------------------------
  async function loadEmployees(){
    const sources = ['adminStaff','caregivers','localCaregivers','nurses'];
    const snaps = await Promise.all(sources.map(col=>db.collection(col).get()));
    const list = [];
    snaps.forEach((snap, idx)=>{
      const source = sources[idx];
      snap.forEach(doc=>{
        const d = doc.data() || {};
        const staffId = String(d.id || doc.id || '').trim();
        const name = String(d.name || '').trim();
        const title = String(d.title || d.role || '').trim();
        const sortOrder = (d.sortOrder==null? 9999 : Number(d.sortOrder));
        if(!staffId && !doc.id) return;
        list.push({
          staffId: staffId || String(doc.id),
          name: name || '(未命名)',
          source,
          title,
          sortOrder: isNaN(sortOrder)? 9999 : sortOrder,
        });
      });
    });

    // sort: by source then sortOrder then name
    list.sort((a,b)=>{
      const s = a.source.localeCompare(b.source);
      if(s) return s;
      const o = (a.sortOrder||9999) - (b.sortOrder||9999);
      if(o) return o;
      return a.name.localeCompare(b.name, 'zh-Hant', {numeric:true});
    });

    employees = list;
  }

  // -----------------------------
  // Load courses / attendance
  // -----------------------------
  async function loadCourses(){
    const snap = await db.collection(COL_COURSES).orderBy('date', 'desc').get();
    const arr = [];
    snap.forEach(doc=>{
      const d = doc.data() || {};
      arr.push({
        id: doc.id,
        date: d.date || '',
        title: d.title || '',
        category: d.category || '',
        hours: Number(d.hours || 0),
        instructor: d.instructor || '',
        description: d.description || '',
        requiredFor: Array.isArray(d.requiredFor) ? d.requiredFor : [],
        createdAt: d.createdAt || null,
        createdBy: d.createdBy || '',
        updatedAt: d.updatedAt || null,
        updatedBy: d.updatedBy || '',
      });
    });
    courses = arr;
  }

  async function loadAttendanceForCourse(courseId){
    attendanceMap = new Map();
    if(!courseId) return;

    // query by courseId
    const snap = await db.collection(COL_ATTEND).where('courseId','==',courseId).get();
    snap.forEach(doc=>{
      attendanceMap.set(doc.id, {id: doc.id, ...(doc.data()||{})});
    });
  }


  async function loadAttendanceForStaff(source, staffId){
    staffAttendanceByCourseId = new Map();
    if(!source || !staffId) return;

    try{
      const snap = await db.collection(COL_ATTEND)
        .where('staffSource','==', source)
        .where('staffId','==', staffId)
        .get();
      snap.forEach(doc=>{
        const d = doc.data() || {};
        const cid = String(d.courseId || '').trim();
        if(cid) staffAttendanceByCourseId.set(cid, {id: doc.id, ...d});
      });
      return;
    }catch(e){
      console.warn('loadAttendanceForStaff indexed query failed, fallback to scan:', e);
    }

    const snap = await db.collection(COL_ATTEND).get();
    snap.forEach(doc=>{
      const d = doc.data() || {};
      if(String(d.staffSource||'')===source && String(d.staffId||'')===staffId){
        const cid = String(d.courseId || '').trim();
        if(cid) staffAttendanceByCourseId.set(cid, {id: doc.id, ...d});
      }
    });
  }

  // -----------------------------
  // Render: Courses
  // -----------------------------
  function renderCourses(){
    if(!coursesTbody) return;

    const q = safeStr(courseSearch?.value||'').trim();
    const cat = safeStr(courseCategoryFilter?.value||'').trim();

    // populate category filter options from existing courses
    const cats = Array.from(new Set(courses.map(c=>safeStr(c.category).trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    if(courseCategoryFilter){
      const old = courseCategoryFilter.value || '';
      const opts = ['<option value="">全部</option>'].concat(cats.map(v=>`<option value="${v}">${v}</option>`));
      courseCategoryFilter.innerHTML = opts.join('');
      // keep selection if possible
      if(old && cats.includes(old)) courseCategoryFilter.value = old;
    }

    const rows = courses.filter(c=>{
      if(typeof courseTypeFilter !== 'undefined' && courseTypeFilter && safeStr(c.delivery).trim() !== courseTypeFilter) return false;
      if(cat && safeStr(c.category).trim() !== cat) return false;
      if(delv && safeStr(c.delivery).trim() !== delv) return false;
      if(!q) return true;
      return contains(c.title, q) || contains(c.instructor, q);
    });

    coursesTbody.innerHTML = rows.map(c=>{
      return `
        <tr data-id="${c.id}">
          <td>${safeStr(c.date)}</td>
          <td>
            <div class="fw-semibold">${safeStr(c.title)}</div>
            <div class="small muted">${safeStr(c.description)}</div>
          </td>
          <td>${safeStr(c.category)}</td>
          <td class="text-end">${Number(c.hours||0).toFixed(1).replace(/\.0$/,'')}</td>
          <td>${safeStr(c.instructor)}</td>
          <td>${requiredForText(c.requiredFor)}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1 btn-edit"><i class="fa-regular fa-pen-to-square me-1"></i>編輯</button>
            <button class="btn btn-sm btn-outline-danger btn-del"><i class="fa-regular fa-trash-can me-1"></i>刪除</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="7" class="text-center text-muted py-4">目前沒有課程</td></tr>`;

    // also refresh attendance course select
    renderCourseSelect();
  }

  function renderCourseSelect(){
    if(!attendanceCourseSelect) return;

    const old = attendanceCourseSelect.value || '';
    const delv = safeStr(verifyCourseDelivery?.value||'').trim();
    const list = courses.filter(c=> !delv || safeStr(c.delivery).trim()===delv);
    const opts = [`<option value="" disabled ${old?'':'selected'}>請選擇課程</option>`]
      .concat(list.map(c=>{
        const label = `${c.date || '未填日期'}｜${c.title}`;
        const sel = (c.id===old) ? 'selected' : '';
        return `<option value="${c.id}" ${sel}>${label}</option>`;
      }));

    attendanceCourseSelect.innerHTML = opts.join('');

    // verify select 同步
    renderVerifyCourseDeliveryOptions();
    renderVerifyCourseSelect();
    renderVerifyStaffSelect();
    fillVerifyYearOptions();
    renderVerifyCategoryOptions();
    renderVerifyDeliveryOptions();

    // if old not present, reset
    const still = courses.some(c=>c.id===old);
    if(!still){
      attendanceCourseSelect.value = '';
      currentAttendanceCourseId = '';
      attendanceCourseInfo.textContent = '尚未選擇課程。';
      attendanceTbody.innerHTML = '';
      setAttendancePills(0,0);
    }
  }

  // -----------------------------
  // Course modal
  // -----------------------------
  function resetCourseModal(){
    courseIdEl.value = '';
    courseDateEl.value = ymd(new Date());
    courseHoursEl.value = '1';
    courseTitleEl.value = '';
    courseCategoryEl.value = '';
    courseInstructorEl.value = '';
    courseDescEl.value = '';
    REQ_KEYS.forEach(k=>{ if(reqCheckboxes[k]) reqCheckboxes[k].checked = false; });
  }

  function fillCourseModal(course){
    courseIdEl.value = course.id;
    courseDateEl.value = course.date || '';
    courseHoursEl.value = String(course.hours || 0);
    courseTitleEl.value = course.title || '';
    courseCategoryEl.value = course.category || '';
    courseInstructorEl.value = course.instructor || '';
    courseDescEl.value = course.description || '';
    REQ_KEYS.forEach(k=>{ if(reqCheckboxes[k]) reqCheckboxes[k].checked = (course.requiredFor||[]).includes(k); });
  }

  function collectCourseModal(){
    const requiredFor = REQ_KEYS.filter(k=> reqCheckboxes[k] && reqCheckboxes[k].checked);
    return {
      date: safeStr(courseDateEl.value).trim(),
      hours: Number(courseHoursEl.value || 0),
      title: safeStr(courseTitleEl.value).trim(),
      category: safeStr(courseCategoryEl.value).trim(),
      instructor: safeStr(courseInstructorEl.value).trim(),
      description: safeStr(courseDescEl.value).trim(),
      requiredFor
    };
  }

  async function saveCourse(){
    const payload = collectCourseModal();
    if(!payload.date || !payload.title){
      alert('日期與課程名稱為必填。');
      return;
    }
    if(!isFinite(payload.hours) || payload.hours < 0){
      alert('時數格式不正確。');
      return;
    }
    const id = safeStr(courseIdEl.value).trim();

    try{
      showStatus('儲存中...', 'info');
      if(id){
        await db.collection(COL_COURSES).doc(id).set(attachAuditFields({ ...payload }, false), { merge:true });
      } else {
        await db.collection(COL_COURSES).add(attachAuditFields({ ...payload }, true));
      }
      if(courseModal) courseModal.hide();
      await refreshAll();
      showStatus('已儲存課程。', 'success');
      setTimeout(hideStatus, 1200);
    }catch(e){
      console.error(e);
      showStatus('儲存失敗：' + (e?.message || e), 'danger');
    }
  }

  async function deleteCourse(courseId){
    if(!confirm('確定要刪除這門課程？\n\n提醒：出席紀錄會一併刪除（以 courseId 查找）。')) return;
    try{
      showStatus('刪除中...', 'info');
      await db.collection(COL_COURSES).doc(courseId).delete();

      // delete attendance docs for this course (best-effort)
      const snap = await db.collection(COL_ATTEND).where('courseId','==',courseId).get();
      const batch = db.batch();
      snap.forEach(doc=>batch.delete(doc.ref));
      await batch.commit();

      await refreshAll();
      showStatus('已刪除課程。', 'success');
      setTimeout(hideStatus, 1200);
    }catch(e){
      console.error(e);
      showStatus('刪除失敗：' + (e?.message || e), 'danger');
    }
  }

  // -----------------------------
  // Attendance
  // -----------------------------
  function setAttendancePills(total, checked){
    if(attendanceCountPill) attendanceCountPill.textContent = `名單 ${total}`;
    if(attendanceCheckedPill) attendanceCheckedPill.textContent = `已勾選 ${checked}`;
  }

  function getSelectedCourse(){
    const id = attendanceCourseSelect?.value || '';
    return courses.find(c=>c.id===id) || null;
  }

  function filterEmployeesForCourse(course){
    if(!course) return employees.slice();
    const req = Array.isArray(course.requiredFor) ? course.requiredFor : [];
    if(!req.length) return employees.slice();
    return employees.filter(e=> req.includes(e.source));
  }

  function buildAttendanceRows(course){
    const list = filterEmployeesForCourse(course);
    const courseHours = Number(course?.hours || 0);

    // map existing attendance (courseId + staffId + source)
    const rows = list.map(emp=>{
      const docId = makeAttendDocId(course.id, emp);
      const existing = attendanceMap.get(docId);
      const attended = existing ? !!existing.attended : false;
      const hoursEarned = existing && existing.hoursEarned!=null ? Number(existing.hoursEarned) : (attended ? courseHours : 0);
      return {
        docId,
        courseId: course.id,
        emp,
        attended,
        hoursEarned: isFinite(hoursEarned) ? hoursEarned : 0,
      };
    });

    currentAttendanceRows = rows;
  }

  function renderAttendance(){
    const course = getSelectedCourse();
    if(!course){
      attendanceCourseInfo.textContent = '尚未選擇課程。';
      attendanceTbody.innerHTML = '';
      setAttendancePills(0,0);
      return;
    }

    const info = [
      `日期：${course.date || '-'}`,
      `類別：${course.category || '-'}`,
      `時數：${Number(course.hours||0).toFixed(1).replace(/\.0$/,'')} 小時`,
      `必修對象：${requiredForText(course.requiredFor)}`
    ].join('｜');

    attendanceCourseInfo.textContent = info;

    const q = safeStr(attendanceSearch?.value||'').trim().toLowerCase();

    const view = currentAttendanceRows.filter(r=>{
      if(!q) return true;
      return safeStr(r.emp.staffId).toLowerCase().includes(q) || safeStr(r.emp.name).toLowerCase().includes(q);
    });

    let checked = 0;
    view.forEach(r=>{ if(r.attended) checked++; });

    setAttendancePills(view.length, checked);

    attendanceTbody.innerHTML = view.map(r=>{
      const chk = r.attended ? 'checked' : '';
      const role = staffSourceLabel(r.emp.source);
      const hoursVal = (isFinite(r.hoursEarned)? r.hoursEarned : 0);
      return `
        <tr data-docid="${r.docId}">
          <td class="text-center">
            <input type="checkbox" class="form-check-input attend-check" ${chk}>
          </td>
          <td class="mono">${safeStr(r.emp.staffId)}</td>
          <td class="fw-semibold">${safeStr(r.emp.name)}</td>
          <td>${role}${r.emp.title ? ('<div class="small muted">' + safeStr(r.emp.title) + '</div>') : ''}</td>
          <td class="text-end">
            <input type="number" step="0.5" min="0" class="form-control form-control-sm attend-hours" style="max-width:110px; margin-left:auto" value="${hoursVal}">
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="5" class="text-center text-muted py-4">沒有員工名單</td></tr>`;
  }

  // -----------------------------
  // Verify (時數核對)
  // -----------------------------
  
  function renderVerifyCourseDeliveryOptions(){
    if(!verifyCourseDelivery) return;
    const vals = Array.from(new Set(courses.map(c=>safeStr(c.delivery).trim()).filter(Boolean)));
    const hasOnline = vals.includes('線上');
    const hasIn = vals.includes('實體');
    const old = verifyCourseDelivery.value || '';
    const opts = ['<option value="">全部</option>']
      .concat(hasOnline? ['<option value="線上">線上</option>'] : [])
      .concat(hasIn? ['<option value="實體">實體</option>'] : []);
    verifyCourseDelivery.innerHTML = opts.join('');
    if(old && (old==='線上' || old==='實體')) verifyCourseDelivery.value = old;
  }

  function renderVerifyCourseSelect(){
    if(!verifyCourseSelect) return;
    const old = verifyCourseSelect.value || '';
    const opts = [`<option value="" disabled ${old?'':'selected'}>請選擇課程</option>`]
      .concat(courses.map(c=>{
        const label = `${c.date || '未填日期'}｜${c.title}`;
        const sel = (c.id===old) ? 'selected' : '';
        return `<option value="${c.id}" ${sel}>${label}</option>`;
      }));
    verifyCourseSelect.innerHTML = opts.join('');
  }

  
  function setVerifyHeader(mode){
    const ths = document.querySelectorAll('#pane-verify thead th');
    if(!ths || ths.length<6) return;
    if(mode==='staff'){
      ths[1].textContent = '日期';
      ths[2].textContent = '課程';
      ths[3].textContent = '課程時數';
      ths[4].textContent = '實得時數';
      ths[5].textContent = '核對';
    }else{
      ths[1].textContent = '員工編號';
      ths[2].textContent = '姓名';
      ths[3].textContent = '職別/來源';
      ths[4].textContent = '實得時數';
      ths[5].textContent = '核對';
    }
  }

  function setVerifyPills(total, attended, missed, mismatch){
    if(verifyTotalPill) verifyTotalPill.textContent = `名單 ${total}`;
    if(verifyAttendedPill) verifyAttendedPill.textContent = `已上課 ${attended}`;
    if(verifyMissedPill) verifyMissedPill.textContent = `未上課 ${missed}`;
    if(verifyMismatchPill) verifyMismatchPill.textContent = `時數不符: ${mismatch} 人`;
  }

  function buildVerifyRowsCourse(course){
    if(!course) { currentVerifyRows = []; return; }
    const list = filterEmployeesForCourse(course);
    const courseHours = Number(course?.hours || 0);

    currentVerifyRows = list.map(emp=>{
      const docId = makeAttendDocId(course.id, emp);
      const existing = attendanceMap.get(docId);
      const attended = existing ? !!existing.attended : false;
      const hoursEarned = existing && existing.hoursEarned!=null ? Number(existing.hoursEarned) : (attended ? courseHours : 0);
      const mismatch = attended && courseHours>0 && isFinite(hoursEarned) && Number(hoursEarned) !== Number(courseHours);
      return { mode:'course', docId, emp, attended, hoursEarned: isFinite(hoursEarned)? hoursEarned : 0, mismatch, course };
    });
  }

  function buildVerifyRowsStaff(staffSource, staffId){
    const year = Number(verifyYear?.value || new Date().getFullYear());
    const cat = safeStr(verifyCategory?.value||'').trim();
    const delv = safeStr(verifyDelivery?.value||'').trim();
    const nameQ = safeStr(verifyCourseName?.value||'').trim().toLowerCase();

    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const list = courses.filter(c=>{
      const d = safeStr(c.date);
      if(d < start || d > end) return false;
      if(typeof courseTypeFilter !== 'undefined' && courseTypeFilter && safeStr(c.delivery).trim() !== courseTypeFilter) return false;
      if(cat && safeStr(c.category).trim() !== cat) return false;
      if(delv && safeStr(c.delivery).trim() !== delv) return false;
      if(nameQ && !safeStr(c.title).toLowerCase().includes(nameQ)) return false;
      return true;
    }).slice().sort((a,b)=> safeStr(a.date).localeCompare(safeStr(b.date)));

    currentVerifyRows = list.map(course=>{
      const a = staffAttendanceByCourseId.get(course.id);
      const attended = a ? !!a.attended : false;
      const hoursEarned = a && a.hoursEarned!=null ? Number(a.hoursEarned) : 0;
      const courseHours = Number(course.hours||0);
      const mismatch = attended && courseHours>0 && isFinite(hoursEarned) && Number(hoursEarned) !== Number(courseHours);
      return { mode:'staff', course, attended, hoursEarned: isFinite(hoursEarned)? hoursEarned : 0, mismatch, staffSource, staffId };
    });
  }

  function renderVerify(){
    if(currentVerifyMode === 'staff'){
      renderVerifyStaff();
    }else{
      renderVerifyCourse();
    }
  }

  function renderVerifyCourse(){
    setVerifyHeader('course');
    const courseId = verifyCourseSelect?.value || '';
    const course = courses.find(c=>c.id===courseId) || null;

    if(!course){
      if(verifyCourseInfo) verifyCourseInfo.textContent = '尚未選擇課程。';
      if(verifyTbody) verifyTbody.innerHTML = '';
      setVerifyPills(0,0,0,0);
      return;
    }

    const info = [
      `日期：${course.date || '-'}`,
      `類別：${course.category || '-'}`,
      `課程時數：${Number(course.hours||0).toFixed(1).replace(/\\.0$/,'')} 小時`,
      `必修對象：${requiredForText(course.requiredFor)}`
    ].join('｜');
    if(verifyCourseInfo) verifyCourseInfo.textContent = info;

    const q = safeStr(verifySearch?.value||'').trim().toLowerCase();
    const view = currentVerifyRows.filter(r=>{
      if(!q) return true;
      return safeStr(r.emp.staffId).toLowerCase().includes(q) || safeStr(r.emp.name).toLowerCase().includes(q);
    });

    const total = view.length;
    const attended = view.filter(r=>r.attended).length;
    const missed = total - attended;
    const mismatch = view.filter(r=>r.mismatch).length;
    setVerifyPills(total, attended, missed, mismatch);

    if(!verifyTbody) return;
    verifyTbody.innerHTML = view.map(r=>{
      const status = r.attended ? '<span class="badge bg-success">已上課</span>' : '<span class="badge bg-secondary">未上課</span>';
      const role = staffSourceLabel(r.emp.source);
      const hoursVal = (isFinite(r.hoursEarned)? r.hoursEarned : 0);
      const check = r.attended ? (r.mismatch ? '<span class="badge bg-warning text-dark">時數不符</span>' : '<span class="badge bg-primary">OK</span>') : '-';
      return `
        <tr>
          <td class="text-center">${status}</td>
          <td class="mono">${safeStr(r.emp.staffId)}</td>
          <td class="fw-semibold">${safeStr(r.emp.name)}</td>
          <td>${role}${r.emp.title ? ('<div class="small muted">' + safeStr(r.emp.title) + '</div>') : ''}</td>
          <td class="text-end">${r.attended ? hoursVal.toFixed(1).replace(/\\.0$/,'') : '0'}</td>
          <td class="text-center">${check}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="6" class="text-center text-muted py-4">沒有名單</td></tr>`;
  }

  function renderVerifyStaff(){
    setVerifyHeader('staff');
    const v = verifyStaffSelect?.value || '';
    if(!v){
      if(verifyStaffInfo) verifyStaffInfo.textContent = '尚未選擇人員。';
      if(verifyTbody) verifyTbody.innerHTML = '';
      setVerifyPills(0,0,0,0);
      return;
    }
    const [source, staffId] = v.split('__');
    const emp = employees.find(e=>e.source===source && String(e.staffId)===String(staffId));
    if(verifyStaffInfo){
      verifyStaffInfo.textContent = emp ? `人員：${emp.staffId}｜${emp.name}｜${REQ_LABEL[emp.source]||emp.source}` : '';
    }

    const q = safeStr(verifySearch?.value||'').trim().toLowerCase();
    const view = currentVerifyRows.filter(r=>{
      if(!q) return true;
      return safeStr(r.course.title).toLowerCase().includes(q) || safeStr(r.course.category).toLowerCase().includes(q) || safeStr(r.course.date).toLowerCase().includes(q);
    });

    const total = view.length;
    const attended = view.filter(r=>r.attended).length;
    const missed = total - attended;
    const mismatch = view.filter(r=>r.mismatch).length;
    setVerifyPills(total, attended, missed, mismatch);

    if(!verifyTbody) return;
    verifyTbody.innerHTML = view.map(r=>{
      const status = r.attended ? '<span class="badge bg-success">已上課</span>' : '<span class="badge bg-secondary">未上課</span>';
      const hoursVal = (isFinite(r.hoursEarned)? r.hoursEarned : 0);
      const courseHours = Number(r.course.hours||0);
      const check = r.attended ? (r.mismatch ? '<span class="badge bg-warning text-dark">時數不符</span>' : '<span class="badge bg-primary">OK</span>') : '-';
      return `
        <tr>
          <td class="text-center">${status}</td>
          <td class="mono">${safeStr(r.course.date)}</td>
          <td class="fw-semibold">${safeStr(r.course.title)}<div class="small muted">${safeStr(r.course.category||'')}</div></td>
          <td>${courseHours.toFixed(1).replace(/\\.0$/,'')} 小時</td>
          <td class="text-end">${r.attended ? hoursVal.toFixed(1).replace(/\\.0$/,'') : '0'}</td>
          <td class="text-center">${check}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="6" class="text-center text-muted py-4">沒有課程</td></tr>`;
  }


function syncAttendanceRowFromDOM(){
    const course = getSelectedCourse();
    if(!course) return;
    const courseHours = Number(course.hours || 0);

    const rowsById = new Map(currentAttendanceRows.map(r=>[r.docId, r]));
    const trs = Array.from(attendanceTbody.querySelectorAll('tr[data-docid]'));
    trs.forEach(tr=>{
      const docId = tr.getAttribute('data-docid');
      const row = rowsById.get(docId);
      if(!row) return;

      const chk = tr.querySelector('.attend-check');
      const hours = tr.querySelector('.attend-hours');

      row.attended = !!chk?.checked;

      let hv = Number(hours?.value || 0);
      if(!isFinite(hv) || hv<0) hv = 0;

      // 若勾選出席但時數為 0，則自動帶入課程時數
      if(row.attended && hv===0 && courseHours>0){
        hv = courseHours;
        if(hours) hours.value = String(hv);
      }
      // 若取消出席則時數歸零
      if(!row.attended){
        hv = 0;
        if(hours) hours.value = '0';
      }
      row.hoursEarned = hv;
    });
  }

  async function saveAttendance(){
    const course = getSelectedCourse();
    if(!course){ alert('請先選擇課程。'); return; }

    syncAttendanceRowFromDOM();
    const batch = db.batch();

    currentAttendanceRows.forEach(r=>{
      const ref = db.collection(COL_ATTEND).doc(r.docId);
      const isNew = !attendanceMap.has(r.docId);
      const payload = {
        courseId: r.courseId,
        courseDate: course.date || '',
        courseTitle: course.title || '',
        courseCategory: course.category || '',
        courseHours: Number(course.hours||0),
        requiredFor: Array.isArray(course.requiredFor)? course.requiredFor : [],
        staffId: r.emp.staffId,
        staffName: r.emp.name,
        staffSource: r.emp.source,
        staffTitle: r.emp.title || '',
        attended: !!r.attended,
        hoursEarned: Number(r.hoursEarned||0),
};

      // 只要點名就寫入（避免殘留舊資料）；若你要節省容量，可改成 attended=false 的就 delete
      batch.set(ref, attachAuditFields(payload, isNew), { merge:true });
    });

    try{
      showStatus('儲存點名中...', 'info');
      await batch.commit();
      await loadAttendanceForCourse(course.id);
      showStatus('已儲存點名。', 'success');
      setTimeout(hideStatus, 1200);
      // refresh computed views (hours)
      await renderHours();
    }catch(e){
      console.error(e);
      showStatus('儲存點名失敗：' + (e?.message || e), 'danger');
    }
  }

  // -----------------------------
  // Hours / Stats
  // -----------------------------
  function fillYearOptions(){
    const y = new Date().getFullYear();
    const years = [y-1, y, y+1];
    hoursYear.innerHTML = years.map(v=>`<option value="${v}" ${v===y?'selected':''}>${v}</option>`).join('');
  }


  function fillVerifyYearOptions(){
    if(!verifyYear) return;
    const y = new Date().getFullYear();
    const years = [y-1, y, y+1];
    verifyYear.innerHTML = years.map(v=>`<option value="${v}" ${v===y?'selected':''}>${v}</option>`).join('');
  }

  function renderVerifyStaffSelect(){
    if(!verifyStaffSelect) return;
    const old = verifyStaffSelect.value || '';
    const opts = [`<option value="" disabled ${old?'':'selected'}>請選擇人員</option>`].concat(
      employees.map(e=>{
        const v = `${e.source}__${e.staffId}`;
        const label = `${e.staffId}｜${e.name}｜${REQ_LABEL[e.source]||e.source}`;
        const sel = (v===old) ? 'selected' : '';
        return `<option value="${v}" ${sel}>${label}</option>`;
      })
    );
    verifyStaffSelect.innerHTML = opts.join('');
  }

  function renderVerifyDeliveryOptions(){
    if(!verifyDelivery) return;
    const vals = Array.from(new Set(courses.map(c=>safeStr(c.delivery).trim()).filter(Boolean)));
    const hasOnline = vals.includes('線上');
    const hasIn = vals.includes('實體');
    const old = verifyDelivery.value || '';
    const opts = ['<option value="">全部</option>']
      .concat(hasOnline? ['<option value="線上">線上</option>'] : [])
      .concat(hasIn? ['<option value="實體">實體</option>'] : []);
    verifyDelivery.innerHTML = opts.join('');
    if(old && (old==='線上' || old==='實體')) verifyDelivery.value = old;
  }

  function renderVerifyCategoryOptions(){
    if(!verifyCategory) return;
    const cats = Array.from(new Set(courses.map(c=>safeStr(c.category).trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    const old = verifyCategory.value || '';
    const opts = ['<option value="">全部</option>'].concat(cats.map(v=>`<option value="${v}">${v}</option>`));
    verifyCategory.innerHTML = opts.join('');
    if(old && cats.includes(old)) verifyCategory.value = old;
  }

  async function loadAllAttendanceInYear(year){
    // Firestore where on courseDate string is possible if stored yyyy-mm-dd.
    // We'll do range query on courseDate.
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    // Use courseDate if available; fallback to courseDate field
    const snap = await db.collection(COL_ATTEND)
      .where('courseDate','>=', start)
      .where('courseDate','<=', end)
      .get();

    const arr=[];
    snap.forEach(doc=>arr.push({id: doc.id, ...(doc.data()||{})}));
    return arr;
  }

  async function renderHours(){
    const year = Number(hoursYear.value || new Date().getFullYear());
    showStatus('統計計算中...', 'info');

    let attendList = [];
    try{
      attendList = await loadAllAttendanceInYear(year);
    }catch(e){
      console.warn('Year range query failed, fallback to full scan (may be slow):', e);
      // fallback: full scan
      const snap = await db.collection(COL_ATTEND).get();
      snap.forEach(doc=>attendList.push({id: doc.id, ...(doc.data()||{})}));
      attendList = attendList.filter(a=> String(a.courseDate||'').startsWith(String(year)));
    }

    // aggregate
    const sumByStaff = new Map(); // staffKey -> {emp, hours, requiredDoneSet}
    const empByKey = new Map(employees.map(e=>[`${e.source}__${e.staffId}`, e]));

    attendList.forEach(a=>{
      const attended = !!a.attended;
      if(!attended) return;

      const source = String(a.staffSource||'').trim();
      const staffId = String(a.staffId||'').trim();
      const key = `${source}__${staffId}`;

      const emp = empByKey.get(key) || {
        staffId,
        name: a.staffName || '',
        source: source || 'unknown',
        title: a.staffTitle || '',
        sortOrder: 9999,
      };

      const hoursEarned = Number(a.hoursEarned || 0);
      const hrs = (isFinite(hoursEarned) && hoursEarned>0) ? hoursEarned : 0;

      if(!sumByStaff.has(key)){
        sumByStaff.set(key, {emp, hours:0, requiredDone: new Set()});
      }
      const bucket = sumByStaff.get(key);
      bucket.hours += hrs;

      // required completion: if course requiredFor includes emp.source
      const req = Array.isArray(a.requiredFor) ? a.requiredFor : [];
      if(req.includes(emp.source)){
        bucket.requiredDone.add(String(a.courseId||a.courseTitle||a.id));
      }
    });

    // ensure every employee shown even if 0
    employees.forEach(e=>{
      const key = `${e.source}__${e.staffId}`;
      if(!sumByStaff.has(key)){
        sumByStaff.set(key, {emp:e, hours:0, requiredDone:new Set()});
      }
    });

    // search filter
    const q = safeStr(hoursSearch?.value||'').trim().toLowerCase();
    const rows = Array.from(sumByStaff.values())
      .filter(x=>{
        if(!q) return true;
        return safeStr(x.emp.staffId).toLowerCase().includes(q) || safeStr(x.emp.name).toLowerCase().includes(q);
      })
      .sort((a,b)=>{
        // show higher hours first, then by source/order
        const h = (b.hours||0) - (a.hours||0);
        if(h) return h;
        const s = a.emp.source.localeCompare(b.emp.source);
        if(s) return s;
        const o = (a.emp.sortOrder||9999) - (b.emp.sortOrder||9999);
        if(o) return o;
        return a.emp.name.localeCompare(b.emp.name, 'zh-Hant', {numeric:true});
      });

    const totalHours = rows.reduce((acc,r)=>acc+(r.hours||0),0);

    hoursTotalPill.textContent = `總時數 ${totalHours.toFixed(1).replace(/\.0$/,'')}`;
    hoursPeoplePill.textContent = `人數 ${rows.length}`;

    hoursTbody.innerHTML = rows.map(r=>{
      const hrs = (r.hours||0);
      const reqDone = r.requiredDone ? r.requiredDone.size : 0;
      return `
        <tr>
          <td class="mono">${safeStr(r.emp.staffId)}</td>
          <td class="fw-semibold">${safeStr(r.emp.name)}</td>
          <td>${staffSourceLabel(r.emp.source)}${r.emp.title ? ('<div class="small muted">' + safeStr(r.emp.title) + '</div>') : ''}</td>
          <td class="text-end fw-bold">${hrs.toFixed(1).replace(/\.0$/,'')}</td>
          <td>${reqDone} 門</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="5" class="text-center text-muted py-4">沒有資料</td></tr>`;

    hideStatus();
  }

  // -----------------------------
  // Excel Export (ExcelJS)
  // -----------------------------
  function applyFooter(ws, footerText){
    if(!ws || !footerText) return;
    ws.headerFooter = {
      oddFooter: footerText,
      evenFooter: footerText,
      firstFooter: footerText
    };
  }

  function styleHeaderRow(row){
    row.font = { name:'Microsoft JhengHei', bold:true, size:12 };
    row.alignment = { vertical:'middle', horizontal:'center' };
    row.eachCell(c=>{
      c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF1F3F5'} };
      c.border = {
        top:{style:'thin', color:{argb:'FF999999'}},
        left:{style:'thin', color:{argb:'FF999999'}},
        bottom:{style:'thin', color:{argb:'FF999999'}},
        right:{style:'thin', color:{argb:'FF999999'}},
      };
    });
    row.height = 22;
  }

  function styleBodyRows(ws, startRow){
    for(let r=startRow; r<=ws.rowCount; r++){
      const row = ws.getRow(r);
      row.font = { name:'Microsoft JhengHei', size:11 };
      row.alignment = { vertical:'middle', horizontal:'left', wrapText:true };
      row.eachCell(c=>{
        c.border = {
          top:{style:'thin', color:{argb:'FF999999'}},
          left:{style:'thin', color:{argb:'FF999999'}},
          bottom:{style:'thin', color:{argb:'FF999999'}},
          right:{style:'thin', color:{argb:'FF999999'}},
        };
      });
    }
  }

  async function exportExcel(){
    if(typeof ExcelJS === 'undefined'){
      alert('ExcelJS 未載入，無法匯出。');
      return;
    }

    const exportUser = getExportUser();
    const t = nowStr();
    const footer = `&L&"Microsoft JhengHei,Regular"&8匯出時間:${t}&R&"Microsoft JhengHei,Regular"&8匯出報表人:${exportUser || ''}`.trim();

    showStatus('正在產生 Excel...', 'info');

    // Prepare year stats data
    const year = Number(hoursYear.value || new Date().getFullYear());
    let attendList = [];
    try{
      attendList = await loadAllAttendanceInYear(year);
    }catch(_e){
      const snap = await db.collection(COL_ATTEND).get();
      snap.forEach(doc=>attendList.push({id: doc.id, ...(doc.data()||{})}));
      attendList = attendList.filter(a=> String(a.courseDate||'').startsWith(String(year)));
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Antai';
    wb.created = new Date();

    // Sheet 1: Courses
    const ws1 = wb.addWorksheet('課程清單', { views:[{state:'frozen', ySplit:1}] });
    ws1.columns = [
      {header:'課程ID', key:'id', width:22},
      {header:'日期', key:'date', width:12},
      {header:'課程名稱', key:'title', width:38},
      {header:'類別', key:'category', width:12},
      {header:'時數', key:'hours', width:8},
      {header:'講師', key:'instructor', width:16},
      {header:'必修對象', key:'requiredFor', width:26},
      {header:'備註', key:'description', width:34},
    ];
    styleHeaderRow(ws1.getRow(1));
    courses.slice().sort((a,b)=> safeStr(a.date).localeCompare(safeStr(b.date))).forEach(c=>{
      ws1.addRow({
        id: c.id,
        date: c.date,
        title: c.title,
        category: c.category,
        hours: Number(c.hours||0).toFixed(1).replace(/\.0$/,''),
        instructor: c.instructor,
        requiredFor: requiredForText(c.requiredFor),
        description: c.description
      });
    });
    styleBodyRows(ws1, 2);
    applyFooter(ws1, footer);

    // Sheet 2: Attendance details
    const ws2 = wb.addWorksheet('出席明細', { views:[{state:'frozen', ySplit:1}] });
    ws2.columns = [
      {header:'課程日期', key:'courseDate', width:12},
      {header:'課程名稱', key:'courseTitle', width:34},
      {header:'員工編號', key:'staffId', width:14},
      {header:'姓名', key:'staffName', width:16},
      {header:'來源', key:'staffSource', width:18},
      {header:'出席', key:'attended', width:8},
      {header:'實得時數', key:'hoursEarned', width:10},
      {header:'更新時間', key:'updatedAt', width:20},
      {header:'更新人', key:'updatedBy', width:16},
    ];
    styleHeaderRow(ws2.getRow(1));

    const sortedAttend = attendList.slice().sort((a,b)=>{
      const da = safeStr(a.courseDate); const dbb = safeStr(b.courseDate);
      if(da!==dbb) return da.localeCompare(dbb);
      const ca = safeStr(a.courseTitle); const cb = safeStr(b.courseTitle);
      if(ca!==cb) return ca.localeCompare(cb, 'zh-Hant', {numeric:true});
      return safeStr(a.staffId).localeCompare(safeStr(b.staffId), 'zh-Hant', {numeric:true});
    });

    sortedAttend.forEach(a=>{
      ws2.addRow({
        courseDate: a.courseDate || '',
        courseTitle: a.courseTitle || '',
        staffId: a.staffId || '',
        staffName: a.staffName || '',
        staffSource: staffSourceLabel(a.staffSource || ''),
        attended: a.attended ? 'Y' : 'N',
        hoursEarned: (Number(a.hoursEarned||0) || 0).toFixed(1).replace(/\.0$/,''),
        updatedAt: a.updatedAt || '',
        updatedBy: a.updatedBy || '',
      });
    });
    styleBodyRows(ws2, 2);
    applyFooter(ws2, footer);

    // Sheet 3: Year hours
    const ws3 = wb.addWorksheet(`員工時數_${year}`, { views:[{state:'frozen', ySplit:1}] });
    ws3.columns = [
      {header:'員工編號', key:'staffId', width:14},
      {header:'姓名', key:'name', width:16},
      {header:'職別/來源', key:'role', width:22},
      {header:'年度時數', key:'hours', width:12},
      {header:'必修完成（門數）', key:'reqDone', width:18},
    ];
    styleHeaderRow(ws3.getRow(1));

    // Reuse aggregation logic
    const sumByStaff = new Map();
    const empByKey = new Map(employees.map(e=>[`${e.source}__${e.staffId}`, e]));
    attendList.forEach(a=>{
      if(!a.attended) return;
      const source = String(a.staffSource||'').trim();
      const staffId = String(a.staffId||'').trim();
      const key = `${source}__${staffId}`;
      const emp = empByKey.get(key) || {staffId, name:a.staffName||'', source:source||'unknown', title:a.staffTitle||'', sortOrder:9999};
      const hrs = Number(a.hoursEarned||0);
      if(!sumByStaff.has(key)) sumByStaff.set(key, {emp, hours:0, requiredDone:new Set()});
      const b = sumByStaff.get(key);
      b.hours += (isFinite(hrs) && hrs>0) ? hrs : 0;
      const req = Array.isArray(a.requiredFor)? a.requiredFor:[];
      if(req.includes(emp.source)) b.requiredDone.add(String(a.courseId||a.courseTitle||a.id));
    });
    employees.forEach(e=>{
      const key = `${e.source}__${e.staffId}`;
      if(!sumByStaff.has(key)) sumByStaff.set(key, {emp:e, hours:0, requiredDone:new Set()});
    });

    const rows = Array.from(sumByStaff.values()).sort((a,b)=>{
      const h = (b.hours||0)-(a.hours||0);
      if(h) return h;
      const s = a.emp.source.localeCompare(b.emp.source);
      if(s) return s;
      const o = (a.emp.sortOrder||9999)-(b.emp.sortOrder||9999);
      if(o) return o;
      return a.emp.name.localeCompare(b.emp.name, 'zh-Hant', {numeric:true});
    });

    rows.forEach(r=>{
      ws3.addRow({
        staffId: r.emp.staffId,
        name: r.emp.name,
        role: staffSourceLabel(r.emp.source) + (r.emp.title? ` / ${r.emp.title}`:''),
        hours: (r.hours||0).toFixed(1).replace(/\.0$/,''),
        reqDone: `${(r.requiredDone?.size||0)} 門`
      });
    });
    styleBodyRows(ws3, 2);
    applyFooter(ws3, footer);

    // Save
    const fname = `教育訓練管理_${year}_${String(new Date().toISOString()).slice(0,10)}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);

    showStatus('已匯出 Excel。', 'success');
    setTimeout(hideStatus, 1500);
  }

  // -----------------------------
  // Refresh all
  // -----------------------------
  async function refreshAll(){
    showStatus('載入中...', 'info');
    await loadEmployees();
    await loadCourses();
    renderCourses();
    renderVerifyCourseDeliveryOptions();
    renderVerifyCourseSelect();
    renderVerifyStaffSelect();
    fillVerifyYearOptions();
    renderVerifyCategoryOptions();
    renderVerifyDeliveryOptions();
    fillYearOptions();
    await renderHours();
    hideStatus();
  }

  // -----------------------------
  // Events
  // -----------------------------
  btnRefresh?.addEventListener('click', refreshAll);

  courseSearch?.addEventListener('input', renderCourses);
  courseCategoryFilter?.addEventListener('change', renderCourses);

  function setCourseTypeFilter(v){
    courseTypeFilter = v || '';
    const setActive = (btn, on)=>{ if(!btn) return; btn.classList.toggle('active', !!on); };
    setActive(courseTypeAllBtn, !courseTypeFilter);
    setActive(courseTypeOnlineBtn, courseTypeFilter==='線上');
    setActive(courseTypeInpersonBtn, courseTypeFilter==='實體');
    if(courseTypeHint) courseTypeHint.textContent = courseTypeFilter ? `（目前：${courseTypeFilter}）` : '';
    renderCourses();
  }
  courseTypeAllBtn?.addEventListener('click', ()=>setCourseTypeFilter(''));
  courseTypeOnlineBtn?.addEventListener('click', ()=>setCourseTypeFilter('線上'));
  courseTypeInpersonBtn?.addEventListener('click', ()=>setCourseTypeFilter('實體'));

  btnAddCourse?.addEventListener('click', ()=>{
    if(!courseModal){ alert('Modal 初始化失敗'); return; }
    courseModalTitle.textContent = '新增課程';
    resetCourseModal();
    courseModal.show();
  });

  courseSaveBtn?.addEventListener('click', saveCourse);

  coursesTbody?.addEventListener('click', async (e)=>{
    const tr = e.target.closest('tr[data-id]');
    if(!tr) return;
    const id = tr.getAttribute('data-id');
    const course = courses.find(c=>c.id===id);
    if(!course) return;

    if(e.target.closest('.btn-edit')){
      if(!courseModal){ alert('Modal 初始化失敗'); return; }
      courseModalTitle.textContent = '編輯課程';
      fillCourseModal(course);
      courseModal.show();
      return;
    }
    if(e.target.closest('.btn-del')){
      await deleteCourse(id);
      return;
    }
  });

  attendanceCourseSelect?.addEventListener('change', async ()=>{
    const id = attendanceCourseSelect.value || '';
    currentAttendanceCourseId = id;
    if(!id){
      renderAttendance();
      return;
    }
    showStatus('載入點名資料...', 'info');
    await loadAttendanceForCourse(id);
    const course = getSelectedCourse();
    buildAttendanceRows(course);
    renderAttendance();
    hideStatus();
  });

    verifyCourseDelivery?.addEventListener('change', ()=>{
    if(currentVerifyMode!=='course') return;
    const prev = verifyCourseSelect?.value || '';
    renderVerifyCourseDeliveryOptions();
    renderVerifyCourseSelect();
    // if previous course is filtered out, clear selection
    const delv = safeStr(verifyCourseDelivery?.value||'').trim();
    if(prev && delv){
      const c = courses.find(x=>x.id===prev);
      if(c && safeStr(c.delivery).trim()!==delv){
        if(verifyCourseSelect) verifyCourseSelect.value = '';
        currentVerifyRows = [];
      }
    }
    renderVerify();
  });

verifyCourseSelect?.addEventListener('change', async ()=>{
    const id = verifyCourseSelect.value || '';
    if(!id){
      renderVerify();
      return;
    }
    showStatus('載入核對資料...', 'info');
    await loadAttendanceForCourse(id);
    const course = courses.find(c=>c.id===id) || null;
    buildVerifyRowsCourse(course);
    renderVerify();
    hideStatus();
  });

  verifySearch?.addEventListener('input', ()=>renderVerify());

  verifyMode?.addEventListener('change', ()=>{
    currentVerifyMode = verifyMode.value || 'course';
    if(currentVerifyMode === 'staff'){
      verifyModeCourse?.classList.add('d-none');
      verifyModeStaff?.classList.remove('d-none');
      renderVerifyStaffSelect();
      fillVerifyYearOptions();
      renderVerifyCategoryOptions();
    renderVerifyDeliveryOptions();
      renderVerify();
    }else{
      verifyModeStaff?.classList.add('d-none');
      verifyModeCourse?.classList.remove('d-none');
      renderVerifyCourseDeliveryOptions();
    renderVerifyCourseSelect();
    renderVerifyStaffSelect();
    fillVerifyYearOptions();
    renderVerifyCategoryOptions();
    renderVerifyDeliveryOptions();
      renderVerify();
    }
  });

  verifyStaffSelect?.addEventListener('change', async ()=>{
    const v = verifyStaffSelect.value || '';
    if(!v){ currentVerifyRows = []; renderVerify(); return; }
    const [source, staffId] = v.split('__');
    showStatus('載入人員出席資料...', 'info');
    await loadAttendanceForStaff(source, staffId);
    buildVerifyRowsStaff(source, staffId);
    renderVerify();
    hideStatus();
  });

  verifyYear?.addEventListener('change', ()=>{
    if(currentVerifyMode!=='staff') return;
    const v = verifyStaffSelect?.value || '';
    if(!v) { renderVerify(); return; }
    const [source, staffId] = v.split('__');
    buildVerifyRowsStaff(source, staffId);
    renderVerify();
  });

  verifyCategory?.addEventListener('change', ()=>{
    if(currentVerifyMode!=='staff') return;
    const v = verifyStaffSelect?.value || '';
    if(!v) { renderVerify(); return; }
    const [source, staffId] = v.split('__');
    buildVerifyRowsStaff(source, staffId);
    renderVerify();
  });

  verifyDelivery?.addEventListener('change', ()=>{
    if(currentVerifyMode!=='staff') return;
    const v = verifyStaffSelect?.value || '';
    if(!v) { renderVerify(); return; }
    const [source, staffId] = v.split('__');
    buildVerifyRowsStaff(source, staffId);
    renderVerify();
  });

  verifyCourseName?.addEventListener('input', ()=>{
    if(currentVerifyMode!=='staff') return;
    const v = verifyStaffSelect?.value || '';
    if(!v) { renderVerify(); return; }
    const [source, staffId] = v.split('__');
    buildVerifyRowsStaff(source, staffId);
    renderVerify();
  });


  attendanceSearch?.addEventListener('input', ()=>renderAttendance());

  attendanceTbody?.addEventListener('change', (e)=>{
    if(e.target.classList.contains('attend-check') || e.target.classList.contains('attend-hours')){
      syncAttendanceRowFromDOM();
      // update pills quickly
      const view = currentAttendanceRows.filter(r=>{
        const q = safeStr(attendanceSearch?.value||'').trim().toLowerCase();
        if(!q) return true;
        return safeStr(r.emp.staffId).toLowerCase().includes(q) || safeStr(r.emp.name).toLowerCase().includes(q);
      });
      const checked = view.filter(r=>r.attended).length;
      setAttendancePills(view.length, checked);
    }
  });

  attendanceSelectAll?.addEventListener('click', ()=>{
    const course = getSelectedCourse();
    if(!course) return;
    const courseHours = Number(course.hours||0);

    Array.from(attendanceTbody.querySelectorAll('tr[data-docid]')).forEach(tr=>{
      const chk = tr.querySelector('.attend-check');
      const hours = tr.querySelector('.attend-hours');
      if(chk) chk.checked = true;
      if(hours) hours.value = String(courseHours || 0);
    });
    syncAttendanceRowFromDOM();
    renderAttendance();
  });

  attendanceClearAll?.addEventListener('click', ()=>{
    Array.from(attendanceTbody.querySelectorAll('tr[data-docid]')).forEach(tr=>{
      const chk = tr.querySelector('.attend-check');
      const hours = tr.querySelector('.attend-hours');
      if(chk) chk.checked = false;
      if(hours) hours.value = '0';
    });
    syncAttendanceRowFromDOM();
    renderAttendance();
  });

  attendanceSave?.addEventListener('click', saveAttendance);

  hoursRecalc?.addEventListener('click', renderHours);
  hoursYear?.addEventListener('change', renderHours);
  hoursSearch?.addEventListener('input', renderHours);

  btnExportExcel?.addEventListener('click', exportExcel);

  // -----------------------------
  // Boot
  // -----------------------------
  actor = getActor();
  renderLoginInfo();
  if (!ensureLogin()) return;
  refreshAll().catch(e=>{
    console.error(e);
    showStatus('初始化失敗：請確認 Firebase db 已就緒。', 'danger');
  });
});
