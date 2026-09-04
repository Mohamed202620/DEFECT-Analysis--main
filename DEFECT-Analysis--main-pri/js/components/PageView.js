export function PageView(title, content, currentLang = window.currentLang || "ar", backTarget = "home") {
    const isEn = currentLang === "en";

    // إصلاح (بند 5): بعض الصفحات (زي "الإعدادات") بيوصلها المستخدم
    // فقط من صفحة "النظام"، فزرار الرجوع بقى يرجّعه لصفحة النظام
    // نفسها بدل ما يقفز دايماً للرئيسية ويفقد السياق اللي كان فيه.
    // باقي الصفحات (اللي مالهاش علاقة بالنظام) فضلت بترجع للرئيسية
    // زي ما كانت بالظبط (backTarget الافتراضي = "home")
    const backLabel = {
        home: isEn ? "← Back Home" : "← رجوع للرئيسية",
        system: isEn ? "← Back" : "← رجوع"
    }[backTarget] || (isEn ? "← Back" : "← رجوع");

    return `
    <div class="app-page p-4 max-w-md mx-auto pb-12">
        <!-- زر الرجوع -->
        <button
            onclick="window.goBack('${backTarget}')"
            class="mb-5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
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
