// ============================================================
// lineUtils.js
// أدوات موحّدة للتعامل مع أسماء خطوط الإنتاج أو خطوط العمل
// الهدف: توحيد القيم وتفادي الأخطاء الناتجة عن تنسيقات مختلفة
// ============================================================

/**
 * تطبيع اسم الخط أو القيمة المرتبطة به إلى نص نظيف ومتسق.
 * مثال: "Line 1" -> "Line 1"
 * "line_1" -> "line 1"
 * "  خط 1  " -> "خط 1"
 *
 * @param {*} value
 * @returns {string}
 */
export function normalizeLine(value) {
  if (value == null) return "";

  const str = String(value).trim();
  if (!str) return "";

  return str
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * استخراج اسم الخط من كائن أو سجل معين.
 * يبحث في الحقول المحتملة الشائعة: line, productionLine, workLine,
 * lineName, machineLine, line_number, lineNumber
 *
 * @param {Object} record
 * @param {string[]} [fields]
 * @returns {string}
 */
export function extractLineName(record, fields = [
  "line",
  "productionLine",
  "workLine",
  "lineName",
  "machineLine",
  "line_number",
  "lineNumber",
  "line_id",
  "lineId"
]) {
  if (!record || typeof record !== "object") return "";

  for (const field of fields) {
    const value = record[field];
    const normalized = normalizeLine(value);
    if (normalized) return normalized;
  }

  return "";
}

/**
 * استخراج رقم الخط من قيمة رقمية أو نصية.
 * يحاول استخراج الأرقام فقط من النص مثل: "Line 12" -> "12"
 *
 * @param {*} value
 * @returns {string}
 */
export function extractLineNumber(value) {
  if (value == null) return "";

  const str = String(value).trim();
  if (!str) return "";

  const match = str.match(/\d+/);
  return match ? match[0] : "";
}

/**
 * إرجاع اسم الخط بشكل آمن لو كان موجودًا، وإلا ترجع نصًا فارغًا.
 *
 * @param {Object|string|null|undefined} value
 * @returns {string}
 */
export function safeLineName(value) {
  if (!value) return "";

  if (typeof value === "string") return normalizeLine(value);

  if (typeof value === "object") {
    return extractLineName(value);
  }

  return normalizeLine(value);
}

export default {
  normalizeLine,
  extractLineName,
  extractLineNumber,
  safeLineName
};
