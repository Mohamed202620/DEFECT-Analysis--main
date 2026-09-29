import { translations } from '../config.js';
import { hasPermission } from '../permissions.js';
import { isManagerDesktopEligible } from '../managerDesktopCore.js'; // MGR-DESKTOP

// ============================================================
// Sidebar.js
// القائمة الجانبية المتقدمة للكمبيوتر والشاشات الكبيرة (1440px / 1920px+)
// - تدعم وضعين: الممتد (Expanded 256px) والمصغر (Icons-Only Collapsed 68px)
// - مجموعات قابلة للطي والفتح (Collapsible Groups)
// - أيقونات تقنية هندسية متجهة (Clean SVG Icons) بدون إيموجي
// - إزالة أزرار الثيم واللغة والإشعارات المكررة
// ============================================================

const ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  maintenance: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  tickets: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  scanner: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>`,
  pm: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  kaizen: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>`,
  kb: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  machines: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path></svg>`,
  stats: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>`,
  reports: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>`,
  system: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  requests: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`
};

export const Sidebar = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const isAr = currentLang === 'ar';
  const t = translations[currentLang] || translations['ar'] || {};
  const isLoggedIn = localStorage.getItem('phone') || localStorage.getItem('userId');

  if (!isLoggedIn) return '';

  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';

  const canSeeSystemTab =
    hasPermission("users") ||
    hasPermission("requests") ||
    hasPermission("machines") ||
    hasPermission("settings");

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

  const isMgrDesk = typeof isManagerDesktopEligible === "function" && isManagerDesktopEligible(); // MGR-DESKTOP
  const overdueCount = window.dashboardData?.overdue || 0; // MGR-DESKTOP
  const openCount = window.dashboardData?.open || 0; // MGR-DESKTOP
  const pendingRequestsCount = window.pendingUsersCount || 0; // MGR-DESKTOP

  const groups = [
    ...(isMgrDesk ? [{ // MGR-DESKTOP
      id: 'manager',
      title: isAr ? 'الإدارة والتحكم' : 'Management & Command',
      items: [
        {
          id: 'home',
          iconSvg: ICONS.home,
          label: isAr ? 'لوحة القيادة التنفيذية' : 'Command Center',
          badge: overdueCount > 0 ? `${overdueCount} SLA` : (openCount > 0 ? `${openCount}` : null),
          badgeClass: overdueCount > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30 mgr-badge-pulse' : 'bg-amber-500/20 text-amber-400',
          action: "window.navigateTo('home')"
        },
        {
          id: 'reports',
          iconSvg: ICONS.reports,
          label: isAr ? 'التقارير الإدارية' : 'Executive Reports',
          action: "window.navigateTo('reports')"
        },
        {
          id: 'tickets',
          iconSvg: ICONS.tickets,
          label: isAr ? 'متابعة الفنيين والأعطال' : 'Technicians & Tickets',
          badge: openCount > 0 ? `${openCount}` : null,
          badgeClass: 'bg-blue-500/20 text-blue-400',
          action: "window.navigateTo('tickets')"
        },
        {
          id: 'requests',
          iconSvg: ICONS.requests,
          label: isAr ? 'المستخدمون والطلبات' : 'Users & Requests',
          badge: pendingRequestsCount > 0 ? `${pendingRequestsCount}` : null,
          badgeClass: 'bg-indigo-500/20 text-indigo-400',
          action: "window.navigateTo('requests')"
        }
      ]
    }] : []), // MGR-DESKTOP
    {
      id: 'ops',
      title: isAr ? 'العمليات والتشغيل' : 'Operations',
      items: [
        {
          id: 'home',
          iconSvg: ICONS.home,
          label: t.navHome || (isAr ? 'الرئيسية' : 'Home'),
          action: "window.navigateTo('home')"
        },
        {
          id: 'maintenance',
          iconSvg: ICONS.maintenance,
          label: t.navMaintenance || (isAr ? 'مركز الصيانة' : 'Maintenance Hub'),
          action: "window.navigateTo('maintenance')"
        },
        {
          id: 'tickets',
          iconSvg: ICONS.tickets,
          label: isAr ? 'لوحة البلاغات' : 'Tickets Board',
          action: "window.navigateTo('tickets')"
        },
        {
          id: 'maintenanceSearch',
          iconSvg: ICONS.search,
          label: isAr ? 'بحث وفلترة الأعطال' : 'Defect Search',
          action: "window.navigateTo('maintenanceSearch')"
        },
        ...(hasPermission("maintenance") || hasPermission("errorScanner") ? [{
          id: 'errorScanner',
          iconSvg: ICONS.scanner,
          label: isAr ? 'فاحص الشاشات' : 'Error Scanner',
          action: "window.navigateTo('errorScanner')"
        }] : []),
        ...(hasPermission("pm") ? [{
          id: 'pm',
          iconSvg: ICONS.pm,
          label: isAr ? 'الصيانة الوقائية' : 'Preventive Maint.',
          action: "window.navigateTo('pm')"
        }] : []),
        ...(hasPermission("suggestions") ? [{
          id: 'kaizen',
          iconSvg: ICONS.kaizen,
          label: isAr ? 'بنك الكايزن' : 'Kaizen Board',
          action: "window.navigateTo('kaizenBoard')"
        }] : []),
        ...(hasPermission("kb") ? [{
          id: 'kb',
          iconSvg: ICONS.kb,
          label: isAr ? 'قاعدة المعرفة' : 'Knowledge Base',
          action: "window.navigateTo('kb')"
        }] : [])
      ]
    },
    {
      id: 'assets',
      title: isAr ? 'البيانات والتحليلات' : 'Intelligence & Assets',
      items: [
        ...(hasPermission("machines") ? [{
          id: 'machines',
          iconSvg: ICONS.machines,
          label: isAr ? 'سجل الماكينات' : 'Machines Register',
          action: "window.navigateTo('machines')"
        }] : []),
        ...(hasPermission("statistics") ? [{
          id: 'stats',
          iconSvg: ICONS.stats,
          label: isAr ? 'داشبورد المؤشرات' : 'Analytics Dashboard',
          action: "window.navigateTo('stats')"
        }] : []),
        ...(hasPermission("reports") ? [{
          id: 'reports',
          iconSvg: ICONS.reports,
          label: isAr ? 'التقارير والإكسيل' : 'Excel Reports',
          action: "window.navigateTo('reports')"
        }] : [])
      ]
    },
    ...(canSeeSystemTab ? [{
      id: 'admin',
      title: isAr ? 'الإدارة والتحكم' : 'Administration',
      items: [
        {
          id: 'system',
          iconSvg: ICONS.system,
          label: t.navSystem || (isAr ? 'لوحة النظام' : 'System Hub'),
          action: "window.navigateTo('system')"
        },
        ...(hasPermission("users") ? [{
          id: 'users',
          iconSvg: ICONS.users,
          label: isAr ? 'إدارة المستخدمين' : 'User Management',
          action: "window.navigateTo('users')"
        }] : []),
        ...(hasPermission("requests") ? [{
          id: 'requests',
          iconSvg: ICONS.requests,
          label: isAr ? 'طلبات الانضمام' : 'Join Requests',
          action: "window.navigateTo('requests')"
        }] : [])
      ]
    }] : [])
  ];

  return `
    <aside
      id="desktopSidebar"
      class="hidden lg:flex lg:flex-col lg:sticky shrink-0 border-e transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-64 xl:w-72'
      }"
      style="background: var(--app-card-bg); border-color: var(--app-border); top: var(--app-header-h, 64px); height: calc(100vh - var(--app-header-h, 64px));"
    >
      <!-- رأس الشريط الجانبي مع زر طي/توسيع -->
      <div class="h-12 px-2.5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'} border-b shrink-0" style="border-color: var(--app-border);">
        ${!isCollapsed ? `
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
            <span class="text-[11px] font-bold tracking-wider text-slate-300 uppercase truncate">
              ${isAr ? 'نظام الصيانة والتشغيل' : 'Navigation'}
            </span>
          </div>
        ` : ''}

        <button
          type="button"
          id="btnToggleSidebar"
          onclick="window.toggleSidebarCollapse()"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition active:scale-90 cursor-pointer shadow-sm"
          title="${isCollapsed ? (isAr ? 'توسيع القائمة الجانبية ( [ )' : 'Expand Sidebar ( [ )') : (isAr ? 'طي القائمة الجانبية ( [ )' : 'Collapse Sidebar ( [ )')}"
          aria-label="${isCollapsed ? (isAr ? 'توسيع القائمة الجانبية' : 'Expand Sidebar') : (isAr ? 'طي القائمة الجانبية' : 'Collapse Sidebar')}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="${
              isAr
                ? (isCollapsed ? '15 18 9 12 15 6' : '9 18 15 12 9 6')
                : (isCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6')
            }"></polyline>
          </svg>
        </button>
      </div>

      <!-- قائمة العناصر المجمعة مع سكرول بار أنيق -->
      <div class="flex-1 px-2.5 py-3 overflow-y-auto space-y-4" style="scrollbar-width: thin;">
        ${groups.map(group => `
          <div class="space-y-1">
            ${!isCollapsed ? `
              <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 opacity-80">
                ${group.title}
              </div>
            ` : `
              <div class="w-6 h-px mx-auto my-2 bg-slate-700/50"></div>
            `}

            ${group.items.map(item => {
              const active = isTabActive(item.id);
              return `
                <button
                  type="button"
                  onclick="${item.action}"
                  title="${isCollapsed ? item.label : ''}"
                  class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    active
                      ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-medium'
                  }">
                  <span class="inline-flex items-center justify-center w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}">
                    ${item.iconSvg}
                  </span>
                  ${!isCollapsed ? `
                    <span class="truncate flex-1 text-start">${item.label}</span>
                    ${item.badge ? `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.badgeClass || 'bg-slate-700 text-slate-300'}">${item.badge}</span>` : ''}
                    ${active ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>` : ''}
                  ` : ''}
                </button>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>

      <!-- أسفل الشريط الجانبي: حالة الاتصال والنسخة -->
      <div class="p-2.5 border-t shrink-0 flex items-center justify-between text-[11px] text-slate-400" style="border-color: var(--app-border);">
        ${!isCollapsed ? `
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-[10px] font-medium text-slate-300">${isAr ? 'متصل بالسيرفر' : 'Connected'}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">v2.4</span>
        ` : `
          <div class="w-full flex justify-center">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="${isAr ? 'متصل بالسيرفر' : 'Connected'}"></span>
          </div>
        `}
      </div>
    </aside>
  `;
};

// ============================================================
// دالة طي وتوسيع الشريط الجانبي للشاشات الكبيرة (Desktop >= 1024px)
// ============================================================
if (typeof window !== "undefined") {
  /**
   * طي أو توسيع الشريط الجانبي للشاشات الكبيرة فقط
   */
  window.toggleSidebarCollapse = function() {
    const isCurrentlyCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    const nextState = !isCurrentlyCollapsed;
    localStorage.setItem('sidebar_collapsed', nextState ? 'true' : 'false');
    
    const container = document.getElementById("sidebarContainer");
    const activeTab = window.currentPage || localStorage.getItem('lastPage') || 'home';
    if (container) {
      container.className = `hidden lg:block shrink-0 ${nextState ? 'w-16' : 'w-64 xl:w-72'}`;
      container.innerHTML = Sidebar(activeTab);
    }

    // إشعار فوري لـ Chart.js وباقي الجداول المتجاوبة للتكيف مع العرض الجديد للشاشات الكبيرة
    window.dispatchEvent(new Event('resize'));
    if (typeof window.refreshManagerDashboardCharts === 'function') {
      setTimeout(window.refreshManagerDashboardCharts, 80);
    }
  };

  // اختصار لوحة المفاتيح: [ أو Ctrl+B لطي وتوسيع القائمة على أجهزة الكمبيوتر
  window.addEventListener('keydown', (e) => {
    if (
      (e.key === '[' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) ||
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')
    ) {
      e.preventDefault();
      window.toggleSidebarCollapse();
    }
  });
}


