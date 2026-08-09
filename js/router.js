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

export { navigateTo, currentPage, render } from './renderCore.js';
