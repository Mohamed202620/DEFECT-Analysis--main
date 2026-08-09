<<<<<<< HEAD
// ============================================================
// REGISTER SERVICE
// Firebase Firestore
// ============================================================

// استخدام خدمة API المركزية بدلاً من الاتصال بـ Firestore مباشرة
import {
  registerUserApi
} from "../../services/api.js";


/**
 * خدمة تسجيل مستخدم جديد
 *
 * جميع عمليات Firebase الخاصة بالمستخدمين
 * تتم من خلال services/api.js
 *
 * @param {Object} userData بيانات المستخدم من نموذج التسجيل
 * @returns {Promise<Object>} نتيجة التسجيل
 */
export async function register(userData = {}) {

  try {

    // ========================================================
    // تنظيف البيانات
    // ========================================================

    const name =
      String(userData.name || "").trim();

    const phone =
      String(userData.phone || "").trim();

    const password =
      String(userData.password || "").trim();

    const confirmPassword =
      String(userData.confirmPassword || "").trim();

    const shift =
      String(userData.shift || "").trim();

    const job =
      String(userData.job || "").trim();

    const department =
      String(userData.department || "").trim();

    const code =
      String(userData.code || "").trim();


    // ========================================================
    // التحقق من البيانات الأساسية
    // ========================================================

    if (
      !name ||
      !phone ||
      !password ||
      !confirmPassword ||
      !shift ||
      !job ||
      !department ||
      !code
    ) {

      return {

        status: "error",

        message:
          "يرجى إدخال جميع البيانات المطلوبة."

      };

    }


    // ========================================================
    // التحقق من كلمة السر
    // ========================================================

    if (password !== confirmPassword) {

      return {

        status: "error",

        message:
          "كلمتا السر غير متطابقتين."

      };

    }


    // ========================================================
    // تجهيز البيانات
    // ========================================================
    //
    // مهم:
    // لا نرسل confirmPassword إلى Firebase.
    //
    // الحساب يبدأ دائماً Pending.
    // الدور والصلاحيات يتم تحديدهما من API.
    //
    // ========================================================

    const newUser = {

      name,

      phone,

      password,

      shift,

      job,

      department,

      code

    };


    // ========================================================
    // إرسال التسجيل إلى API المركزي
    // ========================================================

    const result =
      await registerUserApi(newUser);


    // ========================================================
    // إعادة النتيجة كما هي
    // ========================================================

    return result;


  } catch (error) {

    console.error(
      "Register Service Error:",
      error
    );


    return {

      status: "error",

      message:
        error?.message ||
        "حدث خطأ أثناء إنشاء الحساب."

    };

  }

}
=======
// ============================================================
// REGISTER SERVICE
// Firebase Firestore
// ============================================================

// استخدام خدمة API المركزية بدلاً من الاتصال بـ Firestore مباشرة
import {
  registerUserApi
} from "../../services/api.js";


/**
 * خدمة تسجيل مستخدم جديد
 *
 * جميع عمليات Firebase الخاصة بالمستخدمين
 * تتم من خلال services/api.js
 *
 * @param {Object} userData بيانات المستخدم من نموذج التسجيل
 * @returns {Promise<Object>} نتيجة التسجيل
 */
export async function register(userData = {}) {

  try {

    // ========================================================
    // تنظيف البيانات
    // ========================================================

    const name =
      String(userData.name || "").trim();

    const phone =
      String(userData.phone || "").trim();

    const password =
      String(userData.password || "").trim();

    const confirmPassword =
      String(userData.confirmPassword || "").trim();

    const shift =
      String(userData.shift || "").trim();

    const job =
      String(userData.job || "").trim();

    const department =
      String(userData.department || "").trim();

    const code =
      String(userData.code || "").trim();


    // ========================================================
    // التحقق من البيانات الأساسية
    // ========================================================

    if (
      !name ||
      !phone ||
      !password ||
      !confirmPassword ||
      !shift ||
      !job ||
      !department ||
      !code
    ) {

      return {

        status: "error",

        message:
          "يرجى إدخال جميع البيانات المطلوبة."

      };

    }


    // ========================================================
    // التحقق من كلمة السر
    // ========================================================

    if (password !== confirmPassword) {

      return {

        status: "error",

        message:
          "كلمتا السر غير متطابقتين."

      };

    }


    // ========================================================
    // تجهيز البيانات
    // ========================================================
    //
    // مهم:
    // لا نرسل confirmPassword إلى Firebase.
    //
    // الحساب يبدأ دائماً Pending.
    // الدور والصلاحيات يتم تحديدهما من API.
    //
    // ========================================================

    const newUser = {

      name,

      phone,

      password,

      shift,

      job,

      department,

      code

    };


    // ========================================================
    // إرسال التسجيل إلى API المركزي
    // ========================================================

    const result =
      await registerUserApi(newUser);


    // ========================================================
    // إعادة النتيجة كما هي
    // ========================================================

    return result;


  } catch (error) {

    console.error(
      "Register Service Error:",
      error
    );


    return {

      status: "error",

      message:
        error?.message ||
        "حدث خطأ أثناء إنشاء الحساب."

    };

  }

}
>>>>>>> 8551c80449c58483933317e7bb0aed7e151ac02e
