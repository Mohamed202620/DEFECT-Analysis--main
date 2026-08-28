const fs = require('fs');
const path = 'js/kaizenBoard.js';
let content = fs.readFileSync(path, 'utf8');

// replace the await exportToPdf call with sigLabels included
content = content.replace(
  "await exportToPdf(title, infoRows, htmlContent, filename);",
  `await exportToPdf(title, infoRows, htmlContent, filename, {
      first: isAr ? "توقيع مقدّم المقترح" : "Suggester Signature",
      second: isAr ? "توقيع مهندس الجودة" : "Quality Eng. Signature",
      third: isAr ? "توقيع مدير المصنع" : "Plant Manager Signature"
    });`
);

fs.writeFileSync(path, content, 'utf8');
