// ============================================================
// branding.js
// بيانات الهوية الرسمية للشركة (اسم الشركة بالعربي/الإنجليزي + شعار
// MSCANCO) ودوال مشتركة لبناء هيدر/تذييل رسمي موحّد تستخدمه:
// - شريط الهيدر العلوي للتطبيق (index.html)
// - كل تقارير PDF المُصدَّرة (ticketsBoard.js / kaizenBoard.js /
//   maintenanceSearch.js)
// - ترويسة ملفات CSV المُصدَّرة (maintenanceSearch.js)
// موجودة في مكان واحد بدل تكرار نفس البيانات/الأنماط في كل ملف
// ============================================================

// مسار شعار الشركة الرسمي (MSCANCO + شارات ISO/SGS) - ملف الصورة
// نفسه لازم يتضاف يدوياً في: assets/mscanco-logo.png
// (الشعار الرسمي للشركة مش موجود داخل مشروع الكود، فمينفعش نولّد
// شعار أو شارات اعتماد (ISO/SGS) بديلة مكانه - كل الأماكن اللي
// بتستخدم المسار ده معمول لها fallback آمن (onerror يخفي الصورة
// بس النص جنبها فاضل يظهر) لحد ما يتم توفير ملف الشعار الحقيقي)
export const COMPANY_LOGO_PATH = "assets/mscanco-logo.png";

export const COMPANY_NAME_AR = "شركة محمود سعيد لصناعة علب المرطبات والأغطية المحدودة";
export const COMPANY_NAME_EN = "MAHMOOD SAEED BEVERAGE CANS & ENDS INDUSTRY COMPANY LTD.";
export const COMPANY_SHORT = "MSCANCO";

function escapeBrandHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chunkPairs(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------
// هيدر HTML رسمي موحّد لأعلى كل صفحة PDF مُصدَّرة من التطبيق - شعار
// الشركة + الاسم بالعربي والإنجليزي + الاسم المختصر
// ------------------------------------------------------------
export function buildPdfBrandHeaderHtml() {
  return `
    <div style="display:flex; align-items:center; gap:14px; border-bottom:3px solid #1d4ed8; padding-bottom:12px; margin-bottom:16px;">
      <img src="${COMPANY_LOGO_PATH}" alt="${COMPANY_SHORT}"
           style="height:64px; width:auto; object-fit:contain; flex-shrink:0;"
           onerror="this.style.display='none'" />
      <div style="flex:1; text-align:center;">
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
          <tr>
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
    <div style="text-align:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:14px;">
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
    <div style="display:flex; gap:8px; margin-bottom:16px;">
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
// مدير مصنع) - أسماء الخانات قابلة للتخصيص لو التقرير مش عن
// الصيانة (مثلاً تقرير الكايزن)
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
    <div style="display:flex; gap:20px; margin-top:36px; padding-top:16px; border-top:1px dashed #cbd5e1;">
      ${box(firstLabel)}
      ${box(secondLabel)}
      ${box(thirdLabel)}
    </div>
  `;
}

// ------------------------------------------------------------
// أسطر الترويسة الرسمية اللي بتتضاف في أول أي ملف CSV مُصدَّر من
// التطبيق - كل سطر عبارة عن مصفوفة صف واحد (نفس شكل باقي صفوف
// البيانات) عشان تتحط زي ما هي في أول csvContent، وبعدها سطر فاصل
// فاضي قبل رؤوس الأعمدة الفعلية
// ------------------------------------------------------------
export function buildCsvHeaderLines(reportTitle) {
  const now = new Date();
  const exportedAt = now.toLocaleDateString("ar-EG") + " " + now.toLocaleTimeString("ar-EG");
  return [
    [`${COMPANY_NAME_AR} - ${COMPANY_SHORT}`],
    [COMPANY_NAME_EN],
    [reportTitle],
    [`تاريخ ووقت التصدير: ${exportedAt}`],
    [] // سطر فاصل فاضي قبل رؤوس الأعمدة
  ];
}
