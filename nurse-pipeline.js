document.addEventListener('firebase-ready', async () => {
  const dbResidents = db.collection('residents');
  const dbPipelines = db.collection('residents_pipelines');
  const tbody = document.getElementById('pipelineTableBody');

  const countTotal = document.getElementById('count-total');
  const countMaker = document.getElementById('count-maker');
  const countCentral = document.getElementById('count-central');
  const countTracheostomy = document.getElementById('count-tracheostomy');
  const countNGTube = document.getElementById('count-ngtube');
  const countUrine = document.getElementById('count-urine');

  async function loadResidents() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbResidents.orderBy('bedNumber').get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">尚無住民資料</td></tr>`;
      return;
    }

    let total = 0;
    let stats = { maker: 0, central: 0, tracheostomy: 0, ngtube: 0, urine: 0 };

    tbody.innerHTML = '';
    for (const doc of snap.docs) {
      const data = doc.data();
      const id = doc.id;
      const pipelineDoc = await dbPipelines.doc(id).get();
      const p = pipelineDoc.exists ? pipelineDoc.data() : {};
      total++;

      if (p.maker) stats.maker++;
      if (p.central) stats.central++;
      if (p.tracheostomy) stats.tracheostomy++;
      if (p.ngtube) stats.ngtube++;
      if (p.urine) stats.urine++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data.bedNumber || ''}</td>
        <td>${id}</td>
        <td><input type="checkbox" class="pipeCheck" data-type="maker" ${p.maker ? 'checked' : ''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="central" ${p.central ? 'checked' : ''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="tracheostomy" ${p.tracheostomy ? 'checked' : ''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="ngtube" ${p.ngtube ? 'checked' : ''}></td>
        <td><input type="checkbox" class="pipeCheck" data-type="urine" ${p.urine ? 'checked' : ''}></td>
      `;

      tr.querySelectorAll('.pipeCheck').forEach(chk => {
        chk.addEventListener('change', async () => {
          const type = chk.dataset.type;
          const update = {};
          update[type] = chk.checked;
          await dbPipelines.doc(id).set(update, { merge: true });
          loadResidents(); // 重新載入更新統計
        });
      });

      tbody.appendChild(tr);
    }

    updateStats(total, stats);
  }

  function updateStats(total, stats) {
    countTotal.textContent = total;
    countMaker.textContent = `製氧機：${stats.maker}`;
    countCentral.textContent = `中央氧氣：${stats.central}`;
    countTracheostomy.textContent = `氣切：${stats.tracheostomy}`;
    countNGTube.textContent = `鼻胃管：${stats.ngtube}`;
    countUrine.textContent = `尿管：${stats.urine}`;
  }

  loadResidents();
});
