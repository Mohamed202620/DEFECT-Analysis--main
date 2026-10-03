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


// ============================================================
// إعادة تعيين كلمة سر مستخدم بمساعدة الأدمن (PHASE 2 - بند 2 في
// تقرير المراجعة، HIGH)
// ============================================================
// المشكلة الأصلية: "نسيت كلمة السر" كانت بترسل رابط استعادة
// Firebase القياسي لإيميل داخلي وهمي (phone@...-system.local) محدش
// يقدر يوصله فعلياً - الواجهة كانت بتعرض "تم الإرسال بنجاح" رغم إن
// محدش هيستلم أي حاجة، فيفضل المستخدم عالق بلا أي طريقة حقيقية
// لاستعادة حسابه.
//
// بما إن المستخدمين بيدخلوا برقم موبايل بس (مفيش إيميل حقيقي لأي
// حد)، وإرسال SMS محتاج خدمة مدفوعة (خارج النطاق)، أقرب آلية
// استرجاع حقيقية وآمنة متاحة بدون أي خدمة مدفوعة هي: الأدمن (بعد
// التأكد من هوية الموظف يدوياً داخل الشركة) يولّد كلمة سر مؤقتة
// جديدة له من صفحة الإدارة عبر الـ Function دي - وهي تنفّذ فعلياً
// admin.auth().updateUser() (عملية Admin SDK لا يمكن تنفيذها من
// المتصفح إطلاقاً)، بعد التحقق السيرفري إن المستدعي admin فعلاً،
// بنفس مبدأ deleteUserAccount فوق بالضبط.
//
// كلمة السر المؤقتة بتتولّد عشوائياً على السيرفر نفسه ومترجعش غير
// مرة واحدة بس للأدمن اللي طلبها (مش بتتخزن في Firestore ولا في أي
// مكان تاني) - عشان الأدمن يديها للموظف يستخدمها في أول دخول.
//
// ⚠️ ملاحظة نشر: ربط الدالة دي بزر فعلي داخل شاشة إدارة المستخدمين
// لم يتم في هذا الإصلاح (خارج النطاق المطلوب - "لا تعديلات على
// واجهات أخرى") - الدالة جاهزة للاستخدام عبر adminResetPasswordApi
// في js/services/usersApi.js.
//
// @param {{ userId: string }} data
// @returns {{ status: string, temporaryPassword: string }}
exports.adminResetUserPassword = onCall(async (request) => {

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

  const targetSnap = await db.collection("users").doc(userId).get();

  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "المستخدم غير موجود.");
  }

  // كلمة سر مؤقتة عشوائية آمنة (12 حرف، أحرف كبيرة/صغيرة/أرقام،
  // بدون رموز ملتبسة زي 0/O أو 1/l/I) - بتتولّد على السيرفر فقط
  // ومتتخزنش أبداً، بترجع مرة واحدة بس للأدمن اللي طلبها
  const crypto = require("crypto");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomBytes = crypto.randomBytes(12);
  let temporaryPassword = "";
  for (let i = 0; i < 12; i++) {
    temporaryPassword += chars[randomBytes[i] % chars.length];
  }

  try {
    await admin.auth().updateUser(userId, { password: temporaryPassword });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      // المستخدم ده لسه ماترحّلش (مفيش حساب Firebase Auth ليه
      // أصلاً) - لازم يدخل مرة واحدة على الأقل بكلمة سره القديمة
      // الأول عشان يتعمله حساب Auth حقيقي (راجع js/auth/login.js)
      throw new HttpsError(
        "failed-precondition",
        "هذا المستخدم ليس لديه حساب دخول (Auth) بعد - يجب أن يسجّل دخول مرة واحدة على الأقل بكلمة سره القديمة أولاً."
      );
    }
    throw new HttpsError("internal", "فشل إعادة تعيين كلمة السر: " + error.message);
  }

  return { status: "success", temporaryPassword };

});
