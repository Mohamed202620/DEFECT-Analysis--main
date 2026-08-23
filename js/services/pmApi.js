// ============================================================
// pmApi.js
// الصيانة الوقائية (Preventive Maintenance) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../config.js";

import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ============================================================
// PREVENTIVE MAINTENANCE (PM) - سجل الصيانة الوقائية
// ============================================================


/**
 * حفظ نموذج صيانة وقائية (PM) في مجموعة "pmRecords"
 */
export async function savePmApi(payload) {

  try {

    const docRef = await addDoc(
      collection(db, "pmRecords"),
      {
        ...payload,
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم حفظ نموذج الصيانة الوقائية بنجاح"
    };

  } catch (error) {

    console.error("Error saving PM record:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}


// إضافة جديدة: جلب كل سجلات الصيانة الوقائية - لم تكن موجودة أصلاً
// (pmApi.js كان فيه حفظ فقط، بدون أي قراءة). مطلوبة لصفحة "البحث
// والفلترة المتقدمة" الجديدة (maintenanceSearch) عشان تقدر تجمع
// سجلات الـ PM مع بلاغات الأعطال في نفس النتائج - بنفس أسلوب/شكل
// النتيجة المُستخدم في fetchTicketsApi (services/ticketsApi.js)
export async function fetchPmRecordsApi() {

  try {

    const q = query(
      collection(db, "pmRecords"),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach(docSnap => {
      records.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: records };

  } catch (error) {

    // لو orderBy فشل لأي سبب (زي عدم وجود createdAt على سجلات قديمة
    // جداً)، نرجع بدون ترتيب بدل ما نكسر الصفحة بالكامل
    console.error("Error fetching PM records (with orderBy):", error);

    try {
      const fallbackSnap = await getDocs(collection(db, "pmRecords"));
      const records = [];
      fallbackSnap.forEach(docSnap => {
        records.push({ id: docSnap.id, ...docSnap.data() });
      });
      records.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return { status: "success", data: records };
    } catch (fallbackError) {
      console.error("Error fetching PM records (fallback):", fallbackError);
      return { status: "error", message: fallbackError.message };
    }

  }

}


