export const SuggestionView = () => {
  const isEn = window.currentLang === 'en';

  return `
  <div class="p-4 max-w-lg mx-auto">
    <!-- زر الرجوع -->
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back Home' : '← رجوع للرئيسية'}</span>
    </button>
    
    <!-- العنوان الرئيسي -->
    <div class="mb-4">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">
        <span>💡</span> ${isEn ? 'Kaizen & Continuous Improvement' : 'المقترحات والتحسينات (كايزن)'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Share your ideas to eliminate waste and improve work environment' : 'شارِك بأفكارك لتقليل الهدر وتطوير بيئة العمل'}
      </p>
    </div>
    
    <!-- نموذج الكايزن -->
    <form onsubmit="event.preventDefault(); alert('${isEn ? 'Thank you! Kaizen suggestion submitted successfully ✅' : 'شكرًا لمشاركتك! تم إرسال مقترح الكايزن بنجاح ✅'}'); window.navigateTo('home');" class="bg-[#1E293B] p-5 rounded-xl border border-gray-800 space-y-4 shadow-lg">
      
      <!-- عنوان المقترح -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Suggestion Title / Idea' : 'عنوان المقترح / الفكرة'} <span class="text-red-400">*</span>
        </label>
        <input type="text" required placeholder="${isEn ? 'e.g., Reduce packing time...' : 'مثال: تقليل وقت التغليف...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500">
      </div>

      <!-- تصنيف الكايزن -->
      <div>
      <label class="block mb-2 text-sm font-bold">
رقم الخط <span class="text-red-500">*</span>
</label>

<select
id="suggestionLine"
class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

<option value="">اختر الخط...</option>

<option>Line 1</option>
<option>Line 2</option>

</select>
<label class="block mb-2 text-sm font-bold">
الماكينة <span class="text-red-500">*</span>
</label>

<select
id="suggestionMachine"
class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

<option value="">اختر الماكينة...</option>

<option>Coil Handling</option>
<option>Baler</option>
<option>Cupper</option>
<option>Bodymaker</option>
<option>Trimmer</option>
<option>Washer</option>
<option>Decorator</option>
<option>Spray</option>
<option>IBO</option>
<option>Necker</option>
<option>Palletizer</option>
<option>Depalletizer</option>
<option>Front End Line Control</option>
<option>Mid Line Line Control</option>
<option>Back End Line Control</option>

</select>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Improvement Category' : 'تصنيف التحسين (مجال الكايزن)'} <span class="text-red-400">*</span>
        </label>
        <select required class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500">
          <option value="" disabled selected>${isEn ? 'Select category...' : 'اختر التصنيف...'}</option>
          <option value="productivity">${isEn ? '⏱️ Efficiency & Productivity' : '⏱️ زيادة الإنتاجية والكفاءة'}</option>
          <option value="quality">${isEn ? '🎯 Quality Improvement' : '🎯 تحسين الجودة'}</option>
          <option value="safety">${isEn ? '🛡️ Safety & Health (HSE)' : '🛡️ السلامة والصحة المهنية'}</option>
          <option value="5s">${isEn ? '🧹 Workspace Organization (5S)' : '🧹 تنظيم بيئة العمل (5S)'}</option>
          <option value="cost">${isEn ? '💰 Cost Reduction' : '💰 تقليل التكاليف والهدر'}</option>
        </select>
      </div>
      
      <!-- الوضع الحالي (المشكلة) -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Current Situation (The Problem)' : 'الوضع الحالي (المشكلة / الهدر)'} <span class="text-red-400">*</span>
        </label>
        <textarea required placeholder="${isEn ? 'Describe current problem or waste...' : 'صف المشكلة الحالية أو الهدر الموجود...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-20 focus:outline-none focus:border-blue-500"></textarea>
      </div>

      <!-- الحل المقترح -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Proposed Kaizen Solution' : 'الحل المقترح (طريقة التحسين)'} <span class="text-red-400">*</span>
        </label>
        <textarea required placeholder="${isEn ? 'Describe your proposed solution...' : 'اكتب خطوات الحل أو الفكرة الجديدة...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-20 focus:outline-none focus:border-blue-500"></textarea>
      </div>

      <!-- الأثر المتوقع -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Expected Impact (Optional)' : 'الأثر المتوقع (اختياري)'}
        </label>
        <input type="text" placeholder="${isEn ? 'e.g., Saves 15 mins daily, reduces defects...' : 'مثال: توفير 15 دقيقة يومياً، تقليل الأخطاء...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500">
      </div>

      <!-- مرفقات وصور -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Attach Photo / File (Optional)' : 'إرفاق صورة أو مستند (قبل / بعد)'}
        </label>
        <input type="file" accept="image/*,.pdf" class="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer">
      </div>

      <!-- إرسال مجهول -->
      <div class="flex items-center gap-2 pt-1">
        <input type="checkbox" id="anonymous" class="rounded bg-[#0E1117] border-gray-700 text-blue-600 focus:ring-0">
        <label for="anonymous" class="text-xs text-gray-400 cursor-pointer">
          ${isEn ? 'Submit anonymously' : 'إرسال المقترح بدون إظهار اسمي'}
        </label>
      </div>
      
      <!-- زر الإرسال -->
      <button type="submit" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg font-bold text-xs text-white transition flex items-center justify-center gap-2 mt-2">
        <span>${isEn ? 'Submit Kaizen Proposal 🚀' : 'إرسال المقترح 🚀'}</span>
      </button>
    </form>
  </div>
`;
};
