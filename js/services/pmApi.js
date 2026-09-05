// ============================================================
// pmApi.js
// الصيانة الوقائية (Preventive Maintenance) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";
import { getDepartmentForMachineValue, getCurrentUserMachineContext } from "../machines.js";

import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  where
} from "../providers/backend/index.js";


// ============================================================
// PREVENTIVE MAINTENANCE (PM) - سجل الصيانة الوقائية
// ============================================================


/**
 * حفظ نموذج صيانة وقائية (PM) في مجموعة "pmRecords"
 */
export async function savePmApi(payload) {

  try {

    // إصلاح (بند حرج - حماية سيرفرية لقيود القسم): نفس منطق
    // machineErrorsApi.js بالظبط - نحفظ قسم الماكينة الفعلي مع كل
    // سجل صيانة وقائية جديد
    const department =
      getDepartmentForMachineValue(payload?.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";

    const docRef = await addDoc(
      collection(db, "pmRecords"),
      {
        ...payload,
        department,
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


// ============================================================
// جلب سجلات الصيانة الوقائية لصفحة "البحث والفلترة المتقدمة"
// (maintenanceSearch) - بنفس فكرة fetchTicketsForSearchApi
// (ticketsApi.js): فلترة الصلاحيات على مستوى الاستعلام نفسه بدل جلب
// كل السجلات ثم فلترتها محلياً. isFullAccess بيتحدد من الصفحة نفسها
// (admin/manager/engineer). سجلات الـ PM ملهاش reportedBy/assignedTo
// زي التذاكر - المرجع الوحيد لصاحب السجل هو reporter.name (نفس
// الحقل المُستخدم أصلاً في الفلترة المحلية القديمة بالضبط)
// ============================================================
export async function fetchPmRecordsForSearchApi({ isFullAccess, myName }) {

  try {

    const pmRef = collection(db, "pmRecords");

    const q = isFullAccess
      ? query(pmRef)
      : query(pmRef, where("reporter.name", "==", myName || ""));

    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach(docSnap => {
      records.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: records };

  } catch (error) {
    console.error("Error fetching PM records for search:", error);
    return { status: "error", message: error.message };
  }

}


