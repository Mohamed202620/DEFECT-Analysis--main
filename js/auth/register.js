// استيراد قاعدة البيانات من ملف الإعدادات المركزي
import { db } from '../../config.js';
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/**
 * خدمة تسجيل مستخدم جديد عبر Firebase Firestore
 * @param {Object} userData - بيانات المستخدم المرسلة من النموذج
 * @returns {Promise<Object>} - نتيجة عملية التسجيل
 */
export async function register(userData) {
  try {
    const cleanPhone = userData.phone?.trim();
    
    if (!cleanPhone || !userData.password) {
      return {
        status: "error",
        message: "يرجى إدخال رقم الهاتف وكلمة السر على الأقل."
      };
    }

    // 1. التحقق مسبقاً إذا كان رقم الهاتف مسجلاً من قبل
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", cleanPhone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return {
        status: "error",
        message: "رقم الهاتف مسجل بالفعل، يرجى استخدام رقم آخر أو تسجيل الدخول."
      };
    }

    // 2. إضافة المستخدم الجديد إلى مجموعة users مع وقت الإنشاء والصلاحيات الافتراضية
    const docRef = await addDoc(usersRef, {
      ...userData,
      phone: cleanPhone,
      role: "user", // الصلاحية الافتراضية
      createdAt: new Date().toISOString()
    });

    return {
      status: "success",
      message: "تم إنشاء الحساب بنجاح!",
      id: docRef.id
    };

  } catch (error) {
    console.error("Register Service Error:", error);
    return {
      status: "error",
      message: "حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مجدداً."
    };
  }
}
