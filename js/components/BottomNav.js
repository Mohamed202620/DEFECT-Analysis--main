export const BottomNav = (active = "home") => `
<div class="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-gray-700 shadow-lg z-50">
    <div class="grid grid-cols-4 text-center">

        <button onclick="window.navigateTo('home')"
            class="py-3 ${active === "home" ? "text-blue-400" : "text-gray-400"}">
            <div>🏠</div>
            <div class="text-[11px]">الرئيسية</div>
        </button>

        <button onclick="window.navigateTo('maintenance')"
            class="py-3 ${active === "maintenance" ? "text-blue-400" : "text-gray-400"}">
            <div>🛠️</div>
            <div class="text-[11px]">الصيانة</div>
        </button>

        <button onclick="window.navigateTo('quality')"
            class="py-3 ${active === "quality" ? "text-blue-400" : "text-gray-400"}">
            <div>📦</div>
            <div class="text-[11px]">الجودة</div>
        </button>

        <button onclick="window.navigateTo('system')"
            class="py-3 ${active === "system" ? "text-blue-400" : "text-gray-400"}">
            <div>⚙️</div>
            <div class="text-[11px]">النظام</div>
        </button>

    </div>
</div>
`;
