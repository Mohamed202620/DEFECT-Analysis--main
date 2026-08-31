import { BottomNav } from "../components/BottomNav.js";
import { hasPermission } from "../permissions.js";
import { translations } from "../config.js";
import { renderAttendanceCard } from "../attendanceCard.js";

export const HomeView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.en).home;

  const stats = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  // إعداد رقم الواتساب الخاص بك والرسالة الجاهزة (مترجمة حسب اللغة الحالية)
  const waNumber = "201067988554";
  const waMessage = t.waMessage;

  // تجهيز الرابط النهائي وتشفير الرسالة لتتناسب مع الرابط
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  return `
  <div class="app-page p-3 max-w-lg mx-auto pb-24 space-y-3">

    <!-- كارت حضور الوردية الذكي للفنيين (MSCANCO EGYPT) -->
    <div id="attendanceCardContainer">
      ${renderAttendanceCard()}
    </div>

    <!-- ملخص العدادات الحية -->
    <div class="space-y-1.5">
      <h3 class="text-[11px] font-bold text-slate-300 opacity-80 px-0.5">${t.statsOverview || (currentLang === 'ar' ? 'ملخص المؤشرات الحية' : 'Live Metrics Overview')}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">

      <!-- أعطال مفتوحة -->
      <button
        type="button"
        onclick="window.openTicketsWithFilter('pending')"
        class="relative text-start bg-[#1E293B]/80 border border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-amber-500"></div>
        <span class="absolute top-1.5 rtl:left-2 ltr:right-2 text-[10px] font-black text-amber-400/80 group-hover:text-amber-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
        <div class="min-w-0 pr-1 rtl:pr-1 rtl:pl-0 ltr:pl-1">
          <span class="text-[10px] text-slate-300 opacity-75 block mb-0.5 font-medium truncate">${t.kpiOpen}</span>
          <span id="statOpenCount" class="text-lg font-black text-amber-400 leading-none">${stats.open}</span>
          <span id="criticalBadge" class="hidden mt-1 items-center gap-0.5 text-[8px] font-bold text-red-300 bg-red-500/20 border border-red-500/40 px-1 py-0.2 rounded-full w-fit">
            <span class="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
            <span id="criticalBadgeText">${t.kpiCritical}</span>
          </span>
        </div>
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/>
          </svg>
        </div>
      </button>

      <!-- تم إصلاحها -->
      <button
        type="button"
        onclick="window.openTicketsWithFilter('resolved')"
        class="relative text-start bg-[#1E293B]/80 border border-emerald-500/30 hover:border-emerald-400/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
        <span class="absolute top-1.5 rtl:left-2 ltr:right-2 text-[10px] font-black text-emerald-400/80 group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
        <div class="min-w-0 pr-1 rtl:pr-1 rtl:pl-0 ltr:pl-1">
          <span class="text-[10px] text-slate-300 opacity-75 block mb-0.5 font-medium truncate">${t.kpiClosed}</span>
          <span id="statClosedCount" class="text-lg font-black text-emerald-400 leading-none">${stats.closed}</span>
        </div>
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
          </svg>
        </div>
      </button>

      <!-- أعطال اليوم -->
      <button
        type="button"
        onclick="window.openTicketsWithFilter('all')"
        class="relative text-start bg-[#1E293B]/80 border border-blue-500/30 hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
        <span class="absolute top-1.5 rtl:left-2 ltr:right-2 text-[10px] font-black text-blue-400/80 group-hover:text-blue-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
        <div class="min-w-0 pr-1 rtl:pr-1 rtl:pl-0 ltr:pl-1">
          <span class="text-[10px] text-slate-300 opacity-75 block mb-0.5 font-medium truncate">${t.kpiToday}</span>
          <span id="statTodayCount" class="text-lg font-black text-blue-400 leading-none">${stats.today}</span>
        </div>
        <div class="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
          </svg>
        </div>
      </button>

      <!-- بلاغات متأخرة -->
      <button
        type="button"
        onclick="window.openTicketsWithFilter('overdue')"
        class="relative text-start bg-[#1E293B]/80 border border-rose-500/30 hover:border-rose-400/60 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
        <span class="absolute top-1.5 rtl:left-2 ltr:right-2 text-[10px] font-black text-rose-400/80 group-hover:text-rose-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
        <div class="min-w-0 pr-1 rtl:pr-1 rtl:pl-0 ltr:pl-1">
          <span class="text-[10px] text-slate-300 opacity-75 block mb-0.5 font-medium truncate">${t.kpiOverdue || (currentLang === 'ar' ? 'متأخرة' : 'Overdue')}</span>
          <span id="statOverdueCount" class="text-lg font-black text-rose-400 leading-none">${stats.overdue || 0}</span>
        </div>
        <div class="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
      </button>

      <!-- إجمالي البلاغات -->
      <button
        type="button"
        onclick="window.openTicketsWithFilter('all')"
        class="relative text-start bg-[#1E293B]/80 border border-purple-500/30 hover:border-purple-400/60 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group col-span-2 sm:col-span-1">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
        <span class="absolute top-1.5 rtl:left-2 ltr:right-2 text-[10px] font-black text-purple-400/80 group-hover:text-purple-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
        <div class="min-w-0 pr-1 rtl:pr-1 rtl:pl-0 ltr:pl-1">
          <span class="text-[10px] text-slate-300 opacity-75 block mb-0.5 font-medium truncate">${t.kpiTotal}</span>
          <span id="statTotalCount" class="text-lg font-black text-purple-400 leading-none">${stats.total}</span>
        </div>
        <div class="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
          </svg>
        </div>
      </button>

      </div>
    </div>

    <!-- كارتات ذكية إضافية: MTTR + أكثر ماكينة عطلاً + أفضل فني -->
    <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
      <div class="bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md p-2 rounded-xl text-center cursor-default">
        <div class="text-[9px] text-slate-300 opacity-70 mb-0.5 truncate">⏱️ ${t.mttr}</div>
        <div id="statMttrValue" class="text-xs sm:text-sm font-extrabold text-cyan-400 leading-tight">—</div>
      </div>
      <div class="bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md p-2 rounded-xl text-center cursor-default">
        <div class="text-[9px] text-slate-300 opacity-70 mb-0.5 truncate">🏭 ${t.topMachine}</div>
        <div id="statTopMachineName" class="text-[10px] sm:text-xs font-bold text-slate-300 truncate leading-tight">—</div>
      </div>
      <div class="bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md p-2 rounded-xl text-center cursor-default">
        <div class="text-[9px] text-slate-300 opacity-70 mb-0.5 truncate">🥇 ${t.topTech}</div>
        <div id="statTopTechName" class="text-[10px] sm:text-xs font-bold text-slate-300 truncate leading-tight">—</div>
      </div>
    </div>

    <!-- الوصول السريع + الوصول السريع لنظام الكايزن -->
    <div class="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">

    <!-- الوصول السريع -->
    <div class="space-y-1.5">
      <h3 class="text-[11px] font-bold text-slate-300 opacity-80 px-0.5">${t.quickAccess}</h3>
      <div class="grid grid-cols-2 gap-2">
        <!-- زر الإبلاغ عن عطل - تصميم مميز بأسلوب الطوارئ والبروز البصري الفوري -->
        <button
          onclick="window.navigateTo('issue')"
          class="relative group border border-red-500/60 hover:border-red-400 bg-gradient-to-br from-red-950/90 via-red-900/50 to-orange-950/40 p-2.5 rounded-xl flex items-center gap-2 text-start transition-all duration-200 active:scale-95 shadow-md shadow-red-950/50 hover:shadow-red-600/30 overflow-hidden cursor-pointer">
          <div class="absolute -right-4 -bottom-4 w-12 h-12 bg-red-500/20 rounded-full blur-lg pointer-events-none"></div>
          <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse"></div>

          <span class="w-8 h-8 rounded-lg bg-red-600/30 border border-red-400/50 text-red-300 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-8.25 3h.008v.008h-.008v-.008Z"/>
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-black text-[11px] text-red-100 flex items-center gap-1">
              <span>${t.reportIssue}</span>
              <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
            </div>
            <div class="text-[9px] text-red-300/80 font-medium truncate">${t.reportIssueDesc}</div>
          </div>
          <span class="text-amber-400 text-sm font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
        </button>

        <button
          onclick="window.navigateTo('ai')"
          class="relative group bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md border-indigo-500/30 hover:border-indigo-400/60 bg-gradient-to-br from-indigo-950/40 via-indigo-900/20 to-transparent p-2.5 rounded-xl flex items-center gap-2 text-start transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer">
          <span class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-[11px] text-slate-300">${t.aiScan}</div>
            <div class="text-[9px] text-slate-300 opacity-60 truncate">${t.aiScanDesc}</div>
          </div>
          <span class="text-amber-400 text-sm font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
        </button>
      </div>
    </div>

    <!-- الوصول السريع لنظام الكايزن -->
    ${hasPermission("suggestions") ? `
    <div class="space-y-1.5">
      <h3 class="text-[11px] font-bold text-slate-300 opacity-80 px-0.5">${t.kaizenTitle}</h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          onclick="window.navigateTo('suggestions')"
          class="relative group bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-transparent p-2.5 rounded-xl flex items-center gap-2 text-start transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer">
          <span class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/>
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-[11px] text-slate-300">${t.kaizenSubmit}</div>
            <div class="text-[9px] text-slate-300 opacity-60 truncate">${t.kaizenSubmitDesc}</div>
          </div>
          <span class="text-amber-400 text-sm font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
        </button>

        <button
          onclick="window.navigateTo('kaizenBoard')"
          class="relative group bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-transparent p-2.5 rounded-xl flex items-center gap-2 text-start transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer">
          <span id="kaizenNeedsEditBadge" class="hidden absolute -top-1 rtl:-right-1 ltr:-left-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-[8px] font-bold text-white flex items-center justify-center shadow-md"></span>
          <span class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3-6.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008V15Zm0 3h.008v.008h-.008V18ZM6 5.25V18a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 18V5.25m-12 0h12m-12 0-.375-.75h12.75l-.375.75M9 3.75h6"/>
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-[11px] text-slate-300">${t.kaizenTrack}</div>
            <div class="text-[9px] text-slate-300 opacity-60 truncate">${t.kaizenTrackDesc}</div>
          </div>
          <span class="text-amber-400 text-sm font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
        </button>
      </div>
    </div>
    ` : ""}

    </div>

    <!-- الرسم البياني الرئيسي -->
    <div class="bg-[#1E293B]/80 border border-slate-700/60 shadow-md backdrop-blur-md p-2.5 rounded-xl space-y-2">
      <div class="flex items-center justify-between gap-2 border-b border-slate-700/50 pb-1.5">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-xs font-bold text-slate-200 truncate">${t.chartTitle}</span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- فلتر زمني متفاعل بالرموز: يومي (1ي) / أسبوعي (7ي) / شهري (30ي) -->
          <div id="chartRangeControl" class="flex items-center bg-[#0F172A]/90 p-0.5 rounded-lg border border-slate-800 gap-0.5">
            <button
              type="button"
              data-range="daily"
              onclick="window.setMainChartRange('daily')"
              title="${t.chartDaily || (currentLang === 'en' ? 'Daily' : 'يومي')}"
              class="text-[9px] px-1.5 py-0.5 rounded-md font-bold transition-all active:scale-95 flex items-center gap-0.5 ${
                (window.mainChartRange || 'weekly') === 'daily'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              <span>📅</span>
              <span>${currentLang === 'en' ? '1D' : '1ي'}</span>
            </button>
            <button
              type="button"
              data-range="weekly"
              onclick="window.setMainChartRange('weekly')"
              title="${t.chartWeekly || (currentLang === 'en' ? 'Weekly' : 'أسبوعي')}"
              class="text-[9px] px-1.5 py-0.5 rounded-md font-bold transition-all active:scale-95 flex items-center gap-0.5 ${
                (window.mainChartRange || 'weekly') === 'weekly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              <span>🗓️</span>
              <span>${currentLang === 'en' ? '7D' : '7ي'}</span>
            </button>
            <button
              type="button"
              data-range="monthly"
              onclick="window.setMainChartRange('monthly')"
              title="${t.chartMonthly || (currentLang === 'en' ? 'Monthly' : 'شهري')}"
              class="text-[9px] px-1.5 py-0.5 rounded-md font-bold transition-all active:scale-95 flex items-center gap-0.5 ${
                (window.mainChartRange || 'weekly') === 'monthly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              <span>📆</span>
              <span>${currentLang === 'en' ? '30D' : '30ي'}</span>
            </button>
          </div>

          <!-- تبديل شكل عرض الرسم البياني بالرموز: خط / مساحة / أعمدة -->
          <div id="chartTypeControl" class="flex items-center bg-[#0F172A]/90 border border-slate-800 p-0.5 rounded-lg gap-0.5">
            <button
              type="button"
              data-chart-type="line"
              onclick="window.setMainChartType('line')"
              title="${t.chartTypeLine || (currentLang === 'en' ? 'Line' : 'خطي')}"
              class="px-1.5 py-0.5 rounded-md text-[11px] leading-none transition-all active:scale-95 ${
                (window.mainChartType || 'area') === 'line'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              📈
            </button>
            <button
              type="button"
              data-chart-type="area"
              onclick="window.setMainChartType('area')"
              title="${t.chartTypeArea || (currentLang === 'en' ? 'Area' : 'مساحة')}"
              class="px-1.5 py-0.5 rounded-md text-[11px] leading-none transition-all active:scale-95 ${
                (window.mainChartType || 'area') === 'area'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              🌄
            </button>
            <button
              type="button"
              data-chart-type="bar"
              onclick="window.setMainChartType('bar')"
              title="${t.chartTypeBar || (currentLang === 'en' ? 'Bar' : 'أعمدة')}"
              class="px-1.5 py-0.5 rounded-md text-[11px] leading-none transition-all active:scale-95 ${
                (window.mainChartType || 'area') === 'bar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 opacity-80 hover:opacity-100'
              }">
              📊
            </button>
          </div>
        </div>
      </div>

      <div class="relative w-full h-[120px]">
        <canvas id="mainChart"></canvas>
      </div>
    </div>

    <!-- حقوق الملكية والتواصل عبر واتساب والوصول السريع -->
    <div class="pt-2 border-t border-slate-700/50 text-center space-y-2 w-full">

      <div class="grid grid-cols-2 gap-2">
        <!-- زر التواصل مع المطور -->
        <button
          onclick="window.open('${waUrl}', '_blank')"
          class="w-full bg-[#1E293B]/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-emerald-500/40 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300 transition active:scale-95 shadow-sm cursor-pointer">
          <span class="text-green-500 text-sm">📱</span>
          <span class="truncate">${t.contactDev}</span>
        </button>

        <!-- زر تسجيل الخروج -->
        <button
          onclick="if(confirm('${t.logoutConfirm.replace(/'/g, "\\'")}')) { window.logout(); }"
          class="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition active:scale-95 shadow-sm cursor-pointer">
          <span class="text-sm">🚪</span>
          <span class="truncate">${(translations[currentLang] || translations.en).logout}</span>
        </button>
      </div>

      <!-- حقوق الملكية -->
      <p class="text-[9px] text-slate-400 opacity-70 font-medium tracking-wide">
        ${(translations[currentLang] || translations.en).footer}
      </p>
    </div>

  ${BottomNav("home")}
  `;
};
