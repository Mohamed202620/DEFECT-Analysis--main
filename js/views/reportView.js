export const ReportFormFields = () => `
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70">المعدة / الماكينة</label>
    <select class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
      <option value="">اختر الماكينة...</option>
      <option>ماكينة 2</option>
      <option>خط الدهان 1</option>
      <option>مكبس 4</option>
    </select>
  </div>
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70">نوع العطل</label>
    <select class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white">
      <option>ميكانيكي</option>
      <option>كهربائي</option>
      <option>برمجي / كنترول</option>
    </select>
  </div>
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70">وصف العطل</label>
    <textarea placeholder="أدخل تفاصيل العطل والملاحظات..." class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white h-24" required></textarea>
  </div>
`;

export const ReportView = () => `
  <div class="p-4 max-w-md mx-auto">
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
      ⬅️ ${window.currentLang === 'en' ? 'Back Home' : 'رجوع للرئيسية'}
    </button>
    <h2 class="text-base font-bold mb-4 text-blue-400">🚨 تسجيل بلاغ عطل جديد</h2>
    
    <form onsubmit="alert('تم إرسال البلاغ بنجاح #1024 ✅'); window.navigateTo('home'); return false;" class="space-y-4">
      ${ReportFormFields()}
      <button type="submit" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-xs text-white transition">
        حفظ وإرسال ✅
      </button>
    </form>
  </div>
`;