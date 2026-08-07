// استيراد قاعدة البيانات والثوابت من ملف الإعدادات المركزي
import { db, DEFAULT_USER_PERMISSIONS } from '../config.js';

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/* ==========================================================================
   دوال التعامل مع المستخدمين والحسابات (Firebase Firestore)
   ========================================================================== */

/** جلب قائمة المستخدمين */
export async function fetchUsers() {
  try {
    // التعديل 5: جلب البيانات مرتبة من الأحدث للأقدم
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    let users = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // التعديل 1: عزل كلمة السر حتى لا تصل إلى واجهة الإدارة
      const { password, ...safeData } = data;

      users.push({
        id: docSnap.id,
        ...safeData,
        status: (data.status || "").trim(),
        role: (data.role || "").trim(),
        permissions: (data.permissions || "").trim()
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
    const phone = String(userData.phone || "").trim();

    // التعديل 2: التحقق من عدم وجود حساب مسبق بنفس رقم الهاتف
    if (phone) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return {
          status: "error",
          message: "رقم الهاتف مسجل بالفعل."
        };
      }
    }

    const docRef = await addDoc(collection(db, "users"), {
      ...userData,
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
export async function updatePermissionsApi(userId, role, permissions) {
  try {
    const userRef = doc(db, "users", userId);

    await updateDoc(userRef, {
      role,
      permissions,
      updatedAt: new Date().toISOString(),
      // التعديل 4: تسجيل من قام بالتعديل
      updatedBy: localStorage.getItem("name") || "Admin"
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
 * active    = قبول
 * rejected  = رفض
 */
export async function updateUserStatusApi(userId, status) {
  try {
    const userRef = doc(db, "users", userId);

    let updateData = {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    };

    // قبول المستخدم
    if (status === "active") {
      updateData.role = "user";
      // التعديل 3: استخدام الثابت الموحد للصلاحيات
      updateData.permissions = DEFAULT_USER_PERMISSIONS; 
      updateData.approvedAt = new Date().toISOString();
      updateData.approvedBy = localStorage.getItem("name") || "Admin";
    }

    // رفض المستخدم
    if (status === "rejected") {
      updateData.role = "pending";
      updateData.permissions = "";
    }

    await updateDoc(userRef, updateData);

    return {
      status: "success",
      message: status === "active" ? "تم قبول المستخدم وتفعيل الحساب" : "تم رفض طلب المستخدم"
    };

  } catch (error) {
    console.error("Error updating user status:", error);
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
    const docRef = await addDoc(collection(db, "defects"), {
      ...payload,
      createdAt: new Date().toISOString()
    });

    return {
      status: "success",
      id: docRef.id
    };

  } catch (error) {
    console.error("Error saving defect:", error);
    return {
      status: "error",
      message: error.message
    };
  }
}


/** بيانات لوحة المتابعة */
export async function fetchDashboardDataApi() {
  try {
    const ticketsSnap = await getDocs(collection(db, "tickets"));
    const defectsSnap = await getDocs(collection(db, "defects"));

    return {
      status: "success",
      data: {
        openTicketsCount: ticketsSnap.size,
        defectsCount: defectsSnap.size
      }
    };

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      status: "error",
      message: error.message
    };
  }
}


/** جلب التذاكر */
export async function fetchTicketsApi() {
  try {
    // التعديل 5: جلب التذاكر مرتبة من الأحدث للأقدم
    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    let tickets = [];

    querySnapshot.forEach((docSnap) => {
      tickets.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

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
export async function updateTicketStatusApi(ticketId, status, notes = "") {
  try {
    const ticketRef = doc(db, "tickets", ticketId);

    await updateDoc(ticketRef, {
      status,
      notes,
      updatedAt: new Date().toISOString(),
      // التعديل 4: تسجيل من قام بالتعديل على التذكرة
      updatedBy: localStorage.getItem("name") || ""
    });

    return {
      status: "success"
    };

  } catch (error) {
    return {
      status: "error",
      message: error.message
    };
  }
}
