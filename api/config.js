// ملف ثابت لـ Firebase Hosting فقط.
// على Hosting مفيش سيرفر Express (server.js) فالمسار /api/config.js كان بيقع تحت
// rewrite "**" -> /index.html، يعني المتصفح كان بيحمّل صفحة HTML كاملة (~24KB) كأنها
// سكريبت في كل فتح للتطبيق ويفشل في تحليلها (SyntaxError) قبل ما يكمّل.
// في التطوير المحلي (npm start) server.js بيعرّف نفس المسار قبل الملفات الثابتة
// فبيتجاوز الملف ده وبيحقن القيم من متغيرات البيئة.
// القيم الفعلية بتيجي من الـ fallbacks الموجودة في js/config.js (مفاتيح Firebase
// Web العامة - مش أسرار).
window.APP_CONFIG = window.APP_CONFIG || {};
