import { translations } from '../config.js';
import { buildMachineDropdownHtml } from '../machines.js';
import { buildAttachmentPickerHtml } from '../components/attachmentPicker.js';

// دوال المساعدة العامة للاختيار السريع بلمسة واحدة (Single-Tap Selection)
window.selectIssueLine = function(lineVal) {
  const hiddenInput = document.getElementById('issueLine');
  if (hiddenInput) hiddenInput.value = lineVal;
  
  const btn1 = document.getElementById('btnLine1');
  const btn2 = document.getElementById('btnLine2');
  const activeClass = "flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-blue-600 border-blue-400 text-white shadow-sm shadow-blue-600/30";
  const inactiveClass = "flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-slate-700 text-slate-400 hover:border-slate-600";
  if (btn1 && btn2) {
    if (lineVal === 'Line 1') {
      btn1.className = activeClass;
      btn2.className = inactiveClass;
    } else {
      btn2.className = activeClass;
      btn1.className = inactiveClass;
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
        btn.className = "flex-1 py-1.5 px-1.5 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-red-600 border-red-400 text-white shadow-sm shadow-red-600/30";
      } else if (p === 'Medium') {
        btn.className = "flex-1 py-1.5 px-1.5 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-amber-500 border-amber-300 text-slate-950 shadow-sm shadow-amber-500/30";
      } else {
        btn.className = "flex-1 py-1.5 px-1.5 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-emerald-600 border-emerald-400 text-white shadow-sm shadow-emerald-600/30";
      }
    } else {
      btn.className = "flex-1 py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700";
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
    if (btnBreakdown) btnBreakdown.className = "flex-1 py-1.5 px-2 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-red-500/20 border-red-500 text-red-300 shadow-sm";
    if (btnObs) btnObs.className = "flex-1 py-1.5 px-2 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700";
  } else {
    if (obsRadio) obsRadio.checked = true;
    if (btnObs) btnObs.className = "flex-1 py-1.5 px-2 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm";
    if (btnBreakdown) btnBreakdown.className = "flex-1 py-1.5 px-2 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700";
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
      btn.className = "py-1.5 px-1.5 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-600/30";
    } else {
      btn.className = "py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700";
    }
  });
};

export const IssueView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];
  const isAr = currentLang === 'ar';

  return `
  <div class="app-page p-2.5 sm:p-4 max-w-xl mx-auto space-y-2.5 pb-20 text-white">

    <!-- زر الرجوع وشارة البلاغ السريع -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        onclick="window.goBack('home')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-white font-bold text-xs transition active:scale-95 shadow-sm flex items-center gap-1.5">
        <span class="text-xs leading-none">${isAr ? "←" : "→"}</span>
        <span>${t.back || "رجوع"}</span>
      </button>

      <span class="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20 flex items-center gap-1">
        <span>⚡</span>
        <span>${isAr ? "تسجيل سريع" : "Fast Report"}</span>
      </span>
    </div>

    <!-- بطاقة النموذج الرئيسية المدمجة -->
    <div class="bg-[#1E293B] rounded-xl p-3.5 sm:p-4 border border-slate-800 shadow-xl space-y-2.5">

      <!-- هيدر الكارت -->
      <div class="border-b border-slate-800/80 pb-2 flex items-center gap-2">
        <span class="w-7 h-7 flex items-center justify-center bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm shrink-0">📝</span>
        <div>
          <h2 class="text-sm sm:text-base font-black text-white leading-tight">
            ${t.issueTitle || "تسجيل عطل أو ملاحظة"}
          </h2>
          <p class="text-[11px] text-slate-400 leading-none mt-0.5">
            ${isAr ? "أدخل بيانات العطل بسرعة بلمسة واحدة" : "Quick equipment defect reporting"}
          </p>
        </div>
      </div>

      <!-- 1 & 2: خط الإنتاج + الماكينة في صف متجاوب -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <!-- 1. اختيار الخط -->
        <div class="space-y-1">
          <label class="block text-[11px] font-bold text-slate-300">
            🏭 ${t.line || "خط الإنتاج"} <span class="text-red-400">*</span>
          </label>
          <input type="hidden" id="issueLine" value="Line 1" />
          <div class="flex gap-1.5">
            <button type="button" id="btnLine1" onclick="window.selectIssueLine('Line 1')"
              class="flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-blue-600 border-blue-400 text-white shadow-sm shadow-blue-600/30">
              <span>🏭 Line 1</span>
            </button>
            <button type="button" id="btnLine2" onclick="window.selectIssueLine('Line 2')"
              class="flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-slate-700 text-slate-400 hover:border-slate-600">
              <span>🏭 Line 2</span>
            </button>
          </div>
        </div>

        <!-- 2. الماكينة -->
        <div class="space-y-1">
          <label for="issueMachineType" class="block text-[11px] font-bold text-slate-300">
            ⚙️ ${t.machine || "الماكينة"} <span class="text-red-400">*</span>
          </label>
          ${buildMachineDropdownHtml("issueMachine", {
            placeholderLabel: t.selectMachine || "اختر الماكينة",
            typeSelectClass: "w-full py-1.5 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white outline-none focus:border-blue-500 transition text-xs shadow-sm",
            unitSelectClass: "w-full py-1.5 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white outline-none focus:border-blue-500 transition text-xs shadow-sm mt-1"
          })}
        </div>
      </div>

      <!-- 3 & 4: نوع البلاغ + درجة الأولوية في صف متجاوب -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <!-- 3. نوع البلاغ -->
        <div class="space-y-1">
          <label class="block text-[11px] font-bold text-slate-300">
            🏷️ ${t.issueType || "نوع البلاغ"}
          </label>
          <div class="hidden">
            <input type="radio" id="radioBreakdown" name="issueType" value="Breakdown" checked>
            <input type="radio" id="radioObs" name="issueType" value="Observation">
          </div>
          <div class="flex gap-1.5">
            <button type="button" id="btnTypeBreakdown" onclick="window.selectIssueType('Breakdown')"
              class="flex-1 py-1.5 px-2 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-red-500/20 border-red-500 text-red-300 shadow-sm">
              <span>⚠️ ${isAr ? "عطل مفاجئ" : "Breakdown"}</span>
            </button>
            <button type="button" id="btnTypeObs" onclick="window.selectIssueType('Observation')"
              class="flex-1 py-1.5 px-2 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
              <span>👁️ ${isAr ? "ملاحظة" : "Observation"}</span>
            </button>
          </div>
        </div>

        <!-- 4. درجة الأولوية -->
        <div class="space-y-1">
          <label class="block text-[11px] font-bold text-slate-300">
            ⚡ ${t.priority || "درجة الأولوية"}
          </label>
          <input type="hidden" id="issuePriority" value="Medium" />
          <div class="flex gap-1.5">
            <button type="button" id="btnPriority_High" onclick="window.selectIssuePriority('High')"
              class="flex-1 py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
              <span class="text-xs leading-none">🔴</span>
              <span>${isAr ? "عالية" : "High"}</span>
            </button>
            <button type="button" id="btnPriority_Medium" onclick="window.selectIssuePriority('Medium')"
              class="flex-1 py-1.5 px-1.5 rounded-lg font-black text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-amber-500 border-amber-300 text-slate-950 shadow-sm shadow-amber-500/30">
              <span class="text-xs leading-none">🟡</span>
              <span>${isAr ? "متوسطة" : "Medium"}</span>
            </button>
            <button type="button" id="btnPriority_Low" onclick="window.selectIssuePriority('Low')"
              class="flex-1 py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
              <span class="text-xs leading-none">🟢</span>
              <span>${isAr ? "منخفضة" : "Low"}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 5. تصنيف العطل (شرائح تفاعلية سريعة ومدمجة) -->
      <div class="space-y-1">
        <label class="block text-[11px] font-bold text-slate-300">
          🛠️ ${t.category || "تصنيف العطل"} <span class="text-red-400">*</span>
        </label>
        <input type="hidden" id="issueCategory" value="" />
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <button type="button" id="btnCat_كهرباء" onclick="window.selectIssueCategory('كهرباء')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>⚡ كهرباء</span>
          </button>
          <button type="button" id="btnCat_ميكانيكا" onclick="window.selectIssueCategory('ميكانيكا')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>⚙️ ميكانيكا</span>
          </button>
          <button type="button" id="btnCat_برمجة" onclick="window.selectIssueCategory('برمجة')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>💻 برمجة</span>
          </button>
          <button type="button" id="btnCat_Safety" onclick="window.selectIssueCategory('Safety')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>🛡️ سلامة</span>
          </button>
          <button type="button" id="btnCat_جودة" onclick="window.selectIssueCategory('جودة')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>📦 جودة</span>
          </button>
          <button type="button" id="btnCat_أخرى" onclick="window.selectIssueCategory('أخرى')"
            class="py-1.5 px-1.5 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 active:scale-95 bg-[#0F172A] border-slate-800 text-slate-400 hover:border-slate-700">
            <span>❓ أخرى</span>
          </button>
        </div>
      </div>

      <!-- 6. وصف المشكلة -->
      <div class="space-y-1">
        <label for="issueDescription" class="block text-[11px] font-bold text-slate-300">
          📋 ${t.description || "وصف المشكلة"} <span class="text-red-400">*</span>
        </label>
        <textarea id="issueDescription" rows="2"
          placeholder="${t.enterDescription || "اكتب وصف المشكلة بدقة..."}"
          class="w-full p-2 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white outline-none focus:border-blue-500 transition text-xs resize-none shadow-inner placeholder-slate-500"></textarea>
      </div>

      <!-- 7 & 8: مكان العطل داخل الماكينة + مقترح الحل في صف متجاوب -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label for="issueLocation" class="block text-[11px] font-bold text-slate-300">
            📍 ${t.locationInMachine || "مكان العطل بالتحديد"}
          </label>
          <input id="issueLocation" type="text"
            placeholder="مثال: Main Motor - Sensor - Bearing"
            class="w-full p-2 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white outline-none focus:border-blue-500 transition text-xs shadow-inner placeholder-slate-500">
        </div>

        <div class="space-y-1">
          <label for="issueSuggestion" class="block text-[11px] font-bold text-slate-300">
            💡 ${t.suggestion || "اقتراح الحل (اختياري)"}
          </label>
          <input id="issueSuggestion" type="text"
            placeholder="${t.enterSuggestion || "إذا كان لديك مقترح أولي للحل..."}"
            class="w-full p-2 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white outline-none focus:border-blue-500 transition text-xs shadow-inner placeholder-slate-500">
        </div>
      </div>

      <!-- 9. الصور المرفقة -->
      <div class="space-y-1">
        <label class="block text-[11px] font-bold text-slate-300">
          📷 ${t.attachPhoto || "صور توضيحية (اختياري)"}
        </label>
        ${buildAttachmentPickerHtml("issueImages", {
          emptyText: "لا توجد صور مرفقة",
          cameraButtonClass: "bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 rounded-lg py-1.5 px-2.5 text-blue-300 font-bold transition active:scale-95 text-xs flex items-center justify-center gap-1.5",
          galleryButtonClass: "bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg py-1.5 px-2.5 text-slate-300 font-bold transition active:scale-95 text-xs flex items-center justify-center gap-1.5",
          buttonsWrapperClass: "grid grid-cols-2 gap-2 mb-1"
        })}
      </div>

      <!-- 10. زر الحفظ والإرسال الميداني -->
      <div class="pt-1.5">
        <button type="button"
          onclick="window.confirmIssue()"
          class="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-white text-xs sm:text-sm transition active:scale-[0.98] shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2">
          <span>💾</span>
          <span>${t.saveAndSend || "حفظ وإرسال البلاغ"}</span>
        </button>
      </div>

    </div>
  </div>
  `;
};
