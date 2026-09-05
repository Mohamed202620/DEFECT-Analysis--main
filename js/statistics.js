// ============================================================
// statistics.js
// منطق صفحة "داشبورد الصيانة والتحليلات" (Maintenance Dashboard & Analytics)
// - يقرأ من نفس مجموعة "tickets" التي تُستخدم في لوحة المتابعة
//   (fetchTicketsApi) دون أي تغيير في بنية قاعدة البيانات
// - تبويبات زمنية (اليوم / الأسبوع / الشهر / الكل)
// - مؤشرات تشغيلية حية (KPIs): إجمالي، قيد العمل، تم حلها، نسبة الإنجاز،
//   البلاغات الحرجة، ونسبة الكفاءة
// - 3 رسوم بيانية (Chart.js):
//   1. اتجاه وتدفق البلاغات اليومي (Trend Area / Bar Chart)
//   2. أكثر الماكينات تكراراً للأعطال (Horizontal Bar Chart)
//   3. توزيع الأولويات ودرجة الخطورة (Doughnut Chart)
// - متوسط زمن الإصلاح MTTR وكثافة أعطال الخطوط وأداء الفنيين
// ============================================================

import { fetchTicketsApi } from './services/api.js';
import { translations } from './config.js';
import { CLOSED_STATUSES, parseTicketDate } from './ticketStatusConstants.js';

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

let trendChartInstance = null;
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

const INACTIVE_CLASS = 'bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600';

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

  return (tickets || []).filter(item => {
    const created = parseTicketDate(item);
    return created && created >= since;
  });
}

// ============================================================
// تهيئة لوحة الداشبورد عند فتحها (تُستدعى من renderCore.js)
// ============================================================

export async function initStatsView() {
  const summaryBox = el('statsSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `<div class="text-center text-gray-400 text-xs py-6 col-span-2 sm:col-span-4 flex items-center justify-center gap-2">
      <span class="animate-spin text-sm">⏳</span> ${t().loadingStats}
    </div>`;
  }

  const result = await fetchTicketsApi();
  allTickets = (result.status === 'success' && Array.isArray(result.data)) ? result.data : [];
  isLoaded = true;

  window.switchStatsPeriod(currentPeriod);
}

// ============================================================
// زر تحديث بيانات الداشبورد مباشرة
// ============================================================

window.refreshStatsDashboard = async function () {
  const btn = el('statsRefreshBtn');
  if (btn) btn.classList.add('animate-spin');

  const result = await fetchTicketsApi();
  allTickets = (result.status === 'success' && Array.isArray(result.data)) ? result.data : [];
  isLoaded = true;

  renderAll();

  if (btn) {
    setTimeout(() => {
      btn.classList.remove('animate-spin');
    }, 400);
  }
};

// ============================================================
// تبديل التبويب الزمني
// ============================================================

window.switchStatsPeriod = function (period) {
  currentPeriod = period;

  document.querySelectorAll('.stats-period-btn').forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.className =
      'stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 cursor-pointer ' +
      (isActive ? periodMeta(period).activeClass : INACTIVE_CLASS);
  });

  if (!isLoaded) return;
  renderAll();
};

// ============================================================
// حساب الملخص العام ومؤشرات الأداء للداشبورد
// ============================================================

function computeSummary(tickets) {
  let open = 0;
  let closed = 0;
  let highPriority = 0;

  tickets.forEach(ticket => {
    const status = String(ticket.status || '').trim().toLowerCase();
    const priority = String(ticket.priority || '').trim().toLowerCase();
    if (CLOSED_STATUSES.includes(status)) {
      closed++;
    } else {
      open++;
    }

    if (priority === 'high' || priority === 'critical') {
      highPriority++;
    }
  });

  const total = tickets.length;
  const resolutionRate = total ? Math.round((closed / total) * 100) : 0;

  return { total, open, closed, highPriority, resolutionRate };
}

// ============================================================
// حساب تكرار الأعطال حسب الماكينة (Top 5)
// ============================================================

export function computeTopMachines(tickets, limitCount = 5) {
  const freq = {};
  tickets.forEach(item => {
    const machine = String(item.machine || '').trim();
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
  tickets.forEach(item => {
    const p = String(item.priority || '').trim();
    if (p === 'High' || p === 'عالية' || p === 'Critical') freq.High++;
    else if (p === 'Low' || p === 'منخفضة') freq.Low++;
    else freq.Medium++;
  });
  return freq;
}

// ============================================================
// حساب تدفق البلاغات اليومية لرسم الاتجاه (Daily Trend)
// ============================================================

function computeDailyTrend(tickets, days = 7) {
  const map = {};
  const labels = [];
  const currentLang = window.currentLang || 'ar';

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const display = d.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ar-EG', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric'
    });
    map[key] = { label: display, count: 0, closed: 0 };
    labels.push(key);
  }

  tickets.forEach(ticket => {
    const created = parseTicketDate(ticket);
    if (!created) return;
    const key = created.toISOString().split('T')[0];
    if (map[key]) {
      map[key].count++;
      const status = String(ticket.status || '').trim().toLowerCase();
      if (CLOSED_STATUSES.includes(status)) {
        map[key].closed++;
      }
    }
  });

  return {
    labels: labels.map(k => map[k].label),
    counts: labels.map(k => map[k].count),
    closed: labels.map(k => map[k].closed)
  };
}

// ============================================================
// حساب توزيع الأعطال حسب خطوط الإنتاج
// ============================================================

function computeLineBreakdown(tickets) {
  const freq = {};
  tickets.forEach(item => {
    const line = String(item.line || '').trim();
    if (!line) return;
    freq[line] = (freq[line] || 0) + 1;
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]);
}

// ============================================================
// حساب متوسط زمن الإصلاح (MTTR)
// ============================================================

export function computeMTTR(tickets) {
  const resolvedTickets = (tickets || []).filter(item => {
    const status = String(item.status || '').trim().toLowerCase();
    const created = parseTicketDate(item);
    const updated = parseTicketDate(item.updatedAt || item);
    return CLOSED_STATUSES.includes(status) && created && updated;
  });

  if (!resolvedTickets.length) return { avgHours: null, sampleSize: 0 };

  const totalHours = resolvedTickets.reduce((sum, item) => {
    const created = parseTicketDate(item);
    const updated = parseTicketDate(item.updatedAt || item);
    if (!created || !updated || updated < created) return sum;
    return sum + (updated - created) / (1000 * 60 * 60);
  }, 0);

  return { avgHours: totalHours / resolvedTickets.length, sampleSize: resolvedTickets.length };
}

// ============================================================
// حساب أداء الفنيين
// ============================================================

export function computeTechnicianPerformance(tickets, limitCount = 5) {
  const counts = {};
  tickets.forEach(item => {
    const status = String(item.status || '').trim().toLowerCase();
    if (!CLOSED_STATUSES.includes(status)) return;
    const tech = String(item.assignedTo || '').trim();
    if (!tech) return;
    counts[tech] = (counts[tech] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitCount);
}

// ============================================================
// الرسم الشامل لكافة أجزاء الداشبورد
// ============================================================

function renderAll() {
  const periodTickets = filterByPeriod(allTickets, currentPeriod);

  renderSummary(periodTickets);
  renderEfficiencyBanner(periodTickets);
  renderTrendChart(periodTickets);
  renderMachineChart(periodTickets);
  renderPriorityChart(periodTickets);
  renderLineBreakdown(periodTickets);
  renderMttr(periodTickets);
  renderTechnicianPerformance(periodTickets);
}

// ============================================================
// عرض بطاقات مؤشرات الأداء الحيوية (KPI Cards)
// ============================================================

function renderSummary(tickets) {
  const box = el('statsSummaryBox');
  if (!box) return;

  const s = computeSummary(tickets);
  const tr = t();

  box.innerHTML = `
    <!-- إجمالي البلاغات -->
    <div class="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-gray-800 hover:border-indigo-500/50 p-3 rounded-2xl transition-all shadow-sm">
      <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>${tr.totalTickets}</span>
        <span class="text-xs">📋</span>
      </div>
      <div class="text-xl font-black text-white tracking-tight">${s.total}</div>
      <div class="text-[9px] text-indigo-400 font-semibold mt-0.5">100% النشاط</div>
    </div>

    <!-- قيد المعالجة -->
    <div class="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-gray-800 hover:border-amber-500/50 p-3 rounded-2xl transition-all shadow-sm">
      <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>${tr.openTickets}</span>
        <span class="text-xs">⚙️</span>
      </div>
      <div class="text-xl font-black text-amber-400 tracking-tight">${s.open}</div>
      <div class="text-[9px] text-amber-300/80 font-semibold mt-0.5">${tr.activeWorkload}</div>
    </div>

    <!-- تم إصلاحها -->
    <div class="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-gray-800 hover:border-emerald-500/50 p-3 rounded-2xl transition-all shadow-sm">
      <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>${tr.resolvedTickets}</span>
        <span class="text-xs">✅</span>
      </div>
      <div class="text-xl font-black text-emerald-400 tracking-tight">${s.closed}</div>
      <div class="text-[9px] text-emerald-300/80 font-semibold mt-0.5">إغلاق ناجح</div>
    </div>

    <!-- نسبة الإنجاز -->
    <div class="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-gray-800 hover:border-blue-500/50 p-3 rounded-2xl transition-all shadow-sm">
      <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>${tr.completionRate}</span>
        <span class="text-xs">🎯</span>
      </div>
      <div class="text-xl font-black text-blue-400 tracking-tight">${s.resolutionRate}%</div>
      <div class="text-[9px] ${s.resolutionRate >= 70 ? 'text-emerald-400' : 'text-yellow-400'} font-semibold mt-0.5">
        ${s.resolutionRate >= 70 ? 'أداء ممتاز' : 'يحتاج متابعة'}
      </div>
    </div>
  `;
}

// ============================================================
// تحديث شريط مؤشر كفاءة الإغلاق والجاهزية
// ============================================================

function renderEfficiencyBanner(tickets) {
  const s = computeSummary(tickets);
  const percentEl = el('statsEfficiencyPercent');
  const barEl = el('statsEfficiencyBar');
  const resolvedEl = el('statsEfficiencyResolved');
  const pendingEl = el('statsEfficiencyPending');

  if (percentEl) percentEl.textContent = `${s.resolutionRate}%`;
  if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, s.resolutionRate))}%`;
  if (resolvedEl) resolvedEl.textContent = `${s.closed} تم إغلاقه`;
  if (pendingEl) pendingEl.textContent = `${s.open} قيد الإجراء`;
}

// ============================================================
// رسم بياني: اتجاه البلاغات اليومي (Trend Chart)
// ============================================================

function renderTrendChart(tickets) {
  const canvas = el('statsTrendChart');
  const emptyBox = el('statsTrendEmpty');
  const badge = el('statsTrendBadge');
  if (!canvas) return;

  const trend = computeDailyTrend(tickets, currentPeriod === 'month' ? 14 : 7);
  const totalCount = trend.counts.reduce((a, b) => a + b, 0);

  if (badge) {
    badge.textContent = `${totalCount} بلاغ`;
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  if (!totalCount) {
    canvas.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  if (emptyBox) emptyBox.classList.add('hidden');

  trendChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [
        {
          label: 'وارد البلاغات',
          data: trend.counts,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3B82F6',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'تم إصلاحها',
          data: trend.closed,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10B981',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#9CA3AF', font: { size: 10 }, boxWidth: 12, padding: 8 }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9CA3AF', font: { size: 9 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#9CA3AF', precision: 0, font: { size: 9 } },
          grid: { color: 'rgba(51, 65, 85, 0.25)' }
        }
      }
    }
  });
}

// ============================================================
// رسم بياني: أكثر الماكينات عطلاً (Horizontal Bar Chart)
// ============================================================

function renderMachineChart(tickets) {
  const canvas = el('statsMachineChart');
  const emptyBox = el('statsMachineEmpty');
  if (!canvas) return;

  const top = computeTopMachines(tickets, 5);

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
        backgroundColor: 'rgba(239, 68, 68, 0.65)',
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9CA3AF', precision: 0, font: { size: 9 } }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
        y: { ticks: { color: '#E2E8F0', font: { size: 10, weight: 'bold' } }, grid: { display: false } }
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
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { size: 10 }, padding: 10 } }
      }
    }
  });
}

// ============================================================
// عرض توزيع الخطوط كأشرطة نسبية
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
          <span class="text-gray-200 font-bold">${line}</span>
          <span class="text-indigo-400 font-mono font-bold">${count} عطل</span>
        </div>
        <div class="w-full h-2.5 bg-[#0F172A] rounded-full overflow-hidden border border-gray-800">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// عرض متوسط زمن الإصلاح (MTTR)
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
      <div>
        <div class="text-2xl font-black text-cyan-400 tracking-tight">${displayValue}</div>
        <div class="text-[10px] text-gray-400 mt-0.5">${tr.mttrBasedOn.replace('{n}', sampleSize)}</div>
      </div>
      <div class="text-right">
        <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${avgHours <= 2 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}">
          ${avgHours <= 2 ? '⚡ استجابة سريعة' : '⚠️ استجابة متوسطة'}
        </span>
      </div>
    </div>
  `;
}

// ============================================================
// عرض أداء الفنيين
// ============================================================

function renderTechnicianPerformance(tickets) {
  const box = el('statsTechBox');
  if (!box) return;

  const top = computeTechnicianPerformance(tickets, 5);
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
          <span class="text-gray-200 font-bold">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${tech}</span>
          <span class="text-emerald-400 font-mono font-bold">${count} ${tr.ticketWord}</span>
        </div>
        <div class="w-full h-2.5 bg-[#0F172A] rounded-full overflow-hidden border border-gray-800">
          <div class="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}
