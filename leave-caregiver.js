
document.addEventListener('firebase-ready', () => {

const SESSION_KEYS = [
  'antai_session_user',
  'caregiverAuth',
  'officeAuth',
  'nutritionistAuth',
  'nurseAuth'
];

function loadSessionUser() {
  try {
    for (const key of SESSION_KEYS) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    }
    return null;
  } catch (e) { return null; }
}

const calendarDiv = document.getElementById('leave-calendar');
if (!calendarDiv) return;

const employeeNameSelect = document.getElementById('employee-name-select');
const employeeIdDisplay = document.getElementById('employee-id-display');

let employeesData = {};

function autoFillFromSession() {
  const sess = loadSessionUser();
  if (!sess) return false;

  const name = (sess.displayName || sess.name || '').trim();
  const id = (sess.staffId || sess.employeeId || '').trim();

  if (!name) return false;

  if (employeeIdDisplay && id) employeeIdDisplay.value = id;

  if (employeeNameSelect) {
    const opt = [...employeeNameSelect.options].find(o => o.value === name);
    if (opt) {
      employeeNameSelect.value = name;
      employeeNameSelect.disabled = true;
      employeeNameSelect.classList.add('bg-light');
      return true;
    }
  }
  return false;
}

async function loadEmployeesDropdown() {
  const db = firebase.firestore();
  employeeNameSelect.innerHTML = `<option>讀取中...</option>`;

  try {
    const [snap1, snap2] = await Promise.all([
      db.collection('caregivers').orderBy('sortOrder').get(),
      db.collection('localCaregivers').orderBy('sortOrder').get()
    ]);

    let html = `<option disabled selected>請選擇姓名</option>`;
    const added = new Set();

    function append(snap) {
      snap.forEach(doc => {
        const emp = doc.data();
        if (!emp || !emp.name) return;
        if (added.has(emp.name)) return;

        added.add(emp.name);
        employeesData[emp.name] = emp;
        html += `<option value="${emp.name}">${emp.name}</option>`;
      });
    }

    append(snap1);
    append(snap2);

    employeeNameSelect.innerHTML = html;

    // 自動帶入登入者
    autoFillFromSession();

    const current = employeeNameSelect.value;
    if (current && employeeIdDisplay) {
      employeeIdDisplay.value = employeesData[current]?.id || '';
    }

  } catch (err) {
    console.error(err);
    employeeNameSelect.innerHTML = `<option>讀取失敗</option>`;
  }
}

loadEmployeesDropdown();

});
