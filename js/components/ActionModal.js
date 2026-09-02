// ============================================================
// ActionModal.js
// نافذة صغيرة عامة لجمع بيانات إضافية قبل تنفيذ إجراء (إسناد/حل/رفض)
// بديل لـ prompt() المتصفح - بنفس أسلوب الألوان والتصميم المستخدم
// في باقي مكوّنات الواجهة (Tailwind + خلفية #1E293B).
// ============================================================

import { buildAttachmentPickerHtml, initAttachmentPicker, getAttachmentFiles } from "./attachmentPicker.js";

/**
 * يفتح نافذة صغيرة فوق الصفحة الحالية.
 *
 * @param {Object} options
 * @param {string} options.title - عنوان النافذة
 * @param {Array<Object>} options.fields - حقول الإدخال:
 *   { id, label, type: 'text' | 'textarea' | 'select' | 'images', options?, required? }
 *   'images': يسمح باختيار 1-3 صور، بيرجعوا كمصفوفة Base64 مضغوطة
 * @param {string} [options.submitLabel] - نص زر التأكيد
 * @returns {Promise<Object|null>} قيم الحقول ({ [id]: value }) أو null لو أُلغيت
 */
// تنقية أي نص هيتحط داخل قيمة attribute في الـ HTML (زي value="..."
// أو placeholder="...") - بدون كده، لو النص (مثلاً عنوان مقترح كايزن
// قديم) فيه علامة تنصيص "، الـ attribute بيتقفل بدري وبيكسر باقي
// الـ HTML بتاع الحقل (بيمنع ظهور/تعبئة الحقل صح جوه نافذة التعديل)
function escapeModalAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function openActionModal({ title, fields = [], submitLabel = "تأكيد" }) {

  return new Promise(resolve => {

    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4";

    const fieldsHtml = fields.map(field => {

      if (field.type === "select") {
        const optionsHtml = (field.options || [])
          .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
          .join("");

        return `
          <div class="mb-3">
            <label class="block text-[11px] text-gray-400 mb-1">${field.label}</label>
            <select id="modal_${field.id}"
              class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2.5 text-xs text-white">
              ${optionsHtml}
            </select>
          </div>
        `;
      }

      if (field.type === "textarea") {
        return `
          <div class="mb-3">
            <label class="block text-[11px] text-gray-400 mb-1">${field.label}</label>
            <textarea id="modal_${field.id}" rows="3"
              class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2.5 text-xs text-white"
              placeholder="${escapeModalAttr(field.placeholder)}">${escapeModalAttr(field.defaultValue)}</textarea>
          </div>
        `;
      }

      if (field.type === "images") {
        // معرّف مجموعة فريد لكل فتحة نافذة (حتى لو نفس field.id
        // اتكرر في نافذة تانية لاحقاً) - يمنع أي تداخل في الحالة
        // بين نافذتين، ويضمن بداية نظيفة (بدون صور قديمة) كل مرة
        const groupId = `actionModal_${field.id}_${Date.now()}`;
        field._attachmentGroupId = groupId;

        return `
          <div class="mb-3">
            <label class="block text-[11px] text-gray-400 mb-1">${field.label} (حتى 3 صور)</label>
            ${buildAttachmentPickerHtml(groupId, {
              cameraLabel: "📷 التقاط",
              galleryLabel: "🖼️ المعرض",
              emptyText: "لا توجد صور مرفقة",
              buttonsWrapperClass: "grid grid-cols-2 gap-2 mb-2",
              cameraButtonClass: "bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 rounded-lg p-2 text-blue-400 font-bold transition active:scale-95 text-[11px] flex items-center justify-center gap-1.5",
              galleryButtonClass: "bg-gray-700/50 border border-gray-600 hover:bg-gray-700 rounded-lg p-2 text-gray-300 font-bold transition active:scale-95 text-[11px] flex items-center justify-center gap-1.5",
              gridClass: "grid grid-cols-4 gap-1.5 mb-1"
            })}
          </div>
        `;
      }

      return `
        <div class="mb-3">
          <label class="block text-[11px] text-gray-400 mb-1">${field.label}</label>
          <input id="modal_${field.id}" type="text"
            class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2.5 text-xs text-white"
            placeholder="${field.placeholder || ""}" value="${field.defaultValue || ""}" />
        </div>
      `;

    }).join("");

    overlay.innerHTML = `
      <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-sm p-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-sm font-bold text-blue-400 mb-3">${title}</h3>
        <div>${fieldsHtml}</div>
        <div id="modal_error" class="hidden text-[11px] text-red-400 mb-2"></div>
        <div class="flex gap-2 mt-2">
          <button id="modal_cancel_btn"
            class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2.5 rounded-lg">
            إلغاء
          </button>
          <button id="modal_submit_btn"
            class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-lg">
            ${submitLabel}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
    };

    // تفعيل مكوّن اختيار الصور المتعددة لكل حقل "images" - اختيار
    // أكثر من صورة دفعة واحدة، إضافة صور لاحقًا بدون فقدان القديمة،
    // ومعاينة + حذف مستقل لكل صورة (بدل معاينة نصية بأسماء الملفات
    // فقط بدون إمكانية حذف كانت موجودة سابقاً)
    fields.filter(f => f.type === "images").forEach(field => {
      initAttachmentPicker(field._attachmentGroupId, {
        maxFiles: 3,
        maxFileSizeMB: 10,
        emptyText: "لا توجد صور مرفقة"
      });
    });

    overlay.querySelector("#modal_cancel_btn").addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    const showError = (msg) => {
      const errBox = overlay.querySelector("#modal_error");
      errBox.textContent = msg;
      errBox.classList.remove("hidden");
    };

    overlay.querySelector("#modal_submit_btn").addEventListener("click", async () => {

      const submitBtn = overlay.querySelector("#modal_submit_btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "جاري المعالجة...";

      const values = {};

      for (const field of fields) {

        const el = overlay.querySelector(`#modal_${field.id}`);

        if (field.type === "images") {

          const dataUrls = getAttachmentFiles(field._attachmentGroupId);

          if (field.required && !dataUrls.length) {
            showError(`${field.label}: لازم صورة واحدة على الأقل`);
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
            return;
          }

          values[field.id] = dataUrls;

        } else {

          const value = el ? el.value.trim() : "";

          if (field.required && !value) {
            showError(`${field.label}: مطلوب`);
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
            return;
          }

          values[field.id] = value;

        }

      }

      cleanup();
      resolve(values);

    });

    // إغلاق بالضغط على الخلفية الشفافة
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

  });

}

window.openActionModal = openActionModal;
