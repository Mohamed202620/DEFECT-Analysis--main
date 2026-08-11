// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets) - دورة حياة كاملة:
//
//   pending (جديد) -> assigned (تم الإسناد) -> in_progress (قيد التنفيذ)
//   -> awaiting_confirmation (بانتظار تأكيد المُبلغ) -> closed (مغلق)
//
//   الاستثناء الوحيد للرجوع للخلف:
//   awaiting_confirmation -> in_progress (لو المُبلّغ رفض الإصلاح)
//
// كل انتقال حالة بيتسجّل تلقائياً كـ Log غير قابل للتعديل/الحذف في
// tickets/{ticketId}/logs/{logId}، وبيبعت إشعار داخلي (notifications)
// للطرف المعني بالخطوة الجاية.
// ============================================================

import { db } from "../config.js";
import { uploadBase64Image, uploadTicketImages } from "./imageUpload.js";
import { createNotificationApi } from "./notificationsApi.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy
  ,onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ============================================================
// Helpers
// ============================================================

function currentUser() {
  return {
    uid: localStorage.getItem("userId") || "",
    name: localStorage.getItem("name") || "",
    role: (localStorage.getItem("role") || "").trim().toLowerCase()
  };
}

function stampUpdate(extra = {}) {
  const me = currentUser();
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
    updatedBy: me.name
  };
}

/**
 * إضافة سطر Log غير قابل للتعديل/الحذف لتذكرة معيّنة (راجع
 * firestore.rules -> match /tickets/{ticketId}/logs/{logId}:
 * مسموح create فقط، مفيش أي قاعدة update/delete = ممنوعة تلقائياً)
 */
async function addTicketLogApi(ticketId, action, message, meta = {}) {

  const me = currentUser();

  try {

    await addDoc(
      collection(db, "tickets", ticketId, "logs"),
      {
        action,
        message,
        by: me.name,
        byUid: me.uid,
        byRole: me.role,
        createdAt: new Date().toISOString(),
        ...meta
      }
    );

  } catch (error) {
    // فشل تسجيل الـ Log ميوقفش العملية الأساسية (تغيير الحالة) -
    // بنسجّل الخطأ بس في الكونسول عشان نراجعه لاحقاً
    console.error(`Error adding ticket log (${action}):`, error);
  }

}

/**
 * جلب سجل العمليات الكامل لتذكرة (تُستخدم في صفحة TicketDetails
 * لعرض الـ Timeline الرأسي)
 */
export async function fetchTicketLogsApi(ticketId) {

  try {

    const q = query(
      collection(db, "tickets", ticketId, "logs"),
      orderBy("createdAt", "asc")
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


// ============================================================
// ISSUES / TICKETS - إنشاء وجلب
// ============================================================


/**
 * حفظ بلاغ عطل جديد (يُستخدم من IssueView / workflow.js -> confirmIssue)
 */
export async function saveIssueApi(payload) {

  try {

    const { image, ...restPayload } = payload;

    const issueId = payload.issueId || ("IS-" + Date.now());

    const imageUrl = await uploadBase64Image(image, issueId);

    const docRef = await addDoc(
      collection(db, "tickets"),
      {
        ...restPayload,
        issueId,
        ...(imageUrl && { imageUrl }),
        // دورة حياة التذكرة تبدأ دائماً بـ pending (جديد)
        status: payload?.status || "pending",
        createdAt: payload?.createdAt || new Date().toISOString()
      }
    );

    await addTicketLogApi(docRef.id, "created", "تم إنشاء البلاغ");

    return { status: "success", id: docRef.id };

  } catch (error) {

    console.error("Error saving issue/ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * جلب كل التذاكر (لوحة الإحصائيات العامة - loadDashboardStats)
 */
export async function fetchTicketsApi() {

  try {

    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
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


/**
 * جلب تذكرة واحدة بالتفصيل (صفحة TicketDetails)
 */
export async function fetchTicketByIdApi(ticketId) {

  try {

    const snap = await getDoc(doc(db, "tickets", ticketId));

    if (!snap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }

    return { status: "success", data: { id: snap.id, ...snap.data() } };

  } catch (error) {

    console.error("Error fetching ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * جلب التذاكر المناسبة للوحة الإحصائيات (home/stats) حسب دور
 * المستخدم الحالي - بديل عن fetchTicketsApi() غير المُقيّد، عشان
 * يتوافق مع قاعدة قراءة القائمة الجديدة في firestore.rules (كل
 * دور يقدر يقرأ بس التذاكر المصرّح له بيها: أدمن/مدير كل شيء،
 * الفني تذاكره، المُبلّغ تذاكره - بدون فلترة status هنا عمداً
 * عشان الإحصائيات تشمل تاريخه الكامل مش بس التذاكر النشطة حالياً)
 */
export async function fetchTicketsForDashboardApi() {

  const role = (localStorage.getItem("role") || "").trim().toLowerCase();
  const myUid = localStorage.getItem("userId") || "";

  try {

    if (role === "admin" || role === "manager") {
      return await fetchTicketsApi();
    }

    if (role === "technician" || role === "engineer") {
      const q = query(collection(db, "tickets"), where("assignedToUid", "==", myUid));
      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
      return { status: "success", data: tickets };
    }

    if (role === "operator") {
      const q = query(collection(db, "tickets"), where("reportedByUid", "==", myUid));
      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
      return { status: "success", data: tickets };
    }

    return { status: "success", data: [] };

  } catch (error) {

    console.error("Error fetching dashboard tickets:", error);
    return { status: "error", message: error.message };

  }

}


// ============================================================
// استعلامات لوحات المتابعة حسب الدور
// ============================================================
//
// ملحوظة عن الفهارس (Indexes): أول استدعاء لأي استعلام فيه
// where() متعدد أو where()+orderBy() على حقول مختلفة، Firestore
// هيطبع رسالة خطأ في الـ Console فيها رابط مباشر لإنشاء الـ
// composite index تلقائياً - افتحوا الرابط واضغطوا Create مرة واحدة.
// ============================================================


/**
 * لوحة مدير الصيانة/الأدمن: تذاكر "جديد" بانتظار التصنيف والإسناد
 */
export async function fetchPendingTicketsApi() {

  try {

    const q = query(
      collection(db, "tickets"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: tickets };

  } catch (error) {

    console.error("Error fetching pending tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * لوحة الفني: تذاكره (تم الإسناد + قيد التنفيذ)، أو كل التذاكر
 * النشطة لو أدمن/مدير عايز يشوفها كلها (allTickets = true)
 */
export async function fetchTicketsForTechnicianApi(technicianUid, { allTickets = false } = {}) {

  try {

    const constraints = [
      where("status", "in", ["assigned", "in_progress"]),
      orderBy("createdAt", "desc")
    ];

    if (!allTickets) {
      constraints.unshift(where("assignedToUid", "==", technicianUid));
    }

    const q = query(collection(db, "tickets"), ...constraints);
    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: tickets };

  } catch (error) {

    console.error("Error fetching technician tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * لوحة المُبلّغ: تذاكره اللي بانتظار تأكيده هو تحديداً، أو كل
 * التذاكر بانتظار تأكيد لو أدمن/مدير (allTickets = true) - راجع
 * ملحوظة الفهارس فوق: التصفية بـ reportedByUid لازم تبقى جزء من
 * الاستعلام نفسه (مش فلترة بعد الجلب) عشان تتوافق مع قاعدة قراءة
 * القائمة (list) في firestore.rules.
 */
export async function fetchAwaitingConfirmationTicketsApi(reporterUid, { allTickets = false } = {}) {

  try {

    const constraints = [
      where("status", "==", "awaiting_confirmation"),
      orderBy("createdAt", "desc")
    ];

    if (!allTickets) {
      constraints.unshift(where("reportedByUid", "==", reporterUid));
    }

    const q = query(collection(db, "tickets"), ...constraints);
    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: tickets };

  } catch (error) {

    console.error("Error fetching awaiting-confirmation tickets:", error);
    return { status: "error", message: error.message };

  }

}


// ============================================================
// UPDATE TICKET (دالة عامة قديمة - لسه متاحة لأي استخدام موجود)
// ============================================================

export async function updateTicketStatusApi(ticketId, status, notes = "") {

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status, notes })
    );

    return { status: "success" };

  } catch (error) {

    console.error("Error updating ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * Real-time listener: جلب التذاكر المخصّصة للمستخدم الحالي (غير المغلقة)
 * onUpdate: callback يُستدعى عند كل تحديث => onUpdate({ status, data })
 * Returns: unsubscribe function
 */
export function getMyTickets(onUpdate) {

  const myUid = currentUser().uid;

  try {

    const q = query(
      collection(db, "tickets"),
      where("assignedToUid", "==", myUid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tickets = [];
      querySnapshot.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (data.status !== "closed") tickets.push(data);
      });
      onUpdate && onUpdate({ status: "success", data: tickets });
    }, (error) => {
      console.error("getMyTickets onSnapshot error:", error);
      onUpdate && onUpdate({ status: "error", message: error.message });
    });

    return unsubscribe;

  } catch (error) {
    console.error("Error setting up my tickets listener:", error);
    onUpdate && onUpdate({ status: "error", message: error.message });
    return () => {};
  }

}


// ============================================================
// دورة حياة التذكرة (Ticket Lifecycle Transitions)
// ============================================================


/**
 * STEP 2 - مدير الصيانة/الأدمن يصنّف التذكرة ويسندها لفني.
 * pending -> assigned
 */
export async function assignTicketApi(ticketId, { type, assignedTo, assignedToUid }) {

  if (!type || !assignedTo || !assignedToUid) {
    return { status: "error", message: "type و assignedTo و assignedToUid مطلوبين" };
  }

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "assigned", type, assignedTo, assignedToUid })
    );

    await addTicketLogApi(ticketId, "assigned", `تم إسناد التذكرة إلى ${assignedTo} (${type})`, { assignedTo, assignedToUid, type });

    await createNotificationApi({
      userId: assignedToUid,
      title: "تذكرة جديدة مُسندة إليك",
      message: `تم إسناد بلاغ (${type}) إليك`,
      ticketId
    });

    return { status: "success" };

  } catch (error) {

    console.error("Error assigning ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3A - الفني يبدأ التنفيذ فعلياً.
 * assigned -> in_progress
 */
export async function startTicketApi(ticketId) {

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "in_progress" })
    );

    await addTicketLogApi(ticketId, "started", "بدأ الفني تنفيذ الإصلاح");

    return { status: "success" };

  } catch (error) {

    console.error("Error starting ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3B - الفني ينهي الإصلاح: يضيف ملاحظاته ويرفع 1-3 صور
 * (عبر ImgBB - نفس أسلوب باقي صور النظام) - التذكرة منتقلتش
 * لمغلقة، بل بانتظار تأكيد المُبلّغ.
 * in_progress -> awaiting_confirmation
 */
export async function completeTicketApi(ticketId, mechanicNotes, imageFiles = []) {

  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "mechanicNotes مطلوبة لتسجيل إتمام الإصلاح" };
  }

  const fileList = Array.from(imageFiles || []);
  if (fileList.length < 1) {
    return { status: "error", message: "لازم ترفع صورة واحدة على الأقل للإصلاح (بحد أقصى 3)" };
  }
  if (fileList.length > 3) {
    return { status: "error", message: "الحد الأقصى 3 صور فقط" };
  }

  try {

    let imageUrls = [];
    try {
      imageUrls = await uploadTicketImages(ticketId, fileList);
    } catch (uploadError) {
      return { status: "error", message: uploadError.message };
    }

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "awaiting_confirmation",
        mechanicNotes: mechanicNotes.trim(),
        repairImages: imageUrls
      })
    );

    await addTicketLogApi(ticketId, "completed", "أنهى الفني الإصلاح وبانتظار تأكيد المُبلّغ", {
      mechanicNotes: mechanicNotes.trim(),
      images: imageUrls
    });

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const reportedByUid = ticketSnap.exists() ? ticketSnap.data().reportedByUid : null;

    if (reportedByUid) {
      await createNotificationApi({
        userId: reportedByUid,
        title: "بلاغك بانتظار تأكيدك",
        message: "الفني أنهى الإصلاح - يرجى فحص الماكينة وتأكيد الحالة",
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error completing ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4A - المُبلّغ يفحص الماكينة ويؤكد إن الإصلاح تم فعلاً.
 * awaiting_confirmation -> closed
 */
export async function confirmTicketApi(ticketId) {

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "closed" })
    );

    await addTicketLogApi(ticketId, "confirmed", "أكّد المُبلّغ إتمام الإصلاح - تم إغلاق التذكرة");

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    if (assignedToUid) {
      await createNotificationApi({
        userId: assignedToUid,
        title: "تم إغلاق التذكرة",
        message: "المُبلّغ أكّد الإصلاح وتم إغلاق التذكرة",
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error confirming ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4B - المُبلّغ يرفض الإصلاح ويكتب السبب - الاستثناء
 * الوحيد للرجوع للخلف في دورة حياة التذكرة.
 * awaiting_confirmation -> in_progress
 */
export async function rejectTicketApi(ticketId, operatorFeedback) {

  if (!operatorFeedback || !operatorFeedback.trim()) {
    return { status: "error", message: "operatorFeedback مطلوبة لرفض الإصلاح" };
  }

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "in_progress",
        operatorFeedback: operatorFeedback.trim()
      })
    );

    await addTicketLogApi(ticketId, "rejected", `رفض المُبلّغ الإصلاح: ${operatorFeedback.trim()}`, {
      operatorFeedback: operatorFeedback.trim()
    });

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    if (assignedToUid) {
      await createNotificationApi({
        userId: assignedToUid,
        title: "تم رفض الإصلاح",
        message: `المُبلّغ رفض الإصلاح: ${operatorFeedback.trim()}`,
        ticketId
      });
    }

    return { status: "success" };

  } catch (error) {

    console.error("Error rejecting ticket:", error);
    return { status: "error", message: error.message };

  }

}
