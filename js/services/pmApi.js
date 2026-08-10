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
  query,
  orderBy
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


/**
 * جلب سجل الصيانة الوقائية (لعرضه في صفحة PM وفي التقارير)
 */
export async function fetchPmRecordsApi() {

  try {

    const q = query(collection(db, "pmRecords"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const records = [];
    querySnapshot.forEach(docSnap => records.push({ id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: records };

  } catch (error) {

    console.error("Error fetching PM records:", error);
    return { status: "error", message: error.message };

  }

}
