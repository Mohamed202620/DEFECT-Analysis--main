const fs = require('fs');

let renderCore = fs.readFileSync('js/renderCore.js', 'utf8');

const goBackImpl = `
export function goBack(fallbackPage = 'home') {
  if (history.state && history.state.page) {
    history.back();
  } else if (history.length > 2) {
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
  
  fs.writeFileSync('js/renderCore.js', renderCore);
  console.log("Added goBack to renderCore.js");
}
