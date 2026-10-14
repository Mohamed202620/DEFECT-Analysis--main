// ============================================================
// pmApi.js
// الصيانة الوقائية (Preventive Maintenance) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";
import {
  getDepartmentForMachineValue,
  getCurrentUserMachineContext,
  getMachineTypeReference
} from "../machines.js";

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  getCountFromServer,
  orderBy,
  query,
  where,
  onSnapshot
} from "../providers/backend/index.js";
import { normalizeLine, formatLineLabel } from "../utils/lineUtils.js";


// ============================================================
// PREVENTIVE MAINTENANCE (PM) - سجل الصيانة الوقائية
// ============================================================


/**
 * حفظ نموذج صيانة وقائية (PM) في مجموعة "pmRecords"
 */
export async function savePmApi(payload) {

  // إصلاح: نموذج الـ PM مفيهوش أي تحقق على اختيار الماكينة (الـ required
  // على الـ checkboxes بس)، فكان بيتحفظ سجل صيانة وقائية بـ machine فاضية -
  // سجل يتيم مش مربوط بأي ماكينة (مبيظهرش في ملف الماكينة ولا البحث بالماكينة)
  // وبيتحدد له قسم افتراضي غلط. الماكينة لازم تكون محددة قبل الحفظ.
  if (!String(payload?.machine || "").trim()) {
    return { status: "error", message: "يرجى اختيار الماكينة قبل حفظ نموذج الصيانة الوقائية" };
  }

  try {


    // إصلاح (بند حرج - حماية سيرفرية لقيود القسم): نفس منطق
    // machineErrorsApi.js بالظبط - نحفظ قسم الماكينة الفعلي مع كل
    // سجل صيانة وقائية جديد
    const department =
      getDepartmentForMachineValue(payload?.machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";
    const machineReference = getMachineTypeReference(payload.machine);
    if (!machineReference) {
      return { status: "error", message: "الماكينة غير موجودة في كتالوج الماكينات النشط" };
    }

    const { allocateUnifiedNumber } = await import("./sequenceApi.js");
    const unifiedNumber = await allocateUnifiedNumber("pmRecords");
    const docRef = await addDoc(
      collection(db, "pmRecords"),
      {
        ...payload,
        ...machineReference,
        department,
        unifiedNumber, // الرقم الموحد الجديد: PR-00001
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      unifiedNumber,
      message: "تم حفظ نموذج الصيانة الوقائية بنجاح"
    };

  } catch (error) {

    console.error("Error saving PM record:", error);

    return {
      status: "error",
      message: error?.message || "حدث خطأ غير متوقع"
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

    console.error("Error fetching PM records:", error);
    return { status: "error", message: error?.message || "حدث خطأ غير متوقع" };

  }

}

export async function fetchPmRecordCountApi() {
  try {
    const countSnapshot = await getCountFromServer(
      query(collection(db, "pmRecords"))
    );
    return { status: "success", count: countSnapshot.data().count };
  } catch (error) {
    console.error("Error counting PM records:", error);
    return { status: "error", message: error?.message || "حدث خطأ غير متوقع" };
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
    return { status: "error", message: error?.message || "حدث خطأ غير متوقع" };
  }

}

// ============================================================
// PERIODIC PM PLANS & LINE DOWNTIME PM ENGINE
// نظام إدارة خطط الصيانة الوقائية الدورية والتنفيذ الفعلي
// ============================================================

export const PM_FREQUENCIES = [
  { id: "daily", ar: "يومي", en: "Daily", defaultDays: 1 },
  { id: "weekly", ar: "أسبوعي", en: "Weekly", defaultDays: 7 },
  { id: "monthly", ar: "شهري", en: "Monthly", defaultDays: 30 },
  { id: "quarterly", ar: "ربع سنوي (3 أشهر)", en: "Quarterly (3 months)", defaultDays: 90 },
  { id: "semi_annual", ar: "نصف سنوي (6 أشهر)", en: "Semi-annual (6 months)", defaultDays: 180 },
  { id: "annual", ar: "سنوي", en: "Annual", defaultDays: 365 },
  { id: "custom", ar: "دورية مخصصة", en: "Custom interval", defaultDays: 14 }
];

export function getFrequencyLabel(frequencyId, customDays = null) {
  const isEn = (window.currentLang || "ar") === "en";
  if (frequencyId === "custom" && customDays) {
    return isEn ? `Every ${customDays} days` : `كل ${customDays} يوم`;
  }
  const item = PM_FREQUENCIES.find(f => f.id === frequencyId);
  return item ? (isEn ? item.en : item.ar) : (frequencyId || "");
}

/**
 * حساب موعد الصيانة القادم بدقة بناءً على تاريخ الأساس ونوع الدورية
 */
export function calculateNextDueDate(baseDateStr, frequency, customDays = 1) {
  const raw = String(baseDateStr || "").trim();
  let base = raw ? new Date(raw) : new Date();
  if (Number.isNaN(base.getTime())) base = new Date();

  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semi_annual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "custom":
    default:
      const days = Math.max(1, parseInt(customDays, 10) || 1);
      d.setDate(d.getDate() + days);
      break;
  }

  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * تقييم حالة استحقاق الخطة (متأخر، مستحق اليوم، يستحق قريباً، ساري)
 */
export function calculateDueStatus(nextDueDateStr, lastExecutionDateStr = null) {
  const isEn = (window.currentLang || "ar") === "en";
  if (!nextDueDateStr) {
    return {
      status: "never_executed",
      label: isEn ? "Pending First Run" : "بانتظار أول تنفيذ",
      badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      daysDiff: 0
    };
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [ny, nm, nd] = nextDueDateStr.split("-").map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const nextTime = new Date(ny, nm - 1, nd).getTime();
  const todayTime = new Date(ty, tm - 1, td).getTime();

  const diffDays = Math.round((nextTime - todayTime) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: "overdue",
      label: isEn ? `Overdue by ${overdueDays}d` : `متأخر (${overdueDays} يوم)`,
      badgeClass: "bg-red-500/20 text-red-300 border border-red-500/30",
      daysDiff: diffDays
    };
  } else if (diffDays === 0) {
    return {
      status: "due_today",
      label: isEn ? "Due Today ⚡" : "مستحق اليوم ⚡",
      badgeClass: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
      daysDiff: 0
    };
  } else if (diffDays <= 2) {
    return {
      status: "due_soon",
      label: isEn ? `Due in ${diffDays}d` : `يستحق خلال ${diffDays} يوم`,
      badgeClass: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
      daysDiff: diffDays
    };
  } else {
    return {
      status: "upcoming",
      label: isEn ? `Scheduled (${nextDueDateStr})` : `ساري ومجدول (${nextDueDateStr})`,
      badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
      daysDiff: diffDays
    };
  }
}

/**
 * توليد معرّف موحد ومستقر للخطة لمنع تكرار الخطط لنفس الماكينة
 */
export function buildPlanDocId(line, machine) {
  const normLine = normalizeLine(line) || "L0";
  const normMachine = String(machine || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `plan_line${normLine}_${normMachine}`;
}

/**
 * جلب جميع خطط الصيانة الوقائية الدورية
 */
export async function fetchPmPlansApi({ line = "" } = {}) {
  try {
    const plansRef = collection(db, "pmPlans");
    let q = query(plansRef, orderBy("machine", "asc"));
    if (line) {
      q = query(plansRef, where("line", "==", formatLineLabel(line)), orderBy("machine", "asc"));
    }
    const snap = await getDocs(q);
    const plans = [];
    snap.forEach(d => {
      plans.push({ id: d.id, ...d.data() });
    });
    return { status: "success", data: plans };
  } catch (error) {
    console.error("Error fetching PM plans:", error);
    return { status: "error", message: error?.message || "حدث خطأ في جلب خطط PM" };
  }
}

/**
 * اشتراك حي في خطط الصيانة الدورية
 */
export function subscribeToPmPlansApi(callback) {
  try {
    const plansRef = collection(db, "pmPlans");
    return onSnapshot(
      plansRef,
      snapshot => {
        const plans = [];
        snapshot.forEach(d => {
          plans.push({ id: d.id, ...d.data() });
        });
        callback({ status: "success", data: plans });
      },
      error => {
        console.error("Error in PM plans subscription:", error);
        callback({ status: "error", message: error?.message || "تعذر الاشتراك في خطط PM" });
      }
    );
  } catch (error) {
    console.error("Failed to subscribe to PM plans:", error);
    callback({ status: "error", message: error?.message || "فشل الاشتراك" });
    return () => {};
  }
}

/**
 * حفظ أو تحديث خطة PM دورية لماكينة مع منع التكرار والحفاظ على سجل التنفيذ
 */
export async function savePmPlanApi(planPayload) {
  const machine = String(planPayload?.machine || "").trim();
  if (!machine) {
    return { status: "error", message: "يرجى تحديد الماكينة قبل حفظ الخطة" };
  }

  const rawLine = planPayload?.line;
  const lineLabel = formatLineLabel(rawLine) || (normalizeLine(rawLine) ? `Line ${normalizeLine(rawLine)}` : "Line 1");
  const frequency = planPayload?.frequency || "monthly";
  const customDays = parseInt(planPayload?.customDays, 10) || 14;

  const department =
    planPayload?.department ||
    getDepartmentForMachineValue(machine) ||
    getCurrentUserMachineContext().machineDepartment ||
    "backend";

  // معرّف مستند حتمي للماكينة والخط يمنع التكرار تماماً
  const planDocId = planPayload?.id || buildPlanDocId(lineLabel, machine);
  const planDocRef = doc(db, "pmPlans", planDocId);

  try {
    // فحص ما إذا كانت الخطة موجودة مسبقاً للحفاظ على بيانات التنفيذ السابقة
    const existingSnap = await getDoc(planDocRef);
    let previousExecution = null;
    let previousExecutionCount = 0;
    let calculatedNextDue = "";

    if (existingSnap.exists()) {
      const oldData = existingSnap.data();
      previousExecution = oldData.lastExecution || null;
      previousExecutionCount = oldData.executionCount || 0;
      // إذا كان هناك تنفيذ سابق، نحسب الموعد القادم بناءً عليه وعلى الدورية الجديدة
      if (previousExecution?.executedAt) {
        calculatedNextDue = calculateNextDueDate(previousExecution.executedAt, frequency, customDays);
      } else if (planPayload.startDate) {
        calculatedNextDue = planPayload.startDate;
      } else {
        calculatedNextDue = oldData.nextDueDate || calculateNextDueDate(new Date().toISOString(), frequency, customDays);
      }
    } else {
      // خطة جديدة لأول مرة: الموعد القادم يبدأ من تاريخ البداية المختار أو اليوم
      calculatedNextDue = planPayload.startDate || calculateNextDueDate(new Date().toISOString(), frequency, customDays);
    }

    const tasks = Array.isArray(planPayload.tasks) && planPayload.tasks.length
      ? planPayload.tasks.map((t, idx) => ({
          id: t.id || `task_${idx + 1}_${Date.now()}`,
          text: String(t.text || t.description || "").trim(),
          order: typeof t.order === "number" ? t.order : idx + 1
        })).filter(t => t.text.length > 0)
      : [
          { id: "task_1", text: "الفحص الظاهري والميكانيكي العام للمعدة", order: 1 }
        ];

    const dataToSave = {
      line: lineLabel,
      machine,
      department,
      frequency,
      frequencyLabel: getFrequencyLabel(frequency, customDays),
      customDays: frequency === "custom" ? customDays : null,
      estimatedDurationMinutes: parseInt(planPayload.estimatedDurationMinutes, 10) || 30,
      notes: String(planPayload.notes || "").trim(),
      tasks,
      nextDueDate: calculatedNextDue,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "مستخدم",
      updatedByUid: localStorage.getItem("userId") || ""
    };

    if (previousExecution) {
      dataToSave.lastExecution = previousExecution;
      dataToSave.executionCount = previousExecutionCount;
    }

    if (!existingSnap.exists()) {
      dataToSave.createdAt = new Date().toISOString();
      dataToSave.createdBy = localStorage.getItem("name") || "مستخدم";
      dataToSave.createdByUid = localStorage.getItem("userId") || "";
      dataToSave.executionCount = 0;
    }

    await setDoc(planDocRef, dataToSave, { merge: true });

    return {
      status: "success",
      id: planDocId,
      message: existingSnap.exists()
        ? "تم تحديث خطة الصيانة الوقائية مع الحفاظ على سجل التنفيذ السابق ✅"
        : "تم إنشاء خطة الصيانة الوقائية للماكينة بنجاح ✅"
    };
  } catch (error) {
    console.error("Error saving PM plan:", error);
    return { status: "error", message: error?.message || "تعذر حفظ خطة الصيانة" };
  }
}

/**
 * حذف خطة صيانة وقائية
 */
export async function deletePmPlanApi(planId) {
  if (!planId) return { status: "error", message: "معرف الخطة غير محدد" };
  try {
    const planRef = doc(db, "pmPlans", planId);
    await deleteDoc(planRef);
    return { status: "success", message: "تم حذف الخطة بنجاح" };
  } catch (error) {
    console.error("Error deleting PM plan:", error);
    return { status: "error", message: error?.message || "تعذر حذف الخطة" };
  }
}

// ذاكرة تخزين مؤقتة للتوكنات لمنع الإرسال المكرر عند إعادة المحاولة السريعة
const executionTokensCache = new Set();

/**
 * تسجيل نتيجة التنفيذ الفعلي لخطة PM وتحديث سجل الخطة وموعد الصيانة القادم
 * شرط إلزامي: منع التكرار عند إعادة المحاولة + تحديث موعد الصيانة فقط عند التسجيل الفعلي
 */
export async function savePmExecutionApi(payload) {
  const machine = String(payload?.machine || "").trim();
  const planId = String(payload?.planId || "").trim();

  if (!machine) {
    return { status: "error", message: "يرجى تحديد الماكينة لتسجيل التنفيذ" };
  }

  // حماية من التكرار عند النقر المزدوج أو إعادة الإرسال السريع
  const clientToken = payload?.clientToken || `${planId}_${Date.now()}`;
  if (executionTokensCache.has(clientToken)) {
    return { status: "success", message: "تم تسجيل هذا التنفيذ بالفعل" };
  }
  executionTokensCache.add(clientToken);
  // تنظيف التوكن بعد دقيقة
  setTimeout(() => executionTokensCache.delete(clientToken), 60000);

  try {
    const lineLabel = formatLineLabel(payload.line) || "Line 1";
    const department =
      payload.department ||
      getDepartmentForMachineValue(machine) ||
      getCurrentUserMachineContext().machineDepartment ||
      "backend";

    const executedAt = payload.executedAt || new Date().toISOString();
    const executedBy = payload.executedBy || localStorage.getItem("name") || "فني صيانة";
    const executedByUid = payload.executedByUid || localStorage.getItem("userId") || "";
    const result = payload.result || "completed"; // "completed" | "completed_partial" | "deferred"

    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const tasksSummary = {
      total: tasks.length,
      done: tasks.filter(t => t.status === "done").length,
      notDone: tasks.filter(t => t.status === "not_done").length
    };

    // 1. حفظ سجل التنفيذ الفعلي في مجموعة pmExecutions
    const executionDocData = {
      planId,
      machine,
      line: lineLabel,
      department,
      executedAt,
      executedBy,
      executedByUid,
      technicianName: payload.technicianName || executedBy,
      supervisorName: payload.supervisorName || "",
      result,
      tasks,
      tasksSummary,
      notes: String(payload.notes || "").trim(),
      source: payload.source || "line_downtime", // "line_downtime" | "routine"
      clientToken,
      createdAt: new Date().toISOString()
    };

    const execDocRef = await addDoc(collection(db, "pmExecutions"), executionDocData);

    // 2. تحديث الخطة المرتبطة: آخر تنفيذ وحساب الموعد القادم وفقاً للدورية المحددة
    let nextDueDate = "";
    if (planId) {
      const planDocRef = doc(db, "pmPlans", planId);
      const planSnap = await getDoc(planDocRef);

      if (planSnap.exists()) {
        const planData = planSnap.data();
        nextDueDate = calculateNextDueDate(executedAt, planData.frequency || "monthly", planData.customDays || 30);

        await updateDoc(planDocRef, {
          lastExecution: {
            executionId: execDocRef.id,
            executedAt,
            executedBy,
            executedByUid,
            technicianName: payload.technicianName || executedBy,
            result,
            tasksSummary,
            notes: String(payload.notes || "").trim()
          },
          nextDueDate,
          executionCount: (planData.executionCount || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: executedBy
        });
      }
    }

    return {
      status: "success",
      id: execDocRef.id,
      nextDueDate,
      message: "تم تسجيل نتيجة التنفيذ الفعلي وتحديث موعد الصيانة القادم بنجاح ✅"
    };
  } catch (error) {
    console.error("Error saving PM execution:", error);
    executionTokensCache.delete(clientToken);
    return { status: "error", message: error?.message || "تعذر تسجيل نتيجة التنفيذ الفعلي" };
  }
}

/**
 * جلب سجل التنفيذات السابقة لماكينة أو خطة
 */
export async function fetchPmExecutionsApi({ machine = "", planId = "", limitCount = 30 } = {}) {
  try {
    const execRef = collection(db, "pmExecutions");
    let q;
    if (planId) {
      q = query(execRef, where("planId", "==", planId), orderBy("executedAt", "desc"));
    } else if (machine) {
      q = query(execRef, where("machine", "==", machine), orderBy("executedAt", "desc"));
    } else {
      q = query(execRef, orderBy("executedAt", "desc"));
    }

    const snap = await getDocs(q);
    const executions = [];
    snap.forEach(d => {
      executions.push({ id: d.id, ...d.data() });
    });
    return { status: "success", data: executions };
  } catch (error) {
    console.error("Error fetching PM executions:", error);
    return { status: "error", message: error?.message || "تعذر جلب سجل التنفيذ" };
  }
}

