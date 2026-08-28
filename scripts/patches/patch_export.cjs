const fs = require('fs');
const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add positioning styles to prevent cutoff
content = content.replace(
  "container.style.width = '794px';",
  "container.style.position = 'fixed';\n  container.style.top = '-99999px';\n  container.style.left = '0';\n  container.style.width = '794px';"
);

// 2. Add sigLabels parameter to exportToPdf
content = content.replace(
  "export async function exportToPdf(title, rows, htmlContent, filename) {",
  "export async function exportToPdf(title, rows, htmlContent, filename, sigLabels = null) {"
);

// 3. Fix signatures localization and call
const sigCode = `
    const sig1 = sigLabels?.first || (isAr ? "توقيع الفني" : "Technician Signature");
    const sig2 = sigLabels?.second || (isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature");
    const sig3 = sigLabels?.third || (isAr ? "توقيع مدير المصنع" : "Plant Manager Signature");
    
    <div style="margin-top: 20px;">
      \${htmlContent}
    </div>
    \${buildPdfSignatureBlockHtml({ firstLabel: sig1, secondLabel: sig2, thirdLabel: sig3 })}
`;

content = content.replace(
  /\<div style="margin-top: 20px;"\>[\s\S]*?\$\{buildPdfSignatureBlockHtml\(\)\}/,
  sigCode.trim()
);

// 4. Ensure container is in DOM for html2pdf to prevent weird CSS clipping
content = content.replace(
  "if (window.html2pdf) {",
  "document.body.appendChild(container);\n  if (window.html2pdf) {"
);

content = content.replace(
  "}).save();",
  "}).save().then(() => { document.body.removeChild(container); });"
);

// Fallback logic already appended and removed container, but since we added it before 'if', we need to remove duplicate append
content = content.replace(
  "} else {\n    document.body.appendChild(container);",
  "} else {"
);

fs.writeFileSync(path, content, 'utf8');
