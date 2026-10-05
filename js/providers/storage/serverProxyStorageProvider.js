// ============================================================
// serverProxyStorageProvider.js
// مزود رفع الصور المُفعَّل: الرفع بيتم عبر سيرفر وسيط والمفتاح السري
// IMGBB_API_KEY محفوظ هناك فقط - مابقاش في كود العميل نهائيًا.
//
// الأولوية:
//   1) Cloudflare Worker (مجاني، بدون Blaze) لو BACKEND_WORKER_URL مضبوط:
//      الصورة بتتبعت multipart والـ Worker بيمرّرها لـ ImgBB كما هي.
//   2) Cloud Function uploadImageViaImgbb (خطة Blaze) كاحتياطي.
// ============================================================

import { callCloudFunction, callWorkerUpload } from "../backend/index.js";
import { BACKEND_WORKER_URL } from "../../config.js";

// تحويل data URL لـ Blob يدوياً (fetch(dataUrl) ممنوع بالـ CSP: connect-src بدون data:)
function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

/**
 * @param {string} base64 Data URL (data:image/...)
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function uploadImage(base64, name = "image") {

  if (!base64 || typeof base64 !== "string" || !base64.startsWith("data:image")) {
    return null;
  }

  if (BACKEND_WORKER_URL) {
    const blob = dataUrlToBlob(base64);
    if (!blob) return null;
    const form = new FormData();
    form.append("image", blob, `${String(name).replace(/[^\w.-]/g, "_").slice(0, 60)}.img`);
    form.append("name", String(name).slice(0, 60));
    const result = await callWorkerUpload("uploadImageViaImgbb", form);
    return result?.url || null;
  }

  const result = await callCloudFunction("uploadImageViaImgbb", { base64, name });
  return result?.url || null;

}

/** @type {import('./storageProvider.js').StorageProvider} */
export const serverProxyStorageProvider = {
  name: "server-proxy-imgbb",
  uploadImage
};
