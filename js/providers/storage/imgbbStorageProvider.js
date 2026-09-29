// ============================================================
// imgbbStorageProvider.js
// تنفيذ ImgBB الفعلي لواجهة StorageProvider (راجع
// storageProvider.js وproviders/README.md). نفس منطق الرفع الأصلي
// المنقول حرفياً من services/imageUpload.js بدون أي تغيير في
// السلوك - فقط فصل تفاصيل ImgBB (المفتاح، الـ endpoint، شكل
// الاستجابة) في ملف مستقل خلف واجهة موحّدة.
//
// ⚠️ ملحوظة أمان منفصلة (راجع تقرير المراجعة، بند F/Security):
// IMGBB_API_KEY لسه بيُقرأ وبيُستخدم هنا مباشرة من كود العميل
// (Client-side)، يعني لسه مكشوف لأي زائر يفتح DevTools. نقل الرفع
// لسيرفر وسيط (Cloud Function) بدل الاستدعاء المباشر من المتصفح
// تعديل منفصل ومطلوب بشكل مستقل عن هذا الـ Abstraction، ولم يتم
// تنفيذه في هذه الخطوة.
// ============================================================

import { IMGBB_API_KEY } from "../../config.js";

/**
 * رفع صورة Base64 (Data URL) إلى ImgBB وإرجاع رابط الصورة النهائي.
 * @param {string} base64
 * @param {string} name اسم وصفي للصورة (لتنظيم الأرشيف على ImgBB فقط)
 * @returns {Promise<string|null>}
 */
async function uploadImage(base64, name = "image") {

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

  // Test 16: fetch بدون مهلة كانت بتعلّق الحفظ للأبد لو الشبكة وقفت
  // نص الطريق (الزر يفضل "جاري المعالجة"). مهلة 30 ثانية بتحوّل التعليق
  // لخطأ عادي بيتعامل معاه المتصل (uploadBase64Images بتتجاهل الصورة الفاشلة)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let result;
  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal
      }
    );

    result = await response.json();
  } catch (uploadError) {
    if (uploadError && uploadError.name === "AbortError") {
      throw new Error("انتهت مهلة رفع الصورة - تحقق من الاتصال بالإنترنت");
    }
    throw uploadError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!result || !result.success) {
    throw new Error(
      result?.error?.message || "فشل رفع الصورة على ImgBB"
    );
  }

  return result.data.display_url || result.data.url;

}

/** @type {import('./storageProvider.js').StorageProvider} */
export const imgbbStorageProvider = {
  name: "imgbb",
  uploadImage
};
