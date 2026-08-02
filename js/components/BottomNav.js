export const BottomNav = (activeTab) => {
  // قائمة الأقسام
  const navItems = [
    { id: 'home', icon: '🏠', label: 'الرئيسية' },
    { id: 'maintenance', icon: '🛠️', label: 'الصيانة' },
    { id: 'quality', icon: '📦', label: 'الجودة' },
    { id: 'system', icon: '⚙️', label: 'النظام' }
  ];

  return `
    <div class="fixed bottom-4 left-4 right-4 bg-[#0E1117]/90 backdrop-blur-xl border border-white/10 rounded-3xl flex justify-around items-center p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50">
      ${navItems.map(item => {
        const isActive = activeTab === item.id;
        // تنسيقات الزر النشط (Active) مقابل الزر العادي
        const activeContainerClass = isActive ? 'bg-blue-500/20 border-blue-500/30 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-transparent hover:bg-white/5 hover:scale-105 opacity-70';
        const activeIconClass = isActive ? 'text-3xl drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-2xl';
        const activeTextClass = isActive ? 'text-blue-300 font-bold' : 'text-gray-400 font-medium';

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
