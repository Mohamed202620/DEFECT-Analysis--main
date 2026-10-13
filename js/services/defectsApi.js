// ============================================================
// defectsApi.js
// حفظ بلاغات عيوب الإنتاج - جزء مستخرج من services/api.js
// بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";
import { uploadBase64Image } from "./imageUpload.js";

import {
  collection,
  addDoc
} from "../providers/backend/index.js";


// ============================================================
// DEFECTS
// ============================================================


/**
 * حفظ بلاغ عطل أو عيب
 * (يرفع الصور الثلاث فعلياً إلى Firebase Storage أولاً، ويحفظ
 * روابطها فقط داخل المستند بدل الـ Base64 الكامل)
 */
export async function saveDefectApi(
  payload, { skipOfflineQueue = false } = {}
) {
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const { queueOfflineAction } = await import("./offlineQueue.js");
      const localId = await queueOfflineAction({ type: "new_defect", payload });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - تم حفظ العيب محلياً وسيتم إرساله تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline defect:", error);
      return { status: "error", message: "تعذر حفظ العيب محلياً" };
    }
  }

  try {

    // الحصول على الرقم الموحد الجديد باستخدام Firestore Transaction (ذرّي وآمن)
    // يعمل على خطة Firebase Spark المجانية - لا يحتاج Cloud Functions
    let unifiedNumber = null;
    try {
      const { getNextSequenceNumber } = await import("./sequenceApi.js");
      unifiedNumber = await getNextSequenceNumber("defects"); // مثال: DF-00001
    } catch (seqError) {
      console.warn("[saveDefectApi] Sequence generation failed, using local fallback:", seqError.message);
    }
    
    // Fallback اختياري: توليد رقم محلي بالاعتماد على timestamp + random (احتياطي أخير)
    if (!unifiedNumber) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      unifiedNumber = `DF-${timestamp}${random}`;
      console.info("[saveDefectApi] Using local fallback unifiedNumber:", unifiedNumber);
    }

    // فصل حقول الصور Base64 عن باقي البيانات
    const {
      image1,
      image2,
      image3,
      ...restPayload
    } = payload;

    const defectId =
      payload.defectId ||
      ("DF-" + Date.now());

    // رفع الصور الثلاث بالتوازي (كل صورة فارغة/null تُرجع null فوراً)
    const [image1Url, image2Url, image3Url] =
      await Promise.all([
        uploadBase64Image(image1, `${defectId}_1`),
        uploadBase64Image(image2, `${defectId}_2`),
        uploadBase64Image(image3, `${defectId}_3`)
      ]);

    const docRef =
      await addDoc(
        collection(db, "defects"),
        {

          ...restPayload,

          defectId,
          unifiedNumber, // الرقم الموحد الجديد: DF-00001

          ...(image1Url && { image1Url }),
          ...(image2Url && { image2Url }),
          ...(image3Url && { image3Url }),

          createdAt:
            new Date().toISOString()

        }
      );


    return {

      status:
        "success",

      id:
        docRef.id,
      unifiedNumber

    };


  } catch (error) {

    console.error(
      "Error saving defect:",
      error
    );


    return {

      status:
        "error",

      message:
        error.message

    };

  }

}


