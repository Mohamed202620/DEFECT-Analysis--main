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

export async function exportToExcel(title, headers, rows, filename, options = {}) {
  if (typeof window.ExcelJS === "undefined") {
    alert("❌ مكتبة ExcelJS غير محملة حالياً، تأكد من الاتصال بالإنترنت.");
    return;
  }

  // 1. Determine active application language
  const currentLang = window.currentLang || localStorage.getItem("lang") || "ar";
  const isAr = currentLang === "ar";
  
  // 2. Fetch user information, role and permissions
  const role = (getCurrentRole() || localStorage.getItem("role") || "user").toLowerCase();
  const userName = localStorage.getItem("name") || (isAr ? "مستخدم النظام" : "System User");
  const userPhone = localStorage.getItem("phone") || "";

  // Date formatting for the sub-header (e.g., 26 / 7 / 2026)
  const now = new Date();
  const defaultDateStr = `${now.getDate()} / ${now.getMonth() + 1} / ${now.getFullYear()}`;
  const docDate = options.date || defaultDateStr;
  const docShift = options.shift || (localStorage.getItem("shift") ? localStorage.getItem("shift") : "1");
  const docIssuingNo = options.issuingNo || options.issueNo || `${Math.floor(100 + (now.getTime() % 900))}`;
  const formCode = options.formCode || "MS/ENG/Form/IR-01";
  const formRevision = options.formRevision || "Rev. 02   Issue Date: 1 Jan 2017";

  const wb = new window.ExcelJS.Workbook();
  wb.creator = `${userName} - MSCANCO`;
  wb.lastModifiedBy = `${userName} - MSCANCO`;
  wb.created = new Date();
  wb.modified = new Date();

  // Support either single-sheet or multi-sheet
  const sheetsToCreate = options.sheets && options.sheets.length > 0
    ? options.sheets
    : [{ sheetName: options.sheetName || (isAr ? "سجل البيانات" : "Data Log"), title, headers, rows }];

  // Preload company logo (High-Resolution)
  let logoB64 = null;
  try {
    logoB64 = await getCompanyLogoDataUrl();
  } catch (e) {
    console.warn("Could not load company logo for Excel header", e);
  }

  for (const sheetConfig of sheetsToCreate) {
    const sTitle = sheetConfig.title || title;
    let sHeaders = [...(sheetConfig.headers || headers)];
    let sRows = (sheetConfig.rows || rows).map(r => [...r]);
    const sName = sheetConfig.sheetName || (isAr ? "التقرير" : "Report");

    // Ensure Sequential Numbering (S/N or م) starting strictly at 1
    const hasSeqCol = sHeaders.length > 0 && (sHeaders[0] === "S/N" || sHeaders[0] === "#" || sHeaders[0] === "م" || sHeaders[0] === "ت" || sHeaders[0].toLowerCase() === "seq");
    if (!hasSeqCol) {
      sHeaders.unshift("S/N");
      sRows = sRows.map((row, idx) => [idx + 1, ...row]);
    } else {
      sRows = sRows.map((row, idx) => {
        row[0] = idx + 1;
        return row;
      });
    }

    const totalCols = Math.max(sHeaders.length, 10);

    const ws = wb.addWorksheet(sName, {
      views: [{
        rightToLeft: isAr,
        state: "frozen",
        ySplit: 5,
        showGridLines: true
      }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "5:5",
        margins: {
          left: 0.3, right: 0.3, top: 0.4, bottom: 0.4,
          header: 0.2, footer: 0.2
        }
      }
    });

    // Row heights matching the official printed slip exactly
    ws.getRow(1).height = 24; // Arabic Corporate Name + Logo
    ws.getRow(2).height = 20; // English Corporate Name + ISO certification
    ws.getRow(3).height = 26; // Document Title (e.g. / MRO ISSUE SLIP - STOCK ITEMS)
    ws.getRow(4).height = 24; // Metadata Sub-Header (Date: ... | Shift: ... | Issuing #: ...)
    ws.getRow(5).height = 28; // Table Columns Header Row

    // 1. Embed Corporate Logo in Header (Rows 1-2, Col A-B)
    if (logoB64 && logoB64.startsWith("data:image/")) {
      try {
        const extension = logoB64.includes("png") ? "png" : "jpeg";
        const imageId = wb.addImage({
          base64: logoB64,
          extension: extension,
        });
        
        ws.addImage(imageId, {
          tl: { col: 0.05, row: 0.05 },
          ext: { width: 140, height: 48 },
          editAs: "oneCell"
        });
      } catch (imgErr) {
        console.warn("Error embedding logo into worksheet", imgErr);
      }
    }

    // Partition column indexes for top header (Logo | Company Name | Quality Seals)
    const midColStart = Math.min(3, Math.max(2, Math.floor(totalCols * 0.25)));
    const midColEnd = Math.max(midColStart, totalCols - 2);
    const rightColStart = midColEnd + 1;
    const rightColEnd = totalCols;

    // Row 1: Arabic Corporate Name
    // "شركة محمود سعيد وشركاه المحدودة (إحدى شركات مجموعة محمود سعيد المحدودة)"
    ws.mergeCells(1, midColStart, 1, midColEnd);
    const brandArCell = ws.getCell(1, midColStart);
    brandArCell.value = "شركة محمود سعيد وشركاه المحدودة  (إحدى شركات مجموعة محمود سعيد المحدودة)";
    brandArCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0B3D91" } };
    brandArCell.alignment = { horizontal: "center", vertical: "middle" };

    // Row 2: English Corporate Name
    // "Mahmoud Saeed & Partners - CanMaking Factory (subsidiary of Mahmoud Saeed Group Ltd.)"
    ws.mergeCells(2, midColStart, 2, midColEnd);
    const brandEnCell = ws.getCell(2, midColStart);
    brandEnCell.value = "Mahmoud Saeed & Partners - CanMaking Factory (subsidiary of Mahmoud Saeed Group Ltd.)";
    brandEnCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E293B" } };
    brandEnCell.alignment = { horizontal: "center", vertical: "middle" };

    // Right Corner (Rows 1-2): Quality Seals / ISO Certified Info
    if (rightColStart <= rightColEnd) {
      ws.mergeCells(1, rightColStart, 2, rightColEnd);
      const qualityCell = ws.getCell(1, rightColStart);
      qualityCell.value = "CERTIFIED ISO 9001:2015\nFSSC 22000 | ISO 14001\nISO 45001:2018 (SGS)";
      qualityCell.font = { name: "Arial", size: 7.5, bold: true, italic: true, color: { argb: "FF475569" } };
      qualityCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    // Row 3: Official Document Title Bar (e.g. / MRO ISSUE SLIP - STOCK ITEMS)
    ws.mergeCells(3, 1, 3, totalCols);
    const titleCell = ws.getCell("A3");
    let displayTitle = sTitle.trim();
    if (!displayTitle.startsWith("/")) {
      displayTitle = `/ ${displayTitle}`;
    }
    titleCell.value = displayTitle.toUpperCase();
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF0F172A" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "medium", color: { argb: "FF0F172A" } }
    };

    // Row 4: Sub-Header Information Bar: Date: ... | Shift: ... | Issuing #: ...
    const dateSpanEnd = Math.max(2, Math.floor(totalCols * 0.35));
    const shiftSpanStart = dateSpanEnd + 1;
    const shiftSpanEnd = Math.max(shiftSpanStart, Math.floor(totalCols * 0.70));
    const issueSpanStart = shiftSpanEnd + 1;
    const issueSpanEnd = totalCols;

    // Date Block (Left)
    ws.mergeCells(4, 1, 4, dateSpanEnd);
    const dateCell = ws.getCell(4, 1);
    dateCell.value = `Date:   ${docDate}`;
    dateCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    dateCell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle" };

    // Shift Block (Center)
    ws.mergeCells(4, shiftSpanStart, 4, shiftSpanEnd);
    const shiftCell = ws.getCell(4, shiftSpanStart);
    shiftCell.value = `Shift:   ${docShift}`;
    shiftCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    shiftCell.alignment = { horizontal: "center", vertical: "middle" };

    // Issuing # Block (Right)
    ws.mergeCells(4, issueSpanStart, 4, issueSpanEnd);
    const issueCell = ws.getCell(4, issueSpanStart);
    issueCell.value = `Issuing #:   ${docIssuingNo}`;
    issueCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    issueCell.alignment = { horizontal: isAr ? "left" : "right", vertical: "middle" };

    // Apply clean border around Sub-Header Row
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(4, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: c === 1 ? { style: "medium", color: { argb: "FF0F172A" } } : undefined,
        right: c === totalCols ? { style: "medium", color: { argb: "FF0F172A" } } : undefined
      };
    }

    // Row 5: Table Column Headers
    const headerRow = ws.getRow(5);
    headerRow.values = sHeaders;
    headerRow.height = 28;

    headerRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      if (colIdx <= totalCols) {
        cell.font = { name: "Arial", bold: true, color: { argb: "FF0F172A" }, size: 9.5 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF0F172A" } },
          left: { style: "thin", color: { argb: "FF334155" } },
          bottom: { style: "medium", color: { argb: "FF0F172A" } },
          right: { style: "thin", color: { argb: "FF334155" } }
        };
      }
    });

    // Auto-Filter on Headers
    ws.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: sHeaders.length }
    };

    // Detect column indexes for specialized formatting
    const statusColIdx = sHeaders.findIndex(h => h.includes("الحالة") || h.toLowerCase().includes("status")) + 1;
    const priorityColIdx = sHeaders.findIndex(h => h.includes("الأولوية") || h.toLowerCase().includes("priority")) + 1;
    const attachColIdx = sHeaders.findIndex(h => h.includes("روابط") || h.includes("مرفقات") || h.toLowerCase().includes("attach") || h.toLowerCase().includes("media")) + 1;
    const codeColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("item code") || h.includes("كود الصنف") || h.includes("رقم البلاغ") || h.includes("رقم السجل") || h.toLowerCase().includes("id")) + 1;
    const descColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("description") || h.includes("الوصف") || h.includes("البيان") || h.includes("عنوان")) + 1;
    const qtyColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("qty") || h.includes("الكمية") || h.includes("العدد")) + 1;
    const uomColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("uom") || h.includes("الوحدة")) + 1;
    const costColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("cost") || h.toLowerCase().includes("price") || h.includes("السعر") || h.includes("التكلفة")) + 1;
    const machineColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("machine") || h.includes("الماكينة")) + 1;
    const lineColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("line") || h.includes("الخط")) + 1;
    const costCenterColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("cost center") || h.includes("مركز التكلفة")) + 1;
    const receiverColIdx = sHeaders.findIndex(h => h.toLowerCase().includes("received by") || h.includes("المستلم") || h.includes("اسم الفني") || h.includes("بواسطة") || h.toLowerCase().includes("by")) + 1;

    // Populate Data Rows with Official Form Grid Lines
    sRows.forEach((rowData, rIdx) => {
      const row = ws.addRow(rowData);
      const isEven = rIdx % 2 === 0;
      row.height = 24;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= totalCols) {
          cell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" }
          };

          // Precise alignments matching engineering slip
          if (colNumber === 1) { // S/N
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
          } else if (colNumber === codeColIdx || colNumber === qtyColIdx || colNumber === uomColIdx || colNumber === machineColIdx || colNumber === lineColIdx || colNumber === costCenterColIdx || colNumber === statusColIdx || colNumber === priorityColIdx) {
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            if (colNumber === codeColIdx || colNumber === costCenterColIdx) {
              cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
            }
          } else if (colNumber === costColIdx) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else if (colNumber === descColIdx) {
            cell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle", wrapText: true };
          } else if (colNumber === receiverColIdx) {
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          } else {
            cell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle", wrapText: true };
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FF94A3B8" } },
            left: { style: "thin", color: { argb: "FF94A3B8" } },
            bottom: { style: "thin", color: { argb: "FF94A3B8" } },
            right: { style: "thin", color: { argb: "FF94A3B8" } }
          };

          // Status Badge Styling (Soft, Professional Highlights)
          if (colNumber === statusColIdx && cell.value) {
            const val = cell.value.toString().toLowerCase();
            if (val.includes("مغلق") || val.includes("منفذ") || val.includes("closed") || val.includes("done") || val.includes("مكتمل") || val.includes("إصلاح") || val.includes("resolved") || val.includes("معتمد") || val.includes("approved")) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
              cell.font = { name: "Arial", color: { argb: "FF15803D" }, bold: true, size: 9.5 };
            } else if (val.includes("مفتوح") || val.includes("بلاغ") || val.includes("open") || val.includes("ticket") || val.includes("جديد") || val.includes("معلق") || val.includes("pending")) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
              cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9.5 };
            } else if (val.includes("مستمر") || val.includes("جار") || val.includes("progress") || val.includes("assign") || val.includes("مسند") || val.includes("مراجعة") || val.includes("review")) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
              cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9.5 };
            }
          }

          // Attachments Hyperlinks
          if (colNumber === attachColIdx && cell.value) {
            const val = cell.value.toString();
            if (val.includes("http")) {
              const urls = val.split(" | ").filter(u => u.startsWith("http"));
              if (urls.length > 0) {
                const firstUrl = urls[0];
                const extraCount = urls.length - 1;
                cell.value = {
                  text: isAr ? "📎 فتح المرفق" + (extraCount > 0 ? ` (+${extraCount})` : "") 
                             : "📎 View Attachment" + (extraCount > 0 ? ` (+${extraCount})` : ""),
                  hyperlink: firstUrl,
                  tooltip: firstUrl
                };
                cell.font = { name: "Arial", color: { argb: "FF1D4ED8" }, underline: true, bold: true, size: 9.5 };
              }
            }
          }
        }
      });
    });

    // If rows are fewer than 10, fill empty grid rows for true pre-printed slip resemblance
    const minRows = options.minRows !== undefined ? options.minRows : (sRows.length < 10 ? 10 : sRows.length);
    if (sRows.length < minRows) {
      for (let emptyIdx = sRows.length + 1; emptyIdx <= minRows; emptyIdx++) {
        const emptyRowValues = new Array(totalCols).fill("");
        emptyRowValues[0] = emptyIdx; // Sequential numbering in column 1
        const emptyRow = ws.addRow(emptyRowValues);
        emptyRow.height = 22;

        emptyRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= totalCols) {
            cell.font = { name: "Arial", size: 9, color: { argb: "FF64748B" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin", color: { argb: "FFCBD5E1" } },
              left: { style: "thin", color: { argb: "FFCBD5E1" } },
              bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
              right: { style: "thin", color: { argb: "FFCBD5E1" } }
            };
          }
        });
      }
    }

    // Spacer Row
    const spacerRow = ws.addRow([]);
    spacerRow.height = 14;

    // Signatures Section (3 Columns: Issued by / Approved by / Revised by)
    const sigRowNumber = ws.rowCount + 1;
    ws.addRow([]); // Create signature row
    const sigRow = ws.getRow(sigRowNumber);
    sigRow.height = 36;

    const sigCol1End = Math.max(2, Math.floor(totalCols * 0.33));
    const sigCol2Start = sigCol1End + 1;
    const sigCol2End = Math.max(sigCol2Start, Math.floor(totalCols * 0.67));
    const sigCol3Start = sigCol2End + 1;
    const sigCol3End = totalCols;

    // 1. Issued by
    ws.mergeCells(sigRowNumber, 1, sigRowNumber, sigCol1End);
    const issuedCell = ws.getCell(sigRowNumber, 1);
    const issuedName = options.issuedBy || userName || "";
    issuedCell.value = `Issued by /   ${issuedName} ....................................`;
    issuedCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    issuedCell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle" };

    // 2. Approved by
    ws.mergeCells(sigRowNumber, sigCol2Start, sigRowNumber, sigCol2End);
    const approvedCell = ws.getCell(sigRowNumber, sigCol2Start);
    const approvedName = options.approvedBy || "";
    approvedCell.value = `Approved by /   ${approvedName} ....................................`;
    approvedCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    approvedCell.alignment = { horizontal: "center", vertical: "middle" };

    // 3. Revised by
    ws.mergeCells(sigRowNumber, sigCol3Start, sigRowNumber, sigCol3End);
    const revisedCell = ws.getCell(sigRowNumber, sigCol3Start);
    const revisedName = options.revisedBy || "";
    revisedCell.value = `Revised by /   ${revisedName} ....................................`;
    revisedCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    revisedCell.alignment = { horizontal: isAr ? "left" : "right", vertical: "middle" };

    // Bottom Document Control Footer (MS/ENG/Form/IR-01 & Rev. 02 Issue Date: 1 Jan 2017)
    const docControlRowNumber = ws.rowCount + 1;
    ws.addRow([]);
    const docControlRow = ws.getRow(docControlRowNumber);
    docControlRow.height = 18;

    const docCtrlMid = Math.floor(totalCols / 2);

    // Left Footer: Form Code
    ws.mergeCells(docControlRowNumber, 1, docControlRowNumber, docCtrlMid);
    const formCodeCell = ws.getCell(docControlRowNumber, 1);
    formCodeCell.value = formCode;
    formCodeCell.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF475569" } };
    formCodeCell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle" };

    // Right Footer: Revision & Issue Date
    ws.mergeCells(docControlRowNumber, docCtrlMid + 1, docControlRowNumber, totalCols);
    const formRevCell = ws.getCell(docControlRowNumber, docCtrlMid + 1);
    formRevCell.value = formRevision;
    formRevCell.font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
    formRevCell.alignment = { horizontal: isAr ? "left" : "right", vertical: "middle" };

    // Auto-fit Columns Width with Mathematical Content Calculation
    ws.columns.forEach((column, colIdx) => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= 5 && rowNumber < sigRowNumber) {
          const cellVal = cell.value;
          let cellLen = 0;
          if (cellVal && cellVal.text) {
            cellLen = cellVal.text.length + 4;
          } else if (cellVal) {
            const lines = cellVal.toString().split("\n");
            lines.forEach(l => {
              const weightedLen = Math.ceil(l.length * 1.15);
              if (weightedLen > cellLen) cellLen = weightedLen;
            });
          }
          if (cellLen > maxLen) maxLen = cellLen;
        }
      });

      if (colIdx === 0) {
        column.width = 7; // Column S/N
      } else {
        column.width = Math.min(Math.max(maxLen + 4, 13), 45);
      }
    });
  }

  // Generate buffer and trigger download safely
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  
  let finalFilename = filename || `mscanco-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  if (finalFilename.endsWith(".csv")) {
    finalFilename = finalFilename.replace(".csv", ".xlsx");
  } else if (!finalFilename.endsWith(".xlsx")) {
    finalFilename += ".xlsx";
  }

  downloadBlobFile(blob, finalFilename);
}

/**
 * دالة مساعدة عامة وموثوقة لتنزيل ملفات Blob عبر كل بيئات المتصفحات والأجهزة المحمولة وداخل الـ iframe
 */
export async function downloadBlobFile(blob, filename) {
  const isEn = window.currentLang === 'en';
  const isAr = !isEn;

  // 1. دعم متصفحات قديمة إذا وجدت
  if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === 'function') {
    window.navigator.msSaveOrOpenBlob(blob, filename);
    showDownloadSuccessToast(null, null, filename, isEn);
    return;
  }

  // 2. تحويل الـ Blob إلى Base64 Data URL لتجاوز حظر blob: URLs الصادر عن sandbox المتصفح داخل الـ iframe
  let dataUrl = null;
  try {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Could not convert blob to Data URL:", e);
  }

  // 3. إنشاء Blob URL أيضاً
  let blobUrl = null;
  try {
    blobUrl = URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Could not create object URL:", e);
  }

  const effectiveDownloadUrl = dataUrl || blobUrl;

  // 4. المحاولة التلقائية المباشرة
  if (effectiveDownloadUrl) {
    try {
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = effectiveDownloadUrl;
      a.setAttribute("download", filename);
      a.target = "_self";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
      }, 1000);
    } catch (err) {
      console.warn("Direct programmatic click was blocked or limited by browser sandbox:", err);
    }
  }

  // 5. إظهار نافذة/شريط التنزيل المباشر دائماً لتمكين المستخدم من النقر المباشر
  showDownloadSuccessToast(effectiveDownloadUrl, blobUrl, filename, isEn);

  // إبقاء الرابط حياً
  if (blobUrl) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 180000);
  }
}

/**
 * شريط تفاعلي عائم يظهر فور تجهيز الملف مع زر تنزيل مباشر في حال واجه المستخدم إذن أو حجب في الـ iframe
 */
function showDownloadSuccessToast(dataOrBlobUrl, blobUrl, filename, isEn) {
  // إزالة أي إشعار سابق
  const existing = document.getElementById("mscanco-download-toast");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = "mscanco-download-toast";
  toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[94%] bg-[#0f172a] border-2 border-emerald-500 shadow-2xl rounded-2xl p-4 text-white flex flex-col gap-3";
  toast.dir = isEn ? "ltr" : "rtl";

  const targetUrl = dataOrBlobUrl || blobUrl;

  toast.innerHTML = `
    <div class="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
      <div class="flex items-center gap-2.5">
        <span class="text-2xl">📊</span>
        <div>
          <div class="text-sm font-black text-emerald-400">${isEn ? 'Excel Report Ready!' : 'تم تجهيز ملف الإكسيل بنجاح'}</div>
          <div class="text-[11px] text-gray-300 font-mono font-medium truncate max-w-[240px]">${filename}</div>
        </div>
      </div>
      <button type="button" onclick="document.getElementById('mscanco-download-toast')?.remove()" class="text-gray-400 hover:text-white text-sm px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg">✕</button>
    </div>
    
    <div class="flex flex-col gap-2">
      ${targetUrl ? `
        <a id="mscanco-direct-dl-btn" href="${targetUrl}" download="${filename}" class="w-full text-center py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer no-underline border border-emerald-400/30">
          <span class="text-lg">📥</span>
          <span>${isEn ? 'Click Here to Download File' : 'انقر هنا لتنزيل الملف إلى جهازك مباشرة'}</span>
        </a>
      ` : ''}
    </div>
    
    <div class="text-[10px] text-gray-300 leading-normal text-center bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
      ${isEn 
        ? '💡 Note: If your browser shows a "permission needed" or download prompt, please choose <b>"Allow"</b> or click the green button above.' 
        : '💡 تنبيه: إذا ظهرت رسالة تطلب إذناً من المتصفح، اختر <b>"سماح" (Allow)</b>، أو اضغط الزر الأخضر أعلاه لحفظ الملف فوراً.'}
    </div>
  `;

  document.body.appendChild(toast);

  // إخفاء تلقائي بعد 35 ثانية
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add("opacity-0", "transition-opacity", "duration-500");
      setTimeout(() => toast.remove(), 500);
    }
  }, 35000);
}

