export const BottomNav = (activeTab) => {
  const navItems = [
    { id: 'home', icon: '🏠', label: 'الرئيسية' },
    { id: 'maintenance', icon: '🛠️', label: 'الصيانة' },
    { id: 'quality', icon: '📦', label: 'الجودة' },
    { id: 'system', icon: '⚙️', label: 'النظام' }
  ];

  return `
    <style>
      :root {
        --nav-bg: rgba(255, 255, 255, 0.95);
        --nav-border: #e5e7eb;
        --nav-item-hover: #f3f4f6;
        --nav-active-bg: #eff6ff; 
        --nav-active-border: #bfdbfe; 
        --nav-active-text: #1d4ed8; 
        --nav-text: #6b7280;
      }
      .dark, body.dark, .dark-mode, [data-theme="dark"] {
        --nav-bg: rgba(14, 17, 23, 0.95);
        --nav-border: rgba(255, 255, 255, 0.1);
        --nav-item-hover: rgba(255, 255, 255, 0.05);
        --nav-active-bg: rgba(59, 130, 246, 0.2);
        --nav-active-border: rgba(59, 130, 246, 0.3);
        --nav-active-text: #93c5fd; 
        --nav-text: #9ca3af;
      }
      
      .dyn-nav { background-color: var(--nav-bg); border-color: var(--nav-border); }
      .dyn-nav-item { border-color: transparent; color: var(--nav-text); }
      .dyn-nav-item:hover { background-color: var(--nav-item-hover); }
      .dyn-nav-active { background-color: var(--nav-active-bg); border-color: var(--nav-active-border); color: var(--nav-active-text); }
    </style>

    <div class="dyn-nav fixed bottom-4 left-4 right-4 backdrop-blur-xl border rounded-3xl flex justify-around items-center p-2 shadow-lg z-50 transition-colors duration-300">
      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        
        // استخدام الكلاسات المربوطة بالمتغيرات
        const activeContainerClass = isActive ? 'dyn-nav-active scale-110 shadow-sm' : 'dyn-nav-item hover:scale-105';
        const activeIconClass = isActive ? 'text-3xl drop-shadow-sm' : 'text-2xl opacity-80';
        const activeTextClass = isActive ? 'font-bold' : 'font-medium';

        return `
          <div onclick="window.navigateTo('${item.id}')" 
               class="flex flex-col items-center justify-center w-16 h-16 rounded-2xl border cursor-pointer transition-all duration-300 ${activeContainerClass}">
            <div class="transition-all duration-300 mb-1 ${activeIconClass}">${item.icon}</div>
            <span class="text-[10px] ${activeTextClass}">${item.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
};
