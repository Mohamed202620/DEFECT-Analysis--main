import { translations } from '../config.js';

export const IssueView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];

  const userName = localStorage.getItem("name") || "غير محدد";
  const userJob = localStorage.getItem("job") || "غير محدد";
  const userDepartment = localStorage.getItem("department") || "غير محدد";
  const userShift = localStorage.getItem("shift") || "غير محدد";
  const issueDate = new Date().toLocaleString(currentLang === 'ar' ? "ar-EG" : "en-US");
  const issueId = Date.now();

  return `
  <div class="p-4 max-w-md mx-auto space-y-4 pb-24">

    <!-- زر الرجوع -->
    <button
      type="button"
      onclick="window.navigateTo('home')"
      class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
             dyn-card border dyn-text transition-all duration-200 active:scale-95 shadow-sm">
      <span>⬅</span>
      <span>${t.back || "رجوع"}</span>
    </button>

    <!-- بطاقة النموذج الرئيسية -->
    <div class="dyn-card rounded-3xl p-5 border shadow-xl space-y-4">

      <h2 class="text-xl font-bold text-blue-500 flex items-center gap-2 border-b border-gray-700/30 pb-3">
        <span>📝</span>
        <span>${t.issueTitle || "تسجيل عطل أو ملاحظة"}</span>
      </h2>

      <!-- الخط -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.line || "الخط"}
        </label>
        <select id="issueLine"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">${t.selectLine || "اختر الخط"}</option>
          <option value="Line 1">Line 1</option>
          <option value="Line 2">Line 2</option>
        </select>
      </div>

      <!-- الماكينة -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.machine || "الماكينة"}
        </label>
        <select id="issueMachine"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">${t.selectMachine || "اختر الماكينة"}</option>
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
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.priority || "درجة الأولوية"}
        </label>
        <select id="issuePriority"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="High">🔴 عالية</option>
          <option value="Medium" selected>🟡 متوسطة</option>
          <option value="Low">🟢 منخفضة</option>
        </select>
      </div>

      <!-- نوع البلاغ -->
      <div>
        <label class="block mb-2 text-xs font-bold dyn-text">
          ${t.issueType || "نوع البلاغ"}
        </label>
        <div class="flex gap-6 p-3 rounded-xl dyn-card border">
          <label class="flex items-center gap-2 cursor-pointer dyn-text text-sm font-medium">
            <input type="radio" name="issueType" value="Breakdown" checked class="w-4 h-4 text-blue-600">
            <span>عطل</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer dyn-text text-sm font-medium">
            <input type="radio" name="issueType" value="Observation" class="w-4 h-4 text-blue-600">
            <span>ملاحظة</span>
          </label>
        </div>
      </div>

      <!-- نوع العطل -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.category || "نوع العطل"}
        </label>
        <select id="issueCategory"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">${t.selectCategory || "اختر نوع العطل"}</option>
          <option value="كهرباء">⚡ كهرباء</option>
          <option value="ميكانيكا">⚙️ ميكانيكا</option>
          <option value="برمجة">💻 برمجة</option>
          <option value="Safety">🛡️ السلامة (Safety)</option>
          <option value="جودة">📦 جودة</option>
          <option value="أخرى">❓ أخرى</option>
        </select>
      </div>

      <!-- وصف المشكلة -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.description || "وصف المشكلة"}
        </label>
        <textarea id="issueDescription" rows="3"
          placeholder="${t.enterDescription || "اكتب وصف المشكلة التفصيلي هنا..."}"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
      </div>

      <!-- مكان العطل داخل الماكينة -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.locationInMachine || "مكان العطل داخل الماكينة"}
        </label>
        <input id="issueLocation" type="text"
          placeholder="مثال: Main Motor - Sensor - Bearing"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none">
      </div>

      <!-- اقتراح الحل -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.suggestion || "اقتراح الحل (اختياري)"}
        </label>
        <textarea id="issueSuggestion" rows="2"
          placeholder="${t.enterSuggestion || "اقتراحك لحل المشكلة..."}"
          class="w-full p-3 rounded-xl dyn-input border dyn-text focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
      </div>

      <!-- بيانات المبلغ الموثقة -->
      <div class="dyn-card border rounded-2xl p-4 text-xs space-y-2 dyn-text-muted">
        <div class="flex justify-between border-b border-gray-700/20 pb-1">
          <span>👤 <b>المبلغ:</b> ${userName}</span>
          <span>💼 <b>الوظيفة:</b> ${userJob}</span>
        </div>
        <div class="flex justify-between border-b border-gray-700/20 pb-1">
          <span>🏢 <b>القسم:</b> ${userDepartment}</span>
          <span>🔵 <b>الشيفت:</b> ${userShift}</span>
        </div>
        <div class="flex justify-between border-b border-gray-700/20 pb-1">
          <span>📅 <b>التاريخ:</b> ${issueDate}</span>
        </div>
        <div class="text-blue-400 font-mono text-[11px] pt-1">
          🆔 <b>رقم البلاغ:</b> <span id="generatedIssueId">${issueId}</span>
        </div>
      </div>

      <!-- المرفقات والصور -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.attachPhoto || "صورة المرفق (اختياري)"}
        </label>

        <div class="grid grid-cols-2 gap-3 mb-2">
          <input id="cameraImage" type="file" accept="image/*" capture="environment" class="hidden">
          <button type="button"
            onclick="document.getElementById('cameraImage').click()"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl p-3 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
            📷 تصوير
          </button>

          <input id="galleryImage" type="file" accept="image/*" class="hidden">
          <button type="button"
            onclick="document.getElementById('galleryImage').click()"
            class="dyn-card border dyn-text font-bold rounded-xl p-3 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            🖼️ المعرض
          </button>
        </div>

        <div id="imageName" class="text-center text-xs dyn-text-muted mb-2">
          لم يتم اختيار صورة
        </div>

        <img id="previewImage" class="hidden rounded-xl border dyn-border max-h-48 w-full object-cover mb-2" />
      </div>

      <!-- حالة البلاغ -->
      <div>
        <label class="block mb-1.5 text-xs font-bold dyn-text">
          ${t.status || "حالة البلاغ"}
        </label>
        <input value="🟡 مفتوح" readonly
          class="w-full p-3 rounded-xl dyn-input border text-yellow-500 font-bold cursor-not-allowed outline-none">
      </div>

      <!-- زر الحفظ والإرسال -->
      <button type="button"
        onclick="window.confirmIssue()"
        class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all duration-200">
        💾 ${t.saveAndSend || "حفظ وإرسال البلاغ"}
      </button>

    </div>
  </div>
  `;
};
