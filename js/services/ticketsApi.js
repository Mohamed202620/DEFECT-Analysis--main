// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets/Issues) - حفظ / جلب / دورة حياة التذكرة
// الحالات: pending -> assigned -> resolved -> closed
//                              resolved -> reopened -> resolved ...
// ============================================================

import { db } from "../config.js";
import { uploadBase64Image } from "./imageUpload.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy
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
  payload
) {

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

    console.error("Error fetching pending tickets:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3 - لوحة الفني: التذاكر المُسندة له (جديدة أو مرفوضة ومُعادة)
 */
export async function fetchTicketsForTechnicianApi(technicianName) {

  try {

    const q =
      query(
        collection(db, "tickets"),
        where("assignedTo", "==", technicianName),
        where("status", "in", ["assigned", "reopened"]),
        orderBy("createdAt", "desc")
      );

    const querySnapshot = await getDocs(q);

    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: tickets };

  } catch (error) {

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

    console.error("Error fetching resolved tickets:", error);
    return { status: "error", message: error.message };

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

    return { status: "success" };

  } catch (error) {

    console.error("Error assigning ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 3 - الفني ينهي الإصلاح ويضيف ملاحظاته.
 * assigned | reopened -> resolved
 */
export async function resolveTicketApi(ticketId, mechanicNotes) {

  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "mechanicNotes مطلوبة لإغلاق التذكرة كمُصلَحة" };
  }

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "resolved",
        mechanicNotes: mechanicNotes.trim()
      })
    );

    return { status: "success" };

  } catch (error) {

    console.error("Error resolving ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4A - المُبلّغ يفحص الماكينة ويوافق على الإصلاح.
 * resolved -> closed
 */
export async function closeTicketApi(ticketId) {

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({ status: "closed" })
    );

    return { status: "success" };

  } catch (error) {

    console.error("Error closing ticket:", error);
    return { status: "error", message: error.message };

  }

}


/**
 * STEP 4B - المُبلّغ يرفض الإصلاح ويعيد التذكرة لقائمة الفني.
 * resolved -> reopened
 */
export async function reopenTicketApi(ticketId, operatorFeedback) {

  if (!operatorFeedback || !operatorFeedback.trim()) {
    return { status: "error", message: "operatorFeedback مطلوبة لإعادة فتح التذكرة" };
  }

  try {

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "reopened",
        operatorFeedback: operatorFeedback.trim()
      })
    );

    return { status: "success" };

  } catch (error) {

    console.error("Error reopening ticket:", error);
    return { status: "error", message: error.message };

  }

}
