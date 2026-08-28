import { translations } from '../config.js';

export const BottomNav = (activeTab) => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'] || {};

  const navItems = [
    { 
      id: "home", 
      icon: "🏠", 
      label: t.navHome || "الرئيسية", 
      action: "window.navigateTo('home')" 
    },
    { 
      id: "maintenance", 
      icon: "🛠️", 
      label: t.navMaintenance || "الصيانة", 
      action: "window.navigateTo('maintenance')" 
    },
    { 
      id: "quality", 
      icon: "📦", 
      label: t.navQuality || "الجودة", 
      action: "window.navigateTo('quality')" 
    },
    { 
      id: "system", 
      icon: "⚙️", 
      label: t.navSystem || "النظام", 
      action: "window.navigateTo('system')" 
    }
  ];

  return `
    <div class="md:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto
                bg-[#0F172A]/95 backdrop-blur-2xl border border-slate-800
                rounded-2xl flex justify-between items-center p-1.5 px-2
                shadow-2xl z-50 transition-all duration-300">

      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        return `
          <button
            type="button"
            onclick="${item.action}"
            class="flex flex-col items-center justify-center flex-1 h-13 py-1 rounded-xl cursor-pointer transition-all duration-200 active:scale-90 ${
              isActive
                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/40'
                : 'text-slate-400 hover:text-slate-200 opacity-85'
            }">
            <span class="text-lg leading-none">${item.icon}</span>
            <span class="text-[10px] mt-1 font-bold tracking-tight whitespace-nowrap">${item.label}</span>
          </button>
        `;
      }).join("")}

    </div>
  `;
};
