// استيراد قاعدة البيانات من ملف الإعدادات المركزي
import { db } from '../config.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/* ==========================================================================
   دوال التعامل مع المستخدمين والحسابات (عبر Firebase Firestore)
   ========================================================================== */

/** جلب قائمة المستخدمين */
export async function fetchUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    let users = [];
    querySnapshot.forEach((docSnap) => {
      users.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { status: "error", message: error.message };
  }
}

/** تسجيل مستخدم جديد */
export async function registerUserApi(userData) {
  try {
    const docRef = await addDoc(collection(db, "users"), userData);
    return { status: "success", id: docRef.id };
  } catch (error) {
    console.error("Error registering user:", error);
    return { status: "error", message: error.message };
  }
}

/** تحديث صلاحيات وأدوار المستخدمين */
export async function updatePermissionsApi(userId, role, permissions) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { role, permissions });
    return { status: "success" };
  } catch (error) {
    console.error("Error updating permissions:", error);
    return { status: "error", message: error.message };
  }
}

/* ==========================================================================
   دوال الأعطال والعيوب (Maintenance & Defects) عبر Firestore
   ========================================================================== */

/** حفظ بلاغ عطل أو عيب جودة جديد */
export async function saveDefectApi(payload) {
  try {
    const docRef = await addDoc(collection(db, "defects"), {
      ...payload,
      createdAt: new Date().toISOString()
    });
    return { status: "success", id: docRef.id };
  } catch (error) {
    console.error("Error saving defect:", error);
    return { status: "error", message: error.message };
  }
}

/** جلب بيانات لوحة المتابعة الإحصائية */
export async function fetchDashboardDataApi() {
  try {
    // يمكنك هنا جلب الإحصائيات من المجموعات المختلفة في Firestore
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
    return { status: "error", message: error.message };
  }
}

/** جلب قائمة التذاكر/البلاغات */
export async function fetchTicketsApi(filters = {}) {
  try {
    const querySnapshot = await getDocs(collection(db, "tickets"));
    let tickets = [];
    querySnapshot.forEach((docSnap) => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: tickets };
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return { status: "error", message: error.message };
  }
}

/** تحديث حالة تذكرة عطل */
export async function updateTicketStatusApi(ticketId, status, notes = "") {
  try {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, { status, notes, updatedAt: new Date().toISOString() });
    return { status: "success" };
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return { status: "error", message: error.message };
  }
}
