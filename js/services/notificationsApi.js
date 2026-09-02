// ============================================================
// notificationsApi.js
// إشعارات داخل التطبيق (In-App Notifications) - collection: notifications
// ============================================================

import { db } from "../config.js";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot
} from "../firebase.js";


/**
 * إنشاء إشعار لمستخدم معيّن (داخلية - تُستدعى من ticketsApi.js
 * عند كل انتقال حالة مهم في دورة حياة التذكرة)
 */
export async function createNotificationApi({ userId, title, message, ticketId }) {

  if (!userId) return { status: "error", message: "userId مطلوب" };

  try {

    await addDoc(collection(db, "notifications"), {
      userId,
      title: title || "",
      message: message || "",
      ticketId: ticketId || "",
      read: false,
      createdAt: new Date().toISOString()
    });

    return { status: "success" };

  } catch (error) {

    // إشعار فشل إنشاؤه مايوقفش دورة حياة التذكرة نفسها - بنسجّل
    // الخطأ بس في الكونسول (راجع نداءات هذه الدالة في ticketsApi.js)
    console.error("Error creating notification:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * جلب آخر إشعارات المستخدم الحالي (تُستخدم لعرض قائمة الجرس)
 */
export async function fetchMyNotificationsApi(userId, max = 30) {

  try {

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(max)
    );

    const querySnapshot = await getDocs(q);

    const items = [];
    querySnapshot.forEach(docSnap => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: items };

  } catch (error) {

    console.error("Error fetching notifications:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * تعليم إشعار واحد كمقروء
 */
export async function markNotificationReadApi(notificationId) {

  try {

    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return { status: "success" };

  } catch (error) {

    console.error("Error marking notification as read:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * الاشتراك اللحظي (Realtime) في عدد الإشعارات غير المقروءة -
 * تُستخدم في NotificationBell.js لتحديث الشارة (Badge) تلقائياً
 * بدون إعادة تحميل الصفحة
 *
 * @returns {Function} دالة لإلغاء الاشتراك (unsubscribe)
 */
export function subscribeToUnreadCount(userId, onCountChange) {

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );

  return onSnapshot(
    q,
    snapshot => onCountChange(snapshot.size),
    error => {
      console.error("Error subscribing to unread notifications:", error);
      onCountChange(0);
    }
  );

}
