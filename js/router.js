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

// استيراد جانبي (Side-effect) لربط جرس الإشعارات بـ window
// (window.initNotificationBell / window.destroyNotificationBell)
// ملاحظة: كان هذا الملف موجوداً بدون أي import له في المشروع،
// فكانت الدالتين غير معرّفتين أبداً ولم يكن الجرس يظهر مطلقاً
import './components/NotificationBell.js';

// استيراد جانبي (Side-effect) لإضافة زر تبديل اللغة (عربي/إنجليزي)
// ملاحظة: نفس مشكلة NotificationBell.js بالظبط - كان هذا الملف
// موجوداً بدون أي import له في المشروع، فالزر مكانش بيتضاف للصفحة
// نهائياً. لازم يتحمّل بعد renderCore.js (مستورد بالفعل عبر
// authHandlers.js فوق) عشان يقرأ window.currentLang الصح من أول
// ظهور للزر
import './components/LanguageToggle.js';

export { navigateTo, currentPage, render } from './renderCore.js';
