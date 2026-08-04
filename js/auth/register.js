// استيراد دالة الاتصال العامة
import { apiRequest } from '../services/api.js';

/**
 * خدمة إنشاء حساب جديد
 * @param {Object} userData - بيانات المستخدم
 * @returns {Promise<Object>} - نتيجة عملية التسجيل
 */
export async function register(userData) {
  const { name, phone, shift, password, job, department, code } = userData || {};

  // 1. التحقق من وجود جميع البيانات المطلوبة
  if (!name || !phone || !shift || !password || !job || !department || !code) {
    return {
      status: "error",
      message: "يرجى ملء كافة البيانات المطلوبة قبل الإرسال."
    };
  }

  // 2. إرسال البيانات للـ Backend مع معالجة الأخطاء
  try {
    const result = await apiRequest({
      action: "register", // مطابقة للـ Backend في Google Apps Script
      name: name.trim(),
      phone: phone.trim(),
      shift: shift.trim(),
      password: password.trim(),
      job: job.trim(),
      department: department.trim(),
      code: code.trim()
    });

    return result;

  } catch (error) {
    console.error("Register Service Error:", error);
    return {
      status: "error",
      message: "حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة لاحقاً."
    };
  }
}
