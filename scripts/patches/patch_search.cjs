const fs = require('fs');

const path = 'js/maintenanceSearch.js';
let content = fs.readFileSync(path, 'utf8');

// Insert import at the top
content = "import { exportToPdf, exportToCsv, PAGE_BREAK_CLASS } from './services/exportUtility.js';\n" + content;

// Replace window.exportMaintenanceSearchResults
const startCsv = content.indexOf('window.exportMaintenanceSearchResults = function () {');
const endCsv = content.indexOf('// ============================================================', startCsv);

const newCsvCode = `window.exportMaintenanceSearchResults = function () {
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
      formatCsvDate(record.createdAt),
      byText,
      assignedText,
      descText,
      resolutionText,
      attachments
    ];
  });

  const title = isAr ? 'تقرير البحث والفلترة المتقدمة' : 'Advanced Search Report';
  const filename = \`maintenance-search-\${new Date().toISOString().slice(0, 10)}.csv\`;
  
  exportToCsv(title, headers, rows, filename);
};
`;

content = content.substring(0, startCsv) + newCsvCode + "\n" + content.substring(endCsv);

const startPdf = content.indexOf('window.exportMaintenanceSearchResultsPdf = async function () {');
const endPdf = content.indexOf('// ============================================================', startPdf);

const newPdfCode = `window.exportMaintenanceSearchResultsPdf = async function () {
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
        statusLabel = isAr ? \`\${doneCount}/3 بنود\` : \`\${doneCount}/3 items\`;
      }
      const descriptionText = record.description || record.problem || record.notes || '';
      
      const reportedLabel = isAr ? "👤 بلّغ:" : "👤 Reporter:";
      const assignedLabel = isAr ? "🛠️ مُسندة إلى:" : "🛠️ Assigned To:";
      const anonymousLabel = isAr ? "مجهول" : "Anonymous";
      const suggesterLabel = isAr ? "👤 مقدّم المقترح:" : "👤 Suggester:";
      const techLabel = isAr ? "🔧 الفني:" : "🔧 Technician:";
      
      const peopleLine = kind === 'ticket'
        ? \`\${reportedLabel} \${escapeHtml(record.reportedBy || '-')} &nbsp;|&nbsp; \${assignedLabel} \${escapeHtml(record.assignedTo || '-')}\`
        : kind === 'suggestion'
          ? \`\${suggesterLabel} \${escapeHtml(record.anonymous ? anonymousLabel : (record.name || '-'))} &nbsp;|&nbsp; \${techLabel} \${escapeHtml(record.assignedTo || '-')}\`
          : \`\${techLabel} \${escapeHtml(record.reporter?.name || '-')}\`;

      const imagesHtml = images.length ? \`
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          \${images.map(src => \`
            <img src="\${src}" style="width:100px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" />
          \`).join("")}
        </div>
      \` : "";
      
      const skippedNoteHtml = hasSkippedMedia ? \`
        <div style="font-size:10px; color:#b45309; margin-top:6px;">
          \${isAr ? "🎥 يوجد وسائط إضافية (فيديو/ملف) مرتبطة بهذا السجل - راجع تصدير CSV لروابطها الكاملة." : "🎥 Additional media (video/file) exists - see CSV export for full links."}
        </div>
      \` : "";
      return \`
        <div class="\${PAGE_BREAK_CLASS}" style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:14px; background: #f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:13px; color:#0f172a;">\${kindLabel} — \${escapeHtml(titleText)}</span>
            <span style="font-size:11px; padding:2px 10px; border-radius:10px; background:#e2e8f0; color:#334155;">
              \${escapeHtml(statusLabel)}
            </span>
          </div>
          <div style="font-size:11px; color:#475569; margin-bottom:6px;">
            📅 \${formatPdfDate(record.createdAt)} &nbsp;|&nbsp; \${peopleLine}
          </div>
          \${descriptionText ? \`<div style="font-size:11px; color:#1e293b; margin-bottom:6px;">\${escapeHtml(descriptionText)}</div>\` : ""}
          \${imagesHtml}
          \${skippedNoteHtml}
        </div>
      \`;
    }).join("");

    const title = isAr ? "🔎 تقرير البحث والفلترة المتقدمة" : "🔎 Advanced Search Report";
    const filename = \`maintenance-search-\${new Date().toISOString().slice(0, 10)}.pdf\`;
    
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
`;

content = content.substring(0, startPdf) + newPdfCode + "\n" + content.substring(endPdf);

// Now remove buildPdfRecordBlockHtml definition as we inlined it to avoid scope issues
const blockStart = content.indexOf('function buildPdfRecordBlockHtml(record, imageDataUrls, hasSkippedMedia) {');
if (blockStart !== -1) {
  const nextFunc = content.indexOf('window.exportMaintenanceSearchResultsPdf', blockStart);
  if (nextFunc !== -1) {
    content = content.substring(0, blockStart) + content.substring(nextFunc);
  }
}

fs.writeFileSync(path, content, 'utf8');
