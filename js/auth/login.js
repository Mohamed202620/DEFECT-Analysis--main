// استيراد قاعدة البيانات ومتغير DEBUG من ملف الإعدادات المركزي
import { db, auth, DEBUG, phoneToAuthEmail } from '../config.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "../firebase.js";

import { verifyPassword } from '../services/crypto.js';

/**
 * خدمة تسجيل الدخول عبر Firebase Authentication (Email/Password)
 *
 * رقم الموبايل بيتحوّل لإيميل داخلي (phoneToAuthEmail) عشان نقدر
 * نستخدم Firebase Auth الحقيقي مع الحفاظ على واجهة الدخول برقم
 * الموبايل زي ما هي تماماً.
 *
 * ترحيل تلقائي للحسابات القديمة:
 * أي مستخدم اتسجل قبل التفعيل ده لسه عنده فقط مستند فيه
 * passwordHash/salt (أو password Plaintext في حالات قديمة جداً)
 * من غير أي حساب Firebase Auth حقيقي. أول مرة يدخل بعد هذا
 * التحديث: بنتحقق من كلمة سره بالطريقة القديمة، ولو صحيحة بننشئ
 * له حساب Auth حقيقي بنفس كلمة السر اللي كتبها الآن، وننقل بياناته
 * (بدون أي حقول خاصة بكلمة السر) لمستند جديد بمعرّف = uid بتاع
 * Firebase Auth. من المرة الجاية هيدخل عادي عن طريق Auth مباشرة.
 */
export async function login(phone, pass) {

  const cleanPhone = String(phone || "").trim();
  const cleanPass = String(pass || "").trim();

  if (!cleanPhone || !cleanPass) {
    return {
      status: "error",
      message: "يرجى إدخال رقم الموبايل وكلمة السر بشكل صحيح."
    };
  }

  const email = phoneToAuthEmail(cleanPhone);
  let uid;

  try {

    // ==================================================
    // المحاولة الطبيعية: المستخدم عنده حساب Firebase Auth بالفعل
    // ==================================================

    const cred = await signInWithEmailAndPassword(auth, email, cleanPass);
    uid = cred.user.uid;

  } catch (authError) {

    const isMissingAuthAccount =
      authError.code === "auth/user-not-found" ||
      authError.code === "auth/invalid-credential" ||
      authError.code === "auth/invalid-email";

    if (!isMissingAuthAccount) {

      if (authError.code === "auth/wrong-password") {
        return { status: "error", message: "كلمة السر غير صحيحة." };
      }

      if (authError.code === "auth/too-many-requests") {
        return {
          status: "error",
          message: "محاولات كثيرة جداً، يرجى المحاولة لاحقاً."
        };
      }

      console.error("Auth Login Error:", authError);
      return { status: "error", message: "حدث خطأ أثناء تسجيل الدخول." };
    }

    // ==================================================
    // ترحيل تلقائي من النظام القديم (بدون Firebase Auth)
    // ==================================================

    const usersRef = collection(db, "users");
    const legacyQuery = query(usersRef, where("phone", "==", cleanPhone), limit(1));
    const legacySnapshot = await getDocs(legacyQuery);

    if (legacySnapshot.empty) {
      return { status: "error", message: "رقم الموبايل غير مسجل بالنظام." };
    }

    if (legacySnapshot.size > 1) {
      return {
        status: "error",
        message: "يوجد أكثر من حساب بنفس رقم الهاتف."
      };
    }

    const legacyDocSnap = legacySnapshot.docs[0];
    const legacyData = legacyDocSnap.data();

    const isLegacyPlaintext = !legacyData.passwordHash && !!legacyData.password;

    let passwordOk = false;

    if (isLegacyPlaintext) {
      passwordOk = legacyData.password === cleanPass;
    } else {
      passwordOk = await verifyPassword(
        cleanPass,
        legacyData.salt,
        legacyData.passwordHash
      );
    }

    if (!passwordOk) {
      return { status: "error", message: "كلمة السر غير صحيحة." };
    }

    // كلمة السر صحيحة -> ننشئ حساب Firebase Auth حقيقي الآن
    let migratedCred;
    try {
      migratedCred = await createUserWithEmailAndPassword(auth, email, cleanPass);
    } catch (migrationAuthError) {
      console.error("Auth migration error:", migrationAuthError);
      return {
        status: "error",
        message: "حدث خطأ أثناء ترقية الحساب، يرجى المحاولة مرة أخرى."
      };
    }

    uid = migratedCred.user.uid;

    // نقل بيانات المستخدم (بدون أي حقول متعلقة بكلمة السر) لمستند
    // جديد بمعرّف = uid، بدل المستند القديم بمعرّفه العشوائي.
    // migratedFromId: معرّف المستند القديم - مطلوب عشان قاعدة
    // الأمان (firestore.rules) تقدر تتحقق إن role/status المنسوخين
    // فعلاً جايين من مستند قديم حقيقي بنفس القيم، مش مُلفّقين
    const {
      password: _legacyPassword,
      passwordHash: _legacyHash,
      salt: _legacySalt,
      ...safeLegacyData
    } = legacyData;

    try {
      await setDoc(doc(db, "users", uid), {
        ...safeLegacyData,
        migratedFromId: legacyDocSnap.id
      });
    } catch (migrationWriteError) {
      console.error("Legacy profile migration error:", migrationWriteError);
      return {
        status: "error",
        message: "تم ترقية الحساب لكن حدث خطأ أثناء نقل البيانات، يرجى المحاولة مرة أخرى."
      };
    }

    // ملحوظة: المستند القديم (legacyDocSnap.id) بيفضل موجود عمداً
    // كنسخة احتياطية بدل حذفه تلقائياً - يُنصح بمراجعته وحذفه يدوياً
    // بعد التأكد إن الترحيل نجح لكل المستخدمين.
  }

  // ==================================================
  // من هنا: نفس منطق فحص الحساب القديم بالضبط، لكن القراءة
  // من مستند users/{uid} مباشرة بدل الاستعلام برقم الهاتف
  // ==================================================

  let userDocSnap = await getDoc(doc(db, "users", uid));

  if (!userDocSnap.exists()) {
    // إذا يوجد حساب Auth لكن لا يوجد مستند users/{uid}، حاولنا الترحيل
    // من بيانات المستخدم القديم برقم الهاتف نفسه إذا كانت موجودة.
    const usersRef = collection(db, "users");
    const legacyQuery = query(usersRef, where("phone", "==", cleanPhone), limit(1));
    const legacySnapshot = await getDocs(legacyQuery);

    if (!legacySnapshot.empty) {
      const legacyDocSnap = legacySnapshot.docs[0];
      const legacyData = legacyDocSnap.data();
      const { password: _legacyPassword, passwordHash: _legacyHash, salt: _legacySalt, ...safeLegacyData } = legacyData;
      try {
        await setDoc(doc(db, "users", uid), {
          ...safeLegacyData,
          migratedFromId: legacyDocSnap.id
        });
        userDocSnap = await getDoc(doc(db, "users", uid));
      } catch (migrationWriteError) {
        console.error("Legacy profile migration error for missing users/{uid}:", migrationWriteError);
        return {
          status: "error",
          message: "بيانات الحساب غير موجودة. يرجى التواصل مع المسؤول."
        };
      }
    }
  }

  if (!userDocSnap.exists()) {
    // إصلاح (بند B3 في تقرير المراجعة): لو حذف الأدمن مستخدم من
    // Firestore، حساب Firebase Auth بتاعه بيفضل موجود فعلياً (حذف
    // حساب Auth لمستخدم تاني محتاج Admin SDK من سيرفر - راجع
    // الملاحظة فوق deleteUserApi في usersApi.js). لو حاول الدخول
    // بعد كده بكلمة سره القديمة، Auth SDK هيقبله (الحساب لسه موجود)،
    // وهيوصل هنا (مفيش مستند بيانات ليه، ومفيش نسخة قديمة نرحّلها).
    // كان الكود قبل كده بيرجع خطأ من غير ما يعمل signOut، يعني
    // المستخدم يفضل شكلياً "مسجّل دخول" على مستوى Firebase Auth
    // (auth.currentUser) رغم إن التطبيق بيعتبره غير مسجّل - نفس
    // الأسلوب المُتّبع بالفعل تحت لحالات pending/rejected/inactive.
    await signOut(auth);
    return {
      status: "error",
      message: "هذا الحساب لم يعد موجودًا بالنظام، يرجى التواصل مع المسؤول."
    };
  }

  const data = userDocSnap.data();

  const userData = {
    id: uid,
    ...data,

    status: (data.status || "").trim().toLowerCase(),
    role: (data.role || "").trim().toLowerCase(),

    permissions: (data.permissions || "")
      .split(",")
      .map(p => p.trim().toLowerCase())
      .filter(Boolean)
      .join(",")
  };

  if (DEBUG) {
    console.log("USER DATA:", userData);
  }

  if (userData.status === "pending") {
    await signOut(auth);
    return {
      status: "error",
      message: "تم إرسال طلبك وهو بانتظار موافقة المسؤول."
    };
  }

  if (userData.status === "rejected") {
    await signOut(auth);
    return {
      status: "error",
      message: "تم رفض طلب الانضمام، يرجى التواصل مع المسؤول."
    };
  }

  if (userData.status !== "active") {
    await signOut(auth);
    return {
      status: "error",
      message: "الحساب غير مفعل."
    };
  }

  return {
    status: "success",
    user: userData
  };
}
