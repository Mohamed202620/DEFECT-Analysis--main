// ============================================================
// kaizenBoard.js
// لوحة متابعة الكايزن (مراجعة واعتماد المقترحات) - نفس تجربة
// لوحة متابعة البلاغات (ticketsBoard.js) من ناحية التصميم
// والـPagination، لكن منطقها مستقل بالكامل هنا ومفيهوش أي تعديل
// أو استيراد من ticketsBoard.js نفسه (فقط استخدام دوال مشتركة
// عامة زي permissions.js و services/api.js)
// ============================================================

import { getCurrentRole, getSuggestionActions } from './permissions.js';
import { openActionModal } from './components/ActionModal.js';

import {
  subscribeToSuggestionsBoardApi,
  fetchSuggestionsForReportApi,
  reviewSuggestionApi,
  rejectSuggestionApi,
  requestSuggestionRevisionApi,
  returnSuggestionToReviewApi,
  resubmitSuggestionApi,
  assignAndApproveSuggestionApi,
  implementSuggestionApi,
  fetchSuggestionLogsApi,
  fetchTechniciansApi
} from './services/api.js';

// ============================================================
// حالات الكايزن - المرحلة النهائية للـWorkflow (راجع
// services/suggestionsApi.js لتفاصيل الانتقالات المسموحة)
// ============================================================

const KAIZEN_STATUS_LABELS = {
  new: "جديد",
  under_review: "قيد المراجعة",
  in_progress: "قيد التنفيذ",
  revision_requested: "يحتاج تعديل",
  rejected: "مرفوض",
  implemented: "تم التنفيذ"
};

const KAIZEN_STATUS_CLASSES = {
  new: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  revision_requested: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  implemented: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
};

const KAIZEN_TABS = [
  { key: "all", label: "الكل" },
  { key: "new", label: "🆕 جديد" },
  { key: "under_review", label: "🔍 قيد المراجعة" },
  { key: "in_progress", label: "⚙️ قيد التنفيذ" },
  { key: "revision_requested", label: "✏️ يحتاج تعديل" },
  { key: "rejected", label: "❌ مرفوض" },
  { key: "implemented", label: "🏁 تم التنفيذ" }
];

// ============================================================
// كارت المقترح
// ============================================================

function suggestionCardHtml(suggestion) {

  const status = suggestion.status || "new";
  const displayName = suggestion.anonymous ? "🕶️ مقترح مجهول" : (suggestion.name || "-");

  // أزرار الإجراءات المتاحة فعلياً حسب الحالة الحالية والدور (أدمن
  // فقط للمراجعة/الموافقة/الرفض/طلب التعديل، والفني المسؤول المُسند
  // إليه فقط لتسجيل التنفيذ) - راجع getSuggestionActions في permissions.js
  const suggestionActions = getSuggestionActions(suggestion).filter(a => a.key !== "details");

  const statusChangeHtml = suggestionActions.length ? `
    <div class="flex flex-wrap gap-1.5 pt-2 border-t border-gray-800 mt-2">
      ${suggestionActions.map(a => `
        <button
          onclick="window.handleKaizenAction('${suggestion.id}', '${a.key}')"
          class="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 bg-[#0E1117] border-gray-700 text-gray-300 hover:border-blue-500/50 hover:text-blue-400">
          ${a.label}
        </button>
      `).join("")}
    </div>
  ` : "";

  // معلومات إضافية عن آخر إجراء تم اتخاذه (سبب الرفض / ملاحظات طلب
  // التعديل / الفني المسؤول) - تظهر في الكارت لو موجودة
  const extraInfoHtml = `
    ${suggestion.assignedTo ? `
      <div class="text-[11px] bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 text-purple-300">
        🔧 الفني المسؤول: ${suggestion.assignedTo}
      </div>
    ` : ""}
    ${suggestion.revisionNotes && status === "revision_requested" ? `
      <div class="text-[11px] bg-orange-500/5 border border-orange-500/20 rounded-lg p-2 text-orange-300">
        ✏️ ملاحظات طلب التعديل: ${suggestion.revisionNotes}
      </div>
    ` : ""}
    ${suggestion.rejectionReason && status === "rejected" ? `
      <div class="text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-2 text-red-300">
        ❌ سبب الرفض: ${suggestion.rejectionReason}
      </div>
    ` : ""}
  `;

  const imageHtml = suggestion.imageUrl ? `
    <img src="${suggestion.imageUrl}" class="w-full max-h-40 object-cover rounded-lg border border-gray-800 mt-2" />
  ` : "";

  // زر "التفاصيل" - يفتح Modal للعرض فقط (بدون أي تعديل على الحالة
  // أو الصلاحيات)، ويعتمد على بيانات المقترح المخزَّنة أصلاً في
  // kaizenItemsById بدل تمريرها داخل الـ HTML نفسه
  const detailsButtonHtml = `
    <button
      onclick="window.openKaizenSuggestionDetails('${suggestion.id}')"
      class="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg border border-gray-700 bg-[#0E1117] text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all active:scale-95">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>التفاصيل</span>
    </button>
  `;

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-2 mb-3">
      <div class="flex justify-between items-center">
        <span class="font-bold text-sm text-gray-100">${suggestion.title || "-"}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${KAIZEN_STATUS_CLASSES[status] || "bg-gray-500/10 text-gray-400"}">
          ${KAIZEN_STATUS_LABELS[status] || status}
        </span>
      </div>

      ${suggestion.problem ? `<p class="text-xs text-gray-400">${suggestion.problem}</p>` : ""}

      ${suggestion.solution ? `
        <div class="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-emerald-300">
          💡 الحل المقترح: ${suggestion.solution}
        </div>
      ` : ""}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span>👤 ${displayName}</span>
        ${suggestion.line ? `<span>🏭 ${suggestion.line}</span>` : ""}
        ${suggestion.machine ? `<span>⚙️ ${suggestion.machine}</span>` : ""}
        ${suggestion.category ? `<span>🏷️ ${suggestion.category}</span>` : ""}
      </div>

      ${extraInfoHtml}
      ${imageHtml}
      ${detailsButtonHtml}
      ${statusChangeHtml}
    </div>
  `;

}

// ============================================================
// حد أقصى 60 مقترح (بعد فلترة الصلاحيات) + Pagination محلي
// 20 مقترح/صفحة × 3 صفحات كحد أقصى = 60
// ============================================================

const MAX_KAIZEN_ITEMS = 60;
const KAIZEN_PAGE_SIZE = 20;
const KAIZEN_MAX_PAGES = 3;

let kaizenCurrentPage = 1;
let kaizenCurrentStatusFilter = "all";
let kaizenCappedItems = [];
let unsubscribeKaizenListener = null;

// خريطة id → بيانات المقترح الكاملة، تُستخدم فقط لعرض تفاصيل
// المقترح داخل الـ Modal (بدل تمرير كل البيانات داخل الـ HTML)
let kaizenItemsById = {};

function renderKaizenTabs() {

  const container = document.getElementById("kaizenTabsContainer");
  if (!container) return;

  container.innerHTML = KAIZEN_TABS.map(tab => `
    <button
      onclick="window.setKaizenStatusFilter('${tab.key}')"
      class="shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
        kaizenCurrentStatusFilter === tab.key
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-[#1E293B] border-gray-800 text-gray-400 hover:border-gray-700"
      }">
      ${tab.label}
    </button>
  `).join("");

}

function renderKaizenPage() {

  const container = document.getElementById("kaizenBoardContainer");
  if (!container) return;

  const totalPages = Math.min(
    KAIZEN_MAX_PAGES,
    Math.max(1, Math.ceil(kaizenCappedItems.length / KAIZEN_PAGE_SIZE))
  );
  if (kaizenCurrentPage > totalPages) kaizenCurrentPage = totalPages;
  if (kaizenCurrentPage < 1) kaizenCurrentPage = 1;

  const pageStart = (kaizenCurrentPage - 1) * KAIZEN_PAGE_SIZE;
  const pageItems = kaizenCappedItems.slice(pageStart, pageStart + KAIZEN_PAGE_SIZE);

  const bannerHtml = `
    <div class="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 mb-3">
      ℹ️ يتم عرض آخر ${MAX_KAIZEN_ITEMS} مقترح فقط.
    </div>
  `;

  const listHtml = pageItems.length
    ? pageItems.map(suggestionCardHtml).join("")
    : `<div class="text-center text-gray-500 text-xs py-8">لا توجد مقترحات حالياً في قائمتك.</div>`;

  const paginationHtml = totalPages > 1 ? `
    <div class="flex items-center justify-center gap-1.5 pt-3">
      <button
        onclick="window.setKaizenPage(${kaizenCurrentPage - 1})"
        ${kaizenCurrentPage <= 1 ? "disabled" : ""}
        class="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-800 transition-all ${
          kaizenCurrentPage <= 1 ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:border-gray-700 active:scale-95"
        }">السابق</button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
        <button
          onclick="window.setKaizenPage(${p})"
          class="w-7 h-7 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
            p === kaizenCurrentPage ? "bg-blue-600 border-blue-600 text-white" : "border-gray-800 text-gray-400 hover:border-gray-700"
          }">${p}</button>
      `).join("")}
      <button
        onclick="window.setKaizenPage(${kaizenCurrentPage + 1})"
        ${kaizenCurrentPage >= totalPages ? "disabled" : ""}
        class="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-800 transition-all ${
          kaizenCurrentPage >= totalPages ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:border-gray-700 active:scale-95"
        }">التالي</button>
    </div>
  ` : "";

  container.innerHTML = bannerHtml + listHtml + paginationHtml;

}

/**
 * تحميل لوحة الكايزن - تحميل تلقائي عند فتح الصفحة (يُستدعى من
 * renderCore.js)، تطبيق فلترة الصلاحيات أولاً (داخل
 * subscribeToSuggestionsBoardApi) ثم أخذ آخر 60 مقترح مرتبة
 * (الأحدث أولاً) وتقسيمها Pagination محلي
 */
window.loadKaizenBoard = function () {

  renderKaizenTabs();
  kaizenCurrentPage = 1;

  const container = document.getElementById("kaizenBoardContainer");
  if (!container) return;

  if (typeof unsubscribeKaizenListener === "function") {
    unsubscribeKaizenListener();
    unsubscribeKaizenListener = null;
  }

  const role = getCurrentRole();
  const myName = localStorage.getItem("name") || "";

  container.innerHTML = `
    <div class="text-center text-gray-400 text-xs py-8">جاري تحميل المقترحات...</div>
  `;

  unsubscribeKaizenListener = subscribeToSuggestionsBoardApi(
    { role, myName, status: kaizenCurrentStatusFilter },
    (result) => {

      if (!result || result.status !== "success") {
        console.error("Kaizen subscription error:", result?.message);
        container.innerHTML = `
          <div class="text-red-400 text-center text-xs py-6">
            تعذر تحميل المقترحات حالياً. حاول مرة أخرى، ولو استمرت المشكلة تواصل مع الأدمن.
          </div>
        `;
        return;
      }

      const items = Array.isArray(result.data) ? result.data : [];
      kaizenCappedItems = items.slice(0, MAX_KAIZEN_ITEMS);

      kaizenItemsById = {};
      kaizenCappedItems.forEach(item => { kaizenItemsById[item.id] = item; });

      renderKaizenPage();

    }
  );

};

/**
 * تغيير تبويب فلتر الحالة
 */
window.setKaizenStatusFilter = function (status) {

  if (status === kaizenCurrentStatusFilter) return;

  kaizenCurrentStatusFilter = status;
  window.loadKaizenBoard();

};

/**
 * التنقل بين صفحات لوحة الكايزن (Pagination محلي - بدون أي طلب
 * إضافي لـ Firestore)
 */
window.setKaizenPage = function (page) {

  const totalPages = Math.min(
    KAIZEN_MAX_PAGES,
    Math.max(1, Math.ceil(kaizenCappedItems.length / KAIZEN_PAGE_SIZE))
  );

  if (page < 1 || page > totalPages || page === kaizenCurrentPage) return;

  kaizenCurrentPage = page;
  renderKaizenPage();

};

/**
 * تنفيذ إجراء على مقترح كايزن - كل إجراء بيتحقق من الصلاحية والحالة
 * الحالية بنفسه (راجع services/suggestionsApi.js) - الأزرار أصلاً
 * ميظهرش غير الإجراء المسموح به فعلياً لكل مستخدم (getSuggestionActions)
 * لكن التحقق الحقيقي غير القابل للالتفاف حوله موجود في الـAPI/logic
 * و firestore.rules، مش في الواجهة بس
 */
window.handleKaizenAction = async function (suggestionId, action) {

  if (action === "details") {
    window.openKaizenSuggestionDetails(suggestionId);
    return;
  }

  let result;

  if (action === "review") {

    result = await reviewSuggestionApi(suggestionId);

  } else if (action === "reject") {

    const values = await openActionModal({
      title: "❌ رفض مقترح الكايزن",
      submitLabel: "رفض",
      fields: [
        { id: "reason", label: "سبب الرفض", type: "textarea", placeholder: "اذكر سبب الرفض...", required: true }
      ]
    });

    if (!values || !values.reason) return;

    result = await rejectSuggestionApi(suggestionId, values.reason);

  } else if (action === "request_revision") {

    const values = await openActionModal({
      title: "✏️ طلب تعديل على المقترح",
      submitLabel: "إرسال طلب التعديل",
      fields: [
        { id: "notes", label: "ملاحظات التعديل المطلوب", type: "textarea", placeholder: "وضّح المطلوب تعديله...", required: true }
      ]
    });

    if (!values || !values.notes) return;

    result = await requestSuggestionRevisionApi(suggestionId, values.notes);

  } else if (action === "return_to_review") {

    result = await returnSuggestionToReviewApi(suggestionId);

  } else if (action === "resubmit") {

    // صاحب المقترح يعدّل المحتوى فعلياً قبل إعادة الإرسال - الحقول
    // مُعبّأة مسبقاً بالقيم الحالية (defaultValue) عشان يعدّل عليها
    // مش يكتبها من الصفر - نفس مصدر البيانات المُستخدَم فعلياً في
    // نافذة التفاصيل (kaizenItemsById، البيانات المعروضة أصلاً باللوحة)
    const current = kaizenItemsById[suggestionId];
    if (!current) {
      alert("❌ تعذّر جلب بيانات المقترح، حاول مرة أخرى.");
      return;
    }

    const values = await openActionModal({
      title: "✏️ تعديل المقترح وإعادة الإرسال",
      submitLabel: "إعادة الإرسال للمراجعة",
      fields: [
        { id: "title", label: "عنوان المقترح", type: "text", required: true, defaultValue: current.title || "" },
        { id: "problem", label: "المشكلة الحالية", type: "textarea", required: true, defaultValue: current.problem || "" },
        { id: "solution", label: "الحل المقترح", type: "textarea", required: true, defaultValue: current.solution || "" }
      ]
    });

    if (!values) return;

    result = await resubmitSuggestionApi(suggestionId, values);

  } else if (action === "approve_assign") {

    const techResult = await fetchTechniciansApi();
    const technicians = techResult.status === "success" ? techResult.data : [];

    if (!technicians.length) {
      alert("⚠️ لا يوجد فنيون/مهندسون نشطون حالياً لإسناد المقترح لهم.");
      return;
    }

    const values = await openActionModal({
      title: "✅ موافقة وإسناد المقترح",
      submitLabel: "موافقة وإسناد",
      fields: [
        {
          id: "assignedTo",
          label: "إسناد إلى (الفني المسؤول)",
          type: "select",
          options: technicians.map(t => ({ value: `${t.id}::${t.name}`, label: `${t.name} (${t.role})` }))
        }
      ]
    });

    if (!values) return;

    const [assignedToUid, assignedTo] = (values.assignedTo || "").split("::");
    if (!assignedTo) return;

    result = await assignAndApproveSuggestionApi(suggestionId, { assignedTo, assignedToUid });

  } else if (action === "implement") {

    const values = await openActionModal({
      title: "🏁 تسجيل اكتمال تنفيذ المقترح",
      submitLabel: "تم التنفيذ",
      fields: [
        { id: "notes", label: "ملاحظة التنفيذ (اختياري)", type: "textarea", placeholder: "وصف مختصر لما تم تنفيذه..." },
        { id: "afterImages", label: "صورة بعد التنفيذ (اختياري)", type: "images" }
      ]
    });

    if (!values) return;

    result = await implementSuggestionApi(suggestionId, values.notes, values.afterImages);

  } else {
    return;
  }

  if (result?.status !== "success") {
    alert("❌ " + (result?.message || "حدث خطأ أثناء تنفيذ الإجراء، حاول مرة أخرى."));
  }
  // التحديث بيوصل تلقائياً عبر الاشتراك اللحظي (onSnapshot)

};

/**
 * إيقاف المستمع عند مغادرة الصفحة (يُستدعى من renderCore.js)
 */
window.cleanupKaizenBoard = function () {

  if (typeof unsubscribeKaizenListener === "function") {
    unsubscribeKaizenListener();
    unsubscribeKaizenListener = null;
  }

  if (typeof window.closeKaizenSuggestionDetails === "function") {
    window.closeKaizenSuggestionDetails();
  }

};

// ============================================================
// Modal تفاصيل المقترح - عرض فقط (خطوة 1)
// لا يعدّل أي حالة/صلاحية/Workflow، فقط يعرض بيانات المقترح
// الكاملة بشكل واضح فوق نفس اللوحة، بنفس ألوان وتنسيق باقي
// مكونات لوحة الكايزن (Dark + RTL + Responsive)
// ============================================================

/**
 * تنسيق تاريخ ووقت المقترح لعرضه داخل الـ Modal (عربي، مفصّل أكتر
 * من التاريخ المختصر المستخدم في التقرير الشهري)
 */
function formatKaizenDetailsDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch (error) {
    return iso;
  }
}

/**
 * صف واحد من صفوف تفاصيل المقترح داخل الـ Modal - بيتجاهل نفسه
 * تلقائياً لو مفيش قيمة (زي حالة "الماكينة إن وجدت")
 */
function kaizenDetailRowHtml(icon, label, value) {
  if (!value) return "";
  return `
    <div class="flex gap-2.5 items-start py-2.5 border-b border-gray-800/70 last:border-b-0">
      <span class="text-sm shrink-0 mt-0.5">${icon}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-bold text-gray-500 mb-0.5">${label}</div>
        <div class="text-xs text-gray-100 leading-relaxed break-words whitespace-pre-line">${value}</div>
      </div>
    </div>
  `;
}

function buildKaizenDetailsModalHtml(suggestion) {

  const status = suggestion.status || "new";
  const displayName = suggestion.anonymous ? "🕶️ مقترح مجهول" : (suggestion.name || "-");

  const imageHtml = suggestion.imageUrl ? `
    <div class="pt-1">
      <div class="text-[10px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
        <span>🖼️</span> الصورة المرفقة
      </div>
      <img src="${suggestion.imageUrl}" class="w-full max-h-64 object-cover rounded-xl border border-gray-800" />
    </div>
  ` : "";

  const implementationImagesHtml = (suggestion.implementationImages || []).length ? `
    <div class="pt-2">
      <div class="text-[10px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
        <span>🏁</span> صور بعد التنفيذ
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        ${suggestion.implementationImages.map(url => `
          <img src="${url}" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
        `).join("")}
      </div>
    </div>
  ` : "";

  return `
    <div
      id="kaizenDetailsModalOverlay"
      class="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onclick="if (event.target === this) window.closeKaizenSuggestionDetails()"
    >
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl">

        <!-- Header -->
        <div class="flex items-start justify-between gap-2 p-4 border-b border-gray-800 shrink-0">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1">
              <span>💡</span> تفاصيل مقترح الكايزن
            </div>
            <h3 class="text-sm font-bold text-gray-100 break-words">${suggestion.title || "-"}</h3>
          </div>
          <button
            onclick="window.closeKaizenSuggestionDetails()"
            aria-label="إغلاق"
            class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[#0E1117] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95">
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-4 space-y-0.5">

          <div class="flex items-center justify-between pb-2.5 mb-1 border-b border-gray-800/70">
            <span class="text-[10px] font-bold text-gray-500">الحالة الحالية</span>
            <span class="text-[10px] px-2.5 py-1 rounded-full font-bold ${KAIZEN_STATUS_CLASSES[status] || "bg-gray-500/10 text-gray-400"}">
              ${KAIZEN_STATUS_LABELS[status] || status}
            </span>
          </div>

          ${kaizenDetailRowHtml("⚠️", "المشكلة الحالية", suggestion.problem)}
          ${kaizenDetailRowHtml("💡", "الحل المقترح", suggestion.solution)}
          ${kaizenDetailRowHtml("🏢", "القسم", suggestion.department)}
          ${kaizenDetailRowHtml("🏭", "خط الإنتاج", suggestion.line)}
          ${kaizenDetailRowHtml("⚙️", "الماكينة", suggestion.machine)}
          ${kaizenDetailRowHtml("🏷️", "تصنيف التحسين", suggestion.category)}
          ${kaizenDetailRowHtml("👤", "مقدم المقترح", displayName)}
          ${kaizenDetailRowHtml("📅", "التاريخ", formatKaizenDetailsDate(suggestion.createdAt))}
          ${kaizenDetailRowHtml("🔧", "الفني المسؤول", suggestion.assignedTo)}
          ${kaizenDetailRowHtml("✏️", "ملاحظات طلب التعديل", suggestion.revisionNotes)}
          ${kaizenDetailRowHtml("❌", "سبب الرفض", suggestion.rejectionReason)}
          ${kaizenDetailRowHtml("🏁", "ملاحظات التنفيذ", suggestion.implementationNotes)}
          ${kaizenDetailRowHtml("🕒", "آخر تحديث", suggestion.updatedBy ? `${suggestion.updatedBy} - ${formatKaizenDetailsDate(suggestion.updatedAt)}` : "")}

          ${imageHtml}
          ${implementationImagesHtml}

          <!-- السجل الزمني (Timeline) - يُملأ لاحقاً بشكل غير متزامن
          عبر fetchSuggestionLogsApi، من غير ما يعطّل ظهور باقي
          التفاصيل فوراً -->
          <div class="pt-3 mt-2 border-t border-gray-800">
            <div class="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
              <span>🕘</span> السجل الزمني للإجراءات
            </div>
            <div id="kaizenTimelineContainer" class="text-[11px] text-gray-500">
              جاري تحميل السجل...
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-gray-800 shrink-0">
          <button
            onclick="window.closeKaizenSuggestionDetails()"
            class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs font-bold text-gray-300 hover:border-gray-600 transition-all active:scale-95">
            إغلاق
          </button>
        </div>

      </div>
    </div>
  `;

}

function handleKaizenDetailsEscape(event) {
  if (event.key === "Escape") window.closeKaizenSuggestionDetails();
}

// تسمية عربية واضحة لكل نوع إجراء مسجَّل في الـlogs
const KAIZEN_LOG_ACTION_LABELS = {
  review: "بدء المراجعة",
  reject: "رفض المقترح",
  request_revision: "طلب تعديل",
  return_to_review: "إعادة للمراجعة (بواسطة الأدمن)",
  resubmit: "تعديل وإعادة الإرسال (بواسطة صاحب المقترح)",
  approve_assign: "موافقة وإسناد لفني",
  implement: "تسجيل اكتمال التنفيذ"
};

/**
 * تحميل وعرض السجل الزمني لمقترح (من نفّذ كل إجراء ومتى) داخل
 * نافذة التفاصيل - قراءة فقط، مفيش أي تعديل هنا
 */
async function loadAndRenderKaizenTimeline(suggestionId) {
  const container = document.getElementById("kaizenTimelineContainer");
  if (!container) return;

  const result = await fetchSuggestionLogsApi(suggestionId);

  // المستخدم ممكن يكون قفل الـ Modal قبل ما الطلب يخلص
  const stillOpen = document.getElementById("kaizenTimelineContainer");
  if (!stillOpen) return;

  if (result.status !== "success" || !result.data.length) {
    stillOpen.innerHTML = `<div class="text-[11px] text-gray-600">لا يوجد سجل إجراءات بعد.</div>`;
    return;
  }

  stillOpen.innerHTML = result.data.map(log => `
    <div class="flex gap-2 items-start py-1.5 border-b border-gray-800/50 last:border-b-0">
      <span class="text-xs shrink-0 mt-0.5">•</span>
      <div class="min-w-0 flex-1">
        <div class="text-[11px] text-gray-200 font-bold">
          ${KAIZEN_LOG_ACTION_LABELS[log.action] || log.action}
        </div>
        <div class="text-[10px] text-gray-500">
          بواسطة ${log.by || "-"} (${log.byRole || "-"}) - ${formatKaizenDetailsDate(log.at)}
        </div>
        ${log.note ? `<div class="text-[10px] text-gray-400 mt-0.5 whitespace-pre-line">${log.note}</div>` : ""}
      </div>
    </div>
  `).join("");
}

/**
 * فتح Modal تفاصيل المقترح - عرض فقط، بيقرأ البيانات من
 * kaizenItemsById (نفس البيانات المعروضة أصلاً في الكارت/اللوحة،
 * بدون أي طلب إضافي لـ Firestore وبدون أي تعديل على الحالة) -
 * السجل الزمني وحده بيتحمّل بشكل غير متزامن (Async) من الـlogs
 */
window.openKaizenSuggestionDetails = function (suggestionId) {

  const suggestion = kaizenItemsById[suggestionId];
  if (!suggestion) return;

  let root = document.getElementById("kaizenDetailsModalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "kaizenDetailsModalRoot";
    document.body.appendChild(root);
  }

  root.innerHTML = buildKaizenDetailsModalHtml(suggestion);
  document.addEventListener("keydown", handleKaizenDetailsEscape);

  loadAndRenderKaizenTimeline(suggestionId);

};

/**
 * إغلاق Modal تفاصيل المقترح
 */
window.closeKaizenSuggestionDetails = function () {

  const root = document.getElementById("kaizenDetailsModalRoot");
  if (root) root.innerHTML = "";
  document.removeEventListener("keydown", handleKaizenDetailsEscape);

};

// ============================================================
// التقرير الشهري (PDF) - آخر 30 يوم، بنفس صلاحيات المستخدم
// (منطق مستقل، لكن بنفس أسلوب التقرير الشهري لصفحة متابعة
// البلاغات: HTML عربي RTL خارج الشاشة → html2canvas → jsPDF)
// ============================================================

const KAIZEN_REPORT_DAYS = 30;
const KAIZEN_REPORT_PAGE_WIDTH_PX = 794; // عرض صفحة A4 تقريباً بدقة 96dpi

function formatKaizenReportDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch (error) {
    return iso || "-";
  }
}

function escapeKaizenReportHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * تحميل صورة من رابطها وضغطها قبل تضمينها في التقرير - نفس فكرة
 * الدالة المستخدمة في تقرير البلاغات، مُعرَّفة هنا بشكل مستقل
 */
async function loadKaizenImageAsCompressedDataUrl(url, maxDim = 480, quality = 0.55) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذر فك ترميز الصورة"));
      el.src = objectUrl;
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
    console.warn("تعذر تحميل/ضغط صورة لتقرير الكايزن:", url, error);
    return null;
  }
}

function buildKaizenReportBlockHtml(suggestion, imageDataUrl) {

  const status = suggestion.status || "new";
  const displayName = suggestion.anonymous ? "مجهول" : (suggestion.name || "-");

  const imageHtml = imageDataUrl ? `
    <div style="margin-top:8px;">
      <img src="${imageDataUrl}" style="width:140px; height:140px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" />
    </div>
  ` : "";

  return `
    <div style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:bold; font-size:13px; color:#0f172a;">${escapeKaizenReportHtml(suggestion.title || "-")}</span>
        <span style="font-size:11px; padding:2px 10px; border-radius:10px; background:#e2e8f0; color:#334155;">
          ${escapeKaizenReportHtml(KAIZEN_STATUS_LABELS[status] || status)}
        </span>
      </div>
      <div style="font-size:11px; color:#475569; margin-bottom:6px;">
        📅 ${formatKaizenReportDate(suggestion.createdAt)} &nbsp;|&nbsp;
        👤 مقدّم المقترح: ${escapeKaizenReportHtml(displayName)} &nbsp;|&nbsp;
        🏷️ ${escapeKaizenReportHtml(suggestion.category || "-")}
      </div>
      ${suggestion.problem ? `<div style="font-size:11px; color:#1e293b; margin-bottom:6px;"><b>المشكلة:</b> ${escapeKaizenReportHtml(suggestion.problem)}</div>` : ""}
      ${suggestion.solution ? `<div style="font-size:11px; color:#065f46; margin-bottom:6px;"><b>الحل المقترح:</b> ${escapeKaizenReportHtml(suggestion.solution)}</div>` : ""}
      ${suggestion.assignedTo ? `<div style="font-size:11px; color:#6d28d9; margin-bottom:6px;"><b>الفني المسؤول:</b> ${escapeKaizenReportHtml(suggestion.assignedTo)}</div>` : ""}
      ${suggestion.revisionNotes ? `<div style="font-size:11px; color:#c2410c; margin-bottom:6px;"><b>ملاحظات طلب التعديل:</b> ${escapeKaizenReportHtml(suggestion.revisionNotes)}</div>` : ""}
      ${suggestion.rejectionReason ? `<div style="font-size:11px; color:#b91c1c; margin-bottom:6px;"><b>سبب الرفض:</b> ${escapeKaizenReportHtml(suggestion.rejectionReason)}</div>` : ""}
      ${suggestion.updatedBy ? `<div style="font-size:10px; color:#94a3b8;">آخر تحديث بواسطة: ${escapeKaizenReportHtml(suggestion.updatedBy)} - ${formatKaizenReportDate(suggestion.updatedAt)}</div>` : ""}
      ${imageHtml}
    </div>
  `;

}

window.generateKaizenMonthlyReport = async function () {

  if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
    alert("❌ مكتبات إنشاء التقرير غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول تاني.");
    return;
  }

  const btn = document.getElementById("kaizenReportBtn");
  const originalLabel = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري تجهيز التقرير...";
  }

  let offscreen = null;

  try {

    const role = getCurrentRole();
    const myName = localStorage.getItem("name") || "";

    const since = new Date();
    since.setDate(since.getDate() - KAIZEN_REPORT_DAYS);

    const result = await fetchSuggestionsForReportApi({
      role, myName, sinceISO: since.toISOString()
    });

    if (result.status !== "success") {
      alert("❌ تعذر تجهيز بيانات التقرير، حاول مرة أخرى.");
      return;
    }

    const suggestions = result.data;

    if (!suggestions.length) {
      alert("ℹ️ لا توجد مقترحات كايزن خلال آخر 30 يوم لعرضها في التقرير.");
      return;
    }

    // تحميل وضغط صورة كل مقترح (إن وُجدت)
    const itemsWithImages = [];
    for (const suggestion of suggestions) {
      const dataUrl = suggestion.imageUrl
        ? await loadKaizenImageAsCompressedDataUrl(suggestion.imageUrl)
        : null;
      itemsWithImages.push({ suggestion, dataUrl });
    }

    offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.top = "-99999px";
    offscreen.style.left = "0";
    offscreen.style.width = `${KAIZEN_REPORT_PAGE_WIDTH_PX}px`;
    offscreen.style.padding = "24px";
    offscreen.style.background = "#ffffff";
    offscreen.style.color = "#0f172a";
    offscreen.style.fontFamily = "Tahoma, Arial, sans-serif";
    offscreen.dir = "rtl";

    const roleLabel = { admin: "مدير النظام", manager: "مدير الإنتاج" }[role] || "فني/مهندس";

    offscreen.innerHTML = `
      <div style="text-align:center; margin-bottom:18px; border-bottom:2px solid #d97706; padding-bottom:12px;">
        <div style="font-size:18px; font-weight:bold; color:#d97706;">💡 التقرير الشهري لمقترحات الكايزن</div>
        <div style="font-size:11px; color:#475569; margin-top:6px;">
          الفترة: آخر ${KAIZEN_REPORT_DAYS} يوم &nbsp;|&nbsp; تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")} &nbsp;|&nbsp;
          الصلاحية: ${escapeKaizenReportHtml(roleLabel)} &nbsp;|&nbsp; إجمالي المقترحات: ${suggestions.length}
        </div>
      </div>
      <div id="kaizenReportItemsContainer"></div>
    `;

    offscreen.querySelector("#kaizenReportItemsContainer").innerHTML =
      itemsWithImages.map(({ suggestion, dataUrl }) => buildKaizenReportBlockHtml(suggestion, dataUrl)).join("");

    document.body.appendChild(offscreen);

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

    pdf.save(`تقرير-كايزن-شهري-${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (error) {
    console.error("Error generating kaizen monthly report:", error);
    alert("❌ حدث خطأ أثناء إنشاء التقرير، حاول مرة أخرى.");
  } finally {
    if (offscreen && offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

};
