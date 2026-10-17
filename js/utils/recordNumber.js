// ============================================================
// recordNumber.js
// منطق الأرقام التسلسلية الموحدة (BR-001 / KZ-001 / PM-001 ...) - وحدة نقية
// بدون أي اعتماد على Firebase، فتُستخدم في الواجهة (عرض/بحث/تصدير) وفي
// الاختبارات بنفس القواعد.
//
// الصيغة: <بادئة النوع>-<رقم بثلاث خانات على الأقل>  مثال: BR-001، BR-012، BR-1000
// لكل نوع سجل تسلسله المستقل. السجلات القديمة المخزّنة بخمس خانات (BR-00012)
// تُعرض بنفس الصيغة المختصرة (BR-012) دون تعديل البيانات المخزّنة.
// ============================================================

export const SEQUENCE_PREFIXES = Object.freeze({
  tickets: "BR",        // بلاغات الأعطال
  suggestions: "KZ",    // مقترحات الكايزن
  pmOrders: "PM",       // أوامر الصيانة الوقائية
  defects: "DF",        // عيوب الإنتاج
  machineErrors: "ME",  // أعطال الماكينات (قاعدة المعرفة)
  checklists: "CL",     // سجلات الفحص (Daily AM / 5S)
  pmRecords: "PR"       // سجلات الصيانة الوقائية
});

export const SEQUENCE_PAD = 3;

const KNOWN_PREFIXES = Object.values(SEQUENCE_PREFIXES);
const NUMBER_RE = new RegExp(`^\\s*#?\\s*(${KNOWN_PREFIXES.join("|")})\\s*[-_ ]?\\s*0*(\\d+)\\s*$`, "i");

export function isSequenceType(type) {
  return Object.prototype.hasOwnProperty.call(SEQUENCE_PREFIXES, type);
}

/** يبني الرقم المعروض من نوع السجل والرقم الصحيح: ("tickets", 7) => "BR-007" */
export function formatSequenceNumber(type, n) {
  const prefix = SEQUENCE_PREFIXES[type] || (KNOWN_PREFIXES.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : "");
  const num = Number(n);
  if (!prefix) throw new Error(`نوع الترقيم غير مدعوم: ${type}`);
  if (!Number.isInteger(num) || num < 1) throw new Error(`رقم تسلسلي غير صالح: ${n}`);
  return `${prefix}-${String(num).padStart(SEQUENCE_PAD, "0")}`;
}

/** يحلل أي صيغة مقبولة (BR-007 / br007 / #BR-00007) إلى { prefix, number } أو null */
export function parseRecordNumber(value) {
  const m = NUMBER_RE.exec(String(value ?? ""));
  if (!m) return null;
  const number = parseInt(m[2], 10);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { prefix: m[1].toUpperCase(), number };
}

/** يوحّد الصيغة المخزّنة (القديمة أو الجديدة) إلى الصيغة المعروضة المختصرة، أو null إن لم تكن رقماً موحداً */
export function normalizeRecordNumber(value) {
  const parsed = parseRecordNumber(value);
  return parsed ? `${parsed.prefix}-${String(parsed.number).padStart(SEQUENCE_PAD, "0")}` : null;
}

/**
 * الرقم الذي يراه المستخدم لأي سجل: الرقم الموحد المختصر، وللسجلات القديمة جداً
 * (قبل نظام الترقيم) نرجع لمعرّفها القديم حتى لا يظهر فراغ.
 */
export function displayRecordNumber(record, fallback = "-") {
  const raw = record?.unifiedNumber;
  const normalized = normalizeRecordNumber(raw);
  if (normalized) return normalized;
  if (raw) return String(raw);
  return String(record?.issueId || record?.id || fallback);
}

/**
 * نص البحث الخاص برقم السجل: يشمل الصيغة المعروضة وبدون شرطة والمخزّنة والرقم الأصلي
 * (قبل تصنيف PM) والمعرّف القديم، فيجد البحث "BR-012" و"br012" و"012" وكذلك السجلات القديمة.
 */
export function recordNumberSearchText(record) {
  const parts = [];
  const push = (value) => {
    if (value === undefined || value === null || value === "") return;
    const text = String(value);
    parts.push(text);
    const normalized = normalizeRecordNumber(text);
    if (normalized) parts.push(normalized, normalized.replace("-", ""));
  };
  push(record?.unifiedNumber);
  push(record?.originalUnifiedNumber);
  push(record?.issueId);
  return parts.join(" ");
}
