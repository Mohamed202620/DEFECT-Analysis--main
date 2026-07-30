// 1. استيراد الإعدادات والترجمات
import { GOOGLE_SCRIPT_URL, translations } from './config.js';

// 2. استيراد الواجهات من مجلد views الفرعي (تم تصحيح المسارات هنا)
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';

// 3. استيراد دوال العمليات المساعدة (Workflow)
import { saveDefectData, handleDefectFile } from './workflow.js';

// --- تعريف المتغيرات العامة للنظام (Global State) ---
export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = '';
export let mainChart = null;
export let statsChart = null;
export let defectImages = [null, null, null];

// --- الدوال الأساسية للتنقل واللغة ---

export function navigateTo(page) {
  if (page === "users" && currentRole !== "admin") {
    alert("ليس لديك صلاحية الوصول لهذه الصفحة");
    return;
  }
  currentPage = page;
  if (page === "home" && typeof loadDashboard === 'function') {
    loadDashboard();
  }
  render();
  window.scrollTo(0, 0);
}

export function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  const htmlTag = document.getElementById('html-tag');
  if (htmlTag) {
    htmlTag.dir = translations[currentLang].dir;
    htmlTag.lang = currentLang;
  }
  render();
}

export function toggleDarkMode() {
  document.body.classList.toggle('light-mode');
}

export function logout() {
  localStorage.removeItem("phone");
  localStorage.removeItem("user");
  currentPage = "login";
  render();
}

export function contactSupport() {
  window.open("https://wa.me/201000000000", "_blank");
}

// --- دالة العرض الرئيسية (Render) ---
export function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (currentPage === 'login') {
    app.innerHTML = `
      <div class="p-6 max-w-sm mx-auto text-center mt-10">
        <h2 class="text-xl font-bold mb-4">تسجيل الدخول</h2>
        <input type="tel" id="phoneInput" placeholder="رقم الهاتف" class="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white mb-4"/>
        <button onclick="doLogin()" class="w-full py-3 bg-blue-600 rounded-lg font-bold">دخول</button>
      </div>
    `;
  } else if (currentPage === 'home') {
    app.innerHTML = typeof HomeView === 'function' ? HomeView() : '';
  } else if (currentPage === 'maint') {
    app.innerHTML = typeof ReportView === 'function' ? ReportView() : '';
  } else if (currentPage === 'pm') {
    app.innerHTML = typeof PMView === 'function' ? PMView() : '';
  } else if (currentPage === 'reports') {
    app.innerHTML = typeof ReportsView === 'function' ? ReportsView() : '';
  }
}

export function doLogin() {
  const phone = document.getElementById('phoneInput')?.value;
  if (phone) {
    localStorage.setItem("phone", phone);
    localStorage.setItem("user", JSON.stringify({ phone: phone, role: 'admin' }));
    currentRole = 'admin';
    currentPage = 'home';
    render();
  } else {
    alert("يرجى إدخال رقم الهاتف");
  }
}

// --- 4. ربط جميع الدوال بـ Window لتسريع الاستجابة لأحداث HTML ---
window.navigateTo = navigateTo;
window.toggleLanguage = toggleLanguage;
window.toggleDarkMode = toggleDarkMode;
window.doLogin = doLogin;
window.logout = logout;
window.contactSupport = contactSupport;
window.saveDefectData = saveDefectData;
window.handleDefectFile = handleDefectFile;

// --- 5. التشغيل عند جاهزية الصفحة ---
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
  } else {
    currentPage = 'login';
  }

  // رسم الواجهة الأولية
  render();

  // إخفاء الـ Splash Screen بأمان
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
      }, 700);
    }
  }, 800);
});