// ============================================================
// googleHolidaysSync.js
// مزامنة الإجازات الرسمية المصرية من تقويم جوجل العام (Google
// Calendar - Egyptian Holidays) وتخزينها محليًا في localStorage
// عشان تشتغل Offline بعد أول مزامنة ناجحة.
//
// ⚠️ ملحوظة تقنية مهمة: نقطة نهاية Google Calendar API v3 (حتى
// للتقويمات العامة) بتتطلب عادةً مفتاح API صالح (?key=...) عشان
// ترجع بيانات بدل خطأ 400/403. الكود هنا جاهز ومصمم بالكامل
// ويطبّق نفس الرابط المطلوب بالظبط، ويضيف المفتاح تلقائيًا لو
// اتحط في GOOGLE_CALENDAR_API_KEY تحت. من غير مفتاح، المزامنة
// الفعلية (Live) هتفشل بأمان وهيتم الرجوع تلقائيًا لآخر نسخة
// محفوظة محليًا (بالضبط زي ما هو مطلوب في حالة عدم توفر الإنترنت).
// ============================================================

// ضع مفتاح Google Calendar API هنا لو متاح - سيب فاضي لو مفيش
// (النظام هيشتغل بأمان بالكاش المحلي بدون Live Sync لحد ما يتحط)
const GOOGLE_CALENDAR_API_KEY = "";

const EGYPT_HOLIDAYS_CALENDAR_ID = "en.egyptian%23holiday%40group.v.calendar.google.com";
const GOOGLE_CALENDAR_EVENTS_URL =
  `https://www.googleapis.com/calendar/v3/calendars/${EGYPT_HOLIDAYS_CALENDAR_ID}/events`;

export const EGYPTIAN_HOLIDAYS_STORAGE_KEY = "egyptian_holidays";
export const EGYPTIAN_HOLIDAYS_UPDATED_AT_KEY = "egyptian_holidays_updated_at";
const LAST_AUTO_SYNC_CHECK_KEY = "egyptian_holidays_last_auto_sync_month"; // "YYYY-MM"

/**
 * قراءة آخر نسخة محفوظة محليًا من إجازات مصر الرسمية (Offline-First)
 */
export function getLocalEgyptianHolidays() {
  try {
    const raw = localStorage.getItem(EGYPTIAN_HOLIDAYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[GoogleHolidays] تعذرت قراءة الكاش المحلي:", e);
    return [];
  }
}

export function getEgyptianHolidaysUpdatedAt() {
  try {
    return localStorage.getItem(EGYPTIAN_HOLIDAYS_UPDATED_AT_KEY) || null;
  } catch (e) {
    return null;
  }
}

function saveLocalEgyptianHolidays(list) {
  try {
    localStorage.setItem(EGYPTIAN_HOLIDAYS_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(EGYPTIAN_HOLIDAYS_UPDATED_AT_KEY, new Date().toISOString());
  } catch (e) {
    console.warn("[GoogleHolidays] تعذر حفظ الكاش المحلي:", e);
  }
}

/**
 * تحويل استجابة Google Calendar API الخام لقائمة مبسطة {date, label}
 */
function parseGoogleCalendarEvents(items) {
  const list = [];
  (items || []).forEach(item => {
    const dateStr = item?.start?.date || (item?.start?.dateTime ? item.start.dateTime.substring(0, 10) : null);
    if (!dateStr) return;
    list.push({ date: dateStr, label: item.summary || "إجازة رسمية" });
  });
  // ترتيب زمني وحذف أي تكرار لنفس التاريخ+الاسم
  const seen = new Set();
  const unique = [];
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  list.forEach(h => {
    const k = `${h.date}|${h.label}`;
    if (!seen.has(k)) { seen.add(k); unique.push(h); }
  });
  return unique;
}

/**
 * مزامنة فعلية من Google Calendar (Live) - بترجع النتيجة وتحفظها
 * محليًا لو نجحت. لو فشلت (مفيش إنترنت / مفيش مفتاح API صالح)
 * بترجع للنسخة المحفوظة محليًا تلقائيًا (Offline Fallback) بدون
 * ما تكسر أي حاجة
 */
export async function syncEgyptianHolidaysFromGoogle({ silent = false } = {}) {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("لا يوجد اتصال بالإنترنت حالياً");
    }

    const url = GOOGLE_CALENDAR_API_KEY
      ? `${GOOGLE_CALENDAR_EVENTS_URL}?key=${encodeURIComponent(GOOGLE_CALENDAR_API_KEY)}&maxResults=250&singleEvents=true&orderBy=startTime`
      : GOOGLE_CALENDAR_EVENTS_URL;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Calendar API رجع خطأ HTTP ${response.status}`);
    }
    const data = await response.json();
    const parsed = parseGoogleCalendarEvents(data.items);

    if (!parsed.length) {
      throw new Error("لم يتم العثور على أي إجازات في استجابة Google Calendar");
    }

    saveLocalEgyptianHolidays(parsed);
    try {
      const now = new Date();
      localStorage.setItem(LAST_AUTO_SYNC_CHECK_KEY, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    } catch (e) { /* تجاهل */ }

    return { status: "success", data: parsed, source: "google", updatedAt: getEgyptianHolidaysUpdatedAt() };
  } catch (error) {
    if (!silent) {
      console.warn("[GoogleHolidays] فشلت المزامنة الحية من Google، سيتم استخدام آخر نسخة محفوظة محليًا:", error.message);
    }
    const cached = getLocalEgyptianHolidays();
    return {
      status: cached.length ? "success" : "error",
      data: cached,
      source: "cache",
      offline: true,
      message: error.message,
      updatedAt: getEgyptianHolidaysUpdatedAt()
    };
  }
}

/**
 * فحص هل حان وقت المزامنة التلقائية الشهرية (أول يوم في الشهر بعد
 * الساعة 2:00 صباحًا) ولسه ماحصلتش هذا الشهر - ولو كده يشغّل
 * المزامنة تلقائيًا في الخلفية بدون ما يعطّل تحميل الصفحة
 */
export function maybeAutoSyncGoogleHolidays() {
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastAutoSyncMonth = localStorage.getItem(LAST_AUTO_SYNC_CHECK_KEY);

    const isSyncWindow = now.getDate() === 1 && now.getHours() >= 2;
    // لو أول مرة أصلاً (مفيش أي نسخة محفوظة) زامن فورًا بغض النظر
    // عن التوقيت، عشان النظام يبدأ بأول نسخة بيانات متاحة
    const neverSynced = !getEgyptianHolidaysUpdatedAt();

    if (neverSynced || (isSyncWindow && lastAutoSyncMonth !== currentMonthKey)) {
      return syncEgyptianHolidaysFromGoogle({ silent: true }).catch(() => null);
    }
  } catch (e) {
    // localStorage/navigator غير متاح - تجاهل بأمان
  }
  return Promise.resolve(null);
}
