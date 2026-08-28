import { exportToPdf, exportToExcel, PAGE_BREAK_CLASS } from './services/exportUtility.js';
// ============================================================
// maintenanceSearch.js
// منطق صفحة "البحث والفلترة المتقدمة" (maintenanceSearch)
// - يجمع بلاغات الأعطال (tickets) وسجلات الصيانة الوقائية
//   (pmRecords) ومقترحات الكايزن (suggestions) في مصفوفة واحدة موحّدة
// - الصلاحيات مُطبّقة فعلياً على مستوى جلب البيانات نفسه (وليس مجرد
//   إخفاء واجهة): admin/manager/engineer (راجع hasFullDataAccess في
//   permissions.js) يشوفوا كل شيء، أي دور تاني (فني...) يشوف بس
//   السجلات المسموح له بيها فعلاً - الاستعلامات المُرسَلة لـ Firestore
//   نفسها مختلفة حسب الدور (fetchTicketsForSearchApi/
//   fetchPmRecordsForSearchApi/fetchSuggestionsForSearchApi في
//   services/api.js)، فمفيش أي بيانات زيادة عن اللازم بتترجع أصلاً
// - بحث نصي + فلاتر (نوع السجل/الحالة/الأولوية/الماكينة/التاريخ) +
//   ترتيب + تصدير Excel و PDF (يحترمان نفس نتيجة البحث/الفلاتر
//   المعروضة بالظبط، وبالتالي نفس نطاق الصلاحيات)
// نفس أسلوب knowledgeBase.js تماماً (حالة موديول + دوال window.*)
// ============================================================

import { getCurrentRole, hasFullDataAccess } from './permissions.js';
import {
  fetchTicketsForSearchApi,
  fetchPmRecordsForSearchApi,
  fetchSuggestionsForSearchApi,
  fetchSuggestionLogsApi
} from './services/api.js';
import {
  buildPdfBrandHeaderHtml,
  buildPdfTitleBlockHtml,
  buildPdfSignatureBlockHtml,
  buildCsvHeaderLines,
  getCompanyLogoDataUrl
} from './branding.js';
import { openTicketDetailsModal } from './components/TicketDetailsModal.js';

// ============================================================
// حالة الموديول
// ============================================================

let allRecords = [];     // كل السجلات (بلاغات + PM + كايزن) بعد تطبيق نطاق الصلاحيات (من مصدر الجلب نفسه)
let isLoaded = false;
let loadError = false;   // فشل تحميل المصادر الثلاثة معاً فعلياً (مش مجرد صفر نتائج)
let currentType = 'all'; // all | ticket | pm | suggestion

const TYPE_META = {
  all: { activeClass: 'bg-blue-500/15 border-blue-500/50 text-blue-300' },
  ticket: { activeClass: 'bg-red-500/15 border-red-500/50 text-red-300' },
  pm: { activeClass: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' },
  suggestion: { activeClass: 'bg-amber-500/15 border-amber-500/50 text-amber-300' }
};
const INACTIVE_CLASS = 'bg-[#0F172A] border-gray-700 text-gray-400';

const STATUS_LABELS = {
  pending: "جديد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  resolved: "بانتظار تأكيد المُبلغ",
  closed: "مغلقة",
  reopened: "قيد التنفيذ"
};

const STATUS_CLASSES = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  closed: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  reopened: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
};

const PRIORITY_LABELS = { High: "🔴 عالية", Medium: "🟡 متوسطة", Low: "🟢 منخفضة" };

// حالات مقترحات الكايزن
const SUGGESTION_STATUS_LABELS = {
  new: "جديد",
  under_review: "قيد المراجعة",
  in_progress: "قيد التنفيذ",
  revision_requested: "يحتاج تعديل",
  rejected: "مرفوض",
  implemented: "تم التنفيذ"
};

const SUGGESTION_STATUS_CLASSES = {
  new: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  revision_requested: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  implemented: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
};

const SUGGESTION_ACTION_ICONS = {
  create: "📝", review: "🔍", reject: "❌", approve_assign: "✅",
  request_revision: "✏️", return_to_review: "↩️", resubmit: "✏️", implement: "🏁"
};

const TICKET_STATUS_OPTIONS = [
  ['all', 'كل الحالات'],
  ['pending', 'جديد'],
  ['assigned', 'تم الإسناد'],
  ['in_progress', 'قيد التنفيذ'],
  ['resolved', 'بانتظار تأكيد المُبلغ'],
  ['closed', 'مغلقة']
];

const SUGGESTION_STATUS_OPTIONS = [
  ['all', 'كل الحالات'],
  ['new', 'جديد'],
  ['under_review', 'قيد المراجعة'],
  ['in_progress', 'قيد التنفيذ'],
  ['revision_requested', 'يحتاج تعديل'],
  ['rejected', 'مرفوض'],
  ['implemented', 'تم التنفيذ']
];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STATUS_FILTER_ALIASES = {
  in_progress: ["in_progress", "reopened"]
};

function el(id) {
  return document.getElementById(id);
}

// ============================================================
// إظهار/إخفاء وتبديل خيارات الفلاتر حسب نوع السجل المختار حالياً
// ============================================================

function updateFilterVisibilityForType(type) {
  const statusSelect = el('mStatusFilter');
  const priorityFilter = el('mPriorityFilter');

  if (statusSelect) {
    const options = type === 'suggestion' ? SUGGESTION_STATUS_OPTIONS : TICKET_STATUS_OPTIONS;
    const previousValue = statusSelect.value;
    statusSelect.innerHTML = options.map(([value, label]) =>
      `<option value="${value}">${label}</option>`
    ).join('');
    statusSelect.value = options.some(([value]) => value === previousValue) ? previousValue : 'all';
    statusSelect.classList.toggle('hidden', type === 'pm');
  }

  if (priorityFilter) {
    priorityFilter.classList.toggle('hidden', type === 'pm' || type === 'suggestion');
  }
}

// ============================================================
// فلتر التاريخ - يحسب حدود الفترة (من/إلى) حسب الخيار المختار
// ============================================================

function getDateRangeBounds() {
  const filterValue = el('mDateFilter')?.value || 'all';
  if (filterValue === 'all') return null;

  const now = new Date();
  let from = null;
  let to = null;

  if (filterValue === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filterValue === 'last7') {
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
  } else if (filterValue === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (filterValue === 'year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filterValue === 'custom') {
    const fromValue = el('mDateFrom')?.value || '';
    const toValue = el('mDateTo')?.value || '';
    from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
    to = toValue ? new Date(`${toValue}T23:59:59`) : null;
    if (!from && !to) return null;
  }

  return { from, to };
}

window.handleMaintenanceSearchDateFilterChange = function () {
  const filterValue = el('mDateFilter')?.value || 'all';
  const isCustom = filterValue === 'custom';

  el('mDateFrom')?.classList.toggle('hidden', !isCustom);
  el('mDateTo')?.classList.toggle('hidden', !isCustom);

  renderResults();
};

// ============================================================
// تهيئة الصفحة عند فتحها لأول مرة (تُستدعى من renderCore.js)
// ============================================================

export async function initMaintenanceSearchView() {
  const box = el('mResultsBox');
  if (box) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-8">جاري تحميل البيانات...</div>`;
  }

  const role = getCurrentRole();
  const myName = localStorage.getItem('name') || '';
  const myUid = localStorage.getItem('userId') || '';

  const isFullAccess = hasFullDataAccess(role);

  const [ticketsResult, pmResult, suggestionsResult] = await Promise.all([
    fetchTicketsForSearchApi({ isFullAccess, myUid, myName }),
    fetchPmRecordsForSearchApi({ isFullAccess, myName }),
    fetchSuggestionsForSearchApi({ isFullAccess, myUid, myName })
  ]);

  const tickets = (ticketsResult.status === 'success' && Array.isArray(ticketsResult.data))
    ? ticketsResult.data : [];
  const pmRecords = (pmResult.status === 'success' && Array.isArray(pmResult.data))
    ? pmResult.data : [];
  const suggestions = (suggestionsResult.status === 'success' && Array.isArray(suggestionsResult.data))
    ? suggestionsResult.data : [];

  loadError =
    ticketsResult.status !== 'success' &&
    pmResult.status !== 'success' &&
    suggestionsResult.status !== 'success';

  allRecords = [
    ...tickets.map(t => ({ ...t, _kind: 'ticket' })),
    ...pmRecords.map(p => ({ ...p, _kind: 'pm' })),
    ...suggestions.map(s => ({ ...s, _kind: 'suggestion' }))
  ];

  isLoaded = true;

  updateFilterVisibilityForType(currentType);
  window.switchMaintenanceSearchType(currentType);
}

// ============================================================
// تبديل تبويب نوع السجل
// ============================================================

window.switchMaintenanceSearchType = function (type) {
  currentType = type;

  document.querySelectorAll('.m-type-btn').forEach(btn => {
    const isActive = btn.dataset.type === type;
    btn.className =
      'm-type-btn py-2 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ' +
      (isActive ? TYPE_META[type].activeClass : INACTIVE_CLASS);
  });

  updateFilterVisibilityForType(type);
  renderResults();
};

// ============================================================
// تطبيق البحث/الفلاتر
// ============================================================

window.applyMaintenanceSearchFilters = function () {
  renderResults();
};

// ============================================================
// فتح تفاصيل بلاغ عطل
// ============================================================

window.openMaintenanceSearchTicketDetails = function (ticketId) {
  openTicketDetailsModal(ticketId);
};

// ============================================================
// مودال تفاصيل مقترح كايزن
// ============================================================

function formatSuggestionDetailsDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function suggestionTimelineItemHtml(log) {
  return `
    <div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div class="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xs">
          ${SUGGESTION_ACTION_ICONS[log.action] || "•"}
        </div>
        <div class="w-px flex-1 bg-gray-700 my-1"></div>
      </div>
      <div class="pb-4 flex-1">
        <div class="text-[11px] font-bold text-gray-200">
          ${SUGGESTION_STATUS_LABELS[log.toStatus] || escapeHtml(log.toStatus)}
        </div>
        <div class="text-[10px] text-gray-500 mt-0.5">
          ${escapeHtml(log.by || "")} ${log.byRole ? `(${escapeHtml(log.byRole)})` : ""} · ${formatSuggestionDetailsDate(log.at)}
        </div>
        ${log.note ? `<div class="text-[11px] text-gray-400 mt-1 bg-[#0F172A] rounded-lg p-2 border border-gray-800">${escapeHtml(log.note)}</div>` : ""}
      </div>
    </div>
  `;
}

async function openSuggestionDetailsModal(suggestion) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4";

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-md p-4 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-amber-400">💡 تفاصيل مقترح الكايزن</h3>
        <button id="mSuggDetails_close" class="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div id="mSuggDetails_body" class="text-center text-gray-500 text-xs py-8">
        جاري التحميل...
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#mSuggDetails_close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const logsResult = await fetchSuggestionLogsApi(suggestion.id);
  const logs = logsResult.status === "success" ? logsResult.data : [];
  const status = String(suggestion.status || "new").toLowerCase();
  const implementationImages = Array.isArray(suggestion.implementationImages) ? suggestion.implementationImages : [];
  const suggestionImages = Array.isArray(suggestion.imageUrls) && suggestion.imageUrls.length
    ? suggestion.imageUrls
    : (suggestion.imageUrl ? [suggestion.imageUrl] : []);

  const body = overlay.querySelector("#mSuggDetails_body");

  body.innerHTML = `
    <div class="space-y-4 text-right">

      <!-- بيانات أساسية -->
      <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">العنوان</span>
          <span class="text-gray-200 font-bold">${escapeHtml(suggestion.title || "-")}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">الحالة</span>
          <span class="text-amber-300 font-bold">${SUGGESTION_STATUS_LABELS[status] || escapeHtml(status)}</span>
        </div>
        ${suggestion.machine ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">الماكينة</span>
          <span class="text-gray-300">${escapeHtml(suggestion.machine)}</span>
        </div>` : ""}
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">مقدّم المقترح</span>
          <span class="text-gray-300">${escapeHtml(suggestion.anonymous ? "🕶️ مقترح مجهول" : (suggestion.name || "-"))}</span>
        </div>
        ${suggestion.assignedTo ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">الفني المسؤول</span>
          <span class="text-gray-300">${escapeHtml(suggestion.assignedTo)}</span>
        </div>` : ""}
        ${suggestion.problem ? `<div class="text-xs text-gray-400 pt-1 border-t border-gray-800 mt-1"><b>المشكلة:</b> ${escapeHtml(suggestion.problem)}</div>` : ""}
        ${suggestion.solution ? `<div class="text-xs text-gray-400"><b>الحل المقترح:</b> ${escapeHtml(suggestion.solution)}</div>` : ""}
        ${suggestion.rejectionReason && status === "rejected" ? `<div class="text-xs text-red-400 pt-1 border-t border-gray-800 mt-1"><b>سبب الرفض:</b> ${escapeHtml(suggestion.rejectionReason)}</div>` : ""}
        ${suggestion.revisionNotes && status === "revision_requested" ? `<div class="text-xs text-orange-400 pt-1 border-t border-gray-800 mt-1"><b>ملاحظات التعديل:</b> ${escapeHtml(suggestion.revisionNotes)}</div>` : ""}
      </div>

      <!-- صور المقترح -->
      ${suggestionImages.length ? `
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">📷 ${suggestionImages.length > 1 ? "صور المقترح" : "صورة المقترح"}</div>
          <div class="grid grid-cols-3 gap-2">
            ${suggestionImages.map(url => `
              <a href="${url}" target="_blank" rel="noopener">
                <img src="${url}" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
              </a>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- صور التنفيذ -->
      ${implementationImages.length ? `
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">📷 صور بعد التنفيذ</div>
          <div class="grid grid-cols-3 gap-2">
            ${implementationImages.map(url => `
              <a href="${url}" target="_blank" rel="noopener">
                <img src="${url}" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
              </a>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- التايملاين -->
      <div>
        <div class="text-[11px] font-bold text-gray-300 mb-2">🕒 سجل الحالات</div>
        ${logs.length ? logs.map(suggestionTimelineItemHtml).join("") : `<div class="text-[11px] text-gray-500">لا يوجد سجل بعد.</div>`}
      </div>

    </div>
  `;
}

window.openMaintenanceSearchSuggestionDetails = function (suggestionId) {
  const suggestion = allRecords.find(r => r._kind === 'suggestion' && r.id === suggestionId);
  if (!suggestion) return;
  openSuggestionDetailsModal(suggestion);
};

// ============================================================
// بناء وعرض النتائج المفلترة
// ============================================================

let lastFilteredList = [];

function renderResults() {
  const box = el('mResultsBox');
  const summaryBox = el('mResultsSummary');
  if (!box) return;

  if (!isLoaded) return;

  if (loadError) {
    if (summaryBox) summaryBox.innerHTML = '';
    box.innerHTML = `
      <div class="text-center text-red-400 text-[11px] py-8 space-y-2">
        <div>⚠️ تعذّر تحميل البيانات - تأكد من الاتصال بالإنترنت.</div>
        <button onclick="window.retryMaintenanceSearchLoad()"
          class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all">
          إعادة المحاولة
        </button>
      </div>
    `;
    return;
  }

  const searchTerm = (el('mSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = el('mStatusFilter')?.value || 'all';
  const priorityFilter = el('mPriorityFilter')?.value || 'all';
  const machineFilter = el('mMachineFilter')?.value || 'all';
  const sortOrder = el('mSortFilter')?.value || 'newest';
  const dateRange = getDateRangeBounds();

  let list = [...allRecords];

  if (currentType !== 'all') {
    list = list.filter(r => r._kind === currentType);
  }

  if (statusFilter !== 'all') {
    if (currentType === 'suggestion') {
      list = list.filter(r => r._kind === 'suggestion' && String(r.status || 'new').toLowerCase() === statusFilter);
    } else {
      const aliasValues = STATUS_FILTER_ALIASES[statusFilter] || [statusFilter];
      list = list.filter(r => r._kind === 'ticket' && aliasValues.includes(String(r.status || '').toLowerCase()));
    }
  }

  if (priorityFilter !== 'all') {
    list = list.filter(r => r._kind === 'ticket' && r.priority === priorityFilter);
  }

  if (machineFilter !== 'all') {
    list = list.filter(r => (r.machine || '') === machineFilter);
  }

  if (dateRange) {
    list = list.filter(r => {
      if (!r.createdAt) return false;
      const created = new Date(r.createdAt);
      if (isNaN(created.getTime())) return false;
      if (dateRange.from && created < dateRange.from) return false;
      if (dateRange.to && created > dateRange.to) return false;
      return true;
    });
  }

  if (searchTerm) {
    list = list.filter(r => {
      const haystack = [
        r.machine, r.line, r.description, r.notes, r.locationInMachine,
        r.reportedBy, r.assignedTo, r.reporter?.name, r.category, r.mechanicNotes,
        r.title, r.problem, r.solution, r.name, r.impact
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  list.sort((a, b) => {
    const diff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return sortOrder === 'oldest' ? -diff : diff;
  });

  lastFilteredList = list;

  if (summaryBox) {
    summaryBox.innerHTML = `عدد النتائج: <span class="text-gray-300 font-bold">${list.length}</span> من إجمالي ${allRecords.length} سجل`;
  }

  if (!list.length) {
    box.innerHTML = `
      <div class="text-center text-gray-500 text-[11px] py-8">
        لا توجد نتائج مطابقة لبحثك/فلاترك الحالية.
      </div>
    `;
    return;
  }

  box.innerHTML = list.map(r => {
    if (r._kind === 'ticket') return ticketResultCard(r);
    if (r._kind === 'pm') return pmResultCard(r);
    return suggestionResultCard(r);
  }).join('');
}

// ============================================================
// إعادة محاولة تحميل البيانات
// ============================================================

window.retryMaintenanceSearchLoad = function () {
  isLoaded = false;
  initMaintenanceSearchView();
};

// ============================================================
// جمع روابط الوسائط
// ============================================================

function collectRecordMediaUrls(record) {
  const urls = [];
  if (record._kind === 'ticket') {
    if (Array.isArray(record.imageUrls)) urls.push(...record.imageUrls);
    else if (record.imageUrl) urls.push(record.imageUrl);
    if (Array.isArray(record.afterImages)) urls.push(...record.afterImages);
  } else if (record._kind === 'suggestion') {
    if (Array.isArray(record.imageUrls)) urls.push(...record.imageUrls);
    else if (record.imageUrl) urls.push(record.imageUrl);
    if (Array.isArray(record.implementationImages)) urls.push(...record.implementationImages);
  }
  return urls.filter(Boolean);
}

// ============================================================
// تصدير النتائج المفلترة الحالية كملف CSV (تعديل: تنسيق التاريخ والروابط)
// ============================================================

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

window.exportMaintenanceSearchResults = async function () {
  if (!lastFilteredList.length) {
    alert('لا توجد نتائج لتصديرها بالفلاتر الحالية');
    return;
  }

  const isAr = (window.currentLang || "ar") === "ar";
  
  const headers = isAr 
    ? ['النوع', 'رقم السجل', 'الماكينة / العنوان', 'الحالة', 'تاريخ الإنشاء', 'تم بواسطة', 'مسندة إلى', 'الوصف', 'ملاحظات المعالجة', 'روابط المرفقات (فيديو/صور)']
    : ['Type', 'ID', 'Machine / Title', 'Status', 'Date', 'By', 'Assigned To', 'Description', 'Notes', 'Attachments'];

  const rows = lastFilteredList.map(record => {
    const kind = record._kind;
    let kindStr = kind;
    if (isAr) kindStr = kind === 'ticket' ? 'عطل' : kind === 'suggestion' ? 'مقترح' : 'صيانة وقائية';
    else kindStr = kind === 'ticket' ? 'Ticket' : kind === 'suggestion' ? 'Suggestion' : 'PM';

    const titleText = kind === 'suggestion' ? (record.title || record.machine || '') : (record.machine || record.machineName || '');
    let statusText = String(record.status || '').toLowerCase();
    if (kind === 'ticket') statusText = (isAr ? STATUS_LABELS[statusText] : statusText) || statusText;
    if (kind === 'suggestion') statusText = (isAr ? SUGGESTION_STATUS_LABELS[statusText] : statusText) || statusText;

    const byText = kind === 'suggestion' ? (record.anonymous ? (isAr ? 'مجهول' : 'Anonymous') : record.name) : (record.reportedBy || record.reporter?.name || '');
    const assignedText = record.assignedTo || '';
    const descText = record.description || record.problem || record.notes || '';
    const resolutionText = record.resolutionDetails || record.implementationNotes || '';
    
    const mediaUrls = collectRecordMediaUrls(record);
    const attachments = mediaUrls.join(' | ');

    return [
      kindStr,
      record.id || '',
      titleText,
      statusText,
      formatPdfDate(record.createdAt),
      byText,
      assignedText,
      descText,
      resolutionText,
      attachments
    ];
  });

  const title = isAr ? 'تقرير البحث والفلترة المتقدمة' : 'Advanced Search Report';
  const filename = `maintenance-search-${new Date().toISOString().slice(0, 10)}.csv`;
  
  await exportToExcel(title, headers, rows, filename);
};

// ============================================================
// تصدير النتائج المفلترة الحالية كملف PDF احترافي (RTL)
// ============================================================

const PDF_PAGE_WIDTH_PX = 794;

function formatPdfDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return iso || '-';
  }
}

async function loadImageAsCompressedDataUrl(url, maxDim = 480, quality = 0.55) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = await new Promise((resolve, reject) => {
      const imgEl = new Image();
      imgEl.onload = () => resolve(imgEl);
      imgEl.onerror = () => reject(new Error("تعذر فك ترميز الصورة"));
      imgEl.src = objectUrl;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);

    URL.revokeObjectURL(objectUrl);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (error) {
    console.warn("تعذر تحميل/ضغط صورة للتصدير:", url, error);
    return null;
  }
}

window.exportMaintenanceSearchResultsPdf = async function () {
  if (!lastFilteredList.length) {
    alert('لا توجد نتائج لتصديرها بالفلاتر الحالية');
    return;
  }

  const btn = el('mExportPdfBtn');
  const originalLabel = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري التجهيز...";
  }

  try {
    const isAr = (window.currentLang || "ar") === "ar";
    const recordsWithImages = [];
    for (const record of lastFilteredList) {
      const mediaUrls = collectRecordMediaUrls(record).slice(0, 4);
      const dataUrls = [];
      for (const url of mediaUrls) {
        const dataUrl = await loadImageAsCompressedDataUrl(url);
        if (dataUrl) dataUrls.push(dataUrl);
      }
      const hasSkippedMedia = mediaUrls.length > dataUrls.length;
      recordsWithImages.push({ record, images: dataUrls, hasSkippedMedia });
    }

    const htmlContent = recordsWithImages.map(({ record, images, hasSkippedMedia }) => {
      const kind = record._kind;
      const kindLabel = kind === 'ticket' ? (isAr ? '🚨 بلاغ عطل' : '🚨 Ticket') 
                      : kind === 'suggestion' ? (isAr ? '💡 مقترح كايزن' : '💡 Suggestion') 
                      : (isAr ? '📝 صيانة وقائية' : '📝 PM');
      
      const titleText = kind === 'suggestion' ? (record.title || record.machine || '-') : (record.machine || record.machineName || '-');
      let statusLabel = '-';
      if (kind === 'ticket') {
        const status = String(record.status || '').toLowerCase();
        statusLabel = (isAr ? STATUS_LABELS[status] : status) || record.status || '-';
      } else if (kind === 'suggestion') {
        const status = String(record.status || 'new').toLowerCase();
        statusLabel = (isAr ? SUGGESTION_STATUS_LABELS[status] : status) || record.status || '-';
      } else {
        const checklist = record.checklist || {};
        const doneCount = [checklist.hydraulic, checklist.filters, checklist.lubrication].filter(Boolean).length;
        statusLabel = isAr ? `${doneCount}/3 بنود` : `${doneCount}/3 items`;
      }
      const descriptionText = record.description || record.problem || record.notes || '';
      
      const reportedLabel = isAr ? "👤 بلّغ:" : "👤 Reporter:";
      const assignedLabel = isAr ? "🛠️ مُسندة إلى:" : "🛠️ Assigned To:";
      const anonymousLabel = isAr ? "مجهول" : "Anonymous";
      const suggesterLabel = isAr ? "👤 مقدّم المقترح:" : "👤 Suggester:";
      const techLabel = isAr ? "🔧 الفني:" : "🔧 Technician:";
      
      const peopleLine = kind === 'ticket'
        ? `${reportedLabel} ${escapeHtml(record.reportedBy || '-')} &nbsp;|&nbsp; ${assignedLabel} ${escapeHtml(record.assignedTo || '-')}`
        : kind === 'suggestion'
          ? `${suggesterLabel} ${escapeHtml(record.anonymous ? anonymousLabel : (record.name || '-'))} &nbsp;|&nbsp; ${techLabel} ${escapeHtml(record.assignedTo || '-')}`
          : `${techLabel} ${escapeHtml(record.reporter?.name || '-')}`;

      const imagesHtml = images.length ? `
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          ${images.map(src => `
            <img src="${src}" style="width:100px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" />
          `).join("")}
        </div>
      ` : "";
      
      const skippedNoteHtml = hasSkippedMedia ? `
        <div style="font-size:10px; color:#b45309; margin-top:6px;">
          ${isAr ? "🎥 يوجد وسائط إضافية (فيديو/ملف) مرتبطة بهذا السجل - راجع تصدير Excel لروابطها الكاملة." : "🎥 Additional media (video/file) exists - see Excel export for full links."}
        </div>
      ` : "";
      return `
        <div class="${PAGE_BREAK_CLASS}" style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:14px; background: #f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:13px; color:#0f172a;">${kindLabel} — ${escapeHtml(titleText)}</span>
            <span style="font-size:11px; padding:2px 10px; border-radius:10px; background:#e2e8f0; color:#334155;">
              ${escapeHtml(statusLabel)}
            </span>
          </div>
          <div style="font-size:11px; color:#475569; margin-bottom:6px;">
            📅 ${formatPdfDate(record.createdAt)} &nbsp;|&nbsp; ${peopleLine}
          </div>
          ${descriptionText ? `<div style="font-size:11px; color:#1e293b; margin-bottom:6px;">${escapeHtml(descriptionText)}</div>` : ""}
          ${imagesHtml}
          ${skippedNoteHtml}
        </div>
      `;
    }).join("");

    const title = isAr ? "🔎 تقرير البحث والفلترة المتقدمة" : "🔎 Advanced Search Report";
    const filename = `maintenance-search-${new Date().toISOString().slice(0, 10)}.pdf`;
    
    const infoRows = [
      { label: isAr ? "إجمالي النتائج" : "Total Results", value: lastFilteredList.length }
    ];

    await exportToPdf(title, infoRows, htmlContent, filename);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert('حدث خطأ أثناء تصدير PDF');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }
};

// ============================================================
// كارت نتيجة - بلاغ عطل
// ============================================================

function ticketResultCard(t) {
  const status = String(t.status || '').trim().toLowerCase();
  const machineName = escapeHtml(t.machine || t.machineName || '-');

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3 space-y-2 text-xs">
      <div class="flex justify-between items-center">
        <span class="font-bold text-gray-100 flex items-center gap-1.5">
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">🚨 بلاغ</span>
          ${machineName}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASSES[status] || 'bg-gray-500/10 text-gray-400'}">
          ${STATUS_LABELS[status] || escapeHtml(status) || '-'}
        </span>
      </div>

      ${t.description ? `<p class="text-[11px] text-gray-400">${escapeHtml(t.description)}</p>` : ''}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${t.priority ? `<span>${PRIORITY_LABELS[t.priority] || escapeHtml(t.priority)}</span>` : ''}
        ${t.reportedBy ? `<span>👤 بلّغ: ${escapeHtml(t.reportedBy)}</span>` : ''}
        ${t.assignedTo ? `<span>🛠️ مُسندة إلى: ${escapeHtml(t.assignedTo)}</span>` : ''}
        ${t.createdAt ? `<span>🕓 ${escapeHtml(new Date(t.createdAt).toLocaleDateString('ar-EG'))}</span>` : ''}
      </div>

      <button
        onclick="window.openMaintenanceSearchTicketDetails('${t.id}')"
        class="w-full text-[11px] font-bold py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 transition-all">
        🔍 التفاصيل
      </button>
    </div>
  `;
}

// ============================================================
// كارت نتيجة - سجل صيانة وقائية (PM)
// ============================================================

function pmResultCard(p) {
  const checklist = p.checklist || {};
  const doneCount = [checklist.hydraulic, checklist.filters, checklist.lubrication].filter(Boolean).length;

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3 space-y-2 text-xs">
      <div class="flex justify-between items-center">
        <span class="font-bold text-gray-100 flex items-center gap-1.5">
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">📝 صيانة وقائية</span>
          ${escapeHtml(p.machine || '-')}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ✅ ${doneCount}/3 بنود
        </span>
      </div>

      ${p.notes ? `<p class="text-[11px] text-gray-400">${escapeHtml(p.notes)}</p>` : ''}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${p.reporter?.name ? `<span>👤 الفني: ${escapeHtml(p.reporter.name)}</span>` : ''}
        ${p.reporter?.shift ? `<span>🕒 الوردية: ${escapeHtml(p.reporter.shift)}</span>` : ''}
        ${p.createdAt ? `<span>🕓 ${escapeHtml(new Date(p.createdAt).toLocaleDateString('ar-EG'))}</span>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// كارت نتيجة - مقترح كايزن
// ============================================================

function suggestionResultCard(s) {
  const status = String(s.status || 'new').trim().toLowerCase();
  const titleText = escapeHtml(s.title || s.machine || '-');

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3 space-y-2 text-xs">
      <div class="flex justify-between items-center">
        <span class="font-bold text-gray-100 flex items-center gap-1.5">
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">💡 كايزن</span>
          ${titleText}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${SUGGESTION_STATUS_CLASSES[status] || 'bg-gray-500/10 text-gray-400'}">
          ${SUGGESTION_STATUS_LABELS[status] || escapeHtml(status) || '-'}
        </span>
      </div>

      ${s.problem ? `<p class="text-[11px] text-gray-400">${escapeHtml(s.problem)}</p>` : ''}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${s.machine ? `<span>🏭 ${escapeHtml(s.machine)}</span>` : ''}
        <span>👤 ${escapeHtml(s.anonymous ? 'مجهول' : (s.name || '-'))}</span>
        ${s.assignedTo ? `<span>🔧 الفني: ${escapeHtml(s.assignedTo)}</span>` : ''}
        ${s.createdAt ? `<span>🕓 ${escapeHtml(new Date(s.createdAt).toLocaleDateString('ar-EG'))}</span>` : ''}
      </div>

      <button
        onclick="window.openMaintenanceSearchSuggestionDetails('${s.id}')"
        class="w-full text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all">
        🔍 التفاصيل
      </button>
    </div>
  `;
}
