// ============================================================
// attendanceSettingsApi.js
// إعدادات عامة (Global) لحاسبة الحضور والمرتبات - تُدار من الأدمن
// فقط (راجع firestore.rules) وتُخزَّن في Firestore عشان تظهر لكل
// المستخدمين:
//   1) settings/attendancePattern -> جدول الـ Pattern (GREEN/BLUE/RED)
//      اللي بيتقرأ من ملف Excel (راجع excelPatternParser.js)
//   2) settings/payrollRules      -> معاملات حساب الإضافي القابلة
//      للتعديل (Normal OT × ?, OFF Work × ?, Holiday Work × ?،
//      الساعات المستهدفة شهرياً، خصم الإجازة الرسمية بالساعات)
// نفس أسلوب holidaysApi.js بالظبط (كاش بالذاكرة + كاش محلي احتياطي
// Offline-First)
// ============================================================

import { db } from "../config.js";
import { doc, getDoc, setDoc } from "../firebase.js";

const PATTERN_DOC_PATH = ["settings", "attendancePattern"];
const RULES_DOC_PATH = ["settings", "payrollRules"];

const PATTERN_LOCAL_CACHE_KEY = "attendance_pattern_cache_v1";
const RULES_LOCAL_CACHE_KEY = "payroll_rules_cache_v1";

export const DEFAULT_PAYROLL_RULES = {
  monthlyTargetHours: 192,
  holidayHoursDeduction: 12,
  normalOvertimeMultiplier: 1.5,
  offWorkMultiplier: 2,
  holidayWorkMultiplier: 1.5
};

let patternMemoryCache = null; // { teams, fileName, updatedAt } أو null
let rulesMemoryCache = null;   // كائن القواعد أو null

// ============================================================
// Pattern (جدول الورديات)
// ============================================================

export async function fetchAttendancePatternApi({ forceRefresh = false } = {}) {
  if (!forceRefresh && patternMemoryCache) {
    return { status: "success", data: patternMemoryCache };
  }

  try {
    const ref = doc(db, ...PATTERN_DOC_PATH);
    const snap = await getDoc(ref);
    if (snap && snap.exists()) {
      const data = snap.data();
      patternMemoryCache = {
        teams: data.teams || { green: {}, blue: {}, red: {} },
        fileName: data.fileName || "",
        updatedAt: data.updatedAt || null,
        updatedBy: data.updatedBy || ""
      };
    } else {
      patternMemoryCache = { teams: { green: {}, blue: {}, red: {} }, fileName: "", updatedAt: null, updatedBy: "" };
    }
    try {
      localStorage.setItem(PATTERN_LOCAL_CACHE_KEY, JSON.stringify(patternMemoryCache));
    } catch (e) { /* تجاهل امتلاء المساحة */ }
    return { status: "success", data: patternMemoryCache };
  } catch (error) {
    console.warn("[AttendanceSettings] فشل جلب الـ Pattern من Firestore، سيتم استخدام الكاش المحلي:", error.message);
    try {
      const raw = localStorage.getItem(PATTERN_LOCAL_CACHE_KEY);
      patternMemoryCache = raw ? JSON.parse(raw) : { teams: { green: {}, blue: {}, red: {} }, fileName: "", updatedAt: null };
    } catch (e) {
      patternMemoryCache = { teams: { green: {}, blue: {}, red: {} }, fileName: "", updatedAt: null };
    }
    return { status: "success", data: patternMemoryCache, offline: true };
  }
}

/**
 * حفظ/استبدال الـ Pattern كاملاً (أدمن فقط - مفروضة أيضاً في
 * firestore.rules، فحص الصلاحية هنا في الواجهة فقط للـ UX)
 */
export async function saveAttendancePatternApi(teams, fileName) {
  try {
    const ref = doc(db, ...PATTERN_DOC_PATH);
    const payload = {
      teams,
      fileName: fileName || "",
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    };
    await setDoc(ref, payload);
    patternMemoryCache = payload;
    try {
      localStorage.setItem(PATTERN_LOCAL_CACHE_KEY, JSON.stringify(payload));
    } catch (e) { /* تجاهل */ }
    return { status: "success", message: "تم حفظ الـ Pattern بنجاح" };
  } catch (error) {
    console.error("[AttendanceSettings] Error saving pattern:", error);
    return { status: "error", message: error.message };
  }
}

export function invalidateAttendancePatternCache() {
  patternMemoryCache = null;
}

export function getCachedAttendancePattern() {
  return patternMemoryCache || { teams: { green: {}, blue: {}, red: {} }, fileName: "", updatedAt: null };
}

// ============================================================
// Payroll Rules (معاملات الإضافي)
// ============================================================

export async function fetchPayrollRulesApi({ forceRefresh = false } = {}) {
  if (!forceRefresh && rulesMemoryCache) {
    return { status: "success", data: rulesMemoryCache };
  }

  try {
    const ref = doc(db, ...RULES_DOC_PATH);
    const snap = await getDoc(ref);
    if (snap && snap.exists()) {
      rulesMemoryCache = { ...DEFAULT_PAYROLL_RULES, ...snap.data() };
    } else {
      rulesMemoryCache = { ...DEFAULT_PAYROLL_RULES };
    }
    try {
      localStorage.setItem(RULES_LOCAL_CACHE_KEY, JSON.stringify(rulesMemoryCache));
    } catch (e) { /* تجاهل */ }
    return { status: "success", data: rulesMemoryCache };
  } catch (error) {
    console.warn("[AttendanceSettings] فشل جلب قواعد الإضافي من Firestore، سيتم استخدام الكاش المحلي:", error.message);
    try {
      const raw = localStorage.getItem(RULES_LOCAL_CACHE_KEY);
      rulesMemoryCache = raw ? { ...DEFAULT_PAYROLL_RULES, ...JSON.parse(raw) } : { ...DEFAULT_PAYROLL_RULES };
    } catch (e) {
      rulesMemoryCache = { ...DEFAULT_PAYROLL_RULES };
    }
    return { status: "success", data: rulesMemoryCache, offline: true };
  }
}

export async function savePayrollRulesApi(rules) {
  try {
    const ref = doc(db, ...RULES_DOC_PATH);
    const payload = {
      monthlyTargetHours: Number(rules.monthlyTargetHours) || DEFAULT_PAYROLL_RULES.monthlyTargetHours,
      holidayHoursDeduction: Number(rules.holidayHoursDeduction) || DEFAULT_PAYROLL_RULES.holidayHoursDeduction,
      normalOvertimeMultiplier: Number(rules.normalOvertimeMultiplier) || DEFAULT_PAYROLL_RULES.normalOvertimeMultiplier,
      offWorkMultiplier: Number(rules.offWorkMultiplier) || DEFAULT_PAYROLL_RULES.offWorkMultiplier,
      holidayWorkMultiplier: Number(rules.holidayWorkMultiplier) || DEFAULT_PAYROLL_RULES.holidayWorkMultiplier,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || "Admin"
    };
    await setDoc(ref, payload);
    rulesMemoryCache = payload;
    try {
      localStorage.setItem(RULES_LOCAL_CACHE_KEY, JSON.stringify(payload));
    } catch (e) { /* تجاهل */ }
    return { status: "success", message: "تم حفظ إعدادات الإضافي بنجاح" };
  } catch (error) {
    console.error("[AttendanceSettings] Error saving payroll rules:", error);
    return { status: "error", message: error.message };
  }
}

export function invalidatePayrollRulesCache() {
  rulesMemoryCache = null;
}

export function getCachedPayrollRules() {
  return rulesMemoryCache || { ...DEFAULT_PAYROLL_RULES };
}
