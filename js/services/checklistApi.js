// ============================================================
// checklistApi.js
// Daily AM Checklist + 5S Assessment - سجلات فحص الماكينة اليومي
// وتقييم الـ5S. نفس أسلوب/شكل pmApi.js و machineErrorsApi.js
// بالظبط (مجموعة Firestore واحدة "machineChecklists"، حماية القسم
// على مستوى الحفظ نفسه - راجع firestore.rules).
// ============================================================

import { db } from "../providers/backend/index.js";
import { getDepartmentForMachineValue, getCurrentUserMachineContext } from "../machines.js";
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
    const department =
      getDepartmentForMachineValue(payload?.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";

    // رفع صور بنود "Not OK" (لو موجودة) قبل الحفظ - نفس أسلوب
    // saveIssueApi (uploadBase64Images ثم تخزين الروابط فقط)
    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemsWithUploadedPhotos = [];

    for (const item of items) {
      if (item.photo) {
        const [url] = await uploadBase64Images([item.photo], `${type}-${item.id || "item"}`);
        itemsWithUploadedPhotos.push({ ...item, photo: url || null });
      } else {
        itemsWithUploadedPhotos.push(item);
      }
    }

    const docRef = await addDoc(collection(db, "machineChecklists"), {
      ...payload,
      items: itemsWithUploadedPhotos,
      type,
      department,
      createdAt: new Date().toISOString()
    });

    return { status: "success", id: docRef.id };
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
    let latest = null;
    snap.forEach(docSnap => {
      latest = { id: docSnap.id, ...docSnap.data() };
    });

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
