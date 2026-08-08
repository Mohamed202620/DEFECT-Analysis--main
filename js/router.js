// ============================================================
// ROUTER v1.1.1
// نظام التنقل + الحماية
// ============================================================

import { translations, APP_NAME } from "../config.js";
import { hasPermission } from "./auth.js";

let currentView = null;
const appContainer = document.getElementById('app');

// ============================================================
// الخرائط
// ============================================================
const routes = {
  'login': { view: 'loginView', file: './views/loginView.js', permission: null },
  'home': { view: 'homeView', file: './views/homeView.js', permission: 'home' },
  'maintenance': { view: 'maintenanceView', file: './views/maintenanceView.js', permission: 'maintenance' },
  'issue': { view: 'issueView', file: './views/issueView.js', permission: 'issue' },
  'quality': { view: 'qualityView', file: './views/qualityView.js', permission: 'quality' },
  'system': { view: 'systemView', file: './views/systemView.js', permission: 'system' },
  'pm': { view: 'pmView', file: './views/pmView.js', permission: 'pm' },
  'requests': { view: 'requestsView', file: './views/requestsView.js', permission: 'requests' },
  'unauthorized': { view: 'unauthorizedView', file: './views/unauthorizedView.js', permission: null }
};

// ============================================================
// دالة التنقل الرئيسية
// ============================================================
export async function navigateTo(routeName) {
  const route = routes[routeName] || routes['login'];

  // 1. فحص الصلاحيات
  if (route.permission &&!hasPermission(route.permission)) {
    console.warn(`No permission for ${routeName}. Redirecting to unauthorized.`);
    return navigateTo('unauthorized');
  }

  // 2. تحميل الفيو
  try {
    const module = await import(route.file);
    const viewFunction = module[route.view];

    if (typeof viewFunction!== 'function') {
      throw new Error(`Function ${route.view} not found in ${route.file}`);
    }

    // 3. مسح الفيو القديم ورسم الجديد
    appContainer.innerHTML = '';
    currentView = viewFunction(appContainer);

    // 4. تحديث الرابط
    window.location.hash = `#/${routeName}`;
    document.title = `${APP_NAME} - ${routeName}`;

  } catch (error) {
    console.error("Router Error:", error);
    appContainer.innerHTML = `<div class="p-4 text-red-500">Error loading page: ${error.message}</div>`;
  }
}

// ============================================================
// تهيئة الراوتر عند بداية التشغيل
// ============================================================
export function init() {
  // قراءة الرابط #/page
  const hash = window.location.hash.replace('#/', '') || 'login';

  // لو فيه يوزر في localStorage نوديه home
  const user = localStorage.getItem("user");
  if (user && hash === 'login') {
    navigateTo('home');
  } else {
    navigateTo(hash);
  }

  // الاستماع لتغير الرابط
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#/', '') || 'login';
    navigateTo(newHash);
  });
}

// نخليها جلوبال عشان index.html يعرف يكلمها
window.navigateTo = navigateTo;
