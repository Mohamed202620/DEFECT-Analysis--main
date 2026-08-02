// استيراد دالة الاتصال العامة
import { apiRequest } from '../services/api.js';

/**
 * خدمة تسجيل الدخول
 * @param {string} phone - رقم الموبايل
 * @param {string} pass - كلمة السر
 * @returns {Promise<Object>} - نتيجة عملية تسجيل الدخول
 */
export async function login(phone, pass) {
  if (!phone || !pass) {
    return {
      status: "error",
      message: "أدخل رقم الموبايل وكلمة السر"
    };
  }

  // إرسال طلب تسجيل الدخول للسيرفر
  const result = await apiRequest({
    action: "login", // تأكد من مطابقتها للـ Backend في Google Apps Script
    phone: phone,
    password: pass
  });

  return result;
}
console.log("✅ login.js loaded");
