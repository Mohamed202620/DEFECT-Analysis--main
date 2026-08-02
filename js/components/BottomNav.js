export const BottomNav = (activeTab) => {
  const navItems = [
    { id: "home", icon: "🏠", label: "الرئيسية" },
    { id: "maintenance", icon: "🛠️", label: "الصيانة" },
    { id: "quality", icon: "📦", label: "الجودة" },
    { id: "system", icon: "⚙️", label: "النظام" }
  ];

  return `
    <div class="fixed bottom-4 left-4 right-4
                bg-[#1E293B]/95 backdrop-blur-xl
                border border-gray-700
                rounded-3xl
                flex justify-around items-center
                p-2
                shadow-xl
                z-50">

      ${navItems.map(item => `
        <div
          onclick="window.navigateTo('${item.id}')"
          class="flex flex-col items-center justify-center
                 w-16 h-16 rounded-2xl
                 cursor-pointer transition
                 ${activeTab === item.id
                    ? 'bg-blue-600 text-white scale-105'
                    : 'text-gray-300 hover:bg-gray-700'}">

            <div class="text-2xl">${item.icon}</div>
            <span class="text-[10px] mt-1">${item.label}</span>
        </div>
      `).join("")}

    </div>
  `;
};
