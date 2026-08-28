import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";

export const QualityView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).quality;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div>
      <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
        <span>📦</span> ${t.title || (currentLang === 'en' ? 'Quality & Knowledge' : 'الجودة والمعرفة')}
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
    </div>
    <span class="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[10px] px-2.5 py-1 rounded-full font-black shadow-sm">
      ${t.badge || (currentLang === 'en' ? 'Quality Control' : 'مراقبة الجودة')}
    </span>
  </div>

  <!-- شبكة الإجراءات السريعة -->
  <div class="grid grid-cols-2 gap-3.5">

    <!-- تصوير عيب -->
    <button 
      type="button"
      onclick="window.navigateTo('defect')" 
      class="relative text-start border border-blue-500/40 hover:border-blue-400/70 bg-gradient-to-br from-blue-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-blue-900/30 group overflow-hidden">
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        📷
      </div>
      <span class="font-bold text-xs text-gray-100">${t.defectTitle || (currentLang === 'en' ? 'Capture Defect' : 'تصوير عيب')}</span>
      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">${t.defectDesc || ''}</span>
    </button>

    <!-- اكتشاف العيب بـ AI (شارة مميزة) -->
    <button 
      type="button"
      onclick="window.navigateTo('ai')" 
      class="relative text-start border border-indigo-500/40 hover:border-indigo-400/70 bg-gradient-to-br from-indigo-950/60 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-indigo-900/30 group overflow-hidden">
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <span class="absolute top-2 rtl:right-2 ltr:left-2 bg-indigo-500/25 text-indigo-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-400/40 shadow-sm">
        AI 🚀
      </span>
      <div class="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        🤖
      </div>
      <span class="font-bold text-xs text-gray-100">${t.aiTitle || (currentLang === 'en' ? 'AI Defect Diagnosis' : 'اكتشاف العيب بالذكاء')}</span>
      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">${t.aiDesc || ''}</span>
    </button>

    <!-- قاعدة المعرفة -->
    <button 
      type="button"
      onclick="window.navigateTo('kb')" 
      class="relative text-start border border-cyan-500/40 hover:border-cyan-400/70 bg-gradient-to-br from-cyan-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-cyan-900/30 group overflow-hidden">
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        📚
      </div>
      <span class="font-bold text-xs text-gray-100">${t.kbTitle || (currentLang === 'en' ? 'Knowledge Base' : 'قاعدة المعرفة')}</span>
      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">${t.kbDesc || ''}</span>
    </button>

    <!-- الإحصائيات -->
    <button 
      type="button"
      onclick="window.navigateTo('stats')" 
      class="relative text-start border border-emerald-500/40 hover:border-emerald-400/70 bg-gradient-to-br from-emerald-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-emerald-900/30 group overflow-hidden">
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        📈
      </div>
      <span class="font-bold text-xs text-gray-100">${t.statsTitle || (currentLang === 'en' ? 'Statistics' : 'الإحصائيات')}</span>
      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">${t.statsDesc || ''}</span>
    </button>

  </div>

</div>

${BottomNav("quality")}
`;
};
