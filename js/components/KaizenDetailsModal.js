// ============================================================
// KaizenDetailsModal.js
// نافذة "تفاصيل ومراجعة" مقترح الكايزن الموثّق (kaizens collection)
// - عرض كامل البيانات + (للأدمن فقط) تغيير الحالة/ملاحظات المراجعة/
// مسؤول التنفيذ/تاريخ الإنجاز + زر تصدير PDF (راجع kaizenPdfExport.js)
// ============================================================

import { updateKaizenStatusApi, KAIZEN_MGMT_STATUSES } from "../services/kaizensApi.js";
import { exportKaizenPDF } from "../services/kaizenPdfExport.js";
import { isAdminRole, getCurrentRole } from "../permissions.js";

export const KAIZEN_MGMT_STATUS_LABELS = {
  submitted: { ar: "مُقدَّم", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under Review" },
  approved: { ar: "معتمد", en: "Approved" },
  implemented: { ar: "تم التنفيذ", en: "Implemented" },
  rejected: { ar: "مرفوض", en: "Rejected" }
};

export const KAIZEN_MGMT_STATUS_CLASSES = {
  submitted: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  approved: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  implemented: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20"
};

function escapeDetailsHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dv(value, isEn) {
  const str = (value === undefined || value === null) ? "" : String(value).trim();
  return str ? escapeDetailsHtml(str) : (isEn ? "—" : "—");
}

function formatKzDate(iso, isEn) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(isEn ? "en-US" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return escapeDetailsHtml(iso);
  }
}

function detailRowHtml(icon, label, value) {
  if (!value || value === "—") return `
    <div class="flex gap-2.5 items-start py-2 border-b border-gray-800/70 last:border-b-0">
      <span class="text-sm shrink-0 mt-0.5">${icon}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-bold text-gray-500 mb-0.5">${label}</div>
        <div class="text-xs text-gray-500 italic">—</div>
      </div>
    </div>
  `;
  return `
    <div class="flex gap-2.5 items-start py-2 border-b border-gray-800/70 last:border-b-0">
      <span class="text-sm shrink-0 mt-0.5">${icon}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-bold text-gray-500 mb-0.5">${label}</div>
        <div class="text-xs text-gray-100 leading-relaxed break-words whitespace-pre-line">${value}</div>
      </div>
    </div>
  `;
}

function imagesGridHtml(urls, emptyLabel) {
  if (!Array.isArray(urls) || !urls.length) {
    return `<div class="text-[11px] text-gray-600 italic py-2">${emptyLabel}</div>`;
  }
  return `
    <div class="grid ${urls.length > 1 ? "grid-cols-3 gap-1.5" : "grid-cols-1"}">
      ${urls.map(url => `
        <a href="${url}" target="_blank" rel="noopener">
          <img src="${url}" class="w-full ${urls.length > 1 ? "h-20" : "max-h-56"} object-cover rounded-lg border border-gray-800" />
        </a>
      `).join("")}
    </div>
  `;
}

function benefitsTableHtml(benefits, isEn) {
  const rows = Array.isArray(benefits) ? benefits.filter(b => b && (b.indicator || b.before || b.after || b.improvement)) : [];
  if (!rows.length) {
    return `<div class="text-[11px] text-gray-600 italic py-2">${isEn ? "No impact indicators recorded" : "لا توجد مؤشرات أثر مسجَّلة"}</div>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-[11px] border-collapse">
        <thead>
          <tr class="bg-amber-500/10 text-amber-300">
            <th class="border border-gray-800 p-1.5 font-bold">${isEn ? "KPI" : "المؤشر"}</th>
            <th class="border border-gray-800 p-1.5 font-bold">${isEn ? "Before" : "قبل"}</th>
            <th class="border border-gray-800 p-1.5 font-bold">${isEn ? "After" : "بعد"}</th>
            <th class="border border-gray-800 p-1.5 font-bold">${isEn ? "Improvement" : "التحسن/الوفر"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(b => `
            <tr>
              <td class="border border-gray-800 p-1.5 text-gray-200 font-bold">${dv(b.indicator, isEn)}</td>
              <td class="border border-gray-800 p-1.5 text-gray-400">${dv(b.before, isEn)}</td>
              <td class="border border-gray-800 p-1.5 text-gray-400">${dv(b.after, isEn)}</td>
              <td class="border border-gray-800 p-1.5 text-emerald-400 font-bold">${dv(b.improvement, isEn)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * فتح نافذة تفاصيل/مراجعة مقترح كايزن موثّق
 *
 * @param {Object} kaizen - المستند الكامل (id + كل الحقول)
 * @param {Object} [options]
 * @param {Function} [options.onStatusUpdated] - يُستدعى بعد نجاح تحديث الحالة (لإعادة تحميل اللوحة)
 */
export function openKaizenDetailsModal(kaizen, { onStatusUpdated } = {}) {

  const isEn = (window.currentLang || "ar") === "en";
  const status = kaizen.status || "submitted";
  const canReview = isAdminRole(getCurrentRole());

  let root = document.getElementById("kaizenDetailsModalRoot2");
  if (!root) {
    root = document.createElement("div");
    root.id = "kaizenDetailsModalRoot2";
    document.body.appendChild(root);
  }

  const machineOrLine = [kaizen.line, kaizen.machine].filter(Boolean).join(" - ");
  const initiatorLine = kaizen.initiator ? `${kaizen.initiator}${kaizen.initiatorRole ? ` (${kaizen.initiatorRole})` : ""}` : "";
  const datesRange = (kaizen.implementationStartDate || kaizen.implementationEndDate)
    ? `${formatKzDate(kaizen.implementationStartDate, isEn)} → ${formatKzDate(kaizen.implementationEndDate, isEn)}`
    : "";

  const statusOptionsHtml = KAIZEN_MGMT_STATUSES.map(s => `
    <option value="${s}" ${s === status ? "selected" : ""}>${KAIZEN_MGMT_STATUS_LABELS[s]?.[isEn ? "en" : "ar"] || s}</option>
  `).join("");

  const reviewSectionHtml = canReview ? `
    <div class="pt-3 mt-2 border-t border-gray-800 space-y-2.5">
      <div class="text-[10px] font-bold text-blue-400 mb-1 flex items-center gap-1.5">
        <span>🧾</span> ${isEn ? "Review & Evaluation (Admin)" : "المراجعة والتقييم (أدمن)"}
      </div>

      <div>
        <label class="block text-[10px] text-gray-400 mb-1">${isEn ? "Status" : "الحالة"}</label>
        <select id="kzReviewStatus" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
          ${statusOptionsHtml}
        </select>
      </div>

      <div>
        <label class="block text-[10px] text-gray-400 mb-1">${isEn ? "Review Notes" : "ملاحظات المراجعة"}</label>
        <textarea id="kzReviewNotes" rows="2" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white resize-none">${escapeDetailsHtml(kaizen.reviewNotes || "")}</textarea>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">${isEn ? "Implementation Owner" : "مسؤول التنفيذ"}</label>
          <input id="kzReviewOwner" type="text" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white" value="${escapeDetailsHtml(kaizen.implementationOwner || "")}" />
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">${isEn ? "Completion Date" : "تاريخ الإنجاز"}</label>
          <input id="kzReviewCompletionDate" type="date" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white" value="${kaizen.completionDate || ""}" />
        </div>
      </div>

      <div id="kzReviewErrorBox" class="hidden text-[11px] text-red-400"></div>

      <button id="kzReviewSaveBtn" class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition active:scale-95">
        💾 ${isEn ? "Save Evaluation" : "حفظ التقييم"}
      </button>
    </div>
  ` : `
    ${detailRowHtml("🧾", isEn ? "Review Notes" : "ملاحظات المراجعة", dv(kaizen.reviewNotes, isEn))}
    ${detailRowHtml("👷", isEn ? "Implementation Owner" : "مسؤول التنفيذ", dv(kaizen.implementationOwner, isEn))}
    ${detailRowHtml("🏁", isEn ? "Completion Date" : "تاريخ الإنجاز", formatKzDate(kaizen.completionDate, isEn))}
  `;

  root.innerHTML = `
    <div id="kaizenDetailsModalOverlay2" class="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        <!-- Header -->
        <div class="flex items-start justify-between gap-2 p-4 border-b border-gray-800 shrink-0">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <span>💡</span> ${dv(kaizen.kaizenNumber, isEn)}
            </div>
            <h3 class="text-sm font-bold text-gray-100 break-words">${dv(kaizen.title, isEn)}</h3>
          </div>
          <button id="kzDetailsCloseBtn" aria-label="close" class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[#0E1117] border border-gray-700 text-gray-400 hover:text-white transition active:scale-95">✕</button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-4 space-y-0.5">

          <div class="flex items-center justify-between pb-2.5 mb-1 border-b border-gray-800/70">
            <span class="text-[10px] font-bold text-gray-500">${isEn ? "Current Status" : "الحالة الحالية"}</span>
            <span class="text-[10px] px-2.5 py-1 rounded-full font-bold ${KAIZEN_MGMT_STATUS_CLASSES[status] || "bg-gray-500/10 text-gray-400"}">
              ${KAIZEN_MGMT_STATUS_LABELS[status]?.[isEn ? "en" : "ar"] || status}
            </span>
          </div>

          ${detailRowHtml("🏷️", isEn ? "Category" : "مجال التحسين", dv(kaizen.category, isEn))}
          ${detailRowHtml("🏢", isEn ? "Department" : "القسم", dv(kaizen.department, isEn))}
          ${detailRowHtml("⚙️", isEn ? "Line / Machine" : "الخط / الماكينة", dv(machineOrLine, isEn))}
          ${detailRowHtml("🙋", isEn ? "Initiator" : "صاحب الفكرة", dv(initiatorLine, isEn))}
          ${detailRowHtml("👥", isEn ? "Execution Team" : "فريق التنفيذ", dv(kaizen.executionTeam, isEn))}
          ${detailRowHtml("📅", isEn ? "Submission Date" : "تاريخ التقديم", formatKzDate(kaizen.submissionDate, isEn))}
          ${detailRowHtml("🗓️", isEn ? "Implementation Period" : "فترة التنفيذ", dv(datesRange, isEn))}

          <div class="pt-3 mt-2 border-t border-gray-800">
            <div class="text-[10px] font-bold text-red-300 mb-1.5">⚠️ ${isEn ? "Problem" : "المشكلة"}</div>
            <p class="text-xs text-gray-200 leading-relaxed whitespace-pre-line mb-2">${dv(kaizen.problem, isEn)}</p>
            ${imagesGridHtml(kaizen.beforeImageUrls, isEn ? "No before photos" : "لا توجد صور قبل")}
          </div>

          <div class="pt-3 mt-2 border-t border-gray-800">
            <div class="text-[10px] font-bold text-emerald-300 mb-1.5">💡 ${isEn ? "Solution" : "الحل المقترح"}</div>
            <p class="text-xs text-gray-200 leading-relaxed whitespace-pre-line mb-2">${dv(kaizen.solution, isEn)}</p>
            ${imagesGridHtml(kaizen.afterImageUrls, isEn ? "No after photos" : "لا توجد صور بعد")}
          </div>

          <div class="pt-3 mt-2 border-t border-gray-800">
            <div class="text-[10px] font-bold text-amber-300 mb-1.5">📊 ${isEn ? "Impact & Benefits" : "الأثر والنتائج"}</div>
            ${benefitsTableHtml(kaizen.benefits, isEn)}
          </div>

          ${detailRowHtml("📝", isEn ? "SOP Update" : "تحديث الإجراء القياسي (SOP)", dv(kaizen.sopUpdate, isEn))}
          ${detailRowHtml("🔁", isEn ? "Horizontal Deployment" : "التعميم الأفقي", dv(kaizen.horizontalDeployment, isEn))}

          ${reviewSectionHtml}

        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-gray-800 shrink-0 flex gap-2">
          <button id="kzExportPdfBtn" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition active:scale-95">
            📄 ${isEn ? "Export PDF" : "تصدير PDF"}
          </button>
          <button id="kzDetailsCloseBtn2" class="flex-1 bg-[#0E1117] border border-gray-700 text-gray-300 text-xs font-bold py-2.5 rounded-lg hover:border-gray-600 transition active:scale-95">
            ${isEn ? "Close" : "إغلاق"}
          </button>
        </div>

      </div>
    </div>
  `;

  const handleEscape = (event) => { if (event.key === "Escape") closeModal(); };

  function closeModal() {
    root.innerHTML = "";
    document.removeEventListener("keydown", handleEscape);
  }

  document.addEventListener("keydown", handleEscape);

  root.querySelector("#kzDetailsCloseBtn").addEventListener("click", closeModal);
  root.querySelector("#kzDetailsCloseBtn2").addEventListener("click", closeModal);
  root.querySelector("#kaizenDetailsModalOverlay2").addEventListener("click", e => {
    if (e.target.id === "kaizenDetailsModalOverlay2") closeModal();
  });

  root.querySelector("#kzExportPdfBtn").addEventListener("click", async () => {
    const btn = root.querySelector("#kzExportPdfBtn");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = isEn ? "⏳ Preparing..." : "⏳ جاري التجهيز...";
    try {
      await exportKaizenPDF(kaizen);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  if (canReview) {
    root.querySelector("#kzReviewSaveBtn").addEventListener("click", async () => {
      const newStatus = root.querySelector("#kzReviewStatus").value;
      const reviewNotes = root.querySelector("#kzReviewNotes").value.trim();
      const implementationOwner = root.querySelector("#kzReviewOwner").value.trim();
      const completionDate = root.querySelector("#kzReviewCompletionDate").value;

      const errorBox = root.querySelector("#kzReviewErrorBox");
      errorBox.classList.add("hidden");

      if ((newStatus === "rejected" || newStatus === "approved") && !reviewNotes) {
        errorBox.textContent = isEn ? "Review notes are required for this status" : "ملاحظات المراجعة مطلوبة لهذه الحالة";
        errorBox.classList.remove("hidden");
        return;
      }

      const saveBtn = root.querySelector("#kzReviewSaveBtn");
      const original = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = isEn ? "⏳ Saving..." : "⏳ جاري الحفظ...";

      const result = await updateKaizenStatusApi(kaizen.id, newStatus, reviewNotes, {
        implementationOwner,
        completionDate
      });

      saveBtn.disabled = false;
      saveBtn.innerHTML = original;

      if (result.status !== "success") {
        errorBox.textContent = result.message || (isEn ? "Failed to save, try again" : "فشل الحفظ، حاول مرة أخرى");
        errorBox.classList.remove("hidden");
        return;
      }

      closeModal();
      if (typeof onStatusUpdated === "function") onStatusUpdated();
    });
  }

}

window.openKaizenDetailsModal = openKaizenDetailsModal;
