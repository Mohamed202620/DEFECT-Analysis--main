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
//   ترتيب + تصدير CSV و PDF (يحترمان نفس نتيجة البحث/الفلاتر
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

// حالات مقترحات الكايزن (نفس القيم/التسميات المُستخدمة أصلاً في
// kaizenBoard.js - مُعادة هنا بشكل مستقل بنفس فلسفة الملف: كل
// شاشة عندها نسخة خاصة بيها بدل استيراد متشابك بين الشاشات)
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

// خيارات فلتر "الحالة" تتغيّر حسب نوع السجل المختار - بلاغات
// الأعطال ومقترحات الكايزن عندهم مفهوم "حالة" مختلف تماماً عن
// بعضهم، والصيانة الوقائية أصلاً مالهاش "حالة" (بنود Checklist بس)
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

// إصلاح: نصوص المستخدم (الوصف/الملاحظات/الأسماء) كانت بتتحقن مباشرة
// جوه innerHTML من غير أي تنقية - أي نص فيه < أو > أو " كان ممكن
// يكسر شكل الكارت أو يحقن HTML/سكريبت داخل الصفحة (نفس فئة المشكلة
// اللي اتصلحت في ActionModal.js). كل نص مستخدم بيتعرض هنا لازم يعدي
// من الدالة دي الأول.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// إصلاح: فلتر الحالة كان بيقارن مطابقة تامة بس، فكانت التذاكر بحالة
// "reopened" (اللي بتتعامل معاها باقي الصفحة بصرياً كـ"قيد التنفيذ" -
// نفس الـ label ونفس الكلاس فوق) بتختفي لو اخترت فلتر "قيد التنفيذ"
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
    // الحفاظ على القيمة المختارة لو لسه موجودة ضمن الخيارات الجديدة
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

// تبديل ظهور حقول "من/إلى" لما يختار المستخدم "نطاق مخصص"، وتُستدعى
// أيضاً بمجرد تغيير فلتر التاريخ عشان تعيد رسم النتائج فوراً
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

  // نطاق الصلاحيات: admin/manager/engineer يشوفوا كل شيء، أي دور
  // تاني (فني...) يشوف بس بياناته المسموح له بيها - القرار ده بيتحدد
  // مرة واحدة هنا وبيتبعت لكل دالة جلب، فالفلترة تحصل فعلياً جوه
  // استعلام Firestore نفسه مش بعد الجلب (راجع services/api.js)
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

  // لو المصادر التلاتة فشلت فعلياً (مش مجرد صفر نتائج) نعلّم على كده
  // عشان renderResults تعرض رسالة خطأ واضحة بدل "لا توجد نتائج"
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
// تطبيق البحث/الفلاتر (تُستدعى من كل حقول الفلترة)
// ============================================================

window.applyMaintenanceSearchFilters = function () {
  renderResults();
};

// ============================================================
// فتح تفاصيل بلاغ عطل (إعادة استخدام المودال الموجود بالفعل)
// ============================================================

window.openMaintenanceSearchTicketDetails = function (ticketId) {
  openTicketDetailsModal(ticketId);
};

// ============================================================
// مودال تفاصيل مقترح كايزن - نسخة خفيفة مستقلة (نفس أسلوب/تصميم
// TicketDetailsModal.js)، لكن بدون الاعتماد على أي حالة داخلية
// لصفحة كايزن (kaizenBoard.js) عشان تشتغل بشكل مستقل تماماً حتى لو
// المستخدم دخل صفحة البحث مباشرة من غير ما يفتح لوحة الكايزن -
// بيانات المقترح نفسها متوفرة أصلاً في allRecords، وسجل الحالات
// بيتجاب بطلب واحد بس (fetchSuggestionLogsApi) وقت فتح المودال
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

      <!-- صورة المقترح -->
      ${suggestion.imageUrl ? `
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">📷 صورة المقترح</div>
          <a href="${suggestion.imageUrl}" target="_blank" rel="noopener">
            <img src="${suggestion.imageUrl}" class="w-full max-h-40 object-cover rounded-lg border border-gray-800" />
          </a>
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
  // بيانات المقترح متوفرة أصلاً جوه allRecords (نفس السجل المعروض في
  // الكارت) - مفيش داعي لأي طلب جلب إضافي غير سجل الحالات وقت الفتح
  const suggestion = allRecords.find(r => r._kind === 'suggestion' && r.id === suggestionId);
  if (!suggestion) return;
  openSuggestionDetailsModal(suggestion);
};

// ============================================================
// بناء وعرض النتائج المفلترة
// ============================================================

// حالة إضافية: آخر قائمة مفلترة مُعروضة فعلياً - محفوظة عشان أزرار
// التصدير (CSV/PDF) تصدّر بالظبط اللي المستخدم شايفه على الشاشة،
// بدون إعادة حساب الفلاتر تاني، وبنفس نطاق الصلاحيات (allRecords
// أصلاً مفلترة حسب الدور من الاستعلام نفسه في initMaintenanceSearchView)
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
      // مقترحات الكايزن فقط - بحالتها الخاصة (new/under_review/...)
      list = list.filter(r => r._kind === 'suggestion' && String(r.status || 'new').toLowerCase() === statusFilter);
    } else {
      // الحالة هنا مفهوم خاص ببلاغات الأعطال فقط - سجلات الـ PM
      // ومقترحات الكايزن بتُستبعد تلقائياً لو تم اختيار فلتر حالة بلاغ
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
// إعادة محاولة تحميل البيانات بعد فشل (تُستدعى من زرار "إعادة
// المحاولة" في حالة الخطأ)
// ============================================================

window.retryMaintenanceSearchLoad = function () {
  isLoaded = false;
  initMaintenanceSearchView();
};

// ============================================================
// جمع روابط الوسائط (صور/أي رابط ملف) المرتبطة بسجل معيّن - نفس
// القائمة بتُستخدم في تصدير PDF (محاولة تضمين كصور) وفي عمود
// "روابط الوسائط" بملف CSV (كنص/روابط كاملة قابلة للفتح لاحقاً -
// أنسب من محاولة تضمين فيديو داخل PDF نفسه، خصوصاً إن ملفات الفيديو
// أصلاً مش قابلة للتضمين كصورة ثابتة داخل مستند PDF)
// ============================================================

function collectRecordMediaUrls(record) {
  const urls = [];
  if (record._kind === 'ticket') {
    if (record.imageUrl) urls.push(record.imageUrl);
    if (Array.isArray(record.afterImages)) urls.push(...record.afterImages);
  } else if (record._kind === 'suggestion') {
    if (record.imageUrl) urls.push(record.imageUrl);
    if (Array.isArray(record.implementationImages)) urls.push(...record.implementationImages);
  }
  // سجلات الصيانة الوقائية (pm) مفيهاش صور حالياً في النموذج - لو
  // اتضافت مستقبلاً هتنضم هنا تلقائياً بنفس الطريقة
  return urls.filter(Boolean);
}

// ============================================================
// تصدير النتائج المفلترة الحالية كملف CSV (يفتح في Excel مباشرة)
// - بيصدّر بالظبط اللي المستخدم شايفه بعد آخر بحث/فلترة، ومحترم
//   لنفس نطاق الصلاحيات (allRecords أصلاً مفلترة من مصدر الجلب نفسه)
// ============================================================

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

window.exportMaintenanceSearchResults = function () {
  if (!lastFilteredList.length) {
    alert('لا توجد نتائج لتصديرها بالفلاتر الحالية');
    return;
  }

  const headers = [
    'النوع', 'الماكينة', 'الحالة', 'الأولوية', 'الوصف/الملاحظات',
    'بلّغ/الفني/مقدّم المقترح', 'مُسندة إلى', 'تاريخ الإنشاء', 'روابط الوسائط'
  ];

  const rows = lastFilteredList.map(r => {

    const mediaLinks = collectRecordMediaUrls(r).join(' | ');

    if (r._kind === 'ticket') {
      const status = String(r.status || '').toLowerCase();
      return [
        'بلاغ عطل',
        r.machine || '',
        STATUS_LABELS[status] || r.status || '',
        r.priority ? (PRIORITY_LABELS[r.priority] || r.priority) : '',
        r.description || '',
        r.reportedBy || '',
        r.assignedTo || '',
        r.createdAt || '',
        mediaLinks
      ];
    }

    if (r._kind === 'suggestion') {
      const status = String(r.status || 'new').toLowerCase();
      return [
        'مقترح كايزن',
        r.machine || '',
        SUGGESTION_STATUS_LABELS[status] || r.status || '',
        '',
        [r.title, r.problem].filter(Boolean).join(' - '),
        r.anonymous ? 'مجهول' : (r.name || ''),
        r.assignedTo || '',
        r.createdAt || '',
        mediaLinks
      ];
    }

    const checklist = r.checklist || {};
    const doneCount = [checklist.hydraulic, checklist.filters, checklist.lubrication].filter(Boolean).length;
    return [
      'صيانة وقائية',
      r.machine || '',
      `${doneCount}/3 بنود`,
      '',
      r.notes || '',
      r.reporter?.name || '',
      '',
      r.createdAt || '',
      mediaLinks
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  // BOM (\uFEFF) عشان Excel يفتح العربي صح من غير ترميز غريب
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maintenance-search-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ============================================================
// تصدير النتائج المفلترة الحالية كملف PDF احترافي (RTL) - نفس
// أسلوب التقرير الشهري الموجود فعلاً في ticketsBoard.js/kaizenBoard.js
// بالظبط (HTML عربي RTL خارج الشاشة → html2canvas → jsPDF)، مُنفَّذ
// هنا بشكل مستقل (بدون أي استيراد من الملفين) لنفس فلسفة المشروع في
// كل شاشة تانية. بيحترم نفس نطاق الصلاحيات والفلاتر لأنه بيصدّر
// lastFilteredList بالظبط - مفيش أي طلب Firestore إضافي هنا
// ============================================================

const PDF_PAGE_WIDTH_PX = 794; // عرض صفحة A4 تقريباً بدقة 96dpi

function formatPdfDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return iso || '-';
  }
}

/**
 * تحميل صورة من رابطها وضغطها قبل تضمينها في الـ PDF - بترجع null
 * بهدوء لو تعذر تحميلها (رابط فيديو/تعذر اتصال/CORS...) بدل ما توقف
 * التصدير كله؛ وده بالظبط اللي بيخلينا مش محتاجين نفرّق بين رابط
 * صورة أو فيديو يدوياً هنا - أي رابط مش قابل للعرض كصورة بيتجاهل
 * تلقائياً ويفضل متاح للمستخدم عبر عمود "روابط الوسائط" في CSV
 */
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

function buildPdfRecordBlockHtml(record, imageDataUrls, hasSkippedMedia) {

  const kind = record._kind;
  const kindLabel = kind === 'ticket' ? '🚨 بلاغ عطل' : kind === 'suggestion' ? '💡 مقترح كايزن' : '📝 صيانة وقائية';
  const titleText = kind === 'suggestion' ? (record.title || record.machine || '-') : (record.machine || record.machineName || '-');

  let statusLabel = '-';
  if (kind === 'ticket') {
    const status = String(record.status || '').toLowerCase();
    statusLabel = STATUS_LABELS[status] || record.status || '-';
  } else if (kind === 'suggestion') {
    const status = String(record.status || 'new').toLowerCase();
    statusLabel = SUGGESTION_STATUS_LABELS[status] || record.status || '-';
  } else {
    const checklist = record.checklist || {};
    const doneCount = [checklist.hydraulic, checklist.filters, checklist.lubrication].filter(Boolean).length;
    statusLabel = `${doneCount}/3 بنود`;
  }

  const descriptionText = record.description || record.problem || record.notes || '';

  const peopleLine = kind === 'ticket'
    ? `👤 بلّغ: ${escapeHtml(record.reportedBy || '-')} &nbsp;|&nbsp; 🛠️ مُسندة إلى: ${escapeHtml(record.assignedTo || '-')}`
    : kind === 'suggestion'
      ? `👤 مقدّم المقترح: ${escapeHtml(record.anonymous ? 'مجهول' : (record.name || '-'))} &nbsp;|&nbsp; 🔧 الفني: ${escapeHtml(record.assignedTo || '-')}`
      : `👤 الفني: ${escapeHtml(record.reporter?.name || '-')}`;

  const imagesHtml = imageDataUrls.length ? `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      ${imageDataUrls.map(src => `
        <img src="${src}" style="width:100px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" />
      `).join("")}
    </div>
  ` : "";

  // ملاحظة نصية (مش صورة) لو فيه روابط وسائط اتجاهلت أثناء التصدير
  // (مش قابلة للعرض كصورة ثابتة - زي الفيديو) عشان المستخدم يعرف إنه
  // يرجع لتصدير CSV لعمود "روابط الوسائط" لو محتاج يفتحها
  const skippedNoteHtml = hasSkippedMedia ? `
    <div style="font-size:10px; color:#b45309; margin-top:6px;">
      🎥 يوجد وسائط إضافية (فيديو/ملف) مرتبطة بهذا السجل - راجع تصدير CSV لروابطها الكاملة.
    </div>
  ` : "";

  return `
    <div style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:14px;">
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

}

window.exportMaintenanceSearchResultsPdf = async function () {

  if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
    alert("❌ مكتبات إنشاء PDF غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول تاني.");
    return;
  }

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

  let offscreen = null;

  try {

    // 1) تحميل/ضغط صور كل سجل (بحد أقصى 4 لكل سجل - نفس حد التقرير
    // الشهري الحالي - عشان الملف النهائي يفضل بحجم معقول)
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

    // 2) بناء محتوى الـ PDF كـ HTML خارج الشاشة (بالخط والاتجاه
    // العربي الطبيعي للمتصفح) عشان يترسم بشكل صحيح عند تحويله لصورة
    offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.top = "-99999px";
    offscreen.style.left = "0";
    offscreen.style.width = `${PDF_PAGE_WIDTH_PX}px`;
    offscreen.style.padding = "24px";
    offscreen.style.background = "#ffffff";
    offscreen.style.color = "#0f172a";
    offscreen.style.fontFamily = "Tahoma, Arial, sans-serif";
    offscreen.dir = "rtl";

    const role = getCurrentRole();
    const roleLabel = { admin: "مدير النظام", manager: "مدير الإنتاج", engineer: "مهندس" }[role] || "فني";

    offscreen.innerHTML = `
      <div style="text-align:center; margin-bottom:18px; border-bottom:2px solid #1d4ed8; padding-bottom:12px;">
        <div style="font-size:18px; font-weight:bold; color:#1d4ed8;">🔎 تقرير البحث والفلترة المتقدمة</div>
        <div style="font-size:11px; color:#475569; margin-top:6px;">
          تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")} &nbsp;|&nbsp;
          الصلاحية: ${escapeHtml(roleLabel)} &nbsp;|&nbsp; إجمالي النتائج: ${lastFilteredList.length}
        </div>
      </div>
      <div id="mPdfRecordsContainer"></div>
    `;

    offscreen.querySelector("#mPdfRecordsContainer").innerHTML =
      recordsWithImages.map(({ record, images, hasSkippedMedia }) =>
        buildPdfRecordBlockHtml(record, images, hasSkippedMedia)
      ).join("");

    document.body.appendChild(offscreen);

    // 3) تحويل المحتوى لصورة (Canvas) ثم تقسيمها على صفحات PDF -
    // نفس الأسلوب بالظبط المُستخدم في التقرير الشهري الحالي
    const canvas = await window.html2canvas(offscreen, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.72);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`maintenance-search-${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (error) {
    console.error("Error generating maintenance search PDF:", error);
    alert("❌ حدث خطأ أثناء إنشاء ملف PDF، حاول مرة أخرى.");
  } finally {
    if (offscreen && offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

};

// ============================================================
// كارت نتيجة - بلاغ عطل (نفس شكل/ألوان ticketsBoard.js)
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
// كارت نتيجة - مقترح كايزن (نفس فكرة شكل باقي الكروت، بألوان
// amber/purple المُستخدمة أصلاً في kaizenBoard.js لتمييز الكايزن)
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
