// ============================================================
// pmSchedule.js
// منطق نقي (بدون Firebase/DOM) لخطط الصيانة الوقائية الدورية:
// حساب مواعيد الاستحقاق وحالة الاستحقاق ونتيجة التنفيذ وتحديث الخطة.
// معزول في ملف مستقل لكي يمكن اختباره مباشرة (tests/run-logic-tests.mjs)
// وتعيد pmApi.js تصدير نفس الأسماء الأصلية دون أي تغيير في الواجهة.
// ============================================================

const currentLang = () =>
  (typeof window !== "undefined" && window.currentLang) || "ar";

export const PM_FREQUENCIES = [
  { id: "daily", ar: "يومي", en: "Daily", defaultDays: 1 },
  { id: "weekly", ar: "أسبوعي", en: "Weekly", defaultDays: 7 },
  { id: "monthly", ar: "شهري", en: "Monthly", defaultDays: 30 },
  { id: "quarterly", ar: "ربع سنوي (3 أشهر)", en: "Quarterly (3 months)", defaultDays: 90 },
  { id: "semi_annual", ar: "نصف سنوي (6 أشهر)", en: "Semi-annual (6 months)", defaultDays: 180 },
  { id: "annual", ar: "سنوي", en: "Annual", defaultDays: 365 },
  { id: "custom", ar: "دورية مخصصة", en: "Custom interval", defaultDays: 14 }
];

export const PM_EXECUTION_RESULTS = ["completed", "completed_partial", "deferred"];
export const PM_DEFAULT_CUSTOM_DAYS = 14;
export const PM_MAX_CUSTOM_DAYS = 3650;

export function isValidFrequency(frequencyId) {
  return PM_FREQUENCIES.some(f => f.id === frequencyId);
}

export function getFrequencyLabel(frequencyId, customDays = null) {
  const isEn = currentLang() === "en";
  if (frequencyId === "custom" && customDays) {
    return isEn ? `Every ${customDays} days` : `كل ${customDays} يوم`;
  }
  const item = PM_FREQUENCIES.find(f => f.id === frequencyId);
  return item ? (isEn ? item.en : item.ar) : (frequencyId || "");
}

const pad2 = n => String(n).padStart(2, "0");

/** YYYY-MM-DD بالتوقيت المحلي */
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * تحويل أي قيمة تاريخ إلى Date بمنتصف ليل التوقيت المحلي.
 * - "YYYY-MM-DD" تُفسَّر محلياً (new Date("YYYY-MM-DD") كانت تُفسَّر UTC
 *   فتنزاح الدورة يوماً في المناطق ذات الإزاحة السالبة).
 * - ISO كامل بوقت يُحوَّل لليوم المحلي.
 * - قيمة غير صالحة (أو 2026-02-31) => null.
 */
export function parseLocalDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** تاريخ صالح بصيغة YYYY-MM-DD أو "" */
export function normalizeDateKey(value) {
  const d = parseLocalDate(value);
  return d ? toDateKey(d) : "";
}

// إضافة أشهر مع الحفاظ على نهاية الشهر (31 يناير + شهر = 28/29 فبراير
// بدل القفز إلى 3 مارس كما كان يفعل setMonth)
function addMonthsClamped(date, months) {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

/**
 * حساب موعد الصيانة القادم بدقة بناءً على تاريخ الأساس ونوع الدورية
 */
export function calculateNextDueDate(baseDateStr, frequency, customDays = 1) {
  const today = parseLocalDate(new Date());
  const base = parseLocalDate(baseDateStr) || today;
  let d;

  switch (frequency) {
    case "daily":
      d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
      break;
    case "weekly":
      d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
      break;
    case "monthly":
      d = addMonthsClamped(base, 1);
      break;
    case "quarterly":
      d = addMonthsClamped(base, 3);
      break;
    case "semi_annual":
      d = addMonthsClamped(base, 6);
      break;
    case "annual":
      d = addMonthsClamped(base, 12);
      break;
    case "custom":
    default: {
      const days = Math.min(PM_MAX_CUSTOM_DAYS, Math.max(1, parseInt(customDays, 10) || 1));
      d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
      break;
    }
  }
  return toDateKey(d);
}

/**
 * تقييم حالة استحقاق الخطة:
 *   overdue / due_today / due_soon (حتى يومين) / never_executed (لم تُنفَّذ
 *   بعد وموعدها بعيد) / upcoming (سارية)
 * الأولوية دائماً للاستحقاق/التأخر ثم لعدم وجود تنفيذ سابق.
 */
export function calculateDueStatus(nextDueDateStr, lastExecutionDateStr = null) {
  const isEn = currentLang() === "en";
  const next = parseLocalDate(nextDueDateStr);
  if (!next) {
    return {
      status: "never_executed",
      label: isEn ? "Pending First Run" : "بانتظار أول تنفيذ",
      badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      daysDiff: 0
    };
  }

  const today = parseLocalDate(new Date());
  const diffDays = Math.round((next.getTime() - today.getTime()) / 86400000);
  const nextKey = toDateKey(next);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: "overdue",
      label: isEn ? `Overdue by ${overdueDays}d` : `متأخر (${overdueDays} يوم)`,
      badgeClass: "bg-red-500/20 text-red-300 border border-red-500/30",
      daysDiff: diffDays
    };
  }
  if (diffDays === 0) {
    return {
      status: "due_today",
      label: isEn ? "Due Today ⚡" : "مستحق اليوم ⚡",
      badgeClass: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
      daysDiff: 0
    };
  }
  if (diffDays <= 2) {
    return {
      status: "due_soon",
      label: isEn ? `Due in ${diffDays}d` : `يستحق خلال ${diffDays} يوم`,
      badgeClass: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
      daysDiff: diffDays
    };
  }
  if (!lastExecutionDateStr) {
    return {
      status: "never_executed",
      label: isEn ? `Pending First Run (${nextKey})` : `بانتظار أول تنفيذ (${nextKey})`,
      badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      daysDiff: diffDays
    };
  }
  return {
    status: "upcoming",
    label: isEn ? `Scheduled (${nextKey})` : `ساري ومجدول (${nextKey})`,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    daysDiff: diffDays
  };
}

/** حالة استحقاق خطة كاملة */
export function getPlanDueStatus(plan) {
  return calculateDueStatus(plan?.nextDueDate, plan?.lastExecution?.executedAt || null);
}

/** تصنيف الخطة لأغراض الإحصائيات والفلاتر (فئات متنافية تجمع الإجمالي) */
export function getPlanDueBucket(plan) {
  const { status } = getPlanDueStatus(plan);
  if (status === "overdue" || status === "due_today") return "due";
  if (status === "due_soon" || status === "upcoming") return "upcoming";
  return "never";
}

// ============================================================
// تنفيذ الخطة
// ============================================================

/**
 * تنقية مهام التنفيذ القادمة من الواجهة: done / not_done فقط
 * (أي قيمة أخرى تُعتبر لم تُنفَّذ) مع حدود للطول.
 */
export function sanitizeExecutionTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((t, idx) => ({
      id: String(t?.id || `task_${idx + 1}`).slice(0, 120),
      text: String(t?.text || t?.description || "").trim().slice(0, 500),
      status: t?.status === "done" ? "done" : "not_done",
      note: String(t?.note || t?.reason || "").trim().slice(0, 500)
    }))
    .filter(t => t.text.length > 0)
    .slice(0, 100);
}

export function summarizeExecutionTasks(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  return {
    total: list.length,
    done: list.filter(t => t.status === "done").length,
    notDone: list.filter(t => t.status === "not_done").length
  };
}

/**
 * النتيجة الفعلية للتنفيذ كما تُحفظ:
 *  - "مؤجل" المختارة صراحةً تبقى مؤجلة.
 *  - غير ذلك تُشتق من المهام: كلها تمت => مكتمل، لا شيء تم => مؤجل،
 *    وإلا مكتمل جزئياً. (منع تسجيل "مكتمل" ومهام لم تُنفَّذ، أو "جزئي"
 *    بلا أي مهمة منفذة فيتقدّم الموعد دون عمل فعلي.)
 *  - بلا مهام: تُحترم النتيجة المطلوبة (الافتراضي مكتمل).
 */
export function resolveExecutionResult(tasks, requested) {
  const req = PM_EXECUTION_RESULTS.includes(requested) ? requested : "completed";
  if (req === "deferred") return "deferred";
  const { total, done } = summarizeExecutionTasks(tasks);
  if (!total) return req;
  if (done === total) return "completed";
  if (done === 0) return "deferred";
  return "completed_partial";
}

/**
 * التعديل الذي يُطبَّق على مستند الخطة بعد تسجيل تنفيذ:
 *  - مكتمل/جزئي: آخر تنفيذ + عدّاد التنفيذ + الموعد القادم من تاريخ التنفيذ.
 *  - مؤجل: لا يتغير الموعد ولا يُحتسب تنفيذاً (تُسجَّل lastDeferral فقط)
 *    فتبقى الخطة متأخرة/مستحقة إلى أن يتم العمل فعلاً.
 *  - إن كانت الخطة تحمل executionId نفسه (إعادة إرسال) => null (لا تغيير).
 */
export function buildPlanPatchAfterExecution(plan, execution) {
  const { executionId, executedAt, executedBy, executedByUid, technicianName, result, tasksSummary, notes } = execution;
  if (!plan) return null;
  if (plan.lastExecution?.executionId === executionId || plan.lastDeferral?.executionId === executionId) return null;

  const nowIso = new Date().toISOString();
  const common = { updatedAt: nowIso, updatedBy: executedBy };
  const summaryEntry = {
    executionId,
    executedAt,
    executedBy,
    executedByUid,
    technicianName,
    result,
    tasksSummary,
    notes
  };

  if (result === "deferred") {
    return { nextDueDate: plan.nextDueDate || "", lastDeferral: summaryEntry, ...common };
  }

  const customDays = plan.frequency === "custom"
    ? (parseInt(plan.customDays, 10) || PM_DEFAULT_CUSTOM_DAYS)
    : null;
  return {
    lastExecution: summaryEntry,
    nextDueDate: calculateNextDueDate(executedAt, plan.frequency || "monthly", customDays || 1),
    executionCount: (parseInt(plan.executionCount, 10) || 0) + 1,
    ...common
  };
}

/**
 * تحديد الموعد القادم عند حفظ/تعديل خطة موجودة.
 *  - تاريخ يدوي مختلف عن المخزّن => يُعتمد كما أدخله المستخدم.
 *  - تغيّر الدورية/عدد الأيام وهناك تنفيذ سابق => يُحسب من آخر تنفيذ.
 *  - غير ذلك => يبقى الموعد المخزّن.
 */
export function resolveNextDueOnEdit({ existing, startDate, frequency, customDays }) {
  const stored = normalizeDateKey(existing?.nextDueDate);
  const wanted = normalizeDateKey(startDate);
  if (wanted && wanted !== stored) return wanted;

  const freqChanged = (existing?.frequency || "monthly") !== frequency
    || (frequency === "custom" && (parseInt(existing?.customDays, 10) || PM_DEFAULT_CUSTOM_DAYS) !== customDays);
  const lastExec = existing?.lastExecution?.executedAt;
  if (freqChanged && lastExec) return calculateNextDueDate(lastExec, frequency, customDays || 1);

  return stored || wanted || calculateNextDueDate(new Date(), frequency, customDays || 1);
}
