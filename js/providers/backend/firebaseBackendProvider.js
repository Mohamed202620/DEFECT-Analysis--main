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

import {
  auth as _auth,
  FIREBASE_PROJECT_ID,
  FIREBASE_FUNCTIONS_REGION
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
  return `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/${functionName}`;
}

export async function callCloudFunction(functionName, data) {

  if (!_auth.currentUser) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }

  const idToken = await _auth.currentUser.getIdToken();

  let response;
  try {
    response = await fetch(cloudFunctionUrl(functionName), {
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
