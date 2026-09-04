// ============================================================
// attendanceCard.js - حاسبة الحضور والمرتبات لمصنع MSCANCO EGYPT
// نظام CMMS - إدارة الصيانة وتحليل العيوب
// ============================================================
// نسخة مطوَّرة (تحل محل كارت "حضور الوردية الذكي" القديم بنفس
// الاسم/التصدير حفاظاً على التوافق مع باقي الملفات):
//
// 1. Pattern حقيقي من ملف Excel (يرفعه الأدمن) بدل الحساب اليدوي
//    لدورة 6+3، مع رجوع تلقائي (Fallback) لنفس حساب الدورة القديم
//    لو مفيش Pattern مرفوع أو الفريق/التاريخ مش موجود فيه.
// 2. صلاحيات الأدمن لإدارة الـ Pattern (رفع/استبدال) ومعاملات
//    الإضافي - محفوظة Global في Firestore (راجع attendanceSettingsApi.js)
// 3. بيانات المرتب (أساسي/تأمينات/سعر ساعة الإضافي) + PIN المرتب:
//    محلية 100% على الجهاز فقط (راجع payrollLocalStore.js) - ولا
//    تُرسل أو تُخزَّن في Firebase/Firestore إطلاقاً.
// 4. إخفاء كل المبالغ المالية افتراضياً خلف قفل PIN (4 أرقام).
// 5. حضور يومي: فريق/وردية/معاد/يوم الدورة/حالة اليوم + دخول/خروج،
//    مع دعم الوردية الليلية العابرة لمنتصف الليل.
// 6. فصل 4 حسابات مستقلة (Regular / Normal OT ×1.5 / OFF Work ×2 /
//    Official Holiday Work × معامل قابل للتعديل من الأدمن) بدون أي
//    تطبيق مزدوج للمعامل على نفس الساعات.
// 7. ملخص مالي كامل بعد فتح PIN.
// 8. تصدير PDF شهري يغطي كل أيام الشهر (Pattern + حضور فعلي).
//
// ============================================================
// 🔧 سجل الإصلاحات في هذه النسخة (بدون أي تغيير في هيكل الملف أو
// التصديرات العامة - نفس الأسماء ونفس الاستخدام تمامًا):
//
// 1) calculateCycle() كانت بتستخدم 192 و 8 كأرقام ثابتة (Hardcoded)
//    بدل قراءة إعدادات الأدمن الفعلية (rules.monthlyTargetHours /
//    rules.holidayHoursDeduction) - ده كان بيسبب اختلاف بين "المطلوب"
//    المعروض في الكارت الحي و"المطلوب" في تقرير الـ PDF. تم التوحيد.
// 2) توحيد شرط عدّ "يوم الإجازة الرسمية المخصوم" بين calculateCycle
//    و calculateMonth (خصم فقط لو الإجازة الرسمية صادفت يوم عمل
//    مُجدوَل فعليًا للفني - مش أي إجازة رسمية في مدى الفترة).
// 3) حذف كود اختباري (Debug) في checkOut() كان بيفرض 12 ساعة تلقائيًا
//    عند خروج فوري (diffHours < 0.1) - كان بيسبب تسجيل ساعات عمل
//    وهمية بالغلط عند خطأ توقيت أو ضغط الزرار بسرعة.
// 4) زر "🔄 تعديل الدخول" (بعد تسجيل الخروج) كان بيمسح سجل اليوم
//    كاملاً بدون أي تأكيد - تمت إضافة confirm() قبل التنفيذ.
// 5) تصحيح عرض "خصم إجازات رسمية" في تقرير الـ PDF ليعرض القيمة
//    الفعلية من إعدادات الأدمن بدل القيمة الافتراضية الثابتة دايمًا.
// 6) getCardContextDate() كانت بتحصر البحث عن وردية ليلية مفتوحة
//    فقط لو الوقت الحالي قبل 12 ظهرًا - لو الفني اتأخر في تسجيل
//    الخروج بعد الظهر، الوردية المفتوحة كانت بتتفقد وتتحسب غلط.
// 7) addExtraDay() كانت بتفرض أوقات وردية ليلية ثابتة (20:00-08:00)
//    حتى لو الفني من فريق نهاري - دلوقتي بتستخدم أوقات وردية الفني
//    الفعلية كقيمة افتراضية.
// 8) openPastAttendanceModal() كانت بتمسح isLeave لأي يوم كان مسجل
//    كإجازة رصيد بدون تنبيه المستخدم - تمت إضافة تأكيد صريح.
// 9) إضافة دالة escapeHtml() وتطبيقها على أي نص قادم من بيانات
//    المستخدم/Firestore (الاسم/الوظيفة) قبل حقنه في innerHTML، لسد
//    ثغرة XSS محتملة.
// 10) إزالة تسجيل مكرر لنفس الدوال على window (checkInShift/
//     checkOutShift) في نهاية الملف.
// ============================================================

import { db } from "./config.js";
import { doc, getDoc } from "./firebase.js";
import { getCompanyLogoDataUrl, COMPANY_NAME_AR, COMPANY_SHORT } from "./branding.js";
import { fetchOfficialHolidaysApi } from "./services/api.js";
import {
  fetchAttendancePatternApi,
  fetchPayrollRulesApi,
  getCachedAttendancePattern,
  getCachedPayrollRules,
  DEFAULT_PAYROLL_RULES
} from "./services/attendanceSettingsApi.js";
import {
  getPayrollLocalConfig,
  savePayrollLocalConfig,
  setPayrollPin,
  verifyPayrollPin,
  hasPayrollPin,
  removePayrollPin,
  isPayrollUnlocked,
  setPayrollUnlocked
} from "./payrollLocalStore.js";
import {
  getLocalEgyptianHolidays,
  getEgyptianHolidaysUpdatedAt,
  syncEgyptianHolidaysFromGoogle
} from "./services/googleHolidaysSync.js";

// ============================================================
// 0. أدوات مساعدة عامة
// ============================================================

/**
 * (إصلاح #9) تفادي حقن HTML (XSS) عند عرض أي نص قادم من بيانات
 * المستخدم/Firestore (مثل الاسم والوظيفة) داخل innerHTML. بتحوّل
 * الحروف الخاصة لكيانات HTML آمنة بدل تنفيذها كأكواد فعلية.
 */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

// ============================================================
// 0.1 الإجازات الرسمية - كاش محلي (Cache) + جلب من Firestore
// (بدون أي تعديل عن النسخة السابقة - نفس السلوك بالظبط)
// ============================================================

const HOLIDAYS_CACHE_KEY = "official_holidays_cache_v1";

let holidaysMemoryCache = null;

export async function getOfficialHolidays() {
  if (Array.isArray(holidaysMemoryCache)) {
    return holidaysMemoryCache;
  }
  try {
    const result = await fetchOfficialHolidaysApi();
    if (result.status === "success") {
      holidaysMemoryCache = result.data;
      try {
        localStorage.setItem(HOLIDAYS_CACHE_KEY, JSON.stringify(result.data));
      } catch (e) { /* تجاهل */ }
      return holidaysMemoryCache;
    }
  } catch (e) {
    console.warn("[Attendance] فشل جلب الإجازات الرسمية من Firestore، سيتم استخدام الكاش المحلي:", e);
  }
  try {
    const raw = localStorage.getItem(HOLIDAYS_CACHE_KEY);
    holidaysMemoryCache = raw ? JSON.parse(raw) : [];
  } catch (e) {
    holidaysMemoryCache = [];
  }
  return holidaysMemoryCache;
}

export function invalidateHolidaysCache() {
  holidaysMemoryCache = null;
}

export function isOfficialHolidayDate(dateStr, holidaysList) {
  const list = Array.isArray(holidaysList) ? holidaysList : (holidaysMemoryCache || []);
  return list.some(h => h.date === dateStr);
}

export function getCachedOfficialHolidays() {
  return holidaysMemoryCache || [];
}

// إضافة: حالة طي/فرد الكارت (نفس السلوك القديم بالظبط)
let attendanceCardExpanded = false;

// ============================================================
// 1. جلب بيانات الفني من البروفايل (Firestore + Cache محلي)
// ملحوظة مهمة: hourlyRate/monthTargetHours اتشالوا من هنا نهائياً
// - دلوقتي بيانات المرتب بتتقرأ حصرياً من payrollLocalStore.js
// (محلي 100%) والساعات المستهدفة من إعدادات الأدمن Global
// (attendanceSettingsApi.js) - مفيش أي بيانات مالية بتتخزن ولا
// تتقرأ من Firestore
// ============================================================

export async function getTechnicianProfile(customUserId = null) {
  const userId = customUserId || localStorage.getItem("userId") || "local_user";

  let profile = {
    userId,
    name: localStorage.getItem("name") || "فني صيانة",
    job: localStorage.getItem("job") || "فني صيانة ميكانيكية/كهربائية",
    shiftColor: localStorage.getItem("shift") || "جرين",
    shiftStartDate: "2026-01-01",
    shiftStart: "08:00",
    shiftEnd: "20:00"
  };

  try {
    const cachedUserStr = localStorage.getItem("currentUser");
    if (cachedUserStr) {
      const cached = JSON.parse(cachedUserStr);
      if (cached) {
        profile = {
          ...profile,
          name: cached.name || profile.name,
          job: cached.job || profile.job,
          shiftColor: cached.shiftColor || cached.shift || profile.shiftColor,
          shiftStartDate: cached.shiftStartDate || profile.shiftStartDate,
          shiftStart: cached.shiftStart || profile.shiftStart,
          shiftEnd: cached.shiftEnd || profile.shiftEnd
        };
      }
    }
  } catch (e) {
    console.warn("[Attendance] Error parsing currentUser cache:", e);
  }

  if (userId && userId !== "local_user" && db) {
    try {
      const userDocRef = doc(db, "users", userId);
      const snap = await getDoc(userDocRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        profile = {
          ...profile,
          name: data.name || profile.name,
          job: data.job || profile.job,
          shiftColor: data.shiftColor || data.shift || profile.shiftColor,
          shiftStartDate: data.shiftStartDate || profile.shiftStartDate,
          shiftStart: data.shiftStart || profile.shiftStart,
          shiftEnd: data.shiftEnd || profile.shiftEnd
        };
      }
    } catch (err) {
      console.warn("[Attendance] Fetching Firestore profile skipped (offline/cached):", err.message);
    }
  }

  return profile;
}

/**
 * تطبيع لون/فريق الوردية لأحد المفاتيح الثلاثة المستخدمة في الـ
 * Pattern: green / blue / red - عشان نقدر نطابق مباشرة مع أعمدة
 * الـ Excel المرفوع بغض النظر عن شكل النص المخزَّن في بروفايل
 * المستخدم (عربي/إنجليزي)
 */
export function normalizeTeamKey(shiftColor) {
  const clean = String(shiftColor || "").trim().toLowerCase();
  if (clean.includes("blue") || clean.includes("بلو") || clean.includes("أزرق") || clean.includes("ازرق")) return "blue";
  if (clean.includes("red") || clean.includes("ريد") || clean.includes("أحمر") || clean.includes("احمر")) return "red";
  return "green";
}

// ============================================================
// 2. دالة حساب الدورة والوردية (Fallback) عند عدم وجود Pattern:
// دورة 6 عمل + 3 إجازة + 6 عمل + 3 إجازة (بدون أي تغيير عن
// السلوك القديم - تُستخدم فقط لو الأدمن لسه ما رفعش Excel، أو
// التاريخ المطلوب مش موجود في الملف المرفوع)
// ============================================================

export function getMyShiftInfo(startDate = "2026-01-01", shiftColor = "جرين", targetDate = new Date(), shiftStart = "08:00", shiftEnd = "20:00") {
  const sDate = new Date(startDate);
  const tDate = typeof targetDate === "string" ? new Date(targetDate) : new Date(targetDate);

  const sUtc = Date.UTC(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
  const tUtc = Date.UTC(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());

  const diffDays = Math.floor((tUtc - sUtc) / (1000 * 60 * 60 * 24));

  let colorOffset = 0;
  const teamKey = normalizeTeamKey(shiftColor);
  if (teamKey === "blue") colorOffset = 6;
  else if (teamKey === "red") colorOffset = 12;

  const cycleLength = 18;
  const cycleIndex = (((diffDays - colorOffset) % cycleLength) + cycleLength) % cycleLength;

  const dayShiftTime = `${shiftStart} - ${shiftEnd}`;
  const nightShiftTime = `${shiftEnd} - ${shiftStart}`;

  let isWorkDay = true;
  let isNight = false;
  let shiftType = "نهاري";
  let shiftTime = dayShiftTime;
  let dayInCycleText = "";
  let dayPos = 1, dayTotal = 6;

  if (cycleIndex >= 0 && cycleIndex <= 5) {
    dayPos = cycleIndex + 1; dayTotal = 6;
    isWorkDay = true; isNight = false; shiftType = "نهاري"; shiftTime = dayShiftTime;
    dayInCycleText = `يوم ${dayPos} من ${dayTotal}`;
  } else if (cycleIndex >= 6 && cycleIndex <= 8) {
    dayPos = cycleIndex - 5; dayTotal = 3;
    isWorkDay = false; isNight = false; shiftType = "راحة دورية"; shiftTime = "إجازة رسمية";
    dayInCycleText = `راحة (يوم ${dayPos} من ${dayTotal})`;
  } else if (cycleIndex >= 9 && cycleIndex <= 14) {
    dayPos = cycleIndex - 8; dayTotal = 6;
    isWorkDay = true; isNight = true; shiftType = "ليلي"; shiftTime = nightShiftTime;
    dayInCycleText = `يوم ${dayPos} من ${dayTotal}`;
  } else {
    dayPos = cycleIndex - 14; dayTotal = 3;
    isWorkDay = false; isNight = false; shiftType = "راحة دورية"; shiftTime = "إجازة رسمية";
    dayInCycleText = `راحة (يوم ${dayPos} من ${dayTotal})`;
  }

  return { isWorkDay, isNight, shiftType, shiftTime, dayInCycleText, code: isWorkDay ? (isNight ? "N" : "M") : "OFF", source: "cycle" };
}

function getColorBadge(shiftColor) {
  const teamKey = normalizeTeamKey(shiftColor);
  if (teamKey === "blue") {
    return { label: "بلو شفت", bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-300", dot: "bg-cyan-400" };
  }
  if (teamKey === "red") {
    return { label: "ريد شفت", bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-300", dot: "bg-rose-400" };
  }
  return { label: "جرين شفت", bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400" };
}

function shiftTypeBadgeClass(isWorkDay, isNight) {
  if (!isWorkDay) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  return isNight
    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
    : "bg-amber-500/20 text-amber-300 border-amber-500/40";
}

/**
 * حساب "يوم X من Y" داخل الدورة الحالية بالاعتماد على الـ Pattern
 * الفعلي المرفوع (سكان للخلف وللقدام على أيام من نفس النوع
 * المتتالية) - بدون أي افتراض لطول دورة ثابت (6/3) لأن الملف
 * الحقيقي هو المصدر
 */
function computePatternCyclePosition(patternForTeam, dateStr, isWorkDayToday) {
  const MAX_SCAN = 31;
  const d0 = new Date(`${dateStr}T00:00:00`);

  let pos = 1;
  for (let i = 1; i <= MAX_SCAN; i++) {
    const d = new Date(d0); d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const code = patternForTeam ? patternForTeam[ds] : undefined;
    if (code === undefined) break;
    const wasWorkDay = code !== "OFF";
    if (wasWorkDay !== isWorkDayToday) break;
    pos++;
  }

  let total = pos;
  for (let i = 1; i <= MAX_SCAN; i++) {
    const d = new Date(d0); d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const code = patternForTeam ? patternForTeam[ds] : undefined;
    if (code === undefined) break;
    const willBeWorkDay = code !== "OFF";
    if (willBeWorkDay !== isWorkDayToday) break;
    total++;
  }

  return { pos, total };
}

/**
 * الدالة الموحَّدة لتحديد معلومات وردية أي تاريخ: بتحاول أولاً من
 * الـ Pattern الفعلي المرفوع من الأدمن (raw Excel data)، ولو مفيش
 * بيانات لهذا الفريق/التاريخ بترجع تلقائياً لحساب الدورة القديم
 * (Fallback) - وده اللي بيضمن إن الكارت يفضل شغال حتى لو الأدمن
 * لسه ما رفعش Pattern لشهر معيّن
 */
export function getShiftInfoForDate(profile, dateStr, patternTeams = null) {
  const teams = patternTeams || getCachedAttendancePattern().teams || {};
  const teamKey = normalizeTeamKey(profile.shiftColor);
  const patternForTeam = teams[teamKey] || null;
  const code = patternForTeam ? patternForTeam[dateStr] : undefined;

  const colorBadge = getColorBadge(profile.shiftColor);

  if (code === "M" || code === "N" || code === "OFF") {
    const isWorkDay = code !== "OFF";
    const isNight = code === "N";
    const shiftTime = !isWorkDay
      ? "راحة (Pattern)"
      : (isNight ? `${profile.shiftEnd} - ${profile.shiftStart}` : `${profile.shiftStart} - ${profile.shiftEnd}`);
    const { pos, total } = computePatternCyclePosition(patternForTeam, dateStr, isWorkDay);
    const dayInCycleText = isWorkDay ? `يوم ${pos} من ${total}` : `راحة (يوم ${pos} من ${total})`;

    return {
      isWorkDay, isNight,
      shiftType: !isWorkDay ? "راحة دورية" : (isNight ? "ليلي" : "نهاري"),
      shiftTime, dayInCycleText, code, source: "pattern",
      colorBadge, badgeColorClass: shiftTypeBadgeClass(isWorkDay, isNight)
    };
  }

  // Fallback: مفيش Pattern لهذا الفريق/التاريخ - استخدم حساب الدورة
  const cycleInfo = getMyShiftInfo(profile.shiftStartDate, profile.shiftColor, dateStr, profile.shiftStart, profile.shiftEnd);
  return {
    ...cycleInfo,
    colorBadge,
    badgeColorClass: shiftTypeBadgeClass(cycleInfo.isWorkDay, cycleInfo.isNight)
  };
}

// ============================================================
// 3. دوال التخزين المحلي لسجلات الحضور اليومية (localStorage)
// (بدون أي تغيير في آلية التخزين نفسها - نفس المفاتيح القديمة
// بالظبط عشان أي سجلات سابقة تفضل شغالة)
// ============================================================

export function getTodayDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStorageKey(userId, dateStr) {
  return `attendance_${userId}_${dateStr}`;
}

export function getDailyAttendanceRecord(userId, dateStr) {
  const key = getStorageKey(userId, dateStr);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("[Attendance] Error reading local record:", e);
    return null;
  }
}

export function saveDailyAttendanceRecord(userId, dateStr, data) {
  const key = getStorageKey(userId, dateStr);
  try {
    localStorage.setItem(key, JSON.stringify({
      userId,
      date: dateStr,
      updatedAt: new Date().toISOString(),
      ...data
    }));
  } catch (e) {
    console.error("[Attendance] Error saving local record:", e);
  }
}

/**
 * تحديد "تاريخ السياق" الحالي للكارت: عادةً النهارده، إلا لو فيه
 * وردية ليلية بدأت إمبارح ولسه مفتوحة (فيها دخول بدون خروج) - عشان
 * دعم الوردية الليلية العابرة لمنتصف الليل (تسجيل الخروج والساعات
 * المحسوبة تفضل مرتبطة بيوم الوردية الصح، مش باليوم التقويمي اللي
 * بيحصل فيه الخروج فعلياً).
 *
 * (إصلاح #6) الكود القديم كان بيحصر البحث عن وردية إمبارح مفتوحة
 * فقط لو الوقت الحالي قبل الساعة 12 ظهرًا. لو الفني اتأخر في تسجيل
 * الخروج (بعد الظهر)، الوردية المفتوحة كانت "بتضيع" ويبدأ سياق يوم
 * جديد بالغلط، فتفضل الوردية القديمة مفتوحة للأبد. دلوقتي بنفحص
 * سجل إمبارح دايمًا، وبنقبله كسياق لليوم الحالي طالما إن الوردية
 * اتفتحت خلال آخر 30 ساعة تقريبًا (حد منطقي أقصى لأي وردية، حتى مع
 * إضافي)، بغض النظر عن الساعة دلوقتي
 */
export function getCardContextDate(userId, now = new Date()) {
  const todayStr = getTodayDateString(now);

  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yStr = getTodayDateString(y);
  const yRecord = getDailyAttendanceRecord(userId, yStr);

  if (yRecord && yRecord.checkIn && !yRecord.checkOut) {
    const checkInTs = yRecord.checkInTimestamp;
    const hoursSinceCheckIn = checkInTs ? (now.getTime() - checkInTs) / (1000 * 60 * 60) : 0;
    if (!checkInTs || hoursSinceCheckIn <= 30) {
      return yStr;
    }
  }
  return todayStr;
}

// ============================================================
// 4. العمليات التفاعلية: checkIn, checkOut, addExtraDay, takeLeave
// ============================================================

export async function checkIn() {
  const profile = await getTechnicianProfile();
  // دخول جديد بيبدأ دايماً وردية "النهارده" (مش سياق يوم مفتوح
  // سابق - ده بيتحدد وقت الخروج فقط)
  const todayStr = getTodayDateString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};

  saveDailyAttendanceRecord(profile.userId, todayStr, {
    ...currentRecord,
    checkIn: timeStr,
    checkInTimestamp: now.getTime(),
    checkOut: null,
    checkOutTimestamp: null,
    status: "checked_in"
  });

  refreshAttendanceCard();
}

// معيار طول الوردية القياسي (12 ساعة) المستخدَم لتحديد هل الوقت
// المنقضي منذ الدخول تجاوز الوردية العادية ويحتاج إدخال ساعات
// إضافية يدوي أو لأ
const STANDARD_SHIFT_LENGTH_HOURS = 12;

/**
 * تسجيل الخروج - بيحسب الساعات المنقضية من الدخول، ولو تجاوزت
 * طول الوردية القياسي (12 ساعة) ومفيش قيمة إضافي يدوية اتبعتت،
 * بيرجع { needsManualOvertime: true } عشان الكود اللي بينادي الدالة
 * (window.handleAttendanceButton) يفتح مودال إدخال الساعات
 * الإضافية يدويًا، ثم يعيد نداء checkOut() تاني مع القيمة المُدخلة.
 * البيانات بتتحفظ بالشكل الجديد {normalHours, overtimeHours, type}
 * مع الإبقاء على حقل hoursWorked القديم كمان للتوافق العكسي مع أي
 * كود لسه بيقرأه (calculateMonth/calculateCycle بيدعموا الشكلين)
 */
export async function checkOut(manualOvertimeHours = null) {
  const profile = await getTechnicianProfile();
  const contextDate = getCardContextDate(profile.userId);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const currentRecord = getDailyAttendanceRecord(profile.userId, contextDate) || {};
  const checkInTimestamp = currentRecord.checkInTimestamp || (now.getTime() - 12 * 60 * 60 * 1000);

  let diffHours = (now.getTime() - checkInTimestamp) / (1000 * 60 * 60);
  // (إصلاح #3) تم حذف كود اختباري (Debug) كان بيفرض 12 ساعة تلقائياً
  // عند خروج فوري (diffHours < 0.1)، وكان بيسبب تسجيل ساعات عمل وهمية
  // بالغلط لو حصل خطأ توقيت أو ضغط الزرار بسرعة. دلوقتي بنعتمد على
  // الفرق الحقيقي فقط (بحد أدنى صفر لتفادي أي قيمة سالبة)
  diffHours = Math.max(0, Number(diffHours.toFixed(2)));

  let normalHours = Math.min(diffHours, STANDARD_SHIFT_LENGTH_HOURS);
  let overtimeHours = 0;

  if (diffHours > STANDARD_SHIFT_LENGTH_HOURS) {
    if (manualOvertimeHours === null || manualOvertimeHours === undefined) {
      return {
        needsManualOvertime: true,
        elapsedHours: diffHours,
        shiftLengthHours: STANDARD_SHIFT_LENGTH_HOURS,
        contextDate
      };
    }
    overtimeHours = Math.max(0, Number(manualOvertimeHours) || 0);
  }

  const dayInfo = getShiftInfoForDate(profile, contextDate);
  const isHoliday = isOfficialHolidayDate(contextDate, getCachedOfficialHolidays());
  const type = !dayInfo.isWorkDay ? "off" : (isHoliday ? "holiday" : "normal");

  normalHours = Number(normalHours.toFixed(2));
  overtimeHours = Number(overtimeHours.toFixed(2));

  saveDailyAttendanceRecord(profile.userId, contextDate, {
    ...currentRecord,
    checkIn: currentRecord.checkIn || "08:00",
    checkInTimestamp,
    checkOut: timeStr,
    checkOutTimestamp: now.getTime(),
    normalHours,
    overtimeHours,
    hoursWorked: Number((normalHours + overtimeHours).toFixed(2)), // توافق عكسي
    type,
    status: "checked_out",
    isExtraDay: false,
    isLeave: false
  });

  refreshAttendanceCard();
  return { needsManualOvertime: false };
}

/**
 * إضافة يوم إضافي (عمل كامل في يوم راحة/OFF مُجدوَل - يُحتسب دايماً
 * ضمن فئة "العمل في يوم OFF" × المعامل، بغض النظر عن حساب الساعات
 * الفعلي، لأنه إعلان صريح من الفني إنه اشتغل يوم راحته)
 */
export async function addExtraDay() {
  if (!confirm("هل تريد إضافة يوم إضافي كامل (12 ساعة) في يوم راحتك المُجدوَل؟ سيُحتسب بالكامل ضمن فئة \"العمل في يوم OFF\".")) return;

  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};

  // (إصلاح #7) كانت الأوقات الافتراضية ثابتة (20:00-08:00) وكأنها
  // دايماً وردية ليلية، حتى لو الفني من فريق نهاري. دلوقتي بنستخدم
  // أوقات وردية الفني الفعلية (shiftStart/shiftEnd) كقيمة افتراضية أدق
  saveDailyAttendanceRecord(profile.userId, todayStr, {
    ...currentRecord,
    checkIn: currentRecord.checkIn || profile.shiftStart || "08:00",
    checkOut: currentRecord.checkOut || profile.shiftEnd || "20:00",
    hoursWorked: 12,
    isExtraDay: true,
    isLeave: false,
    status: "extra_day"
  });

  refreshAttendanceCard();
}

/**
 * تسجيل إجازة من الرصيد (8 ساعات مدفوعة عادي - بتضاف لمجمّع
 * الساعات العادية اللي بتُقارن بالساعات المطلوبة شهرياً)
 */
export async function takeLeave() {
  if (!confirm("هل تريد تسجيل إجازة من الرصيد (8 ساعات مدفوعة الأجر ضمن الساعات العادية)؟")) return;

  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};

  saveDailyAttendanceRecord(profile.userId, todayStr, {
    ...currentRecord,
    checkIn: "—",
    checkOut: "—",
    hoursWorked: 8,
    isExtraDay: false,
    isLeave: true,
    status: "leave"
  });

  refreshAttendanceCard();
}

/**
 * زر تسجيل الحضور الواحد: أول ضغطة = تسجيل دخول، والضغطة التانية
 * (بوجود دخول وعدم وجود خروج) = تسجيل خروج + حساب الساعات. لو
 * الساعات المنقضية تجاوزت طول الوردية القياسي، بيفتح مودال إدخال
 * الساعات الإضافية يدويًا قبل حفظ الخروج نهائيًا
 */
window.handleAttendanceButton = async function () {
  const profile = await getTechnicianProfile();
  const contextDate = getCardContextDate(profile.userId);
  const record = getDailyAttendanceRecord(profile.userId, contextDate);

  if (!record || !record.checkIn) {
    await checkIn();
    return;
  }

  if (record.checkIn && !record.checkOut) {
    const result = await checkOut();
    if (result && result.needsManualOvertime) {
      const manualValue = await requestManualOvertimeInput(result.elapsedHours, result.shiftLengthHours);
      if (manualValue === null) return; // المستخدم لغى الإدخال - يفضل الحضور مفتوح لحد ما يضغط تاني
      await checkOut(manualValue);
    }
    return;
  }

  alert("✅ تم تسجيل حضورك وانصرافك لهذا اليوم بالفعل.");
};

// إبقاء الأسماء القديمة شغالة لأي كود/أزرار سابقة لسه بتستخدمها
window.checkInShift = checkIn;
window.checkOutShift = checkOut;

/**
 * مودال إدخال الساعات الإضافية يدويًا عند تجاوز الساعات المنقضية
 * لطول الوردية القياسي - بيرجع Promise<number|null> (null لو
 * المستخدم لغى العملية)
 */
function requestManualOvertimeInput(elapsedHours, shiftLengthHours) {
  return new Promise(resolve => {
    closeAnyPayrollModal();
    const suggestedOt = Math.max(0, Number((elapsedHours - shiftLengthHours).toFixed(2)));

    const overlay = document.createElement("div");
    overlay.id = "payrollModalOverlay";
    overlay.dir = "rtl";
    overlay.className = "fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="w-full max-w-xs bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-amber-400/40 rounded-2xl p-5 shadow-2xl">
        <div class="text-center mb-3">
          <div class="text-2xl mb-1">⏱️</div>
          <div class="text-white font-black text-sm">تجاوزت ساعات الوردية القياسية</div>
          <div class="text-[10px] text-slate-400 mt-1">الساعات المنقضية: ${elapsedHours} س (الوردية: ${shiftLengthHours} س) - أدخل عدد ساعات الإضافي المستحقة فعليًا</div>
        </div>
        <input id="manualOtInput" type="number" min="0" step="0.25" value="${suggestedOt}"
          class="w-full text-center text-xl p-3 rounded-xl bg-slate-950 border border-slate-700 text-white mb-3" />
        <div class="grid grid-cols-2 gap-2">
          <button id="manualOtCancel" class="py-2.5 rounded-xl bg-slate-700/60 text-slate-200 text-xs font-bold">إلغاء</button>
          <button id="manualOtSave" class="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 text-xs font-black">✅ تأكيد وتسجيل الخروج</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#manualOtInput").focus();

    overlay.querySelector("#manualOtCancel").onclick = () => { overlay.remove(); resolve(null); };
    overlay.querySelector("#manualOtSave").onclick = () => {
      const val = Math.max(0, Number(overlay.querySelector("#manualOtInput").value) || 0);
      overlay.remove();
      resolve(val);
    };
  });
}

/**
 * مودال "إضافة حضور سابق": تاريخ (بدون السماح بتواريخ مستقبلية) +
 * ساعات عادية + ساعات إضافية + نوع اليوم (عادي/OFF/إجازة رسمية) -
 * بيحفظ بنفس شكل البيانات الجديد ({normalHours, overtimeHours, type})
 * مع البقاء متوافق تمامًا مع السجلات القديمة (مفيش أي حذف/تعديل لها)
 */
window.openPastAttendanceModal = async function () {
  closeAnyPayrollModal();
  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();

  const overlay = document.createElement("div");
  overlay.id = "payrollModalOverlay";
  overlay.dir = "rtl";
  overlay.className = "fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4";
  overlay.innerHTML = `
    <div class="w-full max-w-sm bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-cyan-400/40 rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="text-white font-black text-sm mb-3 flex items-center gap-2"><span>🗓️</span><span>إضافة حضور سابق</span></div>

      <label class="block text-[11px] text-slate-300 mb-1">التاريخ</label>
      <input id="pastAttDate" type="date" max="${todayStr}" value="${todayStr}"
        class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-3" />

      <label class="block text-[11px] text-slate-300 mb-1">الساعات العادية</label>
      <input id="pastAttNormal" type="number" min="0" step="0.25" value="12"
        class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-3" />

      <label class="block text-[11px] text-slate-300 mb-1">الساعات الإضافية</label>
      <input id="pastAttOvertime" type="number" min="0" step="0.25" value="0"
        class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-3" />

      <label class="block text-[11px] text-slate-300 mb-1">نوع اليوم</label>
      <select id="pastAttType" class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-4">
        <option value="normal">عادي</option>
        <option value="off">OFF (يوم راحة)</option>
        <option value="holiday">إجازة رسمية</option>
      </select>

      <div id="pastAttError" class="text-[11px] text-rose-400 text-center mb-2 hidden"></div>

      <div class="grid grid-cols-2 gap-2">
        <button id="pastAttCancel" class="py-2.5 rounded-xl bg-slate-700/60 text-slate-200 text-xs font-bold">إلغاء</button>
        <button id="pastAttSave" class="py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-900 text-xs font-black">💾 حفظ</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#pastAttCancel").onclick = () => overlay.remove();

  overlay.querySelector("#pastAttSave").onclick = () => {
    const errBox = overlay.querySelector("#pastAttError");
    const dateVal = overlay.querySelector("#pastAttDate").value;
    const normalHours = Math.max(0, Number(overlay.querySelector("#pastAttNormal").value) || 0);
    const overtimeHours = Math.max(0, Number(overlay.querySelector("#pastAttOvertime").value) || 0);
    const type = overlay.querySelector("#pastAttType").value;

    if (!dateVal) {
      errBox.textContent = "⚠️ يرجى اختيار التاريخ";
      errBox.classList.remove("hidden");
      return;
    }
    if (dateVal > todayStr) {
      errBox.textContent = "⚠️ غير مسموح باختيار تاريخ مستقبلي";
      errBox.classList.remove("hidden");
      return;
    }

    const existing = getDailyAttendanceRecord(profile.userId, dateVal) || {};

    // (إصلاح #8) لو اليوم ده كان مسجَّل قبل كده كـ "إجازة رصيد"
    // (isLeave) وهيتم الكتابة فوقه ببيانات حضور يدوية، بنطلب تأكيد
    // صريح قبل الإلغاء عشان منمسحش بيانات إجازة مسجلة بدون علم المستخدم
    if (existing.isLeave) {
      const confirmOverwrite = confirm("هذا اليوم مسجَّل حالياً كإجازة رصيد. هل تريد استبداله ببيانات الحضور المُدخلة يدويًا؟");
      if (!confirmOverwrite) return;
    }

    saveDailyAttendanceRecord(profile.userId, dateVal, {
      ...existing,
      checkIn: existing.checkIn || "—",
      checkOut: existing.checkOut || "—",
      normalHours,
      overtimeHours,
      hoursWorked: Number((normalHours + overtimeHours).toFixed(2)),
      type,
      isExtraDay: type === "off",
      isLeave: false,
      status: "manual_past_entry"
    });

    overlay.remove();
    refreshAttendanceCard();
  };
};

// ============================================================
// 5. تصنيف يوم واحد (Shared Helper) + حساب إجماليات الشهر التقويمي
// (calculateMonth - يُستخدم في تصدير PDF) + حساب إجماليات دورة
// 21 → 20 (calculateCycle - يُستخدم في عرض الكارت الحي، بالصيغة
// المطلوبة: requiredHours = targetHours - (holidayCountInCycle × خصم))
// ============================================================

/**
 * تصنيف يوم واحد لأي مستخدم: بيرجع الوردية (Pattern/Fallback)،
 * هل هو إجازة رسمية، سجل الحضور (لو موجود)، عدد الساعات، والفئة
 * (bucket) اللي بيقع فيها اليوم. بيدعم شكلي البيانات: القديم
 * (record.hoursWorked) والجديد (record.normalHours/overtimeHours)
 * بالإضافة لحقل record.type الصريح (من التسجيل التلقائي أو من
 * مودال "إضافة حضور سابق") لو موجود، وإلا بيرجع للاشتقاق التلقائي
 * من الـ Pattern + الإجازات الرسمية (بالظبط زي السلوك القديم)
 */
function classifyDay(userId, dateStr, profile, patternTeams, holidays) {
  const dayInfo = getShiftInfoForDate(profile, dateStr, patternTeams);
  const isHoliday = isOfficialHolidayDate(dateStr, holidays);
  const record = getDailyAttendanceRecord(userId, dateStr);

  const hasNewFields = !!(record && (record.normalHours != null || record.overtimeHours != null));
  const hoursWorked = record
    ? (hasNewFields
        ? Number(record.normalHours || 0) + Number(record.overtimeHours || 0)
        : Number(record.hoursWorked || 0))
    : 0;

  const isLeave = !!(record && record.isLeave);
  const isExtraDay = !!(record && record.isExtraDay);
  const explicitType = record && record.type; // 'normal' | 'off' | 'holiday'

  let bucket = "none";
  if (isLeave) {
    bucket = "leave";
  } else if (isExtraDay) {
    bucket = "off";
  } else if (explicitType === "holiday") {
    bucket = hoursWorked > 0 ? "holiday" : "none";
  } else if (explicitType === "off") {
    bucket = hoursWorked > 0 ? "off" : "none";
  } else if (explicitType === "normal") {
    bucket = hoursWorked > 0 ? "work" : "none";
  } else if (dayInfo.isWorkDay && isHoliday) {
    bucket = hoursWorked > 0 ? "holiday" : "none";
  } else if (!dayInfo.isWorkDay && hoursWorked > 0) {
    bucket = "off";
  } else if (dayInfo.isWorkDay && hoursWorked > 0) {
    bucket = "work";
  }

  return { date: dateStr, dayInfo, isHoliday, record, hoursWorked, bucket };
}

/**
 * حساب مدى دورة الحضور والمرتبات: من يوم 21 في الشهر لحد يوم 20 في
 * الشهر التالي (بالظبط كما هو مطلوب) - باستخدام dayjs (محمّلة عبر
 * CDN في index.html) لضمان دقة حساب نهايات الشهور المختلفة الطول
 * وتغيّر السنة عند دورة ديسمبر/يناير. لو dayjs مش متاحة لأي سبب
 * (فشل تحميل الـ CDN) فيه احتياطي بديل بنفس المنطق بالظبط بـ
 * Date الأصلية في JS، فالنظام يفضل شغال في الحالتين
 */
export function getCycleRange(referenceDate = new Date()) {
  const hasDayjs = typeof window !== "undefined" && typeof window.dayjs === "function";

  if (hasDayjs) {
    const ref = window.dayjs(referenceDate);
    const start = ref.date() >= 21 ? ref.date(21) : ref.subtract(1, "month").date(21);
    const end = start.add(1, "month").date(20);
    return {
      startStr: start.format("YYYY-MM-DD"),
      endStr: end.format("YYYY-MM-DD"),
      label: `${start.format("D MMM")} – ${end.format("D MMM YYYY")}`
    };
  }

  // احتياطي بدون dayjs (نفس منطق الحساب بالظبط)
  const ref = new Date(referenceDate);
  let startY = ref.getFullYear(), startM = ref.getMonth();
  if (ref.getDate() < 21) {
    startM -= 1;
    if (startM < 0) { startM = 11; startY -= 1; }
  }
  const start = new Date(startY, startM, 21);
  let endM = startM + 1, endY = startY;
  if (endM > 11) { endM = 0; endY += 1; }
  const end = new Date(endY, endM, 20);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startStr: fmt(start), endStr: fmt(end), label: `${fmt(start)} – ${fmt(end)}` };
}

/**
 * حساب إجماليات دورة 21 → 20 الحالية (أو أي دورة تحتوي على
 * referenceDate) - هذا هو المصدر الحي لعرض الكارت (المطلوب/المُنجز
 * وProgress Bar).
 *
 * (إصلاح #1 و #2) الصيغة القديمة كانت بتستخدم 192 و 8 كأرقام ثابتة
 * (Hardcoded) بدل قراءة إعدادات الأدمن الفعلية (rules.monthlyTargetHours
 * / rules.holidayHoursDeduction)، وكمان كانت بتخصم أي إجازة رسمية تقع
 * في مدى الدورة بدون شرط (حتى لو كانت أصلاً يوم راحة مُجدوَل للفني).
 * دلوقتي:
 *  requiredHours = rules.monthlyTargetHours - (holidayCountInCycle × rules.holidayHoursDeduction)
 *  حيث holidayCountInCycle = عدد أيام العمل المُجدوَلة فعليًا للفني
 *  واللي صادفت إجازة رسمية (نفس منطق calculateMonth بالظبط - موحَّد الآن)
 */
export function calculateCycle(userId, options = {}) {
  const profile = options.profile || {
    userId, shiftColor: localStorage.getItem("shift") || "جرين",
    shiftStartDate: "2026-01-01", shiftStart: "08:00", shiftEnd: "20:00"
  };
  const patternTeams = options.patternTeams || (getCachedAttendancePattern && getCachedAttendancePattern() ? getCachedAttendancePattern().teams : null);
  const holidays = options.holidays || (getCachedOfficialHolidays ? getCachedOfficialHolidays() : []);
  const referenceDate = options.referenceDate || new Date();
  const rules = options.rules || (getCachedPayrollRules ? getCachedPayrollRules() : DEFAULT_PAYROLL_RULES) || DEFAULT_PAYROLL_RULES;

  const range = getCycleRange(referenceDate);

  let poolHours = 0, offWorkHours = 0, holidayWorkHours = 0, holidayCountInCycle = 0;
  let totalWorkDays = 0, totalLeaves = 0, totalExtraDays = 0, totalHolidayWorkDays = 0, totalOffWorkDays = 0;
  const daysList = [];

  let cursor = new Date(`${range.startStr}T00:00:00`);
  const endDate = new Date(`${range.endStr}T00:00:00`);

  while (cursor.getTime() <= endDate.getTime()) {
    const dateStr = getTodayDateString(cursor);
    const info = classifyDay(userId, dateStr, profile, patternTeams, holidays);

    // (إصلاح #2) خصم فقط لو الإجازة الرسمية صادفت يوم عمل مُجدوَل
    // فعليًا للفني - موحَّد مع نفس شرط calculateMonth بالضبط
    if (info.dayInfo.isWorkDay && info.isHoliday) holidayCountInCycle++;

    if (info.bucket === "leave") { poolHours += info.hoursWorked; totalLeaves++; }
    else if (info.bucket === "off") {
      offWorkHours += info.hoursWorked;
      totalOffWorkDays++;
      if (info.record?.isExtraDay) totalExtraDays++;
    } else if (info.bucket === "holiday") { holidayWorkHours += info.hoursWorked; totalHolidayWorkDays++; }
    else if (info.bucket === "work") { poolHours += info.hoursWorked; totalWorkDays++; }

    daysList.push(info);
    cursor.setDate(cursor.getDate() + 1);
  }

  // (إصلاح #1) استخدام قيم rules الفعلية بدل الأرقام الثابتة 192 / 8
  const targetHours = Number(rules.monthlyTargetHours) || DEFAULT_PAYROLL_RULES.monthlyTargetHours;
  const holidayDeductionPerDay = Number(rules.holidayHoursDeduction) || DEFAULT_PAYROLL_RULES.holidayHoursDeduction;
  const requiredHours = Math.max(0, targetHours - holidayCountInCycle * holidayDeductionPerDay);

  const regularHours = Number(Math.min(poolHours, requiredHours).toFixed(2));
  const normalOvertimeHours = Number(Math.max(0, poolHours - requiredHours).toFixed(2));
  offWorkHours = Number(offWorkHours.toFixed(2));
  holidayWorkHours = Number(holidayWorkHours.toFixed(2));

  const registeredHours = Number((regularHours + normalOvertimeHours + offWorkHours + holidayWorkHours).toFixed(2));
  const progressPercent = requiredHours > 0 ? Math.min(100, Math.round((registeredHours / requiredHours) * 100)) : 100;

  return {
    cycleStart: range.startStr,
    cycleEnd: range.endStr,
    cycleLabel: range.label,
    targetHours,
    requiredHours,
    holidayCountInCycle,
    regularHours,
    normalOvertimeHours,
    offWorkHours,
    holidayWorkHours,
    registeredHours,
    progressPercent,
    totalWorkDays,
    totalLeaves,
    totalExtraDays,
    totalOffWorkDays,
    totalHolidayWorkDays,
    daysList
  };
}

/**
 * حساب إجماليات الشهر التقويمي (1 → آخر يوم بالشهر) - يُستخدم حصرياً
 * في تصدير تقرير الـ PDF الشهري (لم يتغيّر نطاقه أو صيغته بناءً على
 * طلب هذا التعديل، للحفاظ على تقرير PDF كما هو تمامًا). الكارت الحي
 * (المطلوب/Progress Bar) بيستخدم دلوقتي calculateCycle بدل هذه
 * الدالة - راجع أعلاه
 */
export function calculateMonth(userId, yearMonth = null, options = {}) {
  const profile = options.profile || {
    userId, shiftColor: localStorage.getItem("shift") || "جرين",
    shiftStartDate: "2026-01-01", shiftStart: "08:00", shiftEnd: "20:00"
  };
  const rules = options.rules || (getCachedPayrollRules ? getCachedPayrollRules() : DEFAULT_PAYROLL_RULES) || DEFAULT_PAYROLL_RULES;
  const patternTeams = options.patternTeams || (getCachedAttendancePattern && getCachedAttendancePattern() ? getCachedAttendancePattern().teams : null);
  const holidays = options.holidays || (getCachedOfficialHolidays ? getCachedOfficialHolidays() : []);

  const currentYM = yearMonth || getTodayDateString().substring(0, 7);
  const [yStr, mStr] = currentYM.split("-");
  const y = Number(yStr), m = Number(mStr);
  const daysInMonth = new Date(y, m, 0).getDate();

  let poolHours = 0;          // ساعات تُقارن بسقف الساعات المطلوبة (حضور عادي + إجازة رصيد)
  let offWorkHours = 0;       // عمل في يوم OFF مُجدوَل (× offWorkMultiplier)
  let holidayWorkHours = 0;   // عمل في يوم عمل مُجدوَل صادف إجازة رسمية (× holidayWorkMultiplier)
  let holidayDeductionDays = 0; // عدد أيام العمل المُجدوَلة المصادفة لإجازة رسمية (لخصم الساعات المطلوبة)
  let totalWorkDays = 0, totalLeaves = 0, totalExtraDays = 0, totalHolidayWorkDays = 0, totalOffWorkDays = 0;

  const daysList = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const info = classifyDay(userId, dateStr, profile, patternTeams, holidays);

    if (info.dayInfo.isWorkDay && info.isHoliday) holidayDeductionDays++;

    if (info.bucket === "leave") { poolHours += info.hoursWorked; totalLeaves++; }
    else if (info.bucket === "off") {
      offWorkHours += info.hoursWorked;
      totalOffWorkDays++;
      if (info.record?.isExtraDay) totalExtraDays++;
    } else if (info.bucket === "holiday") { holidayWorkHours += info.hoursWorked; totalHolidayWorkDays++; }
    else if (info.bucket === "work") { poolHours += info.hoursWorked; totalWorkDays++; }

    daysList.push(info);
  }

  const targetHours = Number(rules.monthlyTargetHours) || DEFAULT_PAYROLL_RULES.monthlyTargetHours;
  const holidayDeductionPerDay = Number(rules.holidayHoursDeduction) || DEFAULT_PAYROLL_RULES.holidayHoursDeduction;
  const requiredHours = Math.max(0, targetHours - holidayDeductionPerDay * holidayDeductionDays);

  const regularHours = Number(Math.min(poolHours, requiredHours).toFixed(2));
  const normalOvertimeHours = Number(Math.max(0, poolHours - requiredHours).toFixed(2));
  offWorkHours = Number(offWorkHours.toFixed(2));
  holidayWorkHours = Number(holidayWorkHours.toFixed(2));

  const totalHours = Number((regularHours + normalOvertimeHours + offWorkHours + holidayWorkHours).toFixed(2));
  const progressPercent = requiredHours > 0 ? Math.min(100, Math.round((totalHours / requiredHours) * 100)) : 100;

  return {
    yearMonth: currentYM,
    daysInMonth,
    targetHours,
    requiredHours,
    holidayDeductionDays,
    holidayDeductionPerDay,
    regularHours,
    normalOvertimeHours,
    offWorkHours,
    holidayWorkHours,
    totalHours,
    progressPercent,
    totalWorkDays,
    totalLeaves,
    totalExtraDays,
    totalOffWorkDays,
    totalHolidayWorkDays,
    daysList
  };
}

/**
 * حساب الجانب المالي كاملاً بناءً على إجماليات الشهر (calculateMonth)
 * وبيانات المرتب المحلية للمستخدم (baseSalary/insurancePercent/otHourRate)
 * ومعاملات الإضافي (rules) - المرتب الأساسي يُصرف كقيمة ثابتة، وسعر
 * ساعة الإضافي اللي أدخله المستخدم هو المستخدَم لحساب كل فئات
 * الإضافي (مش سعر ساعة مشتق من المرتب الأساسي)
 */
export function computeFinancials(monthData, localConfig, rules = getCachedPayrollRules()) {
  const baseSalary = Number(localConfig.baseSalary) || 0;
  const insurancePercent = Number(localConfig.insurancePercent) || 0;
  const otHourRate = Number(localConfig.otHourRate) || 0;

  const normalOvertimeMoney = Number((monthData.normalOvertimeHours * otHourRate * (Number(rules.normalOvertimeMultiplier) || DEFAULT_PAYROLL_RULES.normalOvertimeMultiplier)).toFixed(2));
  const offWorkMoney = Number((monthData.offWorkHours * otHourRate * (Number(rules.offWorkMultiplier) || DEFAULT_PAYROLL_RULES.offWorkMultiplier)).toFixed(2));
  const holidayWorkMoney = Number((monthData.holidayWorkHours * otHourRate * (Number(rules.holidayWorkMultiplier) || DEFAULT_PAYROLL_RULES.holidayWorkMultiplier)).toFixed(2));

  const totalOvertimeMoney = Number((normalOvertimeMoney + offWorkMoney + holidayWorkMoney).toFixed(2));
  const insuranceAmount = Number((baseSalary * (insurancePercent / 100)).toFixed(2));
  const netExpectedSalary = Number((baseSalary + totalOvertimeMoney - insuranceAmount).toFixed(2));

  return {
    baseSalary,
    insurancePercent,
    otHourRate,
    normalOvertimeMoney,
    offWorkMoney,
    holidayWorkMoney,
    totalOvertimeMoney,
    insuranceAmount,
    netExpectedSalary
  };
}

// ============================================================
// 6. تصدير PDF الشهري (يغطي كل أيام الشهر + الملخص المالي) -
// يتطلب فتح PIN أولاً (نفس قاعدة إخفاء البيانات المالية)
// ============================================================

const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function codeLabel(code) {
  if (code === "M") return "☀️ صباحي";
  if (code === "N") return "🌙 ليلي";
  if (code === "OFF") return "🏖️ راحة";
  return "—";
}

export async function exportPDF(customUserId = null, customYM = null) {
  const profile = await getTechnicianProfile(customUserId);

  if (!isPayrollUnlocked()) {
    const unlocked = await requestPayrollUnlock();
    if (!unlocked) return;
  }

  const yearMonth = customYM || getTodayDateString().substring(0, 7);
  await loadAttendanceSettingsCaches();

  const rules = getCachedPayrollRules();
  const monthData = calculateMonth(profile.userId, yearMonth, { profile, rules });
  const localConfig = getPayrollLocalConfig(profile.userId);
  const financials = computeFinancials(monthData, localConfig, rules);

  const logoDataUrl = await getCompanyLogoDataUrl();

  const [yearStr, monthStr] = yearMonth.split("-");
  const monthArabic = MONTH_NAMES_AR[parseInt(monthStr, 10) - 1] || monthStr;

  // (إصلاح #9) الاسم والوظيفة قادمين من Firestore/localStorage، فبيتم
  // تنظيفهم (escapeHtml) قبل حقنهم في innerHTML لسد أي ثغرة XSS محتملة
  const safeName = escapeHtml(profile.name);
  const safeJob = escapeHtml(profile.job);

  let tableRowsHtml = "";
  monthData.daysList.forEach((row, idx) => {
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    const statusBadge = row.bucket === "holiday"
      ? '<span style="color:#b45309;font-weight:bold;background:#fef3c7;padding:2px 6px;border-radius:4px;">🎉 عمل إجازة رسمية</span>'
      : row.bucket === "off"
      ? '<span style="color:#9d174d;font-weight:bold;background:#fce7f3;padding:2px 6px;border-radius:4px;">عمل في يوم OFF</span>'
      : row.bucket === "leave"
      ? '<span style="color:#047857;font-weight:bold;background:#d1fae5;padding:2px 6px;border-radius:4px;">إجازة رصيد</span>'
      : row.bucket === "work"
      ? '<span style="color:#1e3a8a;font-weight:bold;background:#dbeafe;padding:2px 6px;border-radius:4px;">حضور عادي</span>'
      : (row.isHoliday ? '<span style="color:#e11d48;font-weight:bold;">إجازة رسمية (راحة أصلاً)</span>' : '<span style="color:#94a3b8;">—</span>');

    tableRowsHtml += `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
        <td style="padding: 8px 6px; text-align: center; font-weight: bold; border-left: 1px solid #e2e8f0;">${idx + 1}</td>
        <td style="padding: 8px 6px; text-align: center; direction: ltr; unicode-bidi: embed; border-left: 1px solid #e2e8f0;">${row.date}</td>
        <td style="padding: 8px 6px; text-align: center; border-left: 1px solid #e2e8f0;">${codeLabel(row.dayInfo.code)}</td>
        <td style="padding: 8px 6px; text-align: center; border-left: 1px solid #e2e8f0;">${statusBadge}</td>
        <td style="padding: 8px 6px; text-align: center; direction: ltr; unicode-bidi: embed; border-left: 1px solid #e2e8f0; color: #334155;">${row.record?.checkIn || "—"}</td>
        <td style="padding: 8px 6px; text-align: center; direction: ltr; unicode-bidi: embed; border-left: 1px solid #e2e8f0; color: #334155;">${row.record?.checkOut || "—"}</td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 900; color: #0f172a;">${row.hoursWorked || 0} س</td>
      </tr>
    `;
  });

  const printWrapper = document.createElement("div");
  // السر الجذري لحل مشكلة القص: جعل الحاوية الأساسية LTR لإجبار html2canvas على حساب الإحداثيات من 0 
  printWrapper.dir = "ltr";
  printWrapper.style.position = "absolute";
  printWrapper.style.top = "0px";
  printWrapper.style.left = "0px";
  // عرض ديناميكي مرجعي عالي الدقة يتم تحجيمه تلقائياً داخل ورق A4 بواسطة html2pdf
  printWrapper.style.width = "850px"; 
  printWrapper.style.padding = "24px";
  printWrapper.style.zIndex = "-9999"; 
  printWrapper.style.backgroundColor = "#ffffff";
  printWrapper.style.pointerEvents = "none";

  printWrapper.innerHTML = `
    <div dir="rtl" style="width: 100%; padding: 0; box-sizing: border-box; background: #ffffff; color: #0f172a; font-family: 'Cairo', system-ui, -apple-system, sans-serif;">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px;">
        <div style="flex: 1; text-align: right;">
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 900; color: #1e3a8a;">${COMPANY_NAME_AR}</h1>
          <h2 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #64748b;">نظام إدارة الصيانة والتشغيل الصناعي (CMMS)</h2>
          <div style="display: inline-block; padding: 4px 12px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: bold; border-radius: 4px;">تقرير حاسبة الحضور والمرتبات الشهري</div>
        </div>
        <div style="flex: 0 0 auto; text-align: left;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="height: 60px; max-width: 160px; object-fit: contain;" />` : `<span style="font-size: 24px; font-weight: 900; color: #1e3a8a;">${COMPANY_SHORT}</span>`}
        </div>
      </div>

      <!-- Employee Info -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">اسم الموظف</span>
          <strong style="font-size: 14px; color: #0f172a;">${safeName}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">الوظيفة</span>
          <strong style="font-size: 14px; color: #0f172a;">${safeJob}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">الفريق</span>
          <strong style="font-size: 14px; color: #1e3a8a;">${getColorBadge(profile.shiftColor).label}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">الشهر</span>
          <strong style="font-size: 14px; color: #0f172a;">${monthArabic} ${yearStr}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">الساعات المستهدفة</span>
          <strong style="font-size: 14px; color: #0f172a;">${monthData.targetHours} س</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">خصم الإجازات الرسمية</span>
          <strong style="font-size: 14px; color: #0f172a;">${monthData.holidayDeductionDays} يوم × ${monthData.holidayDeductionPerDay}س</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">المطلوب الفعلي</span>
          <strong style="font-size: 14px; color: #047857;">${monthData.requiredHours} س</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; display: block; margin-bottom: 4px;">تاريخ الطباعة</span>
          <strong style="font-size: 14px; color: #0f172a; direction: ltr; unicode-bidi: embed;">${new Date().toLocaleDateString("en-GB")}</strong>
        </div>
      </div>

      <!-- Hours Summary -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #1e40af; font-weight: bold; margin-bottom: 4px;">ساعات عادية</div>
          <div style="font-size: 18px; font-weight: 900; color: #1e3a8a;">${monthData.regularHours} س</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #92400e; font-weight: bold; margin-bottom: 4px;">إضافي عادي ×${rules.normalOvertimeMultiplier}</div>
          <div style="font-size: 18px; font-weight: 900; color: #b45309;">${monthData.normalOvertimeHours} س</div>
        </div>
        <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #9d174d; font-weight: bold; margin-bottom: 4px;">عمل OFF ×${rules.offWorkMultiplier}</div>
          <div style="font-size: 18px; font-weight: 900; color: #9d174d;">${monthData.offWorkHours} س</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #166534; font-weight: bold; margin-bottom: 4px;">عمل إجازة رسمية ×${rules.holidayWorkMultiplier}</div>
          <div style="font-size: 18px; font-weight: 900; color: #047857;">${monthData.holidayWorkHours} س</div>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background: #1e3a8a; color: #ffffff; font-size: 12px;">
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 5%;">م</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 14%;">التاريخ</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 13%;">النمط</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 22%;">الحالة</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 18%;">دخول</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 18%;">خروج</th>
            <th style="padding: 10px 6px; border: 1px solid #3b82f6; width: 10%;">الساعات</th>
          </tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
      </table>

      <!-- Financials -->
      <div style="background: #0f172a; color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155; page-break-inside: avoid;">
        <div style="font-size: 15px; font-weight: 900; color: #fbbf24; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <span>💰</span> ملخص الحساب المالي
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">المرتب الأساسي:</span> <strong>${financials.baseSalary.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">سعر ساعة الإضافي:</span> <strong>${financials.otHourRate.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">قيمة الإضافي العادي:</span> <strong>${financials.normalOvertimeMoney.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">قيمة عمل OFF:</span> <strong>${financials.offWorkMoney.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">قيمة عمل الإجازة الرسمية:</span> <strong>${financials.holidayWorkMoney.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">إجمالي الإضافي:</span> <strong>${financials.totalOvertimeMoney.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <span style="color: #94a3b8;">التأمينات (${financials.insurancePercent}%):</span> <strong style="color: #f87171; direction: ltr;">- ${financials.insuranceAmount.toLocaleString()} ج.م</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 6px; background: rgba(251,191,36,0.1); border-radius: 4px; padding: 6px 10px;">
            <span style="color: #fbbf24; font-weight: bold;">صافي المرتب المتوقع:</span> <strong style="color: #fbbf24; font-size: 15px;">${financials.netExpectedSalary.toLocaleString()} ج.م</strong>
          </div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #cbd5e1; page-break-inside: avoid;">
        <div>
          <div style="font-weight: bold; color: #475569; margin-bottom: 40px; font-size: 13px;">توقيع الفني</div>
          <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
          <div style="margin-top: 8px; color: #0f172a; font-size: 12px; font-weight: bold;">${safeName}</div>
        </div>
        <div>
          <div style="font-weight: bold; color: #475569; margin-bottom: 40px; font-size: 13px;">اعتماد مهندس الوردية</div>
          <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
        </div>
        <div>
          <div style="font-weight: bold; color: #475569; margin-bottom: 40px; font-size: 13px;">اعتماد مدير المصنع</div>
          <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
        </div>
      </div>
    </div>
  `;

  // حفظ التمرير الحالي والصعود للأعلى فوراً لتجنب أي قص من الكاميرا
  const currentScrollY = window.scrollY;
  window.scrollTo(0, 0);

  // شاشة تحميل ضبابية تغطي التقرير العائم ريثما ينتهي التصوير
  const loadingOverlay = document.createElement("div");
  loadingOverlay.style.position = "fixed";
  loadingOverlay.style.top = "0";
  loadingOverlay.style.left = "0";
  loadingOverlay.style.width = "100vw";
  loadingOverlay.style.height = "100vh";
  loadingOverlay.style.background = "rgba(255,255,255,0.95)";
  loadingOverlay.style.zIndex = "9999999";
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.flexDirection = "column";
  loadingOverlay.style.alignItems = "center";
  loadingOverlay.style.justifyContent = "center";
  loadingOverlay.innerHTML = '<div style="width:40px;height:40px;border:4px solid #0891b2;border-bottom-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div><style>@keyframes spin{100%{transform:rotate(360deg)}}</style><div style="margin-top:16px;color:#0891b2;font-weight:bold;">جاري تجهيز وتصدير التقرير...</div>';

  document.body.appendChild(printWrapper);
  document.body.appendChild(loadingOverlay);

  // إعطاء المتصفح فرصة كافية لمعالجة الـ DOM (خصوصاً الـ Grid والـ Flex)
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    const filename = `MSCANCO_Payroll_${profile.name.replace(/\s+/g, "_")}_${yearMonth}.pdf`;
    
    // استخدام html2canvas الحديث (1.4.1) المرفق عالمياً لدعم Grid و Gap بشكل كامل
    const canvas = await window.html2canvas(printWrapper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 850,
      logging: false
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 20; 
    const contentWidth = pdfWidth - (margin * 2);
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const ratio = contentWidth / imgWidth;
    const printHeight = imgHeight * ratio;
    const pageContentHeight = pdfHeight - (margin * 2);
    
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    
    let heightLeft = printHeight;
    let position = margin;
    let page = 1;
    
    const totalPages = Math.ceil(printHeight / pageContentHeight);
    
    pdf.addImage(imgData, "JPEG", margin, position, contentWidth, printHeight);
    heightLeft -= pageContentHeight;
    
    while (heightLeft > 0) {
      position -= pageContentHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, contentWidth, printHeight);
      heightLeft -= pageContentHeight;
    }
    
    pdf.save(filename);
    
  } catch (err) {
    console.error("[Attendance] Error generating PDF:", err);
    alert("تعذر توليد ملف الـ PDF حالياً، سيتم فتح نافذة الطباعة بدلاً من ذلك.");
    window.print();
  } finally {
    if (printWrapper.parentNode) printWrapper.parentNode.removeChild(printWrapper);
    if (loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay);
    window.scrollTo(0, currentScrollY);
  }
}

// ============================================================
// 7. تحميل كاش الإعدادات (Pattern + قواعد الإضافي + الإجازات)
// ============================================================

export async function loadAttendanceSettingsCaches() {
  await Promise.all([
    getOfficialHolidays(),
    fetchAttendancePatternApi(),
    fetchPayrollRulesApi()
  ]);
}

// ============================================================
// 8. قفل الـ PIN وإدارة بيانات المرتب (Modal تفاعلي)
// ============================================================

function closeAnyPayrollModal() {
  const existing = document.getElementById("payrollModalOverlay");
  if (existing) existing.remove();
}

/**
 * يطلب من المستخدم فتح القفل (PIN) - لو مفيش PIN متظبط أصلاً بيطلب
 * تعيين واحد جديد أولاً. بيرجع Promise<boolean> (true لو اتفتح)
 */
export function requestPayrollUnlock() {
  return new Promise(resolve => {
    const userId = localStorage.getItem("userId") || "local_user";
    closeAnyPayrollModal();

    const pinIsSet = hasPayrollPin(userId);

    const overlay = document.createElement("div");
    overlay.id = "payrollModalOverlay";
    overlay.dir = "rtl";
    overlay.className = "fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="w-full max-w-xs bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-2xl">
        <div class="text-center mb-3">
          <div class="text-2xl mb-1">🔒</div>
          <div class="text-white font-black text-sm">${pinIsSet ? "أدخل PIN المرتب" : "تعيين PIN جديد للمرتب"}</div>
          <div class="text-[10px] text-slate-400 mt-1">${pinIsSet ? "4 أرقام لعرض بيانات مرتبك" : "PIN من 4 أرقام لحماية بيانات مرتبك محلياً على جهازك فقط"}</div>
        </div>
        <input id="payrollPinInput" type="password" inputmode="numeric" maxlength="4" placeholder="••••"
          class="w-full text-center tracking-[10px] text-xl p-3 rounded-xl bg-slate-950 border border-slate-700 text-white mb-2" />
        ${!pinIsSet ? `<input id="payrollPinConfirm" type="password" inputmode="numeric" maxlength="4" placeholder="تأكيد PIN" class="w-full text-center tracking-[10px] text-xl p-3 rounded-xl bg-slate-950 border border-slate-700 text-white mb-2" />` : ""}
        <div id="payrollPinError" class="text-[11px] text-rose-400 text-center mb-2 hidden"></div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <button id="payrollPinCancel" class="py-2.5 rounded-xl bg-slate-700/60 text-slate-200 text-xs font-bold">إلغاء</button>
          <button id="payrollPinSubmit" class="py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-900 text-xs font-black">${pinIsSet ? "دخول" : "تعيين"}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#payrollPinInput");
    input.focus();

    overlay.querySelector("#payrollPinCancel").onclick = () => { overlay.remove(); resolve(false); };

    overlay.querySelector("#payrollPinSubmit").onclick = async () => {
      const errBox = overlay.querySelector("#payrollPinError");
      const val = overlay.querySelector("#payrollPinInput").value.trim();
      if (!/^\d{4}$/.test(val)) {
        errBox.textContent = "يرجى إدخال 4 أرقام بالضبط";
        errBox.classList.remove("hidden");
        return;
      }
      if (pinIsSet) {
        const ok = await verifyPayrollPin(userId, val);
        if (!ok) {
          errBox.textContent = "❌ PIN غير صحيح";
          errBox.classList.remove("hidden");
          return;
        }
        setPayrollUnlocked(true);
        overlay.remove();
        refreshAttendanceCard();
        resolve(true);
      } else {
        const confirmVal = overlay.querySelector("#payrollPinConfirm").value.trim();
        if (val !== confirmVal) {
          errBox.textContent = "❌ الـ PIN وتأكيده غير متطابقين";
          errBox.classList.remove("hidden");
          return;
        }
        await setPayrollPin(userId, val);
        setPayrollUnlocked(true);
        overlay.remove();
        refreshAttendanceCard();
        resolve(true);
      }
    };
  });
}

window.requestPayrollUnlock = requestPayrollUnlock;

/**
 * إخفاء المرتب مرة أخرى (بدون حذف الـ PIN المخزّن - مجرد قفل
 * العرض للجلسة الحالية)
 */
export function hidePayrollAmounts() {
  setPayrollUnlocked(false);
  refreshAttendanceCard();
}
window.hidePayrollAmounts = hidePayrollAmounts;

window.showPayrollAmounts = async function () {
  if (isPayrollUnlocked()) return;
  await requestPayrollUnlock();
};

/**
 * Modal بيانات المرتب (المرتب الأساسي / نسبة التأمينات / سعر ساعة
 * الإضافي) - يتطلب فتح PIN أولاً (لو مش متظبط، بيتظبط هنا)، ثم
 * بيسمح بتعديل الأرقام وحفظها محلياً فقط
 */
window.openPayrollSettingsModal = async function () {
  const userId = localStorage.getItem("userId") || "local_user";

  if (!isPayrollUnlocked()) {
    const unlocked = await requestPayrollUnlock();
    if (!unlocked) return;
  }

  closeAnyPayrollModal();
  const config = getPayrollLocalConfig(userId);

  const overlay = document.createElement("div");
  overlay.id = "payrollModalOverlay";
  overlay.dir = "rtl";
  overlay.className = "fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4";
  overlay.innerHTML = `
    <div class="w-full max-w-sm bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="text-white font-black text-sm mb-3 flex items-center gap-2"><span>⚙️</span><span>بيانات المرتب (محلية على جهازك فقط)</span></div>
      <p class="text-[10px] text-slate-400 mb-3">هذه البيانات لا تُخزَّن على أي سيرفر ولا يطّلع عليها الأدمن أو أي مستخدم آخر - محفوظة فقط في متصفح هذا الجهاز.</p>

      <label class="block text-[11px] text-slate-300 mb-1">المرتب الأساسي (ج.م)</label>
      <input id="cfgBaseSalary" type="number" min="0" step="0.01" value="${config.baseSalary}" class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-3" />

      <label class="block text-[11px] text-slate-300 mb-1">نسبة التأمينات (%)</label>
      <input id="cfgInsurancePercent" type="number" min="0" max="100" step="0.01" value="${config.insurancePercent}" class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-3" />

      <label class="block text-[11px] text-slate-300 mb-1">سعر ساعة الإضافي (ج.م)</label>
      <input id="cfgOtHourRate" type="number" min="0" step="0.01" value="${config.otHourRate}" class="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm mb-4" />

      <div class="grid grid-cols-2 gap-2 mb-2">
        <button id="payrollCfgCancel" class="py-2.5 rounded-xl bg-slate-700/60 text-slate-200 text-xs font-bold">إلغاء</button>
        <button id="payrollCfgSave" class="py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-900 text-xs font-black">💾 حفظ</button>
      </div>
      <button id="payrollCfgChangePin" class="w-full py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px] font-bold mb-1">🔑 تغيير PIN المرتب</button>
      <button id="payrollCfgRemovePin" class="w-full py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-bold">🗑️ إلغاء PIN (بدون حماية)</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#payrollCfgCancel").onclick = () => overlay.remove();

  overlay.querySelector("#payrollCfgSave").onclick = () => {
    const baseSalary = Number(overlay.querySelector("#cfgBaseSalary").value) || 0;
    const insurancePercent = Number(overlay.querySelector("#cfgInsurancePercent").value) || 0;
    const otHourRate = Number(overlay.querySelector("#cfgOtHourRate").value) || 0;
    savePayrollLocalConfig(userId, { baseSalary, insurancePercent, otHourRate });
    overlay.remove();
    refreshAttendanceCard();
  };

  overlay.querySelector("#payrollCfgChangePin").onclick = async () => {
    setPayrollUnlocked(false);
    overlay.remove();
    await requestPayrollUnlock();
    window.openPayrollSettingsModal();
  };

  overlay.querySelector("#payrollCfgRemovePin").onclick = () => {
    if (!confirm("هل تريد إلغاء حماية PIN؟ ستظهر بيانات مرتبك بدون قفل بعد ذلك.")) return;
    removePayrollPin(userId);
    overlay.remove();
    refreshAttendanceCard();
  };
};

// ============================================================
// 9. دالة العرض الرئيسية: renderAttendanceCard
// ============================================================

function maskMoney(value, unlocked) {
  return unlocked ? `${Number(value || 0).toLocaleString()} ج.م` : "🔒 ••••••";
}

export function renderAttendanceCard(customProfile = null) {
  try {
    const userId = customProfile?.userId || localStorage.getItem("userId") || "local_user";
    // (إصلاح #9) escapeHtml على الاسم والوظيفة قبل الحقن في innerHTML
    const name = escapeHtml(customProfile?.name || localStorage.getItem("name") || "أحمد محمد");
    const job = escapeHtml(customProfile?.job || localStorage.getItem("job") || "فني صيانة");
    const shiftColor = customProfile?.shiftColor || localStorage.getItem("shift") || "جرين";
    const shiftStartDate = customProfile?.shiftStartDate || "2026-01-01";
    const shiftStart = customProfile?.shiftStart || "08:00";
    const shiftEnd = customProfile?.shiftEnd || "20:00";

    const profile = { userId, name, job, shiftColor, shiftStartDate, shiftStart, shiftEnd };

    const contextDate = getCardContextDate(userId);
    const dayInfo = getShiftInfoForDate(profile, contextDate);
    const isHolidayToday = isOfficialHolidayDate(contextDate, getCachedOfficialHolidays());

    const todayRecord = getDailyAttendanceRecord(userId, contextDate) || {
      checkIn: null, checkOut: null, hoursWorked: 0, status: "idle"
    };

    const isCheckedIn = !!todayRecord.checkIn && !todayRecord.checkOut;
    const isCheckedOut = !!todayRecord.checkIn && !!todayRecord.checkOut;
    const isExtraDay = !!todayRecord.isExtraDay;
    const isLeave = !!todayRecord.isLeave;

    // الكارت الحي (المطلوب/Progress Bar) بيستخدم دلوقتي دورة 21 → 20
    // (calculateCycle) بدل الشهر التقويمي - راجع تعليق الدالة أعلاه.
    // تصدير الـ PDF لسه بيستخدم الشهر التقويمي (calculateMonth) زي ما هو
    const rules = getCachedPayrollRules ? getCachedPayrollRules() : DEFAULT_PAYROLL_RULES;
    // (إصلاح #1) تمرير rules صراحةً لـ calculateCycle عشان تستخدم
    // إعدادات الأدمن الفعلية بدل الأرقام الثابتة القديمة
    const cycleData = calculateCycle(userId, { profile, referenceDate: new Date(`${contextDate}T00:00:00`), rules });

    const localConfig = getPayrollLocalConfig(userId);
    const unlocked = isPayrollUnlocked();
    const financials = computeFinancials(cycleData, localConfig, rules);

    const dateOptions = { weekday: "long", year: "numeric", month: "short", day: "numeric" };
    const formattedToday = new Date(`${contextDate}T00:00:00`).toLocaleDateString("ar-EG", dateOptions);

    // هل اليوم إجازة رسمية حسب Google Calendar تحديدًا (القائمة
    // المتزامَنة محليًا) - لتلوين كارت اليوم بالأزرق الفاتح
    const isGoogleHolidayToday = (getLocalEgyptianHolidays && getLocalEgyptianHolidays() || []).some(h => h.date === contextDate);
  const todayRowClasses = isGoogleHolidayToday
    ? "bg-sky-400/10 p-2.5 rounded-xl border border-sky-300/40"
    : "bg-slate-950/40 p-2.5 rounded-xl border border-white/10";

  let actionButtonHtml = "";
  if (isExtraDay) {
    actionButtonHtml = `<div class="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold text-[10.5px] flex items-center justify-center gap-1"><span>⭐</span><span>إضافي مسجل</span></div>`;
  } else if (isLeave) {
    actionButtonHtml = `<div class="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-[10.5px] flex items-center justify-center gap-1"><span>🏖️</span><span>إجازة رصيد</span></div>`;
  } else if (isCheckedIn) {
    // زر واحد واضح "تسجيل حضور" - نفس المُعالِج (handleAttendanceButton)
    // بيحدد تلقائيًا إنها ضغطة تسجيل خروج طالما فيه دخول بدون خروج
    actionButtonHtml = `
      <button type="button" id="btnAttendanceAction" onclick="window.handleAttendanceButton()"
        class="group relative px-2.5 py-1 rounded-lg font-black text-[11px] text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border border-red-400/50 shadow shadow-red-950/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
        <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span><span>تسجيل حضور</span><span class="rtl:rotate-180 text-xs">🚪</span>
      </button>`;
  } else if (isCheckedOut) {
    actionButtonHtml = `
      <div class="flex items-center gap-1">
        <div class="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-[10.5px] flex items-center justify-center gap-1"><span>✅</span><span>تمت الوردية</span></div>
        <button type="button" title="تعديل الدخول" onclick="window.editCheckInWithConfirm()" class="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[9px] transition">🔄</button>
      </div>`;
  } else {
    actionButtonHtml = `
      <button type="button" id="btnAttendanceAction" onclick="window.handleAttendanceButton()"
        class="group relative px-2.5 py-1 rounded-lg font-black text-[11px] text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/50 shadow shadow-emerald-950/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span><span>تسجيل حضور</span><span class="rtl:rotate-180 text-xs">📲</span>
      </button>`;
  }

  const dayStatusText = !dayInfo.isWorkDay
    ? (isHolidayToday ? "🏖️ راحة مُجدوَلة (إجازة رسمية)" : "🏖️ يوم راحة")
    : (isHolidayToday ? "🎉 يوم عمل يصادف إجازة رسمية" : "✅ يوم عمل");

  return `
  <!-- حاسبة الحضور والمرتبات - MSCANCO EGYPT (تصميم فائق الانضغاط Micro-Compact) -->
  <div id="attendanceShiftCard" class="w-full bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0F172A] border border-[#D4AF37]/60 shadow-md shadow-blue-950/30 rounded-xl p-2 text-white relative overflow-hidden transition-all duration-300">

    <div class="absolute -left-10 -bottom-10 w-24 h-24 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="absolute -right-10 -top-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

    <div class="relative z-10 space-y-1.5">

      <!-- هيدر مدمج في سطر واحد بارتفاع مصغر جداً -->
      <div id="attendanceRow1" class="flex items-center justify-between gap-1 pb-1.5 border-b border-white/10">
        <div class="flex items-center gap-1.5 min-w-0">
          <div class="w-6 h-6 rounded-md bg-gradient-to-br from-[#D4AF37]/30 to-amber-500/10 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-black text-[11px] shrink-0">🧮</div>
          <div class="min-w-0 flex items-center gap-1.5">
            <span class="font-black text-[11.5px] text-white truncate">حضور الوردية</span>
            <span class="text-[9.5px] text-slate-300 font-medium truncate max-w-[90px] sm:max-w-[140px] opacity-90">${name}</span>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold flex items-center gap-1 border ${dayInfo.colorBadge.bg} ${dayInfo.colorBadge.border} ${dayInfo.colorBadge.text}">
            <span class="w-1 h-1 rounded-full ${dayInfo.colorBadge.dot}"></span><span>${dayInfo.colorBadge.label}</span>
          </span>
          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border ${dayInfo.badgeColorClass}">
            ${dayInfo.shiftType === "ليلي" ? "🌙 ليلي" : (dayInfo.shiftType === "نهاري" ? "☀️ نهاري" : "🏖️ راحة")}
          </span>
          <button type="button" id="attendanceToggleBtn" onclick="window.toggleAttendanceCard()" aria-expanded="${attendanceCardExpanded ? "true" : "false"}" aria-controls="attendanceExpandableContent"
            title="${attendanceCardExpanded ? "طي التفاصيل" : "عرض كل التفاصيل"}"
            class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0">
            <svg id="attendanceToggleChevron" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white transition-transform duration-300 ${attendanceCardExpanded ? "rotate-180" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      <!-- صف تسجيل الحضور وساعات الدخول/الخروج المدمج -->
      <div id="attendanceRow3" class="flex items-center justify-between gap-1.5 ${todayRowClasses} py-1 px-2">
        <div class="flex items-center gap-2 text-xs">
          <div><span class="text-[8.5px] text-slate-400 block font-medium leading-none">الدخول</span><span class="font-black text-emerald-400 text-[11px] dir-ltr">${todayRecord.checkIn || "--:--"}</span></div>
          <div class="h-3.5 w-px bg-white/10"></div>
          <div><span class="text-[8.5px] text-slate-400 block font-medium leading-none">الخروج</span><span class="font-black text-amber-400 text-[11px] dir-ltr">${todayRecord.checkOut || "--:--"}</span></div>
          ${todayRecord.hoursWorked ? `
          <div class="h-3.5 w-px bg-white/10"></div>
          <div><span class="text-[8.5px] text-slate-400 block font-medium leading-none">الساعات</span><span class="font-black text-cyan-300 text-[11px] dir-ltr">${todayRecord.hoursWorked}س</span></div>
          ` : ''}
        </div>
        <div>${actionButtonHtml}</div>
      </div>

      <!-- الحاوية الموسعة بالتفاصيل -->
      <div id="attendanceExpandableContent" class="overflow-hidden transition-all duration-300 ease-in-out space-y-2.5"
        style="max-height: ${attendanceCardExpanded ? "2400px" : "0px"}; opacity: ${attendanceCardExpanded ? "1" : "0"};"
        aria-hidden="${attendanceCardExpanded ? "false" : "true"}">

      <div id="attendanceRow2" class="grid grid-cols-3 gap-1.5 bg-slate-900/60 p-2 rounded-lg border border-white/5 text-center items-center">
        <div><div class="text-[8.5px] text-slate-400 font-medium">الدورة الحالية</div><div class="text-[11px] font-black text-[#D4AF37] mt-0.5">${dayInfo.dayInCycleText}</div></div>
        <div class="border-x border-white/10 px-1"><div class="text-[8.5px] text-slate-400 font-medium">تاريخ اليوم</div><div class="text-[10px] font-bold text-white mt-0.5 truncate" title="${formattedToday}">${formattedToday}</div></div>
        <div><div class="text-[8.5px] text-slate-400 font-medium">ميعاد الوردية</div><div class="text-[10px] font-black text-cyan-300 mt-0.5 dir-ltr">${dayInfo.shiftTime}</div></div>
      </div>

      <div id="attendanceDayStatus" class="flex items-center gap-1.5 bg-slate-900/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10.5px] text-slate-200 font-bold">
        <span>${dayStatusText}</span>
        ${dayInfo.source === "cycle" ? '<span class="text-[8.5px] text-slate-500 font-normal">(محسوبة تلقائياً)</span>' : ""}
      </div>

      ${isHolidayToday ? `
        <div id="attendanceHolidayBadge" class="flex items-center gap-1.5 bg-amber-500/10 border border-amber-400/30 rounded-lg px-2.5 py-1.5 text-[10.5px] text-amber-200 font-bold">
          <span>🎉</span>
          <span>${!dayInfo.isWorkDay ? "اليوم إجازة رسمية (راحة دورية)" : "اليوم إجازة رسمية وهو يوم عملك"}</span>
        </div>` : ""}

      <div id="attendanceRow5" class="space-y-1.5 bg-slate-900/80 p-2.5 rounded-xl border border-white/10">
        <div class="text-[8.5px] text-slate-400 font-medium text-center">دورة المرتب: ${cycleData.cycleStart} → ${cycleData.cycleEnd}</div>
        <div class="grid grid-cols-4 gap-1 text-center">
          <div class="bg-slate-950/50 rounded-lg p-1 border border-white/5"><div class="text-slate-400 text-[8.5px]">عادي</div><div class="text-emerald-400 text-xs font-bold">${cycleData.regularHours}س</div></div>
          <div class="bg-slate-950/50 rounded-lg p-1 border border-white/5"><div class="text-slate-400 text-[8.5px]">إضافي</div><div class="text-amber-400 text-xs font-bold">${cycleData.normalOvertimeHours}س</div></div>
          <div class="bg-slate-950/50 rounded-lg p-1 border border-white/5"><div class="text-slate-400 text-[8.5px]">عمل OFF</div><div class="text-rose-400 text-xs font-bold">${cycleData.offWorkHours}س</div></div>
          <div class="bg-slate-950/50 rounded-lg p-1 border border-white/5"><div class="text-slate-400 text-[8.5px]">إجازة رسمية</div><div class="text-cyan-300 text-xs font-bold">${cycleData.holidayWorkHours}س</div></div>
        </div>

        <div class="space-y-1 pt-0.5">
          <div class="flex justify-between text-[9.5px] text-slate-400 font-medium">
            <span>المطلوب: <b class="text-white">${cycleData.requiredHours}س</b> (المسجل: ${cycleData.registeredHours}س)</span>
            <span class="text-cyan-300 font-bold">${cycleData.progressPercent}% مُنجز</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div class="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-[#D4AF37] rounded-full transition-all duration-500" style="width: ${cycleData.progressPercent}%"></div>
          </div>
        </div>
      </div>

      <!-- الملخص المالي - محمي بـ PIN -->
      <div id="attendancePayrollBox" class="space-y-1 bg-gradient-to-br from-slate-900 to-slate-950 p-2.5 rounded-xl border border-[#D4AF37]/30">
        <div class="flex items-center justify-between">
          <span class="text-[10.5px] font-black text-[#D4AF37] flex items-center gap-1"><span>💰</span><span>الملخص المالي</span></span>
          <div class="flex items-center gap-1">
            <button type="button" onclick="window.openPayrollSettingsModal()" class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300">⚙️ بيانات المرتب</button>
            ${unlocked
              ? `<button type="button" onclick="window.hidePayrollAmounts()" class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300">🙈 إخفاء</button>`
              : `<button type="button" onclick="window.showPayrollAmounts()" class="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] font-bold">🔓 إظهار</button>`}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1 text-[10px]">
          <div class="flex justify-between bg-slate-950/60 rounded px-2 py-1"><span class="text-slate-400">الأساسي</span><span class="font-bold text-white">${maskMoney(financials.baseSalary, unlocked)}</span></div>
          <div class="flex justify-between bg-slate-950/60 rounded px-2 py-1"><span class="text-slate-400">الإضافي</span><span class="font-bold text-amber-300">${maskMoney(financials.totalOvertimeMoney, unlocked)}</span></div>
          <div class="flex justify-between bg-slate-950/60 rounded px-2 py-1"><span class="text-slate-400">التأمينات</span><span class="font-bold text-rose-300">${unlocked ? "-" : ""}${maskMoney(financials.insuranceAmount, unlocked)}</span></div>
          <div class="flex justify-between bg-slate-950/60 rounded px-2 py-1"><span class="text-slate-400">صافي المتوقع</span><span class="font-black text-[#D4AF37]">${maskMoney(financials.netExpectedSalary, unlocked)}</span></div>
        </div>
      </div>

      <div id="attendanceRow6" class="grid grid-cols-4 gap-1.5 pt-0.5">
        <button type="button" id="btnAddExtraDay" onclick="window.addExtraDayShift()" class="px-1 py-1.5 rounded-lg text-[10px] font-bold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 active:scale-95 transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer"><span>➕</span><span>إضافي</span></button>
        <button type="button" id="btnAddPastAttendance" onclick="window.openPastAttendanceModal()" class="px-1 py-1.5 rounded-lg text-[10px] font-bold text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 active:scale-95 transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer"><span>🗓️</span><span>سابق</span></button>
        <button type="button" id="btnTakeLeave" onclick="window.takeLeaveShift()" class="px-1 py-1.5 rounded-lg text-[10px] font-bold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 active:scale-95 transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer"><span>🏖️</span><span>إجازة</span></button>
        <button type="button" id="btnExportPdf" onclick="window.exportAttendancePDF()" class="px-1 py-1.5 rounded-lg text-[10px] font-bold text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 active:scale-95 transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer"><span>📄</span><span>PDF</span></button>
      </div>

      </div>
      <!-- نهاية حاوية الطي -->

    </div>
  </div>
  `;
  } catch (error) {
    console.error("[AttendanceCard] Error rendering:", error);
    return `
      <div id="attendanceShiftCard" class="w-full bg-red-900/50 border border-red-500 rounded-xl p-4 text-center">
        <h3 class="text-red-400 font-bold mb-2 text-sm">⚠️ عذراً، حدث خطأ أثناء تحميل كارت الحضور</h3>
        <p class="text-white text-xs text-opacity-80 mb-3">${escapeHtml(error.message)}</p>
        <button onclick="window.refreshAttendanceCard()" class="px-3 py-1.5 bg-red-800 text-white text-xs rounded-lg hover:bg-red-700 border border-red-600 transition shadow-md">إعادة المحاولة</button>
      </div>
    `;
  }
}

// ============================================================
// 10. تسجيل الدوال العامة في window + التحديث والطي
// ============================================================

export function toggleAttendanceCard() {
  attendanceCardExpanded = !attendanceCardExpanded;

  const content = document.getElementById("attendanceExpandableContent");
  const chevron = document.getElementById("attendanceToggleChevron");
  const toggleBtn = document.getElementById("attendanceToggleBtn");

  if (content) {
    content.style.maxHeight = attendanceCardExpanded ? `${content.scrollHeight}px` : "0px";
    content.style.opacity = attendanceCardExpanded ? "1" : "0";
    content.setAttribute("aria-hidden", attendanceCardExpanded ? "false" : "true");
  }
  if (chevron) chevron.classList.toggle("rotate-180", attendanceCardExpanded);
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", attendanceCardExpanded ? "true" : "false");
    toggleBtn.title = attendanceCardExpanded ? "طي التفاصيل" : "عرض كل التفاصيل";
  }
}

/**
 * (إصلاح #4) زر "🔄 تعديل الدخول" كان بينادي checkInShift() مباشرة،
 * واللي بتعمل Overwrite كامل لسجل اليوم (بيمسح checkOut والساعات
 * المحسوبة فورًا) بدون أي تأكيد من المستخدم - على عكس باقي العمليات
 * الحساسة (addExtraDay/takeLeave) اللي كلها محمية بـ confirm(). دلوقتي
 * تمت إضافة تأكيد صريح قبل مسح بيانات الوردية المسجلة بالفعل
 */
window.editCheckInWithConfirm = async function () {
  if (!confirm("سيتم إلغاء تسجيل الخروج والساعات المحسوبة لهذا اليوم وإعادة فتح تسجيل الدخول من جديد. هل أنت متأكد؟")) return;
  await checkIn();
};

export async function refreshAttendanceCard() {
  const container = document.getElementById("attendanceCardContainer");
  if (container) {
    try {
      const profile = await getTechnicianProfile();
      await loadAttendanceSettingsCaches();
      container.innerHTML = renderAttendanceCard(profile);
    } catch (error) {
      console.error("[AttendanceCard] Error refreshing:", error);
      container.innerHTML = `
        <div class="w-full bg-red-900/50 border border-red-500 rounded-xl p-4 text-center shadow-lg">
          <h3 class="text-red-400 font-bold mb-2 text-sm">⚠️ عذراً، فشل تحديث كارت الحضور</h3>
          <p class="text-white text-xs text-opacity-80 mb-3">${escapeHtml(error.message)}</p>
          <button onclick="window.refreshAttendanceCard()" class="px-3 py-1.5 bg-red-800 text-white text-xs rounded-lg hover:bg-red-700 border border-red-600 transition shadow-md">إعادة المحاولة</button>
        </div>
      `;
    }
  }
}

if (typeof window !== "undefined") {
  // (إصلاح #10) تم حذف إعادة تسجيل checkInShift/checkOutShift هنا
  // لأنها متسجلة بالفعل فوق مباشرة بعد تعريف الدوال - نفس المرجع بالظبط
  window.addExtraDayShift = addExtraDay;
  window.takeLeaveShift = takeLeave;
  window.exportAttendancePDF = exportPDF;
  window.refreshAttendanceCard = refreshAttendanceCard;
  window.toggleAttendanceCard = toggleAttendanceCard;
  window.getMyShiftInfo = getMyShiftInfo;
  window.calculateAttendanceMonth = calculateMonth;
  window.calculateAttendanceCycle = calculateCycle;
  window.renderAttendanceCard = renderAttendanceCard;

  // تحميل مبدئي غير معطِّل للإعدادات (Pattern/قواعد الإضافي) عشان
  // أول رسم للكارت (متزامن) يستخدم أحدث كاش متاح بمجرد اكتماله -
  // فقط لو فيه مستخدم مسجّل دخوله بالفعل (تجنّباً لأي محاولة قراءة
  // Firestore غير ضرورية في صفحة تسجيل الدخول قبل المصادقة)
  try {
    const isLoggedIn = localStorage.getItem("phone") || localStorage.getItem("userId");
    if (isLoggedIn) {
      loadAttendanceSettingsCaches().then(() => {
        const container = document.getElementById("attendanceCardContainer");
        if (container) refreshAttendanceCard();
      }).catch(() => {});
    }
  } catch (e) { /* localStorage غير متاح - تجاهل بأمان */ }
}