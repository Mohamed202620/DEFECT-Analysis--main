// ============================================================
// checklistApi.js
// Daily AM Checklist + 5S Assessment - سجلات فحص الماكينة اليومي
// وتقييم الـ5S. نفس أسلوب/شكل pmApi.js و machineErrorsApi.js
// بالظبط (مجموعة Firestore واحدة "machineChecklists"، حماية القسم
// على مستوى الحفظ نفسه - راجع firestore.rules).
// ============================================================

import { db } from "../providers/backend/index.js";
import {
  getDepartmentForMachineValue,
  getCurrentUserMachineContext,
  getMachineTypeReference
} from "../machines.js";
import { uploadBase64Images } from "./imageUpload.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "../providers/backend/index.js";

// نوعا السجل المدعومان داخل نفس المجموعة (type)
export const CHECKLIST_TYPE_AM = "am";
export const CHECKLIST_TYPE_5S = "5s";

/**
 * حفظ سجل فحص (Daily AM أو 5S) في مجموعة "machineChecklists"
 * نفس منطق حماية القسم المستخدم في pmApi.js/machineErrorsApi.js
 */
async function saveChecklistRecord(type, payload) {
  try {
    // الحصول على الرقم الموحد الجديد من Cloud Function (ذرّي وآمن من التعارض)
    // مع fallback محلي لو الدالة غير منشورة أو فشل الاتصال
    let unifiedNumber = null;
    try {
      const { callCloudFunction } = await import("../providers/backend/index.js");
      const sequenceResult = await callCloudFunction("getNextSequenceNumber", { type: "checklists" });
      if (sequenceResult.status === "success") {
        unifiedNumber = sequenceResult.displayNumber; // مثال: CL-00001
      } else {
        console.warn("[saveChecklistRecord] Cloud Function returned error:", sequenceResult.message);
      }
    } catch (cfError) {
      console.warn("[saveChecklistRecord] Cloud Function unavailable, using local fallback:", cfError.message);
    }
    
    // Fallback: توليد رقم محلي بالاعتماد على timestamp + random (مؤقت لحين توفر الدالة)
    if (!unifiedNumber) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      unifiedNumber = `CL-${timestamp}${random}`;
      console.info("[saveChecklistRecord] Using local fallback unifiedNumber:", unifiedNumber);
    }

    const department =
      getDepartmentForMachineValue(payload?.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";
    const machineReference = getMachineTypeReference(payload?.machine);
    if (!machineReference) {
      return { status: "error", message: "الماكينة غير موجودة في كتالوج الماكينات النشط" };
    }

    // رفع صور بنود "Not OK" (لو موجودة) قبل الحفظ - نفس أسلوب
    // saveIssueApi (uploadBase64Images ثم تخزين الروابط فقط)
    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemsWithUploadedPhotos = [];

    for (const item of items) {
      if (item.photo) {
        const [url] = await uploadBase64Images([item.photo], `${type}-${item.id || "item"}`);
        if (!url) {
          return {
            status: "error",
            message: "تعذر رفع صورة بند الفحص؛ لم يتم حفظ السجل للحفاظ على الصورة. تحقق من الاتصال وحاول مجدداً."
          };
        }
        itemsWithUploadedPhotos.push({ ...item, photo: url });
      } else {
        itemsWithUploadedPhotos.push(item);
      }
    }

    const docRef = await addDoc(collection(db, "machineChecklists"), {
      ...payload,
      ...machineReference,
      items: itemsWithUploadedPhotos,
      type,
      department,
      unifiedNumber, // الرقم الموحد الجديد: CL-00001
      createdAt: new Date().toISOString()
    });

    return { status: "success", id: docRef.id, unifiedNumber };
  } catch (error) {
    console.error(`Error saving ${type} checklist record:`, error);
    return { status: "error", message: error.message };
  }
}

export async function saveDailyAmApi(payload) {
  return saveChecklistRecord(CHECKLIST_TYPE_AM, payload);
}

export async function saveFiveSApi(payload) {
  return saveChecklistRecord(CHECKLIST_TYPE_5S, payload);
}

/**
 * جلب آخر سجل (Daily AM أو 5S) لماكينة معيّنة - يُستخدم في ملف
 * الماكينة (Machine Profile) لعرض "آخر نتيجة"
 */
export async function fetchLatestChecklistApi(machine, type) {
  try {
    const q = query(
      collection(db, "machineChecklists"),
      where("machine", "==", machine),
      where("type", "==", type),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const snap = await getDocs(q);
    const latest = snap.empty
      ? null
      : { id: snap.docs[0].id, ...snap.docs[0].data() };

    return { status: "success", data: latest };
  } catch (error) {
    console.error(`Error fetching latest ${type} checklist:`, error);
    return { status: "error", message: error.message, data: null };
  }
}

/**
 * جلب سجل السجلات السابقة (Daily AM أو 5S) لماكينة معيّنة - لعرض
 * تاريخ الفحوصات في ملف الماكينة حسب صلاحية المستخدم (الواجهة هي
 * اللي بتقرر تعرض الزرار ده لمين - راجع MachineProfileView.js)
 */
export async function fetchChecklistHistoryApi(machine, type, maxCount = 10) {
  if (!Number.isInteger(maxCount) || maxCount < 1 || maxCount > 100) {
    return { status: "error", message: "maxCount must be an integer between 1 and 100", data: [] };
  }

  try {
    const q = query(
      collection(db, "machineChecklists"),
      where("machine", "==", machine),
      where("type", "==", type),
      orderBy("createdAt", "desc"),
      limit(maxCount)
    );

    const snap = await getDocs(q);
    const records = [];
    snap.forEach(docSnap => records.push({ id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: records };
  } catch (error) {
    console.error(`Error fetching ${type} checklist history:`, error);
    return { status: "error", message: error.message, data: [] };
  }
}
