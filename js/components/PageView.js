export function PageView(title, content, currentLang = "ar") {
    return `
    <div class="p-4 max-w-md mx-auto">
        <button
            onclick="window.navigateTo('home')"
            class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
            ⬅️ ${currentLang === "ar" ? "رجوع للرئيسية" : "Back Home"}
        </button>

        <h2 class="text-base font-bold mb-4 text-blue-400">
            ${title}
        </h2>

        ${content}
    </div>
    `;
}
