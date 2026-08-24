// ============================================================
// imageUpload.js
// رفع الصور - جزء مستخرج من services/api.js (تقسيم بدون أي
// تغيير في المنطق أو الأسماء المُصدَّرة) عشان يبقى الملف الأصلي
// أصغر وأسهل في القراءة والصيانة.
// ============================================================

import { IMGBB_API_KEY } from "../config.js";


// ============================================================
// رفع الصور على ImgBB (مجاني بالكامل - بدون بطاقة ائتمان)
// ============================================================
//
// السبب: كانت الصور (Base64) تُخزَّن مباشرة داخل مستندات
// Firestore، ما يؤدي أحياناً لتضخم حجم المستند (قد يتجاوز حد
// الـ 1MB لكل مستند في حالة 3 صور)، وكان هذا سبب ظهور
// "Error loading documents" في Firebase Console عند تصفح
// مجموعة machineErrors تحديداً بسبب حجم حقل الصورة الكبير.
//
// كان الحل الأول المقترح هو Firebase Storage، لكن Firebase بقى
// من فبراير 2026 بيطلب ربط بطاقة ائتمان (Blaze Plan) حتى
// للاستخدام المجاني - لذلك تم الاستغناء عنه واستخدام ImgBB بدلاً
// منه: خدمة استضافة صور مجانية بالكامل وبدون أي بطاقة، تحتاج
// فقط مفتاح API مجاني (IMGBB_API_KEY في config.js).
//
// المستند في Firestore بيتخزن فيه رابط الصورة (URL) بس، مش
// الـ Base64 الكامل - فبيفضل صغير جداً.
// ============================================================

/**
 * رفع صورة Base64 (Data URL) إلى ImgBB
 * وإرجاع رابط الصورة النهائي (Display URL)
 *
 * @param {string} base64 صورة بصيغة data:image/... (من compressImage)
 * @param {string} name اسم وصفي للصورة (لتنظيم الأرشيف على ImgBB فقط)
 * @returns {Promise<string|null>} رابط الصورة، أو null إذا لم تكن هناك صورة
 */
export async function uploadBase64Image(base64, name = "image") {

  if (
    !base64 ||
    typeof base64 !== "string" ||
    !base64.startsWith("data:image")
  ) {
    return null;
  }

  if (!IMGBB_API_KEY || IMGBB_API_KEY.includes("ضع_مفتاح")) {
    throw new Error(
      "لم يتم ضبط مفتاح ImgBB (IMGBB_API_KEY) في config.js بعد."
    );
  }

  // ImgBB يطلب الـ base64 بدون البادئة "data:image/...;base64,"
  const rawBase64 = base64.split(",")[1] || base64;

  const formData = new FormData();
  formData.append("image", rawBase64);
  formData.append("name", name);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json();

  if (!result || !result.success) {
    throw new Error(
      result?.error?.message || "فشل رفع الصورة على ImgBB"
    );
  }

  return result.data.display_url || result.data.url;

}

