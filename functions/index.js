// ============================================================
// functions/index.js
// كود مرجعي غير مُفعّل بعد - راجع functions/README.md قبل أي نشر.
// (بند B3 في تقرير المراجعة: حذف حساب Firebase Auth الفعلي عند
// حذف مستخدم، بدل الاكتفاء بحذف مستند Firestore فقط).
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

/**
 * حذف مستخدم بالكامل: حساب Firebase Auth + مستند Firestore معاً.
 *
 * لازم يتنادى من مستخدم مسجّل دخول ودوره "admin" فعلياً (بيتحقق من
 * الفحص هنا على السيرفر - مش من أي بيانات جاية من العميل، بنفس
 * مبدأ firestore.rules).
 *
 * بيشمل نفس حماية "آخر Admin" الموجودة في usersApi.js
 * (updatePermissionsApi / deleteUserApi) - كطبقة حماية إضافية على
 * مستوى السيرفر، مش بديلة عنها.
 *
 * @param {{ userId: string }} data
 */
exports.deleteUserAccount = onCall(async (request) => {

  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  }

  const { userId } = request.data || {};

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "معرف المستخدم غير صالح.");
  }

  // التحقق إن المستخدم اللي بينادي فعلاً أدمن - قراءة مباشرة من
  // Firestore على السيرفر، مش من أي claim/بيانات جاية من العميل.
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;

  if (!callerData || callerData.role !== "admin" || callerData.status !== "active") {
    throw new HttpsError("permission-denied", "هذه العملية مقصورة على Admin فقط.");
  }

  const targetRef = db.collection("users").doc(userId);
  const targetSnap = await targetRef.get();
  const targetData = targetSnap.exists ? targetSnap.data() : null;

  // حماية آخر Admin (نفس منطق usersApi.js على مستوى السيرفر)
  const targetIsActiveAdmin =
    targetData && targetData.role === "admin" && targetData.status === "active";

  if (targetIsActiveAdmin) {

    const otherAdmins = await db
      .collection("users")
      .where("role", "==", "admin")
      .where("status", "==", "active")
      .get();

    const remaining = otherAdmins.docs.filter((d) => d.id !== userId).length;

    if (remaining === 0) {
      throw new HttpsError(
        "failed-precondition",
        "لا يمكن حذف هذا المستخدم لأنه آخر Admin نشط في النظام."
      );
    }

  }

  // حذف حساب Firebase Auth (لو موجود أصلاً - ممكن يكون اتحذف قبل
  // كده أو المستخدم لسه في النظام القديم بدون حساب Auth)
  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "فشل حذف حساب الدخول: " + error.message);
    }
    // auth/user-not-found: مفيش حساب Auth أصلاً - نكمل عادي لحذف المستند
  }

  // حذف مستند Firestore (لو لسه موجود - ممكن يكون اتحذف قبل كده
  // من deleteUserApi في الواجهة، والـ Function دي جاية تكمل حذف
  // حساب Auth بس)
  if (targetSnap.exists) {
    await targetRef.delete();
  }

  return { status: "success" };

});


// ============================================================
// رفع الصور عبر ImgBB - وسيط سيرفر (بند F/الأمان في تقرير المراجعة)
// ============================================================
// المشكلة الحالية: IMGBB_API_KEY موجود كنص واضح في js/config.js
// (كود عميل)، يعني أي زائر يفتح DevTools يقدر ياخده ويستهلك كوتة
// الحساب أو يرفع محتوى تحته. الحل: المفتاح يتخزن كـ Secret على
// السيرفر بس (Cloud Function)، والعميل يبعت الصورة للـ Function
// دي، وهي اللي تكلم ImgBB بالمفتاح السري وترجع الرابط.
//
// لتخزين المفتاح كـ Secret (مرة واحدة، من جهازك، بعد firebase init
// functions):
//   firebase functions:secrets:set IMGBB_API_KEY
// (هيطلب منك تكتب قيمة المفتاح، وهيتخزن مشفّر عند Google، مش في
// أي ملف بالمستودع)
const { defineSecret } = require("firebase-functions/params");
const IMGBB_API_KEY_SECRET = defineSecret("IMGBB_API_KEY");

/**
 * رفع صورة Base64 لـ ImgBB من السيرفر - نفس شكل الإدخال/الإخراج
 * بالظبط اللي كانت بتعمله imgbbStorageProvider.js من المتصفح مباشرة،
 * لكن المفتاح دلوقتي مش بيتبعت للعميل نهائياً.
 *
 * @param {{ base64: string, name?: string }} data
 * @returns {Promise<{ status: string, url: string|null }>}
 */
exports.uploadImageViaImgbb = onCall(
  { secrets: [IMGBB_API_KEY_SECRET] },
  async (request) => {

    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
    }

    const { base64, name } = request.data || {};

    if (!base64 || typeof base64 !== "string" || !base64.startsWith("data:image")) {
      return { status: "success", url: null };
    }

    const rawBase64 = base64.split(",")[1] || base64;

    const formData = new URLSearchParams();
    formData.append("image", rawBase64);
    formData.append("name", name || "image");

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY_SECRET.value()}`,
      { method: "POST", body: formData }
    );

    const result = await response.json();

    if (!result || !result.success) {
      throw new HttpsError(
        "internal",
        result?.error?.message || "فشل رفع الصورة على ImgBB"
      );
    }

    return {
      status: "success",
      url: result.data.display_url || result.data.url
    };

  }
);
