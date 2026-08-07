// استيراد قاعدة البيانات ومتغير DEBUG من ملف الإعدادات المركزي
import { db, DEBUG } from '../config.js'; 
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/**
 * خدمة تسجيل الدخول عبر Firebase Firestore
 */
export async function login(phone, pass) {

  // تحسين معالجة المدخلات لضمان عدم حدوث أخطاء حتى لو وصل كأرقام (Numbers)
  const cleanPhone = String(phone || "").trim();
  const cleanPass = String(pass || "").trim();

  if (!cleanPhone || !cleanPass) {
    return {
      status: "error",
      message: "يرجى إدخال رقم الموبايل وكلمة السر بشكل صحيح."
    };
  }

  try {

    const usersRef = collection(db, "users");

    const q = query(
      usersRef,
      where("phone", "==", cleanPhone)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        status: "error",
        message: "رقم الموبايل غير مسجل بالنظام."
      };
    }

    // منع الحسابات المكررة بنفس رقم الهاتف
    if (querySnapshot.size > 1) {
      return {
        status: "error",
        message: "يوجد أكثر من حساب بنفس رقم الهاتف."
      };
    }

    // تحسين الأداء: استدعاء المستند الأول مباشرة بدلاً من حلقة forEach
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    const userData = {
      id: docSnap.id,
      ...data,
      // إزالة أي مسافات زائدة
      status: (data.status || "").trim(),
      role: (data.role || "").trim()
    };

    // إظهار البيانات في وضع التطوير فقط
    if (DEBUG) {
      console.log("USER DATA:", userData);
    }

    // فحص كلمة السر
    if (userData.password !== cleanPass) {
      return {
        status: "error",
        message: "كلمة السر غير صحيحة."
      };
    }

    // فحص حالة الحساب (الترتيب المنطقي السليم)
    if (userData.status === "pending") {
      return {
        status: "error",
        message: "تم إرسال طلبك وهو بانتظار موافقة المسؤول."
      };
    }

    if (userData.status === "rejected") {
      return {
        status: "error",
        message: "تم رفض طلب الانضمام، يرجى التواصل مع المسؤول."
      };
    }

    if (userData.status !== "active") {
      return {
        status: "error",
        message: "الحساب غير مفعل."
      };
    }

    // حماية أمنية: حذف كلمة السر من الكائن قبل إرجاعه وحفظه في LocalStorage
    delete userData.password;

    return {
      status: "success",
      user: userData
    };

  } catch (error) {

    console.error("Login Service Error:", error);

    return {
      status: "error",
      message: "حدث خطأ أثناء الاتصال بقاعدة البيانات."
    };

  }
}
