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

export function getStorageProvider() {
  return imgbbStorageProvider;
}
