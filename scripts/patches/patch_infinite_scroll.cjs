const fs = require('fs');

let tbPath = 'js/ticketsBoard.js';
let content = fs.readFileSync(tbPath, 'utf8');

// 1. Replace the section from MAX_BOARD_TICKETS down to setTicketsPage
const startStr = '// حد أقصى 60 بلاغ';
const endStr = 'window.setTicketsPage = function (page) {';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf('};', content.indexOf(endStr)) + 2;

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  const newLogic = `// تحميل متدرج (Infinite Scroll) بلا حدود للصفحات
// ============================================================
const BOARD_CHUNK_SIZE = 20;
let boardVisibleCount = BOARD_CHUNK_SIZE;
let boardAllTickets = [];

function renderBoardPage(containerId, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tr = t();

  const visibleItems = boardAllTickets.slice(0, boardVisibleCount);
  const listHtml = visibleItems.length
    ? visibleItems.map(ticketCardHtml).join("")
    : \`<div class="text-center text-gray-500 text-xs py-8">\${emptyMessage}</div>\`;

  const loaderHtml = boardVisibleCount < boardAllTickets.length 
    ? \`<div id="infiniteScrollTarget" class="py-4 text-center text-gray-500 text-[11px] animate-pulse">
         جاري تحميل المزيد... ( \${boardVisibleCount} من \${boardAllTickets.length} )
       </div>\` 
    : \`\`;

  container.innerHTML = listHtml + loaderHtml;

  if (boardVisibleCount < boardAllTickets.length) {
    setTimeout(() => {
      const target = document.getElementById('infiniteScrollTarget');
      if (target) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            observer.disconnect();
            window.loadMoreTickets(containerId, emptyMessage);
          }
        }, { rootMargin: "150px" });
        observer.observe(target);
      }
    }, 150);
  }
}

window.loadMoreTickets = function (containerId, emptyMessage) {
  boardVisibleCount += BOARD_CHUNK_SIZE;
  renderBoardPage(containerId, emptyMessage);
};`;
  
  // Need to find the exact boundary for the replacement
  // We'll replace from the line containing startStr up to the end of setTicketsPage function
  const lines = content.split('\n');
  const startIndex = lines.findIndex(l => l.includes('حد أقصى 60 بلاغ'));
  const endIndex = lines.findIndex((l, i) => i > startIndex && l.startsWith('window.setTicketsPage = function (page) {'));
  
  // Find where setTicketsPage ends
  let endOfFuncIndex = -1;
  if (endIndex !== -1) {
      for(let i = endIndex; i < lines.length; i++) {
          if (lines[i].startsWith('};')) {
              endOfFuncIndex = i;
              break;
          }
      }
  }

  if (startIndex !== -1 && endIndex !== -1 && endOfFuncIndex !== -1) {
    const before = lines.slice(0, startIndex);
    const after = lines.slice(endOfFuncIndex + 1);
    content = before.join('\\n') + '\\n' + newLogic + '\\n' + after.join('\\n');
  }
}

// 2. Replace boardCurrentPage = 1; with boardVisibleCount = BOARD_CHUNK_SIZE;
content = content.replace(/boardCurrentPage = 1;/g, 'boardVisibleCount = BOARD_CHUNK_SIZE;');

// 3. Replace boardCappedTickets assignment
content = content.replace(/boardCappedTickets = tickets\.slice\(0, MAX_BOARD_TICKETS\);/g, 'boardAllTickets = tickets;');

// 4. Update the comments mentioning "60" to reflect the new logic
content = content.replace(/\/\/ هنا بس بناخد آخر 60 من النتيجة المفلترة والمرتبة/g, '// هنا بناخد كل النتائج المفلترة والمرتبة (الأحدث أولاً)');
content = content.replace(/\/\/ \(الأحدث أولاً\) وبعدين نقسمها Pagination محلي 20\/صفحة × 3 صفحات/g, '// وبعدين نعرضها بشكل متدرج (Infinite Scroll) باستخدام IntersectionObserver');


fs.writeFileSync(tbPath, content, 'utf8');
