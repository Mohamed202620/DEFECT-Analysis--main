// ============================================================
// branding.js
// بيانات الهوية الرسمية للشركة (اسم الشركة بالعربي/الإنجليزي + شعار
// MSCANCO) ودوال مشتركة لبناء هيدر/تذييل رسمي موحّد تستخدمه:
// - شريط الهيدر العلوي للتطبيق (index.html)
// - كل تقارير PDF المُصدَّرة (ticketsBoard.js / kaizenBoard.js /
//   maintenanceSearch.js)
// - ترويسة ملفات CSV المُصدَّرة (maintenanceSearch.js)
// ============================================================

export const COMPANY_LOGO_PATH = "assets/mscanco-logo.png";

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
// هيدر HTML موحّد لأعلى الشاشة/التقارير مطاطق للصورة تماماً
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="text-align:center; padding:10px 0 14px 0; margin-bottom:16px; border-bottom:2px solid #1d4ed8; page-break-inside:avoid;">
      <!-- الشعار في حالة توفره كصورة -->
      <img src="${COMPANY_LOGO_PATH}" alt="${COMPANY_SHORT}"
           style="max-height:60px; width:auto; object-fit:contain; margin:0 auto 8px auto; display:block;"
           onerror="this.style.display='none';" />

      <!-- النص الرسمي الموحد بالظبط مثل أعلى الواجهة -->
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
      <h1 class="text-xs sm:text-sm font-bold text-slate-100 tracking-wide">${COMPANY_NAME_AR}</h1>
      <p class="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-wider mt-0.5">${COMPANY_NAME_EN}</p>
    </div>
  `;
}

// ------------------------------------------------------------
// مربع عنوان التقرير + جدول معلومات (تاريخ التصدير/الفني/خط الإنتاج...)
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
// كروت إحصائيات سريعة أعلى التقرير - cards = [{ label, value, color, bg }]
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
// خانة التوقيعات الثلاثية في نهاية التقرير
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
