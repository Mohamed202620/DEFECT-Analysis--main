// ============================================================
// functions/legacyAuth.js
// أدوات ترحيل حسابات النظام القديم (قبل Firebase Authentication).
// الملف كان مفقودًا من المستودع (require("./legacyAuth") في index.js كان
// بيكسر تحميل كل الدوال). أُعيد بناؤه من:
//   - js/services/crypto.js (PBKDF2-SHA256، 150000 تكرار، salt hex 16 بايت،
//     مشتق 32 بايت بصيغة hex)
//   - استخدامات index.js: phoneToAuthEmail / hasLegacySecrets /
//     verifyLegacyPassword / stripLegacySecrets / LEGACY_SECRET_FIELDS
// ⚠️ تطبيع الهاتف هنا لازم يطابق js/utils/phoneUtils.js حرفيًا.
// ============================================================

const crypto = require("crypto");

const AUTH_EMAIL_DOMAIN = "maintenance-defect-system.local";
const PBKDF2_ITERATIONS = 150000;
const PBKDF2_DIGEST = "sha256";
const PBKDF2_KEYLEN = 32;

// الحقول السرية اللي كانت بتتخزن في مستند المستخدم القديم
const LEGACY_SECRET_FIELDS = ["password", "passwordHash", "salt"];

function toAsciiDigits(input) {
  return String(input == null ? "" : input)
    .replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)))
    .replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch)))
    .replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}

function normalizePhone(phone) {
  let digits = toAsciiDigits(phone).replace(/\D/g, "");
  if (!digits) return { ok: false, canonical: "" };
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = "0" + digits;
  }
  if (digits.length < 8 || digits.length > 15) return { ok: false, canonical: digits };
  return { ok: true, canonical: digits };
}

/** إيميل Auth الداخلي بالصيغة القياسية للرقم ("" ... لو غير صالح، يرجع القديم) */
function phoneToAuthEmail(phone) {
  const { ok, canonical } = normalizePhone(phone);
  if (ok) return `${canonical}@${AUTH_EMAIL_DOMAIN}`;
  const legacy = String(phone == null ? "" : phone).replace(/\D/g, "");
  return `${legacy}@${AUTH_EMAIL_DOMAIN}`;
}

/** قيم users.phone المحتملة لنفس الشخص (للبحث عن المستندات القديمة) - Firestore "in" حد أقصى 10 */
function phoneStorageVariants(phone) {
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  const raw = String(phone == null ? "" : phone).trim();
  push(raw);
  push(toAsciiDigits(raw).trim());
  const { ok, canonical } = normalizePhone(raw);
  if (ok) {
    push(canonical);
    if (/^01\d{9}$/.test(canonical)) {
      push("20" + canonical.slice(1));
      push("+20" + canonical.slice(1));
      push(canonical.slice(1));
    }
  }
  return out.slice(0, 10);
}

function hasLegacySecrets(data) {
  if (!data || typeof data !== "object") return false;
  const hasHash = typeof data.passwordHash === "string" && data.passwordHash.length > 0 &&
    typeof data.salt === "string" && data.salt.length > 0;
  const hasPlain = typeof data.password === "string" && data.password.length > 0;
  return hasHash || hasPlain;
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** التحقق من كلمة السر القديمة (PBKDF2 أو Plaintext للحسابات القديمة جدًا) */
function verifyLegacyPassword(password, data) {
  if (!hasLegacySecrets(data) || typeof password !== "string") return false;

  if (data.passwordHash && data.salt) {
    if (!/^[0-9a-f]+$/i.test(data.salt) || data.salt.length % 2 !== 0) return false;
    const derived = crypto
      .pbkdf2Sync(password, Buffer.from(data.salt, "hex"), PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
      .toString("hex");
    return timingSafeEqualStr(derived, String(data.passwordHash).toLowerCase());
  }

  if (typeof data.password === "string") {
    return timingSafeEqualStr(data.password, password);
  }
  return false;
}

/** نسخة من المستند بدون الحقول السرية */
function stripLegacySecrets(data) {
  const out = { ...(data || {}) };
  LEGACY_SECRET_FIELDS.forEach((f) => delete out[f]);
  return out;
}

module.exports = {
  AUTH_EMAIL_DOMAIN,
  LEGACY_SECRET_FIELDS,
  normalizePhone,
  phoneToAuthEmail,
  phoneStorageVariants,
  hasLegacySecrets,
  verifyLegacyPassword,
  stripLegacySecrets
};
