// استيراد رابط السيرفر من ملف الإعدادات
import { GOOGLE_SCRIPT_URL } from '../config.js';

/**
 * دالة عامة لإرسال طلبات POST إلى Google Apps Script
 * @param {Object} payload - البيانات المراد إرسالها
 * @returns {Promise<Object>} - الاستجابة بصيغة JSON
 */
export async function apiRequest(payload) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain" // مطلوب أحياناً لتجنب قيود CORS مع Google Apps Script
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API Request Error:", error);
    return {
      status: "error",
      message: "تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت."
    };
  }
}

/**
 * جلب قائمة المستخدمين
 */
export async function fetchUsers() {
  return await apiRequest({ action: "getUsers" });
}

/**
 * تحديث صلاحيات وأدوار المستخدمين
 */
export async function updatePermissionsApi(phone, role, permissions) {
  return await apiRequest({
    action: "updatePermissions",
    phone: phone,
    role: role,
    permissions: permissions
  });
}

/**
 * تسجيل مستخدم جديد
 */
export async function registerUserApi(userData) {
  return await apiRequest({
    action: "register",
    ...userData
  });
}
console.log("✅ api.js loaded");
