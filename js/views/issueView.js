import { translations } from '../config.js';
import { saveIssueApi } from '../services/api.js';
import { compressImage } from '../workflow.js';

// متغير محلي لشفرة الصورة المرفقة
let selectedIssueImage = null;

export const IssueView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];

  const userName = localStorage.getItem("name") || "";
  const userJob = localStorage.getItem("job") || "";
  const userDepartment = localStorage.getItem("department") || "";
  const userShift = localStorage.getItem("shift") || "";
  const issueDate = new Date().toLocaleString(currentLang === 'ar' ? "ar-EG" : "en-US");
  const issueId = Date.now();

  return `
  <div class="p-4 max-w-md mx-auto space-y-4 pb-24 text-white">

    <!-- زر الرجوع -->
    <button
      type="button"
      onclick="window.navigateTo('home')"
      class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold transition active:scale-95">
      ⬅ ${t.back || "رجوع"}
    </button>

    <!-- بطاقة النموذج الرئيسية -->
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-700 space-y-4">

      <h2 class="text-xl font-bold text-blue-400 mb-4">
        📝 ${t.issueTitle || "تسجيل عطل أو ملاحظة"}
      </h2>

      <!-- الخط -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.line || "الخط"}
        </label>
        <select id="issueLine"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none">
          <option value="">${t.selectLine || "اختر الخط"}</option>
          <option value="Line 1">Line 1</option>
          <option value="Line 2">Line 2</option>
        </select>
      </div>

      <!-- الماكينة -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.machine || "الماكينة"}
        </label>
        <select id="issueMachine"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none">
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
        <label class="block mb-2 text-sm font-bold">
          ${t.priority || "درجة الأولوية"}
        </label>
        <select id="issuePriority"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none">
          <option value="High">🔴 عالية</option>
          <option value="Medium" selected>🟡 متوسطة</option>
          <option value="Low">🟢 منخفضة</option>
        </select>
      </div>

      <!-- نوع البلاغ -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.issueType || "نوع البلاغ"}
        </label>
        <div class="flex gap-5 mb-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="issueType" value="Breakdown" checked>
            <span>عطل</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="issueType" value="Observation">
            <span>ملاحظة</span>
          </label>
        </div>
      </div>

      <!-- نوع العطل -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.category || "نوع العطل"}
        </label>
        <select id="issueCategory"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none">
          <option value="">${t.selectCategory || "اختر نوع العطل"}</option>
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
        <label class="block mb-2 text-sm font-bold">
          ${t.description || "وصف المشكلة"}
        </label>
        <textarea id="issueDescription" rows="4"
          placeholder="${t.enterDescription || "اكتب وصف المشكلة"}"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none resize-none"></textarea>
      </div>

      <!-- مكان العطل داخل الماكينة -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.locationInMachine || "مكان العطل داخل الماكينة"}
        </label>
        <input id="issueLocation" type="text"
          placeholder="مثال: Main Motor - Sensor - Bearing"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none">
      </div>

      <!-- اقتراح الحل -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.suggestion || "اقتراح الحل (اختياري)"}
        </label>
        <textarea id="issueSuggestion" rows="3"
          placeholder="${t.enterSuggestion || "اقتراح الحل"}"
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none resize-none"></textarea>
      </div>

      <!-- بيانات المبلغ -->
      <div class="bg-[#0F172A] rounded-xl p-3 border border-gray-700 mb-4 space-y-2 text-sm">
        <div>👤 <b>المبلغ:</b> ${userName}</div>
        <div>💼 <b>الوظيفة:</b> ${userJob}</div>
        <div>🏢 <b>القسم:</b> ${userDepartment}</div>
        <div>🔵 <b>الشيفت:</b> ${userShift}</div>
        <div>📅 <b>التاريخ:</b> ${issueDate}</div>
        <div>🆔 <b>رقم البلاغ:</b> <span id="generatedIssueId">${issueId}</span></div>
      </div>

      <!-- الصورة -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.attachPhoto || "صورة (اختياري)"}
        </label>

        <div class="grid grid-cols-2 gap-2 mb-4">
          <input id="cameraImage" type="file" accept="image/*" capture="environment" class="hidden">
          <button type="button"
            onclick="document.getElementById('cameraImage').click()"
            class="bg-blue-600 rounded-lg p-3 text-white font-bold hover:bg-blue-700 transition">
            📷 تصوير
          </button>

          <input id="galleryImage" type="file" accept="image/*" class="hidden">
          <button type="button"
            onclick="document.getElementById('galleryImage').click()"
            class="bg-gray-700 rounded-lg p-3 text-white font-bold hover:bg-gray-600 transition">
            🖼️ المعرض
          </button>
        </div>

        <div id="imageName" class="text-center text-xs text-gray-400 mb-3">
          لم يتم اختيار صورة
        </div>

        <img id="previewImage" class="hidden rounded-xl border border-gray-700 w-full mb-4 max-h-48 object-cover"/>
      </div>

      <!-- حالة البلاغ -->
      <div>
        <label class="block mb-2 text-sm font-bold">
          ${t.status || "حالة البلاغ"}
        </label>
        <input value="🟡 مفتوح" readonly
          class="w-full p-3 rounded-lg bg-[#111827] border border-gray-700 text-yellow-400 mb-4 outline-none">
      </div>

      <!-- حفظ -->
      <button type="button"
        onclick="window.confirmIssue()"
        class="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition active:scale-95 shadow-lg">
        💾 ${t.saveAndSend || "حفظ وإرسال البلاغ"}
      </button>

    </div>
  </div>
  `;
};

// المعالجة التلقائية لاختيار الصور عبر Event Delegation
document.addEventListener('change', async (e) => {
  if (e.target && (e.target.id === 'cameraImage' || e.target.id === 'galleryImage')) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      selectedIssueImage = await compressImage(file, 1000, 0.8);
      const preview = document.getElementById('previewImage');
      const nameTxt = document.getElementById('imageName');

      if (preview) {
        preview.src = selectedIssueImage;
        preview.classList.remove('hidden');
      }
      if (nameTxt) {
        nameTxt.textContent = `📷 تم اختيار الصورة: ${file.name || 'مباشرة'}`;
        nameTxt.classList.remove('text-gray-400');
        nameTxt.classList.add('text-emerald-400');
      }
    } catch (err) {
      alert("❌ خطأ أثناء معالجة الصورة: " + err.message);
    }
  }
});

// دالة تأكيد وإرسال البلاغ
window.confirmIssue = async function() {
  const line = document.getElementById('issueLine')?.value;
  const machine = document.getElementById('issueMachine')?.value;
  const priority = document.getElementById('issuePriority')?.value;
  const type = document.querySelector('input[name="issueType"]:checked')?.value || "Breakdown";
  const category = document.getElementById('issueCategory')?.value;
  const description = document.getElementById('issueDescription')?.value?.trim();
  const location = document.getElementById('issueLocation')?.value?.trim();
  const suggestion = document.getElementById('issueSuggestion')?.value?.trim();
  const issueId = document.getElementById('generatedIssueId')?.textContent;

  if (!line || !machine || !category || !description) {
    alert("⚠️ يرجى استكمال كافة البيانات الأساسية (الخط، الماكينة، نوع العطل، والوصف).");
    return;
  }

  const btn = document.querySelector('button[onclick="window.confirmIssue()"]');
  const originalText = btn ? btn.innerHTML : "💾 حفظ وإرسال البلاغ";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري الإرسال...";
  }

  const payload = {
    action: "saveIssue",
    issueId,
    line,
    machine,
    priority,
    type,
    category,
    description,
    location,
    suggestion,
    image: selectedIssueImage,
    reporter: {
      name: localStorage.getItem("name") || "",
      job: localStorage.getItem("job") || "",
      department: localStorage.getItem("department") || "",
      shift: localStorage.getItem("shift") || ""
    },
    status: "open",
    createdAt: new Date().toISOString()
  };

  try {
    const res = await saveIssueApi(payload);
    if (res && res.status === 'success') {
      alert("✅ تم حفظ وإرسال البلاغ بنجاح");
      selectedIssueImage = null;
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
      }
    } else {
      alert("❌ حدث خطأ أثناء الإرسال: " + (res?.message || "خطأ غير معروف"));
    }
  } catch (err) {
    alert("❌ خطأ بالاتصال: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};
