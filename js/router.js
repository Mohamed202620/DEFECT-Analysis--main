// ============================================================
// router.js
// نقطة الدخول الرئيسية للتطبيق (App Entry Point)
//
// تم تقسيم هذا الملف (كان يتجاوز 1170 سطراً) إلى وحدات أصغر
// دون أي تغيير في السلوك الظاهر للمستخدم أو أسماء الدوال على
// مستوى window - فقط إعادة تنظيم:
//
//   permissions.js   → نظام الصلاحيات (hasPermission, currentRole...)
//   theme.js         → الوضع الليلي/النهاري (Dark/Light Mode)
//   pageRenderer.js  → جدول التوجيه بين الصفحات (renderPage)
//   renderCore.js    → render() / navigateTo() / الصفحة الحالية
//   authHandlers.js  → تسجيل الدخول/الخروج/إنشاء حساب/تحميل المستخدمين
//   workflow.js      → منطق تحليل العيوب والبلاغات (كما كان)
//   errorScanner.js  → منطق Machine Error Scanner (كما كان)
//
// ملف index.html يستورد هذا الملف (import('./js/router.js')) ويتوقع
// وجود navigateTo كـ export، لذلك يبقى مُصدَّراً هنا بنفس الاسم.
// ============================================================

import './theme.js';
import './permissions.js';
import './authHandlers.js';

// استيراد جانبي (Side-effect) لربط دوال ميزة Machine Error Scanner بـ window
import './errorScanner.js';

// استيراد جانبي (Side-effect) لربط دوال لوحة متابعة التذاكر بـ window
// (window.loadTicketsBoard / window.handleTicketAction)
import './ticketsBoard.js';

// استيراد جانبي (Side-effect) لربط دوال لوحة متابعة الكايزن بـ window
// (window.loadKaizenBoard / window.handleKaizenAction) - منطق مستقل
// تماماً عن ticketsBoard.js، بيستخدم بس دوال services/api.js المشتركة
import './kaizenBoard.js';

// استيراد جانبي (Side-effect) لبانر حالة الاتصال + المزامنة
// التلقائية عند عودة الإنترنت (Offline-First)
import './offlineBanner.js';

// استيراد جانبي (Side-effect) لإشعارات المتصفح (بديل عملي لـ Push
// الحقيقي عبر FCM بدون سيرفر - راجع التعليق التفصيلي في الملف
// نفسه). بيفعّل تلقائياً لو المستخدم مسجّل دخوله بالفعل (Refresh)
import './pushNotifications.js';

// استيراد جانبي (Side-effect) لبانر طلب تفعيل إشعارات المتصفح
// (window.renderNotificationPermissionBanner - يُستدعى من renderCore.js
// عند فتح صفحة الرئيسية فقط)
import './notificationPermissionBanner.js';

// استيراد جانبي (Side-effect) لربط window.openNotificationsModal /
// window.refreshNotificationsBadge - إصلاح زر "الإشعارات" في
// الشريط السفلي (BottomNav.js) اللي كان بيدوّر على دالة مكانتش
// معرّفة في أي مكان بالمشروع (راجع NotificationsModal.js)
import './components/NotificationsModal.js';

// استيراد جانبي لنظام «معلومة على الماشي» (Daily Insights & Tips)
// تفعيل مؤقتات الـ Toast التلقائية (بعد 5 ثوانٍ وبعد 4 ساعات)
import './dailyTips.js';

// استيراد جانبي (Side-effect) لربط دوال إدارة الإجازات الرسمية
// بـ window (window.loadHolidays / window.addHoliday / window.deleteHoliday
// / window.seedDefaultHolidays2026) - مستخدمة في صفحة "settings"
// (راجع pageRenderer.js). إصلاح: كان الملف موجوداً في المشروع لكن
// غير مستورد من أي مكان فعلياً، فكانت أزرار صفحة الإعدادات بتفشل
// silently (window.loadHolidays غير معرّفة).
import './holidaysManagement.js';

// استيراد جانبي (Side-effect) لربط دوال إدارة Pattern الورديات
// (رفع/استبدال ملف Excel) ومعاملات حساب الإضافي بـ window - جزء
// من "حاسبة الحضور والمرتبات" (راجع attendanceCard.js وصفحة
// "settings" في pageRenderer.js)
import './attendancePatternManagement.js';

// فحص/تشغيل المزامنة التلقائية الشهرية لإجازات مصر الرسمية من
// Google Calendar (أول يوم بالشهر الساعة 2 صباحًا) - فحص خفيف
// وغير معطِّل، وآمن تمامًا لو مفيش مستخدم مسجّل دخوله بعد
try {
  const isLoggedInForHolidaysSync = localStorage.getItem("phone") || localStorage.getItem("userId");
  if (isLoggedInForHolidaysSync) {
    import('./services/googleHolidaysSync.js').then(m =>
      m.maybeAutoSyncGoogleHolidays().then(result => {
        // تحديث الكارت تلقائيًا لو المزامنة التلقائية غيّرت قائمة
        // الإجازات (الساعات المطلوبة للدورة بتُحسب منها مباشرة)
        if (result && window.refreshAttendanceCard) window.refreshAttendanceCard();
      })
    ).catch(() => {});
  }
} catch (e) { /* localStorage غير متاح - تجاهل بأمان */ }

export { navigateTo, currentPage, render } from './renderCore.js';
