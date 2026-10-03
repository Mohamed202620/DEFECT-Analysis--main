// ============================================================
// firebaseBackendProvider.js
// تنفيذ Firebase الفعلي لواجهة الـ Backend Provider (راجع
// providers/README.md). هذا الملف هو نقطة إعادة التصدير الوحيدة
// لأدوات Firestore/Auth الخام (collection, doc, getDocs...) ولـ
// db/auth نفسها - أي ملف تاني في طبقة services يفترض يستوردهم من
// index.js في هذا المجلد، مش من هنا مباشرة ولا من firebase.js/
// config.js.
//
// لو حبينا نستبدل Firebase بمزود تاني مستقبلاً: نضيف ملف تنفيذ جديد
// بنفس الأسماء المُصدَّرة هنا (نفس التوقيعات قدر الإمكان)، ونغيّر
// سطر الاستيراد في index.js بس.
// ============================================================

// الـ instances المُهيّأة فعلاً (تهيئة Firebase App نفسها لسه في
// config.js - ده تفصيلة تنفيذ داخلية طبيعية لمزود Firebase، مش جزء
// من الواجهة العامة اللي services المفروض تتعامل معاها)
export { db, auth } from "../../config.js";
export { getRegistrationAuthContext } from "../../config.js";

import {
  auth as _auth,
  FIREBASE_PROJECT_ID,
  FIREBASE_FUNCTIONS_REGION,
  BACKEND_WORKER_URL
} from "../../config.js";

// ============================================================
// استدعاء Cloud Functions من نوع onCall (functions/index.js) - بند
// B3/A1 في تقرير المراجعة (حذف حساب Firebase Auth عند حذف مستخدم،
// وحماية "آخر Admin" على مستوى السيرفر عند تغيير الدور).
//
// بنستخدم بروتوكول "onCall" الرسمي مباشرة عبر fetch() بدل تحميل
// حزمة "firebase/functions" كاملة في js/firebase.js (اللي حالياً
// بندل واحد جاهز فيه فقط app/auth/firestore/storage) - البروتوكول
// موثّق وثابت: POST لرابط الدالة مع
// Authorization: Bearer <ID Token> وBody = { data: {...} }، والرد
// بييجي { result: ... } عند النجاح أو { error: { message, ... } }
// عند الفشل. الأسلوب ده مايحتاجش حزمة SDK إضافية إطلاقاً - بس
// auth.currentUser.getIdToken() (متاحة أصلاً) وfetch() العادية.
//
// ⚠️ الدوال دي (deleteUserAccount / updateUserRoleAccount) لازم
// تكون منشورة فعلاً (firebase deploy --only functions) قبل ما
// الاستدعاء هنا يشتغل - راجع functions/README.md لخطوات النشر.
// ============================================================

function cloudFunctionUrl(functionName) {
  // الـ Worker (Cloudflare) له نفس البروتوكول: POST /<اسم> بـ {data} ويرجع {result}
  if (BACKEND_WORKER_URL) {
    return `${BACKEND_WORKER_URL.replace(/\/+$/, "")}/${functionName}`;
  }
  return `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/${functionName}`;
}

/**
 * رفع ملف (multipart) للـ Worker مع توكن المستخدم. الجسم بيتمرّر لـ ImgBB
 * كما هو بدون تحليل JSON (الـ Worker المجاني محدود بـ 10ms CPU للطلب).
 */
export async function callWorkerUpload(functionName, formData) {
  if (!_auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
  const idToken = await _auth.currentUser.getIdToken();
  const response = await fetchWithTimeout(cloudFunctionUrl(functionName), {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` }, // مفيش Content-Type: المتصفح بيضيف الـ boundary
    body: formData
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { /* لا شيء */ }
  if (!response.ok || !payload || payload.error) {
    throw new Error(payload?.error?.message || "فشل رفع الصورة.");
  }
  return payload.result;
}

// إصلاح (اتصال): fetch بدون مهلة كان بيعلّق الحفظ للأبد لو الشبكة وقفت نص الطريق
// (نفس مشكلة Test 16 اللي اتعالجت في imgbbStorageProvider بـ AbortController 30 ثانية).
// رفع الصور بقى بيمر من هنا (serverProxyStorageProvider) فلازم المهلة تتنقل معاه.
const CLOUD_FUNCTION_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options, timeoutMs = CLOUD_FUNCTION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callCloudFunction(functionName, data) {

  if (!_auth.currentUser) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }

  const idToken = await _auth.currentUser.getIdToken();

  let response;
  try {
    response = await fetchWithTimeout(cloudFunctionUrl(functionName), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ data: data || {} })
    });
  } catch (networkError) {
    // الأرجح: الدالة (Cloud Function) لسه مش منشورة فعلاً على
    // Firebase، أو مفيش اتصال إنترنت - راجع functions/README.md
    throw new Error(
      "تعذّر الوصول لخدمة السيرفر المطلوبة. تأكد من نشر Cloud Functions " +
      `(${functionName}) على مشروع Firebase أولاً، أو من اتصال الإنترنت.`
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_parseError) {
    // رد بدون JSON صالح - هيتعامل معاه تحت كـ فشل عام
  }

  if (!response.ok || !payload || payload.error) {
    const message =
      payload?.error?.message ||
      `فشل تنفيذ العملية على السيرفر (${functionName}).`;
    throw new Error(message);
  }

  return payload.result;

}

// استدعاء دالة onCall "عامة" بدون تسجيل دخول مسبق (بدون Authorization).
// الاستخدام الوحيد الحالي: migrateLegacyAccount من شاشة الدخول (ترحيل
// الحسابات القديمة) - الدالة نفسها بتتحقق من كلمة السر القديمة على
// السيرفر وبتطبّق حد محاولات، فمفيش أي صلاحية بتتعطى من العميل.
export async function callPublicCloudFunction(functionName, data) {

  let response;
  try {
    response = await fetchWithTimeout(cloudFunctionUrl(functionName), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: data || {} })
    });
  } catch (networkError) {
    throw new Error(
      "تعذّر الوصول لخدمة السيرفر المطلوبة. تأكد من نشر Cloud Functions " +
      `(${functionName}) على مشروع Firebase أولاً، أو من اتصال الإنترنت.`
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_parseError) {
    // رد بدون JSON صالح - هيتعامل معاه تحت كـ فشل عام
  }

  if (!response.ok || !payload || payload.error) {
    const publicError = new Error(
      payload?.error?.message ||
      `فشل تنفيذ العملية على السيرفر (${functionName}).`
    );
    // كود HttpsError من الدالة (مثلاً PERMISSION_DENIED) - عشان المُنادي
    // يفرّق بين رد الدالة الفعلي وبين فشل بنية تحتية (دالة غير منشورة...)
    publicError.code = payload?.error?.status || "UNAVAILABLE";
    throw publicError;
  }

  return payload.result;

}

// أدوات Firestore + Auth الخام المُستخدمة فعلياً عبر كل ملفات
// services/*.js حالياً (نفس الأسماء والتوقيعات القادمة من Firebase
// SDK بدون أي تعديل في المنطق)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getCountFromServer,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged
} from "../../firebase.js";

// ============================================================
// serverTimestamp (بند M7): حزمة js/firebase.js الجاهزة ما بتصدّرش
// serverTimestamp، فبنبنيه من أصناف الـ SDK الداخلية المُصدَّرة صراحةً
// (FieldValue / FieldTransform / ServerTimestampTransform) - نفس
// تنفيذ الـ SDK الرسمي بالظبط: sentinel بيتحوّل لـ setToServerValue:
// REQUEST_TIME على السيرفر. بنستخدمه للأوقات الحساسة (createdAtServer /
// resolvedAtServer) بدل الاعتماد على ساعة جهاز المستخدم.
// ============================================================
import {
  FieldValue as _FieldValue,
  FieldTransform as _FieldTransform,
  ServerTimestampTransform as _ServerTimestampTransform
} from "../../firebase.js";

class ServerTimestampSentinel extends _FieldValue {
  constructor() {
    super("serverTimestamp");
  }
  _toFieldTransform(context) {
    return new _FieldTransform(context.path, new _ServerTimestampTransform());
  }
  isEqual(other) {
    return other instanceof ServerTimestampSentinel;
  }
}

export function serverTimestamp() {
  return new ServerTimestampSentinel();
}
