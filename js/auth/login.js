// استيراد قاعدة البيانات ومتغير DEBUG من ملف الإعدادات المركزي
import { DEBUG, phoneToAuthEmail } from '../config.js';
import { normalizePhone, phoneAuthEmailCandidates } from '../utils/phoneUtils.js';

import {
  db,
  auth,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  callPublicCloudFunction
} from "../providers/backend/index.js";

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
 * من غير أي حساب Firebase Auth حقيقي. لما تسجيل الدخول العادي
 * يفشل، بننادي Cloud Function (migrateLegacyAccount - functions/
 * index.js) اللي بتتحقق من كلمة السر القديمة على السيرفر وبتنشئ
 * حساب Auth حقيقي ومستند users/{uid} نظيف (بدون أي حقول كلمة سر).
 *
 * Security review (Auth/Roles): كان الترحيل بيتم هنا في المتصفح:
 * قراءة المستند القديم (بأسراره) بدون تسجيل دخول، ومقارنة كلمة السر
 * محلياً، وكتابة المستند الجديد بـ role/status منسوخين - ده كان
 * بيكشف أسرار الحسابات القديمة لأي زائر وبيفتح باب استيلاء على حساب.
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

  // تطبيع الرقم (أرقام عربية / +20 / 0020 ...) قبل أي محاولة - بدل ما
  // الأرقام العربية كانت بتتحذف وتنتج إيميل فاضي ورسالة مضللة (بند H2)
  if (!normalizePhone(cleanPhone).ok) {
    return {
      status: "error",
      message: "رقم الموبايل غير صالح، تأكد من كتابته بشكل صحيح."
    };
  }

  // الإيميل القياسي أولاً، وبعده الصيغ القديمة لحسابات اتسجّلت قبل التطبيع
  const emailCandidates = phoneAuthEmailCandidates(cleanPhone);
  let email = phoneToAuthEmail(cleanPhone);
  let uid;

  try {

    // ==================================================
    // المحاولة الطبيعية: المستخدم عنده حساب Firebase Auth بالفعل
    // ==================================================

    let cred = null;
    let lastAuthError = null;

    for (const candidate of emailCandidates) {
      try {
        cred = await signInWithEmailAndPassword(auth, candidate, cleanPass);
        email = candidate;
        break;
      } catch (candidateError) {
        lastAuthError = candidateError;
        // فقط "حساب غير موجود / بيانات غير صحيحة" بتخلينا نجرّب الصيغة التالية
        if (
          candidateError.code !== "auth/user-not-found" &&
          candidateError.code !== "auth/invalid-credential" &&
          candidateError.code !== "auth/invalid-email"
        ) {
          break;
        }
      }
    }

    if (!cred) throw lastAuthError;

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
    // ترحيل تلقائي من النظام القديم (بدون Firebase Auth) - سيرفري
    // ==================================================

    try {
      await callPublicCloudFunction("migrateLegacyAccount", {
        phone: cleanPhone,
        password: cleanPass
      });
    } catch (migrationError) {
      // الدالة بترد برسالة موحّدة (رقم/كلمة سر غير صحيحة) لو مفيش حساب
      // قديم أو كلمة السر غلط - مانكشفش هل الرقم مسجل ولا لأ. أي فشل
      // تاني (دالة غير منشورة/شبكة) مايظهرش للمستخدم كتفاصيل بنية تحتية
      // لأن الحالة الأكثر شيوعاً هنا ببساطة كلمة سر غلط لحساب عادي.
      const knownDenial = [
        "PERMISSION_DENIED",
        "RESOURCE_EXHAUSTED",
        "FAILED_PRECONDITION",
        "INVALID_ARGUMENT"
      ].includes(migrationError?.code);

      if (!knownDenial) {
        console.warn("Legacy migration call failed:", migrationError?.message || migrationError);
      }

      return {
        status: "error",
        message:
          knownDenial && migrationError?.message
            ? migrationError.message
            : "رقم الموبايل أو كلمة السر غير صحيحة."
      };
    }

    // الحساب اترحّل - نسجّل الدخول به الآن
    try {
      const migratedCred = await signInWithEmailAndPassword(auth, phoneToAuthEmail(cleanPhone), cleanPass);
      uid = migratedCred.user.uid;
    } catch (postMigrationError) {
      console.error("Post-migration sign-in error:", postMigrationError);
      return {
        status: "error",
        message: "تمت ترقية الحساب، يرجى تسجيل الدخول مرة أخرى."
      };
    }
  }

  // ==================================================
  // من هنا: نفس منطق فحص الحساب القديم بالضبط، لكن القراءة
  // من مستند users/{uid} مباشرة بدل الاستعلام برقم الهاتف
  // ==================================================

  let userDocSnap = await getDoc(doc(db, "users", uid));

  if (!userDocSnap.exists()) {
    // حساب Auth موجود لكن مستند users/{uid} مفقود: غالباً ترحيل سابق
    // اتقطع في النص، أو حساب Auth اتحجز قبل صاحبه. بنحاول نفس الترحيل
    // السيرفري (بيتحقق من كلمة السر القديمة بنفسه - مفيش نسخ للبيانات
    // من العميل). لو مفيش مستند قديم مناسب بيفشل ونكمل للرسالة تحت.
    try {
      await callPublicCloudFunction("migrateLegacyAccount", {
        phone: cleanPhone,
        password: cleanPass
      });

      // الدالة بتلغي جلسات الحساب (revokeRefreshTokens) - نعيد الدخول
      const reCred = await signInWithEmailAndPassword(auth, email, cleanPass);
      uid = reCred.user.uid;
      userDocSnap = await getDoc(doc(db, "users", uid));
    } catch (migrationError) {
      console.warn("Legacy profile recovery not applicable:", migrationError?.message || migrationError);
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

  // Security (Test 15): تم حذف كود "TEMPORARY FIX" اللي كان بيرقّي أي
  // مستخدم اسمه "mohamed hosien" لـ Admin تلقائياً من المتصفح - ثغرة
  // ترقية صلاحيات (الاسم حقل حر). الترقية بقت عبر Admin فقط.

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
 * استعادة كلمة السر - المستخدم نفسه (خصوصية: الأدمن لا يعرف ولا يعيّن كلمات السر).
 * التحقق برقم الهاتف + كود الموظف المسجَّل وقت إنشاء الحساب، والتنفيذ على السيرفر
 * (Worker: resetPasswordWithEmployeeCode) لأن تغيير كلمة سر حساب غير مسجَّل دخوله
 * ممكن بامتيازات Admin فقط. السيرفر بيحدّ المحاولات (٥ محاولات فاشلة لكل رقم كل ٢٤ ساعة)
 * وبيرد برسالة عامة موحّدة سواء الرقم أو الكود غلط (مايكشفش وجود الحساب).
 */
export async function resetPassword(phone, code, newPassword) {
  if (!normalizePhone(phone).ok) {
    return { success: false, message: "رقم الموبايل غير صالح." };
  }
  if (!String(code || "").trim()) {
    return { success: false, message: "أدخل كود الموظف." };
  }
  if (String(newPassword || "").length < 8) {
    return { success: false, message: "كلمة السر الجديدة يجب أن تكون ٨ أحرف على الأقل." };
  }
  try {
    await callPublicCloudFunction("resetPasswordWithEmployeeCode", {
      phone: String(phone).trim(),
      code: String(code).trim(),
      newPassword
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: error?.message || "تعذّر تغيير كلمة السر." };
  }
}
