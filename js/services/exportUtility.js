import { getCurrentRole } from '../permissions.js';
import { buildPdfBrandHeaderHtml, buildPdfTitleBlockHtml, buildPdfSignatureBlockHtml, getCompanyLogoDataUrl } from '../branding.js';

export const PAGE_BREAK_CLASS = "no-page-break";

export async function exportToPdf(title, rows, htmlContent, filename, sigLabels = null) {
  if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
    alert("❌ مكتبات إنشاء PDF غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول تاني.");
    return;
  }
  
  const logoDataUrl = await getCompanyLogoDataUrl();
  const currentLang = window.currentLang || "ar";
  const isAr = currentLang === "ar";
  const role = getCurrentRole();
  const userName = localStorage.getItem("name") || "";
  const roleLabel = { admin: isAr ? "مدير النظام" : "System Admin", manager: isAr ? "مدير الإنتاج" : "Production Manager", engineer: isAr ? "مهندس" : "Engineer" }[role] || (isAr ? "فني" : "Technician");
  
  const dateStr = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US");
  const exportDateLabel = isAr ? "تاريخ التصدير" : "Export Date";
  const roleHeaderLabel = isAr ? "الصلاحية" : "Role";
  const userNameLabel = isAr ? "بواسطة" : "By";
  
  const defaultInfoRows = [
    { label: exportDateLabel, value: dateStr },
    { label: roleHeaderLabel, value: roleLabel },
    { label: userNameLabel, value: userName },
    ...rows
  ];
  
  const container = document.createElement('div');
  // نحدد عرض ثابت ومناسب للورقة لضمان دقة التقاط الشاشة
  container.style.width = '794px';
  container.style.boxSizing = 'border-box';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Tahoma, sans-serif';
  container.dir = isAr ? 'rtl' : 'ltr';
  
  // يجب أن يكون العنصر داخل الـ DOM لكي يقوم المتصفح بدمج الحروف العربية بشكل صحيح
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  
  const styleHtml = `
    <style>
      .no-page-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .logo-print-wrapper {
         text-align: center;
         margin-bottom: 20px;
      }
      .logo-print-wrapper img {
        object-fit: contain !important;
        height: 120px !important;
        max-height: 120px !important;
        width: auto !important;
      }
      table {
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      td, th, p, span, div {
        word-wrap: break-word !important;
        white-space: normal !important;
      }
      * {
        letter-spacing: normal !important;
      }
    </style>
  `;
  
  const sig1 = sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature");
  const sig2 = sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature");
  const sig3 = sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature");

  container.innerHTML = `
    ${styleHtml}
    <div class="logo-print-wrapper">
      ${buildPdfBrandHeaderHtml(logoDataUrl)}
    </div>
    ${buildPdfTitleBlockHtml(title, defaultInfoRows)}
    <div style="margin-top: 20px;">
      ${htmlContent}
    </div>
    ${buildPdfSignatureBlockHtml({ firstLabel: sig1, secondLabel: sig2, thirdLabel: sig3 })}
  `;
  
  document.body.appendChild(container);
  
  // ننتظر قليلاً لضمان تحميل الخطوط وتطبيق المتصفح لاتجاه وحروف اللغة العربية (Text Shaping)
  await new Promise(r => setTimeout(r, 150));
  
  try {
    const canvas = await window.html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794
    });
    
    document.body.removeChild(container);
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 20; 
    const contentWidth = pdfWidth - (margin * 2);
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const ratio = contentWidth / imgWidth;
    const printHeight = imgHeight * ratio;
    const pageContentHeight = pdfHeight - (margin * 2);
    
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    
    let heightLeft = printHeight;
    let position = margin;
    let page = 1;
    
    const addFooter = (p, current, total) => {
      p.setFontSize(10);
      p.setTextColor(100);
      // استخدمنا الإنجليزية والأرقام فقط لتجنب تشوه الخط الافتراضي لـ jsPDF مع العربية
      const text = `Page ${current} / ${total}`;
      p.text(text, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
    };
    
    const totalPages = Math.ceil(printHeight / pageContentHeight);
    
    pdf.addImage(imgData, "JPEG", margin, position, contentWidth, printHeight);
    heightLeft -= pageContentHeight;
    addFooter(pdf, page++, totalPages);
    
    while (heightLeft > 0) {
      position -= pageContentHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, contentWidth, printHeight);
      addFooter(pdf, page++, totalPages);
      heightLeft -= pageContentHeight;
    }
    
    pdf.save(filename);
  } catch (err) {
    console.error("PDF generation error:", err);
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    alert("حدث خطأ أثناء تصدير الـ PDF. يرجى المحاولة مرة أخرى.");
  }
}

export async function exportToExcel(title, headers, rows, filename) {
  if (typeof window.ExcelJS === "undefined") {
    alert("❌ مكتبة ExcelJS غير محملة حالياً، تأكد من الاتصال بالإنترنت.");
    return;
  }

  const currentLang = window.currentLang || "ar";
  const isAr = currentLang === "ar";
  
  const role = getCurrentRole();
  const userName = localStorage.getItem("name") || "";
  const roleLabel = { admin: isAr ? "مدير النظام" : "System Admin", manager: isAr ? "مدير الإنتاج" : "Production Manager", engineer: isAr ? "مهندس" : "Engineer" }[role] || (isAr ? "فني" : "Technician");
  
  const exportDateStr = new Date().toLocaleString(isAr ? "ar-EG" : "en-US");
  const exportedAtStr = isAr ? "تاريخ ووقت التصدير: " : "Exported At: ";
  const exportedByStr = isAr ? "تم التصدير بواسطة: " : "Exported By: ";

  const wb = new window.ExcelJS.Workbook();
  wb.creator = userName;
  wb.created = new Date();
  
  // Freeze at row 8
  const ws = wb.addWorksheet(isAr ? 'التقرير' : 'Report', {
    views: [{ rightToLeft: isAr, state: 'frozen', ySplit: 8 }]
  });

  // 1. Add Logo
  try {
    const logoB64 = await getCompanyLogoDataUrl();
    if (logoB64) {
      const extension = logoB64.substring(logoB64.indexOf('/') + 1, logoB64.indexOf(';'));
      const imageId = wb.addImage({
        base64: logoB64,
        extension: extension === 'jpeg' ? 'jpeg' : 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 140, height: 60 } // Standard logo size
      });
    }
  } catch (e) {
    console.warn("Could not load logo for Excel", e);
  }

  // Title Row (Row 5)
  ws.getRow(5).values = [title];
  ws.mergeCells('A5:E5');
  const titleCell = ws.getCell('A5');
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }; // Navy blue
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Info Rows (6 and 7)
  ws.getRow(6).values = [`${exportedAtStr}${exportDateStr}`];
  ws.getRow(7).values = [`${exportedByStr}${userName} (${roleLabel})`];
  
  ws.getRow(6).font = { color: { argb: 'FF4B5563' }, italic: true, size: 10 };
  ws.getRow(7).font = { color: { argb: 'FF4B5563' }, italic: true, size: 10 };

  // Headers (Row 8)
  const headerRow = ws.getRow(8);
  headerRow.values = headers;
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Navy Blue background
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Auto-Filter
  ws.autoFilter = {
    from: { row: 8, column: 1 },
    to: { row: 8, column: headers.length }
  };

  // Detect status and attachments columns dynamically based on text
  const statusColIdx = headers.findIndex(h => h.includes('الحالة') || h.toLowerCase().includes('status')) + 1;
  const attachColIdx = headers.findIndex(h => h.includes('روابط') || h.toLowerCase().includes('attach')) + 1;

  // Data Rows
  rows.forEach(rowData => {
    const row = ws.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      // Standard styling
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: isAr ? 'right' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Conditional Styling for Status
      if (colNumber === statusColIdx && cell.value) {
        const val = cell.value.toString().toLowerCase();
        if (val.includes('مغلق') || val.includes('منفذ') || val.includes('closed') || val.includes('done') || val.includes('مكتمل')) {
          cell.font = { color: { argb: 'FF16A34A' }, bold: true }; // Green
        } else if (val.includes('مفتوح') || val.includes('بلاغ') || val.includes('open') || val.includes('ticket') || val.includes('جديد')) {
          cell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
        } else if (val.includes('مستمر') || val.includes('جار') || val.includes('progress') || val.includes('assign') || val.includes('مسند')) {
          cell.font = { color: { argb: 'FFD97706' }, bold: true }; // Orange
        } else {
          cell.font = { bold: true };
        }
      }

      // Hyperlinks for Attachments
      if (colNumber === attachColIdx && cell.value) {
        const val = cell.value.toString();
        if (val.includes('http')) {
          // Extract URLs
          const urls = val.split(' | ').filter(u => u.startsWith('http'));
          if (urls.length > 0) {
            const firstUrl = urls[0];
            const extraCount = urls.length - 1;
            cell.value = {
              text: isAr ? '📎 فتح المرفق' + (extraCount > 0 ? ` (+${extraCount})` : '') 
                         : '📎 Open File' + (extraCount > 0 ? ` (+${extraCount})` : ''),
              hyperlink: firstUrl,
              tooltip: firstUrl
            };
            cell.font = { color: { argb: 'FF2563EB' }, underline: true, bold: true };
          }
        }
      }
    });
  });

  // Auto-fit Columns width
  ws.columns.forEach((column, i) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= 8) { // Only measure headers and data
         const cellVal = cell.value;
         let cellLen = 0;
         if (cellVal && cellVal.text) { // hyperlink object
           cellLen = cellVal.text.length + 5; 
         } else if (cellVal) {
           const lines = cellVal.toString().split('\n');
           lines.forEach(l => { if (l.length > cellLen) cellLen = l.length; });
         }
         if (cellLen > maxLen) maxLen = cellLen;
      }
    });
    // Add extra padding and cap width
    column.width = Math.min(Math.max(maxLen + 4, 15), 65); 
  });

  // Generate Buffer and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  
  let finalFilename = filename;
  if(finalFilename.endsWith('.csv')) {
    finalFilename = finalFilename.replace('.csv', '.xlsx');
  } else if (!finalFilename.endsWith('.xlsx')) {
    finalFilename += '.xlsx';
  }
  
  a.setAttribute("download", finalFilename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
