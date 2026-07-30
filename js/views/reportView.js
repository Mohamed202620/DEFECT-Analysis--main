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

export const ReportView = () => FormPage('🚨 تسجيل بلاغ عطل جديد', ReportFormFields(), 'تم إرسال البلاغ بنجاح #1024 ✅');