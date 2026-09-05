// ============================================================
// serverProxyStorageProvider.js
// تنفيذ مرجعي غير مُفعّل بعد (بند F/الأمان في تقرير المراجعة).
//
// ⚠️ قبل استخدام هذا الملف لازم بالترتيب:
//   ١) إضافة السطر الخاص بـ getFunctions/httpsCallable في
//      src-firebase.js (تم فعلاً) ثم تشغيل: npm run build
//      (عشان js/firebase.js الفعلي يتحدّث - الملف الحالي متبني من
//      قبل الإضافة دي، فمن غير build السطر الجاي هيرمي خطأ).
//   ٢) نشر functions/uploadImageViaImgbb فعلياً (راجع
//      functions/README.md) - بما في ذلك ضبط الـ Secret:
//      firebase functions:secrets:set IMGBB_API_KEY
//   ٣) تفعيله كمزود نشط: في providers/storage/index.js، استبدل
//      استيراد imgbbStorageProvider بهذا الملف. من هذه اللحظة
//      IMGBB_API_KEY في config.js يبقى غير مُستخدم نهائياً من
//      العميل ويُفضّل حذفه من config.js.
//
// طالما الخطوات دي متعملتش، السطر ده لازم يفضل كما هو (مش مفعّل)
// - راجع providers/storage/index.js.
// ============================================================

import { app } from "../../config.js";
import { getFunctions, httpsCallable } from "../../firebase.js";

const functions = getFunctions(app);
const uploadImageCallable = httpsCallable(functions, "uploadImageViaImgbb");

/**
 * رفع صورة Base64 عبر الـ Cloud Function الوسيطة بدل استدعاء ImgBB
 * مباشرة من المتصفح - نفس توقيع imgbbStorageProvider.uploadImage
 * بالظبط.
 * @param {string} base64
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function uploadImage(base64, name = "image") {

  const result = await uploadImageCallable({ base64, name });

  return result?.data?.url || null;

}

/** @type {import('./storageProvider.js').StorageProvider} */
export const serverProxyStorageProvider = {
  name: "server-proxy-imgbb",
  uploadImage
};
