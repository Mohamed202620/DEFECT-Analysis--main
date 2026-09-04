const fs = require('fs');
let code = fs.readFileSync('js/renderCore.js', 'utf8');

const target = `export function navigateTo(
page,
addToHistory = true
) {

currentPage =
page;

if (addToHistory) {

history.pushState(
    { page },
    "",
    \`#\${page}\`
  );

}

render();

}`;

const replacement = `export async function navigateTo(page, addToHistory = true) {
  if (page !== "login" && page !== "register") {
    try {
      if (auth.currentUser === null) {
        await auth.authStateReady();
        if (!auth.currentUser) {
          console.warn("User not in Firebase Auth. Redirecting to login.");
          page = "login";
        }
      }
    } catch (e) {
      console.warn("Auth check failed", e);
    }
  }

  currentPage = page;
  if (addToHistory) {
    history.pushState({ page }, "", \`#\${page}\`);
  }
  render();
}`;

code = code.replace(/export function navigateTo\([\s\S]*?render\(\);\s*?\n\s*?\}/, replacement);
fs.writeFileSync('js/renderCore.js', code);
