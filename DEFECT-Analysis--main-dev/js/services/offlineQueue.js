// ============================================================
// offlineQueue.js
// طبقة تخزين محلية بسيطة (IndexedDB خام - بدون مكتبات خارجية)
// لحفظ البلاغات اللي اتعملت وقت انقطاع الإنترنت، لحد ما يرجع
// الاتصال وتتزامن تلقائياً مع Firestore (راجع syncOfflineTicketsApi
// في ticketsApi.js).
// ============================================================

const DB_NAME = "maintenance_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "pending_tickets";

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: "localId" });
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
