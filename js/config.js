// ============================================================
// Firebase SDK
// ============================================================

import {
  initializeApp,
  getApps,
  getApp,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getStorage,
  getAuth,
  onAuthStateChanged
} from "./firebase.js";


// ============================================================
// Google Apps Script - نسخة احتياطية
// ============================================================

export const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz2O9L2NTyJvKQgUwzmFASSzoX7EIYd6H21g3J--bJYbdB-zsW2NYubv8WRw87GORni/exec";


// ============================================================
// ImgBB - استضافة الصور (مجاني بالكامل بدون بطاقة ائتمان)
// ============================================================
//
// بديل عن Firebase Storage، لأن Firebase بقى من فبراير 2026
// بيطلب ربط بطاقة (Blaze Plan) حتى للاستخدام المجاني.
//
// خطوات الحصول على مفتاح مجاني (دقيقة واحدة، بالإيميل بس):
//   1. افتح https://api.imgbb.com/
//   2. اعمل حساب مجاني (بالإيميل، بدون أي بيانات دفع)
//   3. هتلاقي "API Key" ظاهر في صفحتك الرئيسية بعد تسجيل الدخول
//   4. الصقه هنا بدل النص "ضع_مفتاح_ImgBB_هنا"
//
// ============================================================

export const IMGBB_API_KEY = "9e43fc30da5df3c4cdf213f1725504c7";


// ============================================================
// إعدادات Firebase
// ============================================================

const firebaseConfig = {

  apiKey:
    "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",

  authDomain:
    "maintenance-defect-system.firebaseapp.com",

  projectId:
    "maintenance-defect-system",

  storageBucket:
    "maintenance-defect-system.firebasestorage.app",

  messagingSenderId:
    "1065779979535",

  appId:
    "1:1065779979535:web:6d53e69c4cfde57b414a7a"

};


// ============================================================
// ثوابت التطبيق
// ============================================================

export const APP_VERSION = "1.3.0";

export const APP_NAME =
  "MAINTENANCE & DEFECT SYSTEM";

// إصلاح (أمان/خصوصية): كانت DEBUG ثابتة true دايماً، فبيانات المستخدم
// الكاملة (الاسم/الهاتف/الدور/الصلاحيات) كانت بتتطبع في console
// المتصفح في كل عملية دخول حتى في بيئة الإنتاج (راجع auth/login.js
// و authHandlers.js اللي بيعتمدوا على DEBUG عشان يقرروا يطبعوا ولا
// لأ). دلوقتي DEBUG بتتحدد ديناميكياً من الـ hostname: true بس على
// localhost/الأجهزة المحلية ومعاينة Replit، وfalse في أي دومين إنتاج
// تاني (Firebase Hosting أو أي دومين مخصص)
export const DEBUG = (() => {
  try {
    const host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".replit.dev") ||
      host.endsWith(".repl.co")
    );
  } catch {
    return false;
  }
})();


// ============================================================
// الصلاحيات الموحدة
// ============================================================
//
// مهم:
// أسماء الصلاحيات هنا مطابقة تماماً للمطلوب
// والـ RequestsView و SystemView
//
// ============================================================

// الصلاحيات الافتراضية للمستخدم الجديد بعد القبول
export const DEFAULT_USER_PERMISSIONS =
  "home,maintenance,issue,suggestions,pm,log,reports,qr,errorScanner,kb,statistics,export";

// جميع الصلاحيات الموجودة في النظام
export const ALL_PERMISSIONS = [
  "home",

  // الصيانة
  "maintenance",
  "issue",
  "suggestions",
  "pm",
  "log",
  "reports",
  "qr",
  "errorScanner",

  // المعرفة
  "kb",

  // الإحصائيات والتقارير
  "statistics",
  "export",

  // إدارة النظام
  "users",
  "requests",
  "machines",
  "settings",

  // كل الصلاحيات
  "all"
];


// ============================================================
// تهيئة Firebase
// ============================================================

export const app =
  getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


// Offline Persistence (Firestore v9+): بيخلي البيانات اللي
// اتقرت قبل كده متاحة للقراءة حتى من غير إنترنت (IndexedDB محلي
// جوه المتصفح، بيدير نفسه تلقائياً). لو المتصفح مايدعمش الميزة
// دي (نادر جداً) بنرجع لـ getFirestore العادي بدل ما نكسر التطبيق.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    console.warn("[Firestore] تعذّر تفعيل Offline Persistence، هيشتغل التطبيق عادي بس بدون تخزين محلي:", error.message);
    return getFirestore(app);
  }
})();


export const storage =
  getStorage(app);


export const auth =
  getAuth(app);

/**
 * دالة للتأكد من استعادة جلسة تسجيل الدخول من Firebase Auth قبل تنفيذ أي استعلام
 */
export function ensureAuthReady() {
  return new Promise((resolve) => {
    if (auth && typeof auth.authStateReady === "function") {
      auth.authStateReady().then(() => resolve(auth.currentUser)).catch(() => resolve(auth.currentUser));
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (typeof unsubscribe === "function") unsubscribe();
        resolve(user);
      }, () => resolve(null));
    }
  });
}


// ============================================================
// Firebase Authentication - تحويل رقم الموبايل لإيميل داخلي
// ============================================================
//
// التطبيق بيستخدم رقم الموبايل كمعرّف دخول (زي ما هو في الواجهة)
// لكن Firebase Authentication (Email/Password - مجاني بالكامل بدون
// Blaze، بعكس Phone Auth اللي بيحتاج SMS) محتاج إيميل. الدالة دي
// بتحوّل الرقم لإيميل داخلي وهمي يُستخدم فقط كمعرّف لـ Firebase Auth
// (المستخدم نفسه لسه بيكتب رقم موبايله في واجهة الدخول زي ما هو).
// ============================================================

export function phoneToAuthEmail(phone) {

  const digitsOnly =
    String(phone || "")
      .replace(/\D/g, "");

  return `${digitsOnly}@maintenance-defect-system.local`;

}


// ============================================================
// الترجمات
// ============================================================

export const translations = {

  // ==========================================================
  // العربية
  // ==========================================================

  ar: {

    dir: "rtl",
    langBtn: "EN",

    welcome: "أهلاً:",
    today: "اليوم",

    // Dashboard
    dashTitle: "📊 لوحة المتابعة",

    openTickets:
      "بلاغات مفتوحة",

    pmLate:
      "PM متأخرة",

    todayDefects:
      "عيوب اليوم",


    // Maintenance
    secMaint:
      "🛠️ قسم الصيانة والمهام",

    m1:
      "تسجيل بلاغ",

    m2:
      "تسجيل PM",

    m3:
      "سجل الصيانة",

    m4:
      "الجدولة",

    m5:
      "مسح QR الماكينات",


    // Defects
    secDefects:
      "📦 قسم تحليل عيوب الإنتاج",

    d1:
      "تصوير عيب",

    d3:
      "قاعدة المعرفة",

    d4:
      "الإحصائيات",

    d5:
      "تصدير التقارير",


    // Users
    secUsers:
      "👥 إدارة المستخدمين",

    u1:
      "إدارة الصلاحيات والمستخدمين",


    // Navigation
    navHome:
      "الرئيسية",

    navMaintenance:
      "الصيانة",

    navNotifications:
      "الإشعارات",

    navSystem:
      "النظام",


    // Issue
    issueTitle:
      "تسجيل عطل أو ملاحظة",

    line:
      "الخط",

    selectLine:
      "اختر الخط",

    machine:
      "الماكينة",

    selectMachine:
      "اختر الماكينة",

    priority:
      "درجة الأولوية",

    issueType:
      "نوع البلاغ",

    category:
      "نوع العطل",

    selectCategory:
      "اختر نوع العطل",

    description:
      "وصف المشكلة",

    enterDescription:
      "اكتب وصف المشكلة بدقة...",

    locationInMachine:
      "مكان العطل داخل الماكينة",

    suggestion:
      "اقتراح الحل (اختياري)",

    enterSuggestion:
      "إذا كان لديك اقتراح لحل المشكلة...",

    attachPhoto:
      "صورة توضيحية (اختياري)",

    status:
      "حالة البلاغ",

    saveAndSend:
      "حفظ وإرسال البلاغ",

    back:
      "رجوع",


    // System
    users:
      "المستخدمون",

    requests:
      "طلبات الانضمام",

    machines:
      "الماكينات",

    settings:
      "الإعدادات",


    // General
    logout:
      "تسجيل الخروج ➔",

    footer:
      "© 2026 جميع الحقوق محفوظة | Mohamed Hussein",

    chartLabel:
      "أكثر الماكينات أعطالاً",

    // ==========================================================
    // إضافة: مفاتيح خاصة بكارتات الرئيسية (homeView.js) - أسماء
    // مستقلة عن المفاتيح العامة فوق (زي openTickets) عشان معانيها
    // مختلفة شوية (عطل/بلاغ) ومربوطة بكارت معيّن في التصميم
    // ==========================================================
    home: {
      welcome: "مرحباً،",
      // إضافة: نص احتياطي فقط لو localStorage("name"/"job") فاضية -
      // مش نص واجهة ثابت، ده بديل لبيانات مستخدم حقيقية فاضية
      defaultName: "المستخدم",
      defaultJob: "فني صيانة",
      statsOverview: "ملخص المؤشرات الحية",
      kpiOpen: "أعطال مفتوحة",
      kpiCritical: "يوجد بلاغ حرج",
      kpiClosed: "تم إصلاحها",
      kpiToday: "أعطال اليوم",
      kpiTotal: "إجمالي البلاغات",
      kpiOverdue: "بلاغات متأخرة",
      kpiOverdueHint: "مفتوحة منذ أكثر من 24 ساعة",

      mttr: "متوسط زمن الإصلاح",
      topMachine: "أكثر ماكينة عطلاً",
      topTech: "أفضل فني",
      noData: "لا توجد بيانات",

      // إضافة: أسماء أيام الأسبوع لعناوين الرسم البياني في الرئيسية
      // (كانت ثابتة بالعربي جوه workflow.js - initMainChart)
      weekdays: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],

      quickAccess: "الوصول السريع",
      reportIssue: "إبلاغ عن عطل",
      reportIssueDesc: "تسجيل بلاغ جديد",

      kbQuick: "قاعدة المعرفة",
      kbQuickDesc: "دليل الإصلاح والحلول",
      statsQuick: "الإحصائيات",
      statsQuickDesc: "معدل العيوب والتكرار",

      kaizenTitle: "💡 الكايزن",
      kaizenSubmit: "إرسال مقترح",
      kaizenSubmitDesc: "مقترح كايزن جديد",
      kaizenTrack: "متابعة مقترحاتي",
      kaizenTrackDesc: "الحالة والتعديل المطلوب",

      chartTitle: "تحليل الأداء والأعطال",
      chartDaily: "يومي",
      chartWeekly: "أسبوعي",
      chartMonthly: "شهري",
      chartTypeLine: "خطي",
      chartTypeArea: "مساحة",
      chartTypeBar: "أعمدة",

      contactDev: "تواصل مع المطور",
      // إضافة: نص رسالة الواتساب الجاهزة لزرار "تواصل مع المطور"
      waMessage: "السلام عليكم، أود التواصل معك بخصوص تطبيق الصيانة.",
      logoutConfirm: "هل أنت متأكد من رغبتك في تسجيل الخروج؟"
    },

    // ==========================================================
    // إضافة: ترجمة شاملة (Global i18n) - مفاتيح عناصر مشتركة بين
    // أكتر من صفحة (زرار رجوع، تحميل، إلخ) - بدل تكرارها في كل
    // namespace خاص بصفحة
    // ==========================================================
    common: {
      back: "⬅ رجوع",
      loading: "جاري التحميل...",
      cancel: "إلغاء",
      confirm: "تأكيد",
      required: "مطلوب",
      noData: "لا توجد بيانات"
    },


    // مفاتيح خاصة بصفحة "قسم الصيانة" (MaintenanceView.js)
    maintenance: {
      title: "قسم الصيانة",
      subtitle: "إدارة بلاغات الأعطال وصيانة المعدات",
      badge: "الورشة",
      issueTitle: "تسجيل عطل",
      issueDesc: "إبلاغ سريع عن توقف",
      ticketsTitle: "متابعة البلاغات",
      ticketsDesc: "تصنيف، إسناد، فحص وإغلاق",
      kaizenTitle: "نظام كايزن",
      kaizenDesc: "مقترحات التحسين المستمر",
      kaizenBoardTitle: "متابعة الكايزن",
      kaizenBoardDesc: "مراجعة واعتماد المقترحات",
      searchTitle: "البحث والفلترة المتقدمة",
      searchDesc: "فلترة البلاغات وسجلات الصيانة الوقائية معاً",
      searchOpen: "فتح ↩",
      scannerTitle: "Machine Error Scanner",
      scannerDesc: "تصوير شاشة العطل والبحث عنه تلقائياً",
      scannerBtn: "مسح 📷",
      qrTitle: "مسح QR الماكينات",
      qrDesc: "وصول سريع لبيانات المعدة بالكاميرا",
      qrBtn: "مسح 📷"
    },

    // مفاتيح خاصة بصفحة "إدارة النظام" (SystemView.js)
    system: {
      title: "إدارة النظام والتحكم",
      subtitle: "إدارة المستخدمين والصلاحيات وإعدادات التطبيق",
      usersTitle: "المستخدمون",
      usersDesc: "إدارة الحسابات والصلاحيات",
      requestsTitle: "طلبات الانضمام",
      requestsDesc: "مراجعة المستخدمين الجدد",
      machinesTitle: "الماكينات",
      machinesDesc: "إضافة/تعديل أنواع الماكينات",
      settingsTitle: "الإعدادات",
      settingsDesc: "إعدادات النظام",
      noAccess: "ليس لديك صلاحيات لإدارة النظام."
    },

    // مفاتيح خاصة بصفحة "قاعدة المعرفة" (KnowledgeBaseView.js)
    kb: {
      title: "قاعدة المعرفة",
      subtitle: "دليل الإصلاح والحلول لأعطال الماكينات المسجلة، مع إمكانية تصفح الأكثر تكراراً حسب الفترة.",
      searchPlaceholder: "🔍 ابحث بكود العطل، الماكينة، أو كلمة...",
      day: "يومي",
      week: "أسبوعي",
      month: "شهري",
      all: "الكل",
      // مفاتيح إضافية لمنطق knowledgeBase.js (ملخص الفترة + القائمة)
      periodDay: "اليوم",
      periodWeek: "هذا الأسبوع",
      periodMonth: "هذا الشهر",
      periodAll: "كل قاعدة المعرفة",
      loadingKb: "جاري تحميل قاعدة المعرفة...",
      calculating: "جاري الحساب...",
      loggedError: "عطل مسجل",
      totalOccurrences: "إجمالي الظهور",
      distinctCodes: "أكواد أعطال مختلفة",
      pendingReview: "قيد المراجعة",
      repeatedTimes: "تكرر {n} مرة",
      machineLine: "الماكينة/الخط:",
      probableCause: "السبب المحتمل:",
      solution: "الحل:",
      repairSteps: "خطوات الإصلاح:",
      notSpecified: "غير محدد",
      emptyAll: "لا توجد أعطال في قاعدة المعرفة بعد.",
      emptyPeriod: "لا توجد أعطال مسجلة خلال هذه الفترة."
    },

    // مفاتيح خاصة بصفحة "الإحصائيات" (StatsView.js)
    stats: {
      title: "الإحصائيات",
      subtitle: "تحليل بلاغات الأعطال حسب الفترة",
      day: "اليوم",
      week: "الأسبوع",
      month: "الشهر",
      all: "الكل",
      loadingStats: "جاري تحميل الإحصائيات...",
      topMachines: "أكثر الماكينات عطلاً",
      noChartData: "لا توجد بلاغات كافية لعرض الرسم البياني خلال هذه الفترة.",
      priorityDist: "توزيع الأولويات",
      lineDist: "توزيع البلاغات حسب الخط",
      mttr: "متوسط زمن الإصلاح",
      techPerf: "أداء الفنيين (الأكثر إنجازاً)",
      // مفاتيح إضافية لمنطق statistics.js
      periodDay: "اليوم",
      periodWeek: "هذا الأسبوع",
      periodMonth: "هذا الشهر",
      periodAll: "كل الفترات",
      totalTickets: "إجمالي البلاغات",
      openTickets: "مفتوحة",
      resolvedTickets: "تم إصلاحها",
      completionRate: "معدل الإنجاز",
      errorsCountLabel: "عدد الأعطال",
      priorityHighLabel: "عالية",
      priorityMediumLabel: "متوسطة",
      priorityLowLabel: "منخفضة",
      noLineData: "لا توجد بيانات كافية خلال هذه الفترة.",
      mttrNoData: "لا توجد بلاغات مُنجزة كافية لحساب متوسط زمن الإصلاح خلال هذه الفترة.",
      mttrMinute: "دقيقة",
      mttrHour: "ساعة",
      mttrDay: "يوم",
      mttrBasedOn: "بناءً على {n} بلاغ مُنجز",
      noTechData: "لا توجد بيانات كافية عن أداء الفنيين خلال هذه الفترة.",
      ticketWord: "بلاغ"
    },

    // مفاتيح خاصة بصفحة "Machine Error Scanner" (ErrorScannerView.js)
    errorScanner: {
      title: "Machine Error Scanner",
      subtitle: "صوّر الخطأ الظاهر على شاشة الماكينة، وسيتم قراءته والبحث عنه تلقائياً في قاعدة المعرفة.",
      machineType: "نوع الماكينة",
      selectMachine: "اختر نوع الماكينة",
      captureBtn: "تصوير الشاشة",
      galleryBtn: "من المعرض",
      readyStatus: "جاهز لالتقاط صورة شاشة العطل.",
      errorCode: "Error Code",
      errorCodePlaceholder: "سيتم تعبئته تلقائياً بعد قراءة الصورة، ويمكن تعديله",
      errorMessage: "Error Message (النص المستخرج من الصورة)",
      errorMessagePlaceholder: "سيظهر هنا النص المستخرج من الصورة تلقائياً",
      manualSearch: "أو ابحث يدوياً",
      manualPlaceholder: "اكتب رقم العطل أو النص",
      searchBtn: "بحث في قاعدة المعرفة",
      // مفاتيح إضافية لمنطق errorScanner.js
      selectPlaceholder: "اختر...",
      notImage: "⚠️ الملف المختار ليس صورة.",
      fileTooLarge: "❌ حجم الصورة كبير جداً (الحد الأقصى 10MB)",
      preparingImage: "⏳ جاري تجهيز الصورة...",
      readingOcr: "🔍 جاري قراءة النص من الصورة (OCR)...",
      codeExtracted: "✅ تم استخراج كود مقترح: {code} (يمكنك تعديله قبل البحث)",
      codeNotFound: "⚠️ لم يتم التعرف تلقائياً على كود واضح، يرجى إدخاله يدوياً بعد مراجعة النص المستخرج.",
      ocrError: "❌ لم استطع قراءة الكود. حاول تصوير اوضح",
      tesseractLoadError: "تعذر تحميل مكتبة قراءة النص (OCR)",
      enterCodeFirst: "⚠️ يرجى إدخال أو استخراج كود العطل أولاً أو استخدام البحث اليدوي.",
      searchingKb: "🔍 جاري البحث في قاعدة المعرفة...",
      genericSearchError: "حدث خطأ أثناء البحث",
      foundTitle: "✅ تم العثور على العطل",
      verifiedStatus: "معتمد",
      pendingReviewStatus: "قيد المراجعة",
      errorCodeLabel: "كود العطل",
      machineLineLabel: "الماكينة / الخط",
      causeLabel: "السبب المحتمل",
      solutionLabel: "الحل",
      stepsLabel: "خطوات الإصلاح",
      notSpecified: "غير محدد",
      logOccurrenceBtn: "📌 تسجيل ظهور هذا العطل الآن",
      verifyBtn: "✅ اعتماد هذا العطل",
      scanAnotherBtn: "🔄 فحص عطل آخر",
      loadingHistory: "جاري تحميل السجل...",
      noHistory: "لا يوجد سجل ظهور سابق لهذا العطل بعد.",
      historyTitle: "📋 سجل الأعطال السابق",
      notFoundTitle: "❌ لم يتم العثور على هذا العطل في قاعدة المعرفة",
      notFoundDesc: "يمكنك إضافته الآن، وسيتم حفظه كـ \"قيد المراجعة\" حتى تتم مراجعته.",
      lineLabel: "الخط",
      machineLabelOnly: "الماكينة",
      addNewBtn: "➕ إضافة عطل جديد (قيد المراجعة)",
      causeOrSolutionRequired: "⚠️ يرجى إدخال السبب المحتمل أو الحل على الأقل.",
      genericSaveError: "حدث خطأ أثناء الحفظ",
      occurrenceLogged: "✅ تم تسجيل ظهور العطل في السجل",
      occurrenceLogFailed: "تعذر تسجيل الظهور",
      verifiedSuccess: "تم الاعتماد",
      genericError: "حدث خطأ"
    },

    // مفاتيح خاصة بصفحة "البحث والفلترة المتقدمة" (MaintenanceSearchView.js)
    maintenanceSearch: {
      title: "البحث والفلترة المتقدمة",
      subtitle: "بحث موحّد في بلاغات الأعطال وسجلات الصيانة الوقائية ومقترحات الكايزن، مع فلترة حسب الحالة والماكينة والأولوية والتاريخ.",
      searchPlaceholder: "🔍 ابحث بالماكينة، الوصف، اسم الفني...",
      typeAll: "الكل",
      typeTicket: "🚨 بلاغات",
      typePm: "📝 صيانة",
      typeSuggestion: "💡 كايزن",
      dateAll: "كل الفترات",
      dateToday: "📅 اليوم",
      dateLast7: "🗓️ آخر 7 أيام",
      dateMonth: "📆 هذا الشهر",
      dateYear: "🗓️ هذا العام",
      dateCustom: "🎯 نطاق مخصص",
      statusAll: "كل الحالات",
      statusPending: "جديد",
      statusAssigned: "تم الإسناد",
      statusInProgress: "قيد التنفيذ",
      statusResolved: "بانتظار تأكيد المُبلغ",
      statusClosed: "مغلقة",
      priorityAll: "كل الأولويات",
      priorityHigh: "🔴 عالية",
      priorityMedium: "🟡 متوسطة",
      priorityLow: "🟢 منخفضة",
      machineAll: "كل الماكينات",
      sortNewest: "🕓 الأحدث أولاً",
      sortOldest: "🕘 الأقدم أولاً",
      exportExcel: "📤 Excel",
      exportPdf: "🖨️ PDF"
    },

    // مفاتيح خاصة بصفحة "تسجيل الدخول" (loginView.js)
    login: {
      title: "تسجيل دخول النظام",
      phone: "رقم الموبايل",
      password: "كلمة السر",
      loginBtn: "دخول",
      registerBtn: "➕ إنشاء حساب جديد",
      showHidePass: "إظهار أو إخفاء كلمة المرور"
    },

    // مفاتيح خاصة بصفحة "إنشاء حساب" (registerView.js)
    register: {
      title: "إنشاء حساب جديد",
      fullName: "الاسم بالكامل",
      phone: "رقم الموبايل",
      shift: "الشيفت (Shift)",
      selectShift: "اختر الشيفت",
      password: "كلمة السر",
      confirmPassword: "تأكيد كلمة السر",
      job: "الوظيفة",
      selectJob: "اختر الوظيفة",
      department: "القسم",
      selectDepartment: "اختر القسم",
      deptProduction: "الإنتاج",
      deptMechanical: "الميكانيكا",
      deptElectrical: "الكهرباء",
      code: "رقم الكود",
      submitBtn: "إنشاء الحساب",
      backBtn: "رجوع"
    },

    // مفاتيح بانر حالة الاتصال (offlineBanner.js)
    offline: {
      offlineMsg: "⚠️ لا يوجد اتصال بالإنترنت - سيتم حفظ البلاغات محلياً",
      syncing: "🔄 تم استعادة الاتصال - جاري المزامنة...",
      // {n} بيتستبدل بعدد البلاغات المُزامنة فعلياً (راجع offlineBanner.js)
      syncedWithCount: "✅ تم رفع {n} بلاغ محفوظ بنجاح",
      restored: "✅ تم استعادة الاتصال"
    },

    // مفاتيح النافذة العامة لجمع البيانات (ActionModal.js)
    actionModal: {
      cancel: "إلغاء",
      confirm: "تأكيد",
      processing: "جاري المعالجة...",
      imagesLabelSuffix: "(١-٣ صور)",
      imagesRequired: "لازم صورة واحدة على الأقل",
      imagesError: "حدث خطأ أثناء معالجة الصور، حاول مرة أخرى",
      fieldRequired: "مطلوب"
    },

    // مفاتيح نافذة الإشعارات العامة (NotificationsModal.js)
    notifications: {
      title: "🔔 الإشعارات",
      markAll: "تحديد الكل كمقروء",
      loading: "جاري التحميل...",
      noUser: "تعذر تحديد المستخدم الحالي.",
      loadError: "تعذر تحميل الإشعارات، حاول مرة أخرى.",
      empty: "لا توجد إشعارات."
    },

    // مفاتيح نافذة تفاصيل التذكرة (TicketDetailsModal.js)
    ticketDetailsModal: {
      title: "🔍 تفاصيل البلاغ",
      loading: "جاري التحميل...",
      loadError: "تعذر تحميل بيانات التذكرة.",
      machine: "الماكينة",
      status: "الحالة",
      reportedBy: "المُبلّغ",
      assignedTo: "مُسندة إلى",
      repairImages: "📷 صور بعد الإصلاح",
      statusLog: "🕒 سجل الحالات",
      noLog: "لا يوجد سجل بعد."
    },

    // مفاتيح صفحات عامة (pageRenderer.js: قيد التطوير / غير مصرح /
    // شاشات users - tickets - kaizenBoard المُضمَّنة مباشرة هناك)
    pageRenderer: {
      comingSoonTitle: "🚧 قيد التطوير",
      comingSoonMsg: "لم تُفعّل بعد وسيتم إضافتها قريباً.",
      unauthorizedTitle: "⚠️ غير مصرح",
      unauthorizedMsg: "ليس لديك صلاحية للوصول إلى:",
      usersTitle: "👥 إدارة المستخدمين",
      refreshList: "🔄 تحديث القائمة",
      loadingData: "جاري تحميل البيانات...",
      ticketsTitle: "📋 متابعة البلاغات",
      monthlyReportBtn: "🗓️ تقرير شهري (PDF)",
      loadingTickets: "جاري تحميل التذاكر...",
      kaizenBoardTitle: "💡 متابعة الكايزن",
      loadingSuggestions: "جاري تحميل المقترحات..."
    },

    // مفاتيح أزرار دورة حياة البلاغ (permissions.js: getTicketActions)
    ticketActions: {
      assign: "🛠️ تصنيف وإسناد",
      start: "▶️ بدء التنفيذ",
      resolve: "✅ تم الإصلاح",
      confirm: "✔️ تأكيد الإغلاق",
      reject: "❌ رفض ورجوع للفني",
      reassign: "🔄 إعادة إسناد",
      details: "🔍 تفاصيل"
    },

    // مفاتيح أزرار دورة حياة مقترح الكايزن (permissions.js: getSuggestionActions)
    suggestionActions: {
      review: "🔍 بدء المراجعة",
      reject: "❌ رفض",
      approveAssign: "✅ موافقة وإسناد",
      requestRevision: "✏️ طلب تعديل",
      returnToReview: "↩️ إعادة للمراجعة",
      resubmit: "✏️ تعديل وإعادة الإرسال",
      implement: "🏁 تم التنفيذ",
      details: "🔍 تفاصيل"
    },

    // مفاتيح خاصة بـ authHandlers.js (دخول/تسجيل/تسجيل خروج/قائمة مستخدمين)
    auth: {
      fillPhonePassword: "⚠️ يرجى إدخال رقم الموبايل وكلمة السر.",
      loggingIn: "جاري تسجيل الدخول...",
      loginFailed: "فشل تسجيل الدخول.",
      loginErrorGeneric: "حدث خطأ أثناء تسجيل الدخول.",
      fillAllFields: "⚠️ يرجى إدخال جميع البيانات المطلوبة.",
      passwordMismatch: "⚠️ كلمتا السر غير متطابقتين.",
      creatingAccount: "جاري إنشاء الحساب...",
      registerErrorGeneric: "حدث خطأ أثناء التسجيل.",
      registerSuccessDefault: "تم إرسال طلب التسجيل بنجاح.",
      registerErrorCatch: "حدث خطأ أثناء إنشاء الحساب.",
      loadingUsers: "جاري تحميل المستخدمين...",
      loadUsersError: "فشل تحميل المستخدمين",
      errorPrefix: "خطأ:",
      noUsers: "لا يوجد مستخدمون مسجلون حالياً",
      unnamedUser: "مستخدم بدون اسم",
      roleLabel: "الدور:",
      statusLabel: "الحالة:",
      shiftLabel: "الشيفت:",
      departmentLabel: "القسم:",
      loadUsersErrorCatch: "حدث خطأ أثناء تحميل المستخدمين"
    },

    // مفاتيح خاصة بـ ticketsBoard.js (لوحة متابعة البلاغات + التقرير الشهري)
    ticketsBoard: {
      tabAssignedToMe: "🛠️ المُسندة إليّ",
      tabMyTickets: "📌 بلاغاتي",
      tabAwaitingConfirm: "🔍 بانتظار تأكيدي",
      tabAll: "الكل",
      tabPending: "📥 جديدة",
      tabInProgress: "⚙️ قيد التنفيذ",
      tabResolved: "🔍 قيد المراجعة",
      tabClosed: "✔️ مغلقة",
      status: {
        pending: "جديد",
        assigned: "تم الإسناد",
        in_progress: "قيد التنفيذ",
        resolved: "بانتظار تأكيد المُبلغ",
        closed: "مغلقة",
        reopened: "قيد التنفيذ"
      },
      reportedByLabel: "بلّغ:",
      assignedToLabel: "مُسندة إلى:",
      overdueBadge: "متأخر",
      mechanicNotesLabel: "ملاحظات الفني:",
      operatorFeedbackLabel: "ملاحظات المُبلّغ:",
      prevPage: "السابق",
      nextPage: "التالي",
      showingLastBanner: "ℹ️ يتم عرض آخر {n} بلاغ فقط.",
      noPermission: "لا توجد صلاحية لعرض التذاكر لهذا الدور.",
      loadingTickets: "جاري تحميل التذاكر...",
      loadError: "تعذر تحميل التذاكر حالياً. حاول مرة أخرى، ولو استمرت المشكلة تواصل مع الأدمن.",
      empty: "لا توجد تذاكر حالياً في قائمتك.",
      noTechnicians: "⚠️ لا يوجد فنيون/مهندسون نشطون حالياً لإسناد التذكرة لهم.",
      assignTitle: "🛠️ تصنيف وإسناد التذكرة",
      assignSubmit: "إسناد",
      typeLabel: "نوع البلاغ",
      typeBreakdown: "عطل مفاجئ (Breakdown)",
      typePM: "صيانة وقائية (PM)",
      typeOther: "أخرى",
      assignToLabel: "إسناد إلى",
      reassignTitle: "🔄 إعادة إسناد التذكرة",
      reassignSubmit: "إعادة الإسناد",
      reassignToLabel: "إعادة الإسناد إلى",
      resolveTitle: "✅ تسجيل إتمام الإصلاح",
      resolveSubmit: "تم الإصلاح",
      mechanicNotesField: "ملاحظات الفني",
      mechanicNotesPlaceholder: "وصف الإصلاح الذي تم...",
      afterImagesField: "صور بعد الإصلاح",
      rejectTitle: "❌ رفض الإصلاح",
      rejectSubmit: "رفض وإعادة فتح",
      operatorFeedbackField: "ما المشكلة المتبقية؟",
      operatorFeedbackPlaceholder: "مثال: لا يزال يوجد تسريب...",
      genericActionError: "حدث خطأ أثناء تنفيذ الإجراء، حاول مرة أخرى أو تواصل مع الأدمن.",
      actionQueuedOffline: "لا يوجد اتصال بالإنترنت - تم حفظ الإجراء محلياً وسيتم تنفيذه تلقائياً عند عودة الاتصال",
      libsNotLoaded: "❌ مكتبات إنشاء التقرير غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول مرة أخرى.",
      preparingReport: "⏳ جاري تجهيز التقرير...",
      reportDataError: "❌ تعذر تجهيز بيانات التقرير، حاول مرة أخرى.",
      noTicketsForReport: "ℹ️ لا توجد بلاغات خلال آخر 30 يوم لعرضها في التقرير.",
      reportTitle: "📋 التقرير الشهري لبلاغات الصيانة",
      reportPeriodLabel: "الفترة: آخر {n} يوم",
      reportDateLabel: "تاريخ الإصدار:",
      reportRoleLabel: "الصلاحية:",
      reportTotalLabel: "إجمالي البلاغات:",
      roleAdmin: "مدير النظام",
      roleManager: "مدير الإنتاج",
      roleOther: "فني/مهندس",
      reportDescLabel: "وصف البلاغ:",
      reportMechanicNotesLabel: "ملاحظات الفني:",
      reportGenerateError: "❌ حدث خطأ أثناء إنشاء التقرير، حاول مرة أخرى.",
      reportFileName: "تقرير-شهري"
    }

  },


  // ==========================================================
  // English
  // ==========================================================

  en: {

    dir: "ltr",
    langBtn: "عربي",

    welcome:
      "Welcome:",

    today:
      "Today",


    // Dashboard
    dashTitle:
      "📊 Dashboard Overview",

    openTickets:
      "Open Tickets",

    pmLate:
      "Overdue PM",

    todayDefects:
      "Today Defects",


    // Maintenance
    secMaint:
      "🛠️ Maintenance & Tasks",

    m1:
      "New Ticket",

    m2:
      "Record PM",

    m3:
      "Maint. Log",

    m4:
      "Schedule",

    m5:
      "Scan Machine QR",


    // Defects
    secDefects:
      "📦 Defects Analysis",

    d1:
      "Capture Defect",

    d3:
      "Knowledge Base",

    d4:
      "Statistics",

    d5:
      "Export Reports",


    // Users
    secUsers:
      "👥 Users Management",

    u1:
      "Manage Roles & Users",


    // Navigation
    navHome:
      "Home",

    navMaintenance:
      "Maintenance",

    navNotifications:
      "Notifications",

    navSystem:
      "System",


    // Issue
    issueTitle:
      "Report Breakdown / Observation",

    line:
      "Line",

    selectLine:
      "Select Line",

    machine:
      "Machine",

    selectMachine:
      "Select Machine",

    priority:
      "Priority",

    issueType:
      "Issue Type",

    category:
      "Issue Category",

    selectCategory:
      "Select Category",

    description:
      "Description",

    enterDescription:
      "Describe the problem accurately...",

    locationInMachine:
      "Location in Machine",

    suggestion:
      "Suggested Solution (Optional)",

    enterSuggestion:
      "If you have a suggested solution...",

    attachPhoto:
      "Photo (Optional)",

    status:
      "Issue Status",

    saveAndSend:
      "Save & Submit",

    back:
      "Back",


    // System
    users:
      "Users",

    requests:
      "Join Requests",

    machines:
      "Machines",

    settings:
      "Settings",


    // General
    logout:
      "Logout ➔",

    footer:
      "© 2026 All Rights Reserved | Mohamed Hussein",

    chartLabel:
      "Top Faulty Machines",

    // Home dashboard cards - see matching Arabic "home" block above
    home: {
      welcome: "Welcome,",
      // Fallback only when localStorage("name"/"job") is empty - not
      // static UI copy, this substitutes missing real user data
      defaultName: "User",
      defaultJob: "Maintenance Technician",
      statsOverview: "Live Metrics Overview",
      kpiOpen: "Open Breakdowns",
      kpiCritical: "Critical breakdown open",
      kpiClosed: "Resolved",
      kpiToday: "Today's Breakdowns",
      kpiTotal: "Total Tickets",
      kpiOverdue: "Overdue Tickets",
      kpiOverdueHint: "Open for more than 24 hours",

      mttr: "Avg. Repair Time (MTTR)",
      topMachine: "Top Faulty Machine",
      topTech: "Top Technician",
      noData: "No data",

      // Weekday labels for the home dashboard chart (previously
      // hardcoded in Arabic inside workflow.js - initMainChart)
      weekdays: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],

      quickAccess: "Quick Access",
      reportIssue: "Report Breakdown",
      reportIssueDesc: "Submit a new ticket",

      kbQuick: "Knowledge Base",
      kbQuickDesc: "Repair guide and solutions",
      statsQuick: "Statistics",
      statsQuickDesc: "Defect rate and recurrence",

      kaizenTitle: "💡 Kaizen",
      kaizenSubmit: "Submit Suggestion",
      kaizenSubmitDesc: "New Kaizen suggestion",
      kaizenTrack: "Track My Suggestions",
      kaizenTrackDesc: "Status & requested revisions",

      chartTitle: "Performance & Breakdown Analysis",
      chartDaily: "Daily",
      chartWeekly: "Weekly",
      chartMonthly: "Monthly",
      chartTypeLine: "Line",
      chartTypeArea: "Area",
      chartTypeBar: "Bar",

      contactDev: "Contact Developer",
      // Pre-filled WhatsApp message text for the "Contact Developer" button
      waMessage: "Hello, I'd like to get in touch regarding the maintenance app.",
      logoutConfirm: "Are you sure you want to log out?"
    },

    common: {
      back: "⬅ Back",
      loading: "Loading...",
      cancel: "Cancel",
      confirm: "Confirm",
      required: "Required",
      noData: "No data"
    },

    maintenance: {
      title: "Maintenance",
      subtitle: "Manage breakdown tickets and equipment maintenance",
      badge: "Workshop",
      issueTitle: "Report Breakdown",
      issueDesc: "Quick report of a stoppage",
      ticketsTitle: "Track Tickets",
      ticketsDesc: "Classify, assign, inspect and close",
      kaizenTitle: "Kaizen System",
      kaizenDesc: "Continuous improvement suggestions",
      kaizenBoardTitle: "Track Kaizen",
      kaizenBoardDesc: "Review and approve suggestions",
      searchTitle: "Advanced Search & Filter",
      searchDesc: "Filter tickets and PM records together",
      searchOpen: "Open ↩",
      scannerTitle: "Machine Error Scanner",
      scannerDesc: "Photograph the error screen and search automatically",
      scannerBtn: "Scan 📷",
      qrTitle: "Scan Machine QR",
      qrDesc: "Quick equipment access via camera",
      qrBtn: "Scan 📷"
    },

    system: {
      title: "System Administration",
      subtitle: "Manage users, permissions and app settings",
      usersTitle: "Users",
      usersDesc: "Manage accounts and permissions",
      requestsTitle: "Join Requests",
      requestsDesc: "Review new users",
      machinesTitle: "Machines",
      machinesDesc: "Add/edit machine types",
      settingsTitle: "Settings",
      settingsDesc: "App settings",
      noAccess: "You don't have permission to manage the system."
    },

    kb: {
      title: "Knowledge Base",
      subtitle: "Repair guide and solutions for logged machine errors, browsable by most frequent per period.",
      searchPlaceholder: "🔍 Search by error code, machine, or keyword...",
      day: "Daily",
      week: "Weekly",
      month: "Monthly",
      all: "All",
      periodDay: "Today",
      periodWeek: "This Week",
      periodMonth: "This Month",
      periodAll: "Entire Knowledge Base",
      loadingKb: "Loading knowledge base...",
      calculating: "Calculating...",
      loggedError: "logged error(s)",
      totalOccurrences: "Total Occurrences",
      distinctCodes: "Distinct Error Codes",
      pendingReview: "Pending Review",
      repeatedTimes: "Occurred {n} times",
      machineLine: "Machine/Line:",
      probableCause: "Probable Cause:",
      solution: "Solution:",
      repairSteps: "Repair Steps:",
      notSpecified: "Not specified",
      emptyAll: "No errors in the knowledge base yet.",
      emptyPeriod: "No errors logged during this period."
    },

    stats: {
      title: "Statistics",
      subtitle: "Breakdown ticket analysis by period",
      day: "Today",
      week: "Week",
      month: "Month",
      all: "All",
      loadingStats: "Loading statistics...",
      topMachines: "Top Faulty Machines",
      noChartData: "Not enough tickets to show a chart for this period.",
      priorityDist: "Priority Distribution",
      lineDist: "Tickets by Line",
      mttr: "Avg. Repair Time (MTTR)",
      techPerf: "Technician Performance (Top Performers)",
      periodDay: "Today",
      periodWeek: "This Week",
      periodMonth: "This Month",
      periodAll: "All Periods",
      totalTickets: "Total Tickets",
      openTickets: "Open",
      resolvedTickets: "Resolved",
      completionRate: "Completion Rate",
      errorsCountLabel: "Error Count",
      priorityHighLabel: "High",
      priorityMediumLabel: "Medium",
      priorityLowLabel: "Low",
      noLineData: "Not enough data for this period.",
      mttrNoData: "Not enough resolved tickets to calculate average repair time for this period.",
      mttrMinute: "min",
      mttrHour: "hr",
      mttrDay: "day",
      mttrBasedOn: "Based on {n} resolved ticket(s)",
      noTechData: "Not enough data on technician performance for this period.",
      ticketWord: "ticket(s)"
    },

    errorScanner: {
      title: "Machine Error Scanner",
      subtitle: "Photograph the error shown on the machine screen - it will be read and searched for automatically in the knowledge base.",
      machineType: "Machine Type",
      selectMachine: "Select machine type",
      captureBtn: "Capture Screen",
      galleryBtn: "From Gallery",
      readyStatus: "Ready to capture the error screen.",
      errorCode: "Error Code",
      errorCodePlaceholder: "Auto-filled after reading the image, editable",
      errorMessage: "Error Message (text extracted from image)",
      errorMessagePlaceholder: "The text extracted from the image will appear here automatically",
      manualSearch: "Or search manually",
      manualPlaceholder: "Type the error code or text",
      searchBtn: "Search Knowledge Base",
      selectPlaceholder: "Select...",
      notImage: "⚠️ The selected file is not an image.",
      fileTooLarge: "❌ Image is too large (max 10MB)",
      preparingImage: "⏳ Preparing image...",
      readingOcr: "🔍 Reading text from image (OCR)...",
      codeExtracted: "✅ Suggested code extracted: {code} (you can edit it before searching)",
      codeNotFound: "⚠️ Could not automatically recognize a clear code, please enter it manually after reviewing the extracted text.",
      ocrError: "❌ Could not read the code. Try a clearer photo.",
      tesseractLoadError: "Could not load the OCR text-reading library",
      enterCodeFirst: "⚠️ Please enter or extract an error code first, or use manual search.",
      searchingKb: "🔍 Searching the knowledge base...",
      genericSearchError: "An error occurred during search",
      foundTitle: "✅ Error Found",
      verifiedStatus: "Verified",
      pendingReviewStatus: "Pending Review",
      errorCodeLabel: "Error Code",
      machineLineLabel: "Machine / Line",
      causeLabel: "Probable Cause",
      solutionLabel: "Solution",
      stepsLabel: "Repair Steps",
      notSpecified: "Not specified",
      logOccurrenceBtn: "📌 Log This Occurrence Now",
      verifyBtn: "✅ Verify This Error",
      scanAnotherBtn: "🔄 Scan Another Error",
      loadingHistory: "Loading history...",
      noHistory: "No prior occurrence history for this error yet.",
      historyTitle: "📋 Prior Error History",
      notFoundTitle: "❌ This error was not found in the knowledge base",
      notFoundDesc: "You can add it now, and it will be saved as \"Pending Review\" until it's reviewed.",
      lineLabel: "Line",
      machineLabelOnly: "Machine",
      addNewBtn: "➕ Add New Error (Pending Review)",
      causeOrSolutionRequired: "⚠️ Please enter at least the probable cause or the solution.",
      genericSaveError: "An error occurred while saving",
      occurrenceLogged: "✅ Error occurrence logged",
      occurrenceLogFailed: "Could not log the occurrence",
      verifiedSuccess: "Verified successfully",
      genericError: "An error occurred"
    },

    maintenanceSearch: {
      title: "Advanced Search & Filter",
      subtitle: "Unified search across breakdown tickets, PM records and Kaizen suggestions, filterable by status, machine, priority and date.",
      searchPlaceholder: "🔍 Search by machine, description, technician...",
      typeAll: "All",
      typeTicket: "🚨 Tickets",
      typePm: "📝 PM",
      typeSuggestion: "💡 Kaizen",
      dateAll: "All periods",
      dateToday: "📅 Today",
      dateLast7: "🗓️ Last 7 days",
      dateMonth: "📆 This month",
      dateYear: "🗓️ This year",
      dateCustom: "🎯 Custom range",
      statusAll: "All statuses",
      statusPending: "New",
      statusAssigned: "Assigned",
      statusInProgress: "In Progress",
      statusResolved: "Awaiting Reporter Confirmation",
      statusClosed: "Closed",
      priorityAll: "All priorities",
      priorityHigh: "🔴 High",
      priorityMedium: "🟡 Medium",
      priorityLow: "🟢 Low",
      machineAll: "All machines",
      sortNewest: "🕓 Newest first",
      sortOldest: "🕘 Oldest first",
      exportExcel: "📤 Excel",
      exportPdf: "🖨️ PDF"
    },

    login: {
      title: "System Login",
      phone: "Mobile Number",
      password: "Password",
      loginBtn: "Login",
      registerBtn: "➕ Create New Account",
      showHidePass: "Show or hide password"
    },

    register: {
      title: "Create New Account",
      fullName: "Full Name",
      phone: "Mobile Number",
      shift: "Shift",
      selectShift: "Select shift",
      password: "Password",
      confirmPassword: "Confirm Password",
      job: "Job Title",
      selectJob: "Select job title",
      department: "Department",
      selectDepartment: "Select department",
      deptProduction: "Production",
      deptMechanical: "Mechanical",
      deptElectrical: "Electrical",
      code: "Employee Code",
      submitBtn: "Create Account",
      backBtn: "Back"
    },

    offline: {
      offlineMsg: "⚠️ No internet connection - tickets will be saved locally",
      syncing: "🔄 Connection restored - syncing...",
      syncedWithCount: "✅ {n} saved ticket(s) uploaded successfully",
      restored: "✅ Connection restored"
    },

    actionModal: {
      cancel: "Cancel",
      confirm: "Confirm",
      processing: "Processing...",
      imagesLabelSuffix: "(1-3 photos)",
      imagesRequired: "At least one photo is required",
      imagesError: "An error occurred while processing the images, try again",
      fieldRequired: "Required"
    },

    notifications: {
      title: "🔔 Notifications",
      markAll: "Mark all as read",
      loading: "Loading...",
      noUser: "Could not identify the current user.",
      loadError: "Could not load notifications, try again.",
      empty: "No notifications."
    },

    ticketDetailsModal: {
      title: "🔍 Ticket Details",
      loading: "Loading...",
      loadError: "Could not load ticket data.",
      machine: "Machine",
      status: "Status",
      reportedBy: "Reported By",
      assignedTo: "Assigned To",
      repairImages: "📷 After-Repair Photos",
      statusLog: "🕒 Status Log",
      noLog: "No log yet."
    },

    pageRenderer: {
      comingSoonTitle: "🚧 Coming Soon",
      comingSoonMsg: "Not activated yet, will be added soon.",
      unauthorizedTitle: "⚠️ Unauthorized",
      unauthorizedMsg: "You don't have permission to access:",
      usersTitle: "👥 User Management",
      refreshList: "🔄 Refresh List",
      loadingData: "Loading data...",
      ticketsTitle: "📋 Track Tickets",
      monthlyReportBtn: "🗓️ Monthly Report (PDF)",
      loadingTickets: "Loading tickets...",
      kaizenBoardTitle: "💡 Track Kaizen",
      loadingSuggestions: "Loading suggestions..."
    },

    ticketActions: {
      assign: "🛠️ Classify & Assign",
      start: "▶️ Start Work",
      resolve: "✅ Resolved",
      confirm: "✔️ Confirm Closure",
      reject: "❌ Reject & Return to Technician",
      reassign: "🔄 Reassign",
      details: "🔍 Details"
    },

    suggestionActions: {
      review: "🔍 Start Review",
      reject: "❌ Reject",
      approveAssign: "✅ Approve & Assign",
      requestRevision: "✏️ Request Revision",
      returnToReview: "↩️ Return to Review",
      resubmit: "✏️ Edit & Resubmit",
      implement: "🏁 Implemented",
      details: "🔍 Details"
    },

    auth: {
      fillPhonePassword: "⚠️ Please enter your mobile number and password.",
      loggingIn: "Logging in...",
      loginFailed: "Login failed.",
      loginErrorGeneric: "An error occurred while logging in.",
      fillAllFields: "⚠️ Please fill in all required fields.",
      passwordMismatch: "⚠️ The passwords do not match.",
      creatingAccount: "Creating account...",
      registerErrorGeneric: "An error occurred during registration.",
      registerSuccessDefault: "Registration request submitted successfully.",
      registerErrorCatch: "An error occurred while creating the account.",
      loadingUsers: "Loading users...",
      loadUsersError: "Failed to load users",
      errorPrefix: "Error:",
      noUsers: "No registered users currently",
      unnamedUser: "Unnamed user",
      roleLabel: "Role:",
      statusLabel: "Status:",
      shiftLabel: "Shift:",
      departmentLabel: "Department:",
      loadUsersErrorCatch: "An error occurred while loading users"
    },

    ticketsBoard: {
      tabAssignedToMe: "🛠️ Assigned to Me",
      tabMyTickets: "📌 My Tickets",
      tabAwaitingConfirm: "🔍 Awaiting My Confirmation",
      tabAll: "All",
      tabPending: "📥 New",
      tabInProgress: "⚙️ In Progress",
      tabResolved: "🔍 Under Review",
      tabClosed: "✔️ Closed",
      status: {
        pending: "New",
        assigned: "Assigned",
        in_progress: "In Progress",
        resolved: "Awaiting Reporter Confirmation",
        closed: "Closed",
        reopened: "In Progress"
      },
      reportedByLabel: "Reported by:",
      assignedToLabel: "Assigned to:",
      overdueBadge: "Overdue",
      mechanicNotesLabel: "Technician notes:",
      operatorFeedbackLabel: "Reporter feedback:",
      prevPage: "Previous",
      nextPage: "Next",
      showingLastBanner: "ℹ️ Showing the last {n} tickets only.",
      noPermission: "You don't have permission to view tickets for this role.",
      loadingTickets: "Loading tickets...",
      loadError: "Could not load tickets right now. Try again, and if the problem persists, contact the admin.",
      empty: "You have no tickets right now.",
      noTechnicians: "⚠️ No active technicians/engineers currently available to assign the ticket to.",
      assignTitle: "🛠️ Classify & Assign Ticket",
      assignSubmit: "Assign",
      typeLabel: "Ticket Type",
      typeBreakdown: "Sudden Breakdown",
      typePM: "Preventive Maintenance (PM)",
      typeOther: "Other",
      assignToLabel: "Assign To",
      reassignTitle: "🔄 Reassign Ticket",
      reassignSubmit: "Reassign",
      reassignToLabel: "Reassign To",
      resolveTitle: "✅ Log Repair Completion",
      resolveSubmit: "Resolved",
      mechanicNotesField: "Technician Notes",
      mechanicNotesPlaceholder: "Describe the repair that was done...",
      afterImagesField: "After-Repair Photos",
      rejectTitle: "❌ Reject Repair",
      rejectSubmit: "Reject & Reopen",
      operatorFeedbackField: "What issue remains?",
      operatorFeedbackPlaceholder: "Example: there's still a leak...",
      genericActionError: "An error occurred while performing the action, try again or contact the admin.",
      actionQueuedOffline: "No internet connection - the action was saved locally and will run automatically once connection is back",
      libsNotLoaded: "❌ Report-generation libraries are not currently loaded, check your internet connection and try again.",
      preparingReport: "⏳ Preparing report...",
      reportDataError: "❌ Could not prepare report data, try again.",
      noTicketsForReport: "ℹ️ No tickets in the last 30 days to show in the report.",
      reportTitle: "📋 Monthly Maintenance Tickets Report",
      reportPeriodLabel: "Period: last {n} days",
      reportDateLabel: "Issue Date:",
      reportRoleLabel: "Role:",
      reportTotalLabel: "Total Tickets:",
      roleAdmin: "System Admin",
      roleManager: "Production Manager",
      roleOther: "Technician/Engineer",
      reportDescLabel: "Ticket Description:",
      reportMechanicNotesLabel: "Technician Notes:",
      reportGenerateError: "❌ An error occurred while generating the report, try again.",
      reportFileName: "monthly-report"
    }

  }

};