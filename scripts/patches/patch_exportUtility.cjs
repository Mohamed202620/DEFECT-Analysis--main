const fs = require('fs');
const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

// We want to replace the whole exportToPdf function to make it robust and clean.
const startIdx = content.indexOf('export async function exportToPdf');
const endIdx = content.indexOf('export function exportToCsv');

if (startIdx !== -1 && endIdx !== -1) {
  let newExportToPdf = `export async function exportToPdf(title, rows, htmlContent, filename, sigLabels = null) {
  if (typeof window.html2pdf === "undefined" && (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined")) {
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
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.boxSizing = 'border-box';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Tahoma, Arial, sans-serif';
  container.dir = isAr ? 'rtl' : 'ltr';
  
  const styleHtml = \`
    <style>
      .no-page-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .logo-print-wrapper img {
        object-fit: contain !important;
        max-height: 80px !important;
        width: auto !important;
      }
    </style>
  \`;
  
  const sig1 = sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature");
  const sig2 = sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature");
  const sig3 = sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature");

  container.innerHTML = \`
    \${styleHtml}
    <div class="logo-print-wrapper">
      \${buildPdfBrandHeaderHtml(logoDataUrl)}
    </div>
    \${buildPdfTitleBlockHtml(title, defaultInfoRows)}
    <div style="margin-top: 20px;">
      \${htmlContent}
    </div>
    \${buildPdfSignatureBlockHtml({ firstLabel: sig1, secondLabel: sig2, thirdLabel: sig3 })}
  \`;
  
  const opt = {
    margin:       [0.5, 0.5, 0.5, 0.5],
    filename:     filename,
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { scale: 2, useCORS: true, windowWidth: 794 },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'] }
  };
  
  if (window.html2pdf) {
    // html2pdf does not require appending to DOM. It creates a hidden iframe automatically.
    window.html2pdf().from(container).set(opt).toPdf().get('pdf').then(function (pdf) {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        const pageText = isAr ? 'صفحة ' + i + ' من ' + totalPages : 'Page ' + i + ' of ' + totalPages;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.text(pageText, pageWidth / 2, pageHeight - 0.2, { align: 'center' });
      }
    }).save();
  } else {
    // Fallback requires element to be in DOM for html2canvas
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    
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
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 1);
    let heightLeft = imgHeight;
    let position = 0;
    let i = 1;
    
    const addFooter = (p, current, total) => {
      p.setFontSize(10);
      p.setTextColor(100);
      const text = isAr ? 'صفحة ' + current + ' من ' + total : 'Page ' + current + ' of ' + total;
      p.text(text, pdfWidth / 2, pdfHeight - 20, { align: 'center' });
    };
    
    const totalPages = Math.ceil(imgHeight/pdfHeight);
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    addFooter(pdf, i++, totalPages);
    
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      addFooter(pdf, i++, totalPages);
      heightLeft -= pdfHeight;
    }
    pdf.save(filename);
  }
}

`;
  content = content.substring(0, startIdx) + newExportToPdf + content.substring(endIdx);
  fs.writeFileSync(path, content, 'utf8');
}
