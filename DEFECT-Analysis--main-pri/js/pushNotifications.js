// ============================================================
// pushNotifications.js
// إشعارات المتصفح (Browser Notifications) - بديل عملي لـ Push
// الحقيقي (FCM) بدون أي حاجة لسيرفر خارجي أو مفتاح سري (المشروع
// Static بالكامل، ومفتاح FCM السري ممنوع يكون في كود المتصفح).
//
// الفكرة: نظام الإشعارات الحقيقي (collection "notifications" في
// Firestore) كان موجود بالفعل ومربوط بالكامل عبر services/ticketsApi.js
// (createNotification عند كل حدث في دورة حياة التذكرة/المقترح)، وكان
// عنده حتى دالة اشتراك لحظي جاهزة (subscribeToMyNotificationsApi) -
// لكنها مكانتش مستخدمة في أي مكان بالتطبيق فعلياً! كل عرض للإشعارات
// كان Polling يدوي (fetchMyNotificationsApi) بيحصل بس لحظة فتح نافذة
// الإشعارات أو التنقل بين الصفحات (renderCore.js) - يعني المستخدم
// لازم يكون فاتح صفحة/نافذة بعينها عشان "يلاحظ" وصول إشعار جديد.
//
// هذا الملف بيفعّل نفس الاشتراك اللحظي الموجود بالفعل على مستوى
// التطبيق كله (مش صفحة بعينها)، وبيعرض أي إشعار جديد فعلاً (مش
// موجود قبل كده في نفس الجلسة) كـ Browser Notification حقيقي عبر
// Service Worker (sw.js) - بيفضل شغال طول ما المتصفح/التطبيق شغال
// في الخلفية (حتى لو مش الـ Tab النشط دلوقتي أو التطبيق مُصغّر).
//
// ⚠️ حد مهم لازم يكون واضح: ده مش نفس قوة Push الحقيقي عبر FCM -
// لازم المتصفح يكون شغال أصلاً (Process مفتوح)، وده غير ممكن تقنياً
// بدون سيرفر خارجي يحمل مفتاح FCM السري. تحسين حقيقي وملموس عن
// الوضع الحالي، مش بديل كامل لـ Push الحقيقي.
// ============================================================

import { subscribeToMyNotificationsApi, markNotificationReadApi } from './services/api.js';

const SEEN_IDS_KEY_PREFIX = "pushNotif_seenIds_";
const MAX_STORED_SEEN_IDS = 200;

let unsubscribeFn = null;

const NOTIFICATION_ICONS = {
  assigned: "🛠️",
  resolved: "✅",
  closed: "✔️",
  rejected: "❌",
  under_review: "👀",
  revision_requested: "✏️",
  in_progress: "⚙️",
  implemented: "🎉"
};

function getSeenIdsKey(uid) {
  return SEEN_IDS_KEY_PREFIX + uid;
}

function loadSeenIds(uid) {
  try {
    const raw = localStorage.getItem(getSeenIdsKey(uid));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(uid, idsSet) {
  try {
    // نحتفظ بآخر MAX_STORED_SEEN_IDS معرّف بس عشان حجم التخزين في
    // localStorage مايكبرش من غير داعي مع الوقت (الإشعارات القديمة
    // مش محتاجين نفتكرها للأبد، بس آخر شوية كفاية لتفادي التكرار)
    const arr = Array.from(idsSet).slice(-MAX_STORED_SEEN_IDS);
    localStorage.setItem(getSeenIdsKey(uid), JSON.stringify(arr));
  } catch {
    // تجاهل أي خطأ تخزين (مساحة ممتلئة مثلاً) - مش حرج لوظيفة الإشعار
  }
}

async function showBrowserNotification(notification) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const icon = NOTIFICATION_ICONS[notification.type] || "🔔";
    await reg.showNotification(`${icon} نظام إدارة الصيانة`, {
      body: notification.message || "",
      icon: "./assets/icons/app-icon.png",
      badge: "./assets/icons/app-icon.png",
      // نفس معرّف الإشعار كـ tag - يمنع ظهور نفس الإشعار مكرر لو
      // لأي سبب وصل الـ Snapshot مرتين
      tag: notification.id,
      data: {
        notificationId: notification.id,
        ticketId: notification.ticketId || "",
        suggestionId: notification.suggestionId || ""
      }
    });
  } catch (error) {
    console.error("Error showing browser notification:", error);
  }
}

/**
 * بدء الاشتراك اللحظي في إشعارات المستخدم الحالي (من localStorage)
 * وعرض أي إشعار جديد فعلاً (مش موجود قبل كده في نفس الجلسة/الجهاز)
 * كـ Browser Notification. آمنة تُستدعى أكتر من مرة - بتلغي أي
 * اشتراك سابق أول حاجة (مثلاً بعد تسجيل خروج ودخول بحساب تاني)
 */
export function initBrowserNotifications() {

  const myUid = localStorage.getItem("userId") || "";
  if (!myUid) return;

  if (typeof unsubscribeFn === "function") {
    unsubscribeFn();
    unsubscribeFn = null;
  }

  const seenIds = loadSeenIds(myUid);
  let isFirstSnapshot = true;

  unsubscribeFn = subscribeToMyNotificationsApi(myUid, (result) => {
    if (result.status !== "success") return;

    const notifications = result.data || [];

    // أول Snapshot بعد بدء الاشتراك: كل الإشعارات الموجودة فعلاً
    // (حتى لو قديمة من قبل فتح التطبيق) بتتسجل كـ "متعرّف عليها" من
    // غير أي Browser Notification - عشان منعملش "قصف" إشعارات لكل
    // حاجة قديمة أول ما التطبيق يفتح أو يتعمله Refresh
    if (isFirstSnapshot) {
      notifications.forEach(n => seenIds.add(n.id));
      saveSeenIds(myUid, seenIds);
      isFirstSnapshot = false;
      return;
    }

    const newOnes = notifications.filter(n => !seenIds.has(n.id));
    if (!newOnes.length) return;

    newOnes.forEach(n => {
      seenIds.add(n.id);
      showBrowserNotification(n);
    });
    saveSeenIds(myUid, seenIds);

    // تحديث شارة الإشعارات فوراً لحظة وصول إشعار جديد - بدل ما تستنى
    // لحظة تنقل جديدة بين الصفحات (النمط الحالي في renderCore.js)
    if (typeof window.refreshNotificationsBadge === "function") {
      window.refreshNotificationsBadge();
    }
  });

}

/**
 * إيقاف الاشتراك اللحظي - تُستدعى عند تسجيل الخروج
 */
export function stopBrowserNotifications() {
  if (typeof unsubscribeFn === "function") {
    unsubscribeFn();
    unsubscribeFn = null;
  }
}

window.initBrowserNotifications = initBrowserNotifications;
window.stopBrowserNotifications = stopBrowserNotifications;

// إضافة (إشعارات المتصفح): استقبال رسالة "تم الضغط على الإشعار" من
// الـ Service Worker (sw.js -> notificationclick) والتنقل فعلياً
// لمصدر الإشعار - بنفس منطق window.handleGlobalNotificationClick في
// NotificationsModal.js بالظبط (تفاصيل تذكرة / لوحة متابعة الكايزن)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NOTIFICATION_CLICK") return;

    const { notificationId, ticketId, suggestionId } = event.data.data || {};

    if (notificationId) {
      markNotificationReadApi(notificationId);
    }

    if (typeof window.refreshNotificationsBadge === "function") {
      window.refreshNotificationsBadge();
    }

    if (ticketId && typeof window.openTicketDetailsModal === "function") {
      window.openTicketDetailsModal(ticketId);
    } else if (suggestionId && typeof window.navigateTo === "function") {
      window.navigateTo("kaizenBoard");
    }
  });
}

// تفعيل تلقائي عند تحميل التطبيق لو المستخدم مسجّل دخوله بالفعل
// (حالة تحديث الصفحة Refresh - مش أول تسجيل دخول، ده بيتغطى بنداء
// صريح من authHandlers.js بعد نجاح الدخول مباشرة)
if (localStorage.getItem("userId")) {
  initBrowserNotifications();
}
