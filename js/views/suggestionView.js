export const SuggestionView = () => `
  <div class="p-4 max-w-md mx-auto">
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
      ⬅️ ${window.currentLang === 'en' ? 'Back Home' : 'رجوع للرئيسية'}
    </button>
    
    <h2 class="text-base font-bold mb-4 text-blue-400">💡 المقترحات والتحسينات</h2>
    
    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3">
      <label class="block text-xs font-bold opacity-70 text-white">عنوان المقترح / الفكرة</label>
      <input type="text" placeholder="أدخل عنوان المقترح..." class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white">
      
      <label class="block text-xs font-bold opacity-70 text-white">تفاصيل المقترح</label>
      <textarea placeholder="اكتب تفاصيل مقترحك لتطوير بيئة العمل أو النظام..." class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-28"></textarea>
      
      <button onclick="alert('شكرًا لمشاركتك! تم إرسال المقترح بنجاح ✅'); window.navigateTo('home');" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg font-bold text-xs text-white transition">
        إرسال المقترح 🚀
      </button>
    </div>
  </div>
`;