import { BottomNav } from "../components/BottomNav.js";
import { hasPermission } from "../permissions.js";
import { translations } from "../config.js";

export const HomeView = () => {
  // نظام الترجمة الموجود بالفعل في config.js (translations) - نفس
  // النمط المستخدم في BottomNav.js / issueView.js بالظبط، من غير
  // إنشاء أي نظام ترجمة تاني أو تكرار
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.en).home;

  // اسم/وظيفة المستخدم بيانات حقيقية من التسجيل (مش نص واجهة) -
  // النص الاحتياطي بس (لو الحقل فاضي) بيتاخد من الترجمة عشان ميظهرش
  // عربي وسط واجهة إنجليزية أو العكس
  const name = localStorage.getItem("name") || t.defaultName;
  const job = localStorage.getItem("job") || t.defaultJob;
  const stats = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  // إعداد رقم الواتساب الخاص بك والرسالة الجاهزة (مترجمة حسب اللغة الحالية)
  const waNumber = "201067988554";
  const waMessage = t.waMessage;

  // تجهيز الرابط النهائي وتشفير الرسالة لتتناسب مع الرابط
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  return `
  <div class="p-4 max-w-md mx-auto pb-24 space-y-5">

    <!-- الهيدر والترحيب -->
    <div class="flex items-center justify-between border-b pb-3" style="border-color: var(--app-border);">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base shadow-inner">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 class="text-sm font-bold dyn-text-muted flex items-center gap-1">
            ${t.welcome} ${name} 👋
          </h2>
          <p class="text-[11px] dyn-text-muted opacity-60">${job}</p>
        </div>
      </div>

      <!-- أدوات التحكم: تبديل الثيم وتبديل اللغة -->
      <div class="flex flex-col items-center gap-1.5">
        <button
          onclick="window.toggleDarkMode()"
          class="px-2.5 py-1 dyn-card border rounded-xl text-xs dyn-text-muted active:scale-95 transition shadow-sm"
          title="Toggle theme / تبديل الوضع">
          🌙 / ☀️
        </button>

        <button
          onclick="window.toggleLanguage()"
          class="px-2.5 py-1 dyn-card border rounded-xl text-xs font-bold dyn-text-muted active:scale-95 transition shadow-sm"
          title="Toggle language / تغيير اللغة">
          🌐 ${currentLang === 'ar' ? 'EN' : 'AR'}
        </button>
      </div>
    </div>

    <!-- ملخص العدادات الحية -->
    <div class="grid grid-cols-2 gap-3">

      <!-- أعطال مفتوحة -->
      <div class="relative dyn-card border p-3.5 rounded-2xl flex items-center justify-between shadow-lg shadow-black/10 ring-1 ring-white/5 overflow-hidden">
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-amber-500"></div>
        <div>
          <span class="text-[11px] dyn-text-muted opacity-60 block mb-0.5">${t.kpiOpen}</span>
          <span id="statOpenCount" class="text-xl font-bold text-amber-400">${stats.open}</span>
          <span id="criticalBadge" class="hidden mt-1 items-center gap-1 text-[9px] font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-full w-fit">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span id="criticalBadgeText">${t.kpiCritical}</span>
          </span>
        </div>
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/>
          </svg>
        </div>
      </div>

      <!-- تم إصلاحها -->
      <div class="dyn-card border p-3.5 rounded-2xl flex items-center justify-between shadow-lg shadow-black/10 ring-1 ring-white/5">
        <div>
          <span class="text-[11px] dyn-text-muted opacity-60 block mb-0.5">${t.kpiClosed}</span>
          <span id="statClosedCount" class="text-xl font-bold text-emerald-400">${stats.closed}</span>
        </div>
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
          </svg>
        </div>
      </div>

      <!-- أعطال اليوم -->
      <div class="dyn-card border p-3.5 rounded-2xl flex items-center justify-between shadow-lg shadow-black/10 ring-1 ring-white/5">
        <div>
          <span class="text-[11px] dyn-text-muted opacity-60 block mb-0.5">${t.kpiToday}</span>
          <span id="statTodayCount" class="text-xl font-bold text-blue-400">${stats.today}</span>
        </div>
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400 flex items-center justify-center shadow-inner shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
          </svg>
        </div>
      </div>

      <!-- إجمالي البلاغات -->
      <div class="dyn-card border p-3.5 rounded-2xl flex items-center justify-between shadow-lg shadow-black/10 ring-1 ring-white/5">
        <div>
          <span class="text-[11px] dyn-text-muted opacity-60 block mb-0.5">${t.kpiTotal}</span>
          <span id="statTotalCount" class="text-xl font-bold text-purple-400">${stats.total}</span>
        </div>
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-400 flex items-center justify-center shadow-inner shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
          </svg>
        </div>
      </div>

    </div>

    <!-- كارتات ذكية إضافية: MTTR + أكثر ماكينة عطلاً + أفضل فني -->
    <div class="grid grid-cols-3 gap-2">
      <div class="dyn-card border p-2.5 rounded-xl text-center shadow-md shadow-black/10">
        <div class="text-[9px] dyn-text-muted opacity-60 mb-1">⏱️ ${t.mttr}</div>
        <div id="statMttrValue" class="text-sm font-extrabold text-cyan-400">—</div>
      </div>
      <div class="dyn-card border p-2.5 rounded-xl text-center shadow-md shadow-black/10">
        <div class="text-[9px] dyn-text-muted opacity-60 mb-1">🏭 ${t.topMachine}</div>
        <div id="statTopMachineName" class="text-[11px] font-bold dyn-text-muted truncate">—</div>
      </div>
      <div class="dyn-card border p-2.5 rounded-xl text-center shadow-md shadow-black/10">
        <div class="text-[9px] dyn-text-muted opacity-60 mb-1">🥇 ${t.topTech}</div>
        <div id="statTopTechName" class="text-[11px] font-bold dyn-text-muted truncate">—</div>
      </div>
    </div>

    <!-- الوصول السريع -->
    <div class="space-y-2">
      <h3 class="text-xs font-bold dyn-text-muted opacity-70 px-1">${t.quickAccess}</h3>
      <div class="grid grid-cols-2 gap-3">
        <button
          onclick="window.navigateTo('issue')"
          class="dyn-card border hover:border-red-500/40 p-3 rounded-xl flex items-center gap-3 text-start transition active:scale-95 shadow-md shadow-black/10">
          <span class="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-8.25 3h.008v.008h-.008v-.008Z"/>
            </svg>
          </span>
          <div>
            <div class="font-bold text-xs dyn-text-muted">${t.reportIssue}</div>
            <div class="text-[10px] dyn-text-muted opacity-60">${t.reportIssueDesc}</div>
          </div>
        </button>

        <button
          onclick="window.navigateTo('ai')"
          class="dyn-card border hover:border-indigo-500/40 p-3 rounded-xl flex items-center gap-3 text-start transition active:scale-95 shadow-md shadow-black/10">
          <span class="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
            </svg>
          </span>
          <div>
            <div class="font-bold text-xs dyn-text-muted">${t.aiScan}</div>
            <div class="text-[10px] dyn-text-muted opacity-60">${t.aiScanDesc}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- الوصول السريع لنظام الكايزن -->
    ${hasPermission("suggestions") ? `
    <div class="space-y-2">
      <h3 class="text-xs font-bold dyn-text-muted opacity-70 px-1">${t.kaizenTitle}</h3>
      <div class="grid grid-cols-2 gap-3">
        <button
          onclick="window.navigateTo('suggestions')"
          class="dyn-card border hover:border-amber-500/40 p-3 rounded-xl flex items-center gap-3 text-start transition active:scale-95 shadow-md shadow-black/10">
          <span class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/>
            </svg>
          </span>
          <div>
            <div class="font-bold text-xs dyn-text-muted">${t.kaizenSubmit}</div>
            <div class="text-[10px] dyn-text-muted opacity-60">${t.kaizenSubmitDesc}</div>
          </div>
        </button>

        <button
          onclick="window.navigateTo('kaizenBoard')"
          class="relative dyn-card border hover:border-amber-500/40 p-3 rounded-xl flex items-center gap-3 text-start transition active:scale-95 shadow-md shadow-black/10">
          <span id="kaizenNeedsEditBadge" class="hidden absolute -top-1.5 rtl:-right-1.5 ltr:-left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center shadow-md"></span>
          <span class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3-6.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008V15Zm0 3h.008v.008h-.008V18ZM6 5.25V18a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 18V5.25m-12 0h12m-12 0-.375-.75h12.75l-.375.75M9 3.75h6"/>
            </svg>
          </span>
          <div>
            <div class="font-bold text-xs dyn-text-muted">${t.kaizenTrack}</div>
            <div class="text-[10px] dyn-text-muted opacity-60">${t.kaizenTrackDesc}</div>
          </div>
        </button>
      </div>
    </div>
    ` : ""}

    <!-- الرسم البياني الرئيسي -->
    <div class="dyn-card border p-4 rounded-2xl space-y-3 shadow-lg shadow-black/10">
      <div class="flex items-center justify-between border-b pb-2" style="border-color: var(--app-border);">
        <span class="text-xs font-bold dyn-text-muted">${t.chartTitle}</span>
        <span class="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">${t.chartWeekly}</span>
      </div>
      <div style="height: 180px;">
        <canvas id="mainChart"></canvas>
      </div>
    </div>

    <!-- حقوق الملكية والتواصل عبر واتساب والوصول السريع -->
    <div class="pt-4 border-t text-center space-y-3" style="border-color: var(--app-border);">

      <!-- زر التواصل مع المطور -->
      <button
        onclick="window.open('${waUrl}', '_blank')"
        class="w-full dyn-card hover:border-green-500/40 border py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold dyn-text-muted transition active:scale-95 shadow-md shadow-black/10">
        <span class="text-green-500">📱</span>
        <span>${t.contactDev}</span>
      </button>

      <!-- زر تسجيل الخروج -->
      <button
        onclick="if(confirm('${t.logoutConfirm.replace(/'/g, "\\'")}')) { localStorage.clear(); window.location.reload(); }"
        class="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition active:scale-95 shadow-md">
        <span>🚪</span>
        <span>${(translations[currentLang] || translations.en).logout}</span>
      </button>

      <!-- حقوق الملكية -->
      <p class="text-[10px] dyn-text-muted opacity-50 font-medium tracking-wide">
        ${(translations[currentLang] || translations.en).footer}
      </p>
    </div>

  </div>

  ${BottomNav("home")}
  `;
};
