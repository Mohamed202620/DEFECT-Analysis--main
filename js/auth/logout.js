// استيراد دالة الاتصال العامة
import { apiRequest } from '../services/api.js';

/**
 * خدمة تسجيل الخروج
 * @returns {Promise<Object>} - نتيجة عملية الخروج
 */
export async function logout() {
  try {
    // 1. محاولة إبلاغ السيرفر بإنهاء الجلسة (اختياري حسب الـ Backend)
    await apiRequest({
      action: "logout"
    });
  } catch (error) {
    console.warn("Logout request to server failed, proceeding with local cleanup:", error);
  } finally {
    // 2. مسح البيانات المحفوظة محلياً لضمان خروج المستخدم دائماً
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userToken');
    sessionStorage.clear();
  }

  return {
    status: "success",
    message: "تم تسجيل الخروج بنجاح."
  };
}
