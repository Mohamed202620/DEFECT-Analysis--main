import { translations } from '../config.js';
import { buildMachineDropdownHtml } from '../machines.js';
import { buildAttachmentPickerHtml } from '../components/attachmentPicker.js';

// دوال المساعدة العامة للاختيار السريع بلمسة واحدة (Single-Tap Selection)
window.selectIssueLine = function(lineVal) {
  const hiddenInput = document.getElementById('issueLine');
  if (hiddenInput) hiddenInput.value = lineVal;
  
  const btn1 = document.getElementById('btnLine1');
  const btn2 = document.getElementById('btnLine2');
  if (btn1 && btn2) {
    if (lineVal === 'Line 1') {
      btn1.className = "flex-1 py-3 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30";
      btn2.className = "flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600";
    } else {
      btn2.className = "flex-1 py-3 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30";
      btn1.className = "flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600";
    }
  }
};

window.selectIssuePriority = function(priorityVal) {
  const hiddenInput = document.getElementById('issuePriority');
  if (hiddenInput) hiddenInput.value = priorityVal;

  const priorities = ['High', 'Medium', 'Low'];
  priorities.forEach(p => {
    const btn = document.getElementById(`btnPriority_${p}`);
    if (!btn) return;
    if (p === priorityVal) {
      if (p === 'High') {
        btn.className = "flex-1 py-3 px-2 rounded-xl font-black text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40";
      } else if (p === 'Medium') {
        btn.className = "flex-1 py-3 px-2 rounded-xl font-black text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-amber-500 border-amber-300 text-slate-900 shadow-lg shadow-amber-500/40";
      } else {
        btn.className = "flex-1 py-3 px-2 rounded-xl font-black text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/40";
      }
    } else {
      btn.className = "flex-1 py-3 px-2 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700";
    }
  });
};

window.selectIssueType = function(typeVal) {
  const breakdownRadio = document.getElementById('radioBreakdown');
  const obsRadio = document.getElementById('radioObs');
  const btnBreakdown = document.getElementById('btnTypeBreakdown');
  const btnObs = document.getElementById('btnTypeObs');

  if (typeVal === 'Breakdown') {
    if (breakdownRadio) breakdownRadio.checked = true;
    if (btnBreakdown) btnBreakdown.className = "flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-red-500/20 border-red-500 text-red-300 shadow-md";
    if (btnObs) btnObs.className = "flex-1 py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400";
  } else {
    if (obsRadio) obsRadio.checked = true;
    if (btnObs) btnObs.className = "flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-blue-500/20 border-blue-500 text-blue-300 shadow-md";
    if (btnBreakdown) btnBreakdown.className = "flex-1 py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400";
  }
};

window.selectIssueCategory = function(catVal) {
  const hiddenInput = document.getElementById('issueCategory');
  if (hiddenInput) hiddenInput.value = catVal;

  const cats = ['كهرباء', 'ميكانيكا', 'برمجة', 'Safety', 'جودة', 'أخرى'];
  cats.forEach(c => {
    const btn = document.getElementById(`btnCat_${c}`);
    if (!btn) return;
    if (c === catVal) {
      btn.className = "py-2.5 px-3 rounded-xl font-black text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30";
    } else {
      btn.className = "py-2.5 px-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700";
    }
  });
};

export const IssueView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];
  const isAr = currentLang === 'ar';

  return `
  <div class="app-page p-4 max-w-md mx-auto space-y-4 pb-28 text-white">

    <!-- زر الرجوع -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        onclick="window.goBack('home')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition active:scale-95 shadow-md flex items-center gap-2">
        <span>${isAr ? "←" : "→"}</span>
        <span>${t.back || "رجوع"}</span>
      </button>

      <span class="text-xs font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
        ⚡ ${isAr ? "تسجيل سريع" : "Fast Report"}
      </span>
    </div>

    <!-- بطاقة النموذج الرئيسية -->
    <div class="bg-[#1E293B] rounded-2xl p-5 border border-slate-800 shadow-2xl space-y-5">

      <div class="border-b border-slate-800 pb-3">
        <h2 class="text-lg font-black text-white flex items-center gap-2">
          <span class="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-base">📝</span>
          <span>${t.issueTitle || "تسجيل عطل أو ملاحظة"}</span>
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          ${isAr ? "أدخل بيانات العطل بسرعة بلمسة واحدة" : "Quickly submit equipment defect with single-tap selectors"}
        </p>
      </div>

      <!-- 1. اختيار الخط (شرائح لمس سريعة) -->
      <div class="space-y-2">
        <label class="block text-xs font-black text-slate-300">
          🏭 ${t.line || "خط الإنتاج"} <span class="text-red-400">*</span>
        </label>
        <input type="hidden" id="issueLine" value="Line 1" />
        <div class="flex gap-2">
          <button type="button" id="btnLine1" onclick="window.selectIssueLine('Line 1')"
            class="flex-1 py-3 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30">
            <span>🏭 Line 1</span>
          </button>
          <button type="button" id="btnLine2" onclick="window.selectIssueLine('Line 2')"
            class="flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600">
            <span>🏭 Line 2</span>
          </button>
        </div>
      </div>

      <!-- 2. الماكينة -->
      <div class="space-y-2">
        <label for="issueMachineType" class="block text-xs font-black text-slate-300">
          ⚙️ ${t.machine || "الماكينة"} <span class="text-red-400">*</span>
        </label>
        ${buildMachineDropdownHtml("issueMachine", { placeholderLabel: t.selectMachine || "اختر الماكينة" })}
      </div>

      <!-- 3. درجة الأولوية (أزرار لمس واضحة وعريضة) -->
      <div class="space-y-2">
        <label class="block text-xs font-black text-slate-300">
          ⚡ ${t.priority || "درجة الأولوية"}
        </label>
        <input type="hidden" id="issuePriority" value="Medium" />
        <div class="flex gap-2">
          <button type="button" id="btnPriority_High" onclick="window.selectIssuePriority('High')"
            class="flex-1 py-3 px-2 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span class="text-sm">🔴</span>
            <span>${isAr ? "عالية (توقف)" : "High"}</span>
          </button>
          <button type="button" id="btnPriority_Medium" onclick="window.selectIssuePriority('Medium')"
            class="flex-1 py-3 px-2 rounded-xl font-black text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-amber-500 border-amber-300 text-slate-900 shadow-lg shadow-amber-500/40">
            <span class="text-sm">🟡</span>
            <span>${isAr ? "متوسطة" : "Medium"}</span>
          </button>
          <button type="button" id="btnPriority_Low" onclick="window.selectIssuePriority('Low')"
            class="flex-1 py-3 px-2 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span class="text-sm">🟢</span>
            <span>${isAr ? "منخفضة" : "Low"}</span>
          </button>
        </div>
      </div>

      <!-- 4. نوع البلاغ (عطل / ملاحظة) -->
      <div class="space-y-2">
        <label class="block text-xs font-black text-slate-300">
          🏷️ ${t.issueType || "نوع البلاغ"}
        </label>
        <div class="hidden">
          <input type="radio" id="radioBreakdown" name="issueType" value="Breakdown" checked>
          <input type="radio" id="radioObs" name="issueType" value="Observation">
        </div>
        <div class="flex gap-2">
          <button type="button" id="btnTypeBreakdown" onclick="window.selectIssueType('Breakdown')"
            class="flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-red-500/20 border-red-500 text-red-300 shadow-md">
            <span>⚠️ ${isAr ? "عطل مفاجئ" : "Breakdown"}</span>
          </button>
          <button type="button" id="btnTypeObs" onclick="window.selectIssueType('Observation')"
            class="flex-1 py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400">
            <span>👁️ ${isAr ? "ملاحظة / حيود" : "Observation"}</span>
          </button>
        </div>
      </div>

      <!-- 5. تصنيف العطل (شرائح تفاعلية سريعة) -->
      <div class="space-y-2">
        <label class="block text-xs font-black text-slate-300">
          🛠️ ${t.category || "تصنيف العطل"} <span class="text-red-400">*</span>
        </label>
        <input type="hidden" id="issueCategory" value="" />
        <div class="grid grid-cols-3 gap-2">
          <button type="button" id="btnCat_كهرباء" onclick="window.selectIssueCategory('كهرباء')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>⚡ كهرباء</span>
          </button>
          <button type="button" id="btnCat_ميكانيكا" onclick="window.selectIssueCategory('ميكانيكا')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>⚙️ ميكانيكا</span>
          </button>
          <button type="button" id="btnCat_برمجة" onclick="window.selectIssueCategory('برمجة')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>💻 برمجة</span>
          </button>
          <button type="button" id="btnCat_Safety" onclick="window.selectIssueCategory('Safety')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>🛡️ سلامة</span>
          </button>
          <button type="button" id="btnCat_جودة" onclick="window.selectIssueCategory('جودة')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>📦 جودة</span>
          </button>
          <button type="button" id="btnCat_أخرى" onclick="window.selectIssueCategory('أخرى')"
            class="py-2.5 px-2 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-gray-800 text-gray-400 hover:border-gray-700">
            <span>❓ أخرى</span>
          </button>
        </div>
      </div>

      <!-- 6. وصف المشكلة -->
      <div class="space-y-2">
        <label for="issueDescription" class="block text-xs font-black text-slate-300">
          📋 ${t.description || "وصف المشكلة"} <span class="text-red-400">*</span>
        </label>
        <textarea id="issueDescription" rows="3"
          placeholder="${t.enterDescription || "اكتب وصف المشكلة بدقة..."}"
          class="w-full p-3.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm resize-none shadow-inner placeholder-gray-500"></textarea>
      </div>

      <!-- 7. مكان العطل داخل الماكينة -->
      <div class="space-y-2">
        <label for="issueLocation" class="block text-xs font-black text-slate-300">
          📍 ${t.locationInMachine || "مكان العطل بالتحديد"}
        </label>
        <input id="issueLocation" type="text"
          placeholder="مثال: Main Motor - Sensor - Bearing"
          class="w-full p-3.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm shadow-inner placeholder-gray-500">
      </div>

      <!-- 8. اقتراح الحل -->
      <div class="space-y-2">
        <label for="issueSuggestion" class="block text-xs font-black text-slate-300">
          💡 ${t.suggestion || "اقتراح الحل (اختياري)"}
        </label>
        <textarea id="issueSuggestion" rows="2"
          placeholder="${t.enterSuggestion || "إذا كان لديك مقترح أولي للحل..."}"
          class="w-full p-3.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm resize-none shadow-inner placeholder-gray-500"></textarea>
      </div>

      <!-- 9. الصور -->
      <div class="space-y-2">
        <label class="block text-xs font-black text-slate-300">
          📷 ${t.attachPhoto || "صور توضيحية (اختياري)"}
        </label>
        ${buildAttachmentPickerHtml("issueImages", { emptyText: "لا توجد صور مرفقة" })}
      </div>

      <!-- 10. زر الحفظ والإرسال الميداني الكبير -->
      <div class="pt-3">
        <button type="button"
          onclick="window.confirmIssue()"
          class="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-black text-white text-base transition active:scale-[0.98] shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2">
          <span>💾</span>
          <span>${t.saveAndSend || "حفظ وإرسال البلاغ"}</span>
        </button>
      </div>

    </div>
  </div>
  `;
};
