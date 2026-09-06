import { getErrorScannerMachineOptions } from '../errorScanner.js';
import { translations } from '../config.js';

export const ErrorScannerView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).errorScanner;
  const common = (translations[currentLang] || translations.ar).common;

  // إصلاح (بند حرج - Machine Access حسب Role/Work Area): القائمة دلوقتي
  // مفلترة حسب قسم المستخدم من مصدرها (getErrorScannerMachineOptions ->
  // getMachineTypeEntries في machines.js) - لو رجعت فاضية (مفيش ماكينة
  // ضمن قسم المستخدم)، نعرض رسالة واضحة بدل قائمة فاضية تماماً
  const scannerMachineOptions = getErrorScannerMachineOptions();

  // التحقق من صحة القيمة المحفوظة: إذا كانت القيمة المخزنة غير متوفرة ضمن خيارات المستخدم الحالية، تُفرغ لتجنب تصفية وهمية
  const rawSavedMachine = localStorage.getItem('selectedMachineType') || '';
  const selectedMachineType = scannerMachineOptions.includes(rawSavedMachine) ? rawSavedMachine : '';
  window.selectedMachineType = selectedMachineType;
  if (!selectedMachineType && rawSavedMachine) {
    localStorage.removeItem('selectedMachineType');
  }

  const machineOptionsHtml = scannerMachineOptions.length === 0
    ? `<option value="" selected disabled>${
        currentLang === 'en'
          ? 'No machines available for your work area'
          : 'لا توجد ماكينات متاحة ضمن قسمك الحالي'
      }</option>`
    : [
        `<option value="" ${selectedMachineType === '' ? 'selected' : ''}>${t.selectMachine || (currentLang === 'en' ? 'Select machine type...' : 'اختر نوع الماكينة...')}</option>`,
        ...scannerMachineOptions.map((machine) =>
          `<option value="${machine}" ${selectedMachineType === machine ? 'selected' : ''}>${machine}</option>`
        )
      ].join('');

  return `
<div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع والعنوان -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick="window.goBack('maintenance')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180">‹</span>
        <span class="text-xs text-slate-200">${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}</span>
      </button>
      <div>
        <h2 class="text-base font-black text-indigo-400 flex items-center gap-2">
          <span>🔎</span> ${t.title || (currentLang === 'en' ? 'Machine Error Scanner' : 'فاحص شاشات وأكواد الأعطال')}
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
      </div>
    </div>
  </div>

  <!-- بطاقة النموذج الرئيسية -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <!-- اختيار نوع الماكينة: يتم حفظه محلياً للاستخدام لاحقاً -->
    <div>
      <label for="machineTypeSelect" class="mb-2 flex items-center gap-2 text-xs font-bold text-gray-300">
        <span class="text-xs" aria-hidden="true">🏭</span>
        <span>${t.machineType || (currentLang === 'en' ? 'Machine Type' : 'نوع الماكينة')}</span>
      </label>
      <select id="machineTypeSelect"
        aria-label="${t.machineType || (currentLang === 'en' ? 'Machine Type' : 'نوع الماكينة')}"
        onchange="const value = this.value; if(value) { localStorage.setItem('selectedMachineType', value); } else { localStorage.removeItem('selectedMachineType'); } window.selectedMachineType = value;"
        class="w-full p-3 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-inner cursor-pointer">
        ${machineOptionsHtml}
      </select>
    </div>

    <!-- التقاط الصورة -->
    <div class="grid grid-cols-2 gap-3">
      <input id="errScanCamera" type="file" accept="image/*" capture="environment" class="hidden">
      <button type="button"
        onclick="document.getElementById('errScanCamera').click()"
        class="bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600/30 rounded-xl p-3 text-indigo-300 font-black transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2 cursor-pointer">
        <span>📷</span> ${t.captureBtn || (currentLang === 'en' ? 'Camera' : 'الكاميرا')}
      </button>

      <input id="errScanGallery" type="file" accept="image/*" class="hidden">
      <button type="button"
        onclick="document.getElementById('errScanGallery').click()"
        class="bg-gray-700/50 border border-gray-600 hover:bg-gray-700 rounded-xl p-3 text-gray-300 font-black transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2 cursor-pointer">
        <span>🖼️</span> ${t.galleryBtn || (currentLang === 'en' ? 'Gallery' : 'المعرض')}
      </button>
    </div>

    <img id="errScanPreview" class="hidden rounded-xl border border-gray-700 w-full max-h-56 object-contain bg-[#0F172A] p-1 shadow-sm"/>

    <div id="errScanStatus" class="text-[11px] text-blue-400 text-center min-h-[16px] font-medium">
      ${t.readyStatus || ''}
    </div>

    <!-- كود العطل -->
    <div>
      <label for="errScanCode" class="block mb-2 text-xs font-bold text-gray-300">
        ${t.errorCode || (currentLang === 'en' ? 'Error Code' : 'كود العطل')}
      </label>
      <input id="errScanCode" type="text"
        placeholder="${t.errorCodePlaceholder || ''}"
        class="w-full p-3 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-inner">
    </div>

    <!-- النص/الرسالة المستخرجة -->
    <div>
      <label for="errScanMessage" class="block mb-2 text-xs font-bold text-gray-300">
        ${t.errorMessage || (currentLang === 'en' ? 'Error Message / Description' : 'رسالة أو وصف العطل')}
      </label>
      <textarea id="errScanMessage" rows="3"
        placeholder="${t.errorMessagePlaceholder || ''}"
        class="w-full p-3 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm resize-none shadow-inner"></textarea>
    </div>

    <div>
      <label for="errScanManual" class="block mb-2 text-xs font-bold text-gray-300">
        ${t.manualSearch || (currentLang === 'en' ? 'Manual Search' : 'بحث يدوي')}
      </label>
      <input id="errScanManual" type="text"
        placeholder="${t.manualPlaceholder || ''}"
        class="w-full p-3 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-indigo-500 transition text-sm shadow-inner" />
    </div>

    <button type="button"
      onclick="window.searchMachineError()"
      class="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-xl font-black text-white text-sm transition-all duration-150 active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center justify-center gap-2">
      <span>🔍</span>
      <span>${t.searchBtn || (currentLang === 'en' ? 'Search Database' : 'بحث في قاعدة الأعطال')}</span>
    </button>

    <!-- نتائج البحث / نموذج إضافة عطل جديد -->
    <div id="errorScanResults"></div>

  </div>
</div>
`;
};
