// استيراد قاعدة البيانات ومتغير DEBUG من ملف الإعدادات المركزي
import { DEBUG, phoneToAuthEmail } from '../config.js';

import {
  db,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "../providers/backend/index.js";

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
    // إصلاح أمني (PHASE 2 - بند 1 في تقرير المراجعة، CRITICAL):
    // ترحيل تلقائي من النظام القديم (بدون Firebase Auth) - بدون
    // أي استعلام Firestore غير مُصادَق عليه.
    //
    // كان الكود القديم هنا بيعمل getDocs() على users بـ
    // where(phone)+limit(1) وهو المستخدم لسه غير مسجّل دخول - وده
    // كان بيعتمد على استثناء في firestore.rules
    // (!isSignedIn() && request.query.limit<=1) اتضح إنه قابل
    // للاستغلال: أي حد يقدر يستدعي مباشرة من كونسول المتصفح
    //   getDocs(query(collection(db,"users"), limit(1)))
    // من غير where() أصلاً (القاعدة مش بتتحقق من وجوده أصلاً)
    // ويكرر العملية بـ startAfter(lastDoc) عشان يسحب كل مستندات
    // users بالتدريج - تسريب كامل (هاتف/اسم/دور/الخ) لكل
    // المستخدمين بلا أي تسجيل دخول.
    //
    // الإصلاح: بننشئ حساب Firebase Auth الحقيقي *الأول*
    // (createUserWithEmailAndPassword) قبل أي استعلام Firestore -
    // فبيبقى عندنا request.auth != null فعلياً (بحساب Email/
    // Password حقيقي) وقت الاستعلام. firestore.rules دلوقتي
    // بتسمح بـ list() بحد أقصى نتيجة واحدة بس لمستخدم مسجّل دخول
    // فعلياً بحساب Email/Password حقيقي (مش Anonymous) - يعني أي
    // محاولة تعداد لازم تعدي أولاً من إنشاء حساب Firebase Auth
    // حقيقي، اللي عنده حماية Rate-Limiting مدمجة من Firebase نفسها
    // (auth/too-many-requests، مُعالجة بالفعل تحت).
    //
    // لو كلمة السر القديمة غلط أو الهاتف مش مسجّل أو مسجّل أكتر من
    // مرة: بنحذف الحساب المؤقت ده فوراً (deleteUser على المستخدم
    // الحالي نفسه - مسموح من الـ Client SDK بدون أي Admin SDK)
    // عشان مايفضلش أي أثر ومايتسربش أي معلومة عن وجود الحساب من
    // عدمه بعد كده.
    // ==================================================

    let tempCred;
    try {
      tempCred = await createUserWithEmailAndPassword(auth, email, cleanPass);
    } catch (createError) {

      if (createError.code === "auth/email-already-in-use") {
        // نادرة جداً (Race condition محتمل) - الحساب موجود فعلاً
        // بس كلمة السر المُدخَلة غلط عليه
        return { status: "error", message: "كلمة السر غير صحيحة." };
      }

      if (createError.code === "auth/weak-password") {
        return {
          status: "error",
          message: "كلمة السر قصيرة جداً (الحد الأدنى المسموح به من Firebase هو 6 أحرف)، يرجى التواصل مع المسؤول لتحديثها."
        };
      }

      if (createError.code === "auth/too-many-requests") {
        return {
          status: "error",
          message: "محاولات كثيرة جداً، يرجى المحاولة لاحقاً."
        };
      }

      console.error("Auth migration pre-check error:", createError);
      return { status: "error", message: "حدث خطأ أثناء تسجيل الدخول." };
    }

    uid = tempCred.user.uid;

    // من هنا المستخدم *مسجّل دخول فعلياً* بحساب Email/Password
    // حقيقي، فالاستعلام التالي مسموح من firestore.rules الجديدة
    const usersRef = collection(db, "users");
    const legacyQuery = query(usersRef, where("phone", "==", cleanPhone), limit(1));

    let legacySnapshot;
    try {
      legacySnapshot = await getDocs(legacyQuery);
    } catch (queryError) {
      console.error("Legacy lookup error:", queryError);
      await deleteUser(tempCred.user).catch(() => {});
      return { status: "error", message: "حدث خطأ أثناء تسجيل الدخول." };
    }

    if (legacySnapshot.empty) {
      await deleteUser(tempCred.user).catch(() => {});
      return { status: "error", message: "رقم الموبايل غير مسجل بالنظام." };
    }

    if (legacySnapshot.size > 1) {
      await deleteUser(tempCred.user).catch(() => {});
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
      await deleteUser(tempCred.user).catch(() => {});
      return { status: "error", message: "كلمة السر غير صحيحة." };
    }

    // كلمة السر صحيحة -> ننقل بياناته لمستند جديد بمعرّف = uid
    // بتاع حساب Auth اللي اتعمل فوق بالفعل (مش هننشئ حساب Auth
    // تاني - نفس مبدأ الكود القديم، بس بترتيب مختلف)
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
      // ملحوظة: هنا الحساب صحيح وكلمة السر صحيحة، بس فشلت كتابة
      // المستند الجديد - مبنحذفش الحساب (لو حذفناه المستخدم يفقد
      // فرصة إعادة المحاولة بنفس الحساب) وبنسيب رسالة واضحة تطلب
      // إعادة المحاولة، بدل ما نرجّعه لنقطة الصفر
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

/**
 * إصلاح (PHASE 2 - بند 2 في تقرير المراجعة، HIGH): "نسيت كلمة السر"
 * المعطّلة فعلياً.
 *
 * كانت هذه الدالة بتستخدم phoneToAuthEmail() لتحويل رقم الموبايل
 * لإيميل داخلي وهمي (مثال: 01001234567@maintenance-defect-system.local)
 * ثم تطلب من Firebase إرسال رابط استعادة كلمة السر القياسي (sendOobCode)
 * لهذا الإيميل - رغم إنه إيميل غير موجود فعلياً ولا يملكه أي أحد.
 * كانت الواجهة (authHandlers.js) تعرض للمستخدم "تم الإرسال بنجاح"
 * دائماً، بينما لا يصل أي شيء لأي أحد أبداً - المستخدم يفضل عالق
 * بلا أي طريقة حقيقية لاستعادة حسابه.
 *
 * لماذا لا يوجد حل "استعادة تلقائية حقيقية" هنا: المستخدمون يدخلون
 * برقم موبايل فقط (لا يوجد إيميل حقيقي لأي أحد)، وإرسال رابط عبر
 * SMS يتطلب الاشتراك في خدمة SMS مدفوعة (خارج نطاق هذا الإصلاح).
 *
 * الآلية الحقيقية الوحيدة المتاحة بدون أي خدمة مدفوعة: "إعادة
 * تعيين بمساعدة الأدمن" - بعد أن يتأكد الأدمن من هوية الموظف (يدويًا
 * داخل الشركة)، يستطيع توليد كلمة سر مؤقتة جديدة له من صفحة الإدارة
 * عبر Cloud Function مخصصة (adminResetUserPassword في
 * functions/index.js) لا تعمل إطلاقاً من المتصفح مباشرة بصلاحيات
 * Admin - تتحقق من كون المستخدم المستدعي admin فعلاً على السيرفر
 * أولاً (نفس مبدأ deleteUserAccount الموجودة بالفعل).
 *
 * لذلك: هذه الدالة لم تعد تتصل بـ Firebase إطلاقاً (كانت هي نفسها
 * مصدر الخداع)، وترجع فقط رسالة صادقة توضح الآلية الحقيقية المتاحة
 * حاليًا - بدون أي ادّعاء بنجاح إرسال أي شيء.
 *
 * ⚠️ ملاحظة نشر: ربط adminResetUserPassword بزر فعلي داخل شاشة
 * إدارة المستخدمين (مثل RequestsView.js) لم يتم في هذا الإصلاح
 * (خارج النطاق المطلوب - "لا تعديلات على واجهات أخرى") - الدالة
 * جاهزة للاستخدام عبر adminResetPasswordApi في usersApi.js.
 */
export async function resetPassword(_phone) {
  return {
    success: false,
    adminAssistedOnly: true,
    message:
      "لا يوجد بريد إلكتروني حقيقي مرتبط برقم الموبايل، فلا يمكن إرسال رابط استعادة تلقائيًا. يرجى التواصل مع مسؤول النظام لإعادة تعيين كلمة السر لك."
  };
}
