import { exportToExcel } from '../services/exportUtility.js';
import { getCurrentRole, hasFullDataAccess } from '../permissions.js';
import {
  fetchTicketsForSearchApi,
  fetchPmRecordsForSearchApi,
  fetchSuggestionsForSearchApi
} from '../services/api.js';
import { COMPANY_NAME_AR, COMPANY_NAME_EN, COMPANY_SHORT } from '../branding.js';
import { parseTicketDate } from '../ticketStatusConstants.js';

export const ReportsView = () => {
  const isEn = window.currentLang === 'en';
  const isAr = !isEn;

  return `
  <div class="app-page p-3 sm:p-4 md:p-6 lg:p-8 max-w-md sm:max-w-xl md:max-w-5xl lg:max-w-7xl xl:max-w-[1550px] mx-auto pb-24 lg:pb-8 space-y-4 md:space-y-6 text-white">
    <!-- زر الرجوع والعنوان -->
    <div class="flex items-center justify-between border-b border-gray-800 pb-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick="window.goBack('maintenance')"
          class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
          <span class="text-base rtl:rotate-180">‹</span>
          <span class="text-xs text-slate-200">${isEn ? 'Back' : 'رجوع'}</span>
        </button>
        <div>
          <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
            <span>📊</span> ${isEn ? 'Reports & Excel Export' : 'مركز تقارير وتصدير البيانات'}
          </h2>
          <p class="text-[11px] text-gray-400 mt-0.5 font-medium">
            ${isEn ? 'Export official logs with company header and branding' : 'تصدير السجلات الرسمية مع هيدر وشعار الشركة'}
          </p>
        </div>
      </div>
    </div>

    <!-- بطاقة تأكيد الهوية الرسمية -->
    <div class="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/20 rounded-2xl p-3.5 flex items-start gap-3 shadow-md">
      <div class="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg shrink-0 mt-0.5">
        🏢
      </div>
      <div class="text-xs space-y-1">
        <div class="font-bold text-blue-300">
          ${isEn ? COMPANY_NAME_EN : COMPANY_NAME_AR}
        </div>
        <div class="text-[10px] text-gray-400 leading-relaxed">
          ${isEn 
            ? 'All exported Excel files automatically include the high-resolution company logo, certified ISO standards, timestamps, exporter details, and conditional color badges.' 
            : 'جميع ملفات الإكسيل المُصدّرة تُدرج تلقائياً لوجو الشركة الرسمي بدقة عالية، شهادات الجودة (ISO/FSSC)، بيانات القائم بالتصدير، وتلوين الحالات الذكي.'}
        </div>
      </div>
    </div>

    <!-- شبكة فلتر التاريخ وبطاقة التصدير الشامل -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- فلتر الفترة الزمنية للتصدير -->
      <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-3 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <span>🗓️</span> ${isEn ? 'Date Range Filter' : 'نطاق الفترة الزمنية للتصدير'}
            </label>
            <span class="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">
              ${isEn ? 'Auto Applied' : 'مطبق تلقائياً'}
            </span>
          </div>

          <select id="reportDateFilter" onchange="window.handleReportDateFilterChange()"
            class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">
            <option value="all">${isEn ? 'All Records (Full History)' : 'جميع السجلات (السجل الكامل)'}</option>
            <option value="today">${isEn ? 'Today' : 'اليوم'}</option>
            <option value="last7">${isEn ? 'Last 7 Days' : 'آخر 7 أيام'}</option>
            <option value="month" selected>${isEn ? 'This Month' : 'هذا الشهر'}</option>
            <option value="year">${isEn ? 'This Year' : 'هذه السنة'}</option>
            <option value="custom">${isEn ? 'Custom Date Range...' : 'تحديد فترة مخصصة...'}</option>
          </select>
        </div>

        <div id="reportCustomDatesRow" class="hidden grid grid-cols-2 gap-2 pt-1">
          <div>
            <label class="block text-[10px] text-gray-400 mb-1">${isEn ? 'From Date' : 'من تاريخ'}</label>
            <input id="reportDateFrom" type="date"
              class="w-full p-2 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner">
          </div>
          <div>
            <label class="block text-[10px] text-gray-400 mb-1">${isEn ? 'To Date' : 'إلى تاريخ'}</label>
            <input id="reportDateTo" type="date"
              class="w-full p-2 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner">
          </div>
        </div>
      </div>

      <!-- بطاقة التصدير الشامل (Master Multi-Sheet Report) -->
      <div class="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-[#1E293B] rounded-2xl p-4 border border-emerald-500/30 shadow-xl space-y-3 flex flex-col justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">
            📁
          </div>
          <div>
            <h3 class="text-xs font-black text-emerald-300">
              ${isEn ? 'Master Multi-Sheet Operations Report' : 'التقرير الشامل المجمع (متعدد التبويبات)'}
            </h3>
            <p class="text-[10px] text-gray-400">
              ${isEn ? 'Includes Tickets, PM, and Kaizen in a single structured workbook' : 'يجمع البلاغات والصيانة الوقائية والكايزن في ملف إكسيل واحد ذكي'}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btnExportMaster"
          onclick="window.runExcelExport('master')"
          class="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] rounded-xl font-black text-xs text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer">
          <span>📊</span>
          <span>${isEn ? 'Export Full Master Workbook (.xlsx)' : 'تصدير التقرير الشامل المجمع (Excel)'}</span>
        </button>
      </div>
    </div>

    <!-- خيارات التصدير الفردية المخصصة -->
    <div class="space-y-2.5">
      <h3 class="text-xs font-bold text-gray-400 px-1">
        ${isEn ? 'Sectional Reports' : 'تقارير الأقسام الفردية'}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <!-- 1. بلاغات الأعطال -->
        <div class="bg-[#1E293B] hover:bg-[#243348] border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-all duration-150 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-base shrink-0">
              🚨
            </div>
            <div>
              <div class="text-xs font-bold text-white">
                ${isEn ? 'Breakdown Tickets Log' : 'سجل بلاغات الأعطال والتوقفات'}
              </div>
              <div class="text-[10px] text-gray-400">
                ${isEn ? 'Machine issues, downtime, technician actions' : 'سجل الأعطال والتوقفات وإجراءات المعالجة'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onclick="window.runExcelExport('tickets')"
            class="w-full justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-emerald-400 font-bold text-xs active:scale-95 transition-all duration-150 flex items-center gap-1.5 shadow-sm cursor-pointer">
            <span>📤</span>
            <span>${isEn ? 'Export Excel' : 'تصدير إكسيل'}</span>
          </button>
        </div>

        <!-- 2. الصيانة الوقائية -->
        <div class="bg-[#1E293B] hover:bg-[#243348] border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-all duration-150 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-base shrink-0">
              🛠️
            </div>
            <div>
              <div class="text-xs font-bold text-white">
                ${isEn ? 'Preventive Maintenance (PM)' : 'سجل الصيانة الوقائية والتفتيش'}
              </div>
              <div class="text-[10px] text-gray-400">
                ${isEn ? 'Routine checks, checklists, spare parts' : 'الفحوصات الدورية وقطع الغيار'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onclick="window.runExcelExport('pm')"
            class="w-full justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-emerald-400 font-bold text-xs active:scale-95 transition-all duration-150 flex items-center gap-1.5 shadow-sm cursor-pointer">
            <span>📤</span>
            <span>${isEn ? 'Export Excel' : 'تصدير إكسيل'}</span>
          </button>
        </div>

        <!-- 3. مقترحات كايزن -->
        <div class="bg-[#1E293B] hover:bg-[#243348] border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-all duration-150 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base shrink-0">
              💡
            </div>
            <div>
              <div class="text-xs font-bold text-white">
                ${isEn ? 'Kaizen Improvement Log' : 'سجل مقترحات كايزن والتطوير'}
              </div>
              <div class="text-[10px] text-gray-400">
                ${isEn ? 'Suggestions, reviews, implementation' : 'أفكار التحسين ومراحل المراجعة والاعتماد'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onclick="window.runExcelExport('suggestions')"
            class="w-full justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-emerald-400 font-bold text-xs active:scale-95 transition-all duration-150 flex items-center gap-1.5 shadow-sm cursor-pointer">
            <span>📤</span>
            <span>${isEn ? 'Export Excel' : 'تصدير إكسيل'}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- مؤشر حالة التصدير المباشر -->
    <div id="exportStatusBox" class="hidden bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-xs text-gray-300 animate-pulse">
      ⏳ جاري سحب البيانات وبناء ملف الإكسيل الرسمي...
    </div>
  </div>
  `;
};

// ============================================================
// دالة تبديل خيار التاريخ المخصص
// ============================================================
window.handleReportDateFilterChange = function () {
  const select = document.getElementById('reportDateFilter');
  const customRow = document.getElementById('reportCustomDatesRow');
  if (!select || !customRow) return;

  if (select.value === 'custom') {
    customRow.classList.remove('hidden');
  } else {
    customRow.classList.add('hidden');
  }
};

// ============================================================
// دوال الفلترة المساعدة
// ============================================================
function getReportRecordDate(item) {
  // نفس قراءة التاريخ المستخدمة في باقي الشاشات (Timestamp / seconds / ISO / ms)
  return parseTicketDate(item?.createdAt || item?.date || item?.timestamp || null);
}

// إصلاح (اتساق الفلاتر مع شاشة البحث): حدود الفترات بنفس منطق
// maintenanceSearch.js (getDateRangeBounds) بالظبط، والسجلات بدون تاريخ
// صالح بتُستبعد من أي فترة محددة (وتظهر فقط في "جميع السجلات") بدل ما
// كانت بتتضمّن في كل فترة وتنفخ الأعداد
function filterRecordsByDateRange(records, filterType, fromDate, toDate) {
  if (!filterType || filterType === 'all') return records;

  const now = new Date();
  let start = null;
  let end = null;

  if (filterType === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filterType === 'last7') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filterType === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (filterType === 'year') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filterType === 'custom') {
    if (fromDate) start = new Date(fromDate + 'T00:00:00');
    if (toDate) end = new Date(toDate + 'T23:59:59');
    if (!start && !end) return records;
  }

  return records.filter(item => {
    const itemDate = getReportRecordDate(item);
    if (!itemDate) return false;
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    return true;
  });
}

// ترتيب الأحدث أولاً (نفس ترتيب الشاشات) - getDocs بدون orderBy بيرجّع
// السجلات بترتيب معرّف المستند العشوائي، فكان الإكسيل بيطلع بترتيب غير زمني
function sortRecordsNewestFirst(records) {
  return [...records].sort((a, b) => {
    const da = getReportRecordDate(a);
    const db = getReportRecordDate(b);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });
}

// إصلاح (إخفاء الأخطاء): نتيجة الجلب الفاشلة (status === 'error') كانت
// بتتعامل كأنها "لا توجد سجلات" (res.data || [])، وفي التقرير الشامل كانت
// تطلع ورقة فاضية بدون أي تنبيه. دلوقتي الفشل بيوقف التصدير برسالة خطأ
function unwrapReportFetch(res) {
  if (!res || res.status !== 'success' || !Array.isArray(res.data)) {
    throw new Error((res && res.message) || 'Report data fetch failed');
  }
  return res.data;
}

function localDateStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatReportDate(raw) {
  const isEn = window.currentLang === 'en';
  const d = parseTicketDate(raw);
  if (!d) return '-';
  try {
    return d.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '-';
  }
}

function formatReportStatus(status, kind, isEn) {
  const s = String(status || '').toLowerCase().trim();
  if (kind === 'ticket') {
    // نفس تسميات الشاشات (ticketStatusConstants.STATUS_LABELS و config.js)
    const arMap = {
      pending: 'جديد', assigned: 'تم الإسناد', in_progress: 'قيد التنفيذ',
      resolved: 'بانتظار تأكيد المُبلغ', closed: 'مغلقة', reopened: 'قيد التنفيذ'
    };
    const enMap = {
      pending: 'New', assigned: 'Assigned', in_progress: 'In Progress',
      resolved: 'Awaiting Reporter Confirmation', closed: 'Closed', reopened: 'In Progress'
    };
    return isEn ? (enMap[s] || status || 'New') : (arMap[s] || status || 'جديد');
  }
  if (kind === 'suggestion') {
    // نفس حالات مقترحات الكايزن الفعلية (kaizenBoard.js / maintenanceSearch.js)
    const arMap = {
      new: 'جديد', under_review: 'قيد المراجعة', in_progress: 'قيد التنفيذ',
      revision_requested: 'يحتاج تعديل', rejected: 'مرفوض', implemented: 'تم التنفيذ'
    };
    const enMap = {
      new: 'New', under_review: 'Under Review', in_progress: 'In Progress',
      revision_requested: 'Revision Requested', rejected: 'Rejected', implemented: 'Implemented'
    };
    return isEn ? (enMap[s] || status || 'New') : (arMap[s] || status || 'جديد');
  }
  if (kind === 'pm') {
    const arMap = { done: 'منفذ', completed: 'مكتمل', pending: 'معلق', overdue: 'متأخر' };
    const enMap = {
      done: 'Completed', completed: 'Completed', pending: 'Pending', overdue: 'Overdue',
      'منفذ': 'Completed', 'مكتمل': 'Completed', 'معلق': 'Pending', 'متأخر': 'Overdue'
    };
    return isEn ? (enMap[s] || status || 'Completed') : (arMap[s] || status || 'منفذ');
  }
  return status;
}

// سجل الصيانة الوقائية ملوش حقل status - الشاشة (maintenanceSearch) بتعرض
// "عدد بنود الفحص المنفذة x/3"، فالتقرير بيعرض نفس القيمة بدل "منفذ" ثابتة
function formatPmStatus(pm, isEn) {
  if (pm?.status) return formatReportStatus(pm.status, 'pm', isEn);
  const c = pm?.checklist || {};
  const done = [c.hydraulic, c.filters, c.lubrication].filter(Boolean).length;
  return isEn ? `${done}/3 items` : `${done}/3 بنود`;
}

function formatReportPriority(p, isEn) {
  const val = String(p || '').toLowerCase().trim();
  if (isEn) {
    if (val.includes('عالية') || val === 'high') return 'High';
    if (val.includes('منخفضة') || val === 'low') return 'Low';
    return 'Medium';
  } else {
    if (val.includes('high') || val === 'عالية') return 'عالية';
    if (val.includes('low') || val === 'منخفضة') return 'منخفضة';
    return 'متوسطة';
  }
}

// ============================================================
// تسمية نصية واضحة لنطاق الفترة الزمنية المُختار (عرض فقط - لا تُغيّر منطق الفلترة)
// ============================================================
function getPeriodLabel(filterType, fromDate, toDate, isAr) {
  const map = {
    all: isAr ? 'جميع السجلات (السجل الكامل)' : 'All Records (Full History)',
    today: isAr ? 'اليوم' : 'Today',
    last7: isAr ? 'آخر 7 أيام' : 'Last 7 Days',
    month: isAr ? 'هذا الشهر' : 'This Month',
    year: isAr ? 'هذه السنة' : 'This Year'
  };
  if (filterType === 'custom') {
    if (fromDate && toDate) return isAr ? `من ${fromDate} إلى ${toDate}` : `${fromDate} to ${toDate}`;
    if (fromDate) return isAr ? `من ${fromDate}` : `From ${fromDate}`;
    if (toDate) return isAr ? `حتى ${toDate}` : `Until ${toDate}`;
    return isAr ? 'فترة مخصصة' : 'Custom Range';
  }
  return map[filterType] || (isAr ? 'غير محدد' : 'Not Specified');
}

// ============================================================
// الدالة المركزية لتصدير الإكسيل
// ============================================================
// ============================================================
// بناة الصفوف (مصدر واحد للتصدير الفردي والتقرير الشامل - كانت مكررة
// حرفياً في الموضعين فأي تعديل كان بيتنسى في أحدهما)
// ============================================================
function attachmentsCell(rec) {
  return (Array.isArray(rec.imageUrls) && rec.imageUrls.length
    ? rec.imageUrls
    : (rec.imageUrl ? [rec.imageUrl] : [])).join(' | ');
}

function buildTicketSheet(tickets, isAr, isEn) {
  const headers = isAr
    ? ['رقم البلاغ', 'الماكينة / الخط', 'نوع العطل', 'الحالة', 'الأولوية', 'تاريخ الإنشاء', 'تم بواسطة', 'مسندة إلى', 'الوصف', 'ملاحظات المعالجة', 'المرفقات']
    : ['Ticket ID', 'Machine / Line', 'Issue Type', 'Status', 'Priority', 'Created Date', 'Reported By', 'Assigned To', 'Description', 'Resolution Notes', 'Attachments'];
  const rows = tickets.map(t => [
    t.issueId || t.id || '',
    t.machine || t.machineName || '',
    t.issueType || t.type || '',
    formatReportStatus(t.status, 'ticket', isEn),
    formatReportPriority(t.priority, isEn),
    formatReportDate(t.createdAt),
    t.reportedBy || t.reporter?.name || '',
    t.assignedTo || '',
    t.description || t.problem || '',
    t.resolutionDetails || t.mechanicNotes || '',
    attachmentsCell(t)
  ]);
  return {
    sheetName: isAr ? 'بلاغات الأعطال' : 'Tickets',
    title: isAr ? 'سجل بلاغات وتوقفات الصيانة' : 'Maintenance Breakdown Tickets Log',
    headers,
    rows
  };
}

function buildPmSheet(pmRecords, isAr, isEn) {
  const headers = isAr
    ? ['رقم السجل', 'الماكينة', 'نوع الفحص', 'الحالة', 'تاريخ التنفيذ', 'اسم الفني', 'الملاحظات', 'قطع الغيار', 'المرفقات']
    : ['PM ID', 'Machine', 'Check Type', 'Status', 'Execution Date', 'Technician', 'Notes', 'Spare Parts', 'Attachments'];
  const rows = pmRecords.map(pm => [
    pm.id || '',
    pm.machine || '',
    pm.checkType || pm.type || (isAr ? 'وقائية' : 'Preventive'),
    formatPmStatus(pm, isEn),
    formatReportDate(pm.createdAt || pm.date),
    // إصلاح: نموذج الـ PM بيحفظ اسم الفني في reporter.name (راجع pmView.js)
    // - الحقول technician/performedBy/name مش موجودة أصلاً فكان العمود فاضي دايماً
    pm.reporter?.name || pm.technician || pm.performedBy || pm.name || '',
    pm.notes || pm.description || '',
    pm.partsUsed || pm.spareParts || '-',
    attachmentsCell(pm)
  ]);
  return {
    sheetName: isAr ? 'الصيانة الوقائية' : 'PM Records',
    title: isAr ? 'سجل الصيانة الوقائية والتفتيش' : 'Preventive Maintenance Log',
    headers,
    rows
  };
}

function buildKaizenSheet(suggestions, isAr, isEn) {
  const headers = isAr
    ? ['رقم المقترح', 'عنوان المقترح', 'الماكينة / القسم', 'الحالة', 'تاريخ التقديم', 'مقدم المقترح', 'المشكلة الحالية', 'مقترح التحسين', 'المردود المتوقع', 'ملاحظات المراجعة', 'المرفقات']
    : ['ID', 'Title', 'Machine / Dept', 'Status', 'Date', 'Submitted By', 'Current Problem', 'Proposed Improvement', 'Expected Impact', 'Review Notes', 'Attachments'];
  const rows = suggestions.map(s => [
    s.id || '',
    s.title || '',
    s.machine || s.department || '',
    formatReportStatus(s.status || 'new', 'suggestion', isEn),
    formatReportDate(s.createdAt),
    s.anonymous ? (isAr ? 'مجهول' : 'Anonymous') : (s.name || s.submittedBy || ''),
    s.problem || '',
    s.solution || s.suggestion || '',
    s.impact || s.benefit || '',
    s.reviewNotes || s.implementationNotes || '',
    attachmentsCell(s)
  ]);
  return {
    sheetName: isAr ? 'مقترحات كايزن' : 'Kaizen Suggestions',
    title: isAr ? 'سجل مقترحات كايزن والتحسين المستمر' : 'Kaizen Continuous Improvement Log',
    headers,
    rows
  };
}

// ============================================================
// الدالة المركزية لتصدير الإكسيل
// ============================================================
window.runExcelExport = async function (type) {
  const isEn = window.currentLang === 'en';
  const isAr = !isEn;
  const statusBox = document.getElementById('exportStatusBox');

  if (statusBox) {
    statusBox.classList.remove('hidden');
    statusBox.textContent = isEn ? '⏳ Fetching data and generating Excel file...' : '⏳ جاري سحب البيانات وبناء ملف الإكسيل الرسمي مع شعار الشركة...';
  }

  const role = getCurrentRole();
  const isFullAccess = hasFullDataAccess(role);
  const myUid = localStorage.getItem('userId') || '';
  const myName = localStorage.getItem('name') || '';

  const dateFilterEl = document.getElementById('reportDateFilter');
  const filterType = dateFilterEl ? dateFilterEl.value : 'month';
  const fromDate = document.getElementById('reportDateFrom')?.value || '';
  const toDate = document.getElementById('reportDateTo')?.value || '';
  const periodLabel = getPeriodLabel(filterType, fromDate, toDate, isAr);
  const stamp = localDateStamp();
  const fetchArgs = { isFullAccess, myUid, myName };

  // null = التصدير اتوقف بدون ملف (لا بيانات) - false = فشل فعلي في بناء/تنزيل الملف
  let exported = null;

  try {
    if (type === 'tickets') {
      const tickets = sortRecordsNewestFirst(
        filterRecordsByDateRange(unwrapReportFetch(await fetchTicketsForSearchApi(fetchArgs)), filterType, fromDate, toDate)
      );

      if (!tickets.length) {
        alert(isAr ? 'لا توجد بلاغات أعطال مطابقة للفترة المحددة' : 'No ticket records found for the selected period');
        if (statusBox) statusBox.classList.add('hidden');
        return;
      }

      const sheet = buildTicketSheet(tickets, isAr, isEn);
      exported = await exportToExcel(sheet.title, sheet.headers, sheet.rows, `mscanco-tickets-${stamp}.xlsx`, {
        sheetName: sheet.sheetName,
        periodLabel
      });

    } else if (type === 'pm') {
      const pmRecords = sortRecordsNewestFirst(
        filterRecordsByDateRange(unwrapReportFetch(await fetchPmRecordsForSearchApi(fetchArgs)), filterType, fromDate, toDate)
      );

      if (!pmRecords.length) {
        alert(isAr ? 'لا توجد سجلات صيانة وقائية مطابقة للفترة المحددة' : 'No PM records found for the selected period');
        if (statusBox) statusBox.classList.add('hidden');
        return;
      }

      const sheet = buildPmSheet(pmRecords, isAr, isEn);
      exported = await exportToExcel(sheet.title, sheet.headers, sheet.rows, `mscanco-pm-${stamp}.xlsx`, {
        sheetName: sheet.sheetName,
        periodLabel
      });

    } else if (type === 'suggestions') {
      const suggestions = sortRecordsNewestFirst(
        filterRecordsByDateRange(unwrapReportFetch(await fetchSuggestionsForSearchApi(fetchArgs)), filterType, fromDate, toDate)
      );

      if (!suggestions.length) {
        alert(isAr ? 'لا توجد مقترحات كايزن مطابقة للفترة المحددة' : 'No Kaizen suggestions found for the selected period');
        if (statusBox) statusBox.classList.add('hidden');
        return;
      }

      const sheet = buildKaizenSheet(suggestions, isAr, isEn);
      exported = await exportToExcel(sheet.title, sheet.headers, sheet.rows, `mscanco-kaizen-${stamp}.xlsx`, {
        sheetName: sheet.sheetName,
        periodLabel
      });

    } else if (type === 'master') {
      // الجلب بالتوازي - ولو أي مصدر فشل التصدير كله بيتوقف (بدل ورقة فاضية صامتة)
      const [ticketsRes, pmRes, suggestionsRes] = await Promise.all([
        fetchTicketsForSearchApi(fetchArgs),
        fetchPmRecordsForSearchApi(fetchArgs),
        fetchSuggestionsForSearchApi(fetchArgs)
      ]);

      const tickets = sortRecordsNewestFirst(filterRecordsByDateRange(unwrapReportFetch(ticketsRes), filterType, fromDate, toDate));
      const pmRecords = sortRecordsNewestFirst(filterRecordsByDateRange(unwrapReportFetch(pmRes), filterType, fromDate, toDate));
      const suggestions = sortRecordsNewestFirst(filterRecordsByDateRange(unwrapReportFetch(suggestionsRes), filterType, fromDate, toDate));

      const totalCount = tickets.length + pmRecords.length + suggestions.length;
      if (totalCount === 0) {
        alert(isAr ? 'لا توجد أي بيانات مطابقة للفترة الزمنية المحددة' : 'No records found for the selected period');
        if (statusBox) statusBox.classList.add('hidden');
        return;
      }

      const multiSheets = [
        buildTicketSheet(tickets, isAr, isEn),
        buildPmSheet(pmRecords, isAr, isEn),
        buildKaizenSheet(suggestions, isAr, isEn)
      ];

      const masterTitle = isAr ? 'التقرير الشامل المجمع لعمليات الصيانة والكايزن' : 'MSCANCO Master Maintenance & Kaizen Operations Report';
      exported = await exportToExcel(masterTitle, [], [], `mscanco-operations-master-${stamp}.xlsx`, {
        sheets: multiSheets,
        periodLabel
      });
    }

    // exportToExcel بيرجّع false لو فشل تحميل المكتبة/البناء - كانت رسالة
    // "تم إنشاء التقرير بنجاح" بتظهر حتى في الحالة دي
    if (exported === false) {
      if (statusBox) statusBox.classList.add('hidden');
      return;
    }

    if (statusBox) {
      statusBox.classList.remove('animate-pulse');
      statusBox.innerHTML = `
        <div class="text-emerald-400 font-bold flex items-center justify-center gap-1.5 mb-1">
          <span>✅</span> <span>${isAr ? 'تم إنشاء التقرير بنجاح وبدء التنزيل!' : 'Report generated and download started!'}</span>
        </div>
        <div class="text-[10px] text-gray-400">
          ${isAr ? 'إذا طلب المتصفح إذناً، اضغط "سماح" (Allow) لإتمام الحفظ.' : 'If browser prompts for permission, click "Allow".'}
        </div>
      `;
      setTimeout(() => {
        if (statusBox) statusBox.classList.add('hidden');
      }, 7000);
    }
  } catch (err) {
    console.error('Error during Excel export:', err);
    alert(isAr ? 'حدث خطأ أثناء جلب البيانات أو تصدير ملف الإكسيل. يرجى المحاولة مجدداً.' : 'Error fetching data or generating the Excel report. Please try again.');
    if (statusBox) statusBox.classList.add('hidden');
  }
};
