// ============================================================
// branding.js - الهوية الرسمية (اسم الصورة المحدد)
// ============================================================

export const COMPANY_BANNER_PATH = "A_wide_horizontal_logo_graphic_on_a_transparent_b.png";

export const COMPANY_NAME_AR = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة";
export const COMPANY_NAME_EN = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY COMPANY LTD.";
export const COMPANY_SHORT = "MSCANCO";

// ------------------------------------------------------------
// 1. هيدر HTML موحّد لتقارير الـ PDF
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="text-align:center; padding-bottom:8px; margin-bottom:16px; border-bottom:2px solid #0B3D91; page-break-inside:avoid;">
      <img src="${COMPANY_BANNER_PATH}" alt="${COMPANY_SHORT}"
           style="width:100%; max-height:85px; object-fit:contain; display:block; margin:0 auto;"
           onerror="this.style.display='none'; const fb = this.nextElementSibling; if(fb) fb.style.display='block';" />
      
      <div style="display:none; text-align:center;">
        <div style="font-size:13px; font-weight:bold; color:#0B3D91;" dir="rtl">${COMPANY_NAME_AR}</div>
        <div style="font-size:9px; font-weight:bold; color:#475569;" dir="ltr">${COMPANY_NAME_EN}</div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// 2. هيدر واجهة التطبيق العلوي (index.html)
// ------------------------------------------------------------
export function renderHeader() {
  return `
  <header id="appHeader" class="w-full bg-white border-b-4 border-[#0B3D91] px-3 py-2 fixed top-0 left-0 z-50 shadow-sm">
    <div class="max-w-[1400px] mx-auto flex justify-center items-center">
      <img src="${COMPANY_BANNER_PATH}" alt="${COMPANY_SHORT}" class="h-10 md:h-12 max-w-full object-contain" />
    </div>
  </header>
  `;
}

// ------------------------------------------------------------
// 3. مربع عنوان التقرير وجدول المعلومات
// ------------------------------------------------------------
export function buildPdfTitleBlockHtml(title, infoRows = [], accentColor = "#0B3D91") {
  const rows = (infoRows || []).filter(r => r && r.value !== undefined && r.value !== null && r.value !== "");
  const escapeHtml = (str) => String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const infoTable = rows.length ? `
    <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;" dir="rtl">
      <tbody>
        ${rows.map(r => `
          <tr style="page-break-inside:avoid;">
            <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:20%; font-family:sans-serif;">${escapeHtml(r.label)}</td>
            <td style="border:1px solid #e2e8f0; padding:6px 10px; font-family:sans-serif;">${escapeHtml(r.value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "";

  return `
    <div style="text-align:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:14px; page-break-inside:avoid;">
      <div style="font-size:16px; font-weight:bold; color:${accentColor}; font-family:sans-serif;">${escapeHtml(title)}</div>
    </div>
    ${infoTable}
  `;
}

// ------------------------------------------------------------
// 4. دالة تحديث الهيدر في التطبيق تلقائياً
// ------------------------------------------------------------
window.refreshHeader = function() {
  document.getElementById('appHeader')?.remove();
  document.body.insertAdjacentHTML('afterbegin', renderHeader());
};
