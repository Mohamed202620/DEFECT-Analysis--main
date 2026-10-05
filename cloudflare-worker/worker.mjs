// ============================================================
// Cloudflare Worker - بديل مجاني لـ Firebase Cloud Functions (خطة Spark)
// ============================================================
// بروتوكول التطبيق: POST /<اسم_الدالة> بـ {data:{...}} ويرجع {result:{...}} أو {error:{message,status}}
//
// دوال بتتطلب تسجيل دخول (Authorization: Bearer <Firebase ID token>):
//   - uploadImageViaImgbb      رفع صورة لـ ImgBB (المفتاح سر هنا فقط)
//   - registerEmployeeCode     تسجيل كود الموظف مجزّأً (hash) وقت إنشاء الحساب (مرة واحدة لكل حساب)
//   - migrateEmployeeCodes     (Admin) نقل أكواد الموظفين القديمة من users إلى مجموعة مغلقة
//   - deleteUserAccount        (Admin) حذف حساب Auth + مستند المستخدم
//   - updateUserRoleAccount    (Admin) تغيير دور، بحماية "آخر Admin"
// دالة عامة (بدون تسجيل دخول):
//   - resetPasswordWithEmployeeCode  المستخدم نفسه يغيّر كلمة سره برقم هاتفه + كود الموظف
//
// خصوصية: لا يوجد مسار يعيّن فيه الأدمن كلمة سر لمستخدم. كود الموظف لا يُخزَّن في مستند
// users (مقروء لمستخدمين آخرين)؛ بيتخزن هاش في userSecrets/{uid} وده مقفول على العملاء بالكامل.
//
// Secrets / Variables المطلوبة (Settings -> Variables and Secrets):
//   SERVICE_ACCOUNT_JSON  (Secret)  محتوى ملف مفتاح حساب الخدمة كاملاً
//   IMGBB_API_KEY         (Secret)  مفتاح ImgBB
//   FIREBASE_PROJECT_ID   (Text)    مثال: maintenance-defect-system
//   ALLOWED_ORIGINS       (Text, اختياري) نطاقات مفصولة بفواصل
// ============================================================

const DEFAULT_ORIGINS = [
  "https://maintenance-defect-system.web.app",
  "https://maintenance-defect-system.firebaseapp.com",
  "https://my-dev-2026.web.app",
  "https://my-dev-2026.firebaseapp.com",
  "http://localhost:3000"
];

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const AUTH_EMAIL_DOMAIN = "maintenance-defect-system.local";

// ---------- تطبيع الهاتف/الكود (مطابق لـ js/utils/phoneUtils.js وfunctions/legacyAuth.js) ----------
const toAsciiDigits = (input) => String(input == null ? "" : input)
  .replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)))
  .replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch)))
  .replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));

export function normalizePhone(phone) {
  let d = toAsciiDigits(phone).replace(/\D/g, "");
  if (!d) return { ok: false, canonical: "" };
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length === 12) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  if (d.length < 8 || d.length > 15) return { ok: false, canonical: d };
  return { ok: true, canonical: d };
}

export function phoneVariants(phone) {
  const out = []; const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  const raw = String(phone == null ? "" : phone).trim();
  push(raw); push(toAsciiDigits(raw).trim());
  const { ok, canonical } = normalizePhone(raw);
  if (ok) {
    push(canonical);
    if (/^01\d{9}$/.test(canonical)) { push("20" + canonical.slice(1)); push("+20" + canonical.slice(1)); push(canonical.slice(1)); }
  }
  return out.slice(0, 10);
}

// كود الموظف: أرقام عربية->إنجليزية، بدون مسافات/شرطات، حروف كبيرة
export const normalizeCode = (code) => toAsciiDigits(code).trim().toUpperCase().replace(/[\s-]+/g, "");

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256Hex = async (str) => toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)));
const hashCode = (code, saltHex) => sha256Hex(`${saltHex}:${code}`);
const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

// ---------- base64url ----------
const b64urlToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes) => {
  let bin = ""; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const strToB64url = (s) => bytesToB64url(new TextEncoder().encode(s));
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// ---------- التحقق من Firebase ID token ----------
let jwksCache = { keys: null, at: 0 };

async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new HttpError(503, "UNAVAILABLE", "تعذّر جلب مفاتيح التحقق.");
  const { keys } = await res.json();
  jwksCache = { keys, at: Date.now() };
  return keys;
}

export async function verifyIdToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "UNAUTHENTICATED", "يجب تسجيل الدخول أولاً.");
  let header, payload;
  try { header = b64urlToJson(parts[0]); payload = b64urlToJson(parts[1]); }
  catch { throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح."); }

  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`
      || !payload.sub || typeof payload.sub !== "string"
      || payload.exp <= now - 5 || payload.iat > now + 300) {
    throw new HttpError(401, "UNAUTHENTICATED", "انتهت الجلسة، سجّل الدخول مرة أخرى.");
  }
  return payload; // payload.sub = uid
}

// ---------- OAuth لحساب الخدمة ----------
let tokenCache = { value: null, exp: 0 };

async function getAccessToken(env) {
  if (tokenCache.value && Date.now() < tokenCache.exp - 60_000) return tokenCache.value;

  let sa;
  try { sa = JSON.parse(env.SERVICE_ACCOUNT_JSON); }
  catch { throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (SERVICE_ACCOUNT_JSON)."); }

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${strToB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${strToB64url(JSON.stringify(claim))}`;

  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${bytesToB64url(sig)}`
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error("oauth failed", res.status, json.error);
    throw new HttpError(500, "INTERNAL", "تعذّر الاتصال بخدمات Google من السيرفر.");
  }
  tokenCache = { value: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
  return json.access_token;
}

// ---------- Firestore REST ----------
const fsBase = (env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const authHeaders = async (env) => ({ Authorization: `Bearer ${await getAccessToken(env)}`, "Content-Type": "application/json" });
const strField = (f) => (f && typeof f.stringValue === "string" ? f.stringValue : "");

async function getUserDoc(env, uid) {
  const res = await fetch(`${fsBase(env)}/users/${encodeURIComponent(uid)}`, { headers: await authHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّرت قراءة بيانات المستخدم.");
  const f = (await res.json()).fields || {};
  return { role: strField(f.role), status: strField(f.status), name: strField(f.name), permissions: strField(f.permissions) };
}

async function countOtherActiveAdmins(env, excludeUid) {
  const res = await fetch(`${fsBase(env)}:runQuery`, {
    method: "POST",
    headers: await authHeaders(env),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "role" }, op: "EQUAL", value: { stringValue: "admin" } } },
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } }
        ] } },
        select: { fields: [{ fieldPath: "__name__" }] },
        limit: 5
      }
    })
  });
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّر التحقق من عدد المسؤولين.");
  const rows = await res.json();
  return rows.filter((r) => r.document && !r.document.name.endsWith(`/users/${excludeUid}`)).length;
}

async function requireActiveAdmin(env, uid) {
  const me = await getUserDoc(env, uid);
  if (!me || me.role !== "admin" || me.status !== "active") {
    throw new HttpError(403, "PERMISSION_DENIED", "هذه العملية مقصورة على Admin فقط.");
  }
  return me;
}

async function identityToolkit(env, action, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:${action}`, {
    method: "POST", headers: await authHeaders(env), body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, message: json?.error?.message || "", body: json };
}

// ---------- Firestore: أدوات إضافية (commit / runQuery عام / حد المحاولات الذري) ----------
const docName = (env, path) => `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

async function fsGetFields(env, path) {
  const res = await fetch(`${fsBase(env)}/${path}`, { headers: await authHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّرت قراءة البيانات.");
  return (await res.json()).fields || {};
}

async function fsCommit(env, writes) {
  const res = await fetch(`${fsBase(env)}:commit`, { method: "POST", headers: await authHeaders(env), body: JSON.stringify({ writes }) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new HttpError(res.status === 409 ? 409 : 500, res.status === 409 ? "ALREADY_EXISTS" : "INTERNAL", "تعذّر حفظ البيانات.");
    e.firestoreStatus = err?.error?.status || res.status;
    throw e;
  }
  return res.json();
}

async function fsRunQuery(env, structuredQuery) {
  const res = await fetch(`${fsBase(env)}:runQuery`, { method: "POST", headers: await authHeaders(env), body: JSON.stringify({ structuredQuery }) });
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّر تنفيذ الاستعلام.");
  return (await res.json()).filter((r) => r.document).map((r) => ({
    id: r.document.name.split("/").pop(), fields: r.document.fields || {}
  }));
}

const incrementWrite = (env, path, field, by) => ({
  transform: { document: docName(env, path), fieldTransforms: [{ fieldPath: field, increment: { integerValue: String(by) } }] }
});

/**
 * حد محاولات ذري (بدون KV): عدّاد في Firestore بيتزوّد قبل التحقق (increment transform ذري)،
 * فمستحيل طلبات متوازية تتجاوز الحد. لو تجاوز الحد بنرجّع العدّاد (-1) عشان المحاولات
 * المرفوضة ماتمدّدش الحظر. النافذة بتتجدد بعد windowMs.
 */
async function consumeBudget(env, key, limit, windowMs) {
  const path = `resetAttempts/${key}`;
  const now = Date.now();
  const f = await fsGetFields(env, path);
  const windowStart = f ? Number(f.windowStart?.integerValue || 0) : 0;
  let start = windowStart;
  if (!f || now - windowStart >= windowMs) {
    start = now;
    await fsCommit(env, [{ update: { name: docName(env, path), fields: { windowStart: { integerValue: String(now) }, n: { integerValue: "0" } } } }]);
  }
  const res = await fsCommit(env, [incrementWrite(env, path, "n", 1)]);
  const n = Number(res.writeResults?.[0]?.transformResults?.[0]?.integerValue || 0);
  if (n > limit) {
    await fsCommit(env, [incrementWrite(env, path, "n", -1)]).catch(() => {});
    return { ok: false, retryAfterMs: Math.max(0, start + windowMs - now) };
  }
  return { ok: true, path };
}

const waitText = (ms) => {
  const h = Math.ceil(ms / 3600_000);
  return h <= 1 ? "بعد ساعة تقريبًا" : `بعد ${h} ساعة تقريبًا`;
};

// ---------- المعالجات ----------
const handlers = {
  // تسجيل كود الموظف مجزّأً (مرة واحدة لكل حساب). بيتنادى وقت إنشاء الحساب بتوكن الحساب الجديد.
  async registerEmployeeCode(data, caller, env) {
    const code = normalizeCode(data?.code);
    if (code.length < 3 || code.length > 40) throw new HttpError(400, "INVALID_ARGUMENT", "كود الموظف يجب أن يكون بين ٣ و٤٠ حرفًا.");
    const salt = randomHex(16);
    try {
      await fsCommit(env, [{
        update: { name: docName(env, `userSecrets/${caller}`), fields: {
          codeHash: { stringValue: await hashCode(code, salt) },
          salt: { stringValue: salt },
          createdAt: { stringValue: new Date().toISOString() }
        } },
        currentDocument: { exists: false }
      }]);
    } catch (e) {
      if (e.code === "ALREADY_EXISTS" || e.firestoreStatus === "ALREADY_EXISTS" || e.firestoreStatus === "FAILED_PRECONDITION") {
        throw new HttpError(409, "ALREADY_EXISTS", "كود الموظف مسجل بالفعل لهذا الحساب.");
      }
      throw e;
    }
    return { status: "success" };
  },

  // (Admin) نقل أكواد الموظفين القديمة من مستندات users (مقروءة لمستخدمين آخرين) إلى userSecrets (مغلقة)
  async migrateEmployeeCodes(_data, caller, env) {
    await requireActiveAdmin(env, caller);
    const LIMIT = 400;
    const users = await fsRunQuery(env, {
      from: [{ collectionId: "users" }],
      select: { fields: [{ fieldPath: "code" }] },
      limit: LIMIT
    });
    const withCode = users.filter((u) => strField(u.fields.code).trim());
    const existing = new Set((await fsRunQuery(env, {
      from: [{ collectionId: "userSecrets" }], select: { fields: [{ fieldPath: "__name__" }] }, limit: 1000
    })).map((x) => x.id));

    const writes = []; let created = 0;
    for (const u of withCode) {
      if (!existing.has(u.id)) {
        const code = normalizeCode(strField(u.fields.code));
        if (code.length >= 1) {
          const salt = randomHex(16);
          writes.push({ update: { name: docName(env, `userSecrets/${u.id}`), fields: {
            codeHash: { stringValue: await hashCode(code, salt) }, salt: { stringValue: salt },
            createdAt: { stringValue: new Date().toISOString() }, migrated: { booleanValue: true }
          } }, currentDocument: { exists: false } });
          created++;
        }
      }
      // حذف حقل code من مستند المستخدم (updateMask بدون الحقل = حذفه)
      writes.push({ update: { name: docName(env, `users/${u.id}`), fields: {} }, updateMask: { fieldPaths: ["code"] }, currentDocument: { exists: true } });
    }
    for (let i = 0; i < writes.length; i += 400) await fsCommit(env, writes.slice(i, i + 400));
    return { status: "success", secretsCreated: created, codeFieldsRemoved: withCode.length, more: users.length >= LIMIT };
  },

  async deleteUserAccount(data, caller, env) {
    const { userId } = data || {};
    if (!userId || typeof userId !== "string" || userId.length > 128) throw new HttpError(400, "INVALID_ARGUMENT", "معرف المستخدم غير صالح.");
    await requireActiveAdmin(env, caller);

    const target = await getUserDoc(env, userId);
    if (target && target.role === "admin" && target.status === "active"
        && (await countOtherActiveAdmins(env, userId)) === 0) {
      throw new HttpError(412, "FAILED_PRECONDITION", "لا يمكن حذف هذا المستخدم لأنه آخر Admin نشط في النظام.");
    }

    if (target) {
      const del = await fetch(`${fsBase(env)}/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: await authHeaders(env) });
      if (!del.ok && del.status !== 404) throw new HttpError(500, "INTERNAL", "تعذّر حذف بيانات المستخدم.");
    }
    const r = await identityToolkit(env, "delete", { localId: userId });
    if (!r.ok && !r.message.includes("USER_NOT_FOUND")) {
      console.error("auth delete failed", r.message);
      throw new HttpError(500, "INTERNAL", "تم حذف بيانات المستخدم لكن تعذّر حذف حساب الدخول.");
    }
    return { status: "success" };
  },

  async updateUserRoleAccount(data, caller, env) {
    const { userId, role, permissions } = data || {};
    if (!userId || typeof userId !== "string" || userId.length > 128) throw new HttpError(400, "INVALID_ARGUMENT", "معرف المستخدم غير صالح.");
    if (!role || typeof role !== "string" || !["admin", "manager", "supervisor", "engineer", "technician", "operator"].includes(role)) {
      throw new HttpError(400, "INVALID_ARGUMENT", "الدور الجديد غير صالح.");
    }
    const me = await requireActiveAdmin(env, caller);
    const target = await getUserDoc(env, userId);
    if (!target) throw new HttpError(404, "NOT_FOUND", "المستخدم غير موجود.");

    if (target.role === "admin" && target.status === "active" && role !== "admin"
        && (await countOtherActiveAdmins(env, userId)) === 0) {
      throw new HttpError(412, "FAILED_PRECONDITION", "لا يمكن تغيير دور هذا المستخدم لأنه آخر Admin نشط في النظام.");
    }

    const perms = typeof permissions === "string" ? permissions.slice(0, 2000) : target.permissions;
    const mask = ["role", "permissions", "updatedAt", "updatedBy"].map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await fetch(`${fsBase(env)}/users/${encodeURIComponent(userId)}?${mask}&currentDocument.exists=true`, {
      method: "PATCH",
      headers: await authHeaders(env),
      body: JSON.stringify({ fields: {
        role: { stringValue: role },
        permissions: { stringValue: perms },
        updatedAt: { stringValue: new Date().toISOString() },
        updatedBy: { stringValue: me.name || "Admin" }
      } })
    });
    if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّر تحديث الدور.");
    return { status: "success" };
  }
};

// رفع الصور: الجسم (multipart) بيتمرّر لـ ImgBB كما هو بدون تحليل (CPU قليل جداً)
async function handleUpload(request, caller, env) {
  const me = await getUserDoc(env, caller);
  if (!me || me.status !== "active") throw new HttpError(403, "PERMISSION_DENIED", "الحساب غير مفعّل.");

  const len = Number(request.headers.get("content-length") || 0);
  const type = request.headers.get("content-type") || "";
  if (len > MAX_UPLOAD_BYTES) throw new HttpError(413, "INVALID_ARGUMENT", "الصورة كبيرة جدًا.");
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw new HttpError(400, "INVALID_ARGUMENT", "صيغة الطلب غير صحيحة.");
  if (!env.IMGBB_API_KEY) throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (IMGBB_API_KEY).");
  if (!request.body) throw new HttpError(400, "INVALID_ARGUMENT", "لا توجد صورة في الطلب.");

  // الأفضل: تمرير التدفق كما هو (طول معروف). لو الطول غير معروف (بدون Content-Length)
  // بنجمّع الجسم بحد أقصى 8MB بدل ما نرفض - ImgBB محتاج طول معروف للطلب.
  let upstreamBody = request.body;
  if (!len) {
    const chunks = []; let total = 0;
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BYTES) { await reader.cancel(); throw new HttpError(413, "INVALID_ARGUMENT", "الصورة كبيرة جدًا."); }
      chunks.push(value);
    }
    if (!total) throw new HttpError(400, "INVALID_ARGUMENT", "لا توجد صورة في الطلب.");
    const all = new Uint8Array(total); let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.byteLength; }
    upstreamBody = all;
  }

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, {
    method: "POST", headers: { "Content-Type": type }, body: upstreamBody, ...(len ? { duplex: "half" } : {})
  });
  const json = await res.json().catch(() => null);
  if (!json || !json.success) throw new HttpError(502, "UNAVAILABLE", "فشل رفع الصورة.");
  return { status: "success", url: json.data.display_url || json.data.url };
}


// ---------- دالة عامة: المستخدم نفسه يغيّر كلمة سره برقم هاتفه + كود الموظف ----------
const GENERIC_RESET_ERROR = "رقم الهاتف أو كود الموظف غير صحيح.";
const PHONE_ATTEMPTS = 5;             // محاولات فاشلة لكل رقم
const PHONE_WINDOW_MS = 24 * 3600_000; // كل 24 ساعة
const IP_ATTEMPTS = 40;               // طلبات لكل IP
const IP_WINDOW_MS = 3600_000;        // كل ساعة

async function resetPasswordWithEmployeeCode(data, request, env) {
  const { phone, code, newPassword } = data || {};
  const phoneInfo = normalizePhone(phone);
  const cleanCode = normalizeCode(code);
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    throw new HttpError(400, "INVALID_ARGUMENT", "كلمة السر الجديدة يجب أن تكون ٨ أحرف على الأقل.");
  }
  if (!phoneInfo.ok || cleanCode.length < 1 || cleanCode.length > 40) throw new HttpError(400, "INVALID_ARGUMENT", GENERIC_RESET_ERROR);

  // 1) حد لكل IP (يحمي من تجريب أرقام كثيرة)، 2) حد لكل رقم (يحمي من تخمين الكود)
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipBudget = await consumeBudget(env, `ip_${await sha256Hex(ip)}`, IP_ATTEMPTS, IP_WINDOW_MS);
  if (!ipBudget.ok) throw new HttpError(429, "RESOURCE_EXHAUSTED", `محاولات كثيرة من نفس الجهاز، حاول ${waitText(ipBudget.retryAfterMs)}.`);
  const phoneKey = `p_${await sha256Hex(phoneInfo.canonical)}`;
  const phoneBudget = await consumeBudget(env, phoneKey, PHONE_ATTEMPTS, PHONE_WINDOW_MS);
  if (!phoneBudget.ok) throw new HttpError(429, "RESOURCE_EXHAUSTED", `تم تجاوز عدد المحاولات لهذا الرقم، حاول ${waitText(phoneBudget.retryAfterMs)}.`);

  const candidates = await fsRunQuery(env, {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: "phone" }, op: "IN", value: { arrayValue: { values: phoneVariants(phone).map((v) => ({ stringValue: v })) } } } },
    select: { fields: [{ fieldPath: "status" }] },
    limit: 5
  });

  const expectedEmail = `${phoneInfo.canonical}@${AUTH_EMAIL_DOMAIN}`;
  for (const c of candidates) {
    const status = strField(c.fields.status);
    if (status !== "active" && status !== "pending") continue;
    const secret = await fsGetFields(env, `userSecrets/${c.id}`);
    if (!secret) continue;
    const expected = strField(secret.codeHash);
    const actual = await hashCode(cleanCode, strField(secret.salt));
    if (!expected || !safeEqual(expected, actual)) continue;

    // ربط الهوية: حساب الدخول الفعلي لازم يكون إيميله مشتقاً من نفس الرقم
    // (بيمنع مستخدماً من تسجيل مستند users برقم شخص آخر)
    const lookup = await identityToolkit(env, "lookup", { localId: [c.id] });
    const accountEmail = String(lookup.body?.users?.[0]?.email || "").toLowerCase();
    if (!lookup.ok || accountEmail !== expectedEmail) continue;

    const upd = await identityToolkit(env, "update", { localId: c.id, password: newPassword, validSince: String(Math.floor(Date.now() / 1000)) });
    if (!upd.ok) {
      console.error("reset update failed", upd.message);
      throw new HttpError(500, "INTERNAL", "تعذّر تغيير كلمة السر، حاول مرة أخرى.");
    }
    // نجاح: نصفّر عدّاد المحاولات لهذا الرقم
    await fsCommit(env, [{ delete: docName(env, `resetAttempts/${phoneKey}`) }]).catch(() => {});
    return { status: "success" };
  }
  throw new HttpError(403, "PERMISSION_DENIED", GENERIC_RESET_ERROR);
}

// ---------- CORS + التوجيه ----------
function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS);
  const origin = request.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && (path === "" || path === "health")) return json({ ok: true }, 200, cors);
    if (request.method !== "POST") return json({ error: { message: "Method not allowed", status: "INVALID_ARGUMENT" } }, 405, cors);

    try {
      if (!env.FIREBASE_PROJECT_ID) throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (FIREBASE_PROJECT_ID).");

      // دالة عامة (بدون توكن): المستخدم نسي كلمة السر فمفيش جلسة أصلاً - الحماية بحد المحاولات
      if (path === "resetPasswordWithEmployeeCode") {
        const body = await request.json().catch(() => ({}));
        return json({ result: await resetPasswordWithEmployeeCode(body.data, request, env) }, 200, cors);
      }

      const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const claims = await verifyIdToken(bearer, env.FIREBASE_PROJECT_ID);
      const caller = claims.sub;

      if (path === "uploadImageViaImgbb") {
        return json({ result: await handleUpload(request, caller, env) }, 200, cors);
      }

      const handler = handlers[path];
      if (!handler) throw new HttpError(404, "NOT_FOUND", "هذه الخدمة غير متاحة على السيرفر الحالي.");

      const body = await request.json().catch(() => ({}));
      return json({ result: await handler(body.data, caller, env) }, 200, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { message: e.message, status: e.code } }, e.status, cors);
      console.error("unhandled", e && e.message);
      return json({ error: { message: "خطأ غير متوقع في السيرفر.", status: "INTERNAL" } }, 500, cors);
    }
  }
};
