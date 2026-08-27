import { translations } from '../config.js';

// ============================================================
// Sidebar.js
// القائمة الجانبية الثابتة لوضع لوحة التحكم على الكمبيوتر (md:
// وما فوق) - بديل BottomNav.js في الشاشات الكبيرة، بنفس عناصر
// التنقل وبنفس منطق الترجمة/الحالة النشطة بالظبط، عشان السلوك
// يفضل متطابق بين الموبايل والكمبيوتر.
//
// بيتم استدعاؤها من renderCore.js في كل render() وتُحقن في
// #sidebarContainer (خارج #app) عشان تفضل ثابتة بدون ما نكرر
// كتابتها في كل ملف view.
// ============================================================

export const Sidebar = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'] || {};
  const isLoggedIn = localStorage.getItem('phone') || localStorage.getItem('userId');

  // ما فيش Sidebar في صفحات الدخول/التسجيل
  if (!isLoggedIn) return '';

  const name = localStorage.getItem('name') || '';

  const navItems = [
    {
      id: 'home',
      icon: '🏠',
      label: t.navHome || 'الرئيسية',
      action: "window.navigateTo('home')"
    },
    {
      id: 'maintenance',
      icon: '🛠️',
      label: t.navMaintenance || 'الصيانة',
      action: "window.navigateTo('maintenance')"
    },
    {
      id: 'notifications',
      icon: '🔔',
      label: t.navNotifications || 'الإشعارات',
      action: "if (typeof window.openNotificationsModal === 'function') { window.openNotificationsModal(); } else if (typeof window.toggleNotifications === 'function') { window.toggleNotifications(); } else if (typeof window.showNotificationsModal === 'function') { window.showNotificationsModal(); } else { window.navigateTo('notifications'); }"
    },
    {
      id: 'quality',
      icon: '📦',
      label: t.navQuality || 'الجودة',
      action: "window.navigateTo('quality')"
    },
    {
      id: 'system',
      icon: '⚙️',
      label: t.navSystem || 'النظام',
      action: "window.navigateTo('system')"
    }
  ];

  return `
    <div class="hidden md:flex md:flex-col md:sticky w-64 shrink-0
                dyn-card border-e overflow-y-auto"
         style="border-color: var(--app-border); top: var(--app-header-h, 56px); height: calc(100vh - var(--app-header-h, 56px));">

      <!-- شعار/عنوان التطبيق -->
      <div class="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b" style="border-color: var(--app-border);">
        <span class="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-lg shrink-0">
          🛠️
        </span>
        <div class="min-w-0">
          <div class="text-xs font-bold dyn-text-muted truncate">MAINTENANCE SYSTEM</div>
          <div class="text-[10px] dyn-text-muted opacity-50">v1.0</div>
        </div>
      </div>

      <!-- عناصر التنقل -->
      <nav class="flex-1 px-3 py-4 space-y-1">
        ${navItems.map(item => {
          const isActive = activeTab === item.id;
          const iconHtml = item.id === 'notifications'
            ? `
              <span class="relative inline-flex items-center justify-center text-base leading-none w-5">
                ${item.icon}
                <span id="sidebarNotifBadge"
                  class="hidden absolute -top-1.5 -end-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5 flex items-center justify-center leading-none">0</span>
              </span>
            `
            : `<span class="inline-flex items-center justify-center text-base leading-none w-5">${item.icon}</span>`;
          return `
            <button
              type="button"
              onclick="${item.action}"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30'
                  : 'dyn-text-muted hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
              }">
              ${iconHtml}
              <span class="truncate">${item.label}</span>
            </button>
          `;
        }).join('')}
      </nav>

      <!-- أسفل القائمة: تبديل الثيم/اللغة + المستخدم -->
      <div class="px-3 py-4 border-t space-y-2" style="border-color: var(--app-border);">
        <div class="flex items-center gap-2">
          <button
            onclick="window.toggleDarkMode()"
            class="flex-1 px-2.5 py-1.5 dyn-card border rounded-xl text-xs dyn-text-muted active:scale-95 transition shadow-sm"
            title="Toggle theme / تبديل الوضع">
            🌙 / ☀️
          </button>
          <button
            onclick="window.toggleLanguage()"
            class="flex-1 px-2.5 py-1.5 dyn-card border rounded-xl text-xs font-bold dyn-text-muted active:scale-95 transition shadow-sm"
            title="Toggle language / تغيير اللغة">
            🌐 ${currentLang === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        ${name ? `
        <div class="flex items-center gap-2.5 px-1 pt-1">
          <div class="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
            ${name.charAt(0).toUpperCase()}
          </div>
          <div class="min-w-0">
            <div class="text-xs font-bold dyn-text-muted truncate">${name}</div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;
};
