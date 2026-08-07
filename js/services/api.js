// استيراد قاعدة البيانات من ملف الإعدادات المركزي
import { db } from '../config.js';

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* ==========================================================================
   دوال التعامل مع المستخدمين والحسابات (Firebase Firestore)
   ========================================================================== */


/** جلب قائمة المستخدمين */
export async function fetchUsers() {

  try {

    const querySnapshot = await getDocs(collection(db, "users"));

    let users = [];

    querySnapshot.forEach((docSnap) => {

      users.push({
        id: docSnap.id,
        ...docSnap.data()
      });

    });


    return {
      status: "success",
      data: users
    };


  } catch (error) {

    console.error("Error fetching users:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}



/** تسجيل مستخدم جديد */
export async function registerUserApi(userData) {

  try {

    const docRef = await addDoc(collection(db, "users"), {

      ...userData,

      // الحساب ينتظر موافقة المدير
      role: "pending",
      permissions: "",
      status: "pending",

      createdAt: new Date().toISOString()

    });


    return {

      status: "success",
      id: docRef.id,
      message: "تم إرسال طلب التسجيل، بانتظار موافقة المسؤول"

    };


  } catch (error) {

    console.error("Error registering user:", error);


    return {

      status: "error",
      message: error.message

    };

  }

}



/** تحديث صلاحيات وأدوار المستخدمين */
export async function updatePermissionsApi(
  userId,
  role,
  permissions
) {

  try {

    const userRef = doc(db, "users", userId);


    await updateDoc(userRef, {

      role,
      permissions

    });


    return {

      status: "success",
      message: "تم تحديث الصلاحيات"

    };


  } catch (error) {


    console.error("Error updating permissions:", error);


    return {

      status: "error",
      message: error.message

    };

  }

}



/**
 * قبول أو رفض طلب تسجيل المستخدم
 *
 * active    = قبول
 * rejected  = رفض
 */
export async function updateUserStatusApi(
  userId,
  status
) {

  try {


    const userRef = doc(db, "users", userId);


    let updateData = {

      status,

      updatedAt: new Date().toISOString()

    };



    // عند القبول يتم تفعيل الحساب
    if (status === "active") {

      updateData.role = "tech";

      updateData.permissions =
        "report,issue,log";

    }



    // عند الرفض
    if (status === "rejected") {

      updateData.role = "pending";

      updateData.permissions = "";

    }



    await updateDoc(
      userRef,
      updateData
    );


    return {

      status: "success",
      message:
        status === "active"
          ? "تم قبول المستخدم وتفعيل الحساب"
          : "تم رفض طلب المستخدم"

    };


  } catch (error) {


    console.error(
      "Error updating user status:",
      error
    );


    return {

      status: "error",
      message: error.message

    };

  }

}



/* ==========================================================================
   دوال الأعطال والعيوب (Maintenance & Defects)
   ========================================================================== */


/** حفظ بلاغ عطل أو عيب */
export async function saveDefectApi(payload) {

  try {


    const docRef = await addDoc(
      collection(db, "defects"),
      {

        ...payload,

        createdAt:
          new Date().toISOString()

      }
    );


    return {

      status: "success",
      id: docRef.id

    };


  } catch (error) {


    console.error(
      "Error saving defect:",
      error
    );


    return {

      status: "error",
      message: error.message

    };

  }

}



/** بيانات لوحة المتابعة */
export async function fetchDashboardDataApi() {

  try {


    const ticketsSnap =
      await getDocs(
        collection(db, "tickets")
      );


    const defectsSnap =
      await getDocs(
        collection(db, "defects")
      );


    return {

      status: "success",

      data: {

        openTicketsCount:
          ticketsSnap.size,

        defectsCount:
          defectsSnap.size

      }

    };


  } catch (error) {


    console.error(
      "Error fetching dashboard data:",
      error
    );


    return {

      status: "error",
      message: error.message

    };

  }

}



/** جلب التذاكر */
export async function fetchTicketsApi() {

  try {


    const querySnapshot =
      await getDocs(
        collection(db, "tickets")
      );


    let tickets = [];


    querySnapshot.forEach(
      (docSnap)=>{

        tickets.push({

          id: docSnap.id,

          ...docSnap.data()

        });

      }
    );



    return {

      status: "success",
      data: tickets

    };


  } catch (error) {


    return {

      status: "error",
      message: error.message

    };

  }

}



/** تحديث حالة التذكرة */
export async function updateTicketStatusApi(
  ticketId,
  status,
  notes = ""
) {

  try {


    const ticketRef =
      doc(db,"tickets",ticketId);



    await updateDoc(
      ticketRef,
      {

        status,

        notes,

        updatedAt:
          new Date().toISOString()

      }
    );



    return {

      status:"success"

    };


  } catch(error) {


    return {

      status:"error",
      message:error.message

    };

  }

}
