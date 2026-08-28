import { translations } from '../config.js';

export const BottomNav = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'] || {};

  const navItems = [
    { 
      id: "home", 
      icon: "🏠", 
      label: t.navHome || (currentLang === 'en' ? "Home" : "الرئيسية"), 
      action: "window.navigateTo('home')" 
    },
    { 
      id: "maintenance", 
      icon: "🛠️", 
      label: t.navMaintenance || (currentLang === 'en' ? "Maintenance" : "الصيانة"), 
      action: "window.navigateTo('maintenance')" 
    },
    { 
      id: "quality", 
      icon: "📦", 
      label: t.navQuality || (currentLang === 'en' ? "Quality" : "الجودة"), 
      action: "window.navigateTo('quality')" 
    },
    { 
      id: "system", 
      icon: "⚙️", 
      label: t.navSystem || (currentLang === 'en' ? "System" : "النظام"), 
      action: "window.navigateTo('system')" 
    }
  ];

  return `
    <nav aria-label="Bottom Navigation" class="md:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto
                bg-[#0F172A]/95 backdrop-blur-2xl border border-slate-700/60
                rounded-2xl flex justify-between items-center p-1.5 px-2
                shadow-2xl shadow-black/60 z-50 transition-all duration-300">

      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        return `
          <button
            type="button"
            onclick="${item.action}"
            class="flex flex-col items-center justify-center flex-1 h-12 py-1 rounded-xl cursor-pointer select-none transition-all duration-150 active:scale-95 ${
              isActive
                ? 'bg-gradient-to-b from-blue-600 to-indigo-600 text-white font-black shadow-md shadow-blue-600/40 border border-blue-400/40 relative'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }">
            <span class="text-base leading-none">${item.icon}</span>
            <span class="text-[10px] mt-0.5 font-bold tracking-tight whitespace-nowrap">${item.label}</span>
            ${isActive ? '<span class="absolute -bottom-0.5 w-4 h-0.5 bg-blue-300 rounded-full shadow-sm"></span>' : ''}
          </button>
        `;
      }).join("")}

    </nav>
  `;
};
