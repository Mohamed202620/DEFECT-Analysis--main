export const PMFormFields = (isEn) => `
  <div>
    <label class="block text-xs font-bold mb-1 opacity-70 text-gray-300">
      ${isEn ? 'Machine Name' : 'اسم الماكينة'} <span class="text-red-400">*</span>
    </label>
    <select id="pmMachine" required class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
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
        <input id="pmCheckHydraulic" type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Check Hydraulic Pressure' : 'فحص ضغط الهيدروليك'}</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input id="pmCheckFilters" type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Clean Filters & Cooling System' : 'تنظيف الفلاتر ونظام التبريد'}</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input id="pmCheckLubrication" type="checkbox" required class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50 cursor-pointer"> 
        <span class="group-hover:text-blue-400 transition-colors">${isEn ? 'Periodic Lubrication & Greasing' : 'التشحيم والتزييت الدوري'}</span>
      </label>
    </div>
  </div>

  <div>
    <label class="block text-xs font-bold text-gray-300 mb-1 opacity-70">
      ${isEn ? 'Notes / Observations' : 'ملاحظات / مشاهدات'}
    </label>
    <textarea id="pmNotes" placeholder="${isEn ? 'Any abnormal sounds or leaks?' : 'هل يوجد أصوات غير طبيعية أو تسريبات؟'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-16 focus:outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
  </div>
`;

window.loadPmHistory = async function () {

  const container = document.getElementById('pmHistoryContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>`;

  const { fetchPmRecordsApi } = await import('../services/api.js');
  const result = await fetchPmRecordsApi();

  if (!result || result.status !== 'success') {
    container.innerHTML = `<div class="text-center text-red-400 text-[11px] py-4">${result?.message || 'فشل تحميل السجل'}</div>`;
    return;
  }

  const records = result.data || [];

  if (!records.length) {
    container.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">لا توجد سجلات صيانة وقائية بعد.</div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const checklistDone = Object.values(r.checklist || {}).filter(Boolean).length;
    const checklistTotal = Object.keys(r.checklist || {}).length;
    return `
      <div class="bg-[#0E1117] border border-gray-800 rounded-xl p-3 mb-2">
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-gray-100">${r.machine || '-'}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            ${checklistDone}/${checklistTotal} ✓
          </span>
        </div>
        ${r.notes ? `<p class="text-[11px] text-gray-400 mt-1">${r.notes}</p>` : ''}
        <div class="flex justify-between items-center mt-1 text-[10px] text-gray-500">
          <span>👤 ${r.reporter?.name || '-'}</span>
          <span>${r.createdAt ? new Date(r.createdAt).toLocaleString('ar-EG') : ''}</span>
        </div>
      </div>
    `;
  }).join('');

};

export const PMView = () => {
  const isEn = window.currentLang === 'en';
  
  // معالجة الإرسال - حفظ فعلي في Firestore (مجموعة pmRecords)
  window.handlePMSubmit = async (event) => {
    event.preventDefault();

    const submitBtn = event.target?.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';

    const payload = {
      machine: document.getElementById('pmMachine')?.value || '',
      checklist: {
        hydraulic: !!document.getElementById('pmCheckHydraulic')?.checked,
        filters: !!document.getElementById('pmCheckFilters')?.checked,
        lubrication: !!document.getElementById('pmCheckLubrication')?.checked
      },
      notes: document.getElementById('pmNotes')?.value?.trim() || '',
      reporter: {
        name: localStorage.getItem('name') || '',
        job: localStorage.getItem('job') || '',
        department: localStorage.getItem('department') || '',
        shift: localStorage.getItem('shift') || ''
      }
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = isEn ? 'Saving...' : 'جاري الحفظ...';
    }

    try {
      const { savePmApi } = await import('../services/api.js');
      const result = await savePmApi(payload);

      if (result.status === 'success') {
        alert(isEn ? 'PM form saved successfully ✅' : 'تم حفظ نموذج الصيانة الوقائية بنجاح ✅');
        window.navigateTo('maintenance');
      } else {
        alert((isEn ? 'Error: ' : 'خطأ: ') + (result.message || (isEn ? 'Failed to save' : 'فشل الحفظ')));
      }
    } catch (err) {
      alert((isEn ? 'Connection error: ' : 'خطأ في الاتصال: ') + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
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

    <!-- سجل الصيانة الوقائية -->
    <div class="mt-6">
      <h3 class="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1">
        <span>📜</span> ${isEn ? 'PM History' : 'سجل الصيانة الوقائية'}
      </h3>
      <div id="pmHistoryContainer">
        <div class="text-center text-gray-500 text-[11px] py-4">${isEn ? 'Loading...' : 'جاري التحميل...'}</div>
      </div>
    </div>
  </div>
  `;
};
