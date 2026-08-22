// ============================================================
// LanguageToggle.js
// زر تبديل اللغة (عربي/إنجليزي) - عنصر عائم ثابت، متاح من أول
// صفحة (تسجيل الدخول) بدون حاجة لتسجيل الدخول (بعكس جرس
// الإشعارات اللي بيتفعّل بعد الدخول فقط)
// ============================================================

function buttonHtml(lang) {
  return `
    <button id="languageToggleBtn"
      onclick="window.toggleLanguage()"
      class="fixed top-4 right-4 z-40 bg-[#1E293B] border border-gray-700 shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-xs font-bold text-gray-200 active:scale-95 transition-all">
      ${lang === 'ar' ? 'EN' : 'ع'}
    </button>
  `;
}

if (!document.getElementById('languageToggleBtn')) {
  document.body.insertAdjacentHTML('beforeend', buttonHtml(window.currentLang || 'ar'));
}

/**
 * تحديث نص الزر نفسه - الزر برّه حاوية #app اللي بتتغيّر مع كل
 * render()، فمحتاج يتحدّث بشكل مستقل عند تبديل اللغة (راجع
 * window.toggleLanguage في renderCore.js)
 */
window.refreshLanguageToggleLabel = function () {
  const btn = document.getElementById('languageToggleBtn');
  if (btn) btn.textContent = window.currentLang === 'ar' ? 'EN' : 'ع';
};
