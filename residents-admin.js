// residents-admin.merged.gridlike.pretty.js
// 合併版（美化窗格）：保留原功能 + 更美觀的「房卡」匯出（不套模板）
// - 每列 3 間房，房卡上方有「🚪 房號 101」標題（合併儲存格）
// - 每床位一行：🛏 101-1   姓名   ♂/♀  年齡  （請假=🏖、住院=🏥）
// - 房卡底部顯示空床清單：🈳 108-2, 106-1 ...
// - 仍輸出五分頁：基本資料、1/2/3樓床位配置（美化房卡）、總人數統計
// - 檔名仍為 民國年月日-床位配置-消防位置圖-報告詞 -

(function(){
  let started=false;
  function canStart(){return typeof db!=='undefined' && db && typeof db.collection==='function'}
  function startNow(){if(started)return;started=true;document.dispatchEvent(new Event('residents-init'));}
  document.addEventListener('firebase-ready', ()=>startNow());
  if(document.readyState==='complete'||document.readyState==='interactive'){setTimeout(()=>{if(canStart())startNow()},300)}
  else{document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if(canStart())startNow()},300)})}
  let tries=0;const t=setInterval(()=>{if(started){clearInterval(t);return}if(canStart()){startNow();clearInterval(t)}if(++tries>20)clearInterval(t)},500);
})();

document.addEventListener('residents-init', ()=>{
  const dbCol='residents';
  const tbody=document.getElementById('residents-table-body');
  const floor1Grid=document.getElementById('floor1-grid');
  const floor2Grid=document.getElementById('floor2-grid');
  const floor3Grid=document.getElementById('floor3-grid');
  const statsArea=document.getElementById('stats-area');

  const importBtn=document.getElementById('import-excel-btn');
  const fileInput=document.getElementById('excel-file-input');
  const importStatus=document.getElementById('import-status');
  const addBtn=document.getElementById('add-resident-btn');

  const LS_KEY='FLOOR_TEMPLATE_V1';
  function getTemplate(){try{return JSON.parse(localStorage.getItem(LS_KEY))||{'1':[], '2':[], '3':[]}}catch{return {'1':[], '2':[], '3':[]}}}
  const norm=v=>(v==null?'':String(v).trim());
  function bedToSortValue(bed){if(!bed)return 0;const m=String(bed).match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);if(!m)return 0;const base=parseInt(m[1],10);const sub=m[2]?parseInt(String(m[2]).replace(/\D/g,''),10)||0:0;return base+sub/100;}
  function calcAge(iso){if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; const now=new Date(); let a=now.getFullYear()-d.getFullYear(); const m=now.getMonth()-d.getMonth(); if(m<0||(m===0&&now.getDate()<d.getDate())) a--; return a;}
  function parseDateSmart(v){
    if(!v&&v!==0) return '';
    if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString().slice(0,10);
    if(typeof v==='number'&&isFinite(v)){const ms=(v-25569)*86400000; const d=new Date(ms); if(!isNaN(d)) return new Date(d.getTime()+d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
    let s=String(v).trim(); if(!s) return ''; s=s.replace(/[\.年\/\-]/g,'-').replace(/月/g,'-').replace(/日/g,'').replace(/\s+/g,''); const m=s.match(/^(\d{1,4})-?(\d{1,2})-?(\d{1,2})$/); if(m){let y=+m[1],mo=+m[2],da=+m[3]; if(y<1911) y+=1911; const dd=new Date(Date.UTC(y,mo-1,da)); if(!isNaN(dd)) return dd.toISOString().slice(0,10);} const d2=new Date(s); if(!isNaN(d2)) return d2.toISOString().slice(0,10); return '';}

  let cache=[];

  // ======= 畫面渲染（沿用原結構） =======
  function renderBasic(){
    if(!tbody) return;
    let html='';
    cache.forEach(r=>{
      const age=calcAge(r.birthday);
      html+=`<tr data-id="${r.id}">
        <td>${r.nursingStation||''}</td>
        <td>${r.bedNumber||''}</td>
        <td>${r.id||''}</td>
        <td>${r.idNumber||''}</td>
        <td>${r.birthday||''}</td>
        <td>${r.gender||''}</td>
        <td>${age!==''?age:''}</td>
        <td>${r.emergencyContact||''}</td>
        <td>${r.emergencyPhone||''}</td>
        <td>${r.mobility||''}</td>
        <td>${r.checkinDate||''}</td>
        <td>${r.leaveStatus||''}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-edit">編輯</button>
          <button class="btn btn-sm btn-danger btn-delete">刪除</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML=html;
  }
  function parseBedToken(s){const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return null; return {room:m[1], sub:m[2], token:`${m[1]}-${m[2]}`};}
  function renderFloorTo(container,list,floor){
    if(!container) return;
    container.innerHTML='';
    const tpl=getTemplate();
    const tokens=(tpl[String(floor)]||[]).slice();
    const grouped=new Map();
    tokens.forEach(tok=>{const t=parseBedToken(tok); if(!t) return; if(!grouped.has(t.room)) grouped.set(t.room,{}); const g=grouped.get(t.room); if(!g.__keys) g.__keys=new Set(); g.__keys.add(t.sub);});
    list.forEach(r=>{const t=parseBedToken(r.bedNumber); if(!t) return; if(!grouped.has(t.room)) return; const g=grouped.get(t.room); if(!g.__keys||!g.__keys.has(t.sub)) return; g[t.sub]=r;});
    const rooms=Array.from(grouped.keys()).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
    let html='<div class="row g-2">';
    rooms.forEach(room=>{
      const g=grouped.get(room);
      const keys=Array.from(g.__keys).sort((a,b)=>(parseInt(a.replace(/\D/g,''),10)||0)-(parseInt(b.replace(/\D/g,''),10)||0));
      let rows='';
      keys.forEach(sub=>{
        const r=g[sub];
        const age= r? calcAge(r.birthday):'';
        const sex= r? (r.gender==='男'?'♂':'♀'):'';
        const tag= r? (r.leaveStatus==='住院'?'🏥':(r.leaveStatus==='請假'?'🏖':'')) : '🈳 空床';
        rows+=`<div class="d-flex justify-content-between border-bottom py-2">
          <div class="small text-muted">🛏 ${room}-${sub}</div>
          <div>${r?(r.id||''):'—'} ${r?sex:''} ${age!==''?`/ ${age}歲`:''} <span class="ms-1">${tag}</span></div>
        </div>`;
      });
      html+=`<div class="col-12 col-sm-6 col-lg-4"><div class="card h-100">
        <div class="card-header fw-bold">🚪 房號 ${room}</div>
        <div class="card-body">${rows}</div>
      </div></div>`;
    });
    html+='</div>';
    container.innerHTML=html;
  }
  function renderFloors(){
    const f1=cache.filter(r=>/^1\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/1/.test(r.nursingStation)));
    const f2=cache.filter(r=>/^2\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/2/.test(r.nursingStation)));
    const f3=cache.filter(r=>/^3\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/3/.test(r.nursingStation)));
    renderFloorTo(floor1Grid,f1,1);
    renderFloorTo(floor2Grid,f2,2);
    renderFloorTo(floor3Grid,f3,3);
  }
  function renderStats(){
    if(!statsArea) return;
    const total=cache.length;
    const male=cache.filter(r=>r.gender==='男').length;
    const female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>r.leaveStatus==='請假').length;
    const hosp=cache.filter(r=>r.leaveStatus==='住院').length;
    const present=total-(leave+hosp);
    statsArea.innerHTML=`
      <div class="col-md-4"><div class="card"><div class="card-body">
        <div class="h5">總人數</div>
        <div class="display-6">${total}</div>
        <div class="text-muted">男：${male} ・ 女：${female}</div>
        <div class="mt-1">實到：<strong>${present}</strong>　🏖 ${leave}　🏥 ${hosp}</div>
      </div></div></div>
      <div class="col-md-8"><div class="card"><div class="card-body">
        <div class="h6">匯出</div>
        <button id="export-excel-btn" class="btn btn-success btn-sm me-2"><i class="fa-solid fa-table me-1"></i>表格</button>
        <button id="export-excel-gridlike" class="btn btn-outline-success btn-sm"><i class="fa-solid fa-border-all me-1"></i>窗格</button>
      </div></div></div>`;
  }

  // ===== 匯出（表格） =====
  function aoaBasic(){
    const header=['護理站','床號','姓名','身份證字號','生日','性別','住民年齡','緊急連絡人或家屬','連絡電話','行動方式','入住日期','住民請假'];
    const rows=cache.map(r=>[r.nursingStation||'',r.bedNumber||'',r.id||'',r.idNumber||'',r.birthday||'',r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)),r.emergencyContact||'',r.emergencyPhone||'',r.mobility||'',r.checkinDate||'',r.leaveStatus||'']);
    return [header,...rows];
  }
  function aoaStats(){
    const total=cache.length, male=cache.filter(r=>r.gender==='男').length, female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>r.leaveStatus==='請假').length, hosp=cache.filter(r=>r.leaveStatus==='住院').length, present=total-(leave+hosp);
    const head1=['總人數',total,'','男',male,'女',female,'實到',present,'請假',leave,'住院',hosp];
    const head2=['樓層','輪椅','推床','步行'];
    const normv=s=>(s==null?'':String(s)); const WHEEL=/(輪椅)/i,TROLLEY=/(推床|臥床|平車|推車)/i,WALK=/(步行|可獨立|助行|拐杖|walker)/i;
    function countMob(list,re){return list.filter(r=>re.test(normv(r.mobility))).length}
    function fl(f){return cache.filter(r=> new RegExp('^'+f+'\\d\\d').test(String(r.bedNumber||'')) || (r.nursingStation&&r.nursingStation.includes(String(f))))}
    const row1=['1F',countMob(fl(1),WHEEL),countMob(fl(1),TROLLEY),countMob(fl(1),WALK)];
    const row2=['2F',countMob(fl(2),WHEEL),countMob(fl(2),TROLLEY),countMob(fl(2),WALK)];
    const row3=['3F',countMob(fl(3),WHEEL),countMob(fl(3),TROLLEY),countMob(fl(3),WALK)];
    return [head1,[],head2,row1,row2,row3];
  }
  function buildExportName(){const d=new Date(); const y=d.getFullYear()-1911; const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}${m}${dd}-床位配置-消防位置圖-報告詞 -`;}

  function exportDirect(){
    if(typeof XLSX==='undefined'){alert('缺少 XLSX 外掛');return}
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaBasic()), '基本資料');
    XLSX.utils.book_append_sheet(wb, buildFloorPrettySheet(1), '1樓床位配置');
    XLSX.utils.book_append_sheet(wb, buildFloorPrettySheet(2), '2樓床位配置');
    XLSX.utils.book_append_sheet(wb, buildFloorPrettySheet(3), '3樓床位配置');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaStats()), '總人數統計');
    XLSX.writeFile(wb, buildExportName()+'.xlsx');
  }

  // ===== 匯出（美化窗格） =====
  function buildFloorPrettySheet(floor){
    const list=cache.filter(r=> new RegExp('^'+floor+'\\d\\d').test(String(r.bedNumber||'')) || (r.nursingStation&&r.nursingStation.includes(String(floor))));
    const roomMap=new Map();
    list.forEach(r=>{
      const m=String(r.bedNumber||'').match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      if(!m) return; const room=m[1], sub=m[2];
      if(!roomMap.has(room)) roomMap.set(room,{});
      roomMap.get(room)[sub]=r;
    });
    const rooms=[...roomMap.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));

    const aoa=[]; const merges=[];
    const PER_ROW=3;          // 每列幾間
    const CARD_W=8;           // 每張卡使用幾欄（含內部欄位）
    const GUTTER=1;           // 卡片間隔欄
    const TITLE_COLS=PER_ROW*(CARD_W+GUTTER)-GUTTER;

    // Title
    setCell(aoa,0,0,`${floor}樓床位配置`);
    merges.push({s:{r:0,c:0},e:{r:0,c:TITLE_COLS-1}});

    let rCur=2, cCur=0, tallest=0;
    rooms.forEach((room,idx)=>{
      // 卡片外框（用空白列與合併來營造區塊感）
      // Header
      setCell(aoa, rCur, cCur, `🚪 房號 ${room}`);
      merges.push({s:{r:rCur,c:cCur}, e:{r:rCur,c:cCur+CARD_W-1}});
      // 欄位標頭
      setCell(aoa, rCur+1, cCur, '床位'); setCell(aoa, rCur+1, cCur+2, '姓名'); setCell(aoa, rCur+1, cCur+5, '性別/年齡/狀態');
      merges.push({s:{r:rCur+1,c:cCur+2}, e:{r:rCur+1,c:cCur+4}});

      const subs=Object.keys(roomMap.get(room)).sort((a,b)=>(parseInt(String(a).replace(/\D/g,''),10)||0)-(parseInt(String(b).replace(/\D/g,''),10)||0));
      const lines=Math.max(2, subs.length||2);
      for(let i=0;i<lines;i++){
        const rr=rCur+2+i;
        const sub=subs[i];
        const res=sub? roomMap.get(room)[sub]:null;
        const sex=res? (res.gender==='男'?'♂':'♀'):'';
        const age=res? calcAge(res.birthday):'';
        const tag=res? (res.leaveStatus==='住院'?'🏥':(res.leaveStatus==='請假'?'🏖':'')):'🈳';
        setCell(aoa, rr, cCur, sub?`🛏 ${room}-${sub}`:'');
        merges.push({s:{r:rr,c:cCur+2}, e:{r:rr,c:cCur+4}});
        setCell(aoa, rr, cCur+2, res?(res.id||''):'—');
        setCell(aoa, rr, cCur+5, res?`${sex}${age!==''?` / ${age}歲`:''} ${tag}`:tag);
      }
      // 空床清單
      const empties=subs.filter(s=> !roomMap.get(room)[s]).map(s=>`${room}-${s}`);
      const footerR=rCur+2+lines;
      setCell(aoa, footerR, cCur, empties.length?`🈳 空床：${empties.join('、')}`:'🈳 空床：—');
      merges.push({s:{r:footerR,c:cCur}, e:{r:footerR,c:cCur+CARD_W-1}});

      tallest=Math.max(tallest, lines+3); // header+欄頭+內容+footer
      // 下一張卡
      cCur += CARD_W + GUTTER;
      if((idx+1)%PER_ROW===0){
        rCur += tallest + 1; // 卡片間留白一列
        cCur = 0; tallest=0;
      }
    });

    const ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges']=merges;
    // 欄寬：讓卡片更方正（姓名區略寬、間隔欄窄）
    const totalCols=TITLE_COLS;
    ws['!cols']=Array(totalCols).fill(0).map((_,i)=>({wch: (i%(CARD_W+GUTTER)===CARD_W)?2 : ( (i%(CARD_W+GUTTER)===0)?10 : 14 ) }));
    return ws;
  }

  function setCell(aoa,r,c,v){if(!aoa[r]) aoa[r]=[]; aoa[r][c]=v;}

  async function load(){
    if(tbody) tbody.innerHTML='<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap=await db.collection(dbCol).get();
      cache=snap.docs.map(d=>({id:d.id,...d.data()}));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber)-bedToSortValue(b.bedNumber));
      renderBasic(); renderFloors(); renderStats();
    }catch(e){
      console.error(e);
      if(tbody) tbody.innerHTML='<tr><td colspan="13"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
    }
  }

  // 匯出事件
  document.addEventListener('click', (e)=>{
    const t=e.target;
    if(t.closest('#export-excel-btn')) exportDirect();
    if(t.closest('#export-excel-gridlike')) exportDirect(); // 這版已把樓層分頁換成美化卡片
  });

  // 匯入
  if(importBtn && fileInput){
    importBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', handleExcelImport);
  }
  function pick(row, aliases){
    const map={}; Object.keys(row).forEach(k=>{map[String(k).replace(/\s+/g,'').trim()]=row[k];});
    for(const a of aliases){const kk=String(a).replace(/\s+/g,'').trim(); if(Object.prototype.hasOwnProperty.call(map,kk)) return map[kk];}
    return '';
  }
  async function handleExcelImport(evt){
    const file=evt.target.files[0]; if(!file) return;
    if(importStatus){importStatus.className='alert alert-info'; importStatus.classList.remove('d-none'); importStatus.textContent='正在讀取檔案...';}
    const reader=new FileReader();
    reader.onload=async (e)=>{
      try{
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array',cellDates:true});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
        const batch=db.batch(); let count=0;
        rows.forEach(r=>{
          const name=norm(pick(r,['姓名','住民姓名','Name'])); if(!name) return;
          const birthdayRaw=pick(r,['生日','出生日期','出生年月日','Birth','BirthDate']);
          const checkinRaw=pick(r,['入住日期','入住日','入院日期','Checkin','Admission']);
          const payload={
            nursingStation:norm(pick(r,['護理站','站別','樓層','Floor'])),
            bedNumber:norm(pick(r,['床號','床位','Bed'])),
            gender:norm(pick(r,['性別','Gender'])),
            idNumber:norm(pick(r,['身份證字號','身份証字號','ID','身分證'])),
            birthday:parseDateSmart(birthdayRaw),
            checkinDate:parseDateSmart(checkinRaw),
            emergencyContact:norm(pick(r,['緊急連絡人或家屬','緊急聯絡人','家屬','EmergencyContact'])),
            emergencyPhone:norm(pick(r,['連絡電話','聯絡電話','電話','Phone'])),
            mobility:norm(pick(r,['行動方式','行動','Mobility'])),
            leaveStatus:norm(pick(r,['住民請假','請假','住院','LeaveHosp','Leave/Hosp']))
          };
          batch.set(db.collection(dbCol).doc(name), payload, {merge:true}); count++;
        });
        await batch.commit();
        if(importStatus){importStatus.className='alert alert-success'; importStatus.textContent=`成功匯入 ${count} 筆資料！重新載入中...`; }
        setTimeout(()=>location.reload(),1000);
      }catch(err){
        console.error(err);
        if(importStatus){importStatus.className='alert alert-danger'; importStatus.textContent='匯入失敗，請檢查檔案。';}
      }finally{ if(fileInput) fileInput.value=''; }
    };
    reader.readAsArrayBuffer(file);
  }

  // 新增/編輯/刪除（延用原 DOM id）
  let modal; const modalEl=document.getElementById('resident-modal');
  if(window.bootstrap && modalEl) modal=new bootstrap.Modal(modalEl);
  const modalTitle=document.getElementById('resident-modal-title');
  const saveBtn=document.getElementById('save-resident-btn');
  const nameInput=document.getElementById('resident-name');
  const stationInput=document.getElementById('resident-station');
  const bedInput=document.getElementById('resident-bedNumber');
  const genderInput=document.getElementById('resident-gender');
  const birthdayInput=document.getElementById('resident-birthday');
  const idInput=document.getElementById('resident-idNumber');
  const emgNameInput=document.getElementById('resident-emgName');
  const emgPhoneInput=document.getElementById('resident-emgPhone');
  const mobilityInput=document.getElementById('resident-mobility');
  const checkinInput=document.getElementById('resident-checkinDate');
  const statusInput=document.getElementById('resident-status');

  if(addBtn && modal){
    addBtn.addEventListener('click', ()=>{
      modalTitle && (modalTitle.textContent='新增住民');
      const form=document.getElementById('resident-form'); if(form) form.reset();
      if(nameInput){ nameInput.disabled=false; nameInput.value=''; }
      modal.show();
    });
  }
  if(saveBtn){
    saveBtn.addEventListener('click', async ()=>{
      const name=nameInput? nameInput.value.trim() : ''; if(!name) return alert('請填寫姓名');
      const payload={
        nursingStation:stationInput?norm(stationInput.value):'',
        bedNumber:bedInput?norm(bedInput.value):'',
        gender:genderInput?genderInput.value:'',
        birthday:birthdayInput?parseDateSmart(birthdayInput.value):'',
        idNumber:idInput?norm(idInput.value):'',
        emergencyContact:emgNameInput?norm(emgNameInput.value):'',
        emergencyPhone:emgPhoneInput?norm(emgPhoneInput.value):'',
        mobility:mobilityInput?norm(mobilityInput.value):'',
        checkinDate:checkinInput?parseDateSmart(checkinInput.value):'',
        leaveStatus:statusInput?norm(statusInput.value):''
      };
      await db.collection(dbCol).doc(name).set(payload,{merge:true});
      if(modal) modal.hide();
      load();
    });
  }
  if(tbody){
    tbody.addEventListener('click', async (e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const row=btn.closest('tr'); const id=row?.dataset.id; if(!id) return;
      if(btn.classList.contains('btn-edit')){
        if(!modal) return;
        modalTitle && (modalTitle.textContent='編輯住民資料');
        if(nameInput){ nameInput.disabled=true; nameInput.value=id; }
        const doc=await db.collection(dbCol).doc(id).get();
        if(doc.exists){
          const d=doc.data();
          if(stationInput) stationInput.value=d.nursingStation||'';
          if(bedInput) bedInput.value=d.bedNumber||'';
          if(genderInput) genderInput.value=d.gender||'';
          if(birthdayInput) birthdayInput.value=d.birthday||'';
          if(idInput) idInput.value=d.idNumber||'';
          if(emgNameInput) emgNameInput.value=d.emergencyContact||'';
          if(emgPhoneInput) emgPhoneInput.value=d.emergencyPhone||'';
          if(mobilityInput) mobilityInput.value=d.mobility||'';
          if(checkinInput) checkinInput.value=d.checkinDate||'';
          if(statusInput) statusInput.value=d.leaveStatus||'';
        }
        modal.show();
      }
      if(btn.classList.contains('btn-danger')){
        if(confirm(`確定刪除「${id}」資料？`)){
          await db.collection(dbCol).doc(id).delete();
          load();
        }
      }
    });
  }

  load();
});
