// js/views/suggestionView.js
const SuggestionViewModule = {
  render: () => `
    <div class="p-4 max-w-md mx-auto space-y-4">
      <button onclick="navigateTo('home')" class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">⬅️ رجوع</button>
      <h2 class="text-base font-bold text-blue-400">💡 تسجيل اقتراح تطوير جديد</h2>
      
      <form onsubmit="SuggestionViewModule.handleSubmit(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">الماكينة / القسم</label>
          <select id="sugMachine" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="">اختر الماكينة...</option>
            <option value="Bodymaker 1">Bodymaker 1</option>
            <option value="Necker">Necker</option>
            <option value="Decorator">Decorator</option>
            <option value="عام / خط الإنتاج">عام / خط الإنتاج</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">عنوان الاقتراح *</label>
          <input id="sugTitle" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required />
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">وصف الاقتراح التفصيلي *</label>
          <textarea id="sugDesc" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white h-20" required></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">الفائدة المتوقعة (إنتاجية / سلامة / جودة) *</label>
          <input id="sugBenefit" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required />
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">صورة توضيحية (اختياري)</label>
          <input id="sugImg" type="file" accept="image/*" class="w-full text-xs text-gray-400 bg-[#1E293B] p-2 rounded-lg border border-gray-700" />
        </div>

        <button type="submit" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-xs text-white transition">
          إرسال الاقتراح 💡
        </button>
      </form>
    </div>
  `,

  handleSubmit: async (e) => {
    e.preventDefault();
    alert('تم إرسال الاقتراح بنجاح لقسم التطوير والصيانة ✅');
    navigateTo('home');
  }
};