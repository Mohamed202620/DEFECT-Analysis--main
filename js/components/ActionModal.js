// ============================================================
// ActionModal.js
// نافذة صغيرة عامة لجمع بيانات إضافية قبل تنفيذ إجراء (إسناد/حل/رفض)
// بديل لـ prompt() المتصفح - بنفس أسلوب الألوان والتصميم المستخدم
// في باقي مكوّنات الواجهة (Tailwind + خلفية #1E293B).
// ============================================================

/**
 * يفتح نافذة صغيرة فوق الصفحة الحالية.
 *
 * @param {Object} options
 * @param {string} options.title - عنوان النافذة
 * @param {Array<Object>} options.fields - حقول الإدخال:
 *   { id, label, type: 'text' | 'textarea' | 'select', options?: [{value,label}] }
 * @param {string} [options.submitLabel] - نص زر التأكيد
 * @returns {Promise<Object|null>} قيم الحقول ({ [id]: value }) أو null لو أُلغيت
 */
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
              placeholder="${field.placeholder || ""}"></textarea>
          </div>
        `;
      }

      return `
        <div class="mb-3">
          <label class="block text-[11px] text-gray-400 mb-1">${field.label}</label>
          <input id="modal_${field.id}" type="text"
            class="w-full bg-[#0F172A] border border-gray-700 rounded-lg p-2.5 text-xs text-white"
            placeholder="${field.placeholder || ""}" />
        </div>
      `;

    }).join("");

    overlay.innerHTML = `
      <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-sm p-4 shadow-2xl">
        <h3 class="text-sm font-bold text-blue-400 mb-3">${title}</h3>
        <div>${fieldsHtml}</div>
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

    overlay.querySelector("#modal_cancel_btn").addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    overlay.querySelector("#modal_submit_btn").addEventListener("click", () => {
      const values = {};
      fields.forEach(field => {
        const el = overlay.querySelector(`#modal_${field.id}`);
        values[field.id] = el ? el.value.trim() : "";
      });
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
