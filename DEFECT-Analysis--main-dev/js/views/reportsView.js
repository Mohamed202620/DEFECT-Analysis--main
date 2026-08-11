// ============================================================
// reportsView.js
// تصدير البلاغات وسجلات الصيانة الوقائية - CSV/XLSX + فلاتر
// (من تاريخ/إلى تاريخ، حالة البلاغ، نوع العطل، الفني المسؤول)
// ============================================================

let cachedTickets = null;
let cachedTechnicians = null;

function attachmentsOf(record) {
  // يجمع كل روابط الصور/الفيديوهات المتاحة على المستند في عمود
  // واحد مفصول بـ ";" - راجع ticketsApi.js: imageUrl (عند الإنشاء)
  // و repairImages (عند إتمام الإصلاح). لا توجد حالياً حقول فيديو
  // فعلية في أي من التذاكر أو سجلات PM (راجع ملاحظة الختام).
  const urls = [
    record.imageUrl,
    ...(Array.isArray(record.repairImages) ? record.repairImages : []),
    record.videoUrl,
    ...(Array.isArray(record.videos) ? record.videos : [])
  ].filter(Boolean);

  return [...new Set(urls)].join(';');
}

function toCsv(rows, headers) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h])).join(',')));
  return '\uFEFF' + lines.join('\n'); // BOM لدعم العربي
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadXlsx(filename, rows, sheetName) {
  if (typeof XLSX === 'undefined') {
    alert(window.currentLang === 'en'
      ? 'XLSX library failed to load (check internet connection).'
      : 'مكتبة XLSX لم يتم تحميلها (تأكد من الاتصال بالإنترنت).');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function ticketRow(t) {
  return {
    issueId: t.issueId || t.id,
    machine: t.machine || t.machineName || '',
    status: t.status || '',
    type: t.type || '',
    reportedBy: t.reportedBy || '',
    assignedTo: t.assignedTo || '',
    description: t.description || '',
    mechanicNotes: t.mechanicNotes || '',
    operatorFeedback: t.operatorFeedback || '',
    attachments: attachmentsOf(t),
    createdAt: t.createdAt || ''
  };
}

function pmRow(r) {
  return {
    machine: r.machine || '',
    hydraulic: r.checklist?.hydraulic ? 'yes' : 'no',
    filters: r.checklist?.filters ? 'yes' : 'no',
    lubrication: r.checklist?.lubrication ? 'yes' : 'no',
    notes: r.notes || '',
    reporter: r.reporter?.name || '',
    attachments: attachmentsOf(r),
    createdAt: r.createdAt || ''
  };
}

const TICKET_HEADERS = ['issueId', 'machine', 'status', 'type', 'reportedBy', 'assignedTo', 'description', 'mechanicNotes', 'operatorFeedback', 'attachments', 'createdAt'];
const PM_HEADERS = ['machine', 'hydraulic', 'filters', 'lubrication', 'notes', 'reporter', 'attachments', 'createdAt'];

function getFilterValues() {
  return {
    from: document.getElementById('repFrom')?.value || '',
    to: document.getElementById('repTo')?.value || '',
    status: document.getElementById('repStatus')?.value || 'all',
    type: document.getElementById('repType')?.value || 'all',
    technician: document.getElementById('repTechnician')?.value || 'all'
  };
}

function statusMatches(status, filter) {
  if (filter === 'all') return true;
  if (filter === 'closed') return status === 'closed';
  if (filter === 'in_progress') return status === 'in_progress';
  if (filter === 'open') return status !== 'closed' && status !== 'in_progress';
  return true;
}

function inDateRange(createdAt, from, to) {
  if (!createdAt) return !from && !to;
  const d = new Date(createdAt);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

function applyTicketFilters(tickets) {
  const f = getFilterValues();
  return tickets.filter(t =>
    inDateRange(t.createdAt, f.from, f.to) &&
    statusMatches(t.status || '', f.status) &&
    (f.type === 'all' || t.type === f.type) &&
    (f.technician === 'all' || t.assignedTo === f.technician)
  );
}

function applyDateFilterOnly(records) {
  const f = getFilterValues();
  return records.filter(r => inDateRange(r.createdAt, f.from, f.to));
}

async function ensureTicketsLoaded() {
  if (cachedTickets) return cachedTickets;
  const { fetchTicketsForDashboardApi } = await import('../services/api.js');
  const result = await fetchTicketsForDashboardApi();
  cachedTickets = result.status === 'success' ? result.data : [];
  return cachedTickets;
}

async function ensureTechniciansLoaded() {
  if (cachedTechnicians) return cachedTechnicians;
  const { fetchTechniciansApi } = await import('../services/api.js');
  const result = await fetchTechniciansApi();
  cachedTechnicians = result.status === 'success' ? result.data : [];
  return cachedTechnicians;
}

window.loadReportsFilters = async function () {
  const [tickets, technicians] = await Promise.all([ensureTicketsLoaded(), ensureTechniciansLoaded()]);

  const typeSelect = document.getElementById('repType');
  if (typeSelect) {
    const types = [...new Set(tickets.map(t => t.type).filter(Boolean))];
    typeSelect.innerHTML = `<option value="all">${window.currentLang === 'en' ? 'All Types' : 'كل الأنواع'}</option>` +
      types.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  const techSelect = document.getElementById('repTechnician');
  if (techSelect) {
    techSelect.innerHTML = `<option value="all">${window.currentLang === 'en' ? 'All Technicians' : 'كل الفنيين'}</option>` +
      technicians.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  }
};

window.exportTicketsReport = async function (format) {
  const tickets = applyTicketFilters(await ensureTicketsLoaded());

  if (!tickets.length) {
    alert(window.currentLang === 'en' ? 'No tickets match the selected filters.' : 'لا توجد بلاغات مطابقة للفلاتر المحددة.');
    return;
  }

  const rows = tickets.map(ticketRow);

  if (format === 'xlsx') {
    downloadXlsx('tickets.xlsx', rows, 'Tickets');
  } else {
    downloadCsv('tickets.csv', toCsv(rows, TICKET_HEADERS));
  }
};

window.exportPmReport = async function (format) {
  const { fetchPmRecordsApi } = await import('../services/api.js');
  const result = await fetchPmRecordsApi();
  const records = applyDateFilterOnly(result.status === 'success' ? result.data : []);

  if (!records.length) {
    alert(window.currentLang === 'en' ? 'No PM records match the selected date range.' : 'لا توجد سجلات صيانة وقائية مطابقة للفترة المحددة.');
    return;
  }

  const rows = records.map(pmRow);

  if (format === 'xlsx') {
    downloadXlsx('pm-records.xlsx', rows, 'PM Records');
  } else {
    downloadCsv('pm-records.csv', toCsv(rows, PM_HEADERS));
  }
};

export const ReportsView = () => {
  const isEn = window.currentLang === 'en';

  return `
  <div class="p-4 max-w-md mx-auto pb-10">
    <button onclick="window.navigateTo('maintenance')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>

    <div class="mb-4">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">
        <span>📄</span> ${isEn ? 'Export Reports' : 'تصدير التقارير'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'CSV or XLSX (Arabic-safe), including attached image/video links' : 'CSV أو XLSX (يدعم العربي)، شامل روابط الصور/الفيديوهات المرفقة'}
      </p>
    </div>

    <!-- الفلاتر (تُطبَّق على تصدير البلاغات - نطاق التاريخ يُطبَّق على PM أيضاً) -->
    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3 shadow-lg mb-4">
      <h3 class="text-xs font-bold text-gray-300">${isEn ? 'Filters' : 'الفلاتر'}</h3>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] text-gray-500 mb-1">${isEn ? 'From' : 'من تاريخ'}</label>
          <input id="repFrom" type="date" class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white" />
        </div>
        <div>
          <label class="block text-[10px] text-gray-500 mb-1">${isEn ? 'To' : 'إلى تاريخ'}</label>
          <input id="repTo" type="date" class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white" />
        </div>
      </div>

      <div>
        <label class="block text-[10px] text-gray-500 mb-1">${isEn ? 'Ticket Status' : 'حالة البلاغ'}</label>
        <select id="repStatus" class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white">
          <option value="all">${isEn ? 'All' : 'الكل'}</option>
          <option value="open">${isEn ? 'Open' : 'مفتوح'}</option>
          <option value="in_progress">${isEn ? 'In Progress' : 'قيد التنفيذ'}</option>
          <option value="closed">${isEn ? 'Closed' : 'مغلق'}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] text-gray-500 mb-1">${isEn ? 'Defect / Equipment Type' : 'نوع العطل / المعدة'}</label>
        <select id="repType" class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white">
          <option value="all">${isEn ? 'All Types' : 'كل الأنواع'}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] text-gray-500 mb-1">${isEn ? 'Assigned Technician' : 'الفني المسؤول'}</label>
        <select id="repTechnician" class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white">
          <option value="all">${isEn ? 'All Technicians' : 'كل الفنيين'}</option>
        </select>
      </div>
    </div>

    <!-- تصدير البلاغات -->
    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-2 shadow-lg mb-4">
      <h3 class="text-xs font-bold text-gray-300">${isEn ? 'Tickets' : 'البلاغات'}</h3>
      <div class="flex gap-2">
        <button onclick="window.exportTicketsReport('csv')" class="flex-1 p-3 bg-green-600 hover:bg-green-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">CSV</button>
        <button onclick="window.exportTicketsReport('xlsx')" class="flex-1 p-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">XLSX</button>
      </div>
    </div>

    <!-- تصدير الصيانة الوقائية -->
    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-2 shadow-lg">
      <h3 class="text-xs font-bold text-gray-300">${isEn ? 'PM Records' : 'الصيانة الوقائية'}</h3>
      <p class="text-[10px] text-gray-500">${isEn ? 'Date range filter only' : 'فلتر نطاق التاريخ فقط'}</p>
      <div class="flex gap-2">
        <button onclick="window.exportPmReport('csv')" class="flex-1 p-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">CSV</button>
        <button onclick="window.exportPmReport('xlsx')" class="flex-1 p-3 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">XLSX</button>
      </div>
    </div>
  </div>
  `;
};
