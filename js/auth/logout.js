<<<<<<< HEAD
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
=======
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
>>>>>>> 8551c80449c58483933317e7bb0aed7e151ac02e
