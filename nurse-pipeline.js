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

  function parseBedNumber(bed) {
    if (!bed) return { num: 0, suffix: '' };
    const match = bed.match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    return {
      num: match ? parseInt(match[1]) : 0,
      suffix: match && match[2] ? match[2] : ''
    };
  }

  async function loadResidents() {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbResidents.get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">尚無住民資料</td></tr>`;
      return;
    }

    // 批次載入所有管路資料
    const pipeSnap = await dbPipelines.get();
    const pipelineMap = new Map();
    pipeSnap.forEach((pdoc) => {
      pipelineMap.set(pdoc.id, pdoc.data());
    });

    // 排序住民列表
    const residents = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    residents.sort((a, b) => {
      const pa = parseBedNumber(a.bedNumber);
      const pb = parseBedNumber(b.bedNumber);
      if (pa.num !== pb.num) return pa.num - pb.num;
      return pa.suffix.localeCompare(pb.suffix, 'zh-Hant', { numeric: true });
    });

    let total = residents.length;
    let stats = { maker: 0, central: 0, tracheostomy: 0, ngtube: 0, urine: 0 };
    let html = '';

    residents.forEach(resident => {
      const p = pipelineMap.get(resident.id) || {};

      if (p.maker) stats.maker++;
      if (p.central) stats.central++;
      if (p.tracheostomy) stats.tracheostomy++;
      if (p.ngtube) stats.ngtube++;
      if (p.urine) stats.urine++;

      html += `
        <tr data-id="${resident.id}">
          <td>${resident.bedNumber || ''}</td>
          <td>${resident.id}</td>
          <td><input type="checkbox" class="pipeCheck" data-type="maker" ${p.maker ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="central" ${p.central ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="tracheostomy" ${p.tracheostomy ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="ngtube" ${p.ngtube ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="urine" ${p.urine ? 'checked' : ''}></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // 綁定事件（一次綁所有）
    tbody.querySelectorAll('.pipeCheck').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const tr = e.target.closest('tr');
        const residentId = tr.dataset.id;
        const type = e.target.dataset.type;
        const update = {};
        update[type] = e.target.checked;
        await dbPipelines.doc(residentId).set(update, { merge: true });
        updateStats(); // 即時更新統計
      });
    });

    updateStats(total, stats);
  }

  function updateStats(total = null, stats = null) {
    // 若傳入統計值，直接顯示；否則重新統計畫面勾選
    if (!stats) {
      const rows = tbody.querySelectorAll('tr');
      total = rows.length;
      stats = { maker: 0, central: 0, tracheostomy: 0, ngtube: 0, urine: 0 };
      rows.forEach(row => {
        row.querySelectorAll('.pipeCheck').forEach(chk => {
          if (chk.checked) stats[chk.dataset.type]++;
        });
      });
    }
    countTotal.textContent = total;
    countMaker.textContent = `製氧機：${stats.maker}`;
    countCentral.textContent = `中央氧氣：${stats.central}`;
    countTracheostomy.textContent = `氣切：${stats.tracheostomy}`;
    countNGTube.textContent = `鼻胃管：${stats.ngtube}`;
    countUrine.textContent = `尿管：${stats.urine}`;
  }

  loadResidents();
});
