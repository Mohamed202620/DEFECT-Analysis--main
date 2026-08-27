import { buildMachineOptionsHtml } from '../machines.js';

export const ErrorScannerView = () => {
  const selectedMachineType = localStorage.getItem('selectedMachineType') || '';
  window.selectedMachineType = selectedMachineType;

  const machineOptionsHtml = buildMachineOptionsHtml({
    selectedValue: selectedMachineType,
    includePlaceholder: true,
    placeholderLabel: 'اختر نوع الماكينة'
  });

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع -->
  <button
    type="button"
    onclick="window.navigateTo('maintenance')"
    class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold transition active:scale-95 shadow-sm">
    ⬅ رجوع
  </button>

  <!-- بطاقة النموذج الرئيسية -->
  <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <h2 class="text-xl font-bold text-indigo-400 mb-1 flex items-center gap-2">
      <span>🔎</span>
      <span>Machine Error Scanner</span>
    </h2>
    <p class="text-[11px] text-gray-400">
      صوّر الخطأ الظاهر على شاشة الماكينة، وسيتم قراءته والبحث عنه تلقائياً في قاعدة المعرفة.
    </p>

    <!-- اختيار نوع الماكينة: يتم حفظه محلياً للاستخدام لاحقاً -->
    <div>
      <label for="machineTypeSelect" class="mb-2 flex items-center gap-2 text-xs font-bold text-gray-300">
        <span class="text-[10px] text-gray-400">🔒</span>
        <span>نوع الماكينة</span>
      </label>
      <select id="machineTypeSelect"
        onchange="const value = this.value; localStorage.setItem('selectedMachineType', value); window.selectedMachineType = value;"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-sm appearance-none">
        ${machineOptionsHtml}
      </select>
    </div>

    <!-- التقاط الصورة -->
    <div class="grid grid-cols-2 gap-3">
      <input id="errScanCamera" type="file" accept="image/*" capture="environment" class="hidden">
      <button type="button"
        onclick="document.getElementById('errScanCamera').click()"
        class="bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600/30 rounded-xl p-3 text-indigo-300 font-bold transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2">
        <span>📷</span> تصوير الشاشة
      </button>

      <input id="errScanGallery" type="file" accept="image/*" class="hidden">
      <button type="button"
        onclick="document.getElementById('errScanGallery').click()"
        class="bg-gray-700/50 border border-gray-600 hover:bg-gray-700 rounded-xl p-3 text-gray-300 font-bold transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2">
        <span>🖼️</span> من المعرض
      </button>
    </div>

    <img id="errScanPreview" class="hidden rounded-xl border border-gray-700 w-full max-h-56 object-contain bg-[#0F172A] p-1 shadow-sm"/>

    <div id="errScanStatus" class="text-[11px] text-blue-400 text-center min-h-[16px]">
      جاهز لالتقاط صورة شاشة العطل.
    </div>

    <!-- كود العطل -->
    <div>
      <label for="errScanCode" class="block mb-2 text-xs font-bold text-gray-300">
        Error Code
      </label>
      <input id="errScanCode" type="text"
        placeholder="سيتم تعبئته تلقائياً بعد قراءة الصورة، ويمكن تعديله"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-sm">
    </div>

    <!-- النص/الرسالة المستخرجة -->
    <div>
      <label for="errScanMessage" class="block mb-2 text-xs font-bold text-gray-300">
        Error Message (النص المستخرج من الصورة)
      </label>
      <textarea id="errScanMessage" rows="3"
        placeholder="سيظهر هنا النص المستخرج من الصورة تلقائياً"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm resize-none shadow-sm"></textarea>
    </div>

    <div>
      <label for="errScanManual" class="block mb-2 text-xs font-bold text-gray-300">
        أو ابحث يدوياً
      </label>
      <input id="errScanManual" type="text"
        placeholder="اكتب رقم العطل او النص"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-sm" />
    </div>

    <button type="button"
      onclick="window.searchMachineError()"
      class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-base transition active:scale-95 shadow-lg shadow-indigo-500/20">
      🔍 بحث في قاعدة المعرفة
    </button>

    <!-- نتائج البحث / نموذج إضافة عطل جديد -->
    <div id="errorScanResults"></div>

  </div>
</div>
`;
};
