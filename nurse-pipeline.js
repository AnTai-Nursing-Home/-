document.addEventListener('firebase-ready', async () => {
  const dbResidents = db.collection('residents');
  const dbHistory = db.collection('nurse_pipeline_history');
  const dbPipelines = db.collection('residents_pipelines');
  const tbody = document.getElementById('pipelineTableBody');
  const btnSave = document.getElementById('btn-save-snapshot');
  const btnHistory = document.getElementById('btn-view-history');
  const signDate = document.getElementById('sign-date');
  const signName = document.getElementById('sign-name');
  const btnConfirmSnapshot = document.getElementById('btn-confirm-snapshot');
  let latestStore = { residents: [], pipeline: new Map(), stats: null, total: 0, present: 0 };
  const countTotal = document.getElementById('count-total');
  const countMaker = document.getElementById('count-maker');
  const countCentral = document.getElementById('count-central');
  const countTracheostomy = document.getElementById('count-tracheostomy');
  const countSuction = document.getElementById('count-suction');
  const countNGTube = document.getElementById('count-ngtube');
  const countUrine = document.getElementById('count-urine');
  const countSpecial = document.getElementById('count-special');
  const countWound = document.getElementById('count-wound');
  const countPresent = document.getElementById('count-present');

  function parseBedNumber(bed) {
    if (!bed) return { num: 0, suffix: '' };
    const match = bed.match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    return { num: match ? parseInt(match[1]) : 0, suffix: match && match[2] ? match[2] : '' };
  }

  async function loadResidents() {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbResidents.get();
    if (snap.empty) {tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">尚無住民資料</td></tr>`; return;}
    const pipeSnap = await dbPipelines.get();
    const pipelineMap = new Map();
    pipeSnap.forEach(pdoc => pipelineMap.set(pdoc.id, pdoc.data()));
    const residents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    residents.sort((a,b)=>{const pa=parseBedNumber(a.bedNumber);const pb=parseBedNumber(b.bedNumber);if(pa.num!==pb.num)return pa.num-pb.num;return pa.suffix.localeCompare(pb.suffix,'zh-Hant',{numeric:true});});
    const presentResidents = residents.filter(r => !(r.leaveStatus && r.leaveStatus !== ''));
    let total = residents.length;
    let presentCount = presentResidents.length;
    let stats = { maker:0, central:0, tracheostomy:0, suction:0, ngtube:0, urine:0, special:0, wound:0 };
    let html = '';
    residents.forEach(r=>{
      const p = pipelineMap.get(r.id)||{};
      const specialList = p.special||[];
      const isAbsent = !!(r.leaveStatus && r.leaveStatus !== '');
      if(!isAbsent){
        if(p.maker)stats.maker++; if(p.central)stats.central++; if(p.tracheostomy)stats.tracheostomy++; if(p.suction)stats.suction++; if(p.ngtube)stats.ngtube++; if(p.urine)stats.urine++;
        if(specialList.length>0)stats.special+=specialList.length;
        if(p.wound && p.wound !== "") stats.wound++;
      }

      const specialHTML = specialList.map((s,i)=>`<div class="d-flex align-items-center justify-content-between border rounded p-1 my-1"><span>${s}</span><button class="btn btn-sm btn-outline-danger btn-remove-special" data-index="${i}" data-id="${r.id}"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
      html += `<tr data-id="${r.id}" class="${(r.leaveStatus&&r.leaveStatus!=="")?"table-secondary":""}">
        <td>${r.bedNumber||''}</td>
        <td>${r.id} ${(r.leaveStatus==='請假')?'<span class="badge bg-warning ms-1">請假</span>':''} ${(r.leaveStatus==='住院')?'<span class="badge bg-danger ms-1">住院</span>':''}</td>
        <td><input type="checkbox" class="pipeCheck" data-type="maker" ${p.maker?'checked':''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="central" ${p.central?'checked':''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="tracheostomy" ${p.tracheostomy?'checked':''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="suction" ${p.suction?'checked':''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="ngtube" ${p.ngtube?'checked':''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="urine" ${p.urine?'checked':''}></td>
        <td><div>${specialHTML||'<span class="text-muted">無</span>'}</div>
        <div class="mt-2"><select class="form-select form-select-sm d-inline w-auto specialSelect">
          <option value="">新增特殊管路...</option>
          <option value="port-A">port-A</option>
          <option value="鼻腸管">鼻腸管</option>
          <option value="膀胱造廔口接尿管">膀胱造廔口接尿管</option>
          <option value="腸造廔口">腸造廔口</option>
        </select></div></td>
        <td>
          <select class="form-select form-select-sm woundSelect">
            <option value="">選擇傷口...</option>
            <option value="壓傷" ${p.wound==='壓傷'?'selected':''}>壓傷</option>
            <option value="外傷" ${p.wound==='外傷'?'selected':''}>外傷</option>
            <option value="術後傷口" ${p.wound==='術後傷口'?'selected':''}>術後傷口</option>
            <option value="疾病所致" ${p.wound==='疾病所致'?'selected':''}>疾病所致</option>
          </select>
        </td>
      </tr>`;
    });
    tbody.innerHTML=html;

    tbody.querySelectorAll('.pipeCheck').forEach(chk=>chk.addEventListener('change',async e=>{
      const id=e.target.closest('tr').dataset.id;
      const t=e.target.dataset.type;
      await dbPipelines.doc(id).set({[t]:e.target.checked},{merge:true});
      loadResidents();
    }));

    tbody.querySelectorAll('.specialSelect').forEach(sel=>sel.addEventListener('change',async e=>{
      const id=e.target.closest('tr').dataset.id;
      const v=e.target.value;
      if(!v)return;
      const ref=dbPipelines.doc(id);
      const doc=await ref.get();
      const data=doc.exists?doc.data():{};
      const cur=data.special||[];
      if(!cur.includes(v))cur.push(v);
      await ref.set({special:cur},{merge:true});
      loadResidents();
    }));

    tbody.querySelectorAll('.btn-remove-special').forEach(btn=>btn.addEventListener('click',async e=>{
      const id=e.target.closest('button').dataset.id;
      const index=parseInt(e.target.closest('button').dataset.index);
      const ref=dbPipelines.doc(id);
      const doc=await ref.get();
      if(!doc.exists)return;
      const data=doc.data();
      const cur=data.special||[];
      cur.splice(index,1);
      await ref.set({special:cur},{merge:true});
      loadResidents();
    }));

    tbody.querySelectorAll('.woundSelect').forEach(sel=>sel.addEventListener('change',async e=>{
      const id=e.target.closest('tr').dataset.id;
      const v=e.target.value;
      await dbPipelines.doc(id).set({wound:v},{merge:true});
      loadResidents();
    }));

    updateStats(total,stats);
  }

  function updateStats(total,stats){
    countTotal.textContent=total;
    countMaker.textContent=`製氧機：${stats.maker}`;
    countCentral.textContent=`中央氧氣：${stats.central}`;
    countTracheostomy.textContent=`氣切：${stats.tracheostomy}`;
    countSuction.textContent=`抽痰：${stats.suction}`;
    countNGTube.textContent=`鼻胃管：${stats.ngtube}`;
    countUrine.textContent=`尿管：${stats.urine}`;
    countSpecial.textContent=`特殊管路：${stats.special}`;
    countWound.textContent=`傷口：${stats.wound}`;
  }

  function openSnapshotModal(){
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const d = String(today.getDate()).padStart(2,'0');
    if (signDate) signDate.value = `${y}-${m}-${d}`;
    const modal = new bootstrap.Modal(document.getElementById('snapshotModal'));
    modal.show();
  }
  async function saveSnapshot(){
    const date = (signDate && signDate.value)||'';
    const signer = (signName && signName.value)||'';
    if(!signer){
      const modalEl = document.getElementById('snapshotModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      return;
    }
    const items = latestStore.residents.map(r=>{
      const p = latestStore.pipeline.get(r.id)||{};
      return {
        id: r.id, bedNumber: r.bedNumber||'', leaveStatus: r.leaveStatus||'',
        maker: !!p.maker, central: !!p.central, tracheostomy: !!p.tracheostomy,
        suction: !!p.suction, ngtube: !!p.ngtube, urine: !!p.urine,
        special: Array.isArray(p.special)? p.special : [], wound: p.wound || ''
      };
    });
    const payload = {
      date, signer,
      total: latestStore.total,
      present: latestStore.present,
      stats: latestStore.stats,
      items,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await dbHistory.add(payload);
    const modalEl = document.getElementById('snapshotModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
  async function loadHistory(){
    const snap = await dbHistory.orderBy('createdAt','desc').limit(50).get();
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    let h='';
    snap.forEach(doc=>{
      const d = doc.data();
      h += `<tr>
        <td>${d.date||''}</td>
        <td>${d.signer||''}</td>
        <td>${d.total||0}</td>
        <td>${d.present||0}</td>
        <td>${(d.stats&&d.stats.ngtube)||0}</td>
        <td>${(d.stats&&d.stats.tracheostomy)||0}</td>
        <td>${(d.stats&&d.stats.suction)||0}</td>
        <td>${(d.stats&&d.stats.urine)||0}</td>
        <td>${(d.stats&&d.stats.special)||0}</td>
        <td>${(d.stats&&d.stats.wound)||0}</td>
      </tr>`;
    });
    tbody.innerHTML = h || '<tr><td colspan="10" class="text-center text-muted">尚無歷程紀錄</td></tr>';
  }
  if (btnSave) btnSave.addEventListener('click', openSnapshotModal);
  if (btnConfirmSnapshot) btnConfirmSnapshot.addEventListener('click', saveSnapshot);
  if (btnHistory) btnHistory.addEventListener('click', ()=>{
    loadHistory();
    const modal = new bootstrap.Modal(document.getElementById('historyModal'));
    modal.show();
  });

  loadResidents();
});
