// ============================================================
// Firebase SDK
// ============================================================

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


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

export const APP_VERSION = "1.1.0";

export const APP_NAME =
  "MAINTENANCE & DEFECT SYSTEM";

export const DEBUG = true;


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
  "home,maintenance,issue,suggestions,pm,log,reports,qr,errorScanner,quality,ai,kb,statistics,export";

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

  // الجودة
  "quality",

  // الذكاء الاصطناعي والمعرفة
  "ai",
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

    d2:
      "فحص AI",

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

    navQuality:
      "الجودة",

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
      kpiOpen: "أعطال مفتوحة",
      kpiCritical: "يوجد بلاغ حرج",
      kpiClosed: "تم إصلاحها",
      kpiToday: "أعطال اليوم",
      kpiTotal: "إجمالي البلاغات",

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
      aiScan: "فحص الذكاء الاصطناعي",
      aiScanDesc: "تحليل عيوب الإنتاج",

      kaizenTitle: "💡 الكايزن",
      kaizenSubmit: "إرسال مقترح",
      kaizenSubmitDesc: "مقترح كايزن جديد",
      kaizenTrack: "متابعة مقترحاتي",
      kaizenTrackDesc: "الحالة والتعديل المطلوب",

      chartTitle: "تحليل الأداء والأعطال",
      chartWeekly: "تحديث أسبوعي",

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

    // مفاتيح خاصة بصفحة "قسم الجودة" (QualityView.js)
    quality: {
      title: "قسم الجودة وتحليل العيوب",
      subtitle: "توثيق وفحص عيوب المنتجات وقاعدة المعرفة",
      badge: "الجودة QC",
      defectTitle: "تصوير عيب",
      defectDesc: "تسجيل وتوثيق visual defect",
      aiTitle: "فحص بـ AI",
      aiDesc: "كشف العيوب تلقائياً",
      kbTitle: "قاعدة المعرفة",
      kbDesc: "دليل الإصلاح والحلول",
      statsTitle: "الإحصائيات",
      statsDesc: "معدل العيوب والتكرار"
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
      machinesDesc: "إدارة المعدات و QR",
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
      all: "الكل"
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
      techPerf: "أداء الفنيين (الأكثر إنجازاً)"
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
      manualPlaceholder: "اكتب رقم العطل او النص",
      searchBtn: "بحث في قاعدة المعرفة"
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
      exportCsv: "📤 CSV",
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
      imagesError: "حدث خطأ أثناء معالجة الصور، حاول تاني",
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

    d2:
      "AI Inspect",

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

    navQuality:
      "Quality",

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
      kpiOpen: "Open Breakdowns",
      kpiCritical: "Critical breakdown open",
      kpiClosed: "Resolved",
      kpiToday: "Today's Breakdowns",
      kpiTotal: "Total Tickets",

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
      aiScan: "AI Inspection",
      aiScanDesc: "Production defect analysis",

      kaizenTitle: "💡 Kaizen",
      kaizenSubmit: "Submit Suggestion",
      kaizenSubmitDesc: "New Kaizen suggestion",
      kaizenTrack: "Track My Suggestions",
      kaizenTrackDesc: "Status & requested revisions",

      chartTitle: "Performance & Breakdown Analysis",
      chartWeekly: "Weekly Update",

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

    quality: {
      title: "Quality & Defect Analysis",
      subtitle: "Document and inspect product defects, plus the knowledge base",
      badge: "QC",
      defectTitle: "Photograph Defect",
      defectDesc: "Log and document a visual defect",
      aiTitle: "AI Inspection",
      aiDesc: "Automatic defect detection",
      kbTitle: "Knowledge Base",
      kbDesc: "Repair guide and solutions",
      statsTitle: "Statistics",
      statsDesc: "Defect rate and recurrence"
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
      machinesDesc: "Manage equipment and QR codes",
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
      all: "All"
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
      techPerf: "Technician Performance (Top Performers)"
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
      searchBtn: "Search Knowledge Base"
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
      exportCsv: "📤 CSV",
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
    }

  }

};
