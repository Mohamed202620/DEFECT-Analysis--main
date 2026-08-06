export function PageView(title, content, currentLang = window.currentLang || "ar") {
    const isEn = currentLang === "en";

    return `
    <div class="p-4 max-w-md mx-auto pb-12">
        <!-- زر الرجوع -->
        <button
            onclick="window.navigateTo('home')"
            class="mb-5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
            <span>${isEn ? '← Back Home' : '← رجوع للرئيسية'}</span>
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
