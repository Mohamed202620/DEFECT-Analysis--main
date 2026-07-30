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

export const PMView = () => FormPage('📝 تسجيل صيانة وقائية (PM)', PMFormFields(), 'تم حفظ نموذج PM بنجاح ✅');