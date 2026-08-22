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
      "أكثر الماكينات أعطالاً"

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
      "Top Faulty Machines"

  }

};
