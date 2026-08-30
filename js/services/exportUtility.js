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

    const NAVY = "FF0B3D91";
    const DARK = "FF1E293B";
    const LIGHT_GREY = "FFF1F5F9"; // Cool grey (Slate 100) instead of anything yellowish
    const WHITE = "FFFFFFFF";

    // Pre-fill rows 1 to 150 with pure white to destroy ANY default yellow fills
    for (let i = 1; i <= 150; i++) {
      const row = ws.getRow(i);
      for (let j = 1; j <= totalCols; j++) {
        const cell = row.getCell(j);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
        cell.border = {}; // Clear borders
      }
    }

    // 1. Header Image & Background (Rows 1-4)
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

    // 2. Report Information Table (Rows 6-9)
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

    addInfoRow(6, isAr ? "اسم التقرير:" : "Report Name:", sTitle);
    addInfoRow(7, isAr ? "المستخدم:" : "User:", userName);
    addInfoRow(8, isAr ? "تاريخ الاستخراج:" : "Generated On:", exportDateStr);
    
    let totalRecordsValue = sRows.length.toString();
    if (options.periodLabel) {
       totalRecordsValue += `  |  ${isAr ? "الفترة:" : "Period:"} ${options.periodLabel}`;
    }
    addInfoRow(9, isAr ? "عدد السجلات:" : "Total Records:", totalRecordsValue);

    // 3. Data Table Headers (Row 11)
    const tableHeaderRowNum = 11;
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

    let r = 12;

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
