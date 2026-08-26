// ============================================================
// branding.js - الهوية الرسمية (معدل ومُصدّر بشكل صحيح)
// ============================================================

export const COMPANY_BANNER_PATH = "./a_wide_horizontal_logo_graphic_on_a_transparent_b.png";

export const COMPANY_NAME_AR = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة";
export const COMPANY_NAME_EN = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY COMPANY LTD.";
export const COMPANY_SHORT = "MSCANCO";

// شهادات الجودة المعتمدة
export const CERTIFICATIONS = [
  { name: "FSSC 22000", type: "سلامة الغذاء" },
  { name: "ISO 9001",   type: "إدارة الجودة" },
  { name: "ISO 14001",  type: "الإدارة البيئية" },
  { name: "ISO 45001",  type: "السلامة والصحة المهنية" }
];

function escapeBrandHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function chunkPairs(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ------------------------------------------------------------
// 0. تحميل لوجو الشركة كـ Data URL وتخزينه مؤقتاً (Cache)
// ------------------------------------------------------------
// المشكلة الأصلية: كانت تقارير الـ PDF (html2canvas) تُلتقط كصورة
// فور إضافة الـ HTML للـ DOM، أي قبل ما ملف اللوجو (خصوصاً أول مرة
// وبدون Cache من المتصفح) يخلّص تحميله فعلياً -> فبيطلع فاضي أو
// ناقص في التقرير المُصدَّر رغم إنه ظاهر تمام في هيدر التطبيق
// نفسه. الحل: نحوّل اللوجو لـ Data URL مرة واحدة ونخزّنه، وأي
// تقرير PDF بعد كده (أو حتى أول مرة) بينتظر الدالة دي قبل ما
// يبني الـ HTML بتاعه، فيضمن ظهور اللوجو 100% في كل تقرير.
let _cachedLogoDataUrl = null;
let _cachedLogoPromise = null;

export function getCompanyLogoDataUrl() {
  if (_cachedLogoDataUrl) return Promise.resolve(_cachedLogoDataUrl);
  if (_cachedLogoPromise) return _cachedLogoPromise;

  _cachedLogoPromise = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        _cachedLogoDataUrl = canvas.toDataURL("image/png");
      } catch (e) {
        // مثلاً لو الصفحة اتفتحت من file:// وسياسة الأمان منعت
        // قراءة الـ Canvas: نرجع لمسار الملف العادي بدل ما نفشل
        console.warn("تعذر تحويل لوجو الشركة إلى Data URL، سيتم استخدام مسار الملف مباشرة:", e);
        _cachedLogoDataUrl = COMPANY_BANNER_PATH;
      }
      resolve(_cachedLogoDataUrl);
    };

    img.onerror = () => {
      console.warn("تعذر تحميل ملف لوجو الشركة نهائياً، سيتم عرض اسم الشركة نصياً بدلاً منه في التقارير.");
      _cachedLogoPromise = null;
      resolve(null);
    };

    img.src = COMPANY_BANNER_PATH;
  });

  return _cachedLogoPromise;
}

// تسخين الكاش فور تحميل الصفحة (بدون انتظار)، عشان يبقى جاهز في
// الذاكرة قبل أول محاولة تصدير تقرير أصلاً
if (typeof window !== "undefined") {
  getCompanyLogoDataUrl();
}

// ------------------------------------------------------------
// 1. هيدر HTML موحّد لتقارير الـ PDF
// ------------------------------------------------------------
// ملحوظة: لازم أي كود بيصدّر تقرير PDF (html2canvas) يستدعي
// await getCompanyLogoDataUrl() ويمرر الناتج هنا (logoSrc) *قبل*
// ما يعمل html2canvas على العنصر، بدل ما يسيب المتصفح يحمّل
// الصورة "لحظة" الالتقاط. لو معدّاش logoSrc أو رجعت null هيظهر
// اسم الشركة نصياً تلقائياً بدل اللوجو بدل ما يفضل فاضي.
export function buildPdfBrandHeaderHtml(logoSrc = COMPANY_BANNER_PATH) {
  const textFallback = `
    <div style="text-align:center;">
      <div style="font-size:13px; font-weight:bold; color:#0B3D91;" dir="rtl">
        ${COMPANY_NAME_AR}
      </div>
      <div style="font-size:9px; font-weight:bold; color:#475569;" dir="ltr">
        ${COMPANY_NAME_EN}
      </div>
    </div>
  `;

  const logoBlock = logoSrc
    ? `
      <img
        src="${logoSrc}"
        alt="${COMPANY_SHORT}"
        style="width:100%; max-height:85px; object-fit:contain; display:block; margin:0 auto;"
      />
    `
    : textFallback;

  return `
    <div style="text-align:center; padding-bottom:8px; margin-bottom:16px; border-bottom:2px solid #0B3D91; page-break-inside:avoid;">
      ${logoBlock}
    </div>
  `;
}

// ------------------------------------------------------------
// 2. هيدر واجهة التطبيق العلوي
// ------------------------------------------------------------
// بدل الشريط الأبيض العريض اللي كان بيقطع الشكل عن باقي الواجهة
// (خصوصاً في الوضع الليلي)، بقى الهيدر "كارت" عائم بنفس لغة
// تصميم شريط التنقل السفلي (BottomNav.js): زوايا دائرية، خلفية
// شبه شفافة بتتلوّن تلقائياً مع الوضع الليلي/النهاري (dyn-card)،
// وظل خفيف. اللوجو نفسه اتحط جوه "شريحة" بيضاء صغيرة مستقلة عشان
// يفضل واضح وألوانه (الأزرق الغامق والبرتقالي) تبان بوضوح فوق أي
// خلفية غامقة، مع خط تمييز رفيع بلون هوية الشركة تحته بدل الخط
// السفلي القديم اللي كان حادّ وغير مندمج مع باقي الكروت.
export function renderHeader() {
  return `
    <header
      id="appHeader"
      class="w-full fixed top-0 left-0 z-50 px-3 pt-3 pb-1"
    >
      <div class="max-w-[1400px] mx-auto">
        <div
          class="dyn-card backdrop-blur-xl border rounded-3xl shadow-lg
                 flex flex-col items-center justify-center py-2.5 px-4
                 transition-all duration-300"
        >
          <div class="bg-white rounded-2xl px-3 py-1.5 shadow-sm max-w-full overflow-hidden">
            <img
              src="${COMPANY_BANNER_PATH}"
              alt="${COMPANY_SHORT}"
              class="h-8 md:h-11 max-w-full object-contain block"
            />
          </div>
          <span class="w-10 h-1 rounded-full bg-[#0B3D91] mt-2 opacity-80"></span>
        </div>
      </div>
    </header>
  `;
}

// ------------------------------------------------------------
// 3. مربع عنوان التقرير وجدول المعلومات
// ------------------------------------------------------------
export function buildPdfTitleBlockHtml(
  title,
  infoRows = [],
  accentColor = "#0B3D91"
) {
  const rows = (infoRows || []).filter(
    r =>
      r &&
      r.value !== undefined &&
      r.value !== null &&
      r.value !== ""
  );

  const infoTable = rows.length
    ? `
      <table
        style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;"
        dir="rtl"
      >
        <tbody>
          ${chunkPairs(rows, 2)
            .map(
              pair => `
                <tr style="page-break-inside:avoid;">
                  ${pair
                    .map(
                      r => `
                        <td
                          style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:15%; white-space:nowrap; font-family:sans-serif;"
                        >
                          ${escapeBrandHtml(r.label)}
                        </td>

                        <td
                          style="border:1px solid #e2e8f0; padding:6px 10px; width:35%; font-family:sans-serif;"
                        >
                          ${escapeBrandHtml(r.value)}
                        </td>
                      `
                    )
                    .join("")}

                  ${
                    pair.length === 1
                      ? `<td style="border:none;"></td><td style="border:none;"></td>`
                      : ""
                  }
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : "";

  return `
    <div
      style="text-align:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:14px; page-break-inside:avoid;"
    >
      <div
        style="font-size:16px; font-weight:bold; color:${accentColor}; font-family:sans-serif;"
      >
        ${escapeBrandHtml(title)}
      </div>
    </div>

    ${infoTable}
  `;
}

// ------------------------------------------------------------
// 4. كروت الإحصائيات والتوقيعات
// ------------------------------------------------------------
export function buildPdfStatsCardsHtml(cards = []) {
  if (!cards.length) return "";

  return `
    <div
      style="display:flex; gap:8px; margin-bottom:16px; page-break-inside:avoid;"
    >
      ${cards
        .map(
          c => `
            <div
              style="flex:1; text-align:center; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; background:${c.bg || "#f8fafc"};"
            >
              <div
                style="font-size:10px; color:#64748b; margin-bottom:2px;"
              >
                ${escapeBrandHtml(c.label)}
              </div>

              <div
                style="font-size:16px; font-weight:bold; color:${c.color || "#0f172a"};"
              >
                ${escapeBrandHtml(c.value)}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

export function buildPdfSignatureBlockHtml({
  firstLabel = "توقيع الفني",
  secondLabel = "توقيع مهندس الجودة",
  thirdLabel = "توقيع مدير المصنع"
} = {}) {
  const box = label => `
    <div style="flex:1; text-align:center;">
      <div
        style="height:50px; border-bottom:1px solid #94a3b8; margin-bottom:6px;"
      ></div>

      <div
        style="font-size:11px; font-weight:bold; color:#334155;"
      >
        ${escapeBrandHtml(label)}
      </div>
    </div>
  `;

  return `
    <div
      style="display:flex; gap:20px; margin-top:36px; padding-top:16px; border-top:1px dashed #cbd5e1; page-break-inside:avoid;"
    >
      ${box(firstLabel)}
      ${box(secondLabel)}
      ${box(thirdLabel)}
    </div>
  `;
}

// ------------------------------------------------------------
// 5. ترويسة ملفات CSV
// ------------------------------------------------------------
export function buildCsvHeaderLines(reportTitle) {
  const now = new Date();

  const exportedAt =
    now.toLocaleDateString("ar-EG") +
    " " +
    now.toLocaleTimeString("ar-EG");

  return [
    [`"${COMPANY_NAME_AR}"`],
    [`"${COMPANY_NAME_EN}"`],
    [`"${reportTitle}"`],
    [`"تاريخ ووقت التصدير: ${exportedAt}"`],
    []
  ];
}

// ------------------------------------------------------------
// 6. دالة تحديث الهيدر تلقائياً (تصدير مباشر آمن)
// ------------------------------------------------------------
export function refreshHeader() {
  document.getElementById("appHeader")?.remove();
  document.body.insertAdjacentHTML("afterbegin", renderHeader());
}

window.refreshHeader = refreshHeader;
