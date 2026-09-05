// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets/Issues) - حفظ / جلب / دورة حياة التذكرة
// الحالات: pending(جديد) -> assigned(تم الإسناد) -> in_progress(قيد التنفيذ)
//          -> resolved(بانتظار تأكيد المُبلغ) -> closed(مغلق) [نهائية]
//                                     resolved -> in_progress (رفض مع سبب)
// ============================================================

import { db, ensureAuthReady } from "../config.js";
import { uploadBase64Image, uploadBase64Images } from "./imageUpload.js";
import { getCurrentRole, isAdminRole, hasFullDataAccess } from "../permissions.js";
// إصلاح (تنظيف/Refactor): قائمة "الحالات المغلقة" بقت مستوردة من ملف
// ثوابت مشترك (ticketStatusConstants.js) بدل تعريفها محلياً هنا (كانت
// نفس القيم مكررة يدوياً في أكتر من ملف - workflow.js / statistics.js)
import { CLOSED_STATUSES, isOverdueTicket } from "../ticketStatusConstants.js";

// إضافة (تحسين الأداء - نطاق افتراضي للوحة التذاكر): حد أقصى لعدد
// التذاكر اللي بتترجع لتبويب "الكل"/"أعطال اليوم"/"بلاغات متأخرة" عند
// الأدمن/المدير (اللي بيرجّعوا كل تذكرة اتسجلت على الإطلاق بدون فلتر
// حالة). مع نمو البيانات مع الوقت (آلاف التذاكر) ده كان بيبطّئ اللوحة
// ويزوّد قراءات Firestore بلا داعي. باقي التبويبات (قيد الانتظار/قيد
// التنفيذ/مغلق...) بتفضل من غير حد لأن حجمها الطبيعي محدود أصلاً
// (تذاكر مفتوحة حالياً، مش الأرشيف كله)
const TICKETS_BOARD_DEFAULT_LIMIT = 300;
import { queueOfflineTicket, getQueuedTickets, removeQueuedTicket, queueOfflineAction, getQueuedActions, removeQueuedAction } from "./offlineQueue.js";
// إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): استيراد مباشر من
// usersApi.js (مش من services/api.js) عشان نتجنب Circular Import، بما
// إن api.js نفسه بيعمل Re-export من ticketsApi.js
import { fetchManagersAndAdminsApi } from "./usersApi.js";

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
  limit,
  onSnapshot,
  writeBatch,
  getCountFromServer
} from "../firebase.js";

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
    // دعم صورة واحدة (الاسم القديم "image" - للتوافق مع أي بيانات
    // قديمة مُخزَّنة محلياً في طابور offlineQueue من قبل هذا التحديث)
    // أو أكثر من صورة دفعة واحدة عبر "images" (الاسم الجديد)
    const { image, images, ...restPayload } = payload;
    const issueId = payload.issueId || ("IS-" + Date.now());
    const imageList = Array.isArray(images) ? images : (image ? [image] : []);
    const imageUrls = await uploadBase64Images(imageList, issueId);

    const docRef = await addDoc(collection(db, "tickets"), {
      ...restPayload,
      issueId,
      ...(imageUrls.length && { imageUrls }),
      status: payload?.status || "pending",
      createdAt: payload?.createdAt || new Date().toISOString()
    });

    // إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): قبل هذا
    // التحديث ما كانش فيه أي إشعار بيتبعت عند إنشاء بلاغ جديد (pending)-
    // المدير/الأدمن كان لازم يفتح لوحة البلاغات يدوياً عشان يعرف إن
    // فيه عطل جديد، وده بيتعارض مع هدف "استجابة سريعة" في بيئة مصنع.
    // هنا بنبعت إشعار لكل مدير/أدمن نشط فور نجاح إنشاء التذكرة. أي
    // فشل في الإرسال (مثلاً مشكلة شبكة مؤقتة) ما ينفعش يفشّل عملية
    // تسجيل البلاغ نفسها، فبنكتفي بتسجيله في الـ Console فقط
    notifyManagersOfNewTicket(docRef.id, restPayload).catch(error => {
      console.error("Error notifying managers of new ticket:", error);
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

// إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): مزامنة إجراءات
// دورة حياة التذكرة (بدء تنفيذ/تم الإصلاح/تأكيد الإغلاق) المخزّنة
// محلياً وقت انقطاع الإنترنت - بنفس نمط syncOfflineTicketsApi فوق
// بالظبط، بترتيب زمني (الأقدم أولاً) عشان دورة حياة كل تذكرة تتنفذ
// بنفس التسلسل اللي حصل بيه فعلياً. أي إجراء يفشل (مثلاً التذكرة
// اتحذفت أو تغيّرت حالتها من جهة تانية في الأثناء) بيفضل في الطابور
// للمحاولة تاني، ومفيش أي إجراء بيتفوّت صامتاً
export async function syncOfflineTicketActionsApi() {
  const queued = await getQueuedActions();
  if (!queued.length) {
    return { status: "success", synced: 0, total: 0 };
  }

  let synced = 0;
  for (const item of queued) {
    try {
      const { type, ticketId, payload } = item.action || {};
      let result;

      if (type === "start") {
        result = await startTicketApi(ticketId, { skipOfflineQueue: true });
      } else if (type === "resolve") {
        result = await resolveTicketApi(
          ticketId,
          payload?.mechanicNotes,
          payload?.afterImages,
          { skipOfflineQueue: true }
        );
      } else if (type === "close") {
        result = await closeTicketApi(ticketId, { skipOfflineQueue: true });
      } else if (type === "reassign") {
        result = await reassignTicketApi(
          ticketId,
          { assignedTo: payload?.assignedTo, assignedToUid: payload?.assignedToUid },
          { skipOfflineQueue: true }
        );
      } else {
        console.error("Unknown queued action type:", type);
        continue;
      }

      if (result.status === "success") {
        await removeQueuedAction(item.localId);
        synced++;
      }
    } catch (error) {
      console.error("Error syncing offline ticket action:", item.localId, error);
    }
  }
  return { status: "success", synced, total: queued.length };
}

// TICKETS
// ============================================================

// إصلاح M1: كانت الدالة بتجيب كل التذاكر دايماً بدون أي فلترة صلاحيات
// (مصدر بيانات كارتات لوحة المتابعة في الرئيسية عبر loadDashboardStats)
// بقت تاخد { role, myUid, myName } وتطبّق نفس منطق الصلاحيات المستخدم
// في subscribeToTicketsBoardApi / fetchTicketsForReportApi بالظبط:
// admin/manager = كل التذاكر، وباقي الأدوار (فني/مشغل/مهندس) = بلاغاتي
// (reportedBy) + المُسندة إليّ (assignedTo) فقط. تم إبقاء الاستدعاء
// بدون آرجيومنتس شغال (role/myUid/myName هيبقوا undefined) عشان أي
// استخدام قديم للدالة ميتكسرش، لكنه هيرجع النتيجة الفارغة/المقيّدة
// المناسبة لغير الأدمن/المدير بدل كل التذاكر.
export async function fetchTicketsApi({ role, myUid, myName, maxCount } = {}) {
  try {
    await ensureAuthReady();
    const ticketsRef = collection(db, "tickets");
    const isFullAccess = hasFullDataAccess(role);
    
    if (isFullAccess || !myName) {
      const clauses = [orderBy("createdAt", "desc")];
      if (maxCount) clauses.push(limit(maxCount));
      const q = query(ticketsRef, ...clauses);
      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(docSnap => {
        tickets.push({ id: docSnap.id, ...docSnap.data() });
      });
      return { status: "success", data: tickets };
    } else {
      const [reportedSnap, assignedSnap] = await Promise.all([
        getDocs(query(ticketsRef, where("reportedBy", "==", myName))),
        getDocs(query(ticketsRef, where("assignedTo", "==", myName)))
      ]);

      const merged = new Map();
      reportedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      assignedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      let tickets = Array.from(merged.values());
      tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (maxCount && tickets.length > maxCount) {
        tickets = tickets.slice(0, maxCount);
      }
      return { status: "success", data: tickets };
    }
  } catch (error) {
    console.error("Error fetching tickets with orderBy:", error);
    try {
      const fallbackSnap = await getDocs(collection(db, "tickets"));
      const tickets = [];
      fallbackSnap.forEach(docSnap => {
        tickets.push({ id: docSnap.id, ...docSnap.data() });
      });
      tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (maxCount && tickets.length > maxCount) {
        return { status: "success", data: tickets.slice(0, maxCount) };
      }
      return { status: "success", data: tickets };
    } catch (fallbackError) {
      console.error("Error in fallback fetchTicketsApi:", fallbackError);
      return { status: "error", message: fallbackError.message };
    }
  }
}

// ============================================================
// حساب أرقام كروت لوحة المتابعة الرئيسية (مفتوحة/تم إصلاحها/اليوم/الإجمالي)
// بدقة وسرعة من البيانات المحدثة
// ============================================================

export async function fetchTicketCountsApi() {
  try {
    const ticketsRes = await fetchTicketsApi();
    if (ticketsRes.status !== "success") {
      return ticketsRes;
    }
    const tickets = ticketsRes.data || [];
    const todayStr = new Date().toDateString();
    let open = 0;
    let closed = 0;
    let today = 0;
    let overdue = 0;

    tickets.forEach(ticket => {
      if (isClosedStatus(ticket.status)) {
        closed++;
      } else {
        open++;
      }
      if (ticket.createdAt) {
        const d = new Date(ticket.createdAt);
        if (!isNaN(d.getTime()) && d.toDateString() === todayStr) {
          today++;
        }
      }
      if (isOverdueTicket(ticket)) {
        overdue++;
      }
    });

    return {
      status: "success",
      data: {
        total: tickets.length,
        open,
        closed,
        today,
        overdue
      }
    };
  } catch (error) {
    console.error("Error calculating ticket counts:", error);
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
// Real-time Listener للوحة متابعة التذاكر حسب الدور والتبويب (مع الترتيب المحلي لمنع مشاكل الـ Indexes)
// ============================================================

export function subscribeToTicketsBoardApi({ role, myUid, myName, status }, callback) {
  try {
    const ticketsRef = collection(db, "tickets");

    // إصلاح M6: فلتر زمني "أعطال اليوم" - بنفس منطق حساب كارت "أعطال
    // اليوم" في loadDashboardStats (workflow.js) بالظبط (مقارنة
    // toDateString() مع تاريخ اليوم)، بغض النظر عن حالة التذكرة
    const isCreatedToday = (ticket) => {
      if (!ticket.createdAt) return false;
      const created = new Date(ticket.createdAt);
      if (isNaN(created.getTime())) return false;
      return created.toDateString() === new Date().toDateString();
    };

    const handleSnapshotWithoutOrder = (q, context) => {
      return onSnapshot(
        q,
        (querySnapshot) => {
          let tickets = [];
          querySnapshot.forEach(docSnap => {
            tickets.push({ id: docSnap.id, ...docSnap.data() });
          });
          // إصلاح M6: فلترة محلية بتاريخ اليوم (فوق أي فلتر حالة) لما
          // يكون الفلتر المطلوب "today" - نفس أسلوب فلترة التاريخ
          // المحلية المستخدم بالفعل في fetchTicketsForReportApi بدل أي
          // استعلام Firestore إضافي على createdAt (تفادياً لأي Composite Index)
          if (status === "today") {
            tickets = tickets.filter(isCreatedToday);
          }
          // إضافة (تحسين Workflow - كارت "بلاغات متأخرة"): فلترة محلية
          // بنفس دالة isOverdueTicket المستخدمة في حساب كارت الرئيسية
          // (workflow.js) بالظبط، عشان الفلتر يطابق الرقم الظاهر تماماً
          if (status === "overdue") {
            tickets = tickets.filter(t => isOverdueTicket(t));
          }
          // ترتيب محلياً حسب التاريخ من الأحدث للأقدم
          tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
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
    };

    // 1. تبويب "بلاغاتي" (My Tickets)
    if (status === "my_tickets") {
      const q = query(ticketsRef, where("reportedBy", "==", myName));
      return handleSnapshotWithoutOrder(q, "subscribeToTicketsBoardApi(my_tickets)");
    }

    // 2. تبويب "المُسندة إليّ" (Assigned To Me)
    if (status === "assigned_to_me") {
      const q = query(
        ticketsRef, 
        where("assignedTo", "==", myName),
        where("status", "in", ["assigned", "in_progress", "reopened"])
      );
      return handleSnapshotWithoutOrder(q, "subscribeToTicketsBoardApi(assigned_to_me)");
    }

    // 3. تبويب "بانتظار تأكيدي" (Awaiting Confirm)
    if (status === "awaiting_confirm") {
      const q = query(
        ticketsRef, 
        where("reportedBy", "==", myName),
        where("status", "==", "resolved")
      );
      return handleSnapshotWithoutOrder(q, "subscribeToTicketsBoardApi(awaiting_confirm)");
    }

    // 4. الفلاتر العامة (الأدمن والمدير)
    // إصلاح (تنظيف/Refactor): CLOSED_STATUSES بقت مستوردة من ملف الثوابت
    // المشترك بدل مصفوفة محلية مكررة (CLOSED_STATUSES_FOR_HOME_CARDS)
    // - عشان كارت "تم إصلاحها" في الرئيسية يفضل مطابق تماماً لنفس
    // منطق isClosedStatus في workflow.js حتى لو القائمة اتعدّلت مستقبلاً
    const STATUS_QUERY_ALIASES = {
      pending: ["pending", "open"],
      in_progress: ["in_progress", "reopened", "assigned"],
      fixed: CLOSED_STATUSES
    };

    const statusClauses = () => {
      if (!status || status === "all" || status === "today" || status === "overdue") return [];
      if (status === "open") {
        // إصلاح M2: كارت "أعطال مفتوحة" بيحسب رقمه كـ "كل حالة مش
        // مغلقة" (isClosedStatus === false) مش قائمة حالات مفتوحة
        // محددة سلفاً - فبدل تخمين قائمة "مفتوحة" ممكن تفوّت حالة جديدة
        // غير متوقعة، بنستخدم عكس بالظبط نفس قائمة الحالات المغلقة
        // (CLOSED_STATUSES) عشان الفلتر يطابق الرقم تماماً
        return [where("status", "not-in", CLOSED_STATUSES)];
      }
      const values = STATUS_QUERY_ALIASES[status];
      return values ? [where("status", "in", values)] : [where("status", "==", status)];
    };

    if (isAdminRole(role) || role === "manager" || role === "supervisor" || role === "engineer" || !["my_tickets", "assigned_to_me", "awaiting_confirm"].includes(status)) {
      const clauses = statusClauses();
      const q = clauses.length === 0
        ? query(ticketsRef, orderBy("createdAt", "desc"), limit(TICKETS_BOARD_DEFAULT_LIMIT))
        : query(ticketsRef, ...clauses);
      return handleSnapshotWithoutOrder(q, "subscribeToTicketsBoardApi(general)");
    }

    // الفنيين والمشغلين في الحالات الخاصة بـ (بلاغاتي / المسندة إليّ)
    let reportedTickets = [];
    let assignedTickets = [];
    let reportedReady = false;
    let assignedReady = false;

    const emitMerged = () => {
      if (!reportedReady || !assignedReady) return;
      const merged = new Map();
      [...reportedTickets, ...assignedTickets].forEach(t => merged.set(t.id, t));
      let tickets = Array.from(merged.values());
      if (status === "today") {
        tickets = tickets.filter(isCreatedToday);
      }
      if (status === "overdue") {
        tickets = tickets.filter(t => isOverdueTicket(t));
      }
      tickets.sort(
        (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      callback({ status: "success", data: tickets });
    };

    const unsubReported = onSnapshot(
      query(ticketsRef, where("reportedBy", "==", myName || ""), ...statusClauses()),
      (snapshot) => {
        reportedTickets = [];
        snapshot.forEach(docSnap => reportedTickets.push({ id: docSnap.id, ...docSnap.data() }));
        reportedReady = true;
        emitMerged();
      },
      () => { reportedTickets = []; reportedReady = true; emitMerged(); }
    );

    const unsubAssigned = onSnapshot(
      query(ticketsRef, where("assignedTo", "==", myName || ""), ...statusClauses()),
      (snapshot) => {
        assignedTickets = [];
        snapshot.forEach(docSnap => assignedTickets.push({ id: docSnap.id, ...docSnap.data() }));
        assignedReady = true;
        emitMerged();
      },
      () => { assignedTickets = []; assignedReady = true; emitMerged(); }
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

// ============================================================
// جلب تذاكر آخر N يوم لتقرير قابل للتصدير
// ============================================================
// إصلاح (أمان): كانت الدالة بتستقبل role/myUid/myName كباراميترات
// لكن من غير ما تستخدمهم خالص - النتيجة إن أي مستخدم (حتى فني عادي)
// كان بيقدر يضغط زر "تقرير شهري PDF" ويسحب كل تذاكر الشركة (مش بس
// بلاغاته هو). دلوقتي بتطبّق بالظبط نفس منطق الصلاحيات المُستخدم في
// fetchTicketsForSearchApi: وصول كامل (admin/manager/engineer) يجيب
// كل التذاكر، وإلا استعلامين where على reportedBy وassignedTo.
//
// تحسين (أداء): فلترة sinceISO بقت where("createdAt", ">=", sinceISO)
// على مستوى الاستعلام نفسه بدل الجلب الكامل ثم الفلترة محلياً - بيقلل
// عدد المستندات المقروءة فعلياً من Firestore في كل تقرير شهري.
// ⚠️ ده محتاج Composite Index جديد في Firestore لحالة الوصول المحدود
// (reportedBy+createdAt وassignedTo+createdAt) - راجع firestore.indexes.json
// المُرفق. لحد ما الـ Index يتنشر، أي محاولة هترجع نتيجة فاضية بأمان
// (عبر emptyResultOnMissingIndex) بدل ما توقع الصفحة، وهتتسجل تحذير
// في console يوضح الحاجة للـ Index.
export async function fetchTicketsForReportApi({ role, myUid, myName, sinceISO }) {
  try {
    const ticketsRef = collection(db, "tickets");
    const isFullAccess = hasFullDataAccess(role);
    const dateClause = sinceISO ? [where("createdAt", ">=", sinceISO)] : [];
    let tickets = [];

    if (isFullAccess) {
      const snap = await getDocs(query(ticketsRef, ...dateClause));
      snap.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
    } else {
      const [reportedSnap, assignedSnap] = await Promise.all([
        getDocs(query(ticketsRef, where("reportedBy", "==", myName || ""), ...dateClause)),
        getDocs(query(ticketsRef, where("assignedTo", "==", myName || ""), ...dateClause))
      ]);

      const merged = new Map();
      reportedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      assignedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      tickets = Array.from(merged.values());
    }

    tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return { status: "success", data: tickets };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchTicketsForReportApi");
    if (fallback) return fallback;
    console.error("Error fetching tickets for report:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// جلب بلاغات الأعطال لصفحة "البحث والفلترة المتقدمة" (maintenanceSearch)
// - نفس فكرة فلترة الصلاحيات على مستوى الاستعلام نفسه المُستخدمة في
//   fetchTicketsForReportApi فوق (بدل جلب كل شيء ثم فلترته محلياً)،
//   لكن isFullAccess بيتحدد من الصفحة نفسها (admin/manager/engineer -
//   راجع hasFullDataAccess في permissions.js) بدل تكرار شرط دور مختلف
//   هنا. بدون قيد تاريخ عند الجلب لأن فلتر التاريخ في الصفحة تفاعلي
//   على نفس النتائج المجلوبة مرة واحدة (بدون أي طلب إضافي لـ Firestore)
// ============================================================
export async function fetchTicketsForSearchApi({ isFullAccess, myUid, myName }) {
  try {
    const ticketsRef = collection(db, "tickets");

    if (isFullAccess) {
      const snap = await getDocs(query(ticketsRef));
      const tickets = [];
      snap.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
      return { status: "success", data: tickets };
    }

    // وصول محدود (فني/مهندس عادي): بلاغاته هو بس (بلّغ بيها أو
    // مُسندة إليه) - استعلامين بالاسم (نفس أسلوب subscribeToTicketsBoardApi
    // وfetchTicketsForReportApi) بدل استعلام واحد على كل التذاكر
    const [reportedSnap, assignedSnap] = await Promise.all([
      getDocs(query(ticketsRef, where("reportedBy", "==", myName || ""))),
      getDocs(query(ticketsRef, where("assignedTo", "==", myName || "")))
    ]);

    const merged = new Map();
    reportedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    assignedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: Array.from(merged.values()) };
  } catch (error) {
    console.error("Error fetching tickets for search:", error);
    return { status: "error", message: error.message };
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

// إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): يبعت إشعار "بلاغ
// جديد" لكل مدير/أدمن نشط في المصنع - راجع الاستدعاء في saveIssueApi
// فوق. بيتجاهل بأمان (من غير ما يرمي Exception) لو قايمة المدراء
// فاضية أو فشل الجلب، عشان أي مشكلة هنا ما تأثرش على نجاح تسجيل
// البلاغ نفسه اللي أصلاً خلص قبل ما الدالة دي تتنادى
async function notifyManagersOfNewTicket(ticketId, ticketData) {
  const machineLabel = ticketData?.machine || "";
  const reporterName = ticketData?.reportedBy || "";

  const message = machineLabel
    ? `بلاغ عطل جديد على "${machineLabel}"${reporterName ? ` من ${reporterName}` : ""}`
    : `تم تسجيل بلاغ عطل جديد${reporterName ? ` من ${reporterName}` : ""}`;

  const result = await fetchManagersAndAdminsApi();
  if (result.status !== "success" || !result.data.length) {
    return;
  }

  await Promise.all(
    result.data.map(manager =>
      createNotification(manager.id, {
        type: "new_ticket",
        message,
        ticketId
      })
    )
  );
}

// ملاحظة: بدون orderBy مع where عشان نتجنب الحاجة لـ Composite Index
// في Firestore - الترتيب بيتم محلياً بنفس أسلوب subscribeToTicketsBoardApi
export async function fetchMyNotificationsApi(uid) {
  try {
    const q = query(collection(db, "notifications"), where("forUid", "==", uid));
    const querySnapshot = await getDocs(q);
    const notifications = [];
    querySnapshot.forEach(docSnap => {
      notifications.push({ id: docSnap.id, ...docSnap.data() });
    });
    notifications.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { status: "success", data: notifications.slice(0, 30) };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchMyNotificationsApi");
    if (fallback) return fallback;
    console.error("Error fetching notifications:", error);
    return { status: "error", message: error.message };
  }
}

// اشتراك لحظي (Realtime) في إشعارات المستخدم - يُستخدم لتحديث
// الجرس والقائمة المنبثقة تلقائياً بدون إعادة تحميل
export function subscribeToMyNotificationsApi(uid, callback) {
  try {
    const q = query(collection(db, "notifications"), where("forUid", "==", uid));
    return onSnapshot(
      q,
      (querySnapshot) => {
        const notifications = [];
        querySnapshot.forEach(docSnap => {
          notifications.push({ id: docSnap.id, ...docSnap.data() });
        });
        notifications.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        callback({ status: "success", data: notifications.slice(0, 30) });
      },
      (error) => {
        const fallback = emptyResultOnMissingIndex(error, "subscribeToMyNotificationsApi");
        if (fallback) {
          callback(fallback);
          return;
        }
        console.error("Error subscribing to notifications:", error);
        callback({ status: "error", message: error.message });
      }
    );
  } catch (error) {
    console.error("Error subscribing to notifications:", error);
    callback({ status: "error", message: error.message });
    return () => {};
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

// تحديد كل إشعارات المستخدم الحالي كمقروءة دفعة واحدة (Batch Write)
// where("forUid","==") + where("read","==") فلترتين equality بس -> بدون Index
export async function markAllNotificationsAsRead(uid) {
  try {
    const q = query(
      collection(db, "notifications"),
      where("forUid", "==", uid),
      where("read", "==", false)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { status: "success", updated: 0 };
    }

    const batch = writeBatch(db);
    querySnapshot.forEach(docSnap => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();

    return { status: "success", updated: querySnapshot.size };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "markAllNotificationsAsRead");
    if (fallback) return { status: "success", updated: 0 };
    console.error("Error marking all notifications as read:", error);
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

// إضافة (تحسين Workflow - إعادة إسناد): للمدير/الأدمن بس - بتسمح
// بنقل تذكرة "تم الإسناد"/"قيد التنفيذ" لفني تاني (لو الفني الأصلي
// بقى غير متاح مثلاً) بدل ما التذكرة تفضل عالقة من غير أي تحرك. بترجع
// حالة التذكرة لـ "assigned" دايماً (حتى لو كانت in_progress) عشان
// الفني الجديد يبدأ التنفيذ بنفسه من الأول ويبقى في السجل واضح مين
// المسؤول فعلياً عن كل مرحلة
export async function reassignTicketApi(ticketId, { assignedTo, assignedToUid }, { skipOfflineQueue = false } = {}) {
  if (!assignedTo) {
    return { status: "error", message: "assignedTo مطلوب" };
  }

  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): لو مفيش نت،
  // منقدرش نتحقق من حالة التذكرة الحالية على السيرفر (getDoc) قبل ما
  // نسمح بإعادة الإسناد - فبنخزّن الإجراء محلياً "بشكل متفائل" (Optimistic)
  // ونأجّل التحقق الفعلي (هل التذكرة لسه assigned/in_progress؟) لحظة
  // المزامنة عند عودة الاتصال، بنفس أسلوب باقي إجراءات دورة حياة
  // التذكرة (start/resolve/close)
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({
        type: "reassign",
        ticketId,
        payload: { assignedTo, assignedToUid: assignedToUid || null }
      });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (إعادة الإسناد) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline reassign action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }

    const currentData = ticketSnap.data();
    const fromStatus = String(currentData.status || "").trim().toLowerCase();
    const previousAssignee = currentData.assignedTo || "غير محدد";

    // إعادة الإسناد مسموحة بس للتذاكر المفتوحة فعلياً (تم الإسناد/قيد
    // التنفيذ/معاد فتحها) - مش على تذاكر بانتظار تأكيد المُبلغ أو مغلقة
    // بالفعل، عشان منغيّرش مسؤول تذكرة خلصت مرحلتها
    if (!["assigned", "in_progress", "reopened"].includes(fromStatus)) {
      return {
        status: "error",
        message: "إعادة الإسناد متاحة فقط للتذاكر (تم الإسناد / قيد التنفيذ)"
      };
    }

    await updateDoc(
      ticketRef,
      stampUpdate({
        status: "assigned",
        assignedTo,
        assignedToUid: assignedToUid || null
      })
    );

    addTicketLog(ticketId, {
      action: "reassign",
      fromStatus,
      toStatus: "assigned",
      note: `إعادة إسناد من "${previousAssignee}" إلى "${assignedTo}"`
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "assigned",
        message: `تم إسناد بلاغ صيانة إليك (إعادة إسناد)`,
        ticketId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error reassigning ticket:", error);
    return { status: "error", message: error.message };
  }
}

export async function startTicketApi(ticketId, { skipOfflineQueue = false } = {}) {
  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): "بدء التنفيذ"
  // مايحتاجش أي بيانات إضافية من المستخدم، فلو مفيش نت بنخزّن الإجراء
  // محلياً فوراً ونرجّعه كـ "queued" بدل ما يفشل الطلب بلا أي بديل
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({ type: "start", ticketId });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (بدء التنفيذ) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline start action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

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

export async function resolveTicketApi(ticketId, mechanicNotes, afterImages = [], { skipOfflineQueue = false } = {}) {
  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "ملاحظات الفني مطلوبة" };
  }
  const images = (afterImages || []).filter(Boolean).slice(0, 3);
  if (!images.length) {
    return { status: "error", message: "لازم صورة واحدة على الأقل بعد الإصلاح (بحد أقصى 3)" };
  }

  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): نفس التحقق من
  // صحة البيانات فوق بيتنفذ الأول (عشان مدخلات ناقصة متتخزنش في
  // الطابور أصلاً)، وبعدين لو مفيش نت بنخزّن النص والصور (Base64) محلياً
  // ونرفعها فعلياً على ImgBB/Firestore لما الاتصال يرجع (نفس أسلوب
  // queueOfflineTicket تماماً)
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({
        type: "resolve",
        ticketId,
        payload: { mechanicNotes: mechanicNotes.trim(), afterImages: images }
      });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم رفع بيانات الإصلاح تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline resolve action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
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

export async function closeTicketApi(ticketId, { skipOfflineQueue = false } = {}) {
  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): "تأكيد
  // الإغلاق" برضه مايحتاجش بيانات إضافية - نفس أسلوب startTicketApi
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({ type: "close", ticketId });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (تأكيد الإغلاق) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline close action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

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

// ============================================================
// إضافة (تحسين Workflow - إجراءات جماعية Bulk Actions): تأكيد إغلاق
// أكتر من تذكرة "بانتظار تأكيد" مرة واحدة، بدل الضغط على كل تذكرة
// لوحدها. تحديث الحالة الفعلي لكل التذاكر بيتم في Batch واحد
// (writeBatch) - طلب واحد لـ Firestore بدل N طلب منفصل، وبعدين تسجيل
// الـ Log والإشعار لكل تذكرة بيحصل بالتوازي (منفصل عن الـ Batch لأن
// addDoc بيحتاج معرف تلقائي جديد، والهدف من الـ Batch هو التحديث
// الأساسي الذري بس). أي تذكرة مش بحالة "resolved" بيتم تجاهلها بأمان
// (مفيش إغلاق جماعي لتذاكر لسه قيد التنفيذ مثلاً)
// ============================================================
export async function bulkCloseTicketsApi(ticketIds) {
  if (!Array.isArray(ticketIds) || !ticketIds.length) {
    return { status: "error", message: "لم يتم تحديد أي تذكرة" };
  }

  try {
    // 1. قراءة كل التذاكر أولاً - للتحقق من إن الحالة "resolved" فعلاً
    // (المسموح إغلاقه جماعياً)، ولمعرفة assignedToUid لإرسال إشعار لاحقاً
    const snapshots = await Promise.all(
      ticketIds.map(id => getDoc(doc(db, "tickets", id)))
    );

    const validIds = [];
    const assigneeByTicket = {};

    snapshots.forEach((snap, i) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (String(data.status || "").trim().toLowerCase() !== "resolved") return;
      const id = ticketIds[i];
      validIds.push(id);
      assigneeByTicket[id] = data.assignedToUid || null;
    });

    if (!validIds.length) {
      return { status: "error", message: "لا توجد تذاكر صالحة للإغلاق الجماعي (بانتظار تأكيد فقط)" };
    }

    // 2. تحديث الحالة لكل التذاكر الصالحة في Batch واحد (ذرّي - إما
    // كلها تنجح أو كلها تفشل مع بعض)
    const batch = writeBatch(db);
    validIds.forEach(id => {
      batch.update(doc(db, "tickets", id), stampUpdate({ status: "closed" }));
    });
    await batch.commit();

    // 3. تسجيل Log + إشعار لكل تذكرة بالتوازي (بعد نجاح التحديث الأساسي)
    await Promise.all(validIds.map(async id => {
      addTicketLog(id, { action: "close", fromStatus: "resolved", toStatus: "closed" });
      const assignedToUid = assigneeByTicket[id];
      if (assignedToUid) {
        createNotification(assignedToUid, {
          type: "closed",
          message: `تم تأكيد إغلاق البلاغ - شكراً لك`,
          ticketId: id
        });
      }
    }));

    return {
      status: "success",
      closedCount: validIds.length,
      skippedCount: ticketIds.length - validIds.length
    };
  } catch (error) {
    console.error("Error bulk closing tickets:", error);
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

    // إصلاح (تصحيح Workflow - رفض المُبلّغ): البلاغ المرفوض بيرجع
    // مباشرة لنفس الفني المُسند إليه بحالة "reopened" (بدل "pending")
    // عشان يكمل الشغل من غير ما يحتاج مدير/أدمن يعيد إسناده من الأول.
    // "reopened" ده أصلاً معرّفة بالكامل في الترجمات والفلاتر
    // (ticketStatusConstants.js, ticketsApi.js, permissions.js) لكن
    // محدش كان بيحطها فعلياً - كانت بترجع pending دايماً
    await updateDoc(
      ticketRef,
      stampUpdate({ status: "reopened" })
    );

    addTicketLog(ticketId, {
      action: "reopen",
      // إصلاح: كانت مسجلة "closed" وهو غلط - الرفض بيحصل من حالة
      // "resolved" فعلياً (مفيش زرار رفض إلا على تذكرة resolved)
      fromStatus: "resolved",
      toStatus: "reopened",
      note: reason.trim()
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error reopening ticket:", error);
    return { status: "error", message: error.message };
  }
}
