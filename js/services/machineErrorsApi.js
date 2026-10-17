// ============================================================
// machineErrorsApi.js
// قاعدة معرفة أعطال الماكينات (Machine Error Scanner) + قاعدة
// المعرفة (Knowledge Base) - جزء مستخرج من services/api.js
// بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";
import { uploadBase64Image } from "./imageUpload.js";
import {
  getDepartmentForMachineValue,
  getCurrentUserMachineContext,
  getMachineTypeReference
} from "../machines.js";

import {
  collection,
  addDoc,
  setDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from "../providers/backend/index.js";

// ============================================================
// MACHINE ERROR SCANNER (Machine Error Scanner)
// ميزة جديدة: قاعدة معرفة أعطال الماكينات (OCR) + سجل التكرار
// نفس نمط الدوال المستخدم أعلاه (Firestore Firestore) دون أي
// تغيير في باقي مجموعات البيانات الحالية
// ============================================================


/**
 * تطبيع كود العطل لضمان مطابقة موحدة عند البحث/منع التكرار
 */
function normalizeErrorCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function machineErrorDocumentId(code) {
  return `error_${code}`;
}


/**
 * البحث عن عطل بواسطة الكود في مجموعة "machineErrors"
 */
export async function findMachineErrorByCode(code) {

  try {

    const normalized = normalizeErrorCode(code);

    if (!normalized) {
      return { status: "error", message: "كود العطل مطلوب" };
    }

    const q = query(
      collection(db, "machineErrors"),
      where("errorCode", "==", normalized)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { status: "success", found: false, data: null };
    }

    const docSnap = querySnapshot.docs[0];

    return {
      status: "success",
      found: true,
      data: { id: docSnap.id, ...docSnap.data() }
    };

  } catch (error) {

    console.error("Error finding machine error:", error);

    return {
      status: "error",
      message: error?.message || "حدث خطأ غير متوقع"
    };

  }

}


/**
 * حفظ عطل جديد في قاعدة المعرفة (كـ Pending Review افتراضياً)
 * يمنع تكرار نفس كود العطل قدر الإمكان
 */
export async function saveMachineErrorApi(payload, { skipOfflineQueue = false } = {}) {
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const { queueOfflineAction } = await import("./offlineQueue.js");
      const localId = await queueOfflineAction({ type: "new_machine_error", payload });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - تم حفظ العطل محلياً وسيتم إرساله تلقائياً"
      };
    } catch (error) {
      console.error("Error queuing offline machine error:", error);
      return { status: "error", message: "تعذر حفظ العطل محلياً" };
    }
  }

  try {

    const normalized = normalizeErrorCode(payload?.errorCode);

    if (!normalized) {
      return { status: "error", message: "يرجى إدخال كود العطل" };
    }
    if (normalized.includes("/") || normalized.length > 256) {
      return { status: "error", message: "كود العطل غير صالح" };
    }

    // منع تكرار نفس الكود
    const existing = await findMachineErrorByCode(normalized);

    if (existing.status !== "success") {
      return {
        status: "error",
        message: existing.message || "تعذر التحقق من تكرار كود العطل"
      };
    }
    if (existing.found) {
      return {
        status: "error",
        duplicate: true,
        message: "هذا الكود مسجل بالفعل في قاعدة المعرفة",
        data: existing.data
      };
    }

    const errorRef = doc(db, "machineErrors", machineErrorDocumentId(normalized));
    const deterministicExisting = await getDoc(errorRef);
    if (deterministicExisting.exists()) {
      return {
        status: "error",
        duplicate: true,
        message: "هذا الكود مسجل بالفعل في قاعدة المعرفة",
        data: { id: deterministicExisting.id, ...deterministicExisting.data() }
      };
    }

    // فصل حقل الصورة Base64 ورفعها إلى Storage بدل حفظها كاملة
    // داخل المستند (هذا كان السبب المباشر في تضخم حجم مستندات
    // machineErrors وظهور "Error loading documents" في الكونسول)
    const { image, ...restPayload } = payload;


    const imageUrl = await uploadBase64Image(
      image,
      `machineError_${normalized}`
    );

    // إصلاح (بند حرج - حماية سيرفرية لقيود القسم): نحفظ قسم الماكينة
    // الفعلي مع كل مستند جديد (وليس قسم المستخدم المُبلِّغ نفسه، عشان
    // الأدمن يقدر يسجل بالنيابة عن أي قسم بشكل صحيح) - ده اللي
    // firestore.rules هتتحقق منه بعدين لمنع أي مستخدم من كتابة/قراءة
    // أعطال قسم مختلف عن قسمه مباشرة عبر الـ API، بغض النظر عن فلترة
    // الواجهة (اللي ممكن تتلاعب بيها من DevTools)
    const department =
      getDepartmentForMachineValue(restPayload.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";
    const machineReference = getMachineTypeReference(restPayload.machine);
    if (!machineReference) {
      return { status: "error", message: "الماكينة غير موجودة في كتالوج الماكينات النشط" };
    }

    // الرقم الموحد (ME-001...) يُحجز ويُكتب مع العطل في دفعة ذرّية واحدة
    const { commitWithSequence } = await import("./sequenceApi.js");
    const { unifiedNumber } = await commitWithSequence("machineErrors", (batch, number) => batch.set(errorRef, {
      ...restPayload,
      ...machineReference,
      errorCode: normalized,
      unifiedNumber: number, // الرقم الموحد الجديد: ME-001
      department,
      ...(imageUrl && { imageUrl }),
      status: "pending_review",
      createdAt: new Date().toISOString()
    }));

    return {
      status: "success",
      id: errorRef.id,
      unifiedNumber,
      message: "تم إضافة العطل بنجاح وهو الآن قيد المراجعة"
    };

  } catch (error) {

    console.error("Error saving machine error:", error);

    return {
      status: "error",
      message: error?.message || "حدث خطأ غير متوقع"
    };

  }

}


/**
 * اعتماد (تأكيد) عطل كان قيد المراجعة - إجراء إداري
 */
export async function verifyMachineErrorApi(errorId) {

  try {

    const ref = doc(db, "machineErrors", errorId);

    await updateDoc(ref, {
      status: "verified",
      verifiedAt: new Date().toISOString(),
      verifiedBy: localStorage.getItem("name") || "Admin"
    });

    return { status: "success", message: "تم اعتماد العطل بنجاح" };

  } catch (error) {

    console.error("Error verifying machine error:", error);

    return { status: "error", message: error?.message || "حدث خطأ غير متوقع" };

  }

}


/**
 * تسجيل ظهور جديد لعطل معروف (سجل الأعطال السابق)
 * وربط الصورة الملتقطة بهذا الظهور
 */
export async function logMachineErrorOccurrenceApi(payload, { skipOfflineQueue = false } = {}) {
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const { queueOfflineAction } = await import("./offlineQueue.js");
      const localId = await queueOfflineAction({ type: "log_machine_error", payload });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - تم حفظ السجل محلياً وسيتم إرساله تلقائياً"
      };
    } catch (error) {
      console.error("Error queuing offline machine error log:", error);
      return { status: "error", message: "تعذر حفظ السجل محلياً" };
    }
  }

  try {

    const normalized = normalizeErrorCode(payload?.errorCode);

    if (!normalized) {
      return { status: "error", message: "كود العطل مطلوب" };
    }

    // نفس مبدأ رفع الصورة إلى Storage بدل تخزينها Base64 كاملة
    const { image, ...restPayload } = payload;

    const imageUrl = await uploadBase64Image(
      image,
      `machineErrorLog_${normalized}`
    );

    // إصلاح (بند حرج - حماية سيرفرية لقيود القسم): نفس منطق
    // saveMachineErrorApi فوق بالظبط
    const department =
      getDepartmentForMachineValue(restPayload.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";
    const machineReference = getMachineTypeReference(restPayload.machine);
    if (!machineReference) {
      return { status: "error", message: "الماكينة غير موجودة في كتالوج الماكينات النشط" };
    }

    const docRef = await addDoc(
      collection(db, "machineErrorLogs"),
      {
        ...restPayload,
        ...machineReference,
        errorCode: normalized,
        department,
        ...(imageUrl && { imageUrl }),
        scannedAt: new Date().toISOString()
      }
    );

    return { status: "success", id: docRef.id };

  } catch (error) {

    console.error("Error logging machine error occurrence:", error);

    return { status: "error", message: error?.message || "حدث خطأ غير متوقع" };

  }

}


/**
 * جلب سجل الأعطال السابق لكود معين (آخر 10 ظهورات)
 */
export async function fetchMachineErrorHistoryApi(code) {

  try {

    const normalized = normalizeErrorCode(code);

    if (!normalized) {
      return { status: "success", data: [] };
    }

    const q = query(
      collection(db, "machineErrorLogs"),
      where("errorCode", "==", normalized),
      orderBy("scannedAt", "desc"),
      limit(10)
    );

    const querySnapshot = await getDocs(q);

    const logs = [];

    querySnapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: logs };

  } catch (error) {

    console.error("Error fetching machine error history:", error);

    return { status: "error", message: error?.message || "حدث خطأ غير متوقع", data: [] };

  }

}



// KNOWLEDGE BASE (قاعدة المعرفة) - عرض/تصفح كل الأعطال المسجلة
// ============================================================


/**
 * جلب كل أعطال قاعدة المعرفة (machineErrors) لعرضها في صفحة
 * قاعدة المعرفة (Knowledge Base)
 */
export async function fetchAllMachineErrorsApi() {

  try {

    const querySnapshot = await getDocs(
      collection(db, "machineErrors")
    );

    const data = [];

    querySnapshot.forEach(docSnap => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data };

  } catch (error) {

    console.error("Error fetching machine errors list:", error);

    return { status: "error", message: error?.message || "حدث خطأ غير متوقع", data: [] };

  }

}


/**
 * جلب كل سجلات ظهور الأعطال (machineErrorLogs) منذ تاريخ معين
 * تُستخدم لحساب أكثر الأعطال تكراراً خلال فترة (يومي/أسبوعي/شهري)
 * استعلام بحقل واحد فقط (scannedAt) لتفادي الحاجة لفهرس مركب
 */
export async function fetchMachineErrorLogsSinceApi(sinceIso) {

  try {

    const q = query(
      collection(db, "machineErrorLogs"),
      where("scannedAt", ">=", sinceIso)
    );

    const querySnapshot = await getDocs(q);

    const data = [];

    querySnapshot.forEach(docSnap => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data };

  } catch (error) {

    console.error("Error fetching machine error logs since date:", error);

    return { status: "error", message: error?.message || "حدث خطأ غير متوقع", data: [] };

  }

}
