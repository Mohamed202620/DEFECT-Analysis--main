// ============================================================
// branding.js - الهوية الرسمية (طبقة توافقية فوق المصدر الموحّد)
// ============================================================
// ⚠️ ملحوظة هامة: هذا الملف لم يعد يحتوي على أي بيانات هوية أصلية بنفسه.
// كل النصوص والصور والألوان أصبح مصدرها الوحيد ملف companyHeaderConfig.js
// (Single Source of Truth). هذا الملف بقى طبقة توافقية (Wrapper) بس، بتعيد
// تصدير (Re-export) نفس الأسماء القديمة بالظبط عشان أي كود حالي في المشروع
// (kaizenBoard.js, reportsView.js, maintenanceSearch.js, attendanceCard.js,
// ticketsBoard.js, exportUtility.js) يفضل شغال من غير أي تعديل مطلوب فيه.
//
// أي تعديل على النص أو الشعار أو الشهادات مستقبلاً: يتم في
// companyHeaderConfig.js فقط، وينعكس تلقائيًا هنا وفي كل مكان تاني.
// ============================================================

import { translations } from "./config.js";
import { buildCompanyHeaderHtml, injectCompanyHeaderPrintStyles } from "./components/headerComponent.js";
import {
  COMPANY_NAME_AR,
  COMPANY_NAME_EN,
  COMPANY_SHORT,
  CERTIFICATIONS as CERTIFICATIONS_V2,
  LOGO_ICON_PATH,
  LOGO_ICON_DATA_URL,
  COMPANY_BANNER_PATH,
  COMPANY_BANNER_DATA_URL,
  getCompanyLogoDataUrl as getCompanyLogoDataUrlV2
} from "./companyHeaderConfig.js";

export { COMPANY_BANNER_DATA_URL, LOGO_ICON_DATA_URL };

// إعادة تصدير النصوص والمسارات بنفس الأسماء القديمة تمامًا (توافقية كاملة)
export {
  COMPANY_NAME_AR,
  COMPANY_NAME_EN,
  COMPANY_SHORT,
  LOGO_ICON_PATH,
  COMPANY_BANNER_PATH
};

// شهادات الجودة المعتمدة - نفس البيانات، بشكل الحقول القديم (name/type) عشان
// أي كود حالي بيقرأ CERTIFICATIONS بالشكل ده يفضل شغال بدون أي تعديل
export const CERTIFICATIONS = CERTIFICATIONS_V2.map(c => ({
  name: c.code,
  type: c.nameAr
}));

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
// 0. لوجو الشركة كـ Data URL
// ------------------------------------------------------------
// المشكلة الأصلية (سجل تاريخي): كانت تقارير الـ PDF (html2canvas) بتُلتقط
// كصورة فور إضافة الـ HTML للـ DOM، أي قبل ما ملف اللوجو (خصوصًا أول مرة
// وبدون Cache من المتصفح) يخلّص تحميله فعليًا عبر fetch() -> فبيطلع فاضي
// أو ناقص في التقرير المُصدَّر، وكان بيختفي تحديدًا من ملفات الإكسيل لأن
// ExcelJS محتاج Base64 حقيقي فقط، مش رابط أو Blob.
//
// الحل الجذري النهائي: بعد توحيد كل أصول الهوية في companyHeaderConfig.js
// كـ Base64 مُضمّن مباشرة جوه كود الـ JS (مش ملف يُجلب وقت التشغيل)، بقت
// getCompanyLogoDataUrl() هنا مجرد استدعاء مباشر للمصدر الموحّد - مفيش
// fetch ولا FileReader ولا انتظار شبكة نهائيًا، والقيمة جاهزة فورًا من نفس
// لحظة تحميل الملف، فمضمون ظهورها 100% في PDF والإكسيل من أول مرة حتى بدون
// إنترنت أو Service Worker.
export function getCompanyLogoDataUrl() {
  return getCompanyLogoDataUrlV2();
}

// ------------------------------------------------------------
// 1. هيدر HTML موحّد لتقارير الـ PDF
// ------------------------------------------------------------
// ملحوظة: لازم أي كود بيصدّر تقرير PDF (html2canvas) يستدعي
// await getCompanyLogoDataUrl() ويمرر الناتج هنا (logoSrc) *قبل*
// ما يعمل html2canvas على العنصر، بدل ما يسيب المتصفح يحمّل
// الصورة "لحظة" الالتقاط.
//
// ⚠️ محدّث: بقت الدالة دي بترجع الهيدر الرسمي الموحّد الكامل بثلاث مناطق
// (شعار MSCANCO يسار + الاسم الثنائي اللغة في المنتصف + شهادات SGS/ISO
// يمين) عن طريق headerComponent.js/companyHeaderConfig.js، بدل ما كانت
// بترجع صورة بانر واحدة مسطّحة بس. الباراميتر logoSrc اتسابت لتوافقية
// الاستدعاءات القديمة (exportUtility.js بينده بالـ Data URL الناتج من
// getCompanyLogoDataUrl()) لكن بقت بتستخدم فقط كـ "إشارة": لو اتبعتت
// صراحة null (يعني عايز نص بس بدون أي صور)، هيظهر اسم الشركة نصيًا فقط
// من غير أي صور - أي حاجة تانية (بما فيها القيمة الافتراضية) هتعرض
// الهيدر الكامل بثلاث المناطق زي المطلوب.
export function buildPdfBrandHeaderHtml(logoSrc = COMPANY_BANNER_DATA_URL) {
  const currentLang = (typeof window !== "undefined" && window.currentLang) || "ar";

  if (logoSrc === null) {
    // نص فقط بدون أي صور (Fallback نادر الاستخدام - غالبًا لتقارير بيضاء بحتة)
    return `
      <div style="text-align:center; padding-bottom:8px; margin-bottom:16px; border-bottom:2px solid #0B3D91; page-break-inside:avoid;">
        <div style="font-size:13px; font-weight:bold; color:#0B3D91;" dir="rtl">${COMPANY_NAME_AR}</div>
        <div style="font-size:9px; font-weight:bold; color:#475569;" dir="ltr">${COMPANY_NAME_EN}</div>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:16px; page-break-inside:avoid;">
      ${buildCompanyHeaderHtml({ variant: "pdf", lang: currentLang })}
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
  const job = localStorage.getItem("job") || t.defaultJob || (isEn ? "Technician" : "فني صيانة");
  const role = (localStorage.getItem("role") || "technician").toUpperCase();
  const initial = (name.trim().charAt(0) || "M").toUpperCase();

  const activeHomeMode = localStorage.getItem("home_view_mode") || (role === 'ADMIN' || role === 'MANAGER' || role === 'ENGINEER' || role === 'SUPERVISOR' ? 'manager' : 'technician');

  const notifAction =
    "if (typeof window.openNotificationsModal === 'function') { window.openNotificationsModal(); } " +
    "else if (typeof window.toggleNotifications === 'function') { window.toggleNotifications(); } " +
    "else if (typeof window.showNotificationsModal === 'function') { window.showNotificationsModal(); } " +
    "else { window.navigateTo('notifications'); }";

  const roleBadgeStyle = {
    ADMIN: "bg-red-500/20 text-red-300 border-red-500/30",
    MANAGER: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    SUPERVISOR: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    ENGINEER: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    TECHNICIAN: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
  }[role] || "bg-slate-700 text-slate-300 border-slate-600";

  return `
    <header
      id="appHeader"
      class="w-full fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b transition-colors duration-200 select-none"
      style="background: var(--app-header-bg); border-color: var(--app-border); height: 64px;"
    >
      <div class="max-w-[1600px] h-full mx-auto px-4 md:px-6 flex items-center justify-between gap-3">

        <!-- المنطقة 1: الشعار والهوية الرسمية وزر طي/توسيع القائمة -->
        <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            id="btnHeaderToggleSidebar"
            onclick="window.toggleSidebarCollapse()"
            class="hidden lg:flex w-8.5 h-8.5 rounded-lg items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition active:scale-90 cursor-pointer shadow-sm"
            aria-label="${isEn ? 'Toggle sidebar' : 'طي وتوسيع القائمة الجانبية'}"
            title="${isEn ? 'Toggle sidebar ( [ )' : 'طي وتوسيع القائمة الجانبية ( [ )'}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <a href="#home" onclick="if(window.navigateTo) window.navigateTo('home');" class="flex items-center gap-2.5 group cursor-pointer text-start">
            <img
              src="${LOGO_ICON_DATA_URL}"
              alt="${COMPANY_SHORT}"
              class="h-8 sm:h-9 w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
              onerror="this.src='${LOGO_ICON_PATH}'"
            />
            <div class="leading-tight">
              <div class="text-[13px] sm:text-[15px] font-black tracking-wide text-white flex items-center gap-1.5">
                <span>MSCANCO</span>
                <span class="text-amber-400">EGYPT</span>
              </div>
              <div class="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate hidden sm:block">
                ${isEn ? COMPANY_NAME_EN : COMPANY_NAME_AR}
              </div>
            </div>
          </a>
        </div>

        <!-- المنطقة 2: شريط البحث الشامل ومبدل الأدوار (Desktop) -->
        <div class="hidden lg:flex items-center gap-3 flex-1 max-w-lg mx-4">
          <!-- حقل البحث السريع مع اختصار لوحة المفاتيح [/] -->
          <div class="relative w-full">
            <input
              type="text"
              id="globalSearchInput"
              placeholder="${isEn ? 'Quick search tickets, assets, lines... ( / )' : 'بحث سريع في البلاغات، الماكينات، الخطوط... ( / )'}"
              onkeydown="if(event.key === 'Enter') { window.executeGlobalSearch(this.value); }"
              class="w-full h-9 pl-9 pr-9 text-xs rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans"
            />
            <span class="absolute inset-y-0 start-2.5 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <kbd class="absolute inset-y-0 end-2.5 my-auto h-5 px-1.5 flex items-center text-[10px] font-mono text-slate-400 bg-slate-900/60 border border-slate-700 rounded shadow-sm pointer-events-none">
              /
            </kbd>
          </div>

          <!-- زر التبديل السريع لمنظور العرض (مدير / فني) -->
          <div class="flex items-center p-0.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shrink-0 text-xs font-semibold">
            <button
              type="button"
              onclick="window.setHomeViewMode('manager')"
              class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeHomeMode === 'manager'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="9"></rect>
                <rect x="14" y="3" width="7" height="5"></rect>
                <rect x="14" y="12" width="7" height="9"></rect>
                <rect x="3" y="16" width="7" height="5"></rect>
              </svg>
              <span>${isEn ? 'Manager' : 'لوحة المدير'}</span>
            </button>
            <button
              type="button"
              onclick="window.setHomeViewMode('technician')"
              class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeHomeMode === 'technician'
                  ? 'bg-amber-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              <span>${isEn ? 'Technician' : 'لوحة الفني'}</span>
            </button>
          </div>
        </div>

        <!-- المنطقة 3: الإجراءات وأدوات التحكم وقائمة المستخدم -->
        <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">

          <!-- زر الإبلاغ الفوري عن عطل (الزر الأساسي الأوحد) -->
          <button
            type="button"
            onclick="window.navigateTo('issue')"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-lg border border-red-500/50 shadow-sm shadow-red-950/40 transition active:scale-95 cursor-pointer">
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>${isEn ? 'Report Breakdown' : 'تسجيل بلاغ عطل'}</span>
          </button>

          <!-- زر الإشعارات -->
          <button
            type="button"
            onclick="${notifAction}"
            aria-label="${isEn ? 'Notifications' : 'الإشعارات'}"
            title="${isEn ? 'Notifications' : 'الإشعارات'}"
            class="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition active:scale-95 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span
              id="headerNotifBadge"
              class="hidden absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold bg-red-600 border border-slate-900 flex items-center justify-center">0</span>
          </button>

          <!-- زر تبديل الثيم -->
          <button
            type="button"
            onclick="if (typeof window.toggleDarkMode === 'function') { window.toggleDarkMode(); }"
            aria-label="${isEn ? 'Toggle theme' : 'تبديل الوضع'}"
            title="${isEn ? 'Toggle theme' : 'تبديل الوضع'}"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition active:scale-95 cursor-pointer">
            ${isDark ? `
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ` : `
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            `}
          </button>

          <!-- زر اللغة -->
          <button
            type="button"
            onclick="if (typeof window.toggleLanguage === 'function') { window.toggleLanguage(); }"
            aria-label="${isEn ? 'عربي' : 'English'}"
            title="${isEn ? 'عربي' : 'English'}"
            class="h-8 px-2.5 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition active:scale-95 cursor-pointer">
            ${isEn ? 'AR' : 'EN'}
          </button>

          <!-- بطاقة المستخدم المدمجة وقائمة المستخدم المنسدلة -->
          ${isLoggedIn ? `
            <div class="relative">
              <button
                type="button"
                id="userProfileTrigger"
                onclick="window.toggleUserMenu(event)"
                class="flex items-center gap-2 p-1 pl-2 rtl:pl-1 rtl:pr-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 transition cursor-pointer">
                <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-inner">
                  ${escapeBrandHtml(initial)}
                </div>
                <div class="hidden md:block text-start leading-tight">
                  <div class="text-xs font-bold text-slate-200 truncate max-w-[110px]">${escapeBrandHtml(name)}</div>
                  <div class="text-[10px] font-semibold text-slate-400 truncate max-w-[110px]">${escapeBrandHtml(role)}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              <!-- قائمة المستخدم المنسدلة -->
              <div
                id="userProfileDropdown"
                class="hidden absolute end-0 mt-1.5 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-start"
                style="box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6);"
              >
                <div class="px-3.5 py-2.5 border-b border-slate-800">
                  <div class="font-bold text-xs text-white truncate">${escapeBrandHtml(name)}</div>
                  <div class="text-[11px] text-slate-400 truncate">${escapeBrandHtml(job)}</div>
                  <div class="mt-1.5">
                    <span class="inline-block text-[9px] font-bold px-2 py-0.5 rounded border ${roleBadgeStyle}">
                      ${role}
                    </span>
                  </div>
                </div>

                <div class="py-1">
                  <button
                    type="button"
                    onclick="window.setHomeViewMode('manager'); window.toggleUserMenu();"
                    class="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="7" height="9"></rect>
                      <rect x="14" y="3" width="7" height="5"></rect>
                    </svg>
                    <span>${isEn ? 'Switch to Manager Dashboard' : 'التحويل للوحة الإدارة والقرارات'}</span>
                  </button>

                  <button
                    type="button"
                    onclick="window.setHomeViewMode('technician'); window.toggleUserMenu();"
                    class="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    <span>${isEn ? 'Switch to Technician Workbench' : 'التحويل لبيئة عمل الفني'}</span>
                  </button>

                  ${role === 'ADMIN' ? `
                    <button
                      type="button"
                      onclick="window.navigateTo('system'); window.toggleUserMenu();"
                      class="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                      <span>${isEn ? 'System Settings' : 'لوحة إدارة النظام'}</span>
                    </button>
                  ` : ''}
                </div>

                <div class="border-t border-slate-800 pt-1 mt-1">
                  <button
                    type="button"
                    onclick="if(confirm('${isEn ? 'Are you sure you want to logout?' : 'هل أنت متأكد من تسجيل الخروج؟'}')) { window.logout(); }"
                    class="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>${isEn ? 'Logout' : 'تسجيل الخروج'}</span>
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <button
              type="button"
              onclick="window.navigateTo('login')"
              class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition">
              ${isEn ? 'Login' : 'تسجيل الدخول'}
            </button>
          `}

        </div>

      </div>
    </header>
  `;
}

// دالة تبديل قائمة المستخدم المنسدلة
if (typeof window !== "undefined") {
  window.toggleUserMenu = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("userProfileDropdown");
    if (dropdown) dropdown.classList.toggle("hidden");
  };

  document.addEventListener("click", function(e) {
    const dropdown = document.getElementById("userProfileDropdown");
    const trigger = document.getElementById("userProfileTrigger");
    if (dropdown && !dropdown.classList.contains("hidden") && trigger && !trigger.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  window.setHomeViewMode = function(mode) {
    localStorage.setItem("home_view_mode", mode);
    if (window.currentPage === "home") {
      if (typeof window.render === "function") window.render();
      if (typeof window.loadDashboardStats === "function") window.loadDashboardStats();
    }
    if (typeof window.refreshHeader === "function") {
      window.refreshHeader();
    }
  };

  window.executeGlobalSearch = function(query) {
    if (!query || !query.trim()) return;
    localStorage.setItem("maintenance_search_keyword", query.trim());
    if (typeof window.navigateTo === "function") {
      window.navigateTo("maintenanceSearch");
    }
  };

  // اختصار لوحة المفاتيح [/] للتركيز على البحث الشامل و [N] لتسجيل بلاغ عطل
  document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const input = document.getElementById("globalSearchInput");
      if (input) {
        input.focus();
        input.select();
      }
    } else if ((e.key === "n" || e.key === "N" || e.key === "ى") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (typeof window.navigateTo === "function") {
        window.navigateTo("issue");
      }
    }
  });
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
    now.toLocaleDateString((window.currentLang === "en" ? "en-US" : "ar-EG")) +
    " " +
    now.toLocaleTimeString((window.currentLang === "en" ? "en-US" : "ar-EG"));

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
  if (!headerEl || !document?.documentElement?.style?.setProperty) return;
  const height = headerEl.offsetHeight || 64;
  document.documentElement.style.setProperty(
    "--app-header-h",
    height + "px"
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

// حقن أنماط الهيدر الرسمي الموحّد (بما فيها قواعد @media print لتكرار
// الهيدر في كل صفحة طباعة) مرة واحدة من أول تحميل للتطبيق - جاهزة لأي
// تقرير أو صفحة تستخدم buildCompanyHeaderHtml()/wrapHtmlForRepeatingPrintHeader()
// بعد كده من غير ما تحتاج تستدعيها بنفسها في كل مرة.
if (typeof window !== "undefined") {
  injectCompanyHeaderPrintStyles();
}
