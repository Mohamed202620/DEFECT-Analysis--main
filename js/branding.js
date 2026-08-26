// ============================================================
// branding.js
// بيانات الهوية الرسمية للشركة (اسم الشركة بالعربي/الإنجليزي + شعار MSCANCO)
// ============================================================

// شعار MSCANCO مدمج كـ SVG شفاف عالي الدقة (بدون خلفية رمادية وبدون ملفات خارجية)
export const COMPANY_LOGO_PATH = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'><g transform='translate(10, 5)'><path d='M 80,25 A 45,45 0 1 0 80,115 M 80,15 A 55,55 0 1 0 80,125' fill='none' stroke='%23d97706' stroke-width='6' stroke-linecap='round'/><line x1='72' y1='15' x2='92' y2='15' stroke='%23d97706' stroke-width='6'/><line x1='72' y1='25' x2='92' y2='25' stroke='%23d97706' stroke-width='6'/><line x1='72' y1='115' x2='92' y2='115' stroke='%23d97706' stroke-width='6'/><line x1='72' y1='125' x2='92' y2='125' stroke='%23d97706' stroke-width='6'/><path d='M 70,38 A 32,32 0 1 0 70,102 M 70,30 A 40,40 0 1 0 70,110' fill='none' stroke='%231e3a8a' stroke-width='5'/><line x1='58' y1='48' x2='58' y2='92' stroke='%231e3a8a' stroke-width='8'/><line x1='50' y1='48' x2='66' y2='48' stroke='%231e3a8a' stroke-width='4'/><line x1='50' y1='92' x2='66' y2='92' stroke='%231e3a8a' stroke-width='4'/><text x='70' y='152' font-family='Arial, sans-serif' font-weight='900' font-size='22' fill='%231e3a8a' text-anchor='middle' letter-spacing='1'>MSCANCO</text></g></svg>";

export const COMPANY_NAME_AR = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة";
export const COMPANY_NAME_EN = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY CO. LTD. (MSCANCO)";
export const COMPANY_SHORT = "MSCANCO";

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
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------
// هيدر HTML موحّد لتقارير الـ PDF
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="text-align:center; padding:8px 0 12px 0; margin-bottom:16px; border-bottom:2px solid #1d4ed8; page-break-inside:avoid;">
      <!-- الشعار المدمج الشفاف -->
      <img src="${COMPANY_LOGO_PATH}" alt="${COMPANY_SHORT}"
           style="height:55px; width:auto; object-fit:contain; margin:0 auto 6px auto; display:block;" />

      <!-- النصوص الرسمية -->
      <div style="font-size:13px; font-weight:bold; color:#0f172a; line-height:1.4;">${COMPANY_NAME_AR}</div>
      <div style="font-size:9.5px; font-weight:bold; color:#475569; letter-spacing:0.2px; margin-top:2px;">${COMPANY_NAME_EN}</div>
    </div>
  `;
}

// ------------------------------------------------------------
// هيدر مخصص للشاشة العلوية للتطبيق (index.html)
// ------------------------------------------------------------
export function buildAppHeaderHtml() {
  return `
    <div class="text-center py-2 px-3">
      <img src="${COMPANY_LOGO_PATH}" alt="${COMPANY_SHORT}" class="h-10 mx-auto mb-1 object-contain" />
      <h1 class="text-xs sm:text-sm font-bold text-slate-100 tracking-wide">${COMPANY_NAME_AR}</h1>
      <p class="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-wider mt-0.5">${COMPANY_NAME_EN}</p>
    </div>
  `;
}

// ------------------------------------------------------------
// مربع عنوان التقرير + جدول معلومات
// ------------------------------------------------------------
export function buildPdfTitleBlockHtml(title, infoRows = [], accentColor = "#1d4ed8") {
  const rows = (infoRows || []).filter(r => r && r.value !== undefined && r.value !== null && r.value !== "");

  const infoTable = rows.length ? `
    <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;" dir="rtl">
      <tbody>
        ${chunkPairs(rows, 2).map(pair => `
          <tr style="page-break-inside:avoid;">
            ${pair.map(r => `
              <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:15%; white-space:nowrap;">${escapeBrandHtml(r.label)}</td>
              <td style="border:1px solid #e2e8f0; padding:6px 10px; width:35%;">${escapeBrandHtml(r.value)}</td>
            `).join("")}
            ${pair.length === 1 ? `<td style="border:none;"></td><td style="border:none;"></td>` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "";

  return `
    <div style="text-align:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:14px; page-break-inside:avoid;">
      <div style="font-size:16px; font-weight:bold; color:${accentColor};">${escapeBrandHtml(title)}</div>
    </div>
    ${infoTable}
  `;
}

// ------------------------------------------------------------
// كروت إحصائيات سريعة أعلى التقرير
// ------------------------------------------------------------
export function buildPdfStatsCardsHtml(cards = []) {
  if (!cards.length) return "";
  return `
    <div style="display:flex; gap:8px; margin-bottom:16px; page-break-inside:avoid;">
      ${cards.map(c => `
        <div style="flex:1; text-align:center; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; background:${c.bg || "#f8fafc"};">
          <div style="font-size:10px; color:#64748b; margin-bottom:2px;">${escapeBrandHtml(c.label)}</div>
          <div style="font-size:16px; font-weight:bold; color:${c.color || "#0f172a"};">${escapeBrandHtml(c.value)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// ------------------------------------------------------------
// خانة التوقيعات الثلاثية
// ------------------------------------------------------------
export function buildPdfSignatureBlockHtml({
  firstLabel = "توقيع الفني",
  secondLabel = "توقيع مهندس الجودة",
  thirdLabel = "توقيع مدير المصنع"
} = {}) {
  const box = (label) => `
    <div style="flex:1; text-align:center;">
      <div style="height:50px; border-bottom:1px solid #94a3b8; margin-bottom:6px;"></div>
      <div style="font-size:11px; font-weight:bold; color:#334155;">${escapeBrandHtml(label)}</div>
    </div>
  `;
  return `
    <div style="display:flex; gap:20px; margin-top:36px; padding-top:16px; border-top:1px dashed #cbd5e1; page-break-inside:avoid;">
      ${box(firstLabel)}
      ${box(secondLabel)}
      ${box(thirdLabel)}
    </div>
  `;
}

// ------------------------------------------------------------
// أسطر الترويسة الرسمية لملفات CSV المُصدَّرة
// ------------------------------------------------------------
export function buildCsvHeaderLines(reportTitle) {
  const now = new Date();
  const exportedAt = now.toLocaleDateString("ar-EG") + " " + now.toLocaleTimeString("ar-EG");
  return [
    [`"${COMPANY_NAME_AR}"`],
    [`"${COMPANY_NAME_EN}"`],
    [`"${reportTitle}"`],
    [`"تاريخ ووقت التصدير: ${exportedAt}"`],
    []
  ];
}
