// ============================================================
// phoneUtils.js
// تطبيع أرقام الهاتف (عربي/هندي/فارسي/دولي) لمصدر هوية موحّد.
//
// رقم الموبايل هو معرّف الدخول (بيتحوّل لإيميل داخلي لـ Firebase Auth).
// قبل التطبيع كان:
//   - الأرقام العربية (٠١٢٣…) بتتحذف بالكامل (replace(/\D/g,"")) فينتج
//     إيميل فاضي ويفشل الدخول برسالة مضللة.
//   - 0100… و+20100… و0020100… بتتحول لإيميلات مختلفة = حسابات مكررة
//     لنفس الشخص.
//
// الصيغة القياسية (canonical) للأرقام المصرية: 01XXXXXXXXX (11 رقم).
// أي رقم غير مصري بيفضل أرقامه الدولية بدون + أو 00.
//
// ⚠️ نفس المنطق بالظبط مكرر في functions/legacyAuth.js (السيرفر) - أي
// تعديل هنا لازم يتنقل هناك (في اختبار مقارنة في tests/).
// ============================================================

const AUTH_EMAIL_DOMAIN = "maintenance-defect-system.local";

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** تحويل أي أرقام عربية/هندية/فارسية/عرض كامل لأرقام ASCII */
export function toAsciiDigits(input) {
  return String(input ?? "")
    .replace(/[٠-٩]/g, ch => String(ARABIC_INDIC.indexOf(ch)))
    .replace(/[۰-۹]/g, ch => String(EXTENDED_ARABIC_INDIC.indexOf(ch)))
    .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10));
}

/**
 * تطبيع رقم هاتف.
 * @param {*} phone
 * @returns {{ ok: boolean, canonical: string, reason?: string }}
 */
export function normalizePhone(phone) {
  let digits = toAsciiDigits(phone).replace(/\D/g, "");

  if (!digits) {
    return { ok: false, canonical: "", reason: "empty" };
  }

  // بادئة الاتصال الدولي 00
  if (digits.startsWith("00")) digits = digits.slice(2);

  // مصري: 20 + 10 أرقام (1XXXXXXXXX) -> 01XXXXXXXXX
  if (digits.startsWith("20") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith("1")) {
    // مصري بدون الصفر الأول
    digits = "0" + digits;
  }

  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, canonical: digits, reason: "length" };
  }

  return { ok: true, canonical: digits };
}

/** إيميل Firebase Auth الداخلي للصيغة القياسية للرقم ("" لو الرقم غير صالح) */
export function phoneToCanonicalAuthEmail(phone) {
  const { ok, canonical } = normalizePhone(phone);
  return ok ? `${canonical}@${AUTH_EMAIL_DOMAIN}` : "";
}

/**
 * الإيميل بالطريقة القديمة (كل ما ليس رقم ASCII بيتحذف) - بنجرّبه عند
 * الدخول كاحتياطي لحسابات اتسجّلت قبل التطبيع بصيغة مختلفة.
 */
export function phoneToLegacyAuthEmail(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? `${digits}@${AUTH_EMAIL_DOMAIN}` : "";
}

/**
 * قائمة إيميلات الدخول المحتملة بالترتيب (القياسي أولاً)، بدون تكرار.
 * بتغطي: الصيغة القياسية، الصيغة القديمة كما كُتبت، وصيغ شائعة للرقم
 * المصري (0100… / 20100… / +20100…) لحسابات اتسجّلت بصيغ مختلفة قديماً.
 */
export function phoneAuthEmailCandidates(phone) {
  const out = [];
  const push = (email) => { if (email && !out.includes(email)) out.push(email); };

  const { ok, canonical } = normalizePhone(phone);
  if (ok) {
    push(`${canonical}@${AUTH_EMAIL_DOMAIN}`);
  }
  push(phoneToLegacyAuthEmail(toAsciiDigits(phone)));
  push(phoneToLegacyAuthEmail(phone));

  if (ok && /^01\d{9}$/.test(canonical)) {
    const intl = "20" + canonical.slice(1);
    push(`${intl}@${AUTH_EMAIL_DOMAIN}`);
    push(`${canonical.slice(1)}@${AUTH_EMAIL_DOMAIN}`);
  }
  return out;
}

/**
 * قيم الهاتف المحتملة المخزّنة في users.phone لنفس الشخص (للبحث/كشف التكرار).
 */
export function phoneStorageVariants(phone) {
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  const raw = String(phone ?? "").trim();
  push(raw);
  const ascii = toAsciiDigits(raw).trim();
  push(ascii);
  const { ok, canonical } = normalizePhone(raw);
  if (ok) {
    push(canonical);
    if (/^01\d{9}$/.test(canonical)) {
      push("20" + canonical.slice(1));
      push("+20" + canonical.slice(1));
      push(canonical.slice(1));
    }
  }
  return out;
}

export { AUTH_EMAIL_DOMAIN };
