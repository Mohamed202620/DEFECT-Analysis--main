/**
 * خدمة تسجيل الخروج
 * @returns {Promise<Object>} - نتيجة عملية الخروج
 */
export async function logout() {
  try {
    // مسح البيانات المحفوظة محلياً لضمان خروج المستخدم وتأمين الجلسة
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userToken');
    sessionStorage.clear();

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
