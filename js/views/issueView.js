import { translations } from '../config.js';

export const IssueView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];

  return `
  <div class="p-4 max-w-md mx-auto space-y-4 pb-24 text-white">

    <!-- زر الرجوع -->
    <button
      type="button"
      onclick="window.navigateTo('home')"
      class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold transition active:scale-95 shadow-sm">
      ⬅ ${t.back || "رجوع"}
    </button>

    <!-- بطاقة النموذج الرئيسية -->
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

      <h2 class="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
        <span>📝</span>
        <span>${t.issueTitle || "تسجيل عطل أو ملاحظة"}</span>
      </h2>

      <!-- الخط -->
      <div>
        <label for="issueLine" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.line || "الخط"}
        </label>
        <select id="issueLine"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm">
          <option value="" disabled selected>${t.selectLine || "اختر الخط"}</option>
          <option value="Line 1">Line 1</option>
          <option value="Line 2">Line 2</option>
        </select>
      </div>

      <!-- الماكينة -->
      <div>
        <label for="issueMachine" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.machine || "الماكينة"}
        </label>
        <select id="issueMachine"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm">
          <option value="" disabled selected>${t.selectMachine || "اختر الماكينة"}</option>
          <option value="Coil Handling">Coil Handling</option>
          <option value="Baler">Baler</option>
          <option value="Cupper">Cupper</option>
          <option value="Bodymaker">Bodymaker</option>
          <option value="Trimmer">Trimmer</option>
          <option value="Washer">Washer</option>
          <option value="Decorator">Decorator</option>
          <option value="Spray">Spray</option>
          <option value="IBO">IBO</option>
          <option value="Necker">Necker</option>
          <option value="Palletizer">Palletizer</option>
          <option value="Depalletizer">Depalletizer</option>
          <option value="Front End Line Control">Front End Line Control</option>
          <option value="Mid Line Control">Mid Line Control</option>
          <option value="Back End Line Control">Back End Line Control</option>
        </select>
      </div>

      <!-- درجة الأولوية -->
      <div>
        <label for="issuePriority" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.priority || "درجة الأولوية"}
        </label>
        <select id="issuePriority"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm">
          <option value="High">🔴 عالية</option>
          <option value="Medium" selected>🟡 متوسطة</option>
          <option value="Low">🟢 منخفضة</option>
        </select>
      </div>

      <!-- نوع البلاغ -->
      <div>
        <label class="block mb-2 text-xs font-bold text-gray-300">
          ${t.issueType || "نوع البلاغ"}
        </label>
        <div class="flex gap-5 mb-2 bg-[#0F172A] p-3 rounded-lg border border-gray-700">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="issueType" value="Breakdown" checked class="accent-blue-500">
            <span class="text-sm">عطل</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="issueType" value="Observation" class="accent-blue-500">
            <span class="text-sm">ملاحظة</span>
          </label>
        </div>
      </div>

      <!-- نوع العطل -->
      <div>
        <label for="issueCategory" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.category || "نوع العطل"}
        </label>
        <select id="issueCategory"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm">
          <option value="" disabled selected>${t.selectCategory || "اختر نوع العطل"}</option>
          <option value="كهرباء">⚡ كهرباء</option>
          <option value="ميكانيكا">⚙️ ميكانيكا</option>
          <option value="برمجة">💻 برمجة</option>
          <option value="Safety">🛡️ Safety</option>
          <option value="جودة">📦 جودة</option>
          <option value="أخرى">❓ أخرى</option>
        </select>
      </div>

      <!-- وصف المشكلة -->
      <div>
        <label for="issueDescription" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.description || "وصف المشكلة"}
        </label>
        <textarea id="issueDescription" rows="4"
          placeholder="${t.enterDescription || "اكتب وصف المشكلة بدقة..."}"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm resize-none shadow-sm"></textarea>
      </div>

      <!-- مكان العطل داخل الماكينة -->
      <div>
        <label for="issueLocation" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.locationInMachine || "مكان العطل داخل الماكينة"}
        </label>
        <input id="issueLocation" type="text"
          placeholder="مثال: Main Motor - Sensor - Bearing"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm shadow-sm">
      </div>

      <!-- اقتراح الحل -->
      <div>
        <label for="issueSuggestion" class="block mb-2 text-xs font-bold text-gray-300">
          ${t.suggestion || "اقتراح الحل (اختياري)"}
        </label>
        <textarea id="issueSuggestion" rows="2"
          placeholder="${t.enterSuggestion || "إذا كان لديك اقتراح لحل المشكلة..."}"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm resize-none shadow-sm"></textarea>
      </div>

      <!-- الصورة -->
      <div>
        <label class="block mb-2 text-xs font-bold text-gray-300">
          ${t.attachPhoto || "صورة توضيحية (اختياري)"}
        </label>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <input id="cameraImage" type="file" accept="image/*" capture="environment" class="hidden">
          <button type="button"
            onclick="document.getElementById('cameraImage').click()"
            class="bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 rounded-xl p-3 text-blue-400 font-bold transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2">
            <span>📷</span> التقاط صورة
          </button>

          <input id="galleryImage" type="file" accept="image/*" class="hidden">
          <button type="button"
            onclick="document.getElementById('galleryImage').click()"
            class="bg-gray-700/50 border border-gray-600 hover:bg-gray-700 rounded-xl p-3 text-gray-300 font-bold transition active:scale-95 shadow-sm text-sm flex items-center justify-center gap-2">
            <span>🖼️</span> من المعرض
          </button>
        </div>

        <div id="imageName" class="text-center text-[11px] text-gray-500 py-2">
          لا توجد صورة مرفقة
        </div>

        <img id="previewImage" class="hidden rounded-xl border border-gray-700 w-full mt-3 max-h-48 object-contain bg-[#0F172A] p-1 shadow-sm"/>
      </div>

      <!-- حفظ -->
      <div class="pt-2">
        <button type="button"
          onclick="window.confirmIssue()"
          class="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-base transition active:scale-95 shadow-lg shadow-blue-500/20">
          💾 ${t.saveAndSend || "حفظ وإرسال البلاغ"}
        </button>
      </div>

    </div>
  </div>
  `;
};
