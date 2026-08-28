// ============================================================
// branding.js - الهوية الرسمية (معدل ومُصدّر بشكل صحيح)
// ============================================================

import { translations } from "./config.js";

export const COMPANY_BANNER_PATH = "./a_wide_horizontal_logo_graphic_on_a_transparent_b.png";

// شعار مختصر (الرمز الدائري فقط بدون النص الطويل واختام الجودة)
// بخلفية شفافة بالكامل - مُجهّز خصيصاً لشريط التطبيق العلوي
// appHeader بدل اللوجو الأفقي الطويل (COMPANY_BANNER_PATH) اللي
// مصمم أصلاً لترويسة تقارير PDF ومساحته الأفقية الواسعة مش مناسبة
// لشريط علوي ضيق على الموبايل
export const LOGO_ICON_PATH = "./mscanco-icon-mark.png";

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
// ثابت وملتصق بأعلى الشاشة، بثيم صناعي داكن وفاخر (slate-900) ثابت
// دايماً بغض النظر عن وضع فاتح/داكن لباقي التطبيق (راجع تعليق
// --app-header-bg في index.html) - اللوجو نفسه بقى الرمز الدائري
// المختصر (LOGO_ICON_PATH) بخلفية شفافة بالكامل ومندمج مباشرة في
// خلفية الهيدر من غير أي "شريحة" بيضاء حواليه زي قبل كده.
//
// الهيدر بقى صفاً واحداً compact:
//   الشعار + بيانات المستخدم المختصرة + أدوات التحكم
// بيانات المستخدم تظهر inline بعد تسجيل الدخول حتى لا يتكرر شريط
// الترحيب داخل الصفحة الرئيسية.
//
// البيانات (الاسم/الوظيفة/اللغة) مأخوذة بنفس الطريقة بالظبط
// المستخدمة فعلاً في homeView.js/Sidebar.js (localStorage +
// translations من config.js) عشان تفضل متطابقة مع باقي الواجهة من
// غير أي نظام ترجمة أو تخزين موازٍ جديد.
export function renderHeader() {

  const currentLang = window.currentLang || localStorage.getItem("lang") || "ar";
  const isEn = currentLang === "en";
  const t = (translations[currentLang] || translations.ar || {}).home || {};

  const isDark = document.documentElement.classList.contains("dark");
  const isLoggedIn = !!(localStorage.getItem("phone") || localStorage.getItem("userId"));

  const name = localStorage.getItem("name") || t.defaultName || (isEn ? "User" : "المستخدم");
  const job = localStorage.getItem("job") || t.defaultJob || (isEn ? "Maintenance Technician" : "فني صيانة");
  const initial = (name.trim().charAt(0) || "M").toUpperCase();
  const welcomeWord = t.welcome || (isEn ? "Welcome," : "مرحباً،");

  // نفس بالظبط سلسلة الاحتياطيات المستخدمة فعلاً في زرار 🔔
  // بالشريط السفلي (BottomNav.js) عشان الجرس هنا يفتح نفس نافذة
  // الإشعارات الحقيقية بالظبط
  const notifAction =
    "if (typeof window.openNotificationsModal === 'function') { window.openNotificationsModal(); } " +
    "else if (typeof window.toggleNotifications === 'function') { window.toggleNotifications(); } " +
    "else if (typeof window.showNotificationsModal === 'function') { window.showNotificationsModal(); } " +
    "else { window.navigateTo('notifications'); }";

  const glassChip =
    "background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.18);";

  const profileMeta = isLoggedIn
    ? `
      <div class="app-header-profile flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 shadow-sm transition-colors hover:bg-slate-800 min-w-0 max-w-full overflow-hidden">
        <div
          class="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 flex items-center justify-center font-black text-[10px] sm:text-xs text-white shadow"
          style="background: linear-gradient(135deg, #f5a623, #2563eb); box-shadow: 0 0 0 2px rgba(15,23,42,0.9), 0 0 8px rgba(245,166,35,0.3);"
        >${escapeBrandHtml(initial)}</div>
        <div class="app-header-profile-copy min-w-0 flex-1 leading-tight overflow-hidden">
          <div class="flex items-center gap-1 min-w-0">
            <span class="text-[11px] sm:text-[12px] font-bold text-slate-100 truncate">
              ${escapeBrandHtml(welcomeWord)} <span class="text-amber-400 font-extrabold">${escapeBrandHtml(name)}</span>
            </span>
            <span class="text-xs shrink-0" aria-hidden="true">👋</span>
          </div>
          <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span class="text-[9px] sm:text-[10px] font-medium text-slate-300 truncate">
              ${escapeBrandHtml(job)}
            </span>
          </div>
        </div>
      </div>
    `
    : `
      <div class="text-[10px] sm:text-[11px] font-semibold text-slate-300 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 truncate">
        ${isEn ? "Maintenance Portal" : "بوابة نظام الصيانة"}
      </div>
    `;

  return `
    <header
      id="appHeader"
      class="w-full fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 shadow-md overflow-hidden"
      style="background: var(--app-header-bg); border-color: rgba(148,163,184,0.14); padding-top: env(safe-area-inset-top, 0px);"
    >
      <div class="max-w-[1400px] mx-auto px-3 sm:px-4 py-1.5 flex flex-col gap-1.5 overflow-hidden w-full">

        <!-- السطر الأول: شعار الشركة واضح وكامل (يمين/بداية) | جرس الإشعارات + الثيم (يسار/الجهة المقابلة) -->
        <div class="app-header-row-top flex items-center justify-between gap-2.5 pb-1 border-b min-w-0 w-full" style="border-color: rgba(148,163,184,0.1);">

          <!-- شعار الشركة واضح وكامل -->
          <div class="app-header-brand flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
            <img
              src="${LOGO_ICON_PATH}"
              alt="${COMPANY_SHORT}"
              class="app-header-logo h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 object-contain shrink-0 transition-transform duration-200 hover:scale-105"
              style="filter: drop-shadow(0 0 8px rgba(245,166,35,0.35));"
              onerror="this.style.display='none'"
            />
            <div class="app-header-brand-copy min-w-0 flex-1 leading-tight overflow-hidden">
              <div class="app-header-brand-name text-[12px] sm:text-[14px] md:text-[15px] font-black tracking-wide truncate" style="color:#f8fafc;">
                MSCANCO <span style="color:#f5a623;">EGYPT</span>
              </div>
              <div class="text-[8.5px] sm:text-[9.5px] md:text-[10.5px] font-medium text-slate-400 truncate">
                ${isEn ? COMPANY_NAME_EN : COMPANY_NAME_AR}
              </div>
            </div>
          </div>

          <!-- الجهة المقابلة بالسطر الأول: جرس الإشعارات + الثيم -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- جرس الإشعارات + شارة العدد غير المقروء -->
            <button
              type="button"
              onclick="${notifAction}"
              aria-label="${isEn ? "Notifications" : "الإشعارات"}"
              title="${isEn ? "Notifications" : "الإشعارات"}"
              class="app-header-button relative w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-all duration-200 active:scale-90"
              style="${glassChip}"
              onmouseover="this.style.boxShadow='0 0 10px rgba(248,113,113,0.4)'"
              onmouseout="this.style.boxShadow='none'"
            >
              🔔
              <span
                id="headerNotifBadge"
                class="hidden absolute -top-0.5 -end-0.5 min-w-[15px] h-3.5 px-0.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                style="background:#ef4444; box-shadow: 0 0 0 2px rgba(15,23,42,0.95), 0 0 6px rgba(239,68,68,0.6);"
              >0</span>
            </button>

            <!-- زر تبديل الثيم (شمس/قمر) -->
            <button
              type="button"
              onclick="if (typeof window.toggleDarkMode === 'function') { window.toggleDarkMode(); }"
              aria-label="${isEn ? "Toggle theme" : "تبديل الوضع"}"
              title="${isEn ? "Toggle theme" : "تبديل الوضع"}"
              class="app-header-button w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-all duration-200 active:scale-90"
              style="${glassChip}"
              onmouseover="this.style.boxShadow='0 0 10px rgba(96,165,250,0.4)'"
              onmouseout="this.style.boxShadow='none'"
            >${isDark ? "🌙" : "☀️"}</button>
          </div>

        </div>

        <!-- السطر الثاني: المستخدم واضح في جهة (يمين/بداية) | زر اللغة في الجهة المقابلة (يسار/نهاية) -->
        <div class="app-header-row-bottom flex items-center justify-between gap-2.5 min-w-0 w-full">

          <!-- المستخدم واضح وكامل -->
          <div class="min-w-0 flex-1 overflow-hidden">
            ${profileMeta}
          </div>

          <!-- الجهة المقابلة بالسطر الثاني: كبسولة زر اللغة (AR / EN) -->
          <div class="app-header-lang flex items-center rounded-full p-0.5 gap-0.5 shrink-0" style="${glassChip}">
            <button
              type="button"
              onclick="if (window.currentLang !== 'ar' && typeof window.toggleLanguage === 'function') { window.toggleLanguage(); }"
              class="min-w-[30px] sm:min-w-[32px] h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all duration-200 active:scale-90"
              style="${!isEn ? "background:#2563eb; color:#ffffff; box-shadow:0 0 8px rgba(37,99,235,0.5);" : "color:#94a3b8;"}"
            >AR</button>
            <button
              type="button"
              onclick="if (window.currentLang !== 'en' && typeof window.toggleLanguage === 'function') { window.toggleLanguage(); }"
              class="min-w-[30px] sm:min-w-[32px] h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all duration-200 active:scale-90"
              style="${isEn ? "background:#2563eb; color:#ffffff; box-shadow:0 0 8px rgba(37,99,235,0.5);" : "color:#94a3b8;"}"
            >EN</button>
          </div>

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
        style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;; table-layout:fixed; word-wrap:break-word;"
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
// إصلاح: كان في تراكب بين appHeader وأول محتوى الصفحة في أي صفحة
// "أول ما تتفتح" بعد تسجيل الدخول (غير الرئيسية) - السبب الحقيقي:
// Tailwind (عبر CDN) بيحقن CSS أي Class جديد بشكل غير متزامن (عن
// طريق MutationObserver داخلي بتاعه)، فلما كنا بنقيس
// headerEl.offsetHeight فوراً في نفس اللحظة المتزامنة بعد إدخال
// الهيدر في الـ DOM - كان القياس بيطلع الارتفاع "قبل" ما Tailwind
// يلحق يحقن تنسيقه (يعني أصغر من الحقيقي بكتير)، والمتغيّر
// --app-header-h كان بيتجمّد على الرقم الغلط ده لحد أي render()
// تاني - فأي صفحة أول ما تتفتح (قبل ما Tailwind يخلّص) كانت بتاخد
// مساحة padding-top أصغر من ارتفاع الهيدر الفعلي = تراكب. الصفحة
// الرئيسية كانت بتظهر سليمة بالصدفة بس لأنها غالبًا مش أول render()
// بيحصل فعليًا، فبحلول وقتها Tailwind يكون خلّص فعلاً.
//
// الحل الجذري: ResizeObserver حقيقي بيراقب حجم الهيدر المرسوم على
// الشاشة فعليًا ويحدّث --app-header-h تلقائيًا أي وقت الحجم يتغيّر
// (تحميل Tailwind متأخر / تغيير حجم الشاشة / لف اسم طويل سطرين) -
// مش قياس لحظي واحد بس وقت الإدخال زي قبل كده.
let _headerResizeObserver = null;

function syncHeaderHeightVar(headerEl) {
  if (!headerEl) return;
  document.documentElement.style.setProperty(
    "--app-header-h",
    headerEl.offsetHeight + "px"
  );
}

function observeHeaderHeight(headerEl) {
  if (!headerEl) return;

  if (!_headerResizeObserver && typeof ResizeObserver !== "undefined") {
    _headerResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        syncHeaderHeightVar(entry.target);
      }
    });
  }

  // refreshHeader() بيشيل عنصر الهيدر القديم ويحط واحد جديد مكانه
  // في كل مرة (مش نفس العنصر) - فلازم نراقب العنصر الجديد في كل
  // مرة، عشان كده بنعمل disconnect() من القديم قبل ما نراقب الجديد
  if (_headerResizeObserver) {
    _headerResizeObserver.disconnect();
    _headerResizeObserver.observe(headerEl);
  }
}

export function refreshHeader() {
  document.querySelectorAll("#appHeader").forEach(el => el.remove());
  document.body.insertAdjacentHTML("afterbegin", renderHeader());

  const headerEl = document.getElementById("appHeader");

  // قياس فوري (Best-effort) عشان الفرق يبقى أقل حاجة ممكنة من أول
  // لحظة - والـ ResizeObserver فوق هو اللي هيصحّح الرقم تلقائيًا أي
  // وقت الحجم الحقيقي يتغيّر بعد كده (زي تحميل Tailwind المتأخر)
  syncHeaderHeightVar(headerEl);
  observeHeaderHeight(headerEl);
}

window.refreshHeader = refreshHeader;
