// ============================================================
// attendanceCard.js - كارت حضور الوردية الذكي لمصنع MSCANCO EGYPT
// نظام CMMS - إدارة الصيانة وتحليل العيوب
// ============================================================
// 1. حسابات دورات الورادي (جرين / بلو / ريد) بدورة 6 عمل + 3 إجازة + 6 عمل + 3 إجازة
// 2. تسجيل الدخول والخروج الفعلي وحساب الساعات العادية والإضافية (× 1.5)
// 3. إضافة يوم إضافي (12س إضافي) وإجازة من الرصيد (8س عادي)
// 4. ملخص مالي وساعات شهري ومستهدف 192 ساعة
// 5. حفظ محلي 100% (localStorage) للحفاظ التام على خصوصية الفني
// 6. تصدير تقرير PDF شهري رسمي بهوية شركة MSCANCO واعتمادات الجودة
// ============================================================

import { db } from "./config.js";
import { doc, getDoc } from "./firebase.js";
import { getCompanyLogoDataUrl, COMPANY_NAME_AR, COMPANY_SHORT } from "./branding.js";
import { fetchOfficialHolidaysApi } from "./services/api.js";

// ============================================================
// 0. الإجازات الرسمية - كاش محلي (Cache) + جلب من Firestore
// ============================================================
// إضافة: نظام الإجازات الرسمية. يُدار من شاشة "settings" (راجع
// holidaysManagement.js) ويُستخدم هنا لتحديد هل اليوم الحالي
// إجازة رسمية أم لا، عشان نطبّق القاعدة المتفق عليها:
//   - إجازة رسمية تقع في يوم من أيام راحة الفني (الدورة) → لا شيء،
//     بدون أي إضافة.
//   - إجازة رسمية تقع في يوم من أيام عمله وهو شغال فيه → كل
//     ساعات اليوم ده تُحتسب إضافي (×1.5) بالكامل، مش عادي.
// الكاش (localStorage + متغيّر الموديول) بيضمن إن كارت الحضور
// يشتغل حتى بدون إنترنت (Offline-First، بنفس فلسفة باقي التطبيق)،
// مع تحديث فوري لما الأدمن يضيف/يحذف إجازة من شاشة الإعدادات
// (invalidateHolidaysCache).
// ============================================================

const HOLIDAYS_CACHE_KEY = "official_holidays_cache_v1";

let holidaysMemoryCache = null; // مصفوفة {date, label} أو null لو لسه ما اتحمّلتش

/**
 * جلب قائمة الإجازات الرسمية (Firestore أولاً، مع الرجوع للكاش
 * المحلي المحفوظ في localStorage عند تعذّر الاتصال)
 */
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
      } catch (e) {
        // تجاهل أخطاء التخزين (مساحة ممتلئة مثلاً) - الكاش في الذاكرة كافي لهذه الجلسة
      }
      return holidaysMemoryCache;
    }
  } catch (e) {
    console.warn("[Attendance] فشل جلب الإجازات الرسمية من Firestore، سيتم استخدام الكاش المحلي:", e);
  }

  // احتياطي: قراءة آخر نسخة محفوظة محلياً (Offline)
  try {
    const raw = localStorage.getItem(HOLIDAYS_CACHE_KEY);
    holidaysMemoryCache = raw ? JSON.parse(raw) : [];
  } catch (e) {
    holidaysMemoryCache = [];
  }

  return holidaysMemoryCache;

}

/**
 * إبطال الكاش (تُستدعى من شاشة إدارة الإجازات بعد أي إضافة/حذف،
 * عشان التغيير ينعكس فوراً في كارت الحضور بدون انتظار إعادة تحميل
 * الصفحة بالكامل)
 */
export function invalidateHolidaysCache() {
  holidaysMemoryCache = null;
}

/**
 * هل التاريخ المُعطى (YYYY-MM-DD) إجازة رسمية؟ - تعتمد على الكاش
 * المُحمَّل مسبقاً (يجب استدعاء getOfficialHolidays() أولاً)
 */
export function isOfficialHolidayDate(dateStr, holidaysList) {
  const list = Array.isArray(holidaysList) ? holidaysList : (holidaysMemoryCache || []);
  return list.some(h => h.date === dateStr);
}

/**
 * نسخة متزامنة (Sync) من قائمة الإجازات الرسمية المُحمَّلة بالفعل
 * في الكاش - تُستخدم في renderAttendanceCard() اللي بيُستدعى أحياناً
 * بشكل متزامن (زي أول رسم للصفحة الرئيسية في homeView.js قبل ما أي
 * بيانات غير متزامنة تتحمّل) فمينفعش يستنى Promise. لو الكاش لسه
 * فاضي (أول ظهور للصفحة قبل اكتمال refreshAttendanceCard) هترجع
 * مصفوفة فاضية مؤقتاً، وهتتحدث تلقائياً بعد أول refreshAttendanceCard()
 */
export function getCachedOfficialHolidays() {
  return holidaysMemoryCache || [];
}

// ============================================================
// 1. جلب بيانات الفني من البروفايل (Firestore + Cache محلي)
// ============================================================

/**
 * جلب بيانات المستخدم مع دعم التخزين المؤقت والقراءة المباشرة من Firestore
 * @param {string} [customUserId]
 * @returns {Promise<Object>}
 */
export async function getTechnicianProfile(customUserId = null) {
  const userId = customUserId || localStorage.getItem("userId") || "local_user";
  
  // القيم الافتراضية المستندة للبروفايل
  // إصلاح: كانت مواعيد الوردية الافتراضية 19:00/07:00 (7م-7ص) بدل
  // 08:00/20:00 (8ص-8م) المتفق عليها فعلياً (وردية 12 ساعة تبدأ
  // 8 صباحاً نهاري، أو 8 مساءً ليلي)
  let profile = {
    userId: userId,
    name: localStorage.getItem("name") || "فني صيانة",
    job: localStorage.getItem("job") || "فني صيانة ميكانيكية/كهربائية",
    shiftColor: localStorage.getItem("shift") || "جرين",
    shiftStartDate: "2026-01-01",
    shiftStart: "08:00",
    shiftEnd: "20:00",
    hourlyRate: 50,
    monthTargetHours: 192
  };

  // محاولة قراءة الحساب المخزن في currentUser بـ localStorage
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
          shiftEnd: cached.shiftEnd || profile.shiftEnd,
          hourlyRate: Number(cached.hourlyRate) || profile.hourlyRate,
          monthTargetHours: Number(cached.monthTargetHours) || profile.monthTargetHours
        };
      }
    }
  } catch (e) {
    console.warn("[Attendance] Error parsing currentUser cache:", e);
  }

  // محاولة الجلب الحي من Firestore إذا كان المستخدم مسجلاً ومتصلاً
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
          shiftEnd: data.shiftEnd || profile.shiftEnd,
          hourlyRate: Number(data.hourlyRate) || profile.hourlyRate,
          monthTargetHours: Number(data.monthTargetHours) || profile.monthTargetHours
        };
      }
    } catch (err) {
      // الصمت في حالة عدم الاتصال والاعتماد على الكاش المحلي
      console.warn("[Attendance] Fetching Firestore profile skipped (offline/cached):", err.message);
    }
  }

  return profile;
}

// ============================================================
// 2. دالة حساب الدورة والوردية: getMyShiftInfo
// ============================================================

/**
 * حساب يوم الدورة ونوع الوردية (نهاري / ليلي / إجازة)
 * الدورة: 6 أيام عمل + 3 أيام إجازة + 6 أيام عمل + 3 أيام إجازة = 18 يوماً
 * 
 * @param {string|Date} startDate تاريخ بداية الوردية المرجعي
 * @param {string} shiftColor لون الوردية (جرين / بلو / ريد)
 * @param {string|Date} [targetDate] التاريخ المراد حسابه (الافتراضي: اليوم)
 * @param {string} [shiftStart] ميعاد بداية الوردية النهارية (افتراضي 08:00)
 * @param {string} [shiftEnd] ميعاد نهاية الوردية النهارية / بداية الليلية (افتراضي 20:00)
 * @returns {Object} تفاصيل الوردية واليوم في الدورة
 */
export function getMyShiftInfo(startDate = "2026-01-01", shiftColor = "جرين", targetDate = new Date(), shiftStart = "08:00", shiftEnd = "20:00") {
  const sDate = new Date(startDate);
  const tDate = typeof targetDate === "string" ? new Date(targetDate) : new Date(targetDate);
  
  // تصفير الساعات لمقارنة الأيام بدقة
  const sUtc = Date.UTC(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
  const tUtc = Date.UTC(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
  
  const diffDays = Math.floor((tUtc - sUtc) / (1000 * 60 * 60 * 24));
  
  // إزاحة لون الشفت في حالة عدم تثبيت startDate مخصص
  let colorOffset = 0;
  const cleanColor = String(shiftColor || "").trim().toLowerCase();
  if (cleanColor.includes("بلو") || cleanColor.includes("blue") || cleanColor.includes("أزرق")) {
    colorOffset = 6;
  } else if (cleanColor.includes("ريد") || cleanColor.includes("red") || cleanColor.includes("أحمر")) {
    colorOffset = 12;
  }

  const cycleLength = 18; // 6 + 3 + 6 + 3
  const cycleIndex = (((diffDays - colorOffset) % cycleLength) + cycleLength) % cycleLength; // 0 .. 17

  // إصلاح: مواعيد الوردية كانت ثابتة 07:00/19:00 بدل الاعتماد على
  // الميعاد الفعلي المتفق عليه (08:00 صباحاً - 08:00 مساءً)، وكمان
  // متجاهلة تماماً قيمتي shiftStart/shiftEnd القادمتين من بروفايل
  // الفني. دلوقتي شكل النص بيتبني ديناميكياً من الميعادين الفعليين.
  const dayShiftTime = `${shiftStart} - ${shiftEnd}`;
  const nightShiftTime = `${shiftEnd} - ${shiftStart}`;

  let isWorkDay = true;
  let isNight = false;
  let shiftType = "نهاري";
  let shiftTime = dayShiftTime;
  let dayInCycleText = "";
  let badgeColorClass = "bg-blue-500/20 text-blue-300 border-blue-500/40";

  if (cycleIndex >= 0 && cycleIndex <= 5) {
    // المرحلة 1: 6 أيام عمل نهاري
    const dayNum = cycleIndex + 1;
    isWorkDay = true;
    isNight = false;
    shiftType = "نهاري";
    shiftTime = dayShiftTime;
    dayInCycleText = `يوم ${dayNum} من 6`;
    badgeColorClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
  } else if (cycleIndex >= 6 && cycleIndex <= 8) {
    // إجازة 1: 3 أيام راحة
    const restDayNum = cycleIndex - 5;
    isWorkDay = false;
    isNight = false;
    shiftType = "راحة دورية";
    shiftTime = "إجازة رسمية";
    dayInCycleText = `راحة (يوم ${restDayNum} من 3)`;
    badgeColorClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  } else if (cycleIndex >= 9 && cycleIndex <= 14) {
    // المرحلة 2: 6 أيام عمل ليلي
    const dayNum = cycleIndex - 8;
    isWorkDay = true;
    isNight = true;
    shiftType = "ليلي";
    shiftTime = nightShiftTime;
    dayInCycleText = `يوم ${dayNum} من 6`;
    badgeColorClass = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
  } else {
    // إجازة 2: 3 أيام راحة
    const restDayNum = cycleIndex - 14;
    isWorkDay = false;
    isNight = false;
    shiftType = "راحة دورية";
    shiftTime = "إجازة رسمية";
    dayInCycleText = `راحة (يوم ${restDayNum} من 3)`;
    badgeColorClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  }

  // تخصيص لون الوردية للبادج
  let colorBadge = {
    label: shiftColor || "جرين",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    dot: "bg-emerald-400"
  };

  if (cleanColor.includes("بلو") || cleanColor.includes("blue") || cleanColor.includes("أزرق")) {
    colorBadge = {
      label: "بلو شفت",
      bg: "bg-cyan-500/20",
      border: "border-cyan-500/40",
      text: "text-cyan-300",
      dot: "bg-cyan-400"
    };
  } else if (cleanColor.includes("ريد") || cleanColor.includes("red") || cleanColor.includes("أحمر")) {
    colorBadge = {
      label: "ريد شفت",
      bg: "bg-rose-500/20",
      border: "border-rose-500/40",
      text: "text-rose-300",
      dot: "bg-rose-400"
    };
  } else {
    colorBadge = {
      label: "جرين شفت",
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
      dot: "bg-emerald-400"
    };
  }

  return {
    cycleIndex,
    isWorkDay,
    isNight,
    shiftType,
    shiftTime,
    dayInCycleText,
    badgeColorClass,
    colorBadge
  };
}

// ============================================================
// 3. دوال التخزين المحلي (localStorage)
// ============================================================

/**
 * الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
 */
export function getTodayDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * الحصول على مفتاح التخزين لليوم
 */
function getStorageKey(userId, dateStr) {
  return `attendance_${userId}_${dateStr}`;
}

/**
 * جلب سجل الحضور لليوم
 */
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

/**
 * حفظ سجل الحضور لليوم
 */
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

// ============================================================
// 4. العمليات التفاعلية: checkIn, checkOut, addExtraDay, takeLeave
// ============================================================

/**
 * تسجيل الدخول للوردية
 */
export async function checkIn() {
  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};
  
  const updatedRecord = {
    ...currentRecord,
    checkIn: timeStr,
    checkInTimestamp: now.getTime(),
    status: "checked_in"
  };

  saveDailyAttendanceRecord(profile.userId, todayStr, updatedRecord);
  refreshAttendanceCard();
}

/**
 * تسجيل الخروج من الوردية وحساب الساعات العادية والإضافية
 */
export async function checkOut() {
  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};
  const checkInTimestamp = currentRecord.checkInTimestamp || (now.getTime() - 12 * 60 * 60 * 1000);
  
  // حساب الفارق بالساعات
  let diffHours = (now.getTime() - checkInTimestamp) / (1000 * 60 * 60);
  if (diffHours < 0.1) {
    // في حالة التجربة السريعة أو الخروج الفوري نعين 12 ساعة افتراضية
    diffHours = 12;
  }

  // إضافة: هل اليوم إجازة رسمية وهو أصلاً يوم عمل مُجدوَل للفني؟
  // القاعدة المتفق عليها: لو حاضر ويوم عمله يوافق إجازة رسمية،
  // ساعات اليوم كله تُحتسب إضافي (×1.5) بالكامل، مش عادي حتى لو
  // أقل من أو يساوي 12 ساعة. (لو الإجازة الرسمية وقعت في يوم راحته
  // الدورية أصلاً، مفيش أي تسجيل حضور هيحصل، فمفيش تأثير هناك).
  const holidays = await getOfficialHolidays();
  const shiftInfoToday = getMyShiftInfo(
    profile.shiftStartDate, profile.shiftColor, todayStr, profile.shiftStart, profile.shiftEnd
  );
  const isHolidayWork = shiftInfoToday.isWorkDay && isOfficialHolidayDate(todayStr, holidays);

  let regularHours, overtimeHours;

  if (isHolidayWork) {
    // إجازة رسمية + يوم عمل مُجدوَل = كل الساعات إضافي بالكامل
    regularHours = 0;
    overtimeHours = Number(diffHours.toFixed(2));
  } else {
    // القاعدة العادية للعرض اليومي: حتى 12 ساعة عادي، الزيادة إضافي
    // × 1.5 - ملحوظة: التصنيف النهائي (عادي/إضافي) للشهر بيُعاد
    // حسابه فعلياً على مستوى الشهر كله في calculateMonth() حسب سقف
    // الـ192 ساعة الشهري المتفق عليه، مش على مستوى اليوم الواحد -
    // القيم هنا بمثابة ملخص تقريبي لليوم نفسه بس
    regularHours = Math.min(12, Number(diffHours.toFixed(2)));
    overtimeHours = Number(Math.max(0, diffHours - 12).toFixed(2));
  }

  const totalHours = Number((regularHours + overtimeHours).toFixed(2));

  const regularEarnings = regularHours * profile.hourlyRate;
  const overtimeEarnings = overtimeHours * (profile.hourlyRate * 1.5);
  const totalEarnings = regularEarnings + overtimeEarnings;

  const updatedRecord = {
    ...currentRecord,
    checkIn: currentRecord.checkIn || "08:00",
    checkInTimestamp: checkInTimestamp,
    checkOut: timeStr,
    checkOutTimestamp: now.getTime(),
    regularHours,
    overtimeHours,
    totalHours,
    regularEarnings,
    overtimeEarnings,
    totalEarnings,
    status: "checked_out",
    isExtraDay: false,
    isLeave: false,
    isHolidayWork,
    note: isHolidayWork ? "يوم عمل مصادف لإجازة رسمية (محتسب إضافي بالكامل)" : (currentRecord.note || "")
  };

  saveDailyAttendanceRecord(profile.userId, todayStr, updatedRecord);
  refreshAttendanceCard();
}

/**
 * إضافة يوم إضافي (وردية كاملة 12س إضافي × 1.5)
 */
export async function addExtraDay() {
  if (!confirm("هل تريد إضافة يوم إضافي كامل (12 ساعة إضافي بمعامل 1.5)؟")) return;

  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};

  const overtimeHours = 12;
  const regularHours = 0;
  const totalHours = 12;
  const regularEarnings = 0;
  const overtimeEarnings = overtimeHours * (profile.hourlyRate * 1.5);
  const totalEarnings = overtimeEarnings;

  const updatedRecord = {
    ...currentRecord,
    checkIn: currentRecord.checkIn || "20:00",
    checkOut: currentRecord.checkOut || "08:00",
    regularHours,
    overtimeHours,
    totalHours,
    regularEarnings,
    overtimeEarnings,
    totalEarnings,
    isExtraDay: true,
    isLeave: false,
    status: "extra_day",
    note: "يوم إضافي (Overtime Shift)"
  };

  saveDailyAttendanceRecord(profile.userId, todayStr, updatedRecord);
  refreshAttendanceCard();
}

/**
 * تسجيل إجازة من الرصيد (8 ساعات مدفوعة عادي)
 */
export async function takeLeave() {
  if (!confirm("هل تريد تسجيل إجازة من الرصيد (8 ساعات مدفوعة الأجر)؟")) return;

  const profile = await getTechnicianProfile();
  const todayStr = getTodayDateString();
  const currentRecord = getDailyAttendanceRecord(profile.userId, todayStr) || {};

  const regularHours = 8;
  const overtimeHours = 0;
  const totalHours = 8;
  const regularEarnings = regularHours * profile.hourlyRate;
  const overtimeEarnings = 0;
  const totalEarnings = regularEarnings;

  const updatedRecord = {
    ...currentRecord,
    checkIn: "—",
    checkOut: "—",
    regularHours,
    overtimeHours,
    totalHours,
    regularEarnings,
    overtimeEarnings,
    totalEarnings,
    isExtraDay: false,
    isLeave: true,
    status: "leave",
    note: "إجازة من الرصيد (8 ساعات)"
  };

  saveDailyAttendanceRecord(profile.userId, todayStr, updatedRecord);
  refreshAttendanceCard();
}

// ============================================================
// 5. حساب إجماليات الشهر: calculateMonth
// ============================================================

/**
 * حساب ساعات وأموال الشهر كاملاً
 *
 * إصلاح جوهري: كان الحساب القديم بيجمع regularHours/overtimeHours
 * المُخزَّنة لكل يوم على حدة (واللي كانت بتتحدد بقاعدة "أكتر من 12
 * ساعة في نفس اليوم = إضافي")، فكان أي شهر فيه عدد أيام عمل عادية
 * (12 ساعة/يوم) أكتر من 16 يوم (أي أكتر من 192 ساعة) بيُحتسب بالكامل
 * "عادي" غلط، رغم إن المتفق عليه فعلياً: "بنتخاسب في الشهر على 192
 * ساعة، والزيادة عن كده تُحتسب إضافي (×1.5)" - وهو أمر متوقع الحدوث
 * بشكل طبيعي لأن دورة الـ18 يوم مش بتتقسم بالظبط على شهور 30/31 يوم.
 *
 * القاعدة الجديدة:
 *  - أيام الحضور العادي + أيام الإجازة من الرصيد (8س) تتجمع في
 *    "مجمّع الساعات العادية" (pool) أولاً.
 *  - عادي (نهائي) = أقل قيمة بين (المجمّع، 192)
 *  - إضافي (نهائي) = (المجمّع - 192 لو كان أكبر) + كل ساعات أيام
 *    العمل الإضافي (isExtraDay) + كل ساعات أيام العمل المصادفة
 *    لإجازة رسمية (isHolidayWork) - الاتنين دول دايماً إضافي كامل
 *    بغض النظر عن سقف الـ192، لأنهم عمل إضافي عن الجدول الأساسي
 *    أصلاً (سواء بمبادرة الفني أو بحكم مصادفة إجازة رسمية).
 *
 * @param {string} userId معرّف الفني
 * @param {string} [yearMonth] الشهر بصيغة YYYY-MM (الافتراضي: الشهر الحالي)
 * @param {number} [customHourlyRate]
 * @param {number} [customTargetHours]
 * @returns {Object} تجميع شامل للشهر
 */
export function calculateMonth(userId, yearMonth = null, customHourlyRate = 50, customTargetHours = 192) {
  const currentYM = yearMonth || getTodayDateString().substring(0, 7); // "2026-08"
  const prefix = `attendance_${userId}_${currentYM}`;
  
  let poolHours = 0;         // ساعات الحضور العادي + الإجازة من الرصيد (تُقارن بسقف الـ192)
  let fixedOvertimeHours = 0; // ساعات الأيام الإضافية + أيام الإجازات الرسمية المشتغلة (إضافي دايماً)
  let totalWorkDays = 0;
  let totalLeaves = 0;
  let totalExtraDays = 0;
  let totalHolidayWorkDays = 0;
  let daysList = [];

  // قراءة كل الأيام المسجلة لهذا الشهر من localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        const record = JSON.parse(localStorage.getItem(key));
        if (record) {
          daysList.push(record);

          const dayTotalHours = Number(record.totalHours) || 0;

          if (record.isHolidayWork) {
            fixedOvertimeHours += dayTotalHours;
            totalHolidayWorkDays++;
          } else if (record.isExtraDay) {
            fixedOvertimeHours += dayTotalHours;
            totalExtraDays++;
          } else if (record.isLeave) {
            poolHours += dayTotalHours;
            totalLeaves++;
          } else if (dayTotalHours > 0) {
            poolHours += dayTotalHours;
            totalWorkDays++;
          }
        }
      } catch (e) {
        console.error("Error reading month record:", e);
      }
    }
  }

  // ترتيب الأيام تصاعدياً حسب التاريخ
  daysList.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const targetHours = customTargetHours || 192;
  const rate = customHourlyRate || 50;

  // تصنيف مجمّع الساعات العادية على سقف الـ192 الشهري
  const totalRegularHours = Number(Math.min(poolHours, targetHours).toFixed(2));
  const poolOvertimeHours = Number(Math.max(0, poolHours - targetHours).toFixed(2));
  const totalOvertimeHours = Number((poolOvertimeHours + fixedOvertimeHours).toFixed(2));

  // إجمالي الساعات
  const totalHours = Number((totalRegularHours + totalOvertimeHours).toFixed(2));
  
  // حساب الفلوس
  const regularMoney = totalRegularHours * rate;
  const overtimeMoney = totalOvertimeHours * (rate * 1.5);
  const totalMoney = regularMoney + overtimeMoney;

  // نسبة التقدم من المستهدف
  const progressPercent = Math.min(100, Math.round((totalHours / targetHours) * 100));

  return {
    yearMonth: currentYM,
    regularHours: totalRegularHours,
    overtimeHours: totalOvertimeHours,
    totalHours,
    targetHours,
    regularMoney,
    overtimeMoney,
    totalMoney,
    progressPercent,
    totalWorkDays,
    totalLeaves,
    totalExtraDays,
    totalHolidayWorkDays,
    daysList
  };
}

// ============================================================
// 6. تصدير PDF الشهري الرسمي: exportPDF
// ============================================================

/**
 * توليد وتصدير ملف PDF لجدول الحضور والساعات الشهري لشركة MSCANCO
 */
export async function exportPDF(customUserId = null, customYM = null) {
  const profile = await getTechnicianProfile(customUserId);
  const yearMonth = customYM || getTodayDateString().substring(0, 7);
  const monthData = calculateMonth(profile.userId, yearMonth, profile.hourlyRate, profile.monthTargetHours);
  const logoDataUrl = await getCompanyLogoDataUrl();

  const [yearStr, monthStr] = yearMonth.split("-");
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthArabic = monthNamesAr[parseInt(monthStr, 10) - 1] || monthStr;

  // بناء جدول أيام الشهر
  let tableRowsHtml = "";
  if (monthData.daysList.length === 0) {
    tableRowsHtml = `
      <tr>
        <td colspan="8" class="text-center py-6 text-slate-500 font-bold">لا توجد سجلات حضور مسجلة لهذا الشهر حتى الآن.</td>
      </tr>
    `;
  } else {
    monthData.daysList.forEach((row, idx) => {
      const isExtra = row.isExtraDay;
      const isLeave = row.isLeave;
      const isHolidayWork = row.isHolidayWork;
      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
      const statusBadge = isHolidayWork
        ? '<span style="color:#b45309;font-weight:bold;">🎉 عمل بإجازة رسمية (إضافي بالكامل)</span>'
        : isExtra 
        ? '<span style="color:#b45309;font-weight:bold;">يوم إضافي (+12س)</span>'
        : (isLeave ? '<span style="color:#047857;font-weight:bold;">إجازة رصيد (8س)</span>' : '<span style="color:#1e3a8a;font-weight:bold;">حضور عادي</span>');

      tableRowsHtml += `
        <tr class="${rowBg}" style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 6px 8px; text-align: center; direction: ltr;">${row.date}</td>
          <td style="padding: 6px 8px; text-align: center;">${statusBadge}</td>
          <td style="padding: 6px 8px; text-align: center; direction: ltr;">${row.checkIn || "—"}</td>
          <td style="padding: 6px 8px; text-align: center; direction: ltr;">${row.checkOut || "—"}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${row.regularHours || 0} س</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #b45309;">${row.overtimeHours || 0} س</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #047857;">${(row.totalEarnings || 0).toLocaleString()} ج.م</td>
        </tr>
      `;
    });
  }

  // الحاوية الطباعية المؤقتة
  const printContainer = document.createElement("div");
  printContainer.id = "attendance-pdf-print-container";
  printContainer.dir = "rtl";
  printContainer.style.width = "794px";
  printContainer.style.background = "#ffffff";
  printContainer.style.color = "#0f172a";
  printContainer.style.fontFamily = "system-ui, -apple-system, sans-serif";
  printContainer.style.padding = "24px";
  printContainer.style.boxSizing = "border-box";
  printContainer.style.position = "absolute";
  printContainer.style.left = "-9999px";
  printContainer.style.top = "0";

  printContainer.innerHTML = `
    <!-- هيدر المصنع الرسمي -->
    <div style="border-bottom: 2px solid #d4af37; padding-bottom: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
      <div style="text-align: right;">
        <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #1e3a8a;">${COMPANY_NAME_AR}</h1>
        <h2 style="margin: 2px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b;">نظام إدارة الصيانة والتشغيل الصناعي (CMMS)</h2>
        <div style="margin-top: 4px; font-size: 10px; color: #b45309; font-weight: bold;">كشف حضور وساعات عمل الوردية الفردي</div>
      </div>
      <div style="text-align: left;">
        ${logoDataUrl ? `<img src="${logoDataUrl}" style="height: 50px; max-width: 140px; object-fit: contain;" />` : `<span style="font-size: 20px; font-weight: 900; color: #1e3a8a;">${COMPANY_SHORT}</span>`}
      </div>
    </div>

    <!-- معلومات الفني والوردية -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px;">
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">اسم الفني:</span>
        <strong style="color: #0f172a;">${profile.name}</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">الوظيفة:</span>
        <strong style="color: #0f172a;">${profile.job}</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">لون الوردية:</span>
        <strong style="color: #1e3a8a;">${profile.shiftColor}</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">الشهر:</span>
        <strong style="color: #0f172a;">${monthArabic} ${yearStr}</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">سعر الساعة:</span>
        <strong style="color: #047857;">${profile.hourlyRate} ج.م/ساعة</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">معامل الإضافي:</span>
        <strong style="color: #b45309;">1.5 × (${profile.hourlyRate * 1.5} ج.م)</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">المستهدف الشهري:</span>
        <strong style="color: #0f172a;">${profile.monthTargetHours} ساعة</strong>
      </div>
      <div>
        <span style="color: #64748b; font-size: 10px; display: block;">تاريخ الطباعة:</span>
        <strong style="color: #64748b;">${new Date().toLocaleDateString("ar-EG")}</strong>
      </div>
    </div>

    <!-- كروت ملخص الأرقام الشهرية -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 10px; color: #1e40af; font-weight: bold;">الساعات العادية</div>
        <div style="font-size: 16px; font-weight: 900; color: #1e3a8a;">${monthData.regularHours} س</div>
        <div style="font-size: 9px; color: #64748b;">${monthData.regularMoney.toLocaleString()} ج.م</div>
      </div>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 10px; color: #92400e; font-weight: bold;">الساعات الإضافية (×1.5)</div>
        <div style="font-size: 16px; font-weight: 900; color: #b45309;">${monthData.overtimeHours} س</div>
        <div style="font-size: 9px; color: #64748b;">${monthData.overtimeMoney.toLocaleString()} ج.م</div>
      </div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 10px; color: #166534; font-weight: bold;">إجمالي الساعات الفعلية</div>
        <div style="font-size: 16px; font-weight: 900; color: #047857;">${monthData.totalHours} س</div>
        <div style="font-size: 9px; color: #166534; font-weight: bold;">نسبة الإنجاز: ${monthData.progressPercent}%</div>
      </div>
      <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 10px; color: #9d174d; font-weight: bold;">إجمالي المستحقات</div>
        <div style="font-size: 16px; font-weight: 900; color: #9d174d;">${monthData.totalMoney.toLocaleString()} ج.م</div>
        <div style="font-size: 9px; color: #64748b;">صافي الاستحقاق</div>
      </div>
    </div>

    <!-- جدول الأيام المفصل -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #1e3a8a; color: #ffffff; font-size: 11px;">
          <th style="padding: 7px; border: 1px solid #3b82f6;">م</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">التاريخ</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">النوع / الحالة</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">دخول</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">خروج</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">عادي</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">إضافي</th>
          <th style="padding: 7px; border: 1px solid #3b82f6;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- صندوق الاعتمادات والتوقيعات -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 16px; margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px;">
      <div>
        <div style="font-weight: bold; color: #0f172a; margin-bottom: 30px;">توقيع الفني</div>
        <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
        <div style="margin-top: 4px; color: #64748b; font-size: 10px;">${profile.name}</div>
      </div>
      <div>
        <div style="font-weight: bold; color: #0f172a; margin-bottom: 30px;">اعتماد مهندس الوردية</div>
        <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
        <div style="margin-top: 4px; color: #64748b; font-size: 10px;">مهندس الصيانة المسؤول</div>
      </div>
      <div>
        <div style="font-weight: bold; color: #0f172a; margin-bottom: 30px;">اعتماد مدير المصنع</div>
        <div style="border-bottom: 1px dashed #94a3b8; width: 80%; margin: 0 auto;"></div>
        <div style="margin-top: 4px; color: #64748b; font-size: 10px;">إدارة مصنع MSCANCO</div>
      </div>
    </div>
  `;

  document.body.appendChild(printContainer);

  try {
    const filename = `MSCANCO_Attendance_${profile.name.replace(/\s+/g, "_")}_${yearMonth}.pdf`;

    if (window.html2pdf) {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };
      await window.html2pdf().set(opt).from(printContainer).save();
    } else {
      window.print();
    }
  } catch (err) {
    console.error("[Attendance] Error generating PDF:", err);
    alert("تعذر توليد ملف الـ PDF حالياً، سيتم فتح نافذة الطباعة بدلاً من ذلك.");
    window.print();
  } finally {
    if (printContainer && printContainer.parentNode) {
      printContainer.parentNode.removeChild(printContainer);
    }
  }
}

// ============================================================
// 7. دالة العرض الرئيسية: renderAttendanceCard
// ============================================================

/**
 * توليد الـ HTML لكارت حضور الوردية الذكي
 * تصميم دارك فخم: Gradient من #1E3A8A إلى #0F172A وحدود ذهبية #D4AF37
 * 
 * الصف 1: الاسم | الوظيفة | لون الشفت | نوع الوردية الحالية
 * الصف 2: الدورة: يوم X من 6 | التاريخ | معاد الوردية
 * الصف 3: دخول: --:-- | خروج: --:-- | زرار تسجيل دخول أو خروج
 * الصف 4: ملخص اليوم: ساعات + فلوس
 * الصف 5: ملخص الشهر: عادي + إضافي = إجمالي
 * الصف 6: 3 أزرار: ➕ يوم إضافي | 🏖️ إجازة من الرصيد | 📄 تصدير PDF
 * 
 * @param {Object} [customProfile] بيانات مسبقة اختيارية
 * @returns {string} كود HTML للكارت
 */
export function renderAttendanceCard(customProfile = null) {
  // بيانات الفني
  const userId = customProfile?.userId || localStorage.getItem("userId") || "local_user";
  const name = customProfile?.name || localStorage.getItem("name") || "أحمد محمد";
  const job = customProfile?.job || localStorage.getItem("job") || "فني صيانة";
  const shiftColor = customProfile?.shiftColor || localStorage.getItem("shift") || "جرين";
  const shiftStartDate = customProfile?.shiftStartDate || "2026-01-01";
  const shiftStart = customProfile?.shiftStart || "08:00";
  const shiftEnd = customProfile?.shiftEnd || "20:00";
  const hourlyRate = Number(customProfile?.hourlyRate) || 50;
  const monthTargetHours = Number(customProfile?.monthTargetHours) || 192;

  // اليوم وتفاصيل الدورة
  const todayStr = getTodayDateString();
  const shiftInfo = getMyShiftInfo(shiftStartDate, shiftColor, todayStr, shiftStart, shiftEnd);

  // إضافة: هل اليوم إجازة رسمية؟ (نسخة متزامنة من الكاش - راجع
  // getCachedOfficialHolidays أعلاه لسبب استخدام النسخة المتزامنة هنا)
  const isHolidayToday = isOfficialHolidayDate(todayStr, getCachedOfficialHolidays());

  // السجل الحالي لليوم
  const todayRecord = getDailyAttendanceRecord(userId, todayStr) || {
    checkIn: null,
    checkOut: null,
    regularHours: 0,
    overtimeHours: 0,
    totalHours: 0,
    regularEarnings: 0,
    overtimeEarnings: 0,
    totalEarnings: 0,
    status: "idle"
  };

  // حالة تسجيل الحضور الحالي
  const isCheckedIn = !!todayRecord.checkIn && !todayRecord.checkOut;
  const isCheckedOut = !!todayRecord.checkIn && !!todayRecord.checkOut;
  const isExtraDay = !!todayRecord.isExtraDay;
  const isLeave = !!todayRecord.isLeave;

  // إجماليات الشهر
  const currentYM = todayStr.substring(0, 7);
  const monthData = calculateMonth(userId, currentYM, hourlyRate, monthTargetHours);

  // تنسيق تاريخ اليوم بالعربي
  const dateOptions = { weekday: "long", year: "numeric", month: "short", day: "numeric" };
  const formattedToday = new Date().toLocaleDateString("ar-EG", dateOptions);

  // نص وتنسيق زر الحضور/الانصراف
  let actionButtonHtml = "";
  if (isExtraDay) {
    actionButtonHtml = `
      <div class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold text-xs flex items-center justify-center gap-1">
        <span>⭐</span>
        <span>يوم إضافي مسجل</span>
      </div>
    `;
  } else if (isLeave) {
    actionButtonHtml = `
      <div class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1">
        <span>🏖️</span>
        <span>إجازة من الرصيد</span>
      </div>
    `;
  } else if (isCheckedIn) {
    actionButtonHtml = `
      <button
        type="button"
        id="btnShiftCheckOut"
        onclick="window.checkOutShift()"
        class="group relative px-4 py-2 rounded-xl font-black text-xs text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border border-red-400/50 shadow-md shadow-red-950/50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
        <span>تسجيل خروج</span>
        <span class="rtl:rotate-180 text-sm">🚪</span>
      </button>
    `;
  } else if (isCheckedOut) {
    actionButtonHtml = `
      <div class="flex items-center gap-1.5">
        <div class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1">
          <span>✅</span>
          <span>تم إتمام الوردية</span>
        </div>
        <button
          type="button"
          title="تعديل الدخول"
          onclick="window.checkInShift()"
          class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] transition">
          🔄
        </button>
      </div>
    `;
  } else {
    actionButtonHtml = `
      <button
        type="button"
        id="btnShiftCheckIn"
        onclick="window.checkInShift()"
        class="group relative px-4 py-2 rounded-xl font-black text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/50 shadow-md shadow-emerald-950/50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
        <span>تسجيل دخول</span>
        <span class="rtl:rotate-180 text-sm">📲</span>
      </button>
    `;
  }

  return `
  <!-- كارت حضور الوردية الفخم MSCANCO EGYPT -->
  <div id="attendanceShiftCard" class="w-full bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0F172A] border-2 border-[#D4AF37] shadow-xl shadow-blue-950/40 rounded-2xl p-4 text-white relative overflow-hidden transition-all duration-300">
    
    <!-- خلفية ناعمة وشعار مائي خفيف -->
    <div class="absolute -left-10 -bottom-10 w-36 h-36 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="absolute -right-10 -top-10 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

    <div class="relative z-10 space-y-3.5">
      
      <!-- الصف 1: الاسم | الوظيفة | لون الشفت | نوع الوردية الحالية ليلي/نهاري -->
      <div id="attendanceRow1" class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        
        <!-- الاسم والوظيفة -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4AF37]/30 to-amber-500/10 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-black text-sm shrink-0 shadow-inner">
            👷
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-black text-sm text-white truncate max-w-[140px] sm:max-w-[200px]">${name}</span>
              <span class="text-[9px] text-[#D4AF37] font-bold px-1.5 py-0.2 bg-[#D4AF37]/15 rounded border border-[#D4AF37]/30">MSCANCO</span>
            </div>
            <div class="text-[11px] text-slate-300 font-medium truncate max-w-[150px] sm:max-w-[220px]">${job}</div>
          </div>
        </div>

        <!-- شارات الشفت والنوع -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- لون الشفت -->
          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${shiftInfo.colorBadge.bg} ${shiftInfo.colorBadge.border} ${shiftInfo.colorBadge.text}">
            <span class="w-1.5 h-1.5 rounded-full ${shiftInfo.colorBadge.dot}"></span>
            <span>${shiftInfo.colorBadge.label}</span>
          </span>

          <!-- نوع الوردية الحالية -->
          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold border ${shiftInfo.badgeColorClass}">
            ${shiftInfo.shiftType === "ليلي" ? "🌙 ليلي" : (shiftInfo.shiftType === "نهاري" ? "☀️ نهاري" : "🏖️ راحة")}
          </span>
        </div>
      </div>

      <!-- الصف 2: الدورة: يوم X من 6 | التاريخ | معاد الوردية -->
      <div id="attendanceRow2" class="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-white/5 text-center items-center">
        <div>
          <div class="text-[9px] text-slate-400 font-medium">الدورة الحالية</div>
          <div class="text-xs font-black text-[#D4AF37] mt-0.5">${shiftInfo.dayInCycleText}</div>
        </div>
        <div class="border-x border-white/10 px-1">
          <div class="text-[9px] text-slate-400 font-medium">تاريخ اليوم</div>
          <div class="text-[11px] font-bold text-white mt-0.5 truncate" title="${formattedToday}">${formattedToday}</div>
        </div>
        <div>
          <div class="text-[9px] text-slate-400 font-medium">ميعاد الوردية</div>
          <div class="text-[11px] font-black text-cyan-300 mt-0.5 dir-ltr">${shiftInfo.shiftTime}</div>
        </div>
      </div>

      <!-- إضافة: بادج تنبيهي لو اليوم إجازة رسمية -->
      ${isHolidayToday ? `
        <div id="attendanceHolidayBadge" class="flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 text-[11px] text-amber-200 font-bold">
          <span>🎉</span>
          <span>
            ${
              !shiftInfo.isWorkDay
                ? "اليوم إجازة رسمية (يوم راحتك الدورية أصلاً - بدون أي تأثير على حسابك)"
                : todayRecord.isHolidayWork
                  ? "اليوم إجازة رسمية وأنت شغال - كل ساعات اليوم محتسبة إضافي (×1.5) بالكامل"
                  : "اليوم إجازة رسمية وهو يوم عملك المُجدوَل - أي ساعات هتشتغلها هتتحسب إضافي (×1.5) بالكامل"
            }
          </span>
        </div>
      ` : ""}

      <!-- الصف 3: دخول: --:-- | خروج: --:-- | زرار تسجيل دخول او خروج -->
      <div id="attendanceRow3" class="flex items-center justify-between gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-white/10">
        <div class="flex items-center gap-3 text-xs">
          <div>
            <span class="text-[10px] text-slate-400 block font-medium">الدخول:</span>
            <span class="font-black text-emerald-400 text-sm dir-ltr">${todayRecord.checkIn || "--:--"}</span>
          </div>
          <div class="h-6 w-px bg-white/10"></div>
          <div>
            <span class="text-[10px] text-slate-400 block font-medium">الخروج:</span>
            <span class="font-black text-amber-400 text-sm dir-ltr">${todayRecord.checkOut || "--:--"}</span>
          </div>
        </div>

        <div>
          ${actionButtonHtml}
        </div>
      </div>

      <!-- الصف 4: ملخص اليوم: ساعات + فلوس -->
      <div id="attendanceRow4" class="flex items-center justify-between bg-blue-950/50 px-3 py-2 rounded-xl border border-blue-400/20 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-blue-300 font-bold">📊 ملخص اليوم:</span>
          <span class="text-white font-black">${todayRecord.totalHours || 0} س</span>
          ${todayRecord.overtimeHours > 0 ? `<span class="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded font-bold">(+${todayRecord.overtimeHours}س إضافي)</span>` : ""}
        </div>
        <div class="flex items-center gap-1 font-black text-[#D4AF37]">
          <span>${(todayRecord.totalEarnings || 0).toLocaleString()}</span>
          <span class="text-[10px] font-normal text-amber-200">ج.م</span>
        </div>
      </div>

      <!-- الصف 5: ملخص الشهر: عادي 160س + اضافي 8س = اجمالي -->
      <div id="attendanceRow5" class="space-y-1.5 bg-slate-900/80 p-3 rounded-xl border border-white/10">
        <div class="flex items-center justify-between text-xs font-bold">
          <div class="flex items-center gap-1.5 text-slate-200">
            <span>🗓️ ملخص الشهر:</span>
            <span class="text-emerald-400">عادي ${monthData.regularHours}س</span>
            <span class="text-slate-400">+</span>
            <span class="text-amber-400">إضافي ${monthData.overtimeHours}س</span>
            <span class="text-slate-400">=</span>
            <span class="text-cyan-300 font-black">${monthData.totalHours}س</span>
          </div>
          <div class="text-[#D4AF37] font-black">
            <span>${monthData.totalMoney.toLocaleString()}</span>
            <span class="text-[10px] font-normal text-amber-200">ج.م</span>
          </div>
        </div>

        <!-- شريط التقدم نحو المستهدف (192 ساعة) -->
        <div class="space-y-1 pt-1">
          <div class="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>المستهدف: ${monthTargetHours} ساعة</span>
            <span class="text-cyan-300 font-bold">${monthData.progressPercent}% مُنجز</span>
          </div>
          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div class="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-[#D4AF37] rounded-full transition-all duration-500" style="width: ${monthData.progressPercent}%"></div>
          </div>
        </div>
      </div>

      <!-- الصف 6: 3 ازرار صغيرين: ➕ يوم اضافي | 🏖️ اجازة من الرصيد | 📄 تصدير PDF -->
      <div id="attendanceRow6" class="grid grid-cols-3 gap-2 pt-1">
        
        <!-- 1. يوم إضافي -->
        <button
          type="button"
          id="btnAddExtraDay"
          onclick="window.addExtraDayShift()"
          class="px-2 py-2 rounded-xl text-[11px] font-bold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 active:scale-95 transition flex items-center justify-center gap-1 shadow-sm cursor-pointer">
          <span>➕</span>
          <span>يوم إضافي</span>
        </button>

        <!-- 2. إجازة من الرصيد -->
        <button
          type="button"
          id="btnTakeLeave"
          onclick="window.takeLeaveShift()"
          class="px-2 py-2 rounded-xl text-[11px] font-bold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 active:scale-95 transition flex items-center justify-center gap-1 shadow-sm cursor-pointer">
          <span>🏖️</span>
          <span>إجازة رصيد</span>
        </button>

        <!-- 3. تصدير PDF -->
        <button
          type="button"
          id="btnExportPdf"
          onclick="window.exportAttendancePDF()"
          class="px-2 py-2 rounded-xl text-[11px] font-bold text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 active:scale-95 transition flex items-center justify-center gap-1 shadow-sm cursor-pointer">
          <span>📄</span>
          <span>تصدير PDF</span>
        </button>
      </div>

    </div>
  </div>
  `;
}

// ============================================================
// 8. تسجيل الدوال العامة في window للعمل التفاعلي
// ============================================================

export async function refreshAttendanceCard() {
  const container = document.getElementById("attendanceCardContainer");
  if (container) {
    const profile = await getTechnicianProfile();
    // إضافة: تحميل/تحديث كاش الإجازات الرسمية قبل الرسم، عشان بادج
    // "اليوم إجازة رسمية" (وقاعدة احتساب العمل فيها إضافي بالكامل)
    // يشتغلوا بأحدث بيانات متاحة
    await getOfficialHolidays();
    container.innerHTML = renderAttendanceCard(profile);
  }
}

// ربط الدوال بنافذة window لسهولة استدعائها من الـ HTML onclick
if (typeof window !== "undefined") {
  window.checkInShift = checkIn;
  window.checkOutShift = checkOut;
  window.addExtraDayShift = addExtraDay;
  window.takeLeaveShift = takeLeave;
  window.exportAttendancePDF = exportPDF;
  window.refreshAttendanceCard = refreshAttendanceCard;
  window.getMyShiftInfo = getMyShiftInfo;
  window.calculateAttendanceMonth = calculateMonth;
  window.renderAttendanceCard = renderAttendanceCard;
}
