const fs = require('fs');

// 1. Fix exportUtility.js
let expPath = 'js/services/exportUtility.js';
let expContent = fs.readFileSync(expPath, 'utf8');

const faultyHtml = `    const sig1 = sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature");
    const sig2 = sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature");
    const sig3 = sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature");
    
    <div style="margin-top: 20px;">
      \${htmlContent}
    </div>
    \${buildPdfSignatureBlockHtml({ firstLabel: sig1, secondLabel: sig2, thirdLabel: sig3 })}`;

expContent = expContent.replace(faultyHtml, `<div style="margin-top: 20px;">
      \${htmlContent}
    </div>
    \${buildPdfSignatureBlockHtml({ firstLabel: sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature"), secondLabel: sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature"), thirdLabel: sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature") })}`);

fs.writeFileSync(expPath, expContent, 'utf8');

// 2. Fix maintenanceSearch.js
let searchPath = 'js/maintenanceSearch.js';
let searchContent = fs.readFileSync(searchPath, 'utf8');
searchContent = searchContent.replace(/formatCsvDate\(/g, "formatPdfDate(");
fs.writeFileSync(searchPath, searchContent, 'utf8');
