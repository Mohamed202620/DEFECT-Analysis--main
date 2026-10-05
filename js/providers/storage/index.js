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
import { serverProxyStorageProvider } from "./serverProxyStorageProvider.js";

// الإنتاج: الرفع عبر Cloud Function (المفتاح سري على السيرفر).
// التطوير المحلي فقط (server.js بيحقن IMGBB_API_KEY في window.APP_CONFIG):
// لو المفتاح موجود فعلاً في الإعدادات المحلية بنستخدم الرفع المباشر.
export function getStorageProvider() {
  const localDevKey =
    typeof window !== "undefined" && window.APP_CONFIG?.IMGBB_API_KEY;
  return localDevKey ? imgbbStorageProvider : serverProxyStorageProvider;
}
