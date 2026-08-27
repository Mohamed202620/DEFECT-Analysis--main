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
    <div class="md:hidden fixed bottom-4 left-4 right-4 max-w-md mx-auto
                dyn-card backdrop-blur-xl border
                rounded-3xl flex justify-between items-center p-2 px-3
                shadow-2xl z-50 transition-all duration-300">

      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        return `
          <button
            type="button"
            onclick="${item.action}"
            class="flex flex-col items-center justify-center flex-1 h-12 rounded-2xl cursor-pointer transition-all duration-200 active:scale-95 ${
              isActive
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-105'
                : 'dyn-text-muted hover:opacity-100 opacity-70'
            }">
            <span class="text-lg leading-none">${item.icon}</span>
            <span class="text-[9px] mt-1 font-medium truncate max-w-[50px]">${item.label}</span>
          </button>
        `;
      }).join("")}

    </div>
  `;
};
