const fs = require('fs');

const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\\*\\*\\n \\* دالة مساعدة عامة وموثوقة لتنزيل ملفات Blob/g;
// We want to replace from `export async function exportToExcel` to right before the downloadBlobFile function.
// Let's find the indices.

const startStr = 'export async function exportToExcel(title, headers, rows, filename, options = {}) {';
const startIdx = content.indexOf(startStr);
const endStr = '/**\n * دالة مساعدة عامة وموثوقة لتنزيل ملفات Blob';
const endIdx = content.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

// We will rewrite the exportToExcel function completely
// I'll leave the generation of the replacement to the next step.
