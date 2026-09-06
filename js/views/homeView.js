import { BottomNav } from "../components/BottomNav.js";
import { hasPermission } from "../permissions.js";
import { translations } from "../config.js";
import { renderAttendanceCard } from "../attendanceCard.js";

export const HomeView = () => {
  // نظام الترجمة الموجود بالفعل في config.js (translations) - نفس
  // النمط المستخدم في BottomNav.js / issueView.js بالظبط، من غير
  // إنشاء أي نظام ترجمة تاني أو تكرار
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.en).home;

  const stats = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  // إعداد رقم الواتساب الخاص بك والرسالة الجاهزة (مترجمة حسب اللغة الحالية)
  const waNumber = "201067988554";
  const waMessage = t.waMessage;

  // تجهيز الرابط النهائي وتشفير الرسالة لتتناسب مع الرابط
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  return `
  <div class="app-page p-3 sm:p-4 md:p-6 lg:p-8 max-w-md sm:max-w-xl md:max-w-5xl lg:max-w-7xl xl:max-w-[1500px] mx-auto pb-24 space-y-4 md:space-y-6">

    <div class="flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6 items-start w-full">

      <!-- ========================================================
           1. ملخص المؤشرات الحية والعدادات الذكية
           الموبايل: ترتيب 2 / الكمبيوتر: أعلى لوحة التحكم بعرض كامل
           ======================================================== -->
      <div class="order-2 lg:order-1 lg:col-span-12 w-full space-y-2.5 sm:space-y-3.5">
        <div class="flex items-center justify-between px-0.5">
          <h3 class="text-xs sm:text-sm font-bold dyn-text-muted opacity-80 uppercase tracking-wider flex items-center gap-1.5">
            <span>📊</span>
            <span>${t.statsOverview || (currentLang === 'ar' ? 'ملخص المؤشرات الحية' : 'Live Metrics Overview')}</span>
          </h3>
          <span class="text-[10px] sm:text-xs text-blue-400 font-medium inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>${currentLang === 'ar' ? 'مزامنة حية' : 'Live Sync'}</span>
          </span>
        </div>

        <!-- كروت العدادات الخمسة -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3 md:gap-3.5">

          <!-- أعطال مفتوحة -->
          <button
            type="button"
            onclick="window.openTicketsWithFilter('pending')"
            class="relative text-start dyn-card border border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
            <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-amber-500"></div>
            <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-[10px] sm:text-xs font-black text-amber-400/80 group-hover:text-amber-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
            <div class="min-w-0 pr-1.5 rtl:pr-1.5 rtl:pl-0 ltr:pl-1.5">
              <span class="text-[10px] sm:text-[11px] md:text-xs dyn-text-muted opacity-75 block mb-1 font-medium truncate">${t.kpiOpen}</span>
              <span id="statOpenCount" class="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 leading-none">${stats.open}</span>
              <span id="criticalBadge" class="hidden mt-1.5 items-center gap-1 text-[8px] sm:text-[9px] font-bold text-red-300 bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 rounded-full w-fit">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span id="criticalBadgeText">${t.kpiCritical}</span>
              </span>
            </div>
            <div class="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/>
              </svg>
            </div>
          </button>

          <!-- تم إصلاحها -->
          <button
            type="button"
            onclick="window.openTicketsWithFilter('resolved')"
            class="relative text-start dyn-card border border-emerald-500/30 hover:border-emerald-400/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
            <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
            <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-[10px] sm:text-xs font-black text-emerald-400/80 group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
            <div class="min-w-0 pr-1.5 rtl:pr-1.5 rtl:pl-0 ltr:pl-1.5">
              <span class="text-[10px] sm:text-[11px] md:text-xs dyn-text-muted opacity-75 block mb-1 font-medium truncate">${t.kpiClosed}</span>
              <span id="statClosedCount" class="text-xl sm:text-2xl md:text-3xl font-black text-emerald-400 leading-none">${stats.closed}</span>
            </div>
            <div class="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
              </svg>
            </div>
          </button>

          <!-- أعطال اليوم -->
          <button
            type="button"
            onclick="window.openTicketsWithFilter('today')"
            class="relative text-start dyn-card border border-blue-500/30 hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
            <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
            <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-[10px] sm:text-xs font-black text-blue-400/80 group-hover:text-blue-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
            <div class="min-w-0 pr-1.5 rtl:pr-1.5 rtl:pl-0 ltr:pl-1.5">
              <span class="text-[10px] sm:text-[11px] md:text-xs dyn-text-muted opacity-75 block mb-1 font-medium truncate">${t.kpiToday}</span>
              <span id="statTodayCount" class="text-xl sm:text-2xl md:text-3xl font-black text-blue-400 leading-none">${stats.today}</span>
            </div>
            <div class="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
              </svg>
            </div>
          </button>

          <!-- بلاغات متأخرة -->
          <button
            type="button"
            onclick="window.openTicketsWithFilter('overdue')"
            class="relative text-start dyn-card border border-rose-500/30 hover:border-rose-400/60 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group">
            <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
            <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-[10px] sm:text-xs font-black text-rose-400/80 group-hover:text-rose-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
            <div class="min-w-0 pr-1.5 rtl:pr-1.5 rtl:pl-0 ltr:pl-1.5">
              <span class="text-[10px] sm:text-[11px] md:text-xs dyn-text-muted opacity-75 block mb-1 font-medium truncate">${t.kpiOverdue || (currentLang === 'ar' ? 'متأخرة' : 'Overdue')}</span>
              <span id="statOverdueCount" class="text-xl sm:text-2xl md:text-3xl font-black text-rose-400 leading-none">${stats.overdue || 0}</span>
            </div>
            <div class="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </button>

          <!-- إجمالي البلاغات -->
          <button
            type="button"
            onclick="window.openTicketsWithFilter('all')"
            class="relative text-start dyn-card border border-purple-500/30 hover:border-purple-400/60 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden group col-span-2 sm:col-span-1">
            <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
            <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-[10px] sm:text-xs font-black text-purple-400/80 group-hover:text-purple-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
            <div class="min-w-0 pr-1.5 rtl:pr-1.5 rtl:pl-0 ltr:pl-1.5">
              <span class="text-[10px] sm:text-[11px] md:text-xs dyn-text-muted opacity-75 block mb-1 font-medium truncate">${t.kpiTotal}</span>
              <span id="statTotalCount" class="text-xl sm:text-2xl md:text-3xl font-black text-purple-400 leading-none">${stats.total}</span>
            </div>
            <div class="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
              </svg>
            </div>
          </button>

        </div>

        <!-- كارتات ذكية إضافية: MTTR + أكثر ماكينة عطلاً + أفضل فني -->
        <div class="grid grid-cols-3 gap-2 sm:gap-3 md:gap-3.5">
          <div class="dyn-card border p-2.5 sm:p-3 md:p-3.5 rounded-xl md:rounded-2xl text-center shadow-sm cursor-default hover:border-cyan-500/30 transition-colors">
            <div class="text-[9px] sm:text-[10px] md:text-xs dyn-text-muted opacity-75 mb-1 truncate font-medium">⏱️ ${t.mttr}</div>
            <div id="statMttrValue" class="text-xs sm:text-sm md:text-base font-black text-cyan-400">—</div>
          </div>
          <div class="dyn-card border p-2.5 sm:p-3 md:p-3.5 rounded-xl md:rounded-2xl text-center shadow-sm cursor-default hover:border-purple-500/30 transition-colors">
            <div class="text-[9px] sm:text-[10px] md:text-xs dyn-text-muted opacity-75 mb-1 truncate font-medium">🏭 ${t.topMachine}</div>
            <div id="statTopMachineName" class="text-[10px] sm:text-xs md:text-sm font-bold dyn-text-muted truncate">—</div>
          </div>
          <div class="dyn-card border p-2.5 sm:p-3 md:p-3.5 rounded-xl md:rounded-2xl text-center shadow-sm cursor-default hover:border-amber-500/30 transition-colors">
            <div class="text-[9px] sm:text-[10px] md:text-xs dyn-text-muted opacity-75 mb-1 truncate font-medium">🥇 ${t.topTech}</div>
            <div id="statTopTechName" class="text-[10px] sm:text-xs md:text-sm font-bold dyn-text-muted truncate">—</div>
          </div>
        </div>
      </div>

      <!-- ========================================================
           2. كارت حضور الوردية الذكي للفنيين (MSCANCO EGYPT)
           الموبايل: ترتيب 1 في البداية لسرعة التسجيل / الكمبيوتر: عمود متناسق بجوار الإجراءات
           ======================================================== -->
      <div class="order-1 lg:order-2 lg:col-span-6 xl:col-span-6 w-full space-y-2">
        <div class="flex items-center justify-between px-0.5">
          <h3 class="text-xs sm:text-sm font-bold dyn-text-muted opacity-80 uppercase tracking-wider flex items-center gap-1.5">
            <span>⏰</span>
            <span>${currentLang === 'ar' ? 'وردية العمل وحاسبة الحضور' : 'Shift & Attendance'}</span>
          </h3>
        </div>
        <div id="attendanceCardContainer" class="w-full">
          ${renderAttendanceCard()}
        </div>
      </div>

      <!-- ========================================================
           3. مركز الإجراءات السريعة والعمليات التشغيلية
           الموبايل: ترتيب 3 / الكمبيوتر: عمود متناسق بجوار كارت الحضور
           ======================================================== -->
      <div class="order-3 lg:order-3 lg:col-span-6 xl:col-span-6 w-full space-y-3">
        <div class="flex items-center justify-between px-0.5">
          <h3 class="text-xs sm:text-sm font-bold dyn-text-muted opacity-80 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span>
            <span>${t.quickAccess}</span>
          </h3>
        </div>

        <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
          <!-- زر الإبلاغ عن عطل - تصميم مميز بأسلوب الطوارئ والبروز البصري الفوري -->
          <button
            onclick="window.navigateTo('issue')"
            class="${hasPermission('suggestions') ? 'col-span-1' : 'col-span-2'} relative group border-2 border-red-500/70 hover:border-red-400 bg-gradient-to-br from-red-950/90 via-red-900/50 to-orange-950/40 p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-2.5 sm:gap-3 text-start transition-all duration-200 active:scale-95 shadow-md shadow-red-950/50 hover:shadow-red-600/30 overflow-hidden cursor-pointer">
            <div class="absolute -right-4 -bottom-4 w-12 h-12 bg-red-500/20 rounded-full blur-lg pointer-events-none"></div>
            <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse"></div>

            <span class="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-red-600/30 border border-red-400/50 text-red-300 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-red-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-8.25 3h.008v.008h-.008v-.008Z"/>
              </svg>
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-black text-xs sm:text-sm text-red-100 flex items-center gap-1">
                <span class="truncate">${t.reportIssue}</span>
                ${hasPermission('suggestions') ? '' : '<span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>'}
              </div>
              <div class="text-[9.5px] sm:text-[10px] md:text-xs text-red-300/80 font-medium truncate">${t.reportIssueDesc}</div>
            </div>
            <span class="text-amber-400 text-sm sm:text-base font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
          </button>

          <!-- زر الكايزن -->
          ${hasPermission("suggestions") ? `
          <button
            onclick="window.navigateTo('suggestions')"
            class="col-span-1 relative group dyn-card border border-amber-500/40 hover:border-amber-400/70 bg-gradient-to-br from-amber-950/60 via-amber-900/30 to-transparent p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-2.5 sm:gap-3 text-start transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md cursor-pointer">
            <span class="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/>
              </svg>
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-xs sm:text-sm dyn-text-muted truncate">${t.kaizenSubmit}</div>
              <div class="text-[9.5px] sm:text-[10px] md:text-xs dyn-text-muted opacity-60 truncate">${t.kaizenSubmitDesc}</div>
            </div>
            <span class="text-amber-400 text-sm sm:text-base font-black shrink-0 rtl:rotate-180 group-hover:scale-125 transition-transform">›</span>
          </button>
          ` : ""}

          ${(hasPermission("maintenance") || hasPermission("errorScanner")) ? `
          <!-- فاحص شاشات الأعطال -->
          <button 
            type="button"
            id="cardErrorScanner"
            onclick="window.navigateTo('errorScanner')" 
            aria-label="${(translations[currentLang] || translations.ar).maintenance.scannerTitle || (currentLang === 'en' ? 'Error Code Scanner' : 'فاحص شاشات الأعطال')}"
            class="${hasPermission("maintenance") || hasPermission("qr") ? 'col-span-2 sm:col-span-1' : 'col-span-2'} relative text-start dyn-card bg-gradient-to-r from-indigo-950/60 via-[#1E293B] to-[#0F172A] hover:from-indigo-900/60 hover:to-[#1E293B] border border-indigo-500/30 hover:border-indigo-400/60 p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-md group overflow-hidden">
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div class="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xl sm:text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0" aria-hidden="true">
                📷
              </div>
              <div class="min-w-0">
                <span class="font-bold text-xs sm:text-sm dyn-text-muted block truncate">${(translations[currentLang] || translations.ar).maintenance.scannerTitle || (currentLang === 'en' ? 'Error Code Scanner' : 'فاحص شاشات الأعطال')}</span>
                <span class="text-[9.5px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 block truncate">${(translations[currentLang] || translations.ar).maintenance.scannerDesc || ''}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span class="text-[11px] sm:text-xs text-indigo-400 font-bold bg-indigo-500/15 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-indigo-500/30 shadow-sm">
                ${(translations[currentLang] || translations.ar).maintenance.scannerBtn || (currentLang === 'en' ? 'Scan' : 'فحص')}
              </span>
              <span class="text-amber-400 text-base sm:text-lg font-black group-hover:scale-125 transition-transform rtl:rotate-180" aria-hidden="true">›</span>
            </div>
          </button>
          ` : ''}

          ${(hasPermission("maintenance") || hasPermission("qr")) ? `
          <!-- QR الماكينة -->
          <button 
            type="button"
            id="cardQrCode"
            onclick="window.navigateTo('qr')" 
            aria-label="${(translations[currentLang] || translations.ar).maintenance.qrTitle || (currentLang === 'en' ? 'Machine QR Code' : 'مسح QR الماكينات')}"
            class="${hasPermission("maintenance") || hasPermission("errorScanner") ? 'col-span-2 sm:col-span-1' : 'col-span-2'} relative text-start dyn-card bg-gradient-to-r from-emerald-950/60 via-[#1E293B] to-[#0F172A] hover:from-emerald-900/60 hover:to-[#1E293B] border border-emerald-500/30 hover:border-emerald-400/60 p-3 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-md group overflow-hidden">
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div class="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl sm:text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0" aria-hidden="true">
                📱
              </div>
              <div class="min-w-0">
                <span class="font-bold text-xs sm:text-sm dyn-text-muted block truncate">${(translations[currentLang] || translations.ar).maintenance.qrTitle || (currentLang === 'en' ? 'Machine QR Code' : 'مسح QR الماكينات')}</span>
                <span class="text-[9.5px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 block truncate">${(translations[currentLang] || translations.ar).maintenance.qrDesc || ''}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span class="text-[11px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/15 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-emerald-500/30 shadow-sm">
                ${(translations[currentLang] || translations.ar).maintenance.qrBtn || (currentLang === 'en' ? 'Open' : 'فتح')}
              </span>
              <span class="text-amber-400 text-base sm:text-lg font-black group-hover:scale-125 transition-transform rtl:rotate-180" aria-hidden="true">›</span>
            </div>
          </button>
          ` : ''}
        </div>

        <!-- أزرار الدعم وتسجيل الخروج -->
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <!-- زر التواصل مع المطور -->
          <button
            type="button"
            onclick="window.open('${waUrl}', '_blank')"
            class="w-full dyn-card hover:border-green-500/40 border py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold dyn-text-muted transition active:scale-95 shadow-sm cursor-pointer">
            <span class="text-green-500 text-sm">📱</span>
            <span class="truncate">${t.contactDev}</span>
          </button>

          <!-- زر تسجيل الخروج -->
          <button
            type="button"
            onclick="if(confirm('${t.logoutConfirm.replace(/'/g, "\\'")}')) { window.logout(); }"
            class="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition active:scale-95 shadow-sm cursor-pointer">
            <span class="text-sm">🚪</span>
            <span class="truncate">${(translations[currentLang] || translations.en).logout}</span>
          </button>
        </div>
      </div>

      <!-- ========================================================
           4. الفوتر وحقوق الملكية
           الموبايل والكمبيوتر: أسفل الصفحة بعرض كامل
           ======================================================== -->
      <div class="order-4 lg:order-4 lg:col-span-12 w-full pt-4 border-t text-center space-y-1.5" style="border-color: var(--app-border);">
        <p class="text-[10px] sm:text-xs dyn-text-muted opacity-60 font-medium tracking-wide">
          ${(translations[currentLang] || translations.en).footer}
        </p>
      </div>

    </div>

  ${BottomNav("home")}
  `;
};
