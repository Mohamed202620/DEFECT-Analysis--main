export const PMFormFields = (isEn) => `
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70 text-gray-300">
      ${isEn ? 'Machine Name' : 'اسم الماكينة'} <span class="text-red-400">*</span>
    </label>
    <select required class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
      <option value="" disabled selected>${isEn ? 'Select Machine...' : 'اختر الماكينة...'}</option>
      <option value="line1">${isEn ? 'Coating Line 1' : 'خط الدهان 1'}</option>
      <option value="machine2">${isEn ? 'Machine 2' : 'ماكينة 2'}</option>
    </select>
  </div>
  
  <div>
    <label class="block text-xs font-bold mb-2 opacity-70 text-gray-300">
      ${isEn ? 'Inspection & Verification Checklist' : 'قائمة الفحص والتأكيد'} <span class="text-red-400">*</span>
    </label>
    <div class="bg-[#0E1117] p-4 rounded-lg border border-gray-700 space-y-3 text-xs text-gray-200">
      <label class="flex items-center gap-3 cursor-pointer group">
        <input type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Check Hydraulic Pressure' : 'فحص ضغط الهيدروليك'}</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Clean Filters & Cooling System' : 'تنظيف الفلاتر ونظام التبريد'}</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Periodic Lubrication & Greasing' : 'التشحيم والتزييت الدوري'}</span>
      </label>
    </div>
  </div>

  <div>
    <label class="block text-xs font-bold text-gray-300 mb-1 opacity-70">
      ${isEn ? 'Notes / Observations' : 'ملاحظات / مشاهدات'}
    </label>
    <textarea placeholder="${isEn ? 'Any abnormal sounds or leaks?' : 'هل يوجد أصوات غير طبيعية أو تسريبات؟'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-16 focus:outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
  </div>
`;

export const PMView = () => {
  const isEn = window.currentLang === 'en';
  
  // معالجة الإرسال
  window.handlePMSubmit = (event) => {
    event.preventDefault();
    alert(isEn ? 'PM form saved successfully ✅' : 'تم حفظ نموذج الصيانة الوقائية بنجاح ✅');
    window.navigateTo('maintenance'); 
  };

  return `
  <div class="p-4 max-w-md mx-auto pb-10">
    <!-- زر الرجوع -->
    <button onclick="window.navigateTo('maintenance')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>
    
    <!-- العنوان -->
    <div class="mb-5">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">
        <span>📝</span> ${isEn ? 'Preventive Maintenance (PM)' : 'تسجيل صيانة وقائية (PM)'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Routine equipment check and service logs' : 'سجل الفحوصات الدورية وصيانة المعدات'}
      </p>
    </div>
    
    <!-- النموذج -->
    <form onsubmit="window.handlePMSubmit(event)" class="bg-[#1E293B] p-5 rounded-xl border border-gray-800 space-y-4 shadow-lg">
      ${PMFormFields(isEn)}
      
      <button type="submit" class="w-full p-3 mt-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
        <span>${isEn ? 'Save & Submit ✅' : 'حفظ وإرسال ✅'}</span>
      </button>
    </form>
  </div>
  `;
};
