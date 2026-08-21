// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets/Issues) - حفظ / جلب / دورة حياة التذكرة
// الحالات: pending(جديد) -> assigned(تم الإسناد) -> in_progress(قيد التنفيذ)
//          -> resolved(بانتظار تأكيد المُبلغ) -> closed(مغلق) [نهائية]
//                                     resolved -> in_progress (رفض مع سبب)
// ============================================================

import { db } from "../config.js";
import { uploadBase64Image } from "./imageUpload.js";
import { getCurrentRole } from "../permissions.js";
import { queueOfflineTicket, getQueuedTickets, removeQueuedTicket } from "./offlineQueue.js";

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
// ISSUES / TICKETS (بلاغات الأعطال)
// ============================================================


/**
 * حفظ بلاغ عطل جديد (يُستخدم من IssueView / workflow.js -> confirmIssue)
 * يتم الحفظ في نفس مجموعة "tickets" التي تُقرأ بواسطة
 * fetchTicketsApi و updateTicketStatusApi حفاظاً على توافق الـ Architecture الحالي
 */
export async function saveIssueApi(
  payload,
  { skipOfflineQueue = false } = {}
) {

  // Offline-First: لو مفيش إنترنت، بنحفظ البلاغ (بما فيه الصورة
  // Base64) محلياً في IndexedDB بدل ما نحاول نتصل بـ Firestore
  // ونفشل. skipOfflineQueue بتتفعّل بس وقت المزامنة التلقائية
  // (syncOfflineTicketsApi) عشان منعملش لفة تخزين محلي لا نهائية.
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {

    try {
      const localId = await queueOfflineTicket(payload);
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - تم حفظ البلاغ محلياً وسيتم رفعه تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline ticket:", error);
      return { status: "error", message: "تعذر حفظ البلاغ محلياً" };
    }

  }

  try {

    // فصل حقل الصورة Base64 عن باقي البيانات ورفعها إلى Storage
    const {
      image,
      ...restPayload
    } = payload;

    const issueId =
      payload.issueId ||
      ("IS-" + Date.now());

    const imageUrl =
      await uploadBase64Image(
        image,
        issueId
      );

    const docRef =
      await addDoc(
        collection(db, "tickets"),
        {

          ...restPayload,

          issueId,

          ...(imageUrl && { imageUrl }),

          // دورة حياة التذكرة تبدأ دائماً بـ pending (راجع workflow.js)
          status:
            payload?.status ||
            "pending",

          createdAt:
            payload?.createdAt ||
            new Date().toISOString()

        }
      );


    return {

      status:
        "success",

      id:
        docRef.id

    };


  } catch (error) {

    console.error(
      "Error saving issue/ticket:",
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


/**
 * Auto-Upload: بتتنادى تلقائياً من مستمع حدث 'online' (راجع
 * offlineBanner.js) - بتسحب كل البلاغات المحفوظة محلياً في
 * IndexedDB، وترفع كل واحدة فيها لـ Firestore (والصورة معاها عبر
 * ImgBB زي أي بلاغ عادي)، وبعد نجاح كل رفعة بتمسحها من التخزين
 * المحلي. لو بلاغ فشل رفعه (مثلاً النت اتقطع تاني فجأة) بيفضل
 * محفوظ في IndexedDB عشان يتحاول تاني في المرة الجاية.
 */
export async function syncOfflineTicketsApi() {

  const queued = await getQueuedTickets();

  if (!queued.length) {
    return { status: "success", synced: 0, total: 0 };
  }

  let synced = 0;

  for (const item of queued) {

    try {

      const result = await saveIssueApi(item.payload, { skipOfflineQueue: true });

      if (result.status === "success") {
        await removeQueuedTicket(item.localId);
        synced++;
      }

    } catch (error) {
      console.error("Error syncing offline ticket:", item.localId, error);
      // بيفضل في الطابور يتحاول تاني المرة الجاية
    }

  }

  return { status: "success", synced, total: queued.length };

}



// TICKETS
// ============================================================


/**
 * جلب كل التذاكر (تُستخدم في لوحة الإحصائيات العامة - loadDashboardStats)
 */
export async function fetchTicketsApi() {

  try {

    const ticketsRef =
      collection(
        db,
        "tickets"
      );


    const q =
      query(
        ticketsRef,
        orderBy(
          "createdAt",
          "desc"
        )
      );


    const querySnapshot =
      await getDocs(q);


    const tickets = [];


    querySnapshot.forEach(
      docSnap => {

        tickets.push({

          id:
            docSnap.id,

          ...docSnap.data()

        });

      }
    );


    return {

      status:
        "success",

      data:
        tickets

    };


  } catch (error) {

    console.error(
      "Error fetching tickets:",
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


// ============================================================
// استعلامات لوحات المتابعة حسب الدور (Ticket Lifecycle Queries)
// ============================================================
//
// ملحوظة عن الفهارس (Indexes):
// أول مرة تستدعوا أي دالة فيها where() أكتر من واحد أو
// where() + orderBy() على حقول مختلفة، Firestore هيرفضها ويطبع
// في الـ Console رسالة خطأ فيها رابط مباشر لإنشاء الـ composite
// index المطلوب تلقائياً - افتحوا الرابط واضغطوا Create، مرة واحدة
// بس لكل استعلام، مش محتاجين تبنوه يدوي من Firebase Console.
// ============================================================


/**
 * STEP 2 - لوحة مدير الصيانة: التذاكر بانتظار التصنيف والإسناد
 */
export async function fetchPendingTicketsApi() {

  try {

    const q =
      query(
        collection(db, "tickets"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );

    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: tickets };

  } catch (error) {

    const fallback = emptyResultOnMissingIndex(error, "fetchPendingTicketsApi");
    if (fallback) return fallback;

    console.error("Error fetching pending tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3 - لوحة الفني: التذاكر المُسندة له (تم إسنادها أو قيد التنفيذ)
 */
export async function fetchTicketsForTechnicianApi(technicianName) {

  try {

    const q =
      query(
        collection(db, "tickets"),
        where("assignedTo", "==", technicianName),
        where("status", "in", ["assigned", "in_progress"]),
        orderBy("createdAt", "desc")
      );

    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: tickets };

  } catch (error) {

    const fallback = emptyResultOnMissingIndex(error, "fetchTicketsForTechnicianApi");
    if (fallback) return fallback;

    console.error("Error fetching technician tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4 - لوحة المُبلّغ (Operator): التذاكر بانتظار الفحص والإغلاق
 * جلب عام لكل التذاكر resolved - الفلترة على المُبلّغ الحالي
 * (reportedByUid) بتتم في واجهة العرض (ticketsBoard.js) عشان
 * نتفادى الحاجة لـ composite index إضافي (status + reportedByUid).
 */
export async function fetchResolvedTicketsApi() {

  try {

    const q =
      query(
        collection(db, "tickets"),
        where("status", "==", "resolved"),
        orderBy("createdAt", "desc")
      );

    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: tickets };

  } catch (error) {

    const fallback = emptyResultOnMissingIndex(error, "fetchResolvedTicketsApi");
    if (fallback) return fallback;

    console.error("Error fetching resolved tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * لوحة متابعة البلاغات (كارت "متابعة البلاغات" في صفحة الصيانة) -
 * Real-time listener واحد موحّد بيجمع فلتر الصلاحيات (حسب uid
 * المستخدم الحالي) + فلتر تبويب الحالة (الكل/جديد/قيد المعالجة/
 * مغلق) في استعلام واحد، ويرجّع دالة unsubscribe عشان تُقفل من
 * الطرف المستدعي (ticketsBoard.js) عند تغيير الفلتر أو مغادرة
 * الصفحة.
 *
 * فلتر الصلاحيات (حسب uid - نفس الحقول الموجودة بالفعل في
 * الـ Schema لضمان الأمان في firestore.rules، مش reportedBy/
 * assignedTo النصية اللي بتتعرض للمستخدم فقط):
 *   - operator (مشغل)              -> reportedByUid == uid
 *   - technician/engineer (فني)    -> assignedToUid == uid
 *   - admin/manager (مدير)         -> بدون فلتر مستخدم (كل البلاغات)
 *
 * فلتر الحالة (status):
 *   - "all"          -> بدون فلتر status
 *   - غير كده         -> where("status", "==", status)
 *
 * @param {{role: string, myUid: string, status: string}} params
 * @param {(result: {status: string, data?: any[], message?: string}) => void} callback
 * @returns {() => void} دالة unsubscribe لإيقاف الـ listener
 */
export function subscribeToTicketsBoardApi({ role, myUid, status }, callback) {

  try {

    const clauses = [];

    if (role === "operator") {
      clauses.push(where("reportedByUid", "==", myUid));
    } else if (role === "technician" || role === "engineer") {
      clauses.push(where("assignedToUid", "==", myUid));
    }
    // admin / manager -> بدون فلتر مستخدم (يشوفوا كل البلاغات)

    if (status && status !== "all") {
      clauses.push(where("status", "==", status));
    }

    const q = query(
      collection(db, "tickets"),
      ...clauses,
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {

        const tickets = [];
        querySnapshot.forEach(docSnap => {
          tickets.push({ id: docSnap.id, ...docSnap.data() });
        });

        callback({ status: "success", data: tickets });

      },
      (error) => {

        const fallback = emptyResultOnMissingIndex(error, "subscribeToTicketsBoardApi");
        if (fallback) {
          callback(fallback);
          return;
        }

        console.error("Error in tickets board listener:", error);
        callback({ status: "error", message: error.message });

      }
    );

    return unsubscribe;

  } catch (error) {

    console.error("Error subscribing to tickets board:", error);
    callback({ status: "error", message: error.message });
    return () => {};

  }

}


// ============================================================
// UPDATE TICKET
// ============================================================


/**
 * تحديث حالة التذكرة (دالة عامة - لا تزال متاحة لأي استخدام قديم)
 */
export async function updateTicketStatusApi(
  ticketId,
  status,
  notes = ""
) {

  try {

    const ticketRef =
      doc(
        db,
        "tickets",
        ticketId
      );


    await updateDoc(
      ticketRef,
      {

        status,

        notes,

        updatedAt:
          new Date().toISOString(),

        updatedBy:
          localStorage.getItem("name")
          || ""

      }
    );


    return {

      status:
        "success"

    };


  } catch (error) {

    console.error(
      "Error updating ticket:",
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


// ============================================================
// دورة حياة التذكرة (Ticket Lifecycle Transitions)
// ============================================================

// دالة داخلية صغيرة عشان كل انتقال يسجّل نفس بيانات
// "مين عمل التحديث وإمتى" بشكل موحّد
function stampUpdate(extra = {}) {
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
    updatedBy: localStorage.getItem("name") || ""
  };
}

// ============================================================
// حماية المستخدم من رسائل Firestore الخام (خصوصاً "الفهرس
// (Index) الناقص" اللي بترجع رابط Firebase Console داخل نص
// الخطأ نفسه). لو ده اللي حصل، منعتبرهوش "خطأ" خالص - بنرجّع
// نتيجة ناجحة بقائمة فاضية، فالمستخدم يشوف "لا توجد تذاكر حالياً"
// بشكل طبيعي تماماً بدل أي رسالة أو رابط تقني. التفاصيل الحقيقية
// بتتسجل في Console بس (للأدمن/المطوّر) عشان يعرف يعمل الفهرس
// المطلوب مرة واحدة (راجع ملاحظات firestore.rules).
// ============================================================
function isMissingIndexError(error) {
  return error?.code === "failed-precondition";
}

function emptyResultOnMissingIndex(error, context) {
  if (isMissingIndexError(error)) {
    console.warn(
      `[${context}] محتاج Index في Firestore لسه ماتعملش - ` +
      `تم إخفاء الخطأ عن المستخدم وعرض قائمة فاضية مؤقتاً. ` +
      `التفاصيل: ${error.message}`
    );
    return { status: "success", data: [] };
  }
  return null; // مش خطأ فهرس - يترفع عادي زي ما هو
}

// ============================================================
// سجل التغييرات التلقائي (Ticket Logs) - subcollection:
// tickets/{ticketId}/logs/{logId} - append-only (راجع firestore.rules)
// ============================================================

async function addTicketLog(ticketId, { action, fromStatus, toStatus, note = "" }) {

  try {

    await addDoc(
      collection(db, "tickets", ticketId, "logs"),
      {
        action,
        fromStatus,
        toStatus,
        note,
        by: localStorage.getItem("name") || "",
        byUid: localStorage.getItem("userId") || "",
        byRole: getCurrentRole() || "",
        at: new Date().toISOString()
      }
    );

  } catch (error) {
    // فشل تسجيل اللوج مايوقفش العملية الأساسية، بس بنسجله في الكونسول
    console.error("Error adding ticket log:", error);
  }

}

/**
 * جلب سجل تغييرات تذكرة معينة (لعرضها كـ Timeline في شاشة
 * Ticket Details) - مرتب من الأقدم للأحدث
 */
export async function fetchTicketLogsApi(ticketId) {

  try {

    const q = query(
      collection(db, "tickets", ticketId, "logs"),
      orderBy("at", "asc")
    );

    const querySnapshot = await getDocs(q);

    const logs = [];
    querySnapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: logs };

  } catch (error) {

    console.error("Error fetching ticket logs:", error);
    return { status: "error", message: error.message };

  }

}

/**
 * جلب تذكرة واحدة بالتفصيل (شاشة Ticket Details)
 */
export async function fetchTicketByIdApi(ticketId) {

  try {

    const docSnap = await getDoc(doc(db, "tickets", ticketId));

    if (!docSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }

    return { status: "success", data: { id: docSnap.id, ...docSnap.data() } };

  } catch (error) {

    console.error("Error fetching ticket:", error);
    return { status: "error", message: error.message };

  }

}

// ============================================================
// إشعارات داخل التطبيق (In-App Notifications)
// ============================================================

async function createNotification(forUid, { type, message, ticketId }) {

  if (!forUid) return; // مفيش مستخدم مستهدف (مثلاً لسه معندناش assignedToUid)

  try {

    await addDoc(
      collection(db, "notifications"),
      {
        forUid,
        type,
        message,
        ticketId,
        read: false,
        createdAt: new Date().toISOString()
      }
    );

  } catch (error) {
    console.error("Error creating notification:", error);
  }

}

/**
 * جلب آخر إشعارات المستخدم الحالي (زر الجرس في صفحة التذاكر)
 */
export async function fetchMyNotificationsApi(uid) {

  try {

    const q = query(
      collection(db, "notifications"),
      where("forUid", "==", uid),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);

    const notifications = [];
    querySnapshot.forEach(docSnap => {
      notifications.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: notifications.slice(0, 30) };

  } catch (error) {

    const fallback = emptyResultOnMissingIndex(error, "fetchMyNotificationsApi");
    if (fallback) return fallback;

    console.error("Error fetching notifications:", error);
    return { status: "error", message: error.message };

  }

}

/**
 * تعليم إشعار كمقروء
 */
export async function markNotificationReadApi(notificationId) {

  try {

    await updateDoc(
      doc(db, "notifications", notificationId),
      { read: true }
    );

    return { status: "success" };

  } catch (error) {

    console.error("Error marking notification read:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 2 - مدير الصيانة يصنّف التذكرة ويسندها لفني/قسم.
 * pending -> assigned
 * assignedToUid ضروري لقواعد الأمان (firestore.rules) اللي بتتحقق
 * إن الفني اللي هيحل التذكرة هو نفسه المُسندة له فعلاً.
 */
export async function assignTicketApi(ticketId, { type, assignedTo, assignedToUid }) {

  if (!type || !assignedTo) {
    return { status: "error", message: "type و assignedTo مطلوبين" };
  }

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "assigned",
        type,
        assignedTo,
        ...(assignedToUid && { assignedToUid })
      })
    );

    addTicketLog(ticketId, {
      action: "assign",
      fromStatus: "pending",
      toStatus: "assigned",
      note: `تم الإسناد إلى ${assignedTo}`
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "assigned",
        message: `تم إسناد بلاغ صيانة جديد إليك`,
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error assigning ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3 - الفني يبدأ التنفيذ فعلياً.
 * assigned -> in_progress
 */
export async function startTicketApi(ticketId) {

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "in_progress" })
    );

    addTicketLog(ticketId, {
      action: "start",
      fromStatus: "assigned",
      toStatus: "in_progress"
    });

    return { status: "success" };

  } catch (error) {

    console.error("Error starting ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4 - الفني ينهي الإصلاح، يضيف ملاحظاته، ويرفع 1-3 صور بعد
 * الإصلاح (عبر نظام الصور الحالي - ImgBB، مش Firebase Storage).
 * in_progress -> resolved
 */
export async function resolveTicketApi(ticketId, mechanicNotes, afterImages = []) {

  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "ملاحظات الفني مطلوبة" };
  }

  const images = (afterImages || []).filter(Boolean).slice(0, 3);

  if (!images.length) {
    return { status: "error", message: "لازم صورة واحدة على الأقل بعد الإصلاح (بحد أقصى 3)" };
  }

  try {

    // رفع الصور بالتوازي على ImgBB (نفس نظام الصور المستخدم في
    // باقي التطبيق - imageUpload.js)
    const afterImageUrls = (
      await Promise.all(
        images.map((img, i) => uploadBase64Image(img, `${ticketId}_after_${i + 1}`))
      )
    ).filter(Boolean);

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "resolved",
        mechanicNotes: mechanicNotes.trim(),
        afterImages: afterImageUrls
      })
    );

    addTicketLog(ticketId, {
      action: "resolve",
      fromStatus: "in_progress",
      toStatus: "resolved",
      note: mechanicNotes.trim()
    });

    // إشعار المُبلّغ الأصلي إن بلاغه اتصلح ومحتاج تأكيد
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const reportedByUid = ticketSnap.exists() ? ticketSnap.data().reportedByUid : null;

    if (reportedByUid) {
      createNotification(reportedByUid, {
        type: "resolved",
        message: `تم إصلاح بلاغك - برجاء التأكد والتأكيد`,
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error resolving ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 5A - المُبلّغ يفحص الماكينة ويوافق على الإصلاح.
 * resolved -> closed (حالة نهائية)
 */
export async function closeTicketApi(ticketId) {

  try {

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "closed" })
    );

    addTicketLog(ticketId, {
      action: "close",
      fromStatus: "resolved",
      toStatus: "closed"
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "closed",
        message: `تم تأكيد إغلاق البلاغ - شكراً لك`,
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error closing ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 5B - المُبلّغ يرفض الإصلاح مع سبب واضح، وترجع التذكرة
 * للفني عشان يكمل الشغل - الاستثناء الوحيد المسموح للرجوع للخلف
 * في دورة الحياة (resolved -> in_progress، مش لأي حالة سابقة تانية)
 */
export async function reopenTicketApi(ticketId, operatorFeedback) {

  if (!operatorFeedback || !operatorFeedback.trim()) {
    return { status: "error", message: "سبب الرفض مطلوب" };
  }

  try {

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "in_progress",
        operatorFeedback: operatorFeedback.trim()
      })
    );

    addTicketLog(ticketId, {
      action: "reject",
      fromStatus: "resolved",
      toStatus: "in_progress",
      note: operatorFeedback.trim()
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "rejected",
        message: `تم رفض الإصلاح: ${operatorFeedback.trim()}`,
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error reopening ticket:", error);
    return { status: "error", message: error.message };

  }

}
