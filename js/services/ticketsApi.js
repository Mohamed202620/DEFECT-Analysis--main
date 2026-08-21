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

export async function saveIssueApi(payload, { skipOfflineQueue = false } = {}) {
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
    const { image, ...restPayload } = payload;
    const issueId = payload.issueId || ("IS-" + Date.now());
    const imageUrl = await uploadBase64Image(image, issueId);

    const docRef = await addDoc(collection(db, "tickets"), {
      ...restPayload,
      issueId,
      ...(imageUrl && { imageUrl }),
      status: payload?.status || "pending",
      createdAt: payload?.createdAt || new Date().toISOString()
    });

    return { status: "success", id: docRef.id };
  } catch (error) {
    console.error("Error saving issue/ticket:", error);
    return { status: "error", message: error.message };
  }
}

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
    }
  }
  return { status: "success", synced, total: queued.length };
}

// TICKETS
// ============================================================

export async function fetchTicketsApi() {
  try {
    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: tickets };
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return { status: "error", message: error.message };
  }
}

export async function fetchPendingTicketsApi() {
  try {
    const q = query(
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

export async function fetchTicketsForTechnicianApi(technicianName) {
  try {
    const q = query(
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

export async function fetchResolvedTicketsApi() {
  try {
    const q = query(
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

// ============================================================
// Real-time Listener للوحة متابعة التذاكر حسب الدور والتبويب
// ============================================================

function createSnapshotListener(q, context, callback) {
  return onSnapshot(
    q,
    (querySnapshot) => {
      const tickets = [];
      querySnapshot.forEach(docSnap => {
        tickets.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback({ status: "success", data: tickets });
    },
    (error) => {
      const fallback = emptyResultOnMissingIndex(error, context);
      if (fallback) {
        callback(fallback);
        return;
      }
      console.error(`Error in ${context}:`, error);
      callback({ status: "error", message: error.message });
    }
  );
}

export function subscribeToTicketsBoardApi({ role, myUid, myName, status }, callback) {
  try {

    // 1. تبويب "بلاغاتي" (My Tickets) - التذاكر التي قام المستخدم بإنشائها
    if (status === "my_tickets") {
      const field = myUid ? "reportedByUid" : "reportedBy";
      const val = myUid || myName;
      const q = query(
        collection(db, "tickets"),
        where(field, "==", val),
        orderBy("createdAt", "desc")
      );
      return createSnapshotListener(q, "subscribeToTicketsBoardApi(my_tickets)", callback);
    }

    // 2. تبويب "المُسندة إليّ" (Assigned To Me) - التذاكر المُسندة للفني وقيد التنفيذ
    if (status === "assigned_to_me") {
      const field = myUid ? "assignedToUid" : "assignedTo";
      const val = myUid || myName;
      const q = query(
        collection(db, "tickets"),
        where(field, "==", val),
        where("status", "in", ["assigned", "in_progress", "reopened"]),
        orderBy("createdAt", "desc")
      );
      return createSnapshotListener(q, "subscribeToTicketsBoardApi(assigned_to_me)", callback);
    }

    // 3. تبويب "بانتظار تأكيدي" (Awaiting Confirm) - بلاغات أصلحها الفني وتنتظر مراجعة مُنشئ البلاغ
    if (status === "awaiting_confirm") {
      const field = myUid ? "reportedByUid" : "reportedBy";
      const val = myUid || myName;
      const q = query(
        collection(db, "tickets"),
        where(field, "==", val),
        where("status", "==", "resolved"),
        orderBy("createdAt", "desc")
      );
      return createSnapshotListener(q, "subscribeToTicketsBoardApi(awaiting_confirm)", callback);
    }

    // 4. الفلاتر العامة (خاصة بالأدمن/المدير أو عند اختيار "الكل")
    const STATUS_QUERY_ALIASES = {
      pending: ["pending", "open"],
      in_progress: ["in_progress", "reopened", "assigned"]
    };

    const statusClauses = () => {
      if (!status || status === "all") return [];
      const values = STATUS_QUERY_ALIASES[status];
      return values
        ? [where("status", "in", values)]
        : [where("status", "==", status)];
    };

    if (role === "admin" || role === "manager") {
      const q = query(
        collection(db, "tickets"),
        ...statusClauses(),
        orderBy("createdAt", "desc")
      );
      return createSnapshotListener(q, "subscribeToTicketsBoardApi(admin/manager)", callback);
    }

    // استعلام مزدوج كمرجع للفنيين في حالة اختيار تبويب عام مثل "الكل"
    let reportedTickets = [];
    let assignedTickets = [];
    let reportedReady = false;
    let assignedReady = false;

    const emitMerged = () => {
      if (!reportedReady || !assignedReady) return;
      const merged = new Map();
      [...reportedTickets, ...assignedTickets].forEach(t => merged.set(t.id, t));
      const tickets = Array.from(merged.values()).sort(
        (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      callback({ status: "success", data: tickets });
    };

    const handleBranchError = (error, context, markBranchReady) => {
      const fallback = emptyResultOnMissingIndex(error, context);
      if (fallback) {
        markBranchReady();
        return;
      }
      console.error(`Error in ${context}:`, error);
      callback({ status: "error", message: error.message });
    };

    const unsubReported = onSnapshot(
      query(
        collection(db, "tickets"),
        where("reportedBy", "==", myName),
        ...statusClauses(),
        orderBy("createdAt", "desc")
      ),
      (querySnapshot) => {
        reportedTickets = [];
        querySnapshot.forEach(docSnap => {
          reportedTickets.push({ id: docSnap.id, ...docSnap.data() });
        });
        reportedReady = true;
        emitMerged();
      },
      (error) => handleBranchError(error, "subscribeToTicketsBoardApi(reportedBy)", () => {
        reportedTickets = [];
        reportedReady = true;
        emitMerged();
      })
    );

    const unsubAssigned = onSnapshot(
      query(
        collection(db, "tickets"),
        where("assignedTo", "==", myName),
        ...statusClauses(),
        orderBy("createdAt", "desc")
      ),
      (querySnapshot) => {
        assignedTickets = [];
        querySnapshot.forEach(docSnap => {
          assignedTickets.push({ id: docSnap.id, ...docSnap.data() });
        });
        assignedReady = true;
        emitMerged();
      },
      (error) => handleBranchError(error, "subscribeToTicketsBoardApi(assignedTo)", () => {
        assignedTickets = [];
        assignedReady = true;
        emitMerged();
      })
    );

    return () => {
      unsubReported();
      unsubAssigned();
    };

  } catch (error) {
    console.error("Error subscribing to tickets board:", error);
    callback({ status: "error", message: error.message });
    return () => {};
  }
}

export async function updateTicketStatusApi(ticketId, status, notes = "") {
  try {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, {
      status,
      notes,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || ""
    });
    return { status: "success" };
  } catch (error) {
    console.error("Error updating ticket:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// Helpers & Lifecycle
// ============================================================

function stampUpdate(extra = {}) {
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
    updatedBy: localStorage.getItem("name") || ""
  };
}

function isMissingIndexError(error) {
  return error?.code === "failed-precondition";
}

function emptyResultOnMissingIndex(error, context) {
  if (isMissingIndexError(error)) {
    console.warn(
      `[${context}] محتاج Index في Firestore - ` +
      `تم إخفاء الخطأ مؤقتاً. التفاصيل: ${error.message}`
    );
    return { status: "success", data: [] };
  }
  return null; 
}

async function addTicketLog(ticketId, { action, fromStatus, toStatus, note = "" }) {
  try {
    await addDoc(collection(db, "tickets", ticketId, "logs"), {
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
    console.error("Error adding ticket log:", error);
  }
}

export async function fetchTicketLogsApi(ticketId) {
  try {
    const q = query(collection(db, "tickets", ticketId, "logs"), orderBy("at", "asc"));
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

async function createNotification(forUid, { type, message, ticketId }) {
  if (!forUid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      forUid,
      type,
      message,
      ticketId,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

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

export async function markNotificationReadApi(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return { status: "success" };
  } catch (error) {
    console.error("Error marking notification read:", error);
    return { status: "error", message: error.message };
  }
}

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

export async function startTicketApi(ticketId) {
  try {
    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "in_progress" }));
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

export async function resolveTicketApi(ticketId, mechanicNotes, afterImages = []) {
  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "ملاحظات الفني مطلوبة" };
  }
  const images = (afterImages || []).filter(Boolean).slice(0, 3);
  if (!images.length) {
    return { status: "error", message: "لازم صورة واحدة على الأقل بعد الإصلاح (بحد أقصى 3)" };
  }
  try {
    const afterImageUrls = (
      await Promise.all(images.map((img, i) => uploadBase64Image(img, `${ticketId}_after_${i + 1}`)))
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

export async function closeTicketApi(ticketId) {
  try {
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "closed" }));
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

export async function rejectTicketApi(ticketId, reason) {
  if (!reason || !reason.trim()) {
    return { status: "error", message: "سبب الرفض مطلوب" };
  }
  try {
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "in_progress" }));
    addTicketLog(ticketId, {
      action: "reject",
      fromStatus: "resolved",
      toStatus: "in_progress",
      note: reason.trim()
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "rejected",
        message: `تم رفض إصلاح البلاغ لأن المشكلة لم تحل بالكامل - برجاء المراجعة`,
        ticketId
      });
    }
    return { status: "success" };
  } catch (error) {
    console.error("Error rejecting ticket:", error);
    return { status: "error", message: error.message };
  }
}

export async function reopenTicketApi(ticketId, reason) {
  if (!reason || !reason.trim()) {
    return { status: "error", message: "سبب إعادة الفتح مطلوب" };
  }
  try {
    const ticketRef = doc(db, "tickets", ticketId);
    
    await updateDoc(
      ticketRef,
      stampUpdate({ status: "pending" })
    );

    addTicketLog(ticketId, {
      action: "reopen",
      fromStatus: "closed",
      toStatus: "pending",
      note: reason.trim()
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error reopening ticket:", error);
    return { status: "error", message: error.message };
  }
}
