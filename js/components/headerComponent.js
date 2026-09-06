// ============================================================================
// headerComponent.js
// ----------------------------------------------------------------------------
// مكوّن الهيدر الرسمي الموحّد لكل واجهات المشروع (شاشة / طباعة مباشرة من
// المتصفح / التقاط PDF عبر html2canvas). كل البيانات (نصوص، صور، ألوان)
// مصدرها الوحيد هو companyHeaderConfig.js - المكوّن ده مسؤول بس عن الشكل
// (HTML + CSS)، مش عن أي بيانات جديدة.
//
// هيكل الهيدر (Flexbox متجاوب، ثلاثة أقسام):
//   [ الطرف الأيسر: شعار MSCANCO ]  [ الوسط: الاسم بالعربي/الإنجليزي ]  [ الطرف الأيمن: شهادات SGS/ISO ]
//
// في RTL (العربي) الشعار الرئيسي بيفضل بصريًا "يمين" طبيعي والشهادات "شمال"
// بحكم اتجاه الصفحة نفسه - إحنا مش بنعكس ترتيب الـ flex يدويًا، سايبين
// المتصفح يتعامل مع dir="rtl" بشكل طبيعي زي أي عنصر تاني في الصفحة، فيفضل
// الهيدر متطابق مع باقي اتجاه التقرير/الصفحة تلقائيًا.
// ============================================================================

import {
  COMPANY_NAME_AR,
  COMPANY_NAME_EN,
  COMPANY_SHORT,
  CERTIFICATIONS,
  HEADER_COLORS,
  LOGO_MAIN_DATA_URL,
  CERT_BADGES_DATA_URL
} from "../companyHeaderConfig.js";

// معرّف فريد لعنصر الـ <style> عشان منحقنش نفس القواعد أكتر من مرة في الصفحة
const PRINT_STYLE_ID = "mscanco-company-header-print-style";
const HEADER_CLASS = "mscanco-company-header";
const PRINT_WRAP_CLASS = "mscanco-print-repeat-wrap";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------------
// 1. هيكل HTML للهيدر (Flexbox متجاوب)
// ------------------------------------------------------------------
/**
 * يبني هيكل الـ HTML للهيدر الرسمي الموحّد.
 *
 * @param {Object} options
 * @param {"screen"|"pdf"|"print"} [options.variant="screen"] - يتحكم في الأبعاد فقط (نفس البنية دايمًا)
 * @param {string} [options.lang="ar"] - "ar" أو "en" لتحديد ترتيب النصوص المُبرزة
 * @param {boolean} [options.showCertLabels=false] - إظهار أكواد الشهادات نصيًا تحت الصورة (اختياري)
 * @returns {string} HTML جاهز للحقن المباشر
 */
export function buildCompanyHeaderHtml(options = {}) {
  const {
    variant = "screen",
    lang = "ar",
    showCertLabels = false
  } = options;

  const isEn = lang === "en";
  const heights = {
    screen: { logo: 56, cert: 52 },
    pdf: { logo: 85, cert: 78 },
    print: { logo: 70, cert: 64 }
  };
  const h = heights[variant] || heights.screen;

  const certLabelsHtml = showCertLabels
    ? `
      <div class="${HEADER_CLASS}__cert-labels" aria-hidden="true">
        ${CERTIFICATIONS.map(c => `<span>${escapeHtml(c.code)}</span>`).join("")}
      </div>
    `
    : "";

  // ⚠️ مهم: الحاوية الخارجية للهيدر لازم تفضل dir="ltr" دايمًا (بصرف النظر
  // عن لغة الواجهة الحالية) عشان ترتيب عناصر الـ Flexbox الفيزيائي (شعار
  // يسار / شهادات يمين) يفضل ثابت زي ما هو مطلوب بالظبط - لو سيبنا الحاوية
  // تاخد dir="rtl" وقت العربي، الـ flexbox هيعكس الترتيب البصري تلقائيًا
  // (الشعار هيروح يمين والشهادات شمال)، وده عكس المطلوب في "الطرف الأيسر:
  // شعار MSCANCO" / "الطرف الأيمن: شهادات الاعتماد". اتجاه النص جوه كل خانة
  // (dir على العناصر الداخلية) هو المسؤول عن شكل الكتابة العربي/الإنجليزي
  // الصحيح، مش اتجاه الحاوية نفسها.
  return `
    <div class="${HEADER_CLASS}" dir="ltr" role="banner" aria-label="MSCANCO Official Header">
      <div class="${HEADER_CLASS}__cell ${HEADER_CLASS}__logo">
        <img
          src="${LOGO_MAIN_DATA_URL}"
          alt="${escapeHtml(COMPANY_SHORT)}"
          style="height:${h.logo}px;"
        />
      </div>

      <div class="${HEADER_CLASS}__cell ${HEADER_CLASS}__title">
        <div class="${HEADER_CLASS}__title-ar" dir="rtl">${escapeHtml(COMPANY_NAME_AR)}</div>
        <div class="${HEADER_CLASS}__title-en" dir="ltr">${escapeHtml(COMPANY_NAME_EN)}</div>
      </div>

      <div class="${HEADER_CLASS}__cell ${HEADER_CLASS}__certs">
        <img
          src="${CERT_BADGES_DATA_URL}"
          alt="${isEn ? "SGS / ISO Certifications" : "شهادات الاعتماد SGS / ISO"}"
          style="height:${h.cert}px;"
        />
        ${certLabelsHtml}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------
// 2. أنماط CSS الموحّدة (شاشة + طباعة) - تشمل @media print لتكرار الهيدر
// ------------------------------------------------------------------
/**
 * يرجع نص CSS كامل (بدون وسم <style>) يغطي:
 *  - شكل الهيدر في الشاشة العادية (Flexbox متجاوب، بيلف على الموبايل)
 *  - قواعد @media print لضمان ثبات وتكرار الهيدر أعلى كل صفحة عند
 *    الطباعة المباشرة من المتصفح (Ctrl+P / window.print())
 */
export function getCompanyHeaderStyles() {
  const c = HEADER_COLORS;

  return `
    .${HEADER_CLASS} {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      border-bottom: 3px solid ${c.navy};
      background: ${c.white};
      flex-wrap: wrap;
    }
    .${HEADER_CLASS}__cell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
    }
    .${HEADER_CLASS}__logo,
    .${HEADER_CLASS}__certs {
      flex: 0 0 auto;
    }
    .${HEADER_CLASS}__logo img,
    .${HEADER_CLASS}__certs img {
      max-width: 100%;
      width: auto;
      object-fit: contain;
      display: block;
    }
    .${HEADER_CLASS}__title {
      flex: 1 1 260px;
      flex-direction: column;
      text-align: center;
      line-height: 1.35;
      padding: 0 8px;
    }
    .${HEADER_CLASS}__title-ar {
      font-family: "Cairo", "Tahoma", Arial, sans-serif;
      font-weight: 800;
      font-size: 15px;
      color: ${c.navy};
    }
    .${HEADER_CLASS}__title-en {
      font-family: Arial, Tahoma, sans-serif;
      font-weight: 700;
      font-size: 10.5px;
      color: ${c.dark};
      letter-spacing: 0.2px;
      margin-top: 2px;
    }
    .${HEADER_CLASS}__cert-labels {
      display: flex;
      gap: 6px;
      margin-top: 4px;
      font-size: 8px;
      color: ${c.dark};
      flex-wrap: wrap;
      justify-content: center;
    }

    /* أصغر شاشة (موبايل): نصوص أصغر ولوجوهات أصغر شوية عشان ميحصلش تكسير */
    @media screen and (max-width: 560px) {
      .${HEADER_CLASS} { padding: 8px 8px; gap: 8px; }
      .${HEADER_CLASS}__title-ar { font-size: 12px; }
      .${HEADER_CLASS}__title-en { font-size: 8.5px; }
      .${HEADER_CLASS}__logo img,
      .${HEADER_CLASS}__certs img { max-height: 38px !important; }
    }

    /* ============================================================
       قواعد الطباعة: ضمان ظهور نفس الهيدر أعلى كل صفحة مطبوعة
       ============================================================
       الفكرة: أي محتوى تقرير هيتلف Wrapping جوه جدول (<table>) بعنصر
       .${PRINT_WRAP_CLASS}، والهيدر بيتحط جوه <thead> الخاص بيه. الـ
       <thead> في أي جدول HTML قياسي بيتكرر تلقائيًا في أول كل صفحة
       عند الطباعة (window.print) في كل المتصفحات الحديثة (Chrome /
       Edge / Firefox) - وده أضمن وأثبت تقنية معروفة لتكرار هيدر عبر
       صفحات طباعة متعددة، وبتشتغل Offline بالكامل من غير أي JS إضافي
       وقت الطباعة نفسها.
    */
    @media print {
      @page {
        margin: 14mm 10mm 14mm 10mm;
      }
      html, body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .${PRINT_WRAP_CLASS} {
        width: 100%;
        border-collapse: collapse;
      }
      .${PRINT_WRAP_CLASS} thead {
        display: table-header-group; /* يضمن تكرار الـ thead في كل صفحة */
      }
      .${PRINT_WRAP_CLASS} tfoot {
        display: table-footer-group;
      }
      .${HEADER_CLASS} {
        page-break-inside: avoid;
        break-inside: avoid;
        border-bottom-width: 2px;
      }
      /* أي عنصر بعلامة "لا تقطعه بين صفحتين" (نفس اللي بيتستخدم في exportUtility.js) */
      .no-page-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `;
}

/**
 * يحقن أنماط الهيدر مرة واحدة بس في <head> الصفحة الحالية (Idempotent - آمن
 * حتى لو اتنادت أكتر من مرة، مش هتتكرر). استخدمها مرة عند بداية أي صفحة/فيو
 * محتاج يعرض الهيدر (شاشة أو طباعة).
 */
export function injectCompanyHeaderPrintStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRINT_STYLE_ID)) return;

  const styleEl = document.createElement("style");
  styleEl.id = PRINT_STYLE_ID;
  styleEl.textContent = getCompanyHeaderStyles();
  document.head.appendChild(styleEl);
}

// ------------------------------------------------------------------
// 3. تغليف أي محتوى تقرير بجدول Header/Body عشان الطباعة المباشرة
//    (window.print) تكرر الهيدر تلقائيًا أعلى كل صفحة ورقية
// ------------------------------------------------------------------
/**
 * يغلّف محتوى HTML (جسم التقرير) بجدول من صف هيدر متكرر (thead) وصف محتوى
 * (tbody) - الطريقة القياسية لضمان تكرار هيدر ثابت في كل صفحات الطباعة
 * المباشرة من المتصفح. يستخدم أيضاً حقن الـ CSS تلقائيًا.
 *
 * @param {string} bodyHtml - محتوى التقرير (جدول بيانات، كروت، إلخ)
 * @param {Object} [options] - نفس خيارات buildCompanyHeaderHtml
 * @returns {string} HTML كامل جاهز لوضعه مباشرة في أي حاوية قبل window.print()
 */
export function wrapHtmlForRepeatingPrintHeader(bodyHtml, options = {}) {
  injectCompanyHeaderPrintStyles();

  const headerHtml = buildCompanyHeaderHtml({ variant: "print", ...options });

  return `
    <table class="${PRINT_WRAP_CLASS}">
      <thead>
        <tr>
          <td>${headerHtml}</td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${bodyHtml}</td>
        </tr>
      </tbody>
    </table>
  `;
}

// إتاحة الدوال عالميًا (اختياري) لأي كود قديم بينادي عبر window مباشرة
// (نفس نمط باقي المشروع - راجع window.refreshHeader في branding.js)
if (typeof window !== "undefined") {
  window.buildCompanyHeaderHtml = buildCompanyHeaderHtml;
  window.injectCompanyHeaderPrintStyles = injectCompanyHeaderPrintStyles;
  window.wrapHtmlForRepeatingPrintHeader = wrapHtmlForRepeatingPrintHeader;
}
