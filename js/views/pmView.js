export const PMFormFields = () => `
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70">اسم الماكينة</label>
    <select class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white">
      <option>خط الدهان 1</option>
      <option>ماكينة 2</option>
    </select>
  </div>
  <div>
    <label class="block text-xs font-bold mb-2 opacity-70">قائمة الفحص والتأكيد</label>
    <div class="bg-[#1E293B] p-3 rounded-lg border border-gray-700 space-y-2 text-xs">
      <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" required> فحص ضغط الهيدروليك</label>
      <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" required> تنظيف الفلاتر ونظام التبريد</label>
      <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" required> التشحيم والتزييت الدوري</label>
    </div>
  </div>
`;

export const PMView = () => `
  <div class="p-4 max-w-md mx-auto">
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
      ⬅️ ${window.currentLang === 'en' ? 'Back Home' : 'رجوع للرئيسية'}
    </button>
    <h2 class="text-base font-bold mb-4 text-blue-400">📝 تسجيل صيانة وقائية (PM)</h2>
    
    <form onsubmit="alert('تم حفظ نموذج PM بنجاح ✅'); window.navigateTo('home'); return false;" class="space-y-4">
      ${PMFormFields()}
      <button type="submit" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-xs text-white transition">
        حفظ وإرسال ✅
      </button>
    </form>
  </div>
`;