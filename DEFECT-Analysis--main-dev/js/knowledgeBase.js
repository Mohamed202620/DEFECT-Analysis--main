// ============================================================
// knowledgeBase.js
// منطق صفحة "قاعدة المعرفة" (Knowledge Base)
// - تصفح كل الأعطال المسجلة في machineErrors
// - تبويبات يومي / أسبوعي / شهري / الكل، تُغيّر شكل ومحتوى الصفحة
//   حسب الفترة (تكرار الأعطال في نفس الفترة من machineErrorLogs)
// - بحث فوري بالكود/الماكينة/النص
// ============================================================

import {
  fetchAllMachineErrorsApi,
  fetchMachineErrorLogsSinceApi
} from './services/api.js';

// ============================================================
// حالة الموديول
// ============================================================

let allErrors = [];          // كل عناصر قاعدة المعرفة (machineErrors)
let periodLogs = [];         // سجلات الظهور ضمن الفترة الحالية (machineErrorLogs)
let currentPeriod = 'day';   // day | week | month | all
let isLoaded = false;

// إعدادات مظهر كل فترة (لتحقيق "شكله يتغير" فعلياً حسب التبويب)
const PERIOD_META = {
  day: {
    label: 'اليوم',
    icon: '🔴',
    activeClass: 'bg-red-500/15 border-red-500/50 text-red-300',
    summaryClass: 'border-red-500/30 text-red-300'
  },
  week: {
    label: 'هذا الأسبوع',
    icon: '🟠',
    activeClass: 'bg-amber-500/15 border-amber-500/50 text-amber-300',
    summaryClass: 'border-amber-500/30 text-amber-300'
  },
  month: {
    label: 'هذا الشهر',
    icon: '🟡',
    activeClass: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-200',
    summaryClass: 'border-yellow-500/30 text-yellow-200'
  },
  all: {
    label: 'كل قاعدة المعرفة',
    icon: '📚',
    activeClass: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300',
    summaryClass: 'border-cyan-500/30 text-cyan-300'
  }
};

const INACTIVE_CLASS = 'bg-[#0F172A] border-gray-700 text-gray-400';

function el(id) {
  return document.getElementById(id);
}

// ============================================================
// حساب بداية الفترة (Since) بصيغة ISO مطابقة لتنسيق createdAt/scannedAt
// ============================================================

function computeSinceIso(period) {
  const now = new Date();

  if (period === 'day') {
    now.setDate(now.getDate() - 1);
  } else if (period === 'week') {
    now.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    now.setMonth(now.getMonth() - 1);
  }

  return now.toISOString();
}

// ============================================================
// تهيئة الصفحة عند فتحها لأول مرة (تُستدعى من renderCore.js)
// ============================================================

export async function initKbView() {

  const summaryBox = el('kbSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">جاري تحميل قاعدة المعرفة...</div>`;
  }

  const result = await fetchAllMachineErrorsApi();

  allErrors = (result.status === 'success' && Array.isArray(result.data)) ? result.data : [];

  isLoaded = true;

  await window.switchKbPeriod(currentPeriod);
}

// ============================================================
// تبديل التبويب الزمني
// ============================================================

window.switchKbPeriod = async function (period) {

  currentPeriod = period;

  // تحديث شكل الأزرار (التبويب النشط يأخذ لون الفترة)
  document.querySelectorAll('.kb-period-btn').forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.className =
      'kb-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ' +
      (isActive ? PERIOD_META[period].activeClass : INACTIVE_CLASS);
  });

  if (!isLoaded) return; // لم تُحمَّل البيانات بعد (initKbView سيستدعي هذه الدالة بعد التحميل)

  if (period === 'all') {
    periodLogs = [];
    renderKbSummary();
    renderKbList();
    return;
  }

  const summaryBox = el('kbSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-3">جاري الحساب...</div>`;
  }

  const sinceIso = computeSinceIso(period);
  const result = await fetchMachineErrorLogsSinceApi(sinceIso);

  periodLogs = (result.status === 'success' && Array.isArray(result.data)) ? result.data : [];

  renderKbSummary();
  renderKbList();
};

// ============================================================
// حساب تكرار كل كود عطل خلال الفترة الحالية
// ============================================================

function computeFrequencyMap() {
  const freq = {};

  periodLogs.forEach(log => {
    const code = log.errorCode;
    if (!code) return;
    freq[code] = (freq[code] || 0) + 1;
  });

  return freq;
}

// ============================================================
// عرض ملخص الفترة (يتغيّر شكله ولونه حسب التبويب المختار)
// ============================================================

function renderKbSummary() {
  const box = el('kbSummaryBox');
  if (!box) return;

  const meta = PERIOD_META[currentPeriod];

  if (currentPeriod === 'all') {
    box.innerHTML = `
      <div class="bg-[#0F172A] border ${meta.summaryClass} rounded-xl p-3 flex items-center justify-between">
        <div class="text-xs font-bold">${meta.icon} ${meta.label}</div>
        <div class="text-lg font-bold">${allErrors.length} <span class="text-[10px] font-normal">عطل مسجل</span></div>
      </div>
    `;
    return;
  }

  const freq = computeFrequencyMap();
  const distinctCodes = Object.keys(freq).length;
  const totalOccurrences = periodLogs.length;

  box.innerHTML = `
    <div class="bg-[#0F172A] border ${meta.summaryClass} rounded-xl p-3 grid grid-cols-2 gap-2">
      <div>
        <div class="text-[10px] opacity-80">${meta.icon} إجمالي الظهور (${meta.label})</div>
        <div class="text-lg font-bold">${totalOccurrences}</div>
      </div>
      <div>
        <div class="text-[10px] opacity-80">أكواد أعطال مختلفة</div>
        <div class="text-lg font-bold">${distinctCodes}</div>
      </div>
    </div>
  `;
}

// ============================================================
// عرض قائمة الأعطال (تُصفّى حسب الفترة + البحث)
// ============================================================

function renderKbList() {
  const box = el('kbListBox');
  if (!box) return;

  const searchTerm = (el('kbSearchInput')?.value || '').trim().toLowerCase();

  let list;
  let freq = {};

  if (currentPeriod === 'all') {
    list = [...allErrors];
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else {
    freq = computeFrequencyMap();
    list = allErrors.filter(e => freq[e.errorCode] > 0);
    list.sort((a, b) => (freq[b.errorCode] || 0) - (freq[a.errorCode] || 0));
  }

  if (searchTerm) {
    list = list.filter(e =>
      String(e.errorCode || '').toLowerCase().includes(searchTerm) ||
      String(e.machine || '').toLowerCase().includes(searchTerm) ||
      String(e.line || '').toLowerCase().includes(searchTerm) ||
      String(e.cause || '').toLowerCase().includes(searchTerm) ||
      String(e.errorMessage || '').toLowerCase().includes(searchTerm)
    );
  }

  if (!list.length) {
    box.innerHTML = `
      <div class="text-center text-gray-500 text-[11px] py-8">
        ${currentPeriod === 'all'
          ? 'لا توجد أعطال في قاعدة المعرفة بعد.'
          : 'لا توجد أعطال مسجلة خلال هذه الفترة.'}
      </div>
    `;
    return;
  }

  box.innerHTML = list.map(e => {
    const isPending = e.status === 'pending_review';
    const count = freq[e.errorCode];

    return `
      <details class="bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs">
        <summary class="cursor-pointer flex items-center justify-between font-bold text-gray-100">
          <span class="flex items-center gap-2">
            <span class="text-blue-400">${e.errorCode || '-'}</span>
            ${isPending ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">قيد المراجعة</span>` : ''}
          </span>
          ${count ? `<span class="text-[10px] text-gray-400">تكرر ${count} مرة</span>` : ''}
        </summary>

        <div class="mt-2 pt-2 border-t border-gray-800 space-y-1.5 text-gray-300">
          ${e.machine || e.line ? `<div class="text-[11px]"><span class="text-gray-500">الماكينة/الخط:</span> ${e.machine || '-'} ${e.line ? '· ' + e.line : ''}</div>` : ''}
          <div class="text-[11px]"><span class="text-gray-500">السبب المحتمل:</span> ${e.cause || 'غير محدد'}</div>
          <div class="text-[11px]"><span class="text-gray-500">الحل:</span> ${e.solution || 'غير محدد'}</div>
          <div class="text-[11px] whitespace-pre-line"><span class="text-gray-500">خطوات الإصلاح:</span> ${e.steps || 'غير محدد'}</div>
        </div>
      </details>
    `;
  }).join('');
}

// ============================================================
// البحث الفوري (يُطبَّق فوق نفس بيانات الفترة الحالية)
// ============================================================

window.filterKbView = function () {
  renderKbList();
};
