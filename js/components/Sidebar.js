import { translations } from '../config.js';
import { hasPermission } from '../permissions.js';

// ============================================================
// Sidebar.js
// القائمة الجانبية المتقدمة للكمبيوتر والشاشات الكبيرة (lg: وما فوق)
// تحويل الشريط الجانبي إلى مركز تحكم للمصنع (Enterprise Desktop Navigation)
// مقسم حسب قطاعات العمليات، والتحليلات، والإدارة، مع الحفاظ الكامل على
// الصلاحيات والتوجيه، ومزامنة الحالة النشطة والإشعارات والثيم واللغة.
// ============================================================

export const Sidebar = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const isAr = currentLang === 'ar';
  const t = translations[currentLang] || translations['ar'] || {};
  const isLoggedIn = localStorage.getItem('phone') || localStorage.getItem('userId');

  // ما فيش Sidebar في صفحات الدخول/التسجيل
  if (!isLoggedIn) return '';

  const name = localStorage.getItem('name') || '';
  const role = (localStorage.getItem('role') || 'technician').trim().toUpperCase();

  const canSeeSystemTab =
    hasPermission("users") ||
    hasPermission("requests") ||
    hasPermission("machines") ||
    hasPermission("settings");

  // التحقق الذكي من التبويب النشط حتى مع الصفحات الفرعية
  const isTabActive = (itemKey) => {
    if (activeTab === itemKey) return true;
    if (itemKey === 'tickets' && activeTab === 'tickets') return true;
    if (itemKey === 'kaizen' && (activeTab === 'kaizenBoard' || activeTab === 'suggestions' || activeTab === 'suggestion')) return true;
    if (itemKey === 'machines' && (activeTab === 'machines' || activeTab === 'machineProfile' || activeTab === 'dailyAM' || activeTab === 'fiveS' || activeTab === 'qr')) return true;
    if (itemKey === 'system' && (activeTab === 'system' || activeTab === 'settings')) return true;
    if (itemKey === 'users' && activeTab === 'users') return true;
    if (itemKey === 'requests' && activeTab === 'requests') return true;
    return false;
  };

  // المجموعات الوظيفية
  const groups = [
    {
      title: isAr ? 'العمليات والتشغيل' : 'Operations',
      items: [
        {
          id: 'home',
          icon: '🏠',
          label: t.navHome || (isAr ? 'الرئيسية' : 'Home'),
          action: "window.navigateTo('home')"
        },
        {
          id: 'maintenance',
          icon: '🛠️',
          label: t.navMaintenance || (isAr ? 'مركز الصيانة' : 'Maintenance'),
          action: "window.navigateTo('maintenance')"
        },
        {
          id: 'tickets',
          icon: '📋',
          label: isAr ? 'لوحة البلاغات' : 'Tickets Board',
          action: "window.navigateTo('tickets')"
        },
        {
          id: 'maintenanceSearch',
          icon: '🔎',
          label: isAr ? 'بحث وفلترة الأعطال' : 'Defect Search',
          action: "window.navigateTo('maintenanceSearch')"
        },
        ...(hasPermission("maintenance") || hasPermission("errorScanner") ? [{
          id: 'errorScanner',
          icon: '⚡',
          label: isAr ? 'فاحص الشاشات' : 'Error Scanner',
          action: "window.navigateTo('errorScanner')"
        }] : []),
        ...(hasPermission("pm") ? [{
          id: 'pm',
          icon: '📝',
          label: isAr ? 'الصيانة الوقائية' : 'Preventive Maint.',
          action: "window.navigateTo('pm')"
        }] : []),
        ...(hasPermission("suggestions") ? [{
          id: 'kaizen',
          icon: '💡',
          label: isAr ? 'بنك الأفكار والكايزن' : 'Kaizen Board',
          action: "window.navigateTo('kaizenBoard')"
        }] : []),
        ...(hasPermission("kb") ? [{
          id: 'kb',
          icon: '📚',
          label: isAr ? 'قاعدة المعرفة' : 'Knowledge Base',
          action: "window.navigateTo('kb')"
        }] : [])
      ]
    },
    {
      title: isAr ? 'البيانات والتحليلات' : 'Assets & Intelligence',
      items: [
        ...(hasPermission("machines") ? [{
          id: 'machines',
          icon: '🏭',
          label: isAr ? 'سجل الماكينات' : 'Machines Register',
          action: "window.navigateTo('machines')"
        }] : []),
        ...(hasPermission("statistics") ? [{
          id: 'stats',
          icon: '📊',
          label: isAr ? 'داشبورد المؤشرات' : 'Analytics Dashboard',
          action: "window.navigateTo('stats')"
        }] : []),
        ...(hasPermission("reports") ? [{
          id: 'reports',
          icon: '📑',
          label: isAr ? 'التقارير والإكسيل' : 'Excel Reports',
          action: "window.navigateTo('reports')"
        }] : [])
      ]
    },
    ...(canSeeSystemTab ? [{
      title: isAr ? 'الإدارة والتحكم' : 'Administration',
      items: [
        {
          id: 'system',
          icon: '⚙️',
          label: t.navSystem || (isAr ? 'لوحة النظام' : 'System Hub'),
          action: "window.navigateTo('system')"
        },
        ...(hasPermission("users") ? [{
          id: 'users',
          icon: '👥',
          label: isAr ? 'إدارة المستخدمين' : 'User Management',
          action: "window.navigateTo('users')"
        }] : []),
        ...(hasPermission("requests") ? [{
          id: 'requests',
          icon: '⏳',
          label: isAr ? 'طلبات الانضمام' : 'Join Requests',
          action: "window.navigateTo('requests')"
        }] : [])
      ]
    }] : [])
  ];

  const roleColor = {
    ADMIN: "bg-red-500/20 text-red-300 border-red-500/40",
    MANAGER: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    SUPERVISOR: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    ENGINEER: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    TECHNICIAN: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    OPERATOR: "bg-slate-500/20 text-slate-300 border-slate-500/40"
  }[role] || "bg-blue-500/20 text-blue-300 border-blue-500/40";

  return `
    <aside class="hidden lg:flex lg:flex-col lg:sticky w-64 xl:w-72 shrink-0
                 dyn-card border-e select-none"
           style="border-color: var(--app-border); top: var(--app-header-h, 56px); height: calc(100vh - var(--app-header-h, 56px));">

      <!-- زر الإجراء السريع الدائم بالأعلى: تسجيل بلاغ عطل فوري -->
      <div class="p-3 border-b shrink-0" style="border-color: var(--app-border);">
        <button
          type="button"
          onclick="window.navigateTo('issue')"
          class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 active:scale-95 shadow-md shadow-red-950/40 border border-red-500/50 transition-all cursor-pointer group ${
            activeTab === 'issue' || activeTab === 'report' ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-slate-900' : ''
          }">
          <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span>🚨 ${isAr ? 'تسجيل بلاغ عطل' : 'Report Breakdown'}</span>
          <span class="rtl:rotate-180 group-hover:translate-x-1 transition-transform">›</span>
        </button>
      </div>

      <!-- عناصر التنقل المجمعة مع سكرول بار سلس -->
      <div class="flex-1 px-3 py-3 overflow-y-auto space-y-4" style="scrollbar-width: thin;">
        ${groups.filter(g => g.items && g.items.length > 0).map(group => `
          <div class="space-y-1">
            <div class="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider dyn-text-muted opacity-60">
              ${group.title}
            </div>
            ${group.items.map(item => {
              const active = isTabActive(item.id);
              return `
                <button
                  type="button"
                  onclick="${item.action}"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30'
                      : 'dyn-text-muted hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 hover:text-white font-medium'
                  }">
                  <span class="inline-flex items-center justify-center text-sm leading-none w-5 shrink-0">${item.icon}</span>
                  <span class="truncate flex-1 text-start">${item.label}</span>
                </button>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>

      <!-- أسفل القائمة: تحكم سريع + بطاقة المستخدم مع تسجيل الخروج -->
      <div class="p-3 border-t space-y-2.5 shrink-0 bg-black/5 dark:bg-black/20" style="border-color: var(--app-border);">

        <!-- شريط أدوات التحكم السريع (إشعارات + ثيم + لغة) -->
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onclick="if (typeof window.openNotificationsModal === 'function') { window.openNotificationsModal(); } else if (typeof window.toggleNotifications === 'function') { window.toggleNotifications(); } else { window.navigateTo('notifications'); }"
            class="relative flex-1 py-1.5 px-2 dyn-card border rounded-xl text-xs font-bold dyn-text-muted hover:text-white active:scale-95 transition shadow-sm flex items-center justify-center gap-1"
            title="${t.navNotifications || (isAr ? 'الإشعارات' : 'Notifications')}">
            <span>🔔</span>
            <span id="sidebarNotifBadge"
              class="hidden bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] px-1 flex items-center justify-center leading-none">0</span>
          </button>

          <button
            type="button"
            onclick="window.toggleDarkMode()"
            class="flex-1 py-1.5 px-2 dyn-card border rounded-xl text-xs dyn-text-muted hover:text-white active:scale-95 transition shadow-sm flex items-center justify-center"
            title="Toggle theme / تبديل الوضع">
            🌙 / ☀️
          </button>

          <button
            type="button"
            onclick="window.toggleLanguage()"
            class="flex-1 py-1.5 px-2 dyn-card border rounded-xl text-xs font-black dyn-text-muted hover:text-white active:scale-95 transition shadow-sm flex items-center justify-center"
            title="Toggle language / تغيير اللغة">
            🌐 ${currentLang === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        <!-- بطاقة المستخدم الحالية مع زر تسجيل الخروج المباشر -->
        ${name ? `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-xs shrink-0">
              ${name.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold dyn-text-muted truncate text-white">${name}</div>
              <span class="inline-block text-[9px] font-black px-1.5 py-0.2 rounded border ${roleColor}">
                ${role}
              </span>
            </div>
          </div>

          <button
            type="button"
            onclick="if(confirm('${isAr ? 'هل تريد تسجيل الخروج من النظام؟' : 'Are you sure you want to logout?'}')) { window.logout(); }"
            class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition active:scale-90 shrink-0"
            title="${isAr ? 'تسجيل الخروج' : 'Logout'}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
        ` : ''}

      </div>
    </aside>
  `;
};

