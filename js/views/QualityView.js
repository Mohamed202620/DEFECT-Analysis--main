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
      <h2 class="text-base font-bold text-blue-400 flex items-center gap-2">
        <span>📦</span> ${t.title}
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5">${t.subtitle}</p>
    </div>
    <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">
      ${t.badge}
    </span>
  </div>

  <!-- شبكة الإجراءات السريعة -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">

    <!-- تصوير عيب -->
    <div 
      onclick="window.navigateTo('defect')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        📷
      </div>
      <span class="font-bold text-xs text-gray-100">${t.defectTitle}</span>
      <span class="text-[10px] text-gray-400 mt-1">${t.defectDesc}</span>
    </div>

    <!-- اكتشاف العيب بـ AI (شارة مميزة) -->
    <div 
      onclick="window.navigateTo('ai')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-indigo-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group relative overflow-hidden">
      <span class="absolute top-2 right-2 bg-indigo-500/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
        AI 🚀
      </span>
      <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        🤖
      </div>
      <span class="font-bold text-xs text-gray-100">${t.aiTitle}</span>
      <span class="text-[10px] text-gray-400 mt-1">${t.aiDesc}</span>
    </div>

    <!-- قاعدة المعرفة -->
    <div 
      onclick="window.navigateTo('kb')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-cyan-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        📚
      </div>
      <span class="font-bold text-xs text-gray-100">${t.kbTitle}</span>
      <span class="text-[10px] text-gray-400 mt-1">${t.kbDesc}</span>
    </div>

    <!-- الإحصائيات -->
    <div 
      onclick="window.navigateTo('stats')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        📈
      </div>
      <span class="font-bold text-xs text-gray-100">${t.statsTitle}</span>
      <span class="text-[10px] text-gray-400 mt-1">${t.statsDesc}</span>
    </div>

  </div>

</div>

${BottomNav("quality")}
`;
};
