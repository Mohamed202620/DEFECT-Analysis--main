import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";
// إصلاح (اتساق واجهة الصلاحيات): نفس دالة الصلاحيات المستخدمة في
// homeView.js - عشان أزرار مركز الصيانة تتفق مع نفس منطق الإخفاء
// المتبع في الرئيسية، بدل الاعتماد بس على حماية المسار (Router) اللي
// بتمنع الدخول فعلياً لكنها متمنعش ظهور زرار بيؤدي لصفحة "غير مصرح"
import { hasPermission } from "../permissions.js";

export const MaintenanceView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).maintenance;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div>
      <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
        <span>🛠️</span> ${t.title || (currentLang === 'en' ? 'Maintenance Center' : 'مركز الصيانة')}
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
    </div>
    <span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-1 rounded-full font-black shadow-sm">
      ${t.badge || (currentLang === 'en' ? 'Live System' : 'نظام حي')}
    </span>
  </div>

  <!-- شبكة الإجراءات السريعة -->
  <div class="grid grid-cols-2 gap-2.5 sm:gap-3">

    ${hasPermission("maintenance") ? `
    <!-- تسجيل عطل - تصميم الطوارئ المدمج -->
    <button 
      type="button"
      onclick="window.navigateTo('issue')" 
      class="relative text-start border border-red-500/60 hover:border-red-400 bg-gradient-to-br from-red-950/70 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-red-900/30 group overflow-hidden min-h-[90px]">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse"></div>
      
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-red-600/25 border border-red-400/40 text-red-200 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          🚨
        </div>
        <span class="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
          <span>${currentLang === 'en' ? 'Alert' : 'طوارئ'}</span>
        </span>
      </div>

      <div>
        <span class="font-bold text-xs text-red-100 block leading-tight truncate">${t.issueTitle || (currentLang === 'en' ? 'Report Breakdown' : 'تسجيل عطل')}</span>
        <span class="text-[10px] text-red-300/70 mt-0.5 block truncate font-medium">${t.issueDesc || ''}</span>
      </div>
    </button>

    <!-- متابعة البلاغات (دورة حياة التذكرة) -->
    <button 
      type="button"
      onclick="window.navigateTo('tickets')" 
      class="relative text-start border border-emerald-500/35 hover:border-emerald-400/60 bg-gradient-to-br from-emerald-950/50 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-emerald-900/30 group overflow-hidden min-h-[90px]">
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          📋
        </div>
        <span class="text-gray-400 text-xs font-black group-hover:text-emerald-400 transition-colors rtl:rotate-180">›</span>
      </div>

      <div>
        <span class="font-bold text-xs text-gray-100 block leading-tight truncate">${t.ticketsTitle || (currentLang === 'en' ? 'Track Tickets' : 'متابعة البلاغات')}</span>
        <span class="text-[10px] text-gray-400 mt-0.5 block truncate font-medium">${t.ticketsDesc || ''}</span>
      </div>
    </button>
    ` : ''}

    ${hasPermission("suggestions") ? `
    <!-- نظام كايزن -->
    <button 
      type="button"
      onclick="window.navigateTo('suggestions')" 
      class="relative text-start border border-amber-500/35 hover:border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-amber-900/30 group overflow-hidden min-h-[90px]">
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          💡
        </div>
        <span class="text-gray-400 text-xs font-black group-hover:text-amber-400 transition-colors rtl:rotate-180">›</span>
      </div>

      <div>
        <span class="font-bold text-xs text-gray-100 block leading-tight truncate">${t.kaizenTitle || (currentLang === 'en' ? 'Submit Kaizen' : 'نظام كايزن')}</span>
        <span class="text-[10px] text-gray-400 mt-0.5 block truncate font-medium">${t.kaizenDesc || ''}</span>
      </div>
    </button>

    <!-- متابعة الكايزن (مراجعة واعتماد المقترحات) -->
    <button 
      type="button"
      onclick="window.navigateTo('kaizenBoard')" 
      class="relative text-start border border-amber-500/35 hover:border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-amber-900/30 group overflow-hidden min-h-[90px]">
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          🏆
        </div>
        <span class="text-gray-400 text-xs font-black group-hover:text-amber-400 transition-colors rtl:rotate-180">›</span>
      </div>

      <div>
        <span class="font-bold text-xs text-gray-100 block leading-tight truncate">${t.kaizenBoardTitle || (currentLang === 'en' ? 'Kaizen Board' : 'متابعة الكايزن')}</span>
        <span class="text-[10px] text-gray-400 mt-0.5 block truncate font-medium">${t.kaizenBoardDesc || ''}</span>
      </div>
    </button>
    ` : ''}

    ${hasPermission("kb") ? `
    <!-- قاعدة المعرفة (دليل الإصلاح) -->
    <button 
      type="button"
      onclick="window.navigateTo('kb')" 
      class="relative text-start border border-cyan-500/35 hover:border-cyan-400/60 bg-gradient-to-br from-cyan-950/45 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-cyan-900/30 group overflow-hidden min-h-[90px]">
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          📖
        </div>
        <span class="text-gray-400 text-xs font-black group-hover:text-cyan-400 transition-colors rtl:rotate-180">›</span>
      </div>

      <div>
        <span class="font-bold text-xs text-gray-100 block leading-tight truncate">${t.kbTitle || (currentLang === 'en' ? 'Knowledge Base' : 'قاعدة المعرفة')}</span>
        <span class="text-[10px] text-gray-400 mt-0.5 block truncate font-medium">${t.kbDesc || ''}</span>
      </div>
    </button>
    ` : ''}

    ${hasPermission("statistics") ? `
    <!-- الإحصائيات والتحليلات -->
    <button 
      type="button"
      onclick="window.navigateTo('stats')" 
      class="relative text-start border border-emerald-500/35 hover:border-emerald-400/60 bg-gradient-to-br from-emerald-950/45 via-[#1E293B] to-[#0F172A] p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-emerald-900/30 group overflow-hidden min-h-[90px]">
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          📊
        </div>
        <span class="text-gray-400 text-xs font-black group-hover:text-emerald-400 transition-colors rtl:rotate-180">›</span>
      </div>

      <div>
        <span class="font-bold text-xs text-gray-100 block leading-tight truncate">${t.statsTitle || (currentLang === 'en' ? 'Statistics' : 'الإحصائيات')}</span>
        <span class="text-[10px] text-gray-400 mt-0.5 block truncate font-medium">${t.statsDesc || ''}</span>
      </div>
    </button>
    ` : ''}

    ${hasPermission("maintenance") ? `
    <!-- البحث والفلترة المتقدمة (زر عريض بارز) -->
    <button 
      type="button"
      onclick="window.navigateTo('maintenanceSearch')" 
      class="col-span-2 relative text-start bg-gradient-to-r from-[#1E293B] to-[#0F172A] hover:from-[#283548] hover:to-[#1E293B] border border-blue-500/30 hover:border-blue-400/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-md group overflow-hidden">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
          🔎
        </div>
        <div>
          <span class="font-bold text-xs text-gray-100 block">${t.searchTitle || (currentLang === 'en' ? 'Advanced Search' : 'البحث والفلترة المتقدمة')}</span>
          <span class="text-[10px] text-gray-400 mt-0.5 block">${t.searchDesc || ''}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-blue-400 font-bold bg-blue-500/15 px-3 py-1.5 rounded-lg border border-blue-500/30 shadow-sm">
          ${t.searchOpen || (currentLang === 'en' ? 'Search' : 'بحث')}
        </span>
        <span class="text-amber-400 text-lg font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      </div>
    </button>

    <!-- Machine Error Scanner (زر عريض بارز) -->
    <button 
      type="button"
      onclick="window.navigateTo('errorScanner')" 
      class="col-span-2 relative text-start bg-gradient-to-r from-[#1E293B] to-[#0F172A] hover:from-[#283548] hover:to-[#1E293B] border border-indigo-500/30 hover:border-indigo-400/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-md group overflow-hidden">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
          📷
        </div>
        <div>
          <span class="font-bold text-xs text-gray-100 block">${t.scannerTitle || (currentLang === 'en' ? 'Error Code Scanner' : 'فاحص شاشات الأعطال')}</span>
          <span class="text-[10px] text-gray-400 mt-0.5 block">${t.scannerDesc || ''}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-indigo-400 font-bold bg-indigo-500/15 px-3 py-1.5 rounded-lg border border-indigo-500/30 shadow-sm">
          ${t.scannerBtn || (currentLang === 'en' ? 'Scan' : 'فحص')}
        </span>
        <span class="text-amber-400 text-lg font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      </div>
    </button>

    <!-- QR الماكينة (زر عريض بارز) -->
    <button 
      type="button"
      onclick="window.navigateTo('qr')" 
      class="col-span-2 relative text-start bg-gradient-to-r from-[#1E293B] to-[#0F172A] hover:from-[#283548] hover:to-[#1E293B] border border-emerald-500/30 hover:border-emerald-400/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-95 shadow-md group overflow-hidden">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
          📱
        </div>
        <div>
          <span class="font-bold text-xs text-gray-100 block">${t.qrTitle || (currentLang === 'en' ? 'Machine QR Code' : 'مسح QR الماكينة')}</span>
          <span class="text-[10px] text-gray-400 mt-0.5 block">${t.qrDesc || ''}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-emerald-400 font-bold bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/30 shadow-sm">
          ${t.qrBtn || (currentLang === 'en' ? 'Open' : 'فتح')}
        </span>
        <span class="text-amber-400 text-lg font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      </div>
    </button>
    ` : ''}

  </div>

</div>

${BottomNav("maintenance")}
`;
};
