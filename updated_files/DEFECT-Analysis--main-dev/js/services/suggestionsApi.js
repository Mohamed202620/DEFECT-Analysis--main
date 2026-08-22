// ============================================================
// suggestionsApi.js
// مقترحات الكايزن (Kaizen Suggestions) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../config.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ============================================================
// KAIZEN SUGGESTIONS - مقترحات التحسين المستمر
// ============================================================


/**
 * حفظ مقترح كايزن في مجموعة "suggestions"
 */
export async function saveSuggestionApi(payload) {

  try {

    const docRef = await addDoc(
      collection(db, "suggestions"),
      {
        ...payload,
        status: payload?.status || "new",
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم إرسال مقترح الكايزن بنجاح"
    };

  } catch (error) {

    console.error("Error saving suggestion:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}

// ============================================================
// لوحة متابعة الكايزن (Kaizen Board) - مراجعة واعتماد المقترحات
// نفس فكرة subscribeToTicketsBoardApi (Realtime + فلترة صلاحيات
// أولاً ثم فلترة الحالة محلياً بدون orderBy مع where عشان نتجنب
// أي Composite Index)، لكن مُنفَّذة بشكل مستقل هنا لمقترحات الكايزن
// ============================================================

const KAIZEN_STATUSES = ["new", "under_review", "approved", "rejected", "implemented"];

/**
 * اشتراك لحظي (Realtime) في مقترحات الكايزن حسب الصلاحية والحالة
 * role: admin/manager (PM) → كل المقترحات
 * غير ذلك (فني/مهندس/عامل) → مقترحاته هو فقط (بالاسم، زي reportedBy
 * في نظام التذاكر)
 */
export function subscribeToSuggestionsBoardApi({ role, myName, status }, callback) {
  try {
    const suggestionsRef = collection(db, "suggestions");

    const q =
      (role === "admin" || role === "manager")
        ? query(suggestionsRef)
        : query(suggestionsRef, where("name", "==", myName || ""));

    return onSnapshot(
      q,
      (querySnapshot) => {
        let items = [];
        querySnapshot.forEach(docSnap => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });

        // السجلات القديمة اللي اتسجلت قبل إضافة نظام الحالات
        // تُعتبر "جديد" افتراضياً
        if (status && status !== "all") {
          items = items.filter(s => (s.status || "new") === status);
        }

        items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        callback({ status: "success", data: items });
      },
      (error) => {
        console.error("Error subscribing to suggestions board:", error);
        callback({ status: "error", message: error.message });
      }
    );
  } catch (error) {
    console.error("Error subscribing to suggestions board:", error);
    callback({ status: "error", message: error.message });
    return () => {};
  }
}

/**
 * تغيير حالة مقترح كايزن - مقيّد على مستوى الواجهة لدور PM فقط
 * (راجع kaizenBoard.js) - وبيسجل updatedBy/updatedAt زي نفس نمط
 * التحديثات المُستخدم في باقي المشروع
 */
export async function updateSuggestionStatusApi(suggestionId, newStatus) {
  if (!KAIZEN_STATUSES.includes(newStatus)) {
    return { status: "error", message: "حالة غير صالحة" };
  }
  try {
    await updateDoc(doc(db, "suggestions", suggestionId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || ""
    });
    return { status: "success" };
  } catch (error) {
    console.error("Error updating suggestion status:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// جلب مقترحات آخر N يوم لتقرير قابل للتصدير - مرة واحدة (getDocs)
// بنفس منطق فلترة الصلاحيات أعلاه، وفلترة التاريخ محلياً (بدون
// Composite Index)
// ============================================================
export async function fetchSuggestionsForReportApi({ role, myName, sinceISO }) {
  try {
    const suggestionsRef = collection(db, "suggestions");
    const items = [];

    if (role === "admin" || role === "manager") {
      const snap = await getDocs(query(suggestionsRef));
      snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    } else {
      const snap = await getDocs(query(suggestionsRef, where("name", "==", myName || "")));
      snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    }

    const filtered = items.filter(s => String(s.createdAt || "") >= sinceISO);
    filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return { status: "success", data: filtered };
  } catch (error) {
    console.error("Error fetching suggestions for report:", error);
    return { status: "error", message: error.message };
  }
}


