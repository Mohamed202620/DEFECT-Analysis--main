export const router = {
  currentPage: 'home',

  async navigateTo(page) {
    this.currentPage = page;
    const app = document.getElementById('app');
    if (!app) return;

    switch (page) {
      case 'home':
        const { HomeViewModule } = await import('./views/homeView.js');
        app.innerHTML = HomeViewModule.render();
        break;

      case 'report':
        const { ReportViewModule } = await import('./views/reportView.js');
        app.innerHTML = ReportViewModule.render();
        break;

      case 'suggestion':
        const { SuggestionViewModule } = await import('./views/suggestionView.js');
        app.innerHTML = SuggestionViewModule.render();
        break;

      case 'pm':
        const { PMViewModule } = await import('./views/pmView.js');
        app.innerHTML = PMViewModule.render();
        break;

      case 'reports':
        const { ReportsViewModule } = await import('./views/reportsView.js');
        app.innerHTML = ReportsViewModule.render();
        break;

      default:
        const { HomeModule } = await import('./views/homeView.js');
        app.innerHTML = HomeModule.render();
    }
    window.scrollTo(0, 0);
  }
};

window.navigateTo = (page) => router.navigateTo(page);
