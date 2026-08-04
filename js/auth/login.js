// استيراد دالة الاتصال العامة
import { apiRequest } from '../services/api.js';

/**
 * خدمة تسجيل الدخول
 * @param {string} phone - رقم الموبايل
 * @param {string} pass - كلمة السر
 * @returns {Promise<Object>} - نتيجة عملية تسجيل الدخول
 */
export async function login(phone, pass) {
  // 1. تنظيف البيانات (إزالة المسافات الزائدة من البداية والنهاية)
  const cleanPhone = phone?.trim();
  const cleanPass = pass?.trim();

  // 2. التحقق من المدخلات بعد التنظيف
  if (!cleanPhone || !cleanPass) {
    return {
      status: "error",
      message: "يرجى إدخال رقم الموبايل وكلمة السر بشكل صحيح."
    };
  }

  // 3. إرسال الطلب مع معالجة الأخطاء المحتملة للشبكة
  try {
    const result = await apiRequest({
      action: "login", // تأكد من مطابقتها للـ Backend في Google Apps Script
      phone: cleanPhone,
      password: cleanPass
    });

    return result;

  } catch (error) {
    console.error("Login Service Error:", error);
    
    // إرجاع كائن خطأ موحد ليتعامل معه الـ Controller أو הـ View
    return {
      status: "error",
      message: "حدث خطأ أثناء الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً."
    };
  }
}
