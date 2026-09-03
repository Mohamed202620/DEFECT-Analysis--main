// ============================================================
// KaizenFormModal.js
// نافذة "إضافة مقترح كايزن جديد" (توثيق رسمي - Kaizen Completion
// Sheet) لصفحة "متابعة وتقييم مقترحات الكايزن" (kaizenManagement.js)
//
// مستقلة تماماً عن ActionModal.js (مش مناسب لعدد الحقول والصفوف
// الديناميكية - Benefits KPI Rows) وعن فورم suggestionView.js
// (مجموعة بيانات "suggestions" مختلفة تماماً) - بس بتُعيد استخدام
// نفس مكوّنات الماكينة/المرفقات الموجودة فعلاً بالمشروع.
// ============================================================

import { buildMachineDropdownHtml } from "../machines.js";
import {
  buildAttachmentPickerHtml,
  initAttachmentPicker,
  getAttachmentFiles,
  resetAttachmentFiles
} from "./attachmentPicker.js";

export const KAIZEN_CATEGORY_OPTIONS = [
  { value: "productivity", ar: "صيانة وإنتاجية (Productivity)", en: "Productivity" },
  { value: "quality", ar: "جودة (Quality)", en: "Quality" },
  { value: "safety", ar: "سلامة مهنية (Safety)", en: "Safety" },
  { value: "cost", ar: "تخفيض تكلفة (Cost Reduction)", en: "Cost Reduction" },
  { value: "maintenance", ar: "صيانة (Maintenance)", en: "Maintenance" },
  { value: "ergonomics", ar: "سهولة العمل (Ergonomics)", en: "Ergonomics" }
];

function escapeFormAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inputClass() {
  return "w-full p-2.5 rounded-lg bg-[#0E1117] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors";
}

let benefitRowSeq = 0;

function benefitRowHtml(row = {}) {
  benefitRowSeq += 1;
  const rowId = `kzBenefitRow_${benefitRowSeq}`;
  return `
    <div id="${rowId}" class="kz-benefit-row grid grid-cols-4 gap-1.5 items-center">
      <input type="text" class="kz-benefit-indicator ${inputClass()} !p-2 !text-[11px]" placeholder="مؤشر القياس" value="${escapeFormAttr(row.indicator)}" />
      <input type="text" class="kz-benefit-before ${inputClass()} !p-2 !text-[11px]" placeholder="قبل" value="${escapeFormAttr(row.before)}" />
      <input type="text" class="kz-benefit-after ${inputClass()} !p-2 !text-[11px]" placeholder="بعد" value="${escapeFormAttr(row.after)}" />
      <div class="flex items-center gap-1">
        <input type="text" class="kz-benefit-improvement ${inputClass()} !p-2 !text-[11px]" placeholder="الوفر/التحسن" value="${escapeFormAttr(row.improvement)}" />
        <button type="button" onclick="document.getElementById('${rowId}').remove()" class="shrink-0 w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition active:scale-90">✕</button>
      </div>
    </div>
  `;
}

/**
 * فتح نافذة إضافة مقترح كايزن جديد
 * @returns {Promise<Object|null>} بيانات النموذج الكاملة، أو null لو أُلغيت
 */
export function openKaizenFormModal() {
  return new Promise(resolve => {

    const isEn = (window.currentLang || "ar") === "en";
    const todayIso = new Date().toISOString().slice(0, 10);
    const myName = localStorage.getItem("name") || "";

    const overlay = document.createElement("div");
    overlay.id = "kaizenFormModalOverlay";
    overlay.className = "fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4";

    const categoryOptionsHtml = KAIZEN_CATEGORY_OPTIONS
      .map(opt => `<option value="${opt.value}">${isEn ? opt.en : opt.ar}</option>`)
      .join("");

    overlay.innerHTML = `
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        <!-- Header -->
        <div class="flex items-center justify-between gap-2 p-4 border-b border-gray-800 shrink-0">
          <h3 class="text-sm font-bold text-amber-400 flex items-center gap-1.5">
            <span>💡</span> ${isEn ? "New Kaizen Proposal" : "إضافة مقترح كايزن جديد"}
          </h3>
          <button id="kzFormCloseBtn" aria-label="close" class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0E1117] border border-gray-700 text-gray-400 hover:text-white transition active:scale-95">✕</button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-4 space-y-4 text-white">

          <!-- بيانات أساسية -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Idea Title" : "عنوان المقترح / الفكرة"}</label>
              <input id="kzTitle" type="text" class="${inputClass()}" placeholder="${isEn ? "e.g., Reduce changeover time..." : "مثال: تقليل وقت التوقف وتسهيل ضبط مسار العلب"}" />
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Category" : "مجال التحسين (Category)"}</label>
              <select id="kzCategory" class="${inputClass()}">
                <option value="" disabled selected>${isEn ? "Select category..." : "اختر التصنيف..."}</option>
                ${categoryOptionsHtml}
              </select>
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Department" : "القسم"}</label>
              <input id="kzDepartment" type="text" class="${inputClass()}" placeholder="${isEn ? "e.g., Maintenance" : "مثال: الصيانة"}" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Line / Machine" : "الخط / الماكينة"}</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input id="kzLine" type="text" class="${inputClass()}" placeholder="${isEn ? "Line (e.g., Line 2)" : "الخط (مثال: الخط 2)"}" />
                ${buildMachineDropdownHtml("kzMachine", {
                  placeholderLabel: isEn ? "Select machine type" : "اختر نوع الماكينة",
                  unitPlaceholderLabel: isEn ? "Select unit" : "اختر الرقم",
                  typeSelectClass: inputClass(),
                  unitSelectClass: inputClass() + " mt-2"
                })}
              </div>
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Initiator" : "صاحب الفكرة (مقدم المقترح)"}</label>
              <input id="kzInitiator" type="text" class="${inputClass()}" value="${escapeFormAttr(myName)}" />
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Execution Team" : "فريق التنفيذ"}</label>
              <input id="kzExecutionTeam" type="text" class="${inputClass()}" placeholder="${isEn ? "e.g., Maintenance + Production team" : "مثال: فريق صيانة وإنتاج التشغيل"}" />
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Submission Date" : "تاريخ التقديم"}</label>
              <input id="kzSubmissionDate" type="date" class="${inputClass()}" value="${todayIso}" />
            </div>
            <div>
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Implementation Start" : "بداية التنفيذ"}</label>
              <input id="kzImplStart" type="date" class="${inputClass()}" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] text-gray-400 mb-1">${isEn ? "Implementation End" : "نهاية التنفيذ"}</label>
              <input id="kzImplEnd" type="date" class="${inputClass()}" />
            </div>
          </div>

          <!-- المشكلة والحل -->
          <div class="grid grid-cols-1 gap-3 pt-2 border-t border-gray-800">
            <div>
              <label class="block text-[11px] text-red-300 mb-1">⚠️ ${isEn ? "Problem (Previous State / Waste)" : "المشكلة (الوضع السابق / الهدر)"}</label>
              <textarea id="kzProblem" rows="2" class="${inputClass()} resize-none" placeholder="${isEn ? "Describe the current problem or waste..." : "صف المشكلة الحالية أو الهدر الموجود..."}"></textarea>
            </div>
            <div>
              <label class="block text-[11px] text-emerald-300 mb-1">💡 ${isEn ? "Proposed Solution" : "الحل المقترح / التحسين"}</label>
              <textarea id="kzSolution" rows="2" class="${inputClass()} resize-none" placeholder="${isEn ? "Describe the proposed solution..." : "اكتب خطوات الحل أو طريقة التحسين..."}"></textarea>
            </div>
          </div>

          <!-- صور قبل/بعد -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
            <div>
              <label class="block text-[11px] text-red-300 mb-1">📷 ${isEn ? "Before Photo(s)" : "صورة/صور الوضع قبل التحسين"}</label>
              ${buildAttachmentPickerHtml("kzBeforeImages", {
                emptyText: isEn ? "No before photos" : "لا توجد صور",
                gridClass: "grid grid-cols-3 gap-1.5 mb-1"
              })}
            </div>
            <div>
              <label class="block text-[11px] text-emerald-300 mb-1">📷 ${isEn ? "After Photo(s)" : "صورة/صور الوضع بعد التحسين"}</label>
              ${buildAttachmentPickerHtml("kzAfterImages", {
                emptyText: isEn ? "No after photos" : "لا توجد صور",
                gridClass: "grid grid-cols-3 gap-1.5 mb-1"
              })}
            </div>
          </div>

          <!-- الأثر والنتائج (Benefits KPI) -->
          <div class="pt-2 border-t border-gray-800">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-[11px] text-amber-300 font-bold">📊 ${isEn ? "Impact & Benefits (KPIs)" : "الأثر والنتائج (مؤشرات القياس)"}</label>
              <button type="button" id="kzAddBenefitRowBtn" class="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition active:scale-95">
                + ${isEn ? "Add Row" : "إضافة مؤشر"}
              </button>
            </div>
            <div class="grid grid-cols-4 gap-1.5 mb-1 text-[10px] text-gray-500 font-bold px-0.5">
              <span>${isEn ? "KPI" : "المؤشر"}</span>
              <span>${isEn ? "Before" : "قبل"}</span>
              <span>${isEn ? "After" : "بعد"}</span>
              <span>${isEn ? "Improvement" : "التحسن/الوفر"}</span>
            </div>
            <div id="kzBenefitsRowsContainer" class="space-y-1.5">
              ${benefitRowHtml()}
            </div>
          </div>

          <!-- التعميم والتقييس -->
          <div class="grid grid-cols-1 gap-3 pt-2 border-t border-gray-800">
            <div>
              <label class="block text-[11px] text-gray-400 mb-1">📝 ${isEn ? "SOP Update" : "تحديث إجراء العمل القياسي (SOP)"}</label>
              <textarea id="kzSopUpdate" rows="2" class="${inputClass()} resize-none" placeholder="${isEn ? "e.g., Updated maintenance safety SOP #..." : "مثال: تم تحديث تعليمات الضبط الوقائي رقم..."}"></textarea>
            </div>
            <div>
              <label class="block text-[11px] text-gray-400 mb-1">🔁 ${isEn ? "Horizontal Deployment" : "التعميم الأفقي"}</label>
              <textarea id="kzHorizontalDeployment" rows="2" class="${inputClass()} resize-none" placeholder="${isEn ? "e.g., Applied to lines 1 and 3 as well..." : "مثال: تم تعميم نفس التحسين على الخطوط 1 و 3..."}"></textarea>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div id="kzFormErrorBox" class="hidden text-[11px] text-red-400 px-4 pb-1"></div>
        <div class="p-3 border-t border-gray-800 shrink-0 flex gap-2">
          <button id="kzFormCancelBtn" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2.5 rounded-lg transition active:scale-95">
            ${isEn ? "Cancel" : "إلغاء"}
          </button>
          <button id="kzFormSubmitBtn" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-lg transition active:scale-95">
            ${isEn ? "Save Proposal" : "حفظ المقترح"}
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // تفريغ أي صور متبقية من فتح سابق للنافذة (نفس Map مشترك عالمياً
    // في attachmentPicker.js) قبل التهيئة، لتفادي ظهور صور فتحة سابقة
    resetAttachmentFiles("kzBeforeImages");
    resetAttachmentFiles("kzAfterImages");

    initAttachmentPicker("kzBeforeImages", { maxFiles: 3, emptyText: isEn ? "No before photos" : "لا توجد صور" });
    initAttachmentPicker("kzAfterImages", { maxFiles: 3, emptyText: isEn ? "No after photos" : "لا توجد صور" });

    const cleanup = () => overlay.remove();

    overlay.querySelector("#kzAddBenefitRowBtn").addEventListener("click", () => {
      const container = overlay.querySelector("#kzBenefitsRowsContainer");
      container.insertAdjacentHTML("beforeend", benefitRowHtml());
    });

    overlay.querySelector("#kzFormCloseBtn").addEventListener("click", () => { cleanup(); resolve(null); });
    overlay.querySelector("#kzFormCancelBtn").addEventListener("click", () => { cleanup(); resolve(null); });

    overlay.addEventListener("click", e => {
      if (e.target === overlay) { cleanup(); resolve(null); }
    });

    const showError = msg => {
      const box = overlay.querySelector("#kzFormErrorBox");
      box.textContent = msg;
      box.classList.remove("hidden");
    };

    overlay.querySelector("#kzFormSubmitBtn").addEventListener("click", () => {

      const val = id => (overlay.querySelector(`#${id}`)?.value || "").trim();

      const title = val("kzTitle");
      const problem = val("kzProblem");
      const solution = val("kzSolution");
      const machine = val("kzMachine");

      if (!title) return showError(isEn ? "Idea title is required" : "عنوان المقترح مطلوب");
      if (!problem) return showError(isEn ? "Problem description is required" : "وصف المشكلة مطلوب");
      if (!solution) return showError(isEn ? "Proposed solution is required" : "الحل المقترح مطلوب");

      const benefits = Array.from(overlay.querySelectorAll(".kz-benefit-row")).map(row => ({
        indicator: row.querySelector(".kz-benefit-indicator")?.value.trim() || "",
        before: row.querySelector(".kz-benefit-before")?.value.trim() || "",
        after: row.querySelector(".kz-benefit-after")?.value.trim() || "",
        improvement: row.querySelector(".kz-benefit-improvement")?.value.trim() || ""
      })).filter(b => b.indicator || b.before || b.after || b.improvement);

      const data = {
        title,
        category: val("kzCategory"),
        department: val("kzDepartment"),
        line: val("kzLine"),
        machine,
        initiator: val("kzInitiator"),
        executionTeam: val("kzExecutionTeam"),
        submissionDate: val("kzSubmissionDate"),
        implementationStartDate: val("kzImplStart"),
        implementationEndDate: val("kzImplEnd"),
        problem,
        solution,
        beforeImages: getAttachmentFiles("kzBeforeImages"),
        afterImages: getAttachmentFiles("kzAfterImages"),
        benefits,
        sopUpdate: val("kzSopUpdate"),
        horizontalDeployment: val("kzHorizontalDeployment")
      };

      cleanup();
      resolve(data);

    });

  });
}

window.openKaizenFormModal = openKaizenFormModal;
