// ============================================================
// statistics.js
// منطق صفحة "الإحصائيات" (Stats)
// - يقرأ من نفس مجموعة "tickets" التي تُستخدم في لوحة المتابعة
//   (fetchTicketsApi) دون أي تغيير في بنية قاعدة البيانات
// - تبويبات زمنية (اليوم / الأسبوع / الشهر / الكل) بنفس أسلوب
//   قاعدة المعرفة (knowledgeBase.js) لضمان اتساق تجربة الاستخدام
// - رسمان بيانيان (Chart.js): أكثر الماكينات عطلاً + توزيع الأولويات
// ============================================================

import { fetchTicketsForDashboardApi } from './services/api.js';

// ============================================================
// حالة الموديول
// ============================================================

let allTickets = [];
let currentPeriod = 'week';   // day | week | month | all
let isLoaded = false;

let machineChartInstance = null;
let priorityChartInstance = null;

const PERIOD_META = {
  day: {
    label: 'اليوم',
    icon: '🔴',
    activeClass: 'bg-red-500/15 border-red-500/50 text-red-300'
  },
  week: {
    label: 'هذا الأسبوع',
    icon: '🟠',
    activeClass: 'bg-amber-500/15 border-amber-500/50 text-amber-300'
  },
  month: {
    label: 'هذا الشهر',
    icon: '🟡',
    activeClass: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-200'
  },
  all: {
    label: 'كل الفترات',
    icon: '📚',
    activeClass: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
  }
};

const INACTIVE_CLASS = 'bg-[#0F172A] border-gray-700 text-gray-400';

const CLOSED_STATUSES = ['closed', 'resolved', 'done', 'مغلق', 'تم الإصلاح'];

function el(id) {
  return document.getElementById(id);
}

// ============================================================
// فلترة التذاكر حسب الفترة الزمنية المختارة
// ============================================================

function filterByPeriod(tickets, period) {
  if (period === 'all') return tickets;

  const since = new Date();
  if (period === 'day') since.setDate(since.getDate() - 1);
  else if (period === 'week') since.setDate(since.getDate() - 7);
  else if (period === 'month') since.setMonth(since.getMonth() - 1);

  return tickets.filter(t => {
    if (!t.createdAt) return false;
    const created = new Date(t.createdAt);
    return !isNaN(created) && created >= since;
  });
}

// ============================================================
// تهيئة الصفحة عند فتحها لأول مرة (تُستدعى من renderCore.js)
// ============================================================

export async function initStatsView() {

  const summaryBox = el('statsSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4 col-span-2">جاري تحميل الإحصائيات...</div>`;
  }

  const result = await fetchTicketsForDashboardApi();

  allTickets = (result.status === 'success' && Array.isArray(result.data)) ? result.data : [];

  isLoaded = true;

  window.switchStatsPeriod(currentPeriod);
}

// ============================================================
// تبديل التبويب الزمني
// ============================================================

window.switchStatsPeriod = function (period) {

  currentPeriod = period;

  document.querySelectorAll('.stats-period-btn').forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.className =
      'stats-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ' +
      (isActive ? PERIOD_META[period].activeClass : INACTIVE_CLASS);
  });

  if (!isLoaded) return; // لم تُحمَّل البيانات بعد (initStatsView سيستدعي هذه الدالة بعد التحميل)

  renderAll();
};

// ============================================================
// حساب الملخص العام للفترة الحالية
// ============================================================

function computeSummary(tickets) {
  let open = 0;
  let closed = 0;

  tickets.forEach(t => {
    const status = String(t.status || '').trim().toLowerCase();
    if (CLOSED_STATUSES.includes(status)) closed++;
    else open++;
  });

  const total = tickets.length;
  const resolutionRate = total ? Math.round((closed / total) * 100) : 0;

  return { total, open, closed, resolutionRate };
}

// ============================================================
// حساب تكرار الأعطال حسب الماكينة (Top 5)
// ============================================================

function computeTopMachines(tickets, limitCount = 5) {
  const freq = {};

  tickets.forEach(t => {
    const machine = String(t.machine || '').trim();
    if (!machine) return;
    freq[machine] = (freq[machine] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitCount);
}

// ============================================================
// حساب توزيع الأولويات
// ============================================================

function computePriorityBreakdown(tickets) {
  const freq = { High: 0, Medium: 0, Low: 0 };

  tickets.forEach(t => {
    const p = String(t.priority || '').trim();
    if (freq[p] !== undefined) freq[p]++;
  });

  return freq;
}

// ============================================================
// حساب توزيع الأعطال حسب الخط (لعرضه كأشرطة نسبية بدون Chart.js)
// ============================================================

function computeLineBreakdown(tickets) {
  const freq = {};

  tickets.forEach(t => {
    const line = String(t.line || '').trim();
    if (!line) return;
    freq[line] = (freq[line] || 0) + 1;
  });

  return Object.entries(freq).sort((a, b) => b[1] - a[1]);
}

// ============================================================
// الرسم الشامل: يُستدعى عند تحميل الصفحة أو تبديل الفترة
// ============================================================

function renderAll() {
  const periodTickets = filterByPeriod(allTickets, currentPeriod);

  renderSummary(periodTickets);
  renderMachineChart(periodTickets);
  renderPriorityChart(periodTickets);
  renderLineBreakdown(periodTickets);
}

// ============================================================
// عرض بطاقات الملخص
// ============================================================

function renderSummary(tickets) {
  const box = el('statsSummaryBox');
  if (!box) return;

  const s = computeSummary(tickets);

  box.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">إجمالي البلاغات</div>
      <div class="text-lg font-bold text-purple-400">${s.total}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">مفتوحة</div>
      <div class="text-lg font-bold text-amber-400">${s.open}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">تم إصلاحها</div>
      <div class="text-lg font-bold text-emerald-400">${s.closed}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">معدل الإنجاز</div>
      <div class="text-lg font-bold text-blue-400">${s.resolutionRate}%</div>
    </div>
  `;
}

// ============================================================
// رسم بياني: أكثر الماكينات عطلاً (Bar Chart أفقي)
// ============================================================

function renderMachineChart(tickets) {
  const canvas = el('statsMachineChart');
  const emptyBox = el('statsMachineEmpty');
  if (!canvas) return;

  const top = computeTopMachines(tickets);

  if (machineChartInstance) {
    machineChartInstance.destroy();
    machineChartInstance = null;
  }

  if (!top.length) {
    canvas.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  if (emptyBox) emptyBox.classList.add('hidden');

  machineChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(([machine]) => machine),
      datasets: [{
        label: 'عدد الأعطال',
        data: top.map(([, count]) => count),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3B82F6',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9CA3AF', precision: 0 }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
        y: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ============================================================
// رسم بياني: توزيع الأولويات (Doughnut Chart)
// ============================================================

function renderPriorityChart(tickets) {
  const canvas = el('statsPriorityChart');
  const emptyBox = el('statsPriorityEmpty');
  if (!canvas) return;

  const breakdown = computePriorityBreakdown(tickets);
  const total = breakdown.High + breakdown.Medium + breakdown.Low;

  if (priorityChartInstance) {
    priorityChartInstance.destroy();
    priorityChartInstance = null;
  }

  if (!total) {
    canvas.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  if (emptyBox) emptyBox.classList.add('hidden');

  priorityChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['عالية', 'متوسطة', 'منخفضة'],
      datasets: [{
        data: [breakdown.High, breakdown.Medium, breakdown.Low],
        backgroundColor: ['#EF4444', '#F59E0B', '#10B981'],
        borderColor: '#1E293B',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { size: 10 }, padding: 12 } }
      }
    }
  });
}

// ============================================================
// عرض توزيع الخطوط كأشرطة نسبية (بدون الحاجة لرسم بياني إضافي)
// ============================================================

function renderLineBreakdown(tickets) {
  const box = el('statsLineBreakdown');
  if (!box) return;

  const lines = computeLineBreakdown(tickets);

  if (!lines.length) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">لا توجد بيانات كافية خلال هذه الفترة.</div>`;
    return;
  }

  const max = lines[0][1];

  box.innerHTML = lines.map(([line, count]) => {
    const pct = Math.round((count / max) * 100);
    return `
      <div>
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-gray-300 font-bold">${line}</span>
          <span class="text-gray-400">${count}</span>
        </div>
        <div class="w-full h-2 bg-[#0F172A] rounded-full overflow-hidden border border-gray-800">
          <div class="h-full bg-indigo-500 rounded-full" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}
