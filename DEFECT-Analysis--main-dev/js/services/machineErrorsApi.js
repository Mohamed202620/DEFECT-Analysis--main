// ============================================================
// machineErrorsApi.js
// قاعدة معرفة أعطال الماكينات (Machine Error Scanner) + قاعدة
// المعرفة (Knowledge Base) - جزء مستخرج من services/api.js
// بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../config.js";
import { uploadBase64Image } from "./imageUpload.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
      message: error.message
    };

  }

}


/**
 * حفظ عطل جديد في قاعدة المعرفة (كـ Pending Review افتراضياً)
 * يمنع تكرار نفس كود العطل قدر الإمكان
 */
export async function saveMachineErrorApi(payload) {

  try {

    const normalized = normalizeErrorCode(payload?.errorCode);

    if (!normalized) {
      return { status: "error", message: "يرجى إدخال كود العطل" };
    }

    // منع تكرار نفس الكود
    const existing = await findMachineErrorByCode(normalized);

    if (existing.status === "success" && existing.found) {
      return {
        status: "error",
        duplicate: true,
        message: "هذا الكود مسجل بالفعل في قاعدة المعرفة",
        data: existing.data
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

    const docRef = await addDoc(
      collection(db, "machineErrors"),
      {
        ...restPayload,
        errorCode: normalized,
        ...(imageUrl && { imageUrl }),
        status: payload?.status || "pending_review",
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم إضافة العطل بنجاح وهو الآن قيد المراجعة"
    };

  } catch (error) {

    console.error("Error saving machine error:", error);

    return {
      status: "error",
      message: error.message
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

    return { status: "error", message: error.message };

  }

}


/**
 * تسجيل ظهور جديد لعطل معروف (سجل الأعطال السابق)
 * وربط الصورة الملتقطة بهذا الظهور
 */
export async function logMachineErrorOccurrenceApi(payload) {

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

    const docRef = await addDoc(
      collection(db, "machineErrorLogs"),
      {
        ...restPayload,
        errorCode: normalized,
        ...(imageUrl && { imageUrl }),
        scannedAt: new Date().toISOString()
      }
    );

    return { status: "success", id: docRef.id };

  } catch (error) {

    console.error("Error logging machine error occurrence:", error);

    return { status: "error", message: error.message };

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

    // ملاحظة: قد يتطلب هذا الاستعلام فهرس Firestore مركب
    // (errorCode + scannedAt) - في حال عدم وجوده نُعيد قائمة فارغة
    // بدلاً من كسر الواجهة
    console.error("Error fetching machine error history:", error);

    return { status: "success", data: [] };

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

    return { status: "error", message: error.message, data: [] };

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

    // فشل ناعم بدلاً من كسر الواجهة
    return { status: "success", data: [] };

  }

}
