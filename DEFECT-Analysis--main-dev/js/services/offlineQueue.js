// ============================================================
// offlineQueue.js
// طبقة تخزين محلية بسيطة (IndexedDB خام - بدون مكتبات خارجية)
// لحفظ البلاغات اللي اتعملت وقت انقطاع الإنترنت، لحد ما يرجع
// الاتصال وتتزامن تلقائياً مع Firestore (راجع syncOfflineTicketsApi
// في ticketsApi.js).
//
// إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): كان الطابور ده
// بيغطي "تسجيل بلاغ جديد" بس. أي عملية تحديث حالة (بدء تنفيذ/تم
// الإصلاح/تأكيد الإغلاق) وقت انقطاع الإنترنت كانت بتفشل من غير أي
// مسار بديل - ده شائع جداً في أرضية المصنع. الـ Object Store الجديد
// "pending_actions" بيخزن أي إجراء عام (start/resolve/close) بنفس
// أسلوب "pending_tickets"، ويتزامن تلقائياً عبر نفس بانر الاتصال
// (offlineBanner.js -> syncOfflineTicketActionsApi في ticketsApi.js)
// ============================================================

const DB_NAME = "maintenance_offline_db";
const DB_VERSION = 2;
const STORE_NAME = "pending_tickets";
const ACTIONS_STORE_NAME = "pending_actions";

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
      if (!req.result.objectStoreNames.contains(ACTIONS_STORE_NAME)) {
        req.result.createObjectStore(ACTIONS_STORE_NAME, { keyPath: "localId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * حفظ بلاغ محلياً (payload كامل بما فيه الصورة Base64) وقت
 * انقطاع الإنترنت. بيرجع localId فريد لتتبع العنصر.
 */
export async function queueOfflineTicket(payload) {

  const db = await openOfflineDB();
  const localId = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      localId,
      payload,
      queuedAt: new Date().toISOString()
    });
    tx.oncomplete = () => resolve(localId);
    tx.onerror = () => reject(tx.error);
  });

}

/**
 * جلب كل البلاغات المحفوظة محلياً وبانتظار الرفع
 */
export async function getQueuedTickets() {

  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

}

/**
 * حذف بلاغ من القائمة المحلية بعد رفعه بنجاح لـ Firestore
 */
export async function removeQueuedTicket(localId) {

  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

}

// ============================================================
// إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): نفس فكرة
// queueOfflineTicket/getQueuedTickets/removeQueuedTicket فوق، لكن
// لأي إجراء عام على تذكرة موجودة بالفعل (start/resolve/close) بدل
// بلاغ جديد. الـ action هنا كائن حر الشكل: { type, ticketId, payload }
// ============================================================

/**
 * حفظ إجراء (بدء تنفيذ/تم الإصلاح/تأكيد الإغلاق) محلياً وقت انقطاع
 * الإنترنت. بيرجع localId فريد لتتبع العنصر.
 */
export async function queueOfflineAction(action) {

  const db = await openOfflineDB();
  const localId = "action_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE_NAME, "readwrite");
    tx.objectStore(ACTIONS_STORE_NAME).put({
      localId,
      action,
      queuedAt: new Date().toISOString()
    });
    tx.oncomplete = () => resolve(localId);
    tx.onerror = () => reject(tx.error);
  });

}

/**
 * جلب كل الإجراءات المحفوظة محلياً وبانتظار المزامنة، مرتبة زمنياً
 * (الأقدم أولاً) عشان تتنفذ بنفس ترتيب حصولها فعلياً
 */
export async function getQueuedActions() {

  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE_NAME, "readonly");
    const req = tx.objectStore(ACTIONS_STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => String(a.queuedAt || "").localeCompare(String(b.queuedAt || "")));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });

}

/**
 * حذف إجراء من القائمة المحلية بعد تنفيذه بنجاح على Firestore
 */
export async function removeQueuedAction(localId) {

  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE_NAME, "readwrite");
    tx.objectStore(ACTIONS_STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

}
