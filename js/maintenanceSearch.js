// ============================================================
// maintenanceSearch.js
// منطق صفحة "البحث والفلترة المتقدمة" (maintenanceSearch)
// - يجمع بلاغات الأعطال (tickets) وسجلات الصيانة الوقائية
//   (pmRecords) في مصفوفة واحدة موحّدة
// - يطبّق نفس منطق الصلاحيات المستخدم أصلاً في لوحة متابعة
//   البلاغات (subscribeToTicketsBoardApi في ticketsApi.js):
//   admin/manager يشوفوا كل شيء، أي دور تاني يشوف بس السجلات
//   المرتبطة بيه (بلّغ بيها / مُسندة إليه / سجّلها بنفسه)
// - بحث نصي + فلاتر (نوع السجل/الحالة/الأولوية/الماكينة) + ترتيب
// نفس أسلوب knowledgeBase.js تماماً (حالة موديول + دوال window.*)
// ============================================================

import { getCurrentRole } from './permissions.js';
import { fetchTicketsApi, fetchPmRecordsApi } from './services/api.js';
import { openTicketDetailsModal } from './components/TicketDetailsModal.js';

// ============================================================
// حالة الموديول
// ============================================================

let allRecords = [];     // كل السجلات (بلاغات + PM) بعد تطبيق نطاق الصلاحيات
let isLoaded = false;
let currentType = 'all'; // all | ticket | pm

const TYPE_META = {
  all: { activeClass: 'bg-blue-500/15 border-blue-500/50 text-blue-300' },
  ticket: { activeClass: 'bg-red-500/15 border-red-500/50 text-red-300' },
  pm: { activeClass: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' }
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

function el(id) {
  return document.getElementById(id);
}

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
  const isFullAccess = role === 'admin' || role === 'manager';

  const [ticketsResult, pmResult] = await Promise.all([
    fetchTicketsApi(),
    fetchPmRecordsApi()
  ]);

  const tickets = (ticketsResult.status === 'success' && Array.isArray(ticketsResult.data))
    ? ticketsResult.data : [];
  const pmRecords = (pmResult.status === 'success' && Array.isArray(pmResult.data))
    ? pmResult.data : [];

  // تطبيق نطاق الصلاحيات: admin/manager يشوفوا الكل، غيرهم يشوفوا
  // بس السجلات المرتبطة بيهم فعلاً (نفس فكرة subscribeToTicketsBoardApi)
  const scopedTickets = isFullAccess
    ? tickets
    : tickets.filter(t =>
        (!!myUid && (t.reportedByUid === myUid || t.assignedToUid === myUid)) ||
        (!!myName && (t.reportedBy === myName || t.assignedTo === myName))
      );

  const scopedPm = isFullAccess
    ? pmRecords
    : pmRecords.filter(p => !!myName && p.reporter?.name === myName);

  allRecords = [
    ...scopedTickets.map(t => ({ ...t, _kind: 'ticket' })),
    ...scopedPm.map(p => ({ ...p, _kind: 'pm' }))
  ];

  isLoaded = true;

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
      'm-type-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ' +
      (isActive ? TYPE_META[type].activeClass : INACTIVE_CLASS);
  });

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
// بناء وعرض النتائج المفلترة
// ============================================================

function renderResults() {

  const box = el('mResultsBox');
  const summaryBox = el('mResultsSummary');
  if (!box) return;

  if (!isLoaded) return;

  const searchTerm = (el('mSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = el('mStatusFilter')?.value || 'all';
  const priorityFilter = el('mPriorityFilter')?.value || 'all';
  const machineFilter = el('mMachineFilter')?.value || 'all';
  const sortOrder = el('mSortFilter')?.value || 'newest';

  let list = [...allRecords];

  if (currentType !== 'all') {
    list = list.filter(r => r._kind === currentType);
  }

  if (statusFilter !== 'all') {
    // الحالة مفهوم خاص ببلاغات الأعطال فقط - سجلات الـ PM بتُستبعد
    // تلقائياً لو تم اختيار فلتر حالة مُحدد
    list = list.filter(r => r._kind === 'ticket' && String(r.status || '').toLowerCase() === statusFilter);
  }

  if (priorityFilter !== 'all') {
    list = list.filter(r => r._kind === 'ticket' && r.priority === priorityFilter);
  }

  if (machineFilter !== 'all') {
    list = list.filter(r => (r.machine || '') === machineFilter);
  }

  if (searchTerm) {
    list = list.filter(r => {
      const haystack = [
        r.machine, r.line, r.description, r.notes, r.locationInMachine,
        r.reportedBy, r.assignedTo, r.reporter?.name, r.category, r.mechanicNotes
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  list.sort((a, b) => {
    const diff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return sortOrder === 'oldest' ? -diff : diff;
  });

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

  box.innerHTML = list.map(r => r._kind === 'ticket' ? ticketResultCard(r) : pmResultCard(r)).join('');
}

// ============================================================
// كارت نتيجة - بلاغ عطل (نفس شكل/ألوان ticketsBoard.js)
// ============================================================

function ticketResultCard(t) {
  const status = String(t.status || '').trim().toLowerCase();
  const machineName = t.machine || t.machineName || '-';

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3 space-y-2 text-xs">
      <div class="flex justify-between items-center">
        <span class="font-bold text-gray-100 flex items-center gap-1.5">
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">🚨 بلاغ</span>
          ${machineName}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASSES[status] || 'bg-gray-500/10 text-gray-400'}">
          ${STATUS_LABELS[status] || status || '-'}
        </span>
      </div>

      ${t.description ? `<p class="text-[11px] text-gray-400">${t.description}</p>` : ''}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${t.priority ? `<span>${PRIORITY_LABELS[t.priority] || t.priority}</span>` : ''}
        ${t.reportedBy ? `<span>👤 بلّغ: ${t.reportedBy}</span>` : ''}
        ${t.assignedTo ? `<span>🛠️ مُسندة إلى: ${t.assignedTo}</span>` : ''}
        ${t.createdAt ? `<span>🕓 ${new Date(t.createdAt).toLocaleDateString('ar-EG')}</span>` : ''}
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
          ${p.machine || '-'}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ✅ ${doneCount}/3 بنود
        </span>
      </div>

      ${p.notes ? `<p class="text-[11px] text-gray-400">${p.notes}</p>` : ''}

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${p.reporter?.name ? `<span>👤 الفني: ${p.reporter.name}</span>` : ''}
        ${p.reporter?.shift ? `<span>🕒 الوردية: ${p.reporter.shift}</span>` : ''}
        ${p.createdAt ? `<span>🕓 ${new Date(p.createdAt).toLocaleDateString('ar-EG')}</span>` : ''}
      </div>
    </div>
  `;
}
