const fs = require('fs');

function replaceInFile(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

// ErrorScannerView
replaceInFile('js/views/ErrorScannerView.js', "onclick=\"window.navigateTo('maintenance')\"", "onclick=\"window.goBack('maintenance')\"");

// MachinesView
replaceInFile('js/views/MachinesView.js', "onclick=\"window.navigateTo('system')\"", "onclick=\"window.goBack('system')\"");

// suggestionView
replaceInFile('js/views/suggestionView.js', "window.navigateTo('home');", "window.goBack('home');");
replaceInFile('js/views/suggestionView.js', "onclick=\"window.navigateTo('home')\"", "onclick=\"window.goBack('home')\"");

// StatsView
replaceInFile('js/views/StatsView.js', "onclick=\"window.navigateTo('home')\"", "onclick=\"window.goBack('home')\"");

// pmView
replaceInFile('js/views/pmView.js', "window.navigateTo('maintenance');", "window.goBack('maintenance');");
replaceInFile('js/views/pmView.js', "onclick=\"window.navigateTo('maintenance')\"", "onclick=\"window.goBack('maintenance')\"");

// reportsView
replaceInFile('js/views/reportsView.js', "onclick=\"window.navigateTo('maintenance')\"", "onclick=\"window.goBack('maintenance')\"");

// registerView
replaceInFile('js/views/registerView.js', "onclick=\"window.navigateTo('login')\"", "onclick=\"window.goBack('login')\"");

// reportView
replaceInFile('js/views/reportView.js', "window.navigateTo('maintenance');", "window.goBack('maintenance');");
replaceInFile('js/views/reportView.js', "onclick=\"window.navigateTo('maintenance')\"", "onclick=\"window.goBack('maintenance')\"");

// RequestsView
replaceInFile('js/views/RequestsView.js', "onclick=\"window.navigateTo('system')\"", "onclick=\"window.goBack('system')\"");

// MaintenanceSearchView
replaceInFile('js/views/MaintenanceSearchView.js', "onclick=\"window.navigateTo('maintenance')\"", "onclick=\"window.goBack('maintenance')\"");

// issueView
replaceInFile('js/views/issueView.js', "onclick=\"window.navigateTo('home')\"", "onclick=\"window.goBack('home')\"");

// KnowledgeBaseView
replaceInFile('js/views/KnowledgeBaseView.js', "onclick=\"window.navigateTo('home')\"", "onclick=\"window.goBack('home')\"");

