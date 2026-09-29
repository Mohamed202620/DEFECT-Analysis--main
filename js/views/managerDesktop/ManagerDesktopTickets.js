// ============================================================
// ManagerDesktopTickets.js - MGR-DESKTOP
// جدول ولوحة البلاغات العريضة المخصصة لمدير الصيانة على الكمبيوتر
// مع لوحة معاينة سريعة جانبية واختصارات لوحة المفاتيح (/ , N , J/K)
// ============================================================

import { translations } from '../../config.js';
import { STATUS_LABELS, STATUS_CLASSES, CLOSED_STATUSES, isOverdueTicket, parseTicketDate } from '../../ticketStatusConstants.js';
import { fetchTechniciansApi } from '../../services/usersApi.js';
import { assignTicketApi, reassignTicketApi } from '../../services/ticketsApi.js';
import { openActionModal } from '../../components/ActionModal.js';

let activeFilteredTickets = [];
let selectedRowIndex = 0;
let sidePreviewTicketId = null;
let keyListenerAttached = false;
let currentSortField = "createdAt";
let currentSortAsc = false;
let currentTextSearch = "";
let currentDeptFilter = "all";
let currentLineFilter = "all";
let currentPriorityFilter = "all";

export function renderManagerDesktopTicketsView(containerId, allTickets, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  // تصفية الفلاتر والبحث محلياً
  activeFilteredTickets = filterAndSortTickets(allTickets);

  container.innerHTML = `
    <div class="mgr-tickets-split-container">
      
      <!-- اللوحة الرئيسية العريضة للجدول وأدوات التصفية -->
      <div class="mgr-tickets-main-panel space-y-3">
        
        <!-- شريط البحث والفلترة السريعة مع مؤشرات الاختصارات -->
        <div class="mgr-card p-3 flex flex-wrap items-center justify-between gap-3">
          
          <!-- حقل البحث مع اختصار / -->
          <div class="relative flex-1 min-w-[240px]">
            <span class="absolute inset-y-0 start-3 flex items-center text-gray-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              id="mgrTicketSearchInput"
              value="${currentTextSearch}"
              placeholder="${isEn ? 'Search by machine, line, description, or technician... (Press / to focus)' : 'بحث بالماكينة، الخط، الوصف أو الفني... (اضغط / للتركيز)'}"
              class="w-full ps-9 pe-12 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <span class="absolute inset-y-0 end-2.5 flex items-center pointer-events-none">
              <kbd class="mgr-kbd">/</kbd>
            </span>
          </div>

          <!-- الفلاتر السريعة -->
          <div class="flex items-center gap-2 flex-wrap">
            
            <!-- فلتر الأولوية -->
            <select
              id="mgrPriorityFilterSelect"
              class="py-2 px-2.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none">
              <option value="all" ${currentPriorityFilter === 'all' ? 'selected' : ''}>${isEn ? 'All Priorities' : 'كل الأولويات'}</option>
              <option value="High" ${currentPriorityFilter === 'High' ? 'selected' : ''}>🔴 ${isEn ? 'High' : 'عالية'}</option>
              <option value="Medium" ${currentPriorityFilter === 'Medium' ? 'selected' : ''}>🟡 ${isEn ? 'Medium' : 'متوسطة'}</option>
              <option value="Low" ${currentPriorityFilter === 'Low' ? 'selected' : ''}>🟢 ${isEn ? 'Low' : 'منخفضة'}</option>
            </select>

            <!-- فلتر الأقسام والخطوط إن وجدت -->
            <select
              id="mgrSortSelect"
              class="py-2 px-2.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none">
              <option value="createdAt_desc" ${currentSortField === 'createdAt' && !currentSortAsc ? 'selected' : ''}>${isEn ? 'Newest first' : 'الأحدث أولاً'}</option>
              <option value="createdAt_asc" ${currentSortField === 'createdAt' && currentSortAsc ? 'selected' : ''}>${isEn ? 'Oldest first' : 'الأقدم أولاً'}</option>
              <option value="priority" ${currentSortField === 'priority' ? 'selected' : ''}>${isEn ? 'Highest Priority' : 'الأعلى خطورة'}</option>
              <option value="machine" ${currentSortField === 'machine' ? 'selected' : ''}>${isEn ? 'Machine name' : 'اسم الماكينة'}</option>
            </select>

            <!-- اختصارات لوحة المفاتيح المرئية -->
            <div class="hidden xl:flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
              <span>${isEn ? 'Shortcuts:' : 'اختصارات:'}</span>
              <kbd class="mgr-kbd">N</kbd> <span class="text-[10px]">${isEn ? 'New' : 'جديد'}</span>
              <kbd class="mgr-kbd">J</kbd>/<kbd class="mgr-kbd">K</kbd> <span class="text-[10px]">${isEn ? 'Rows' : 'تنقل'}</span>
            </div>

          </div>

        </div>

        <!-- شريط الإجراءات الجماعية المتقدم للمدير -->
        <div id="mgrBulkActionsContainer" class="hidden">
          <div class="mgr-card p-2.5 flex items-center justify-between bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-2">
              <span id="mgrBulkSelectedText" class="text-xs font-bold text-blue-700 dark:text-blue-300">0 محدد</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick="window.mgrBulkAssignPrompt()"
                class="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition active:scale-95 cursor-pointer">
                👤 ${isEn ? 'Bulk Assign' : 'إسناد جماعي'}
              </button>
              <button
                type="button"
                onclick="window.bulkCloseSelectedTickets()"
                class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95 cursor-pointer">
                ✔️ ${isEn ? 'Close Selected' : 'إغلاق المحدد'}
              </button>
              <button
                type="button"
                onclick="window.bulkExportSelectedTickets()"
                class="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-700 hover:bg-gray-600 text-white shadow-sm transition active:scale-95 cursor-pointer">
                📄 ${isEn ? 'Export PDF' : 'تصدير PDF'}
              </button>
              <button
                type="button"
                onclick="window.mgrClearSelection()"
                class="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition cursor-pointer">
                ${isEn ? 'Clear' : 'إلغاء'}
              </button>
            </div>
          </div>
        </div>

        <!-- جدول التذاكر العريض (Wide Responsive Table) -->
        <div class="mgr-card mgr-table-container">
          <table class="w-full text-start text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 select-none">
                <th class="py-3 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    id="mgrSelectAllCheckbox"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Status' : 'الحالة'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Priority' : 'الأولوية'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Machine / Asset' : 'الماكينة'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Line / Dept' : 'الخط / القسم'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Issue Description' : 'بيان العطل'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Assigned Tech' : 'الفني المكلف'}</th>
                <th class="py-3 px-3 font-semibold text-start">${isEn ? 'Reported Time' : 'وقت البلاغ'}</th>
                <th class="py-3 px-3 font-semibold text-center">${isEn ? 'Actions' : 'إجراء'}</th>
              </tr>
            </thead>
            <tbody id="mgrTicketsTableBody" class="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
              <!-- Rows will be injected -->
            </tbody>
          </table>
        </div>

      </div>

      <!-- اللوحة الجانبية للمعاينة السريعة (Split Panel Preview) -->
      <div id="mgrSidePreviewPanel" class="mgr-tickets-side-preview mgr-card p-4">
        <div id="mgrSidePreviewContent" class="space-y-4">
          <div class="py-12 text-center text-gray-400 text-xs">
            <div class="text-3xl mb-2">👈</div>
            <div class="font-bold text-gray-600 dark:text-gray-300">
              ${isEn ? 'Select a ticket row for instant preview' : 'اضغط على أي صف لمعاينته فوراً دون مغادرة الجدول'}
            </div>
            <div class="text-[10px] text-gray-400 mt-1">
              ${isEn ? 'Use J and K keyboard keys to navigate quickly' : 'استخدم مفاتيح J و K للتنقل السريع بين التذاكر'}
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // ربط أحداث الإدخال والتصفية
  attachTableFilterListeners(allTickets, containerId, emptyMessage);

  // رسم الصفوف
  renderTableRows(allTickets);

  // تفعيل مستمع اختصارات الكيبورد
  attachKeyboardShortcuts(allTickets);
}

function filterAndSortTickets(allTickets) {
  let list = Array.isArray(allTickets) ? [...allTickets] : [];

  // 1. فلتر البحث النصي
  if (currentTextSearch.trim()) {
    const q = currentTextSearch.trim().toLowerCase();
    list = list.filter(t => {
      const matchMachine = String(t.machine || '').toLowerCase().includes(q);
      const matchLine = String(t.line || '').toLowerCase().includes(q);
      const matchDesc = String(t.description || '').toLowerCase().includes(q);
      const matchTech = String(t.assignedTo || '').toLowerCase().includes(q);
      const matchReporter = String(t.reportedBy || '').toLowerCase().includes(q);
      const matchId = String(t.id || '').toLowerCase().includes(q);
      return matchMachine || matchLine || matchDesc || matchTech || matchReporter || matchId;
    });
  }

  // 2. فلتر الأولوية
  if (currentPriorityFilter !== 'all') {
    list = list.filter(t => String(t.priority || '').trim() === currentPriorityFilter);
  }

  // 3. الترتيب
  list.sort((a, b) => {
    if (currentSortField === 'createdAt') {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      return currentSortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }
    if (currentSortField === 'priority') {
      const weight = { High: 3, Critical: 3, Medium: 2, Low: 1 };
      const wA = weight[a.priority] || 0;
      const wB = weight[b.priority] || 0;
      return wB - wA;
    }
    if (currentSortField === 'machine') {
      return String(a.machine || '').localeCompare(String(b.machine || ''));
    }
    return 0;
  });

  return list;
}

function renderTableRows(allTickets) {
  const tbody = document.getElementById("mgrTicketsTableBody");
  if (!tbody) return;

  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  if (!activeFilteredTickets.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-12 text-center text-gray-400 text-xs">
          <div class="text-2xl mb-1">🔍</div>
          <div>${isEn ? 'No tickets found matching your filter' : 'لا توجد بلاغات تطابق معايير البحث والفلترة'}</div>
        </td>
      </tr>
    `;
    renderSidePreview(null);
    return;
  }

  tbody.innerHTML = activeFilteredTickets.map((t, idx) => {
    const isSelected = window.selectedTicketIds ? window.selectedTicketIds.has(t.id) : false;
    const isRowActive = t.id === sidePreviewTicketId || (idx === selectedRowIndex && !sidePreviewTicketId);
    if (isRowActive && !sidePreviewTicketId) {
      sidePreviewTicketId = t.id;
    }

    const priorityCls = t.priority === 'High' 
      ? 'bg-red-500/15 text-red-500 border border-red-500/30'
      : t.priority === 'Low'
        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
        : 'bg-amber-500/15 text-amber-500 border border-amber-500/30';

    const statusBadgeCls = STATUS_CLASSES[t.status] || "bg-gray-500/20 text-gray-300";
    const statusText = STATUS_LABELS[t.status] || t.status;
    const isOverdue = isOverdueTicket(t);

    const timeStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '-';

    return `
      <tr
        data-ticket-id="${t.id}"
        data-row-idx="${idx}"
        class="mgr-ticket-row cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-gray-800/60 ${isRowActive ? 'mgr-row-active' : ''}">
        
        <!-- التحديد -->
        <td class="py-2.5 px-3 text-center" onclick="event.stopPropagation()">
          <input
            type="checkbox"
            data-select-id="${t.id}"
            class="mgr-ticket-chk rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            ${isSelected ? 'checked' : ''}
          />
        </td>

        <!-- الحالة -->
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeCls}">
            ${isOverdue ? '<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>' : ''}
            <span>${statusText}</span>
          </span>
        </td>

        <!-- الأولوية -->
        <td class="py-2.5 px-3 font-semibold">
          <span class="inline-block text-[10px] px-2 py-0.5 rounded-md ${priorityCls}">
            ${t.priority || (isEn ? 'Normal' : 'عادية')}
          </span>
        </td>

        <!-- الماكينة -->
        <td class="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
          ${t.machine || '-'}
        </td>

        <!-- الخط والقسم -->
        <td class="py-2.5 px-3 text-gray-500 dark:text-gray-400">
          ${t.line || '-'}
        </td>

        <!-- الوصف -->
        <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title="${t.description || ''}">
          ${t.description || '-'}
        </td>

        <!-- الفني المكلف -->
        <td class="py-2.5 px-3 text-gray-600 dark:text-gray-300 font-medium">
          ${t.assignedTo ? `👷 ${t.assignedTo}` : `<span class="text-amber-500 font-bold">${isEn ? 'Unassigned' : 'بانتظار الإسناد'}</span>`}
        </td>

        <!-- الوقت -->
        <td class="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
          ${timeStr}
        </td>

        <!-- إجراءات -->
        <td class="py-2.5 px-3 text-center" onclick="event.stopPropagation()">
          <button
            type="button"
            onclick="window.openTicketDetailsModal('${t.id}')"
            class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-200 transition active:scale-95 cursor-pointer">
            ${isEn ? 'Details' : 'تفاصيل'}
          </button>
        </td>

      </tr>
    `;
  }).join("");

  // ربط الضغط على الصفوف لمعاينة التذكرة
  tbody.querySelectorAll(".mgr-ticket-row").forEach(row => {
    row.addEventListener("click", () => {
      const ticketId = row.dataset.ticketId;
      const idx = parseInt(row.dataset.rowIdx, 10);
      selectRowByIndex(idx);
    });
  });

  // ربط الـ Checkboxes
  tbody.querySelectorAll(".mgr-ticket-chk").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const id = chk.dataset.selectId;
      if (window.selectedTicketIds) {
        if (chk.checked) window.selectedTicketIds.add(id);
        else window.selectedTicketIds.delete(id);
      }
      updateBulkActionBar();
    });
  });

  // عرض المعاينة الجانبية للتذكرة المحددة
  const activeTicket = activeFilteredTickets.find(t => t.id === sidePreviewTicketId) || activeFilteredTickets[0];
  renderSidePreview(activeTicket);
}

function selectRowByIndex(idx) {
  if (idx < 0 || idx >= activeFilteredTickets.length) return;
  selectedRowIndex = idx;
  const targetTicket = activeFilteredTickets[idx];
  if (!targetTicket) return;
  sidePreviewTicketId = targetTicket.id;

  // تحديث الكلاسات في الجدول
  const tbody = document.getElementById("mgrTicketsTableBody");
  if (tbody) {
    tbody.querySelectorAll(".mgr-ticket-row").forEach(r => {
      if (parseInt(r.dataset.rowIdx, 10) === idx) {
        r.classList.add("mgr-row-active");
        r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        r.classList.remove("mgr-row-active");
      }
    });
  }

  renderSidePreview(targetTicket);
}

function renderSidePreview(ticket) {
  const container = document.getElementById("mgrSidePreviewContent");
  if (!container) return;

  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  if (!ticket) {
    container.innerHTML = `
      <div class="py-12 text-center text-gray-400 text-xs">
        <div>${isEn ? 'No ticket selected' : 'لم يتم تحديد أي بلاغ'}</div>
      </div>
    `;
    return;
  }

  const priorityCls = ticket.priority === 'High' 
    ? 'bg-red-500/15 text-red-500 border border-red-500/30'
    : ticket.priority === 'Low'
      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30';

  const statusBadgeCls = STATUS_CLASSES[ticket.status] || "bg-gray-500/20 text-gray-300";
  const statusText = STATUS_LABELS[ticket.status] || ticket.status;

  const mediaUrls = (ticket.imageUrls && Array.isArray(ticket.imageUrls) && ticket.imageUrls.length > 0)
    ? ticket.imageUrls : (ticket.imageUrl ? [ticket.imageUrl] : []);

  container.innerHTML = `
    <!-- Header -->
    <div class="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeCls}">
            ${statusText}
          </span>
          <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded ${priorityCls}">
            ${ticket.priority || 'Normal'}
          </span>
        </div>
        <h2 class="text-base font-black text-gray-900 dark:text-white mt-1.5">
          ${ticket.machine || (isEn ? 'Unspecified Machine' : 'ماكينة غير محددة')}
        </h2>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
          ${isEn ? 'Ticket' : 'تذكرة'}: #${ticket.id ? ticket.id.slice(0, 8) : '-'}
        </div>
      </div>

      <button
        type="button"
        onclick="window.openTicketDetailsModal('${ticket.id}')"
        class="p-1.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
        title="${isEn ? 'Open Full Modal' : 'فتح المودال الكامل'}">
        ⛶
      </button>
    </div>

    <!-- Description -->
    <div class="space-y-1">
      <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
        ${isEn ? 'Issue Description' : 'بيان العطل والملاحظات'}
      </span>
      <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-200 leading-relaxed border border-gray-100 dark:border-gray-800">
        ${ticket.description || (isEn ? 'No description provided' : 'لا يوجد وصف مسجل')}
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
        <span class="text-[10px] text-gray-400 block">${isEn ? 'Line / Location' : 'الخط / الموقع'}</span>
        <span class="font-bold text-gray-800 dark:text-gray-200">${ticket.line || '-'}</span>
      </div>

      <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
        <span class="text-[10px] text-gray-400 block">${isEn ? 'Reported By' : 'المُبلّغ'}</span>
        <span class="font-bold text-gray-800 dark:text-gray-200">${ticket.reportedBy || '-'}</span>
      </div>

      <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 col-span-2">
        <span class="text-[10px] text-gray-400 block">${isEn ? 'Assigned Technician' : 'الفني المكلف'}</span>
        <div class="flex items-center justify-between mt-0.5">
          <span class="font-bold text-gray-800 dark:text-gray-200">
            ${ticket.assignedTo ? `👷 ${ticket.assignedTo}` : `<span class="text-amber-500 font-bold">${isEn ? 'Unassigned' : 'بانتظار الإسناد'}</span>`}
          </span>
          <button
            type="button"
            onclick="window.mgrPromptAssignTicket('${ticket.id}')"
            class="text-[11px] font-bold text-blue-500 hover:underline">
            ${ticket.assignedTo ? (isEn ? 'Reassign' : 'إعادة إسناد') : (isEn ? 'Assign Now' : 'إسناد الآن')}
          </button>
        </div>
      </div>
    </div>

    <!-- Media Thumbnails -->
    ${mediaUrls.length > 0 ? `
      <div class="space-y-1.5 pt-1">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          ${isEn ? 'Attached Images' : 'الصور المرفقة'} (${mediaUrls.length})
        </span>
        <div class="flex gap-2 overflow-x-auto pb-1">
          ${mediaUrls.map(url => `
            <img
              src="${url}"
              alt="Evidence"
              onclick="window.open('${url}', '_blank')"
              class="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:scale-105 transition cursor-pointer"
            />
          `).join("")}
        </div>
      </div>
    ` : ''}

    <!-- Quick Action Footer -->
    <div class="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
      <button
        type="button"
        onclick="window.openTicketDetailsModal('${ticket.id}')"
        class="w-full py-2 px-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition active:scale-95 cursor-pointer">
        📋 ${isEn ? 'Open Full Details & Lifecycle' : 'فتح تفاصيل وسجل البلاغ بالكامل'}
      </button>
    </div>
  `;
}

function attachTableFilterListeners(allTickets, containerId, emptyMessage) {
  // Search input
  const searchInput = document.getElementById("mgrTicketSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentTextSearch = e.target.value;
      activeFilteredTickets = filterAndSortTickets(allTickets);
      selectedRowIndex = 0;
      renderTableRows(allTickets);
    });
  }

  // Priority filter
  const prioSelect = document.getElementById("mgrPriorityFilterSelect");
  if (prioSelect) {
    prioSelect.addEventListener("change", (e) => {
      currentPriorityFilter = e.target.value;
      activeFilteredTickets = filterAndSortTickets(allTickets);
      selectedRowIndex = 0;
      renderTableRows(allTickets);
    });
  }

  // Sort select
  const sortSelect = document.getElementById("mgrSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === 'createdAt_desc') { currentSortField = 'createdAt'; currentSortAsc = false; }
      else if (val === 'createdAt_asc') { currentSortField = 'createdAt'; currentSortAsc = true; }
      else if (val === 'priority') { currentSortField = 'priority'; }
      else if (val === 'machine') { currentSortField = 'machine'; }
      activeFilteredTickets = filterAndSortTickets(allTickets);
      renderTableRows(allTickets);
    });
  }

  // Select all checkbox
  const selectAll = document.getElementById("mgrSelectAllCheckbox");
  if (selectAll) {
    selectAll.addEventListener("change", (e) => {
      if (!window.selectedTicketIds) window.selectedTicketIds = new Set();
      if (e.target.checked) {
        activeFilteredTickets.forEach(t => window.selectedTicketIds.add(t.id));
      } else {
        window.selectedTicketIds.clear();
      }
      renderTableRows(allTickets);
      updateBulkActionBar();
    });
  }
}

function updateBulkActionBar() {
  const bar = document.getElementById("mgrBulkActionsContainer");
  const txt = document.getElementById("mgrBulkSelectedText");
  const count = window.selectedTicketIds ? window.selectedTicketIds.size : 0;
  if (!bar) return;

  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  if (count > 0) {
    bar.classList.remove("hidden");
    if (txt) txt.textContent = `${count} ${isEn ? 'Selected' : 'تذكرة محددة'}`;
  } else {
    bar.classList.add("hidden");
  }
}

function attachKeyboardShortcuts(allTickets) {
  if (keyListenerAttached) return;
  keyListenerAttached = true;

  window.addEventListener("keydown", (e) => {
    // إذا كان المستخدم يكتب في حقل إدخال أو نص
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    const isInput = tag === "input" || tag === "textarea" || tag === "select";

    // 1. اختصار / للتركيز على حقل البحث
    if (e.key === "/" && !isInput) {
      e.preventDefault();
      const input = document.getElementById("mgrTicketSearchInput");
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }

    // إذا كان يكتب في الـ input ومعه مفتاح Escape
    if (e.key === "Escape") {
      if (isInput && document.activeElement) {
        document.activeElement.blur();
      }
      return;
    }

    if (isInput) return;

    // 2. اختصار N لفتح بلاغ جديد
    if ((e.key === "n" || e.key === "N" || e.key === "ى") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (typeof window.navigateTo === "function") {
        window.navigateTo("issue");
      }
      return;
    }

    // 3. اختصار J للصف التالي
    if (e.key === "j" || e.key === "J" || e.key === "ت") {
      e.preventDefault();
      if (selectedRowIndex < activeFilteredTickets.length - 1) {
        selectRowByIndex(selectedRowIndex + 1);
      }
      return;
    }

    // 4. اختصار K للصف السابق
    if (e.key === "k" || e.key === "K" || e.key === "ن") {
      e.preventDefault();
      if (selectedRowIndex > 0) {
        selectRowByIndex(selectedRowIndex - 1);
      }
      return;
    }

    // 5. اختصار Enter لفتح تفاصيل التذكرة المحددة
    if (e.key === "Enter") {
      const activeTicket = activeFilteredTickets[selectedRowIndex];
      if (activeTicket && typeof window.openTicketDetailsModal === "function") {
        window.openTicketDetailsModal(activeTicket.id);
      }
    }
  });
}

// نافذة منبثقة لإسناد التذكرة لفني
window.mgrPromptAssignTicket = async function(ticketId) {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  const techResult = await fetchTechniciansApi();
  const technicians = techResult.status === "success" ? techResult.data : [];

  if (!technicians.length) {
    alert(isEn ? 'No active technicians available in database' : 'لا يوجد فنيين مسجلين في النظام حالياً');
    return;
  }

  const values = await openActionModal({
    title: isEn ? 'Assign Ticket' : 'إسناد البلاغ لفني',
    fields: [
      {
        name: "assignedTo",
        label: isEn ? 'Select Technician' : 'اختر الفني المكلف',
        type: "select",
        options: technicians.map(t => ({ label: `${t.name} (${t.department || ''})`, value: t.name })),
        required: true
      },
      {
        name: "type",
        label: isEn ? 'Maintenance Type' : 'نوع التدخل',
        type: "select",
        options: [
          { label: isEn ? 'Breakdown Repair' : 'إصلاح عطل طارئ', value: 'Breakdown' },
          { label: isEn ? 'Observation Inspection' : 'معاينة ملاحظة', value: 'Observation' },
          { label: isEn ? 'Preventive PM' : 'صيانة وقائية', value: 'PM' }
        ],
        required: true
      }
    ],
    submitText: isEn ? 'Assign' : 'إسناد'
  });

  if (!values) return;

  const selectedTech = technicians.find(t => t.name === values.assignedTo);
  const result = await assignTicketApi(ticketId, {
    type: values.type,
    assignedTo: values.assignedTo,
    assignedToUid: selectedTech?.id || null
  });

  if (result.status === "success") {
    alert(isEn ? '✅ Ticket assigned successfully' : '✅ تم إسناد البلاغ بنجاح');
  } else {
    alert(isEn ? `❌ Failed to assign: ${result.message}` : `❌ فشل الإسناد: ${result.message}`);
  }
};

// إسناد جماعي للمحدد
window.mgrBulkAssignPrompt = async function() {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  if (!window.selectedTicketIds || !window.selectedTicketIds.size) return;

  const techResult = await fetchTechniciansApi();
  const technicians = techResult.status === "success" ? techResult.data : [];

  if (!technicians.length) {
    alert(isEn ? 'No technicians found' : 'لا يوجد فنيين مسجلين');
    return;
  }

  const values = await openActionModal({
    title: isEn ? `Bulk Assign (${window.selectedTicketIds.size} Tickets)` : `إسناد جماعي لـ (${window.selectedTicketIds.size}) تذكرة`,
    fields: [
      {
        name: "assignedTo",
        label: isEn ? 'Select Technician' : 'اختر الفني المكلف',
        type: "select",
        options: technicians.map(t => ({ label: `${t.name}`, value: t.name })),
        required: true
      }
    ],
    submitText: isEn ? 'Assign All' : 'إسناد الكل'
  });

  if (!values) return;

  const selectedTech = technicians.find(t => t.name === values.assignedTo);
  let successCount = 0;

  for (const ticketId of window.selectedTicketIds) {
    try {
      const res = await reassignTicketApi(ticketId, {
        assignedTo: values.assignedTo,
        assignedToUid: selectedTech?.id || null
      });
      if (res.status === "success") successCount++;
    } catch (_) {}
  }

  alert(isEn ? `✅ Successfully assigned ${successCount} tickets` : `✅ تم إسناد ${successCount} تذكرة بنجاح`);
  window.selectedTicketIds.clear();
  updateBulkActionBar();
};

window.mgrClearSelection = function() {
  if (window.selectedTicketIds) window.selectedTicketIds.clear();
  updateBulkActionBar();
  const tbody = document.getElementById("mgrTicketsTableBody");
  if (tbody) {
    tbody.querySelectorAll(".mgr-ticket-chk").forEach(c => { c.checked = false; });
  }
  const allChk = document.getElementById("mgrSelectAllCheckbox");
  if (allChk) allChk.checked = false;
};
