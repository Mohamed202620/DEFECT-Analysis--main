// ============================================================
// payrollLocalStore.js
// بيانات المرتب الخاصة بالمستخدم (المرتب الأساسي / نسبة التأمينات /
// سعر ساعة الإضافي / PIN المرتب) - محلية 100% على جهاز المستخدم.
//
// ⚠️ ممنوع تماماً: أي استيراد لـ db أو firebase.js في هذا الملف،
// وممنوع أي استدعاء شبكة (fetch/XHR). كل القراءة والكتابة هنا
// بتتم فقط عبر localStorage الخاص بالمتصفح، بما يضمن إن الأدمن أو
// أي مستخدم آخر (ولا حتى مطوّرو النظام عبر Firestore) يقدروا
// يوصلوا لهذه البيانات.
//
// الـ PIN بيتخزن كـ Hash (PBKDF2 + Salt عشوائي) مش كنص صريح -
// بنعيد استخدام نفس أداة التجزئة الموجودة أصلاً في services/crypto.js
// (المستخدمة لكلمات سر المستخدمين) بدل اختراع نظام تشفير جديد.
// ============================================================

import { hashPassword, verifyPassword, generateSalt } from "./services/crypto.js";

function storageKey(userId) {
  return `payroll_local_${userId || "local_user"}`;
}

/**
 * قراءة إعدادات المرتب المحلية للمستخدم (بدون الـ PIN نفسه، بيرجع
 * فقط علم هل الـ PIN متظبط أو لأ)
 */
export function getPayrollLocalConfig(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      return {
        baseSalary: 0,
        basicSalary: 0,
        insurancePercent: 11,
        otHourRate: 0,
        transportAllowance: 750,
        excludeAllowances30: false,
        noInsurance: false,
        hasPin: false
      };
    }
    const parsed = JSON.parse(raw);
    const sal = Number(parsed.basicSalary ?? parsed.baseSalary) || 0;
    const autoOtRate = sal > 0 ? Number((sal / 240).toFixed(2)) : 0;
    return {
      baseSalary: sal,
      basicSalary: sal,
      insurancePercent: 11,
      otHourRate: autoOtRate,
      transportAllowance: 750,
      excludeAllowances30: false,
      noInsurance: false,
      hasPin: !!(parsed.pinHash && parsed.pinSalt)
    };
  } catch (e) {
    console.error("[PayrollLocal] Error reading local config:", e);
    return {
      baseSalary: 0,
      basicSalary: 0,
      insurancePercent: 11,
      otHourRate: 0,
      transportAllowance: 750,
      excludeAllowances30: false,
      noInsurance: false,
      hasPin: false
    };
  }
}

/**
 * حفظ بيانات المرتب (المرتب الأساسي basicSalary) - محلياً فقط
 * سعر ساعة الإضافي يُحسب أوتوماتيكياً (الأساسي ÷ 240) وبدل الانتقال ثابت 750 ج.م
 */
export function savePayrollLocalConfig(userId, { baseSalary, basicSalary }) {
  try {
    const key = storageKey(userId);
    const existingRaw = localStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const sal = Number(basicSalary ?? baseSalary ?? existing.basicSalary ?? existing.baseSalary) || 0;
    const autoOtRate = sal > 0 ? Number((sal / 240).toFixed(2)) : 0;
    const updated = {
      ...existing,
      baseSalary: sal,
      basicSalary: sal,
      insurancePercent: 11,
      otHourRate: autoOtRate,
      transportAllowance: 750,
      excludeAllowances30: false,
      noInsurance: false,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error("[PayrollLocal] Error saving local config:", e);
    return false;
  }
}

/**
 * تعيين/تغيير الـ PIN (4 أرقام) - بيتخزن Hash فقط، أبداً كنص صريح
 */
export async function setPayrollPin(userId, pin) {
  if (!/^\d{4}$/.test(String(pin || ""))) {
    throw new Error("الـ PIN لازم يكون 4 أرقام بالظبط");
  }
  const key = storageKey(userId);
  const existingRaw = localStorage.getItem(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : {};

  const salt = generateSalt();
  const pinHash = await hashPassword(String(pin), salt);

  const updated = { ...existing, pinSalt: salt, pinHash, updatedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(updated));
  return true;
}

/**
 * التحقق من الـ PIN المُدخل مقابل الـ Hash المحلي المخزّن
 */
export async function verifyPayrollPin(userId, pin) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed.pinHash || !parsed.pinSalt) return false;
    return await verifyPassword(String(pin || ""), parsed.pinSalt, parsed.pinHash);
  } catch (e) {
    console.error("[PayrollLocal] Error verifying PIN:", e);
    return false;
  }
}

export function hasPayrollPin(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed.pinHash && parsed.pinSalt);
  } catch (e) {
    return false;
  }
}

/**
 * إزالة الـ PIN (رجوع لوضع بدون قفل) - المستخدم بيقدر يعمل كده من
 * كارت الحضور نفسه لو حاب يشيل الحماية
 */
export function removePayrollPin(userId) {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    delete parsed.pinHash;
    delete parsed.pinSalt;
    localStorage.setItem(key, JSON.stringify(parsed));
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================
// حالة الإظهار/الإخفاء خلال الجلسة الحالية فقط (متغيّر موديول -
// بيتصفّر تلقائياً بأي إعادة تحميل للصفحة، فالأرقام المالية بتفضل
// مخفية افتراضياً بمجرد فتح التطبيق من جديد كما هو مطلوب)
// ============================================================
let unlockedForSession = false;

export function isPayrollUnlocked() {
  return unlockedForSession;
}

export function setPayrollUnlocked(value) {
  unlockedForSession = !!value;
}
