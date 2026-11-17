// ============================================================
// userActivityApi.js
// نظام متابعة نشاط المستخدمين (Heartbeat + Presence)
// للـ Admin فقط - مع حماية Firestore Rules
// ============================================================

import { isAdminRole, getCurrentRole } from "../permissions.js";
import {
  db,
  auth,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "../providers/backend/index.js";

// إعدادات الـ Heartbeat
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // كل 30 ثانية
const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // غير متصل بعد دقيقتين
const ACTIVITY_COLLECTION = "userActivity";
const MAX_ACTIVITY_DOCS_PER_USER = 1; // مستند واحد لكل مستخدم (آخر نشاط)

// متغيرات داخلية لإدارة الـ Heartbeat
let heartbeatInterval = null;
let isHeartbeatActive = false;
let lastHeartbeatSent = 0;
let networkOnline = true;
let activityUnsubscribe = null;

// ============================================================
// دوال مساعدة
// ============================================================

/** التحقق مما إذا كان المستخدم الحالي Admin */
function isCurrentUserAdmin() {
  return isAdminRole(getCurrentRole());
}

/** الحصول على معرف المستخدم الحالي */
function getCurrentUserId() {
  return auth.currentUser?.uid || localStorage.getItem("userId") || "";
}

/** الحصول على اسم المستخدم الحالي */
function getCurrentUserName() {
  return localStorage.getItem("name") || "";
}

/** التحقق من الاتصال بالإنترنت */
function checkNetworkOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

/** تنسيق التاريخ والوقت للعرض */
function formatLastSeen(timestamp) {
  if (!timestamp) return "غير معروف";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return "تنسيق غير صالح";
  }
}

// ============================================================
// نظام الـ Heartbeat (نبضات القلب)
// ============================================================

/**
 * إرسال نبضة قلب (تحديث آخر نشاط للمستخدم الحالي)
 * يتم استدعاؤها دورياً كل 30 ثانية
 */
async function sendHeartbeat() {
  if (!isCurrentUserAdmin() && !getCurrentUserId()) return;
  
  const userId = getCurrentUserId();
  if (!userId) return;

  const now = Date.now();
  
  // تجنب الإرسال المتكرر جداً (أقل من 25 ثانية)
  if (now - lastHeartbeatSent < 25000) return;
  
  // التحقق من الاتصال
  if (!checkNetworkOnline()) {
    networkOnline = false;
    return;
  }
  networkOnline = true;

  try {
    const activityRef = doc(db, ACTIVITY_COLLECTION, userId);
    await setDoc(activityRef, {
      userId,
      userName: getCurrentUserName(),
      role: getCurrentRole(),
      lastActivity: serverTimestamp(),
      lastHeartbeat: serverTimestamp(),
      isOnline: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    lastHeartbeatSent = now;
  } catch (error) {
    console.warn("[UserActivity] Heartbeat failed:", error?.message);
    // لا نرمي الخطأ - الـ heartbeat يفشل بصمت ولا يؤثر على تجربة المستخدم
  }
}

/**
 * بدء نظام الـ Heartbeat
 */
export function startHeartbeat() {
  if (isHeartbeatActive) return;
  
  isHeartbeatActive = true;
  
  // إرسال فوري عند البدء
  sendHeartbeat();
  
  // تكرار كل 30 ثانية
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  
  // الاستماع لتغييرات الاتصال
  window.addEventListener("online", () => {
    networkOnline = true;
    sendHeartbeat();
  });
  
  window.addEventListener("offline", () => {
    networkOnline = false;
  });
  
  // عند إغلاق الصفحة/التطبيق - محاولة إرسال آخر نبضة
  // ملاحظة: لا يمكن ضمان تنفيذها دائماً (beforeunload غير موثوق)
  window.addEventListener("beforeunload", () => {
    if (navigator.sendBeacon) {
      // محاولة إرسال عبر sendBeacon (أكثر موثوقية عند الإغلاق)
      // لكننا نحتاج endpoint يدعم POST بدون CORS preflight
      // للتبسيط نعتمد على آخر نبضة مرسلة
    }
  });
}

/**
 * إيقاف نظام الـ Heartbeat
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  isHeartbeatActive = false;
}

/**
 * تعيين المستخدم كغير متصل (عند تسجيل الخروج)
 */
export async function markUserOffline(userId = null) {
  const uid = userId || getCurrentUserId();
  if (!uid) return;
  
  try {
    const activityRef = doc(db, ACTIVITY_COLLECTION, uid);
    await updateDoc(activityRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("[UserActivity] Mark offline failed:", error?.message);
  }
}

/**
 * التحقق مما إذا كان يجب إيقاف الـ heartbeat (مثلاً عند تسجيل الخروج)
 */
export function shouldStopHeartbeat() {
  return !auth.currentUser || !getCurrentUserId();
}

// ============================================================
// واجهة الـ Admin: جلب بيانات النشاط
// ============================================================

/**
 * جلب نشاط جميع المستخدمين (للـ Admin فقط)
 * @returns {Promise<{status: string, data?: Array, message?: string}>}
 */
export async function fetchAllUserActivity() {
  if (!isCurrentUserAdmin()) {
    return { status: "error", message: "صلاحيات غير كافية" };
  }

  try {
    const activityQuery = query(
      collection(db, ACTIVITY_COLLECTION),
      orderBy("lastActivity", "desc")
    );
    
    const snapshot = await getDocs(activityQuery);
    const users = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const lastActivity = data.lastActivity;
      const lastHeartbeat = data.lastHeartbeat;
      const isOnline = data.isOnline === true;
      
      // حساب حالة الاتصال: متصل إذا كان آخر heartbeat خلال دقيقتين
      let computedOnline = false;
      let lastSeenTime = null;
      
      if (lastHeartbeat) {
        const hbTime = lastHeartbeat.toDate ? lastHeartbeat.toDate().getTime() : new Date(lastHeartbeat).getTime();
        lastSeenTime = hbTime;
        computedOnline = (Date.now() - hbTime) < OFFLINE_THRESHOLD_MS;
      } else if (lastActivity) {
        const actTime = lastActivity.toDate ? lastActivity.toDate().getTime() : new Date(lastActivity).getTime();
        lastSeenTime = actTime;
        computedOnline = (Date.now() - actTime) < OFFLINE_THRESHOLD_MS;
      }
      
      // الحالة النهائية: متصل = true فقط إذا كان isOnline=true في قاعدة البيانات 
      // و lastHeartbeat حديث (خلال دقيقتين)
      const finalOnline = isOnline && computedOnline;
      
      users.push({
        id: docSnap.id,
        userId: data.userId,
        userName: data.userName || "غير معروف",
        role: data.role || "user",
        isOnline: finalOnline,
        lastSeen: lastSeenTime,
        lastSeenFormatted: formatLastSeen({ toDate: () => new Date(lastSeenTime) }),
        rawLastActivity: lastActivity,
        rawLastHeartbeat: lastHeartbeat
      });
    }
    
    return { status: "success", data: users };
  } catch (error) {
    console.error("[UserActivity] Fetch all activity failed:", error);
    return { status: "error", message: error?.message || "فشل جلب بيانات النشاط" };
  }
}

/**
 * جلب عدد المستخدمين المتصلين حالياً
 */
export async function getOnlineUsersCount() {
  const result = await fetchAllUserActivity();
  if (result.status !== "success") return 0;
  return result.data.filter(u => u.isOnline).length;
}

/**
 * مراقبة تغييرات النشاط في الوقت الفعلي (للـ Admin)
 * @param {Function} callback - دالة تستدعى عند كل تغيير
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function subscribeToUserActivity(callback) {
  if (!isCurrentUserAdmin()) {
    return () => {};
  }
  
  const activityQuery = query(
    collection(db, ACTIVITY_COLLECTION),
    orderBy("lastActivity", "desc")
  );
  
  activityUnsubscribe = onSnapshot(activityQuery, (snapshot) => {
    const users = [];
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" || change.type === "modified") {
        const data = change.doc.data();
        users.push({ id: change.doc.id, ...data });
      }
    });
    if (users.length > 0) callback(users);
  }, (error) => {
    console.warn("[UserActivity] Subscription error:", error?.message);
  });
  
  return () => {
    if (activityUnsubscribe) {
      activityUnsubscribe();
      activityUnsubscribe = null;
    }
  };
}

// ============================================================
// تنظيف البيانات القديمة (اختياري - يمكن استدعاؤها من Cloud Function)
// ============================================================

/**
 * تنظيف سجلات النشاط القديمة (أكبر من 30 يوم)
 * ملاحظة: يتم استدعاؤها يدوياً أو عبر Cloud Function مجدولة
 */
export async function cleanupOldActivity(daysToKeep = 30) {
  if (!isCurrentUserAdmin()) {
    return { status: "error", message: "صلاحيات غير كافية" };
  }
  
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  try {
    const activityQuery = query(
      collection(db, ACTIVITY_COLLECTION),
      where("lastActivity", "<", new Date(cutoffTime))
    );
    
    const snapshot = await getDocs(activityQuery);
    let deleted = 0;
    
    for (const docSnap of snapshot.docs) {
      // لا نحذف المستند بالكامل، فقط نمسح البيانات القديمة
      // أو يمكننا الحذف إذا كان المستخدم غير نشط لفترة طويلة
      const data = docSnap.data();
      if (!data.isOnline) {
        await docSnap.ref.delete();
        deleted++;
      }
    }
    
    return { status: "success", deleted };
  } catch (error) {
    console.error("[UserActivity] Cleanup failed:", error);
    return { status: "error", message: error?.message };
  }
}

// ============================================================
// تهيئة تلقائية عند تحميل التطبيق (للعملاء العاديين)
// ============================================================

/**
 * تهيئة نظام النشاط - يتم استدعاؤها من authHandlers بعد تسجيل الدخول
 */
export function initUserActivity() {
  // للمستخدمين العاديين: نرسل heartbeat لكنهم لا يرون بيانات الآخرين
  // للـ Admin: نرسل heartbeat + نبدأ المراقبة
  if (auth.currentUser && getCurrentUserId()) {
    startHeartbeat();
  }
  
  // مراقبة تغييرات حالة المصادقة
  const unsubscribe = auth.onAuthStateChanged?.((user) => {
    if (user) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  });
  
  return () => {
    stopHeartbeat();
    if (unsubscribe) unsubscribe();
  };
}

export { HEARTBEAT_INTERVAL_MS, OFFLINE_THRESHOLD_MS, ACTIVITY_COLLECTION };
