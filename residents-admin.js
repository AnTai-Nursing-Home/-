// residents-admin.fixed.js
// 修正：
// 1) 基本資料依「床號」排序（含 3 碼房號與子床號自然序）。
// 2) 床位配置空白：若尚未建立樓層模板，會依現有床號自動推導模板並存到 localStorage，再依模板顯示空床/實床。
// 3) 匯出 Excel 保留（含框線、底色、各樓層統計與總人數統計）。

(function(){
  let started=false;
  function canStart(){return typeof db!=='undefined' && db && typeof db.collection==='function'}
  function startNow(){if(started)return; started=true; document.dispatchEvent(new Event('residents-init'));}
  document.addEventListener('firebase-ready', ()=>startNow());
  if(document.readyState==='complete'||document.readyState==='interactive'){setTimeout(()=>{if(canStart())startNow()},300)}
  else{document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if(canStart())startNow()},300)})}
  let tries=0; const t=setInterval(()=>{ if(started){clearInterval(t);return} if(canStart()){startNow();clearInterval(t)} if(++tries>20)clearInterval(t) },500);
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
  function getTemplateRaw(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {'1':[], '2':[], '3':[]}; }
    catch{ return {'1':[], '2':[], '3':[]}; }
  }
  function setTemplate(tpl){ try{ localStorage.setItem(LS_KEY, JSON.stringify(tpl)); }catch{} }
  function normalizeToken(s){
    const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
    if(!m) return null;
    return `${m[1]}-${m[2]}`;
  }
  function ensureTemplateFromCache(data){
    const tpl = getTemplateRaw();
    let changed = false;
    [1,2,3].forEach(f=>{
      if(!tpl[String(f)] || tpl[String(f)].length===0){
        const tokens = [];
        data.forEach(r=>{
          const bed = normalizeToken(r.bedNumber);
          if(!bed) return;
          if(String(bed).startsWith(`${f}`)){ tokens.push(bed); }
        });
        const uniq = Array.from(new Set(tokens))
          .sort((a,b)=>{
            const ma=a.match(/^(\d{3})-(.+)$/); const mb=b.match(/^(\d{3})-(.+)$/);
            const ra=parseInt(ma[1],10), rb=parseInt(mb[1],10);
            if(ra!==rb) return ra-rb;
            const sa=parseInt(String(ma[2]).replace(/\D/g,''),10)||0;
            const sb=parseInt(String(mb[2]).replace(/\D/g,''),10)||0;
            return sa-sb;
          });
        tpl[String(f)] = uniq;
        changed = true;
      }
    });
    if(changed) setTemplate(tpl);
    return tpl;
  }
  function getTemplate(data){
    const raw = getTemplateRaw();
    if((raw['1']||[]).length===0 && (raw['2']||[]).length===0 && (raw['3']||[]).length===0){
      return ensureTemplateFromCache(data);
    }
    return raw;
  }

  const norm=v=>(v==null?'':String(v).trim());
  function bedToSortValue(bed){ if(!bed) return 0; const m=String(bed).match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/); if(!m) return 0; const base=parseInt(m[1],10); const sub=m[2]?parseInt(String(m[2]).replace(/\D/g,''),10)||0:0; return base+sub/100; }
  function calcAge(iso){ if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; const now=new Date(); let a=now.getFullYear()-d.getFullYear(); const m=now.getMonth()-d.getMonth(); if(m<0||(m===0&&now.getDate()<d.getDate())) a--; return a; }
  function parseDateSmart(v){
    if(!v&&v!==0) return '';
    if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString().slice(0,10);
    if(typeof v==='number'&&isFinite(v)){const ms=(v-25569)*86400000; const d=new Date(ms); if(!isNaN(d)) return new Date(d.getTime()+d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
    let s=String(v).trim(); if(!s) return ''; s=s.replace(/[\.年\/-]/g,'-').replace(/月/g,'-').replace(/日/g,'').replace(/\s+/g,''); const m=s.match(/^(\d{1,4})-?(\d{1,2})-?(\d{1,2})$/); if(m){let y=+m[1],mo=+m[2],da=+m[3]; if(y<1911) y+=1911; const dd=new Date(Date.UTC(y,mo-1,da)); if(!isNaN(dd)) return dd.toISOString().slice(0,10);} const d2=new Date(s); if(!isNaN(d2)) return d2.toISOString().slice(0,10); return ''; }
  function rocName(){ const d=new Date(); const y=d.getFullYear()-1911; const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}${m}${dd}-床位配置-消防位置圖-報告詞 -`; }

  let cache=[];

  function renderBasic(){
    if(!tbody) return;
    let html='';
    cache.forEach(r=>{
      const age=calcAge(r.birthday);
      html+=`<tr data-id="${r.id}">
        <td>${r.nursingStation||''}</td><td>${r.bedNumber||''}</td><td>${r.id||''}</td><td>${r.idNumber||''}</td>
        <td>${r.birthday||''}</td><td>${r.gender||''}</td><td>${age!==''?age:''}</td>
        <td>${r.emergencyContact||''}</td><td>${r.emergencyPhone||''}</td><td>${r.mobility||''}</td>
        <td>${r.checkinDate||''}</td><td>${r.leaveStatus||''}</td>
        <td><button class="btn btn-sm btn-primary btn-edit">編輯</button> <button class="btn btn-sm btn-danger btn-delete">刪除</button></td>
      </tr>`;
    });
    tbody.innerHTML=html;
  }

  function parseBedToken(s){ const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return null; return {room:m[1], sub:m[2], token:`${m[1]}-${m[2]}`}; }
  function buildFloorHtml(container,floor,tpl,data){
    if(!container) return;
    container.innerHTML='';

    const tokens=(tpl[String(floor)]||[]).slice();
    if(tokens.length===0){
      container.innerHTML = '<div class="alert alert-warning">尚未設定床位模板，已自動建立。請重新整理。</div>';
      return;
    }
    const grouped=new Map();
    tokens.forEach(tok=>{const t=parseBedToken(tok); if(!t) return; if(!grouped.has(t.room)) grouped.set(t.room,{}); const g=grouped.get(t.room); if(!g.__keys) g.__keys=new Set(); g.__keys.add(t.sub);});
    const resByToken=new Map(); data.forEach(r=>{ const key=normalizeToken(r.bedNumber); if(key) resByToken.set(key,r); });

    const rooms=[...grouped.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));
    let html='<div class="row g-2">';
    let totalBeds=0, usedBeds=0;
    const emptyTokens=[];

    rooms.forEach(room=>{
      const g=grouped.get(room); const subs=[...g.__keys].sort((a,b)=>(parseInt(a.replace(/\D/g,''),10)||0)-(parseInt(b.replace(/\D/g,''),10)||0));
      totalBeds += subs.length;
      let rows='';
      subs.forEach(sub=>{
        const token=`${room}-${sub}`;
        const r=resByToken.get(token);
        const age=r?calcAge(r.birthday):'';
        const status = r ? (r.leaveStatus==='住院'?'bg-danger-subtle':(r.leaveStatus==='請假'?'bg-warning-subtle':'bg-success-subtle')) : 'bg-light';
        if(r) usedBeds++; else emptyTokens.push(token);
        rows+=`<div class="d-flex justify-content-between border-bottom py-2 ${status}">
          <div class="small text-muted">🛏 ${token}</div>
          <div>${r?(r.id||'🈳 空床'):'🈳 空床'} ${r?(r.gender||''):''} ${age!==''?`/ ${age}歲`:''}</div>
        </div>`;
      });
      html+=`<div class="col-12 col-sm-6 col-lg-4"><div class="card h-100">
        <div class="card-header fw-bold">房號 ${room}</div>
        <div class="card-body">${rows}</div>
      </div></div>`;
    });
    html+='</div>';

    const emptyBeds = totalBeds - usedBeds;
    html+= `<div class="mt-3">
      <div class="row g-2 align-items-start">
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">樓層床位數 <strong>${totalBeds}</strong></div></div>
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">空床數 <strong>${emptyBeds}</strong></div></div>
        <div class="col-auto"><div class="badge bg-secondary-subtle text-dark p-2">已使用床位數 <strong>${usedBeds}</strong></div></div>
      </div>
      <div class="small text-muted mt-2">空床清單：${emptyTokens.length? emptyTokens.join('、') : '無'}</div>
    </div>`;

    container.innerHTML=html;
  }

  function renderFloors(tpl){
    const f1=cache.filter(r=>/^1\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/1/.test(r.nursingStation)));
    const f2=cache.filter(r=>/^2\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/2/.test(r.nursingStation)));
    const f3=cache.filter(r=>/^3\d\d/.test(String(r.bedNumber))||(r.nursingStation&&/3/.test(r.nursingStation)));
    buildFloorHtml(floor1Grid,1,tpl,f1);
    buildFloorHtml(floor2Grid,2,tpl,f2);
    buildFloorHtml(floor3Grid,3,tpl,f3);
  }

  function renderStats(){
    if(!statsArea) return;
    const total=cache.length;
    const male=cache.filter(r=>r.gender==='男').length;
    const female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>r.leaveStatus==='請假').length;
    const hosp=cache.filter(r=>r.leaveStatus==='住院').length;
    const present=total-(leave+hosp);

    function fl(f){ return cache.filter(r=> new RegExp('^'+f+'\\d\\d').test(String(r.bedNumber||'')) || (r.nursingStation && r.nursingStation.includes(String(f)))); }
    const normv=s=>(s==null?'':String(s));
    const WHEEL=/(輪椅)/i, TROLLEY=/(推床|臥床|平車|推車)/i, WALK=/(步行|可獨立|助行|拐杖|walker)/i;
    const mob = [1,2,3].map(f=>({wheel: fl(f).filter(r=>WHEEL.test(normv(r.mobility))).length, trolley: fl(f).filter(r=>TROLLEY.test(normv(r.mobility))).length, walk: fl(f).filter(r=>WALK.test(normv(r.mobility))).length }));

    statsArea.innerHTML = `
      <div class="col-md-6">
        <div class="card"><div class="card-body">
          <div class="h5 mb-2">總人數 <span class="ms-2 badge bg-secondary">${total}</span></div>
          <div class="text-muted mb-2">男：${male} ・ 女：${female} ・ 實到：<strong>${present}</strong> ・ 請假：${leave} ・ 住院：${hosp}</div>
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead><tr><th>樓層</th><th>輪椅</th><th>推床</th><th>步行</th></tr></thead>
              <tbody>
                <tr><td>1F</td><td>${mob[0].wheel}</td><td>${mob[0].trolley}</td><td>${mob[0].walk}</td></tr>
                <tr><td>2F</td><td>${mob[1].wheel}</td><td>${mob[1].trolley}</td><td>${mob[1].walk}</td></tr>
                <tr><td>3F</td><td>${mob[2].wheel}</td><td>${mob[2].trolley}</td><td>${mob[2].walk}</td></tr>
              </tbody>
            </table>
          </div>
        </div></div>
      </div>
      <div class="col-md-6">
        <div class="card"><div class="card-body text-end">
          <button id="export-xls-styled" class="btn btn-success btn-sm"><i class="fa-solid fa-file-excel me-1"></i>匯出 Excel（含框線與底色）</button>
        </div></div>
      </div>`;
  }


  // === 手動模板設定 ===
  const openTplBtn = document.getElementById('open-template-btn');
  const tplModalEl = document.getElementById('template-modal');
  let tplModal = null;
  if (window.bootstrap && tplModalEl) tplModal = new bootstrap.Modal(tplModalEl);
  const tplTextarea = document.getElementById('template-input');
  const saveTplBtn = document.getElementById('save-template-btn');

  function parseTokensToTemplate(text){
    const tpl = {'1':[], '2':[], '3':[]};
    if(!text || !text.trim()) return tpl;
    const raw = text.replace(/[,\s]+/g,' ').trim().split(' ');
    const norm = s => {
      const m=String(s||'').trim().match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/);
      return m? `${m[1]}-${m[2]}` : null;
    };
    const set = {'1':new Set(),'2':new Set(),'3':new Set()};
    raw.forEach(tok=>{
      const t = norm(tok);
      if(!t) return;
      const floor = t[0];
      if(floor==='1') set['1'].add(t);
      else if(floor==='2') set['2'].add(t);
      else if(floor==='3') set['3'].add(t);
    });
    ['1','2','3'].forEach(f=>{
      tpl[f] = Array.from(set[f]).sort((a,b)=>{
        const ma=a.match(/^(\d{3})-(.+)$/); const mb=b.match(/^(\d{3})-(.+)$/);
        const ra=parseInt(ma[1],10), rb=parseInt(mb[1],10);
        if(ra!==rb) return ra-rb;
        const sa=parseInt(String(ma[2]).replace(/\D/g,''),10)||0;
        const sb=parseInt(String(mb[2]).replace(/\D/g,''),10)||0;
        return sa-sb;
      });
    });
    return tpl;
  }

  if(openTplBtn && tplModal && tplTextarea && saveTplBtn){
    openTplBtn.addEventListener('click', ()=>{
      // 預填目前模板內容
      const cur = JSON.parse(localStorage.getItem(LS_KEY) || '{"1":[],"2":[],"3":[]}');
      const merged = [...(cur['1']||[]), ...(cur['2']||[]), ...(cur['3']||[])].join(' ');
      tplTextarea.value = merged;
      tplModal.show();
    });
    saveTplBtn.addEventListener('click', ()=>{
      const text = tplTextarea.value;
      const tpl = parseTokensToTemplate(text);
      localStorage.setItem(LS_KEY, JSON.stringify(tpl));
      if(tplModal) tplModal.hide();
      // 重新渲染樓層（不刷新 Firestore）
      renderFloors(tpl);
    });
  }

  function tableCss(){
    return `
      table { border-collapse: collapse; font-family: "Microsoft JhengHei", Arial; }
      th, td { border: 1px solid #999; padding: 4px 6px; mso-number-format:"\\@"; }
      th { background: #f1f3f5; }
      .room-title { background:#e7f1ff; font-weight:bold; }
      .cell-muted { color:#6c757d; }
      .bg-green { background:#e6ffed; }
      .bg-yellow { background:#fff7cc; }
      .bg-red { background:#ffe3e3; }
    `;
  }
  function sheetBasicHTML(){
    const header=['護理站','床號','姓名','身份證字號','生日','性別','住民年齡','緊急連絡人或家屬','連絡電話','行動方式','入住日期','住民請假'];
    const rows=cache.map(r=>[r.nursingStation||'',r.bedNumber||'',r.id||'',r.idNumber||'',r.birthday||'',r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)),r.emergencyContact||'',r.emergencyPhone||'',r.mobility||'',r.checkinDate||'',r.leaveStatus||'']);
    let html='<table><thead><tr>'+header.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>';
    rows.forEach(tr=>{ html+='<tr>'+tr.map(td=>`<td>${td||''}</td>`).join('')+'</tr>'; });
    html+='</tbody></table>';
    return html;
  }
  function sheetFloorHTML(floor){
    const tpl=getTemplate(cache); const tokens=(tpl[String(floor)]||[]).slice();
    const map=new Map(); tokens.forEach(t=>{ const m=t.match(/^(\d{3})[-_]?([A-Za-z0-9]+)$/); if(!m) return; const room=m[1], sub=m[2]; if(!map.has(room)) map.set(room,[]); map.get(room).push(sub); });
    const resMap=new Map(); cache.forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-'); resMap.set(key,r); });
    let html='<table>';
    html+=`<tr><th colspan="9" class="room-title">${floor}樓床位配置</th></tr>`;
    const rooms=[...map.keys()].sort((a,b)=>parseInt(a,10)-parseInt(b,10));

    let floorTotal=0, floorUsed=0;
    for(let i=0;i<rooms.length;i+=3){
      const chunk=rooms.slice(i,i+3);
      let tr='<tr>';
      chunk.forEach(room=>{ tr+=`<th colspan="3" class="room-title">房號 ${room}</th><td></td>`; });
      tr+='</tr>'; html+=tr;
      const maxLines=Math.max(...chunk.map(rm=> map.get(rm).length));
      for(let line=0; line<maxLines; line++){
        let row='<tr>';
        chunk.forEach(room=>{
          const subs=map.get(room);
          const sub=subs[line];
          const key=sub? `${room}-${sub}`:'';
          if(key) floorTotal++;
          const r=resMap.get(key);
          if(r) floorUsed++;
          const age=r? calcAge(r.birthday):'';
          const status=r? (r.leaveStatus==='住院'?'bg-red':(r.leaveStatus==='請假'?'bg-yellow':'bg-green')):'';
          row+=`<td class="cell-muted">🛏 ${key||''}</td>`;
          row+=`<td>${r?(r.id||''):'🈳 空床'}</td>`;
          row+=`<td class="${status}">${r?(r.gender||''):''} ${age!==''?`/ ${age}歲`:''}</td>`;
          row+=`<td></td>`;
        });
        row+='</tr>'; html+=row;
      }
      html+='<tr><td colspan="9" style="border:none;height:6px"></td></tr>';
    }
    const floorEmpty=floorTotal-floorUsed;
    html+=`<tr><td>樓層床位數</td><td>${floorTotal}</td><td>空床數</td><td>${floorEmpty}</td><td>已使用床位數</td><td>${floorUsed}</td><td colspan="3"></td></tr>`;
    html+='</table>';
    return html;
  }
  function sheetStatsHTML(){
    const total=cache.length, male=cache.filter(r=>r.gender==='男').length, female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>r.leaveStatus==='請假').length, hosp=cache.filter(r=>r.leaveStatus==='住院').length;
    const present=total-(leave+hosp);
    let html='<table>';
    html+=`<tr><th colspan="8" class="room-title">總人數統計</th></tr>`;
    html+=`<tr><td>總人數</td><td>${total}</td><td>男</td><td>${male}</td><td>女</td><td>${female}</td><td>實到</td><td>${present}</td></tr>`;
    html+=`<tr><td>請假</td><td>${leave}</td><td>住院</td><td>${hosp}</td><td colspan="4"></td></tr>`;
    html+='</table>';
    return html;
  }
  function buildWorkbookHTML(sheets){
    const worksheetXml = sheets.map(s=>`
      <x:ExcelWorksheet>
        <x:Name>${s.name}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet>`).join('');
    const content = sheets.map(s=>`<div id="${s.name}">${s.html}</div>`).join('');
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>${worksheetXml}
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>${tableCss()}</style>
      </head>
      <body>
        ${content}
      </body></html>`;
  }


  
  async function exportStyledXls(){
    if (typeof ExcelJS === 'undefined') { alert('ExcelJS 載入失敗，無法匯出樣式。'); return; }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MSICAO';
    wb.created = new Date();

    // ===== 樣式 =====
    const headerFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEFEFEF'} };
    const headerFont = { name:'Microsoft JhengHei', bold:true, size:11 };
    const cellFont = { name:'Microsoft JhengHei', size:11 };
    const borderThin = { top:{style:'thin',color:{argb:'FF999999'}}, left:{style:'thin',color:{argb:'FF999999'}}, bottom:{style:'thin',color:{argb:'FF999999'}}, right:{style:'thin',color:{argb:'FF999999'}} };
    const borderThick = { top:{style:'medium',color:{argb:'FF666666'}}, left:{style:'medium',color:{argb:'FF666666'}}, bottom:{style:'medium',color:{argb:'FF666666'}}, right:{style:'medium',color:{argb:'FF666666'}} };
    const zebraFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF8F9FA'} };
    const titleFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFDCE6F1'} };
    const titleFont = { name:'Microsoft JhengHei', bold:true, size:14 };

    function setColWidths(ws, widths){
      ws.columns = widths.map(w => ({ width:w }));
    }
    function styleRow(row, {isHeader=false, alt=false, thick=false, center=false}={}){
      row.eachCell(c=>{
        c.font = isHeader ? headerFont : cellFont;
        c.border = thick ? borderThick : borderThin;
        if(isHeader){
          c.fill = headerFill;
          c.alignment = { vertical:'middle', horizontal:'center' };
        }else{
          c.alignment = { vertical:'middle', horizontal: center ? 'center' : (c.alignment?.horizontal || 'left') };
          if(alt){ c.fill = zebraFill; }
        }
      });
      row.height = 20;
    }
    function addTitle(ws, text, colCount){
      const titleRow = ws.addRow([text]);
      // merge A1:Ax
      ws.mergeCells(1,1,1,colCount);
      titleRow.eachCell(c=>{
        c.font = titleFont;
        c.fill = titleFill;
        c.alignment = { vertical:'middle', horizontal:'center' };
        c.border = borderThick;
      });
      titleRow.height = 26;
    }
    function addTable(ws, headers, rows, widths, withTitle){
      setColWidths(ws, widths);
      if(withTitle){ addTitle(ws, withTitle, widths.length); }
      const headerRow = ws.addRow(headers);
      styleRow(headerRow, {isHeader:true, thick:true});
      rows.forEach((r,i)=>{
        const row = ws.addRow(r);
        styleRow(row, {alt: i%2===1});
      });
      ws.views = [{ state:'frozen', ySplit: withTitle ? 2 : 1 }];
    }

    // ===== 基本資料 =====
    const wsBasic = wb.addWorksheet('基本資料');
    const headers = ['護理站','床號','姓名','身份證字號','生日','性別','住民年齡','緊急連絡人或家屬','連絡電話','行動方式','入住日期','住民請假'];
    const rowsBasic = cache.map(r=>[
      r.nursingStation||'', r.bedNumber||'', r.id||'', r.idNumber||'', r.birthday||'', r.gender||'',
      (function(a){return a!==''?a:'';})(calcAge(r.birthday)),
      r.emergencyContact||'', r.emergencyPhone||'', r.mobility||'', r.checkinDate||'', r.leaveStatus||''
    ]);
    // 參考樣式的欄寬（微調）：
    addTable(wsBasic, headers, rowsBasic, [13,19,20,18,12,8,10,20,14,12,14,12], '住民基本資料');

    // ===== 每層床位配置 =====
    function floorRows(floor){
      const tpl=getTemplate(cache);
      const tokens = (tpl[String(floor)]||[]).slice();
      const resMap = new Map(); cache.forEach(r=>{ const key=String(r.bedNumber||'').replace('_','-'); resMap.set(key,r); });
      const rows=[]; let total=0, used=0; const emptyList=[];
      tokens.forEach(t=>{
        total++;
        const r=resMap.get(t);
        if(r){ used++; rows.push([t, r.id||'', r.gender||'', (function(a){return a!==''?a:'';})(calcAge(r.birthday)), r.leaveStatus||'']); }
        else{ rows.push([t, '🈳 空床', '', '', '']); emptyList.push(t); }
      });
      return {rows,total,used,emptyList};
    }
    function addFloorSheet(name,floor){
      const ws = wb.addWorksheet(name);
      const {rows,total,used,emptyList} = floorRows(floor);
      addTable(ws, ['床號','姓名','性別','年齡','狀態'], rows, [14,20,10,10,12], `${floor}樓床位配置（分性別）`);
      ws.addRow([]);
      const sumRow = ws.addRow(['樓層床位數', total, '空床數', total-used, '已使用床位數', used]);
      styleRow(sumRow, {thick:true});
      const emptyRow = ws.addRow(['空床清單', emptyList.join('、')]);
      styleRow(emptyRow);
      ws.getColumn(1).alignment = { horizontal:'left', vertical:'middle' };
    }
    addFloorSheet('1樓床位配置',1);
    addFloorSheet('2樓床位配置',2);
    addFloorSheet('3樓床位配置',3);

    // ===== 總人數統計 =====
    const wsStats = wb.addWorksheet('總人數統計');
    addTitle(wsStats, '總人數統計', 2);
    const total=cache.length;
    const male=cache.filter(r=>r.gender==='男').length;
    const female=cache.filter(r=>r.gender==='女').length;
    const leave=cache.filter(r=>r.leaveStatus==='請假').length;
    const hosp=cache.filter(r=>r.leaveStatus==='住院').length;
    const present=total-(leave+hosp);
    setColWidths(wsStats, [12,10]);
    const hdr = wsStats.addRow(['項目','數量']); styleRow(hdr, {isHeader:true, thick:true});
    [['總人數', total],['男', male],['女', female],['實到', present],['請假', leave],['住院', hosp]].forEach((r,i)=>{
      const row = wsStats.addRow(r); styleRow(row, {alt: i%2===1});
    });
    wsStats.views = [{ state:'frozen', ySplit:2 }];

    // ===== 下載 =====
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = rocName()+'.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
    function hookEvents(){
    document.addEventListener('click', (e)=>{
      const t=e.target;
      if(t.closest('#export-xls-styled')) exportStyledXls();
    });
  }

  async function load(){
    if(tbody) tbody.innerHTML='<tr><td colspan="13" class="text-center">讀取中...</td></tr>';
    try{
      const snap=await db.collection(dbCol).get();
      cache=snap.docs.map(d=>({id:d.id,...d.data()}));
      cache.sort((a,b)=> bedToSortValue(a.bedNumber)-bedToSortValue(b.bedNumber));
      const tpl = getTemplate(cache);
      renderBasic(); renderFloors(tpl); renderStats(); hookEvents();
    }catch(e){
      console.error(e);
      if(tbody) tbody.innerHTML='<tr><td colspan="13"><div class="alert alert-danger m-0">讀取失敗</div></td></tr>';
    }
  }

  // 匯入（保留）
  if(importBtn && fileInput){
    importBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', handleExcelImport);
  }
  function pick(row, aliases){ const map={}; Object.keys(row).forEach(k=>{ map[String(k).replace(/\s+/g,'').trim()] = row[k]; }); for(const a of aliases){ const kk=String(a).replace(/\s+/g,'').trim(); if(Object.prototype.hasOwnProperty.call(map,kk)) return map[kk]; } return ''; }
  async function handleExcelImport(evt){
    const file=evt.target.files[0]; if(!file) return;
    if(importStatus){ importStatus.className='alert alert-info'; importStatus.classList.remove('d-none'); importStatus.textContent='正在讀取檔案...'; }
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
        if(importStatus){ importStatus.className='alert alert-success'; importStatus.textContent=`成功匯入 ${count} 筆資料！重新載入中...`; }
        setTimeout(()=>location.reload(),1000);
      }catch(err){
        console.error(err);
        if(importStatus){ importStatus.className='alert alert-danger'; importStatus.textContent='匯入失敗，請檢查檔案。'; }
      }finally{ if(fileInput) fileInput.value=''; }
    };
    reader.readAsArrayBuffer(file);
  }

  // 新增/編輯/刪除（保留原 DOM）
  let modal; const modalEl=document.getElementById('resident-modal'); if(window.bootstrap && modalEl) modal=new bootstrap.Modal(modalEl);
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
      const name=nameInput? nameInput.value.trim():''; if(!name) return alert('請填寫姓名');
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
