// ============================================================
// API SERVICE v2
// Firebase Firestore
// ============================================================

import {
  db,
  DEFAULT_USER_PERMISSIONS // اتأكد ان ده = "all,users,system,maintenance,issue,quality,pm,reports,suggestions,requests"
} from "../config.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// ============================================================
// USERS
// ============================================================
export async function fetchUsers() {
  try {
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);
    const users = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const { password, ...safeData } = data;
      users.push({
        id: docSnap.id,
        ...safeData,
        status: (data.status || "").trim(),
        role: (data.role || "").trim(),
        permissions: (data.permissions || "").trim()
      });
    });
    users.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return { status: "success", data: users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// REGISTER USER
// ============================================================
export async function registerUserApi(userData) {
  try {
    const phone = String(userData.phone || "").trim();
    if (phone) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return { status: "error", message: "رقم الهاتف مسجل بالفعل." };
      }
    }
    const docRef = await addDoc(collection(db, "users"), {
      ...userData,
      role: "pending",
      permissions: "",
      status: "pending",
      createdAt: new Date().toISOString()
    });
    return { status: "success", id: docRef.id, message: "تم إرسال طلب التسجيل، بانتظار موافقة المسؤول" };
  } catch (error) {
    console.error("Error registering user:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// UPDATE USER PERMISSIONS
// ============================================================
export async function updatePermissionsApi(userId, role, permissions) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      role,
      permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    });
    return { status: "success", message: "تم تحديث الصلاحيات" };
  } catch (error) {
    console.error("Error updating permissions:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// UPDATE USER STATUS - التعديل المهم هنا
// ============================================================
export async function updateUserStatusApi(userId, status) {
  try {
    const userRef = doc(db, "users", userId);
    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    };

    if (status === "active") {
      updateData.role = "technician"; 
      // الحل: لو DEFAULT_USER_PERMISSIONS فاضي اديله صلاحيات افتراضية
      updateData.permissions = DEFAULT_USER_PERMISSIONS || "all,maintenance,issue,pm,quality,reports,suggestions,requests"; 
      updateData.approvedAt = new Date().toISOString();
      updateData.approvedBy = localStorage.getItem("name") || "Admin";
    }

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
    return { status: "error", message: error.message };
  }
}

// ============================================================
// DASHBOARD - دوال جديدة للكروت
// ============================================================
export async function getDashboardStatsApi() {
  try {
    const [ticketsSnap, defectsSnap, pmSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "tickets")),
      getDocs(collection(db, "defects")),
      getDocs(collection(db, "pm_tasks")),
      getDocs(collection(db, "users"))
    ]);

    const openTickets = ticketsSnap.docs.filter(d => d.data().status === 'open').length;
    const activePM = pmSnap.docs.filter(d => d.data().status === 'active').length;

    return {
      status: "success",
      data: {
        openIssues: openTickets,
        pmTasks: activePM,
        qualityScore: 94.2, // دي هنحسبها بعدين
        usersCount: usersSnap.size
      }
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { status: "error", message: error.message, data: {openIssues: 0, pmTasks: 0, qualityScore: 0, usersCount: 0} };
  }
}

// ============================================================
// الباقي كما هو...
// ============================================================
export async function saveDefectApi(payload) { /* ... */ }
export async function fetchDashboardDataApi() { /* ... */ }
export async function fetchTicketsApi()
