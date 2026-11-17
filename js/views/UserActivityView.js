// ============================================================
// UserActivityView.js
// عرض متابعة نشاط المستخدمين (للـ Admin فقط)
// ============================================================

import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";
import { hasPermission, isAdminRole, getCurrentRole } from "../permissions.js";
import { fetchAllUserActivity, getOnlineUsersCount, subscribeToUserActivity, startHeartbeat } from "../services/api.js";
import { escapeHtml } from "../utils/escapeHtml.js";

export const UserActivityView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).userActivity || {};
  const isAdmin = isAdminRole(getCurrentRole());

  // إذا لم يكن Admin، إظهار رسالة عدم صلاحية
  if (!isAdmin) {
    return `
<div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-24 space-y-5 text-slate-900 dark:text-white">
  <div class="text-center py-12">
    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-3xl">🚫</div>
    <h3 class="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
      ${t.noPermissionTitle || (currentLang === 'en' ? 'Access Denied' : 'غير مصرح')}
    </h3>
    <p class="text-slate-600 dark:text-slate-300">
      ${t.noPermissionDesc || (currentLang === 'en' ? 'Only administrators can view user activity.' : 'المديرون فقط يمكنهم مشاهدة نشاط المستخدمين.')}
    </p>
    <button onclick="window.navigateTo('maintenance')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
      ${t.backToMaintenance || (currentLang === 'en' ? 'Back to Maintenance' : 'العودة للصيانة')}
    </button>
  </div>
</div>
${BottomNav("maintenance")}`;
  }

  return `
<div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-24 space-y-5 text-slate-900 dark:text-white" id="userActivityPage">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-slate-300 dark:border-gray-800 pb-3">
    <div>
      <h2 class="text-base font-black text-purple-700 dark:text-purple-400 flex items-center gap-2">
        <span>👥</span> ${t.title || (currentLang === 'en' ? 'User Activity Monitor' : 'متابعة نشاط المستخدمين')}
      </h2>
      <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
        ${t.subtitle || (currentLang === 'en' ? 'Real-time online status and last seen' : 'حالة الاتصال الفورية وآخر ظهور')}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span id="onlineCountBadge" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>0 ${currentLang === 'en' ? 'Online' : 'متصل'}</span>
      </span>
      <button 
        type="button"
        id="refreshActivityBtn"
        onclick="window.refreshUserActivity()"
        class="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1"
        aria-label="${t.refresh || (currentLang === 'en' ? 'Refresh' : 'تحديث')}">
        <span>🔄</span>
        <span>${t.refresh || (currentLang === 'en' ? 'Refresh' : 'تحديث')}</span>
      </button>
    </div>
  </div>

  <!-- قائمة المستخدمين -->
  <div class="space-y-3" id="userActivityList">
    <div class="text-center py-8 text-slate-500 dark:text-slate-400">
      <div class="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-sm">${t.loading || (currentLang === 'en' ? 'Loading activity...' : 'جاري تحميل النشاط...')}</p>
    </div>
  </div>

  <!-- تحديث تلقائي كل 30 ثانية -->
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 dark:text-slate-400 px-3 py-1.5 bg-white/80 dark:bg-gray-900/80 rounded-full border border-slate-200 dark:border-gray-700">
    ${t.autoRefresh || (currentLang === 'en' ? 'Auto-refresh every 30s' : 'تحديث تلقائي كل 30 ثانية')}
  </div>

</div>

${BottomNav("maintenance")}

<script>
(function() {
  'use strict';
  
  let activityUnsubscribe = null;
  let refreshInterval = null;
  let isPageActive = true;
  
  // دالة تنسيق آخر ظهور
  function formatLastSeen(timestamp) {
    if (!timestamp) return '${t.never || (currentLang === 'en' ? 'Never' : 'لم يسبق له الظهور')}';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return '${t.invalidDate || (currentLang === 'en' ? 'Invalid date' : 'تاريخ غير صالح')}'; }
  }
  
  // دالة حساب حالة الاتصال
  function computeOnlineStatus(data) {
    const isOnline = data.isOnline === true;
    const lastHeartbeat = data.lastHeartbeat;
    const lastActivity = data.lastActivity;
    const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // دقيقتان
    
    let lastSeenTime = null;
    if (lastHeartbeat) {
      lastSeenTime = lastHeartbeat.toDate ? lastHeartbeat.toDate().getTime() : new Date(lastHeartbeat).getTime();
    } else if (lastActivity) {
      lastSeenTime = lastActivity.toDate ? lastActivity.toDate().getTime() : new Date(lastActivity).getTime();
    }
    
    const computedOnline = lastSeenTime && (Date.now() - lastSeenTime) < OFFLINE_THRESHOLD_MS;
    return isOnline && computedOnline;
  }
  
  // عرض قائمة المستخدمين
  function renderUserList(users) {
    const container = document.getElementById('userActivityList');
    const badge = document.getElementById('onlineCountBadge');
    if (!container) return;
    
    if (!users || users.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-slate-500 dark:text-slate-400"><p>${t.noUsers || (currentLang === 'en' ? 'No user activity found' : 'لا يوجد نشاط للمستخدمين')}</p></div>';
      if (badge) badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>0 ${currentLang === 'en' ? 'Online' : 'متصل'}</span>';
      return;
    }
    
    // حساب عدد المتصلين
    const onlineUsers = users.filter(u => computeOnlineStatus(u));
    if (badge) {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>' + onlineUsers.length + ' ${currentLang === 'en' ? 'Online' : 'متصل'}</span>';
    }
    
    // فرز: المتصلين أولاً، ثم حسب آخر نشاط
    const sortedUsers = [...users].sort((a, b) => {
      const aOnline = computeOnlineStatus(a);
      const bOnline = computeOnlineStatus(b);
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aTime = a.rawLastHeartbeat || a.rawLastActivity;
      const bTime = b.rawLastHeartbeat || b.rawLastActivity;
      const aMs = aTime ? (aTime.toDate ? aTime.toDate().getTime() : new Date(aTime).getTime()) : 0;
      const bMs = bTime ? (bTime.toDate ? bTime.toDate().getTime() : new Date(bTime).getTime()) : 0;
      return bMs - aMs;
    });
    
    container.innerHTML = sortedUsers.map(user => {
      const isOnline = computeOnlineStatus(user);
      const lastSeen = user.rawLastHeartbeat || user.rawLastActivity;
      const lastSeenFormatted = formatLastSeen(lastSeen);
      const roleLabel = user.role || 'user';
      const roleBadgeClass = getRoleBadgeClass(roleLabel);
      
      return '<div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">' +
        '<div class="flex items-center gap-3 min-w-0 flex-1">' +
          '<div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xl shrink-0">' +
            '<span>👤</span>' +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="font-bold text-sm text-slate-900 dark:text-white truncate">' + escapeHtml(user.userName || 'غير معروف') + '</div>' +
            '<div class="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">' +
              '<span class="' + roleBadgeClass + '">' + escapeHtml(roleLabel) + '</span>' +
              '<span class="flex items-center gap-1">' +
                '<span class="w-2 h-2 rounded-full ' + (isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400') + '"></span>' +
                '<span>' + (isOnline ? '${t.online || (currentLang === 'en' ? 'Online' : 'متصل')}' : '${t.offline || (currentLang === 'en' ? 'Offline' : 'غير متصل')}') + '</span>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="text-right sm:text-left w-full sm:w-auto flex items-center gap-2">' +
          '<div class="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">' +
            '<span class="font-medium">${t.lastSeen || (currentLang === 'en' ? 'Last seen' : 'آخر ظهور')}:</span> ' +
            escapeHtml(lastSeenFormatted) +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  function getRoleBadgeClass(role) {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold';
    switch (role) {
      case 'admin': return base + ' bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
      case 'manager': case 'supervisor': return base + ' bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'engineer': case 'maintainer': return base + ' bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
      case 'technician': return base + ' bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'operator': return base + ' bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      default: return base + ' bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  }
  
  // تحميل بيانات النشاط
  async function loadUserActivity() {
    try {
      const { fetchAllUserActivity } = await import('/js/services/api.js');
      const result = await fetchAllUserActivity();
      if (result.status === 'success') {
        renderUserList(result.data);
      } else {
        console.error('Failed to fetch user activity:', result.message);
        const container = document.getElementById('userActivityList');
        if (container) {
          container.innerHTML = '<div class="text-center py-8 text-red-500"><p>${t.loadError || (currentLang === 'en' ? 'Failed to load activity' : 'فشل تحميل النشاط')}</p></div>';
        }
      }
    } catch (error) {
      console.error('UserActivity load error:', error);
    }
  }
  
  // بدء المراقبة الفورية
  function startRealtimeSubscription() {
    try {
      const { subscribeToUserActivity } = await import('/js/services/api.js');
      activityUnsubscribe = subscribeToUserActivity((users) => {
        if (isPageActive) {
          renderUserList(users);
        }
      });
    } catch (error) {
      console.warn('Realtime subscription failed:', error);
    }
  }
  
  // تحديث دوري احتياطي
  function startPeriodicRefresh() {
    refreshInterval = setInterval(() => {
      if (isPageActive) loadUserActivity();
    }, 30000); // كل 30 ثانية
  }
  
  // تهيئة الصفحة
  function initPage() {
    // بدء الـ heartbeat للمستخدم الحالي (Admin)
    try {
      const { startHeartbeat } = await import('/js/services/api.js');
      startHeartbeat();
    } catch (_) {}
    
    loadUserActivity();
    startRealtimeSubscription();
    startPeriodicRefresh();
  }
  
  // تنظيف عند مغادرة الصفحة
  window.addEventListener('beforeunload', () => {
    isPageActive = false;
    if (activityUnsubscribe) activityUnsubscribe();
    if (refreshInterval) clearInterval(refreshInterval);
  });
  
  // دالة تحديث يدوي
  window.refreshUserActivity = loadUserActivity;
  
  // تشغيل التهيئة عند تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
})();
</script>
`;
};
