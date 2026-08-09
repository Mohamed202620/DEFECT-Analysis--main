// ============================================================
// crypto.js
// أداة تشفير كلمات السر (Password Hashing)
// ============================================================
//
// ليه محتاجين الملف ده؟
// كانت كلمات السر بتتخزن Plaintext (نص عادي) في Firestore
// وبتتقارن مباشرة عند الدخول. أي حد يوصل لقاعدة البيانات (حتى
// من كونسول Firebase نفسه) كان هيشوف كل كلمات السر زي ما هي.
//
// الحل: نستخدم PBKDF2 (خوارزمية اشتقاق مفاتيح قياسية، مصممة
// خصيصاً عشان تكون بطيئة أمام هجمات التخمين/Brute-force)
// المتوفرة أصلاً داخل كل متصفح عبر SubtleCrypto (window.crypto.subtle)
// - مفيش أي حاجة تتحمّل من الإنترنت، ومفيش أي مكتبة جديدة.
//
// كل مستخدم بياخد "Salt" عشوائي مختلف، فلو 2 مستخدمين عندهم
// نفس كلمة السر، الـ Hash النهائي هيبقى مختلف تماماً - وده
// بيمنع هجمات جداول Rainbow Tables.
//
// ملحوظة مهمة (حدود هذا الحل):
// التطبيق الحالي بيوصل لـ Firestore مباشرة من المتصفح (بدون
// باك-إند وسيط أو Firebase Authentication)، فالتحقق النهائي من
// كلمة السر لازم يحصل في المتصفح. تشفير الـ Hash بيحمي البيانات
// لو اتسربت قاعدة البيانات أو شافها حد من كونسول Firebase، لكنه
// مش بديل كامل عن Firebase Authentication + Security Rules
// (راجع firestore.rules والملاحظات في README لتفاصيل الخطوة
// التالية الموصى بها).
// ============================================================

const PBKDF2_ITERATIONS = 150000;
const HASH_ALGORITHM = "SHA-256";
const SALT_BYTES = 16;

/**
 * تحويل ArrayBuffer إلى نص Hex قابل للتخزين في Firestore
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * تحويل نص Hex المخزّن مرة أخرى إلى Uint8Array
 */
function hexToBuffer(hex) {
  const clean = String(hex || "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * توليد Salt عشوائي جديد (لكل مستخدم عند التسجيل)
 * @returns {string} Salt بصيغة Hex
 */
export function generateSalt() {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes);
}

/**
 * اشتقاق Hash لكلمة السر باستخدام PBKDF2 + Salt
 * @param {string} password كلمة السر الأصلية (نص عادي - مؤقتاً في الذاكرة فقط)
 * @param {string} saltHex الـ Salt الخاص بالمستخدم (Hex)
 * @returns {Promise<string>} الـ Hash النهائي بصيغة Hex (يُخزَّن بدل كلمة السر)
 */
export async function hashPassword(password, saltHex) {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(password || "")),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuffer(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM
    },
    keyMaterial,
    256 // 256 بت = 32 بايت
  );

  return bufferToHex(derivedBits);
}

/**
 * التحقق من كلمة سر مُدخلة مقابل Hash مخزّن
 * @param {string} password كلمة السر اللي كتبها المستخدم عند الدخول
 * @param {string} saltHex الـ Salt المخزّن مع هذا المستخدم
 * @param {string} storedHash الـ Hash المخزّن في Firestore
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, saltHex, storedHash) {
  if (!saltHex || !storedHash) return false;

  const computedHash = await hashPassword(password, saltHex);

  // مقارنة بطول ثابت قدر الإمكان لتقليل مخاطر Timing Attacks
  if (computedHash.length !== storedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }

  return diff === 0;
}
