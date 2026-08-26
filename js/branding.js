// ============================================================
// branding.js
// بيانات الهوية الرسمية للشركة (اسم الشركة بالعربي/الإنجليزي + شعار
// MSCANCO) ودوال مشتركة لبناء هيدر/تذييل رسمي موحّد تستخدمه:
// - شريط الهيدر العلوي للتطبيق (index.html)
// - كل تقارير PDF المُصدَّرة (ticketsBoard.js / kaizenBoard.js /
//   maintenanceSearch.js)
// - ترويسة ملفات CSV المُصدَّرة (maintenanceSearch.js)
// ============================================================

// مسار شعار الشركة الرسمي (ضع ملف البنر المرفق باسم mscanco-logo.png داخل مجلد assets)
export const COMPANY_LOGO_PATH = "assets/mscanco-logo.png";

export const COMPANY_NAME_AR = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة";
export const COMPANY_NAME_EN = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY COMPANY LTD.";
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
// هيدر HTML رسمي موحّد لأعلى كل صفحة PDF مُصدَّرة من التطبيق
// معالجة البنر الرمادي للشعار وتأطيره تلقائياً لمنع أي تشوه بصري
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="margin-bottom:16px; page-break-inside:avoid;">
      <!-- إطار بنر الهوية الرسمية -->
      <div style="background:#b0b2b7; border-radius:6px; padding:4px 8px; border:1px solid #94a3b8; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <img src="${COMPANY_LOGO_PATH}" alt="${COMPANY_SHORT}"
             style="width:100%; max-height:75px; object-fit:contain; display:block; margin:0 auto;"
             onerror="this.parentElement.style.display='none'; const fb = this.parentElement.nextElementSibling; if(fb) fb.style.display='block';" />
      </div>

      <!-- هيدر احتياطي بنص عادي في حال تعذر تحميل الصورة -->
      <div style="display:none; text-align:center; padding:8px 0; border-bottom:3px solid #1d4ed8;">
        <div style="font-size:14px; font-weight:bold; color:#0f172a;">${COMPANY_NAME_AR}</div>
        <div style="font-size:10px; font-weight:bold; color:#475569; letter-spacing:.3px;">${COMPANY_NAME_EN}</div>
        <div style="font-size:9px; color:#1d4ed8; font-weight:bold; margin-top:2px;">${COMPANY_SHORT}</div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// مربع عنوان التقرير + جدول معلومات (تاريخ التصدير/الفني/خط
// الإنتاج/الفترة ...) - infoRows = [{ label, value }]
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
// خانة التوقيعات الثلاثية في نهاية التقرير (فني - مهندس جودة -
// مدير مصنع)
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
    [`"${COMPANY_NAME_AR} - ${COMPANY_SHORT}"`],
    [`"${COMPANY_NAME_EN}"`],
    [`"${reportTitle}"`],
    [`"تاريخ ووقت التصدير: ${exportedAt}"`],
    [] // سطر فاصل فاضي قبل رؤوس الأعمدة
  ];
}
