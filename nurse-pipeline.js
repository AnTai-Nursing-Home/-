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
  const countSpecial = document.getElementById('count-special');

  function parseBedNumber(bed) {
    if (!bed) return { num: 0, suffix: '' };
    const match = bed.match(/^(\d+)(?:[-_]?([A-Za-z0-9]+))?/);
    return {
      num: match ? parseInt(match[1]) : 0,
      suffix: match && match[2] ? match[2] : ''
    };
  }

  async function loadResidents() {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">讀取中...</td></tr>`;
    const snap = await dbResidents.get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">尚無住民資料</td></tr>`;
      return;
    }

    const pipeSnap = await dbPipelines.get();
    const pipelineMap = new Map();
    pipeSnap.forEach((pdoc) => pipelineMap.set(pdoc.id, pdoc.data()));

    const residents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    residents.sort((a, b) => {
      const pa = parseBedNumber(a.bedNumber);
      const pb = parseBedNumber(b.bedNumber);
      if (pa.num !== pb.num) return pa.num - pb.num;
      return pa.suffix.localeCompare(pb.suffix, 'zh-Hant', { numeric: true });
    });

    let total = residents.length;
    let stats = { maker: 0, central: 0, tracheostomy: 0, ngtube: 0, urine: 0, special: 0 };
    let html = '';

    residents.forEach(resident => {
      const p = pipelineMap.get(resident.id) || {};
      const specialList = p.special || [];

      if (p.maker) stats.maker++;
      if (p.central) stats.central++;
      if (p.tracheostomy) stats.tracheostomy++;
      if (p.ngtube) stats.ngtube++;
      if (p.urine) stats.urine++;
      if (specialList.length > 0) stats.special += specialList.length;

      const specialHTML = specialList.map((s, i) => `
        <div class="d-flex align-items-center justify-content-between border rounded p-1 my-1">
          <span>${s}</span>
          <button class="btn btn-sm btn-outline-danger btn-remove-special" data-index="${i}" data-id="${resident.id}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('');

      html += `
        <tr data-id="${resident.id}">
          <td>${resident.bedNumber || ''}</td>
          <td>${resident.id}</td>
          <td><input type="checkbox" class="pipeCheck" data-type="maker" ${p.maker ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="central" ${p.central ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="tracheostomy" ${p.tracheostomy ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="ngtube" ${p.ngtube ? 'checked' : ''}></td>
          <td><input type="checkbox" class="pipeCheck" data-type="urine" ${p.urine ? 'checked' : ''}></td>
          <td>
            <div>${specialHTML || '<span class="text-muted">無</span>'}</div>
            <div class="mt-2">
              <select class="form-select form-select-sm d-inline w-auto specialSelect">
                <option value="">新增特殊管路...</option>
                <option value="port-A">port-A</option>
                <option value="鼻腸管">鼻腸管</option>
                <option value="膀胱造廔口接尿管">膀胱造廔口接尿管</option>
              </select>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // 綁定 checkbox
    tbody.querySelectorAll('.pipeCheck').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const tr = e.target.closest('tr');
        const residentId = tr.dataset.id;
        const type = e.target.dataset.type;
        const update = {};
        update[type] = e.target.checked;
        await dbPipelines.doc(residentId).set(update, { merge: true });
        updateStats();
      });
    });

    // 綁定新增特殊管路
    tbody.querySelectorAll('.specialSelect').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const tr = e.target.closest('tr');
        const residentId = tr.dataset.id;
        const val = e.target.value;
        if (!val) return;
        const docRef = dbPipelines.doc(residentId);
        const doc = await docRef.get();
        const data = doc.exists ? doc.data() : {};
        const current = data.special || [];
        if (!current.includes(val)) current.push(val);
        await docRef.set({ special: current }, { merge: true });
        loadResidents();
      });
    });

    // 綁定刪除特殊管路
    tbody.querySelectorAll('.btn-remove-special').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const residentId = e.target.closest('button').dataset.id;
        const index = parseInt(e.target.closest('button').dataset.index);
        const docRef = dbPipelines.doc(residentId);
        const doc = await docRef.get();
        if (!doc.exists) return;
        const data = doc.data();
        const current = data.special || [];
        current.splice(index, 1);
        await docRef.set({ special: current }, { merge: true });
        loadResidents();
      });
    });

    updateStats(total, stats);
  }

  function updateStats(total = null, stats = null) {
    if (!stats) {
      const rows = tbody.querySelectorAll('tr');
      total = rows.length;
      stats = { maker: 0, central: 0, tracheostomy: 0, ngtube: 0, urine: 0, special: 0 };
      rows.forEach(row => {
        row.querySelectorAll('.pipeCheck').forEach(chk => {
          if (chk.checked) stats[chk.dataset.type]++;
        });
        const specialCount = row.querySelectorAll('.btn-remove-special').length;
        if (specialCount > 0) stats.special += specialCount;
      });
    }
    countTotal.textContent = total;
    countMaker.textContent = `製氧機：${stats.maker}`;
    countCentral.textContent = `中央氧氣：${stats.central}`;
    countTracheostomy.textContent = `氣切：${stats.tracheostomy}`;
    countNGTube.textContent = `鼻胃管：${stats.ngtube}`;
    countUrine.textContent = `尿管：${stats.urine}`;
    countSpecial.textContent = `特殊管路：${stats.special}`;
  }

  loadResidents();

    document.querySelectorAll(".specialSelect, .btn-remove-special, button, select").forEach(el => {
      el.style.display = "";
    });
  });
}
