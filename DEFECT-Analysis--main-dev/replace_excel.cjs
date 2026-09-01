const fs = require('fs');

const filePath = 'js/services/exportUtility.js';
let content = fs.readFileSync(filePath, 'utf8');

const startStr = 'export async function exportToExcel(title, headers, rows, filename, options = {}) {';
const endStr = '/**\n * دالة مساعدة عامة وموثوقة لتنزيل ملفات Blob';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

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

    // 1. Header (Rows 1-3)
    ws.getRow(1).height = 24;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 18;

    if (logoB64 && logoB64.startsWith("data:image/")) {
      try {
        const extension = logoB64.includes("png") ? "png" : "jpeg";
        const imageId = wb.addImage({ base64: logoB64, extension });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 170, height: 57 },
          editAs: "oneCell"
        });
      } catch (imgErr) {
        console.warn("Error embedding logo", imgErr);
      }
    }

    // Company Names
    ws.mergeCells(1, 3, 1, totalCols);
    const brandArCell = ws.getCell(1, 3);
    brandArCell.value = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة (MSCANCO)";
    brandArCell.font = { name: "Arial", size: 12.5, bold: true, color: { argb: NAVY } };
    brandArCell.alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells(2, 3, 2, totalCols);
    const brandEnCell = ws.getCell(2, 3);
    brandEnCell.value = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY CO. LTD.";
    brandEnCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
    brandEnCell.alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells(3, 3, 3, totalCols);
    const certCell = ws.getCell(3, 3);
    certCell.value = isAr
      ? "شهادات الجودة المعتمدة: FSSC 22000  |  ISO 9001:2015  |  ISO 14001:2015  |  ISO 45001:2018"
      : "Certified Standards: FSSC 22000  |  ISO 9001:2015  |  ISO 14001:2015  |  ISO 45001:2018";
    certCell.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
    certCell.alignment = { horizontal: "right", vertical: "middle" };

    // 2. Report Information Table (Rows 5-8)
    let r = 5;
    
    // Info Table Border Style
    const infoBorder = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } }
    };

    const addInfoRow = (label1, value1, label2, value2) => {
      ws.getRow(r).height = 20;
      
      const c1 = ws.getCell(r, 1);
      c1.value = label1;
      c1.font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } };
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHTER_GREY } };
      c1.border = infoBorder;
      c1.alignment = { horizontal: "right", vertical: "middle" };

      const c2 = ws.getCell(r, 2);
      c2.value = value1;
      c2.font = { name: "Arial", size: 9, color: { argb: DARK } };
      c2.border = infoBorder;
      c2.alignment = { horizontal: "right", vertical: "middle" };

      if (label2) {
        const c3 = ws.getCell(r, 3);
        c3.value = label2;
        c3.font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } };
        c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHTER_GREY } };
        c3.border = infoBorder;
        c3.alignment = { horizontal: "right", vertical: "middle" };

        ws.mergeCells(r, 4, r, totalCols);
        const c4 = ws.getCell(r, 4);
        c4.value = value2;
        c4.font = { name: "Arial", size: 9, color: { argb: DARK } };
        c4.border = infoBorder;
        c4.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        ws.mergeCells(r, 2, r, totalCols);
      }
      r++;
    };

    addInfoRow(isAr ? "اسم التقرير:" : "Report Name:", sTitle, isAr ? "تاريخ الاستخراج:" : "Generated On:", exportDateStr);
    addInfoRow(isAr ? "المستخدم:" : "User:", userName, isAr ? "عدد السجلات:" : "Total Records:", sRows.length);
    if (options.periodLabel) {
      addInfoRow(isAr ? "الفترة الزمنية:" : "Date Range:", options.periodLabel, "", "");
    }
    
    r++; // One empty row between info and data headers

    // 3. Data Table Headers
    const tableHeaderRowNum = r;
    const headerRow = ws.getRow(tableHeaderRowNum);
    headerRow.values = sHeaders;
    headerRow.height = 25;

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
      rightToLeft: true, // As requested
      state: "frozen",
      ySplit: tableHeaderRowNum,
      showGridLines: true
    }];
    ws.pageSetup.printTitlesRow = \`\${tableHeaderRowNum}:\${tableHeaderRowNum}\`;
    
    ws.autoFilter = {
      from: { row: tableHeaderRowNum, column: 1 },
      to: { row: tableHeaderRowNum, column: sHeaders.length }
    };

    r++; // Start data rows

    const statusColIdx = sHeaders.findIndex(h => h.includes("الحالة") || h.toLowerCase().includes("status")) + 1;
    const priorityColIdx = sHeaders.findIndex(h => h.includes("الأولوية") || h.toLowerCase().includes("priority")) + 1;
    const attachColIdx = sHeaders.findIndex(h => h.includes("روابط") || h.includes("مرفقات") || h.toLowerCase().includes("attach") || h.toLowerCase().includes("media")) + 1;

    // 4. Data Rows
    sRows.forEach((rowData, rIdx) => {
      const row = ws.getRow(r);
      row.values = rowData;
      const isEven = rIdx % 2 === 0;
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 9, color: { argb: DARK } };
        
        // Zebra striping
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

        // Status Colors
        if (colNumber === statusColIdx && cell.value) {
          const val = cell.value.toString().toLowerCase();
          if (val.includes("مغلق") || val.includes("منفذ") || val.includes("مكتمل")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
            cell.font = { name: "Arial", color: { argb: "FF15803D" }, bold: true, size: 9 };
          } else if (val.includes("مفتوح") || val.includes("جديد")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
            cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9 };
          } else if (val.includes("مستمر") || val.includes("جار")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
            cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9 };
          }
        }

        // Priority Colors
        if (colNumber === priorityColIdx && cell.value) {
          const val = cell.value.toString().toLowerCase();
          if (val.includes("عالية")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
            cell.font = { name: "Arial", color: { argb: "FFB91C1C" }, bold: true, size: 9 };
          } else if (val.includes("متوسطة")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
            cell.font = { name: "Arial", color: { argb: "FFB45309" }, bold: true, size: 9 };
          }
        }

        // Hyperlinks
        if (colNumber === attachColIdx && cell.value) {
          const val = cell.value.toString();
          if (val.includes("http")) {
            const urls = val.split(" | ").filter(u => u.startsWith("http"));
            if (urls.length > 0) {
              const firstUrl = urls[0];
              cell.value = {
                text: "📎 روابط",
                hyperlink: firstUrl,
                tooltip: firstUrl
              };
              cell.font = { name: "Arial", color: { argb: "FF1D4ED8" }, underline: true, bold: true, size: 9 };
            }
          }
        }
      });
      r++;
    });

    // 5. Auto-fit columns
    ws.columns.forEach((column, colIdx) => {
      let maxLen = 10;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= tableHeaderRowNum) {
          const cellVal = cell.value;
          if (cellVal && cellVal.text) {
            maxLen = Math.max(maxLen, cellVal.text.length + 4);
          } else if (cellVal) {
            const lines = cellVal.toString().split("\\n");
            lines.forEach(l => {
              maxLen = Math.max(maxLen, l.length + 4);
            });
          }
        }
      });
      column.width = Math.min(Math.max(maxLen, 12), 50);
    });
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
