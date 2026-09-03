const fs = require('fs');

let renderCore = fs.readFileSync('js/renderCore.js', 'utf8');

const popstateListener = `
window.addEventListener("popstate", (e) => {
  if (e.state && e.state.page) {
    if (e.state.page !== currentPage) {
      currentPage = e.state.page;
      render();
    }
  } else {
    // Fallback if no state but hash exists
    const hash = window.location.hash.replace("#", "");
    if (hash && hash !== currentPage) {
      currentPage = hash;
      render();
    }
  }
});
`;

if (!renderCore.includes('"popstate"')) {
  renderCore = renderCore.replace(
    'window.addEventListener("hashchange",',
    popstateListener + '\nwindow.addEventListener("hashchange",'
  );
  fs.writeFileSync('js/renderCore.js', renderCore);
  console.log("Added popstate listener to renderCore.js");
}
