// ============================================================
// serverProxyStorageProvider.js
// مزود رفع الصور المُفعَّل (بند M3/الأمان): الرفع بيتم عبر Cloud Function
// (uploadImageViaImgbb) والمفتاح السري IMGBB_API_KEY محفوظ كـ Secret على
// السيرفر فقط - مابقاش في كود العميل نهائيًا.
//
// بنستخدم callCloudFunction (fetch + Bearer ID token) بدل httpsCallable،
// لأن حزمة js/firebase.js الجاهزة ما بتصدّرش getFunctions/httpsCallable
// (استيرادهم كان هيكسر تحميل الوحدة).
//
// متطلبات النشر (مرة واحدة):
//   firebase functions:secrets:set IMGBB_API_KEY
//   firebase deploy --only functions
// ============================================================

import { callCloudFunction } from "../backend/index.js";

/**
 * @param {string} base64 Data URL (data:image/...)
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function uploadImage(base64, name = "image") {

  if (!base64 || typeof base64 !== "string" || !base64.startsWith("data:image")) {
    return null;
  }

  const result = await callCloudFunction("uploadImageViaImgbb", { base64, name });

  return result?.url || null;

}

/** @type {import('./storageProvider.js').StorageProvider} */
export const serverProxyStorageProvider = {
  name: "server-proxy-imgbb",
  uploadImage
};
