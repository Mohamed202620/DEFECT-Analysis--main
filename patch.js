let internalNavCount = 0;

export function navigateTo(
page,
addToHistory = true
) {

currentPage =
page;

if (addToHistory) {
  internalNavCount++;
  history.pushState({ page }, "", `#${page}`);
} else {
  history.replaceState({ page }, "", `#${page}`);
}

render();

}

window.navigateTo =
navigateTo;

export function goBack(fallbackPage = 'home') {
  if (internalNavCount > 0) {
    internalNavCount--;
    history.back();
  } else {
    navigateTo(fallbackPage, false);
  }
}
