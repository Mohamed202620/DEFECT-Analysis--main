const fs = require('fs');
function patchFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/<table[^>]*style="([^"]*)"/g, (match, styleAttr) => {
    if (!styleAttr.includes('table-layout:fixed')) {
      return match.replace(styleAttr, styleAttr + '; table-layout:fixed; word-wrap:break-word;');
    }
    return match;
  });
  
  // also handle tailwind classes if any
  content = content.replace(/class="([^"]*)"/g, (match, classAttr) => {
    // we don't want to replace all classes, but let's just make sure html2pdf container has correct classes
    return match;
  });
  fs.writeFileSync(path, content, 'utf8');
}

['js/branding.js', 'js/kaizenBoard.js', 'js/maintenanceSearch.js', 'js/ticketsBoard.js'].forEach(p => {
  if (fs.existsSync(p)) {
    patchFile(p);
  }
});
