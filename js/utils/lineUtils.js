// ============================================================
// lineUtils.js
// مصدر موحّد لمعالجة وتطبيع "خط الإنتاج" (Line) في التطبيق كله.
//
// القيمة المخزّنة المعيارية = "1" أو "2" فقط (أو "" لو غير محدد)،
// والعرض/التكامل مع باقي مسارات التطبيق (البلاغات/الكايزن/فاحص
// الأعطال) بيستخدم نفس التسمية المستعملة أصلاً في كل الفورمات:
// "Line 1" / "Line 2" (راجع issueView.js / suggestionView.js /
// errorScanner.js: LINE_OPTIONS) - يعني مفيش منطق جديد أو مختلف
// للـQR، نفس الحقل ونفس القيم ونفس المسار بالظبط.
//
// normalizeLine() بتقبل كل الصيغ المتداولة في البيانات القديمة
// والـQR المطبوع مسبقاً ("1" / 1 / "01" / "Line 1" / "line-1" /
// "L1" / "خط 1" / "خط الإنتاج 1" / الأرقام العربية "١") وبترجّعها
// كلها لنفس القيمة المعيارية، عشان مقارنة الخطوط تبقى موثوقة من
// أي مصدر.
// ============================================================

/**
 * تحويل الأرقام العربية/الفارسية إلى أرقام لاتينية
 * @param {*} value
 * @returns {string}
 */
export function normalizeDigits(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

/**
 * تطبيع قيمة خط الإنتاج إلى "1" أو "2" فقط.
 * أي قيمة غير معروفة أو فارغة أو غير محددة تُرجع "" (بدون افتراض
 * خاطئ لخط معيّن - نفس فلسفة normalizeDepartment).
 *
 * @param {*} value
 * @returns {"1" | "2" | ""}
 */
export function normalizeLine(value) {
  if (value == null) return "";

  const str = normalizeDigits(value).trim().toLowerCase();
  if (!str) return "";

  // الأرقام الموجودة داخل النص ("Line 1" -> "1"، "خط 2" -> "2")
  const digits = str.replace(/[^0-9]/g, "");

  if (digits === "1" || digits === "01") return "1";
  if (digits === "2" || digits === "02") return "2";

  return "";
}

/**
 * التسمية المعروضة/المخزّنة في باقي مسارات التطبيق (البلاغات
 * والكايزن بتخزّن "Line 1"/"Line 2" نصاً) - نفس الصيغة بالظبط
 * عشان أي قيمة جاية من الماكينة/الـQR تفضل متوافقة مع الفلاتر
 * والإحصائيات الحالية بدون أي تحويل إضافي.
 *
 * @param {*} value
 * @returns {string} "Line 1" | "Line 2" | ""
 */
export function formatLineLabel(value) {
  const line = normalizeLine(value);
  return line ? `Line ${line}` : "";
}

/**
 * استخراج خط الإنتاج من مستند ماكينة (Firestore) أو من الكاش أو من
 * حمولة QR، بمرونة على اسم الحقل - نفس أسلوب extractMachineDepartment
 * في departmentUtils.js.
 *
 * @param {Object|string|number} machine
 * @returns {"1" | "2" | ""}
 */
export function extractMachineLine(machine) {
  if (machine == null) return "";
  if (typeof machine !== "object") return normalizeLine(machine);

  const candidateFields = [
    machine.line,
    machine.Line,
    machine.lineNumber,
    machine.line_number,
    machine.productionLine,
    machine.production_line,
    machine.lineNo,
    machine.l
  ];

  for (const candidate of candidateFields) {
    const normalized = normalizeLine(candidate);
    if (normalized) return normalized;
  }

  return "";
}
