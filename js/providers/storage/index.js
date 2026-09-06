// ============================================================
// providers/storage/index.js
// نقطة التبديل الوحيدة لمزود استضافة الصور (راجع
// providers/README.md). services/imageUpload.js يستدعي
// getStorageProvider() بس، ومايعرفش تفاصيل ImgBB نهائياً.
//
// لتغيير المزود مستقبلاً (Firebase Storage، Cloudinary...): أنشئ
// ملف تنفيذ جديد بنفس شكل imgbbStorageProvider.js (يصدّر كائن فيه
// name وuploadImage()، راجع storageProvider.js)، واستبدل الاستيراد
// والقيمة المُرجعة تحت بس.
// ============================================================

import { imgbbStorageProvider } from "./imgbbStorageProvider.js";

// ⚠️ بند F/الأمان في تقرير المراجعة: IMGBB_API_KEY لسه مكشوف في
// كود العميل عبر imgbbStorageProvider.js. يوجد تنفيذ بديل جاهز
// (serverProxyStorageProvider.js) بيمرّر الرفع عبر Cloud Function
// بدل كشف المفتاح، لكنه غير مُفعّل بعد - يحتاج خطوات نشر منفصلة
// (راجع الكومنت أعلى serverProxyStorageProvider.js وfunctions/README.md)
// قبل ما نستبدل السطر تحت بـ:
//   import { serverProxyStorageProvider } from "./serverProxyStorageProvider.js";
//   export function getStorageProvider() { return serverProxyStorageProvider; }

export function getStorageProvider() {
  return imgbbStorageProvider;
}
