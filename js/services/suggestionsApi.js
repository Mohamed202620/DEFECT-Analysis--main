// ============================================================
// suggestionsApi.js
// مقترحات الكايزن (Kaizen Suggestions) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
//
// ============================================================
// المرحلة النهائية - دورة حياة مقترح الكايزن (Workflow)
// ============================================================
// new (جديد)
//   -> under_review (قيد المراجعة)   [أدمن]
//   -> rejected     (مرفوض)          [أدمن، سبب إجباري]
//
// under_review (قيد المراجعة)
//   -> in_progress  (قيد التنفيذ)    [أدمن، بعد الموافقة والإسناد لفني]
//   -> rejected     (مرفوض)          [أدمن، مسموح حتى لو بالفعل قيد المراجعة، سبب إجباري]
//   -> revision_requested (طلب تعديل) [أدمن، ملاحظات إجبارية]
//
// revision_requested (طلب تعديل)
//   -> under_review (رجوع للمراجعة بعد التعديل) [أدمن]
//
// in_progress (قيد التنفيذ)
//   -> implemented  (تم التنفيذ)     [الفني المسؤول المُسند إليه، أو أدمن]
//
// rejected / implemented = حالات نهائية (لا يوجد أي انتقال بعدها)
//
// الدور الإداري الوحيد المعتمد لهذا الـWorkflow هو "admin" فقط
// (لا يوجد PM/manager هنا) - التحقق من الصلاحية بيتم في الطبقتين:
//  ١) هنا (منطق العميل) - رفض سريع برسالة واضحة قبل أي طلب لـ Firestore
//  ٢) firestore.rules (الطبقة الحقيقية غير القابلة للالتفاف حولها من
//     الواجهة - راجع match /suggestions/{suggestionId} هناك)
// ============================================================

import { db } from "../config.js";
import { uploadBase64Image } from "./imageUpload.js";
import { getCurrentRole } from "../permissions.js";

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

    // نفس نمط saveIssueApi (ticketsApi.js): استخراج الصورة (Base64)
    // من الـ payload، رفعها على ImgBB، وتخزين الرابط فقط (imageUrl)
    // بدل الـ Base64 الكامل داخل مستند Firestore
    const { image, ...restPayload } = payload;
    const imageUrl = await uploadBase64Image(image, "suggestion_" + Date.now());

    const docRef = await addDoc(
      collection(db, "suggestions"),
      {
        ...restPayload,
        ...(imageUrl && { imageUrl }),

        // معرّف صاحب المقترح الحقيقي (UID) - مطلوب لتوجيه إشعارات
        // تغيّر الحالة إليه لاحقاً (لا علاقة له بخاصية "مقترح مجهول"
        // اللي بتتحكم بس في العرض/الاسم الظاهر للآخرين، مش في توجيه
        // إشعارات صاحب المقترح نفسه)
        submittedByUid: localStorage.getItem("userId") || "",

        // مقترح جديد دايماً يبدأ "new" - أي قيمة status جاية من
        // الواجهة بتتجاهل عمداً هنا (نفس ما تفرضه قاعدة create في
        // firestore.rules) عشان محدش يقدر يبعت مقترح بحالة جاهزة
        // مسبقاً (زي "implemented" مباشرة)
        status: "new",
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

export const KAIZEN_STATUSES = [
  "new", "under_review", "in_progress", "revision_requested", "rejected", "implemented"
];

// حالات نهائية - لا يوجد أي انتقال مسموح بعدها إطلاقاً
export const KAIZEN_FINAL_STATUSES = ["rejected", "implemented"];

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

// ============================================================
// Workflow - دوال داخلية مساعدة (Helpers)
// ============================================================

// نفس فكرة stampUpdate في ticketsApi.js - تسجيل بيانات آخر تحديث
// (updatedAt/updatedBy) مع كل انتقال حالة
function stampSuggestionUpdate(extra = {}) {
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
    updatedBy: localStorage.getItem("name") || ""
  };
}

// سجل تغييرات مقترح الكايزن (Append-only) - نفس فكرة addTicketLog
// بالضبط، لكن تحت suggestions/{id}/logs بدل tickets/{id}/logs
async function addSuggestionLog(suggestionId, { action, fromStatus, toStatus, note = "" }) {
  try {
    await addDoc(collection(db, "suggestions", suggestionId, "logs"), {
      action,
      fromStatus,
      toStatus,
      note,
      by: localStorage.getItem("name") || "",
      byUid: localStorage.getItem("userId") || "",
      byRole: getCurrentRole() || "",
      at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error adding suggestion log:", error);
  }
}

// إنشاء إشعار داخل نظام الإشعارات الحالي (مجموعة "notifications" -
// نفس الشكل بالظبط اللي بيستخدمه createNotification في ticketsApi.js:
// forUid/type/message/read/createdAt)، فقط بحقل suggestionId بدل
// ticketId عشان نفرّق مصدر الإشعار - بدون أي نظام إشعارات موازٍ
async function createSuggestionNotification(forUid, { type, message, suggestionId }) {
  if (!forUid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      forUid,
      type,
      message,
      suggestionId,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating suggestion notification:", error);
  }
}

async function getSuggestionSnapshot(suggestionId) {
  const snap = await getDoc(doc(db, "suggestions", suggestionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ============================================================
// Workflow - دوال الانتقال بين الحالات (الإجراءات المسموحة فقط)
// كل دالة هنا مسؤولة عن انتقال واحد محدد فقط - أي انتقال مش موجود
// كدالة هنا يبقى ببساطة "غير مسموح" (نفس فلسفة assignTicketApi/
// startTicketApi/resolveTicketApi/... في ticketsApi.js بدل دالة
// عامة توصل لأي حالة). التحقق من الدور بيتم هنا (رفض سريع) وبيتم
// أيضاً - وبشكل غير قابل للالتفاف - داخل firestore.rules.
// ============================================================

/**
 * new -> under_review: بدء مراجعة مقترح جديد - أدمن فقط
 */
export async function reviewSuggestionApi(suggestionId) {
  if (getCurrentRole() !== "admin") {
    return { status: "error", message: "بدء المراجعة متاح فقط للأدمن" };
  }
  try {
    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({ status: "under_review" })
    );
    addSuggestionLog(suggestionId, { action: "review", fromStatus: "new", toStatus: "under_review" });

    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (suggestion?.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "under_review",
        message: `مقترح الكايزن "${suggestion.title || ""}" الآن قيد المراجعة`,
        suggestionId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error reviewing suggestion:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * new أو under_review -> rejected: رفض مقترح (سبب الرفض إجباري) -
 * أدمن فقط. مسموح صراحةً حتى لو كان المقترح بالفعل "قيد المراجعة"
 * (مش مقصور على "جديد" فقط).
 */
export async function rejectSuggestionApi(suggestionId, reason) {
  if (getCurrentRole() !== "admin") {
    return { status: "error", message: "رفض المقترح متاح فقط للأدمن" };
  }
  if (!reason || !reason.trim()) {
    return { status: "error", message: "سبب الرفض مطلوب" };
  }
  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion) {
      return { status: "error", message: "المقترح غير موجود" };
    }
    if (!["new", "under_review"].includes(suggestion.status || "new")) {
      return { status: "error", message: "لا يمكن رفض مقترح في هذه الحالة" };
    }

    const fromStatus = suggestion.status || "new";

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({ status: "rejected", rejectionReason: reason.trim() })
    );
    addSuggestionLog(suggestionId, {
      action: "reject", fromStatus, toStatus: "rejected", note: reason.trim()
    });

    if (suggestion.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "rejected",
        message: `تم رفض مقترح الكايزن "${suggestion.title || ""}" - السبب: ${reason.trim()}`,
        suggestionId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * under_review -> revision_requested: طلب تعديل على المقترح مع
 * ملاحظات إجبارية توضح المطلوب تعديله - أدمن فقط
 */
export async function requestSuggestionRevisionApi(suggestionId, notes) {
  if (getCurrentRole() !== "admin") {
    return { status: "error", message: "طلب التعديل متاح فقط للأدمن" };
  }
  if (!notes || !notes.trim()) {
    return { status: "error", message: "ملاحظات طلب التعديل مطلوبة" };
  }
  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion || suggestion.status !== "under_review") {
      return { status: "error", message: "طلب التعديل متاح فقط للمقترحات قيد المراجعة" };
    }

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({ status: "revision_requested", revisionNotes: notes.trim() })
    );
    addSuggestionLog(suggestionId, {
      action: "request_revision", fromStatus: "under_review", toStatus: "revision_requested", note: notes.trim()
    });

    if (suggestion.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "revision_requested",
        message: `مطلوب تعديل على مقترح الكايزن "${suggestion.title || ""}" - ملاحظات: ${notes.trim()}`,
        suggestionId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error requesting suggestion revision:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * revision_requested -> under_review: إعادة المقترح للمراجعة بعد
 * إجراء التعديل المطلوب - أدمن فقط
 */
export async function returnSuggestionToReviewApi(suggestionId) {
  if (getCurrentRole() !== "admin") {
    return { status: "error", message: "هذا الإجراء متاح فقط للأدمن" };
  }
  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion || suggestion.status !== "revision_requested") {
      return { status: "error", message: "الإجراء متاح فقط للمقترحات في حالة طلب تعديل" };
    }

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({ status: "under_review" })
    );
    addSuggestionLog(suggestionId, {
      action: "return_to_review", fromStatus: "revision_requested", toStatus: "under_review"
    });

    if (suggestion.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "under_review",
        message: `مقترح الكايزن "${suggestion.title || ""}" رجع قيد المراجعة بعد التعديل`,
        suggestionId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error returning suggestion to review:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * revision_requested -> under_review: صاحب المقترح نفسه (submittedByUid)
 * يعدّل المقترح (عنوان/مشكلة/حل) بعد ملاحظات الأدمن، ثم "يعيد
 * إرساله للمراجعة" - ملاحظات الأدمن (revisionNotes) بتفضل محفوظة
 * كسجل تاريخي، وبيتسجل من عدّل ومتى في الـlogs
 */
export async function resubmitSuggestionApi(suggestionId, { title, problem, solution } = {}) {
  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";
  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion || suggestion.status !== "revision_requested") {
      return { status: "error", message: "إعادة الإرسال متاحة فقط للمقترحات في حالة يحتاج تعديل" };
    }

    // نفس احتياطي الملكية المُضاف في getSuggestionActions (permissions.js):
    // submittedByUid هو المرجع الأساسي، وبيتم الرجوع للاسم فقط لو
    // الحقل ده فاضي/غير موجود على السجل (مقترحات قديمة سابقة لإضافته)
    const isOwner =
      (!!suggestion.submittedByUid && suggestion.submittedByUid === myUid) ||
      (!suggestion.submittedByUid && !!myName && suggestion.name === myName);

    if (!isOwner) {
      return { status: "error", message: "إعادة الإرسال متاحة فقط لصاحب المقترح نفسه" };
    }
    if (!title?.trim() || !problem?.trim() || !solution?.trim()) {
      return { status: "error", message: "لازم تعبئة العنوان والمشكلة والحل قبل إعادة الإرسال" };
    }

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({
        status: "under_review",
        title: title.trim(),
        problem: problem.trim(),
        solution: solution.trim(),

        // تصحيح ذاتي لسجل قديم مفيهوش submittedByUid: بنثبّته دلوقتي
        // على معرّف المستخدم الحالي (صاحب المقترح الفعلي حسب الاسم)
        // عشان الإشعارات وأزرار التحكم القادمة (طلب تعديل تاني، رفض،
        // تنفيذ...) تشتغل صح من هنا وطالع، من غير ما تتكرر المشكلة
        ...(!suggestion.submittedByUid && myUid && { submittedByUid: myUid })
      })
    );
    addSuggestionLog(suggestionId, {
      action: "resubmit", fromStatus: "revision_requested", toStatus: "under_review",
      note: "تم التعديل وإعادة الإرسال للمراجعة من صاحب المقترح"
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error resubmitting suggestion:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * under_review -> in_progress: موافقة على المقترح مع إسناده لفني
 * مسؤول (assignedTo/assignedToUid إجباريين) - أدمن فقط
 */
export async function assignAndApproveSuggestionApi(suggestionId, { assignedTo, assignedToUid }) {
  if (getCurrentRole() !== "admin") {
    return { status: "error", message: "الموافقة والإسناد متاحان فقط للأدمن" };
  }
  if (!assignedTo || !assignedToUid) {
    return { status: "error", message: "لازم اختيار الفني المسؤول قبل الموافقة" };
  }
  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion || suggestion.status !== "under_review") {
      return { status: "error", message: "الموافقة والإسناد متاحان فقط للمقترحات قيد المراجعة" };
    }

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({ status: "in_progress", assignedTo, assignedToUid })
    );
    addSuggestionLog(suggestionId, {
      action: "approve_assign",
      fromStatus: "under_review",
      toStatus: "in_progress",
      note: `تم الإسناد إلى ${assignedTo}`
    });

    if (suggestion.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "in_progress",
        message: `تمت الموافقة على مقترح الكايزن "${suggestion.title || ""}" وجارٍ تنفيذه`,
        suggestionId
      });
    }
    createSuggestionNotification(assignedToUid, {
      type: "assigned",
      message: `تم إسناد تنفيذ مقترح كايزن إليك: "${suggestion.title || ""}"`,
      suggestionId
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error assigning/approving suggestion:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * in_progress -> implemented: تسجيل اكتمال تنفيذ المقترح - الفني
 * المسؤول المُسند إليه فقط، أو أدمن (حالة نهائية بعدها). ملاحظة
 * التنفيذ وصورة/صور "بعد التنفيذ" اختياريتان (عند الحاجة فقط)
 */
export async function implementSuggestionApi(suggestionId, notes = "", afterImages = []) {
  const role = getCurrentRole();
  const myUid = localStorage.getItem("userId") || "";

  try {
    const suggestion = await getSuggestionSnapshot(suggestionId);
    if (!suggestion || suggestion.status !== "in_progress") {
      return { status: "error", message: "لا يمكن تسجيل التنفيذ إلا لمقترح قيد التنفيذ" };
    }
    if (role !== "admin" && suggestion.assignedToUid !== myUid) {
      return { status: "error", message: "تسجيل التنفيذ متاح فقط للفني المسؤول عن المقترح أو الأدمن" };
    }

    // الصور اختيارية تماماً ("عند الحاجة") - لو مفيش صور متبعتش، والرفع
    // بيحصل فقط لو فعلاً فيه صور مختارة (بحد أقصى 3، نفس حد resolveTicketApi)
    const images = (afterImages || []).filter(Boolean).slice(0, 3);
    const implementationImages = images.length
      ? (await Promise.all(
          images.map((img, i) => uploadBase64Image(img, `${suggestionId}_impl_${i + 1}`))
        )).filter(Boolean)
      : [];

    await updateDoc(
      doc(db, "suggestions", suggestionId),
      stampSuggestionUpdate({
        status: "implemented",
        ...(notes && notes.trim() && { implementationNotes: notes.trim() }),
        ...(implementationImages.length && { implementationImages })
      })
    );
    addSuggestionLog(suggestionId, {
      action: "implement", fromStatus: "in_progress", toStatus: "implemented", note: notes?.trim() || ""
    });

    if (suggestion.submittedByUid) {
      createSuggestionNotification(suggestion.submittedByUid, {
        type: "implemented",
        message: `🎉 تم تنفيذ مقترح الكايزن "${suggestion.title || ""}" بنجاح`,
        suggestionId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error implementing suggestion:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * سجل زمني كامل لمقترح كايزن (من نفّذ كل انتقال ومتى) - للعرض في
 * نافذة تفاصيل المقترح فقط (قراءة، بدون أي تعديل)
 */
export async function fetchSuggestionLogsApi(suggestionId) {
  try {
    const logsRef = collection(db, "suggestions", suggestionId, "logs");
    const snap = await getDocs(query(logsRef, orderBy("at", "asc")));
    const items = [];
    snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    return { status: "success", data: items };
  } catch (error) {
    console.error("Error fetching suggestion logs:", error);
    return { status: "error", message: error.message, data: [] };
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

// ============================================================
// جلب مقترحات الكايزن لصفحة "البحث والفلترة المتقدمة" (maintenanceSearch)
// - نفس فكرة fetchTicketsForSearchApi (ticketsApi.js): فلترة
//   الصلاحيات على مستوى الاستعلام نفسه بدل جلب كل المقترحات ثم
//   فلترتها محلياً. isFullAccess بيتحدد من الصفحة نفسها
//   (admin/manager/engineer - راجع hasFullDataAccess في permissions.js)
// - وصول محدود: مقترحاته هو (بالاسم - نفس subscribeToSuggestionsBoardApi)
//   + أي مقترح مُسند إليه للتنفيذ (assignedToUid) حتى لو مش هو صاحبه،
//   لأنه برضه "مسموح له بيها" فعلياً (زي ما بيوضح getSuggestionActions)
// ============================================================
export async function fetchSuggestionsForSearchApi({ isFullAccess, myUid, myName }) {
  try {
    const suggestionsRef = collection(db, "suggestions");

    if (isFullAccess) {
      const snap = await getDocs(query(suggestionsRef));
      const items = [];
      snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      return { status: "success", data: items };
    }

    const queries = [
      getDocs(query(suggestionsRef, where("name", "==", myName || "")))
    ];
    if (myUid) {
      queries.push(getDocs(query(suggestionsRef, where("assignedToUid", "==", myUid))));
    }

    const snaps = await Promise.all(queries);
    const merged = new Map();
    snaps.forEach(snap => {
      snap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    });

    return { status: "success", data: Array.from(merged.values()) };
  } catch (error) {
    console.error("Error fetching suggestions for search:", error);
    return { status: "error", message: error.message };
  }
}


