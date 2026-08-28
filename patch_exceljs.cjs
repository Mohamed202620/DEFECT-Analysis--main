const fs = require('fs');
let expPath = 'js/services/exportUtility.js';
let expContent = fs.readFileSync(expPath, 'utf8');

const excelStart = expContent.indexOf('export function exportToExcel');
if (excelStart !== -1) {
  const newExcelFunc = `export async function exportToExcel(title, headers, rows, filename) {
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
  ws.getRow(6).values = [\`\${exportedAtStr}\${exportDateStr}\`];
  ws.getRow(7).values = [\`\${exportedByStr}\${userName} (\${roleLabel})\`];
  
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
              text: isAr ? '📎 فتح المرفق' + (extraCount > 0 ? \` (+\${extraCount})\` : '') 
                         : '📎 Open File' + (extraCount > 0 ? \` (+\${extraCount})\` : ''),
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
           const lines = cellVal.toString().split('\\n');
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
`;
  expContent = expContent.substring(0, excelStart) + newExcelFunc;
  fs.writeFileSync(expPath, expContent, 'utf8');
}

// Ensure the UI function is async
let msPath = 'js/maintenanceSearch.js';
let msContent = fs.readFileSync(msPath, 'utf8');
msContent = msContent.replace(/window\.exportMaintenanceSearchResults = function \(\) \{/g, 'window.exportMaintenanceSearchResults = async function () {');
msContent = msContent.replace(/exportToExcel\(title, headers, rows, filename\);/g, 'await exportToExcel(title, headers, rows, filename);');
fs.writeFileSync(msPath, msContent, 'utf8');
