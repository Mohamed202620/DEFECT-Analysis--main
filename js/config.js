// استيراد Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// رابط Google Apps Script (يمكنك الاحتفاظ به كنسخة احتياطية)
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz2O9L2NTyJvKQgUwzmFASSzoX7EIYd6H21g3J--bJYbdB-zsW2NYubv8WRw87GORni/exec";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",
  authDomain: "maintenance-defect-system.firebaseapp.com",
  projectId: "maintenance-defect-system",
  storageBucket: "maintenance-defect-system.firebasestorage.app",
  messagingSenderId: "1065779979535",
  appId: "1:1065779979535:web:6d53e69c4cfde57b414a7a"
};

// تهيئة Firebase وتصدير قاعدة البيانات للاستخدام في باقي الملفات
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// الترجمات والنصوص النظامية
export const translations = {
  ar: {
    dir: 'rtl', langBtn: 'EN', welcome: 'أهلاً:', today: 'اليوم',
    dashTitle: '📊 لوحة المتابعة', openTickets: 'بلاغات مفتوحة', pmLate: 'PM متأخرة', todayDefects: 'عيوب اليوم',
    secMaint: '🛠️ قسم الصيانة والمهام',
    m1: 'تسجيل بلاغ', m2: 'تسجيل PM', m3: 'سجل الصيانة', m4: 'الجدولة', m5: 'مسح QR الماكينات',
    secDefects: '📦 قسم تحليل عيوب الإنتاج',
    d1: 'تصوير عيب', d2: 'فحص AI', d3: 'قاعدة المعرفة', d4: 'الإحصائيات', d5: 'تصدير التقارير',
    secUsers: '👥 إدارة المستخدمين', u1: 'إدارة الصلاحيات والمستخدمين (للمدير فقط)',
    logout: 'تسجيل الخروج ➔', copy: '© 2026 جميع الحقوق محفوظة | Mohamed Hussein ',
    chartLabel: 'أكثر الماكينات أعطالاً'
  },
  en: {
    dir: 'ltr', langBtn: 'عربي', welcome: 'Welcome:', today: 'Today',
    dashTitle: '📊 Dashboard Overview', openTickets: 'Open Tickets', pmLate: 'Overdue PM', todayDefects: 'Today Defects',
    secMaint: '🛠️ Maintenance & Tasks',
    m1: 'New Ticket', m2: 'Record PM', m3: 'Maint. Log', m4: 'Schedule', m5: 'Scan Machine QR',
    secDefects: '📦 Defects Analysis',
    d1: 'Capture Defect', d2: 'AI Inspect', d3: 'Knowledge Base', d4: 'Statistics', d5: 'Export Reports',
    secUsers: '👥 Users Management', u1: 'Manage Roles & Users (Admin Only)',
    logout: 'Logout ➔', copy: '© 2026 All Rights Reserved | Mohamed Hussein',
    chartLabel: 'Top Faulty Machines'
  }
};
