function toCsv(rows, headers) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h])).join(',')));
  return '\uFEFF' + lines.join('\n'); // BOM لدعم العربي في Excel
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

window.exportTicketsCsv = async function () {
  const { fetchTicketsForDashboardApi } = await import('../services/api.js');
  const result = await fetchTicketsForDashboardApi();

  if (!result || result.status !== 'success' || !result.data.length) {
    alert(window.currentLang === 'en' ? 'No tickets to export.' : 'لا توجد بلاغات لتصديرها.');
    return;
  }

  const rows = result.data.map(t => ({
    issueId: t.issueId || t.id,
    machine: t.machine || t.machineName || '',
    status: t.status || '',
    type: t.type || '',
    reportedBy: t.reportedBy || '',
    assignedTo: t.assignedTo || '',
    description: t.description || '',
    createdAt: t.createdAt || ''
  }));

  downloadCsv('tickets.csv', toCsv(rows, ['issueId', 'machine', 'status', 'type', 'reportedBy', 'assignedTo', 'description', 'createdAt']));
};

window.exportPmCsv = async function () {
  const { fetchPmRecordsApi } = await import('../services/api.js');
  const result = await fetchPmRecordsApi();

  if (!result || result.status !== 'success' || !result.data.length) {
    alert(window.currentLang === 'en' ? 'No PM records to export.' : 'لا توجد سجلات صيانة وقائية لتصديرها.');
    return;
  }

  const rows = result.data.map(r => ({
    machine: r.machine || '',
    hydraulic: r.checklist?.hydraulic ? 'yes' : 'no',
    filters: r.checklist?.filters ? 'yes' : 'no',
    lubrication: r.checklist?.lubrication ? 'yes' : 'no',
    notes: r.notes || '',
    reporter: r.reporter?.name || '',
    createdAt: r.createdAt || ''
  }));

  downloadCsv('pm-records.csv', toCsv(rows, ['machine', 'hydraulic', 'filters', 'lubrication', 'notes', 'reporter', 'createdAt']));
};

export const ReportsView = () => {
  const isEn = window.currentLang === 'en';

  return `
  <div class="p-4 max-w-md mx-auto pb-10">
    <!-- زر الرجوع -->
    <button onclick="window.navigateTo('maintenance')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>

    <!-- العنوان -->
    <div class="mb-5">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">
        <span>📄</span> ${isEn ? 'Export Reports' : 'تصدير التقارير'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Download maintenance and defect logs (CSV - opens in Excel)' : 'تحميل سجلات الصيانة والأعطال (CSV - يفتح مباشرة في Excel)'}
      </p>
    </div>

    <!-- خيارات التصدير -->
    <div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 space-y-3 shadow-lg text-center">
      <div class="w-16 h-16 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center text-3xl mx-auto mb-2">
        📊
      </div>

      <button onclick="window.exportTicketsCsv()" class="w-full p-3.5 bg-green-600 hover:bg-green-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
        <span>${isEn ? 'Export Tickets (CSV)' : 'تصدير البلاغات (CSV)'}</span>
      </button>

      <button onclick="window.exportPmCsv()" class="w-full p-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
        <span>${isEn ? 'Export PM Records (CSV)' : 'تصدير سجلات الصيانة الوقائية (CSV)'}</span>
      </button>

      <p class="text-[10px] text-gray-500 pt-1">
        ${isEn ? "Tickets export reflects your role's access (admin/manager: all, technician: assigned, reporter: own)." : 'تصدير البلاغات بيعكس صلاحية دورك (أدمن/مدير: الكل، فني: تذاكره، مُبلّغ: تذاكره).'}
      </p>
    </div>
  </div>
  `;
};
