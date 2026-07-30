import { CONFIG } from '../config.js';

export const ReportViewModule = {
  render: () => `
    <div class="p-4 max-w-md mx-auto space-y-4">
      <button onclick="navigateTo('home')" class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">⬅️ رجوع</button>
      <h2 class="text-base font-bold text-blue-400">🚨 تسجيل عطل أو ملاحظة جديدة</h2>
      
      <form onsubmit="ReportViewModule.submitForm(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">الشيفت الحالي *</label>
          <select id="shift" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="Green">Green Shift</option>
            <option value="Blue">Blue Shift</option>
            <option value="Red">Red Shift</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">المعدة / الماكينة *</label>
          <select id="machine" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="">اختر الماكينة...</option>
            <option value="Bodymaker 1">Bodymaker 1</option>
            <option value="Bodymaker 2">Bodymaker 2</option>
            <option value="Necker">Necker</option>
            <option value="Decorator">Decorator</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">نوع العطل *</label>
          <select id="type" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="ميكانيكي">ميكانيكي</option>
            <option value="كهربائي">كهربائي</option>
            <option value="برمجي / كنترول">برمجي / كنترول</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">وصف العطل *</label>
          <textarea id="desc" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white h-20" required></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">اقتراح الحل (اختياري)</label>
          <input id="solution" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" />
        </div>

        <button type="submit" class="w-full p-3 bg-blue-600 rounded-xl font-bold text-xs text-white">حفظ وإرسال ✅</button>
      </form>
    </div>
  `,

  submitForm: async (e) => {
    e.preventDefault();
    alert('تم إرسال البلاغ بنجاح ✅');
    navigateTo('home');
  }
};
