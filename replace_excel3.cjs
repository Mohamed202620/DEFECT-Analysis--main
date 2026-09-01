const fs = require('fs');
const filePath = 'js/services/exportUtility.js';
let content = fs.readFileSync(filePath, 'utf8');

const startStr = 'export async function exportToExcel(title, headers, rows, filename, options = {}) {';
const endStr = '/**\n * دالة مساعدة عامة وموثوقة لتنزيل ملفات Blob';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

const replacement = `export async function exportToExcel(title, headers, rows, filename, options = {}) {
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
  wb.creator = \`\${userName} - MSCANCO\`;
  wb.lastModifiedBy = \`\${userName} - MSCANCO\`;
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
    const LIGHT_GREY = "FFE2E8F0";
    const LIGHTER_GREY = "FFF8FAFC";
    const WHITE = "FFFFFFFF";

    // 1. Header Image (Rows 1-3)
    ws.mergeCells(1, 1, 3, totalCols); // دمج لتوفير مساحة للصورة في الخلفية
    ws.getRow(1).height = 35;
    ws.getRow(2).height = 35;
    ws.getRow(3).height = 35;

    // مسح أي ألوان أو حدود من مساحة الهيدر
    const headerCell = ws.getCell(1, 1);
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    headerCell.border = {};

    if (logoB64 && logoB64.startsWith("data:image/")) {
      try {
        const extension = logoB64.includes("png") ? "png" : "jpeg";
        const imageId = wb.addImage({ base64: logoB64, extension });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 400, height: 100 }, // الاحتفاظ بالأبعاد دون تمطيط
          editAs: "oneCell"
        });
      } catch (imgErr) {
        console.warn("Error embedding logo", imgErr);
      }
    }

    // إضافة صف فارغ بسيط أو مساحة بعد الصورة مباشرة (صف 4)
    ws.getRow(4).height = 10;
    
    // 2. Report Information Table (Rows 5-8)
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
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHTER_GREY } };
      c1.border = infoBorder;
      c1.alignment = { horizontal: "right", vertical: "middle" };

      // توسيع الأعمدة
      ws.mergeCells(rowNum, 2, rowNum, 4);
      const c2 = ws.getCell(rowNum, 2);
      c2.value = value;
      c2.font = { name: "Arial", size: 9.5, color: { argb: DARK }, bold: true };
      c2.border = infoBorder;
      c2.alignment = { horizontal: "right", vertical: "middle" };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } }; // تأكيد عدم وجود لون أصفر
      
      ws.getCell(rowNum, 3).border = infoBorder;
      ws.getCell(rowNum, 4).border = infoBorder;
    };

    addInfoRow(5, isAr ? "اسم التقرير:" : "Report Name:", sTitle);
    addInfoRow(6, isAr ? "المستخدم:" : "User:", userName);
    addInfoRow(7, isAr ? "تاريخ الاستخراج:" : "Generated On:", exportDateStr);
    
    let totalRecordsValue = sRows.length.toString();
    if (options.periodLabel) {
       totalRecordsValue += \`  |  \${isAr ? "الفترة:" : "Period:"} \${options.periodLabel}\`;
    }
    addInfoRow(8, isAr ? "عدد السجلات:" : "Total Records:", totalRecordsValue);

    // صف فارغ إضافي 9
    ws.getRow(9).height = 15;

    // 3. Data Table Headers (Row 10)
    const tableHeaderRowNum = 10;
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
    ws.pageSetup.printTitlesRow = \`\${tableHeaderRowNum}:\${tableHeaderRowNum}\`;
    
    ws.autoFilter = {
      from: { row: tableHeaderRowNum, column: 1 },
      to: { row: tableHeaderRowNum, column: sHeaders.length }
    };

    let r = 11;

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
        
        // إجبار اللون الأبيض/الرمادي الفاتح فقط ومنع الأصفر
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? WHITE : LIGHTER_GREY }
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

    // Clean up completely empty rows up to row 100 to prevent leftover formats (yellow fills)
    for (let i = r; i <= Math.max(r, 100); i++) {
      const emptyRow = ws.getRow(i);
      emptyRow.eachCell({ includeEmpty: true }, (cell) => {
         cell.fill = { type: "pattern", pattern: "none" };
         cell.border = {};
      });
    }

    // 5. Auto-fit columns
    ws.columns.forEach((column, colIdx) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= tableHeaderRowNum) {
          const cellVal = cell.value;
          if (cellVal && cellVal.text) {
            maxLen = Math.max(maxLen, cellVal.text.length * 1.2);
          } else if (cellVal) {
            const lines = cellVal.toString().split("\\n");
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
  
  let finalFilename = filename || \`mscanco-report-\${new Date().toISOString().slice(0, 10)}.xlsx\`;
  if (finalFilename.endsWith(".csv")) {
    finalFilename = finalFilename.replace(".csv", ".xlsx");
  } else if (!finalFilename.endsWith(".xlsx")) {
    finalFilename += ".xlsx";
  }

  downloadBlobFile(blob, finalFilename);
}
`;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully replaced exportToExcel function.");
