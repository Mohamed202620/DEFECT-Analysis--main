// ============================================================
// ActionModal.js
// نافذة صغيرة عامة لجمع بيانات إضافية قبل تنفيذ إجراء (إسناد/حل/رفض)
// بديل لـ prompt() المتصفح - بنفس أسلوب الألوان والتصميم المستخدم
// في باقي مكوّنات الواجهة (Tailwind + خلفية #1E293B).
// ============================================================

import { compressImage } from "../workflow.js";
import { translations } from "../config.js";

// إصلاح (ترجمة شاملة): نصوص النافذة (إلغاء/تأكيد/رسائل الخطأ) كانت
// ثابتة بالعربي - دلوقتي بتقرأ من translations.actionModal حسب
// window.currentLang وقت فتح كل نافذة
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).actionModal;
}

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

export function openActionModal({ title, fields = [], submitLabel }) {

  return new Promise(resolve => {

    // القيمة الافتراضية بتتحدد وقت الاستدعاء (مش في الـ default
    // parameter) عشان تعكس اللغة الحالية فعلياً بدل ما تتجمّد على
    // العربي وقت تحميل الموديول
    submitLabel = submitLabel || t().confirm;

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
        return `
          <div class="mb-3">
            <label class="block text-[11px] text-gray-400 mb-1">${field.label} ${t().imagesLabelSuffix}</label>
            <input id="modal_${field.id}" type="file" accept="image/*" multiple capture="environment"
              class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-gray-300 file:mr-2 file:bg-blue-600 file:text-white file:border-0 file:rounded-md file:px-2 file:py-1 file:text-[11px]" />
            <div id="modal_${field.id}_preview" class="flex gap-2 mt-2"></div>
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
            ${t().cancel}
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

    // معاينة مصغّرة للصور المختارة (بحد أقصى 3، الباقي بيتجاهل)
    fields.filter(f => f.type === "images").forEach(field => {
      const input = overlay.querySelector(`#modal_${field.id}`);
      const preview = overlay.querySelector(`#modal_${field.id}_preview`);
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []).slice(0, 3);
        preview.innerHTML = files
          .map(f => `<span class="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded px-2 py-1">📷 ${f.name}</span>`)
          .join("");
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
      submitBtn.textContent = t().processing;

      const values = {};

      for (const field of fields) {

        const el = overlay.querySelector(`#modal_${field.id}`);

        if (field.type === "images") {

          const files = Array.from(el?.files || []).slice(0, 3);

          if (field.required && !files.length) {
            showError(`${field.label}: ${t().imagesRequired}`);
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
            return;
          }

          try {
            values[field.id] = await Promise.all(
              files.map(f => compressImage(f, 900, 0.75))
            );
          } catch (e) {
            showError(t().imagesError);
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
            return;
          }

        } else {

          const value = el ? el.value.trim() : "";

          if (field.required && !value) {
            showError(`${field.label}: ${t().fieldRequired}`);
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
