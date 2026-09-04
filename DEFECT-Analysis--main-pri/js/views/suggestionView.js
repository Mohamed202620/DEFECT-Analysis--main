import { buildMachineDropdownHtml } from '../machines.js';
import { buildAttachmentPickerHtml, initAttachmentPicker, getAttachmentFiles, resetAttachmentFiles } from '../components/attachmentPicker.js';

export const SuggestionView = () => {
  const isEn = window.currentLang === 'en';

  // تفعيل مكوّن المرفقات المتعددة بعد إدراج الـ HTML فعلياً في
  // الصفحة (يُستدعى من renderCore.js AUTO LOAD الخاص بصفحة الكايزن)
  window.initSuggestionAttachments = function () {
    initAttachmentPicker("suggestionImages", {
      maxFileSizeMB: 10,
      emptyText: isEn ? "No photos attached" : "لا توجد صور مرفقة"
    });
  };

  // معالجة عملية الإرسال - حفظ فعلي في Firestore (مجموعة suggestions)
  window.handleKaizenSubmit = async (event) => {
    event.preventDefault();

    const data = {
      title: document.getElementById("suggestionTitle").value,
      line: document.getElementById("suggestionLine").value,
      machine: document.getElementById("suggestionMachine").value,
      category: document.getElementById("suggestionCategory").value,
      problem: document.getElementById("suggestionProblem").value,
      solution: document.getElementById("suggestionSolution").value,
      impact: document.getElementById("suggestionImpact").value,

      // بيانات المستخدم تُرسل تلقائياً
      name: localStorage.getItem("name"),
      job: localStorage.getItem("job"),
      department: localStorage.getItem("department"),
      shift: localStorage.getItem("shift"),
      role: localStorage.getItem("role"),
      phone: localStorage.getItem("phone"),

      anonymous: document.getElementById("anonymousSuggestion").checked,
      date: new Date().toISOString()
    };

    // تأكيد إضافي إن قيمة الماكينة اكتملت فعلاً (نوع + رقم الوحدة لو
    // كانت الماكينة المختارة من النوع اللي له وحدات مرقّمة زي
    // Bodymaker/Decorator/Spray/STRAP) - الاعتماد على required في
    // الـ HTML وحده مش موثوق 100% مع الحقل المخفي في كل المتصفحات
    if (!data.machine) {
      alert(isEn ? '⚠️ Please select the machine (and unit number if applicable).' : '⚠️ يرجى اختيار الماكينة (ورقم الوحدة إن وُجد).');
      return;
    }

    // الصور المرفقة (إن وُجدت) - مجموعة كاملة (واحدة أو أكثر) بدل
    // صورة واحدة فقط زي السابق؛ الملفات نفسها اتضغطت وتحققنا من
    // نوعها وحجمها بالفعل داخل attachmentPicker.js وقت اختيارها
    const attachedImages = getAttachmentFiles("suggestionImages");

    const submitBtn = event.target?.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = isEn ? 'Submitting...' : 'جاري الإرسال...';
    }

    try {
      if (attachedImages.length) {
        data.images = attachedImages;
      }

      const { saveSuggestionApi } = await import('../services/api.js');
      const result = await saveSuggestionApi(data);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      if (result.status !== 'success') {
        alert((isEn ? 'Error: ' : 'خطأ: ') + (result.message || (isEn ? 'Failed to submit' : 'فشل الإرسال')));
        return;
      }

      resetAttachmentFiles("suggestionImages", isEn ? "No photos attached" : "لا توجد صور مرفقة");
      alert(isEn ? 'Thank you! Kaizen suggestion submitted successfully ✅' : 'شكرًا لمشاركتك! تم إرسال مقترح الكايزن بنجاح ✅');
      window.goBack('home'); // أو يمكن توجيهه إلى maintenance
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      alert((isEn ? 'Connection error: ' : 'خطأ في الاتصال: ') + err.message);
    }
  };

  return `
  <div class="app-page p-4 max-w-lg mx-auto pb-10">
    <!-- زر الرجوع -->
    <button onclick="window.goBack('home')" class="mb-4 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>
    
    <!-- العنوان الرئيسي -->
    <div class="mb-4">
      <h2 class="text-lg font-bold text-amber-400 flex items-center gap-2">
        <span>💡</span> ${isEn ? 'Kaizen & Continuous Improvement' : 'المقترحات والتحسينات (كايزن)'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Share your ideas to eliminate waste and improve work environment' : 'شارِك بأفكارك لتقليل الهدر وتطوير بيئة العمل'}
      </p>
    </div>
    
    <!-- نموذج الكايزن -->
    <form onsubmit="window.handleKaizenSubmit(event)" class="bg-[#1E293B] p-5 rounded-xl border border-gray-800 space-y-4 shadow-lg">
      
      <!-- عنوان المقترح -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Suggestion Title / Idea' : 'عنوان المقترح / الفكرة'} <span class="text-red-400">*</span>
        </label>
        <input type="text" id="suggestionTitle" required placeholder="${isEn ? 'e.g., Reduce packing time...' : 'مثال: تقليل وقت التغليف...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
      </div>

      <!-- الخط والماكينة -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-gray-300 mb-1">
            ${isEn ? 'Line Number' : 'رقم الخط'} <span class="text-red-500">*</span>
          </label>
          <select id="suggestionLine" required class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
            <option value="" disabled selected>${isEn ? 'Select...' : 'اختر...'}</option>
            <option value="Line 1">Line 1</option>
            <option value="Line 2">Line 2</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-300 mb-1">
            ${isEn ? 'Machine' : 'الماكينة'} <span class="text-red-500">*</span>
          </label>
          ${buildMachineDropdownHtml("suggestionMachine", {
            placeholderLabel: isEn ? 'Select...' : 'اختر...',
            unitPlaceholderLabel: isEn ? 'Select unit...' : 'اختر الرقم...',
            typeSelectClass: "w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors",
            unitSelectClass: "w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors mt-2"
          })}
        </div>
      </div>

      <!-- تصنيف الكايزن -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Improvement Category' : 'تصنيف التحسين (مجال الكايزن)'} <span class="text-red-400">*</span>
        </label>
        <select id="suggestionCategory" required class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
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
        <textarea id="suggestionProblem" required placeholder="${isEn ? 'Describe current problem or waste...' : 'صف المشكلة الحالية أو الهدر الموجود...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-20 focus:outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
      </div>

      <!-- الحل المقترح -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Proposed Kaizen Solution' : 'الحل المقترح (طريقة التحسين)'} <span class="text-red-400">*</span>
        </label>
        <textarea id="suggestionSolution" required placeholder="${isEn ? 'Describe your proposed solution...' : 'اكتب خطوات الحل أو الفكرة الجديدة...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white h-20 focus:outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
      </div>

      <!-- الأثر المتوقع -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Expected Impact (Optional)' : 'الأثر المتوقع (اختياري)'}
        </label>
        <input type="text" id="suggestionImpact" placeholder="${isEn ? 'e.g., Saves 15 mins daily, reduces defects...' : 'مثال: توفير 15 دقيقة يومياً، تقليل الأخطاء...'}" class="w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
      </div>

      <!-- مرفقات وصور -->
      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">
          ${isEn ? 'Attach Photos (Optional)' : 'إرفاق صور (قبل / بعد)'}
        </label>
        ${buildAttachmentPickerHtml("suggestionImages", {
          cameraLabel: isEn ? "📷 Take Photo" : "📷 التقاط صورة",
          galleryLabel: isEn ? "🖼️ From Gallery" : "🖼️ من المعرض",
          emptyText: isEn ? "No photos attached" : "لا توجد صور مرفقة"
        })}
      </div>

      <!-- إرسال مجهول -->
      <div class="flex items-center gap-2 pt-1">
        <input type="checkbox" id="anonymousSuggestion" class="rounded bg-[#0E1117] border-gray-700 text-amber-500 focus:ring-0 focus:ring-offset-0">
        <label for="anonymousSuggestion" class="text-xs text-gray-400 cursor-pointer select-none">
          ${isEn ? 'Submit anonymously' : 'إرسال المقترح بدون إظهار اسمي'}
        </label>
      </div>
      
      <!-- زر الإرسال -->
      <button type="submit" class="w-full p-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] rounded-lg font-bold text-xs text-white transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-amber-500/20">
        <span>${isEn ? 'Submit Kaizen Proposal 🚀' : 'إرسال المقترح 🚀'}</span>
      </button>
    </form>
  </div>
  `;
};
