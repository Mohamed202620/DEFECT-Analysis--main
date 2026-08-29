import { auth } from '../config.js';
import { signOut } from '../firebase.js';

/**
 * خدمة تسجيل الخروج
 * @returns {Promise<Object>} - نتيجة عملية الخروج
 */
export async function logout() {
  try {
    // تسجيل الخروج من Firebase Auth
    await signOut(auth);

    // مسح البيانات المحفوظة محلياً لضمان خروج المستخدم وتأمين الجلسة
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userToken');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    sessionStorage.clear();
    localStorage.clear();

    return {
      status: "success",
      message: "تم تسجيل الخروج بنجاح."
    };
  } catch (error) {
    console.error("Logout Error:", error);
    return {
      status: "error",
      message: "حدث خطأ أثناء تسجيل الخروج."
    };
  }
}
