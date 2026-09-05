// ============================================================
// machinesApi.js
// إدارة "قائمة أنواع الماكينات" (Firestore) - نفس أسلوب
// holidaysApi.js/usersApi.js.
//
// المجموعة "machineTypes" في Firestore: كل مستند =
// {
//   key: "Bodymaker",           // اسم نوع الماكينة (فريد)
//   units: ["01", "02", ...],   // وحدات فرعية مرقّمة/مسمّاة، أو [] لو مفيش
//   active: true,                // false = معطّل (مخفي من فورمات الإنشاء
//                                 // الجديدة، لكن يفضل ظاهر في فلاتر البحث
//                                 // عشان البلاغات القديمة المرتبطة بيه)
//   order: 10,                   // ترتيب العرض
//   createdAt, updatedAt, updatedBy
// }
//
// هذه المجموعة هي "مصدر الحقيقة" الوحيد لقائمة الماكينات في التطبيق
// كله - راجع js/machines.js اللي بيحمّل منها ويغذّي كل الشاشات
// التانية (تسجيل عطل / كايزن / فاحص الأعطال / بحث الصيانة).
// ============================================================

import { db } from "../providers/backend/index.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "../providers/backend/index.js";

import { getCurrentRole, isAdminRole } from "../permissions.js";

// تطبيع قيمة القسم (Backend/Frontend) - أي قيمة غير "frontend" بالظبط
// (فاضية، غير موجودة، أو ماكينة قديمة اتسجلت قبل إضافة الحقل ده)
// تتعامل تلقائياً كـ "backend" (القيمة الافتراضية المطلوبة للتوافق
// مع البيانات القديمة)
function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase() === "frontend" ? "frontend" : "backend";
}


// ============================================================
// FETCH
// ============================================================

/**
 * جلب كل أنواع الماكينات (مفعّلة ومعطّلة) مرتبة حسب order - تُستخدم
 * في شاشة إدارة الماكينات وفي machines.js لتغذية كل فورمات التطبيق
 */
export async function fetchMachineTypesApi() {

  try {

    const ref = collection(db, "machineTypes");
    const q = query(ref, orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    const types = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      types.push({
        id: docSnap.id,
        key: String(data.key || "").trim(),
        units: Array.isArray(data.units) ? data.units : [],
        active: data.active !== false,
        order: typeof data.order === "number" ? data.order : 0,
        // ربط الماكينات بالقسم (backend/frontend) - الماكينات القديمة
        // اللي اتسجلت قبل إضافة هذا الحقل (مفيش عندها department خالص
        // في Firestore) تُعامل تلقائياً كـ "backend"
        department: normalizeDepartment(data.department)
      });
    });

    return { status: "success", data: types };

  } catch (error) {

    console.error("Error fetching machine types:", error);

    return { status: "error", message: error.message, data: [] };

  }

}


// ============================================================
// ADD
// ============================================================

/**
 * إضافة نوع ماكينة جديد. يرفض التكرار (نفس الاسم بالظبط، غير حساس
 * لحالة الأحرف) سواء كان النوع الموجود مفعّل أو معطّل، لتفادي وجود
 * نسختين بنفس الاسم بحالتين مختلفتين.
 *
 * @param {string} key
 * @param {string[]} [units]
 * @param {string} [department] - "backend" أو "frontend" (Required من
 *   واجهة "إضافة ماكينة" - راجع MachinesView.js). أي قيمة تانية أو
 *   فاضية تتعامل كـ "backend" افتراضياً.
 */
export async function addMachineTypeApi(key, units = [], department = "backend") {

  try {

    const cleanKey = String(key || "").trim();

    if (!cleanKey) {
      return { status: "error", message: "يرجى إدخال اسم نوع الماكينة" };
    }

    const existing = await fetchMachineTypesApi();

    if (existing.status === "success") {

      const duplicate = existing.data.find(
        m => m.key.toLowerCase() === cleanKey.toLowerCase()
      );

      if (duplicate) {
        return {
          status: "error",
          message: `نوع الماكينة "${cleanKey}" موجود بالفعل${duplicate.active ? "" : " (معطّل حالياً)"}`
        };
      }

    }

    const maxOrder = existing.status === "success" && existing.data.length
      ? Math.max(...existing.data.map(m => m.order || 0))
      : 0;

    const cleanUnits = Array.isArray(units)
      ? units.map(u => String(u).trim()).filter(Boolean)
      : [];

    await addDoc(
      collection(db, "machineTypes"),
      {
        key: cleanKey,
        units: cleanUnits,
        department: normalizeDepartment(department),
        active: true,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
        createdBy: localStorage.getItem("name") || "Admin"
      }
    );

    return { status: "success", message: "تم إضافة نوع الماكينة" };

  } catch (error) {

    console.error("Error adding machine type:", error);

    return { status: "error", message: error.message };

  }

}


// ============================================================
// UPDATE (تعديل الاسم/الوحدات)
// ============================================================

/**
 * @param {string} machineTypeId
 * @param {string} key
 * @param {string[]} [units]
 * @param {string} [department] - "backend" أو "frontend". تعديل هذا
 *   الحقل مقصور فعلياً على الأدمن فقط: لو الدور الحالي مش أدمن، أي
 *   قيمة متبعتة هنا تُتجاهل تماماً ولا تنعكس على المستند المحفوظ
 *   (القيمة الحالية تفضل زي ما هي) - ده تطبيق فعلي للصلاحية على
 *   مستوى طبقة البيانات، مش مجرد إخفاء الحقل/الزر في الواجهة (راجع
 *   أيضاً firestore.rules اللي أصلاً بيمنع أي تعديل غير الأدمن على
 *   مجموعة machineTypes بالكامل، فهذا الفحص طبقة حماية إضافية على
 *   مستوى التطبيق قبل الوصول لـ Firestore أصلاً). لو الباراميتر ده
 *   اتسيب undefined (مش متبعت خالص)، حقل department ميتلمسش نهائياً.
 */
export async function updateMachineTypeApi(machineTypeId, key, units = [], department = undefined) {

  try {

    if (!machineTypeId) {
      return { status: "error", message: "معرف نوع الماكينة غير موجود" };
    }

    const cleanKey = String(key || "").trim();

    if (!cleanKey) {
      return { status: "error", message: "يرجى إدخال اسم نوع الماكينة" };
    }

    const existing = await fetchMachineTypesApi();

    if (existing.status === "success") {

      const duplicate = existing.data.find(
        m => m.id !== machineTypeId && m.key.toLowerCase() === cleanKey.toLowerCase()
      );

      if (duplicate) {
        return { status: "error", message: `نوع الماكينة "${cleanKey}" مستخدم بالفعل` };
      }

    }

    const cleanUnits = Array.isArray(units)
      ? units.map(u => String(u).trim()).filter(Boolean)
      : [];

    const updateData = {
      key: cleanKey,
      units: cleanUnits,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    };

    if (department !== undefined) {
      if (isAdminRole(getCurrentRole())) {
        updateData.department = normalizeDepartment(department);
      }
      // غير أدمن: تجاهل صامت لقيمة department المتبعة - القسم يفضل
      // كما هو محفوظ حالياً في Firestore
    }

    await updateDoc(
      doc(db, "machineTypes", machineTypeId),
      updateData
    );

    return { status: "success", message: "تم تحديث نوع الماكينة" };

  } catch (error) {

    console.error("Error updating machine type:", error);

    return { status: "error", message: error.message };

  }

}


// ============================================================
// تفعيل / تعطيل
// ============================================================

/**
 * تعطيل نوع الماكينة يخفيه من فورمات إنشاء بلاغ/مقترح جديد، لكنه
 * يفضل ظاهر في فلاتر البحث (عشان البلاغات القديمة المرتبطة بيه
 * تفضل قابلة للبحث) وفي أي قيمة محفوظة مسبقاً بيه. الحذف النهائي
 * منفصل (deleteMachineTypeApi) وأقوى أثراً.
 */
export async function setMachineTypeActiveApi(machineTypeId, active) {

  try {

    if (!machineTypeId) {
      return { status: "error", message: "معرف نوع الماكينة غير موجود" };
    }

    await updateDoc(
      doc(db, "machineTypes", machineTypeId),
      {
        active: !!active,
        updatedAt: new Date().toISOString(),
        updatedBy: localStorage.getItem("name") || "Admin"
      }
    );

    return { status: "success", message: active ? "تم تفعيل نوع الماكينة" : "تم تعطيل نوع الماكينة" };

  } catch (error) {

    console.error("Error toggling machine type active state:", error);

    return { status: "error", message: error.message };

  }

}


// ============================================================
// DELETE (حذف نهائي)
// ============================================================

export async function deleteMachineTypeApi(machineTypeId) {

  try {

    if (!machineTypeId) {
      return { status: "error", message: "معرف نوع الماكينة غير موجود" };
    }

    await deleteDoc(doc(db, "machineTypes", machineTypeId));

    return { status: "success", message: "تم حذف نوع الماكينة نهائياً" };

  } catch (error) {

    console.error("Error deleting machine type:", error);

    return { status: "error", message: error.message || "فشل حذف نوع الماكينة" };

  }

}


// ============================================================
// SEED (زرع القائمة الافتراضية - أول تشغيل أو استرجاع يدوي)
// ============================================================

/**
 * إضافة أي عنصر من القائمة الافتراضية (defaultTypes) غير موجود
 * بالفعل - بيتخطى أي اسم موجود مسبقاً (مفعّل أو معطّل) عشان يمنع
 * التكرار لو اتنادى أكتر من مرة (أول تشغيل تلقائي + زرار استرجاع
 * يدوي من الشاشة).
 */
export async function seedDefaultMachineTypesApi(defaultTypes) {

  try {

    const existing = await fetchMachineTypesApi();

    const existingKeys = existing.status === "success"
      ? new Set(existing.data.map(m => m.key.toLowerCase()))
      : new Set();

    const toAdd = (defaultTypes || []).filter(
      m => !existingKeys.has(String(m.key).toLowerCase())
    );

    for (const m of toAdd) {
      await addMachineTypeApi(m.key, m.units || [], m.department || "backend");
    }

    return { status: "success", added: toAdd.length };

  } catch (error) {

    console.error("Error seeding default machine types:", error);

    return { status: "error", message: error.message, added: 0 };

  }

}
