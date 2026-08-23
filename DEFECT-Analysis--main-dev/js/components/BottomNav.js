import { translations } from '../config.js';

export const BottomNav = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];

  const navItems = [
    { id: "home", icon: "🏠", label: t.navHome || "الرئيسية" },
    { id: "maintenance", icon: "🛠️", label: t.navMaintenance || "الصيانة" },
    { id: "quality", icon: "📦", label: t.navQuality || "الجودة" },
    { id: "system", icon: "⚙️", label: t.navSystem || "النظام" }
  ];

  return `
    <div class="fixed bottom-4 left-4 right-4 max-w-md mx-auto
                dyn-card backdrop-blur-xl border
                rounded-3xl flex justify-around items-center p-2
                shadow-2xl z-50 transition-all duration-300">

      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        return `
          <button
            type="button"
            onclick="window.navigateTo('${item.id}')"
            class="flex flex-col items-center justify-center w-14 h-14 rounded-2xl cursor-pointer transition-all duration-200 active:scale-95 ${
              isActive
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-105'
                : 'dyn-text-muted hover:opacity-100 opacity-70'
            }">
            <span class="text-xl leading-none">${item.icon}</span>
            <span class="text-[10px] mt-1 font-medium">${item.label}</span>
          </button>
        `;
      }).join("")}

    </div>
  `;
};
