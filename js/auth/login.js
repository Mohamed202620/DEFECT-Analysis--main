// استيراد قاعدة البيانات من ملف الإعدادات المركزي
import { db } from '../config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/**
 * خدمة تسجيل الدخول عبر Firebase Firestore
 */
export async function login(phone, pass) {

  const cleanPhone = phone?.trim();
  const cleanPass = pass?.trim();

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


    let userData = null;


    querySnapshot.forEach((docSnap) => {

      const data = docSnap.data();

      userData = {
        id: docSnap.id,
        ...data,

        // إزالة أي مسافات زائدة
        status: (data.status || "").trim(),
        role: (data.role || "").trim()
      };

    });


    console.log("USER DATA:", userData);



    // فحص كلمة السر
    if (userData.password !== cleanPass) {

      return {
        status: "error",
        message: "كلمة السر غير صحيحة."
      };

    }



    // فحص حالة الحساب
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
