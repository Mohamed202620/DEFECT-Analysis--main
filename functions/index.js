// ============================================================
// functions/index.js
// راجع functions/README.md قبل النشر (لسه محتاج خطوة نشر يدوية -
// firebase deploy --only functions - على مشروع بخطة Blaze).
// (بند B3 في تقرير المراجعة: حذف حساب Firebase Auth الفعلي عند
// حذف مستخدم، بدل الاكتفاء بحذف مستند Firestore فقط. وبند A1: نفس
// حماية "آخر Admin" على مستوى السيرفر لتغيير الدور، مش بس الحذف).
//
// إصلاح Race Condition (مراجعة تانية): فحص "آخر Admin" في
// deleteUserAccount وupdateUserRoleAccount بقى ذرّي بالكامل عبر
// db.runTransaction() - راجع التعليق فوق كل دالة للتفاصيل. قبل
// كده كان الفحص (query العدّ) والتنفيذ (حذف/تعديل) خطوتين منفصلتين،
// وده كان ممكن يسمح لطلبين متزامنين (تنزيل/حذف أدمنين مختلفين في
// نفس اللحظة) يعدّوا الفحص الاتنين مع بعض ويسيبوا النظام من غير أي
// Admin نشط.
//
// الكود هنا دلوقتي متصل فعلاً بالواجهة (js/services/usersApi.js
// بينادي عليه عبر callCloudFunction - راجع
// js/providers/backend/firebaseBackendProvider.js)، وfirestore.rules
// بقت تمنع تحديداً حذف/تعديل دور "Admin نشط" من كود العميل مباشرة،
// فالمسارين دول (حذف مستخدم، تغيير دور Admin نشط) مش هيشتغلوا فعلياً
// في الإنتاج غير بعد نشر الدوال دي - راجع خطوات النشر في README.
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
 * ============================================================
 * إصلاح (Race Condition - حماية "آخر Admin" الذرّية):
 * ============================================================
 * فحص "فيه أدمن نشط تاني ولا لأ" + حذف مستند Firestore بقى جوه
 * Firestore Transaction واحدة (db.runTransaction) بدل ٣ خطوات
 * منفصلة (قراءة المستند -> query العدّ -> حذف). ده بيمنع سيناريو:
 * طلبين حذف لأدمنز مختلفين (A وB، وهما آخر أدمنين نشطين) بييجوا في
 * نفس اللحظة تقريباً - كل واحد فيهم كان ممكن يقرا "فيه أدمن نشط
 * تاني" (شايف التاني) قبل ما أي حد يكتب، فيعدّوا الفحص الاتنين
 * وينفّذوا الاتنين، ويفضل النظام من غير أي Admin نشط خالص.
 *
 * الحل بيعتمد على ضمان Firestore التلقائي: أي مستند بيتقرا جوه
 * Transaction (بما فيه نتائج أي query - كل مستند نتيجة بيتحسب
 * "متقروء" لوحده) لو اتغيّر من حد تاني بعد القراءة وقبل الـ commit،
 * الـ Transaction بتفشل تلقائياً وFirestore بيعيد تنفيذها (Retry)
 * بأحدث بيانات. في سيناريو A/B فوق: أول Transaction تعمل commit
 * (نفترض بتاعة A) بتغيّر مستند A - وهو مستند كان جزء من الـ Query
 * اللي قرتها Transaction B، فلما B تحاول commit، Firestore هيكتشف
 * التعارض ويرفضه ويعيد تنفيذ B من الأول - وفي المحاولة التانية،
 * الـ Query هترجع بيانات محدّثة (A بقى محذوف/مش نشط)، فB هتكتشف
 * إنها فعلاً "آخر Admin نشط" وترفض العملية - بدل ما تكمل.
 *
 * ملحوظة مهمة: حذف حساب Firebase Auth (admin.auth().deleteUser)
 * عملية في نظام تاني بالكامل (Firebase Authentication) ومش ممكن
 * تنضم لنفس الـ Firestore Transaction (Firestore مايقدرش يضمن
 * Atomicity عبر نظامين مختلفين). عشان كده الترتيب هنا متعمّد:
 * الـ Transaction (الفحص الذرّي + حذف Firestore) بتتنفذ الأول، وبعد
 * ما تنجح بس (يعني ضمنّا إن الحذف آمن ومش هيسيب صفر أدمن) بنحذف
 * حساب Auth - عشان لو الفحص فشل، مفيش حاجة لا رجعة فيها (حذف حساب
 * Auth) اتنفذت أصلاً. لو حذف Auth فشل بعد كده (نادر جداً)، بيترفع
 * كخطأ واضح للمستخدم (مش نجاح وهمي) - والدالة idempotent (تقدر
 * تتنادى تاني بأمان: هتتعامل مع "المستند اتحذف بالفعل" و"حساب Auth
 * مش موجود" من غير أي خطأ).
 *
 * @param {{ userId: string }} data
 */
exports.deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {

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

  // ------------------------------------------------------------
  // الخطوة الذرّية: فحص "آخر Admin" + حذف مستند Firestore معاً -
  // راجع الشرح فوق
  // ------------------------------------------------------------
  await db.runTransaction(async (transaction) => {

    const targetSnap = await transaction.get(targetRef);

    if (!targetSnap.exists) {
      // مفيش مستند من الأساس - يمكن اتحذف قبل كده (استدعاء متكرر/
      // إعادة محاولة بعد فشل جزئي سابق في حذف حساب Auth) - نكمل
      // عادي تحت لحذف حساب Auth لو لسه موجود
      return;
    }

    const targetData = targetSnap.data();

    const targetIsActiveAdmin =
      targetData.role === "admin" && targetData.status === "active";

    if (targetIsActiveAdmin) {

      const othersQuery = db
        .collection("users")
        .where("role", "==", "admin")
        .where("status", "==", "active");

      // القراءة دي جوه الـ Transaction هي أساس الحماية من الـ Race
      // Condition - راجع الشرح فوق
      const othersSnap = await transaction.get(othersQuery);

      const remaining = othersSnap.docs.filter((d) => d.id !== userId).length;

      if (remaining === 0) {
        throw new HttpsError(
          "failed-precondition",
          "لا يمكن حذف هذا المستخدم لأنه آخر Admin نشط في النظام."
        );
      }

    }

    transaction.delete(targetRef);

  });

  // مستند Firestore اتحذف بأمان (أو مكانش موجود من الأساس) بضمان
  // ذرّي فعلي - دلوقتي بس نحذف حساب Auth (لو موجود أصلاً)
  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw new HttpsError(
        "internal",
        "تم حذف بيانات المستخدم من Firestore لكن فشل حذف حساب الدخول " +
        "(Auth): " + error.message + " - أعد المحاولة، العملية آمنة " +
        "لإعادة التنفيذ (idempotent)."
      );
    }
    // auth/user-not-found: مفيش حساب Auth أصلاً - العملية اكتملت بنجاح
  }

  return { status: "success" };

});


/**
 * تغيير دور/صلاحيات مستخدم - نسخة سيرفرية مطلوبة تحديداً في حالة
 * واحدة: المستخدم المستهدف "Admin نشط" (role=="admin" &&
 * status=="active") حالياً، والتغيير المطلوب هيخرجه من هذه الحالة
 * (دوره الجديد مش "admin"). firestore.rules (بند A1 في تقرير
 * المراجعة) بتمنع هذا التحويل تحديداً من updateDoc() في كود العميل
 * مباشرة - حتى لو المستخدم اللي بينادي فعلاً Admin - عشان نضمن
 * فحص "آخر Admin نشط" الحقيقي هنا على السيرفر (نفس منطق
 * countOtherActiveAdmins في usersApi.js) مش بس في الواجهة، ومينفعش
 * حد يتجاوزه بمناداة updateDoc() مباشرة من DevTools.
 *
 * باقي حالات تغيير الدور/الصلاحيات (نفس الدور، أو مستخدم مش Admin
 * نشط أصلاً) لسه بتحصل مباشرة من الواجهة عبر updateDoc() زي ما هي -
 * الدالة دي مش بديلة عن updatePermissionsApi، هي مسار إضافي
 * للحالة الحرجة دي بالذات (راجع usersApi.js).
 *
 * ============================================================
 * إصلاح (Race Condition - حماية "آخر Admin" الذرّية):
 * ============================================================
 * نفس آلية deleteUserAccount فوق بالظبط: فحص عدد الأدمنز النشطين +
 * تعديل المستند المستهدف بقى جوه Firestore Transaction واحدة، عشان
 * طلبين "تنزيل Admin" لأدمنز مختلفين في نفس اللحظة (وهما آخر
 * أدمنين نشطين) يستحيل يعدّوا الفحص الاتنين مع بعض - Firestore
 * بيكتشف تلقائياً إن أي مستند اتقرا جوه Transaction (بما فيه نتائج
 * الـ Query) اتغيّر من حد تاني قبل الـ commit، فبيرفض الـ commit
 * ويعيد تنفيذ الطلب التاني بأحدث بيانات (وقتها هيلاقي إنه فعلاً آخر
 * أدمن نشط ويترفض). عملية واحدة فقط (Firestore نفسه) هنا، فالحماية
 * ذرّية بالكامل من غير أي تعقيد إضافي.
 *
 * @param {{ userId: string, role: string, permissions?: string }} data
 */
exports.updateUserRoleAccount = onCall({ region: "us-central1" }, async (request) => {

  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  }

  const { userId, role, permissions } = request.data || {};

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "معرف المستخدم غير صالح.");
  }

  if (!role || typeof role !== "string") {
    throw new HttpsError("invalid-argument", "الدور الجديد غير صالح.");
  }

  // التحقق إن المستخدم اللي بينادي فعلاً أدمن نشط - قراءة مباشرة من
  // Firestore على السيرفر، مش من أي بيانات جاية من العميل
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;

  if (!callerData || callerData.role !== "admin" || callerData.status !== "active") {
    throw new HttpsError("permission-denied", "هذه العملية مقصورة على Admin فقط.");
  }

  const targetRef = db.collection("users").doc(userId);

  // ------------------------------------------------------------
  // الخطوة الذرّية: فحص "آخر Admin" + تعديل المستند معاً - راجع
  // الشرح فوق
  // ------------------------------------------------------------
  await db.runTransaction(async (transaction) => {

    const targetSnap = await transaction.get(targetRef);

    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "المستخدم غير موجود.");
    }

    const targetData = targetSnap.data();

    const targetIsActiveAdmin =
      targetData.role === "admin" && targetData.status === "active";

    // حماية آخر Admin - بس في حالة إن الدور فعلاً هيتغيّر لغير admin
    // لمستخدم Admin نشط حالياً
    if (targetIsActiveAdmin && role !== "admin") {

      const othersQuery = db
        .collection("users")
        .where("role", "==", "admin")
        .where("status", "==", "active");

      // القراءة دي جوه الـ Transaction هي أساس الحماية من الـ Race
      // Condition - راجع الشرح فوق
      const othersSnap = await transaction.get(othersQuery);

      const remaining = othersSnap.docs.filter((d) => d.id !== userId).length;

      if (remaining === 0) {
        throw new HttpsError(
          "failed-precondition",
          "لا يمكن تغيير دور هذا المستخدم لأنه آخر Admin نشط في النظام."
        );
      }

    }

    transaction.update(targetRef, {
      role,
      permissions: typeof permissions === "string" ? permissions : (targetData.permissions || ""),
      updatedAt: new Date().toISOString(),
      updatedBy: callerData.name || "Admin"
    });

  });

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
