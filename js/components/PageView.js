export function PageView(title, content, currentLang = window.currentLang || "ar", backTarget = "home") {
    const isEn = currentLang === "en";

    // إصلاح (بند 5): بعض الصفحات (زي "الإعدادات") بيوصلها المستخدم
    // فقط من صفحة "النظام"، فزرار الرجوع بقى يرجّعه لصفحة النظام
    // نفسها بدل ما يقفز دايماً للرئيسية ويفقد السياق اللي كان فيه.
    // باقي الصفحات (اللي مالهاش علاقة بالنظام) فضلت بترجع للرئيسية
    // زي ما كانت بالظبط (backTarget الافتراضي = "home")
    const backArrow = isEn ? "←" : "→";
    const backLabel = {
        home: isEn ? "Back Home" : "رجوع للرئيسية",
        system: isEn ? "Back" : "رجوع"
    }[backTarget] || (isEn ? "Back" : "رجوع");

    return `
    <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-24 sm:pb-20">
        <!-- زر الرجوع -->
        <button
            type="button"
            onclick="window.goBack('${backTarget}')"
            class="mb-4 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm min-h-[38px] cursor-pointer">
            <span class="text-amber-400 font-black">${backArrow}</span>
            <span>${backLabel}</span>
        </button>

        <!-- عنوان الصفحة -->
        <h2 class="text-lg font-bold mb-5 text-blue-400 border-b border-gray-800 pb-2">
            ${title}
        </h2>

        <!-- محتوى الصفحة الديناميكي -->
        <div class="animate-fade-in">
            ${content}
        </div>
    </div>
    `;
}
