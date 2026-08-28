const fs = require('fs');

// 1. Update exportUtility.js
let expPath = 'js/services/exportUtility.js';
let expContent = fs.readFileSync(expPath, 'utf8');

const csvStart = expContent.indexOf('export function exportToCsv');
if (csvStart !== -1) {
  const newExcelFunc = `export function exportToExcel(title, headers, rows, filename) {
  if (typeof window.XLSX === "undefined") {
    alert("❌ مكتبة XLSX غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول تاني.");
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

  // Build Array of Arrays
  const aoa = [
    [title],
    [\`\${exportedAtStr}\${exportDateStr}\`],
    [\`\${exportedByStr}\${userName} (\${roleLabel})\`],
    [], // Empty row for spacing
    headers, // Row 5: Headers (Index 4)
    ...rows  // Row 6+: Data (Index 5+)
  ];

  const ws = window.XLSX.utils.aoa_to_sheet(aoa);

  // Auto-fit columns
  const colWidths = headers.map((h, i) => {
    let max = h ? h.toString().length : 10;
    rows.forEach(row => {
      const cellVal = row[i];
      if (cellVal !== null && cellVal !== undefined) {
        const lines = cellVal.toString().split('\\n');
        lines.forEach(line => {
          if (line.length > max) max = line.length;
        });
      }
    });
    return { wch: Math.min(Math.max(max + 2, 12), 100) }; // cap width at 100, add some padding
  });
  ws['!cols'] = colWidths;

  // Set RTL for the sheet
  if (isAr) {
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });
    // xlsx-js-style uses !dir = 'rtl' as well for some viewers? But views rightToLeft is standard for ExcelJS, xlsx might need something else.
    // However, xlsx-js-style supports RTL if the sheet properties are set or some other way. We'll set views.
  }

  // Formatting using xlsx-js-style
  // Title row styling
  if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
  
  // Headers styling (Row 5 - index 4)
  const range = window.XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellRef = window.XLSX.utils.encode_cell({ c: C, r: 4 });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo background
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
  }

  // Data alignment (wrap text for attachments/long strings)
  for (let R = 5; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = window.XLSX.utils.encode_cell({ c: C, r: R });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          alignment: { wrapText: true, vertical: "top" }
        };
      }
    }
  }

  const wb = window.XLSX.utils.book_new();
  // Set WB views for RTL
  if (isAr) {
     if(!wb.Workbook) wb.Workbook = {};
     if(!wb.Workbook.Views) wb.Workbook.Views = [];
     wb.Workbook.Views.push({ RTL: true });
  }

  window.XLSX.utils.book_append_sheet(wb, ws, isAr ? "التقرير" : "Report");

  let finalFilename = filename;
  if(finalFilename.endsWith('.csv')) {
    finalFilename = finalFilename.replace('.csv', '.xlsx');
  } else if (!finalFilename.endsWith('.xlsx')) {
    finalFilename += '.xlsx';
  }

  window.XLSX.writeFile(wb, finalFilename);
}
`;
  expContent = expContent.substring(0, csvStart) + newExcelFunc;
  fs.writeFileSync(expPath, expContent, 'utf8');
}

// 2. Update maintenanceSearch.js
let msPath = 'js/maintenanceSearch.js';
if (fs.existsSync(msPath)) {
  let msContent = fs.readFileSync(msPath, 'utf8');
  msContent = msContent.replace(/exportToCsv/g, 'exportToExcel');
  fs.writeFileSync(msPath, msContent, 'utf8');
}

// 3. Update the UI button in maintenanceSearch.js
let uiPath = 'js/maintenanceSearch.js';
if (fs.existsSync(uiPath)) {
  let uiContent = fs.readFileSync(uiPath, 'utf8');
  uiContent = uiContent.replace(/id="export-csv-btn"/g, 'id="export-excel-btn"');
  uiContent = uiContent.replace(/>CSV</g, '>Excel<');
  uiContent = uiContent.replace(/تصدير CSV/g, 'تصدير Excel');
  uiContent = uiContent.replace(/Export CSV/g, 'Export Excel');
  fs.writeFileSync(uiPath, uiContent, 'utf8');
}
