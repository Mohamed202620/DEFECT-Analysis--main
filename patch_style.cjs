const fs = require('fs');
const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

const styleBlock = `
    <style>
      @page { margin: 15mm; }
      .no-page-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .logo-print-wrapper img {
        object-fit: contain !important;
        max-height: 80px !important;
        width: auto !important;
      }
      table {
        width: 100% !important;
        table-layout: fixed !important;
        max-width: 100% !important;
      }
      td, th, p, span, div {
        word-wrap: break-word !important;
        white-space: normal !important;
      }
    </style>
`;

content = content.replace(/<style>[\s\S]*?<\/style>/, styleBlock.trim());
fs.writeFileSync(path, content, 'utf8');
