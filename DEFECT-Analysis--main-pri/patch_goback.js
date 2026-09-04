const fs = require('fs');

let renderCore = fs.readFileSync('js/renderCore.js', 'utf8');

const goBackImpl = `
export function goBack(fallbackPage = 'home') {
  // If we have history state from our own pushState
  if (history.state && history.state.page) {
    history.back();
  } 
  // Fallback for PWA when user launches app fresh and clicks back button on a deep link
  else if (history.length > 2) {
    history.back();
  } else {
    navigateTo(fallbackPage, true);
  }
}
window.goBack = goBack;
`;

if (!renderCore.includes('window.goBack =')) {
  renderCore = renderCore.replace(
    'window.navigateTo =navigateTo;',
    'window.navigateTo =navigateTo;\n' + goBackImpl
  );
  
  // also add it to exports of renderCore.js implicitly or we can just leave it as window.goBack
  fs.writeFileSync('js/renderCore.js', renderCore);
  console.log("Added goBack to renderCore.js");
}
