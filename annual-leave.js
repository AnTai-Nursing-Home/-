(function () {
  const DB = () => firebase.firestore();
  const HOURS_PER_DAY = window.HOURS_PER_DAY || 8;
  const COL_REQ = "annual_leave_requests";
  const ROLE_TXT = { 
    admin: "行政人員",
    nurse: "護理師", 
    localCaregiver: "台籍照服員", 
    foreignCaregiver: "外籍照服員"
  };
  const $ = (sel) => document.querySelector(sel);
  const msPerYear = 365.25 * 24 * 3600 * 1000;

  // 年資對應（依你現行制度，可再微調）
  const ENTITLE_STEPS = [
    { years: 0.5, days: 3 },
    { years: 1, days: 7 },
    { years: 2, days: 10 },
    { years: 3, days: 14 },
    { years: 4, days: 14 },
    { years: 5, days: 15 },
    { years: 6, days: 15 },
    { years: 7, days: 15 },
    { years: 8, days: 15 },
    { years: 9, days: 15 },
    { years: 10, days: 16 },
    { years: 11, days: 17 },
    { years: 12, days: 18 },
    { years: 13, days: 19 },
    { years: 14, days: 20 },
    { years: 15, days: 21 },
    { years: 16, days: 22 },
    { years: 17, days: 23 },
    { years: 18, days: 24 },
    { years: 19, days: 25 },
    { years: 20, days: 26 },
    { years: 21, days: 27 },
    { years: 22, days: 28 },
    { years: 23, days: 29 },
    { years: 24, days: 30 },
  ];

  // empId -> { name, role, hireDate }
  const EMP_MAP = Object.create(null);

  // ===== Common helpers =====
  function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v.toDate === "function") {
      try {
        const d = v.toDate();
        return isNaN(d) ? null : d;
      } catch (_) {}
    }
    const s = String(v);
    let d = new Date(s);
    if (!isNaN(d)) return d;
    d = new Date(s.replace(/\./g, "-").replace(/\//g, "-"));
    return isNaN(d) ? null : d;
  }

  function ymd(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function hoursToText(hours) {
    const h = Number(hours) || 0;
    const neg = h < 0;
    const abs = Math.abs(h);
    const d = Math.floor(abs / HOURS_PER_DAY);
    const rem = abs % HOURS_PER_DAY;
    const fullH = Math.floor(rem);
    const minutes = Math.round((rem - fullH) * 60);
    let txt = `${d} 天 ${fullH} 小時`;
    if (minutes > 0) txt += ` ${minutes} 分鐘`;
    return (neg ? "-" : "") + txt;
  }

  function decomposeHours(hours) {
    const h = Number(hours) || 0;
    const neg = h < 0;
    const abs = Math.abs(h);
    const d = Math.floor(abs / HOURS_PER_DAY);
    const rem = abs % HOURS_PER_DAY;
    const fullH = Math.floor(rem);
    const minutes = Math.round((rem - fullH) * 60);
    return { neg, days: d, hours: fullH, minutes, total: h };
  }

  function recordHours(rec) {
    const h = Number(rec?.hoursUsed);
    if (!isNaN(h) && isFinite(h)) return h;
    const days = Number(rec?.daysUsed ?? rec?.durationValue);
    if (!isNaN(days) && isFinite(days)) return days * HOURS_PER_DAY;
    return 0;
  }

  // 建立以入職日為基準的一年期區間（不重疊、不留空白）
  // 建立以入職日為基準的區間（含半年期 3 天假 + 每年期 7 天起）
  function buildPeriods(hireDate, untilDate) {
    const periods = [];
    if (!hireDate) return periods;
    const limit = untilDate || new Date();

    // 半年後起算的第一段區間（3天年假）
    const halfStart = new Date(hireDate);
    halfStart.setMonth(halfStart.getMonth() + 6);
    const halfEnd = new Date(hireDate);
    halfEnd.setFullYear(halfEnd.getFullYear(), hireDate.getMonth(), hireDate.getDate());
    halfEnd.setFullYear(halfEnd.getFullYear() + 1);
    halfEnd.setDate(halfEnd.getDate() - 1);
    if (halfStart <= limit) periods.push({ start: halfStart, end: halfEnd });

    // 一年期區間（7天以上）
    let curStart = new Date(hireDate);
    curStart.setFullYear(curStart.getFullYear() + 1);
    for (let i = 0; i < 40; i++) {
      const start = new Date(curStart);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      if (start > limit) break;
      periods.push({ start, end });
      curStart.setFullYear(curStart.getFullYear() + 1);
    }
    return periods;
  }

  function findPeriodForDate(hireDate, targetDate) {
    if (!hireDate || !targetDate) return null;
    const periods = buildPeriods(hireDate, targetDate);
    for (const p of periods) {
      if (targetDate >= p.start && targetDate <= p.end) return p;
    }
    return null;
  }

  function findCurrentPeriod(hireDate, refDate) {
    const d = refDate || new Date();
    return findPeriodForDate(hireDate, d);
  }

  function periodKey(p) {
    if (!p) return "";
    return `${ymd(p.start)}~${ymd(p.end)}`;
  }

  // 以「該區間結束日的年資」決定該區間應放年假
  function entitlementHoursForPeriod(hireDate, periodEnd) {
    if (!hireDate || !periodEnd) return 0;
    const diffYears = (periodEnd - hireDate) / msPerYear;
    if (diffYears <= 0) return 0;
    let days = 0;
    for (const s of ENTITLE_STEPS) {
      if (diffYears >= s.years) days = s.days;
      else break;
    }
    return days * HOURS_PER_DAY;
  }

  // ===== Employees =====
  async function loadEmployees() {
    const list = [];
    const collections = [
      { name: "adminStaff", role: "admin" },
      { name: "nurses", role: "nurse" },
      { name: "localCaregivers", role: "localCaregiver" },
      { name: "caregivers", role: "foreignCaregiver" },
    ];
  
    for (const c of collections) {
      try {
        const snap = await DB().collection(c.name).orderBy("sortOrder").get();
        snap.forEach(doc => {
          const d = doc.data() || {};
          const empId = d.id || d.empId || doc.id || "";
          const name = d.name || "";
          const hireDate = d.hireDate ? toDate(d.hireDate) : null;
          const role = c.role;
          list.push({ empId, name, hireDate, role });
          EMP_MAP[empId] = { name, hireDate, role };
        });
      } catch (e) {
        console.error(`load ${c.name} error`, e);
      }
    }
  
    const orderRole = { admin: 0, nurse: 1, localCaregiver: 2, foreignCaregiver: 3 };
    list.sort((a, b) => {
      const rr = (orderRole[a.role] ?? 9) - (orderRole[b.role] ?? 9);
      if (rr !== 0) return rr;
      return (a.empId || "").localeCompare(b.empId || "");
    });
    return list;
  }

  function fillEmpSelects(employees) {
    // Quick filter select (篩選快速補登列表)
    const selQuickFilter = $("#quickFilterSelect");
    if (selQuickFilter) {
      selQuickFilter.innerHTML = ['<option value="">全部</option>']
        .concat(
          employees.map(p =>
            `<option value="${p.empId}">${p.empId} ${p.name} (${ROLE_TXT[p.role] || p.role})</option>`
          )
        )
        .join("");
    }

    const selReq = $("#reqEmpSelect");
    const selStat = $("#statEmpSelect");
    const selQuick = $("#quickEmpSelect");
  
    const label = p => `${p.empId} ${p.name} (${ROLE_TXT[p.role] || p.role})`;
  
    if (selReq) {
      selReq.innerHTML = [
        `<option value="">全部</option>`,
        `<option value="@admin">行政人員</option>`,
        `<option value="@nurse">護理師</option>`,
        `<option value="@localCaregiver">台籍照服員</option>`,
        `<option value="@foreignCaregiver">外籍照服員</option>`,
        ...employees.map(p => `<option value="${p.empId}">${label(p)}</option>`),
      ].join("");
    }
    if (selStat) {
      selStat.innerHTML = [
        `<option value="">全部</option>`,
        `<option value="@admin">行政人員</option>`,
        `<option value="@nurse">護理師</option>`,
        `<option value="@localCaregiver">台籍照服員</option>`,
        `<option value="@foreignCaregiver">外籍照服員</option>`,
        ...employees.map(p => `<option value="${p.empId}">${label(p)}</option>`),
      ].join("");
    }
    if (selQuick) {
      selQuick.innerHTML = [
        `<option value="">請選擇</option>`,
        ...employees.map(p => `<option value="${p.empId}" data-name="${p.name}">${label(p)}</option>`),
      ].join("");
    }
  }

  // ===== Requests (唯讀＋可指定扣除區間) =====
  async function renderRequests(allEmployees) {
    const tbody = $("#al-req-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    const fromVal = $("#reqDateFrom")?.value;
    const toVal = $("#reqDateTo")?.value;
    const empSelVal = $("#reqEmpSelect")?.value || "";
    const from = fromVal ? new Date(fromVal + "T00:00:00") : null;
    const to = toVal ? new Date(toVal + "T23:59:59") : null;

    const snap = await DB().collection(COL_REQ).get().catch(e => {
      console.error("load requests error", e);
      return null;
    });
    if (!snap) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted-ghost">沒有資料</td></tr>`;
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.source === "快速補登") return;
      const leaveAt = toDate(d.leaveDate || d.date);
      if (!leaveAt) return;
      if (from && leaveAt < from) return;
      if (to && leaveAt > to) return;

      const empId = d.empId || "";
      const emp = EMP_MAP[empId];

      if (empSelVal) {
        if (empSelVal === "@admin" && emp?.role !== "admin") return;
        if (empSelVal === "@nurse" && emp?.role !== "nurse") return;
        if (empSelVal === "@localCaregiver" && emp?.role !== "localCaregiver") return;
        if (empSelVal === "@foreignCaregiver" && emp?.role !== "foreignCaregiver") return;
        if (!["@admin", "@nurse", "@localCaregiver", "@foreignCaregiver"].includes(empSelVal) && empId !== empSelVal) return;
      }

      const leaveType = d.leaveType || "特休";
      const hours = recordHours(d);

      let periodDisplay = "";
      let periodValue = "";
      if (leaveType === "特休" && emp?.hireDate) {
        const ps = d.periodStart ? toDate(d.periodStart) : null;
        const pe = d.periodEnd ? toDate(d.periodEnd) : null;
        if (ps && pe) {
          periodDisplay = `${ymd(ps)} ~ ${ymd(pe)}`;
          periodValue = `${ymd(ps)}~${ymd(pe)}`;
        } else {
          const cur = findCurrentPeriod(emp.hireDate, leaveAt);
          if (cur) {
            periodDisplay = `${ymd(cur.start)} ~ ${ymd(cur.end)}（預設）`;
            periodValue = periodKey(cur);
          }
        }
      }

      const who = d.applicant || d.name || (emp ? emp.name : "");
      const roleTxt = emp ? (ROLE_TXT[emp.role] || "") : "";
      const applicant = roleTxt ? `${who}(${roleTxt})` : who;

      rows.push({
        id: doc.id,
        applyDate: d.applyDate ? ymd(toDate(d.applyDate)) : (d.createdAt ? ymd(toDate(d.createdAt)) : ""),
        applicant,
        leaveType,
        leaveDate: ymd(leaveAt),
        shift: d.shift || "-",
        hoursText: hoursToText(hours),
        reason: d.reason || "",
        note: d.note || "",
        supervisor: d.supervisorSign || d.approvedBy || "",
        empId,
        emp,
        periodDisplay,
        periodValue,
      });
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted-ghost">沒有資料</td></tr>`;
      return;
    }

    rows.sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));

    tbody.innerHTML = rows.map(r => {
    // ===== 下拉選單篩選快速補登 =====
    const quickFilter = document.getElementById("quickFilterSelect");
    if (quickFilter) {
      quickFilter.addEventListener("change", () => {
        const val = quickFilter.value;
        const trs = tbody.querySelectorAll("tr");
        trs.forEach(tr => {
          const empText = tr.children[1]?.textContent || "";
          if (!val) {
            tr.style.display = "";
          } else if (empText.startsWith(val)) {
            tr.style.display = "";
          } else {
            tr.style.display = "none";
          }
        });
      });
    }

      const periodSelect = (r.leaveType === "特休" && r.emp?.hireDate)
        ? `<select class="form-select form-select-sm al-period-select" data-id="${r.id}" data-emp="${r.empId}">
             <option value="">自動（進行中區間）</option>
           </select>
           <div class="small text-muted mt-1 period-label">${r.periodDisplay || ""}</div>`
        : "";
      return `
        <tr>
          <td>${r.applyDate}</td>
          <td>${r.applicant}</td>
          <td>${r.leaveType}</td>
          <td>${r.leaveDate}</td>
          <td>${r.shift}</td>
          <td>${r.hoursText}</td>
          <td>${r.reason}</td>
          <td>${r.note}</td>
          <td>${r.supervisor}</td>
          <td>${r.id}</td>
          <td>${periodSelect}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".al-period-select").forEach(sel => {
      const docId = sel.getAttribute("data-id");
      const empId = sel.getAttribute("data-emp");
      const row = rows.find(r => r.id === docId);
      const emp = row?.emp;
      if (!emp || !emp.hireDate) return;

      const periods = buildPeriods(emp.hireDate, new Date());
      const options = [`<option value="">自動（進行中區間）</option>`];
      periods.forEach(p => {
        const key = periodKey(p);
        options.push(`<option value="${key}">${ymd(p.start)} ~ ${ymd(p.end)}</option>`);
      });
      sel.innerHTML = options.join("");

      if (row.periodValue) sel.value = row.periodValue;

      sel.addEventListener("change", async () => {
        const v = sel.value;
        const label = sel.closest("td").querySelector(".period-label");
        try {
          if (!v) {
            await DB().collection(COL_REQ).doc(docId).set({
              periodStart: firebase.firestore.FieldValue.delete(),
              periodEnd: firebase.firestore.FieldValue.delete(),
            }, { merge: true });
            if (label) label.textContent = "自動（進行中區間）";
          } else {
            const [ps, pe] = v.split("~");
            await DB().collection(COL_REQ).doc(docId).set({
              periodStart: ps,
              periodEnd: pe,
            }, { merge: true });
            if (label) label.textContent = `${ps} ~ ${pe}`;
          }
        } catch (e) {
          console.error("set period error", e);
          alert("更新區間失敗，請重新確認。");
        }
        renderSummary(allEmployees);
      });
    });
  }

  // ===== Quick add（支援指定區間） =====
  async function renderQuickList(allEmployees) {
    const tbody = $("#quick-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    const snap = await DB().collection(COL_REQ)
      .where("source", "==", "快速補登")
      .get()
      .catch(e => {
        console.error("quick list error", e);
        return null;
      });

    if (!snap || snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">沒有資料</td></tr>`;
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const leaveAt = toDate(d.leaveDate || d.date);
      const empId = d.empId || "";
      const emp = EMP_MAP[empId];
      const who = `${empId} ${(d.name || d.applicant || emp?.name || "")}`.trim();
      const hours = recordHours(d);

      let ps = d.periodStart ? ymd(toDate(d.periodStart)) : "";
      let pe = d.periodEnd ? ymd(toDate(d.periodEnd)) : "";
      let periodText = "";
      if (ps && pe) {
        periodText = `${ps} ~ ${pe}`;
      } else if (emp?.hireDate && leaveAt) {
        const p = findPeriodForDate(emp.hireDate, leaveAt);
        if (p) periodText = `${ymd(p.start)} ~ ${ymd(p.end)}（自動）`;
      }

      rows.push({
        id: doc.id,
        date: leaveAt ? ymd(leaveAt) : "",
        who,
        hoursText: hoursToText(hours),
        reason: d.reason || "",
        periodText,
      });
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.who}</td>
        <td>${r.hoursText}</td>
        <td>${r.reason}</td>
        <td>${r.periodText}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-id="${r.id}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("確定刪除此補登紀錄？")) return;
        try {
          await DB().collection(COL_REQ).doc(id).delete();
        } catch (e) {
          console.error("delete quick error", e);
        }
        renderQuickList(allEmployees);
        renderSummary(allEmployees);
      });
    });
  }

  // ===== Summary（當前區間＋可展開歷史區間） =====
  async function renderSummary(allEmployees) {
    const tbody = $("#al-stat-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted-ghost">讀取中…</td></tr>`;

    const empSelVal = $("#statEmpSelect")?.value || "";
    const today = new Date();

    let people = allEmployees.slice();
    if (empSelVal) {
      if (empSelVal === "@admin") {
        people = people.filter(p => p.role === "admin");
      } else if (empSelVal === "@nurse") {
        people = people.filter(p => p.role === "nurse");
      } else if (empSelVal === "@localCaregiver") {
        people = people.filter(p => p.role === "localCaregiver");
      } else if (empSelVal === "@foreignCaregiver") {
        people = people.filter(p => p.role === "foreignCaregiver");
      } else if (empSelVal) {
        people = people.filter(p => p.empId === empSelVal);
      }
    }

    const snap = await DB().collection(COL_REQ)
      .where("leaveType", "==", "特休")
      .get()
      .catch(e => {
        console.error("summary load error", e);
        return null;
      });

    const usage = {}; // usage[empId][periodKey] = hours

    if (snap) {
      snap.forEach(doc => {
        const d = doc.data() || {};
        const empId = d.empId || "";
        const emp = EMP_MAP[empId];
        if (!emp || !emp.hireDate) return;

        const leaveAt = toDate(d.leaveDate || d.date);
        if (!leaveAt) return;

        const hours = recordHours(d);
        if (!hours) return;

        let key = "";
        if (d.periodStart && d.periodEnd) {
          const ps = ymd(toDate(d.periodStart));
          const pe = ymd(toDate(d.periodEnd));
          if (ps && pe) key = `${ps}~${pe}`;
        }
        if (!key) {
          const p = findPeriodForDate(emp.hireDate, leaveAt);
          if (!p) return;
          key = periodKey(p);
        }

        if (!usage[empId]) usage[empId] = {};
        usage[empId][key] = (usage[empId][key] || 0) + hours;
      });
    }

    const rows = [];
    for (const emp of people) {
      if (!emp.hireDate) continue;
      const curP = findCurrentPeriod(emp.hireDate, today);
      if (!curP) continue;

      const key = periodKey(curP);
      const entH = entitlementHoursForPeriod(emp.hireDate, curP.end);
      const usedH = (usage[emp.empId] && usage[emp.empId][key]) || 0;
      const remainH = entH - usedH;

      const yrs = (today - emp.hireDate) / msPerYear;
      const yrsInt = Math.max(0, Math.floor(yrs));
      const months = Math.max(0, Math.floor((yrs - yrsInt) * 12));
      const seniorityText = `${yrsInt} 年 ${months} 月`;

      const entDays = entH / HOURS_PER_DAY;
      const used = decomposeHours(usedH);
      const remain = decomposeHours(remainH);

      const usedText = `${used.neg ? "-" : ""}${used.days} 天 ${used.hours} 小時${used.minutes ? ` ${used.minutes} 分鐘` : ""}（${usedH} 小時）`;
      const remainText = `${remain.neg ? "-" : ""}${remain.days} 天 ${remain.hours} 小時${remain.minutes ? ` ${remain.minutes} 分鐘` : ""}`;

      rows.push({
        empId: emp.empId,
        name: `${emp.name}${emp.role==="nurse"?"(護理師)":emp.role==="caregiver"?"(照服員)":""}`,
        hire: ymd(emp.hireDate),
        seniority: seniorityText,
        period: `${ymd(curP.start)} ~ ${ymd(curP.end)}`,
        entText: `${entDays} 天`,
        usedText,
        remainText,
        remainHours: remainH,
      });
    }

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted-ghost">沒有符合條件的資料</td></tr>`;
      return;
    }

    rows.sort((a, b) => a.empId.localeCompare(b.empId));

    tbody.innerHTML = rows.map(r => `
      <tr class="emp-row" data-emp="${r.empId}">
        <td>${r.empId}</td>
        <td>${r.name}</td>
        <td>${r.hire}</td>
        <td>${r.seniority}</td>
        <td>${r.period}</td>
        <td>${r.entText}</td>
        <td>${r.usedText}</td>
        <td class="${r.remainHours < 0 ? "neg" : ""}">${r.remainText}</td>
        <td class="${r.remainHours < 0 ? "neg" : ""}">${r.remainHours}</td>
      </tr>
    `).join("");

    const modalEl = document.getElementById("empDetailModal");
    const modalBody = modalEl ? modalEl.querySelector(".modal-body") : null;
    if (!modalEl || !modalBody || typeof bootstrap === "undefined") return;
    const bsModal = new bootstrap.Modal(modalEl);

    tbody.querySelectorAll(".emp-row").forEach(tr => {
      tr.addEventListener("click", () => {
        const empId = tr.getAttribute("data-emp");
        const emp = EMP_MAP[empId];
        if (!emp || !emp.hireDate) return;

        const periods = buildPeriods(emp.hireDate, today);
        const u = usage[empId] || {};

        const yrs = (today - emp.hireDate) / msPerYear;
        const yrsInt = Math.max(0, Math.floor(yrs));
        const months = Math.max(0, Math.floor((yrs - yrsInt) * 12));
        const senTxt = `${yrsInt} 年 ${months} 月`;

        let html = `
          <div class="mb-2">
            <strong>${empId} ${emp.name}${emp.role==="nurse"?"(護理師)":emp.role==="caregiver"?"(照服員)":""}</strong>
            <div class="small text-muted">入職日：${ymd(emp.hireDate)}｜目前總年資：約 ${senTxt}</div>
          </div>
          <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle">
            <thead class="table-light">
              <tr>
                <th>區間</th>
                <th>應放年假</th>
                <th>已用年假</th>
                <th>剩餘年假</th>
                <th>剩餘時數</th>
              </tr>
            </thead>
            <tbody>
        `;

        periods.forEach(p => {
          const key = periodKey(p);
          const entH = entitlementHoursForPeriod(emp.hireDate, p.end);
          const usedH = u[key] || 0;
          const remainH = entH - usedH;

          const entDays = entH / HOURS_PER_DAY;
          const used = decomposeHours(usedH);
          const remain = decomposeHours(remainH);

          const usedTxt = `${used.neg ? "-" : ""}${used.days} 天 ${used.hours} 小時${used.minutes ? ` ${used.minutes} 分鐘` : ""}（${usedH} 小時）`;
          const remainTxt = `${remain.neg ? "-" : ""}${remain.days} 天 ${remain.hours} 小時${remain.minutes ? ` ${remain.minutes} 分鐘` : ""}`;

          html += `
            <tr>
              <td>${ymd(p.start)} ~ ${ymd(p.end)}</td>
              <td>${entDays} 天</td>
              <td>${usedTxt}</td>
              <td class="${remainH < 0 ? "neg" : ""}">${remainTxt}</td>
              <td class="${remainH < 0 ? "neg" : ""}">${remainH}</td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
          </div>
        `;

        modalBody.innerHTML = html;

    // ===== 區間點擊展開該區間請假紀錄（支援 date 與 leaveDate 範圍查詢） =====
    setTimeout(() => {
      const tbodyInner = modalBody.querySelector("tbody");
      if (!tbodyInner) return;
      tbodyInner.querySelectorAll("tr").forEach(tr2 => {
        tr2.style.cursor = "pointer";
        tr2.addEventListener("click", async () => {
          const tdText = tr2.children[0]?.textContent || "";
          const [ps, pe] = tdText.split("~").map(s => s.trim());
          if (!ps || !pe) return;
          modalBody.querySelectorAll("tbody tr").forEach(x => x.classList.remove("table-primary"));
          tr2.classList.add("table-primary");
          const oldDetail = modalBody.querySelector("#intervalDetailTable");
          if (oldDetail) oldDetail.remove();

          const detailDiv = document.createElement("div");
          detailDiv.id = "intervalDetailTable";
          detailDiv.innerHTML = `<div class='text-muted small my-2'>載入中...</div>`;
          modalBody.appendChild(detailDiv);

          try {
            const snap = await DB().collection("annual_leave_requests")
              .where("empId", "==", empId)
              .get();

            if (snap.empty) {
              detailDiv.innerHTML = `<div class='text-muted small my-2'>此區間無請假紀錄。</div>`;
              return;
            }

            const psDate = new Date(ps + "T00:00:00");
            const peDate = new Date(pe + "T23:59:59");
            const rows = [];

            snap.forEach(doc => {
              const d = doc.data() || {};
              const dt = toDate(d.date || d.leaveDate);
              if (!dt) return;
              if (dt < psDate || dt > peDate) return;

              const hours = recordHours(d);
              const srcTxt = d.source === "快速補登" ? "快速補登" : "特休單（唯讀）";
              const reason = d.reason || "";
              const leaveDate = ymd(dt);
              rows.push(`<tr>
                <td>${leaveDate}</td>
                <td>${hoursToText(hours)}</td>
                <td>${reason}</td>
                <td>${srcTxt}</td>
              </tr>`);
            });

            if (rows.length === 0) {
              detailDiv.innerHTML = `<div class='text-muted small my-2'>此區間無請假紀錄。</div>`;
              return;
            }

            detailDiv.innerHTML = `
              <div class="table-responsive mt-3">
                <table class="table table-sm table-bordered align-middle">
                  <thead class="table-light">
                    <tr><th>請假日期</th><th>時數</th><th>原因</th><th>來源</th></tr>
                  </thead>
                  <tbody>${rows.join("")}</tbody>
                </table>
              </div>`;
          } catch (e) {
            console.error("load interval details error", e);
            detailDiv.innerHTML = `<div class='text-danger small my-2'>讀取失敗，請稍後再試。</div>`;
          }
        });
      });
    }, 100);

        bsModal.show();
      });
    });
  }

  // ===== Excel export =====
  function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
      alert("找不到表格");
      return;
    }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, filename);
  }

  // ===== Bind UI =====
  function bindUI(allEmployees) {
    $("#reqFilterBtn")?.addEventListener("click", () => renderRequests(allEmployees));
    $("#reqClearBtn")?.addEventListener("click", () => {
      if ($("#reqEmpSelect")) $("#reqEmpSelect").value = "";
      if ($("#reqDateFrom")) $("#reqDateFrom").value = "";
      if ($("#reqDateTo")) $("#reqDateTo").value = "";
      renderRequests(allEmployees);
    });

    $("#statFilterBtn")?.addEventListener("click", () => renderSummary(allEmployees));
    $("#statClearBtn")?.addEventListener("click", () => {
      if ($("#statEmpSelect")) $("#statEmpSelect").value = "";
      renderSummary(allEmployees);
    });

    $("#quickSubmit")?.addEventListener("click", async () => {
      const empSel = $("#quickEmpSelect");
      const dateEl = $("#quickDate");
      const amountEl = $("#quickAmount");
      const unitEl = $("#quickUnit");
      const reasonEl = $("#quickReason");
      const periodSel = $("#quickPeriodSelect");

      const empId = empSel?.value || "";
      const empName = empSel?.selectedOptions?.[0]?.getAttribute("data-name") || "";
      const dateStr = dateEl?.value || "";
      const amount = Number(amountEl?.value || "0");
      const unit = (unitEl?.value || "day").toLowerCase();
      const reason = reasonEl?.value || "";

      if (!empId || !dateStr || !(amount > 0)) {
        alert("請選擇員工、日期並輸入正確數值");
        return;
      }

      const hours = unit === "day" ? amount * HOURS_PER_DAY : amount;
      const emp = EMP_MAP[empId];
      if (!emp || !emp.hireDate) {
        alert("找不到該員工的入職日，無法歸屬區間");
        return;
      }

      const leaveAt = new Date(dateStr + "T00:00:00");

      let ps = "";
      let pe = "";
      if (periodSel && periodSel.value) {
        [ps, pe] = periodSel.value.split("~");
      } else {
        const p = findPeriodForDate(emp.hireDate, leaveAt) || findCurrentPeriod(emp.hireDate, leaveAt);
        if (p) {
          ps = ymd(p.start);
          pe = ymd(p.end);
        }
      }

      const payload = {
        createdAt: new Date().toISOString(),
        date: dateStr,
        empId,
        name: empName,
        hoursUsed: hours,
        leaveType: "特休",
        reason: reason || "快速補登",
        source: "快速補登",
        status: "審核通過",
      };
      if (ps && pe) {
        payload.periodStart = ps;
        payload.periodEnd = pe;
      }

      try {
        await DB().collection(COL_REQ).add(payload);
      } catch (e) {
        console.error("quickSubmit error", e);
        alert("送出失敗，請稍後再試");
        return;
      }

      amountEl.value = "";
      reasonEl.value = "";
      renderQuickList(allEmployees);
      renderSummary(allEmployees);
      alert("✅ 已送出補登，並歸屬到指定區間");
    });

    // 動態更新快速補登的區間選項
    $("#quickEmpSelect")?.addEventListener("change", updateQuickPeriodOptions);
    $("#quickDate")?.addEventListener("change", updateQuickPeriodOptions);

    function updateQuickPeriodOptions() {
      const empSel = $("#quickEmpSelect");
      const dateEl = $("#quickDate");
      const periodSel = $("#quickPeriodSelect");
      if (!periodSel) return;

      const empId = empSel?.value || "";
      const dateStr = dateEl?.value || "";

      periodSel.innerHTML = `<option value="">自動（依日期歸屬）</option>`;
      if (!empId) return;

      const emp = EMP_MAP[empId];
      if (!emp || !emp.hireDate) return;

      const ref = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
      const periods = buildPeriods(emp.hireDate, ref);
      periods.forEach(p => {
        const key = periodKey(p);
        periodSel.innerHTML += `<option value="${key}">${ymd(p.start)} ~ ${ymd(p.end)}</option>`;
      });

      if (dateStr) {
        const leaveAt = new Date(dateStr + "T00:00:00");
        const p = findPeriodForDate(emp.hireDate, leaveAt);
        if (p) periodSel.value = periodKey(p);
      }
    }

    $("#export-req-excel")?.addEventListener("click", () =>
      exportTableToExcel("reqTable", "特休單_區間制.xlsx")
    );
    $("#export-stat-excel")?.addEventListener("click", () =>
      exportTableToExcel("statTable", "年假統計_區間制.xlsx")
    );
  }

  // ===== Init =====
  async function init() {
    const employees = await loadEmployees();
    fillEmpSelects(employees);
    bindUI(employees);
    await Promise.all([
      renderRequests(employees),
      renderQuickList(employees),
      renderSummary(employees),
    ]);
  }

  let inited = false;
  document.addEventListener("firebase-ready", () => {
    if (inited) return;
    inited = true;
    init().catch(e => {
      console.error("[annual-leave interval] init error", e);
      inited = false;
    });
  });
})();
