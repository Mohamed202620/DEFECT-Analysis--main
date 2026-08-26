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
// 1. هيدر HTML موحّد لتقارير الـ PDF
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="text-align:center; padding-bottom:8px; margin-bottom:16px; border-bottom:2px solid #0B3D91; page-break-inside:avoid;">
      <img
        src="${COMPANY_BANNER_PATH}"
        alt="${COMPANY_SHORT}"
        style="width:100%; max-height:85px; object-fit:contain; display:block; margin:0 auto;"
        onerror="this.style.display='none'; const fb = this.nextElementSibling; if(fb) fb.style.display='block';"
      />

      <div style="display:none; text-align:center;">
        <div style="font-size:13px; font-weight:bold; color:#0B3D91;" dir="rtl">
          ${COMPANY_NAME_AR}
        </div>
        <div style="font-size:9px; font-weight:bold; color:#475569;" dir="ltr">
          ${COMPANY_NAME_EN}
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// 2. هيدر واجهة التطبيق العلوي
// ------------------------------------------------------------
export function renderHeader() {
  return `
    <header
      id="appHeader"
      class="w-full bg-white border-b-4 border-[#0B3D91] px-3 py-2 fixed top-0 left-0 z-50 shadow-sm"
    >
      <div class="max-w-[1400px] mx-auto flex justify-center items-center">
        <img
          src="${COMPANY_BANNER_PATH}"
          alt="${COMPANY_SHORT}"
          class="h-10 md:h-12 max-w-full object-contain"
        />
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
