// ============================================================
// providers/backend/index.js
// نقطة التبديل الوحيدة لمزود الـ Backend (راجع providers/README.md).
// كل ملفات services/*.js تستورد db/auth وأدوات Firestore من هنا،
// مش من config.js أو firebase.js مباشرة.
//
// لتغيير المزود مستقبلاً (مثلاً إلى مزود آخر غير Firebase): أنشئ
// ملف تنفيذ جديد بنفس الأسماء المُصدَّرة الموجودة في
// firebaseBackendProvider.js، وغيّر سطر الاستيراد تحت بس ليشاور
// على الملف الجديد.
// ============================================================

export * from "./firebaseBackendProvider.js";
