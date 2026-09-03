// ============================================================
// kaizensApi.js
// طبقة الاتصال بـ Firestore لمجموعة "kaizens" - أرشيف/سجل مقترحات
// الكايزن الرسمية (Kaizen Completion Sheet) المستخدمة في صفحة
// "متابعة وتقييم مقترحات الكايزن" (kaizenManagement.js).
//
// ملاحظة مهمة: هذه المجموعة (kaizens) مستقلة تماماً عن مجموعة
// "suggestions" المستخدمة في نظام كايزن اليومي (suggestionView.js +
// kaizenBoard.js + suggestionsApi.js) - لا علاقة بينهما ولا أي
// تعديل تم على أي منهما. "kaizens" هي أرشيف توثيق رسمي (Kaizen
// Completion Sheet) بحقول مختلفة تماماً (KPI قبل/بعد، تعميم أفقي،
// توقيعات اعتماد...) يُستخدم لتوثيق وتقييم المقترحات المُنجزة أو
// قيد الإنجاز بشكل احترافي (راجع KaizenManagementView.js).
// ============================================================

import { db } from "../config.js";
import { uploadBase64Images } from "./imageUpload.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  getCountFromServer
} from "../firebase.js";

const KAIZENS_COLLECTION = "kaizens";

// ============================================================
// حالات مقترح الكايزن الموثّق (Workflow)
// ============================================================
// submitted (مُقدَّم) -> under_review (قيد المراجعة)
//                     -> approved (معتمد)
//                     -> rejected (مرفوض)
// approved            -> implemented (تم التنفيذ والتعميم)
// ============================================================
export const KAIZEN_MGMT_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "implemented",
  "rejected"
];

/**
 * توليد رقم مرجعي تسلسلي بصيغة KZ-YYYY-NNN (مثال: KZ-2026-084)
 * بأفضل جهد ممكن (Best-effort) بالاعتماد على عدد المستندات الحالية
 * + 1 - مناسب لحجم استخدام هذا النظام الداخلي، وليس عداد موزّع
 * (Distributed Counter) مضمون التفرّد 100% تحت تزامن لحظي شديد
 */
async function generateKaizenNumber() {
  const year = new Date().getFullYear();
  try {
    const countSnap = await getCountFromServer(collection(db, KAIZENS_COLLECTION));
    const nextSeq = (countSnap.data().count || 0) + 1;
    return `KZ-${year}-${String(nextSeq).padStart(3, "0")}`;
  } catch (error) {
    console.warn("تعذر حساب الرقم التسلسلي التالي للكايزن، سيتم استخدام رقم مبني على الوقت:", error);
    return `KZ-${year}-${String(Date.now()).slice(-3)}`;
  }
}

/**
 * جلب مقترحات الكايزن الموثّقة من مجموعة "kaizens" - فلترة اختيارية
 * على مستوى الاستعلام نفسه بالحالة (status) لتقليل حجم البيانات
 * المنقولة، والباقي (بحث نصي/تصنيف/ماكينة) يُطبَّق محلياً في
 * kaizenManagement.js على نفس نمط fetchSuggestionsForSearchApi
 *
 * @param {Object} [filters]
 * @param {string} [filters.status] - "all" أو أحد KAIZEN_MGMT_STATUSES
 * @returns {Promise<{status:string, data?:Array, message?:string}>}
 */
export async function fetchKaizensApi(filters = {}) {
  try {
    const kaizensRef = collection(db, KAIZENS_COLLECTION);

    const clauses = [];
    if (filters.status && filters.status !== "all") {
      clauses.push(where("status", "==", filters.status));
    }

    let snap;
    try {
      snap = await getDocs(query(kaizensRef, ...clauses, orderBy("createdAt", "desc")));
    } catch (indexError) {
      // فallback بدون orderBy لو الـ Index المركّب (status + createdAt)
      // لسه متضافش في Firebase Console - نرتّب محلياً بدلاً منه
      if (indexError?.code === "failed-precondition") {
        snap = await getDocs(query(kaizensRef, ...clauses));
      } else {
        throw indexError;
      }
    }

    const items = [];
    snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));

    items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return { status: "success", data: items };
  } catch (error) {
    console.error("Error fetching kaizens:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * جلب مستند كايزن واحد بالتفصيل (id) - تُستخدم بشكل احتياطي لو
 * البيانات مش متوفرة أصلاً في الكاش المحلي (kaizenItemsById)
 */
export async function fetchKaizenByIdApi(id) {
  try {
    const snap = await getDoc(doc(db, KAIZENS_COLLECTION, id));
    if (!snap.exists()) {
      return { status: "error", message: "المقترح غير موجود" };
    }
    return { status: "success", data: { id: snap.id, ...snap.data() } };
  } catch (error) {
    console.error("Error fetching kaizen by id:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * إضافة مقترح/توثيق كايزن جديد لمجموعة "kaizens"
 *
 * @param {Object} data - راجع KaizenFormModal.js لقائمة الحقول الكاملة
 * @returns {Promise<{status:string, id?:string, message?:string}>}
 */
export async function addKaizenApi(data) {
  try {
    const {
      beforeImages,
      afterImages,
      ...rest
    } = data;

    const kaizenNumber = await generateKaizenNumber();

    const [uploadedBeforeUrls, uploadedAfterUrls] = await Promise.all([
      uploadBase64Images(beforeImages || [], `kaizen_before_${Date.now()}`),
      uploadBase64Images(afterImages || [], `kaizen_after_${Date.now()}`)
    ]);

    const nowIso = new Date().toISOString();

    const docRef = await addDoc(collection(db, KAIZENS_COLLECTION), {
      ...rest,
      kaizenNumber,
      beforeImageUrls: uploadedBeforeUrls,
      afterImageUrls: uploadedAfterUrls,
      status: "submitted",
      createdBy: localStorage.getItem("name") || "",
      createdByUid: localStorage.getItem("userId") || "",
      createdAt: nowIso,
      updatedAt: nowIso
    });

    return { status: "success", id: docRef.id, kaizenNumber };
  } catch (error) {
    console.error("Error adding kaizen:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * تحديث حالة مقترح كايزن موثّق (مراجعة/اعتماد/رفض/تنفيذ) مع ملاحظات
 * المراجعة، وحقول اختيارية إضافية (مسؤول التنفيذ/تاريخ الإنجاز)
 *
 * @param {string} id
 * @param {string} newStatus - أحد KAIZEN_MGMT_STATUSES
 * @param {string} [reviewNotes]
 * @param {Object} [extra] - { implementationOwner, completionDate }
 */
export async function updateKaizenStatusApi(id, newStatus, reviewNotes = "", extra = {}) {
  try {
    if (!KAIZEN_MGMT_STATUSES.includes(newStatus)) {
      return { status: "error", message: "حالة غير معروفة" };
    }

    const { implementationOwner, completionDate } = extra;

    await updateDoc(doc(db, KAIZENS_COLLECTION, id), {
      status: newStatus,
      reviewNotes: reviewNotes || "",
      ...(implementationOwner !== undefined && { implementationOwner }),
      ...(completionDate !== undefined && { completionDate }),
      updatedBy: localStorage.getItem("name") || "",
      updatedByUid: localStorage.getItem("userId") || "",
      updatedAt: new Date().toISOString()
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error updating kaizen status:", error);
    return { status: "error", message: error.message };
  }
}
