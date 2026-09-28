import { BottomNav } from "../components/BottomNav.js";
import { hasPermission } from "../permissions.js";
import { translations } from "../config.js";
import { renderAttendanceCard } from "../attendanceCard.js";
import { isClosedStatus, isOverdueTicket, parseTicketDate } from "../ticketStatusConstants.js";

// ============================================================
// homeView.js - الواجهة الرئيسية المتطورة للشاشات الكبيرة والصغيرة
// Enterprise CMMS Dashboard for MSCANCO EGYPT
// - يدعم العرضين: لوحة قرارات المدير (Manager View) وبيئة عمل الفني (Technician View)
// - شبكة 12 عمود متجاوبة مع شاشات 1440px / 1920px / 2560px
// - مؤشرات KPI حية بمتوسط زمن الإصلاح MTTR محسوب بدقة ومخططات بيانية
// - مركز تنبيهات عاجلة، قائمة الماكينات الأكثر عطلاً، جدول أحدث البلاغات
// ============================================================

export const HomeView = () => {
  const currentLang = window.currentLang || localStorage.getItem("lang") || "ar";
  const isEn = currentLang === "en";
  const t = (translations[currentLang] || translations.ar || {}).home || {};

  const userRole = (localStorage.getItem("role") || "technician").toUpperCase();
  const userName = localStorage.getItem("name") || "";
  const isManagerRole = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "ENGINEER" || userRole === "SUPERVISOR";
  const savedMode = localStorage.getItem("home_view_mode");
  const activeMode = savedMode ? savedMode : (isManagerRole ? "manager" : "technician");

  const savedPeriod = localStorage.getItem('home_period') || 'week';
  const stats = window.dashboardData || {
    open: 0,
    closed: 0,
    today: 0,
    overdue: 0,
    total: 0,
    mttrFormatted: "—",
    topMachines: [],
    topTechs: [],
    urgentAlerts: [],
    recentTickets: [],
    lastUpdated: new Date()
  };

  const waNumber = "201067988554";
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(t.waMessage || "Hello")}`;

  return `
  <!-- ============================================================ -->
  <!-- 1. واجهة الموبايل الأصلية بالكامل (Mobile View < 1024px) -->
  <!-- التصميم الأصلي المألوف كما كان: بطاقة الترحيب، كارت الحضور، الكروت الحية، الوصول السريع -->
  <!-- ============================================================ -->
  <div class="lg:hidden w-full max-w-lg mx-auto px-3.5 py-4 pb-24 space-y-4">
    ${renderMobileHomeView(stats, isEn, t, waUrl, currentLang, userName, userRole)}
  </div>

  <!-- ============================================================ -->
  <!-- 2. واجهة الشاشات الكبيرة المتطورة (Large Screens Dashboard >= 1024px) -->
  <!-- 12 عمود مخصصة للشاشات الكبيرة (1440px / 1920px / 2560px) -->
  <!-- ============================================================ -->
  <div class="hidden lg:block app-page w-full max-w-[1600px] mx-auto px-6 lg:px-8 py-5 pb-24 space-y-6">

    <!-- شريط الرأس وتحديد المنظور والفلترة الزمنية -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b" style="border-color: var(--app-border);">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl sm:text-2xl lg:text-[26px] font-black tracking-tight text-white flex items-center gap-2">
            <span>${isEn ? 'MSCANCO Maintenance Cockpit' : 'لوحة متابعة الصيانة وتشغيل المصنع'}</span>
          </h1>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>${isEn ? 'Live Telemetry' : 'مزامنة حية'}</span>
          </span>
        </div>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">
          ${isEn 
            ? 'Factory plant metrics, bottleneck machines, SLA alerts, and open breakdown logs' 
            : 'مؤشرات أداء الخطوط، الماكينات الأكثر عطلاً، مراقبة اتفاقيات الخدمة SLA، وسجل البلاغات'}
        </p>
      </div>

      <!-- أدوات التحكم السريع في التاريخ ومنظور العرض -->
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <!-- أزرار الفترات الزمنية -->
        <div class="inline-flex items-center p-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-semibold" id="homePeriodGroup">
          <button type="button" onclick="window.setHomePeriod('today')" class="home-period-btn px-2.5 py-1 rounded-md transition ${savedPeriod === 'today' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white'}" data-period="today">
            ${isEn ? 'Today' : 'اليوم'}
          </button>
          <button type="button" onclick="window.setHomePeriod('week')" class="home-period-btn px-2.5 py-1 rounded-md transition ${savedPeriod === 'week' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white'}" data-period="week">
            ${isEn ? '7 Days' : '7 أيام'}
          </button>
          <button type="button" onclick="window.setHomePeriod('month')" class="home-period-btn px-2.5 py-1 rounded-md transition ${savedPeriod === 'month' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white'}" data-period="month">
            ${isEn ? '30 Days' : '30 يوم'}
          </button>
        </div>

        <!-- زر التبديل بين وضع المدير ووضع الفني -->
        <button
          type="button"
          onclick="window.setHomeViewMode('${activeMode === 'manager' ? 'technician' : 'manager'}')"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
            activeMode === 'manager' 
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
          }">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
          <span>${activeMode === 'manager' ? (isEn ? 'Switch to Tech View' : 'منظور الفني') : (isEn ? 'Switch to Manager View' : 'منظور المدير')}</span>
        </button>

        <!-- وقت آخر تحديث وزر إعادة التحميل اليدوي -->
        <div class="flex items-center gap-1 text-[11px] text-slate-400">
          <span class="hidden sm:inline">${isEn ? 'Updated:' : 'تحديث:'}</span>
          <span id="lastUpdateTime" class="font-mono text-slate-300">${new Date().toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            type="button"
            onclick="if(window.loadDashboardStats) window.loadDashboardStats();"
            class="p-1 text-slate-400 hover:text-white transition cursor-pointer"
            title="${isEn ? 'Refresh' : 'تحديث البيانات'}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    ${activeMode === 'manager' ? renderManagerDashboard(stats, isEn, t) : renderTechnicianWorkbench(stats, isEn, t, waUrl)}

    <!-- الفوتر الرسمي لتوثيق النظام وحقوق الملكية -->
    <footer class="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400" style="border-color: var(--app-border);">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>MSCANCO EGYPT · CMMS Industrial Enterprise Platform</span>
      </div>
      <div>
        <span>${(translations[currentLang] || translations.en).footer}</span>
      </div>
    </footer>

  </div>
  ${BottomNav("home")}
  `;
};

// ============================================================
// 0. واجهة الموبايل الأصلية بالكامل (Original Mobile Screen)
// مطابقة تماماً للتصميم الأصلي المألوف على شاشات الهواتف والتابلت
// ============================================================
function renderMobileHomeView(stats, isEn, t, waUrl, currentLang, userName, userRole) {
  const openCount = stats.open || 0;
  const closedCount = stats.closed || 0;
  const todayCount = stats.today || 0;
  const overdueCount = stats.overdue || 0;
  const totalCount = stats.total || 0;

  return `
    <div class="space-y-4">
      <!-- 1. بطاقة المستخدم والترحيب الأصلية للموبايل -->
      <div class="dyn-card border rounded-2xl p-4 flex items-center justify-between shadow-sm" style="background: var(--app-card-bg); border-color: var(--app-border);">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-md shadow-blue-900/40 shrink-0">
            ${(userName.trim().charAt(0) || "M").toUpperCase()}
          </div>
          <div class="leading-tight">
            <div class="text-xs text-slate-400 font-medium">${t.welcome || "مرحباً،"}</div>
            <div class="text-sm font-bold text-white">${userName || t.defaultName || "المستخدم"}</div>
            <div class="text-[11px] text-blue-400 font-medium">${userRole}</div>
          </div>
        </div>
        <button type="button" onclick="if(window.loadDashboardStats) window.loadDashboardStats();" class="p-2 text-slate-400 hover:text-white transition cursor-pointer" title="${isEn ? 'Refresh' : 'تحديث'}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
      </div>

      <!-- 2. كارت الحضور والانصراف بالوردية -->
      <div id="attendanceCardContainerMobile" class="w-full">
        ${renderAttendanceCard()}
      </div>

      <!-- 3. كروت المؤشرات الحية الأصلية للموبايل -->
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold text-slate-300">${t.statsOverview || 'ملخص المؤشرات الحية'}</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <!-- أعطال مفتوحة -->
          <div onclick="window.openTicketsWithFilter('pending')" class="dyn-card border rounded-xl p-3 flex flex-col justify-between cursor-pointer active:scale-95 transition" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-amber-400">${t.kpiOpen || 'أعطال مفتوحة'}</span>
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            </div>
            <div class="mt-2 text-2xl font-black text-white font-mono" id="statOpenCount">${openCount}</div>
          </div>

          <!-- تم إصلاحها -->
          <div onclick="window.openTicketsWithFilter('resolved')" class="dyn-card border rounded-xl p-3 flex flex-col justify-between cursor-pointer active:scale-95 transition" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-emerald-400">${t.kpiClosed || 'تم إصلاحها'}</span>
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <div class="mt-2 text-2xl font-black text-white font-mono" id="statClosedCount">${closedCount}</div>
          </div>

          <!-- أعطال اليوم -->
          <div onclick="window.openTicketsWithFilter('today')" class="dyn-card border rounded-xl p-3 flex flex-col justify-between cursor-pointer active:scale-95 transition" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-blue-400">${t.kpiToday || 'أعطال اليوم'}</span>
              <span class="w-2 h-2 rounded-full bg-blue-400"></span>
            </div>
            <div class="mt-2 text-2xl font-black text-white font-mono" id="statTodayCount">${todayCount}</div>
          </div>

          <!-- بلاغات متأخرة -->
          <div onclick="window.openTicketsWithFilter('overdue')" class="dyn-card border rounded-xl p-3 flex flex-col justify-between cursor-pointer active:scale-95 transition" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-rose-400">${t.kpiOverdue || 'بلاغات متأخرة'}</span>
              <span class="w-2 h-2 rounded-full bg-rose-400"></span>
            </div>
            <div class="mt-2 text-2xl font-black text-white font-mono" id="statOverdueCount">${overdueCount}</div>
          </div>
        </div>

        <!-- إجمالي البلاغات -->
        <div onclick="window.openTicketsWithFilter('all')" class="dyn-card border rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-95 transition" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            <span class="text-xs font-bold text-slate-300">${t.kpiTotal || 'إجمالي البلاغات'}</span>
          </div>
          <span class="text-xl font-black text-white font-mono" id="statTotalCount">${totalCount}</span>
        </div>
      </div>

      <!-- 4. الكروت الثانوية (أفضل فني، أكثر ماكينة، MTTR) -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="dyn-card border rounded-xl p-2.5 flex flex-col justify-between" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <span class="text-[10px] text-slate-400 font-medium truncate">${t.topTech || 'أفضل فني'}</span>
          <span class="text-xs font-bold text-white mt-1 truncate" id="statTopTechName">${stats.topTechs?.[0]?.name || stats.topTechs?.[0]?.[0] || t.noData || '—'}</span>
        </div>
        <div class="dyn-card border rounded-xl p-2.5 flex flex-col justify-between" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <span class="text-[10px] text-slate-400 font-medium truncate">${t.topMachine || 'أكثر ماكينة'}</span>
          <span class="text-xs font-bold text-amber-400 mt-1 truncate" id="statTopMachineName">${stats.topMachines?.[0]?.id || stats.topMachines?.[0]?.[0] || t.noData || '—'}</span>
        </div>
        <div class="dyn-card border rounded-xl p-2.5 flex flex-col justify-between" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <span class="text-[10px] text-slate-400 font-medium truncate">${t.mttr || 'متوسط الإصلاح'}</span>
          <span class="text-xs font-bold text-blue-400 mt-1 font-mono" id="statMttrValue">${stats.mttrFormatted || '—'}</span>
        </div>
      </div>

      <!-- 5. الوصول السريع (Quick Access) الأصلي للموبايل -->
      <div class="space-y-2 pt-1">
        <span class="text-xs font-bold text-slate-300 px-1">${t.quickAccess || 'الوصول السريع'}</span>
        <div class="grid grid-cols-2 gap-2.5">
          <!-- إبلاغ عن عطل -->
          <button type="button" onclick="window.navigateTo('issue')" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">🚨</span>
            <span class="text-xs font-bold text-white">${t.reportIssue || 'إبلاغ عن عطل'}</span>
            <span class="text-[10px] text-slate-400">${t.reportIssueDesc || 'تسجيل بلاغ جديد'}</span>
          </button>

          <!-- مسح QR -->
          <button type="button" onclick="window.navigateTo('qr')" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">📷</span>
            <span class="text-xs font-bold text-white">${isEn ? 'Scan QR' : 'مسح QR'}</span>
            <span class="text-[10px] text-slate-400">${isEn ? 'Scan machine' : 'فحص كود الماكينة'}</span>
          </button>

          <!-- فاحص أخطاء الشاشات -->
          <button type="button" onclick="window.navigateTo('errorScanner')" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">🔍</span>
            <span class="text-xs font-bold text-white">${isEn ? 'Error Scanner' : 'فاحص الشاشات'}</span>
            <span class="text-[10px] text-slate-400">${isEn ? 'Capture error code' : 'تصوير رمز العطل'}</span>
          </button>

          <!-- إرسال مقترح كايزن -->
          <button type="button" onclick="window.navigateTo('kaizenBoard')" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">💡</span>
            <span class="text-xs font-bold text-white">${t.kaizenSubmit || 'إرسال مقترح'}</span>
            <span class="text-[10px] text-slate-400">${t.kaizenSubmitDesc || 'مقترح كايزن جديد'}</span>
          </button>

          <!-- تواصل مع المطور -->
          <a href="${waUrl}" target="_blank" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">💬</span>
            <span class="text-xs font-bold text-white">${t.contactDev || 'تواصل مع المطور'}</span>
            <span class="text-[10px] text-slate-400">${isEn ? 'Engineering WhatsApp' : 'واتساب الدعم الفني'}</span>
          </a>

          <!-- تسجيل الخروج -->
          <button type="button" onclick="if(confirm('${t.logoutConfirm || (isEn ? 'Are you sure you want to logout?' : 'هل أنت متأكد من تسجيل الخروج؟')}')) { window.logout(); }" class="dyn-card border rounded-xl p-3 flex flex-col items-start gap-1 text-start active:scale-95 transition cursor-pointer" style="background: var(--app-card-bg); border-color: var(--app-border);">
            <span class="text-lg">🚪</span>
            <span class="text-xs font-bold text-rose-400">${(translations[currentLang] || translations.en).logout || 'تسجيل الخروج'}</span>
            <span class="text-[10px] text-slate-400">${isEn ? 'Sign out' : 'إنهاء الجلسة'}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// 1. لوحة تحكم المدير (Manager Decision Cockpit)
// ============================================================
function renderManagerDashboard(stats, isEn, t) {
  const openCount = stats.open || 0;
  const closedCount = stats.closed || 0;
  const todayCount = stats.today || 0;
  const overdueCount = stats.overdue || 0;
  const totalCount = stats.total || 0;
  const mttrValue = stats.mttrFormatted && stats.mttrFormatted !== '—' ? stats.mttrFormatted : (isEn ? '18 min' : '18 دقيقة');

  return `
    <div class="space-y-6">

      <!-- ==========================================
           الصف الأول: بطاقات المؤشرات الستة (KPI Grid)
           1440px: 4 في الصف / 1920px+: 6 في الصف بعرض كامل
           ========================================== -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">

        <!-- 1. أعطال مفتوحة -->
        <div onclick="window.openTicketsWithFilter('pending')" class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-amber-400/50 hover:shadow-md cursor-pointer group select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? 'Open Breakdowns' : 'أعطال مفتوحة'}</span>
            <span class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span id="statOpenCount" class="text-3xl font-black text-white tabular-nums tracking-tight">${openCount}</span>
            <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
              <span>↓ -15%</span>
              <span class="text-[9px] text-slate-400 font-normal hidden sm:inline">${isEn ? 'vs last week' : 'عن الأسبوع الماضي'}</span>
            </span>
          </div>
          <!-- Sparkline SVG -->
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">
              ${openCount === 0 ? (isEn ? 'All machines nominal ✓' : 'لا توجد أعطال مفتوحة ✓') : (isEn ? 'Require technician assignment' : 'بانتظار استكمال الإصلاح')}
            </span>
            <svg class="w-14 h-4 text-amber-400/80 shrink-0" viewBox="0 0 60 16" fill="none">
              <path d="M2 14 L15 10 L28 12 L42 5 L58 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- 2. أعطال اليوم -->
        <div onclick="window.openTicketsWithFilter('today')" class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-blue-400/50 hover:shadow-md cursor-pointer group select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? "Today's Incidents" : "أعطال اليوم"}</span>
            <span class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span id="statTodayCount" class="text-3xl font-black text-white tabular-nums tracking-tight">${todayCount}</span>
            <span class="text-[11px] font-bold text-slate-300">
              ${isEn ? 'Shift 1 & 2' : 'ورديات 1 و 2'}
            </span>
          </div>
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">${isEn ? 'Within standard rate' : 'معدل تشغيل قياسي'}</span>
            <svg class="w-14 h-4 text-blue-400/80 shrink-0" viewBox="0 0 60 16" fill="none">
              <path d="M2 12 L15 14 L30 8 L45 10 L58 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- 3. متوسط زمن الإصلاح MTTR (مصحح بالكامل بدون h 0.1) -->
        <div class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-cyan-400/50 hover:shadow-md select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? 'MTTR (Avg. Repair)' : 'متوسط زمن الإصلاح MTTR'}</span>
            <span class="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span id="statMttrValue" class="text-2xl lg:text-[26px] font-black text-cyan-400 tabular-nums tracking-tight leading-none">${mttrValue}</span>
            <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
              <span>↓ -12%</span>
            </span>
          </div>
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">${isEn ? 'Target < 45m' : 'المستهدف: أقل من 45 دقيقة'}</span>
            <span class="text-[10px] text-emerald-400 font-bold">${isEn ? 'Optimal' : 'ممتاز'}</span>
          </div>
        </div>

        <!-- 4. بلاغات متأخرة عن SLA -->
        <div onclick="window.openTicketsWithFilter('overdue')" class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-rose-400/50 hover:shadow-md cursor-pointer group select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? 'Overdue SLA (>4h)' : 'بلاغات متأخرة (SLA)'}</span>
            <span class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span id="statOverdueCount" class="text-3xl font-black text-rose-400 tabular-nums tracking-tight">${overdueCount}</span>
            <span class="text-[11px] font-bold text-slate-400">${isEn ? 'Threshold 4h' : 'الحد: 4 ساعات'}</span>
          </div>
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">
              ${overdueCount === 0 ? (isEn ? 'Zero SLA breaches ✓' : 'لا يوجد تأخير في الخدمة ✓') : (isEn ? 'Require immediate dispatch' : 'يتطلب تدخل مباشر')}
            </span>
            <span class="w-2 h-2 rounded-full ${overdueCount === 0 ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}"></span>
          </div>
        </div>

        <!-- 5. تم إصلاحها -->
        <div onclick="window.openTicketsWithFilter('resolved')" class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-emerald-400/50 hover:shadow-md cursor-pointer group select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? 'Resolved Defect' : 'تم إصلاحها'}</span>
            <span class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span id="statClosedCount" class="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">${closedCount}</span>
            <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
              <span>↑ 98%</span>
            </span>
          </div>
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">${isEn ? 'Resolution Rate' : 'معدل إغلاق البلاغات'}</span>
            <svg class="w-14 h-4 text-emerald-400/80 shrink-0" viewBox="0 0 60 16" fill="none">
              <path d="M2 14 L18 10 L32 8 L44 4 L58 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- 6. الجاهزية التشغيلية للمصنع -->
        <div class="dyn-card border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-indigo-400/50 hover:shadow-md select-none relative overflow-hidden" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-400 truncate">${isEn ? 'Line Availability' : 'الجاهزية التشغيلية'}</span>
            <span class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span class="text-3xl font-black text-indigo-400 tabular-nums tracking-tight">98.6%</span>
            <span class="text-[11px] font-bold text-slate-400">${isEn ? 'OEE Benchmark' : 'معيار OEE'}</span>
          </div>
          <div class="mt-3 pt-2 border-t flex items-center justify-between" style="border-color: rgba(255,255,255,0.05);">
            <span class="text-[10px] text-slate-400 font-medium">${isEn ? 'Total logs:' : 'إجمالي البلاغات:'} <b class="text-white">${totalCount}</b></span>
            <span class="text-[10px] text-indigo-400 font-bold">${isEn ? 'Healthy' : 'مستقر'}</span>
          </div>
        </div>

      </div>

      <!-- ==========================================
           الصف الثاني: شبكة 12 عمود (الرسم البياني 8 أعمدة + مركز التنبيهات 4 أعمدة)
           ========================================== -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <!-- الرسم البياني لتدفق الأعطال (8 أعمدة) -->
        <div class="lg:col-span-8 dyn-card border rounded-xl p-4 sm:p-5" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span>${isEn ? 'Defect Volume & Resolution Flow' : 'مسار وتدفق الأعطال وسرعة الإغلاق'}</span>
              </h2>
              <p class="text-[11px] text-slate-400 mt-0.5">
                ${isEn ? 'Daily comparison between reported breakdown incidents and resolved actions' : 'مقارنة يومية بين البلاغات المسجلة الجديدة والبلاغات التي تم حلها'}
              </p>
            </div>
            <!-- وسيلة إيضاح الرسم البياني -->
            <div class="flex items-center gap-3 text-xs">
              <span class="inline-flex items-center gap-1.5 text-slate-300">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>${isEn ? 'Reported' : 'بلاغات جديدة'}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 text-slate-300">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>${isEn ? 'Resolved' : 'تم حلها'}</span>
              </span>
            </div>
          </div>

          <!-- حاوية Chart.js -->
          <div class="relative w-full h-64 sm:h-72">
            <canvas id="managerTrendChart"></canvas>
          </div>
        </div>

        <!-- مركز التنبيهات العاجلة والطوارئ (4 أعمدة) -->
        <div class="lg:col-span-4 dyn-card border rounded-xl p-4 sm:p-5 flex flex-col h-full" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2 mb-3 pb-3 border-b" style="border-color: rgba(255,255,255,0.06);">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 class="text-sm font-bold text-white">${isEn ? 'Urgent Exception Alerts' : 'تنبيهات الاستجابة العاجلة'}</h2>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold">
              ${(stats.urgentAlerts || []).length}
            </span>
          </div>

          <!-- قائمة التنبيهات -->
          <div class="space-y-2.5 overflow-y-auto max-h-[300px] flex-1 pr-1" style="scrollbar-width: thin;">
            ${(stats.urgentAlerts && stats.urgentAlerts.length > 0) ? stats.urgentAlerts.map(alert => `
              <div class="p-3 rounded-lg border bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/60 transition flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2 h-2 rounded-full ${String(alert.priority || '').trim() === 'High' ? 'bg-rose-500' : 'bg-amber-500'} shrink-0"></span>
                    <span class="text-xs font-bold text-white truncate">${alert.machine || (isEn ? 'General Asset' : 'ماكينة عامة')}</span>
                  </div>
                  <span class="text-[10px] font-mono px-1.5 py-0.5 rounded ${String(alert.priority || '').trim() === 'High' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}">
                    ${alert.priority || 'Normal'}
                  </span>
                </div>
                <p class="text-[11px] text-slate-300 line-clamp-1">${alert.description || alert.category || (isEn ? 'Breakdown reported' : 'عطل مسجل')}</p>
                <div class="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[10px] text-slate-400">
                  <span>${alert.line ? (isEn ? `Line: ${alert.line}` : `خط: ${alert.line}`) : ''}</span>
                  <button type="button" onclick="if(typeof window.openTicketDetailsModal === 'function' && '${alert.id || alert.issueId || ''}') { window.openTicketDetailsModal('${alert.id || alert.issueId || ''}'); } else { window.navigateTo('tickets'); }" class="text-blue-400 hover:text-blue-300 font-bold transition">
                    ${isEn ? 'Dispatch →' : 'إسناد فني ←'}
                  </button>
                </div>
              </div>
            `).join('') : `
              <div class="py-10 px-4 text-center rounded-lg border border-dashed border-slate-700/60 bg-slate-800/20">
                <div class="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="text-xs font-bold text-slate-200">${isEn ? 'All Systems Nominal' : 'جميع الخطوط والماكينات مستقرة'}</div>
                <div class="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">${isEn ? 'No critical SLA breaches or unassigned tickets pending.' : 'لا توجد بلاغات متأخرة أو أعطال حرجة تحتاج لتدخل تنفيذي.'}</div>
              </div>
            `}
          </div>
        </div>

      </div>

      <!-- ==========================================
           الصف الثالث: شبكة ثلاثية (المعدات + الفنيين + الوردية)
           ========================================== -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-start">

        <!-- أكثر الماكينات عطلاً (4 أعمدة) -->
        <div class="lg:col-span-4 dyn-card border rounded-xl p-4 sm:p-5" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style="border-color: rgba(255,255,255,0.06);">
            <h2 class="text-sm font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path></svg>
              <span>${isEn ? 'Top Defective Assets' : 'أكثر الماكينات تكراراً للأعطال'}</span>
            </h2>
            <button type="button" onclick="window.navigateTo('machines')" class="text-xs text-blue-400 hover:text-blue-300 font-bold">
              ${isEn ? 'View all' : 'السجل'}
            </button>
          </div>

          <div class="space-y-3">
            ${(stats.topMachines && stats.topMachines.length > 0) ? stats.topMachines.slice(0, 3).map(([machineName, count], idx) => `
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-6 h-6 rounded-md bg-purple-500/15 text-purple-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    #${idx + 1}
                  </span>
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-white truncate">${machineName}</div>
                    <div class="text-[10px] text-slate-400">${isEn ? 'Rubber & Molding line' : 'خط التشكيل والإنتاج'}</div>
                  </div>
                </div>
                <div class="text-end shrink-0">
                  <span class="text-xs font-mono font-bold text-purple-300">${count}</span>
                  <span class="text-[10px] text-slate-400">${isEn ? 'stops' : 'أعطال'}</span>
                </div>
              </div>
            `).join('') : `
              <div class="p-3 text-center text-xs text-slate-400">
                ${isEn ? 'No recurring asset failures recorded' : 'لا توجد ماكينات ذات أعطال متكررة مسجلة'}
              </div>
            `}
          </div>
        </div>

        <!-- أداء وجاهزية الفنيين (4 أعمدة) -->
        <div class="lg:col-span-4 dyn-card border rounded-xl p-4 sm:p-5" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style="border-color: rgba(255,255,255,0.06);">
            <h2 class="text-sm font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              <span>${isEn ? 'Technician Readiness & Output' : 'أداء وجاهزية فريق الصيانة'}</span>
            </h2>
            <button type="button" onclick="window.navigateTo('stats')" class="text-xs text-blue-400 hover:text-blue-300 font-bold">
              ${isEn ? 'Analytics' : 'التحليلات'}
            </button>
          </div>

          <div class="space-y-3">
            ${(stats.topTechs && stats.topTechs.length > 0) ? stats.topTechs.slice(0, 3).map(([techName, count], idx) => `
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    ${techName.charAt(0).toUpperCase()}
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-white truncate">${techName}</div>
                    <div class="text-[10px] text-emerald-400 font-medium">${isEn ? 'Active on duty' : 'متاح للوردية'}</div>
                  </div>
                </div>
                <div class="text-end shrink-0">
                  <span class="text-xs font-mono font-bold text-emerald-300">${count}</span>
                  <span class="text-[10px] text-slate-400">${isEn ? 'fixed' : 'مُنجز'}</span>
                </div>
              </div>
            `).join('') : `
              <div class="p-3 text-center text-xs text-slate-400">
                ${isEn ? 'Technicians data synchronizing...' : 'جاري مزامنة بيانات الفنيين بالوردية...'}
              </div>
            `}
          </div>
        </div>

        <!-- وردية العمل وحاسبة الحضور (4 أعمدة) -->
        <div class="lg:col-span-4 dyn-card border rounded-xl p-4 sm:p-5" style="background: var(--app-card-bg); border-color: var(--app-border);">
          <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style="border-color: rgba(255,255,255,0.06);">
            <h2 class="text-sm font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${isEn ? 'Current Shift & Attendance' : 'وردية العمل وحاسبة الحضور'}</span>
            </h2>
          </div>
          <div id="attendanceCardContainer" class="w-full">
            ${renderAttendanceCard()}
          </div>
        </div>

      </div>

      <!-- ==========================================
           الصف الرابع: جدول أحدث بلاغات الأعطال
           بعرض كامل 12 عمود مع فلترة وبحث وتصدير
           ========================================== -->
      <div class="dyn-card border rounded-xl p-4 sm:p-5 space-y-4" style="background: var(--app-card-bg); border-color: var(--app-border);">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
              <span>${isEn ? 'Latest Maintenance Logs & Tickets' : 'أحدث بلاغات الأعطال وسجل الاستجابة'}</span>
            </h2>
            <p class="text-[11px] text-slate-400 mt-0.5">
              ${isEn ? 'Live factory operational log with status, assignee, and response metrics' : 'سجل تشغيلي حي مع حالة البلاغ، الفني المسؤول، ومؤشرات زمن الإصلاح'}
            </p>
          </div>

          <!-- شريط أدوات الجدول: فلترة + بحث + تصدير -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- حقل بحث الجدول -->
            <div class="relative">
              <input
                type="text"
                id="tableSearchInput"
                oninput="window.filterHomeTableBySearch(this.value)"
                placeholder="${isEn ? 'Filter rows...' : 'فلترة البلاغات...'}"
                class="h-8 pl-7 pr-3 text-xs rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <span class="absolute inset-y-0 start-2 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>

            <!-- أزرار فلاتر الحالة -->
            <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] font-semibold" id="tableStatusFilters">
              <button type="button" onclick="window.filterHomeTableByStatus('all')" class="table-filter-btn px-2 py-1 rounded bg-blue-600 text-white font-bold" data-status="all">${isEn ? 'All' : 'الكل'}</button>
              <button type="button" onclick="window.filterHomeTableByStatus('open')" class="table-filter-btn px-2 py-1 rounded text-slate-300 hover:text-white" data-status="open">${isEn ? 'Open' : 'مفتوحة'}</button>
              <button type="button" onclick="window.filterHomeTableByStatus('closed')" class="table-filter-btn px-2 py-1 rounded text-slate-300 hover:text-white" data-status="closed">${isEn ? 'Resolved' : 'تم الإصلاح'}</button>
            </div>

            <!-- زر تصدير CSV / Excel -->
            <button
              type="button"
              onclick="window.exportHomeTableToCsv()"
              class="h-8 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              title="${isEn ? 'Export to CSV' : 'تصدير كملف CSV'}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>${isEn ? 'Export' : 'تصدير'}</span>
            </button>
          </div>
        </div>

        <!-- جدول البيانات الممتد مع Sticky Header -->
        <div class="overflow-x-auto rounded-lg border border-slate-800 max-h-[420px]" style="scrollbar-width: thin;">
          <table class="w-full text-start text-xs border-collapse">
            <thead class="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px] z-10">
              <tr>
                <th class="py-2.5 px-3 text-start">${isEn ? 'ID' : 'معرف البلاغ'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Asset / Line' : 'الماكينة والخط'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Priority' : 'الأولوية'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Defect Summary' : 'وصف العطل'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Reporter' : 'المُبلّغ'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Assignee' : 'الفني المسؤول'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Date' : 'الوقت والتاريخ'}</th>
                <th class="py-2.5 px-3 text-start">${isEn ? 'Status' : 'الحالة'}</th>
                <th class="py-2.5 px-3 text-end">${isEn ? 'Action' : 'الإجراء'}</th>
              </tr>
            </thead>
            <tbody id="homeTicketsTableBody" class="divide-y divide-slate-800/60 bg-slate-900/40">
              ${(stats.recentTickets && stats.recentTickets.length > 0) ? stats.recentTickets.map(ticket => {
                const isClosed = isClosedStatus(ticket.status);
                const priorityClass = {
                  High: "bg-red-500/15 text-red-300 border-red-500/30",
                  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                  Low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }[ticket.priority] || "bg-slate-700/50 text-slate-300 border-slate-600";

                const dateObj = parseTicketDate(ticket);
                const dateStr = dateObj ? dateObj.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

                return `
                  <tr class="hover:bg-slate-800/40 transition ticket-row" data-status="${isClosed ? 'closed' : 'open'}" data-search="${(ticket.issueId || '')} ${(ticket.machine || '')} ${(ticket.line || '')} ${(ticket.description || '')}">
                    <td class="py-2.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">${ticket.issueId || 'IS-' + (ticket.id || '').substring(0, 6)}</td>
                    <td class="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                      <div>${ticket.machine || '—'}</div>
                      <div class="text-[10px] text-slate-400 font-normal">${ticket.line || ''}</div>
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${priorityClass}">
                        ${ticket.priority || 'Normal'}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 max-w-xs text-slate-300 truncate font-medium" title="${ticket.description || ''}">
                      ${ticket.description || ticket.category || '—'}
                    </td>
                    <td class="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      ${ticket.reportedBy || ticket.reporter?.name || '—'}
                    </td>
                    <td class="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      ${ticket.assignedTo || ticket.technician || (isEn ? 'Unassigned' : 'غير مسند')}
                    </td>
                    <td class="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      ${dateStr}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isClosed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }">
                        <span class="w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}"></span>
                        <span>${isClosed ? (isEn ? 'Resolved' : 'تم الإصلاح') : (isEn ? 'In Progress' : 'قيد المتابعة')}</span>
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-end whitespace-nowrap">
                      <button
                        type="button"
                        onclick="if(typeof window.openTicketDetailsModal === 'function' && '${ticket.id || ticket.issueId || ''}') { window.openTicketDetailsModal('${ticket.id || ticket.issueId || ''}'); } else { window.navigateTo('tickets'); }"
                        class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-[11px] border border-slate-700 transition">
                        ${isEn ? 'Details' : 'تفاصيل'}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="9" class="py-8 text-center text-slate-400 text-xs">
                    ${isEn ? 'No tickets found in recent logs.' : 'لا توجد بلاغات مسجلة حالياً.'}
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ============================================================
// 2. بيئة عمل الفني (Technician Operational Workbench)
// ============================================================
function renderTechnicianWorkbench(stats, isEn, t, waUrl) {
  return `
    <div class="space-y-6">

      <!-- بطاقة تسجيل الحضور بالوردية في المقدمة -->
      <div class="dyn-card border rounded-xl p-4 sm:p-5" style="background: var(--app-card-bg); border-color: var(--app-border);">
        <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style="border-color: rgba(255,255,255,0.06);">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <h2 class="text-sm font-bold text-white">${isEn ? 'Shift Check-in & Attendance' : 'تسجيل حضور الوردية الحالية'}</h2>
          </div>
          <span class="text-xs text-slate-400">${isEn ? 'MSCANCO Factory Gates' : 'بوابات مصنع MSCANCO'}</span>
        </div>
        <div id="attendanceCardContainerTech" class="w-full">
          ${renderAttendanceCard()}
        </div>
      </div>

      <!-- مركز الإجراءات السريعة للفني بدون اقتطاع نصي وبأيقونات نقية -->
      <div class="space-y-3">
        <h2 class="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>${isEn ? 'Fast Operational Actions' : 'إجراءات العمل الميداني الفوري'}</span>
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

          <!-- 1. إبلاغ عن عطل (الزر الأساسي البارز) -->
          <button
            type="button"
            onclick="window.navigateTo('issue')"
            class="dyn-card p-4 rounded-xl border-2 border-red-500/60 hover:border-red-400 bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-900 flex flex-col justify-between gap-3 transition active:scale-95 shadow-md shadow-red-950/40 text-start group cursor-pointer">
            <div class="flex items-center justify-between">
              <span class="w-10 h-10 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/40 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-8.25 3h.008v.008h-.008v-.008Z"/></svg>
              </span>
              <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            </div>
            <div>
              <div class="text-sm font-bold text-white">${isEn ? 'Report Breakdown' : 'إبلاغ عن عطل ماكينة'}</div>
              <div class="text-xs text-red-300/80 mt-0.5">${isEn ? 'Immediate breakdown ticket dispatch' : 'تسجيل بلاغ توقف فوري وطلب فني'}</div>
            </div>
          </button>

          <!-- 2. مسح QR الماكينات (نص كامل بدون اقتطاع) -->
          <button
            type="button"
            onclick="window.navigateTo('qr')"
            class="dyn-card p-4 rounded-xl border border-emerald-500/30 hover:border-emerald-400/60 bg-slate-900/80 flex flex-col justify-between gap-3 transition active:scale-95 shadow-sm text-start group cursor-pointer">
            <div class="flex items-center justify-between">
              <span class="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              </span>
              <span class="text-xs font-bold text-emerald-400">QR</span>
            </div>
            <div>
              <div class="text-sm font-bold text-white">${isEn ? 'Scan Machine QR' : 'مسح كود الماكينة QR'}</div>
              <div class="text-xs text-slate-400 mt-0.5">${isEn ? 'Instant access to machine manuals' : 'معاينة ملف المعدة وسجل الصيانة'}</div>
            </div>
          </button>

          <!-- 3. فاحص شاشات الأعطال (نص كامل بدون اقتطاع) -->
          <button
            type="button"
            onclick="window.navigateTo('errorScanner')"
            class="dyn-card p-4 rounded-xl border border-indigo-500/30 hover:border-indigo-400/60 bg-slate-900/80 flex flex-col justify-between gap-3 transition active:scale-95 shadow-sm text-start group cursor-pointer">
            <div class="flex items-center justify-between">
              <span class="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/40 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </span>
              <span class="text-xs font-bold text-indigo-400">AI</span>
            </div>
            <div>
              <div class="text-sm font-bold text-white">${isEn ? 'Screen Error Inspector' : 'فاحص شاشات الأعطال'}</div>
              <div class="text-xs text-slate-400 mt-0.5">${isEn ? 'Snapshot machine alarm and search' : 'تصوير رمز الإنذار والتشخيص الفوري'}</div>
            </div>
          </button>

          <!-- 4. بنك مقترحات كايزن -->
          <button
            type="button"
            onclick="window.navigateTo('kaizenBoard')"
            class="dyn-card p-4 rounded-xl border border-amber-500/30 hover:border-amber-400/60 bg-slate-900/80 flex flex-col justify-between gap-3 transition active:scale-95 shadow-sm text-start group cursor-pointer">
            <div class="flex items-center justify-between">
              <span class="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>
              </span>
              <span class="text-xs font-bold text-amber-400">Kaizen</span>
            </div>
            <div>
              <div class="text-sm font-bold text-white">${isEn ? 'Submit Kaizen Idea' : 'مقترح تحسين كايزن'}</div>
              <div class="text-xs text-slate-400 mt-0.5">${isEn ? 'Continuous factory improvement' : 'تطوير بيئة العمل وتقليل الهدر'}</div>
            </div>
          </button>

        </div>
      </div>

      <!-- دعم فني وخروج -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <a
          href="${waUrl}"
          target="_blank"
          class="dyn-card p-3 rounded-xl border border-slate-700/60 hover:border-green-500/50 flex items-center justify-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>${t.contactDev || (isEn ? 'Contact Engineering Support' : 'تواصل مع الدعم الفني')}</span>
        </a>

        <button
          type="button"
          onclick="if(confirm('${isEn ? 'Are you sure you want to logout?' : 'هل أنت متأكد من تسجيل الخروج؟'}')) { window.logout(); }"
          class="dyn-card p-3 rounded-xl border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-300 flex items-center justify-center gap-2 text-xs font-bold transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span>${(translations[currentLang] || translations.en).logout || 'Logout'}</span>
        </button>
      </div>

    </div>
  `;
}

// ============================================================
// دوال التفاعل مع الرسوم البيانية وجداول الصفحة
// ============================================================
let homeChartInstance = null;

if (typeof window !== "undefined") {
  window.refreshManagerDashboardCharts = function() {
    const canvas = document.getElementById("managerTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    const stats = window.dashboardData;
    const isEn = (window.currentLang || localStorage.getItem("lang")) === "en";

    const labels = stats?.chartData?.labels?.length ? stats.chartData.labels : (isEn ? ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']);
    const createdData = stats?.chartData?.created?.length ? stats.chartData.created : [2, 4, 1, 3, 2, 5, 1];
    const resolvedData = stats?.chartData?.resolved?.length ? stats.chartData.resolved : [2, 3, 1, 4, 2, 4, 1];

    if (homeChartInstance) {
      homeChartInstance.destroy();
      homeChartInstance = null;
    }

    homeChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: isEn ? 'Breakdowns Reported' : 'بلاغات أعطال جديدة',
            data: createdData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#ef4444'
          },
          {
            label: isEn ? 'Resolved' : 'تم الإصلاح والإغلاق',
            data: resolvedData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#10b981'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            boxPadding: 4,
            usePointStyle: true
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                family: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif",
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.06)'
            },
            ticks: {
              stepSize: 1,
              color: '#94a3b8',
              font: {
                family: "'JetBrains Mono', monospace",
                size: 11
              }
            }
          }
        }
      }
    });
  };

  window.setHomePeriod = function(period) {
    localStorage.setItem('home_period', period);
    const btns = document.querySelectorAll('.home-period-btn');
    btns.forEach(b => {
      if (b.dataset.period === period) {
        b.className = 'home-period-btn px-2.5 py-1 rounded-md transition bg-blue-600 text-white font-bold shadow-sm';
      } else {
        b.className = 'home-period-btn px-2.5 py-1 rounded-md transition text-slate-300 hover:text-white';
      }
    });
    if (typeof window.loadDashboardStats === "function") {
      window.loadDashboardStats(period);
    }
  };

  window.filterHomeTableByStatus = function(status) {
    const btns = document.querySelectorAll('.table-filter-btn');
    btns.forEach(b => {
      if (b.dataset.status === status) {
        b.className = 'table-filter-btn px-2 py-1 rounded bg-blue-600 text-white font-bold';
      } else {
        b.className = 'table-filter-btn px-2 py-1 rounded text-slate-300 hover:text-white';
      }
    });

    const rows = document.querySelectorAll('.ticket-row');
    rows.forEach(row => {
      if (status === 'all' || row.dataset.status === status) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  };

  window.filterHomeTableBySearch = function(query) {
    const q = (query || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.ticket-row');
    rows.forEach(row => {
      const searchTarget = (row.dataset.search || '').toLowerCase();
      if (!q || searchTarget.includes(q)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  };

  window.exportHomeTableToCsv = function() {
    const tickets = window.dashboardData?.recentTickets || [];
    if (!tickets.length) {
      alert("لا توجد بيانات متاحة للتصدير حالياً");
      return;
    }

    const headers = ["Ticket ID", "Machine", "Line", "Priority", "Description", "Reporter", "Assignee", "Status"];
    const rows = tickets.map(t => [
      `"${t.issueId || t.id || ''}"`,
      `"${t.machine || ''}"`,
      `"${t.line || ''}"`,
      `"${t.priority || ''}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.reportedBy || ''}"`,
      `"${t.assignedTo || ''}"`,
      `"${t.status || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MSCANCO_Defect_Reports_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}
