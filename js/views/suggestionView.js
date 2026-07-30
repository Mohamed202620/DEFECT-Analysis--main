export const SuggestionView = () => PageView(
  '💡 المقترحات والتحسينات', 
  `<div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3">
    <label class="block text-xs font-bold opacity-70 text-white">عنوان المقترح / الفكرة</label>
    <input type="text" placeholder="أدخل عنوان المقترح..." class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white">
    
    <label class="block text-xs font-bold opacity-70 text-white">تفاصيل المقترح</label>
    <textarea placeholder="اكتب تفاصيل مقترحك لتطوير بيئة العمل أو النظام..." class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-28"></textarea>
    
    <button onclick="alert('شكرًا لمشاركتك! تم إرسال المقترح بنجاح ✅'); navigateTo('home');" class="w-full p-3 bg-blue-600 rounded-lg font-bold text-xs text-white active:scale-95 transition">
      إرسال المقترح 🚀
    </button>
  </div>`
);