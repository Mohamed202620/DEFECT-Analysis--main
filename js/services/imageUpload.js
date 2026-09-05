// ============================================================
// imageUpload.js
// رفع الصور - طبقة Business/Data Access (جزء مستخرج من
// services/api.js). لا تحتوي أي تفاصيل عن مزود الاستضافة الفعلي
// (ImgBB/Firebase Storage/Cloudinary...) - كل التفاصيل دي بقت خلف
// providers/storage/ (راجع providers/README.md). التوقيع والسلوك
// الظاهر لباقي التطبيق (defectsApi.js, ticketsApi.js,
// suggestionsApi.js...) لم يتغيّر إطلاقاً.
// ============================================================

import { getStorageProvider } from "../providers/storage/index.js";

/**
 * رفع صورة Base64 (Data URL) عبر مزود الاستضافة الحالي، وإرجاع
 * رابط الصورة النهائي (Display URL)
 *
 * @param {string} base64 صورة بصيغة data:image/... (من compressImage)
 * @param {string} name اسم وصفي للصورة
 * @returns {Promise<string|null>} رابط الصورة، أو null إذا لم تكن هناك صورة
 */
export async function uploadBase64Image(base64, name = "image") {
  return getStorageProvider().uploadImage(base64, name);
}


// ============================================================
// رفع مجموعة صور دفعة واحدة
// ============================================================

/**
 * رفع مجموعة صور Base64 (Data URLs) دفعة واحدة، وإرجاع مصفوفة
 * الروابط النهائية (أي صورة فشلت أو لم تكن صالحة أصلاً بيتم تجاهلها
 * تلقائياً من المصفوفة النهائية) - نفس منطق uploadBase64Image لكن
 * لمجموعة صور دفعة واحدة، لدعم إرفاق أكثر من صورة/ملف في نفس
 * العملية بدل صورة واحدة فقط.
 *
 * @param {string[]} base64List مصفوفة صور بصيغة data:image/...
 * @param {string} namePrefix اسم وصفي مشترك (بيتلحق برقم تسلسلي لكل صورة)
 * @returns {Promise<string[]>} مصفوفة روابط الصور المرفوعة بنجاح فقط
 */
export async function uploadBase64Images(base64List, namePrefix = "image") {
  const list = Array.isArray(base64List) ? base64List : [];
  if (!list.length) return [];

  const urls = await Promise.all(
    list.map((base64, index) => uploadBase64Image(base64, `${namePrefix}_${index + 1}`))
  );

  return urls.filter(Boolean);
}
