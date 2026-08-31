// ============================================================
// holidaysApi.js
// إدارة الإجازات الرسمية (تواريخ العطلات الرسمية المستخدمة في
// كارت حضور الوردية - attendanceCard.js) - جزء جديد، بنفس أسلوب
// usersApi.js
//
// المجموعة "officialHolidays" في Firestore: كل مستند = {date:
// "YYYY-MM-DD", label: "اسم الإجازة", createdAt, createdBy}
// ============================================================

import { db } from "../config.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy
} from "../firebase.js";


// ============================================================
// FETCH
// ============================================================

// إضافة (تحسين الأداء): تخزين مؤقت بسيط في الذاكرة لمدة الجلسة -
// كانت fetchOfficialHolidaysApi بتتنادى بشكل مستقل من كل من
// holidaysManagement.js (شاشة الإدارة) وattendanceCard.js (كارت
// الحضور) في كل مرة تُعرض فيها الصفحة، رغم إن قائمة الإجازات
// الرسمية بطيئة التغيّر جداً. الكاش بيتصفّر تلقائياً بإعادة تحميل
// الصفحة، وبيتصفّر يدوياً بعد أي إضافة/حذف عشان الإدارة تشوف أثر
// تعديلها فوراً من غير ما تستنى انتهاء مدة الكاش
const HOLIDAYS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
let holidaysCache = null; // { data, fetchedAt }

function invalidateHolidaysCache() {
  holidaysCache = null;
}

/**
 * جلب كل الإجازات الرسمية مرتبة تصاعدياً حسب التاريخ - تُستخدم في
 * شاشة الإدارة (settings) وفي كارت الحضور (للتحقق هل اليوم إجازة
 * رسمية أم لا)
 */
export async function fetchOfficialHolidaysApi({ forceRefresh = false } = {}) {

  if (
    !forceRefresh &&
    holidaysCache &&
    (Date.now() - holidaysCache.fetchedAt) < HOLIDAYS_CACHE_TTL_MS
  ) {
    return { status: "success", data: holidaysCache.data };
  }

  try {

    const holidaysRef =
      collection(db, "officialHolidays");

    const q =
      query(holidaysRef, orderBy("date", "asc"));

    const querySnapshot =
      await getDocs(q);

    const holidays = [];

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      holidays.push({
        id: docSnap.id,
        date: String(data.date || "").trim(),
        label: String(data.label || "").trim()
      });
    });

    holidaysCache = { data: holidays, fetchedAt: Date.now() };

    return { status: "success", data: holidays };

  } catch (error) {

    console.error("Error fetching official holidays:", error);

    return { status: "error", message: error.message, data: [] };

  }

}


// ============================================================
// ADD
// ============================================================

/**
 * إضافة إجازة رسمية جديدة (أدمن فقط - راجع firestore.rules)
 */
export async function addOfficialHolidayApi(dateStr, label) {

  try {

    const cleanDate = String(dateStr || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return { status: "error", message: "التاريخ غير صحيح، يرجى اختيار تاريخ صالح." };
    }

    await addDoc(
      collection(db, "officialHolidays"),
      {
        date: cleanDate,
        label: String(label || "").trim() || "إجازة رسمية",
        createdAt: new Date().toISOString(),
        createdBy: localStorage.getItem("name") || "Admin"
      }
    );

    invalidateHolidaysCache();

    return { status: "success", message: "تم إضافة الإجازة الرسمية" };

  } catch (error) {

    console.error("Error adding official holiday:", error);

    return { status: "error", message: error.message };

  }

}


// ============================================================
// DELETE
// ============================================================

/**
 * حذف إجازة رسمية (أدمن فقط)
 */
export async function deleteOfficialHolidayApi(holidayId) {

  try {

    if (!holidayId) {
      return { status: "error", message: "معرف الإجازة غير موجود" };
    }

    await deleteDoc(doc(db, "officialHolidays", holidayId));

    invalidateHolidaysCache();

    return { status: "success", message: "تم حذف الإجازة الرسمية" };

  } catch (error) {

    console.error("Error deleting official holiday:", error);

    return { status: "error", message: error.message || "فشل حذف الإجازة" };

  }

}
