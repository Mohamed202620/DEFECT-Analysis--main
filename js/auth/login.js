// استيراد قاعدة البيانات من ملف الإعدادات المركزي
import { db } from '../../config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/**
 * خدمة تسجيل الدخول عبر Firebase Firestore
 * @param {string} phone - رقم الموبايل
 * @param {string} pass - كلمة السر
 * @returns {Promise<Object>} - نتيجة عملية تسجيل الدخول
 */
export async function login(phone, pass) {
  // 1. تنظيف البيانات
  const cleanPhone = phone?.trim();
  const cleanPass = pass?.trim();

  // 2. التحقق من المدخلات بعد التنظيف
  if (!cleanPhone || !cleanPass) {
    return {
      status: "error",
      message: "يرجى إدخال رقم الموبايل وكلمة السر بشكل صحيح."
    };
  }

  try {
    // البحث عن المستخدم برقم الموبايل في مجموعة users
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", cleanPhone));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        status: "error",
        message: "رقم الموبايل غير مسجل بالنظام."
      };
    }

    let userData = null;
    querySnapshot.forEach((docSnap) => {
      userData = { id: docSnap.id, ...docSnap.data() };
    });

    // التحقق من صحة كلمة السر (مقارنة مباشرة أو يمكنك مطابقتها حسب تخزينك لها)
    if (userData.password !== cleanPass) {
      return {
        status: "error",
        message: "كلمة السر غير صحيحة."
      };
    }

    // تسجيل الدخول ناجح
    return {
      status: "success",
      user: userData
    };

  } catch (error) {
    console.error("Login Service Error:", error);
    return {
      status: "error",
      message: "حدث خطأ أثناء الاتصال بقاعدة البيانات، يرجى المحاولة مجدداً."
    };
  }
}
