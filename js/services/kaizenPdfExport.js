// ============================================================
// kaizenPdfExport.js
// قالب PDF مستقل بالكامل (Template منفصل) لتصدير "تقرير إغلاق
// كايزن" (Kaizen Completion Sheet) بتصميم احترافي A4/RTL قريب جداً
// من النموذج الرسمي المعتمد لدى MSCANCO EGYPT.
//
// يُستخدم مكتبة html2pdf.js (محمّلة عالمياً بالفعل من index.html -
// راجع <script src=".../html2pdf.bundle.min.js">) بدل الأسلوب اليدوي
// (html2canvas + jsPDF منفصلين) المستخدم في exportUtility.js، عشان
// نستفيد من ميزة تقسيم الصفحات المدمجة فيها (pagebreak options) مع
// نفس موثوقية الالتقاط (html2canvas داخلياً بالفعل جوه html2pdf.js).
//
// مبدأ أساسي: لا يتم اختلاق أي بيانات غير موجودة فعلياً في مستند
// الكايزن - أي حقل فارغ/غير معرَّف يظهر كـ "—" بدل تجاهله أو تخمينه.
// ============================================================

import { getCompanyLogoDataUrl, COMPANY_NAME_AR, COMPANY_NAME_EN } from "../branding.js";

// نفس تسميات/ألوان حالات مقترحات الكايزن الموثّقة المستخدمة في
// kaizenManagement.js - مُعرَّفة هنا بشكل مستقل عمداً (بدون استيراد
// من ملف الواجهة) عشان قالب الـ PDF يفضل وحدة مستقلة قائمة بذاتها
const KAIZEN_PDF_STATUS_META = {
  submitted: {
    ar: "مُقدَّم", en: "Submitted",
    banner: { ar: "⏳ المقترح قيد الانتظار للمراجعة الأولية", en: "⏳ Proposal pending initial review" },
    color: "#b45309", bg: "#fffbeb", border: "#fcd34d"
  },
  under_review: {
    ar: "قيد المراجعة", en: "Under Review",
    banner: { ar: "🔍 المقترح قيد المراجعة الفنية حالياً", en: "🔍 Proposal currently under technical review" },
    color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd"
  },
  approved: {
    ar: "معتمد", en: "Approved",
    banner: { ar: "✅ تم اعتماد المقترح وجاري التنفيذ", en: "✅ Proposal approved and in progress" },
    color: "#047857", bg: "#ecfdf5", border: "#6ee7b7"
  },
  implemented: {
    ar: "تم التنفيذ والتعميم", en: "Implemented & Standardized",
    banner: { ar: "✅ تم تنفيذ التحسين وتثبيت المعيار بنجاح (Status: COMPLETED & STANDARDIZED)", en: "✅ Improvement implemented and standard locked-in (Status: COMPLETED & STANDARDIZED)" },
    color: "#047857", bg: "#ecfdf5", border: "#6ee7b7"
  },
  rejected: {
    ar: "مرفوض", en: "Rejected",
    banner: { ar: "❌ تم رفض هذا المقترح", en: "❌ This proposal was rejected" },
    color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5"
  }
};

function escapePdfHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// أي قيمة فارغة/غير موجودة تظهر "—" - لا يتم اختلاق أي بديل نصي لها
function v(value) {
  const str = (value === undefined || value === null) ? "" : String(value).trim();
  return str ? escapePdfHtml(str) : "—";
}

function formatPdfDate(input, isAr) {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return escapePdfHtml(input);
    return d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return escapePdfHtml(input);
  }
}

// ------------------------------------------------------------
// كتلة الهيدر الرسمي (لوجو الشركة + عنوان التقرير ورقم الكايزن)
// ------------------------------------------------------------
function buildHeaderBlockHtml(kaizen, logoDataUrl, isAr) {
  const titleAr = "تقرير إغلاق كايزن (Kaizen Completion Sheet)";
  const titleEn = "Kaizen Completion Report";

  const logoImgHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="height:46px; max-width:100%; object-fit:contain; display:block;" />`
    : `<div style="font-weight:bold; font-size:14px; color:#0B3D91;">MSCANCO EGYPT</div>`;

  return `
    <div style="background:#0f172a; border-radius:12px; padding:14px 18px; margin-bottom:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:10px;">
        <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); border-radius:10px; padding:8px 14px;">
          <span style="color:#e2e8f0; font-weight:bold; font-size:12.5px;">${isAr ? titleAr : titleEn}</span>
        </div>
        <div style="text-align:${isAr ? "left" : "right"};">
          <div style="color:#f8fafc; font-weight:900; font-size:16px; letter-spacing:0.5px;">
            MSCANCO <span style="color:#f5a623;">EGYPT</span>
          </div>
          <div style="color:#94a3b8; font-size:9.5px; font-weight:600; max-width:340px;">
            ${isAr ? escapePdfHtml(COMPANY_NAME_AR) : escapePdfHtml(COMPANY_NAME_EN)}
          </div>
        </div>
        <div style="shrink:0;">${logoImgHtml}</div>
      </div>
      <div style="padding-top:8px; color:#94a3b8; font-size:10.5px; font-weight:600;">
        ${isAr ? "رقم التقرير" : "Report No."}: <span style="color:#f5a623; font-weight:bold;">${v(kaizen.kaizenNumber)}</span>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// شبكة بيانات المقترح الأساسية (٦ خلايا)
// ------------------------------------------------------------
function infoCellHtml(icon, label, value) {
  return `
    <div style="flex:1; min-width:0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:9px 12px;">
      <div style="font-size:9.5px; color:#64748b; font-weight:bold; margin-bottom:3px;">${icon ? icon + " " : ""}${label}</div>
      <div style="font-size:11.5px; color:#0f172a; font-weight:bold; word-wrap:break-word;">${value}</div>
    </div>
  `;
}

function buildInfoGridHtml(kaizen, isAr) {
  const machineOrLine = [kaizen.line, kaizen.machine].filter(Boolean).map(escapePdfHtml).join(" - ") || "—";
  const initiator = kaizen.initiator
    ? `${escapePdfHtml(kaizen.initiator)}${kaizen.initiatorRole ? ` (${escapePdfHtml(kaizen.initiatorRole)})` : ""}`
    : "—";
  const datesRange = (kaizen.implementationStartDate || kaizen.implementationEndDate)
    ? `${formatPdfDate(kaizen.implementationStartDate, isAr)} → ${formatPdfDate(kaizen.implementationEndDate, isAr)}`
    : "—";

  const row1 = [
    infoCellHtml("🏷️", isAr ? "مجال التحسين (Category)" : "Category", v(kaizen.category)),
    infoCellHtml("⚙️", isAr ? "الخط / الماكينة" : "Line / Machine", machineOrLine),
    infoCellHtml("💡", isAr ? "عنوان المقترح / الفكرة" : "Idea Title", v(kaizen.title))
  ];

  const row2 = [
    infoCellHtml("👥", isAr ? "فريق التنفيذ" : "Execution Team", v(kaizen.executionTeam)),
    infoCellHtml("📅", isAr ? "تاريخ التقديم → التنفيذ" : "Submission → Implementation", datesRange),
    infoCellHtml("🙋", isAr ? "صاحب الفكرة (Initiator)" : "Initiator", initiator)
  ];

  return `
    <div style="display:flex; gap:8px; margin-bottom:8px;">${row1.join("")}</div>
    <div style="display:flex; gap:8px; margin-bottom:14px;">${row2.join("")}</div>
  `;
}

// ------------------------------------------------------------
// شريط الحالة (Status Banner)
// ------------------------------------------------------------
function buildStatusBannerHtml(kaizen, isAr) {
  const meta = KAIZEN_PDF_STATUS_META[kaizen.status] || KAIZEN_PDF_STATUS_META.submitted;
  return `
    <div style="background:${meta.bg}; border:1px solid ${meta.border}; border-radius:10px; padding:10px 14px; margin-bottom:16px; text-align:center;">
      <span style="color:${meta.color}; font-weight:bold; font-size:12px;">${meta.banner[isAr ? "ar" : "en"]}</span>
    </div>
  `;
}

// ------------------------------------------------------------
// قسم "قبل / بعد" (Before & After) - مطابق للنموذج المرجعي
// ------------------------------------------------------------
function beforeAfterImageHtml(url, placeholderAr, placeholderEn, isAr) {
  if (url) {
    return `<img src="${url}" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; margin-top:8px; border:1px solid #e2e8f0;" />`;
  }
  return `
    <div style="margin-top:8px; border:1.5px dashed #cbd5e1; border-radius:8px; padding:18px 8px; text-align:center; color:#94a3b8; font-size:10px;">
      📷 ${isAr ? placeholderAr : placeholderEn}
    </div>
  `;
}

function buildBeforeAfterSectionHtml(kaizen, isAr) {
  const sectionTitle = isAr
    ? "مقارنة الوضع الحالي والوضع بعد التحسين (Before &amp; After)"
    : "Before &amp; After Comparison";

  const afterUrl = Array.isArray(kaizen.afterImageUrls) ? kaizen.afterImageUrls[0] : null;
  const beforeUrl = Array.isArray(kaizen.beforeImageUrls) ? kaizen.beforeImageUrls[0] : null;

  const afterBox = `
    <div style="flex:1; border:1.5px solid #6ee7b7; background:#f0fdf4; border-radius:10px; padding:12px;">
      <div style="color:#047857; font-weight:bold; font-size:11.5px; margin-bottom:6px;">
        ✅ ${isAr ? "الوضع الحالي (الحل والتحسين)" : "Current State (Solution & Improvement)"}
      </div>
      <div style="font-size:10.5px; color:#14532d; line-height:1.6;">${v(kaizen.solution)}</div>
      ${beforeAfterImageHtml(afterUrl, "صورة الوضع بعد التحسين (After Photo)", "After Photo", isAr)}
    </div>
  `;

  const beforeBox = `
    <div style="flex:1; border:1.5px solid #fca5a5; background:#fef2f2; border-radius:10px; padding:12px;">
      <div style="color:#b91c1c; font-weight:bold; font-size:11.5px; margin-bottom:6px;">
        ❌ ${isAr ? "الوضع السابق (المشكلة / الهدر)" : "Previous State (Problem / Waste)"}
      </div>
      <div style="font-size:10.5px; color:#7f1d1d; line-height:1.6;">${v(kaizen.problem)}</div>
      ${beforeAfterImageHtml(beforeUrl, "صورة الوضع قبل التحسين (Before Photo)", "Before Photo", isAr)}
    </div>
  `;

  return `
    <div class="kz-avoid-break" style="margin-bottom:16px;">
      <div style="border-right:${isAr ? "4px" : "0"}; border-left:${isAr ? "0" : "4px"}; border-color:#2563eb; border-style:solid; padding-${isAr ? "right" : "left"}:10px; margin-bottom:10px;">
        <span style="font-size:13px; font-weight:bold; color:#0f172a;">${sectionTitle}</span>
      </div>
      <div style="display:flex; gap:10px;">
        ${isAr ? afterBox + beforeBox : beforeBox + afterBox}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// جدول الأثر والنتائج (Impact & Benefits KPI Table)
// ------------------------------------------------------------
function buildImpactTableHtml(kaizen, isAr) {
  const sectionTitle = isAr
    ? "الأثر والنتائج المحققة (Impact &amp; Benefits)"
    : "Impact &amp; Benefits Achieved";

  const benefits = Array.isArray(kaizen.benefits) ? kaizen.benefits.filter(b => b && (b.indicator || b.before || b.after || b.improvement)) : [];

  const headers = isAr
    ? ["مؤشر القياس (KPI)", "قبل التحسين", "بعد التحسين", "معدل التحسن / الوفر المحقق"]
    : ["KPI", "Before", "After", "Improvement / Savings"];

  const rowsHtml = benefits.length
    ? benefits.map((b, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="border:1px solid #e2e8f0; padding:7px 9px; font-weight:bold; color:#0f172a;">${v(b.indicator)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 9px; color:#475569;">${v(b.before)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 9px; color:#475569;">${v(b.after)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 9px; font-weight:bold; color:#047857;">${v(b.improvement)}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td colspan="4" style="border:1px solid #e2e8f0; padding:14px; text-align:center; color:#94a3b8; font-size:10.5px;">
            ${isAr ? "لا توجد مؤشرات أثر مسجَّلة لهذا المقترح" : "No impact indicators recorded for this proposal"}
          </td>
        </tr>
      `;

  return `
    <div class="kz-avoid-break" style="margin-bottom:16px;">
      <div style="border-right:${isAr ? "4px" : "0"}; border-left:${isAr ? "0" : "4px"}; border-color:#d97706; border-style:solid; padding-${isAr ? "right" : "left"}:10px; margin-bottom:10px;">
        <span style="font-size:13px; font-weight:bold; color:#0f172a;">${sectionTitle}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:10.5px;">
        <thead>
          <tr style="background:#d97706;">
            ${headers.map(h => `<th style="border:1px solid #d97706; padding:8px 9px; color:#ffffff;">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// ------------------------------------------------------------
// التعميم والتقييس (Standardization & Horizontal Deployment)
// ------------------------------------------------------------
function buildStandardizationSectionHtml(kaizen, isAr) {
  const sectionTitle = isAr
    ? "التعميم والتقييس (Standardization &amp; Horizontal Deployment)"
    : "Standardization &amp; Horizontal Deployment";

  return `
    <div class="kz-avoid-break" style="margin-bottom:18px;">
      <div style="border-right:${isAr ? "4px" : "0"}; border-left:${isAr ? "0" : "4px"}; border-color:#2563eb; border-style:solid; padding-${isAr ? "right" : "left"}:10px; margin-bottom:10px;">
        <span style="font-size:13px; font-weight:bold; color:#0f172a;">${sectionTitle}</span>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; font-size:10.5px; color:#1e293b; line-height:1.9;">
        <div style="margin-bottom:6px;">
          <b>${isAr ? "تحديث إجراء العمل القياسي (SOP)" : "SOP Update"}:</b> ${v(kaizen.sopUpdate)}
        </div>
        <div>
          <b>${isAr ? "التعميم الأفقي (Horizontal Deployment)" : "Horizontal Deployment"}:</b> ${v(kaizen.horizontalDeployment)}
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// كتلة الاعتماد والتوقيعات (Approval & Signatures)
// ------------------------------------------------------------
function signatureBoxHtml(roleLabel, nameValue) {
  return `
    <div style="flex:1; text-align:center; border:1px solid #e2e8f0; border-radius:10px; padding:10px 6px;">
      <div style="font-size:9px; color:#64748b; font-weight:bold; margin-bottom:26px;">${roleLabel}</div>
      <div style="border-top:1px solid #94a3b8; padding-top:5px; font-size:10px; font-weight:bold; color:#0f172a;">${nameValue}</div>
    </div>
  `;
}

function buildApprovalSignaturesHtml(kaizen, isAr) {
  const sectionTitle = isAr ? "الاعتماد والتوقيعات (Approval &amp; Signatures)" : "Approval &amp; Signatures";

  const boxes = [
    signatureBoxHtml(isAr ? "مقدم المقترح" : "Proposed By", v(kaizen.initiator)),
    signatureBoxHtml(isAr ? "مهندس الصيانة (الصيانة المباشر)" : "Maintenance Engineer", v(kaizen.implementationOwner)),
    signatureBoxHtml(isAr ? "منسق الكايزن / Lean (مسؤول التطوير المستمر)" : "Kaizen / Lean Coordinator", "—"),
    signatureBoxHtml(isAr ? "مدير المصنع / الإدارة (اعتماد الإدارة)" : "Plant Manager / Management", "—")
  ];

  return `
    <div class="kz-avoid-break" style="margin-top:6px;">
      <div style="border-right:${isAr ? "4px" : "0"}; border-left:${isAr ? "0" : "4px"}; border-color:#334155; border-style:solid; padding-${isAr ? "right" : "left"}:10px; margin-bottom:10px;">
        <span style="font-size:13px; font-weight:bold; color:#0f172a;">${sectionTitle}</span>
      </div>
      <div style="display:flex; gap:8px;">${boxes.join("")}</div>
    </div>
  `;
}

/**
 * بناء HTML التقرير الكامل - قالب مستقل بالكامل عن أي تقرير آخر
 * بالمشروع (لا يستخدم exportUtility.js/buildPdfTitleBlockHtml)
 */
function buildKaizenPdfTemplateHtml(kaizen, logoDataUrl, isAr) {
  return `
    <div dir="${isAr ? "rtl" : "ltr"}" style="width:780px; padding:22px; background:#ffffff; color:#0f172a; font-family:Tahoma, Arial, sans-serif; box-sizing:border-box;">
      ${buildHeaderBlockHtml(kaizen, logoDataUrl, isAr)}
      ${buildInfoGridHtml(kaizen, isAr)}
      ${buildStatusBannerHtml(kaizen, isAr)}
      ${buildBeforeAfterSectionHtml(kaizen, isAr)}
      ${buildImpactTableHtml(kaizen, isAr)}
      ${buildStandardizationSectionHtml(kaizen, isAr)}
      ${buildApprovalSignaturesHtml(kaizen, isAr)}
    </div>
  `;
}

/**
 * تصدير تقرير كايزن واحد بصيغة PDF احترافي (A4/RTL) - باستخدام
 * html2pdf.js (محمّلة عالمياً من index.html)
 *
 * @param {Object} kaizenData - مستند الكايزن الكامل (id + كل الحقول)
 */
export async function exportKaizenPDF(kaizenData) {
  if (typeof window.html2pdf === "undefined") {
    alert("❌ مكتبة html2pdf.js غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول مرة أخرى.");
    return;
  }

  if (!kaizenData) {
    alert("❌ تعذّر تجهيز بيانات التقرير.");
    return;
  }

  const isAr = (window.currentLang || "ar") === "ar";

  let logoDataUrl = null;
  try {
    logoDataUrl = await getCompanyLogoDataUrl();
  } catch {
    logoDataUrl = null;
  }

  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.innerHTML = buildKaizenPdfTemplateHtml(kaizenData, logoDataUrl, isAr);
  document.body.appendChild(wrapper);

  // انتظار قصير لضمان تحميل الخطوط وتطبيق تشكيل النص العربي (Text
  // Shaping) بشكل صحيح قبل الالتقاط - نفس أسلوب exportUtility.js
  await new Promise(resolve => setTimeout(resolve, 200));

  const filenameSafeNumber = String(kaizenData.kaizenNumber || kaizenData.id || "report").replace(/[^\w-]/g, "");
  const filename = `kaizen-${filenameSafeNumber}.pdf`;

  const options = {
    margin: [10, 10, 14, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 800
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "avoid-all"], avoid: [".kz-avoid-break"] }
  };

  try {
    await window.html2pdf().set(options).from(wrapper.firstElementChild).save();
  } catch (error) {
    console.error("Kaizen PDF export error:", error);
    alert("❌ حدث خطأ أثناء تصدير الـ PDF. يرجى المحاولة مرة أخرى.");
  } finally {
    if (wrapper.parentNode) {
      document.body.removeChild(wrapper);
    }
  }
}
