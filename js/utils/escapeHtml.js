// ============================================================
// escapeHtml.js
// أدوات موحّدة لتهريب (Escape) أي بيانات يتحكم فيها المستخدم قبل
// إدراجها داخل HTML (innerHTML / template literals) أو داخل
// خصائص HTML (attributes) أو داخل معالجات الأحداث المضمّنة (onclick).
//
// أي بيانات جاية من Firestore أو من مدخلات المستخدم (اسم، هاتف،
// وصف بلاغ، رسالة إشعار، اسم ماكينة...) لازم تعدّي من هنا قبل ما
// تتحط في HTML - ده خط الدفاع الأساسي ضد Stored XSS.
// ============================================================

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;"
};

/**
 * تهريب نص للإدراج داخل محتوى HTML أو داخل قيمة attribute بين علامات تنصيص.
 * القيم الفارغة (null/undefined) ترجع نص فارغ، والأرقام تتحول لنص.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPES[ch]);
}

// اسم بديل أوضح عند الاستخدام داخل attributes
export const escapeAttr = escapeHtml;

/**
 * تهريب قيمة نصية لتُستخدم كسلسلة JavaScript بين علامتي ' داخل معالج حدث
 * مضمّن (onclick="fn('${escapeJsArg(x)}')"). بتهرّب الـ backslash والاقتباس
 * وأسطر جديدة، وبعدين بتعدّيها على escapeHtml عشان تفضل آمنة داخل attribute.
 * @param {*} value
 * @returns {string}
 */
export function escapeJsArg(value) {
  const js = String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n")
    .replace(/</g, "\\x3C")
    .replace(/>/g, "\\x3E");
  return escapeHtml(js);
}

/**
 * يسمح فقط برابط http(s) أو data:image (للصور المعاينة) - أي بروتوكول تاني
 * (javascript: مثلاً) بيرجع نص فارغ. لازم يتطبّق على أي src/href جاي من بيانات.
 * @param {*} url
 * @returns {string}
 */
export function safeUrl(url) {
  const s = String(url ?? "").trim();
  if (/^https?:\/\//i.test(s) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) {
    return escapeHtml(s);
  }
  return "";
}

if (typeof window !== "undefined") {
  window.escapeHtml = escapeHtml;
  window.escapeJsArg = escapeJsArg;
}
