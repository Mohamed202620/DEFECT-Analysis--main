// ============================================================
// pmApi.js
// الصيانة الوقائية (Preventive Maintenance) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";
import {
  getDepartmentForMachineValue,
  getCurrentUserMachineContext,
  getMachineTypeReference,
  getLineForMachineValue
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
  onSnapshot,
  writeBatch
} from "../providers/backend/index.js";
import { normalizeLine, formatLineLabel } from "../utils/lineUtils.js";
import { getCurrentRole, hasFullDataAccess, hasPermission, isAdminRole } from "../permissions.js";
import {
  PM_FREQUENCIES,
  PM_MAX_CUSTOM_DAYS,
  isValidFrequency,
  getFrequencyLabel,
  calculateNextDueDate,
  calculateDueStatus,
  normalizeDateKey,
  toDateKey,
  sanitizeExecutionTasks,
  summarizeExecutionTasks,
  resolveExecutionResult,
  buildPlanPatchAfterExecution,
  resolveNextDueOnEdit
} from "../utils/pmSchedule.js";

// نفس الأسماء المُصدَّرة سابقاً من هذا الملف (api.js يعيد تصديرها) - المنطق
// نفسه انتقل إلى utils/pmSchedule.js ليكون قابلاً للاختبار دون Firebase
export { PM_FREQUENCIES, getFrequencyLabel, calculateNextDueDate, calculateDueStatus };


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
// (منطق الحساب النقي في utils/pmSchedule.js)
// ============================================================

const currentUserName = () => localStorage.getItem("name") || "مستخدم";
const currentUserUid = () => localStorage.getItem("userId") || "";
const todayKey = () => toDateKey(new Date());

/**
 * توليد معرّف موحد ومستقر للخطة لمنع تكرار الخطط لنفس الماكينة
 * (لا يُغيَّر - المعرّفات القديمة المخزّنة تعتمد على هذه الصيغة)
 */
export function buildPlanDocId(line, machine) {
  const normLine = normalizeLine(line) || "L0";
  const normMachine = String(machine || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `plan_line${normLine}_${normMachine}`;
}

/**
 * جلب جميع خطط الصيانة الوقائية الدورية
 * (الترتيب محلياً: استعلام where + orderBy على حقلين مختلفين كان يتطلب
 *  فهرساً مركباً غير معرّف فيفشل الجلب بخطأ failed-precondition)
 */
export async function fetchPmPlansApi({ line = "" } = {}) {
  try {
    const plansRef = collection(db, "pmPlans");
    const q = line
      ? query(plansRef, where("line", "==", formatLineLabel(line) || String(line)))
      : query(plansRef);
    const snap = await getDocs(q);
    const plans = [];
    snap.forEach(d => {
      plans.push({ id: d.id, ...d.data() });
    });
    plans.sort((a, b) => String(a.machine || "").localeCompare(String(b.machine || "")));
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

function normalizePlanTasks(rawTasks) {
  const list = Array.isArray(rawTasks) ? rawTasks : [];
  const seen = new Set();
  const out = [];
  list.forEach((t, idx) => {
    const text = String(t?.text || t?.description || "").trim().slice(0, 500);
    if (!text) return;
    // معرّفات المهام الموجودة تُحفظ كما هي (سجل التنفيذ يشير إليها)
    let id = String(t?.id || "").trim() || `task_${idx + 1}_${Date.now()}`;
    if (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);
    out.push({ id, text, order: out.length + 1 });
  });
  return out.slice(0, 100);
}

/**
 * حفظ أو تحديث خطة PM دورية لماكينة مع منع التكرار والحفاظ على سجل التنفيذ
 *  - خطة جديدة (بدون id): المعرّف حتمي (خط + ماكينة)؛ إن وُجدت خطة لنفس
 *    الماكينة يُرفض الحفظ بدل الكتابة فوقها بصمت.
 *  - تعديل (id): الخط والماكينة ثابتان، ولا يُعاد إنشاء خطة محذوفة.
 *  - لا يُكتب lastExecution/executionCount عند التعديل (حتى لا يُستبدل
 *    تنفيذ سُجّل في نفس اللحظة من جهاز آخر).
 */
export async function savePmPlanApi(planPayload) {
  if (!hasFullDataAccess(getCurrentRole())) {
    return { status: "error", message: "ليست لديك صلاحية إدارة خطط الصيانة الوقائية" };
  }

  const requestedId = String(planPayload?.id || "").trim();
  let machine = String(planPayload?.machine || "").trim();
  if (!machine && !requestedId) {
    return { status: "error", message: "يرجى تحديد الماكينة قبل حفظ الخطة" };
  }

  const frequency = planPayload?.frequency || "monthly";
  if (!isValidFrequency(frequency)) {
    return { status: "error", message: "دورية الصيانة غير صالحة" };
  }
  let customDays = null;
  if (frequency === "custom") {
    customDays = parseInt(planPayload?.customDays, 10);
    if (!Number.isFinite(customDays) || customDays < 1 || customDays > PM_MAX_CUSTOM_DAYS) {
      return { status: "error", message: `عدد أيام الدورية المخصصة يجب أن يكون بين 1 و${PM_MAX_CUSTOM_DAYS}` };
    }
  }

  const startDateRaw = String(planPayload?.startDate || "").trim();
  const startDate = normalizeDateKey(startDateRaw);
  if (startDateRaw && !startDate) {
    return { status: "error", message: "تاريخ بدء/استحقاق الخطة غير صالح" };
  }

  const tasks = normalizePlanTasks(planPayload?.tasks);
  if (!tasks.length) {
    return { status: "error", message: "يرجى إضافة مهمة صيانة واحدة على الأقل للخطة" };
  }

  const duration = Math.min(1440, Math.max(1, parseInt(planPayload?.estimatedDurationMinutes, 10) || 30));
  const notes = String(planPayload?.notes ?? "").trim().slice(0, 2000);

  try {
    let planDocId = requestedId;
    let planDocRef;
    let existing = null;
    let lineLabel = formatLineLabel(planPayload?.line) || "Line 1";

    if (requestedId) {
      planDocRef = doc(db, "pmPlans", requestedId);
      const snap = await getDoc(planDocRef);
      if (!snap.exists()) {
        return { status: "error", message: "الخطة غير موجودة (ربما تم حذفها). أعد فتح القائمة وحاول مجدداً" };
      }
      existing = snap.data();
      machine = String(existing.machine || machine).trim();
      lineLabel = formatLineLabel(existing.line) || existing.line || lineLabel;
    } else {
      planDocId = buildPlanDocId(lineLabel, machine);
      planDocRef = doc(db, "pmPlans", planDocId);
      const snap = await getDoc(planDocRef);
      if (snap.exists()) {
        return {
          status: "error",
          duplicate: true,
          existingId: planDocId,
          message: "توجد خطة PM لهذه الماكينة في هذا الخط بالفعل — افتحها للتعديل بدلاً من إنشاء خطة مكررة"
        };
      }
    }

    const nowIso = new Date().toISOString();
    const dataToSave = {
      line: lineLabel,
      machine,
      frequency,
      frequencyLabel: getFrequencyLabel(frequency, customDays),
      customDays,
      estimatedDurationMinutes: duration,
      notes,
      tasks,
      updatedAt: nowIso,
      updatedBy: currentUserName(),
      updatedByUid: currentUserUid()
    };

    if (!existing) {
      // خطة جديدة: لا تُقبل إلا لماكينة موجودة في الكتالوج وعلى خطها الصحيح
      const machineReference = getMachineTypeReference(machine);
      if (!machineReference) {
        return { status: "error", message: "الماكينة غير موجودة في كتالوج الماكينات النشط" };
      }
      const catalogLine = formatLineLabel(getLineForMachineValue(machine));
      if (catalogLine && catalogLine !== lineLabel) {
        return { status: "error", message: `هذه الماكينة تتبع ${catalogLine} وليس ${lineLabel}` };
      }
      dataToSave.department =
        planPayload?.department ||
        getDepartmentForMachineValue(machine) ||
        getCurrentUserMachineContext().machineDepartment ||
        "backend";
      Object.assign(dataToSave, machineReference);
      dataToSave.nextDueDate = startDate || calculateNextDueDate(todayKey(), frequency, customDays || 1);
      dataToSave.executionCount = 0;
      dataToSave.createdAt = nowIso;
      dataToSave.createdBy = currentUserName();
      dataToSave.createdByUid = currentUserUid();
    } else {
      dataToSave.department =
        existing.department ||
        planPayload?.department ||
        getDepartmentForMachineValue(machine) ||
        "backend";
      const nextDue = resolveNextDueOnEdit({ existing, startDate, frequency, customDays });
      if (nextDue !== normalizeDateKey(existing.nextDueDate)) {
        dataToSave.nextDueDate = nextDue;
      }
    }

    await setDoc(planDocRef, dataToSave, { merge: true });

    return {
      status: "success",
      id: planDocId,
      message: existing
        ? "تم تحديث خطة الصيانة الوقائية مع الحفاظ على سجل التنفيذ السابق ✅"
        : "تم إنشاء خطة الصيانة الوقائية للماكينة بنجاح ✅"
    };
  } catch (error) {
    console.error("Error saving PM plan:", error);
    return { status: "error", message: error?.message || "تعذر حفظ خطة الصيانة" };
  }
}

/**
 * حذف خطة صيانة وقائية (أدمن فقط - مطابق لقاعدة pmPlans). سجل التنفيذات
 * (pmExecutions) يبقى محفوظاً.
 */
export async function deletePmPlanApi(planId) {
  if (!planId) return { status: "error", message: "معرف الخطة غير محدد" };
  if (!isAdminRole(getCurrentRole())) {
    return { status: "error", message: "حذف الخطط متاح لمدير النظام فقط" };
  }
  try {
    const planRef = doc(db, "pmPlans", planId);
    await deleteDoc(planRef);
    return { status: "success", message: "تم حذف الخطة بنجاح" };
  } catch (error) {
    console.error("Error deleting PM plan:", error);
    return { status: "error", message: error?.message || "تعذر حذف الخطة" };
  }
}

// حماية فورية من النقر المزدوج داخل نفس الجلسة (الحماية الحقيقية من التكرار
// هي معرّف مستند التنفيذ الحتمي المشتق من clientToken)
const executionTokensCache = new Set();

/**
 * تسجيل نتيجة التنفيذ الفعلي لخطة PM وتحديث سجل الخطة وموعد الصيانة القادم
 *  - سجل التنفيذ وتحديث الخطة في Batch واحد (إما الاثنان أو لا شيء).
 *  - معرّف سجل التنفيذ مشتق من clientToken: إعادة الإرسال بعد انقطاع لا
 *    تنشئ سجلاً مكرراً ولا تُحتسب تنفيذاً ثانياً.
 *  - المؤجل لا يغيّر الموعد ولا يُحتسب تنفيذاً؛ المكتمل/الجزئي يحسب الموعد
 *    من تاريخ التنفيذ الفعلي.
 *  - الماكينة والخط والقسم من الخطة نفسها (لا من حمولة العميل).
 */
export async function savePmExecutionApi(payload) {
  const planId = String(payload?.planId || "").trim();
  if (!planId) {
    return { status: "error", message: "يرجى تحديد خطة PM لتسجيل التنفيذ" };
  }

  const myUid = currentUserUid();
  if (!myUid) {
    return { status: "error", message: "تعذر تحديد المستخدم الحالي - أعد تسجيل الدخول" };
  }
  if (!(hasFullDataAccess(getCurrentRole()) || hasPermission("pm"))) {
    return { status: "error", message: "ليست لديك صلاحية تسجيل تنفيذ الصيانة الوقائية" };
  }

  const rawToken = String(payload?.clientToken || "").trim()
    || `exec_${planId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const execDocId = `ex_${rawToken}`.replace(/[^A-Za-z0-9_\-.]/g, "_").slice(0, 150);

  if (executionTokensCache.has(execDocId)) {
    return { status: "success", duplicate: true, id: execDocId, message: "تم تسجيل هذا التنفيذ بالفعل" };
  }
  executionTokensCache.add(execDocId);

  try {
    const planRef = doc(db, "pmPlans", planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) {
      executionTokensCache.delete(execDocId);
      return { status: "error", message: "الخطة غير موجودة (ربما تم حذفها)" };
    }
    const plan = { id: planSnap.id, ...planSnap.data() };

    const execRef = doc(db, "pmExecutions", execDocId);
    const existingExec = await getDoc(execRef);
    if (existingExec.exists()) {
      return {
        status: "success",
        duplicate: true,
        id: execDocId,
        nextDueDate: plan.nextDueDate || "",
        message: "تم تسجيل هذا التنفيذ بالفعل"
      };
    }

    const tasks = sanitizeExecutionTasks(payload?.tasks);
    const missingReason = tasks.find(t => t.status === "not_done" && !t.note);
    if (missingReason) {
      executionTokensCache.delete(execDocId);
      return { status: "error", message: `اكتب سبب عدم تنفيذ المهمة: ${missingReason.text}` };
    }

    const result = resolveExecutionResult(tasks, payload?.result);
    const tasksSummary = summarizeExecutionTasks(tasks);

    let executedAtDate = payload?.executedAt ? new Date(payload.executedAt) : new Date();
    if (Number.isNaN(executedAtDate.getTime())) executedAtDate = new Date();
    const executedAt = executedAtDate.toISOString();

    const executedBy = currentUserName();
    const technicianName = String(payload?.technicianName || "").trim().slice(0, 120) || executedBy;
    const notes = String(payload?.notes || "").trim().slice(0, 2000);
    const nowIso = new Date().toISOString();

    const executionDocData = {
      planId,
      machine: plan.machine || "",
      line: plan.line || formatLineLabel(payload?.line) || "Line 1",
      department: plan.department || "backend",
      executedAt,
      executedBy,
      executedByUid: myUid,
      technicianName,
      supervisorName: String(payload?.supervisorName || "").trim().slice(0, 120),
      result,
      tasks,
      tasksSummary,
      notes,
      source: payload?.source === "routine" ? "routine" : "line_downtime", // "line_downtime" | "routine"
      clientToken: rawToken,
      createdAt: nowIso
    };

    const planPatch = buildPlanPatchAfterExecution(plan, {
      executionId: execDocId,
      executedAt,
      executedBy,
      executedByUid: myUid,
      technicianName,
      result,
      tasksSummary,
      notes
    });

    const batch = writeBatch(db);
    batch.set(execRef, executionDocData);
    if (planPatch) batch.update(planRef, planPatch);
    await batch.commit();

    const isDeferred = result === "deferred";
    return {
      status: "success",
      id: execDocId,
      result,
      deferred: isDeferred,
      nextDueDate: planPatch?.nextDueDate ?? plan.nextDueDate ?? "",
      message: isDeferred
        ? "تم تسجيل التأجيل — لم يتغير موعد الاستحقاق لأن العمل لم يُنفَّذ ⏸️"
        : "تم تسجيل نتيجة التنفيذ الفعلي وتحديث موعد الصيانة القادم بنجاح ✅"
    };
  } catch (error) {
    console.error("Error saving PM execution:", error);
    executionTokensCache.delete(execDocId);
    return { status: "error", message: error?.message || "تعذر تسجيل نتيجة التنفيذ الفعلي" };
  }
}

/**
 * جلب سجل التنفيذات السابقة لماكينة أو خطة
 * (الترتيب والحد محلياً لتجنب الحاجة لفهرس مركب - كان الاستعلام السابق
 *  where + orderBy يفشل بدون فهرس فيظهر "لا توجد سجلات" رغم وجودها)
 */
export async function fetchPmExecutionsApi({ machine = "", planId = "", limitCount = 50 } = {}) {
  try {
    const execRef = collection(db, "pmExecutions");
    let q;
    if (planId) {
      q = query(execRef, where("planId", "==", planId));
    } else if (machine) {
      q = query(execRef, where("machine", "==", machine));
    } else {
      q = query(execRef, orderBy("executedAt", "desc"));
    }

    const snap = await getDocs(q);
    const executions = [];
    snap.forEach(d => {
      executions.push({ id: d.id, ...d.data() });
    });
    executions.sort((a, b) => String(b.executedAt || "").localeCompare(String(a.executedAt || "")));
    const max = Math.max(1, parseInt(limitCount, 10) || 50);
    return { status: "success", data: executions.slice(0, max) };
  } catch (error) {
    console.error("Error fetching PM executions:", error);
    return { status: "error", message: error?.message || "تعذر جلب سجل التنفيذ" };
  }
}
