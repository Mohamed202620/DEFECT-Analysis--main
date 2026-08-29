// ============================================================
// statistics.js
// منطق صفحة "الإحصائيات" (Stats)
// - يقرأ من نفس مجموعة "tickets" التي تُستخدم في لوحة المتابعة
//   (fetchTicketsApi) دون أي تغيير في بنية قاعدة البيانات
// - تبويبات زمنية (اليوم / الأسبوع / الشهر / الكل) بنفس أسلوب
//   قاعدة المعرفة (knowledgeBase.js) لضمان اتساق تجربة الاستخدام
// - رسمان بيانيان (Chart.js): أكثر الماكينات عطلاً + توزيع الأولويات
// ============================================================

import { fetchTicketsApi } from './services/api.js';
import { translations } from './config.js';
// إصلاح (تنظيف/Refactor): CLOSED_STATUSES بقت مستوردة من ملف ثوابت
// مشترك (ticketStatusConstants.js) بدل تعريفها محلياً هنا مكررة حرفياً
// مع نفس التعريف في workflow.js
import { CLOSED_STATUSES } from './ticketStatusConstants.js';

// إصلاح (ترجمة شاملة): كل نصوص هذه الصفحة (بطاقات الملخص، تسميات
// الرسوم البيانية، رسائل عدم وجود بيانات) كانت ثابتة بالعربي -
// دلوقتي بتتقرأ من translations.stats حسب window.currentLang في
// كل مرة بيتعاد فيها الرسم (تبديل تبويب/تحميل أولي)
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).stats;
}

// ============================================================
// حالة الموديول
// ============================================================

let allTickets = [];
let currentPeriod = 'week';   // day | week | month | all
let isLoaded = false;

let machineChartInstance = null;
let priorityChartInstance = null;

function periodMeta(period) {
  const tr = t();
  const META = {
    day: {
      label: tr.periodDay,
      icon: '🔴',
      activeClass: 'bg-red-500/15 border-red-500/50 text-red-300'
    },
    week: {
      label: tr.periodWeek,
      icon: '🟠',
      activeClass: 'bg-amber-500/15 border-amber-500/50 text-amber-300'
    },
    month: {
      label: tr.periodMonth,
      icon: '🟡',
      activeClass: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-200'
    },
    all: {
      label: tr.periodAll,
      icon: '📚',
      activeClass: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
    }
  };
  return META[period];
}

const INACTIVE_CLASS = 'bg-[#0F172A] border-gray-700 text-gray-400';


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
    summaryBox.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4 col-span-2">${t().loadingStats}</div>`;
  }

  const result = await fetchTicketsApi();

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
      (isActive ? periodMeta(period).activeClass : INACTIVE_CLASS);
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

// إضافة: export بدون تغيير أي منطق - عشان homeView.js/workflow.js
// يقدروا يستخدموا نفس الحساب في كارت "أكثر ماكينة عطلاً" على
// الرئيسية بدل ما نكرر نفس الكود في مكان تاني
export function computeTopMachines(tickets, limitCount = 5) {
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
// حساب متوسط زمن الإصلاح (MTTR) - إضافة جديدة
// تقريبي: نعتمد على updatedAt (آخر مرة اتحدّثت فيها التذكرة) كبديل
// عملي لتاريخ الإصلاح الفعلي، لأن الحقل ده موجود بالفعل على كل
// تذكرة (stampUpdate في ticketsApi.js بيحدّثه مع كل تغيير حالة) -
// من غير ما نضيف أي حقل جديد أو نلمس بنية البيانات
// ============================================================

// إضافة: export بدون تغيير أي منطق - عشان كارت MTTR الجديد في
// الرئيسية (homeView.js عبر workflow.js) يستخدم نفس الحساب بالظبط
export function computeMTTR(tickets) {
  const resolvedTickets = tickets.filter(t => {
    const status = String(t.status || '').trim().toLowerCase();
    return CLOSED_STATUSES.includes(status) && t.createdAt && t.updatedAt;
  });

  if (!resolvedTickets.length) return { avgHours: null, sampleSize: 0 };

  const totalHours = resolvedTickets.reduce((sum, t) => {
    const created = new Date(t.createdAt);
    const updated = new Date(t.updatedAt);
    if (isNaN(created) || isNaN(updated) || updated < created) return sum;
    return sum + (updated - created) / (1000 * 60 * 60);
  }, 0);

  return { avgHours: totalHours / resolvedTickets.length, sampleSize: resolvedTickets.length };
}

// ============================================================
// حساب أداء الفنيين - عدد البلاغات المُنجزة لكل فني (Top 5) -
// إضافة جديدة، بتعتمد على حقل assignedTo الموجود بالفعل
// ============================================================

// إضافة: export بدون تغيير أي منطق - عشان كارت "أفضل فني" الجديد
// في الرئيسية يستخدم نفس الحساب بالظبط
export function computeTechnicianPerformance(tickets, limitCount = 5) {
  const counts = {};

  tickets.forEach(t => {
    const status = String(t.status || '').trim().toLowerCase();
    if (!CLOSED_STATUSES.includes(status)) return;
    const tech = String(t.assignedTo || '').trim();
    if (!tech) return;
    counts[tech] = (counts[tech] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitCount);
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
  renderMttr(periodTickets);
  renderTechnicianPerformance(periodTickets);
}

// ============================================================
// عرض بطاقات الملخص
// ============================================================

function renderSummary(tickets) {
  const box = el('statsSummaryBox');
  if (!box) return;

  const s = computeSummary(tickets);
  const tr = t();

  box.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">${tr.totalTickets}</div>
      <div class="text-lg font-bold text-purple-400">${s.total}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">${tr.openTickets}</div>
      <div class="text-lg font-bold text-amber-400">${s.open}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">${tr.resolvedTickets}</div>
      <div class="text-lg font-bold text-emerald-400">${s.closed}</div>
    </div>
    <div class="bg-[#1E293B] border border-gray-800 p-3 rounded-xl text-center">
      <div class="text-[10px] text-gray-400 mb-1">${tr.completionRate}</div>
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
        label: t().errorsCountLabel,
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

  const tr = t();

  priorityChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [tr.priorityHighLabel, tr.priorityMediumLabel, tr.priorityLowLabel],
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
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${t().noLineData}</div>`;
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

// ============================================================
// عرض متوسط زمن الإصلاح (MTTR) - إضافة جديدة
// ============================================================

function renderMttr(tickets) {
  const box = el('statsMttrBox');
  if (!box) return;

  const { avgHours, sampleSize } = computeMTTR(tickets);
  const tr = t();

  if (!sampleSize) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${tr.mttrNoData}</div>`;
    return;
  }

  const displayValue = avgHours < 1
    ? `${Math.round(avgHours * 60)} ${tr.mttrMinute}`
    : avgHours < 24
      ? `${avgHours.toFixed(1)} ${tr.mttrHour}`
      : `${(avgHours / 24).toFixed(1)} ${tr.mttrDay}`;

  box.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-2xl font-bold text-cyan-400">${displayValue}</div>
      <div class="text-[10px] text-gray-500 text-left">
        ${tr.mttr}<br>
        ${tr.mttrBasedOn.replace('{n}', sampleSize)}
      </div>
    </div>
  `;
}

// ============================================================
// عرض أداء الفنيين (Top 5 حسب عدد البلاغات المُنجزة) - إضافة جديدة
// ============================================================

function renderTechnicianPerformance(tickets) {
  const box = el('statsTechBox');
  if (!box) return;

  const top = computeTechnicianPerformance(tickets);
  const tr = t();

  if (!top.length) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${tr.noTechData}</div>`;
    return;
  }

  const max = top[0][1];

  box.innerHTML = top.map(([tech, count], i) => {
    const pct = Math.round((count / max) * 100);
    return `
      <div>
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-gray-300 font-bold">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${tech}</span>
          <span class="text-gray-400">${count} ${tr.ticketWord}</span>
        </div>
        <div class="w-full h-2 bg-[#0F172A] rounded-full overflow-hidden border border-gray-800">
          <div class="h-full bg-emerald-500 rounded-full" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}
