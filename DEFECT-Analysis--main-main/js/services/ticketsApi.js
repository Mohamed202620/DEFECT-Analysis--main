// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets/Issues) - حفظ / جلب / تحديث الحالة
// جزء مستخرج من services/api.js بدون أي تغيير في المنطق أو
// الأسماء المُصدَّرة.
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
 * جلب التذاكر
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
// UPDATE TICKET
// ============================================================


/**
 * تحديث حالة التذكرة
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


