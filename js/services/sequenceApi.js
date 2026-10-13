// ============================================================
// sequenceApi.js
// توليد الأرقام التسلسلية الموحدة باستخدام Firestore Transaction
// يعمل على خطة Firebase Spark المجانية بدون حاجة لـ Cloud Functions
// ============================================================

import { db } from "../providers/backend/index.js";
import { runTransaction, doc } from "firebase/firestore";
import { auth } from "../config.js";

const SEQUENCE_PREFIXES = {
  tickets: "BR",
  suggestions: "KZ",
  pmOrders: "PM",
  defects: "DF",
  machineErrors: "ME",
  checklists: "CL",
  pmRecords: "PR"
};

/**
 * الحصول على الرقم التسلسلي التالي لنوع معين
 * يستخدم Firestore Transaction للزيادة الذرّية (Atomic Increment)
 * لمنع التكرار عند الإنشاء المتزامن من عدة مستخدمين.
 *
 * @param {string} type - نوع السجل: "tickets" | "suggestions" | "pmOrders" | "defects" | "machineErrors" | "checklists" | "pmRecords"
 * @returns {Promise<string>} الرقم الموحد المنسق، مثال: "BR-00001"
 */
export async function getNextSequenceNumber(type) {
  const prefix = SEQUENCE_PREFIXES[type];

  if (!prefix) {
    throw new Error(`نوع الترقيم غير مدعوم: ${type}`);
  }

  if (!auth.currentUser) {
    throw new Error("يجب تسجيل الدخول أولاً لتوليد رقم تسلسلي.");
  }

  const counterRef = doc(db, "counters", type);

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let current = 0;
    if (counterDoc.exists()) {
      current = counterDoc.data().current || 0;
    }

    const next = current + 1;

    transaction.set(counterRef, {
      current: next,
      prefix,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser.uid
    }, { merge: true });

    return next;
  });

  return `${prefix}-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * دالة مساعدة لجلب القيمة الحالية للعداد (للقراءة فقط - للتصحيح/الإدارة)
 * @param {string} type
 * @returns {Promise<{current: number, prefix: string, nextDisplayNumber: string}>}
 */
export async function getSequenceCounter(type) {
  const prefix = SEQUENCE_PREFIXES[type];
  if (!prefix) {
    throw new Error(`نوع الترقيم غير مدعوم: ${type}`);
  }

  const { getDoc } = await import("../firebase.js");
  const counterRef = doc(db, "counters", type);
  const counterDoc = await getDoc(counterRef);
  const current = counterDoc.exists() ? (counterDoc.data().current || 0) : 0;

  return {
    type,
    prefix,
    current,
    nextDisplayNumber: `${prefix}-${String(current + 1).padStart(5, "0")}`
  };
}

/**
 * دالة لإعادة تعيين العداد (للأدمن فقط - تستخدم في الاختبارات أو الصيانة)
 * ملاحظة: لا توجد حماية سيرفرية هنا، يجب أن يتحقق المُنادي من صلاحية الأدمن
 * @param {string} type
 * @returns {Promise<void>}
 */
export async function resetSequenceCounter(type) {
  const prefix = SEQUENCE_PREFIXES[type];
  if (!prefix) {
    throw new Error(`نوع الترقيم غير مدعوم: ${type}`);
  }

  const { setDoc } = await import("../firebase.js");
  const counterRef = doc(db, "counters", type);
  await setDoc(counterRef, {
    current: 0,
    prefix,
    resetAt: new Date().toISOString(),
    resetBy: auth.currentUser?.uid
  });
}