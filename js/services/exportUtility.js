import { getCurrentRole, hasFullDataAccess } from '../permissions.js';
import { buildPdfBrandHeaderHtml, buildPdfTitleBlockHtml, buildPdfSignatureBlockHtml, getCompanyLogoDataUrl } from '../branding.js';
import { HEADER_COLORS, COMPANY_NAME_AR, COMPANY_NAME_EN } from '../companyHeaderConfig.js';

export const PAGE_BREAK_CLASS = "no-page-break";

// عرض ثابت للورقة (بالبكسل) نستخدمه في التقاط كل من الهيدر والجسم بنفس
// المقياس بالظبط، عشان يبقى عرضهم متطابق تمامًا لما يترسموا فوق بعض بالـ PDF
const PDF_PAGE_WIDTH_PX = 794;

// أنماط مشتركة بين حاوية الهيدر وحاوية الجسم (نفس القديم بدون تغيير)
const PDF_SHARED_STYLE_HTML = `
  <style>
    .no-page-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .logo-print-wrapper {
       text-align: center;
       margin-bottom: 0;
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

/**
 * ينشئ عنصر Div مؤقت خارج نطاق رؤية الشاشة (يُستخدم كحاوية التقاط لكل من
 * الهيدر والجسم قبل تمريره لـ html2canvas) - بنفس الإعدادات دايمًا عشان
 * ضمان اتساق العرض بينهم.
 */
function createOffscreenPdfContainer(isAr, paddingCss) {
  const el = document.createElement('div');
  el.style.width = `${PDF_PAGE_WIDTH_PX}px`;
  el.style.boxSizing = 'border-box';
  el.style.padding = paddingCss;
  el.style.background = '#ffffff';
  el.style.color = '#0f172a';
  el.style.fontFamily = 'Arial, Tahoma, sans-serif';
  el.dir = isAr ? 'rtl' : 'ltr';
  // يجب أن يكون العنصر داخل الـ DOM لكي يقوم المتصفح بدمج الحروف العربية بشكل صحيح
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  el.style.top = '0';
  return el;
}

/**
 * تصدير تقرير إلى PDF مع تكرار الهيدر الرسمي الموحّد فعليًا في أعلى كل صفحة.
 * ----------------------------------------------------------------------
 * الفرق الجوهري عن النسخة القديمة: الهيدر والجسم بيتلقطوا كصورتين منفصلتين
 * (Canvas مستقل لكل منهما) بدل صورة واحدة طويلة تتقص بالإزاحة. الهيدر
 * بيترسم من جديد بأعلى كل صفحة PDF (Page) قبل ما يترسم "الجزء الظاهر" من
 * صورة الجسم أسفله مباشرة - فيبقى الهيدر فعليًا متكرر وثابت في كل صفحة،
 * مش موجود بس في الصفحة الأولى زي قبل كده.
 */
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

  const sig1 = sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature");
  const sig2 = sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature");
  const sig3 = sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature");

  // 1) حاوية الهيدر بمفرده - هي اللي هتترسم من جديد أعلى كل صفحة PDF
  const headerContainer = createOffscreenPdfContainer(isAr, '14px 24px 10px 24px');
  headerContainer.innerHTML = `
    ${PDF_SHARED_STYLE_HTML}
    <div class="logo-print-wrapper">
      ${buildPdfBrandHeaderHtml(logoDataUrl)}
    </div>
  `;

  // 2) حاوية جسم التقرير بمفرده (العنوان + الجدول/المحتوى + التوقيعات)
  const bodyContainer = createOffscreenPdfContainer(isAr, '0 24px 24px 24px');
  bodyContainer.innerHTML = `
    ${PDF_SHARED_STYLE_HTML}
    ${buildPdfTitleBlockHtml(title, defaultInfoRows)}
    <div style="margin-top: 20px;">
      ${htmlContent}
    </div>
    ${buildPdfSignatureBlockHtml({ firstLabel: sig1, secondLabel: sig2, thirdLabel: sig3 })}
  `;

  document.body.appendChild(headerContainer);
  document.body.appendChild(bodyContainer);

  // ننتظر قليلاً لضمان تحميل الخطوط وتطبيق المتصفح لاتجاه وحروف اللغة العربية (Text Shaping)
  await new Promise(r => setTimeout(r, 150));

  const cleanupContainers = () => {
    if (headerContainer.parentNode) document.body.removeChild(headerContainer);
    if (bodyContainer.parentNode) document.body.removeChild(bodyContainer);
  };

  try {
    const html2canvasOptions = {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: PDF_PAGE_WIDTH_PX
    };

    // نلتقط الهيدر والجسم كـ Canvas منفصلين تمامًا
    const [headerCanvas, bodyCanvas] = await Promise.all([
      window.html2canvas(headerContainer, html2canvasOptions),
      window.html2canvas(bodyContainer, html2canvasOptions)
    ]);

    cleanupContainers();

    const { jsPDF } = window.jspdf;
    
    // الأبعاد القياسية لعرض ورقة A4 بالنقط (pt)
    const pdfWidth = 595.28;
    const margin = 20;
    const contentWidth = pdfWidth - (margin * 2);

    // تحويل صورة الهيدر لأبعاد الصفحة (عرض ثابت = contentWidth)
    const headerRatio = contentWidth / headerCanvas.width;
    const headerPrintHeight = headerCanvas.height * headerRatio;
    const headerImgData = headerCanvas.toDataURL("image/jpeg", 1.0);

    // تحويل صورة الجسم لنفس العرض
    const bodyRatio = contentWidth / bodyCanvas.width;
    const bodyPrintHeight = bodyCanvas.height * bodyRatio;
    const bodyImgData = bodyCanvas.toDataURL("image/jpeg", 1.0);

    // مسافة فاصلة بسيطة بين أسفل الهيدر وأول سطر من محتوى الجسم
    const gapAfterHeader = 10;
    
    // خيار دمج التقرير في صفحة واحدة أو تقسيمه
    const isSinglePage = window.confirm(
      isAr 
        ? "هل تفضل دمج التقرير بالكامل في صفحة PDF واحدة طويلة؟\n\n- [موافق]: صفحة واحدة (أفضل للعرض على الشاشات والموبايل).\n- [إلغاء]: مقسّم لصفحات A4 (أفضل للطباعة الورقية)."
        : "Do you want to merge the entire report into a single long PDF page?\n\n- [OK]: Single page (best for digital viewing).\n- [Cancel]: Split into A4 pages (best for printing)."
    );

    let pdf, pdfHeight;
    
    if (isSinglePage) {
      // ارتفاع مخصص يتسع لكل المحتوى في صفحة واحدة
      pdfHeight = margin * 2 + headerPrintHeight + gapAfterHeader + bodyPrintHeight;
      pdf = new jsPDF("p", "pt", [pdfWidth, pdfHeight]);
    } else {
      // ارتفاع ورقة A4 القياسية
      pdf = new jsPDF("p", "pt", "a4");
      pdfHeight = pdf.internal.pageSize.getHeight();
    }

    // الارتفاع المتاح فعليًا لمحتوى الجسم في كل صفحة (بعد خصم مساحة الهيدر المتكرر)
    const availableBodyHeightPerPage = pdfHeight - (margin * 2) - headerPrintHeight - gapAfterHeader;

    const totalPages = Math.max(1, Math.ceil(bodyPrintHeight / availableBodyHeightPerPage));

    const addFooter = (p, current, total) => {
      p.setFontSize(10);
      p.setTextColor(100);
      // استخدمنا الإنجليزية والأرقام فقط لتجنب تشوه الخط الافتراضي لـ jsPDF مع العربية
      const text = `Page ${current} / ${total}`;
      p.text(text, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
    };

    const bodyStartY = margin + headerPrintHeight + gapAfterHeader;

    // يرسم الهيدر الثابت + رقم الصفحة أعلى/أسفل الصفحة الحالية. بيترسم
    // "بعد" صورة الجسم قصدًا عشان يغطي أي تراكب بسيط في حدود التقريب
    // ويضمن ظهور الهيدر نظيفًا فوق أي حاجة تانية دايمًا.
    const drawHeaderAndFooter = (p, current, total) => {
      // Clear the top area to prevent body image from bleeding into margins and gap
      p.setFillColor(255, 255, 255);
      p.rect(0, 0, pdfWidth, bodyStartY, 'F');
      
      // Clear the bottom margin to prevent body image from bleeding into the footer area
      p.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');

      p.addImage(headerImgData, "JPEG", margin, margin, contentWidth, headerPrintHeight);
      addFooter(p, current, total);
    };

    let heightLeft = bodyPrintHeight;
    let bodyPosition = bodyStartY;
    let page = 1;

    pdf.addImage(bodyImgData, "JPEG", margin, bodyPosition, contentWidth, bodyPrintHeight);
    drawHeaderAndFooter(pdf, page++, totalPages);
    heightLeft -= availableBodyHeightPerPage;

    while (heightLeft > 0) {
      bodyPosition -= availableBodyHeightPerPage;
      pdf.addPage();
      pdf.addImage(bodyImgData, "JPEG", margin, bodyPosition, contentWidth, bodyPrintHeight);
      drawHeaderAndFooter(pdf, page++, totalPages);
      heightLeft -= availableBodyHeightPerPage;
    }

    pdf.save(filename);
  } catch (err) {
    console.error("PDF generation error:", err);
    cleanupContainers();
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

    const ws = wb.addWorksheet(sName, {
      views: [{ rightToLeft: true }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 9, 
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.4, right: 0.4, top: 0.6, bottom: 0.6,
          header: 0.3, footer: 0.3
        }
      }
    });

    // الألوان الرسمية موحّدة ومصدرها الوحيد companyHeaderConfig.js (نفس
    // الألوان بالظبط المستخدمة في هيدر HTML/PDF - أي تغيير لوني مستقبلي
    // بيتم هناك فقط وبينعكس هنا تلقائيًا)
    const NAVY = HEADER_COLORS.navyArgb;
    const DARK = HEADER_COLORS.darkArgb;
    const LIGHT_GREY = HEADER_COLORS.lightGreyArgb;
    const WHITE = HEADER_COLORS.whiteArgb;

    // Pre-fill rows 1 to 150 with pure white to destroy ANY default yellow fills
    for (let i = 1; i <= 150; i++) {
      const row = ws.getRow(i);
      for (let j = 1; j <= totalCols; j++) {
        const cell = row.getCell(j);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
        cell.border = {}; // Clear borders
      }
    }

    // 1. Header Image (Rows 1-4): البانر الرسمي الكامل (شعار MSCANCO + الاسم
    // الثنائي اللغة + شهادات SGS/ISO الأربعة) - صورة واحدة عالية الدقة، ترتيب
    // العناصر بداخلها ثابت دائمًا (الشعار يسار / الشهادات يمين) بغض النظر عن
    // اتجاه عرض الشيت (rightToLeft) لأنه مصدرها Base64 مُضمّن من
    // companyHeaderConfig.js مباشرة (نفس المصدر المستخدم في هيدر PDF/HTML)
    ws.mergeCells(1, 1, 4, totalCols);
    for (let i = 1; i <= 4; i++) ws.getRow(i).height = 25;

    const headerCell = ws.getCell(1, 1);
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    headerCell.border = { bottom: { style: "medium", color: { argb: NAVY } } };

    if (logoB64 && logoB64.startsWith("data:image/")) {
      try {
        const extension = logoB64.includes("png") ? "png" : "jpeg";
        const imageId = wb.addImage({ base64: logoB64, extension });
        ws.addImage(imageId, {
          tl: { col: 0.2, row: 0.4 }, // Padding from top right (in RTL)
          ext: { width: 320, height: 85 }, // Fixed absolute size in pixels (maintains aspect ratio)
          editAs: "oneCell" 
        });
      } catch (imgErr) {
        console.warn("Error embedding logo", imgErr);
      }
    }

    // 1.b Row 5: نص حقيقي (Real Cell Text) لاسم الشركة الثنائي اللغة، مدموج
    // عبر كل الأعمدة - إضافة لصورة الهيدر، مش بديل عنها. الهدف: أي عميل
    // بريد/عارض إكسيل بيلغي عرض الصور تلقائيًا (شائع في بعض بيئات الشركات)
    // يفضل الاسم الرسمي للشركة ظاهر كنص قابل للقراءة والبحث والنسخ، مش بس
    // صورة قابلة للاختفاء.
    ws.mergeCells(5, 1, 5, totalCols);
    const companyTextRow = ws.getRow(5);
    companyTextRow.height = 16;
    const companyTextCell = ws.getCell(5, 1);
    companyTextCell.value = `${COMPANY_NAME_AR}   |   ${COMPANY_NAME_EN}`;
    companyTextCell.font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } };
    companyTextCell.alignment = { horizontal: "center", vertical: "middle" };
    companyTextCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };

    // 2. Report Information Table (Rows 7-10)
    const infoBorder = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } }
    };

    const addInfoRow = (rowNum, label, value) => {
      ws.getRow(rowNum).height = 22;
      
      const c1 = ws.getCell(rowNum, 1);
      c1.value = label;
      c1.font = { name: "Arial", size: 9.5, bold: true, color: { argb: NAVY } };
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREY } };
      c1.border = infoBorder;
      c1.alignment = { horizontal: "right", vertical: "middle" };

      ws.mergeCells(rowNum, 2, rowNum, 4);
      const c2 = ws.getCell(rowNum, 2);
      c2.value = value;
      c2.font = { name: "Arial", size: 9.5, color: { argb: DARK }, bold: true };
      c2.border = infoBorder;
      c2.alignment = { horizontal: "right", vertical: "middle" };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
      
      ws.getCell(rowNum, 3).border = infoBorder;
      ws.getCell(rowNum, 4).border = infoBorder;
    };

    addInfoRow(7, isAr ? "اسم التقرير:" : "Report Name:", sTitle);
    addInfoRow(8, isAr ? "المستخدم:" : "User:", userName);
    addInfoRow(9, isAr ? "تاريخ الاستخراج:" : "Generated On:", exportDateStr);
    
    let totalRecordsValue = sRows.length.toString();
    if (options.periodLabel) {
       totalRecordsValue += `  |  ${isAr ? "الفترة:" : "Period:"} ${options.periodLabel}`;
    }
    addInfoRow(10, isAr ? "عدد السجلات:" : "Total Records:", totalRecordsValue);

    // 3. Data Table Headers (Row 12 - سطر فاصل عند الصف 11 للتنفس البصري)
    const tableHeaderRowNum = 12;
    const headerRow = ws.getRow(tableHeaderRowNum);
    headerRow.values = sHeaders;
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", bold: true, color: { argb: WHITE }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: DARK } },
        left: { style: "thin", color: { argb: DARK } },
        bottom: { style: "thin", color: { argb: DARK } },
        right: { style: "thin", color: { argb: DARK } }
      };
    });

    // تثبيت الصفوف (Freeze Panes): كل صفوف الهيدر (البانر + النص + معلومات
    // التقرير + صف عناوين الأعمدة) بتفضل ثابتة أعلى الشاشة دايمًا مهما نزل
    // المستخدم لتحت في سجل البيانات - ySplit = رقم آخر صف بيتجمد (صف عناوين
    // الأعمدة نفسه) فبيفضل ظاهر مع كل صفوف البيانات تحته.
    ws.views = [{
      rightToLeft: true,
      state: "frozen",
      ySplit: tableHeaderRowNum,
      showGridLines: true
    }];
    ws.pageSetup.printTitlesRow = `${tableHeaderRowNum}:${tableHeaderRowNum}`;
    
    ws.autoFilter = {
      from: { row: tableHeaderRowNum, column: 1 },
      to: { row: tableHeaderRowNum, column: sHeaders.length }
    };

    let r = tableHeaderRowNum + 1;

    const statusColIdx = sHeaders.findIndex(h => h.includes("الحالة") || h.toLowerCase().includes("status")) + 1;
    const priorityColIdx = sHeaders.findIndex(h => h.includes("الأولوية") || h.toLowerCase().includes("priority")) + 1;
    const attachColIdx = sHeaders.findIndex(h => h.includes("روابط") || h.includes("مرفقات") || h.toLowerCase().includes("attach") || h.toLowerCase().includes("media")) + 1;

    // 4. Data Rows
    sRows.forEach((rowData, rIdx) => {
      const row = ws.getRow(r);
      row.values = rowData;
      const isEven = rIdx % 2 === 0;
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 9.5, color: { argb: DARK } };
        
        // White and Cool Grey only
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? WHITE : LIGHT_GREY }
        };

        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } }
        };

        if (colNumber === statusColIdx && cell.value) {
          const val = cell.value.toString().toLowerCase();
          if (val.includes("مغلق") || val.includes("منفذ") || val.includes("مكتمل")) {
            cell.font = { name: "Arial", color: { argb: "FF15803D" }, bold: true, size: 9.5 };
          } else if (val.includes("مفتوح") || val.includes("جديد")) {
            cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9.5 };
          } else if (val.includes("مستمر") || val.includes("جار")) {
            cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9.5 };
          }
        }

        if (colNumber === priorityColIdx && cell.value) {
          const val = cell.value.toString().toLowerCase();
          if (val.includes("عالية")) {
            cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9.5 };
          } else if (val.includes("متوسطة")) {
            cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9.5 };
          }
        }

        if (colNumber === attachColIdx && cell.value) {
          const val = cell.value.toString();
          if (val.includes("http")) {
            const urls = val.split(" | ").filter(u => u.startsWith("http"));
            if (urls.length > 0) {
              const firstUrl = urls[0];
              cell.value = {
                text: "📎 عرض المرفقات",
                hyperlink: firstUrl,
                tooltip: firstUrl
              };
              cell.font = { name: "Arial", color: { argb: "FF1D4ED8" }, underline: true, bold: true, size: 9.5 };
            }
          }
        }
      });
      r++;
    });

    // 5. Auto-fit columns
    ws.columns.forEach((column, colIdx) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= tableHeaderRowNum) {
          const cellVal = cell.value;
          if (cellVal && cellVal.text) {
            maxLen = Math.max(maxLen, cellVal.text.length * 1.2);
          } else if (cellVal) {
            const lines = cellVal.toString().split("\n");
            lines.forEach(l => {
              maxLen = Math.max(maxLen, l.length * 1.2);
            });
          }
        }
      });
      column.width = Math.min(Math.max(maxLen, 15), 60);
    });
    
    ws.getColumn(2).width = Math.max(ws.getColumn(2).width || 15, 20);
    ws.getColumn(3).width = Math.max(ws.getColumn(3).width || 15, 20);
    ws.getColumn(4).width = Math.max(ws.getColumn(4).width || 15, 20);
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
