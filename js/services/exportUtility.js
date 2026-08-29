import { getCurrentRole, hasFullDataAccess } from '../permissions.js';
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
  container.style.width = '794px';
  container.style.boxSizing = 'border-box';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Tahoma, sans-serif';
  container.dir = isAr ? 'rtl' : 'ltr';
  
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

  const currentLang = window.currentLang || localStorage.getItem("lang") || "ar";
  const isAr = currentLang === "ar";
  
  const role = (getCurrentRole() || localStorage.getItem("role") || "user").toLowerCase();
  const userName = localStorage.getItem("name") || (isAr ? "مستخدم النظام" : "System User");
  const userPhone = localStorage.getItem("phone") || "";
  const rawPerms = localStorage.getItem("permissions") || "";
  const isFullAccess = hasFullDataAccess(role);

  const roleLabel = {
    admin: isAr ? "مدير النظام (Admin)" : "System Administrator",
    manager: isAr ? "مدير الإنتاج والعمليات (Manager)" : "Production & Operations Manager",
    engineer: isAr ? "مهندس صيانة (Engineer)" : "Maintenance Engineer",
    technician: isAr ? "فني صيانة (Technician)" : "Maintenance Technician",
    quality: isAr ? "مفتش جودة (Quality Inspector)" : "Quality Inspector"
  }[role] || (isAr ? `مستخدم (${role})` : `User (${role})`);

  let permSummaryText = "";
  if (role === "admin" || isFullAccess) {
    permSummaryText = isAr ? "صلاحيات كاملة (إدارة، تعديل، تصدير، اعتماد)" : "Full Access (Admin, Edit, Export, Approve)";
  } else if (rawPerms) {
    permSummaryText = isAr ? `صلاحيات مخصصة: ${rawPerms}` : `Custom Permissions: ${rawPerms}`;
  } else {
    permSummaryText = isAr ? "صلاحيات قياسية (عرض وإدخال)" : "Standard Access (View & Submit)";
  }

  const exportDateStr = new Date().toLocaleString(isAr ? "ar-EG" : "en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });

  const wb = new window.ExcelJS.Workbook();
  wb.creator = `${userName} - MSCANCO`;
  wb.lastModifiedBy = `${userName} - MSCANCO`;
  wb.created = new Date();
  wb.modified = new Date();

  const sheetsToCreate = options.sheets && options.sheets.length > 0
    ? options.sheets
    : [{ sheetName: options.sheetName || (isAr ? "سجل البيانات" : "Data Log"), title, headers, rows }];

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

    const hasSeqCol = sHeaders.length > 0 && (sHeaders[0] === "#" || sHeaders[0] === "م" || sHeaders[0] === "ت" || sHeaders[0].toLowerCase() === "seq");
    if (!hasSeqCol) {
      sHeaders.unshift(isAr ? "م" : "#");
      sRows = sRows.map((row, idx) => [idx + 1, ...row]);
    } else {
      sRows = sRows.map((row, idx) => {
        row[0] = idx + 1;
        return row;
      });
    }

    const totalCols = Math.max(sHeaders.length, 7);

    const NAVY = "FF0B3D91";
    const GOLD = "FFC9972E";
    const DARK = "FF1E293B";
    const LIGHT_GREY = "FFE2E8F0";
    const LIGHTER_GREY = "FFF8FAFC";
    const WHITE = "FFFFFFFF";
    const BLACK = "FF000000";

    const ws = wb.addWorksheet(sName, {
      pageSetup: {
        orientation: "landscape",
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.4, right: 0.4, top: 0.6, bottom: 0.6,
          header: 0.3, footer: 0.3
        }
      }
    });

    ws.getColumn(1).width = 9;
    ws.getColumn(2).width = 17;

    // ------------------------------------------------------------
    // Rows 1-3: Official Letterhead Header (مطابق للورق الرسمي)
    // ------------------------------------------------------------
    ws.getRow(1).height = 26;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 6; // مسافة الخط السفلي الفاصل

    // 1. إضافة شعار الشركة (MSCANCO) في أعلى اليسار
    let logoEmbedded = false;
    if (logoB64 && logoB64.startsWith("data:image/")) {
      try {
        const extension = logoB64.includes("png") ? "png" : "jpeg";
        const imageId = wb.addImage({ base64: logoB64, extension });
        ws.addImage(imageId, {
          tl: { col: 0.08, row: 0.1 },
          ext: { width: 160, height: 55 },
          editAs: "oneCell"
        });
        logoEmbedded = true;
      } catch (imgErr) {
        console.warn("Error embedding logo into worksheet", imgErr);
      }
    }

    if (!logoEmbedded) {
      const logoFallbackCell = ws.getCell(1, 1);
      logoFallbackCell.value = "MSCANCO";
      logoFallbackCell.font = { name: "Arial", size: 16, bold: true, color: { argb: NAVY } };
      logoFallbackCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    // تنظيف وتثبيت الخلفية البيضاء تحت الهيدر
    for (let rr = 5; rr <= 90; rr++) {
      for (let cc = 1; cc <= 2; cc++) {
        ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
      }
    }

    const brandColStart = 3;
    const brandColEnd = totalCols;

    // الصف 1: النص العربي المطابق للورق الرسمي
    ws.mergeCells(1, brandColStart, 1, brandColEnd);
    const brandArCell = ws.getCell(1, brandColStart);
    brandArCell.value = "شركة محمود سعيد وشركائه - مصنع علب المرطبات (إحدى شركات مجموعة محمود سعيد المحدودة)";
    brandArCell.font = { name: "Arial", size: 12.5, bold: true, color: { argb: BLACK } };
    brandArCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    // الصف 2: النص الإنجليزي المطابق للورق الرسمي
    ws.mergeCells(2, brandColStart, 2, brandColEnd);
    const brandEnCell = ws.getCell(2, brandColStart);
    brandEnCell.value = "Mahmoud Saeed & Partners - CanMaking Factory (subsidiary of Mahmoud Saeed Group Ltd.)";
    brandEnCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
    brandEnCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    // الصف 3: شهادات الجودة والأيزو المعتمدة
    ws.mergeCells(3, brandColStart, 3, brandColEnd);
    const certCell = ws.getCell(3, brandColStart);
    certCell.value = isAr
      ? "شهادات الجودة المعتمدة: FSSC 22000  |  ISO 9001:2015  |  ISO 14001:2015  |  ISO 45001:2018 (SGS)"
      : "Certified Standards: FSSC 22000  |  ISO 9001:2015  |  ISO 14001:2015  |  ISO 45001:2018 (SGS)";
    certCell.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
    certCell.alignment = { horizontal: "center", vertical: "middle" };

    // الصف 4: رسم الخط الأسود السميك الفاصل تحت الهيدر الرسمي كما هو في المطبوعات
    for (let col = 1; col <= totalCols; col++) {
      const lineCell = ws.getCell(4, col);
      lineCell.border = {
        bottom: { style: "medium", color: { argb: BLACK } }
      };
    }

    let r = 5;

    // ------------------------------------------------------------
    // Title bar — شريط عنوان التقرير
    // ------------------------------------------------------------
    ws.getRow(r).height = 28;
    ws.mergeCells(r, 1, r, totalCols);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = `📋 ${sTitle.toUpperCase()}`;
    titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: WHITE } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
    r++;

    // ------------------------------------------------------------
    // معلومات التقرير — Report Information
    // ------------------------------------------------------------
    ws.getRow(r).height = 20;
    ws.mergeCells(r, 1, r, totalCols);
    const infoSectionHeaderCell = ws.getCell(r, 1);
    infoSectionHeaderCell.value = isAr ? "📋 معلومات التقرير" : "📋 Report Information";
    infoSectionHeaderCell.font = { name: "Arial", size: 10, bold: true, color: { argb: NAVY } };
    infoSectionHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREY } };
    infoSectionHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
    infoSectionHeaderCell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
    r++;

    const labelColEnd = 2;
    const addInfoRow = (label, value) => {
      ws.getRow(r).height = 18;
      ws.mergeCells(r, 1, r, labelColEnd);
      const labelCell = ws.getCell(r, 1);
      labelCell.value = label;
      labelCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1E293B" } };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHTER_GREY } };
      labelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      labelCell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };

      ws.mergeCells(r, labelColEnd + 1, r, totalCols);
      const valueCell = ws.getCell(r, labelColEnd + 1);
      valueCell.value = value;
      valueCell.font = { name: "Arial", size: 9, color: { argb: "FF334155" } };
      valueCell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle", wrapText: true };
      valueCell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      r++;
    };

    addInfoRow(isAr ? "اسم التقرير" : "Report Name", sTitle);
    addInfoRow(isAr ? "نوع التقرير" : "Report Type", sName);
    addInfoRow(isAr ? "المستخدم الذي قام بالتصدير" : "Exported By", `${userName}${userPhone ? `  (${userPhone})` : ""}`);
    addInfoRow(isAr ? "الوظيفة / الدور" : "Role", roleLabel);
    addInfoRow(isAr ? "صلاحيات المستخدم" : "User Permissions", permSummaryText);
    addInfoRow(isAr ? "تاريخ ووقت الاستخراج" : "Generated On", exportDateStr);
    if (options.periodLabel) {
      addInfoRow(isAr ? "الفترة الزمنية" : "Date Range", options.periodLabel);
    }
    addInfoRow(isAr ? "عدد السجلات" : "Total Records", isAr ? `${sRows.length} سجل` : `${sRows.length} records`);
    if (Array.isArray(options.extraInfoRows)) {
      options.extraInfoRows.forEach(({ label, value }) => {
        if (label && (value || value === 0)) addInfoRow(label, value);
      });
    }

    ws.getRow(r).height = 14;
    ws.mergeCells(r, 1, r, totalCols);
    const sysTagCell = ws.getCell(r, 1);
    sysTagCell.value = "🏢 MSCANCO Industrial Operations System";
    sysTagCell.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF94A3B8" } };
    sysTagCell.alignment = { horizontal: "center", vertical: "middle" };
    sysTagCell.border = { bottom: { style: "medium", color: { argb: "FF94A3B8" } } };
    r++;

    // ------------------------------------------------------------
    // Data Table Header Row
    // ------------------------------------------------------------
    const tableHeaderRowNum = r;
    const headerRow = ws.getRow(tableHeaderRowNum);
    headerRow.values = sHeaders;
    headerRow.height = 30;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", bold: true, color: { argb: WHITE }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        right: { style: "thin", color: { argb: "FF475569" } }
      };
    });

    ws.views = [{
      rightToLeft: isAr,
      state: "frozen",
      ySplit: tableHeaderRowNum,
      showGridLines: true
    }];
    ws.pageSetup.printTitlesRow = `${tableHeaderRowNum}:${tableHeaderRowNum}`;

    ws.autoFilter = {
      from: { row: tableHeaderRowNum, column: 1 },
      to: { row: tableHeaderRowNum, column: sHeaders.length }
    };

    const statusColIdx = sHeaders.findIndex(h => h.includes("الحالة") || h.toLowerCase().includes("status")) + 1;
    const priorityColIdx = sHeaders.findIndex(h => h.includes("الأولوية") || h.toLowerCase().includes("priority")) + 1;
    const attachColIdx = sHeaders.findIndex(h => h.includes("روابط") || h.includes("مرفقات") || h.toLowerCase().includes("attach") || h.toLowerCase().includes("media")) + 1;
    const idColIdx = sHeaders.findIndex(h => (h.includes("رقم") || h.includes("كود") || h.toLowerCase().includes("id") || h.toLowerCase().includes("code")) && h !== "#" && h !== "م") + 1;
    const dateColIdx = sHeaders.findIndex(h => h.includes("تاريخ") || h.toLowerCase().includes("date")) + 1;
    const typeColIdx = sHeaders.findIndex(h => h.includes("النوع") || h.toLowerCase().includes("type")) + 1;

    sRows.forEach((rowData, rIdx) => {
      const row = ws.addRow(rowData);
      const isEven = rIdx % 2 === 0;
      row.height = 24;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? WHITE : LIGHTER_GREY }
        };

        if (colNumber === 1) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: NAVY } };
        } else if (colNumber === idColIdx || colNumber === dateColIdx || colNumber === typeColIdx || colNumber === statusColIdx || colNumber === priorityColIdx) {
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        } else {
          cell.alignment = { horizontal: isAr ? "right" : "left", vertical: "middle", wrapText: true };
        }

        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };

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
          } else if (val.includes("تعديل") || val.includes("revision")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" } };
            cell.font = { name: "Arial", color: { argb: "FFC2410C" }, bold: true, size: 9.5 };
          } else if (val.includes("مرفوض") || val.includes("rejected")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
            cell.font = { name: "Arial", color: { argb: "FF9F1239" }, bold: true, size: 9.5 };
          }
        }

        if (colNumber === priorityColIdx && cell.value) {
          const val = cell.value.toString().toLowerCase();
          if (val.includes("عالية") || val.includes("high") || val.includes("red")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
            cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9.5 };
          } else if (val.includes("متوسطة") || val.includes("medium") || val.includes("yellow")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
            cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9.5 };
          } else if (val.includes("منخفضة") || val.includes("low") || val.includes("green")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            cell.font = { name: "Arial", color: { argb: "FF475569" }, size: 9.5 };
          }
        }

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
      });
    });

    const summaryRow = ws.addRow([]);
    summaryRow.height = 24;
    const summaryRowNum = summaryRow.number;

    ws.mergeCells(summaryRowNum, 1, summaryRowNum, 2);
    const sumCellA = ws.getCell(summaryRowNum, 1);
    sumCellA.value = isAr ? `📊 الإجمالي: ${sRows.length} سجل` : `📊 Total: ${sRows.length} records`;
    sumCellA.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    sumCellA.alignment = { horizontal: "center", vertical: "middle" };

    summaryRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREY } };
      cell.border = {
        top: { style: "medium", color: { argb: "FF94A3B8" } },
        bottom: { style: "double", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } }
      };
    });

    // ------------------------------------------------------------
    // الاعتمادات والتوقيعات
    // ------------------------------------------------------------
    let sr = summaryRowNum + 2;

    ws.getRow(sr).height = 22;
    ws.mergeCells(sr, 1, sr, totalCols);
    const sigSectionCell = ws.getCell(sr, 1);
    sigSectionCell.value = isAr ? "✅ الاعتمادات" : "✅ Approvals";
    sigSectionCell.font = { name: "Arial", size: 11, bold: true, color: { argb: NAVY } };
    sigSectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    sigSectionCell.alignment = { horizontal: "center", vertical: "middle" };
    sr++;

    const colsPerBlock = Math.max(2, Math.floor(totalCols / 3));
    const blocks = [
      { start: 1, end: colsPerBlock, label: isAr ? "إعداد / مسؤول التقرير" : "Prepared By / Report Owner" },
      { start: colsPerBlock + 1, end: colsPerBlock * 2, label: isAr ? "مراجعة / مدير الصيانة" : "Reviewed By / Maintenance Manager" },
      { start: colsPerBlock * 2 + 1, end: totalCols, label: isAr ? "اعتماد / مدير المصنع" : "Approved By / Plant Manager" }
    ];

    const sigFields = [
      isAr ? "الاسم:" : "Name:",
      isAr ? "الوظيفة:" : "Title:"
    ];

    ws.getRow(sr).height = 20;
    blocks.forEach(b => {
      ws.mergeCells(sr, b.start, sr, b.end);
      const c = ws.getCell(sr, b.start);
      c.value = b.label;
      c.font = { name: "Arial", size: 9.5, bold: true, color: { argb: DARK } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHTER_GREY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    });
    sr++;

    sigFields.forEach(fieldLabel => {
      ws.getRow(sr).height = 20;
      blocks.forEach(b => {
        ws.mergeCells(sr, b.start, sr, b.end);
        const c = ws.getCell(sr, b.start);
        c.value = fieldLabel;
        c.font = { name: "Arial", size: 9, color: { argb: "FF475569" } };
        c.alignment = { horizontal: isAr ? "right" : "left", vertical: "bottom" };
        c.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
      });
      sr++;
    });

    ws.getRow(sr).height = 34;
    blocks.forEach(b => {
      ws.mergeCells(sr, b.start, sr, b.end);
      const c = ws.getCell(sr, b.start);
      c.value = isAr ? "التوقيع:" : "Signature:";
      c.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
      c.alignment = { horizontal: isAr ? "right" : "left", vertical: "top" };
      c.border = { bottom: { style: "medium", color: { argb: "FF334155" } } };
    });
    sr++;

    ws.getRow(sr).height = 20;
    blocks.forEach(b => {
      ws.mergeCells(sr, b.start, sr, b.end);
      const c = ws.getCell(sr, b.start);
      c.value = isAr ? "التاريخ:" : "Date:";
      c.font = { name: "Arial", size: 9, color: { argb: "FF475569" } };
      c.alignment = { horizontal: isAr ? "right" : "left", vertical: "bottom" };
      c.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
    });
    sr++;

    ws.columns.forEach((column, colIdx) => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= tableHeaderRowNum && rowNumber <= summaryRowNum) {
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
        column.width = Math.max(8, 9);
      } else if (colIdx === 1) {
        column.width = Math.max(Math.min(Math.max(maxLen + 4, 14), 48), 17);
      } else {
        column.width = Math.min(Math.max(maxLen + 4, 14), 48);
      }
    });
  }

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

export async function downloadBlobFile(blob, filename) {
  const isEn = window.currentLang === 'en';
  const isAr = !isEn;

  if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === 'function') {
    window.navigator.msSaveOrOpenBlob(blob, filename);
    showDownloadSuccessToast(null, null, filename, isEn);
    return;
  }

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

  let blobUrl = null;
  try {
    blobUrl = URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Could not create object URL:", e);
  }

  const effectiveDownloadUrl = dataUrl || blobUrl;

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

  showDownloadSuccessToast(effectiveDownloadUrl, blobUrl, filename, isEn);

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

function showDownloadSuccessToast(dataOrBlobUrl, blobUrl, filename, isEn) {
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

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add("opacity-0", "transition-opacity", "duration-500");
      setTimeout(() => toast.remove(), 500);
    }
  }, 35000);
}
