// js/views/pmView.js
const PMViewModule = {
  render: () => `
    <div class="p-4 max-w-md mx-auto space-y-4">
      <button onclick="navigateTo('home')" class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">⬅️ رجوع</button>
      <h2 class="text-base font-bold text-blue-400">🛠️ جدول الصيانة الوقائية (PM)</h2>

      <!-- التنبيه بالاعطال المتكررة التحويل لـ PM -->
      <div class="bg-[#1E293B] p-3 rounded-xl border border-orange-500/40 text-xs space-y-2">
        <div class="font-bold text-orange-400">⚡ الأعطال المتكررة المقترحة للتحويل إلى PM</div>
        <div class="text-gray-300">ماكينة Bodymaker 1 (تكرر عطل الحرارة 4 مرات هذا الأسبوع)</div>
        <button onclick="PMViewModule.createAutoPM('Bodymaker 1', 'عطل حرارة متكرر')" class="w-full py-1.5 bg-orange-600 rounded text-white font-bold text-[11px]">
          تحويل تلقائي إلى خطة PM 🛠️
        </button>
      </div>

      <div class="bg-[#1E293B] p-3 rounded-xl border border-gray-700 text-xs">
        <div class="font-bold mb-2 text-white">تسجيل صيانة وقائية دورية</div>
        <select id="pmMachine" class="w-full p-2 rounded bg-[#0E1117] text-white border border-gray-700 mb-2">
          <option>Bodymaker 1</option>
          <option>Necker</option>
        </select>
        <div class="space-y-1.5 mb-3 text-gray-300">
          <label class="flex items-center gap-2"><input type="checkbox" checked /> فحص منسوب الزيت والضغط</label>
          <label class="flex items-center gap-2"><input type="checkbox" /> تنظيف وإزالة الرواسب</label>
          <label class="flex items-center gap-2"><input type="checkbox" /> معايرة الحساسات</label>
        </div>
        <button onclick="alert('تم حفظ نموذج PM ✅')" class="w-full p-2 bg-green-600 font-bold rounded text-white">إتمام ورشة PM</button>
      </div>
    </div>
  `,

  createAutoPM: (machine, reason) => {
    alert(`تم إنشاء مهمة صيانة وقائية جديدة للماكينة ${machine} بناءً على سجل الأعطال المتكررة.`);
    navigateTo('home');
  }
};