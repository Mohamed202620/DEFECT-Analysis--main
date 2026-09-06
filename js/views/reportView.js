export const ReportFormFields = (isEn) => `
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70 text-gray-300">
      ${isEn ? 'Machine / Equipment' : 'المعدة / الماكينة'} <span class="text-red-400">*</span>
    </label>
    <select class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors" required>
      <option value="" disabled selected>${isEn ? 'Select Machine...' : 'اختر الماكينة...'}</option>
      <option value="machine2">${isEn ? 'Machine 2' : 'ماكينة 2'}</option>
      <option value="line1">${isEn ? 'Coating Line 1' : 'خط الدهان 1'}</option>
      <option value="press4">${isEn ? 'Press 4' : 'مكبس 4'}</option>
    </select>
  </div>
  
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70 text-gray-300">
      ${isEn ? 'Issue Type' : 'نوع العطل'} <span class="text-red-400">*</span>
    </label>
    <select class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors" required>
      <option value="" disabled selected>${isEn ? 'Select Type...' : 'اختر النوع...'}</option>
      <option value="mechanical">${isEn ? 'Mechanical' : 'ميكانيكي'}</option>
      <option value="electrical">${isEn ? 'Electrical' : 'كهربائي'}</option>
      <option value="software">${isEn ? 'Software / Control' : 'برمجي / كنترول'}</option>
    </select>
  </div>
  
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70 text-gray-300">
      ${isEn ? 'Issue Description' : 'وصف العطل'} <span class="text-red-400">*</span>
    </label>
    <textarea placeholder="${isEn ? 'Enter defect details and notes...' : 'أدخل تفاصيل العطل والملاحظات...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-24 focus:outline-none focus:border-blue-500 transition-colors resize-none" required></textarea>
  </div>
`;

export const ReportView = () => {
  const isEn = window.currentLang === 'en';

  window.handleReportSubmit = (event) => {
    event.preventDefault();
    alert(isEn ? 'Report submitted successfully #1024 ✅' : 'تم إرسال البلاغ بنجاح #1024 ✅');
    window.goBack('maintenance');
  };

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-16">
    <!-- زر الرجوع -->
    <button onclick="window.goBack('maintenance')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>
    
    <!-- العنوان -->
    <div class="mb-5">
      <h2 class="text-lg font-bold text-red-400 flex items-center gap-2">
        <span>🚨</span> ${isEn ? 'Log New Breakdown' : 'تسجيل بلاغ عطل جديد'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Report an unexpected stop or equipment failure' : 'الإبلاغ عن توقف مفاجئ أو خلل في المعدة'}
      </p>
    </div>
    
    <!-- النموذج -->
    <form onsubmit="window.handleReportSubmit(event)" class="bg-[#1E293B] p-5 rounded-xl border border-gray-800 space-y-4 shadow-lg">
      ${ReportFormFields(isEn)}
      
      <button type="submit" class="w-full p-3 mt-4 bg-red-600 hover:bg-red-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20">
        <span>${isEn ? 'Save & Submit ✅' : 'حفظ وإرسال ✅'}</span>
      </button>
    </form>
  </div>
  `;
};
