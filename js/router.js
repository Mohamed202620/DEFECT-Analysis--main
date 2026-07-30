// 1. استيراد الملفات الأخرى (إذا كنت تستخدم Modules)
import { GOOGLE_SCRIPT_URL, translations } from './config.js';
import { HomeView } from './homeView.js';
import { saveDefectData, handleDefectFile } from './workflow.js';
import { ReportView } from './reportView.js';
import { PMView } from './pmView.js';
import { ReportsView } from './reportsView.js';

// 2. ربط الدوال بالنطاق العام (Global Scope) لتعمل مع الأحداث من HTML
window.navigateTo = navigateTo;
window.toggleLanguage = toggleLanguage;
window.toggleDarkMode = toggleDarkMode;
window.doLogin = doLogin;
window.registerUser = registerUser;
window.logout = logout;
window.contactSupport = contactSupport;
window.saveDefectData = saveDefectData;
window.handleDefectFile = handleDefectFile;

// 3. كود تشغيل الصفحة وإخفاء الـ Splash Screen
window.addEventListener('DOMContentLoaded', () => {
  const phone = localStorage.getItem("phone");
  const savedUser = localStorage.getItem('user');

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user && user.role) currentRole = user.role;
    } catch(e) {}
  }

  if (phone || savedUser) {
    currentPage = 'home';
    if (typeof loadDashboard === 'function') loadDashboard();
  } else {
    currentPage = 'login';
  }

  // رسم الواجهة
  if (typeof render === 'function') render();

  // إخفاء شاشة الـ Splash
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
      }, 700);
    }
  }, 1000);
});