const fs = require('fs');
const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("container.style.width = '794px'; // A4 width at 96 DPI", "container.style.width = '100%';\n  container.style.maxWidth = '100%';");

content = content.replace("html2canvas:  { scale: 2, useCORS: true, windowWidth: 794 },", "html2canvas:  { scale: 2, useCORS: true, windowWidth: document.documentElement.offsetWidth },");

content = content.replace("margin:       [0.5, 0.5, 0.5, 0.5],", "margin:       [15, 15, 15, 15],");
content = content.replace("jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },", "jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },");

fs.writeFileSync(path, content, 'utf8');
