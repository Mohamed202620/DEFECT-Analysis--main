const fs = require('fs');
const path = 'js/ticketsBoard.js';
let content = fs.readFileSync(path, 'utf8');

content = "import { exportToPdf, PAGE_BREAK_CLASS } from './services/exportUtility.js';\n" + content;

const startPdf = content.indexOf('window.generateMonthlyReport = async function () {');
const endPdf = content.indexOf('// ============================================================', startPdf);

const newPdfCode = `window.generateMonthlyReport = async function () {
  const btn = document.getElementById("monthlyReportBtn");
  const originalLabel = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري تجهيز التقرير...";
  }

  try {
    const role = getCurrentRole();
    const myName = localStorage.getItem("name") || "";
    const myUid = localStorage.getItem("userId") || "";
    const since = new Date();
    since.setDate(since.getDate() - 30);
    
    const result = await fetchTicketsForReportApi({
      role, myName, myUid, sinceISO: since.toISOString()
    });
    
    if (result.status !== "success") {
      alert(tr.reportGenerateError);
      return;
    }
    
    const tickets = result.data;
    if (!tickets.length) {
      alert(tr.reportNoData);
      return;
    }
    
    const ticketsWithImages = [];
    for (const ticket of tickets) {
      const firstImage = getTicketImages(ticket)[0] || null;
      const dataUrl = firstImage ? await loadTicketImageAsCompressedDataUrl(firstImage) : null;
      ticketsWithImages.push({ ticket, dataUrl });
    }
    
    const isAr = (window.currentLang || "ar") === "ar";
    
    let blocksHtml = ticketsWithImages.map(({ ticket, dataUrl }) => {
      let html = buildTicketReportBlockHtml(ticket, dataUrl);
      return html.replace(/<div style="border:1px solid #cbd5e1;/, \`<div class="\${PAGE_BREAK_CLASS}" style="border:1px solid #cbd5e1;\`);
    }).join("");
    
    let summaryTableHtml = buildTicketReportSummaryTableHtml(tickets);
    summaryTableHtml = summaryTableHtml.replace(/<table /, \`<table class="\${PAGE_BREAK_CLASS}" \`);

    const closedCount = tickets.filter(t => t.status === "closed").length;
    const resolvedCount = tickets.filter(t => t.status === "resolved").length;
    const inProgressCount = tickets.filter(t => t.status === "in_progress" || t.status === "assigned").length;
    const pendingCount = tickets.length - closedCount - resolvedCount - inProgressCount;

    const cardsHtml = buildPdfStatsCardsHtml([
      { label: isAr ? "إجمالي البلاغات" : "Total", value: tickets.length, color: "#2563eb", bg: "#eff6ff" },
      { label: isAr ? "معلقة / قيد الانتظار" : "Pending", value: pendingCount, color: "#dc2626", bg: "#fef2f2" },
      { label: isAr ? "جاري العمل" : "In Progress", value: inProgressCount, color: "#d97706", bg: "#fffbeb" },
      { label: isAr ? "مغلقة / تم الحل" : "Closed", value: closedCount + resolvedCount, color: "#059669", bg: "#ecfdf5" }
    ]);

    const htmlContent = \`
      \${cardsHtml}
      \${summaryTableHtml}
      \${blocksHtml}
    \`;

    const title = isAr ? "🗓️ التقرير الشهري لأعطال الصيانة" : "🗓️ Maintenance Monthly Report";
    const filename = \`\${tr.reportFileName}-\${new Date().toISOString().slice(0, 10)}.pdf\`;

    const infoRows = [
      { label: isAr ? "الفترة" : "Period", value: isAr ? "آخر 30 يوم" : "Last 30 days" }
    ];

    await exportToPdf(title, infoRows, htmlContent, filename);

  } catch (error) {
    console.error("Error generating monthly report:", error);
    alert(tr.reportGenerateError);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }
};
`;

let finalContent = content.substring(0, startPdf) + newPdfCode;
if (endPdf !== -1) {
    finalContent += "\n" + content.substring(endPdf);
} else {
    // If it's the last function in the file
}

fs.writeFileSync(path, finalContent, 'utf8');
